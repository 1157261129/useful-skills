# Represent logical members and overload signatures

Status: ready-for-agent

## What to build

Represent overloaded utility methods as logical catalog members with multiple signatures and source anchors. Consulting results should stay capability-oriented while preserving enough call detail for agents to choose and verify the correct overload before coding.

## Acceptance criteria

- [ ] A migration adds structured storage for member signatures and their source anchors.
- [ ] Discovery apply can persist multiple overload signatures for one logical member.
- [ ] Query and show output display logical members without duplicating noisy overload rows, while still exposing relevant signatures.
- [ ] Verify checks the source anchors associated with logical members and their stored signatures.
- [ ] Regression tests cover overloaded utility methods, compact display, and stale-anchor verification.

## Blocked by

- .scratch/tool-catalog-capability-tags/issues/02-apply-reviewed-capability-tag-decisions.md

## Comments

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-capability-tags/issues/05-represent-logical-members-and-overload-signatures.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0011-use-english-for-catalog-prose.md`, `docs/adr/0018-index-artifacts-and-members.md`, `docs/adr/0033-use-two-phase-discovery-apply.md`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md`, current user instructions
- CONTEXT.md: Utility Artifacts expose multiple utility capabilities; Capability Tags may exist at artifact/member level; Selection Descriptions explain fit and boundaries (`CONTEXT.md:21`, `CONTEXT.md:49`, `CONTEXT.md:57`).
- docs/adr: Project Index stores artifacts and callable members; results prefer relevant members while preserving owning artifact context (`docs/adr/0018-index-artifacts-and-members.md:3`, `docs/adr/0018-index-artifacts-and-members.md:7`, `docs/adr/0018-index-artifacts-and-members.md:8`).
- docs/adr: accepting an artifact does not index every member; discovery agents select reusable public members and exclude deprecated, internal, compatibility-only, or business-specific methods (`docs/adr/0018-index-artifacts-and-members.md:9`).
- docs/adr: overloaded methods are one logical member with multiple signatures and source anchors, stored in `member_signatures` rather than a JSON blob (`docs/adr/0018-index-artifacts-and-members.md:10`, `docs/adr/0018-index-artifacts-and-members.md:11`).
- docs/adr: query results group matching utility members under their artifact and use member-level tags for precise selection (`docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:9`, `docs/adr/0040-store-capability-tags-as-structured-catalog-data.md:18`).
- docs/adr: reviewed Discovery Decision Files store accepted entries in final catalog shape; preserve English catalog prose and identifiers (`docs/adr/0033-use-two-phase-discovery-apply.md:13`, `docs/adr/0011-use-english-for-catalog-prose.md:3`).
- Discussion: keep consulting output capability-oriented; do not duplicate overload rows as separate noisy members.

### Execution Started

- Date: 2026-06-09
- Dispatch profile: default Codex worker profile; selected model `gpt-5.4`; reasoning selected per issue by main agent; TDD decided by worker; concurrency cap 2.
- Dependency context: blocked by issue 02; dispatch only after issue 02 completes implementation and required review/repair successfully.
- Dispatch Constraints: existing block reused without freshness inference.

### Progress 2026-06-09

- Read issue constraints, `CLAUDE.md`, ADR `0018` and `0040`, and current CLI/test implementation.
- Current equivalent anchors are in `tools/tool-catalog-cli/bin/tool-catalog.mjs` around schema/apply (`3380+`), query/show load (`4591+`, `4917+`, `5038+`), and verify (`5385+`). The issue text's ADR anchors remain valid; code anchors have drifted from any older references but equivalent sections were found.
- Implementation plan fixed: add a dedicated `member_signatures` migration, aggregate duplicate overload candidates into one logical member during apply, and expose grouped signatures in query/show/verify without changing selector or tag semantics.

### Terminal Report 2026-06-09

- Status: completed
- Outcome: added `member_signatures` schema storage, grouped overloads into one logical member during discovery apply, surfaced grouped signatures in query/show, and tightened verify so each stored overload signature is checked independently.
- Anchor drift: no ADR drift. Code anchors cited in dispatch constraints were stale by line number only; current equivalents were found in `tools/tool-catalog-cli/bin/tool-catalog.mjs` for apply/counts/query/show/verify and updated by implementation.
- Changed files:
  - `tools/tool-catalog-cli/migrations/004-add-member-signatures.sql`
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `tools/tool-catalog-cli/tests/regression.mjs`
  - `.scratch/tool-catalog-capability-tags/issues/05-represent-logical-members-and-overload-signatures.md`
- Commands run:
  - `sed -n '1,260p' .scratch/tool-catalog-capability-tags/issues/05-represent-logical-members-and-overload-signatures.md`
  - `sed -n '1,220p' /home/jing/.agents/skills/execute-issues/SKILL.md`
  - `sed -n '1,260p' CLAUDE.md`
  - `sed -n '1,220p' docs/adr/0018-index-artifacts-and-members.md`
  - `sed -n '1,220p' docs/adr/0040-store-capability-tags-as-structured-catalog-data.md`
  - `rg -n "member_signatures|source_anchor|signature|overload|verify|catalog" .`
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node --check tools/tool-catalog-cli/tests/regression.mjs`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
- Verification summary:
  - `node --check` passed for CLI and regression test files.
  - `node tools/tool-catalog-cli/tests/regression.mjs` passed, including overload persistence, grouped query/show output, and stale overload-signature verification.
- Remaining risks:
  - Read-only consult commands now require schema version `4`; upgrade coverage is exercised through `discover --apply`, but there is no separate fixture for an existing long-lived v3 catalog upgraded outside the regression flow.
  - Signature-level verify now uses exact stored signature text for overload checks; unusual formatting changes that preserve behavior but rewrite the declaration line could report stale until discovery refreshes the index.
- Review worker needed: yes
- Review reason: this issue changes persisted schema plus consult/verify behavior; an independent review should validate backward compatibility for upgraded catalogs and confirm no regression in grouped query semantics introduced by issue 03.

### Review Report 2026-06-09

- Status: completed
- Result: accepted issue 05 implementation; no repair worker needed.
- Scope reviewed:
  - logical members with grouped overload signatures
  - migration v4 compatibility
  - apply/show/query/verify behavior for `member_signatures`
  - regression coverage for overload display and stale-anchor verification
- Evidence:
  - Migration `004-add-member-signatures.sql` creates and backfills `member_signatures`, then bumps schema to v4: `tools/tool-catalog-cli/migrations/004-add-member-signatures.sql:5`
  - Apply path normalizes grouped signatures and aggregates duplicate logical members by `member_key`: `tools/tool-catalog-cli/bin/tool-catalog.mjs:2974`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:3067`
  - Apply persistence resets and rewrites per-member signature rows: `tools/tool-catalog-cli/bin/tool-catalog.mjs:3572`
  - Query grouping keeps overloaded members under one artifact group and exposes grouped signatures on the matched member: `tools/tool-catalog-cli/bin/tool-catalog.mjs:4897`
  - Show/load paths read `member_signatures` and expose `signature_count` plus signature anchors for artifact/member views: `tools/tool-catalog-cli/bin/tool-catalog.mjs:5543`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:5593`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:5635`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:5669`
  - Verify checks each stored overload signature independently with exact signature needles: `tools/tool-catalog-cli/bin/tool-catalog.mjs:5908`
  - Consult/read-only schema gate is consistent with the v4 contract and discovery apply migration path: `tools/tool-catalog-cli/bin/tool-catalog.mjs:4507`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:4547`
  - Regression coverage exercises grouped query/show output, read-only consulting, stale overload verification, and persisted signature rows: `tools/tool-catalog-cli/tests/regression.mjs:656`, `tools/tool-catalog-cli/tests/regression.mjs:784`, `tools/tool-catalog-cli/tests/regression.mjs:821`, `tools/tool-catalog-cli/tests/regression.mjs:865`, `tools/tool-catalog-cli/tests/regression.mjs:873`
- Verification run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node --check tools/tool-catalog-cli/tests/regression.mjs`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
  - Result: passed (`Tool Catalog CLI fixture regression passed.`)
- Query compatibility with concurrent issue 03:
  - No conflict observed in shared query/grouping behavior in the current worktree; grouped overload query coverage and tag-filter regression both passed.
- Risks:
  - Existing catalogs below schema v4 remain intentionally unreadable to consult commands until `discover --apply` migrates them; this is consistent with current code but still worth preserving in follow-up integration review.
- Repair worker needed: no.

### Orchestrator Result

- Status: completed
- Result: accepted implementation and review outputs; no repair worker dispatched because review found no findings.
- Changed files: `tools/tool-catalog-cli/migrations/004-add-member-signatures.sql`, `tools/tool-catalog-cli/bin/tool-catalog.mjs`, `tools/tool-catalog-cli/tests/regression.mjs`, `.scratch/tool-catalog-capability-tags/issues/05-represent-logical-members-and-overload-signatures.md`
- Verification summary: implementation and review workers reported CLI syntax checks and full regression tests passed for the combined worktree.
