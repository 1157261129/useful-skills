# Generate facts-only Discovery Review Packs during dry-run

Status: ready-for-agent

## What to build

Change discovery dry-run so it writes user-cache run files for agents instead of forcing agents to read noisy raw JSON. The Markdown Discovery Review Pack should group candidates by utility class or template pattern and include only compact structural facts needed for agent review.

## Acceptance criteria

- [x] Dry-run writes machine-readable candidate data, a facts-only Markdown Discovery Review Pack, and a decision template or equivalent decision scaffold under the user cache run directory.
- [x] Dry-run stdout stays compact and reports run file paths instead of printing full candidate data by default.
- [x] Review packs include utility class names, source anchors, paths or packages, method signatures, short snippets, template pattern keys, representative instances, and instance anchors.
- [x] Review packs do not include semantic tag hints, suggested actions, risk flags, long source dumps, or LLM-style summaries.
- [x] Regression tests cover full and changed dry-runs, generated file paths, review pack content shape, and target-project cleanliness.

## Blocked by

- .scratch/tool-catalog-capability-tags/issues/01-codify-capability-tag-workflow-contracts.md

## Comments

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-capability-tags/issues/04-generate-facts-only-discovery-review-packs.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0014-batch-discovery-decisions-after-scan.md`, `docs/adr/0017-use-conservative-utility-discovery.md`, `docs/adr/0033-use-two-phase-discovery-apply.md`, `docs/adr/0034-store-discovery-run-files-in-user-cache.md`, `docs/adr/0036-report-discovery-results-as-actionable-summary.md`, current user instructions
- CONTEXT.md: Discovery Review Packs are Markdown artifacts grouped by utility class or template pattern; Discovery Decision Files are reviewed structured JSON consumed by apply (`CONTEXT.md:33`, `CONTEXT.md:37`).
- docs/adr: review packs contain concise structural facts and explicitly no semantic tag hints or suggested actions; agents read the review pack instead of noisy raw JSON (`docs/adr/0033-use-two-phase-discovery-apply.md:3`, `docs/adr/0033-use-two-phase-discovery-apply.md:9`, `docs/adr/0033-use-two-phase-discovery-apply.md:10`, `docs/adr/0033-use-two-phase-discovery-apply.md:11`).
- docs/adr: raw candidate JSON remains available for audit/debug/validation, but apply consumes reviewed decisions (`docs/adr/0033-use-two-phase-discovery-apply.md:12`, `docs/adr/0033-use-two-phase-discovery-apply.md:13`).
- docs/adr: run files live in user cache and dry-run output should stay compact by reporting paths (`docs/adr/0034-store-discovery-run-files-in-user-cache.md:3`, `docs/adr/0034-store-discovery-run-files-in-user-cache.md:9`).
- docs/adr: discovery favors precision and explicit utility naming/shared utility paths; business-package helpers are not indexed by default (`docs/adr/0017-use-conservative-utility-discovery.md:3`, `docs/adr/0017-use-conservative-utility-discovery.md:9`).
- docs/adr: discovery decisions are batched after full review; do not interrupt user for each candidate (`docs/adr/0014-batch-discovery-decisions-after-scan.md:9`, `docs/adr/0014-batch-discovery-decisions-after-scan.md:10`).
- docs/adr: discovery reports should summarize paths/counts/risks/follow-ups rather than printing full catalog data (`docs/adr/0036-report-discovery-results-as-actionable-summary.md:3`).
- Discussion: keep Markdown token-light: no tag hints, suggested actions, risk flags, long source dumps, or LLM-style summaries.

### Execution Started

- Date: 2026-06-09
- Dispatch profile: default Codex worker profile; selected model `gpt-5.4`; reasoning selected per issue by main agent; TDD decided by worker; concurrency cap 2.
- Dependency context: blocked by issue 01; dispatch only after issue 01 completes implementation and required review/repair successfully.
- Dispatch Constraints: existing block reused without freshness inference.

### Dispatch Exception

- Date: 2026-06-09
- User approved continuing worker `019eaa0f-a4b1-7a62-9634-e921ed842f4a` after clarification that the available `multi_agent_v1.spawn_agent` tool cannot pass `model` or `reasoning_effort` as payload fields. The selected profile remains recorded in the worker brief, and execution continues under the tool's inherited worker model behavior.

### Terminal Report

- Status: completed
- Changed files: `tools/tool-catalog-cli/bin/tool-catalog.mjs`, `tools/tool-catalog-cli/tests/regression.mjs`, `.scratch/tool-catalog-capability-tags/issues/04-generate-facts-only-discovery-review-packs.md`
- Implementation summary: `discover --dry-run` now writes `candidates.json`, facts-only `review-pack.md`, and `decisions.template.json` under the user cache project run directory, returns `run_files` in JSON output, and keeps default stdout compact with candidate counts plus run-file paths. The Review Pack groups utility artifacts, observed external usages, and template patterns with structural facts only: anchors, paths/packages, signatures, short snippets, and representative instances.
- Verification: `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`; `node --check tools/tool-catalog-cli/tests/regression.mjs`; `node tools/tool-catalog-cli/tests/regression.mjs`; `node scripts/check-tool-catalog-skills.mjs`; `bash -n scripts/sync-skills.sh`; `git diff --check -- tools/tool-catalog-cli/bin/tool-catalog.mjs tools/tool-catalog-cli/tests/regression.mjs`.
- Remaining risks: `tools/tool-catalog-cli/bin/tool-catalog.mjs` and `tools/tool-catalog-cli/tests/regression.mjs` also contain concurrent issue 02 changes in this working tree; the regression fixture was minimally updated with accepted-entry `capability_tags` and member summaries so the combined tree verifies. No schema, migration, query, or apply tag behavior was implemented for issue 04.
- Review worker: recommended. Reason: this issue modified shared CLI dry-run output and regression behavior while concurrent issue 02 was changing apply/tag validation in the same files.

### Review Report

- Status: completed
- Result: accepted
- Scope reviewed: issue 04 only, limited to dry-run Discovery Review Pack run files and compact stdout behavior.
- Findings: none.
- Acceptance evidence:
  - Dry-run run-file generation is implemented in `tools/tool-catalog-cli/bin/tool-catalog.mjs:2277`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:2490`, and invoked for every dry-run in `tools/tool-catalog-cli/bin/tool-catalog.mjs:5711`.
  - Facts-only Review Pack rendering is implemented in `tools/tool-catalog-cli/bin/tool-catalog.mjs:2337`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:2406`, and `tools/tool-catalog-cli/bin/tool-catalog.mjs:2445`; reviewed content is structural only and excludes tag hints / suggested actions / risk flags.
  - Compact default stdout with run-file paths is implemented in `tools/tool-catalog-cli/bin/tool-catalog.mjs:2505`.
  - Regression coverage for full dry-run, changed dry-run, generated file paths, review-pack shape, and target-project cleanliness is present in `tools/tool-catalog-cli/tests/regression.mjs:189`, `tools/tool-catalog-cli/tests/regression.mjs:218`, `tools/tool-catalog-cli/tests/regression.mjs:330`, `tools/tool-catalog-cli/tests/regression.mjs:370`, and `tools/tool-catalog-cli/tests/regression.mjs:389`.
- Verification run by review:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node --check tools/tool-catalog-cli/tests/regression.mjs`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
  - `node scripts/check-tool-catalog-skills.mjs`
  - `bash -n scripts/sync-skills.sh`
  - `git diff --check -- tools/tool-catalog-cli/bin/tool-catalog.mjs tools/tool-catalog-cli/tests/regression.mjs`
- Concurrent issue 02 check: shared-file overlap exists, but no conflicting behavior was observed in the current tree during the above verification.
- Repair worker needed: no.

### Orchestrator Result

- Status: completed
- Result: accepted implementation and review terminal reports; no repair worker dispatched because review found no findings.
- Changed files: `tools/tool-catalog-cli/bin/tool-catalog.mjs`, `tools/tool-catalog-cli/tests/regression.mjs`, `.scratch/tool-catalog-capability-tags/issues/04-generate-facts-only-discovery-review-packs.md`
- Verification summary: implementation and review workers both reported CLI syntax checks, regression tests, skill static checks, shell syntax checks, and diff whitespace checks passed for issue 04 scope.
