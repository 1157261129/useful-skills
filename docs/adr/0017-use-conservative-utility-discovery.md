# Use conservative utility discovery

Discovery automatically indexes only high-confidence project-owned utility artifacts. Ambiguous candidates are reported for review instead of being written to the project index.

**Consequences**

- Utility discovery favors precision over recall.
- Language-specific detectors use structural evidence such as package or path, exported methods, framework annotations, business dependencies, and cross-file usage.
- Explicit utility naming and shared utility package paths are default inclusion signals. Business-package helper methods are not indexed by default unless the discovery agent accepts them as non-business reusable utilities.
