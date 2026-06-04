---
name: execute-issues
description: Use when executing already-written implementation issues with explicit issue paths, numbers, or references, and the user wants implementation rather than issue breakdown.
---

# Execute Issues

Use this skill when the user wants implementation, not issue breakdown.

Coordinate implementation through worker subagents. The main agent owns orchestration, dependency tracking, supervision, issue write-back, and user-facing progress updates. Keep implementation, repair, debugging, verification, and detailed review inside workers by default. Do not terminate early merely because workers take time.

If a worker's shared channel contains a terminal-looking report while the worker process is still running, keep waiting. Do not interrupt, cancel, replace, take over, or produce a final handoff until the worker itself has reached a terminal state.

## Inputs

- Require explicit issue paths, issue numbers, or issue references from the user.
- Do not scan whole issue directories by default.
- Read each requested issue and its `Blocked by` section first.
- Pull in only the minimum extra context needed to execute safely.
- If a blocker is referenced but not included in the requested set, treat it as external and do not schedule downstream issues until the user includes it or explicitly overrides it.

## Before Dispatch

Ask one combined question before spawning any worker:

Use the default worker dispatch profile?

- Model: choose by the current agent surface. Use `gpt-5.4` for Codex workers; use `Sonnet 4.6` for Claude workers, translated to the valid model identifier accepted by the active subagent tool.
- Reasoning: the main agent selects each worker's reasoning effort from task difficulty, ambiguity, risk, dependency depth, and verification burden. Do not classify a task as simple lightly; use a lower effort only when the issue is tiny, isolated, well-specified, and low-risk.
- TDD: worker decides based on task complexity, risk, and implementation scope; frontend page work does not use TDD.
- Concurrency: at most 2 worker subagents at once.

If the user declines or provides overrides, collect model, reasoning policy or per-worker reasoning overrides, TDD policy, and max concurrency together. Offer only model and reasoning alternatives that are available in the current agent surface.

Do not silently change the selected model, reasoning policy, TDD policy, or concurrency later.

## Execution Graph

- Parse dependencies from `Blocked by`.
- Build a DAG from requested issues.
- Reject cycles or ambiguous dependency references and name the exact issue files involved.
- Use topological layers to determine dependency eligibility, not as batch barriers.
- Maintain a ready queue for implementation, review, and repair subagents.
- When the concurrency pool has capacity, dispatch ready subagents immediately, capped by the selected concurrency.
- A subagent is ready only when its own gates are satisfied: dependency completion for implementation, terminal implementation for review, and terminal fixable review findings for repair.
- Do not dispatch downstream implementation until every required upstream issue has completed implementation and required review/repair successfully.

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
- Do not pull large code, diff, test, review, or repair context into the main agent when a worker can inspect and report it.
- Read additional local code in the main agent only to unblock orchestration or resolve contradictory worker reports.
- Run `prepare-dispatch-constraints` before dispatch only for requested issues that do not already contain a `Dispatch Constraints` block in their shared channel.
- If substantial implementation, review, or repair work is needed, assign it to a worker.
- Use a durable shared channel for worker status: issue `## Comments` by default, or an explicitly provided shared status file/memory key. Do not rely on worker chat-only status text.

## Dispatch Constraints

Before spawning any worker in the requested execution set:

- Ensure every requested issue has a `Dispatch Constraints` block in its shared channel.
- If an issue already has `Dispatch Constraints`, reuse it. Do not regenerate, refresh, or append a duplicate unless the refresh conditions below are met.
- If any requested issue lacks `Dispatch Constraints`, run the `prepare-dispatch-constraints` skill for only the missing issues.
- Treat existing `Dispatch Constraints` as cached instructions. Do not infer staleness from age, issue size, or changed surrounding discussion.
- Refresh existing constraints only when the user explicitly asks for refresh/rebuild, the existing block is explicitly marked `stale`, `superseded`, or `invalid`, or a worker reports concrete conflicts with exact anchors.
- Do not dispatch any worker until every requested issue has either reusable constraints or an explicit "no relevant constraints found" note.
- Pass the harvested constraints to the worker brief.

## Worker Contract

For each runnable implementation issue:

- Spawn one issue worker subagent; when `fork_context: true`, assign worker responsibility in the brief instead of setting `agent_type`.
- Give it exclusive responsibility for that issue.
- Tell it it is not alone in the codebase and must not revert work from other agents or the user.
- Tell it it runs in the same working directory as the main agent; by default, code changes land in that runtime directory.
- Pass the issue reference, acceptance criteria, satisfied dependency assumptions, harvested dispatch constraints, and only the context needed for that issue.
- Apply the selected TDD policy:
  - Default: let the worker decide whether TDD is warranted by complexity, risk, and implementation scope; frontend page work skips TDD.
  - Force TDD: attach the `tdd` skill and require red-green-refactor in vertical slices.
  - No TDD: do not attach the `tdd` skill, but still require relevant verification.
- Tell the worker it owns issue-local code reading, implementation, debugging, verification, self-review, and final reporting.
- Tell the worker to continue until the issue is completed, failed, or genuinely blocked.
- Tell the worker the `Dispatch Constraints` note in the shared channel is mandatory context. If any cited anchor is missing, stale, or conflicts with the issue or code reality, it must report the exact conflicting anchors before deviating.
- Tell the worker to write progress, blockers, and terminal reports to the shared channel, not only to its own chat.
- Tell the worker to report terminally with `completed`, `failed`, or `blocked`, changed files, commands run, remaining risks, and whether a review worker is needed.

Workers should prefer small, safe, incremental changes with verification after meaningful milestones. If blocked, they must report the exact blocker, what was attempted, and what input is needed.

## Dispatch Format

- The first dispatch in a scheduling cycle must use a valid tool payload. Do not probe the schema with a malformed call first.
- When filling multiple open concurrency slots, use one `multi_tool_use.parallel` call with one `functions.spawn_agent` entry per ready implementation, review, or repair subagent.
- Never exceed the selected concurrency; count implementation, review, and repair subagents in the same pool.
- `tool_uses[].parameters` must be a JSON object that matches `functions.spawn_agent` exactly.
- Pass the selected worker model and reasoning in every dispatch payload as `model` and `reasoning_effort`. Do not rely on inherited parent settings to satisfy the selected dispatch profile.
- For the default profile, derive `model` from the current agent surface: Codex uses `gpt-5.4`; Claude uses `Sonnet 4.6` with the active tool's valid model identifier.
- Set `reasoning_effort` to the main agent's selected value for that worker. Choose the least excessive effort that is still safe for the issue; when uncertain, prefer a higher effort over misclassifying nontrivial work as simple.
- Treat prior review feedback that the same issue was completed poorly as a signal to consider increasing `reasoning_effort` on subsequent attempts.
- If `fork_context: true` is used, omit `agent_type`; forked agents inherit the parent agent type and must not also receive `agent_type: "worker"`. Treat worker ownership as part of the prompt contract instead.
- Use `message` or `items`, not both. If TDD is forced, use `items` and attach the `tdd` skill plus one plain-text brief.
- Omit unused optional fields.
- If a schema retry is needed, fix it silently. Do not surface internal payload-correction notes unless the retry also fails.

## Supervision Defaults

Default to trust and patience:

- Presume a worker is making progress unless it explicitly reports `failed` or `blocked`, reaches another terminal state, or enters the abnormal-stop flow below.
- Treat reading, editing, testing, debugging, verifying, preparing a report, running long commands, investigating failures, dependency installation, and local build/test waits as progress.
- If a worker is not clearly looping without progress, acknowledge it as active or progressing in user updates.
- Silence, slow replies, or lack of visible main-thread evidence are not failure, blockage, or idleness.
- Do not cancel, replace, take over, or mark a worker failed merely because it takes longer than expected.
- Do not stop supervising a worker merely because its shared channel contains `completed`, `failed`, or `blocked` while the worker process is still active.
- Do not dispatch dependent downstream issues while required upstream workers are non-terminal.

A worker is terminal only when both the shared-channel report and the worker runtime state are terminal, or when `Abnormal Worker Stops` resolves it. A worker is blocked only when it explicitly reports a blocker or there is clear evidence it cannot proceed without external input.

## Status Checks

Use status checks as liveness communication, not terminal-state collection:

- If a worker is slow but active, continue waiting; optionally ask it to write a concise update to the shared channel.
- If a worker appears silent for a long time, ask for status through the shared channel and continue waiting.
- If the shared channel is unchanged, try again later instead of speculating about its state.
- If the worker state is unknown, treat it as active unless clear crash/unreachable evidence exists.
- If the shared channel shows progress, continue waiting.
- If the shared channel shows a terminal report but the worker runtime remains active, continue waiting and do not interrupt the worker.
- If it reports a blocker, handle it as blocked.
- If it clearly crashed or became unreachable, follow `Abnormal Worker Stops`.

Do not locally take over unfinished worker scope. Terminal state, explicit blockage, or abnormal stop affects scheduling and write-back only.

## Abnormal Worker Stops

Use this flow when a worker crashes, becomes unreachable, or has no usable runtime state after a status check:

- Try to wake that worker up to 5 times through the available worker/status channel.
- Record each wake attempt in the shared channel when possible.
- If the worker resumes, continue normal supervision.
- If all 5 wake attempts fail, trip a global stop: do not wake any subagent again, do not dispatch implementation, review, or repair subagents, and do not take over any issue work in the main agent.
- After a global stop, wait only for already-running workers to complete or abnormally terminate, then end this execution with unresolved issues recorded.

## 30-Minute Terminal Window

Once a worker is on track, give it a 30-minute terminal window before expecting a terminal report. "On track" means it accepted the brief or is reading, editing, testing, debugging, verifying, running commands, or reporting partial progress.

- When tooling permits, wait with a 30-minute timeout, e.g. `wait_agent(timeout_ms: 1800000)`.
- If the environment requires shorter waits, treat each timeout as a heartbeat, not a terminal event.
- At the end of a window, if the worker still appears to be executing appropriately and has not reported failure or blockage, extend by another 30 minutes.
- Repeat extensions while progress is presumed and no terminal condition is confirmed.
- Do not chase terminal reports. Ask for concise status only when needed for liveness or coordination.

## Issue Write-Back

Before spawning any worker:

- Ensure every requested issue has a `## Comments` section; create it if missing.
- Use that section as the default shared status channel unless a shared status file or memory key is explicitly provided.
- Append a short execution entry to every requested issue before any dispatch begins, including date, selected model, TDD policy, concurrency, dependency context, and whether existing or newly prepared `Dispatch Constraints` are used.
- When reusing existing constraints, state that they were reused without freshness inference.
- Do not rewrite existing `Dispatch Constraints` during issue write-back unless the refresh conditions above are met.
- Finish this write-back pass for the full requested issue set before spawning the first worker, even for issues that will only become runnable in later layers.

After the worker finishes:

- Append a result entry under `## Comments` with success or failure, concise reason, changed files, and verification summary.
- Base results on durable shared-channel reports, not worker-private chat-only statements.
- Include the worker's review or repair recommendation and reason when applicable.

## Review And Repair Workers

After an implementation worker reaches a terminal state:

- If its terminal report says review is needed, enqueue one review worker for that issue unless a global stop has been tripped.
- Dispatch the review worker as soon as concurrency capacity exists. Do not wait for peer implementation workers in the same dependency layer to finish.
- Give the review worker the issue file, acceptance criteria, dispatch constraints, implementation terminal report, changed files, and verification commands/results.
- The review worker reviews only; it must not modify code unless the user explicitly asks.
- Treat required review and repair as part of issue completion. Do not unblock downstream issues until the issue's implementation, required review, and required repair loop are terminal and successful.
- If review reports fixable findings, enqueue one repair implementation worker for the same issue unless a global stop has been tripped.
- Dispatch the repair worker as soon as concurrency capacity exists. Do not wait for unrelated review workers in the same dependency layer to finish.
- Give the repair worker the issue file, acceptance criteria, dispatch constraints, review findings, prior terminal report, changed files, and verification commands/results.
- A repair worker may modify code only within the reviewed issue scope and must report terminally with `completed`, `failed`, or `blocked`, changed files, commands run, remaining risks, and whether another review is needed.
- Repeat review/repair only while each cycle reports concrete progress. Stop on success, explicit failure, genuine blockage, unfixable findings, repeated findings without progress, or global stop.
- If review or repair fails, blocks, or reports unfixable findings, treat the issue as failed and do not dispatch its downstream dependents.
- If the review worker finds the issue was completed poorly, it must record that assessment in the shared channel and recommend considering a higher reasoning effort for any repair or later attempt on the same issue.
- If the implementation worker omits a review recommendation, ask it to complete the terminal report. If unavailable, review nontrivial changes by default unless a global stop has been tripped.

Status line rules:

- Preserve the project's existing triage vocabulary. Do not invent a new global status taxonomy silently.
- On success, leave `Status:` unchanged unless the project already has an explicit done-status convention.
- On failure, set `Status:` to `Needs human attention`.
- On blocked because an upstream issue failed, set `Status:` to `Needs human attention` and explain the blocker.
- On blocked because required dependency input is missing or ambiguous, set `Status:` to `Needs more information`.
- If the project already uses Chinese status values, use `需人工处理` for failures/upstream failures and `待补充信息` for missing or ambiguous dependency input.

## Failure Handling

- If any issue fails, do not dispatch its downstream dependents.
- If required review or repair fails, treat the reviewed issue as failed.
- Mark each skipped dependent as blocked in the final summary and issue comment log.
- Write the upstream blocker path or identifier and failure reason into each skipped issue.
- Continue running independent ready work in the same dependency layer.
- Do not stop the entire execution merely because one independent issue failed.
- Keep supervising all other already-running independent workers until they complete, fail, or become genuinely blocked.

## Ready-Queue Scheduling

Before first dispatch:

1. Ensure every requested issue has reusable `Dispatch Constraints`, running `prepare-dispatch-constraints` only for missing issues.
2. Complete the full issue-set write-back pass for every requested issue.
3. Do not dispatch any worker until that pass is complete.

After the initial pass, schedule continuously:

1. Maintain a concurrency pool capped by the selected concurrency.
2. Recompute ready work whenever a worker reaches a terminal state or a concurrency slot opens.
3. Dispatch ready implementation, review, or repair subagents immediately until the pool is full or no ready work remains.
4. Do not wait for all implementation workers in a dependency layer to finish before dispatching review for a completed issue in that layer.
5. Do not wait for all review workers in a dependency layer to finish before dispatching repair for an issue with terminal fixable review findings.
6. Write back each implementation, review, and repair result promptly after its worker is terminal.
7. Skip downstream issues whose dependencies failed, are blocked, have unfixable review findings, or failed required repair.
8. Continue until no worker is running and no ready work remains.

If a global stop is tripped during scheduling, stop scheduling further implementation, review, or repair work and follow `Abnormal Worker Stops`.

Do not dispatch downstream implementation while any required upstream implementation, review, or repair worker is still running or unresolved.

## Progress Updates

Provide concise user-facing updates when execution takes time:

- Which dependency layer or ready queue is active.
- Which implementation, review, or repair workers are active and presumed progressing.
- Which issues completed, failed, or blocked.
- Whether the main agent is waiting inside a 30-minute window or has extended one.

Do not ask the user to confirm continuation while workers are active and unblocked. Continue supervising automatically. Do not turn progress updates into code walkthroughs unless the user asks for implementation detail.

## Final Handoff

Return a concise summary with:

1. execution order by dependency layer and actual dispatch sequence
2. per-issue outcome
3. blocked issues and exact blocker chains
4. review and repair outcomes
5. verification summary
6. next recommended user action

Produce the final handoff only after:

- all runnable workers reached terminal states,
- all issue write-backs and shared-channel status records are complete,
- downstream blocked issues are recorded,
- and no active worker remains running, including workers whose shared channel already contains a terminal-looking report.

## Boundaries

- Execute already-written issues; do not break plans into issues. Use `to-issues` for issue breakdown.
- Prefer one implementation worker per runnable issue; use review and repair workers only after their prerequisites are terminal.
- Keep context minimal and issue-local work inside workers.
- Do not forward unrelated issue files to every worker.
