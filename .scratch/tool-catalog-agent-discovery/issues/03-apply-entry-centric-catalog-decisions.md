Status: ready-for-agent

# Apply entry-centric catalog decisions

## What to build

Change discovery apply to consume an entry-centric JSON Decision File. Accepted Catalog Entries should be identified by entry keys and source anchors, not by CLI Finding provenance, and the applied entries should be available through normal Tool Catalog consult commands.

## Acceptance criteria

- [x] Discovery apply accepts a JSON Decision File with final Catalog Entries keyed by entry identity and source anchors.
- [x] A utility artifact with at least one reusable member can be applied from the entry-centric Decision File.
- [x] The applied utility artifact and member can be retrieved through query, show, and verify flows.
- [x] Apply validates required entry fields, source anchors, members, template instances, summaries, and capability tags where applicable.
- [x] Apply does not require final accepted entries to declare whether they originated from CLI Findings or local gap audit.
- [x] Regression coverage proves entry-centric apply works independently of the old candidate-centric schema.

## Blocked by

- [01 Document agent-orchestrated discovery workflow](./01-document-agent-orchestrated-discovery-workflow.md)
- [02 Emit Finding evidence artifacts](./02-emit-finding-evidence-artifacts.md)

## Comments

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-agent-discovery/issues/03-apply-entry-centric-catalog-decisions.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md`, `docs/adr/0018-index-artifacts-and-members.md`, `docs/adr/0019-index-template-patterns-and-instances.md`, `docs/adr/0016-index-only-observed-external-utility-usage.md`, `docs/adr/0031-query-by-goal-and-code-context.md`, current user instructions
- CONTEXT.md: a Catalog Entry is the final accepted reusable item; the Discovery Decision File records final Catalog Entries, Suppressions, and Deferrals for apply (`CONTEXT.md:17`, `CONTEXT.md:53`).
- docs/adr: final Decision Files are entry-centric JSON and final identity is based on entry keys and source anchors, not CLI Finding provenance (`docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:12`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:19`).
- docs/adr: accepted utility and template entries require summaries and capability tags; capability tags apply at artifact/member level and template pattern level (`docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:10`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:16`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:18`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:19`).
- docs/adr: Project Index stores utility artifacts and callable members; accepted utility artifacts do not imply every callable member is indexed; template code is stored as patterns with representative instances; external utility entries are based only on observed imports/calls (`docs/adr/0018-index-artifacts-and-members.md:3`, `docs/adr/0018-index-artifacts-and-members.md:9`, `docs/adr/0019-index-template-patterns-and-instances.md:3`, `docs/adr/0016-index-only-observed-external-utility-usage.md:3`).
- Discussion: do not require accepted entries to declare whether they originated from CLI Findings or local gap audit.

### Execution start - 2026-06-09

- Dispatch profile: default execute-issues profile; model `gpt-5.4`; worker-specific reasoning selected by issue risk; TDD decided by worker; concurrency cap 4.
- User instructions: give subagents enough task context; `ace-tool` is unavailable; pass `model` and `reasoning_effort` despite schema display, and treat selection as unavailable only after actual dispatch failure.
- Dependency context: blocked until issues 01 and 02 complete implementation and required review/repair successfully.
- Dispatch Constraints: existing block reused without freshness inference.

### Progress - 2026-06-09

- Read the required ADR/context set plus the current apply/query/show/verify regression surface.
- Confirmed the current apply path still treated accepted entries primarily as array payloads merged from `candidate_id`, so keyed entry-centric accepted maps were ignored and did not trigger validation.
- Switched the regression fixture to emit an entry-centric Decision File with grouped keyed `accepted` entries, no accepted-entry `candidate_id` dependence, and explicit validation failures for missing summary, tags, source anchors, members, and template instances.
- Implemented the minimal CLI normalization needed to accept accepted-entry object maps, infer entry type from group or typed selector key, and inject final `artifact_key` / `pattern_key` / `usage_key` identities before normal apply validation runs.

### Terminal report - 2026-06-09

- Status: completed
- Changed files:
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `tools/tool-catalog-cli/tests/regression.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/03-apply-entry-centric-catalog-decisions.md`
- Commands run:
  - `node tools/tool-catalog-cli/tests/regression.mjs`
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
- Verification:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs` passed.
  - `node tools/tool-catalog-cli/tests/regression.mjs` passed.
  - Regression now proves apply accepts keyed entry-centric accepted entries, rejects missing summary/tags/source anchors/members/template instances, persists ignored/deferred trace rows, and keeps accepted utility/template/external entries retrievable through `query`, `show`, and `verify`.
- Remaining risks:
  - Candidate-centric compatibility paths (`candidates`, `decisions`, accepted-entry arrays) still exist in the CLI as a bridge; this issue only removes the requirement that accepted entries depend on them.
  - This issue does not yet convert ignored/deferred trace rows away from candidate-based identifiers; the current contract still preserves candidate ids there for traceability.
- Review worker needed: no additional review worker requested for this issue-local change.

### Review report - 2026-06-09

- Status: completed
- Result: failed
- Findings:
  - Medium: `accepted` object-map keys are not enforced as the authoritative entry identity. In `collectAcceptedEntryArray`, a keyed entry like `accepted.utility_artifacts["artifact:foo"]` still allows payload fields such as `artifact_key`, `pattern_key`, or `usage_key` to override the map key instead of being validated against it (`tools/tool-catalog-cli/bin/tool-catalog.mjs:2965`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:2997`). ADR 0041 says the final Decision File is entry-centric and that final identity is based on entry keys and source anchors, not legacy finding provenance; with the current code, a mismatched keyed entry can silently apply under a different identity. The regression suite proves happy-path keyed apply, but it does not cover or reject this conflict shape (`tools/tool-catalog-cli/tests/regression.mjs:464`, `tools/tool-catalog-cli/tests/regression.mjs:659`).
- Verification:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs` passed.
  - `node tools/tool-catalog-cli/tests/regression.mjs` passed.
  - Confirmed entry-centric accepted maps are parsed and typed per group/selector in `tools/tool-catalog-cli/bin/tool-catalog.mjs:2942` and `tools/tool-catalog-cli/bin/tool-catalog.mjs:3004`.
  - Confirmed accepted entries no longer require `candidate_id`, CLI Finding provenance, or `candidates` / `decisions` payloads in the reviewed fixture written by regression (`tools/tool-catalog-cli/tests/regression.mjs:428`, `tools/tool-catalog-cli/tests/regression.mjs:482`, `tools/tool-catalog-cli/tests/regression.mjs:657`).
  - Confirmed utility artifact/member, template pattern, and external usage retrieval flows resolve by stored entry keys through `query` / `show` / `verify` (`tools/tool-catalog-cli/bin/tool-catalog.mjs:5619`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:5721`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:5956`, `tools/tool-catalog-cli/tests/regression.mjs:728`, `tools/tool-catalog-cli/tests/regression.mjs:890`, `tools/tool-catalog-cli/tests/regression.mjs:937`).
  - Confirmed required-field validation exists for summaries, capability tags, source anchors, members, and template instances (`tools/tool-catalog-cli/bin/tool-catalog.mjs:1181`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1190`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:3321`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:3368`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:3400`; negative-path assertions at `tools/tool-catalog-cli/tests/regression.mjs:596`, `tools/tool-catalog-cli/tests/regression.mjs:606`, `tools/tool-catalog-cli/tests/regression.mjs:616`, `tools/tool-catalog-cli/tests/regression.mjs:626`, `tools/tool-catalog-cli/tests/regression.mjs:636`).
  - Confirmed issue-04-adjacent changes are limited to existing ignored/deferred trace-row persistence and cleanup; no fingerprint preclassification or issue-06/07 orchestration logic was added in this patch (`tools/tool-catalog-cli/bin/tool-catalog.mjs:4225`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:4514`).
- Remaining risks:
  - Until keyed-entry identity conflicts are rejected, review workers can produce a formally entry-centric Decision File whose visible map key and applied catalog identity diverge.
  - The bridge for legacy candidate-centric inputs still exists, which is acceptable as compatibility, but contract tests should keep asserting that reviewed apply fixtures do not depend on it.
- Repair worker needed: Yes

### Repair terminal report - 2026-06-09

- Status: completed
- Result: completed
- Changed files:
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `tools/tool-catalog-cli/tests/regression.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/03-apply-entry-centric-catalog-decisions.md`
- Commands run and results:
  - `rg -n "artifact_key|pattern_key|usage_key|candidate_id|accepted\\.utility_artifacts|accepted\\.template_patterns|accepted\\.external_usages|identity" tools/tool-catalog-cli/bin/tool-catalog.mjs tools/tool-catalog-cli/tests/regression.mjs .scratch/tool-catalog-agent-discovery/issues/03-apply-entry-centric-catalog-decisions.md` -> passed; confirmed the review finding path and regression coverage gap.
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs` -> passed.
  - `node tools/tool-catalog-cli/tests/regression.mjs` -> passed.
- Remaining risks:
  - Legacy candidate-centric compatibility inputs are still accepted by apply as a bridge; this repair only hardens entry-centric keyed accepted maps so map keys cannot diverge from stored entry identity.
  - Query/show/verify coverage remains fixture-based; broader mixed-schema compatibility scenarios are still outside issue 03 scope.
- Another review needed: Yes

### Re-review report - 2026-06-09

- Status: completed
- Result: passed
- Findings:
  - None.
- Verification:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs` passed.
  - `node tools/tool-catalog-cli/tests/regression.mjs` passed.
  - Confirmed the keyed `accepted` map now treats the map key as final identity and rejects payload conflicts for `artifact_key` / `pattern_key` / `usage_key` in `tools/tool-catalog-cli/bin/tool-catalog.mjs:2965`-`tools/tool-catalog-cli/bin/tool-catalog.mjs:3020`.
  - Confirmed selector-prefix type conflicts are also rejected before apply normalization in `tools/tool-catalog-cli/bin/tool-catalog.mjs:2993`-`tools/tool-catalog-cli/bin/tool-catalog.mjs:2995`.
  - Confirmed regression now covers utility/template/external payload-identity mismatch failures in `tools/tool-catalog-cli/tests/regression.mjs:646`-`tools/tool-catalog-cli/tests/regression.mjs:674`.
- Remaining risks:
  - Candidate-centric compatibility inputs are still accepted as a bridge, so future regressions should keep proving reviewed entry-centric Decision Files do not depend on that path.
  - The conflict checks are fixture-backed for the three accepted entry families covered here; broader mixed-schema compatibility behavior remains outside issue 03 scope.
- Another repair worker needed: No

### Orchestrator result - 2026-06-09

- Status: completed
- Result: accepted after review, repair, and re-review.
- Review outcome: initial review failed because keyed accepted-map identity could diverge from payload identity; repair enforced map-key identity and added mismatch regressions; focused re-review passed with no findings.
- Changed files:
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `tools/tool-catalog-cli/tests/regression.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/03-apply-entry-centric-catalog-decisions.md`
- Verification summary:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs` passed.
  - `node tools/tool-catalog-cli/tests/regression.mjs` passed.
  - Regression now covers keyed accepted utility/template/external identity mismatch failures.
- Downstream: issues 04 and 07 are unblocked once their other dependencies are satisfied.
