# Query by Capability Tag with vocabulary lookup

Status: ready-for-agent

## What to build

Add the read-only consulting path for Capability Tags. Consulting agents should be able to inspect the current tag vocabulary, map a task to canonical tags, query with strict tag filters, and receive grouped utility or template results that are still verified against source anchors before reuse.

## Acceptance criteria

- [ ] A `tags` command lists canonical tags, concise descriptions, optional aliases, and entry counts without mutating the Project Index.
- [ ] `query --tag` filters by exact canonical tag, and multiple tag filters use AND semantics.
- [ ] Query output groups matching utility members under their owning utility artifact while preserving template pattern results.
- [ ] No-result tag queries produce guidance compatible with one tag remap or one broadened no-tag query.
- [ ] Regression tests cover vocabulary output, strict tag filtering, multi-tag AND behavior, grouped query output, and read-only guarantees.

## Blocked by

- .scratch/tool-catalog-capability-tags/issues/02-apply-reviewed-capability-tag-decisions.md

## Comments

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-capability-tags/issues/03-query-by-capability-tag-with-vocabulary-lookup.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0004-rank-consulting-results-by-match-then-origin-preference.md`, `docs/adr/0011-use-english-for-catalog-prose.md`, `docs/adr/0012-use-sqlite-fts-without-embeddings.md`, `docs/adr/0022-consult-before-coding-with-progressive-verification.md`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md`, current user instructions
- CONTEXT.md: Consulting Skill queries an existing Project Index; Capability Tag Vocabulary is open controlled and synonyms normalize to canonical tags; Selection Descriptions guide entry choice (`CONTEXT.md:25`, `CONTEXT.md:53`, `CONTEXT.md:57`).
- docs/adr: consulting must inspect tag vocabulary for reusable utilities/templates, map to canonical tags, query, verify, and read source anchors before reuse (`docs/adr/0022-consult-before-coding-with-progressive-verification.md:3`, `docs/adr/0022-consult-before-coding-with-progressive-verification.md:7`).
- docs/adr: no-result tag queries may remap to a better canonical tag and broaden once without tag filters; consulting must not trigger discovery (`docs/adr/0022-consult-before-coding-with-progressive-verification.md:8`, `docs/adr/0022-consult-before-coding-with-progressive-verification.md:9`).
- docs/adr: tag vocabulary view is read-only; tag filters are exact; multiple tag filters use AND semantics; OR-like behavior is separate query merging by the consulting agent (`docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:8`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:13`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:14`).
- docs/adr: query results group matching members under their artifact while preserving best-member ranking (`docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:9`).
- docs/adr: keep lookup local and explainable through SQLite relational data plus FTS; rank by functional match before origin preference (`docs/adr/0012-use-sqlite-fts-without-embeddings.md:3`, `docs/adr/0004-rank-consulting-results-by-match-then-origin-preference.md:3`).
- docs/adr: canonical tags and Markdown query output stay English; agents may map Chinese user intent to English canonical tags (`docs/adr/0011-use-english-for-catalog-prose.md:3`, `docs/adr/0011-use-english-for-catalog-prose.md:9`).

### Execution Started

- Date: 2026-06-09
- Dispatch profile: default Codex worker profile; selected model `gpt-5.4`; reasoning selected per issue by main agent; TDD decided by worker; concurrency cap 2.
- Dependency context: blocked by issue 02; dispatch only after issue 02 completes implementation and required review/repair successfully.
- Dispatch Constraints: existing block reused without freshness inference.

### Progress

- Date: 2026-06-09
- Read issue 03, Dispatch Constraints, `CONTEXT.md`, and ADRs 0004/0011/0012/0022/0040. The required consulting behavior is consistent with the current tree.
- Located current implementation in `tools/tool-catalog-cli/bin/tool-catalog.mjs` and regression coverage in `tools/tool-catalog-cli/tests/regression.mjs`.
- Scope boundary confirmed: implement read-only `tags`, strict `query --tag` filtering, multi-tag AND semantics, grouped utility query output, and no-result guidance; do not introduce issue 05 logical-member or overload storage changes.
- Anchor drift noted: a guessed dependency filename for issue 04 was stale during context gathering; the current equivalent file is `.scratch/tool-catalog-capability-tags/issues/04-generate-facts-only-discovery-review-packs.md`.
- Execution approach: add regression assertions first, then implement the minimal CLI/data-path changes needed to satisfy them and preserve read-only behavior.

### Terminal Report

- Status: completed
- Date: 2026-06-09
- Changed files:
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `tools/tool-catalog-cli/tests/regression.mjs`
  - `.scratch/tool-catalog-capability-tags/issues/03-query-by-capability-tag-with-vocabulary-lookup.md`
- What changed:
  - Added read-only `tool-catalog tags` command support with dedicated help text, exact option parsing, canonical vocabulary metadata, alias fallback, entry counts, and Markdown/JSON rendering.
  - Added strict `query --tag` parsing and validation, exact SQLite tag filtering for artifacts, members, and template patterns, and excluded untagged external-usage results when tag filters are present.
  - Changed query output to group matching utility members under their owning artifact while preserving template and external results, retaining best-match context and compact grouped Markdown output.
  - Added no-result tag guidance that points consulting agents to one vocabulary remap via `tool-catalog tags` or one broadened retry without `--tag`.
  - Extended regression coverage for help output, tag vocabulary output, strict tag filtering, multi-tag AND behavior, grouped artifact query output, template preservation, no-result guidance, and read-only guarantees.
- Commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node --check tools/tool-catalog-cli/tests/regression.mjs`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
  - `node scripts/check-tool-catalog-skills.mjs`
  - `bash -n scripts/sync-skills.sh`
  - `git diff --check -- .scratch/tool-catalog-capability-tags/issues/03-query-by-capability-tag-with-vocabulary-lookup.md tools/tool-catalog-cli/bin/tool-catalog.mjs tools/tool-catalog-cli/tests/regression.mjs`
  - `node --input-type=module <<'EOF' ... EOF`
- Verification:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs` passed.
  - `node --check tools/tool-catalog-cli/tests/regression.mjs` passed.
  - `node scripts/check-tool-catalog-skills.mjs` passed.
  - `bash -n scripts/sync-skills.sh` passed.
  - `git diff --check -- .scratch/tool-catalog-capability-tags/issues/03-query-by-capability-tag-with-vocabulary-lookup.md tools/tool-catalog-cli/bin/tool-catalog.mjs tools/tool-catalog-cli/tests/regression.mjs` passed.
  - Targeted issue 03 end-to-end verification passed via an isolated fixture script covering `tags`, strict `query --tag`, AND semantics, grouped query output, no-result guidance, help text, and read-only catalog mtime checks.
  - Full `node tools/tool-catalog-cli/tests/regression.mjs` execution now reaches a later unrelated failure in concurrent issue 05 coverage: stale overload-signature verification for `member:com.acme.common.StringUtils#trimToEmpty` still returns `verified` after removing one overload signature. That behavior was not changed in this issue and was left to issue 05 scope.
- Remaining risks:
  - Alias data is intentionally local fallback metadata for common canonical tags; project-specific tags without stored descriptions still use a generic description fallback until discovery writes richer tag descriptions.
  - Query grouping now changes JSON shape from flat member rows to artifact groups for utility results; downstream consumers should rely on returned selectors and grouped `matching_members`.
  - Repository-wide regression remains red on the unrelated concurrent issue 05 stale-overload verification case, so shared-file follow-up review should confirm there is no hidden interaction.
- Review worker needed: yes. Reason: shared consulting/query code changed in `tools/tool-catalog-cli/bin/tool-catalog.mjs`, output shape changed for grouped query results, and the workspace currently contains concurrent issue 05 changes plus a later full-regression failure outside issue 03 scope.

### Review Report

- Status: completed
- Result: accepted
- Scope reviewed: issue 03 only, limited to read-only Capability Tag vocabulary lookup, strict `query --tag` filtering, grouped utility query results, template preservation, no-result guidance, and documentation/static-check alignment.
- Findings: none.
- Acceptance evidence:
  - Read-only `tags` consulting flow is dispatched through the consult context without apply paths in `tools/tool-catalog-cli/bin/tool-catalog.mjs:4618`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:4634`, and `tools/tool-catalog-cli/bin/tool-catalog.mjs:6302`.
  - Exact tag filtering with multi-tag AND semantics is implemented by per-entry `EXISTS` predicates in `tools/tool-catalog-cli/bin/tool-catalog.mjs:4790` and `tools/tool-catalog-cli/bin/tool-catalog.mjs:4808`, and then applied on the FTS query path in `tools/tool-catalog-cli/bin/tool-catalog.mjs:5254`.
  - Grouped utility-member results with preserved template entries are implemented in `tools/tool-catalog-cli/bin/tool-catalog.mjs:4873`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:4897`, and `tools/tool-catalog-cli/bin/tool-catalog.mjs:4920`; Markdown output retains grouped member detail in `tools/tool-catalog-cli/bin/tool-catalog.mjs:5311`.
  - No-result tag guidance is emitted exactly once on the tag-filtered empty-result path in `tools/tool-catalog-cli/bin/tool-catalog.mjs:5266`.
  - Regression coverage for vocabulary output, strict filtering, multi-tag AND behavior, grouped utility output, template preservation, no-result guidance, and read-only mtime guarantees is present in `tools/tool-catalog-cli/tests/regression.mjs:593`, `tools/tool-catalog-cli/tests/regression.mjs:611`, `tools/tool-catalog-cli/tests/regression.mjs:704`, `tools/tool-catalog-cli/tests/regression.mjs:724`, `tools/tool-catalog-cli/tests/regression.mjs:754`, and `tools/tool-catalog-cli/tests/regression.mjs:834`.
  - Consulting-skill workflow and static checks align with the tag-first read-only contract in `skills/tool-catalog-consult/SKILL.md:19`, `scripts/check-tool-catalog-skills.mjs:39`, `scripts/check-tool-catalog-skills.mjs:123`, and `README.md:48`.
- Verification run by review:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node --check tools/tool-catalog-cli/tests/regression.mjs`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
  - `node scripts/check-tool-catalog-skills.mjs`
  - `bash -n scripts/sync-skills.sh`
  - `git diff --check -- README.md skills/tool-catalog-consult/SKILL.md scripts/check-tool-catalog-skills.mjs tools/tool-catalog-cli/bin/tool-catalog.mjs tools/tool-catalog-cli/tests/regression.mjs`
- Concurrent issue 05 check: the shared full regression now passes in the current combined worktree, so the earlier stale-overload failure reported by the implementation worker is no longer reproducing and no hidden interaction with issue 03 was observed.
- Repair worker needed: no.

### Orchestrator Result

- Status: completed
- Result: accepted implementation and review terminal reports; no repair worker dispatched because review found no findings.
- Changed files: `tools/tool-catalog-cli/bin/tool-catalog.mjs`, `tools/tool-catalog-cli/tests/regression.mjs`, `skills/tool-catalog-consult/SKILL.md`, `scripts/check-tool-catalog-skills.mjs`, `README.md`, `.scratch/tool-catalog-capability-tags/issues/03-query-by-capability-tag-with-vocabulary-lookup.md`
- Verification summary: implementation and review workers reported CLI syntax checks, full regression tests, skill static checks, shell syntax checks, and diff whitespace checks passed in the combined worktree.
