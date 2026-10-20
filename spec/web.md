# Web
`./skill-atlas serve [port]` starts the web client on port 3000 by default
(`0`: any free port) and prints `Skill Atlas on http://localhost:<port>`.
Like the CLI, a *thin client* over the core; *nothing is stored*.
`GITHUB_TOKEN`, optional, on the server: as for the CLI.
## Page
`GET /`: paste a **GitHub repository** URL (optionally `/tree/<commit>`), press
*Scan*. The page shows `<owner>/<repo> · N skills`, then each skill's **name**
(linked to its pinned SKILL.md), full **description**, path and `also in`
copies, then the warnings. The scanned URL goes into the address bar as
`?url=<GitHub URL>`, and opening such an address scans it at once.

Once a scan finds skills, a filter field shows above them. Typing narrows the
displayed skills, *case-insensitively*, to those whose name, description or
path contains the text. Whitespace is matched as users see it in the page, so
words across a line break are separated by one space. When none match, the page says so. Clearing the field
shows every scanned skill again, *without rescanning* GitHub.
## API
`GET /api/scan?url=<GitHub URL>` answers JSON:
- 200: `{ repository: { id, url, commit }, skills: [{ id, name, description,
  path, link, copies }], warnings }`, skills sorted by **name**
- 400 `{ error }`: not a GitHub repository URL; *local directories are refused*
- 502 `{ error }`: GitHub cannot be scanned (not found, unreachable, rate limit),
  with the CLI's message
- Any other path: 404 `{ error }`; other methods than GET/HEAD: 405
## Browser proof
`npm run test:browser` drives the page in headless Chromium with recorded GitHub
answers: scan, `also in`, warnings, HTML in a description shown as text, the
`?url=` address, error messages, and the filter: matching, no matches, clearing.
