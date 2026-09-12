const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { test: base, expect } = require('@playwright/test');
const { cases, platformBootstrap } = require('./fixtures');
const { releaseId, releaseDirectory, assetBase } = require('./release');

const identityOrigin = 'https://identity.example.test';
const contentTypes = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

function readRelease() {
  const required = [
    'release-manifest.json', 'auth-theme.js', 'auth-theme.css',
    ...cases.map(item => item.template),
  ];
  for (const name of required) {
    if (!fs.existsSync(path.join(releaseDirectory, name))) {
      throw new Error(
        `Missing generated candidate: docs/releases/${releaseId}/${name}. `
        + 'After auth/theme.js and auth/theme.css are ready, run '
        + `\`python3 scripts/build-auth-release.py --release-id ${releaseId} --with-theme\`, `
        + `then \`B2C_RELEASE_ID=${releaseId} npm run test:browser\`. Tests never use root docs/ as a fallback.`,
      );
    }
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(releaseDirectory, 'release-manifest.json'), 'utf8'));
  expect(manifest.releaseId, 'Tests must exercise the explicitly selected release').toBe(releaseId);
  const files = new Map();
  for (const [name, record] of Object.entries(manifest.files)) {
    if (name.includes('..') || path.isAbsolute(name)) throw new Error(`Unsafe manifest path: ${name}`);
    const bytes = fs.readFileSync(path.join(releaseDirectory, name));
    expect(crypto.createHash('sha256').update(bytes).digest('hex'), `Generated ${name} hash`).toBe(record.sha256);
    files.set(name, bytes);
  }
  return { files, manifest };
}

function renderTemplate(bundle, fixture) {
  const html = bundle.files.get(fixture.template).toString('utf8');
  expect(html.match(/<div id="api"><\/div>/g), 'Generated template retains a single empty #api').toHaveLength(1);
  return html.replace('<div id="api"></div>', `<div id="api">${fixture.markup}</div>${platformBootstrap}`);
}

async function attachJson(testInfo, name, data) {
  const filename = testInfo.outputPath(`${name}.json`);
  fs.writeFileSync(filename, `${JSON.stringify(data, null, 2)}\n`);
  await testInfo.attach(name, { path: filename, contentType: 'application/json' });
}

const test = base.extend({
  auth: async ({ page, context }, use, testInfo) => {
    const bundle = readRelease();
    const requests = [];
    const unexpected = [];
    const errors = [];
    let currentFixture;
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      unexpected.push(`Unexpected page/context request: ${route.request().url()}`);
      await route.abort('blockedbyclient');
    });
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      requests.push(request.url());
      if (request.method() === 'GET' && request.isNavigationRequest()
          && request.frame() === page.mainFrame() && url.origin === identityOrigin
          && url.pathname === '/authorize' && currentFixture) {
        return route.fulfill({
          status: 200, contentType: 'text/html',
          body: renderTemplate(bundle, currentFixture),
        });
      }
      if (request.method() === 'GET' && request.url().startsWith(assetBase)) {
        const name = url.pathname.slice(new URL(assetBase).pathname.length);
        const type = contentTypes[path.extname(name)];
        if (type && bundle.files.has(name)) {
          return route.fulfill({
            status: 200, contentType: type, body: bundle.files.get(name),
            headers: { 'Access-Control-Allow-Origin': '*' },
          });
        }
      }
      unexpected.push(`${request.method()} ${request.url()}`);
      return route.abort('blockedbyclient');
    });
    const auth = {
      requests,
      async open(fixture, query = '') {
        currentFixture = fixture;
        await page.goto(`${identityOrigin}/authorize${query ? `?${query}` : ''}`, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('meta[name="pageLayout"]')).toHaveAttribute('content', fixture.layout);
        await expect(page.locator('#api > .heading > h1')).toBeVisible();
        await expect(page.locator(fixture.input)).toBeVisible();
      },
    };
    await attachJson(testInfo, 'release-provenance', {
      sourceGitCommit: bundle.manifest.sourceGitCommit,
      releaseId: bundle.manifest.releaseId,
      themeScript: bundle.manifest.files['auth-theme.js'],
      themeStyles: bundle.manifest.files['auth-theme.css'],
      scope: 'Offline synthetic DOM styling/control preservation; not authentication validity.',
    });
    await use(auth);
    expect(unexpected, 'All authorization/asset requests must be fulfilled offline; no live network').toEqual([]);
    expect(errors, 'Theme code must not throw or break the synthetic platform').toEqual([]);
  },
});

function rgba(color) {
  const channels = color.match(/[\d.]+/g);
  if (!channels) throw new Error(`Expected computed rgb/rgba color, received ${color}`);
  const numbers = channels.map(Number);
  return [numbers[0], numbers[1], numbers[2], numbers[3] ?? 1];
}

function composite(foreground, background) {
  const alpha = foreground[3];
  return [...foreground.slice(0, 3).map((channel, i) => channel * alpha + background[i] * (1 - alpha)), 1];
}

function luminance(color) {
  const linear = color.slice(0, 3).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function colors(locator) {
  return locator.evaluate(element => {
    const style = getComputedStyle(element);
    const ancestors = [];
    for (let node = element; node; node = node.parentElement) {
      const computed = getComputedStyle(node);
      ancestors.unshift({
        backgroundColor: computed.backgroundColor,
        backgroundImage: computed.backgroundImage,
        opacity: computed.opacity,
      });
    }
    return {
      color: style.color, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage,
      borderColor: style.borderTopColor, borderWidth: style.borderTopWidth,
      outlineColor: style.outlineColor, outlineWidth: style.outlineWidth,
      outlineStyle: style.outlineStyle, outlineOffset: style.outlineOffset,
      boxShadow: style.boxShadow, colorScheme: style.colorScheme,
      appearance: style.appearance, ancestors,
    };
  });
}

function backgroundOf(sample, includeSelf = true) {
  const chain = includeSelf ? sample.ancestors : sample.ancestors.slice(0, -1);
  return chain.reduce((background, layer) => composite(rgba(layer.backgroundColor), background), [255, 255, 255, 1]);
}

function textContrast(sample) {
  const background = backgroundOf(sample);
  const opacity = sample.ancestors.reduce((value, layer) => value * Number(layer.opacity), 1);
  const foreground = rgba(sample.color);
  foreground[3] *= opacity;
  return contrast(composite(foreground, background), background);
}

async function pressTab(page, browserName) {
  // macOS WebKit uses Option-Tab for all controls when full keyboard access is off.
  // Keep the same reachability/visible-focus assertions on every control in both engines.
  const fullKeyboardAccess = browserName === 'webkit' && process.platform === 'darwin';
  await page.keyboard.press(fullKeyboardAccess ? 'Alt+Tab' : 'Tab');
}

async function assertTheme(page, fixture, theme, { javaScript = true } = {}) {
  if (javaScript) await expect(page.locator('html')).toHaveAttribute('data-aiman-theme', theme);
  const expectedInputBackground = await page.locator(fixture.input).evaluate(element => {
    const style = document.createElement('span').style;
    style.color = getComputedStyle(element).getPropertyValue('--aiman-input').trim();
    return style.color;
  });
  // Deferred appearance selection can start the baseline's 160ms color transition.
  await expect(page.locator(fixture.input), 'Wait for the actual computed input theme before measuring or capturing')
    .toHaveCSS('background-color', expectedInputBackground);
  const samples = {};
  for (const [name, selector] of Object.entries({
    canvas: 'body', panel: '#api', input: fixture.input, copy: '#api form > .intro',
  })) {
    samples[name] = await colors(page.locator(selector));
  }
  for (const name of ['canvas', 'panel', 'input']) {
    const brightness = luminance(backgroundOf(samples[name]));
    if (theme === 'light') {
      expect(brightness, `${name} uses a genuinely light computed surface, not just a root attribute`).toBeGreaterThan(0.75);
    } else {
      expect(brightness, `${name} uses a genuinely dark computed surface`).toBeLessThan(0.06);
    }
  }
  const copy = page.locator('#api form > .intro > p, #api form > .intro > h2').first();
  const copySample = await colors(copy);
  if (theme === 'light') {
    expect(luminance(rgba(copySample.color)), 'Light surface has dark copy').toBeLessThan(0.2);
  } else {
    expect(luminance(rgba(copySample.color)), 'Dark surface has light copy').toBeGreaterThan(0.5);
  }
  expect(textContrast(copySample), 'Intro copy contrast').toBeGreaterThanOrEqual(4.5);
  expect(samples.canvas.colorScheme).toBe(theme);
  return { ...samples, copy: copySample };
}

async function assertPlatformUntouched(page) {
  const result = await page.evaluate(() => {
    const api = document.getElementById('api');
    const state = window.__platformFixture;
    return {
      sameMarkup: api.innerHTML === state.html,
      sameNodes: state.nodes.every((node, i) => node.isConnected && node.parentElement === state.parents[i]),
      controls: state.controls.map(node => ({
        id: node.id, value: node.value, required: node.required, checked: node.checked,
        disabled: node.disabled, name: node.name, type: node.type,
      })),
      originalControls: state.controlState,
      hrefs: state.links.map(node => node.getAttribute('href')),
      originalHrefs: state.hrefs,
      sameHandlers: state.links.every(node => node.onclick === state.clickHandler)
        && state.controls.every(node => node.oninput === state.inputHandler)
        && api.querySelector('form').onsubmit === state.submitHandler,
      submits: state.submits,
    };
  });
  expect(result.sameMarkup, 'Theme must not rewrite the platform DOM').toBe(true);
  expect(result.sameNodes, 'Theme must not replace/reparent platform controls').toBe(true);
  expect(result.controls, 'Values, required/disabled flags, names and types remain platform-owned').toEqual(result.originalControls);
  expect(result.hrefs, 'Original platform link destinations remain untouched').toEqual(result.originalHrefs);
  expect(result.sameHandlers, 'Existing platform handlers remain installed').toBe(true);
  expect(result.submits, 'Tests must not submit authentication forms').toBe(0);
}

module.exports = {
  test, expect, cases, assetBase, readRelease, renderTemplate, attachJson,
  rgba, composite, luminance, contrast, colors, backgroundOf, textContrast,
  assertTheme, assertPlatformUntouched, pressTab,
};
