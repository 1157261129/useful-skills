# Use the system sqlite3 CLI

The Tool Catalog CLI uses the system `sqlite3` command for SQLite access instead of Node's built-in SQLite API or npm SQLite dependencies. This avoids Node SQLite API coupling and npm native dependency installation.

**Consequences**

- Runtime environments must provide a usable `sqlite3` executable.
- The Node CLI owns SQL generation, command execution, error handling, and transaction wrapping around `sqlite3`.
- Missing `sqlite3` is reported as an environment error; the CLI and sync checks do not auto-install it.
- The CLI invokes `sqlite3` without shell interpolation and treats paths, prose, snippets, and identifiers as data requiring controlled escaping or import.
