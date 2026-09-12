const {
  test, expect, cases, assertTheme, assertPlatformUntouched, colors, textContrast,
  rgba, composite, contrast, attachJson, readRelease, assetBase,
} = require('./harness');

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

async function material(page) {
  return page.locator('#api').evaluate(element => {
    const form = getComputedStyle(element);
    const glass = getComputedStyle(element, '::before');
    const heading = getComputedStyle(element.querySelector('h1'));
    return {
      canvas: getComputedStyle(document.body).backgroundColor,
      lighting: getComputedStyle(document.body).backgroundImage,
      panel: form.backgroundColor, panelRadius: form.borderRadius,
      glass: glass.backgroundColor, rim: glass.borderTopColor, shadow: glass.boxShadow,
      blur: glass.backdropFilter || glass.webkitBackdropFilter,
      logo: glass.backgroundImage, glassRadius: glass.borderRadius,
      font: heading.fontFamily, weight: heading.fontWeight,
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
      expect(value.glass).toBe(expected.fill);
      expect(value.rim).toBe(expected.rim);
      expect(value.blur).toBe('blur(20px) saturate(1.12)');
      expect(value.lighting).toContain('radial-gradient');
      expect(value.shadow).toContain('inset');
      expect(value.panelRadius).toBe('22px');
      expect(value.glassRadius).toBe('22px');
      expect(value.font).toContain('Inter Tight');
      expect(value.weight).toBe('550');
      expect(value.transparentForms).toEqual([]);
      expect(value.logo).toContain(theme === 'light' ? 'aiman-logo-dark.svg' : 'aiman-logo-white.svg');
      expect(auth.requests.some(url => url.endsWith('/fonts/inter-tight-latin-wght-normal.woff2'))).toBe(true);
      expect(auth.requests.some(url => /\/fonts\/(lora|outfit)/.test(url))).toBe(false);
      await expect(page.locator(fixture.input)).toHaveCSS('font-size', '16px');
      await expect(page.locator(fixture.input)).toHaveCSS('border-radius', '13px');
      await expect(page.locator(`label[for="${fixture.input.slice(1)}"]`)).toHaveCSS('font-size', '14px');
      await page.locator('#pageError').evaluate(element => { element.setAttribute('aria-hidden', 'false'); });
      await expect(page.locator('#pageError')).toHaveCSS('background-color', expected.panel);
      expect(textContrast(await colors(page.locator('#pageError p')))).toBeGreaterThanOrEqual(4.5);

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
      expect(value.glass).toBe(palette[theme].solid);
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
