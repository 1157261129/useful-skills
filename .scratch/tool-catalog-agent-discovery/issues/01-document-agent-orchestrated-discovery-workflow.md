Status: ready-for-agent

# Document agent-orchestrated discovery workflow

## What to build

Document the new agent-orchestrated Tool Catalog discovery workflow described by ADR 0041. The documentation should make the new domain language and worker DAG explicit so later implementation issues can follow one shared contract instead of reviving the old candidate-centric flow.

## Acceptance criteria

- [x] The workflow documentation defines Evidence Harvest, Finding, Review Group, Catalog Entry, Suppression, Deferral, and Discovery Fingerprint consistently with the glossary.
- [x] The documentation describes the static worker DAG from evidence harvest through apply verification.
- [x] The documentation describes worker artifact boundaries, including structured work artifacts, strict Markdown work plans, minimal status files, and JSON decision files.
- [x] The documentation states that the main agent is the only dispatcher and that workers must not spawn subagents.
- [x] The documentation references ADR 0041 as the controlling architecture decision and calls out that old candidate-centric discovery is superseded.
- [x] No CLI or skill behavior changes are introduced by this documentation-only slice.

## Blocked by

None - can start immediately

## Comments

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-agent-discovery/issues/01-document-agent-orchestrated-discovery-workflow.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`, current user instructions
- CONTEXT.md: use the glossary terms Project Index, Catalog Entry, Finding, Review Group, Evidence Harvest, Discovery Decision File, Suppression, Deferral, and Discovery Fingerprint exactly as defined (`CONTEXT.md:3`, `CONTEXT.md:17`, `CONTEXT.md:21`, `CONTEXT.md:25`, `CONTEXT.md:29`, `CONTEXT.md:53`, `CONTEXT.md:57`, `CONTEXT.md:61`, `CONTEXT.md:65`).
- docs/adr: ADR 0041 is the controlling architecture decision; document agent-orchestrated Evidence Harvest, main-agent-only dispatch, strict Markdown work plans, JSON Decision Files, recursive map-reduce, and entry-centric decisions (`docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:3`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:7`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:11`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:12`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:13`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:19`).
- Discussion: this slice is documentation-only; do not change CLI or skill behavior while documenting the workflow.

### Execution start - 2026-06-09

- Dispatch profile: default execute-issues profile; model `gpt-5.4`; worker-specific reasoning selected by issue risk; TDD decided by worker; concurrency cap 4.
- User instructions: give subagents enough task context; `ace-tool` is unavailable; pass `model` and `reasoning_effort` despite schema display, and treat selection as unavailable only after actual dispatch failure.
- Dependency context: issue 01 has no blockers and is the first runnable issue.
- Dispatch Constraints: existing block reused without freshness inference.

### Progress - 2026-06-09

- Read the required glossary and ADR sources plus nearby docs to choose a stable documentation location under `docs/`.
- Added `docs/agent-orchestrated-discovery-workflow.md` as the implementation-facing contract for the agent-orchestrated discovery flow.
- Documented glossary-aligned terminology, the static worker DAG, artifact boundaries, main-agent-only dispatch, worker no-spawn rule, and review/apply gating from ADR 0041.
- Kept the slice documentation-only; no CLI, skill, test, package, or implementation files were changed.

### Terminal report - 2026-06-09

- Outcome: completed
- Changed files:
  - `docs/agent-orchestrated-discovery-workflow.md`
  - `.scratch/tool-catalog-agent-discovery/issues/01-document-agent-orchestrated-discovery-workflow.md`
- Commands run:
  - `pwd`
  - `rg --files .scratch/tool-catalog-agent-discovery/issues docs | sed 's#^#/#'`
  - `sed -n '1,220p' .scratch/tool-catalog-agent-discovery/issues/01-document-agent-orchestrated-discovery-workflow.md`
  - `sed -n '1,260p' CONTEXT.md`
  - `sed -n '1,260p' docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`
  - `rg -n "Evidence Harvest|Finding|Review Group|Discovery Decision File|candidate-centric|dispatcher|subagent|Decision File" docs CONTEXT.md .scratch/tool-catalog-agent-discovery/issues/01-document-agent-orchestrated-discovery-workflow.md`
  - `sed -n '1,260p' docs/agents/domain.md`
  - `sed -n '1,260p' docs/adr/0033-use-two-phase-discovery-apply.md`
  - `sed -n '1,260p' docs/adr/0036-report-discovery-results-as-actionable-summary.md`
- Remaining risks:
  - Later implementation issues still need to define exact run-directory filenames and JSON schemas; this document intentionally fixes stage contracts rather than every storage detail.
  - `docs/adr/0033-use-two-phase-discovery-apply.md` still contains older candidate-centric wording, so follow-on implementation should treat ADR 0041 and this workflow document as authoritative for new discovery work.
- Review worker needed: no

### Orchestrator result - 2026-06-09

- Status: completed
- Worker: `019eab40-d2eb-7522-9e9d-920c3af7a006`
- Result: accepted terminal report; no review worker dispatched because the worker marked review as not needed and the slice was documentation-only.
- Changed files:
  - `docs/agent-orchestrated-discovery-workflow.md`
  - `.scratch/tool-catalog-agent-discovery/issues/01-document-agent-orchestrated-discovery-workflow.md`
- Verification summary: worker reported all acceptance criteria checked and no CLI, skill, test, package, or implementation files changed.
- Downstream: issues 02 and 05 are unblocked.
