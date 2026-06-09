# Keep the initial CLI command surface minimal

The first Tool Catalog CLI exposes five commands: `discover`, `query`, `show`, `verify`, and `config`. Discovery owns index updates, query and show support consulting, verify checks indexed references, and config stores project identity and utility origin priorities.

**Consequences**

- Pruning is part of discovery rather than a separate first-version command.
- Export, import, daemon, and watch modes are outside the first version.
