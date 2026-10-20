---
name: record-demo
description: Record a short demo video of the Skill Atlas web page in headless Chromium, from prepared cases, to show that a feature works and to attach to a pull request.
---

# Record a demo

The video is made by [scripts/demo/record.ts](../../../scripts/demo/record.ts):
Playwright opens the real web server in headless Chromium, records the page
(1280×720 WebM), and plays demo cases with a caption bar at the bottom.
GitHub answers come from [scripts/demo/github.ts](../../../scripts/demo/github.ts),
a recording, so every take is the same and nothing reaches the network; each
answer waits 700 ms, so `Scanning…` and `Loading repositories…` are visible.

## Prepared cases

In [scripts/demo/cases.ts](../../../scripts/demo/cases.ts):

| Case | Shows |
|---|---|
| `filter` | Scan `JetBrains/MPS`; filter by name, description (case-insensitive) and path; no match; clear the field, every skill back without a new scan |
| `organization` | Paste `https://github.com/JetBrains`; the repositories on the left; select `koog`, then `MPS` and filter there; a repository without skills |
| `errors` | An unknown organization and a local directory, in red |

Recorded GitHub: organization `JetBrains` with `android`, `koog`, `MPS`
(8 skills with `.claude` copies) and `intellij-sdk-docs` (no skills); `nobody-here`
is an unknown organization.

## Steps

1. Once: `npm ci` and `npx playwright install chromium-headless-shell`. Video
   also needs Playwright's ffmpeg: `npx playwright install ffmpeg`. If the
   Playwright CDN is blocked, put Chrome for Testing's `chrome-headless-shell`
   for the pinned version in `~/.cache/ms-playwright/chromium_headless_shell-<rev>/`
   (or set `CHROMIUM_PATH`), and link a system ffmpeg as
   `~/.cache/ms-playwright/ffmpeg-<rev>/ffmpeg-linux`; revisions are in
   `node_modules/playwright-core/browsers.json`.
2. `npm run demo` records `filter` and `organization` into
   `docs/demo/skill-atlas.webm`. Other cases or files:
   `node scripts/demo/record.ts errors --out /tmp/errors.webm`.
3. Each step waits for what `spec/web.md` promises; if the page does not show
   it within 10 s, the recording fails and no video is written. Fix the
   feature, not the case.
4. Watch it before you share it, e.g. a contact sheet:
   `ffmpeg -i docs/demo/skill-atlas.webm -vf "fps=1/4,scale=640:-1,tile=3x3" /tmp/sheet%d.png`.
   Keep it short: well under a minute and a few MB.

## A new feature

Add a case to `cases.ts`: a caption, then user actions (`type`, `page.click`),
each followed by `see(selector, text)` or an assertion on what shows. Add the
GitHub answers it needs to `github.ts`. Record only the cases the change is
about.

## The pull request

Attach the video to the pull request description when the change is visible
in the web page: drag the `.webm` into the description on GitHub, or commit it
under `docs/demo/` and link it. Say which cases it shows and the command.
