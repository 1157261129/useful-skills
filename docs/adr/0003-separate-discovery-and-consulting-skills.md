# Separate discovery and consulting skills

The tool catalog uses two skills with different responsibilities: the discovery skill updates the project index, while the consulting skill reads the existing index during coding workflows. This keeps expensive or mutating discovery work out of ordinary implementation flow and lets agents treat consulting results as focused reuse guidance.

**Consequences**

- The consulting skill does not perform full-project discovery by default.
- Shared CLI commands may support both workflows, but the skill contracts remain separate.
- The consulting skill is strictly read-only in the first version; stale entries are repaired through discovery.
