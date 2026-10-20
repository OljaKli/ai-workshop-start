// Records the demo cases into one video: `node .agents/skills/demo-video/record.ts [case…] [--out <file.webm>]`.
// No case: every case, into docs/demo/skill-atlas.webm; a GIF of it beside, for the pull request.
// The same cases, data, viewport and fonts as `npm run e2e`. CHROMIUM_PATH points at another Chromium build.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { context, open, serve, viewport } from '../../../tests/demo/atlas.ts';
import { caption, cases } from '../../../tests/demo/cases.ts';
import { toGif } from './gif.ts';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' } } });
const names = positionals.length > 0 ? positionals : Object.keys(cases);
for (const name of names) if (!cases[name]) throw new Error(`No such case: ${name}; the cases: ${Object.keys(cases).join(', ')}`);
const out = resolve(values.out ?? new URL('../../../docs/demo/skill-atlas.webm', import.meta.url).pathname);

const server = await serve();
const videos = mkdtempSync(join(tmpdir(), 'skill-atlas-demo-'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const recording = await browser.newContext({ ...context, recordVideo: { dir: videos, size: viewport } });
  const page = await recording.newPage();
  for (const name of names) {
    await open(page, server.url);
    await caption(page, cases[name].title);
    // The key moments are checked by `npm run e2e`; here they are only filmed.
    await cases[name].run(page, async () => {});
    console.log(`recorded: ${name}`);
  }
  const video = page.video()!;
  await recording.close();
  mkdirSync(dirname(out), { recursive: true });
  await video.saveAs(out);
  console.log(`video: ${out}`);
  const gif = out.replace(/(\.webm)?$/, '.gif');
  await toGif(browser, out, gif);
  console.log(`gif: ${gif}`);
} finally {
  await browser.close();
  server.close();
  rmSync(videos, { recursive: true, force: true });
}
