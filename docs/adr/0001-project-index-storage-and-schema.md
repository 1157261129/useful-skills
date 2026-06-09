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

The tool catalog keeps one project-level index for a target project and does not maintain separate visibility snapshots for each working tree. Utility classes and recurring template code are expected to change rarely, so stale or branch-specific edge cases are handled by the consulting agent when it verifies a referenced file or symbol.

Consequences:

- Re-discovery may remove entries that are absent from the scanned working tree even if they exist in another working tree.
- The consulting workflow must treat index results as navigation aids and verify the current file or symbol before using them in code.

## ADR 0012: Use SQLite FTS Without Embeddings

The first version uses SQLite relational tables and full-text search for catalog lookup, not embeddings or vector search. Agents refine queries with structured filters and goal keywords, while the CLI keeps ranking explainable and local.

Consequences:

- No model or vector index dependency is required for catalog lookup.
- Query quality depends on concise catalog prose, tags, signatures, and iterative agent refinement.

## ADR 0018: Index Artifacts and Members

The project index stores both utility artifacts and their callable members. Query results prefer the most relevant member while preserving the owning artifact, origin, language, framework, and file anchors.

Consequences:

- Agents can identify the exact method or exported function to call.
- Artifact-level context remains available for origin priority, broader inspection, and show results.
- Accepting a utility artifact does not imply indexing every callable member. Discovery agents select reusable public members and exclude deprecated, internal, compatibility-only, or business-specific methods.
- Overloaded methods are represented as one logical member with multiple signatures and source anchors, so consulting results stay capability-oriented without losing call details.
- Multiple overload signatures are stored in a dedicated `member_signatures` table rather than a JSON blob on the member row.

## ADR 0019: Index Template Patterns and Instances

Template code is indexed as reusable patterns with representative instances. Query results return the pattern summary and a small number of examples, while show results can expose the broader instance set.

Consequences:

- Template queries stay compact enough for agents to use during coding.
- Instance references preserve concrete examples without turning the catalog into a clone dump.

## ADR 0023: Use a Minimal Tool Catalog Schema

The first project index schema contains only core catalog tables: metadata, projects, utility origins, origin priorities, artifacts, artifact members, template patterns, template instances, observed external usages, suppression trace rows, and full-text search entries.

Consequences:

- Ranking history, telemetry, recommendation scores, and complex audit tables are outside the first version.
- The schema supports both utility artifacts and template code without becoming a general code intelligence database.
- Suppression trace rows are stored only to avoid repeated prompts for explicitly rejected Findings.

## ADR 0024: Use Built-In SQL Migrations

The Tool Catalog CLI manages SQLite schema changes with ordered SQL migration files and a stored schema version. Commands apply missing migrations before reading or writing the project index.

Consequences:

- No external migration framework is required.
- Failed migrations stop the command and leave troubleshooting to the user or agent.

## ADR 0025: Store Summaries and Minimal Snippets

The project index stores concise metadata, signatures, usage notes, minimal examples, and source anchors. It does not store full method bodies or large source copies.

Consequences:

- Agents use the catalog to locate reusable code, then read source anchors for full context.
- Template entries may store short representative snippets, but long examples stay in the target project source.

## ADR 0026: Store Relative Source Anchors

The project index stores source anchors as paths relative to the target project root, plus symbol identity and line hints. Query and show output resolve those anchors against the current working tree.

Consequences:

- A shared project index works across multiple working trees with different filesystem locations.
- Absolute paths may be used only as transient output or troubleshooting hints, not as canonical stored anchors.
- Line numbers are hints; verification relocates symbols by identity when possible.

## ADR 0027: Resolve Target Project Root Explicitly

The CLI resolves the target project root by preferring an explicit `--root` argument, then the Git repository root, then the current working directory. This root is used for relative source anchors and project identity detection.

Consequences:

- Agents can run commands from subdirectories without corrupting relative paths.
- Projects with unusual layout can override root detection.

## ADR 0028: Record Module Path Without Splitting Indexes

Multi-module repositories use one project index, while catalog entries record module or subproject path metadata. This preserves cross-module reuse while letting queries filter or explain where a utility artifact or template pattern lives.

Consequences:

- Backend and frontend modules can share one target project catalog.
- Module path is metadata for filtering and context, not a separate index boundary.

## ADR 0034: Store Discovery Run Files in the User Cache

Discovery Findings data, worker review artifacts, and Discovery Decision Files are stored under a user-level Tool Catalog run directory. The target project working tree is not used for transient discovery artifacts.

Consequences:

- Discovery does not pollute target project repositories.
- Agents can inspect recent run files when troubleshooting discovery results.
- Dry-run command output can stay compact by reporting run file paths instead of printing full Findings data to stdout.

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

Capability tags are stored as structured catalog data instead of being embedded only in full-text search prose. Discovery agents assign canonical tags and concise descriptions to accepted utility artifacts, artifact members, and template patterns. The CLI persists those tags and supports exact tag filtering during query, while still using full-text search to rank entries within the tagged result set.

Consequences:

- Consulting can first retrieve a stable capability-specific collection, such as date or reflection utilities, then choose the best entry by description and verified source context.
- The CLI exposes a read-only tag vocabulary view so consulting agents can inspect canonical tags, descriptions, optional aliases, and entry counts before querying.
- Query results group matching utility members under their utility artifact, while ranking still uses the best matching member. This preserves class-level navigation without losing method-level precision.
- Selection descriptions explain when to choose an entry, including fit and boundary, rather than only restating the entry's general function. Accepted entries store a required `summary` and optional `usage_notes` and `limitations`.
- Discovery agents own semantic tagging and synonym normalization; the CLI owns deterministic persistence, filtering, and verification.
- Discovery agents add tags and selection descriptions only to final accepted entries. Suppressed or deferred non-entry evidence needs only decision reasons.
- Tag filters are exact filters. Consulting agents map user language and synonyms to canonical tags, and may run a broadened text query separately when the tag is uncertain.
- Multiple tag filters use AND semantics. Consulting agents perform separate queries and merge results when they need OR-like behavior.
- Entries may carry multiple tags, but tags represent core reuse dimensions rather than every implementation detail or keyword present in the source.
- Discovery apply rejects accepted reusable utility and template entries that do not include at least one capability tag and a required summary.
- Optional usage notes and limitations may be omitted.
- The schema and query command surface become larger than a prose-only catalog, but lookup quality no longer depends on whether a tag-like word happens to appear in a summary.
- Capability tags apply at both artifact and member level; member-level tags support precise method selection, while artifact-level tags group related utilities.
- Template patterns use the same tagging model so consulting can locate reusable template code by capability or scenario before inspecting representative instances.
- Template tags describe implementation structure or reusable coding scenarios, not business domains.
