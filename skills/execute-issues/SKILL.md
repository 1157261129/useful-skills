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
2. Ask one blocking dispatch-profile confirmation: model, reasoning policy, TDD policy, max concurrency, worker wait window, and heartbeat write wait. Wait for an explicit user answer before any execution-start write-back or worker dispatch.
3. Build a dependency DAG; reject cycles or ambiguous blockers with exact issue references.
4. Ensure each requested issue has a `## Comments` shared channel and reusable `Dispatch Constraints`.
5. Run `prepare-dispatch-constraints` only for requested issues missing `Dispatch Constraints`.
6. Write one execution-start entry to every requested issue before dispatch.
7. Dispatch ready implementation workers continuously, capped by selected concurrency.
8. Supervise through issue-file heartbeat: wait until an active worker reaches the selected worker wait window, request heartbeat from that worker, wait for the worker to write it, then re-read the issue file.
9. If heartbeat is still missing after the heartbeat write wait, do not count it as failure; wake the worker and dispatch a heartbeat task before abnormal-stop handling.
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
- Worker wait window: 30 minutes before routine heartbeat/status confirmation for a worker.
- TDD: worker decides by complexity, risk, and scope; frontend page work skips TDD.
- Default model: choose by active agent surface as specified in [REFERENCE.md](REFERENCE.md).
- Reasoning: main agent chooses per worker from difficulty, ambiguity, risk, dependency depth, and verification burden.
- Heartbeat write wait: 5 minutes after each heartbeat or wake-and-heartbeat request before re-reading the issue file.
- Defaults are only the proposed profile. User silence, no visible objection, or "if unchanged I will proceed" does not confirm the profile.

## Detailed Protocol

See [REFERENCE.md](REFERENCE.md) for dispatch payload rules, supervision, heartbeat,
abnormal stops, issue write-back, review/repair loops, failure handling,
ready-queue scheduling, progress updates, and final handoff format.
