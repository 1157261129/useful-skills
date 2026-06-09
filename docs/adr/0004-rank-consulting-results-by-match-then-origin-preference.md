# Rank consulting results by match, then priority

Consulting results are selected first by how well the utility class or method matches the coding goal, then ranked by configured priority. Utilities owned by the target project are preferred ahead of external utility origins, and external utilities are ordered by the configured origin priority.

**Consequences**

- A preferred utility origin does not outrank a poor functional match.
- The consulting skill may return multiple results so the agent can verify the best fit before coding.
- No separate recommendation score is maintained.
- Missing external origin priorities are resolved during discovery when possible; consulting reads existing priorities and degrades by returning multiple results with a warning.
- Module proximity may be used only as a weak tie-breaker among otherwise equivalent results.
