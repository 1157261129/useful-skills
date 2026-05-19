---
name: execute-issues
description: Use when executing already-written implementation issues with explicit issue paths, numbers, or references, and the user wants implementation rather than issue breakdown.
---

# Execute Issues

Use this skill when the user wants implementation, not issue breakdown.

Coordinate implementation through worker subagents. The main agent owns orchestration, dependency tracking, supervision, issue write-back, and user-facing progress updates. Keep implementation, debugging, verification, and detailed review inside workers by default. Do not terminate early merely because workers take time.

## Inputs

- Require explicit issue paths, issue numbers, or issue references from the user.
- Do not scan whole issue directories by default.
- Read each requested issue and its `Blocked by` section first.
- Pull in only the minimum extra context needed to execute safely.
- If a blocker is referenced but not included in the requested set, treat it as external and do not schedule downstream issues until the user includes it or explicitly overrides it.

## Before Dispatch

Ask before spawning any worker:

1. Should workers use `gpt-5.3-codex` with `xhigh`?
2. If not, offer concise alternatives: `gpt-5.5` with `high`, `gpt-5.4` with `high`, or `gpt-5.4-mini` with `medium`.
3. Should workers use the `tdd` skill?

Do not silently change the selected model or TDD policy later.

## Execution Graph

- Parse dependencies from `Blocked by`.
- Build a DAG from requested issues.
- Reject cycles or ambiguous dependency references and name the exact issue files involved.
- Schedule work by topological layer.
- Run all currently unblocked issues in the same layer in parallel.
- Do not dispatch downstream issues until every required upstream issue has completed successfully.

For a chain like `01 -> 02 -> 03/04`, run `01`, then `02`, then `03` and `04` together.

`Blocked by` example:

```markdown
## Blocked by

- [02 issue2](./02-issue.md)
- [03 issue3](./03-issue.md)
- [04 issue4](./04-issue.md)
```

## Main-Agent Scope

- Stay alive until execution is complete, blocked, failed, or explicitly stopped by the user.
- Do not produce a final handoff while any dispatched worker remains active.
- Do not pull large code, diff, test, or review context into the main agent when a worker can inspect and report it.
- Read additional local code in the main agent only to unblock orchestration or resolve contradictory worker reports.
- If substantial implementation or review work is needed, assign it to a worker.

## Worker Contract

For each runnable issue:

- Spawn one `worker` subagent.
- Give it exclusive responsibility for that issue.
- Tell it it is not alone in the codebase and must not revert work from other agents or the user.
- Tell it it runs in the same working directory as the main agent; by default, code changes land in that runtime directory.
- Pass the issue reference, acceptance criteria, satisfied dependency assumptions, and only the context needed for that issue.
- If TDD is enabled, attach the `tdd` skill and instruct the worker to use red-green-refactor in vertical slices.
- Tell the worker it owns issue-local code reading, implementation, debugging, verification, self-review, and final reporting.
- Tell the worker to continue until the issue is completed, failed, or genuinely blocked.
- Tell the worker to report terminally with `completed`, `failed`, or `blocked`, changed files, commands run, and remaining risks.

Workers should prefer small, safe, incremental changes with verification after meaningful milestones. If blocked, they must report the exact blocker, what was attempted, and what input is needed.

## Dispatch Format

- The first dispatch in a layer must use a valid tool payload. Do not probe the schema with a malformed call first.
- For parallel runnable issues, use one `multi_tool_use.parallel` call with one `functions.spawn_agent` entry per issue.
- `tool_uses[].parameters` must be a JSON object that matches `functions.spawn_agent` exactly.
- Use `message` or `items`, not both. If TDD is enabled, use `items` and attach the `tdd` skill plus one plain-text brief.
- Omit unused optional fields.
- If a schema retry is needed, fix it silently. Do not surface internal payload-correction notes unless the retry also fails.

## Supervision Defaults

Default to trust and patience:

- Presume a worker is making progress unless it explicitly reports `failed` or `blocked`, reaches another terminal state, or there is clear crash/unreachable evidence.
- Treat reading, editing, testing, debugging, verifying, preparing a report, running long commands, investigating failures, dependency installation, and local build/test waits as progress.
- If a worker is not clearly looping without progress, acknowledge it as active or progressing in user updates.
- Silence, slow replies, or lack of visible main-thread evidence are not failure, blockage, or idleness.
- Do not cancel, replace, take over, or mark a worker failed merely because it takes longer than expected.
- Do not dispatch dependent downstream issues while required upstream workers are non-terminal.

A worker is blocked only when it explicitly reports a blocker or there is clear evidence it cannot proceed without external input.

## Status Checks

Use status checks as liveness communication, not terminal-state collection:

- If a worker is slow but active, continue waiting; optionally ask for a concise progress update.
- If a worker appears silent for a long time, ask for status and continue waiting.
- If the worker does not reply, try communicating again later instead of speculating about its state.
- If the worker state is unknown, treat it as active unless clear crash/unreachable evidence exists.
- If it replies with progress, continue waiting.
- If it reports a blocker, handle it as blocked.
- If it clearly crashed or became unreachable, mark the issue failed and record the reason.

Do not locally take over unfinished worker scope unless terminal state, explicit blockage, or clear crash/unreachable evidence is confirmed.

## 30-Minute Terminal Window

Once a worker is on track, give it a 30-minute terminal window before expecting a terminal report. "On track" means it accepted the brief or is reading, editing, testing, debugging, verifying, running commands, or reporting partial progress.

- When tooling permits, wait with a 30-minute timeout, e.g. `wait_agent(timeout_ms: 1800000)`.
- If the environment requires shorter waits, treat each timeout as a heartbeat, not a terminal event.
- At the end of a window, if the worker still appears to be executing appropriately and has not reported failure or blockage, extend by another 30 minutes.
- Repeat extensions while progress is presumed and no terminal condition is confirmed.
- Do not perform terminal-state催收. Ask for concise status only when needed for liveness or coordination.

## Issue Write-Back

Before spawning a worker:

- Ensure the issue has a `## Comments` section; create it if missing.
- Append a short execution entry including date, selected model, TDD on/off, and dependency context.

After the worker finishes:

- Append a result entry under `## Comments` with success or failure, concise reason, changed files, and verification summary.

Status line rules:

- Preserve the project's existing triage vocabulary. Do not invent a new global status taxonomy silently.
- On success, leave `Status:` unchanged unless the project already has an explicit done-status convention.
- On failure, set `Status:` to `Needs human attention`.
- On blocked because an upstream issue failed, set `Status:` to `Needs human attention` and explain the blocker.
- On blocked because required dependency input is missing or ambiguous, set `Status:` to `Needs more information`.
- If the project already uses Chinese status values, use `需人工处理` for failures/upstream failures and `待补充信息` for missing or ambiguous dependency input.

## Failure Handling

- If any issue fails, do not dispatch its downstream dependents.
- Mark each skipped dependent as blocked in the final summary and issue comment log.
- Write the upstream blocker path or identifier and failure reason into each skipped issue.
- Continue running independent issues in the same layer.
- Do not stop the entire execution merely because one independent issue failed.
- Keep supervising all other already-running independent workers until they complete, fail, or become genuinely blocked.

## Layer Execution Rules

For each topological layer:

1. Identify all issues whose dependencies are satisfied.
2. Dispatch one worker per runnable issue.
3. Keep the main agent alive while workers run.
4. Wait until every worker in the layer reaches a terminal state.
5. Write back each worker result to its issue.
6. Determine which downstream issues are now unblocked.
7. Skip downstream issues whose dependencies failed or are blocked.
8. Continue to the next layer only after all required upstream issues completed successfully.

Do not dispatch a downstream layer while any required upstream worker is still running.

## Progress Updates

Provide concise user-facing updates when execution takes time:

- Which layer is running.
- Which issues are active and presumed progressing.
- Which issues completed, failed, or blocked.
- Whether the main agent is waiting inside a 30-minute window or has extended one.

Do not ask the user to confirm continuation while workers are active and unblocked. Continue supervising automatically. Do not turn progress updates into code walkthroughs unless the user asks for implementation detail.

## Final Handoff

Return a concise summary with:

1. execution order by layer
2. per-issue outcome
3. blocked issues and exact blocker chains
4. verification summary
5. next recommended user action

Produce the final handoff only after:

- all runnable workers reached terminal states,
- all issue write-backs are complete,
- downstream blocked issues are recorded,
- and no active worker remains running.

## Boundaries

- Execute already-written issues; do not break plans into issues. Use `to-issues` for issue breakdown.
- Prefer one worker per runnable issue in the current layer.
- Keep context minimal and issue-local work inside workers.
- Do not forward unrelated issue files to every worker.
