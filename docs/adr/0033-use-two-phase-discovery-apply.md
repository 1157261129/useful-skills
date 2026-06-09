# Use two-phase discovery apply

Discovery is a two-phase workflow. The CLI first produces candidate data in dry-run mode, including machine-readable candidate data and a Markdown Discovery Review Pack grouped by utility class or template pattern. The review pack contains concise structural facts such as source anchors, members, signatures, snippets, and template instances; it does not generate semantic tag hints or suggested actions. The discovery skill agent reviews the pack, filters and enriches final accepted entries, collects user decisions only for ambiguous items, and writes a structured Discovery Decision File. Discovery apply consumes the decision file, not the raw dry-run candidate JSON, when updating the project index.

**Consequences**

- Unreviewed candidates are not written to the project index.
- The CLI remains deterministic while the skill handles semantic judgment.
- Discovery agents default to reading the Markdown review pack instead of raw noisy JSON.
- Review packs avoid semantic recommendations from the CLI so agents do not spend context on low-confidence hints.
- Review packs include only compact structural facts: utility class names, source anchors, paths or packages, method signatures, short snippets, template pattern keys, representative instances, and instance anchors.
- Raw candidate JSON remains available for audit, debugging, and validation against the reviewed decision file.
- Discovery Decision Files store accepted entries in their final catalog shape, while ignored and deferred items reference original candidate identifiers for traceability.
