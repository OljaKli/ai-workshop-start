# Repository analysis
## Input
A **GitHub repository** URL, or a local directory
## Output
Every `SKILL.md`: **name**, **description**, **link**
## Architecture
Core: fetch → find → parse. CLI: a *thin client*.
Skill: id = `repo:path`, name, description, commit
## Project skill
A project skill is a `SKILL.md` used by the repository's agents or shipped to
users as part of the product. A `SKILL.md` in a test resources source set is
test data, not a project skill.

The same root-relative path under `.agents/skills`, `.claude/skills`,
`.github/skills`, or `agent/skills` is one skill with copies. The first root in
that order is canonical: its path supplies the skill id, metadata and link;
the other paths are copies.
## Details
- **GitHub API**, no clone; *under 5 s* for intellij-community
- Truncated GitHub trees are completed by recursively scanning their subtrees
- Exact, case-sensitive `SKILL.md` files can live anywhere, including product resources
- Test resources under `src/<...Test>/resources` are excluded
- The name: front matter, else the directory
- The link pins the *scanned commit*
- Malformed front matter → a *warning*, the scan goes on
- Unreachable repository → a clear message, exit code 1
