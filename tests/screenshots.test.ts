// `npm run screenshots` in spec/web.md#screenshots, run from a checkout whose path has a space.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';

const checkout = join(mkdtempSync(join(tmpdir(), 'skill-atlas-')), 'a checkout');
after(() => rmSync(join(checkout, '..'), { recursive: true, force: true }));
for (const dir of ['scripts', 'spec/screenshots', 'test-results/start']) mkdirSync(join(checkout, dir), { recursive: true });
copyFileSync(fileURLToPath(new URL('../scripts/screenshots.ts', import.meta.url)), join(checkout, 'scripts/screenshots.ts'));
const actual = join(checkout, 'test-results/start/start-actual.png');
writeFileSync(actual, 'new pixels');
writeFileSync(
  join(checkout, 'test-results/report.json'),
  JSON.stringify({
    suites: [{ specs: [{ title: 'start', tags: [], tests: [{ results: [{ status: 'failed', attachments: [{ name: 'start-actual.png', path: actual }] }] }] }] }],
  }),
);

const screenshots = (...args: string[]) => spawnSync(process.execPath, ['scripts/screenshots.ts', ...args], { cwd: checkout, encoding: 'utf8' });

test('summary lists a changed screenshot in a path with a space', () => {
  const { status, stdout, stderr } = screenshots('summary');
  assert.equal(status, 0, stderr);
  assert.match(stdout, /\| `start` \| start \| new \| `spec\/screenshots\/start\.png` \|/);
});

test('accept --local copies the actual pixels into spec/screenshots in a path with a space', { skip: process.platform !== 'linux' }, () => {
  const { status, stdout, stderr } = screenshots('accept', '--local');
  assert.equal(status, 0, stderr);
  assert.match(stdout, /accepted: spec\/screenshots\/start\.png/);
  assert.ok(existsSync(join(checkout, 'spec/screenshots/start.png')));
});
