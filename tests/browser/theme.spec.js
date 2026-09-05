const {
  test, expect, cases, assetBase, assertTheme, assertPlatformUntouched, attachJson,
} = require('./harness');

for (const fixture of cases) {
  for (const theme of ['light', 'dark']) {
    test(`${fixture.name}: explicit ${theme} beats opposite device appearance`, async ({ page, auth }, testInfo) => {
      await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
      await auth.open(fixture, `aiman_theme=${theme}`);
      const computed = await assertTheme(page, fixture, theme);
      await assertPlatformUntouched(page);
      await expect(page.locator('#api input[type="password"]')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /github/i })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /github/i })).toHaveCount(0);
      if (fixture.name === 'unified-signin' || fixture.name === 'phone-entry') {
        await expect(page.locator('#api input[type="email"]')).toHaveCount(0);
      }
      const assets = auth.requests.filter(url => url.startsWith(assetBase));
      expect(assets, 'Actual generated theme JavaScript is loaded').toContain(`${assetBase}auth-theme.js`);
      expect(assets, 'Actual generated theme overlay is loaded').toContain(`${assetBase}auth-theme.css`);
      expect(assets.some(url => /\.css(?:\?|$)/.test(url) && !url.endsWith('/auth-theme.css')),
        'Full source template CSS is loaded, not just the overlay').toBe(true);
      expect(assets.some(url => url.includes('/fonts/')), 'Bundled font is loaded offline').toBe(true);
      expect(assets.some(url => url.includes('aiman-logo-')), 'Bundled logo is loaded offline').toBe(true);
      await attachJson(testInfo, 'computed-theme-before-screenshot', computed);
      await page.screenshot({ path: testInfo.outputPath(`${fixture.name}-${theme}-desktop.png`), fullPage: true, animations: 'disabled' });
    });
  }
}

test('same-tab OTP/recovery inherit the preference; a new explicit hint updates it', async ({ page, auth }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await auth.open(cases[0], 'aiman_theme=light');
  await assertTheme(page, cases[0], 'light');
  for (const fixture of [cases[3], cases[4]]) {
    await auth.open(fixture);
    await assertTheme(page, fixture, 'light');
    expect(await page.evaluate(() => Object.values(sessionStorage))).toContain('light');
  }
  await auth.open(cases[4], 'aiman_theme=dark');
  await assertTheme(page, cases[4], 'dark');
  await auth.open(cases[3]);
  await assertTheme(page, cases[3], 'dark');
  expect(await page.evaluate(() => Object.values(sessionStorage))).toContain('dark');
});

test('a new tab session without a hint defaults to dark even on a light device', async ({ page, auth }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await auth.open(cases[0]);
  await assertTheme(page, cases[0], 'dark');
});

const invalidQueries = [
  ['empty', 'aiman_theme='],
  ['uppercase', 'aiman_theme=LIGHT'],
  ['whitespace', 'aiman_theme=%20light%20'],
  ['list', 'aiman_theme=light,dark'],
  ['duplicate different', 'aiman_theme=light&aiman_theme=dark'],
  ['duplicate same', 'aiman_theme=light&aiman_theme=light'],
  ['markup', `aiman_theme=${encodeURIComponent('</style><img id="injected" src="https://outside.example.test/probe"><script>window.injected=true</script>')}`],
  ['style', `aiman_theme=${encodeURIComponent('light;background:url(https://outside.example.test/probe)')}`],
];

for (const [description, query] of invalidQueries) {
  test(`invalid ${description} hint is not a theme, DOM content, or a request`, async ({ page, auth }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await auth.open(cases[0], query);
    await assertTheme(page, cases[0], 'dark');
    await assertPlatformUntouched(page);
    await expect(page.locator('#injected')).toHaveCount(0);
    const injected = await page.evaluate(() => ({
      executed: Boolean(window.injected),
      inline: `${document.documentElement.getAttribute('style') || ''}${document.body.getAttribute('style') || ''}`,
      stored: Object.values(sessionStorage),
    }));
    expect(injected.executed).toBe(false);
    expect(injected.inline).not.toContain('outside.example.test');
    expect(injected.stored.every(value => value === 'light' || value === 'dark')).toBe(true);
    expect(auth.requests.some(url => !url.startsWith('https://identity.example.test/authorize')
      && !url.startsWith(assetBase))).toBe(false);
  });
}

test('invalid duplicate hints cannot replace an existing valid tab preference', async ({ page, auth }) => {
  await auth.open(cases[0], 'aiman_theme=light');
  await auth.open(cases[3], 'aiman_theme=dark&aiman_theme=dark');
  await assertTheme(page, cases[3], 'light');
  await auth.open(cases[4]);
  await assertTheme(page, cases[4], 'light');
});

for (const blockedStorage of ['getter', 'read-write', 'quota']) {
  test(`blocked session storage (${blockedStorage}) does not prevent explicit hints or forms`, async ({ page, auth }) => {
    await page.addInitScript(mode => {
      const unavailable = () => { throw new DOMException('Synthetic storage restriction', 'SecurityError'); };
      if (mode === 'getter') {
        Object.defineProperty(window, 'sessionStorage', { get: unavailable });
      } else {
        if (mode === 'read-write') Storage.prototype.getItem = unavailable;
        Storage.prototype.setItem = mode === 'quota'
          ? () => { throw new DOMException('Synthetic quota restriction', 'QuotaExceededError'); }
          : unavailable;
      }
    }, blockedStorage);
    for (const theme of ['light', 'dark']) {
      await auth.open(cases[0], `aiman_theme=${theme}`);
      await assertTheme(page, cases[0], theme);
      await assertPlatformUntouched(page);
      await page.locator(cases[0].input).fill('5550123');
      await expect(page.locator(cases[0].input)).toHaveValue('5550123');
      await expect(page.locator(cases[0].primary)).toBeEnabled();
      expect(await page.evaluate(() => window.__platformFixture.submits)).toBe(0);
    }
    await auth.open(cases[3]);
    await assertTheme(page, cases[3], 'dark');
    await page.locator(cases[3].input).fill('123456');
    await expect(page.locator(cases[3].input)).toHaveValue('123456');
  });
}

test.describe('JavaScript unavailable', () => {
  test.use({ javaScriptEnabled: false });
  for (const fixture of cases) {
    for (const device of ['light', 'dark']) {
      test(`${fixture.name}: default dark and usable controls on ${device} device`, async ({ page, auth }, testInfo) => {
        await page.emulateMedia({ colorScheme: device });
        await auth.open(fixture, 'aiman_theme=light');
        await expect(page.locator('html')).not.toHaveAttribute('data-aiman-theme');
        await assertTheme(page, fixture, 'dark', { javaScript: false });
        await page.locator(fixture.input).fill(fixture.input === '#email' ? 'edited@example.test' : '123456');
        await expect(page.locator(fixture.input)).toHaveValue(fixture.input === '#email' ? 'edited@example.test' : '123456');
        await expect(page.locator(fixture.input)).toHaveAttribute('required', '');
        await expect(page.locator(fixture.primary)).toBeEnabled();
        for (const selector of ['#nativeHiddenControl', '#ariaHiddenControl', '#inlineHiddenControl', '#pageError', '#nativeError', '#inlineError']) {
          await expect(page.locator(selector), `${selector} stays hidden without JavaScript`).toBeHidden();
        }
        await expect(page.locator('#helpLink')).toHaveAttribute('href', 'https://identity.example.test/help');
        await page.screenshot({ path: testInfo.outputPath(`${fixture.name}-no-js-${device}.png`), fullPage: true, animations: 'disabled' });
      });
    }
  }
});
