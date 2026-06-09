# Store discovery run files in the user cache

Discovery Findings data, worker review artifacts, and Discovery Decision Files are stored under a user-level Tool Catalog run directory. The target project working tree is not used for transient discovery artifacts.

**Consequences**

- Discovery does not pollute target project repositories.
- Agents can inspect recent run files when troubleshooting discovery results.
- Dry-run command output can stay compact by reporting run file paths instead of printing full Findings data to stdout.
