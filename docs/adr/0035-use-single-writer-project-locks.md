# Use single-writer project locks

The project index allows concurrent read operations but only one discovery apply operation per project at a time. Apply commands acquire a project-level write lock and update SQLite inside transactions.

**Consequences**

- Concurrent consulting remains available during normal coding.
- Conflicting discovery writes fail fast instead of silently interleaving updates.
