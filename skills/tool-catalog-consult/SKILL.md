---
name: tool-catalog-consult
description: Consults an existing Tool Catalog Project Index read-only to find verified reusable utilities while coding. Use when implementing in a project and checking whether established utilities or external utility usage already exist.
---

# Tool Catalog Consult

Use this skill to consult an existing Project Index before adding new utility code.

## Quick Start

1. Identify the Target Project root for the code you are changing.
2. Locate the shared CLI at `../tool-catalog-cli/bin/tool-catalog` relative to this skill directory, or at `tools/tool-catalog-cli/bin/tool-catalog` while developing this repository.
3. Run `tool-catalog --help` and `tool-catalog doctor`; report missing runtime dependencies.
4. Run `tool-catalog config info --root <project>` to confirm the Project Index identity.

## Workflow

1. Inspect the Capability Tag Vocabulary when looking for reusable utilities:
   - `tool-catalog tags --root <project>`.
   - Map user language to one to three canonical tags before querying; use the vocabulary's lowercase token or kebab-case tag strings, and skip this step only for exact selectors, classes, modules, or external utility class or module selectors.
2. Query with strict tag filters, description text, and nearby file context:
   - `tool-catalog query --tag <tag> --description "<text>" --current-file <path> --root <project>`.
   - Use at least one of `--tag` or `--description`; prefer tags when the vocabulary has a good match.
   - Multiple `--tag` filters are exact AND filters; run separate queries and merge only when OR-like behavior is needed.
   - Add `--language`, `--framework`, `--artifact-type`, or `--limit` only when they make the search more precise; `--limit` defaults to 5 and is capped at 10.
   - Treat `--current-file` as query context only. Use `--artifact-type` only to narrow project-owned `artifact:` results; external selectors do not store artifact types.
   - Fill the requested result list with matching project-owned entries first, ordered by lower numeric priority values; include external utility class or module selectors only when project-owned entries do not fill the requested limit.
   - Treat query output as a minimal ranked list. Expect `selector`, `kind`, `summary`, `capability_tags`, `priority`, `language`, optional `framework`, optional project-owned `module_path`, and external origin metadata only; do not expect `source_anchor`, `usage_notes`, or `limitations` from query output.
   - If a tag query returns no results, remap once using the vocabulary or broaden once with `tool-catalog query --description "<text>" --root <project>`; if still empty, report no reusable catalog entry found.
3. Inspect promising results:
   - Use `tool-catalog show <selector> --root <project>` for full entry details.
   - Use `show` to read full entry details. Project-owned artifact details may include `source_anchor`, `usage_notes`, and `limitations`; external selector details include origin metadata and may include `usage_notes` and `limitations`, but never include `source_anchor`.
   - Prefer selectors returned by query: `artifact:` or `external:`.
   - Treat selectors as class or module names, such as `artifact:com.example.util.DateUtils`, `artifact:src/utils/date`, `external:org.apache.commons.lang3.StringUtils`, or `external:lodash/isEqual`.
4. Verify project-owned results before reuse:
   - Run `tool-catalog verify <selector> --root <project>` only for `artifact:` results.
   - Treat project-owned source anchors as `{ path, symbol, line }` hints, not proof by themselves.
   - External utility results are fully qualified class or module selectors; do not run CLI verify for them or expect import, call, or source-anchor evidence in query output.
   - For external utility class or module selectors, inspect project dependencies and local conventions yourself before coding.
   - Read referenced source before coding when a project-owned result will shape implementation.
5. Use or reject:
   - Reuse verified project-owned utilities when they fit the task.
   - Treat external utility class or module selectors as reuse candidates, then check dependency availability and local conventions.

## Read-Only Rules

- `query`, `show`, and project-owned `verify` must not update the Project Index.
- Do not recompute catalog priority during consulting; use persisted Artifact Priority from discovery, with lower numeric values first.
- Do not use Discovery Fingerprints for query filtering, ranking, show, or verify.
- Do not use suppressions as reusable entries or ranking/filtering inputs; they are discovery-only state.
- Do not trigger full discovery from this skill; ask for `tool-catalog-discover` when the index is missing, stale, or incomplete.
- If verification reports stale or missing anchors, do not rely on the entry until discovery refreshes it.
- Keep reasoning in this skill. The CLI only performs deterministic lookup and verification.
