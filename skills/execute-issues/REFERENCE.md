# Execute Issues Reference

## Before Dispatch

Ask one combined question before spawning any worker:

Use the default worker dispatch profile?

- Model: choose by the current agent surface. Use `gpt-5.4` for Codex workers.
  Use `Sonnet 4.6` for Claude workers, translated to the valid model identifier accepted by the active subagent tool.
- Reasoning: the main agent selects each worker's reasoning effort from task difficulty,
  ambiguity, risk, dependency depth, and verification burden. Do not classify a task as simple lightly.
- TDD: worker decides based on task complexity, risk, and implementation scope; frontend page work does not use TDD.
- Concurrency: at most 2 worker subagents at once.

If the user declines or provides overrides, collect model, reasoning policy or per-worker
reasoning overrides, TDD policy, and max concurrency together. Do not silently change the selected profile later.

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
- Use a durable shared channel for worker status: issue `## Comments` by default,
  or an explicitly provided shared status file/memory key.

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

## Dispatch Format

- First dispatch in a scheduling cycle must use a valid tool payload.
- Fill multiple open concurrency slots with one `multi_tool_use.parallel` call.
- Never exceed selected concurrency; count implementation, review, and repair subagents in the same pool.
- Pass selected worker `model` and `reasoning_effort` in every payload.
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

- Use status checks for liveness, not premature terminal-state collection.
- If slow but active, continue waiting; optionally ask for concise shared-channel update.
- If shared channel is unchanged, try again later.
- If worker state is unknown, treat it as active unless clear crash or unreachable evidence exists.

## Abnormal Worker Stops

When a worker crashes, becomes unreachable, or has no usable runtime state:

1. Try to wake that worker up to 5 times through available worker/status channel.
2. Record each wake attempt in the shared channel when possible.
3. If it resumes, continue normal supervision.
4. If all 5 attempts fail, trip global stop: do not wake any subagent again,
   do not dispatch new implementation/review/repair workers, and do not take over issue work in the main agent.
5. Wait only for already-running workers to complete or abnormally terminate, then end with unresolved issues recorded.

## Terminal Window

Once a worker is on track, give it a 30-minute terminal window before expecting terminal report.
If tooling requires shorter waits, treat each timeout as heartbeat.
Extend by another 30 minutes while progress is presumed and no terminal condition is confirmed.

## Issue Write-Back

Before spawning workers:

- Ensure every requested issue has `## Comments`.
- Append execution entry to every requested issue with date, selected model, TDD policy,
  concurrency, dependency context, and constraint source.
- Finish write-back for full requested issue set before first dispatch.

After workers finish:

- Append result entry with success/failure, reason, changed files, verification summary,
  and review/repair recommendation.
- Base results on durable shared-channel reports, not worker-private chat-only statements.

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

1. Ensure every requested issue has reusable constraints.
2. Complete full issue-set write-back.
3. Do not dispatch workers until write-back completes.

After initial pass:

1. Maintain concurrency pool.
2. Recompute ready work whenever a worker reaches terminal state or capacity opens.
3. Dispatch ready implementation, review, or repair subagents immediately.
4. Write back each result promptly.
5. Skip downstream issues whose dependencies failed, blocked, had unfixable review findings, or failed repair.
6. Continue until no worker is running and no ready work remains.

## Progress Updates

Report active dependency layer or ready queue, active implementation/review/repair workers,
completed/failed/blocked issues, and whether the main agent is waiting inside a terminal window.

## Final Handoff

Return concise summary with execution order, per-issue outcome, blocker chains,
review/repair outcomes, verification summary, and next recommended user action.
Produce final only after all runnable workers are terminal, write-backs are complete,
downstream blockers are recorded, and no active worker remains.
