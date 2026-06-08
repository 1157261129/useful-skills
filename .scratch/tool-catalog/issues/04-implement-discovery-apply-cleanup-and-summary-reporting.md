Status: ready-for-agent

# Implement discovery apply, cleanup, and summary reporting

## What to build

Implement the write side of two-phase discovery so accepted agent decisions can update the project index, apply full or changed cleanup rules, persist user choices, and report actionable results.

## Acceptance criteria

- [x] `discover --apply <decisions.json>` validates and applies accepted discovery decisions.
- [x] Accepted utility artifacts and members are written with origin, language, framework, module path, relative anchor, symbol identity, line hint, and concise English catalog prose.
- [x] Accepted template patterns and template instances are written as pattern-level records with representative instances.
- [x] Origin priorities and ignored candidates are persisted.
- [x] Full discovery cleanup may remove or downgrade entries in the full supported scope.
- [x] Changed-path discovery cleanup only affects entries tied to the provided paths.
- [x] Apply produces an actionable summary with project identity, index path, changed counts, required decisions, risks, and follow-up commands.
- [x] Failed extraction or failed apply attempts do not partially corrupt the index.

## Blocked by

- [03 Implement discovery dry-run candidate extraction](./03-implement-discovery-dry-run-candidate-extraction.md)

## Comments

### Dispatch Constraints

- Prepared: 2026-06-08
- Scope: `.scratch/tool-catalog/issues/04-implement-discovery-apply-cleanup-and-summary-reporting.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0006-discovery-suggests-extraction-but-does-not-edit-code.md`, `docs/adr/0014-batch-discovery-decisions-after-scan.md`, `docs/adr/0015-scope-discovery-cleanup-to-refresh-mode.md`, `docs/adr/0018-index-artifacts-and-members.md`, `docs/adr/0019-index-template-patterns-and-instances.md`, `docs/adr/0025-store-summaries-and-minimal-snippets.md`, `docs/adr/0026-store-relative-source-anchors.md`, `docs/adr/0033-use-two-phase-discovery-apply.md`, `docs/adr/0034-store-discovery-run-files-in-user-cache.md`, `docs/adr/0036-report-discovery-results-as-actionable-summary.md`, current user instructions.
- CONTEXT.md: write records using the established `Utility Artifact`, `Template Code`, `Utility Origin`, and `Tool Catalog CLI` vocabulary (`CONTEXT.md:17`, `CONTEXT.md:21`, `CONTEXT.md:37`).
- docs/adr: discovery reports extraction opportunities but never edits target project code; successful extraction is followed by incremental rediscovery, and failed extraction must not update the index (`docs/adr/0006-discovery-suggests-extraction-but-does-not-edit-code.md:3`, `docs/adr/0006-discovery-suggests-extraction-but-does-not-edit-code.md:9`).
- docs/adr: batch user decisions after scanning and update SQLite only after required decisions are resolved (`docs/adr/0014-batch-discovery-decisions-after-scan.md:3`, `docs/adr/0014-batch-discovery-decisions-after-scan.md:8`).
- docs/adr: scope cleanup by refresh mode; full discovery may clean the supported scope, changed-path discovery may only clean entries tied to provided paths (`docs/adr/0015-scope-discovery-cleanup-to-refresh-mode.md:3`).
- docs/adr: store both artifacts and callable members, and store template patterns with representative instances (`docs/adr/0018-index-artifacts-and-members.md:3`, `docs/adr/0019-index-template-patterns-and-instances.md:3`).
- docs/adr: store concise metadata, signatures, minimal examples, and source anchors, not full source copies (`docs/adr/0025-store-summaries-and-minimal-snippets.md:3`).
- docs/adr: source anchors are relative paths plus symbol identity and line hints; absolute paths are not canonical (`docs/adr/0026-store-relative-source-anchors.md:3`, `docs/adr/0026-store-relative-source-anchors.md:8`).
- docs/adr: implement two-phase dry-run/apply, keep run files in user cache, and report project identity, index path, counts, decisions, risks, and follow-up commands (`docs/adr/0033-use-two-phase-discovery-apply.md:3`, `docs/adr/0034-store-discovery-run-files-in-user-cache.md:3`, `docs/adr/0036-report-discovery-results-as-actionable-summary.md:3`).

### Execution start - 2026-06-08

- Dispatch profile: default worker dispatch profile accepted by user on 2026-06-08.
- Model: inherited current Codex worker model through the active subagent tool; the active tool schema has no explicit model field.
- Reasoning: selected by main agent per issue risk; issue 04 uses high caution because it writes catalog records and must preserve transactional safety.
- TDD policy: worker decides whether TDD is warranted; relevant verification is required.
- Concurrency: at most 2 active implementation/review/repair workers.
- Dependency context: blocked until issue 03 completes successfully, including any required review/repair.
- Dispatch Constraints: existing block reused without freshness inference.

### Worker progress - 2026-06-08

- implementation worker accepted issue 04 scope after issue 01/02/03 implementation and review completed.
- checked `CLAUDE.md`, `CONTEXT.md`, required ADR anchors, current schema, and current `tool-catalog.mjs`; no Dispatch Constraints conflict found.
- implementation plan: add `discover --apply <decisions.json>` only, validate decisions before writes, persist accepted/ignored decisions in one project apply lock and SQLite transaction, scope cleanup by dry-run mode, and produce Markdown/JSON apply summaries without target project source edits.

### Implementation terminal report - 2026-06-08

- status: completed.
- changed files: `.scratch/tool-catalog/issues/04-implement-discovery-apply-cleanup-and-summary-reporting.md`, `tools/tool-catalog-cli/bin/tool-catalog.mjs`, `tools/tool-catalog-cli/migrations/002-add-framework-columns.sql`.
- implemented `discover --apply <decisions.json>` with pre-write decisions validation, accepted/ignored/deferred action handling, project apply lock usage, SQLite transaction writes, artifact/member/template/external usage upserts, origin priority persistence, ignored candidate persistence, full and changed cleanup, and Markdown/JSON apply summaries.
- preserved scope boundary: no target project source edits; no consulting `query`, `show`, or `verify` command implementation.
- verification commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --help`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-issue04-home node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --full --dry-run --root /tmp/tool-catalog-issue04-fixture --json`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-issue04-home node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --apply /tmp/tool-catalog-issue04-decisions-full.json --root /tmp/tool-catalog-issue04-fixture --json`
  - SQLite verification of accepted artifacts, members, template patterns, ignored candidates, origin priorities, FTS entries, relative JSON anchors, symbol identity, and line hints.
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-issue04-home node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --apply /tmp/tool-catalog-issue04-decisions-changed.json --root /tmp/tool-catalog-issue04-fixture --json`
  - SQLite verification that changed cleanup removed only entries tied to `src/utils/request.ts` while preserving unrelated artifacts and templates.
  - invalid accepted utility decisions returned exit 2 before writes, counts stayed unchanged, and `apply.lock` was removed.
  - missing source path decisions returned a stable validation error.
  - fresh migration path verified with `TOOL_CATALOG_HOME=/tmp/tool-catalog-issue04-home-v2`, including `metadata.schema_version = 2` and `observed_external_usages.language`.
  - `bash -n scripts/sync-skills.sh`.
- known unrelated verification failure: `scripts/sync-skills.sh --check` still fails before shared CLI verification because installed `/home/jing/.agents/skills/execute-issues/SKILL.md` differs from the repository copy; this matches the pre-existing issue 03 finding and is unrelated to issue 04 changes.
- remaining risks: no dedicated automated regression suite exists yet; apply accepts flexible decisions JSON shapes but the skill documentation in issue 06 still needs to explain the recommended decisions file shape; cleanup uses the decisions file as the source of truth and skips cleanup when unresolved decisions remain.
- review recommendation: review worker recommended because this issue adds persistent write paths, cleanup deletion logic, and a schema migration used by issue 05.

### Main-agent implementation result - 2026-06-08

- result: implementation completed; durable worker terminal report reviewed.
- changed files: `.scratch/tool-catalog/issues/04-implement-discovery-apply-cleanup-and-summary-reporting.md`, `tools/tool-catalog-cli/bin/tool-catalog.mjs`, `tools/tool-catalog-cli/migrations/002-add-framework-columns.sql`.
- verification summary: worker reported passing syntax/help, full dry-run to apply, SQLite persistence checks, changed cleanup checks, invalid-decision rollback/error checks, missing-source validation, fresh migration checks, and shell syntax.
- verification limitation: `scripts/sync-skills.sh --check` still fails before shared CLI verification because installed `execute-issues/SKILL.md` differs from the repository copy; this remains unrelated to issue 04 changes.
- review/repair decision: review worker required because the implementation worker explicitly recommended review for write paths, cleanup deletion logic, and migration behavior.

### Review terminal report - 2026-06-08

- status: review failed.
- review-duplication skill: unavailable in the current skill list and repository paths; reviewed manually for duplicated functionality, reinvented utilities, missed shared helpers, and project-pattern drift. No duplication or missed-helper issue found.
- findings:
  - High: `discover --apply` writes accepted and ignored records even when unresolved required decisions remain. `normalizeApplyDecisions` records unresolved `review`/`defer`/missing actions as `requiredDecisions` (`tools/tool-catalog-cli/bin/tool-catalog.mjs:2615`), but `applyDiscoveryDecisions` still builds and executes accepted/ignored SQL (`tools/tool-catalog-cli/bin/tool-catalog.mjs:3315`); only cleanup is skipped (`tools/tool-catalog-cli/bin/tool-catalog.mjs:3030`). This conflicts with the dispatch constraint from `docs/adr/0014-batch-discovery-decisions-after-scan.md:8`, which says SQLite is updated after required user decisions are resolved. A `/tmp` fixture returned `required_decisions = 1`, `index_mutated = true`, and `artifacts = 1`.
  - Medium: changed-path cleanup can leave stale template-pattern FTS rows. The changed cleanup branch deletes matching `template_instances` (`tools/tool-catalog-cli/bin/tool-catalog.mjs:3088`) and only deletes the template FTS row when the whole pattern becomes empty (`tools/tool-catalog-cli/bin/tool-catalog.mjs:3095`), while template FTS `source_anchor` and `body` are materialized from the accepted instance set (`tools/tool-catalog-cli/bin/tool-catalog.mjs:2916`). A `/tmp` fixture removed the `src/a.ts` template instance but left the template FTS row with `source_anchor = src/a.ts:1#demo` and a body still containing `src/a.ts:1#demo`.
- acceptance review:
  - `discover --apply <decisions.json>` parsing, validation, accepted utility/member writes, template pattern/instance writes, origin priority persistence, ignored candidate persistence, actionable summary, lock usage, and transaction-wrapped apply SQL are present.
  - Discovery apply does not edit target project source files; filesystem writes are limited to Tool Catalog home/index/lock/config paths.
  - `query`, `show`, and `verify` remain unsupported, so issue 05 has not been implemented early.
  - The two findings above prevent marking issue 04 review successful.
- verification commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs query --goal reuse`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs show abc`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs verify abc`
  - `scripts/sync-skills.sh --check`
  - `node -e '<temporary /tmp fixture covering unresolved required decisions and changed template cleanup>'`
- unrelated verification failure: `scripts/sync-skills.sh --check` fails because installed `/home/jing/.agents/skills/execute-issues/SKILL.md` differs from `skills/execute-issues/SKILL.md`; the failure occurs before shared CLI verification and remains unrelated to issue 04 changes.
- repair worker needed: yes.
- repair scope:
  - Make apply refuse or avoid SQLite mutations when `requiredDecisions.length > 0`, or otherwise align the behavior and summary with ADR 0014 without partial accepted writes.
  - Rebuild or delete stale template-pattern FTS rows after changed-path template instance cleanup when a pattern survives with a different representative instance set.
  - Re-run syntax/help, apply validation, unresolved-decision no-write, full cleanup, changed cleanup, stale FTS, and unsupported issue 05 command checks.
- downstream: issue 05 must remain blocked until repair and re-review complete.
- remaining risks: there is still no dedicated automated regression suite; the repair should add focused regression coverage or at least durable fixture commands before issue 06 finalizes instructions.

### Main-agent review result - 2026-06-08

- result: review failed with fixable findings; repair worker required.
- blocking findings: High unresolved required decisions can still mutate SQLite; Medium changed-path template cleanup can leave stale template-pattern FTS rows.
- verification summary: review worker reproduced both findings with `/tmp` fixtures and confirmed issue 05 commands remain unsupported.
- verification limitation: `scripts/sync-skills.sh --check` still fails because installed `execute-issues/SKILL.md` differs from the repository copy; unrelated to issue 04 changes.
- dependency decision: issue 05 remains blocked until repair and re-review complete.

### Repair progress - 2026-06-08

- repair worker accepted scope and reviewed Dispatch Constraints, review terminal report, Main-agent review result, ADR 0014/0015/0019/0036, and the relevant `tool-catalog.mjs` apply/cleanup code.
- no Dispatch Constraints conflict found.
- repair plan: make unresolved required decisions produce a non-mutating apply summary before SQLite initialization or writes, and rebuild changed-path template-pattern FTS rows from surviving representative instances after template instance cleanup.

### Repair terminal report - 2026-06-08

- status: completed.
- changed files: `.scratch/tool-catalog/issues/04-implement-discovery-apply-cleanup-and-summary-reporting.md`, `tools/tool-catalog-cli/bin/tool-catalog.mjs`.
- fixed High finding: `applyDiscoveryDecisions` now short-circuits when `requiredDecisions.length > 0`, returns `index_mutated: false`, keeps before/after counts identical, and avoids apply lock, migrations, project record upsert, accepted writes, ignored writes, and cleanup writes.
- fixed Medium finding: changed-path cleanup now tracks affected template patterns, deletes stale template-pattern FTS rows, and rebuilds surviving rows from current `template_instances` so `source_anchor` and `body` match surviving representative instances.
- preserved scope boundary: no consulting `query`, `show`, or `verify` implementation was added.
- verification commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs query --goal reuse`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs show abc`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs verify abc`
  - `node /tmp/tool-catalog-issue04-repair-test.mjs`
  - `bash -n scripts/sync-skills.sh`
- verification results:
  - syntax and discover help passed.
  - `query`, `show`, and `verify` still return unsupported command errors with exit 2.
  - unresolved required decisions on a fresh project did not create project index storage and reported one required decision with `index_mutated: false`.
  - unresolved required decisions on an existing index did not add accepted artifacts or ignored candidates; counts stayed unchanged.
  - full apply still wrote one artifact, one member, one template pattern, three template instances, one ignored candidate, and one template FTS row.
  - invalid accepted utility apply returned exit 2 and left artifact count unchanged.
  - changed-path cleanup removed only the `src/a.ts` template instance and rebuilt template FTS to `src/b.ts:2#demo` plus `src/c.ts:3#demo`, with no stale `src/a.ts` in `source_anchor` or `body`.
- remaining risks: there is still no committed automated regression suite; the `/tmp` regression script is durable for this repair run but not part of repository tests. The broader flexible decisions JSON shape still needs issue 06 documentation.
- another review worker recommended: yes, because the repair changes apply mutation gating and SQL cleanup/FTS behavior.

### Main-agent repair result - 2026-06-08

- result: repair completed; durable repair terminal report reviewed.
- changed files: `.scratch/tool-catalog/issues/04-implement-discovery-apply-cleanup-and-summary-reporting.md`, `tools/tool-catalog-cli/bin/tool-catalog.mjs`.
- verification summary: repair worker reported passing syntax/help, unsupported issue 05 command checks, unresolved-decision no-write checks, full apply checks, invalid apply rollback, changed cleanup, and stale FTS checks.
- review/repair decision: another review worker required because the repair modified apply mutation gating and SQL cleanup/FTS behavior.
- dependency decision: issue 05 remains blocked until re-review completes successfully.

### Second review terminal report - 2026-06-08

- status: second review completed.
- review-duplication skill: unavailable in the current skill list and no loadable skill path was found in this worker context. Reviewed manually against the required dimensions: duplicated functionality, reinvented utilities, missed shared helpers, and drift from existing project patterns. No duplication, missed-helper, or project-pattern finding was found.
- findings: none.
- repair verification:
  - The unresolved-decision gate is now before project apply lock, migrations, project record upsert, accepted writes, ignored writes, and cleanup SQL. `normalizeApplyDecisions` still records unresolved decisions in `requiredDecisions` at `tools/tool-catalog-cli/bin/tool-catalog.mjs:2626`; `applyDiscoveryDecisions` short-circuits at `tools/tool-catalog-cli/bin/tool-catalog.mjs:3403`, reads counts only if an existing index is present, and builds a no-mutation summary with `index_mutated: false` at `tools/tool-catalog-cli/bin/tool-catalog.mjs:3406`.
  - The apply summary now reports unresolved decisions as actionable output: `index_mutated` is carried in `tools/tool-catalog-cli/bin/tool-catalog.mjs:3291`, cleanup is not applied when required decisions exist at `tools/tool-catalog-cli/bin/tool-catalog.mjs:3311`, `skipped_reason` is set to `unresolved-decisions` at `tools/tool-catalog-cli/bin/tool-catalog.mjs:3314`, and Markdown lists required decisions plus the skip reason at `tools/tool-catalog-cli/bin/tool-catalog.mjs:3360` and `tools/tool-catalog-cli/bin/tool-catalog.mjs:3377`.
  - Changed-path template cleanup now tracks affected patterns before deleting scoped instances at `tools/tool-catalog-cli/bin/tool-catalog.mjs:3108`, deletes stale template-pattern FTS rows at `tools/tool-catalog-cli/bin/tool-catalog.mjs:3125`, and reinserts FTS rows from surviving `template_instances` at `tools/tool-catalog-cli/bin/tool-catalog.mjs:3131`. The rebuilt `source_anchor` is selected from the surviving first instance at `tools/tool-catalog-cli/bin/tool-catalog.mjs:3154`.
- acceptance spot-check:
  - Valid full apply writes artifacts, members, template patterns, representative instances, observed external usages, ignored candidates, origin priorities, FTS rows, and an actionable JSON summary.
  - Full cleanup and changed cleanup are scoped through the existing `full` and `changed` branches; changed cleanup removed only records tied to the provided path in the fixture and preserved unrelated template records.
  - Invalid accepted apply returned exit 2 before changing persisted artifact counts.
  - `query`, `show`, and `verify` remain unsupported commands with exit 2, so issue 05 was not implemented early.
- verification commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --help`
  - `node /tmp/tool-catalog-issue04-second-review.mjs`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs query --goal reuse`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs show artifact:request`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs verify artifact:request`
  - `bash -n scripts/sync-skills.sh`
  - `scripts/sync-skills.sh --check`
- verification results:
  - Syntax and discover help passed.
  - The `/tmp` fixture passed full apply counts: artifacts 1, artifact members 1, template patterns 1, template instances 3, observed external usages 1, ignored candidates 1, origin priorities 2, template FTS rows 1.
  - Fresh unresolved apply did not create project index storage, did not create `apply.lock`, reported one required decision, and returned `index_mutated: false`.
  - Existing-index unresolved apply kept artifact counts unchanged, reported `cleanup.skipped_reason = unresolved-decisions`, and returned `index_mutated: false`.
  - Changed-path template cleanup removed the deleted `src/components/a.ts` instance, left two instances, rebuilt template FTS to `src/components/b.ts:1#demo`, and removed stale `src/components/a.ts` from both `source_anchor` and `body`.
  - Changed-path cleanup of `src/utils/request.ts` removed the scoped stale artifact while preserving the unrelated template pattern and persisted ignored candidate.
  - `query`, `show`, and `verify` returned unsupported command errors with exit 2.
  - `scripts/sync-skills.sh --check` still fails because installed `/home/jing/.agents/skills/execute-issues/SKILL.md` differs from `skills/execute-issues/SKILL.md`; this is the same pre-existing unrelated verification failure and occurs outside issue 04 CLI behavior.
- repair worker needed: no.
- downstream: issue 05 can unlock.
- remaining risks: no committed automated regression suite exists yet; the durable verification is a `/tmp` fixture script for this review run. Issue 06 should document the recommended decisions JSON shape, especially the `scan.mode`/`scan.changed_paths` apply summary shape.

### Main-agent second review result - 2026-06-08

- result: second review completed successfully; no further repair worker required.
- review findings: no blocking findings and no repair findings.
- verification summary: second review worker validated unresolved-decision no-write behavior, changed-path template FTS rebuild, valid apply writes, changed/full cleanup, invalid apply rollback, and unsupported issue 05 commands.
- verification limitation: `scripts/sync-skills.sh --check` still fails because installed `execute-issues/SKILL.md` differs from the repository copy; unrelated to issue 04 CLI behavior.
- dependency decision: issue 05 is unblocked.
