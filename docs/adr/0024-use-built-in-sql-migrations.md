# Use built-in SQL migrations

The Tool Catalog CLI manages SQLite schema changes with ordered SQL migration files and a stored schema version. Commands apply missing migrations before reading or writing the project index.

**Consequences**

- No external migration framework is required.
- Failed migrations stop the command and leave troubleshooting to the user or agent.
