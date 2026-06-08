---
name: tool-catalog-consult
description: Consults an existing Tool Catalog Project Index read-only to find verified reusable utilities and template patterns while coding. Use when implementing in a project and checking whether established utilities, external utility usage, or recurring templates already exist.
---

# Tool Catalog Consult

Use this skill to consult an existing Project Index before adding new utility code or repeating project-specific template code.

## Quick Start

1. Identify the Target Project root for the code you are changing.
2. Locate the shared CLI at `../tool-catalog-cli/bin/tool-catalog` relative to this skill directory, or at `tools/tool-catalog-cli/bin/tool-catalog` while developing this repository.
3. Run `tool-catalog --help` and `tool-catalog doctor`; report missing runtime dependencies.
4. Run `tool-catalog config info --root <project>` to confirm the Project Index identity.

## Workflow

1. Query with the implementation goal and nearby file context:
   - `tool-catalog query --goal "<task>" --current-file <path> --root <project>`.
   - Add `--language`, `--framework`, `--artifact-type`, or `--limit` only when they make the search more precise.
   - If no results match, broaden once; if still empty, report that no reusable catalog entry was found.
2. Inspect promising results:
   - Use `tool-catalog show <selector> --root <project>` for compact details.
   - Prefer selectors returned by query: `artifact:`, `member:`, `template:`, or `external:`.
3. Verify before reuse:
   - Run `tool-catalog verify <selector> --root <project>`.
   - Treat source anchors as relative paths with line hints, not proof by themselves.
   - Read the referenced source before coding when the result will shape implementation.
4. Use or reject:
   - Reuse verified project-owned utilities and templates when they fit the task.
   - Treat observed external usage as evidence of project precedent, then check dependency availability and local conventions.

## Read-Only Rules

- `query`, `show`, and `verify` must not update the Project Index.
- Do not trigger full discovery from this skill; ask for `tool-catalog-discover` when the index is missing, stale, or incomplete.
- If verification reports stale or missing anchors, do not rely on the entry until discovery refreshes it.
- Keep reasoning in this skill. The CLI only performs deterministic lookup and verification.
