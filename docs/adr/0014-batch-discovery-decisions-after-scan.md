# Batch discovery decisions after scanning

The discovery skill scans first, then presents a compact decision report instead of interrupting the user for each ambiguous candidate. User decisions are focused on unresolved utility origin priorities, ambiguous duplicates, and extraction candidates.

**Consequences**

- High-confidence accepted and rejected candidates do not require user confirmation.
- SQLite is updated after required user decisions are resolved.
- Discovery agents classify candidates as automatic accept, automatic ignore, or ask user. User confirmation is reserved for ambiguous utility boundaries, conflicting utility origins, business-specific template risk, and extraction opportunities.
- Discovery agents finish reviewing the full Discovery Review Pack before asking the user, then batch the highest-impact ambiguous decisions instead of interrupting on each candidate.
