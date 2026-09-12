const {
  test, expect, cases, assertTheme, assertPlatformUntouched, colors, textContrast,
} = require('./harness');

// These are stylesheet-compatibility fixtures, never additional customer sign-in options.
const passwordFixture = {
  ...cases[4],
  name: 'synthetic-password-reset',
  input: '#newPassword',
  markup: cases[4].markup.replace(
    '<div id="attributeList" class="attr"><ul>',
    `<div id="attributeList" class="attr"><ul>
      <li><div class="attrEntry">
        <label for="newPassword">New password</label>
        <input id="newPassword" name="newPassword" type="password" autocomplete="new-password" required>
        <button type="button" id="revealPassword" aria-controls="newPassword" aria-pressed="false">Show password</button>
      </div></li>`,
  ).replace('<button id="continue" type="submit">Continue</button>',
    '<button id="continue" type="submit">Continue</button><button id="cancel" type="button">Cancel</button>'),
};
const providersFixture = {
  ...cases[0],
  name: 'synthetic-provider-compatibility',
  markup: cases[0].markup.replace('<div class="entry">',
    `<div class="claims-provider-list-buttons">
      <button id="fixtureProvider" type="button">Synthetic existing provider</button>
      <input id="fixtureProviderInput" type="button" value="Synthetic existing provider button">
    </div><div class="entry">`),
};

for (const fixture of [passwordFixture, providersFixture]) {
  for (const theme of ['light', 'dark']) {
    test(`${fixture.name}: ${theme} preserves native actions and narrow-screen errors`, async ({ page, auth }, testInfo) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await auth.open(fixture, `aiman_theme=${theme}`);
      await assertTheme(page, fixture, theme);
      await assertPlatformUntouched(page);
      await page.locator('#pageError').evaluate(element => {
        element.setAttribute('aria-hidden', 'false');
        element.querySelector('p').textContent = 'Synthetic validation message with a long localized explanation: ' + 'example'.repeat(25);
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      expect(textContrast(await colors(page.locator('#pageError p')))).toBeGreaterThanOrEqual(4.5);
      if (fixture === passwordFixture) {
        // The synthetic platform supplies its handler; the production theme supplies none.
        await page.locator('#revealPassword').evaluate(button => {
          button.addEventListener('click', () => {
            const input = document.getElementById('newPassword');
            const reveal = input.type === 'password';
            input.type = reveal ? 'text' : 'password';
            button.setAttribute('aria-pressed', String(reveal));
          });
        });
        await page.locator('#newPassword').fill('synthetic-only-not-a-credential');
        await page.locator('#revealPassword').click();
        await expect(page.locator('#newPassword')).toHaveAttribute('type', 'text');
        await page.locator('#revealPassword').click();
        await expect(page.locator('#newPassword')).toHaveAttribute('type', 'password');
        await page.locator('#cancel').focus();
        await expect(page.locator('#cancel')).toHaveCSS('outline-style', 'solid');
      } else {
        for (const selector of ['#fixtureProvider', '#fixtureProviderInput']) {
          const control = page.locator(selector);
          expect(textContrast(await colors(control))).toBeGreaterThanOrEqual(4.5);
          await control.hover();
          expect(textContrast(await colors(control))).toBeGreaterThanOrEqual(4.5);
          await control.focus();
          await expect(control).toHaveCSS('outline-style', 'solid');
          await expect(control).toHaveAttribute('type', 'button');
          await expect(control).toBeEnabled();
        }
      }
      await page.screenshot({ path: testInfo.outputPath(`${fixture.name}-${theme}-320px.png`), fullPage: true });
      expect(await page.evaluate(() => window.__platformFixture.submits)).toBe(0);
    });
  }
}

test('RTL and enlarged type keep the native form and verification steps reachable', async ({ page, auth }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await auth.open(cases[2], 'aiman_theme=dark');
  await page.locator('html').evaluate(element => { element.dir = 'rtl'; });
  await page.addStyleTag({ content: '#api { font-size: 24px !important; } #api label, #api p, #api a { font-size: 24px !important; }' });
  await expect(page.locator('#continue')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#continue').focus();
  await expect(page.locator('#continue')).toHaveCSS('outline-style', 'solid');
  expect(await page.evaluate(() => window.__platformFixture.submits)).toBe(0);
});
