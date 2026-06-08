Status: ready-for-agent

# Add project identity, config, SQLite migrations, and locking

## What to build

Implement the shared project-index foundation so multiple working trees for one target project resolve to the same catalog while using user-level configuration, SQLite migrations, safe system `sqlite3` execution, and a single-writer apply lock.

## Acceptance criteria

- [x] `TOOL_CATALOG_HOME` overrides the default `~/.tool-catalog/` data root.
- [x] `config project-id <id>` stores explicit project identity mappings in user-level JSON configuration.
- [x] Project identity resolution prefers explicit `project_id`, then Git worktree common dir, then normalized remote URL, then project root path.
- [x] Project indexes are stored under `projects/<project-id>/catalog.sqlite`.
- [x] SQLite schema migrations run through system `sqlite3` without shell interpolation.
- [x] The initial schema includes metadata, projects, utility origins, origin priorities, artifacts, artifact members, template patterns, template instances, observed external usages, ignored candidates, and FTS entries.
- [x] Discovery apply operations use a project-level single-writer lock and SQLite transactions.

## Blocked by

- [01 Bootstrap shared Tool Catalog CLI and install layout](./01-bootstrap-shared-cli-and-install-layout.md)

## Comments

### Dispatch Constraints

- Prepared: 2026-06-08
- Scope: `.scratch/tool-catalog/issues/02-add-project-identity-config-sqlite-migrations-and-locking.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0001-store-project-index-in-user-cache.md`, `docs/adr/0023-use-minimal-tool-catalog-schema.md`, `docs/adr/0024-use-built-in-sql-migrations.md`, `docs/adr/0027-resolve-target-project-root-explicitly.md`, `docs/adr/0035-use-single-writer-project-locks.md`, `docs/adr/0038-use-system-sqlite3-cli.md`, current user instructions.
- CONTEXT.md: preserve the distinction between `Project Index`, `Target Project`, and `Working Tree`; multiple working trees for one target project share one project index (`CONTEXT.md:3`, `CONTEXT.md:7`, `CONTEXT.md:41`).
- docs/adr: store indexes under `~/.tool-catalog/`, prefer explicit `project_id`, then Git worktree common dir, normalized remote URL, and project root path; use JSON for user config and SQLite for each project index (`docs/adr/0001-store-project-index-in-user-cache.md:3`, `docs/adr/0001-store-project-index-in-user-cache.md:9`, `docs/adr/0001-store-project-index-in-user-cache.md:11`).
- docs/adr: initial schema must stay minimal and include ignored candidates and FTS entries, not telemetry or recommendation-score tables (`docs/adr/0023-use-minimal-tool-catalog-schema.md:3`, `docs/adr/0023-use-minimal-tool-catalog-schema.md:7`, `docs/adr/0023-use-minimal-tool-catalog-schema.md:9`).
- docs/adr: use ordered built-in SQL migrations with stored schema version; commands apply missing migrations before index access (`docs/adr/0024-use-built-in-sql-migrations.md:3`).
- docs/adr: resolve root by `--root`, then Git root, then cwd; root drives anchors and identity detection (`docs/adr/0027-resolve-target-project-root-explicitly.md:3`).
- docs/adr: allow concurrent reads but only one discovery apply writer per project; use transactions and fail fast on conflicting writes (`docs/adr/0035-use-single-writer-project-locks.md:3`, `docs/adr/0035-use-single-writer-project-locks.md:8`).
- docs/adr: invoke system `sqlite3` without shell interpolation and treat paths/prose/snippets/identifiers as data requiring controlled escaping or import (`docs/adr/0038-use-system-sqlite3-cli.md:3`, `docs/adr/0038-use-system-sqlite3-cli.md:10`).

### Execution start - 2026-06-08

- Dispatch profile: default worker dispatch profile accepted by user on 2026-06-08.
- Model: inherited current Codex worker model through the active subagent tool; the active tool schema has no explicit model field.
- Reasoning: selected by main agent per issue risk; issue 02 uses high caution because it defines persisted identity, migrations, SQLite execution, and locking.
- TDD policy: worker decides whether TDD is warranted; relevant verification is required.
- Concurrency: at most 2 active implementation/review/repair workers.
- Dependency context: blocked until issue 01 completes successfully, including any required review/repair.
- Dispatch Constraints: existing block reused without freshness inference.

### Implementation progress - 2026-06-08

- worker: issue 02 implementation worker started after issue 01 implementation and review completed successfully.
- context check: read issue 02, `CLAUDE.md`, `CONTEXT.md`, and the directly cited ADRs for user cache identity, minimal schema, migrations, root resolution, project locks, and system `sqlite3`.
- constraint status: Dispatch Constraints anchors are present and consistent with the issue scope; no conflicts found.
- implementation plan: add only the shared index foundation in the existing Node ESM CLI: `TOOL_CATALOG_HOME`, `config project-id <id>`, project identity resolution, project DB path creation, built-in SQLite migrations, and reusable single-writer apply transaction helpers.

### Implementation terminal report - 2026-06-08

- status: completed
- changed files: `.scratch/tool-catalog/issues/02-add-project-identity-config-sqlite-migrations-and-locking.md`, `tools/tool-catalog-cli/bin/tool-catalog.mjs`, `tools/tool-catalog-cli/migrations/001-initial-schema.sql`
- implementation:
  - added `TOOL_CATALOG_HOME` resolution with default `~/.tool-catalog/`, user-level `config.json`, `config project-id <id>`, and `config info`.
  - added target root resolution by `--root`, then Git root, then cwd; project identity selection now checks explicit JSON mappings first, then Git common dir, normalized remote URL, and project root path.
  - stores project indexes at `projects/<project-id>/catalog.sqlite` and initializes them before index access.
  - added ordered built-in SQL migration loading from `tools/tool-catalog-cli/migrations/`, using system `sqlite3` through `spawnSync` argument arrays and stdin SQL.
  - added initial schema for `metadata`, `projects`, `utility_origins`, `origin_priorities`, `artifacts`, `artifact_members`, `template_patterns`, `template_instances`, `observed_external_usages`, `ignored_candidates`, and FTS5 `fts_entries`.
  - added exported project apply lock and transaction helpers: atomic `apply.lock` acquisition, fail-fast conflict behavior, and `BEGIN IMMEDIATE` SQLite transaction wrapping.
- commands run:
  - context/static reads: `pwd`; `git status --short`; `rg --files ...`; `rg -n ...`; `nl -ba` on issue 02, `CLAUDE.md`, `CONTEXT.md`, relevant ADRs, CLI files, and migration SQL.
  - syntax/runtime: `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`; `tools/tool-catalog-cli/bin/tool-catalog --help`; `tools/tool-catalog-cli/bin/tool-catalog.mjs --help`; `tools/tool-catalog-cli/bin/tool-catalog doctor`; `tools/tool-catalog-cli/bin/tool-catalog config --help`.
  - config/index verification with isolated temp roots: `env TOOL_CATALOG_HOME=/tmp/tool-catalog-issue02-home.xiOyqX tools/tool-catalog-cli/bin/tool-catalog config project-id issue02-project --root /tmp/tool-catalog-issue02-root.BGHSuj --json`; sequential `config info --json`; `nl -ba /tmp/tool-catalog-issue02-home.xiOyqX/config.json`; `sqlite3 ... .tables`; `sqlite3 -json ... "SELECT key, value FROM metadata ORDER BY key;"`.
  - identity verification: `git init /tmp/tool-catalog-issue02-gitroot.9K8b6k`; `git -C /tmp/tool-catalog-issue02-gitroot.9K8b6k remote add origin git@github.com:Example/Tool-Catalog.git`; `config info --json` confirmed `git-common-dir`; `config project-id git-explicit --json`; config JSON confirmed `git-common-dir`, `remote-url`, and `project-root` explicit mappings.
  - locking/transactions: imported `acquireProjectApplyLock`, `createProjectContext`, `readUserConfig`, `runProjectApplyTransaction`, and `sqlString` via `node --input-type=module --eval`; verified a held lock rejects a second apply transaction, then verified a released lock allows a transaction insert into `ignored_candidates`; queried the inserted row and verified `apply.lock` was removed.
  - install regression: `bash -n scripts/sync-skills.sh`; temp-root `scripts/sync-skills.sh`; temp-root `scripts/sync-skills.sh --check`; both verified `tool-catalog-cli/migrations/001-initial-schema.sql` is installed beside the CLI for both agent roots.
  - error paths: invalid project id exits 2 with a clear validation message; direct `.mjs doctor` with a PATH containing `node` but no `sqlite3` exits 1 with a clear sqlite3 dependency message.
- verification result: passed. The created test catalog path was `/tmp/tool-catalog-issue02-home.xiOyqX/projects/issue02-project/catalog.sqlite`, proving the environment override and `projects/<project-id>/catalog.sqlite` layout.
- remaining risks:
  - no dedicated automated regression suite exists yet; coverage is command-level/manual and should be consolidated by issue 06.
  - the project apply lock is intentionally fail-fast and file-based; if a process is killed after lock creation and before cleanup, a stale `apply.lock` may require manual removal in a later recovery workflow.
  - `config project-id` uses atomic JSON replace but not a separate user-config write lock; concurrent first-time config writes could race. This is outside issue 02 acceptance, which only requires project-level apply locking.
- review recommendation: review worker recommended because this issue defines persistent layout, schema, and future apply-lock helpers used by downstream issues.

### Main-agent implementation result - 2026-06-08

- result: implementation completed; durable worker terminal report reviewed.
- changed files: `.scratch/tool-catalog/issues/02-add-project-identity-config-sqlite-migrations-and-locking.md`, `tools/tool-catalog-cli/bin/tool-catalog.mjs`, `tools/tool-catalog-cli/migrations/001-initial-schema.sql`.
- verification summary: worker reported passing syntax/runtime checks, isolated config/index checks, identity resolution checks, lock/transaction checks, sync/check regression, and key error paths.
- review/repair decision: review worker required because the implementation worker explicitly recommended review for persistent layout, schema, and lock helpers.

### Review terminal report - 2026-06-08

- status: review completed
- review scope: issue 02 acceptance criteria, Dispatch Constraints, implementation terminal report, `tools/tool-catalog-cli/bin/tool-catalog.mjs`, and `tools/tool-catalog-cli/migrations/001-initial-schema.sql`.
- review-duplication limitation: no `review-duplication` skill was available in the current skill list or under `/home/jing/.agents/skills`; review still covered duplicate functionality, reinvented utility risk, missed shared helper risk, and divergence from existing project patterns manually.
- findings: none blocking and none requiring repair.
- acceptance review:
  - `TOOL_CATALOG_HOME` override and default `~/.tool-catalog/` behavior are implemented in `tools/tool-catalog-cli/bin/tool-catalog.mjs:201`.
  - `config project-id <id>` stores user-level JSON mappings and gives explicit mappings precedence in `tools/tool-catalog-cli/bin/tool-catalog.mjs:379` and `tools/tool-catalog-cli/bin/tool-catalog.mjs:686`.
  - identity signal order is explicit mapping, Git common dir, normalized remote URL, then root path via `tools/tool-catalog-cli/bin/tool-catalog.mjs:345` and `tools/tool-catalog-cli/bin/tool-catalog.mjs:395`.
  - project index path is `projects/<project-id>/catalog.sqlite` with per-project `apply.lock` in `tools/tool-catalog-cli/bin/tool-catalog.mjs:439`.
  - SQLite execution uses system `sqlite3` through `spawnSync` argument arrays and stdin SQL, with no shell interpolation, in `tools/tool-catalog-cli/bin/tool-catalog.mjs:486`.
  - migrations are loaded from built-in SQL files and applied before current index access paths in `tools/tool-catalog-cli/bin/tool-catalog.mjs:559` and `tools/tool-catalog-cli/bin/tool-catalog.mjs:598`.
  - initial schema contains the required metadata, project, utility origin, priority, artifact, member, template, usage, ignored candidate, and FTS tables in `tools/tool-catalog-cli/migrations/001-initial-schema.sql:5` through `tools/tool-catalog-cli/migrations/001-initial-schema.sql:139`.
  - apply locking and transactional write helpers fail fast on an existing project lock and wrap writes in `BEGIN IMMEDIATE`/`COMMIT` in `tools/tool-catalog-cli/bin/tool-catalog.mjs:603` and `tools/tool-catalog-cli/bin/tool-catalog.mjs:647`.
  - issue 03+ functionality is not prematurely implemented; `discover`, query, show, verify, and apply workflows remain unsupported commands.
- duplication/pattern review:
  - no duplicated project identity/config/SQLite helper implementation was found outside the shared CLI.
  - existing helper boundaries are reusable for downstream CLI commands; future apply code can call the existing in-module `ensureProjectIndex` and `runProjectApplyTransaction` instead of reimplementing migrations or transaction wrapping.
  - implementation follows the issue 01 layout with one shared CLI and sibling migration directory.
- verification commands:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `tools/tool-catalog-cli/bin/tool-catalog --help`
  - `tools/tool-catalog-cli/bin/tool-catalog doctor`
  - isolated Node review script using `/tmp` `TOOL_CATALOG_HOME` and target root verified config info, explicit project id, JSON config mappings, schema tables, `projects/<project-id>/catalog.sqlite`, successful apply transaction, fail-fast lock conflict, rollback of failed transaction, lock cleanup, and unsupported `discover --full --dry-run`.
  - isolated Git-root Node review script verified default `git-common-dir` precedence and explicit mapping persistence for `git-common-dir`, normalized `remote-url`, and `project-root` signals.
- repair worker needed: no.
- downstream status: issue 03 can unlock.
- remaining risks:
  - no dedicated automated regression suite exists yet; issue 06 should consolidate these command-level checks.
  - the fail-fast file lock can be left stale if the process is killed after acquisition and before cleanup; no recovery workflow is implemented in issue 02.
  - user-level `config.json` writes are atomic replace operations but do not use a separate config write lock, so concurrent explicit configuration writes can still race.

### Main-agent review result - 2026-06-08

- result: review completed successfully; no repair worker required.
- review findings: no blocking findings and no repair findings.
- verification summary: review worker reran CLI syntax/help/doctor plus isolated home/root identity, schema, lock conflict, transaction rollback, and unsupported discovery checks.
- dependency decision: issue 03 is unblocked.
