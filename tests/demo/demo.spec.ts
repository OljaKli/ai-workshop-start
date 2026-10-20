// The demo cases as tests: same data, viewport and fonts on every run, a video of each, and their
// key moments compared pixel by pixel with the baselines in spec/screenshots.
import { expect, test } from '@playwright/test';
import { open, serve } from './atlas.ts';
import { caption, cases } from './cases.ts';

let server: Awaited<ReturnType<typeof serve>>;
test.beforeAll(async () => (server = await serve()));
test.afterAll(() => server.close());

test('the page before a scan', async ({ page }) => {
  await open(page, server.url);
  await expect(page).toHaveScreenshot('start.png');
});

for (const [name, demo] of Object.entries(cases)) {
  test(`${name}: ${demo.title}`, async ({ page }) => {
    await open(page, server.url);
    await caption(page, demo.title);
    // Soft: one run reports every changed key moment, not only the first.
    await demo.run(page, (shot) => expect.soft(page).toHaveScreenshot(`${shot}.png`));
  });
}

// Tagged so that `npm run screenshots -- accept` never takes its screenshots for a baseline.
test('a changed pixel fails the check', { tag: '@not-a-baseline' }, async ({ page }) => {
  const { updateSnapshots } = test.info().config;
  test.skip(updateSnapshots === 'all' || updateSnapshots === 'changed', 'it would write the changed pixel as the baseline');
  await open(page, server.url);
  const unchanged = await expect(page).toHaveScreenshot('start.png').then(() => true, () => false);
  test.skip(!unchanged, 'the page itself changed: "the page before a scan" fails for it');
  // One pixel of the white page, one step darker.
  await page.evaluate(() => {
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;left:640px;top:600px;width:1px;height:1px;background:rgb(254,254,254)';
    document.body.append(dot);
  });
  const error: Error | undefined = await expect(page)
    .toHaveScreenshot('start.png', { timeout: 3000 })
    .then(() => undefined, (error) => error);
  expect(error?.message).toMatch(/\b1 pixels \(ratio [\d.]+ of all image pixels\) are different/);
});
