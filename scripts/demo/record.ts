// Records the web page in headless Chromium, as a video, playing demo cases from ./cases.ts
// against the recorded GitHub in ./github.ts. See .agents/skills/record-demo/SKILL.md.
//   node scripts/demo/record.ts [case…] [--out <file.webm>]
// Default: the filter and organization cases, into docs/demo/skill-atlas.webm.
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { createWebServer } from '../../src/server.ts';
import { cases, type Demo } from './cases.ts';
import { demoGitHub } from './github.ts';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string', default: 'docs/demo/skill-atlas.webm' } } });
const names = positionals.length ? positionals : ['filter', 'organization'];
const selected = names.map((name) => {
  const found = cases.find((c) => c.name === name);
  if (!found) throw new Error(`no demo case "${name}"; there are: ${cases.map((c) => c.name).join(', ')}`);
  return found;
});

const size = { width: 1280, height: 720 };
const server = createWebServer({ fetch: demoGitHub(700), token: 'demo' });
await new Promise<void>((resolve) => server.listen(0, resolve));
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
const videos = await mkdtemp(join(tmpdir(), 'skill-atlas-demo-'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: size, recordVideo: { dir: videos, size } });
context.setDefaultTimeout(10_000);
// The caption bar, on every page load, kept out of the page's own elements.
await context.addInitScript({
  content: `addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.id = 'demo-caption';
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;padding:14px 24px;font:600 22px system-ui,sans-serif;' +
      'background:#111827e6;color:white;text-align:center;z-index:9999;pointer-events:none';
    document.body.append(bar);
  });`,
});
const page = await context.newPage();

const demo: Demo = {
  page,
  async caption(text) {
    await page.locator('#demo-caption').evaluate((bar, text) => {
      bar.textContent = text;
    }, text);
  },
  async type(selector, text) {
    await page.fill(selector, '');
    await page.locator(selector).pressSequentially(text, { delay: 70 });
  },
  async see(selector, text, ms = 1200) {
    await page.locator(selector, { hasText: text }).waitFor();
    await page.waitForTimeout(ms);
  },
  pause: (ms = 1200) => page.waitForTimeout(ms),
};

let failure: unknown;
try {
  for (const demoCase of selected) {
    await page.goto(base);
    await demo.caption(demoCase.title);
    await demo.pause(1500);
    await demoCase.run(demo);
    console.log(`recorded: ${demoCase.name}`);
  }
} catch (error) {
  failure = error;
}
const video = page.video();
await context.close();
await browser.close();
server.close();
if (failure) {
  await rm(videos, { recursive: true, force: true });
  throw failure;
}
await mkdir(dirname(values.out), { recursive: true });
await copyFile(await video!.path(), values.out);
await rm(videos, { recursive: true, force: true });
console.log(`video: ${values.out}`);
