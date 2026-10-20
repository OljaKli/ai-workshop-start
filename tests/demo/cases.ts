/// <reference lib="dom" />
// The demo cases, prepared in advance: what a user does on the page, slowly enough to follow.
// Each case waits for what it shows, so a recording also fails when the feature is broken, and
// calls `shot` at its key moments: a screenshot compared with its baseline in spec/screenshots
// when the cases run as tests (demo.spec.ts), nothing when the demo is recorded.
import type { Page } from 'playwright';

/** A key moment, by the name of its baseline: `spec/screenshots/<name>.png`. */
export type Shot = (name: string) => Promise<void>;

export type Case = { title: string; run: (page: Page, shot: Shot) => Promise<void> };

const pause = (page: Page, ms = 1200) => page.waitForTimeout(ms);

/** A caption at the bottom of the video: what the viewer is about to see. */
export async function caption(page: Page, text: string) {
  await page.evaluate((text) => {
    let box = document.getElementById('demo-caption');
    if (!box) {
      box = document.createElement('div');
      box.id = 'demo-caption';
      box.style.cssText =
        'position:fixed;left:50%;bottom:1.5rem;transform:translateX(-50%);z-index:9;padding:.5rem 1rem;border-radius:.5rem;' +
        'background:#111827e6;color:white;font:700 18px/1.4 system-ui,sans-serif;pointer-events:none';
      document.body.append(box);
    }
    box.textContent = text;
  }, text);
  await pause(page, 900);
}

/** Paste a URL into the field, as a user types it, and press Scan. */
async function submit(page: Page, url: string) {
  await page.fill('input[name=url]', '');
  await page.locator('input[name=url]').pressSequentially(url, { delay: 45 });
  await pause(page, 400);
  await page.click('button[type=submit]');
}

async function filter(page: Page, text: string) {
  await page.fill('#filter', '');
  await page.locator('#filter').pressSequentially(text, { delay: 110 });
  await pause(page, 1500);
}

export const cases: Record<string, Case> = {
  filter: {
    title: 'Filter the skills of a repository',
    async run(page, shot) {
      await caption(page, 'Scan a repository: JetBrains/MPS, 75 skills');
      await submit(page, 'https://github.com/JetBrains/MPS');
      await page.locator('#status', { hasText: 'JetBrains/MPS · 75 skills' }).waitFor();
      await shot('filter-1-scanned');
      await pause(page);
      await caption(page, 'Filter by name, description or path, ignoring case');
      await filter(page, 'Test');
      await page.locator('#skills li:visible', { hasText: 'mps-tests' }).first().waitFor();
      await filter(page, 'youtrack');
      await page.locator('#skills li:visible', { hasText: 'bugfix-workflow' }).waitFor();
      await shot('filter-2-description');
      await caption(page, 'Nothing matches: the page says so');
      await filter(page, 'swift');
      await page.locator('#no-match:visible', { hasText: 'No skills match “swift”.' }).waitFor();
      await shot('filter-3-no-match');
      await caption(page, 'Clear the filter: every skill again, without rescanning');
      await page.fill('#filter', '');
      await page.locator('#no-match').waitFor({ state: 'hidden' });
      await shot('filter-4-cleared');
      await pause(page, 1800);
    },
  },
  organization: {
    title: 'Scan an organization, one repository at a time',
    async run(page, shot) {
      await caption(page, 'Paste an organization: its repositories on the left');
      await submit(page, 'https://github.com/JetBrains');
      await page.locator('#status', { hasText: 'JetBrains · 3 repositories' }).waitFor();
      await shot('organization-1-list');
      await pause(page);
      for (const [name, summary] of [
        ['koog', 'JetBrains/koog · 2 skills'],
        ['android', 'JetBrains/android · 6 skills'],
        ['MPS', 'JetBrains/MPS · 75 skills'],
      ]) {
        await caption(page, `Select ${name}: its skills on the right`);
        await page.locator('#repositories button', { hasText: new RegExp(`^${name}$`) }).click();
        await page.locator('#repository-status', { hasText: summary }).waitFor();
        if (name === 'koog') await shot('organization-2-koog');
        await pause(page, 1600);
      }
      await caption(page, 'The filter works here too');
      await filter(page, 'kotlin');
      await page.locator('#skills li:visible').first().waitFor();
      await shot('organization-3-filtered');
      await pause(page, 1500);
    },
  },
};
