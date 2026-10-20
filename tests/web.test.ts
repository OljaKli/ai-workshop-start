// The decisions in spec/web.md, checked on the real web server with GitHub answering from
// tests/helpers.ts, and on the real CLI's serve command.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { after, test } from 'node:test';
import { replay, type Recording } from '../src/core/replay.ts';
import { createWebServer, type OrganizationAnswer, type ScanAnswer } from '../src/server.ts';
import { CLI, EXAMPLE_COMMIT, EXAMPLE_UPDATED, FIXTURE, github } from './helpers.ts';

const server = createWebServer({ fetch: github, token: 'test' });
await new Promise<void>((resolve) => server.listen(0, resolve));
after(() => server.close());
const base = `http://localhost:${(server.address() as AddressInfo).port}`;

const scanUrl = (url: string) => fetch(`${base}/api/scan?url=${encodeURIComponent(url)}`);

/** The API's answer for a URL, with GitHub answering from a recording instead. */
async function scanRecorded(recording: Recording, url: string, token?: string): Promise<ScanAnswer> {
  const other = createWebServer({ fetch: replay(recording), token });
  await new Promise<void>((resolve) => other.listen(0, resolve));
  try {
    const port = (other.address() as AddressInfo).port;
    const response = await fetch(`http://localhost:${port}/api/scan?url=${encodeURIComponent(url)}`);
    assert.equal(response.status, 200);
    return (await response.json()) as ScanAnswer;
  } finally {
    other.close();
  }
}

const blobs = (paths: string[]) => ({
  truncated: false,
  tree: paths.map((path) => ({ path, mode: '100644', type: 'blob', sha: path })),
});

test('GET / is the page with a field for the GitHub URL', async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^text\/html/);
  const html = await response.text();
  assert.match(html, /<title>Skill Atlas<\/title>/);
  assert.match(html, /<input name="url"/);
  assert.match(html, /'api\/scan'/);
  assert.match(html, /'api\/organization'/);
});

test('the API answers the repository and each skill with its full description and pinned link', async () => {
  const response = await scanUrl('https://github.com/JetBrains/example');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
  assert.deepEqual(await response.json(), {
    repository: { id: 'JetBrains/example', url: 'https://github.com/JetBrains/example', commit: EXAMPLE_COMMIT },
    skills: [
      {
        id: 'JetBrains/example:.claude/skills/commits/SKILL.md',
        name: 'commits',
        description: 'Write commit messages the way this repository does. Use for every commit.',
        path: '.claude/skills/commits/SKILL.md',
        link: `https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
        copies: [],
        updated: EXAMPLE_UPDATED,
      },
    ],
    warnings: [],
  });
});

const dated = (commit: string, paths: string[]) => ({
  'https://api.github.com/repos/JetBrains/dated': { status: 200, body: { full_name: 'JetBrains/dated', default_branch: 'main' } },
  'https://api.github.com/repos/JetBrains/dated/commits/main': { status: 200, body: { sha: commit } },
  'https://api.github.com/search/code?q=filename:SKILL.md+repo:JetBrains/dated&per_page=100&page=1': {
    status: 200,
    body: { total_count: paths.length, items: paths.map((path) => ({ path })) },
  },
  [`https://api.github.com/repos/JetBrains/dated/git/trees/${commit}?recursive=1`]: { status: 200, body: blobs(paths) },
  ...Object.fromEntries(
    paths.map((path) => [`https://raw.githubusercontent.com/JetBrains/dated/${commit}/${path}`, { status: 200, body: `---\nname: ${path.split('/')[0]}\n---\n` }]),
  ),
});
const commits = (commit: string, path: string) =>
  `https://api.github.com/repos/JetBrains/dated/commits?sha=${commit}&path=${encodeURIComponent(path)}&per_page=1`;

test('updated: the UTC date of the last commit that changed the SKILL.md, up to the scanned commit', async () => {
  const commit = '7777777777777777777777777777777777777777';
  const answer = await scanRecorded(
    {
      ...dated(commit, ['late/SKILL.md', 'plain/SKILL.md']),
      // 01:30 in UTC+2 is the day before in UTC.
      [commits(commit, 'late/SKILL.md')]: { status: 200, body: [{ commit: { committer: { date: '2026-03-01T01:30:00+02:00' } } }] },
      [commits(commit, 'plain/SKILL.md')]: { status: 200, body: [{ commit: { committer: { date: '2025-12-31T23:59:59Z' } } }] },
    },
    'github.com/JetBrains/dated',
    'test',
  );
  assert.deepEqual(
    answer.skills.map(({ name, updated }) => ({ name, updated })),
    [
      { name: 'late', updated: '2026-02-28' },
      { name: 'plain', updated: '2025-12-31' },
    ],
  );
  assert.deepEqual(answer.warnings, []);
});

test('updated without a token: null for every skill, no warning, no extra request', async () => {
  const commit = '7777777777777777777777777777777777777777';
  // Not recording the commits answers proves they are not asked for: a request would fail.
  const answer = await scanRecorded(dated(commit, ['plain/SKILL.md']), 'github.com/JetBrains/dated');
  assert.deepEqual(
    answer.skills.map(({ name, updated }) => ({ name, updated })),
    [{ name: 'plain', updated: null }],
  );
  assert.deepEqual(answer.warnings, []);
});

test('updated GitHub cannot tell → null for those skills, one warning, the scan still succeeds', async () => {
  const commit = '7777777777777777777777777777777777777777';
  const answer = await scanRecorded(
    {
      ...dated(commit, ['empty/SKILL.md', 'failed/SKILL.md', 'known/SKILL.md', 'unreachable/SKILL.md']),
      [commits(commit, 'empty/SKILL.md')]: { status: 200, body: [] },
      [commits(commit, 'failed/SKILL.md')]: { status: 500, body: { message: 'Server Error' } },
      [commits(commit, 'known/SKILL.md')]: { status: 200, body: [{ commit: { committer: { date: '2026-01-02T00:00:00Z' } } }] },
      // unreachable/SKILL.md: not recorded, so the request fails as if GitHub were unreachable.
    },
    'github.com/JetBrains/dated',
    'test',
  );
  assert.deepEqual(
    answer.skills.map(({ name, updated }) => ({ name, updated })),
    [
      { name: 'empty', updated: null },
      { name: 'failed', updated: null },
      { name: 'known', updated: '2026-01-02' },
      { name: 'unreachable', updated: null },
    ],
  );
  assert.deepEqual(answer.warnings, ['GitHub could not tell when 3 skills last changed; shown without a date']);
});

test('copies and warnings reach the page, skills sorted by name', async () => {
  const commit = '4444444444444444444444444444444444444444';
  const raw = `https://raw.githubusercontent.com/JetBrains/copies/${commit}`;
  const answer = await scanRecorded(
    {
      'https://api.github.com/repos/JetBrains/copies': { status: 200, body: { full_name: 'JetBrains/copies', default_branch: 'main' } },
      'https://api.github.com/repos/JetBrains/copies/commits/main': { status: 200, body: { sha: commit } },
      [`https://api.github.com/repos/JetBrains/copies/git/trees/${commit}?recursive=1`]: {
        status: 200,
        body: blobs(['.claude/skills/tests/SKILL.md', '.agents/skills/tests/SKILL.md', 'docs/broken/SKILL.md']),
      },
      [`${raw}/.agents/skills/tests/SKILL.md`]: { status: 200, body: '---\nname: tests\ndescription: Run the tests.\n---\n' },
      [`${raw}/docs/broken/SKILL.md`]: { status: 200, body: 'no front matter' },
    },
    'github.com/JetBrains/copies',
  );
  assert.deepEqual(
    answer.skills.map(({ name, path, copies }) => ({ name, path, copies })),
    [
      { name: 'broken', path: 'docs/broken/SKILL.md', copies: [] },
      { name: 'tests', path: '.agents/skills/tests/SKILL.md', copies: ['.claude/skills/tests/SKILL.md'] },
    ],
  );
  assert.deepEqual(answer.warnings, ['docs/broken/SKILL.md: no front matter; using the directory name']);
});

test('a /tree/<commit> URL scans and links exactly that commit', async () => {
  const commit = '5555555555555555555555555555555555555555';
  const answer = await scanRecorded(
    {
      'https://api.github.com/repos/JetBrains/pinned': { status: 200, body: { full_name: 'JetBrains/pinned', default_branch: 'main' } },
      [`https://api.github.com/repos/JetBrains/pinned/commits/${commit}`]: { status: 200, body: { sha: commit } },
      [`https://api.github.com/repos/JetBrains/pinned/git/trees/${commit}?recursive=1`]: { status: 200, body: blobs(['SKILL.md']) },
      [`https://raw.githubusercontent.com/JetBrains/pinned/${commit}/SKILL.md`]: { status: 200, body: '---\nname: root\n---\n' },
    },
    `https://github.com/JetBrains/pinned/tree/${commit}`,
  );
  assert.equal(answer.repository.commit, commit);
  assert.equal(answer.skills[0].link, `https://github.com/JetBrains/pinned/blob/${commit}/SKILL.md`);
});

test('a local directory or other text is refused with 400', async () => {
  for (const input of [FIXTURE, '', 'https://gitlab.com/JetBrains/example']) {
    const response = await scanUrl(input);
    assert.equal(response.status, 400, input);
    assert.deepEqual(await response.json(), { error: `Not a GitHub repository URL: ${input}` });
  }
});

test('a repository GitHub cannot scan → 502 with the CLI message', async () => {
  const notFound = await scanUrl('https://github.com/JetBrains/not-answered');
  assert.equal(notFound.status, 502);
  assert.deepEqual(await notFound.json(), {
    error: 'Cannot reach GitHub: not recorded: https://api.github.com/repos/JetBrains/not-answered',
  });
});

/** The API's status and answer for an organization URL, with GitHub answering from a recording. */
async function organizationRecorded(recording: Recording, url: string): Promise<[number, OrganizationAnswer | { error: string }]> {
  const other = createWebServer({ fetch: replay(recording) });
  await new Promise<void>((resolve) => other.listen(0, resolve));
  try {
    const port = (other.address() as AddressInfo).port;
    const response = await fetch(`http://localhost:${port}/api/organization?url=${encodeURIComponent(url)}`);
    assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
    return [response.status, (await response.json()) as OrganizationAnswer];
  } finally {
    other.close();
  }
}

const repo = (name: string, description: string | null = null) => ({ name, full_name: `JetBrains/${name}`, description });

test('an organization URL answers every repository, all pages, sorted by name', async () => {
  const first = Array.from({ length: 100 }, (_, i) => repo(`r${String(i).padStart(3, '0')}`));
  const [status, answer] = await organizationRecorded(
    {
      'https://api.github.com/orgs/jetbrains': { status: 200, body: { login: 'JetBrains' } },
      'https://api.github.com/orgs/JetBrains/repos?per_page=100&page=1': { status: 200, body: first },
      'https://api.github.com/orgs/JetBrains/repos?per_page=100&page=2': {
        status: 200,
        body: [repo('Kotlin', 'The Kotlin language'), repo('amper')],
      },
    },
    'https://github.com/jetbrains/',
  );
  assert.equal(status, 200);
  const { id, url, repositories } = answer as OrganizationAnswer;
  assert.deepEqual({ id, url }, { id: 'JetBrains', url: 'https://github.com/JetBrains' });
  assert.equal(repositories.length, 102);
  assert.deepEqual(repositories[0], { id: 'JetBrains/amper', name: 'amper', url: 'https://github.com/JetBrains/amper', description: '' });
  assert.deepEqual(repositories[1], {
    id: 'JetBrains/Kotlin',
    name: 'Kotlin',
    url: 'https://github.com/JetBrains/Kotlin',
    description: 'The Kotlin language',
  });
  assert.equal(repositories[101].name, 'r099');
});

test('an organization without repositories answers an empty list', async () => {
  const [status, answer] = await organizationRecorded(
    {
      'https://api.github.com/orgs/empty': { status: 200, body: { login: 'empty' } },
      'https://api.github.com/orgs/empty/repos?per_page=100&page=1': { status: 200, body: [] },
    },
    'github.com/empty',
  );
  assert.equal(status, 200);
  assert.deepEqual(answer, { id: 'empty', url: 'https://github.com/empty', repositories: [] });
});

test('an organization GitHub cannot list → 502 with a clear message', async () => {
  const recording: Recording = {
    'https://api.github.com/orgs/nobody': { status: 404, body: { message: 'Not Found' } },
    'https://api.github.com/orgs/limited': { status: 403, body: { message: 'API rate limit exceeded for 1.2.3.4.' } },
  };
  assert.deepEqual(await organizationRecorded(recording, 'github.com/nobody'), [
    502,
    { error: 'Organization not found: https://github.com/nobody' },
  ]);
  assert.deepEqual(await organizationRecorded(recording, 'github.com/limited'), [
    502,
    { error: 'GitHub rate limit reached; set GITHUB_TOKEN' },
  ]);
  assert.deepEqual(await organizationRecorded(recording, 'github.com/unrecorded'), [
    502,
    { error: 'Cannot reach GitHub: not recorded: https://api.github.com/orgs/unrecorded' },
  ]);
});

test('a repository URL, a local directory or other text is not an organization: 400', async () => {
  for (const input of ['https://github.com/JetBrains/example', FIXTURE, '', 'https://gitlab.com/JetBrains']) {
    const response = await fetch(`${base}/api/organization?url=${encodeURIComponent(input)}`);
    assert.equal(response.status, 400, input);
    assert.deepEqual(await response.json(), { error: `Not a GitHub organization URL: ${input}` });
  }
});

test('other paths → 404, other methods → 405', async () => {
  assert.equal((await fetch(`${base}/elsewhere`)).status, 404);
  assert.equal((await fetch(`${base}/api/scan`, { method: 'POST' })).status, 405);
});

test('skill-atlas serve starts the web client, stores nothing, and refuses a bad port', async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'skill-atlas-'));
  const child = spawn(process.execPath, [CLI, 'serve', '0'], { cwd });
  t.after(() => {
    child.kill();
    rmSync(cwd, { recursive: true, force: true });
  });
  const [line] = await createInterface({ input: child.stdout })[Symbol.asyncIterator]().next().then((r) => [r.value as string]);
  const address = /^Skill Atlas on (http:\/\/localhost:\d+)$/.exec(line)?.[1];
  assert.ok(address, line);
  assert.equal((await fetch(address)).status, 200);
  assert.equal((await fetch(`${address}/api/scan?url=${encodeURIComponent(FIXTURE)}`)).status, 400);
  assert.deepEqual(readdirSync(cwd), []);

  const bad = spawn(process.execPath, [CLI, 'serve', 'eighty']);
  let stderr = '';
  bad.stderr.on('data', (chunk) => (stderr += chunk));
  const code = await new Promise((resolve) => bad.on('exit', resolve));
  assert.equal(code, 1);
  assert.equal(stderr, 'Usage: skill-atlas serve [port]\n');
});
