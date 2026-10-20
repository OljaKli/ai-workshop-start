---
name: code-review
description: Review a pull request for concrete defects and leave concise, reproducible inline comments.
---

# Code review

Review the pull request briefly in its web diff. Inspect enough surrounding code to verify each finding.

- Read existing reviews and inline threads first. If a review contains
  `<!-- air-code-review:<head-sha> -->` for the current head commit, stop: that
  exact revision was already reviewed.
- Do not repeat an existing finding for the same defect and location. Never
  reply to review comments or change code; addressing findings belongs to the
  `address-review` automation.
- Leave one inline comment per concrete defect on the smallest relevant changed line.
- State where it occurs and the minimal verified steps or command that reproduce it, including expected versus actual behavior.
- Include the impact and the smallest useful fix direction.
- Skip summaries, praise, style nits, and speculative concerns. If there are no findings, say so without adding inline comments.
- End the submitted review body with `<!-- air-code-review:<head-sha> -->`, using
  the full current head commit SHA. This is durable state for scheduled runs.
