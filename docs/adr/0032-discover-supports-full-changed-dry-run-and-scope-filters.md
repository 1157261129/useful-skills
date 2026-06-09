# Discover supports full, changed, dry-run, and scope filters

The discover command supports full refresh, changed-path refresh, dry-run reporting, language filters, and include or exclude scope overrides. These modes keep full cleanup, incremental rediscovery, and review-only scans explicit.

**Consequences**

- Agents can inspect Findings and worker review artifacts before writing index changes.
- Incremental refresh after implementation can target only changed paths.
