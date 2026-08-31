---
name: paseo-dispatch
description: Dispatch bounded, parallel, read-only investigations through Paseo-managed agents. Use when the user names $paseo-dispatch, Paseo, delegation, or parallel agents, or implicitly when independent non-duplicate evidence gathering can run while the primary agent continues useful work.
---

# Paseo Dispatch

Delegate bounded, read-only investigations. Keep decisions, implementation, and the final response in the primary agent.

## Prepare

1. Read the companion `paseo` skill and [agent-templates.md](references/agent-templates.md).
2. Match the task against every template `description`; select the closest fit.
3. Read `~/.paseo/orchestration-preferences.json`. If it is missing, tell the user once and continue. Apply relevant freeform preferences to the prompt; use explicit provider/model preferences only as availability-checked tie-breakers.
4. Resolve the launch target from Paseo's current configuration:
   - Call `list_profiles`; read every profile's `notes`. Use a user-named profile, otherwise the best match, and copy its `provider`, `model`, `modeId`, `thinkingOptionId`, and `featureValues` into the launch values. If no profile fits or none is configured, tell the user once and continue discovery.
   - Call `list_providers`; keep providers with `status: "available"`. Call `list_models` for candidates as needed. Filter models and modes against the selected template's criteria. Honor explicit preferences, then a model marked `isDefault`; if one candidate remains, use it. If the target is ambiguous or no usable target exists, stop and report it—never guess.
   - Pass the exact provider/model pair to `create_agent` as `<provider>/<model ID>`. Use IDs returned by Paseo, not display labels or placeholders.
5. Call `inspect_provider` with the complete resolved provider and settings; pass the current `cwd` when the call is not agent-scoped. Confirm the target is available and its mode is current. Preserve explicit profile settings; choose provider-supported defaults for missing fields, and omit unknown fields rather than inventing IDs. Use `list_models` when `inspect_provider` does not expose model or thinking options. Request `thinkingOptionId: "max"` when the model exposes and accepts it; otherwise omit only that setting and report the resulting default/unknown strength.
6. Confirm the task is bounded, read-only, dependency-ready, and non-duplicate.

Keep implementation, edits, decisions, and external side effects in the primary agent.

## Build the Prompt

Send a complete, self-contained plaintext prompt directly to the agent. Include the selected template's `developer_instructions` as the worker's standing role and boundary instructions.

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

Create the agent with the resolved provider/model pair and validated settings. Template selection fields are criteria, not literal launch values. Do not hardcode a provider/model or silently bypass runtime resolution.

For `fast-investigator`, count provider, mode, settings validation, agent creation, and initial-run errors as failed attempts. Make the initial attempt plus at most three retries.

After every retryable failure:

1. Preserve and classify the error.
2. If an agent was created, wait for its terminal error notification and archive it. Proceed immediately when validation failed before creation.
3. If fewer than four attempts have failed, call `inspect_provider` again for the same resolved provider/model and failed attempt's settings.
4. Change only `modeId`, `thinkingOptionId`, or supported `features` when the error and inspection identify a valid correction; otherwise reuse the latest validated settings.
5. Keep the provider/model, investigation prompt, and task scope unchanged, then create the retry. A `max` capability gap gets one immediate retry omitting only `thinkingOptionId`; it does not switch targets.

After the fourth retryable failure, resolve and validate a fresh `deep-investigator` target using the same runtime rules. Reuse the investigation goal, scope, and acceptance criteria, but rebuild the worker prompt with the deep template's `developer_instructions`; dispatch it once. Report its provider/model and `thinkingOptionId`. If resolution, validation, or execution fails, preserve the error and stop without another fallback.

When the next primary step depends on an active agent, stop and wait for its terminal notification. Let the notification resume the primary agent; use neither polling nor heartbeats.

## Validate Results

Check every acceptance criterion against cited evidence. Treat an unsupported claim as unresolved. A failed or blocked investigation blocks only tasks that depend on it.

After consuming a terminal report, archive the agent when no follow-up, dependent task, or result reuse remains. Keep it available otherwise.

Keep sensitive prompt contents out of logs.
