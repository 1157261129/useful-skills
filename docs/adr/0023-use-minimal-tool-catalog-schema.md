# Use a minimal Tool Catalog schema

The first project index schema contains only core catalog tables: metadata, projects, utility origins, origin priorities, artifacts, artifact members, template patterns, template instances, observed external usages, ignored candidates, and full-text search entries.

**Consequences**

- Ranking history, telemetry, recommendation scores, and complex audit tables are outside the first version.
- The schema supports both utility artifacts and template code without becoming a general code intelligence database.
- Ignored candidates are stored only to avoid repeated prompts for explicitly rejected candidates.
