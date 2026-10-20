// The screenshots that `npm run e2e` found changed, from its JSON report (test-results/report.json):
//   node scripts/screenshots.ts summary        Markdown for the CI job summary
//   node scripts/screenshots.ts accept         CI's actual pixels for HEAD become the baselines
//   node scripts/screenshots.ts accept --local the last local run's, on Linux only
// Accepting writes spec/screenshots/*.png; commit them, and the pull request shows old and new.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

type Attachment = { name: string; path?: string };
type Suite = { suites?: Suite[]; specs?: { title: string; tags: string[]; tests: { results: { status: string; attachments: Attachment[] }[] }[] }[] };

const baselines = new URL('../spec/screenshots/', import.meta.url).pathname;

/** Each changed screenshot of a failed test: its name and its files, relative to test-results. */
function changed(results: string) {
  const report: { suites: Suite[] } = JSON.parse(readFileSync(join(results, 'report.json'), 'utf8'));
  const shots = new Map<string, { test: string; actual: string; diff?: string }>();
  const walk = (suite: Suite) => {
    suite.suites?.forEach(walk);
    // A test tagged @not-a-baseline changes the page on purpose.
    for (const spec of (suite.specs ?? []).filter((spec) => !spec.tags.includes('not-a-baseline'))) {
      for (const result of spec.tests.flatMap((test) => test.results)) {
        if (result.status === 'passed' || result.status === 'skipped') continue;
        const files = new Map(result.attachments.filter((file) => file.path).map((file) => [file.name, file.path!.split('/test-results/').pop()!]));
        for (const [name, actual] of files) {
          const shot = /^(.+)-actual\.png$/.exec(name)?.[1];
          if (shot) shots.set(shot, { test: spec.title, actual, diff: files.get(`${shot}-diff.png`) });
        }
      }
    }
  };
  report.suites.forEach(walk);
  return shots;
}

const { positionals, values } = parseArgs({ allowPositionals: true, options: { local: { type: 'boolean' } } });
const local = new URL('../test-results/', import.meta.url).pathname;

if (positionals[0] === 'summary') {
  const shots = existsSync(join(local, 'report.json')) ? changed(local) : new Map();
  console.log(`## Screenshots\n`);
  if (shots.size === 0) console.log('No screenshot changed.');
  else {
    console.log('| Screenshot | Test | New | Baseline |\n| --- | --- | --- | --- |');
    for (const [shot, { test }] of shots) console.log(`| \`${shot}\` | ${test} | ${existsSync(join(baselines, `${shot}.png`)) ? 'changed' : 'new'} | \`spec/screenshots/${shot}.png\` |`);
    console.log(
      '\nThe `e2e-results` artifact has each one expected, actual and diff (open `playwright-report/index.html`), and every test\'s video.' +
        '\nIf the change is intended: `npm run screenshots -- accept`, commit `spec/screenshots`, and the reviewer approves the images in the pull request.',
    );
  }
} else if (positionals[0] === 'accept') {
  let results = local;
  if (!values.local) {
    // The CI run of this very commit: the pixels it rendered become the baselines.
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const runs: { databaseId: number; conclusion: string }[] = JSON.parse(
      execFileSync('gh', ['run', 'list', '--workflow', 'ci.yml', '--commit', commit, '--json', 'databaseId,conclusion', '--limit', '1'], { encoding: 'utf8' }),
    );
    if (runs.length === 0) throw new Error(`No CI run for ${commit.slice(0, 7)}: push it, wait for CI, then accept`);
    const download = mkdtempSync(join(tmpdir(), 'skill-atlas-screenshots-'));
    execFileSync('gh', ['run', 'download', String(runs[0].databaseId), '--name', 'e2e-results', '--dir', download], { stdio: 'inherit' });
    results = join(download, 'test-results');
    console.log(`CI run ${runs[0].databaseId} (${runs[0].conclusion}) of ${commit.slice(0, 7)}`);
  } else if (process.platform !== 'linux') {
    throw new Error('Baselines are made on Linux, like CI: accept from CI, or run `npm run e2e:linux -- --update-snapshots`');
  }
  const shots = changed(results);
  if (shots.size === 0) console.log('No screenshot changed: nothing to accept.');
  for (const [shot, { actual }] of shots) {
    copyFileSync(join(results, actual), join(baselines, `${shot}.png`));
    console.log(`accepted: spec/screenshots/${shot}.png`);
  }
  if (shots.size > 0) console.log('Next: git add spec/screenshots && git commit -m "Accept new screenshots: …" && git push');
} else {
  console.error('Usage: node scripts/screenshots.ts summary | accept [--local]');
  process.exitCode = 2;
}
