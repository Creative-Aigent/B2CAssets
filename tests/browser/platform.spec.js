const { test, expect, cases, assertTheme, assertPlatformUntouched } = require('./harness');

const visibilityStates = [
  ['#pageError', 'aria'],
  ['#nativeError', 'hidden'],
  ['#inlineError', 'inline'],
  ['#nativeHiddenControl', 'hidden'],
  ['#ariaHiddenControl', 'aria'],
  ['#inlineHiddenControl', 'inline'],
];

for (const fixture of cases) {
  for (const theme of ['light', 'dark']) {
    test(`${fixture.name}: ${theme} preserves controls, hidden states and platform handlers`, async ({ page, auth }) => {
      await auth.open(fixture, `aiman_theme=${theme}`);
      await assertTheme(page, fixture, theme);
      await assertPlatformUntouched(page);
      const states = [...visibilityStates];
      if (fixture.name === 'long-signup') {
        states.push(
          ['#phoneVerificationControl_but_verify_code', 'aria'],
          ['#phoneVerificationControl_but_send_new_code', 'inline'],
          ['#phoneVerificationControl_but_change_claims', 'hidden'],
        );
      }
      if (fixture.name === 'multifactor-otp') states.push(['#sendNewCode', 'inline']);
      for (const [selector, state] of states) {
        const control = page.locator(selector);
        await expect(control, `${selector} respects platform ${state} state`).toBeHidden();
        await control.evaluate((element, kind) => {
          if (kind === 'hidden') element.hidden = false;
          if (kind === 'aria') element.setAttribute('aria-hidden', 'false');
          if (kind === 'inline') element.style.removeProperty('display');
        }, state);
        await expect(control, `${selector} reveals when the platform flips its state`).toBeVisible();
        await control.evaluate((element, kind) => {
          if (kind === 'hidden') element.hidden = true;
          if (kind === 'aria') element.setAttribute('aria-hidden', 'true');
          if (kind === 'inline') element.style.display = 'none';
        }, state);
        await expect(control, `${selector} can be hidden again by the platform`).toBeHidden();
      }
      await page.locator('#pageError').evaluate(element => {
        element.setAttribute('aria-hidden', 'false');
        element.querySelector('p').textContent = 'Fixture only: a new platform error appeared after code entry.';
      });
      await expect(page.locator('#pageError')).toContainText('a new platform error appeared');
      await page.locator(fixture.input).fill(fixture.input === '#email' ? 'changed@example.test' : '5550123');
      await page.locator('#helpLink').click();
      const state = await page.evaluate(() => ({
        inputEvents: window.__platformFixture.inputEvents,
        clicks: window.__platformFixture.clicks,
        listenerClicks: window.__platformFixture.listenerClicks,
        submits: window.__platformFixture.submits,
      }));
      expect(state.inputEvents, 'Original input handler runs after styling').toBeGreaterThan(0);
      expect(state.clicks, 'Original property click handler runs').toBe(1);
      expect(state.listenerClicks, 'Original addEventListener handler runs').toBe(1);
      expect(state.submits, 'No authentication form submission').toBe(0);
    });
  }
}

for (const theme of ['light', 'dark']) {
  for (const fixture of cases.filter(item => ['phone-entry', 'long-signup'].includes(item.name))) {
    test(`${fixture.name}: ${theme} keeps native country options and sentinel order`, async ({ page, auth }) => {
      await auth.open(fixture, `aiman_theme=${theme}`);
      const select = page.locator('#countryCode');
      const before = await select.evaluate(element => ({
        appearance: getComputedStyle(element).appearance,
        options: Array.from(element.options, option => ({
          value: option.value, text: option.textContent, selected: option.selected, disabled: option.disabled,
        })),
        value: element.value,
      }));
      expect(before.appearance, 'The platform country picker stays a native select').toMatch(/auto|menulist/);
      expect(before.value).toBe('__platform_sentinel__');
      expect(before.options.map(option => option.value)).toEqual(['__platform_sentinel__', 'ZZ', 'CA', 'US', 'GB', '']);
      expect(before.options[0]).toMatchObject({ selected: true, disabled: true });
      await select.selectOption('US');
      await expect(select).toHaveValue('US');
      const after = await select.evaluate(element => Array.from(element.options, option => ({
        value: option.value, text: option.textContent, disabled: option.disabled,
      })));
      expect(after).toEqual(before.options.map(({ selected, ...option }) => option));
      await select.evaluate(element => { element.value = '__platform_sentinel__'; });
      await expect(select).toHaveValue('__platform_sentinel__');
      expect(await page.evaluate(() => window.__platformFixture.submits)).toBe(0);
    });
  }
}
