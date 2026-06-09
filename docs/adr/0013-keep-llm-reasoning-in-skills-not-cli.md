# Keep LLM reasoning in skills, not the CLI

The Tool Catalog CLI performs deterministic scanning, storage, querying, and verification. Semantic classification, false-positive filtering, English catalog prose, and user-facing priority questions are handled by the agent running the discovery or consulting skill.

**Consequences**

- The CLI has no model key, model provider, or LLM retry dependency.
- Skills pass structured accepted entries back to the CLI for persistence.
