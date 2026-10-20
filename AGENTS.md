# AGENTS.md
## Specs
Read [./spec](spec/) first. Update it with the code.
## Tests
Integration tests for every case in the spec.
## Definition of done
- All tests pass locally, `npm run e2e` included
- A changed screenshot: its new baseline in the same PR, made on Linux like CI
  (`npm run screenshots -- accept`, or `-- accept --local` in a Linux cloud machine),
  for the reviewer to approve in the PR's image diff; never from macOS or Windows
- A user-visible change: a demo video attached to the PR, when applicable: its GIF
  inline, a link to the full video
  ([demo-video](.agents/skills/demo-video/SKILL.md))

## Commands
- `npm ci`: first, in a fresh checkout
- `npm test`: the tests
- `npm run test:browser`: the web page in headless Chromium; `npx playwright install chromium-headless-shell` once
- `npm run e2e`: the demo as screenshot tests, pixel by pixel against spec/screenshots, a video of each
- `npm run e2e:linux`: the same in the Playwright Linux image (Docker), from any system
- `npm run screenshots -- summary | accept [--local]`: the changed screenshots; accept them as baselines
- `npm run demo`: records docs/demo/skill-atlas.webm, a video of the web page, and its GIF
