# Use a minimal Tool Catalog schema

The first project index schema contains only core catalog tables: metadata, projects, utility origins, origin priorities, artifacts, artifact members, template patterns, template instances, observed external usages, suppression trace rows, and full-text search entries.

**Consequences**

- Ranking history, telemetry, recommendation scores, and complex audit tables are outside the first version.
- The schema supports both utility artifacts and template code without becoming a general code intelligence database.
- Suppression trace rows are stored only to avoid repeated prompts for explicitly rejected Findings.
