// A demo video as a GIF, which a pull request shows inline from the repository, unlike a video:
// `node .agents/skills/demo-video/gif.ts [<video.webm> [<out.gif>]]`. Chromium decodes the video
// frame by frame; gifenc encodes. A frame that does not change only lengthens the one before.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import gifenc from 'gifenc';
import { chromium, type Browser } from 'playwright';

// gifenc is CommonJS: no named exports.
const { GIFEncoder, applyPalette, quantize } = gifenc;

/** The same picture, but for the video's compression noise. */
function same(a: Buffer, b: Buffer) {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 24) return false;
  return true;
}

/** Writes `gif` from `webm`: `fps` frames a second, `width` pixels wide. */
export async function toGif(browser: Browser, webm: string, gif: string, { fps = 6, width = 800 } = {}) {
  const video = readFileSync(webm);
  const server = createServer((_, response) => response.writeHead(200, { 'Content-Type': 'video/webm' }).end(video));
  await new Promise<void>((done) => server.listen(0, done));
  const page = await browser.newPage();
  try {
    await page.goto(`http://localhost:${(server.address() as AddressInfo).port}/`);
    const { duration, height } = await page.evaluate(async (width) => {
      const video = document.createElement('video');
      video.muted = true;
      // A blob, so the video can seek: the server here answers no Range requests.
      video.src = URL.createObjectURL(await (await fetch(location.href)).blob());
      await new Promise((loaded) => (video.onloadeddata = loaded));
      const canvas = Object.assign(document.createElement('canvas'), {
        width,
        height: Math.round((width * video.videoHeight) / video.videoWidth),
      });
      Object.assign(window, { demoVideo: video, demoCanvas: canvas });
      return { duration: video.duration, height: canvas.height };
    }, width);

    const encoder = GIFEncoder();
    let previous: Buffer | undefined;
    let delay = 0;
    const flush = () => {
      if (!previous) return;
      const rgba = new Uint8Array(previous.buffer, previous.byteOffset, previous.length);
      const palette = quantize(rgba, 256);
      encoder.writeFrame(applyPalette(rgba, palette), width, height, { palette, delay });
    };
    for (let time = 0; time < duration; time += 1 / fps) {
      const frame = Buffer.from(
        await page.evaluate(async (time) => {
          const { demoVideo: video, demoCanvas: canvas } = window as unknown as { demoVideo: HTMLVideoElement; demoCanvas: HTMLCanvasElement };
          video.currentTime = time;
          await new Promise((seeked) => (video.onseeked = seeked));
          // Headless Chromium paints a sought frame only once the video plays.
          const painted = new Promise((done) => video.requestVideoFrameCallback(done));
          await video.play();
          await painted;
          video.pause();
          const context = canvas.getContext('2d', { willReadFrequently: true })!;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let binary = '';
          for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          return btoa(binary);
        }, time),
        'base64',
      );
      if (previous && same(previous, frame)) {
        delay += 1000 / fps;
        continue;
      }
      flush();
      previous = frame;
      delay = 1000 / fps;
    }
    flush();
    encoder.finish();
    writeFileSync(gif, encoder.bytes());
  } finally {
    await page.close();
    server.close();
  }
}

if (import.meta.main) {
  const webm = resolve(process.argv[2] ?? new URL('../../../docs/demo/skill-atlas.webm', import.meta.url).pathname);
  const gif = resolve(process.argv[3] ?? webm.replace(/\.webm$/, '.gif'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    await toGif(browser, webm, gif);
    console.log(`gif: ${gif}`);
  } finally {
    await browser.close();
  }
}
