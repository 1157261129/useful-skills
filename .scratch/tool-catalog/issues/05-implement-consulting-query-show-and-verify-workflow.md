Status: ready-for-agent

# Implement consulting query, show, and verify workflow

## What to build

Implement the read-only consulting commands that help agents find reusable project utilities and template patterns by goal, code context, and source verification before coding.

## Acceptance criteria

- [x] `query --goal <text>` searches SQLite FTS and structured metadata.
- [x] `query` accepts current-file, language, framework, artifact type, and limit filters.
- [x] Results rank by functional match first, then project-owned origin, then configured external origin priority, with module proximity only as a weak tie-breaker.
- [x] `show` displays compact details for a selected artifact, member, template pattern, or external usage.
- [x] `verify` checks relative source anchors against the current working tree using symbol identity and line hints.
- [x] Default output is compact English Markdown with exact identifiers, minimal examples, and source anchors.
- [x] JSON output is available for automation.
- [x] Consulting commands are read-only and report stale or missing entries without modifying the index.

## Blocked by

- [04 Implement discovery apply, cleanup, and summary reporting](./04-implement-discovery-apply-cleanup-and-summary-reporting.md)

## Comments

### Dispatch Constraints

- Prepared: 2026-06-08
- Scope: `.scratch/tool-catalog/issues/05-implement-consulting-query-show-and-verify-workflow.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0002-use-project-level-index-without-working-tree-snapshots.md`, `docs/adr/0003-separate-discovery-and-consulting-skills.md`, `docs/adr/0004-rank-consulting-results-by-match-then-origin-preference.md`, `docs/adr/0010-return-compact-markdown-with-json-option.md`, `docs/adr/0011-use-english-for-catalog-prose.md`, `docs/adr/0012-use-sqlite-fts-without-embeddings.md`, `docs/adr/0022-consult-before-coding-with-progressive-verification.md`, `docs/adr/0026-store-relative-source-anchors.md`, `docs/adr/0031-query-by-goal-and-code-context.md`, current user instructions.
- CONTEXT.md: the `Consulting Skill` queries an existing project index while coding; do not redefine it as a discovery or mutation workflow (`CONTEXT.md:25`, `CONTEXT.md:27`).
- docs/adr: project-level indexes do not track per-working-tree snapshots, so consulting must verify referenced files or symbols before use (`docs/adr/0002-use-project-level-index-without-working-tree-snapshots.md:3`, `docs/adr/0002-use-project-level-index-without-working-tree-snapshots.md:8`).
- docs/adr: consulting is strictly read-only in the first version; stale entries are repaired through discovery, not `query/show/verify` writes (`docs/adr/0003-separate-discovery-and-consulting-skills.md:3`, `docs/adr/0003-separate-discovery-and-consulting-skills.md:9`).
- docs/adr: rank by functional match first, then configured priority; project-owned utilities precede external origins when match is comparable, and module proximity is only a weak tie-breaker (`docs/adr/0004-rank-consulting-results-by-match-then-origin-preference.md:3`, `docs/adr/0004-rank-consulting-results-by-match-then-origin-preference.md:11`).
- docs/adr: default output is compact English Markdown with JSON available; catalog prose and output notes are concise professional English (`docs/adr/0010-return-compact-markdown-with-json-option.md:3`, `docs/adr/0011-use-english-for-catalog-prose.md:3`).
- docs/adr: use SQLite FTS without embeddings; agents refine queries using structured filters and goal keywords (`docs/adr/0012-use-sqlite-fts-without-embeddings.md:3`).
- docs/adr: consulting workflow is query, inspect/show/verify, read source anchors, then code; no-result queries may be broadened once and then reported as no reusable entry found (`docs/adr/0022-consult-before-coding-with-progressive-verification.md:3`, `docs/adr/0022-consult-before-coding-with-progressive-verification.md:9`).
- docs/adr: source anchors resolve relative paths against the current working tree and use symbol identity plus line hints (`docs/adr/0026-store-relative-source-anchors.md:3`).
- docs/adr: `query` uses a goal plus optional current file, language, framework, artifact type, and limit (`docs/adr/0031-query-by-goal-and-code-context.md:3`).

### Execution start - 2026-06-08

- Dispatch profile: default worker dispatch profile accepted by user on 2026-06-08.
- Model: inherited current Codex worker model through the active subagent tool; the active tool schema has no explicit model field.
- Reasoning: selected by main agent per issue risk; issue 05 uses high caution because it must query, display, and verify persisted catalog data without mutating it.
- TDD policy: worker decides whether TDD is warranted; relevant verification is required.
- Concurrency: at most 2 active implementation/review/repair workers.
- Dependency context: blocked until issue 04 completes successfully, including any required review/repair.
- Dispatch Constraints: existing block reused without freshness inference.

### Worker progress - 2026-06-08

- Read issue 05, `CLAUDE.md`, `CONTEXT.md`, and required ADR anchors.
- Dispatch Constraints are usable: anchors exist and align with the current issue/code reality.
- Implementation scope remains limited to read-only consulting commands in `tools/tool-catalog-cli/bin/tool-catalog.mjs`; discovery apply semantics will not be changed.

### Implementation result - 2026-06-08

- Status: completed.
- Changed files:
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `.scratch/tool-catalog/issues/05-implement-consulting-query-show-and-verify-workflow.md`
- Implemented read-only consulting commands:
  - `query --goal <text>` with SQLite FTS plus structured external-usage lookup.
  - Filters for `--current-file`, `--language`, `--framework`, `--artifact-type`, and `--limit`.
  - Ranking order: functional match, project-owned origin, external origin priority, then weak module proximity.
  - `show <selector>` for artifacts, members, template patterns, and external usages.
  - `verify <selector>` using relative source anchors, line hints, symbol identity, and stored snippets.
  - Compact English Markdown defaults and `--json` automation output.
- Verification commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs query --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs show --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs verify --help`
  - isolated missing-index `query/show/verify --json`; confirmed no catalog file was created
  - isolated populated fixture: `discover --apply`, `query`, Markdown query, `show` artifact/member, `verify` artifact/template/external usage, missing selector, stale missing-file verification, and DB size/mtime unchanged after consulting commands
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs doctor`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --full --dry-run --root /home/jing/workspace/liujp-skills --language javascript --json`
  - `bash -n scripts/sync-skills.sh`
  - `git diff --check`
- Known unrelated verification failure:
  - `scripts/sync-skills.sh --check` still fails because the installed `execute-issues/SKILL.md` differs from the repository copy; this is the same pre-existing sync mismatch reported by earlier issues and is not caused by issue 05.
- Remaining risks:
  - Ranking is explainable local scoring over FTS/metadata, not semantic embedding search.
  - Verification is intentionally conservative; unusual symbols or generated files may require source inspection even when an anchor is reported stale.
- Review recommendation: review worker recommended because this issue adds the primary read-only consulting workflow and selector/verification behavior.

### Main-agent implementation result - 2026-06-08

- result: implementation completed; durable worker terminal report reviewed.
- changed files: `.scratch/tool-catalog/issues/05-implement-consulting-query-show-and-verify-workflow.md`, `tools/tool-catalog-cli/bin/tool-catalog.mjs`.
- verification summary: worker reported passing syntax/help, missing-index read-only checks, populated fixture query/show/verify/filter/ranking/stale/missing/JSON checks, DB mtime unchanged after consulting commands, doctor, dry-run, shell syntax, and diff whitespace checks.
- verification limitation: `scripts/sync-skills.sh --check` still fails because installed `execute-issues/SKILL.md` differs from the repository copy; unrelated to issue 05 changes.
- review/repair decision: review worker required because the implementation worker explicitly recommended review for consulting workflow, selector handling, and verification behavior.

### Review result - 2026-06-08

- Status: review failed.
- Scope reviewed: issue 05 acceptance criteria, Dispatch Constraints, implementation report, `tools/tool-catalog-cli/bin/tool-catalog.mjs`, and temporary SQLite fixtures under `/tmp/tool-catalog-review05`.
- `review-duplication` skill status: unavailable in the local skills list; reviewed manually for duplicated functionality, reimplemented utilities, missed shared helpers, and deviation from existing project patterns.
- Finding:
  - Medium: `verify` can falsely mark an observed external usage as verified after the actual indexed call is removed. In `tools/tool-catalog-cli/bin/tool-catalog.mjs:4532`, `symbolNeedles` mixes `importText`, `callText`, snippet, and broad symbol/name hints into one candidate list. In `tools/tool-catalog-cli/bin/tool-catalog.mjs:4571`, `findNeedleLine` accepts any one needle, and `verifySourceAnchor` treats a nearby match as `ok: true` at `tools/tool-catalog-cli/bin/tool-catalog.mjs:4617`. Reproduction: after applying an index with `call_text = preferredFetch(request)` at `src/features/orders/order-service.ts:6`, delete only the `preferredFetch(request)` call while leaving `import { preferredFetch } from 'preferred-lib';`; `verify external:external:preferredFetch --json` still exits 0 with `ok: true`, `status: verified`, and `actual_line: 2`. This violates the stale-entry reporting requirement for consulting verification because the indexed observed usage no longer exists.
- Positive checks:
  - `query --goal` reads FTS rows and structured external usage rows using read-only SQLite calls.
  - language/framework/artifact-type/limit filters worked in fixture output.
  - ranking placed higher functional matches first, project-owned utilities before external usages at comparable relevance, and external priority `90` before `10` when functional score matched.
  - `show` loaded artifact, member, template pattern, and external usage selectors with compact English Markdown and JSON.
  - missing project indexes returned read-only JSON warnings without creating `TOOL_CATALOG_HOME`, config, or SQLite files.
  - missing source files were reported as `stale-or-missing` without modifying the DB.
  - SQLite mtime remained unchanged across consulting commands in the fixture.
- Verification commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs query --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs show --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs verify --help`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-review05-missing node tools/tool-catalog-cli/bin/tool-catalog.mjs query --goal request --root /tmp/tool-catalog-review05 --json`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-review05-missing node tools/tool-catalog-cli/bin/tool-catalog.mjs show artifact:src/utils/request.ts --root /tmp/tool-catalog-review05 --json`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-review05-home node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --apply /tmp/tool-catalog-review05/decisions.json --root /tmp/tool-catalog-review05 --json`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-review05-home node tools/tool-catalog-cli/bin/tool-catalog.mjs query --goal request --root /tmp/tool-catalog-review05 --current-file src/features/orders/order-service.ts --json`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-review05-home node tools/tool-catalog-cli/bin/tool-catalog.mjs query --goal request --root /tmp/tool-catalog-review05 --language typescript --framework node --artifact-type external_usage --limit 2 --json`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-review05-home node tools/tool-catalog-cli/bin/tool-catalog.mjs show artifact:src/utils/request.ts --root /tmp/tool-catalog-review05 --json`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-review05-home node tools/tool-catalog-cli/bin/tool-catalog.mjs show 'member:src/utils/request.ts#buildRequest' --root /tmp/tool-catalog-review05 --json`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-review05-home node tools/tool-catalog-cli/bin/tool-catalog.mjs show template:template:order-view --root /tmp/tool-catalog-review05 --json`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-review05-home node tools/tool-catalog-cli/bin/tool-catalog.mjs show external:external:preferredFetch --root /tmp/tool-catalog-review05 --json`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-review05-home node tools/tool-catalog-cli/bin/tool-catalog.mjs verify artifact:src/utils/request.ts --root /tmp/tool-catalog-review05 --json`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-review05-home node tools/tool-catalog-cli/bin/tool-catalog.mjs verify 'member:src/utils/request.ts#buildRequest' --root /tmp/tool-catalog-review05 --json`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-review05-home node tools/tool-catalog-cli/bin/tool-catalog.mjs verify template:template:order-view --root /tmp/tool-catalog-review05 --json`
  - `TOOL_CATALOG_HOME=/tmp/tool-catalog-review05-home node tools/tool-catalog-cli/bin/tool-catalog.mjs verify external:external:preferredFetch --root /tmp/tool-catalog-review05 --json`
  - stale-call reproduction after deleting only `preferredFetch(request)` from the `/tmp` fixture.
  - missing-file verification after deleting `/tmp/tool-catalog-review05/src/utils/request.ts`.
  - `stat -c %Y /tmp/tool-catalog-review05-home/projects/path-tool-catalog-review05-e8f93bcc504d/catalog.sqlite`
  - `scripts/sync-skills.sh --check`
- Known unrelated verification failure:
  - `scripts/sync-skills.sh --check` still fails because installed `/home/jing/.agents/skills/execute-issues/SKILL.md` differs from the repository copy; this predates issue 05 behavior and does not involve the tool catalog CLI.
- Repair scope:
  - Tighten external usage verification so the stored `call_text` or exact usage snippet must be present at/near the source anchor, instead of allowing an import-only or origin-name match to verify the usage.
  - Preserve existing artifact/member/template verification behavior unless tests show the same false-positive class applies there.
  - Add a regression fixture for "external import remains, indexed call removed" expecting `verify` to return nonzero with `stale-or-missing` or `stale-symbol`.
- Repair worker needed: yes.
- Downstream: issue 06 should remain blocked until repair and re-review pass.
- Remaining risks: ranking remains deterministic FTS/metadata scoring rather than semantic search; selector keys that already include prefixes can render as doubled-prefixed selectors, but the selector still resolves and this is not blocking.

### Main-agent review result - 2026-06-08

- result: review failed with one fixable Medium finding; repair worker required.
- blocking findings: external usage `verify` can return verified when the indexed call was removed but an import remains.
- verification summary: review worker reproduced the stale-call false positive and confirmed query/filter/ranking/show/read-only/missing-file behavior mostly works.
- verification limitation: `scripts/sync-skills.sh --check` still fails because installed `execute-issues/SKILL.md` differs from the repository copy; unrelated to issue 05 changes.
- dependency decision: issue 06 remains blocked until repair and re-review complete.

### Repair progress - 2026-06-08

- Scope accepted: fix observed external usage verification so an import-only or broad origin/name match cannot verify an indexed usage after the stored call is removed.
- Constraints read: Dispatch Constraints, review report, main-agent review result, and `verifySourceAnchor`/`verificationAnchors` code.
- Planned edit: keep artifact/member/template verification behavior unchanged and pass stricter verification hints only for `external_usage`.

### Repair result - 2026-06-08

- Status: completed.
- Changed files:
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `.scratch/tool-catalog/issues/05-implement-consulting-query-show-and-verify-workflow.md`
- Repair summary:
  - Added strict literal verification needles for source-anchor checks.
  - `external_usage` verification now requires stored `call_text` or the call-derived exact snippet; it no longer passes broad origin/name/import text as verification evidence.
  - Artifact, member, and template verification continue to use the existing symbol/snippet behavior.
- Verification commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs query --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs show --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs verify --help`
  - `node /tmp/tool-catalog-issue05-repair-test.mjs`
  - `bash -n scripts/sync-skills.sh`
  - `git diff --check`
- Verification covered:
  - external usage call present verifies successfully.
  - external usage call removed while import remains exits nonzero with `stale-or-missing` / `stale-symbol`.
  - missing source exits nonzero with stale status.
  - artifact, member, and template verification still pass.
  - `query`, `show`, and `verify` remain read-only; SQLite mtime stayed unchanged across consulting commands.
- Remaining risks:
  - Observed external usages without stored `call_text` now fail verification instead of being import-verified; this is intentionally conservative and aligns with the review finding.
  - The regression fixture is a temporary `/tmp` script, not a committed test suite.
- Review recommendation: another review worker is recommended before unblocking issue 06.

### Main-agent repair result - 2026-06-08

- result: repair completed; durable repair terminal report reviewed.
- changed files: `.scratch/tool-catalog/issues/05-implement-consulting-query-show-and-verify-workflow.md`, `tools/tool-catalog-cli/bin/tool-catalog.mjs`.
- verification summary: repair worker reported passing syntax/help, external usage present/removed verification, stale/missing source handling, artifact/member/template verification, read-only consulting, DB mtime stability, shell syntax, and diff checks.
- review/repair decision: another review worker required because the repair tightened verification semantics and needs re-review before downstream issue 06 can unlock.
- dependency decision: issue 06 remains blocked until re-review completes successfully.

### Second review result - 2026-06-08

- Status: second review completed.
- Scope reviewed: issue 05 acceptance criteria, prior review finding, repair report, `tools/tool-catalog-cli/bin/tool-catalog.mjs`, and an independent `/tmp` fixture at `/tmp/tool-catalog-review05-second-*`.
- `review-duplication` skill status: unavailable in the local skills list and no local `review-duplication` skill path was found. Reviewed manually for duplicated functionality, reimplemented utilities, missed shared helpers, and deviation from existing project patterns.
- Findings: none.
- Repair verification:
  - Confirmed `external_usage` verification now passes strict exact usage hints through `verificationAnchors` at `tools/tool-catalog-cli/bin/tool-catalog.mjs:4708`.
  - Confirmed `verifySourceAnchor` switches to exact literal needles when `requireExactNeedle` is set and returns `stale-symbol` when stored usage text is missing at `tools/tool-catalog-cli/bin/tool-catalog.mjs:4620` and `tools/tool-catalog-cli/bin/tool-catalog.mjs:4655`.
  - Confirmed artifact/member/template verification still uses the existing symbol/snippet hint path at `tools/tool-catalog-cli/bin/tool-catalog.mjs:4665`.
  - Independent fixture result: `verify external:preferredFetch --json` exits 0 while `preferredFetch(request)` is present; after deleting only the call and leaving `import { preferredFetch } from 'preferred-lib';`, the same command exits 1 with top-level status `stale-or-missing` and check status `stale-symbol`.
- Acceptance spot-checks:
  - `query --goal` returned SQLite FTS results plus structured external usage rows, with filters for current file, language, framework, artifact type, limit, and JSON output.
  - Ranking matched the required order in the fixture: functional score first, project-owned artifact ahead of comparable external usage, then higher external origin priority ahead of lower priority; implementation anchor reviewed at `tools/tool-catalog-cli/bin/tool-catalog.mjs:4070`.
  - `show` resolved artifact, member, template, and external selectors with JSON output.
  - `verify` passed for artifact, member, template, and external usage while sources were current; missing source files reported stale/missing without modifying the index.
  - Consulting commands use read-only SQLite through `runSqliteReadOnlyJson` at `tools/tool-catalog-cli/bin/tool-catalog.mjs:1033`; handlers use consult state rather than migration/apply paths at `tools/tool-catalog-cli/bin/tool-catalog.mjs:5022`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:5036`, and `tools/tool-catalog-cli/bin/tool-catalog.mjs:5050`.
  - Missing-index `query --json` returned nonzero with `missing-index` and did not create `TOOL_CATALOG_HOME`.
  - SQLite DB mtime stayed unchanged across `query`, `show`, `verify`, stale verification, and missing-file verification.
- Verification commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs query --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs show --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs verify --help`
  - `node /tmp/tool-catalog-issue05-second-review.mjs`
  - `bash -n scripts/sync-skills.sh`
  - `git diff --check`
  - `scripts/sync-skills.sh --check`
- Known unrelated verification failure:
  - `scripts/sync-skills.sh --check` still fails because installed `/home/jing/.agents/skills/execute-issues/SKILL.md` differs from the repository copy; this is the same unrelated sync mismatch reported by earlier issues and does not involve issue 05 CLI behavior.
- Repair worker needed: no.
- Downstream: issue 06 can unlock.
- Remaining risks:
  - No committed automated regression suite covers this fixture yet; the passing regression is a temporary `/tmp` script.
  - External usages without stored `call_text` now verify conservatively as stale instead of using import-only evidence; this matches the repair intent but may require clearer skill instructions in issue 06.
  - Ranking remains deterministic FTS/metadata scoring, not semantic embedding search.

### Main-agent second review result - 2026-06-08

- result: second review completed successfully; no further repair worker required.
- review findings: no blocking findings and no repair findings.
- verification summary: second review worker validated the external usage false-positive repair, artifact/member/template verification, query filters/ranking, show selectors, read-only behavior, DB mtime stability, and missing-index/missing-file reporting.
- verification limitation: `scripts/sync-skills.sh --check` still fails because installed `execute-issues/SKILL.md` differs from the repository copy; unrelated to issue 05 CLI behavior.
- dependency decision: issue 06 is unblocked.
