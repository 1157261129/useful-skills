# Install two skills with one shared CLI

The tool catalog is distributed as `tool-catalog-discover`, `tool-catalog-consult`, and one shared CLI directory. The sync script installs both skills and one CLI copy per agent root so each agent surface can run the tool without duplicating command code inside each skill.

**Consequences**

- The sync script must install shared tools in addition to skill directories.
- Skill instructions reference the shared CLI rather than embedding separate CLI copies.
- CLI copies installed for different agent roots read and write the same `~/.tool-catalog/` database root.
