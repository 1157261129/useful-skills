# Use SQLite FTS without embeddings

The first version uses SQLite relational tables and full-text search for catalog lookup, not embeddings or vector search. Agents refine queries with structured filters and goal keywords, while the CLI keeps ranking explainable and local.

**Consequences**

- No model or vector index dependency is required for catalog lookup.
- Query quality depends on concise catalog prose, tags, signatures, and iterative agent refinement.
