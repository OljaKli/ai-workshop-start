---
name: demo-video
description: Record a short video of Skill Atlas features in the web page, from cases prepared in advance, into docs/demo/ for a pull request.
---

# Demo video

A demo shows a user-visible change working, in a real headless Chromium, with
captions saying what happens. It needs no network and no `GITHUB_TOKEN`.

```console
$ npx playwright install --with-deps chromium-headless-shell   # once
$ npm run demo                                # every case → docs/demo/skill-atlas.webm and .gif
$ npm run demo -- filter --out docs/demo/filter.webm           # some cases only
```

- [github.ts](github.ts): GitHub, prepared in advance. The real JetBrains
  repositories of `tests/snapshots` (android, koog, MPS) at their fixed
  commits, when each of their skills last changed (`updated.json`, GitHub's
  answers recorded once), and a `JetBrains` organization listing them. Served with a token, so
  scans go through code search.
- [cases.ts](cases.ts): the cases, run in order in one page and one video:
  - `filter`: scan JetBrains/MPS (75 skills), filter by name, by description,
    nothing matching, then clear.
  - `organization`: paste `github.com/JetBrains`, select koog, android, MPS;
    filter MPS's skills.
  - `updated`: scan JetBrains/android; each skill shows `updated YYYY-MM-DD`.
- [record.ts](record.ts): starts the web server on a free port, records the
  cases at 1280×720 with Playwright's `recordVideo`, saves the `.webm`, then
  the `.gif` beside it.
- [gif.ts](gif.ts): the `.webm` as an 800-pixel-wide GIF at 6 frames a second
  (`node .agents/skills/demo-video/gif.ts [<video.webm> [<out.gif>]]`):
  Chromium decodes the frames, `gifenc` encodes them, and unchanged frames only
  lengthen the one before. A pull request shows a GIF inline from the
  repository; a video it only offers to download.

## Steps

1. For a new feature, add a case to `cases.ts`: a `title` (the first caption)
   and `run(page)`. Type with `pressSequentially` and pause after each step,
   so a viewer can follow; `caption(page, text)` before each step. Wait for
   what the step shows (`locator(…).waitFor()`): a broken feature fails the
   recording instead of filming an empty page. Keep the video under a minute.
2. Need other GitHub answers? Add them to `github.ts`, from a snapshot or a
   hand-written recording, never the live network.
3. `npm run demo` (or the cases of the change and `--out`). Look at a few frames
   before committing it, e.g.
   `~/.cache/ms-playwright/ffmpeg-*/ffmpeg-linux -ss 10 -i docs/demo/skill-atlas.webm -frames:v 1 /tmp/frame.png`.
4. Commit both under `docs/demo/`. In the pull request description, show the
   GIF and link the full video, at the pushed commit, so the links outlive the
   branch:

   ```markdown
   ![Demo](https://github.com/<owner>/<repo>/blob/<commit>/docs/demo/<file>.gif?raw=true)

   Full video: [<file>.webm](https://github.com/<owner>/<repo>/blob/<commit>/docs/demo/<file>.webm)
   ```

   GitHub plays a video inline only when it is uploaded through its web
   editor; neither `gh` nor the API can do that.

If Chromium fails with `error while loading shared libraries`, run
`npx playwright install-deps chromium-headless-shell` (it needs `sudo`).
