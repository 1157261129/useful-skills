---
name: paseo-dispatch
description: Dispatch bounded, parallel, read-only investigations through Paseo-managed agents. Use when the user names $paseo-dispatch, Paseo, delegation, or parallel agents, or implicitly when independent non-duplicate evidence gathering can run while the primary agent continues useful work.
---

# Paseo Dispatch

Delegate read-only investigation. Keep decisions, implementation, and the final response in the primary agent.

## Prepare

1. Read the companion `paseo` skill and [agent-templates.md](references/agent-templates.md).
2. Match the task against every template `description` and select the closest fit.
3. Use the selected template's `model` and `settings`. Resolve its provider through Paseo without orchestration preferences.
4. Confirm the task is bounded, read-only, dependency-ready, and non-duplicate.

Keep implementation, edits, decisions, and external side effects in the primary agent.

## Build the Prompt

Send a complete, self-contained plaintext prompt directly to the agent. Include
the selected template's `developer_instructions` as the worker's standing
role and boundary instructions.

Include every section:

- `Role`
- `Investigation Goal`
- `Scope and Exclusions`
- `Known Context and Satisfied Dependencies`
- `Measurable Acceptance Criteria`
- `Required Evidence`
- `User and Repository Constraints`
- `Terminal Report Format`

## Dispatch

Dispatch through Paseo with at most three agents active. Continue independent primary-agent work.

When the next primary step depends on an active agent, stop and wait for its terminal notification. Let the notification resume the primary agent; use neither polling nor heartbeats.

## Validate Results

Check every acceptance criterion against cited evidence. Treat an unsupported claim as unresolved. A failed or blocked investigation blocks only tasks that depend on it.

After consuming a terminal report, archive the agent when no follow-up, dependent task, or result reuse remains. Keep it available otherwise.

Keep sensitive prompt contents out of logs.
