Status: ready-for-agent

# Add finalizer, review, repair, and apply orchestration

## What to build

Update the discovery skill so final catalog decisions are made by dedicated workers after sharded review and merge. The finalizer should inspect source anchors, perform mandatory local gap audit, produce the entry-centric Decision File, pass through decision review and repair when needed, and then apply automatically when review passes.

## Acceptance criteria

- [x] The skill defines Catalog Finalizer Worker, Decision Review Worker, Finalizer Repair Worker, Decision Incorporation Worker, and Apply/Verify Worker responsibilities.
- [x] The Catalog Finalizer Worker owns source inspection, semantic decisions, local gap audit, suppressions, deferrals, and Decision File generation.
- [x] Local gap audit is mandatory for every Review Group considered for acceptance.
- [x] Decision Review Worker is mandatory before apply and does not modify the Decision File.
- [x] Fixable decision review findings route to repair and then back to decision review.
- [x] Blocking decision review findings route through user decision and decision incorporation before another review.
- [x] Review passing with no blockers triggers Apply/Verify Worker by default unless the user requested review-only mode.
- [x] Static checks cover the review, repair, user decision, and apply gates.

## Blocked by

- [03 Apply entry-centric catalog decisions](./03-apply-entry-centric-catalog-decisions.md)
- [05 Define worker run contract and status protocol](./05-define-worker-run-contract-and-status-protocol.md)
- [06 Add sharded review map-reduce orchestration](./06-add-sharded-review-map-reduce-orchestration.md)

## Comments

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-agent-discovery/issues/07-add-finalizer-review-repair-and-apply-orchestration.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md`, `docs/adr/0018-index-artifacts-and-members.md`, `docs/adr/0019-index-template-patterns-and-instances.md`, `docs/adr/0016-index-only-observed-external-utility-usage.md`, current user instructions
- CONTEXT.md: Catalog Entries are final accepted reusable items; Utility Artifacts are non-business reusable code units; Template Code is recurring reusable pattern code; Deferrals remain visible when context changes (`CONTEXT.md:13`, `CONTEXT.md:17`, `CONTEXT.md:37`, `CONTEXT.md:61`).
- docs/adr: Catalog Finalizer Workers use stronger reasoning, inspect source anchors, perform mandatory local gap audit, create semantic Catalog Entries, Suppressions, Deferrals, and write entry-centric JSON Decision Files (`docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:16`).
- docs/adr: Decision Review Workers are mandatory before apply; fixable findings go to repair workers, blocking findings go through user decision and incorporation workers; review passing with no blockers triggers Apply/Verify Worker unless review-only mode was requested (`docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:17`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:18`).
- docs/adr: finalizer decisions must preserve member-level precision, representative template instances, observed external usage boundaries, summaries, and capability tags where applicable (`docs/adr/0018-index-artifacts-and-members.md:3`, `docs/adr/0018-index-artifacts-and-members.md:9`, `docs/adr/0019-index-template-patterns-and-instances.md:3`, `docs/adr/0016-index-only-observed-external-utility-usage.md:3`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:16`).
- Discussion: main agent stays orchestration-only; it must not perform source inspection, semantic field writing, final decision edits, or apply-output interpretation when a worker can own that scope.

### Execution start - 2026-06-09

- Dispatch profile: default execute-issues profile; model `gpt-5.4`; worker-specific reasoning selected by issue risk; TDD decided by worker; concurrency cap 4.
- User instructions: give subagents enough task context; `ace-tool` is unavailable; pass `model` and `reasoning_effort` despite schema display, and treat selection as unavailable only after actual dispatch failure.
- Dependency context: blocked until issues 03, 05, and 06 complete implementation and required review/repair successfully.
- Dispatch Constraints: existing block reused without freshness inference.

### Progress update - 2026-06-09

- Baseline check: `node scripts/check-tool-catalog-skills.mjs` passed before edits.
- Gap confirmed: `skills/tool-catalog-discover/SKILL.md` mentioned finalizer and review/apply, but did not yet define `Finalizer Repair Worker`, `Decision Incorporation Worker`, Decision File immutability during review, mandatory per-Review-Group local gap audit wording, or default apply-after-pass behavior in worker-responsibility form.
- Planned issue-local edits: tighten worker responsibility language in `skills/tool-catalog-discover/SKILL.md`, mirror the repair and incorporation gates in `docs/agent-orchestrated-discovery-workflow.md`, and extend `scripts/check-tool-catalog-skills.mjs` to enforce the new review/repair/user-decision/apply gates.

### Terminal report - 2026-06-09

- Status: completed
- Changed files:
  - `skills/tool-catalog-discover/SKILL.md`
  - `docs/agent-orchestrated-discovery-workflow.md`
  - `scripts/check-tool-catalog-skills.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/07-add-finalizer-review-repair-and-apply-orchestration.md`
- Commands run:
  - `sed -n '1,260p' .scratch/tool-catalog-agent-discovery/issues/07-add-finalizer-review-repair-and-apply-orchestration.md`
  - `sed -n '1,260p' CONTEXT.md`
  - `sed -n '1,240p' docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`
  - `sed -n '1,220p' docs/adr/0040-store-capability-tags-as-structured-catalog-data.md`
  - `sed -n '1,220p' docs/adr/0018-index-artifacts-and-members.md`
  - `sed -n '1,220p' docs/adr/0019-index-template-patterns-and-instances.md`
  - `sed -n '1,220p' docs/adr/0016-index-only-observed-external-utility-usage.md`
  - `sed -n '1,260p' docs/agent-orchestrated-discovery-workflow.md`
  - `sed -n '1,260p' skills/tool-catalog-discover/SKILL.md`
  - `sed -n '1,260p' scripts/check-tool-catalog-skills.mjs`
  - `rg -n "Catalog Finalizer|Decision Review|Apply/Verify|repair|review-only|local gap audit|Decision Incorporation|blocking" skills/tool-catalog-discover/SKILL.md docs/agent-orchestrated-discovery-workflow.md scripts/check-tool-catalog-skills.mjs .scratch/tool-catalog-agent-discovery/issues/07-add-finalizer-review-repair-and-apply-orchestration.md`
  - `node scripts/check-tool-catalog-skills.mjs`
- Verification:
  - `node scripts/check-tool-catalog-skills.mjs` passed after the edits.
  - Skill text now defines `Catalog Finalizer Worker`, `Decision Review Worker`, `Finalizer Repair Worker`, `Decision Incorporation Worker`, and `Apply/Verify Worker`, including mandatory local gap audit, repair/re-review loop, blocking-decision incorporation loop, Decision File immutability during review, and default apply-after-pass unless review-only mode was requested.
  - Workflow contract mirrors the same gates and worker responsibilities so the skill and implementation-facing workflow stay aligned.
- Remaining risks:
  - This issue only tightens the skill/workflow contract and static gates. Runtime orchestration still depends on the actual dispatcher/apply implementation following the documented worker responsibilities.
  - Existing unrelated worktree changes remain untouched.
- Review worker needed: no; this change is documentation plus static-check coverage and was verified locally with the updated static check.

### Review report - 2026-06-09

- Status: completed
- Result: passed
- Findings:
  - None
- Verification:
  - `node scripts/check-tool-catalog-skills.mjs` -> passed (`Tool Catalog skill static checks passed.`)
  - `skills/tool-catalog-discover/SKILL.md:33`, `skills/tool-catalog-discover/SKILL.md:67`, `skills/tool-catalog-discover/SKILL.md:68`, `skills/tool-catalog-discover/SKILL.md:69`, `skills/tool-catalog-discover/SKILL.md:70`, and `skills/tool-catalog-discover/SKILL.md:71` require the Catalog Finalizer Worker, Decision Review Worker, Finalizer Repair Worker, Decision Incorporation Worker, and Apply/Verify Worker responsibilities, including mandatory per-Review-Group local gap audit, Decision File immutability during review, repair re-review, blocking-decision incorporation, and default apply-after-pass unless review-only mode was requested.
  - `docs/agent-orchestrated-discovery-workflow.md:42`, `docs/agent-orchestrated-discovery-workflow.md:43`, `docs/agent-orchestrated-discovery-workflow.md:44`, `docs/agent-orchestrated-discovery-workflow.md:45`, `docs/agent-orchestrated-discovery-workflow.md:46`, `docs/agent-orchestrated-discovery-workflow.md:89`, `docs/agent-orchestrated-discovery-workflow.md:90`, `docs/agent-orchestrated-discovery-workflow.md:96`, `docs/agent-orchestrated-discovery-workflow.md:98`, `docs/agent-orchestrated-discovery-workflow.md:101`, `docs/agent-orchestrated-discovery-workflow.md:102`, `docs/agent-orchestrated-discovery-workflow.md:106`, `docs/agent-orchestrated-discovery-workflow.md:112`, and `docs/agent-orchestrated-discovery-workflow.md:118` mirror the same worker DAG ordering and gate semantics in the implementation-facing workflow contract.
  - `scripts/check-tool-catalog-skills.mjs:217`, `scripts/check-tool-catalog-skills.mjs:222`, `scripts/check-tool-catalog-skills.mjs:227`, `scripts/check-tool-catalog-skills.mjs:232`, `scripts/check-tool-catalog-skills.mjs:237`, `scripts/check-tool-catalog-skills.mjs:242`, `scripts/check-tool-catalog-skills.mjs:279`, `scripts/check-tool-catalog-skills.mjs:319`, `scripts/check-tool-catalog-skills.mjs:329`, `scripts/check-tool-catalog-skills.mjs:334`, `scripts/check-tool-catalog-skills.mjs:339`, `scripts/check-tool-catalog-skills.mjs:344`, and `scripts/check-tool-catalog-skills.mjs:349` enforce these gates with exact contract assertions and ordered stage checks, so the review coverage is stronger than a loose surface keyword grep.
  - `.scratch/tool-catalog-agent-discovery/issues/07-add-finalizer-review-repair-and-apply-orchestration.md:55`, `.scratch/tool-catalog-agent-discovery/issues/07-add-finalizer-review-repair-and-apply-orchestration.md:56`, `.scratch/tool-catalog-agent-discovery/issues/07-add-finalizer-review-repair-and-apply-orchestration.md:57`, `.scratch/tool-catalog-agent-discovery/issues/07-add-finalizer-review-repair-and-apply-orchestration.md:58`, and `.scratch/tool-catalog-agent-discovery/issues/07-add-finalizer-review-repair-and-apply-orchestration.md:59` show the implementation stayed within the skill/workflow/static-check surface; it did not touch CLI persistence logic from issue 04 or the broader regression surface scoped by issue 08.
- Remaining risks:
  - `scripts/check-tool-catalog-skills.mjs:81`, `scripts/check-tool-catalog-skills.mjs:88`, and `scripts/check-tool-catalog-skills.mjs:120` show this verification remains contract-oriented static enforcement; runtime dispatcher/apply behavior still depends on downstream implementation and the broader regression coverage described in `.scratch/tool-catalog-agent-discovery/issues/08-prove-new-discovery-flow-with-regression-and-static-checks.md:7` and `.scratch/tool-catalog-agent-discovery/issues/08-prove-new-discovery-flow-with-regression-and-static-checks.md:14`.
  - `docs/agent-orchestrated-discovery-workflow.md:166`, `docs/agent-orchestrated-discovery-workflow.md:167`, and `docs/agent-orchestrated-discovery-workflow.md:168` explicitly keep the workflow document contract-only, so future drift between docs/static checks and runtime behavior still needs regression protection.
- Repair worker needed: No

### Orchestrator result - 2026-06-09

- Status: completed
- Result: accepted after review.
- Review outcome: review passed with no findings; no repair worker needed.
- Changed files:
  - `skills/tool-catalog-discover/SKILL.md`
  - `docs/agent-orchestrated-discovery-workflow.md`
  - `scripts/check-tool-catalog-skills.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/07-add-finalizer-review-repair-and-apply-orchestration.md`
- Verification summary:
  - `node scripts/check-tool-catalog-skills.mjs` passed.
  - Review confirmed finalizer, decision review, repair, incorporation, review-only, and apply/verify gate contracts are present and statically enforced.
- Downstream: issue 08 is now unblocked.
