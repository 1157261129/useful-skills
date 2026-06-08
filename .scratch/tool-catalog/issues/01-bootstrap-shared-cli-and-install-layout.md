Status: ready-for-agent

# Bootstrap shared Tool Catalog CLI and install layout

## What to build

Create the installable Tool Catalog skeleton: two English skills, one shared CLI directory, a stable CLI wrapper, runtime help checks, and sync-script support for installing one CLI copy per agent root while both copies use the shared `~/.tool-catalog/` data root.

## Acceptance criteria

- [x] `skills/tool-catalog-discover/SKILL.md` exists with valid frontmatter and a concise discovery workflow stub.
- [x] `skills/tool-catalog-consult/SKILL.md` exists with valid frontmatter and a concise consulting workflow stub.
- [x] `tools/tool-catalog-cli/bin/tool-catalog` and `tools/tool-catalog-cli/bin/tool-catalog.mjs` exist and can print help.
- [x] The CLI checks for required runtime dependencies and reports missing `node` or `sqlite3` clearly.
- [x] `scripts/sync-skills.sh` installs the shared CLI once per agent root, not once per skill.
- [x] `scripts/sync-skills.sh --check` verifies both skill files and shared CLI files.

## Blocked by

None - can start immediately

## Comments

### Dispatch Constraints

- Prepared: 2026-06-08
- Scope: `.scratch/tool-catalog/issues/01-bootstrap-shared-cli-and-install-layout.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0001-store-project-index-in-user-cache.md`, `docs/adr/0007-install-two-skills-with-one-shared-cli.md`, `docs/adr/0008-implement-cli-as-node-esm-without-build-step.md`, `docs/adr/0038-use-system-sqlite3-cli.md`, `write-a-skill` instructions, current user instructions.
- CONTEXT.md: use the established terms `Tool Catalog CLI`, `Discovery Skill`, and `Consulting Skill` for the two-skill plus shared CLI shape (`CONTEXT.md:17`, `CONTEXT.md:25`, `CONTEXT.md:29`).
- docs/adr: install `tool-catalog-discover`, `tool-catalog-consult`, and one CLI copy per agent root; different CLI copies must still use the same `~/.tool-catalog/` data root (`docs/adr/0007-install-two-skills-with-one-shared-cli.md:3`, `docs/adr/0007-install-two-skills-with-one-shared-cli.md:9`).
- docs/adr: implement the CLI as executable Node.js ESM without a build step, and require a usable system `sqlite3` with clear environment errors (`docs/adr/0008-implement-cli-as-node-esm-without-build-step.md:3`, `docs/adr/0038-use-system-sqlite3-cli.md:3`, `docs/adr/0038-use-system-sqlite3-cli.md:7`, `docs/adr/0038-use-system-sqlite3-cli.md:9`).
- docs/adr: the shared database/config root is agent-neutral `~/.tool-catalog/`, with `TOOL_CATALOG_HOME` as an override (`docs/adr/0001-store-project-index-in-user-cache.md:3`, `docs/adr/0001-store-project-index-in-user-cache.md:12`).
- Discussion: write both `SKILL.md` files in English and follow `write-a-skill`; descriptions must include specific triggers and remain concise (`/home/jing/.agents/skills/write-a-skill/SKILL.md:16`, `/home/jing/.agents/skills/write-a-skill/SKILL.md:60`, `/home/jing/.agents/skills/write-a-skill/SKILL.md:71`, `/home/jing/.agents/skills/write-a-skill/SKILL.md:112`).

### Execution start - 2026-06-08

- Dispatch profile: default worker dispatch profile accepted by user on 2026-06-08.
- Model: inherited current Codex worker model through the active subagent tool; the active tool schema has no explicit model field.
- Reasoning: selected by main agent per issue risk; issue 01 uses high caution because it creates the shared CLI/install foundation.
- TDD policy: worker decides whether TDD is warranted; relevant verification is required.
- Concurrency: at most 2 active implementation/review/repair workers.
- Dependency context: no upstream blocker; this issue is the first runnable issue in the requested chain `01 -> 02 -> 03 -> 04 -> 05 -> 06`.
- Dispatch Constraints: existing block reused without freshness inference.

### Worker progress - 2026-06-08

- implementation: read issue 01, `CLAUDE.md`, `CONTEXT.md`, relevant ADRs, `write-a-skill` instructions, and current `scripts/sync-skills.sh`.
- implementation: no Dispatch Constraints conflicts found; proceeding with only issue 01 bootstrap scope.

### Terminal report - 2026-06-08

- status: completed
- changed files: `.scratch/tool-catalog/issues/01-bootstrap-shared-cli-and-install-layout.md`, `scripts/sync-skills.sh`, `skills/tool-catalog-discover/SKILL.md`, `skills/tool-catalog-consult/SKILL.md`, `tools/tool-catalog-cli/bin/tool-catalog`, `tools/tool-catalog-cli/bin/tool-catalog.mjs`
- implementation: added the two English Tool Catalog skill skeletons, added the shared Node ESM CLI wrapper/source, and updated `scripts/sync-skills.sh` to sync/check one sibling `tool-catalog-cli` directory per agent root.
- commands run: context reads with `sed`, `nl`, `rg --files`, `find`, and `git status --short`; `chmod +x tools/tool-catalog-cli/bin/tool-catalog tools/tool-catalog-cli/bin/tool-catalog.mjs`; `bash -n scripts/sync-skills.sh`; `tools/tool-catalog-cli/bin/tool-catalog --help`; `node tools/tool-catalog-cli/bin/tool-catalog.mjs --help`; `tools/tool-catalog-cli/bin/tool-catalog.mjs --help`; `tools/tool-catalog-cli/bin/tool-catalog doctor`; missing-runtime simulations with restricted `PATH`; temp sync/check with `AGENTS_SKILLS_DIR=/tmp/tool-catalog-issue01-agents` and `CLAUDE_SKILLS_DIR=/tmp/tool-catalog-issue01-claude`.
- verification: CLI wrapper and `.mjs` help both exit 0; `doctor` exits 0 with local Node `24.15.0` and sqlite3 `3.45.1`; missing `node` reports `Tool Catalog CLI environment error: missing required runtime dependency 'node'`; missing `sqlite3` reports `Tool Catalog CLI environment error` with a sqlite3-specific bullet; temp `scripts/sync-skills.sh` install exits 0; temp `scripts/sync-skills.sh --check` exits 0 and verifies both skill files plus `tool-catalog-cli/bin/tool-catalog` and `tool-catalog-cli/bin/tool-catalog.mjs` for both agent roots.
- remaining risks: no dedicated automated test suite exists yet for this CLI; the bootstrap CLI intentionally exposes only help and runtime checks, leaving discovery, apply, query, show, and verify commands to later issues.
- review recommendation: review worker recommended because this is the shared install/layout foundation for downstream issues.

### Main-agent implementation result - 2026-06-08

- result: implementation completed; durable worker terminal report reviewed.
- changed files: `.scratch/tool-catalog/issues/01-bootstrap-shared-cli-and-install-layout.md`, `scripts/sync-skills.sh`, `skills/tool-catalog-discover/SKILL.md`, `skills/tool-catalog-consult/SKILL.md`, `tools/tool-catalog-cli/bin/tool-catalog`, `tools/tool-catalog-cli/bin/tool-catalog.mjs`.
- verification summary: worker reported passing shell syntax, CLI help, runtime dependency checks, and temp sync/check verification.
- review/repair decision: review worker required because the implementation worker explicitly recommended review for this shared downstream foundation.

### Review terminal report - 2026-06-08

- status: review completed
- review-duplication skill: unavailable in this environment; no `/home/jing/.agents/skills` entry matching `review-duplication`, `duplication`, `duplicate`, or `reuse` was found. Review still applied the requested duplication dimensions manually.
- findings:
  - Critical: none.
  - High: none.
  - Medium: none.
  - Low/residual risk only: `scripts/sync-skills.sh:107` and `scripts/sync-skills.sh:112` verify installed file presence and content; they do not independently verify executable mode. This is not blocking for issue 01 because sync preserves executable mode at `scripts/sync-skills.sh:97`, the CLI sources are executable, and the acceptance criterion only requires `--check` to verify skill files and shared CLI files.
- acceptance review:
  - `skills/tool-catalog-discover/SKILL.md:1` and `skills/tool-catalog-discover/SKILL.md:3` provide valid frontmatter with discovery triggers and a concise workflow stub.
  - `skills/tool-catalog-consult/SKILL.md:1` and `skills/tool-catalog-consult/SKILL.md:3` provide valid frontmatter with consulting/reuse triggers and a concise workflow stub.
  - `tools/tool-catalog-cli/bin/tool-catalog:1` and `tools/tool-catalog-cli/bin/tool-catalog.mjs:1` provide executable wrapper and Node ESM entrypoints that print help.
  - `tools/tool-catalog-cli/bin/tool-catalog:12` reports missing `node` clearly before delegation; `tools/tool-catalog-cli/bin/tool-catalog.mjs:47` and `tools/tool-catalog-cli/bin/tool-catalog.mjs:86` report missing or unusable `sqlite3` through `doctor`.
  - `scripts/sync-skills.sh:177` installs/checks one sibling `tool-catalog-cli` directory per target root, not one copy per skill.
  - `scripts/sync-skills.sh:193` runs skill sync/check and then shared CLI sync/check in `--check` mode, covering both skill files and CLI files.
- duplication/reuse review:
  - `rg` found no pre-existing Tool Catalog CLI, sqlite3 wrapper, or shared tool installer utility in the repo that this issue should have reused.
  - The implementation extends existing `scripts/sync-skills.sh` patterns (`sync_or_check_file`, `verify_target`) instead of introducing a parallel installer path.
- verification commands run:
  - `rg --files -g 'SKILL.md' /home/jing/.agents/skills | rg 'review|duplication|duplicate|reuse'` -> no matching skill found.
  - `nl -ba` on issue and changed files for line-anchored inspection.
  - `rg -n "tool-catalog-cli|Tool Catalog CLI|sqlite3|sync-skills|read_skill_name|sync_or_check_directory|backup_target" .`
  - `stat -c '%A %a %n' tools/tool-catalog-cli/bin/tool-catalog tools/tool-catalog-cli/bin/tool-catalog.mjs` -> both `755`.
  - `bash -n scripts/sync-skills.sh`
  - `tools/tool-catalog-cli/bin/tool-catalog --help`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs --help`
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs --help`
  - `tools/tool-catalog-cli/bin/tool-catalog doctor`
  - missing `node` simulation with a restricted `PATH` containing only `bash` -> clear node error, exit 127.
  - missing `sqlite3` simulation with restricted `PATH` containing `bash` and `node` -> clear sqlite3 error, exit 1.
  - temp install/check with isolated `AGENTS_SKILLS_DIR` and `CLAUDE_SKILLS_DIR` under `/tmp` -> exit 0; observed exactly one `tool-catalog-cli` directory per target root and both CLI files under each.
- repair worker needed: no.
- downstream: issue 02 can be unlocked.
- remaining risks: no dedicated automated regression test suite exists yet; issue 01 is still covered by manual/lightweight command verification only.

### Main-agent review result - 2026-06-08

- result: review completed successfully; no repair worker required.
- review findings: no Critical, High, or Medium findings; one Low residual risk about `--check` not independently verifying executable mode.
- verification summary: review worker reran syntax/help/doctor/missing-runtime/temp install checks and inspected changed files with line anchors.
- dependency decision: issue 02 is unblocked.
