const { test, expect, cases, assertTheme, pressTab } = require('./harness');

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  // Reduced viewport approximates keyboard space; it is not a real on-screen keyboard.
  { name: 'short-keyboard-approximation', width: 360, height: 480 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const viewport of viewports) {
  for (const fixture of cases) {
    if (viewport.name === 'desktop' && fixture.name !== 'long-signup') continue;
    for (const theme of ['light', 'dark']) {
      test(`${fixture.name}: ${theme} ${viewport.name} has reachable controls without horizontal overflow`, async ({ page, auth, browserName }, testInfo) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await auth.open(fixture, `aiman_theme=${theme}`);
        await assertTheme(page, fixture, theme);
        const geometry = await page.evaluate(() => {
          const heading = document.querySelector('#api > .heading').getBoundingClientRect();
          const panel = document.getElementById('api').getBoundingClientRect();
          const recovery = document.getElementById('forgotPassword').getBoundingClientRect();
          const help = document.getElementById('helpLink').getBoundingClientRect();
          const overflowing = Array.from(document.querySelectorAll('#api input, #api select, #api button, #api a, #api label'))
            .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')
            .filter(element => {
              const rect = element.getBoundingClientRect();
              return rect.left < -1 || rect.right > innerWidth + 1;
            }).map(element => element.id || element.tagName);
          return {
            scrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            viewportWidth: innerWidth, viewportHeight: innerHeight,
            headingTop: heading.top, panelTop: panel.top,
            panelHeight: panel.height, overflowing,
            linkGap: Math.max(
              help.left - recovery.right, recovery.left - help.right,
              help.top - recovery.bottom, recovery.top - help.bottom,
            ),
          };
        });
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
        expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
        expect(geometry.overflowing, 'No visible native control or text runs off-screen horizontally').toEqual([]);
        expect(geometry.linkGap, 'Separate native links have distinct readable targets').toBeGreaterThanOrEqual(8);
        expect(geometry.panelTop, 'Tall forms start within the scrollable page, not above it').toBeGreaterThanOrEqual(0);
        expect(geometry.headingTop, 'First heading remains reachable from scroll position zero').toBeGreaterThanOrEqual(0);
        expect(geometry.headingTop).toBeLessThan(geometry.viewportHeight);
        if (fixture.name === 'long-signup') {
          expect(geometry.panelHeight, 'Signup fixture really is taller than the viewport').toBeGreaterThan(geometry.viewportHeight);
        }

        const focusable = page.locator('#api input:visible, #api select:visible, #api button:visible, #api a:visible');
        const count = await focusable.count();
        const reached = new Set();
        for (let index = 0; index < count; index++) {
          await pressTab(page, browserName);
          const focused = page.locator(':focus');
          await expect(focused).toBeVisible();
          await expect.poll(() => focused.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return {
              id: element.id, top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight,
              fullyInViewport: rect.top >= 0 && rect.bottom <= innerHeight + 1,
            };
          }), { message: 'Native keyboard scrolling brings the whole focused control into view' })
            .toEqual(expect.objectContaining({ fullyInViewport: true }));
          const focus = await focused.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return {
              id: element.id, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
              inApi: Boolean(element.closest('#api')),
            };
          });
          expect(focus.inApi, 'Tab follows the platform controls instead of hidden elements').toBe(true);
          expect(focus.left).toBeGreaterThanOrEqual(0);
          expect(focus.right).toBeLessThanOrEqual(viewport.width + 1);
          expect(focus.top, 'Browser can scroll keyboard-focused control into view').toBeGreaterThanOrEqual(0);
          expect(focus.bottom).toBeLessThanOrEqual(viewport.height + 1);
          reached.add(focus.id);
        }
        expect(reached.has(fixture.input.slice(1)), 'First data entry control is keyboard reachable').toBe(true);
        expect(reached.has(fixture.primary.slice(1)), 'Primary action is keyboard reachable').toBe(true);
        expect(reached.has('helpLink'), 'Last original platform help link is reachable').toBe(true);
        await page.evaluate(() => {
          document.activeElement.blur();
          window.scrollTo(0, 0);
        });
        await page.screenshot({ path: testInfo.outputPath(`${fixture.name}-${theme}-${viewport.name}.png`), fullPage: true, animations: 'disabled' });
        expect(await page.evaluate(() => window.__platformFixture.submits)).toBe(0);
      });
    }
  }
}
