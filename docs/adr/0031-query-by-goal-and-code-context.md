# Query by goal and code context

Catalog queries use a goal description plus optional current file, language, framework, artifact type, and result limit. The current file helps infer module and framework context, while the goal drives functional matching.

**Consequences**

- Query input stays compact enough for agents to generate reliably.
- Agents can progressively refine results by adding filters.
