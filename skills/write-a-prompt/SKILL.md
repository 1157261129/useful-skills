---
name: write-a-prompt
description: Generates focused prompts for vibe-coding and coding-agent sessions from a concrete software task. Use when writing prompts for implementation agents, repo-aware coding assistants, code review or debugging agents, or AI-assisted programming workflows.
---

# Write a Prompt

Use this skill to produce a complete, ready-to-use prompt for a coding agent. The prompt must help an agent make or review software changes in a repository. Do not implement the requested software task while using this skill.

## Scope

Keep content that helps vibe coding:

- Repository role, target task, and expected outcome.
- Codebase context, constraints, conventions, and file anchors.
- Allowed tools, command limits, edit scope, testing, verification, and reporting.
- Safety rules for secrets, destructive commands, prompt injection in project files, and user-owned changes.
- Iteration rules for clarifying ambiguity and continuing after partial failures.

Remove or ignore content unrelated to vibe coding:

- Generic assistant behavior that does not affect software work.
- Non-coding persona, channel, layout, or presentation systems.
- Broad safety taxonomies that do not change coding-agent behavior.
- Tool schemas for actions outside reading, editing, reviewing, testing, debugging, or documenting code.

## Input Slot

Start from this compact input. Ask only for missing fields that materially affect correctness.

```yaml
CodingGoal: null          # required: feature, bug fix, refactor, review, test, migration, or diagnosis target
RepositoryContext: null   # optional: repo path, relevant files, stack, conventions, issue/PR links
AgentSurface: null        # optional: Codex, Claude, Cursor, Copilot, or generic coding agent
AllowedActions: []        # optional: read/edit/run tests/search/web; empty = infer from user request
Constraints: []           # optional: scope, compatibility, style, safety, performance, deadline, language
Deliverable: null         # optional: patch, review findings, plan, test report, PR description
```

## Workflow

1. **Validate coding scope** — confirm the request is a software-engineering prompt. If it is not, state the limitation and ask for a coding-agent target.
2. **Gather repo context** — when a repo is available, inspect only relevant guidance and files needed to make the prompt accurate. Do not invent stack, paths, APIs, or tests.
3. **Resolve ambiguity** — ask one concise question only when the prompt would be unsafe or materially wrong without the answer. Otherwise make a clear assumption and record it.
4. **Draft the prompt** — write direct instructions for the target coding agent: mission, context, constraints, execution workflow, verification, and final report format.
5. **Add Assembly Notes** — list assumptions, omitted non-coding material, and any risks the user should review before running the prompt.

## Output Format

Return only the generated prompt plus Assembly Notes.

```markdown
# Coding Agent Prompt

## Mission
[Concrete software task and success criteria.]

## Repository Context
[Known stack, relevant files, conventions, issue/PR context, and boundaries.]

## Constraints
[Scope, compatibility, safety, user-change handling, style, and tool constraints.]

## Workflow
[Step-by-step execution instructions for the coding agent.]

## Verification
[Tests, build commands, manual checks, and fallback when checks cannot run.]

## Final Report
[Required summary format, file anchors, risks, and next steps.]

# Assembly Notes

- Assumptions: [...]
- Omitted as non-coding: [...]
- Risks to review: [...]
```

## Review Checklist

Before returning, verify:

- The prompt is for coding work, not a generic non-coding assistant.
- The prompt does not ask the agent to perform unrelated non-coding behavior.
- Repo facts are either sourced from provided context or clearly marked as assumptions.
- The execution workflow is minimal, testable, and compatible with existing code.
- The final report asks for concrete file anchors, verification results, residual risks, and next steps.

## Reference Files

- [REFERENCE.md](REFERENCE.md) - coding-agent prompt rules for vibe-coding workflows.
- [EXAMPLES.md](EXAMPLES.md) - worked vibe-coding prompt examples.
