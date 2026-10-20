# Web
`./skill-atlas serve [port]` starts the web client on port 3000 by default
(`0`: any free port) and prints `Skill Atlas on http://localhost:<port>`.
Like the CLI, a *thin client* over the core; *nothing is stored*.
`GITHUB_TOKEN`, optional, on the server: as for the CLI.
## Page
`GET /`: paste a **GitHub repository** URL (optionally `/tree/<commit>`), press
*Scan*. The page shows `<owner>/<repo> · N skills`, then each skill's **name**
(linked to its pinned SKILL.md), full **description**, path and `also in`
copies, and `updated YYYY-MM-DD`, then the warnings. When a repository has no
skills, the page says so.

### Last updated
Each skill shows the date its SKILL.md last changed, as of the scanned commit,
in UTC: `updated YYYY-MM-DD`. The date needs `GITHUB_TOKEN` on the server, like
code search: one GitHub request per skill. Without a token no date is shown and
nothing else changes. When GitHub cannot tell for some skills, those skills show
no date and one warning says how many; the scan still succeeds. The filter does
not match the date; the CLI does not look it up, and its output is unchanged.
The scanned URL goes into the address bar as `?url=<GitHub URL>`, and opening
such an address scans it at once.

Once a scan finds skills, a filter field shows above them. Typing narrows the
displayed skills, *case-insensitively*, to those whose name, description or
path contains the text. Whitespace is matched as users see it in the page, so
words across a line break are separated by one space. When none match, the page
says so. Clearing the field shows every scanned skill again, *without
rescanning* GitHub.

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
  path, link, copies, updated }], warnings }`, skills sorted by **name**;
  `updated` is `YYYY-MM-DD` or `null` when not known
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
`?url=` address, error messages, the `updated` dates: shown, no token, a failed
lookup, and the filter: matching, no matches, clearing;
for an organization, the list on the left, a selected repository's skills on
the right, and the loading, empty and error states.
## Demo
`npm run demo` records the page, with recorded answers from the JetBrains
snapshots, into `docs/demo/skill-atlas.webm` and a GIF of it, `skill-atlas.gif`: the filter on JetBrains/MPS, then
the JetBrains organization, one repository at a time, then the `updated` dates
on JetBrains/android
([demo-video](../.agents/skills/demo-video/SKILL.md)).
