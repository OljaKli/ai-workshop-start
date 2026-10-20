# Web
`./skill-atlas serve [port]` starts the web client on port 3000 by default
(`0`: any free port) and prints `Skill Atlas on http://localhost:<port>`.
Like the CLI, a *thin client* over the core; *nothing is stored*.
`GITHUB_TOKEN`, optional, on the server: as for the CLI.
## Page
`GET /`: paste a **GitHub repository** URL (optionally `/tree/<commit>`), press
*Scan*. The page shows `<owner>/<repo> · N skills`, then each skill's **name**
(linked to its pinned SKILL.md), full **description**, path and `also in`
copies, then the warnings. When a repository has no skills, the page says so. The
scanned URL goes into the address bar as `?url=<GitHub URL>`, and opening such an
address scans it at once.
### Organization
Paste a **GitHub organization** URL, `https://github.com/<organization>`, instead:
the page shows `<organization> · N repositories`, then the repositories, sorted by
name, in a list on the *left*. Selecting one scans it and shows, on the *right*, its
summary, skills and warnings exactly as for a single repository. The organization
URL goes into the address bar like a repository URL.
States: `Loading repositories…` while the organization is listed, `Scanning…`
while a repository is scanned; `· 0 repositories` (no list) for an empty
organization; GitHub errors in red, for the organization above the list, for a
repository on the right, with the list kept. A late answer from an earlier scan
never replaces the current selection's status or results.
## API
`GET /api/scan?url=<GitHub URL>` answers JSON:
- 200: `{ repository: { id, url, commit }, skills: [{ id, name, description,
  path, link, copies }], warnings }`, skills sorted by **name**
- 400 `{ error }`: not a GitHub repository URL; *local directories are refused*
- 502 `{ error }`: GitHub cannot be scanned (not found, unreachable, rate limit),
  with the CLI's message

`GET /api/organization?url=<GitHub organization URL>` answers JSON:
- 200: `{ id, url, repositories: [{ id, name, url, description }] }`: every
  repository GitHub lists for the organization (all pages of 100), sorted by
  **name**, case-insensitively; public ones only without `GITHUB_TOKEN`
- 400 `{ error }`: not a GitHub organization URL (a repository URL included)
- 502 `{ error }`: GitHub cannot list it; an unknown organization is
  `Organization not found: https://github.com/<organization>`
- Any other path: 404 `{ error }`; other methods than GET/HEAD: 405
## Browser proof
`npm run test:browser` drives the page in headless Chromium with recorded GitHub
answers: scan, `also in`, warnings, HTML in a description shown as text, the
`?url=` address, and error messages; for an organization, the list on the left,
a selected repository's skills on the right, and the loading, empty and error states.
