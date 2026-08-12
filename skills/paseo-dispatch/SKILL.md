---
name: paseo-dispatch
description: Dispatch bounded, parallel, read-only investigations through Paseo-managed agents. Use when the user names $paseo-dispatch, Paseo, delegation, or parallel agents, or implicitly when independent non-duplicate evidence gathering can run while the primary agent continues useful work.
---

# Paseo Dispatch

Delegate read-only investigation. Keep decisions, implementation, and the final response in the primary agent.

## Prepare

1. Read the companion `paseo` skill and [agent-templates.md](references/agent-templates.md).
2. Match the task against every template `description` and select the closest fit.
3. Read `~/.paseo/orchestration-preferences.json`. If it is missing, tell the user once and continue; missing preferences never make a fixed template model unavailable. Apply relevant freeform preferences to the prompt, but do not replace the template's explicit `provider`, `model`, or `settings`.
4. Confirm the template's Paseo `provider` is available and its `modeId` appears in that provider's current modes. Treat Paseo providers, modes, and their internal model IDs as separate layers: a model missing from `list_models` is not evidence that the model is unavailable.
5. Confirm the task is bounded, read-only, dependency-ready, and non-duplicate.

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

Create the agent with the selected template's explicit `provider`, `model`, and `settings`. For `fast-investigator`, pass `provider: "codex"` and `model: "deepseek-v4-flash"` even when DeepSeek is absent from Paseo's Codex model catalog; Codex may resolve custom model IDs from its own configuration.

If the Codex provider itself is unavailable, stop and report the provider failure because both templates require it. If the fast template's model, mode, or settings fail validation, or DeepSeek agent creation or its initial run fails, preserve and classify the original error, then retry once using the complete `deep-investigator` provider, model, and settings with the same investigation prompt. Archive the failed agent only when creation returned an agent. Report both the original failure and the Luna fallback. Do not retry or fall back merely because model discovery omitted DeepSeek, and do not perform a second fallback.

When the next primary step depends on an active agent, stop and wait for its terminal notification. Let the notification resume the primary agent; use neither polling nor heartbeats.

## Validate Results

Check every acceptance criterion against cited evidence. Treat an unsupported claim as unresolved. A failed or blocked investigation blocks only tasks that depend on it.

After consuming a terminal report, archive the agent when no follow-up, dependent task, or result reuse remains. Keep it available otherwise.

Keep sensitive prompt contents out of logs.
