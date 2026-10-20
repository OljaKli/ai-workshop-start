---
name: address-review
description: Address actionable pull-request review comments once, with fixes, verification, and concise replies.
---

# Address review

Work on the current pull request branch. Read its inline review threads and
existing replies before changing code.

For each actionable unresolved root comment:

1. Let `<comment-id>` be its GitHub review-comment ID. Skip it if any existing
   reply contains `<!-- air-address-review:<comment-id> -->`.
2. Verify the report against the current head and reproduce it when practical.
3. Make the smallest correct fix. Update the spec and integration coverage when
   behavior changes, then run the relevant checks from `AGENTS.md`.
4. Commit and push the verified changes once for the run.
5. Reply to the original thread with what changed and the verification command,
   ending with `<!-- air-address-review:<comment-id> -->`. If the report is no
   longer applicable or cannot be reproduced, reply with that evidence and the
   same marker instead of changing code.

Never create a second reply for a marked comment. Ignore review summaries,
replies, resolved threads, praise, and non-actionable discussion. Do not merge
or close the pull request.
