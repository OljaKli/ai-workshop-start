---
name: demo-video
description: Record a short video of Skill Atlas features in the web page, from cases prepared in advance, into docs/demo/ for a pull request.
---

# Demo video

A demo shows a user-visible change working, in a real headless Chromium, with
captions saying what happens. It needs no network and no `GITHUB_TOKEN`.

```console
$ npx playwright install --with-deps chromium-headless-shell   # once
$ npm run demo                                # every case → docs/demo/skill-atlas.webm
$ npm run demo -- filter --out docs/demo/filter.webm           # some cases only
```

- [github.ts](github.ts): GitHub, prepared in advance. The real JetBrains
  repositories of `tests/snapshots` (android, koog, MPS) at their fixed
  commits, and a `JetBrains` organization listing them. Served with a token, so
  scans go through code search.
- [cases.ts](cases.ts): the cases, run in order in one page and one video:
  - `filter`: scan JetBrains/MPS (75 skills), filter by name, by description,
    nothing matching, then clear.
  - `organization`: paste `github.com/JetBrains`, select koog, android, MPS;
    filter MPS's skills.
- [record.ts](record.ts): starts the web server on a free port, records the
  cases at 1280×720 with Playwright's `recordVideo`, saves the `.webm`.

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
4. Commit the video under `docs/demo/` and link it in the pull request
   description: `https://github.com/<owner>/<repo>/blob/<branch>/docs/demo/<file>.webm`.
   GitHub plays videos only when uploaded through its web editor; say so if
   the reviewer should drag it in.

If Chromium fails with `error while loading shared libraries`, run
`npx playwright install-deps chromium-headless-shell` (it needs `sudo`).
