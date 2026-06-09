# Store project indexes in the user cache

Project indexes are stored under the agent-neutral user cache root `~/.tool-catalog/`, keyed by target project identity, not inside any single working tree. This lets branch-specific working trees for the same target project share one SQLite index while keeping the target project repository free of generated catalog data.

**Consequences**

- A target project may provide optional configuration for project identity, but the SQLite database is not part of the target project's source tree by default.
- Environments without stable project identity detection fall back to a path-specific cache and should report that the index is not shared across paths.
- Project identity resolution prefers an explicit `project_id`, then Git worktree common dir, then normalized remote URL, then project root path.
- Explicit project identity mappings are stored in user-level Tool Catalog configuration, not in the target project repository by default.
- User-level configuration uses JSON, while each project index uses SQLite.
- `TOOL_CATALOG_HOME` may override the default `~/.tool-catalog/` root for tests or special environments.
