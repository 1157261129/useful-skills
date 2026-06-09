Status: ready-for-agent

# Add sharded review map-reduce orchestration

## What to build

Update the discovery skill to orchestrate Finding review through sharded and recursively chunked worker passes. Oversized dry-runs should be split into bounded worker inputs, reviewed by economical workers, aggregated with coverage checks, and merged before finalization.

## Acceptance criteria

- [x] The skill defines Evidence Harvest Worker, Shard Planner Worker, Shard Review Worker, Chunk Planner Worker, Shard Aggregator Worker, and Cross-Shard Merge Worker responsibilities.
- [x] Shard Review Workers are limited to cleaning, mechanical dedupe, structural grouping, local anchor validation, and structural flags.
- [x] Shard Review Workers are forbidden from emitting accept, ignore, defer, semantic tags, summaries, usage notes, limitations, or final catalog decisions.
- [x] Oversized shards can be recursively split without letting workers spawn subagents.
- [x] Chunk and shard artifacts include coverage accounting that detects missing or duplicate Finding coverage.
- [x] Cross-shard merge preserves conflicts and duplicate suggestions without making final semantic decisions.
- [x] Static checks or fixtures prove a large dry-run path is planned as bounded worker inputs rather than one oversized worker prompt.

## Blocked by

- [02 Emit Finding evidence artifacts](./02-emit-finding-evidence-artifacts.md)
- [05 Define worker run contract and status protocol](./05-define-worker-run-contract-and-status-protocol.md)

## Comments

### Re-review report - 2026-06-09

- Status: completed
- Result: passed
- Findings:
  - None.
- Verification:
  - `node --check scripts/check-tool-catalog-skills.mjs` passed.
  - `node scripts/check-tool-catalog-skills.mjs` passed with `Tool Catalog skill static checks passed.`
  - Confirmed the skill now fixes the oversized planning chain as `harvest manifest/index -> Shard Planner -> Chunk Planner when a shard stays oversized -> bounded shard/chunk review inputs -> Shard Aggregator -> Cross-Shard Merge` in `skills/tool-catalog-discover/SKILL.md:41`, and the worker flow mirrors that chain in `skills/tool-catalog-discover/SKILL.md:60`-`skills/tool-catalog-discover/SKILL.md:66`.
  - Confirmed the workflow contract now mirrors the same DAG order in `docs/agent-orchestrated-discovery-workflow.md:34`-`docs/agent-orchestrated-discovery-workflow.md:47`, requires the same oversized-planning chain in `docs/agent-orchestrated-discovery-workflow.md:61`, and constrains cross-shard merge to consume shard aggregates only in `docs/agent-orchestrated-discovery-workflow.md:82`.
  - Confirmed coverage gating is explicit in both the skill and workflow contract at `skills/tool-catalog-discover/SKILL.md:31`, `skills/tool-catalog-discover/SKILL.md:65`, `docs/agent-orchestrated-discovery-workflow.md:76`, and `docs/agent-orchestrated-discovery-workflow.md:123`.
  - Confirmed the static checker now validates ordered worker stages, the fixed oversized planning chain, chunk recursion, shard aggregation, coverage gate, and cross-shard merge input boundary in `scripts/check-tool-catalog-skills.mjs:88`-`scripts/check-tool-catalog-skills.mjs:96`, `scripts/check-tool-catalog-skills.mjs:178`-`scripts/check-tool-catalog-skills.mjs:276`.
- Remaining risks:
  - The proof is still static-contract evidence, not an executable oversized-fixture orchestration test. That is acceptable for this issue because acceptance criterion 7 allows static checks or fixtures.
  - If future authoritative orchestration rules move into additional files, `scripts/check-tool-catalog-skills.mjs` will need to enroll them to keep this proof complete.
- Another repair worker needed: No

### Review report - 2026-06-09

- Status: completed
- Result: failed
- Findings:
  - Medium: `scripts/check-tool-catalog-skills.mjs:123`-`scripts/check-tool-catalog-skills.mjs:165` only asserts that required phrases exist in `skills/tool-catalog-discover/SKILL.md`. It does not verify a large dry-run planning path, planner handoff, or any bounded-input artifact shape. That is weaker than acceptance criterion 7, which requires static checks or fixtures to prove oversized dry-runs are planned into bounded worker inputs rather than one oversized prompt.
- Verification:
  - `node scripts/check-tool-catalog-skills.mjs` passed.
  - Confirmed the skill defines the required worker roles and responsibilities in `skills/tool-catalog-discover/SKILL.md:57`.
  - Confirmed Shard Review Worker scope is structurally limited in `skills/tool-catalog-discover/SKILL.md:62`-`skills/tool-catalog-discover/SKILL.md:63`.
  - Confirmed oversized shard recursion and no-subagent constraint in `skills/tool-catalog-discover/SKILL.md:24`, `skills/tool-catalog-discover/SKILL.md:40`, and `skills/tool-catalog-discover/SKILL.md:60`-`skills/tool-catalog-discover/SKILL.md:61`.
  - Confirmed coverage accounting requirements in `skills/tool-catalog-discover/SKILL.md:31` and `skills/tool-catalog-discover/SKILL.md:64`.
  - Confirmed cross-shard merge preserves conflicts and duplicate suggestions without final semantic decisions in `skills/tool-catalog-discover/SKILL.md:65`.
- Remaining risks:
  - Acceptance criterion 7 remains under-specified in executable evidence. A future wording-only edit could still satisfy the current checker without proving that an oversized dry-run is decomposed into bounded worker inputs.
  - `docs/agent-orchestrated-discovery-workflow.md:30`-`docs/agent-orchestrated-discovery-workflow.md:44` still shows a coarse DAG and does not mirror the shard planner/chunk planner/shard aggregator split, so the workflow contract is less specific than the skill text.
- Repair worker needed: Yes

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-agent-discovery/issues/06-add-sharded-review-map-reduce-orchestration.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`, current user instructions
- CONTEXT.md: Review Groups are worker-organized collections of Findings around a reusable boundary, repeated pattern, or observed external usage; Findings remain structural evidence only (`CONTEXT.md:21`, `CONTEXT.md:25`).
- docs/adr: large dry-runs are handled by manifest/index files plus recursive map-reduce chunking, and no LLM worker should consume an oversized full dry-run directly (`docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:13`).
- docs/adr: Shard Review Workers use economical models and only clean, mechanically dedupe, group, and flag structural issues; they must not output final actions or semantic catalog fields (`docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:14`).
- docs/adr: Cross-Shard Merge Workers merge Review Groups and preserve conflicts without final semantic decisions (`docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:15`).
- Discussion: workers cannot spawn subagents; planners produce Markdown work plans and child briefs, while the main agent remains the only dispatcher.

### Execution start - 2026-06-09

- Dispatch profile: default execute-issues profile; model `gpt-5.4`; worker-specific reasoning selected by issue risk; TDD decided by worker; concurrency cap 4.
- User instructions: give subagents enough task context; `ace-tool` is unavailable; pass `model` and `reasoning_effort` despite schema display, and treat selection as unavailable only after actual dispatch failure.
- Dependency context: blocked until issues 02 and 05 complete implementation and required review/repair successfully.
- Dispatch Constraints: existing block reused without freshness inference.

### Progress - 2026-06-09

- Read the required context: issue 06, `CONTEXT.md`, ADR 0041, the workflow doc, `skills/tool-catalog-discover/SKILL.md`, `scripts/check-tool-catalog-skills.mjs`, and issue 05 comments for the accepted run-contract wording.
- Confirmed the current discovery skill still stopped at a high-level review/merge summary and did not define shard planners, chunk planners, shard aggregators, review-worker prohibitions, or coverage accounting.
- Chose a static-check-first repair: extend `scripts/check-tool-catalog-skills.mjs` so missing sharded orchestration language fails before updating the skill text.
- Kept the implementation local to `skills/tool-catalog-discover/SKILL.md` and `scripts/check-tool-catalog-skills.mjs`; no CLI behavior, finalizer flow, or apply/test surface changes were made.

### Blockers - 2026-06-09

- None during implementation.

### Terminal report - 2026-06-09

- Status: completed
- Changed files:
  - `skills/tool-catalog-discover/SKILL.md`
  - `scripts/check-tool-catalog-skills.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/06-add-sharded-review-map-reduce-orchestration.md`
- Commands run:
  - `pwd`
  - `sed -n '1,260p' .scratch/tool-catalog-agent-discovery/issues/06-add-sharded-review-map-reduce-orchestration.md`
  - `sed -n '1,260p' CONTEXT.md`
  - `sed -n '1,260p' docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`
  - `sed -n '1,260p' docs/agent-orchestrated-discovery-workflow.md`
  - `sed -n '1,320p' skills/tool-catalog-discover/SKILL.md`
  - `sed -n '1,260p' scripts/check-tool-catalog-skills.mjs`
  - `sed -n '1,260p' .scratch/tool-catalog-agent-discovery/issues/05-define-worker-run-contract-and-status-protocol.md`
  - `sed -n '1,260p' CLAUDE.md`
  - `git status --short`
  - `rg -n "coverage|terminal_status|next_worker|run contract|work_item_id|Shard Planner|Chunk Planner|Cross-Shard Merge" .scratch/tool-catalog-agent-discovery/issues/05-define-worker-run-contract-and-status-protocol.md skills/tool-catalog-discover/SKILL.md docs/agent-orchestrated-discovery-workflow.md`
  - `rg -n "Shard Planner|Chunk Planner|Shard Aggregator|Cross-Shard Merge|coverage accounting|missing or duplicate|oversized|bounded worker inputs|subagents" skills/tool-catalog-discover/SKILL.md scripts/check-tool-catalog-skills.mjs docs/agent-orchestrated-discovery-workflow.md docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`
  - `nl -ba skills/tool-catalog-discover/SKILL.md | sed -n '1,220p'`
  - `nl -ba scripts/check-tool-catalog-skills.mjs | sed -n '1,260p'`
  - `wc -l skills/tool-catalog-discover/SKILL.md`
  - `node scripts/check-tool-catalog-skills.mjs`
  - `git diff -- skills/tool-catalog-discover/SKILL.md scripts/check-tool-catalog-skills.mjs`
- Verification:
  - `wc -l skills/tool-catalog-discover/SKILL.md` returned `75`, so the discovery skill stays within the static concision guard.
  - `node scripts/check-tool-catalog-skills.mjs` passed after the skill text and new orchestration assertions were aligned.
  - Confirmed the skill now defines the six issue-06 worker responsibilities plus the downstream finalizer/review/apply context in `skills/tool-catalog-discover/SKILL.md:57`-`skills/tool-catalog-discover/SKILL.md:67`.
  - Confirmed chunk/shard coverage accounting and bounded worker-input planning are now explicit in `skills/tool-catalog-discover/SKILL.md:31` and `skills/tool-catalog-discover/SKILL.md:40`, and statically enforced by `scripts/check-tool-catalog-skills.mjs:123`-`scripts/check-tool-catalog-skills.mjs:165`.
- Remaining risks:
  - The bounded-input proof is currently a documentation/static-check guarantee. There is still no executable orchestration fixture that materializes shard plans from a large dry-run sample.
  - The static guard is scoped to `tool-catalog-discover/SKILL.md`; if future orchestration rules move into new authoritative docs, the checker will need to enroll those files explicitly.
- Review worker needed:
  - Yes. A focused review pass is appropriate because this issue establishes contract language that later discovery orchestration work will inherit.

### Repair terminal report - 2026-06-09

- Status: completed
- Result: completed
- Changed files:
  - `skills/tool-catalog-discover/SKILL.md`
  - `docs/agent-orchestrated-discovery-workflow.md`
  - `scripts/check-tool-catalog-skills.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/06-add-sharded-review-map-reduce-orchestration.md`
- Commands run and results:
  - `sed -n '1,260p' .scratch/tool-catalog-agent-discovery/issues/06-add-sharded-review-map-reduce-orchestration.md` plus the required `sed` reads for `skills/tool-catalog-discover/SKILL.md`, `scripts/check-tool-catalog-skills.mjs`, `docs/agent-orchestrated-discovery-workflow.md`, and `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`: confirmed the review finding and the existing contract gaps.
  - `git status --short`: confirmed unrelated workspace changes exist and were left untouched; only issue-06-scoped files were edited here.
  - `rg -n "Shard Planner|Chunk Planner|Shard Aggregator|Cross-Shard Merge|bounded worker inputs|coverage accounting|missing or duplicate Finding coverage|oversized dry-runs|oversized shards" ...`: confirmed the repair text now exists in the discovery skill, workflow contract, ADR context, and checker.
  - `node --check scripts/check-tool-catalog-skills.mjs`: passed.
  - `node scripts/check-tool-catalog-skills.mjs`: passed with `Tool Catalog skill static checks passed.`
  - `wc -l skills/tool-catalog-discover/SKILL.md`: returned `76`, so the skill remains within the concision guard.
  - `git diff -- skills/tool-catalog-discover/SKILL.md docs/agent-orchestrated-discovery-workflow.md scripts/check-tool-catalog-skills.mjs .scratch/tool-catalog-agent-discovery/issues/06-add-sharded-review-map-reduce-orchestration.md`: inspected the final patch and confirmed no CLI apply or issue-07 gate behavior was added.
- Remaining risks:
  - The proof is now a stronger structural static check across the discovery skill and workflow contract, but it is still documentation-backed evidence rather than an executable oversized-fixture orchestration test.
  - Future authoritative contract text moved into new files would require enrolling those files in `scripts/check-tool-catalog-skills.mjs` to keep the proof complete.
- Another review needed: Yes

### Orchestrator result - 2026-06-09

- Status: completed
- Result: accepted after review, repair, and re-review.
- Review outcome: initial review failed because the large-run bounded-input proof was only keyword-based; repair strengthened the skill/workflow contract and static structural checks; focused re-review passed with no findings.
- Changed files:
  - `skills/tool-catalog-discover/SKILL.md`
  - `docs/agent-orchestrated-discovery-workflow.md`
  - `scripts/check-tool-catalog-skills.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/06-add-sharded-review-map-reduce-orchestration.md`
- Verification summary:
  - `node --check scripts/check-tool-catalog-skills.mjs` passed.
  - `node scripts/check-tool-catalog-skills.mjs` passed.
  - Static checks now validate the oversized planning chain, chunk recursion, aggregation, coverage gate, and workflow DAG order.
- Downstream: issue 07 is unblocked once issue 03 completes its required review/repair successfully.
