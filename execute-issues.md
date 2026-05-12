---
name: supervised-execute-issues
description: Execute `to-issues` issue DAGs with fresh subagents, durable supervision and recovery, per-issue spec and code-quality reviews, a configurable worker model defaulting to `gpt-5.3-codex` with `xhigh`, and TDD mode enabled by default.
---

# Supervised Execute Issues

Use this skill when `to-issues` has already produced a set of implementation issues and you need to execute them as a controlled issue DAG.

This skill aligns to `subagent-driven-development`, but the unit of work is an issue instead of a plan task.

## Core Rules

- One issue gets one fresh implementer subagent.
- One implementer handles one issue only.
- Review order is fixed: implementer -> spec reviewer -> code-quality reviewer.
- The controller must paste full issue text into the worker prompt. Never make workers fetch their own issue.
- The durable run state is the source of truth. Thread notifications are advisory only.
- Default worker model is `gpt-5.3-codex` with `xhigh` reasoning effort.
- Default `tdd_mode` is `true`.
- The controller is resumable. If the current turn ends before the run is complete, the next turn must continue from persisted state instead of restarting the workflow from scratch.
- Never busy-wait, poll in a tight loop, or retry the same blocked context without changing something first.

## Input Contract

This skill expects issues created by `to-issues`, which means each issue should already include:

- a concise vertical-slice description
- explicit acceptance criteria
- a `Blocked by` section
- a `Type` or equivalent signal that lets you distinguish `AFK` and `HITL`

If the source material is still a plan, PRD, or parent ticket, stop and use `to-issues` first.

## Runtime Files

Persist orchestration state in:

- `.codex/issue-run-state.json`
- `.codex/issue-results/<issue-id>.json`
- `.codex/issue-run-events.jsonl`

The state file must record at least:

- run id
- controller session id
- issue DAG
- per-issue status
- per-issue acknowledgements for terminal result files
- in-flight agent ids
- awaiting-resume flag
- retry counters or retry budget
- resolved `worker_model`
- resolved `tdd_mode`

Every terminal worker result artifact must include:

- `issue_id`
- `agent_id`
- `status`
- `summary`
- `changed_files`
- `verification`
- `risks`
- `completed_at`
- `worker_model`
- `tdd_mode`
- `spec_review`
- `code_quality_review`

The event log is append-only. Record only orchestration events, short summaries, timestamps, run ids, controller session ids, issue ids, agent ids, statuses, and next actions. Do not store full raw transcripts in the event log.

## Before Dispatch

1. Read every issue body in full, including acceptance criteria and `Blocked by`.
2. Build the issue DAG and classify each issue as `AFK`, `HITL`, or blocked.
3. Create or load `.codex/issue-run-state.json` and `.codex/issue-run-events.jsonl`.
4. Record the current controller `session_id`.
5. Resolve the worker profile:
   - `worker_model`: default `gpt-5.3-codex`
   - `reasoning_effort`: default `xhigh`
   - `tdd_mode`: default `true`
6. Ensure the external supervisor is running before you depend on unattended execution.
7. Write an initial event-log entry that captures the resolved worker profile and the current issue DAG snapshot.

If an issue is `HITL`, do not dispatch it automatically. Surface it as a blocker and continue only with runnable `AFK` issues.

## Dispatch Policy

This skill assumes a shared workspace and therefore serializes implementation by default.

- Only one issue implementer may be active in the current workspace at a time.
- Do not dispatch the next implementer until the current issue has reached a terminal reviewed state and its result artifact has been acknowledged in the run state.
- If you explicitly opt into parallelism later, isolate each worker in its own worktree or equivalent workspace first.

## Supervision and Recovery

- A long-running worker is normal. If the current turn ends while a worker is still active, record that worker in run state, append a resume note to the event log, and exit cleanly.
- A timeout from `wait_agent` is not a failure. Treat it as a checkpoint, not as a reason to spin in place.
- When the supervisor relaunches the controller, read run state first, then read the event log, then reconcile every unacknowledged terminal result artifact before dispatching anything new.
- If the controller session id changes after a relaunch, treat that as expected and continue from persisted state.
- Do not let a resumed turn skip reconciliation just because a worker was already running when the previous turn ended.
- The rationale for this recovery model is documented in [docs/adr/0002-controller-resume-and-event-log.md](./docs/adr/0002-controller-resume-and-event-log.md).

## Per-Issue Loop

For each runnable `AFK` issue:

1. Dispatch a fresh implementer subagent with:
   - full issue text
   - satisfied dependency assumptions
   - current repository or worktree path
   - result artifact path
   - resolved `worker_model`
   - resolved `tdd_mode`
2. If the implementer asks questions or returns `NEEDS_CONTEXT`, answer them before re-dispatching.
3. If the implementer returns `BLOCKED`, change something before retrying:
   - provide missing context
   - break the issue down further
   - choose a stronger model
   - escalate to the human if the issue itself is wrong
4. If the implementer returns `DONE` or `DONE_WITH_CONCERNS`, dispatch a spec reviewer.
5. Only when spec review is fully green may you dispatch code-quality review.
6. If either reviewer finds issues, send the issue back to the same implementer, then re-run the failed review stage.
7. When both reviews pass, write the terminal result artifact and acknowledge it in the run state.
8. Reconcile the DAG, unblock downstream issues, and continue.

## TDD Mode

When `tdd_mode` is `true`:

- The implementer should begin with a failing test or an executable reproduction when the issue is code-bearing.
- Documentation-only or pure operational issues may skip red-green-refactor, but the implementer must say so explicitly.
- Reviewers must verify that tests demonstrate the requested behavior, not only mocked expectations.

When `tdd_mode` is `false`, tests are still required whenever the issue changes behavior. The difference is only that strict red-green-refactor is not mandatory.

## Retry Budget

- Keep retries bounded for each issue and each review stage.
- If a worker or reviewer repeats the same `BLOCKED` or `NEEDS_CONTEXT` outcome with no new information, change the context, split the issue, switch to a stronger model, or escalate to the human.
- Never rerun the same blocked worker with the exact same context and model just to see if it succeeds later.
- Stop cleanly when there are no runnable issues or when the remaining work requires human input.

## Review Gates

Read [references/worker-prompts.md](./references/worker-prompts.md) when you need the exact prompt structure.

- The spec reviewer verifies that the implementation matches the issue body and acceptance criteria, nothing more and nothing less.
- The code-quality reviewer verifies maintainability, test quality, naming, file responsibility, and fit with existing patterns.
- Reviewers must cite concrete `file:line` evidence for failures.
- Never start code-quality review before spec review passes.

## Waiting Rules

- `wait_agent` is only for the current turn.
- A timeout is not a failure.
- If the current turn ends, the supervisor is the only reliable wake-up mechanism.

## Resume Rules

When resumed by the supervisor:

1. Read `.codex/issue-run-state.json` first.
2. Read `.codex/issue-run-events.jsonl` next.
3. Scan every terminal file in `.codex/issue-results/`.
4. Process all unacknowledged result artifacts, not just the most recent one.
5. Update per-issue state idempotently.
6. Unblock newly runnable issues.
7. Dispatch the next runnable `AFK` issue.
8. Persist acknowledgements before exiting again.

## Red Flags

Never:

- rely on `subagent_notification` to restart the controller
- skip spec review
- skip code-quality review
- accept open reviewer findings
- dispatch a `HITL` issue unattended
- dispatch multiple implementers in the same workspace
- mark an issue complete before its terminal artifact is written and acknowledged
- make downstream scheduling decisions before state reconciliation
- rerun a blocked worker with the exact same context and model
- spin in a tight loop waiting for a long-running worker instead of exiting and relying on the supervisor
- skip the event log when reconstructing a resumed run
- keep retrying the same issue forever without changing context, model, or scope

## Final Handoff

Report:

1. issue execution order
2. per-issue outcome
3. blocked issues and blocker chains
4. verification summary
5. active worker profile (`worker_model`, `reasoning_effort`, `tdd_mode`)
6. whether the supervisor is still watching for more completions or the run is awaiting resume
