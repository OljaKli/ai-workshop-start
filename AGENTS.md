# AGENTS.md
## Specs
Read [./spec](spec/) first. Update it with the code.
## Tests
Integration tests for every case in the spec.
## Definition of done
- All tests pass locally
- When the change is visible in the web page, a demo video is attached to the PR:
  `npm run demo`, see [record-demo](.agents/skills/record-demo/SKILL.md)

## Commands
- `npm ci`: first, in a fresh checkout
- `npm test`: the tests
- `npm run test:browser`: the web page in headless Chromium; `npx playwright install chromium-headless-shell` once
- `npm run demo`: a demo video of the web page into `docs/demo/`
