---
name: work
description: Drain open comment threads - locate, fix, verify, reply, resolve each one.
---

Drain the open-comment queue end to end. Read `.agentic-prd.dev.json` (walk up
from cwd) for `{port, prefix}`; base URL `http://localhost:{port}{prefix}`.

1. `GET /threads?resolved=false` — collect open threads (oldest first).
2. For each thread:
   a. `GET /threads/{id}/location` — pick the best candidate, skipping any that
      point into `node_modules/` or a package `dist/` (bundle false-positives).
      Empty candidates → grep the anchor's `selector` / `data-testid`, and check
      the screen's spec (`GET /specs?path={thread.path}`).
   b. Read the code, make the fix the comment asks for. If the request is
      ambiguous or the location can't be found, do NOT guess: append a reply
      asking a concrete question and leave the thread unresolved, then continue
      to the next thread.
   c. Verify: run the project's typecheck/test script if present.
   d. Reply with what changed:
      `POST /threads/{id}/comments` body
      `{"author":"Claude","text":"수정했습니다 — <무엇을 어떻게, 1-2문장>"}`
   e. `POST /threads/{id}/resolve`.
3. Finish with a summary table: thread id, path, action (fixed/skipped), note.

Never resolve a thread you didn't actually fix. Batch-verify at the end as well
(full typecheck) if multiple threads touched code.
