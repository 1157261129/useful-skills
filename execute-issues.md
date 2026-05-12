---
name: execute-issues
description: Execute already-written issues end-to-end with worker subagents. Use when the user wants implementation work, not issue breakdown, and provides explicit issue paths, numbers, or references.
---

# Execute Issues

Use this skill when the user wants implementation, not issue breakdown.

This skill coordinates implementation through worker subagents. The main agent must remain active until the execution is complete, blocked, or explicitly stopped by the user. Do not terminate early merely because subagents are taking a long time. If a worker is still making progress and is not blocked, allow it to continue.

## Inputs

- Require explicit issue paths, issue numbers, or issue references from the user.
- Do not scan whole issue directories by default.
- Read each requested issue and its `Blocked by` section first.
- Pull in only the minimum extra context needed to execute safely.
- If a blocker is referenced but not included in the requested set, treat it as an external blocker and do not schedule downstream issues until the user includes it or explicitly overrides it.

## Before Dispatch

Ask the user these questions before spawning any subagent:

1. Should subagents use `gpt-5.3-codex` with `xhigh`?
2. If not, offer concise alternatives:
   - `gpt-5.5` with `high`
   - `gpt-5.4` with `high`
   - `gpt-5.4-mini` with `medium`
3. Should subagents use the `tdd` skill?

Do not silently choose a different model or TDD policy after these questions are answered.

## Build the Execution Graph

- Parse dependencies from `Blocked by`.
- Build a DAG from the requested issues.
- Reject cycles or ambiguous dependency references and explain the exact issue files involved.
- Schedule work by topological layer.
- Run all currently unblocked issues in the same layer in parallel.
- Do not dispatch downstream issues until every required upstream issue has completed successfully.

For a chain like `01 -> 02 -> 03/04`, run `01`, then `02`, then `03` and `04` together.

## Main-Agent Liveness and Patience

The main agent is responsible for staying alive, supervising subagents, and keeping the overall execution moving.

- The main agent must not exit, stop, or produce a final handoff while any dispatched subagent is still running.
- The main agent must wait patiently for subagents that are still making progress.
- Do not impose a short timeout on worker subagents by default.
- Do not cancel or replace a worker merely because it is taking longer than expected.
- As long as a worker is not blocked, crashed, or clearly looping without progress, continue waiting and allow it to finish its work.
- Prefer long-running supervision over premature termination.
- The main agent may provide brief progress updates to the user, but must not treat waiting as failure.
- If the runtime requires periodic activity to avoid idleness, the main agent should periodically check worker status and summarize progress instead of terminating.

A worker should be considered still valid to continue when any of the following are true:

- It is reading, editing, testing, debugging, or verifying.
- It reports partial progress.
- It is running a command that is expected to take time.
- It is investigating a failure and has not declared itself blocked.
- It is waiting on local verification, builds, tests, or dependency installation.

A worker should be considered blocked only when it explicitly reports a blocker or when there is clear evidence that it cannot proceed without external input.

## Subagent Contract

For each runnable issue:

- Spawn one `worker` subagent.
- Give it exclusive responsibility for that issue.
- Tell it it is not alone in the codebase and must not revert work from other agents or the user.
- Pass the issue reference, acceptance criteria, satisfied dependency assumptions, and only the context needed for that issue.
- If the user enabled TDD, attach the `tdd` skill and instruct the worker to use red-green-refactor in vertical slices.
- Tell the worker to implement the issue end-to-end, run the most relevant verification it can, and report:
  - `completed` or `failed`
  - changed files
  - tests or commands run
  - remaining risks

Workers should also be instructed:

- Continue working until the issue is completed, failed, or genuinely blocked.
- Do not stop early only because the task is large or verification takes time.
- If progress is possible, keep going.
- If blocked, report the exact blocker, what was attempted, and what input is needed.
- Avoid reverting or overwriting work from other workers unless the issue explicitly requires it and the conflict is understood.
- Prefer small, safe, incremental changes with verification after meaningful milestones.

## Dispatch Format

- The first dispatch in a layer must use a valid tool payload. Do not probe the schema with a malformed call first.
- For parallel runnable issues, use one `multi_tool_use.parallel` call with one `functions.spawn_agent` entry per issue.
- `tool_uses[].parameters` must be a JSON object that matches `functions.spawn_agent` exactly.
- Use `message` or `items`, not both. If TDD is enabled, use `items` and attach the `tdd` skill plus one plain-text brief.
- Omit unused optional fields.
- If a schema retry is needed, fix it silently. Do not surface internal payload-correction notes to the user unless the retry also fails.

## Worker Supervision

After dispatching workers, the main agent should supervise them until all workers in the current layer have reached a terminal state.

Terminal worker states are:

- `completed`
- `failed`
- `blocked`

Non-terminal states are:

- running
- reading context
- implementing
- testing
- debugging
- verifying
- preparing report

The main agent must not mark a worker failed simply because it is still in a non-terminal state.

If a worker is slow but active:

- Continue waiting.
- Optionally ask it for a concise progress update.
- Do not dispatch dependent downstream issues.
- Do not finalize the task.

If a worker appears idle or silent for a long time:

- Check whether the execution environment still shows activity.
- Ask the worker for a concise status update.
- If it responds with progress, continue waiting.
- If it reports a blocker, handle it as blocked.
- If it has clearly crashed or become unreachable, mark the issue failed and record the reason.

## Issue Write-Back

Before spawning a worker:

- Ensure the issue has a `## Comments` section; create it if missing.
- Append a short execution entry including date, selected model, TDD on or off, and dependency context.

After the worker finishes:

- Append a result entry under `## Comments` with success or failure, a concise reason, changed files, and a verification summary.

Status line rules:

- Preserve the project's existing triage vocabulary. Do not invent a new global status taxonomy silently.
- On success, leave `Status:` unchanged unless the project already has an explicit done-status convention.
- On failure, set `Status:` to `Needs human attention`.
- On blocked because an upstream issue failed, set `Status:` to `Needs human attention` and explain the blocker.
- On blocked because required dependency input is missing or ambiguous, set `Status:` to `Needs more information`.

If the project already uses Chinese status values, preserve them instead:

- Failure or upstream failure: `需人工处理`
- Missing or ambiguous dependency input: `待补充信息`

## Failure Handling

- If any issue fails, do not dispatch its downstream dependents.
- Mark each skipped dependent as blocked in the final summary and in the issue comment log.
- Write the upstream blocker path or identifier and the failure reason into each skipped issue.
- Continue running other issues in the same layer only if they are independent of the failed issue.
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

The main agent should provide concise user-facing updates when execution takes time.

Progress updates should include:

- Which layer is currently running.
- Which issues are still in progress.
- Which issues completed or failed.
- Whether the main agent is still waiting on active workers.

Do not ask the user to confirm continuation while workers are still active and unblocked. Continue supervising automatically.

## Final Handoff

Return a concise summary with:

1. execution order by layer
2. per-issue outcome
3. blocked issues and exact blocker chains
4. verification summary
5. next recommended user action

The final handoff may only be produced after:

- all runnable workers have reached terminal states,
- all issue write-backs are complete,
- downstream blocked issues have been recorded,
- and no active subagent remains running.

## Boundaries

- This skill executes already-written issues.
- It does not break plans into issues; use `to-issues` for that.
- Prefer one subagent per runnable issue in the current layer.
- Keep context minimal.
- Do not forward unrelated issue files to every subagent.
- Do not terminate the main agent while subagents are still active and unblocked.
