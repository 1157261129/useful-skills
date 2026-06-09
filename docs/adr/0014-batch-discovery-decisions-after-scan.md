# Batch discovery decisions after scanning

The discovery skill scans first, then routes Findings through the worker DAG before presenting compact blocking decisions. User decisions are focused on unresolved utility origin priorities, unresolved Review Group conflicts, business-specific template risk, and extraction opportunities.

**Consequences**

- High-confidence accepted entries, suppressions, and deferrals do not require user confirmation after Decision Review passes.
- SQLite is updated after required user decisions are resolved.
- Catalog Finalizer workers classify Review Groups as accepted entries, suppressions, deferrals, or blocking questions. The main agent does not choose final semantic actions from raw dry-run output.
- Discovery workers finish bounded review and merge before asking the user, then batch the highest-impact blocking decisions instead of interrupting on each Finding.
