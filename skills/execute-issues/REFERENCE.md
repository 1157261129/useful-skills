# Execute Issues Reference

## Before Dispatch

Ask one combined blocking confirmation before any execution-start write-back or worker spawn.
Do not proceed on silence, assumed agreement, or a non-blocking notice.
The profile is selected only after the user explicitly confirms the default profile
or provides overrides.

Use the default worker dispatch profile?

- Model: use the active subagent tool default unless the user overrides it. If an
  explicit model ID is required, use one accepted by that tool and record it in the execution-start entry.
- Reasoning: the main agent selects each worker's reasoning effort from task difficulty,
  ambiguity, risk, dependency depth, and verification burden. Do not classify a task as simple lightly.
- TDD: worker decides based on task complexity, risk, and implementation scope; frontend page work does not use TDD.
- Concurrency: at most 2 worker subagents at once.
- Worker wait window: 30 minutes before routine heartbeat/status confirmation for a worker.
- Heartbeat write wait: 5 minutes after each heartbeat or wake-and-heartbeat request before re-reading the issue file.

If the user declines or provides overrides, collect model, reasoning policy or per-worker
reasoning overrides, TDD policy, max concurrency, worker wait window, and heartbeat write wait together. Do not silently change the selected profile later.

Do not phrase this as a non-blocking notice such as "change it if needed; otherwise I will run with the default."
Ask the profile question, then stop orchestration until the user answers.

## Execution Graph

- Parse dependencies from `Blocked by`.
- Build a DAG from requested issues.
- Reject cycles or ambiguous dependency references and name the exact issue files involved.
- Use topological layers to determine dependency eligibility, not as batch barriers.
- Maintain a ready queue for implementation, review, and repair subagents.
- Dispatch ready subagents immediately when the concurrency pool has capacity.
- Do not dispatch downstream implementation until every required upstream issue has completed
  implementation and required review/repair successfully.

For a chain like `01 -> 02 -> 03/04`, run `01`, then `02`, then `03` and `04` together.

## Main-Agent Scope

- Stay alive until execution is complete, blocked, failed, or explicitly stopped.
- Do not produce a final handoff while any dispatched worker remains active.
- Keep implementation, repair, debugging, verification, and detailed review inside workers by default.
- Read local code in the main agent only to unblock orchestration or resolve contradictory worker reports.
- Use issue `## Comments` as the durable shared channel for worker status.

## Dispatch Constraints

- Ensure every requested issue has a `Dispatch Constraints` block before dispatch.
- Reuse existing constraints. Do not regenerate, refresh, or append duplicates unless
  the user requests refresh, the block is marked `stale`, `superseded`, or `invalid`,
  or a worker reports concrete conflicts with exact anchors.
- Run `prepare-dispatch-constraints` only for requested issues missing constraints.
- Pass harvested constraints to each worker brief.

## Worker Contract

For each runnable implementation issue:

- Spawn one issue worker subagent and give it exclusive responsibility for that issue.
- Tell it it runs in the same working directory as the main agent and must not revert work from other agents or the user.
- Pass issue reference, acceptance criteria, satisfied dependency assumptions,
  dispatch constraints, and only issue-relevant context.
- Apply selected TDD policy.
- Tell the worker to continue until completed, failed, or genuinely blocked.
- Require terminal report: `completed`, `failed`, or `blocked`, changed files,
  commands run, remaining risks, and whether review is needed.
- Tell the worker that heartbeat/status-check requests interrupt normal work: on receipt,
  append a heartbeat entry to issue `## Comments` before continuing any other task.

## Dispatch Format

- First dispatch in a scheduling cycle must use a valid tool payload.
- Fill multiple open concurrency slots with one `multi_tool_use.parallel` call.
- Never exceed selected concurrency; count implementation, review, and repair subagents in the same pool.
- Pass selected worker `model` and `reasoning_effort` when the subagent tool schema supports them.
- If `fork_context: true` is used, omit `agent_type`; put worker ownership in the prompt.
- Use `message` or `items`, not both. If TDD is forced, use `items` and attach
  the `tdd` skill plus one plain-text brief.
- Omit unused optional fields. Fix schema retries silently unless retry also fails.

## Supervision

- Presume a worker is progressing unless it explicitly reports `failed` or `blocked`,
  reaches terminal state, or enters abnormal-stop flow.
- Treat reading, editing, testing, debugging, verifying, dependency installation, and long build/test waits as progress.
- Do not cancel, replace, take over, or mark failed merely because work is slow.
- A worker is terminal only when both shared-channel report and worker runtime state are terminal,
  or abnormal-stop flow resolves it.
- If a worker shared channel has terminal-looking text while runtime remains active, keep waiting.

## Status Checks

- Use status checks for liveness after the selected worker wait window elapses, not premature terminal-state collection.
- Track the worker wait window per active worker from dispatch time, the latest fresh heartbeat, or the latest confirmed progress, whichever is later.
- Do not request routine heartbeat for a worker until that worker reaches the selected worker wait window.
- Heartbeat is issue-file based. When the main agent requests heartbeat, it must wait
  for the selected heartbeat write wait, allowing the worker to append heartbeat, then re-read the issue file
  before interpreting worker state or deciding the next action.
- A worker that receives heartbeat must immediately append a concise heartbeat entry to
  the issue `## Comments`, including current state, current step, blockers if any,
  and whether it is still working.
- If slow but active and still inside the selected worker wait window, continue waiting.
- If the issue file has a fresh heartbeat, treat the worker as active unless it also
  reports `completed`, `failed`, or `blocked`.
- If the issue file is unchanged after heartbeat, do not mark failed and do not increment
  the 5-attempt abnormal-stop counter. Wake the worker, dispatch an explicit heartbeat
  task, wait for the selected heartbeat write wait, then re-read the issue file.
- If worker state is unknown, treat it as active unless clear crash or unreachable evidence exists.

## Abnormal Worker Stops

When a worker crashes, becomes unreachable, or has no usable runtime state:

1. Re-read the issue file before counting or recording any abnormal-stop attempt.
2. Wake that worker and dispatch an explicit heartbeat task through the available worker/status channel.
3. Record each wake attempt in issue `## Comments`; if write-back fails, keep the failure reason for final handoff.
4. Wait for the selected heartbeat write wait after each wake-and-heartbeat attempt, then re-read the issue file.
5. Count a failed wake attempt only when clear crash or unreachable evidence remains and
   no fresh heartbeat was written. Missing heartbeat alone is not a counted failure.
6. If it resumes or writes heartbeat, continue normal supervision.
7. If 5 counted wake attempts fail, trip global stop: do not wake any subagent again,
   do not dispatch new implementation/review/repair workers, and do not take over issue work in the main agent.
8. Wait only for already-running workers to complete or abnormally terminate, then end with unresolved issues recorded.

## Worker Wait Window

The worker wait window is a dispatch-profile parameter. Default: 30 minutes.
Once a worker is on track, give it the selected worker wait window before expecting terminal report
or routine heartbeat confirmation.
If tooling produces a non-terminal timeout before the selected worker wait window elapses,
continue waiting; do not count it as failure.
After a fresh heartbeat or confirmed progress, restart the selected worker wait window.

## Issue Write-Back

Before spawning workers:

- Confirm the dispatch profile with the user and record the selected profile.
- Ensure every requested issue has `## Comments`.
- Append execution entry to every requested issue with date, selected model, TDD policy,
  concurrency, worker wait window, heartbeat write wait, dependency context, and constraint source.
- Finish write-back for full requested issue set before first dispatch.

After workers finish:

- Append result entry with success/failure, reason, changed files, verification summary,
  and review/repair recommendation.
- Base results on issue `## Comments` reports, not worker-private chat-only statements.

## Review And Repair

- If implementation terminal report says review is needed, enqueue one review worker unless global stop has tripped.
- Review worker reviews only and must not modify code unless user explicitly asks.
- If review reports fixable findings, enqueue one repair implementation worker.
- Repair worker may modify code only within reviewed issue scope.
- Repeat review/repair only while each cycle reports concrete progress.
- Stop on success, explicit failure, genuine blockage, unfixable findings,
  repeated findings without progress, or global stop.
- If review/repair fails or blocks, treat issue as failed and do not dispatch downstream dependents.

## Status Lines

- Preserve project triage vocabulary.
- On success, leave `Status:` unchanged unless project has explicit done-status convention.
- On failure or upstream failure, set `Status:` to `Needs human attention`;
  use `需人工处理` when project uses Chinese statuses.
- On missing or ambiguous dependency input, set `Status:` to `Needs more information`;
  use `待补充信息` when project uses Chinese statuses.

## Failure Handling

- If any issue fails, do not dispatch downstream dependents.
- Mark skipped dependents as blocked in final summary and issue comments.
- Continue independent ready work in the same dependency layer.
- Do not stop entire execution because one independent issue failed.

## Ready-Queue Scheduling

Before first dispatch:

1. Confirm the dispatch profile with the user.
2. Ensure every requested issue has reusable constraints.
3. Complete full issue-set write-back.
4. Do not dispatch workers until write-back completes.

After initial pass:

1. Maintain concurrency pool.
2. Recompute ready work whenever a worker reaches terminal state or capacity opens.
3. Dispatch ready implementation, review, or repair subagents immediately.
4. Write back each result promptly.
5. Skip downstream issues whose dependencies failed, blocked, had unfixable review findings, or failed repair.
6. Continue until no worker is running and no ready work remains.

## Progress Updates

Report active dependency layer or ready queue, active implementation/review/repair workers,
completed/failed/blocked issues, and whether the main agent is waiting inside a worker wait window.

## Final Handoff

Return concise summary with execution order, per-issue outcome, blocker chains,
review/repair outcomes, verification summary, and next recommended user action.
Produce final only after all runnable workers are terminal, write-backs are complete,
downstream blockers are recorded, and no active worker remains.
