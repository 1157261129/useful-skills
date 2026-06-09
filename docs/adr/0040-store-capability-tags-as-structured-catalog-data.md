# Store capability tags as structured catalog data

Capability tags are stored as structured catalog data instead of being embedded only in full-text search prose. Discovery agents assign canonical tags and concise descriptions to accepted utility artifacts, artifact members, and template patterns. The CLI persists those tags and supports exact tag filtering during query, while still using full-text search to rank entries within the tagged candidate set.

**Consequences**

- Consulting can first retrieve a stable capability-specific collection, such as date or reflection utilities, then choose the best entry by description and verified source context.
- The CLI exposes a read-only tag vocabulary view so consulting agents can inspect canonical tags, descriptions, optional aliases, and entry counts before querying.
- Query results group matching utility members under their utility artifact, while ranking still uses the best matching member. This preserves class-level navigation without losing method-level precision.
- Selection descriptions explain when to choose an entry, including fit and boundary, rather than only restating the entry's general function. Accepted entries store a required `summary` and optional `usage_notes` and `limitations`.
- Discovery agents own semantic tagging and synonym normalization; the CLI owns deterministic persistence, filtering, and verification.
- Discovery agents add tags and selection descriptions only to final accepted entries. Ignored or deferred candidates need only decision reasons.
- Tag filters are exact filters. Consulting agents map user language and synonyms to canonical tags, and may run a broadened text query separately when the tag is uncertain.
- Multiple tag filters use AND semantics. Consulting agents perform separate queries and merge results when they need OR-like behavior.
- Entries may carry multiple tags, but tags represent core reuse dimensions rather than every implementation detail or keyword present in the source.
- Discovery apply rejects accepted reusable utility and template entries that do not include at least one capability tag and a required summary. Optional usage notes and limitations may be omitted.
- The schema and query command surface become larger than a prose-only catalog, but lookup quality no longer depends on whether a tag-like word happens to appear in a summary.
- Capability tags apply at both artifact and member level; member-level tags support precise method selection, while artifact-level tags group related utilities.
- Template patterns use the same tagging model so consulting can locate reusable template code by capability or scenario before inspecting representative instances.
- Template tags describe implementation structure or reusable coding scenarios, not business domains.
