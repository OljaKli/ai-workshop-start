// The demo cases, prepared in advance: each drives the page as a user would, with a caption,
// and waits for what spec/web.md promises, so a broken feature stops the recording.
import type { Page } from 'playwright';

export type Demo = {
  page: Page;
  /** Shows `text` as a caption over the page. */
  caption(text: string): Promise<void>;
  /** Types `text` into `selector` at a readable pace, after clearing it. */
  type(selector: string, text: string): Promise<void>;
  /** Waits until `selector` shows `text`, then lets the viewer read it. */
  see(selector: string, text: string, ms?: number): Promise<void>;
  pause(ms?: number): Promise<void>;
};

export type Case = { name: string; title: string; run(demo: Demo): Promise<void> };

const shown = (page: Page) => page.locator('#skills li:visible h2').allTextContents();

async function expectShown(page: Page, names: string[]) {
  const actual = await shown(page);
  if (actual.join() !== names.join()) throw new Error(`shown skills: ${actual.join(', ')}; expected ${names.join(', ')}`);
}

export const cases: Case[] = [
  {
    name: 'filter',
    title: 'Filter a repository’s skills',
    async run({ page, caption, type, see, pause }) {
      await caption('Paste a GitHub repository URL and press Scan');
      await type('input[name=url]', 'https://github.com/JetBrains/MPS');
      await page.click('button[type=submit]');
      await see('#status', 'JetBrains/MPS · 8 skills');
      await caption('Type to narrow the skills: by name…');
      await type('#filter', 'mps-aspect');
      await expectShown(page, ['mps-aspect-editor', 'mps-aspect-generator', 'mps-aspect-typesystem']);
      await pause();
      await caption('…by description, case-insensitively…');
      await type('#filter', 'INTELLIJ');
      await expectShown(page, ['actions', 'code-style', 'debugging']);
      await pause();
      await caption('…or by path');
      await type('#filter', '.agents/skills/commits');
      await expectShown(page, ['commits']);
      await pause();
      await caption('No match? The page says so');
      await type('#filter', 'kotlin');
      await see('#no-match', 'No skills match “kotlin”.');
      await caption('Clear the field: every skill is back, without a new scan');
      await type('#filter', '');
      await expectShown(page, ['actions', 'code-style', 'commits', 'debugging', 'mps-aspect-editor', 'mps-aspect-generator', 'mps-aspect-typesystem', 'mps-tests']);
      await pause(1500);
    },
  },
  {
    name: 'organization',
    title: 'Scan an organization',
    async run({ page, caption, type, see, pause }) {
      await caption('Paste a GitHub organization URL instead');
      await type('input[name=url]', 'https://github.com/JetBrains');
      await page.click('button[type=submit]');
      await see('#status', 'JetBrains · 4 repositories');
      await caption('Its repositories, sorted by name, on the left');
      await pause();
      await caption('Select one: its skills on the right');
      await page.click('#repositories button:text-is("koog")');
      await see('#repository-status', 'JetBrains/koog · 2 skills');
      await caption('Select another: the filter works here too');
      await page.click('#repositories button:text-is("MPS")');
      await see('#repository-status', 'JetBrains/MPS · 8 skills');
      await type('#filter', 'typesystem');
      await expectShown(page, ['mps-aspect-typesystem']);
      await pause();
      await caption('A repository without skills says so');
      await page.click('#repositories button:text-is("intellij-sdk-docs")');
      await see('#skills', 'No skills in JetBrains/intellij-sdk-docs.', 1500);
    },
  },
  {
    name: 'errors',
    title: 'What goes wrong, in red',
    async run({ page, caption, type, see }) {
      await caption('An unknown organization: GitHub’s answer, in red');
      await type('input[name=url]', 'https://github.com/nobody-here');
      await page.click('button[type=submit]');
      await see('#status.error', 'Organization not found: https://github.com/nobody-here');
      await caption('A local directory is refused by the web page');
      await type('input[name=url]', '/etc');
      await page.click('button[type=submit]');
      await see('#status.error', 'Not a GitHub repository URL: /etc', 1500);
    },
  },
];
