Status: ready-for-agent

# Define worker run contract and status protocol

## What to build

Update the discovery skill so every agent-orchestrated discovery run uses one durable run contract and a strict worker status protocol. The main agent should schedule workers from Markdown work plans while remaining the only subagent dispatcher.

## Acceptance criteria

- [x] The discovery skill defines a run-level dispatch contract shared by every worker.
- [x] Worker outputs are split into structured work artifacts and minimal status files, with no required narrative reports.
- [x] Status files include terminal status, outcome, artifact paths, readiness, and next recommended worker.
- [x] Work plans use strict Markdown and include work item IDs, roles, dependencies, briefs, inputs, outputs, and coverage.
- [x] The skill states that workers may produce plans and briefs but must not spawn subagents.
- [x] The skill records the model and reasoning dispatch rule: attempt selected fields first, and treat selection as unavailable only after real dispatch failure.
- [x] Static checks cover the required protocol language and reject old candidate-centric wording where it conflicts with ADR 0041.

## Blocked by

- [01 Document agent-orchestrated discovery workflow](./01-document-agent-orchestrated-discovery-workflow.md)

## Comments

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-agent-discovery/issues/05-define-worker-run-contract-and-status-protocol.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`, `docs/adr/0034-store-discovery-run-files-in-user-cache.md`, current user instructions
- CONTEXT.md: Discovery Review Packs are organized around Findings or Review Groups; Discovery Decision Files are structured JSON artifacts for final Catalog Entries, Suppressions, and Deferrals (`CONTEXT.md:49`, `CONTEXT.md:53`).
- docs/adr: discovery uses a durable run directory as the shared channel; workers write structured artifacts and minimal `status.md` files; narrative reports are not required (`docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:10`).
- docs/adr: the main agent is the sole subagent dispatcher; workers may produce Markdown work plans and child briefs but must not spawn subagents; work plans use strict Markdown, while final Decision Files use JSON (`docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:11`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:12`).
- docs/adr: run artifacts belong under user-level Tool Catalog run storage and must not pollute target project working trees (`docs/adr/0034-store-discovery-run-files-in-user-cache.md:3`, `docs/adr/0034-store-discovery-run-files-in-user-cache.md:7`).
- Discussion: dispatch should attempt selected `model` and `reasoning_effort` fields even if the active subagent tool schema omits them; only an actual dispatch failure proves model/reasoning selection is unavailable.

### Execution start - 2026-06-09

- Dispatch profile: default execute-issues profile; model `gpt-5.4`; worker-specific reasoning selected by issue risk; TDD decided by worker; concurrency cap 4.
- User instructions: give subagents enough task context; `ace-tool` is unavailable; pass `model` and `reasoning_effort` despite schema display, and treat selection as unavailable only after actual dispatch failure.
- Dependency context: blocked until issue 01 completes implementation and required review/repair successfully.
- Dispatch Constraints: existing block reused without freshness inference.

### Progress - 2026-06-09

- Read required context: `CONTEXT.md`, ADR 0041, workflow doc, ADR 0034, `skills/tool-catalog-discover/SKILL.md`, and `scripts/check-tool-catalog-skills.mjs`.
- Confirmed the current discovery skill still documents a candidate-centric review/apply flow and the static check still enforces that obsolete wording.
- Editing plan: replace the skill text with a durable run-directory worker contract, add strict `status.md` and Markdown work-plan requirements, and update static checks to require the new protocol while rejecting conflicting candidate wording.

### Blockers - 2026-06-09

- None during implementation.

### Terminal report - 2026-06-09

- Status: completed
- Changed files:
  - `skills/tool-catalog-discover/SKILL.md`
  - `scripts/check-tool-catalog-skills.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/05-define-worker-run-contract-and-status-protocol.md`
- Commands run:
  - `pwd`
  - `git status --short`
  - `rg --files -g 'CLAUDE.md' -g 'CONTEXT.md' -g 'docs/**' -g 'skills/tool-catalog-discover/SKILL.md' -g 'scripts/check-tool-catalog-skills.mjs' -g '.scratch/tool-catalog-agent-discovery/issues/05-define-worker-run-contract-and-status-protocol.md'`
  - `sed -n '1,220p' .scratch/tool-catalog-agent-discovery/issues/05-define-worker-run-contract-and-status-protocol.md`
  - `sed -n '1,220p' CONTEXT.md`
  - `sed -n '1,260p' docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`
  - `sed -n '1,260p' docs/agent-orchestrated-discovery-workflow.md`
  - `sed -n '1,220p' docs/adr/0034-store-discovery-run-files-in-user-cache.md`
  - `sed -n '1,260p' skills/tool-catalog-discover/SKILL.md`
  - `sed -n '1,260p' scripts/check-tool-catalog-skills.mjs`
  - `sed -n '1,220p' CLAUDE.md`
  - `rg -n "candidate|Candidate|status.md|work plan|Discovery Review Pack|Discovery Decision File|reasoning_effort|model" skills/tool-catalog-discover/SKILL.md scripts/check-tool-catalog-skills.mjs docs/agent-orchestrated-discovery-workflow.md docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`
  - `nl -ba skills/tool-catalog-discover/SKILL.md | sed -n '1,220p'`
  - `nl -ba scripts/check-tool-catalog-skills.mjs | sed -n '1,260p'`
  - `wc -l skills/tool-catalog-discover/SKILL.md`
  - `node scripts/check-tool-catalog-skills.mjs`
- Verification:
  - `node scripts/check-tool-catalog-skills.mjs` passed after adding the missing apply command anchor and aligning the status heading check.
- Remaining risks:
  - Static checks currently guard only the discovery skill text; later workflow or README updates could still drift unless future issues extend the same protocol assertions there.
- Review worker needed:
  - Yes. A lightweight review pass is still useful because this change establishes terminology that later discovery orchestration issues will inherit.

### Review report - 2026-06-09

- Status: completed
- Result: failed
- Findings:
  - High: The acceptance criterion for static checks is not fully met. The new check only rejects candidate-centric wording inside `skills/tool-catalog-discover/SKILL.md` (`scripts/check-tool-catalog-skills.mjs:143`), but relevant discovery documentation still contains conflicting candidate terminology in `docs/adr/0034-store-discovery-run-files-in-user-cache.md:3`. That ADR says `Discovery candidate data`, which conflicts with ADR 0041's rule that CLI output is called a Finding, not a Candidate (`docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:8`). Because the checker does not cover this remaining conflicting wording, the issue's acceptance item "reject old candidate-centric wording where it conflicts with ADR 0041" is only partially implemented.
- Verification:
  - Read and cross-checked `skills/tool-catalog-discover/SKILL.md`, `scripts/check-tool-catalog-skills.mjs`, `CONTEXT.md`, `docs/agent-orchestrated-discovery-workflow.md`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`, and `docs/adr/0034-store-discovery-run-files-in-user-cache.md`.
  - Ran `node scripts/check-tool-catalog-skills.mjs` and it passed.
  - Confirmed the checker requires the new run-contract and status protocol language in `skills/tool-catalog-discover/SKILL.md` (`scripts/check-tool-catalog-skills.mjs:113`-`scripts/check-tool-catalog-skills.mjs:148`).
  - Confirmed the remaining conflicting wording is still present in `docs/adr/0034-store-discovery-run-files-in-user-cache.md:3`.
- Remaining risks:
  - Terminology drift remains possible across discovery docs because the static guard is scoped to the skill text and does not detect contradictory wording in adjacent ADR/workflow documents.
- Repair worker needed:
  - Yes. Repair should either align `docs/adr/0034-store-discovery-run-files-in-user-cache.md` with ADR 0041 terminology or explicitly narrow the acceptance/check scope so the protocol check matches the intended boundary.

### Repair progress - 2026-06-09

- Re-read the review finding against ADR 0041, ADR 0034, the workflow document, the discovery skill, and the static checker to keep the repair inside issue 05 scope.
- Updated ADR 0034 to replace the remaining candidate-centric references with Finding-centric discovery artifact wording.
- Strengthened `scripts/check-tool-catalog-skills.mjs` so it rejects superseded candidate-centric discovery wording in relevant discovery docs, not only in `skills/tool-catalog-discover/SKILL.md`.

### Repair terminal report - 2026-06-09

- Status: completed
- Result: completed
- Changed files:
  - `docs/adr/0034-store-discovery-run-files-in-user-cache.md`
  - `scripts/check-tool-catalog-skills.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/05-define-worker-run-contract-and-status-protocol.md`
- Commands run:
  - `pwd`
  - `rg -n "candidate|Candidate|Discovery candidate data|Finding" .scratch/tool-catalog-agent-discovery/issues/05-define-worker-run-contract-and-status-protocol.md docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md docs/adr/0034-store-discovery-run-files-in-user-cache.md docs/agent-orchestrated-discovery-workflow.md skills/tool-catalog-discover/SKILL.md scripts/check-tool-catalog-skills.mjs CLAUDE.md`
  - `sed -n '1,220p' .scratch/tool-catalog-agent-discovery/issues/05-define-worker-run-contract-and-status-protocol.md`
  - `sed -n '1,220p' docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`
  - `sed -n '1,220p' docs/adr/0034-store-discovery-run-files-in-user-cache.md`
  - `sed -n '1,240p' docs/agent-orchestrated-discovery-workflow.md`
  - `sed -n '1,240p' skills/tool-catalog-discover/SKILL.md`
  - `sed -n '1,260p' scripts/check-tool-catalog-skills.mjs`
  - `sed -n '1,220p' CLAUDE.md`
  - `sed -n '60,180p' .scratch/tool-catalog-agent-discovery/issues/05-define-worker-run-contract-and-status-protocol.md`
  - `nl -ba docs/adr/0034-store-discovery-run-files-in-user-cache.md | sed -n '1,80p'`
  - `nl -ba scripts/check-tool-catalog-skills.mjs | sed -n '1,220p'`
  - `node scripts/check-tool-catalog-skills.mjs`
  - `rg -n "Discovery candidate data|full candidate data" docs/adr/0034-store-discovery-run-files-in-user-cache.md docs/agent-orchestrated-discovery-workflow.md`
- Verification:
  - `node scripts/check-tool-catalog-skills.mjs` passed after narrowing the discovery-doc guard to disallowed artifact phrases instead of banning every explanatory `candidate` reference.
  - `rg -n "Discovery candidate data|full candidate data" docs/adr/0034-store-discovery-run-files-in-user-cache.md docs/agent-orchestrated-discovery-workflow.md` returned no matches.
  - Confirmed ADR 0034 now uses `Discovery Findings data` and `full Findings data`, matching ADR 0041 terminology.
- Remaining risks:
  - The candidate-wording guard now covers the ADR/workflow documents explicitly listed in the checker. New discovery docs added later will still need intentional enrollment if they carry authoritative terminology.
- Another review needed:
  - Yes. A focused re-review is appropriate because this repair changes the acceptance guard boundary.

### Re-review report - 2026-06-09

- Status: completed
- Result: passed
- Findings:
  - None. The previous review finding is fixed. `docs/adr/0034-store-discovery-run-files-in-user-cache.md:3` now uses Findings-centric terminology, and `scripts/check-tool-catalog-skills.mjs:27`-`scripts/check-tool-catalog-skills.mjs:35` plus `scripts/check-tool-catalog-skills.mjs:160`-`scripts/check-tool-catalog-skills.mjs:169` now enforce the conflicting artifact phrases across the relevant discovery docs.
- Verification:
  - Ran `node scripts/check-tool-catalog-skills.mjs` and it passed.
  - Ran targeted `rg` for `Discovery candidate data`, `full candidate data`, `candidate`, `status.md`, `work_item_id`, `reasoning_effort`, and `The main agent is the only dispatcher` across the re-review scope.
  - Confirmed the worker run contract and status protocol remain present in `skills/tool-catalog-discover/SKILL.md:18`-`skills/tool-catalog-discover/SKILL.md:53`.
  - Confirmed ADR 0034 no longer contains the old conflicting phrases at `docs/adr/0034-store-discovery-run-files-in-user-cache.md:3` and now aligns with ADR 0041 terminology.
- Remaining risks:
  - The terminology guard is still opt-in by file list. If future authoritative discovery docs are added outside `scripts/check-tool-catalog-skills.mjs:27`-`scripts/check-tool-catalog-skills.mjs:30`, drift could reappear until those files are enrolled.
- Another repair worker needed:
  - No.
