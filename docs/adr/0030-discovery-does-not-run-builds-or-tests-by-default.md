# Discovery does not run builds or tests by default

Discovery scans files, extracts structural candidates, counts references, verifies symbol presence, and updates SQLite. It does not run project builds or test suites by default.

**Consequences**

- Catalog refresh remains lightweight.
- Code-changing workflows, such as utility extraction, are responsible for their own verification.
