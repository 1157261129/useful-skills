---
name: paseo-execute-issues
description: Executes existing implementation issues through Paseo-managed agents, dependency scheduling, review, repair, and issue write-back. Use when the user provides issue paths, issue numbers, or issue references and wants implementation via Paseo.
---

# Paseo Execute Issues

Use this skill to implement existing issues with Paseo. Do not use it to split plans into issues; use `to-issues` for that.

## Prerequisites

- Read the `paseo` skill before creating agents.
- Before choosing providers or creating agents, read `~/.paseo/orchestration-preferences.json`; user-named providers are overrides, not a reason to skip the read.
- Require explicit issue paths, issue numbers, or issue references.

## Workflow

1. Read requested issues and each `Blocked by` section.
2. Ask one blocking dispatch-profile confirmation: provider/model/settings choices, reasoning policy, TDD policy, max concurrency, and workspace strategy. Wait for an explicit user answer before any execution-start write-back or agent dispatch.
3. Build a dependency DAG; reject cycles or ambiguous blockers with exact issue references.
4. Ensure each requested issue has reusable `Dispatch Constraints`; run `prepare-dispatch-constraints` only when constraints are missing, marked stale/superseded/invalid, or the user explicitly requests refresh.
5. Choose providers from the confirmed profile, using Paseo preferences only as defaults: `impl` for implementation/repair, `audit` for review, `ui` for visual work.
6. Append one execution-start note to each requested issue with date, dependency context, provider/model/settings choices, reasoning policy, TDD policy, concurrency, workspace strategy, and constraint source.
7. Dispatch ready implementation agents with `create_agent`, `relationship: { kind: "subagent" }`, `notifyOnFinish` omitted or `true`, and a self-contained prompt.
8. Wait for Paseo finish/error/permission notifications. Do not use `wait_for_agent` with notify-on-finish agents, poll active agents, require file heartbeats, or mark slow work failed.
9. On implementation completion, write back result. Enqueue review only when the issue, user, or terminal report requires it. Enqueue repair only for fixable review findings.
10. Recompute readiness after each terminal result. Dispatch downstream work only after upstream implementation and required review/repair succeed.
11. Finish only when every dispatched Paseo agent has produced a terminal report and all requested, skipped, failed, or blocked outcomes are written back.

## Dispatch Profile

Ask this before execution-start write-back or agent creation. Do not proceed on silence, assumed agreement, or a non-blocking notice.

Default profile:

- Provider/model/settings: Paseo preferences decide role providers (`impl`, `audit`, `ui`) unless the user overrides; pass model/mode/feature choices through `settings` when needed.
- Reasoning: main agent chooses per Paseo agent from task difficulty, ambiguity, risk, dependency depth, and verification burden.
- TDD: implementation/repair agent decides by complexity, risk, and scope; frontend page work skips TDD.
- Max concurrency: 2 active Paseo agents, counting implementation, review, and repair.
- Workspace strategy: current workspace by default; when substantial edit overlap is detected, ask whether to lower concurrency or switch to per-issue worktrees, then wait for the user's answer before dispatch.

If the user declines or provides overrides, collect provider/model/settings choices, reasoning policy or per-agent overrides, TDD policy, max concurrency, and workspace strategy together. Do not silently change the selected profile later.

## Dispatch Prompt

Each agent starts with zero context. Include:

- issue reference, title, acceptance criteria, and relevant dependencies already satisfied.
- `Dispatch Constraints` and current user constraints.
- required skills to load, including project-specific skills.
- exact scope: implement, review-only, or repair.
- workspace ownership: whether it shares the current workspace or uses a worktree; in a shared workspace it must avoid files assigned to other active agents, inspect current changes before editing, report `blocked` on conflicting active changes, and never revert user or other-agent work.
- verification expectations and commands when known.
- terminal report format: `completed`, `failed`, or `blocked`; changed files; commands run; review need; remaining risks.

## Scheduling Rules

- Never exceed selected concurrency; count implementation, review, and repair agents in the same pool.
- Use dependency readiness, not fixed layer barriers: when capacity opens, dispatch any unblocked ready issue.
- Independent issues continue when another issue fails.
- Failed, blocked, or unfixable upstream work blocks downstream dependents; record blocker chains.
- If ready issues have substantial overlapping edit areas, do not reduce concurrency yourself. Ask the user whether to lower concurrency or switch to per-issue worktrees, then wait for the user's answer before dispatching conflicting parallel work.
- Use schedules only when the user asks for delayed/recurring execution or the current agent cannot stay alive; do not add schedule heartbeats by default.

## Removed Workarounds

- No issue-file chat channel as parent-child IPC; Paseo agent terminal results are the authority.
- No routine polling, `wait_for_agent` loops, or heartbeat protocol; Paseo notifications own lifecycle.
- No one-minute liveness checks, five-minute failure assumptions, or forced takeover of slow agents.
- No wake/retry ladder for missing heartbeats; only act on terminal failure, explicit permission need, crash, or user stop.
- No silent dispatch-profile defaults. The user must explicitly confirm or override the profile.

## Write-Back

- Before dispatch: record execution start and selected orchestration choices.
- After each terminal agent: append status, summary, changed files, workspace/worktree, verification, review/repair decision, and residual risks.
- Preserve project status vocabulary. On failure or blocked upstream, use the project's human-attention status if one exists.
- Final response: execution order, per-issue outcome, review/repair outcome, verification summary, skipped dependents, residual risks, and next step.
