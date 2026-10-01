const {
  test, expect, cases, assertTheme, assertPlatformUntouched, colors, textContrast,
  rgba, composite, contrast, attachJson, readRelease, assetBase,
} = require('./harness');
const { releaseId } = require('./release');
const identity = releaseId === 'v18-aiman-identity';
const iris = releaseId === 'v19-aiman-iris';
const journey = identity || releaseId === 'v16-aiman-journey' || releaseId === 'v17-aiman-journey';

const palette = {
  light: {
    canvas: 'rgb(237, 240, 244)', panel: 'rgb(255, 255, 255)',
    fill: 'rgba(248, 250, 253, 0.74)', solid: 'rgb(238, 241, 245)',
    rim: 'rgba(255, 255, 255, 0.94)', ink: 'rgb(36, 40, 50)',
    chrome: 'rgb(70, 81, 95)', hover: 'rgb(38, 41, 55)', pressed: 'rgb(32, 35, 48)',
    backdropStops: ['rgb(255, 255, 255)', 'rgb(214, 220, 229)', 'rgb(239, 242, 246)', 'rgb(230, 234, 240)', 'rgb(245, 246, 248)'],
  },
  dark: {
    canvas: 'rgb(32, 38, 48)', panel: 'rgb(42, 49, 61)',
    fill: 'rgba(31, 38, 49, 0.84)', solid: 'rgb(37, 45, 57)',
    rim: 'rgba(205, 218, 239, 0.25)', ink: 'rgb(240, 242, 247)',
    chrome: 'rgb(185, 193, 208)', hover: 'rgb(243, 246, 252)', pressed: 'rgb(208, 215, 226)',
    backdropStops: ['rgb(60, 70, 88)', 'rgb(47, 57, 72)', 'rgb(37, 45, 57)', 'rgb(30, 37, 48)', 'rgb(40, 49, 62)'],
  },
};
if (journey) {
  Object.assign(palette.light, {
    canvas: 'rgb(250, 249, 247)', fill: 'rgb(255, 255, 255)', solid: 'rgb(255, 255, 255)',
    hover: 'rgb(24, 63, 174)', pressed: 'rgb(15, 42, 107)',
    chrome: 'rgb(75, 85, 99)', backdropStops: ['rgb(227, 234, 251)', 'rgb(250, 249, 247)'],
  });
  Object.assign(palette.dark, {
    canvas: 'rgb(17, 24, 32)', panel: 'rgb(24, 33, 44)', fill: 'rgb(24, 33, 44)', solid: 'rgb(24, 33, 44)',
    hover: 'rgb(24, 63, 174)', pressed: 'rgb(15, 42, 107)',
    chrome: 'rgb(184, 196, 212)', backdropStops: ['rgb(32, 51, 84)', 'rgb(17, 24, 32)'],
  });
}
if (identity) {
  palette.light.ink = 'rgb(17, 24, 39)';
  palette.dark.ink = 'rgb(244, 246, 250)';
}
if (iris) {
  Object.assign(palette.light, {
    canvas: 'rgb(250, 250, 252)', panel: 'rgb(255, 255, 255)',
    fill: 'rgb(255, 255, 255)', solid: 'rgb(244, 244, 249)',
    ink: 'rgb(11, 11, 18)', chrome: 'rgb(83, 83, 106)',
    hover: 'rgb(74, 47, 224)', pressed: 'rgb(58, 34, 201)',
    backdropStops: ['rgb(250, 250, 252)', 'rgb(255, 255, 255)'],
  });
  Object.assign(palette.dark, {
    canvas: 'rgb(9, 9, 14)', panel: 'rgb(18, 18, 26)',
    fill: 'rgb(18, 18, 26)', solid: 'rgb(25, 25, 36)',
    ink: 'rgb(246, 246, 251)', chrome: 'rgb(169, 169, 190)',
    hover: 'rgb(164, 151, 255)', pressed: 'rgb(122, 104, 240)',
    backdropStops: ['rgb(9, 9, 14)', 'rgb(18, 18, 26)'],
  });
}

async function material(page) {
  return page.locator('#api').evaluate(element => {
    const form = getComputedStyle(element);
    const glass = getComputedStyle(element, '::before');
    const heading = getComputedStyle(element.querySelector('h1'));
    const body = getComputedStyle(document.body);
    const action = getComputedStyle(element.querySelector('button, input[type="submit"], input[type="button"]'));
    const input = getComputedStyle(element.querySelector('input:not([type="checkbox"]), select, textarea'));
    return {
      canvas: getComputedStyle(document.body).backgroundColor,
      lighting: getComputedStyle(document.body).backgroundImage,
      panel: form.backgroundColor, panelRadius: form.borderRadius,
      glass: glass.backgroundColor, rim: glass.borderTopColor, shadow: glass.boxShadow,
      blur: glass.backdropFilter || glass.webkitBackdropFilter,
      logo: glass.backgroundImage, mask: glass.maskImage || glass.webkitMaskImage,
      glassRadius: glass.borderRadius,
      font: heading.fontFamily, weight: heading.fontWeight, letterSpacing: heading.letterSpacing,
      bodyFont: body.fontFamily, buttonRadius: action.borderRadius,
      inputRadius: input.borderRadius,
      transparentForms: [...element.querySelectorAll('form, .error, input:not([type="checkbox"]), select, textarea')]
        .filter(node => node.getClientRects().length)
        .filter(node => getComputedStyle(node).backdropFilter !== 'none'
          && getComputedStyle(node).webkitBackdropFilter !== 'none'
          && (getComputedStyle(node).backdropFilter || getComputedStyle(node).webkitBackdropFilter))
        .map(node => node.id || node.tagName),
    };
  });
}

for (const theme of ['light', 'dark']) {
  for (const fixture of cases) {
    test(`${fixture.name}: ${theme} approved materials, typography and opaque validation`, async ({ page, auth }, testInfo) => {
      await auth.open(fixture, `aiman_theme=${theme}`);
      await assertTheme(page, fixture, theme);
      await assertPlatformUntouched(page);
      const value = await material(page);
      const expected = palette[theme];
      expect(value.canvas).toBe(expected.canvas);
      expect(value.panel).toBe(expected.panel);
      if (iris) {
        expect(value.glass).toBe(expected.ink);
        expect(value.mask).toContain('/aiman.svg');
        expect(value.logo).toBe('none');
        expect(value.blur).toBe('none');
        expect(value.shadow).toBe('none');
        expect(value.panelRadius).toBe('22px');
        expect(auth.requests.some(url => url.endsWith('/aiman.svg'))).toBe(true);
      } else if (identity) {
        expect(value.glass).toBe(expected.ink);
        expect(value.mask).toContain('/aiman.svg');
        expect(value.logo).toBe('none');
        expect(value.blur).toBe('none');
        expect(value.shadow).toBe('none');
        expect(value.panelRadius).toBe('20px');
        expect(auth.requests.some(url => url.endsWith('/aiman.svg'))).toBe(true);
      } else {
        expect(value.glass).toBe(expected.fill);
        expect(value.rim).toBe(expected.rim);
        expect(value.blur).toBe('blur(20px) saturate(1.12)');
        if (journey && theme === 'light') expect(value.shadow).toBe('none');
        else expect(value.shadow).toContain('inset');
        expect(value.panelRadius).toBe(journey ? '16px' : '22px');
        expect(value.glassRadius).toBe(journey ? '16px' : '22px');
        expect(value.logo).toContain(theme === 'light' ? 'aiman-logo-dark.svg' : 'aiman-logo-white.svg');
      }
      if (releaseId === 'v16-aiman-journey' || iris) expect(value.lighting).toBe('none');
      else expect(value.lighting).toContain('radial-gradient');
      expect(value.font).toContain(iris ? 'Outfit' : (journey ? 'Plus Jakarta Sans' : 'Inter Tight'));
      expect(value.bodyFont).toContain(iris ? 'Inter Tight' : (journey ? 'Plus Jakarta Sans' : 'Inter Tight'));
      expect(value.weight).toBe(iris ? '700' : (journey ? '800' : '550'));
      if (iris) expect(value.letterSpacing).toBe('-0.6px');
      expect(value.transparentForms).toEqual([]);
      expect(auth.requests.some(url => url.endsWith(journey
        ? '/fonts/plus-jakarta-sans-latin-800-normal.woff2' : '/fonts/inter-tight-latin-wght-normal.woff2'))).toBe(true);
      if (iris) {
        expect(auth.requests.some(url => /\/fonts\/(lora|outfit-latin-ext)/.test(url))).toBe(false);
      } else {
        expect(auth.requests.some(url => /\/fonts\/(lora|outfit)/.test(url))).toBe(false);
      }
      await expect(page.locator(fixture.input)).toHaveCSS('font-size', '16px');
      await expect(page.locator(fixture.input)).toHaveCSS('border-radius', iris || journey ? '12px' : '13px');
      await expect(page.locator(`label[for="${fixture.input.slice(1)}"]`)).toHaveCSS('font-size', '14px');
      await page.locator('#pageError').evaluate(element => { element.setAttribute('aria-hidden', 'false'); });
      await expect(page.locator('#pageError')).toHaveCSS('background-color',
        journey && !identity && theme === 'dark' ? 'rgb(42, 49, 61)' : expected.panel);
      expect(textContrast(await colors(page.locator('#pageError p')))).toBeGreaterThanOrEqual(4.5);
      if (iris) {
        expect(auth.requests.some(url => url.includes('/fonts/plus-jakarta'))).toBe(false);
        expect(auth.requests.some(url => url.endsWith('/fonts/outfit-latin-wght-normal.woff2'))).toBe(true);
        expect(auth.requests.some(url => url.endsWith('/fonts/inter-tight-latin-wght-normal.woff2'))).toBe(true);
        await expect(page.locator(fixture.primary)).toHaveCSS('border-radius', '999px');
        await expect(page.locator(fixture.primary)).toHaveCSS('font-weight', '700');
        await expect(page.locator(fixture.primary)).toHaveCSS('color',
          theme === 'dark' ? 'rgb(11, 11, 18)' : 'rgb(255, 255, 255)');
        await page.locator(fixture.input).focus();
        await expect(page.locator(fixture.input)).toHaveCSS('outline-width', '3px');
        await expect(page.locator(fixture.input)).toHaveCSS('outline-offset', '2px');
        for (const selector of ['#verificationInfo', '#verificationSuccess']) {
          await expect(page.locator(selector)).toBeHidden();
          await page.locator(selector).evaluate(element => element.setAttribute('aria-hidden', 'false'));
          await expect(page.locator(selector)).toBeVisible();
          expect(textContrast(await colors(page.locator(selector)))).toBeGreaterThanOrEqual(4.5);
        }
        await expect(page.locator('#verificationSuccess')).toHaveCSS('background-color',
          theme === 'dark' ? 'rgb(15, 38, 28)' : 'rgb(226, 246, 236)');
        await expect(page.locator('#verificationSuccess')).toHaveCSS('color',
          theme === 'dark' ? 'rgb(94, 224, 170)' : 'rgb(11, 115, 80)');
        await expect(page.locator('#verificationInfo')).toHaveCSS('background-color',
          theme === 'dark' ? 'rgb(25, 25, 36)' : 'rgb(244, 244, 249)');
        await expect(page.locator('#verificationInfo')).not.toHaveCSS('background-color',
          theme === 'dark' ? 'rgb(15, 38, 28)' : 'rgb(226, 246, 236)');
      } else if (identity) {
        expect(auth.requests.some(url => url.includes('/fonts/inter-tight'))).toBe(false);
        await expect(page.locator(fixture.primary)).toHaveCSS('font-weight', '700');
        for (const selector of ['#verificationInfo', '#verificationSuccess']) {
          await expect(page.locator(selector)).toBeHidden();
          await page.locator(selector).evaluate(element => element.setAttribute('aria-hidden', 'false'));
          await expect(page.locator(selector)).toBeVisible();
          expect(textContrast(await colors(page.locator(selector)))).toBeGreaterThanOrEqual(4.5);
        }
        await expect(page.locator('#verificationSuccess')).toHaveCSS('background-color', 'rgb(255, 200, 61)');
        await expect(page.locator('#verificationSuccess')).toHaveCSS('color', 'rgb(61, 46, 0)');
        await expect(page.locator('#verificationInfo')).not.toHaveCSS('background-color', 'rgb(255, 200, 61)');
        await expect(page.locator(fixture.primary)).toHaveCSS('color', 'rgb(255, 255, 255)');
      }

      // Conservative contrast bound across every stop of the actual canvas lighting.
      const ratios = expected.backdropStops.map(stop =>
        contrast(rgba(expected.chrome), composite(rgba(expected.fill), rgba(stop))));
      expect(Math.min(...ratios)).toBeGreaterThanOrEqual(7);
      await attachJson(testInfo, 'material-and-lit-glass-contrast', { ...value, ratios });
      await page.screenshot({ path: testInfo.outputPath(`${fixture.name}-${theme}-error.png`), fullPage: true });
    });
  }

  test(`${theme}: primary contrast stays stable through hover/pressed and loading`, async ({ page, auth }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await auth.open(cases[0], `aiman_theme=${theme}`);
    const action = page.locator(cases[0].primary);
    await expect(action).toHaveCSS('transition-property', 'box-shadow');
    await action.hover();
    await expect(action).toHaveCSS('background-color', palette[theme].hover);
    expect(textContrast(await colors(action))).toBeGreaterThanOrEqual(4.5);
    await page.mouse.down();
    await expect(action).toHaveCSS('background-color', palette[theme].pressed);
    expect(textContrast(await colors(action))).toBeGreaterThanOrEqual(4.5);
    // Release outside the button, never submit even a synthetic authentication form.
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await action.evaluate(element => {
      element.disabled = true;
      element.setAttribute('aria-busy', 'true');
      element.textContent = 'Working...';
    });
    await expect(action).toBeDisabled();
    await expect(action).toHaveCSS('opacity', '1');
    expect(textContrast(await colors(action))).toBeGreaterThanOrEqual(4.5);
    expect(await page.evaluate(() => window.__platformFixture.submits)).toBe(0);
  });

  for (const preference of ['contrast', 'transparency', 'unsupported']) {
    test(`${theme}: ${preference} uses solid material without changing controls`, async ({ page, auth }) => {
      if (preference === 'contrast') await page.emulateMedia({ contrast: 'more' });
      if (preference !== 'contrast') {
        // These engines do not expose reduced transparency / unsupported backdrop emulation.
        // Exercise the shipped fallback rules, not a test-only approximation of their styles.
        let css = readRelease().files.get('auth-theme.css').toString('utf8');
        css = preference === 'transparency'
          ? css.replace('@media (prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)', '@media all')
          : css.replaceAll('((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))', '(aiman-unsupported: true)');
        await page.route(`${assetBase}auth-theme.css`, route => route.fulfill({
          status: 200, contentType: 'text/css', body: css,
          headers: { 'Access-Control-Allow-Origin': '*' },
        }));
      }
      await auth.open(cases[0], `aiman_theme=${theme}`);
      await assertPlatformUntouched(page);
      const value = await material(page);
      expect(value.glass).toBe(identity || iris ? palette[theme].ink : palette[theme].solid);
      expect(value.blur).toBe('none');
      expect(value.lighting).toBe('none');
      await page.locator(cases[0].input).focus();
      await expect(page.locator(cases[0].input)).toHaveCSS('outline-style', 'solid');
    });
  }
}

test('forced colors retain visible controls and focus, without glass or lighting', async ({ page, auth, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit does not emulate Windows forced-colors.');
  await page.emulateMedia({ forcedColors: 'active' });
  await auth.open(cases[0], 'aiman_theme=dark');
  const value = await material(page);
  expect(value.blur).toBe('none');
  expect(value.lighting).toBe('none');
  await page.locator(cases[0].primary).focus();
  const focused = await colors(page.locator(cases[0].primary));
  expect(focused.outlineStyle).toBe('solid');
  expect(parseFloat(focused.outlineWidth)).toBeGreaterThanOrEqual(3);
  await assertPlatformUntouched(page);
});

test('reduced motion has no button or shell animation', async ({ page, auth }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await auth.open(cases[0], 'aiman_theme=light');
  await expect(page.locator(cases[0].primary)).toHaveCSS('transition-duration', '0s');
  await expect(page.locator(cases[0].primary)).toHaveCSS('animation-name', 'none');
});
