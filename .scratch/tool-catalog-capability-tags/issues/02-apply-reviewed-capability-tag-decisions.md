# Apply reviewed Capability Tag decisions end-to-end

Status: ready-for-agent

## What to build

Teach discovery apply to consume reviewed Discovery Decision Files that store accepted entries in their final catalog shape. Accepted reusable utility and template entries must persist Capability Tags and Selection Descriptions, while ignored and deferred items remain traceable to original dry-run candidates.

## Acceptance criteria

- [ ] A migration adds structured storage for canonical Capability Tags and entry-tag associations.
- [ ] Accepted utility artifacts, members, and template patterns require at least one Capability Tag and a required `summary`.
- [ ] Optional `usage_notes` and `limitations` are persisted and surfaced through compact detail output.
- [ ] Ignored and deferred decisions can still reference original candidate identifiers for traceability.
- [ ] Regression tests cover successful apply, validation failure for missing tags or summary, and detail display for stored descriptions.

## Blocked by

- .scratch/tool-catalog-capability-tags/issues/01-codify-capability-tag-workflow-contracts.md

## Comments

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-capability-tags/issues/02-apply-reviewed-capability-tag-decisions.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0011-use-english-for-catalog-prose.md`, `docs/adr/0023-use-minimal-tool-catalog-schema.md`, `docs/adr/0033-use-two-phase-discovery-apply.md`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md`, current user instructions
- CONTEXT.md: Discovery Decision Files are reviewed structured JSON consumed by apply; Capability Tags describe reusable capability domains; Selection Descriptions explain when an entry should be selected (`CONTEXT.md:37`, `CONTEXT.md:49`, `CONTEXT.md:57`).
- docs/adr: keep schema minimal and avoid turning the Project Index into a general code intelligence database (`docs/adr/0023-use-minimal-tool-catalog-schema.md:3`, `docs/adr/0023-use-minimal-tool-catalog-schema.md:8`).
- docs/adr: apply consumes the reviewed Discovery Decision File; raw candidate JSON remains audit/debug validation input only (`docs/adr/0033-use-two-phase-discovery-apply.md:3`, `docs/adr/0033-use-two-phase-discovery-apply.md:12`, `docs/adr/0033-use-two-phase-discovery-apply.md:13`).
- docs/adr: accepted entries store required `summary`, optional `usage_notes` and `limitations`, and at least one Capability Tag; ignored/deferred candidates need only decision reasons (`docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:10`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:12`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:16`).
- docs/adr: store catalog prose, capability tags, JSON fields, and CLI arguments in English (`docs/adr/0011-use-english-for-catalog-prose.md:3`).
- Discussion: do not require tags on observed external usage in this slice unless it is represented as a reusable utility/template entry; the agreed quality gate targets accepted reusable utility and template entries.

### Execution Started

- Date: 2026-06-09
- Dispatch profile: default Codex worker profile; selected model `gpt-5.4`; reasoning selected per issue by main agent; TDD decided by worker; concurrency cap 2.
- Dependency context: blocked by issue 01; dispatch only after issue 01 completes implementation and required review/repair successfully.
- Dispatch Constraints: existing block reused without freshness inference.

### Dispatch Exception

- Date: 2026-06-09
- User approved continuing worker `019eaa0f-9f52-7060-b9e4-48745f7e0056` after clarification that the available `multi_agent_v1.spawn_agent` tool cannot pass `model` or `reasoning_effort` as payload fields. The selected profile remains recorded in the worker brief, and execution continues under the tool's inherited worker model behavior.

### Progress

- Date: 2026-06-09
- Read issue 02, Dispatch Constraints, `CONTEXT.md`, and ADRs 0011/0023/0033/0040. No constraint conflict found.
- Located implementation points in `tools/tool-catalog-cli/bin/tool-catalog.mjs`, migrations, and `tests/regression.mjs`.
- Planned scope: add schema version 3 for structured tags/descriptions/deferred traceability, enforce reviewed accepted-entry metadata during apply, and surface compact details through `show`.

### Terminal Report

- Status: completed
- Date: 2026-06-09
- Changed files:
  - `tools/tool-catalog-cli/migrations/003-add-capability-tags.sql`
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `tools/tool-catalog-cli/tests/regression.mjs`
  - `.scratch/tool-catalog-capability-tags/issues/02-apply-reviewed-capability-tag-decisions.md`
- What changed:
  - Added schema version 3 with `capability_tags`, `entry_capability_tags`, `deferred_candidates`, and `usage_notes` / `limitations` columns for artifacts, members, and template patterns.
  - Extended discovery apply to accept reviewed final `accepted_entries`, top-level `ignored_candidates`, and top-level `deferred_candidates`; successful regression apply now strips raw dry-run `candidates` and legacy `decisions` before invoking the CLI.
  - Enforced required `summary` and at least one `capability_tags` value for accepted utility artifacts, artifact members, and template patterns. Observed external usage remains exempt from tag requirements.
  - Persisted capability tags and selection descriptions, maintained entry-tag associations during upsert and cleanup, and surfaced tags / usage notes / limitations in `show` JSON and Markdown detail output.
  - Added regression coverage for successful apply, missing tags failure, missing summary failure, deferred traceability, stored tag counts, and show detail output.
- Commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node --check tools/tool-catalog-cli/tests/regression.mjs`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
  - `node scripts/check-tool-catalog-skills.mjs`
  - `bash -n scripts/sync-skills.sh`
- Verification: all commands passed.
- Remaining risks:
  - `entry_capability_tags` is intentionally polymorphic and has no direct foreign key to artifacts, members, or template patterns; cleanup SQL removes known stale associations, but this should be reviewed carefully.
  - Existing schema version 1/2 indexes require migration through discovery/config before consult commands can read version 3 detail fields.
  - `query --tag` and `tool-catalog tags` are intentionally not implemented in this issue; downstream issues own that command surface.
- Review worker needed: yes. Reason: this issue changes persistent schema, apply validation, and SQL cleanup behavior; a focused review should inspect migration compatibility and association cleanup correctness before downstream issues depend on it.

### Review Terminal Report

- Status: failed
- Date: 2026-06-09
- Scope reviewed:
  - reviewed Discovery Decision File apply flow
  - Capability Tag persistence and detail output
  - validation for required `summary` and `capability_tags`
  - migration and cleanup behavior for `ignored_candidates` / `deferred_candidates`
- Commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node --check tools/tool-catalog-cli/tests/regression.mjs`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
  - custom repro: apply reviewed decisions twice and inspect SQLite contents for stale trace rows
- Findings:
  - `failed` `ignored_candidates` and `deferred_candidates` are never cleaned when a later reviewed decision promotes the same candidate to accepted or otherwise removes it from the current trace set. The apply path only upserts those rows in [tools/tool-catalog-cli/bin/tool-catalog.mjs](/home/jing/workspace/liujp-skills/tools/tool-catalog-cli/bin/tool-catalog.mjs:3752), wires those upserts into the transaction in [tools/tool-catalog-cli/bin/tool-catalog.mjs](/home/jing/workspace/liujp-skills/tools/tool-catalog-cli/bin/tool-catalog.mjs:4069), and the cleanup SQL in [tools/tool-catalog-cli/bin/tool-catalog.mjs](/home/jing/workspace/liujp-skills/tools/tool-catalog-cli/bin/tool-catalog.mjs:3849) never deletes stale trace rows. Reproduction:
    - deferred case: first apply produced `deferred_candidates = 1`; second apply accepted that same candidate, but `deferred_candidates` remained `1`.
    - ignored case: first apply stored `utility-artifact:typescript:src/utils/legacy.ts` in `ignored_candidates`; second apply accepted that candidate, but `SELECT candidate_key FROM ignored_candidates` still returned the same row.
    - regression coverage currently stops at first-write persistence and does not exercise decision churn cleanup in [tools/tool-catalog-cli/tests/regression.mjs](/home/jing/workspace/liujp-skills/tools/tool-catalog-cli/tests/regression.mjs:462).
- Acceptance result:
  - migration creation, validation, and show/detail persistence are implemented.
  - cleanup correctness is not met because traceability tables can report outdated ignored/deferred state after subsequent reviewed applies.
- Repair worker needed: yes
- Repair guidance:
  - delete scoped stale rows from `ignored_candidates` and `deferred_candidates` before reinserting the current reviewed trace set, using the same full/changed scope semantics as catalog cleanup.
  - add regression coverage for promote-from-ignored and promote-from-deferred reapply scenarios.

### Repair Progress

- Date: 2026-06-09
- Read the failed review report and re-located the current apply path in `tools/tool-catalog-cli/bin/tool-catalog.mjs`; cited anchors are still accurate and did not drift.
- Confirmed the gap: trace tables only upsert current `ignored_candidates` / `deferred_candidates`, while cleanup SQL only removes accepted catalog entities and never clears stale trace rows.
- Repair plan: add scoped stale-trace deletion before current trace upserts, then add regression coverage for `ignored -> accepted` and `deferred -> accepted` replay.

### Repair Terminal Report

- Status: completed
- Date: 2026-06-09
- Changed files:
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `tools/tool-catalog-cli/tests/regression.mjs`
  - `.scratch/tool-catalog-capability-tags/issues/02-apply-reviewed-capability-tag-decisions.md`
- What changed:
  - Added `cleanupDecisionTraceSql` in `tools/tool-catalog-cli/bin/tool-catalog.mjs:3790` to delete stale `ignored_candidates` and `deferred_candidates` rows before trace upserts, with `full` deleting all project rows and `changed` reusing path-scoped cleanup semantics.
  - Wired trace cleanup into the apply transaction ahead of current trace writes in `tools/tool-catalog-cli/bin/tool-catalog.mjs:4079`, so candidates promoted from ignored/deferred no longer leave stale trace rows behind.
  - Added SQLite-backed regression helpers and replay assertions in `tools/tool-catalog-cli/tests/regression.mjs:51` and `tools/tool-catalog-cli/tests/regression.mjs:500` covering both `ignored -> accepted` and `deferred -> accepted` reapply flows.
- Commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node --check tools/tool-catalog-cli/tests/regression.mjs`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
  - `node scripts/check-tool-catalog-skills.mjs`
  - `bash -n scripts/sync-skills.sh`
- Verification:
  - All commands passed.
  - Replay regression now confirms the promoted ignored candidate disappears from `ignored_candidates` and the promoted deferred candidate disappears from `deferred_candidates`.
- Remaining risks:
  - Regression coverage exercises the replay cleanup through the existing full-scan fixture; changed-scope behavior shares the same `pathScopeCondition(...)` helper but was not covered by a dedicated fixture in this repair.
  - Trace cleanup still keys changed-scope deletion from stored `source_anchor.path`; malformed historic trace rows without a usable anchor would remain outside scoped cleanup, consistent with the existing path-scoped catalog cleanup model.
- Review worker needed: yes. Reason: this is a post-review repair on apply SQL ordering and cleanup semantics, so a follow-up review should confirm the stale-trace finding is fully resolved.

### Follow-up Review Terminal Report

- Status: completed
- Date: 2026-06-09
- Scope reviewed:
  - stale `ignored_candidates` / `deferred_candidates` cleanup after repair
  - accepted-entry validation and persistence for required `summary` / `capability_tags`
  - `show` JSON/Markdown detail output for stored tags and descriptions
  - regression coverage, including full-scope replay and changed-scope cleanup behavior
- Commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node --check tools/tool-catalog-cli/tests/regression.mjs`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
  - custom repro: full apply, then changed-scope reapply promoting ignored/deferred candidates and inspecting SQLite trace rows
- Findings:
  - none
- Verification:
  - `cleanupDecisionTraceSql` now deletes stale trace rows for both `full` and `changed` scope before current trace upserts, and it is wired into the apply transaction before writeback in [tools/tool-catalog-cli/bin/tool-catalog.mjs](/home/jing/workspace/liujp-skills/tools/tool-catalog-cli/bin/tool-catalog.mjs:3790) and [tools/tool-catalog-cli/bin/tool-catalog.mjs](/home/jing/workspace/liujp-skills/tools/tool-catalog-cli/bin/tool-catalog.mjs:4079).
  - Regression coverage now proves promote-from-ignored and promote-from-deferred cleanup, while preserving the existing acceptance checks for missing tags, missing summary, persisted counts, and `show` output in [tools/tool-catalog-cli/tests/regression.mjs](/home/jing/workspace/liujp-skills/tools/tool-catalog-cli/tests/regression.mjs:462), [tools/tool-catalog-cli/tests/regression.mjs](/home/jing/workspace/liujp-skills/tools/tool-catalog-cli/tests/regression.mjs:500), and [tools/tool-catalog-cli/tests/regression.mjs](/home/jing/workspace/liujp-skills/tools/tool-catalog-cli/tests/regression.mjs:595).
  - Additional changed-scope replay verification passed: promoting an ignored candidate removed only the in-scope stale row, preserved an out-of-scope deferred row, and promoting that deferred candidate on its own changed path then removed the remaining stale deferred row.
- Acceptance result:
  - issue 02 acceptance criteria are satisfied after repair.
  - no repair worker needed.

### Orchestrator Result

- Status: completed
- Result: accepted implementation, repair, and follow-up review terminal reports; no further repair worker dispatched because follow-up review found no findings.
- Changed files: `tools/tool-catalog-cli/migrations/003-add-capability-tags.sql`, `tools/tool-catalog-cli/bin/tool-catalog.mjs`, `tools/tool-catalog-cli/tests/regression.mjs`, `.scratch/tool-catalog-capability-tags/issues/02-apply-reviewed-capability-tag-decisions.md`
- Verification summary: implementation, repair, and follow-up review workers reported CLI syntax checks and regression tests passed; repair added stale trace replay coverage for `ignored -> accepted` and `deferred -> accepted`.
