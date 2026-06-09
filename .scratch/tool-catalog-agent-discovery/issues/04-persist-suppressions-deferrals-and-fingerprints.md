Status: ready-for-agent

# Persist suppressions, deferrals, and fingerprints

## What to build

Persist Suppressions, Deferrals, and structural fingerprints in the Project Index so later discovery runs can classify unchanged evidence before worker review. The discovery flow should reopen stale or changed evidence while skipping unchanged entries and known noise.

## Acceptance criteria

- [x] The Project Index persists structural fingerprints for Catalog Entries, Suppressions, and Deferrals.
- [x] Discovery planning can classify new, unchanged, stale, and missing-source evidence using stored fingerprints.
- [x] Unchanged Catalog Entries do not re-enter worker review during a later discovery run.
- [x] Unchanged Suppressions and Deferrals do not repeatedly consume review worker context.
- [x] Stale Suppressions, stale Deferrals, changed Catalog Entries, and missing-source records are reopened or reported for cleanup.
- [x] Regression coverage proves preclassification behavior across at least one unchanged and one changed discovery run.

## Blocked by

- [02 Emit Finding evidence artifacts](./02-emit-finding-evidence-artifacts.md)
- [03 Apply entry-centric catalog decisions](./03-apply-entry-centric-catalog-decisions.md)

## Comments

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-agent-discovery/issues/04-persist-suppressions-deferrals-and-fingerprints.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`, current user instructions
- CONTEXT.md: Project Index contains accepted reusable entries, Suppressions, Deferrals, and Discovery Fingerprints; a Suppression prevents unchanged non-entry evidence from repeatedly consuming review effort; a Deferral remains visible when relevant context changes; a Discovery Fingerprint distinguishes unchanged, stale, and new records (`CONTEXT.md:3`, `CONTEXT.md:57`, `CONTEXT.md:61`, `CONTEXT.md:65`).
- docs/adr: Project Index state should persist Catalog Entries, Suppressions, Deferrals, and structural fingerprints, and later runs should use these records for pre-classification so unchanged records do not repeatedly consume worker context (`docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:20`).
- Discussion: pre-classification happens before review-worker dispatch; unchanged entries, unchanged suppressions, and unchanged deferrals should be routed away from worker review, while stale or changed records reopen.

### Execution start - 2026-06-09

- Dispatch profile: default execute-issues profile; model `gpt-5.4`; worker-specific reasoning selected by issue risk; TDD decided by worker; concurrency cap 4.
- User instructions: give subagents enough task context; `ace-tool` is unavailable; pass `model` and `reasoning_effort` despite schema display, and treat selection as unavailable only after actual dispatch failure.
- Dependency context: blocked until issues 02 and 03 complete implementation and required review/repair successfully.
- Dispatch Constraints: existing block reused without freshness inference.

### Terminal report - 2026-06-09

- Status: completed
- Changed files:
  - `tools/tool-catalog-cli/migrations/005-add-discovery-fingerprints.sql`
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `tools/tool-catalog-cli/tests/regression.mjs`
- Commands run:
  - `node tools/tool-catalog-cli/tests/regression.mjs`
  - `git status --short`
  - `rg -n "fingerprint|suppression|deferral|preclassification" tools/tool-catalog-cli/bin/tool-catalog.mjs tools/tool-catalog-cli/tests/regression.mjs`
- Verification:
  - `node tools/tool-catalog-cli/tests/regression.mjs` passed.
  - Regression now proves:
    - apply persists `discovery_fingerprints` rows for accepted entries, suppressions, and deferrals;
    - initial dry-run without persisted records classifies all findings as `new`;
    - unchanged rerun classifies accepted entries / suppressions / deferrals as unchanged and keeps review queue at `0`;
    - changed rerun reopens changed accepted entries and stale suppressions for review, and reports missing-source accepted/deferred records for cleanup.
- Remaining risks:
  - Partial changed-path cleanup for persisted template fingerprints still scopes SQL pruning by the stored primary source anchor, while read-time preclassification uses the richer stored `source_paths` list. Full rerun behavior is covered by regression; broader changed-path cleanup permutations are not yet covered here.
  - Entry-centric accepted entries created purely from local gap audit still fall back to recomputed structural fingerprints when no incoming `discovery_fingerprint` is supplied; current regression covers the finding-backed path required by this issue.
- Review worker needed: yes

### Review report - 2026-06-09

- Status: completed
- Result: passed
- Findings:
  - None
- Verification:
  - `node tools/tool-catalog-cli/tests/regression.mjs` -> passed (`Tool Catalog CLI fixture regression passed.`)
  - `tools/tool-catalog-cli/migrations/005-add-discovery-fingerprints.sql:5` creates persisted `discovery_fingerprints` storage with `record_family`, `record_kind`, `record_key`, `source_anchor`, `source_paths`, `match_keys`, and `structural_fingerprint`; `tools/tool-catalog-cli/migrations/005-add-discovery-fingerprints.sql:25` advances `schema_version` to `5`.
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs:1240` loads and applies numbered migrations, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1280` runs them during project-index initialization, and `tools/tool-catalog-cli/bin/tool-catalog.mjs:2761` gates preclassification on schema version `>= 5`, so fingerprint persistence is wired into the real SQLite index rather than only in-memory flow.
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs:2712`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:2908`, and `tools/tool-catalog-cli/bin/tool-catalog.mjs:2940`-`2959` classify findings as unchanged, reopened, or new by matching stored `match_keys` and `structural_fingerprint`; `tools/tool-catalog-cli/bin/tool-catalog.mjs:2962`-`2971` reports unmatched persisted records for cleanup, including missing-source records.
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs:4719`-`4738` builds persisted fingerprint records for accepted catalog entries, suppressions, and deferrals; `tools/tool-catalog-cli/bin/tool-catalog.mjs:5055`-`5082` writes them during apply after cleanup.
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs:4741`-`4770` and `tools/tool-catalog-cli/bin/tool-catalog.mjs:4832`-`5052` remove stale suppression/deferral trace rows and stale catalog-entry fingerprints when apply replays changed decisions.
  - `tools/tool-catalog-cli/tests/regression.mjs:842`-`849` asserts persisted fingerprint rows exist after apply; `tools/tool-catalog-cli/tests/regression.mjs:890`-`909` proves unchanged reruns keep review queue at `0`; `tools/tool-catalog-cli/tests/regression.mjs:916`-`945` proves changed reruns reopen changed catalog entries and stale suppressions, and emit cleanup for missing-source accepted/deferred records.
- Remaining risks:
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs:4915`-`5052` still scopes changed-path template fingerprint cleanup by persisted primary anchors, while read-time preclassification uses stored `source_paths`; current regression covers the reviewed fixture path, but not every partial changed-path permutation.
  - `tools/tool-catalog-cli/tests/regression.mjs:916`-`945` exercises changed catalog-entry reopen, stale-suppression reopen, and missing-source cleanup, but does not separately pin a stale-deferral reopen case.
- Repair worker needed: No

### Orchestrator result - 2026-06-09

- Status: completed
- Result: accepted after review.
- Review outcome: review passed with no findings; no repair worker needed.
- Changed files:
  - `tools/tool-catalog-cli/migrations/005-add-discovery-fingerprints.sql`
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `tools/tool-catalog-cli/tests/regression.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/04-persist-suppressions-deferrals-and-fingerprints.md`
- Verification summary:
  - `node tools/tool-catalog-cli/tests/regression.mjs` passed.
  - Review confirmed persisted fingerprints, preclassification, unchanged-run suppression, changed-run reopen, and missing-source cleanup behavior.
- Downstream: issue 08 is unblocked once issue 07 completes implementation and required review/repair successfully.
