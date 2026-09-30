---
name: paseo-dispatch
description: Dispatch read-only document and data dictionary extraction tasks to GPT-6-Luna subagents through Paseo. Use when asked to extract definitions, schema details, or documentation contents without modifying code.
---

# Paseo Dispatch

Delegate read-only documentation and data dictionary extraction to a dedicated GPT-6-Luna subagent.

## Prepare

1. Read the companion `paseo` skill for workspace and subagent lifecycle semantics.
2. Verify input boundaries:
   - Target source paths must be concrete and known (documentation, DDL, schema, migration, or spec files).
   - Requested information must be explicit (specific fields, types, enum values, or sections).
   - If sources or extraction targets are ambiguous, clarify before dispatch. Do not allow the subagent to expand scope autonomously.
3. Confirm the extraction task is bounded, read-only, and non-duplicate.

## Build the Prompt

Load the `reader` template from [agent-templates.md](references/agent-templates.md).

Use `reader.prompt_template` verbatim as the single source of truth, substituting only:
- `{sources}`: Concrete paths to target documents or data dictionary files.
- `{requested_information}`: Concrete items to extract.

Do not re-summarize or alter the standing Reader constraints.

## Dispatch

Dispatch through Paseo with at most three active Reader agents:

- `title`: `[Reader] <target or topic>`
- `provider`: Copy `reader.provider` from the template
- `settings`: Copy `reader.settings` from the template unchanged
- `initialPrompt`: Assembled prompt from the step above
- `workspaceId`: Omit for agent-scoped calls to inherit the caller workspace. Pass a confirmed existing workspace ID only for top-level calls
- `notifyOnFinish`: `true`

Continue independent primary agent work. When a subsequent step depends on the Reader's output, wait for the terminal finish notification to resume; do not poll.

If agent creation or execution fails, preserve the error and report it directly to the primary agent. Do not perform blind retries or silent model fallbacks.

## Consume and Archive

1. Check returned content against the requested items.
2. Integrate the extracted information into primary agent work.
3. Call `paseo_archive_agent` with the child `agentId` once results are consumed and no follow-up question remains.
