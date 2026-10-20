// The page in spec/web.md, in a real headless Chromium: what a user sees after pasting a GitHub
// URL. GitHub answers from recordings. `npx playwright install chromium-headless-shell` once;
// CHROMIUM_PATH points at another Chromium build instead.
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';
import { chromium } from 'playwright';
import { replay } from '../src/core/replay.ts';
import { createWebServer } from '../src/server.ts';
import { EXAMPLE_COMMIT, github } from './helpers.ts';

const commit = '6666666666666666666666666666666666666666';
const raw = `https://raw.githubusercontent.com/JetBrains/web/${commit}`;
const paths = ['.agents/skills/tests/SKILL.md', '.claude/skills/tests/SKILL.md', 'docs/broken/SKILL.md', 'docs/html/SKILL.md'];

/** JetBrains/web: a skill with a copy, one with a warning, one whose description looks like HTML; then EXAMPLE. */
const web = replay(
  {
    'https://api.github.com/repos/JetBrains/web': { status: 200, body: { full_name: 'JetBrains/web', default_branch: 'main' } },
    'https://api.github.com/repos/JetBrains/web/commits/main': { status: 200, body: { sha: commit } },
    'https://api.github.com/search/code?q=filename:SKILL.md+repo:JetBrains/web&per_page=100&page=1': {
      status: 200,
      body: { total_count: paths.length, items: paths.map((path) => ({ path })) },
    },
    [`${raw}/.agents/skills/tests/SKILL.md`]: { status: 200, body: '---\nname: tests\ndescription: Run the tests.\n---\n' },
    [`${raw}/docs/broken/SKILL.md`]: { status: 200, body: 'no front matter' },
    [`${raw}/docs/html/SKILL.md`]: {
      status: 200,
      body: '---\nname: html\ndescription: <img src=x onerror="document.title=\'pwned\'"> is text.\n---\n',
    },
    // The JetBrains organization: web and example above, one repository without skills, one GitHub cannot scan.
    'https://api.github.com/orgs/JetBrains': { status: 200, body: { login: 'JetBrains' } },
    'https://api.github.com/orgs/JetBrains/repos?per_page=100&page=1': {
      status: 200,
      body: ['web', 'gone', 'example', 'empty'].map((name) => ({ name, full_name: `JetBrains/${name}`, description: null })),
    },
    'https://api.github.com/repos/JetBrains/empty': { status: 200, body: { full_name: 'JetBrains/empty', default_branch: 'main' } },
    'https://api.github.com/repos/JetBrains/empty/commits/main': { status: 200, body: { sha: commit } },
    'https://api.github.com/search/code?q=filename:SKILL.md+repo:JetBrains/empty&per_page=100&page=1': {
      status: 200,
      body: { total_count: 0, items: [] },
    },
    'https://api.github.com/orgs/quiet': { status: 200, body: { login: 'quiet' } },
    'https://api.github.com/orgs/quiet/repos?per_page=100&page=1': { status: 200, body: [] },
    'https://api.github.com/orgs/nobody': { status: 404, body: { message: 'Not Found' } },
  },
  github,
);

// With a token, through code search, as both recordings answer it.
const server = createWebServer({ fetch: web, token: 'test' });
await new Promise<void>((resolve) => server.listen(0, resolve));
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
after(async () => {
  await browser.close();
  server.close();
});

async function open(path = '/') {
  const page = await browser.newPage();
  await page.goto(`${base}${path}`);
  return page;
}

async function scan(url: string) {
  const page = await open();
  await page.fill('input[name=url]', url);
  await page.click('button[type=submit]');
  await page.locator('#status:not(:has-text("Scanning"))').waitFor();
  return page;
}

test('paste a GitHub URL, press Scan: the repository, then each skill linked at the scanned commit', async () => {
  const page = await scan('https://github.com/JetBrains/example');
  assert.equal(await page.textContent('#status'), `JetBrains/example · 1 skill at ${EXAMPLE_COMMIT.slice(0, 7)}`);
  assert.equal(await page.getAttribute('#status a', 'href'), 'https://github.com/JetBrains/example');
  const skill = page.locator('#skills li');
  assert.equal(await skill.count(), 1);
  assert.equal(await skill.locator('h2').textContent(), 'commits');
  assert.equal(
    await skill.locator('h2 a').getAttribute('href'),
    `https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
  );
  assert.equal(await skill.locator('p').textContent(), 'Write commit messages the way this repository does. Use for every commit.');
  assert.equal(await skill.locator('.path').textContent(), '.claude/skills/commits/SKILL.md');
  await page.close();
});

test('copies show as "also in", warnings after the skills, sorted by name', async () => {
  const page = await scan('github.com/JetBrains/web');
  assert.equal(await page.textContent('#status'), `JetBrains/web · 3 skills at ${commit.slice(0, 7)}`);
  assert.deepEqual(await page.locator('#skills h2').allTextContents(), ['broken', 'html', 'tests']);
  assert.equal(await page.locator('#skills li', { hasText: 'tests' }).locator('.copies').textContent(), 'also in .claude/skills/tests/SKILL.md');
  assert.deepEqual(await page.locator('#warnings li').allTextContents(), [
    'warning: docs/broken/SKILL.md: no front matter; using the directory name',
  ]);
  await page.close();
});

test('a description that looks like HTML is shown as text, never run', async () => {
  const page = await scan('github.com/JetBrains/web');
  assert.equal(
    await page.locator('#skills li', { hasText: 'html' }).locator('p').textContent(),
    `<img src=x onerror="document.title='pwned'"> is text.`,
  );
  assert.equal(await page.locator('#skills img').count(), 0);
  assert.equal(await page.title(), 'Skill Atlas');
  await page.close();
});

test('the scanned URL goes into the address bar, and opening that address scans at once', async () => {
  const scanned = await scan('https://github.com/JetBrains/example');
  const address = scanned.url();
  assert.equal(new URL(address).searchParams.get('url'), 'https://github.com/JetBrains/example');
  await scanned.close();

  const page = await open(`/${new URL(address).search}`);
  await page.locator('#skills li').first().waitFor();
  assert.equal(await page.inputValue('input[name=url]'), 'https://github.com/JetBrains/example');
  assert.equal(await page.locator('#skills h2').textContent(), 'commits');
  await page.close();
});

test('a local directory or a repository GitHub cannot scan → the message, in red, and no skills', async () => {
  for (const [input, message] of [
    ['/etc', 'Not a GitHub repository URL: /etc'],
    ['https://github.com/JetBrains/not-answered', 'Cannot reach GitHub: not recorded: https://api.github.com/repos/JetBrains/not-answered'],
  ]) {
    const page = await scan(input);
    assert.equal(await page.textContent('#status'), message);
    assert.equal(await page.getAttribute('#status', 'class'), 'error');
    assert.equal(await page.locator('#skills li').count(), 0);
    await page.close();
  }
});

async function scanOrganization(url: string) {
  const page = await open();
  await page.fill('input[name=url]', url);
  await page.click('button[type=submit]');
  await page.locator('#status:not(:has-text("Loading repositories"))').waitFor();
  return page;
}

async function select(page: Awaited<ReturnType<typeof open>>, name: string) {
  await page.locator('#repositories button', { hasText: new RegExp(`^${name}$`) }).click();
  await page.locator('#repository-status:not(:has-text("Scanning"))').waitFor();
}

test('paste an organization URL: its repositories on the left, the selected one\'s skills on the right', async () => {
  const page = await scanOrganization('https://github.com/JetBrains');
  assert.equal(await page.textContent('#status'), 'JetBrains · 4 repositories');
  assert.equal(await page.getAttribute('#status a', 'href'), 'https://github.com/JetBrains');
  assert.deepEqual(await page.locator('#repositories button').allTextContents(), ['empty', 'example', 'gone', 'web']);
  assert.equal(await page.textContent('#repository-status'), 'Select a repository to see its skills.');
  assert.equal(await page.locator('#skills li').count(), 0);
  // Left and right: the list sits beside the skills.
  const list = await page.locator('#repositories').boundingBox();
  const right = await page.locator('#skills').boundingBox();
  assert.ok(list && right && list.x + list.width <= right.x, 'the repositories are left of the skills');

  await select(page, 'web');
  assert.equal(await page.textContent('#repository-status'), `JetBrains/web · 3 skills at ${commit.slice(0, 7)}`);
  assert.equal(await page.getAttribute('#repositories button[aria-current=true]', 'title'), 'JetBrains/web');
  assert.deepEqual(await page.locator('#skills h2').allTextContents(), ['broken', 'html', 'tests']);
  const tests = page.locator('#skills li', { hasText: 'tests' });
  assert.equal(await tests.locator('h2 a').getAttribute('href'), `https://github.com/JetBrains/web/blob/${commit}/.agents/skills/tests/SKILL.md`);
  assert.equal(await tests.locator('p').textContent(), 'Run the tests.');
  assert.equal(await tests.locator('.copies').textContent(), 'also in .claude/skills/tests/SKILL.md');
  assert.deepEqual(await page.locator('#warnings li').allTextContents(), [
    'warning: docs/broken/SKILL.md: no front matter; using the directory name',
  ]);

  await select(page, 'example');
  assert.equal(await page.textContent('#repository-status'), `JetBrains/example · 1 skill at ${EXAMPLE_COMMIT.slice(0, 7)}`);
  assert.deepEqual(await page.locator('#skills h2').allTextContents(), ['commits']);
  assert.equal(await page.locator('#warnings li').count(), 0);
  assert.equal(await page.textContent('#status'), 'JetBrains · 4 repositories');
  await page.close();
});

test('an organization repository without skills, or one GitHub cannot scan, says so on the right', async () => {
  const page = await scanOrganization('github.com/JetBrains');
  await select(page, 'empty');
  assert.equal(await page.textContent('#repository-status'), `JetBrains/empty · 0 skills at ${commit.slice(0, 7)}`);
  assert.deepEqual(await page.locator('#skills li').allTextContents(), ['No skills in JetBrains/empty.']);

  await select(page, 'gone');
  assert.equal(await page.textContent('#repository-status'), 'Cannot reach GitHub: not recorded: https://api.github.com/repos/JetBrains/gone');
  assert.equal(await page.getAttribute('#repository-status', 'class'), 'error');
  assert.equal(await page.locator('#skills li').count(), 0);
  assert.equal(await page.locator('#repositories button').count(), 4);
  await page.close();
});

test('a late error from an earlier repository does not replace the selected repository status', async () => {
  const page = await scanOrganization('github.com/JetBrains');
  await page.route('**/api/scan?*', async (route) => {
    if (new URL(route.request().url()).searchParams.get('url')?.endsWith('/gone')) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await route.continue();
  });

  await page.locator('#repositories button', { hasText: /^gone$/ }).click();
  await select(page, 'web');
  await new Promise((resolve) => setTimeout(resolve, 150));

  assert.equal(await page.textContent('#repository-status'), `JetBrains/web · 3 skills at ${commit.slice(0, 7)}`);
  assert.deepEqual(await page.locator('#skills h2').allTextContents(), ['broken', 'html', 'tests']);
  await page.close();
});

test('an organization without repositories, or one GitHub cannot list, says so', async () => {
  const quiet = await scanOrganization('github.com/quiet');
  assert.equal(await quiet.textContent('#status'), 'quiet · 0 repositories');
  assert.equal(await quiet.locator('#repositories').isVisible(), false);
  await quiet.close();

  const nobody = await scanOrganization('github.com/nobody');
  assert.equal(await nobody.textContent('#status'), 'Organization not found: https://github.com/nobody');
  assert.equal(await nobody.getAttribute('#status', 'class'), 'error');
  assert.equal(await nobody.locator('#repositories li').count(), 0);
  await nobody.close();
});

test('an organization URL goes into the address bar, and a repository scan after it shows no list', async () => {
  const page = await scanOrganization('github.com/JetBrains');
  assert.equal(new URL(page.url()).searchParams.get('url'), 'github.com/JetBrains');
  await page.fill('input[name=url]', 'https://github.com/JetBrains/example');
  await page.click('button[type=submit]');
  await page.locator('#status', { hasText: 'JetBrains/example' }).waitFor();
  assert.equal(await page.locator('#repositories').isVisible(), false);
  assert.equal(await page.locator('#repository-status').isVisible(), false);
  assert.deepEqual(await page.locator('#skills h2').allTextContents(), ['commits']);
  await page.close();

  const opened = await open(`/?url=${encodeURIComponent('github.com/JetBrains')}`);
  await opened.locator('#repositories button').first().waitFor();
  assert.equal(await opened.locator('#repositories button').count(), 4);
  await opened.close();
});
