---
name: execute-issues
description: Executes existing implementation issues through supervised workers, dependency scheduling, write-back, review, and repair. Use when the user provides issue paths, issue numbers, or issue references and wants implementation rather than issue breakdown.
---

# Execute Issues

Use this skill to implement existing issues. Do not use it to break plans into issues; use `to-issues` for that.

## Required Inputs

- Explicit issue paths, issue numbers, or issue references.
- A user request for implementation, not planning or triage.

## Workflow

1. Read each requested issue and its `Blocked by` section.
2. Ask one combined dispatch-profile question: model, reasoning policy, TDD policy, and max concurrency.
3. Build a dependency DAG; reject cycles or ambiguous blockers with exact issue references.
4. Ensure each requested issue has a `## Comments` shared channel and reusable `Dispatch Constraints`.
5. Run `prepare-dispatch-constraints` only for requested issues missing `Dispatch Constraints`.
6. Write one execution-start entry to every requested issue before dispatch.
7. Dispatch ready implementation workers continuously, capped by selected concurrency.
8. Supervise through issue-file heartbeat: request heartbeat, re-read the issue file, then interpret worker state.
9. Missing heartbeat is not a failure count; wake the worker and dispatch a heartbeat task before abnormal-stop handling.
10. After terminal implementation, dispatch review and repair workers when required.
11. Write back every implementation, review, repair, skipped, blocked, failed, or completed result.
12. Finish only when no runnable worker remains active and all downstream blockers are recorded.

## Worker Rules

- One implementation worker owns one runnable issue.
- Workers must not revert user or other-agent changes.
- Workers must use issue `## Comments` for progress, blockers, and terminal reports.
- Workers must answer heartbeat immediately by appending a status entry to issue `## Comments`.
- Downstream issues wait for upstream implementation plus required review and repair success.
- Main agent supervises scheduling and write-back.
- Workers own issue-local reading, implementation, debugging, verification, self-review, and terminal reporting.

## Defaults

- Max concurrency: 2 worker subagents.
- TDD: worker decides by complexity, risk, and scope; frontend page work skips TDD.
- Default model: choose by active agent surface as specified in [REFERENCE.md](REFERENCE.md).
- Reasoning: main agent chooses per worker from difficulty, ambiguity, risk, dependency depth, and verification burden.

## Detailed Protocol

See [REFERENCE.md](REFERENCE.md) for dispatch payload rules, supervision, heartbeat,
abnormal stops, issue write-back, review/repair loops, failure handling,
ready-queue scheduling, progress updates, and final handoff format.
