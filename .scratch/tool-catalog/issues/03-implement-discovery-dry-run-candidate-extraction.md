Status: ready-for-agent

# Implement discovery dry-run candidate extraction

## What to build

Implement conservative dry-run discovery that scans supported Java/Spring/Maven and TypeScript, JavaScript, and Vue project files, then emits structured candidate data without writing the project index.

## Acceptance criteria

- [x] `discover --full --dry-run` scans the resolved target project root and emits structured candidate output.
- [x] `discover --changed <paths...> --dry-run` scans only the provided paths.
- [x] Discovery respects `.gitignore`, default dependency/build/generated exclusions, and explicit include/exclude filters.
- [x] Java utility artifact candidates are detected conservatively from package/path, class structure, method signatures, and business-role exclusions.
- [x] TypeScript, JavaScript, and Vue utility artifact candidates are detected from common utility paths, exports, composables, and cross-file usage.
- [x] Observed external utility usages are detected only from imports or call sites already present in the target project.
- [x] Template candidates are produced only from controlled structural patterns and conservative frequency thresholds.
- [x] Dry-run output is suitable for a discovery agent to review, enrich, ignore, or apply later.

## Blocked by

- [02 Add project identity, config, SQLite migrations, and locking](./02-add-project-identity-config-sqlite-migrations-and-locking.md)

## Comments

### Dispatch Constraints

- Prepared: 2026-06-08
- Scope: `.scratch/tool-catalog/issues/03-implement-discovery-dry-run-candidate-extraction.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0005-support-java-and-typescript-vue-projects-first.md`, `docs/adr/0016-index-only-observed-external-utility-usage.md`, `docs/adr/0017-use-conservative-utility-discovery.md`, `docs/adr/0020-use-controlled-template-pattern-discovery.md`, `docs/adr/0029-exclude-dependencies-build-output-and-generated-files.md`, `docs/adr/0030-discovery-does-not-run-builds-or-tests-by-default.md`, `docs/adr/0032-discover-supports-full-changed-dry-run-and-scope-filters.md`, `docs/adr/0039-use-lightweight-structural-scanning-first.md`, current user instructions.
- CONTEXT.md: `Utility Artifact` is language-neutral and non-business; `Utility Class` is the Java subtype; `Template Code` is recurring reusable pattern code (`CONTEXT.md:13`, `CONTEXT.md:21`, `CONTEXT.md:33`).
- docs/adr: first-version discovery supports Java Spring Boot Maven, general TypeScript/JavaScript utility modules, and Vue 3 common structures; React/Python-specific detectors are out of scope (`docs/adr/0005-support-java-and-typescript-vue-projects-first.md:3`, `docs/adr/0005-support-java-and-typescript-vue-projects-first.md:10`).
- docs/adr: external utilities are indexed only from observed imports/calls already present in the target project, not by crawling full third-party APIs (`docs/adr/0016-index-only-observed-external-utility-usage.md:3`).
- docs/adr: automatically index only high-confidence project-owned utility candidates; ambiguous candidates belong in the dry-run report (`docs/adr/0017-use-conservative-utility-discovery.md:3`, `docs/adr/0017-use-conservative-utility-discovery.md:7`).
- docs/adr: do not perform general clone detection; use controlled structural fingerprints and let the discovery agent decide usefulness (`docs/adr/0020-use-controlled-template-pattern-discovery.md:3`).
- docs/adr: respect `.gitignore`, dependency/build/generated exclusions, and include/exclude overrides; discovery must not run builds or tests by default (`docs/adr/0029-exclude-dependencies-build-output-and-generated-files.md:3`, `docs/adr/0030-discovery-does-not-run-builds-or-tests-by-default.md:3`).
- docs/adr: support full, changed, dry-run, language, include, and exclude modes; use lightweight structural scanning without parser dependencies (`docs/adr/0032-discover-supports-full-changed-dry-run-and-scope-filters.md:3`, `docs/adr/0039-use-lightweight-structural-scanning-first.md:3`).

### Execution start - 2026-06-08

- Dispatch profile: default worker dispatch profile accepted by user on 2026-06-08.
- Model: inherited current Codex worker model through the active subagent tool; the active tool schema has no explicit model field.
- Reasoning: selected by main agent per issue risk; issue 03 uses high caution because discovery heuristics affect later persisted catalog data.
- TDD policy: worker decides whether TDD is warranted; relevant verification is required.
- Concurrency: at most 2 active implementation/review/repair workers.
- Dependency context: blocked until issue 02 completes successfully, including any required review/repair.
- Dispatch Constraints: existing block reused without freshness inference.

### Worker progress - 2026-06-08

- implementation worker accepted issue 03 scope.
- Checked `CONTEXT.md` and required ADR anchors from Dispatch Constraints; no missing or conflicting anchors found.
- Scope guard: implementing `discover --full --dry-run` and `discover --changed <paths...> --dry-run` candidate extraction only; no apply writes, cleanup writes, query, show, or verify commands.

### Implementation result - 2026-06-08

- completed.
- Changed files:
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `.scratch/tool-catalog/issues/03-implement-discovery-dry-run-candidate-extraction.md`
- Implemented `discover --full --dry-run` and `discover --changed <paths...> --dry-run`.
- Added language, include, and exclude filters for discovery scope.
- Added Git-backed scan base via `git ls-files --cached --others --exclude-standard`; non-Git fallback uses filesystem walk plus root `.gitignore` and default dependency/build/generated exclusions.
- Added conservative extraction for Java utility classes, TypeScript/JavaScript/Vue utility modules and composables, observed external utility imports/calls, and controlled template patterns with a threshold of 3 instances.
- Added compact Markdown output by default and structured JSON output with `--json`.
- Dry-run does not call project index initialization or SQLite mutation helpers; verification confirmed no `catalog.sqlite` was created in isolated `TOOL_CATALOG_HOME`.
- Commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --help`
  - `env TOOL_CATALOG_HOME=/tmp/tool-catalog-issue03-home-codex node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --full --dry-run --root /tmp/tool-catalog-issue03-fixture-codex --json`
  - `env TOOL_CATALOG_HOME=/tmp/tool-catalog-issue03-home-codex node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --changed src/utils/format.ts src/views/UserView.vue --dry-run --root /tmp/tool-catalog-issue03-fixture-codex --json`
  - `env TOOL_CATALOG_HOME=/tmp/tool-catalog-issue03-home-codex node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --full --dry-run --root /tmp/tool-catalog-issue03-fixture-codex --language java --json`
  - `env TOOL_CATALOG_HOME=/tmp/tool-catalog-issue03-home-codex node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --full --dry-run --root /tmp/tool-catalog-issue03-fixture-codex --include 'src/utils/**' --exclude '**/format.ts' --json`
  - `git init /tmp/tool-catalog-issue03-fixture-codex`
  - `env TOOL_CATALOG_HOME=/tmp/tool-catalog-issue03-home-codex node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --full --dry-run --root /tmp/tool-catalog-issue03-fixture-codex`
  - `env TOOL_CATALOG_HOME=/tmp/tool-catalog-issue03-home-codex node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --full --root /tmp/tool-catalog-issue03-fixture-codex` (expected exit 2 because non-dry-run discover is out of scope)
  - `env TOOL_CATALOG_HOME=/tmp/tool-catalog-issue03-home-codex node -e "...JSON assertions..."` (passed)
  - `bash -n scripts/sync-skills.sh`
  - `scripts/sync-skills.sh --check` (failed because installed `execute-issues` skill differs from the repository copy; not caused by issue 03 CLI changes)
- Remaining risks:
  - Discovery is intentionally regex/structure based, so it favors precision and can miss multiline Java signatures, uncommon export forms, or utility code outside conventional paths.
  - Non-Git `.gitignore` support is root-level and lightweight; Git projects use Git's own `--exclude-standard` behavior.
  - Template detection is limited to controlled first-version fingerprints; discovery agents should review usefulness before apply.
- Review recommendation: recommend review worker because this issue introduces the candidate schema and heuristics that issue 04 will persist.

### Main-agent implementation result - 2026-06-08

- result: implementation completed; durable worker terminal report reviewed.
- changed files: `.scratch/tool-catalog/issues/03-implement-discovery-dry-run-candidate-extraction.md`, `tools/tool-catalog-cli/bin/tool-catalog.mjs`.
- verification summary: worker reported passing syntax/help/discover help, full and changed dry-run, filters, Git `.gitignore`, Markdown/JSON output, non-dry-run rejection, JSON assertions, and no SQLite index creation in isolated `TOOL_CATALOG_HOME`.
- verification limitation: `scripts/sync-skills.sh --check` failed because the installed `execute-issues` skill differs from the repository copy; this is recorded as external to issue 03 CLI changes.
- review/repair decision: review worker required because the implementation worker explicitly recommended review for candidate schema and heuristic behavior.

### Review result - 2026-06-08

- review completed.
- Scope: reviewed `.scratch/tool-catalog/issues/03-implement-discovery-dry-run-candidate-extraction.md` and `tools/tool-catalog-cli/bin/tool-catalog.mjs` only; no implementation files were modified.
- `review-duplication` skill status: unavailable in the current skill directory. Manual review still covered duplicated functionality, reinvented utilities, missed shared helpers, and deviation from established project patterns.
- Findings:
  - None blocking.
  - None requiring repair.
- Acceptance review:
  - `discover --full --dry-run` and `discover --changed <paths...> --dry-run` are implemented by the discover option parser and handler (`tools/tool-catalog-cli/bin/tool-catalog.mjs:345`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:2044`).
  - Discovery scope respects Git `.gitignore` through `git ls-files --exclude-standard` for Git projects and uses default dependency/build/generated exclusions plus include/exclude filters before scanning (`tools/tool-catalog-cli/bin/tool-catalog.mjs:1064`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1149`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1173`).
  - Java utility candidates use package/path/name/static-method/business-role checks (`tools/tool-catalog-cli/bin/tool-catalog.mjs:1296`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1309`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1333`).
  - TypeScript, JavaScript, and Vue utility candidates use export, utility/composable path, and cross-file import evidence (`tools/tool-catalog-cli/bin/tool-catalog.mjs:1399`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1523`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1548`).
  - Observed external usages are derived from imports/call sites already present in scanned project files (`tools/tool-catalog-cli/bin/tool-catalog.mjs:1635`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1669`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1734`).
  - Template candidates use controlled patterns and the threshold constant of 3 instances (`tools/tool-catalog-cli/bin/tool-catalog.mjs:75`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1748`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1838`).
  - Output is structured JSON when requested and compact Markdown otherwise, with `index_mutated: false` and a later-apply decision schema (`tools/tool-catalog-cli/bin/tool-catalog.mjs:1868`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1927`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:1986`).
  - Dry-run does not initialize or mutate SQLite project index data. `handleDiscoverCommand` reads config, creates context, builds dry-run output, and prints it; SQLite/migration writes remain on config paths only (`tools/tool-catalog-cli/bin/tool-catalog.mjs:2009`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:2019`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:2044`).
  - No issue 04 apply/cleanup or issue 05 query/show/verify command handlers were found.
- Duplication/reuse review:
  - No existing shared discovery utility was found in this repository; the standalone CLI keeps lightweight path, glob, scan, and extraction helpers local to `tool-catalog.mjs`, matching the current issue 01/02 single-file CLI pattern.
  - No duplicated apply/query/show/verify implementation was introduced.
  - No missed reuse of SQLite/project-lock helpers was found for dry-run; avoiding those helpers is correct because this issue must not write the project index.
- Verification commands:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs` passed.
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --help` passed.
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --full --root /tmp` exited 2 with the expected dry-run-only error.
  - A `/tmp` Git fixture verified full dry-run JSON, changed-path scoping, include/exclude filtering, Git `.gitignore`, Java utility extraction, TypeScript utility extraction, Vue composable extraction, Java and Vue external usage extraction, template threshold output, and no `catalog.sqlite` under isolated `TOOL_CATALOG_HOME`.
  - `scripts/sync-skills.sh --check` still fails because the installed `execute-issues` skill differs from the repository copy. This is unrelated to issue 03 changes; the reviewed issue 03 implementation did not modify `scripts/sync-skills.sh`.
- Remaining risks:
  - Non-Git `.gitignore` support is intentionally lightweight and root-file based (`tools/tool-catalog-cli/bin/tool-catalog.mjs:1017`).
  - Java method extraction is line-based and can miss multiline signatures (`tools/tool-catalog-cli/bin/tool-catalog.mjs:1309`).
  - JavaScript/TypeScript utility extraction is conservative and may miss cross-file-used utilities outside conventional utility/composable paths (`tools/tool-catalog-cli/bin/tool-catalog.mjs:1571`).
- Repair worker: not needed.
- Downstream: issue 04 can be unlocked.

### Main-agent review result - 2026-06-08

- result: review completed successfully; no repair worker required.
- review findings: no blocking findings and no repair findings.
- verification summary: review worker reran syntax/help/non-dry-run rejection and independent dry-run fixture checks for filters, `.gitignore`, Java/TS/Vue candidates, external usage, template threshold, and no SQLite index creation.
- verification limitation: `scripts/sync-skills.sh --check` failure remains attributed to an installed `execute-issues` skill mismatch unrelated to issue 03 changes.
- dependency decision: issue 04 is unblocked.
