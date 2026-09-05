const {
  test, expect, cases, rgba, composite, contrast, colors, backgroundOf, textContrast, assertTheme, attachJson,
} = require('./harness');

function gradientContrast(sample) {
  const stops = sample.backgroundImage.match(/rgba?\([^)]+\)/g) || [];
  expect(stops.length, 'Primary CTA uses the complete generated gradient').toBeGreaterThanOrEqual(2);
  return Math.min(...stops.map(stop => {
    const background = composite(rgba(stop), backgroundOf(sample));
    return contrast(composite(rgba(sample.color), background), background);
  }));
}

async function focusWithKeyboard(page, selector) {
  for (let attempts = 0; attempts < 40; attempts++) {
    await page.keyboard.press('Tab');
    if (await page.locator(selector).evaluate(element => element === document.activeElement)) return;
  }
  throw new Error(`Keyboard could not reach ${selector} in 40 Tab presses`);
}

for (const fixture of cases) {
  for (const theme of ['light', 'dark']) {
    test(`${fixture.name}: ${theme} text, CTA endpoints, control boundaries and keyboard focus contrast`, async ({ page, auth }, testInfo) => {
      await auth.open(fixture, `aiman_theme=${theme}`);
      await assertTheme(page, fixture, theme);
      await page.locator('#pageError').evaluate(element => element.setAttribute('aria-hidden', 'false'));
      const evidence = {};
      for (const [name, locator] of [
        ['body', page.locator('body')],
        ['heading', page.locator('#api > .heading > h1')],
        ['intro', page.locator('#api form > .intro > p, #api form > .intro > h2').first()],
        ['label', page.locator(`#api label[for="${fixture.input.slice(1)}"]`)],
        ['error', page.locator('#pageError p')],
        ['input-text', page.locator(fixture.input)],
        ['help-link', page.locator('#helpLink')],
      ]) {
        await expect(locator).toBeVisible();
        const sample = await colors(locator);
        evidence[name] = { sample, ratio: textContrast(sample) };
        expect(evidence[name].ratio, `${name} normal-size text contrast must be >=4.5:1`).toBeGreaterThanOrEqual(4.5);
      }

      const input = page.locator(fixture.input);
      const normal = await colors(input);
      const fill = backgroundOf(normal);
      const surround = backgroundOf(normal, false);
      const border = composite(rgba(normal.borderColor), fill);
      evidence.control = {
        innerContrast: contrast(border, fill),
        outerContrast: contrast(border, surround),
      };
      expect(parseFloat(normal.borderWidth), 'Unfocused editable control has a visible border').toBeGreaterThanOrEqual(1);
      expect.soft(Math.min(evidence.control.innerContrast, evidence.control.outerContrast),
        'Editable control boundary contrasts >=3:1 against both adjacent surfaces').toBeGreaterThanOrEqual(3);

      const cta = page.locator(fixture.primary);
      const normalCta = await colors(cta);
      evidence.cta = { normal: gradientContrast(normalCta) };
      expect(evidence.cta.normal, 'CTA text contrasts >=4.5:1 at every normal gradient stop').toBeGreaterThanOrEqual(4.5);
      await cta.hover();
      await expect(cta).not.toHaveCSS('background-image', normalCta.backgroundImage);
      await expect.configure({ soft: true }).poll(async () => gradientContrast(await colors(cta)), {
        message: 'CTA text contrasts >=4.5:1 at every hover gradient stop',
      }).toBeGreaterThanOrEqual(4.5);
      evidence.cta.hover = gradientContrast(await colors(cta));
      await page.mouse.move(0, 0);
      await page.evaluate(() => {
        document.activeElement.blur();
        window.scrollTo(0, 0);
      });

      await focusWithKeyboard(page, fixture.input);
      await expect(input).toBeFocused();
      const expectedFocusColor = await input.evaluate(element => {
        const style = document.createElement('span').style;
        style.color = getComputedStyle(element).getPropertyValue('--aiman-focus').trim();
        return style.color;
      });
      // Measure the settled focus state, not the first frame of its transition.
      await expect(input).toHaveCSS('border-color', expectedFocusColor);
      await expect.poll(async () => (await colors(input)).boxShadow).not.toBe(normal.boxShadow);
      await expect.poll(async () => {
        const focused = await colors(input);
        return contrast(composite(rgba(focused.borderColor), backgroundOf(focused)), backgroundOf(focused));
      }, { message: 'Keyboard-focused input border contrasts >=3:1' }).toBeGreaterThanOrEqual(3);
      const focusedInput = await colors(input);
      expect(focusedInput.borderColor, 'Keyboard focus is visibly different from rest').not.toBe(normal.borderColor);
      expect(focusedInput.boxShadow, 'Input has an additional visible focus ring').not.toBe(normal.boxShadow);
      evidence.inputFocus = focusedInput;

      for (const selector of [fixture.primary, '#helpLink']) {
        await focusWithKeyboard(page, selector);
        const focused = await colors(page.locator(selector));
        expect(focused.outlineStyle, `${selector} keyboard focus outline`).not.toBe('none');
        expect(parseFloat(focused.outlineWidth), `${selector} focus width`).toBeGreaterThanOrEqual(2);
        expect(parseFloat(focused.outlineOffset), `${selector} focus separates from the control`).toBeGreaterThanOrEqual(2);
        const adjacent = backgroundOf(focused, false);
        const ratio = contrast(composite(rgba(focused.outlineColor), adjacent), adjacent);
        expect(ratio, `${selector} focus indicator contrast >=3:1`).toBeGreaterThanOrEqual(3);
        evidence[`${selector}-focus`] = { sample: focused, ratio };
      }
      await attachJson(testInfo, 'computed-contrast', evidence);
      expect(await page.evaluate(() => window.__platformFixture.submits)).toBe(0);
    });
  }
}
