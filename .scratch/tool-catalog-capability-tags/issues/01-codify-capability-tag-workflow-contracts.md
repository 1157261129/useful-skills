# Codify Capability Tag workflow in Tool Catalog contracts

Status: ready-for-agent

## What to build

Update the Tool Catalog command and skill contracts so discovery and consulting agents share the new Capability Tag workflow before behavior changes are implemented. The documented workflow should make Discovery Review Packs the discovery agent's primary dry-run input, Discovery Decision Files the apply input, and tags-first lookup the default consulting path for reusable utilities and templates.

## Acceptance criteria

- [x] The discovery skill describes facts-only Discovery Review Packs, reviewed Discovery Decision Files, and enrichment only for final accepted entries.
- [x] The consulting skill describes tag vocabulary lookup, strict tag filtering, source verification, and one-step fallback for no-result tag queries.
- [x] The repository command surface documentation mentions the planned `tags` command and `query --tag` filter without implying that raw dry-run JSON is the primary agent input.
- [x] Static contract checks are updated only where they can pass before CLI behavior exists; checks that require new help output are deferred to the implementation issues.

## Blocked by

None - can start immediately

## Comments

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-capability-tags/issues/01-codify-capability-tag-workflow-contracts.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0011-use-english-for-catalog-prose.md`, `docs/adr/0022-consult-before-coding-with-progressive-verification.md`, `docs/adr/0033-use-two-phase-discovery-apply.md`, `docs/adr/0034-store-discovery-run-files-in-user-cache.md`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md`, current user instructions
- CONTEXT.md: use glossary terms exactly: `Tool Catalog CLI`, `Discovery Skill`, `Discovery Review Pack`, `Discovery Decision File`, `Capability Tag`, `Capability Tag Vocabulary`, and `Selection Description` (`CONTEXT.md:17`, `CONTEXT.md:29`, `CONTEXT.md:33`, `CONTEXT.md:37`, `CONTEXT.md:49`, `CONTEXT.md:53`, `CONTEXT.md:57`).
- docs/adr: catalog prose, capability tags, usage notes, limitations, Markdown query output, JSON fields, and CLI arguments stay English; Chinese may be mapped by agents during consulting (`docs/adr/0011-use-english-for-catalog-prose.md:3`, `docs/adr/0011-use-english-for-catalog-prose.md:9`).
- docs/adr: consult workflow is tags-first for reusable utilities/templates, verifies source anchors before reuse, and falls back only once for no-result tag queries (`docs/adr/0022-consult-before-coding-with-progressive-verification.md:3`, `docs/adr/0022-consult-before-coding-with-progressive-verification.md:7`, `docs/adr/0022-consult-before-coding-with-progressive-verification.md:9`).
- docs/adr: dry-run produces facts-only Discovery Review Packs and reviewed Discovery Decision Files; apply consumes the decision file, not raw candidate JSON (`docs/adr/0033-use-two-phase-discovery-apply.md:3`, `docs/adr/0033-use-two-phase-discovery-apply.md:9`, `docs/adr/0033-use-two-phase-discovery-apply.md:13`).
- docs/adr: discovery run files live in user cache and stdout should report compact paths instead of dumping full candidate data (`docs/adr/0034-store-discovery-run-files-in-user-cache.md:3`, `docs/adr/0034-store-discovery-run-files-in-user-cache.md:9`).
- docs/adr: structured Capability Tags are exact filters; tags and Selection Descriptions are added only to final accepted entries (`docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:3`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:12`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:13`).
- Discussion: keep CLI contract text simple and avoid promising CLI-generated tag hints, suggested actions, semantic risk flags, or agent-quality judgments.

### Execution Started

- Date: 2026-06-09
- Dispatch profile: default Codex worker profile; selected model `gpt-5.4`; reasoning selected per issue by main agent; TDD decided by worker; concurrency cap 2.
- Dependency context: no blockers; runnable in the first dispatch layer.
- Dispatch Constraints: existing block reused without freshness inference.

### Worker Terminal Report

- Status: completed
- Changed files: `skills/tool-catalog-discover/SKILL.md`, `skills/tool-catalog-consult/SKILL.md`, `README.md`, `scripts/check-tool-catalog-skills.mjs`, `.scratch/tool-catalog-capability-tags/issues/01-codify-capability-tag-workflow-contracts.md`
- Summary: Updated discovery and consulting skill contracts for the Capability Tag workflow, documented planned `tool-catalog tags` and `query --tag` surfaces without requiring current CLI help support, and constrained static checks to documentation-level contract assertions.
- Commands run: `node --check scripts/check-tool-catalog-skills.mjs`; `node scripts/check-tool-catalog-skills.mjs`; `bash -n scripts/sync-skills.sh`; `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`; `node tools/tool-catalog-cli/tests/regression.mjs`
- Verification: all listed commands passed.
- Remaining risks: planned `tags` and `query --tag` behavior is documented but intentionally not implemented in this issue; downstream implementation issues must add CLI/schema behavior and help output.
- Review worker needed: no; changes are documentation/static-contract only and existing verification passed.

### Orchestrator Result

- Status: completed
- Result: accepted worker terminal report; no review worker dispatched because worker reported review not needed and the issue changed only documentation/static contract checks with passing verification.
- Changed files: `skills/tool-catalog-discover/SKILL.md`, `skills/tool-catalog-consult/SKILL.md`, `README.md`, `scripts/check-tool-catalog-skills.mjs`, `.scratch/tool-catalog-capability-tags/issues/01-codify-capability-tag-workflow-contracts.md`
- Verification summary: worker reported `node --check scripts/check-tool-catalog-skills.mjs`, `node scripts/check-tool-catalog-skills.mjs`, `bash -n scripts/sync-skills.sh`, `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`, and `node tools/tool-catalog-cli/tests/regression.mjs` passed.

### Superseded Contract Note

- Date: 2026-06-09
- Update: Issue 06 finalized the implemented Tool Catalog command surface. The earlier issue-01 wording that described `tool-catalog tags` and `query --tag` as planned behavior is now historical context only; current repository contracts, CLI help, and static checks treat those commands as implemented.
