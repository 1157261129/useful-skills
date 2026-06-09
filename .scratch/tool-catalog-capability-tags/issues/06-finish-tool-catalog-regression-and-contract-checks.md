# Finish Tool Catalog regression and contract checks

Status: ready-for-agent

## What to build

Bring the Tool Catalog verification suite and published command surface into alignment after the Capability Tag, Discovery Review Pack, tag query, and logical member changes are implemented. The standard repository checks should validate the final documented workflow and CLI behavior.

## Acceptance criteria

- [ ] Regression fixtures cover the complete discovery-to-consulting flow for Capability Tags and Selection Descriptions.
- [ ] Static skill checks require the final discover and consult workflows, including review packs, decision files, tag vocabulary lookup, and strict tag filtering.
- [ ] CLI help, README command surface, and skill docs agree on all supported commands and options.
- [ ] The documented verification commands pass, including syntax checks, CLI regression tests, skill static checks, and shell script checks.
- [ ] Any transitional contract text from the first issue is removed or updated to describe implemented behavior.

## Blocked by

- .scratch/tool-catalog-capability-tags/issues/02-apply-reviewed-capability-tag-decisions.md
- .scratch/tool-catalog-capability-tags/issues/03-query-by-capability-tag-with-vocabulary-lookup.md
- .scratch/tool-catalog-capability-tags/issues/04-generate-facts-only-discovery-review-packs.md
- .scratch/tool-catalog-capability-tags/issues/05-represent-logical-members-and-overload-signatures.md

## Comments

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-capability-tags/issues/06-finish-tool-catalog-regression-and-contract-checks.md`
- Sources checked: `CONTEXT.md`, `README.md`, `docs/adr/0011-use-english-for-catalog-prose.md`, `docs/adr/0036-report-discovery-results-as-actionable-summary.md`, `docs/adr/0037-test-cli-with-fixtures-and-skill-static-checks.md`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md`, current user instructions
- CONTEXT.md: final checks must preserve the Tool Catalog glossary terms for Project Index, Tool Catalog CLI, Discovery Review Pack, Discovery Decision File, Capability Tag, Capability Tag Vocabulary, and Selection Description (`CONTEXT.md:3`, `CONTEXT.md:17`, `CONTEXT.md:33`, `CONTEXT.md:37`, `CONTEXT.md:49`, `CONTEXT.md:53`, `CONTEXT.md:57`).
- README.md: standard verification commands include CLI syntax check, regression tests, skill static checks, and sync shell syntax check (`README.md:25`, `README.md:28`, `README.md:29`, `README.md:30`, `README.md:31`).
- docs/adr: CLI behavior is verified with fixtures and skill static checks; skill docs must stay aligned with CLI command contract (`docs/adr/0037-test-cli-with-fixtures-and-skill-static-checks.md:3`, `docs/adr/0037-test-cli-with-fixtures-and-skill-static-checks.md:7`, `docs/adr/0037-test-cli-with-fixtures-and-skill-static-checks.md:8`).
- docs/adr: final reports summarize project identity, index path, counts, decisions, risks, and follow-ups without printing full catalog data (`docs/adr/0036-report-discovery-results-as-actionable-summary.md:3`).
- docs/adr: final documented behavior must include structured tags, tag vocabulary lookup, strict tag filters, AND multi-tag semantics, and required summary quality gates (`docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:8`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:13`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:14`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:16`).
- docs/adr: all catalog prose, tags, Markdown query output, JSON fields, and CLI arguments stay English (`docs/adr/0011-use-english-for-catalog-prose.md:3`).
- Discussion: remove transitional contract text from issue 01 once implementation exists; final static checks should require implemented CLI help and skill docs to agree.

### Execution Started

- Date: 2026-06-09
- Dispatch profile: default Codex worker profile; selected model `gpt-5.4`; reasoning selected per issue by main agent; TDD decided by worker; concurrency cap 2.
- Dependency context: blocked by issues 02, 03, 04, and 05; dispatch only after all required upstream implementation and review/repair gates complete successfully.
- Dispatch Constraints: existing block reused without freshness inference.

### Worker Progress

- Date: 2026-06-09
- Status: in_progress
- Notes: Read issue 06, dispatch constraints, README, tool-catalog skills, static checks, and regression suite. Running the documented verification commands to find remaining contract mismatches before editing.
- Date: 2026-06-09
- Status: in_progress
- Notes: Updated README to the final command surface, removed planned Capability Tag wording, tightened static checks against CLI help, and added direct regression assertions for accepted summary/usage metadata.

### Worker Terminal Report

- Status: completed
- Changed files: `README.md`, `scripts/check-tool-catalog-skills.mjs`, `tools/tool-catalog-cli/tests/regression.mjs`, `.scratch/tool-catalog-capability-tags/issues/01-codify-capability-tag-workflow-contracts.md`, `.scratch/tool-catalog-capability-tags/issues/06-finish-tool-catalog-regression-and-contract-checks.md`
- Summary: Promoted `tool-catalog tags` and `query --tag` from planned wording to the final README command surface, tightened static checks so README/skill docs/CLI help must agree on the implemented workflow, added direct regression assertions for accepted summary and selection metadata, and appended a superseding note to issue 01 so the old transitional contract is explicitly historical.
- Commands run: `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`; `node --check scripts/check-tool-catalog-skills.mjs`; `node scripts/check-tool-catalog-skills.mjs`; `node tools/tool-catalog-cli/tests/regression.mjs`; `bash -n scripts/sync-skills.sh`; `git diff --check -- README.md scripts/check-tool-catalog-skills.mjs tools/tool-catalog-cli/tests/regression.mjs .scratch/tool-catalog-capability-tags/issues/01-codify-capability-tag-workflow-contracts.md .scratch/tool-catalog-capability-tags/issues/06-finish-tool-catalog-regression-and-contract-checks.md`
- Verification: All listed commands passed. Static checks now fail if README falls back to planned Capability Tag wording or diverges from CLI help, and regression explicitly covers persisted summary/usage metadata during consult flows.
- Remaining risks: Future CLI help or skill-doc edits can still drift if they bypass these repository checks; the current guardrail only holds if contributors run the documented verification commands.
- Review worker needed: no; scope is documentation/static-contract alignment plus regression assertions, and the full documented verification suite passed.

### Orchestrator Result

- Status: completed
- Result: accepted worker terminal report; no review worker dispatched because worker reported review not needed and the final documented verification suite passed.
- Changed files: `README.md`, `scripts/check-tool-catalog-skills.mjs`, `tools/tool-catalog-cli/tests/regression.mjs`, `.scratch/tool-catalog-capability-tags/issues/01-codify-capability-tag-workflow-contracts.md`, `.scratch/tool-catalog-capability-tags/issues/06-finish-tool-catalog-regression-and-contract-checks.md`
- Verification summary: worker reported `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`, `node --check scripts/check-tool-catalog-skills.mjs`, `node scripts/check-tool-catalog-skills.mjs`, `node tools/tool-catalog-cli/tests/regression.mjs`, `bash -n scripts/sync-skills.sh`, and scoped `git diff --check` passed.
