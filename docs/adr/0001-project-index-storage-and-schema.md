# Project Index, Storage, and Schema Decisions

This file consolidates the storage and index-model ADRs that previously lived as ADR 0001, 0002, 0012, 0018, 0019, 0023, 0024, 0025, 0026, 0027, 0028, 0034, 0035, 0038, and 0040.

## ADR 0001: Store Project Indexes in the User Cache

Project indexes are stored under the agent-neutral user cache root `~/.tool-catalog/`, keyed by target project identity, not inside any single working tree. This lets branch-specific working trees for the same target project share one SQLite index while keeping the target project repository free of generated catalog data.

Consequences:

- A target project may provide optional configuration for project identity, but the SQLite database is not part of the target project's source tree by default.
- Environments without stable project identity detection fall back to a path-specific cache and should report that the index is not shared across paths.
- Project identity resolution prefers an explicit `project_id`, then Git worktree common dir, then normalized remote URL, then project root path.
- Explicit project identity mappings are stored in user-level Tool Catalog configuration, not in the target project repository by default.
- User-level configuration uses JSON, while each project index uses SQLite.
- `TOOL_CATALOG_HOME` may override the default `~/.tool-catalog/` root for tests or special environments.

## ADR 0002: Use a Project-Level Index Without Working Tree Snapshots

The tool catalog keeps one project-level index for a target project and does not maintain separate visibility snapshots for each working tree. Utility artifacts are expected to change rarely, so stale or branch-specific edge cases are handled by the consulting agent when it verifies referenced project-owned source anchors or independently checks external selectors.

Consequences:

- Re-discovery may remove entries that are absent from the scanned working tree even if they exist in another working tree.
- The consulting workflow must treat index results as navigation aids, verify project-owned source anchors before using them in code, and check external selector availability through project dependencies and local conventions.

## ADR 0012: Use Deterministic Local Text Lookup Without Embeddings

The first version uses SQLite relational tables and deterministic text matching over persisted catalog prose for lookup, not embeddings, vector search, or query-time LLM scoring. Agents refine queries with structured tags and description text, while the CLI keeps ranking explainable and local.

Consequences:

- No model or vector index dependency is required for catalog lookup.
- Query quality depends on concise catalog prose, tags, stable class or module identifiers, and iterative agent refinement.

## ADR 0018: Index Utility Artifacts Only

The project index stores reusable utilities only at the utility class or module layer. It does not store callable members, method signatures, overloads, or function-level selectors.

Consequences:

- Agents receive the utility class or module identity and inspect source or dependency APIs themselves to choose the exact method or function.
- Project-owned priorities live with artifacts; external utility priorities live with utility origins.
- Agent-facing selectors use the stable class or module identity directly: `artifact:<fully-qualified-class-or-relative-module>` and `external:<fully-qualified-class-or-module>`.
- Java project artifacts use class FQCNs, such as `artifact:com.example.util.DateUtils`; TypeScript, JavaScript, and Vue project artifacts use target-project-relative module paths without file extensions, such as `artifact:src/utils/date`.
- Package aliases, barrel exports, hash keys, and file basenames are not selector sources. If one file exports multiple utility functions, the file module remains the catalog artifact and the agent inspects source to choose the export.
- Hash keys, `usage_key` values, row IDs, and other internal database identifiers must not be exposed as selectors.
- Discovery agents may inspect methods and exported functions as evidence, but final catalog entries remain class or module level.
- Method-level selectors such as `member:` and supporting tables such as `artifact_members` or `member_signatures` are outside the model and should be removed from the implementation.

## ADR 0019: Remove Template Pattern Support

Template patterns are removed from the Tool Catalog domain. Discovery workers do not create template entries, consulting does not return them, and the implementation should remove template-pattern tables, selectors, query/show/verify paths, and tests.

Consequences:

- Discovery stays focused on project-owned utility artifacts, external utility selectors, and external origin priority data.
- Consult results stay faster and more predictable because they do not mix reusable utilities with recurring code examples.
- Existing cached indexes that contain template-pattern data are not preserved as a compatibility target.

## ADR 0023: Use a Minimal Tool Catalog Schema

The first project index schema contains only core catalog tables: metadata, projects, utility origins with external Artifact Priority and usage-count metadata, artifacts with project-owned Artifact Priority metadata, external utility class or module selectors, suppression trace rows, discovery fingerprints for entries and suppressions, and capability tag associations. Utility origins identify external libraries or modules for priority and usage-count aggregation; external selectors identify the returned utility class or module. Suppressions are stored only at the same class, module, or normalized external origin layer. Internal keys may exist for persistence, but query and show expose only catalog selectors based on class or module full names.

Consequences:

- Ranking history, telemetry, query-time recommendation scores, and complex audit tables are outside the first version.
- The default schema supports utility artifacts, external utility selectors, and origin-level usage counts without becoming a general code intelligence database.
- External origin `usage_count` is a discovery-produced count of distinct target project source files that use that normalized origin. Multiple imports or calls in the same file count once, and raw import or call evidence is not persisted.
- External origin priority is deterministic: higher `usage_count` receives a lower numeric priority value, and equal counts are ordered by `origin_key` lexicographically. Manual external priority override metadata is outside the schema.
- Suppression trace rows are stored only to avoid repeated prompts for explicitly rejected Findings at the utility artifact, external selector, or normalized external origin layer. They are discovery-only state and are not exposed by tag vocabulary, query, show, verify, or consulting ranking.
- Suppressions and discovery fingerprints target only `artifact`, `external_selector`, or `origin`. They must not target methods, callable exports, repeated-code examples, raw external usage rows, source anchors, findings, imports, calls, or raw evidence rows.
- External utility origins and external selectors are separate: one origin can rank multiple class or module selectors from the same library.

## ADR 0024: Use Built-In SQL Migrations

The Tool Catalog CLI manages SQLite schema changes with ordered SQL migration files and a stored schema version. Commands apply missing migrations before reading or writing the project index.

Consequences:

- No external migration framework is required.
- Failed migrations stop the command and leave troubleshooting to the user or agent.

## ADR 0025: Store Summaries and Minimal Snippets

The project index stores concise metadata, stable class or module identifiers, usage notes, minimal examples, and project-owned utility source anchors. It does not store full method bodies, method signatures, external usage anchors, or large source copies.

Consequences:

- Agents use the catalog to locate project-owned reusable code, then read source anchors for full context.

## ADR 0026: Store Relative Source Anchors

The project index stores source anchors only for project-owned utility artifacts, as paths relative to the target project root plus symbol identity and line hints. Query and show output resolve those anchors against the current working tree. External utility class or module selectors do not store source anchors. Stored source anchors use the minimal object shape `{ path, symbol, line }`; `path` is target-project relative, `symbol` is the utility class fully qualified name or relative module path corresponding to the catalog selector, and `line` is an optional hint.

Consequences:

- A shared project index works across multiple working trees with different filesystem locations.
- Absolute paths may be used only as transient output or troubleshooting hints, not as canonical stored anchors.
- Line numbers are hints; verification relocates symbols by identity when possible.
- Source anchors do not store snippets, methods, callable exports, import text, call text, or call anchors.

## ADR 0027: Resolve Target Project Root Explicitly

The CLI resolves the target project root by preferring an explicit `--root` argument, then the Git repository root, then the current working directory. This root is used for relative source anchors and project identity detection.

Consequences:

- Agents can run commands from subdirectories without corrupting relative paths.
- Projects with unusual layout can override root detection.

## ADR 0028: Record Module Path Without Splitting Indexes

Multi-module repositories use one project index, while catalog entries record module or subproject path metadata. This preserves cross-module reuse while letting queries filter or explain where a utility artifact lives.

Consequences:

- Backend and frontend modules can share one target project catalog.
- Module path is metadata for filtering and context, not a separate index boundary.

## ADR 0034: Store Discovery Run Files in the User Cache

Discovery Findings data, worker review artifacts, and Discovery Decision Files are stored under a user-level Tool Catalog run directory. The target project working tree is not used for transient discovery artifacts.

Consequences:

- Discovery does not pollute target project repositories.
- Agents can inspect recent run files when troubleshooting discovery results.
- Discovery reports can stay compact by reporting run file paths instead of printing full source evidence data to stdout.

## ADR 0035: Use Single-Writer Project Locks

The project index allows concurrent read operations but only one discovery apply operation per project at a time. Apply commands acquire a project-level write lock and update SQLite inside transactions.

Consequences:

- Concurrent consulting remains available during normal coding.
- Conflicting discovery writes fail fast instead of silently interleaving updates.

## ADR 0038: Use the System sqlite3 CLI

The Tool Catalog CLI uses the system `sqlite3` command for SQLite access instead of Node's built-in SQLite API or npm SQLite dependencies. This avoids Node SQLite API coupling and npm native dependency installation.

Consequences:

- Runtime environments must provide a usable `sqlite3` executable.
- The Node CLI owns SQL generation, command execution, error handling, and transaction wrapping around `sqlite3`.
- Missing `sqlite3` is reported as an environment error; the CLI and sync checks do not auto-install it.
- The CLI invokes `sqlite3` without shell interpolation and treats paths, prose, snippets, and identifiers as data requiring controlled escaping or import.

## ADR 0040: Store Capability Tags as Structured Catalog Data

Capability tags are stored as structured catalog data instead of being embedded only in prose. Discovery agents assign canonical tags and concise descriptions to accepted project-owned utility artifacts and external utility class or module selectors. The CLI persists those tags and supports exact tag filtering during query, while deterministic description text matching narrows entries within the tagged result set.

Consequences:

- Consulting can first retrieve a stable capability-specific collection, such as date or reflection utilities, then choose the best entry by description and verified source context.
- The CLI exposes a read-only tag vocabulary view derived from accepted entry tags. It returns canonical tags and project/external entry counts, but does not store tag descriptions, aliases, or a separate vocabulary table.
- Query results return only utility artifacts or external utility class or module selectors, while ranking uses persisted Artifact Priority with lower numeric values first.
- Selection descriptions explain when to choose an entry, including fit and boundary, rather than only restating the entry's general function. Accepted entries store a required English `summary` and optional English `usage_notes` and `limitations`; `summary` is the primary selection description used by description-text lookup.
- Discovery agents own semantic tagging and synonym normalization; the CLI owns deterministic persistence, filtering, and verification.
- Capability tags are non-empty canonical string arrays. Tag values are lowercase tokens or lowercase kebab-case strings, and duplicate tags are removed before persistence.
- Discovery agents add tags and selection descriptions only to final accepted utility artifacts and external utility class or module selectors. Suppressions need persisted decision reasons and fingerprints, but they do not carry capability tags, `summary`, `usage_notes`, `limitations`, or selection descriptions. Run-local deferrals stay in discovery artifacts and are not persisted.
- Tag filters are exact filters. Consulting agents map user language and synonyms to canonical tags, and may run a broadened text query separately when the tag is uncertain.
- Multiple tag filters use AND semantics. Consulting agents perform separate queries and merge results when they need OR-like behavior.
- Entries may carry multiple tags, but tags represent core reuse dimensions rather than every implementation detail or keyword present in the source.
- Accepted entries store stable context metadata only when it helps deterministic filtering. `language` is required on project-owned utility artifacts and external utility class or module selectors. `artifact_type` is required only on project-owned utility artifacts. `framework` is optional on both entry kinds, and `module_path` is optional only on project-owned utility artifacts.
- Discovery apply rejects accepted reusable utility artifacts and external utility class or module selectors that do not include at least one valid capability tag and a required summary.
- Optional `usage_notes` and `limitations` may be omitted. When present, they are persisted and may participate in deterministic description-text lookup.
- The schema and query command surface become larger than a prose-only catalog, but lookup quality no longer depends on whether a tag-like word happens to appear in a summary.
- Capability tags apply at project-owned utility artifact and external utility class or module selector level only.
