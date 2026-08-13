---
name: paseo-dispatch
description: Dispatch bounded, parallel, read-only investigations through Paseo-managed agents. Use when the user names $paseo-dispatch, Paseo, delegation, or parallel agents, or implicitly when independent non-duplicate evidence gathering can run while the primary agent continues useful work.
---

# Paseo Dispatch

Delegate read-only investigation. Keep decisions, implementation, and the final response in the primary agent.

## Prepare

1. Read the companion `paseo` skill and [agent-templates.md](references/agent-templates.md).
2. Match the task against every template `description` and select the closest fit.
3. Read `~/.paseo/orchestration-preferences.json`. If it is missing, tell the user once and continue; missing preferences never make a fixed template provider unavailable. Apply relevant freeform preferences to the prompt, but do not replace the template's explicit `provider` or `settings`.
4. Call `inspect_provider` with the template's complete `provider` value and `settings`, then confirm the provider is available and its `modeId` is current. The `provider` value already contains the internal model ID; a model missing from `list_models` is not evidence that the model is unavailable.
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

Create the agent with the selected template's explicit `provider` and `settings`. Pass the `provider/model` pair as the single `provider` value required by `create_agent`; for example, `fast-investigator` uses `provider: "codex/deepseek-v4-flash"`. Keep that value even when DeepSeek is absent from Paseo's Codex model catalog because Codex may resolve custom model IDs from its own configuration.

If the Codex provider is unavailable, stop and report the provider failure because both templates require it. A missing DeepSeek entry in `list_models` is not a failure and consumes no attempt.

For `fast-investigator`, count provider, mode, or settings validation errors and agent creation or initial-run errors as failed DeepSeek attempts. Make the initial attempt plus at most three retries, for four attempts total. After every failure:

1. Preserve and classify the error.
2. If creation returned an agent, wait for its terminal error notification and archive it. Proceed immediately when validation failed before creation.

If fewer than four attempts have failed, continue with the next attempt:

1. Call `inspect_provider` with the selected fast template's complete `provider` and the failed attempt's settings.
2. Change only `modeId`, `thinkingOptionId`, or supported `features` when the error and inspection identify a valid correction; otherwise reuse the latest validated settings.
3. Keep the provider, investigation prompt, and task scope unchanged, then create a new DeepSeek agent.

After the fourth failure, call `inspect_provider` with the complete `deep-investigator` provider and settings, then fall back to Luna once with those validated values and the same investigation prompt. Report all four DeepSeek errors and the Luna result. If Luna validation or execution fails, preserve its error and stop without another fallback.

When the next primary step depends on an active agent, stop and wait for its terminal notification. Let the notification resume the primary agent; use neither polling nor heartbeats.

## Validate Results

Check every acceptance criterion against cited evidence. Treat an unsupported claim as unresolved. A failed or blocked investigation blocks only tasks that depend on it.

After consuming a terminal report, archive the agent when no follow-up, dependent task, or result reuse remains. Keep it available otherwise.

Keep sensitive prompt contents out of logs.
