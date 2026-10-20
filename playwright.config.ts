// `npm run e2e`: the demo cases as screenshot tests (tests/demo), recorded on video every run.
// Baselines are part of the spec, spec/screenshots/<name>.png, made on Linux like CI: a pixel
// that changes fails. On CI a missing baseline fails too, instead of being written.
import { defineConfig } from '@playwright/test';
import { context, viewport } from './tests/demo/atlas.ts';

export default defineConfig({
  testDir: 'tests/demo',
  testMatch: '*.spec.ts',
  snapshotPathTemplate: 'spec/screenshots/{arg}{ext}',
  outputDir: 'test-results',
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  updateSnapshots: process.env.CI ? 'none' : 'missing',
  reporter: [
    [process.env.CI ? 'github' : 'list'],
    ['html', { open: 'never' }],
    // What `npm run screenshots` reads: which screenshots failed, and their actual pixels.
    ['json', { outputFile: 'test-results/report.json' }],
  ],
  expect: {
    toHaveScreenshot: { threshold: 0, maxDiffPixels: 0, animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  use: {
    ...context,
    video: { mode: 'on', size: viewport },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
});
