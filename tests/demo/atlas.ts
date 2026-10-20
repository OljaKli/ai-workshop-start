// The page as the demo and its screenshot tests see it, on every machine alike: GitHub from
// github.ts, a 1280×720 light page, and the bundled Liberation Sans in place of system-ui, which
// is a different font on every machine.
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { BrowserContextOptions, Page } from 'playwright';
import { createWebServer } from '../../src/server.ts';
import { github } from './github.ts';

export const viewport = { width: 1280, height: 720 };

/** Everything about the browser that changes pixels, for a new context. */
export const context: BrowserContextOptions = {
  viewport,
  deviceScaleFactor: 1,
  colorScheme: 'light',
  locale: 'en-US',
  timezoneId: 'UTC',
};

/** The web server, on a free port, with a token, so scans go through code search. */
export async function serve() {
  const server = createWebServer({ fetch: github, token: 'demo' });
  await new Promise<void>((done) => server.listen(0, done));
  return { url: `http://localhost:${(server.address() as AddressInfo).port}/`, close: () => server.close() };
}

const fonts = Object.fromEntries(
  ['Regular', 'Bold'].map((weight) => [weight, readFileSync(new URL(`fonts/LiberationSans-${weight}.ttf`, import.meta.url))]),
);

/** Opens the page with the bundled font, loaded before anything is shown. */
export async function open(page: Page, url: string) {
  await page.route('**/demo-fonts/*.ttf', (route) =>
    route.fulfill({ contentType: 'font/ttf', body: fonts[new URL(route.request().url()).pathname.split('/').pop()!.replace('.ttf', '')] }),
  );
  await page.goto(url);
  await page.addStyleTag({
    content: `
      @font-face { font-family: 'Atlas'; font-weight: 400; src: url(/demo-fonts/Regular.ttf); }
      @font-face { font-family: 'Atlas'; font-weight: 700; src: url(/demo-fonts/Bold.ttf); }
      * { font-family: 'Atlas' !important; }`,
  });
  await page.evaluate(() => Promise.all([document.fonts.load("16px 'Atlas'"), document.fonts.load("bold 16px 'Atlas'")]));
}
