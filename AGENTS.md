# AGENTS.md
## Specs
Read [./spec](spec/) first. Update it with the code.
## Tests
Integration tests for every case in the spec.
## Definition of done
- All tests pass locally
- A user-visible change: a demo video attached to the PR, when applicable: its GIF
  inline, a link to the full video
  ([demo-video](.agents/skills/demo-video/SKILL.md))

## Commands
- `npm ci`: first, in a fresh checkout
- `npm test`: the tests
- `npm run test:browser`: the web page in headless Chromium; `npx playwright install chromium-headless-shell` once
- `npm run demo`: records docs/demo/skill-atlas.webm, a video of the web page, and its GIF
