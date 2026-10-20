// Records the demo cases into one video: `node .agents/skills/demo-video/record.ts [case…] [--out <file.webm>]`.
// No case: every case, into docs/demo/skill-atlas.webm; a GIF of it beside, for the pull request. CHROMIUM_PATH points at another Chromium build.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { createWebServer } from '../../../src/server.ts';
import { caption, cases } from './cases.ts';
import { toGif } from './gif.ts';
import { github } from './github.ts';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' } } });
const names = positionals.length > 0 ? positionals : Object.keys(cases);
for (const name of names) if (!cases[name]) throw new Error(`No such case: ${name}; the cases: ${Object.keys(cases).join(', ')}`);
const out = resolve(values.out ?? new URL('../../../docs/demo/skill-atlas.webm', import.meta.url).pathname);

const server = createWebServer({ fetch: github, token: 'demo' });
await new Promise<void>((done) => server.listen(0, done));
const size = { width: 1280, height: 720 };
const videos = mkdtempSync(join(tmpdir(), 'skill-atlas-demo-'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ viewport: size, recordVideo: { dir: videos, size } });
  const page = await context.newPage();
  for (const name of names) {
    await page.goto(`http://localhost:${(server.address() as AddressInfo).port}/`);
    await caption(page, cases[name].title);
    await cases[name].run(page);
    console.log(`recorded: ${name}`);
  }
  const video = page.video()!;
  await context.close();
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
