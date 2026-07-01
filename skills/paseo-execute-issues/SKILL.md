---
name: paseo-execute-issues
description: Executes existing implementation issues through Paseo-managed agents, dependency scheduling, review, repair, and issue write-back. Use when the user provides issue paths, issue numbers, or issue references and wants implementation via Paseo.
---

# Paseo Execute Issues

Use this skill to implement existing issues with Paseo. Do not use it to split plans into issues; use `to-issues` for that.

## Prerequisites

- Read the `paseo` skill before creating agents.
- Before choosing providers, read `~/.paseo/orchestration-preferences.json` unless the user explicitly named providers.
- Require explicit issue paths, issue numbers, or issue references.

## Workflow

1. Read requested issues and each `Blocked by` section.
2. Build a dependency DAG; reject cycles or ambiguous blockers with exact issue references.
3. Ensure each issue has reusable `Dispatch Constraints`; run `prepare-dispatch-constraints` only when constraints are missing or explicitly stale.
4. Choose providers from Paseo preferences: `impl` for implementation/repair, `audit` for review, `ui` for visual work.
5. Append one execution-start note to each requested issue with date, dependency context, provider choices, concurrency, and constraint source.
6. Dispatch ready implementation agents with `create_agent`, `relationship: { kind: "subagent" }`, default `notifyOnFinish`, and a self-contained prompt.
7. Wait for Paseo finish/error/permission notifications. Do not use `wait_for_agent` with notify-on-finish agents, poll active agents, require file heartbeats, or mark slow work failed.
8. On implementation completion, write back result. Enqueue review only when the issue, user, or terminal report requires it. Enqueue repair only for fixable review findings.
9. Recompute readiness after each terminal result. Dispatch downstream work only after upstream implementation and required review/repair succeed.
10. Finish only when every dispatched Paseo agent has produced a terminal report and all requested, skipped, failed, or blocked outcomes are written back.

## Dispatch Prompt

Each agent starts with zero context. Include:

- issue reference, title, acceptance criteria, and relevant dependencies already satisfied.
- `Dispatch Constraints` and current user constraints.
- required skills to load, including project-specific skills.
- exact scope: implement, review-only, or repair.
- verification expectations and commands when known.
- terminal report format: `completed`, `failed`, or `blocked`; changed files; commands run; review need; remaining risks.

## Scheduling Rules

- Default max concurrency: 2 active Paseo agents, counting implementation, review, and repair.
- Use dependency readiness, not fixed layer barriers: when capacity opens, dispatch any unblocked ready issue.
- Independent issues continue when another issue fails.
- Failed, blocked, or unfixable upstream work blocks downstream dependents; record blocker chains.
- Use current workspace for serial work. For parallel work that may touch overlapping files, create per-issue worktrees or reduce concurrency.
- Use schedules only when the user asks for delayed/recurring execution or the current agent cannot stay alive; do not add schedule heartbeats by default.

## Removed Workarounds

- No issue-file chat channel as parent-child IPC; Paseo agent terminal results are the authority.
- No routine polling, `wait_for_agent` loops, or heartbeat protocol; Paseo notifications own lifecycle.
- No one-minute liveness checks, five-minute failure assumptions, or forced takeover of slow agents.
- No wake/retry ladder for missing heartbeats; only act on terminal failure, explicit permission need, crash, or user stop.
- No mandatory dispatch-profile confirmation. Use defaults unless user named overrides or ambiguity affects safety.

## Write-Back

- Before dispatch: record execution start and selected orchestration choices.
- After each terminal agent: append status, summary, changed files, workspace/worktree, verification, review/repair decision, and residual risks.
- Preserve project status vocabulary. On failure or blocked upstream, use the project's human-attention status if one exists.
- Final response: execution order, per-issue outcome, review/repair outcome, verification summary, skipped dependents, residual risks, and next step.
