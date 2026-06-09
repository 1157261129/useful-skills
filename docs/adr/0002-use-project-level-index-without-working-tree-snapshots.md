# Use a project-level index without working tree snapshots

The tool catalog keeps one project-level index for a target project and does not maintain separate visibility snapshots for each working tree. Utility classes and recurring template code are expected to change rarely, so stale or branch-specific edge cases are handled by the consulting agent when it verifies a referenced file or symbol.

**Consequences**

- Re-discovery may remove entries that are absent from the scanned working tree even if they exist in another working tree.
- The consulting workflow must treat index results as navigation aids and verify the current file or symbol before using them in code.
