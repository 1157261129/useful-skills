Status: ready-for-agent

# Prove the new discovery flow with regression and static checks

## What to build

Add regression and static verification that prove the new agent-orchestrated discovery architecture is the active contract. The tests should cover Finding artifacts, entry-centric apply, preclassification, worker protocol artifacts, large-run planning, and workflow gates.

## Acceptance criteria

- [x] CLI regression coverage verifies Finding artifacts, manifest/index output, fingerprints, and no semantic recommendation fields.
- [x] CLI regression coverage verifies entry-centric Decision File apply, consult retrieval, and verification behavior.
- [x] Regression coverage verifies Suppression, Deferral, and fingerprint preclassification across repeated runs.
- [x] Skill static checks verify required worker roles, main-agent-only dispatch, strict Markdown work plans, status outcome fields, and no nested subagent dispatch.
- [x] Skill static checks verify Review Workers cannot emit final actions or semantic catalog fields.
- [x] Test fixtures or static checks verify large dry-runs are planned through bounded shards/chunks with coverage accounting.
- [x] Old candidate-centric assertions are removed, renamed, or explicitly superseded by the new Finding and Catalog Entry contract.

## Blocked by

- [02 Emit Finding evidence artifacts](./02-emit-finding-evidence-artifacts.md)
- [03 Apply entry-centric catalog decisions](./03-apply-entry-centric-catalog-decisions.md)
- [04 Persist suppressions, deferrals, and fingerprints](./04-persist-suppressions-deferrals-and-fingerprints.md)
- [05 Define worker run contract and status protocol](./05-define-worker-run-contract-and-status-protocol.md)
- [06 Add sharded review map-reduce orchestration](./06-add-sharded-review-map-reduce-orchestration.md)
- [07 Add finalizer, review, repair, and apply orchestration](./07-add-finalizer-review-repair-and-apply-orchestration.md)

## Comments

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-agent-discovery/issues/08-prove-new-discovery-flow-with-regression-and-static-checks.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md`, `docs/adr/0034-store-discovery-run-files-in-user-cache.md`, current user instructions
- CONTEXT.md: tests and static checks should use current glossary language: Finding, Review Group, Catalog Entry, Suppression, Deferral, and Discovery Fingerprint (`CONTEXT.md:17`, `CONTEXT.md:21`, `CONTEXT.md:25`, `CONTEXT.md:57`, `CONTEXT.md:61`, `CONTEXT.md:65`).
- docs/adr: ADR 0041 supersedes old candidate-centric discovery for new implementation work; regression and static checks should prove Findings, main-agent-only dispatch, Markdown work plans, JSON Decision Files, recursive chunking, mandatory review, and entry-centric identity (`docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:7`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:8`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:11`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:12`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:13`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:17`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:19`).
- docs/adr: accepted reusable entries still require structured capability tags/summaries where applicable, and run artifacts belong in user cache rather than target project source (`docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:16`, `docs/adr/0034-store-discovery-run-files-in-user-cache.md:3`).
- Discussion: remove, rename, or explicitly supersede old candidate-centric assertions rather than preserving backward compatibility with the current unusable implementation.

### Execution start - 2026-06-09

- Dispatch profile: default execute-issues profile; model `gpt-5.4`; worker-specific reasoning selected by issue risk; TDD decided by worker; concurrency cap 4.
- User instructions: give subagents enough task context; `ace-tool` is unavailable; pass `model` and `reasoning_effort` despite schema display, and treat selection as unavailable only after actual dispatch failure.
- Dependency context: blocked until issues 02, 03, 04, 05, 06, and 07 complete implementation and required review/repair successfully.
- Dispatch Constraints: existing block reused without freshness inference.

### Progress - 2026-06-09

- Read the required issue, `CONTEXT.md`, ADR 0034/0040/0041, the discovery skill, the workflow doc, `tool-catalog.mjs`, `tools/tool-catalog-cli/tests/regression.mjs`, and `scripts/check-tool-catalog-skills.mjs`.
- Confirmed most issue 08 coverage already existed, but found two proof gaps: no dedicated stale-deferral reopen regression, and static checks could be tighter on dispatcher/review-worker boundary assertions.
- Tightened regression helper naming around the supplemental compatibility projection so the active assertions read as Finding-first and entry-centric rather than candidate-centric.
- Added a dedicated repeated-run regression that defers `src/utils/legacy.ts`, mutates it, and proves `reopened_deferrals = 1` with a `stale-deferral` review-queue reason.
- Strengthened static checks to require the exact `status.md` field sentence plus explicit workflow assertions for main-agent-only dispatch, worker no-subagent boundaries, shard-review semantic limits, and Decision Review outcome gating.

### Terminal report - 2026-06-09

- Status: completed
- Changed files:
  - `tools/tool-catalog-cli/tests/regression.mjs`
  - `scripts/check-tool-catalog-skills.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/08-prove-new-discovery-flow-with-regression-and-static-checks.md`
- Commands run:
  - `sed -n '1,240p' .scratch/tool-catalog-agent-discovery/issues/08-prove-new-discovery-flow-with-regression-and-static-checks.md`
  - `sed -n '1,260p' CONTEXT.md`
  - `sed -n '1,260p' docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`
  - `sed -n '1,260p' docs/adr/0040-store-capability-tags-as-structured-catalog-data.md`
  - `sed -n '1,260p' docs/adr/0034-store-discovery-run-files-in-user-cache.md`
  - `sed -n '1,260p' skills/tool-catalog-discover/SKILL.md`
  - `sed -n '1,320p' tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `sed -n '1,360p' tools/tool-catalog-cli/tests/regression.mjs`
  - `sed -n '1,360p' scripts/check-tool-catalog-skills.mjs`
  - `sed -n '1,260p' docs/agent-orchestrated-discovery-workflow.md`
  - `rg -n "candidate|accept|ignore|defer|recommend|summary|usage_notes|limitations|selection_description|coverage|status.md|Decision Review Worker|Review Worker|Chunk Planner|Shard Planner|Apply/Verify Worker" tools/tool-catalog-cli/tests/regression.mjs scripts/check-tool-catalog-skills.mjs tools/tool-catalog-cli/bin/tool-catalog.mjs skills/tool-catalog-discover/SKILL.md .scratch/tool-catalog-agent-discovery/issues`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
  - `node scripts/check-tool-catalog-skills.mjs`
- Verification:
  - `tools/tool-catalog-cli/tests/regression.mjs` now proves Finding artifacts remain the primary dry-run contract, consult/show/verify stay read-only, suppression/deferral/fingerprint preclassification covers unchanged, stale-suppression, stale-deferral, and missing-source cleanup paths, and the entry-centric Decision File apply path still succeeds.
  - `scripts/check-tool-catalog-skills.mjs` now statically enforces exact `status.md` fields, main-agent-only dispatch, no nested worker dispatch, shard-review semantic boundaries, Decision Review immutability/outcomes, and the bounded shard/chunk planning chain with coverage accounting.
  - Final command results:
    - `node tools/tool-catalog-cli/tests/regression.mjs` -> passed
    - `node scripts/check-tool-catalog-skills.mjs` -> passed
- Remaining risks:
  - The stale-deferral proof uses a utility-artifact deferral (`src/utils/legacy.ts`) because that fixture guarantees fingerprint drift; template-pattern deferrals are still covered indirectly by unchanged/cleanup behavior rather than a dedicated reopened-template-deferral case.
  - The large-run planning proof remains static-contract enforcement from docs/skill text, not a runtime oversized-shard orchestration fixture.
- Review worker needed: no; this slice only tightened regression/static proof and passed the targeted verification locally.

### Review report - 2026-06-09

- Status: completed
- Result: passed
- Findings:
  - None
- Verification:
  - `node tools/tool-catalog-cli/tests/regression.mjs` passed locally; the regression covers Finding artifacts, manifest/index run files, fingerprints, no semantic Finding fields, entry-centric reviewed apply, consult/query/show/verify read-only behavior, and repeated-run preclassification for unchanged, stale-suppression, stale-deferral, and missing-source paths (`tools/tool-catalog-cli/tests/regression.mjs:239`, `tools/tool-catalog-cli/tests/regression.mjs:259`, `tools/tool-catalog-cli/tests/regression.mjs:567`, `tools/tool-catalog-cli/tests/regression.mjs:815`, `tools/tool-catalog-cli/tests/regression.mjs:890`, `tools/tool-catalog-cli/tests/regression.mjs:941`, `tools/tool-catalog-cli/tests/regression.mjs:1191`, `tools/tool-catalog-cli/tests/regression.mjs:1238`).
  - `node scripts/check-tool-catalog-skills.mjs` passed locally; the static checks enforce required worker roles, main-agent-only dispatch, strict Markdown work plans, required `status.md` fields, no nested subagent dispatch, shard-review semantic boundaries, Decision Review outcomes, and bounded shard/chunk planning with coverage accounting (`scripts/check-tool-catalog-skills.mjs:134`, `scripts/check-tool-catalog-skills.mjs:187`, `scripts/check-tool-catalog-skills.mjs:252`, `scripts/check-tool-catalog-skills.mjs:304`, `scripts/check-tool-catalog-skills.mjs:334`, `scripts/check-tool-catalog-skills.mjs:344`).
  - The implementation still keeps the compatibility bridge as a supplemental run artifact, while the active dry-run contract is Finding-first and read-only consult/verify remains non-mutating (`tools/tool-catalog-cli/bin/tool-catalog.mjs:3120`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:3167`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:5278`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:5318`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:6743`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:6911`).
- Remaining risks:
  - Large dry-run shard/chunk proof is still static-contract enforcement, not a runtime oversized-shard fixture.
  - The reopened deferral regression is exercised on a utility-artifact deferral; template-pattern deferrals still lack a dedicated reopened case.
- Repair worker needed: No

### Orchestrator result - 2026-06-09

- Status: completed
- Result: accepted after review.
- Review outcome: review passed with no findings; no repair worker needed.
- Changed files:
  - `tools/tool-catalog-cli/tests/regression.mjs`
  - `scripts/check-tool-catalog-skills.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/08-prove-new-discovery-flow-with-regression-and-static-checks.md`
- Verification summary:
  - `node tools/tool-catalog-cli/tests/regression.mjs` passed.
  - `node scripts/check-tool-catalog-skills.mjs` passed.
  - Review confirmed Finding artifacts, entry-centric apply, preclassification, worker protocol, bounded shard/chunk planning, and superseded candidate-centric assertion coverage.
- Downstream: no requested issues remain blocked by issue 08.
