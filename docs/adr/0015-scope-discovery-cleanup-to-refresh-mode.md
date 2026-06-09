# Scope discovery cleanup to refresh mode

Discovery cleanup is scoped by refresh mode. A full discovery may remove or downgrade entries that no longer exist or no longer qualify in the supported project scope, while a changed-path discovery only refreshes and cleans entries tied to the provided paths.

**Consequences**

- Incremental rediscovery after subagent work cannot accidentally prune unrelated catalog entries.
- Users can run full discovery when they want the current working tree to become the source of truth for the catalog.
