# Use two-phase discovery apply

Discovery is a two-phase workflow. The CLI first runs Evidence Harvest in dry-run mode, producing machine-readable Findings plus manifest and index artifacts. The worker DAG reviews those facts, groups them into Review Groups, performs local gap audit for accepted entries, and writes a structured Discovery Decision File. Discovery apply consumes the decision file, not raw dry-run output, when updating the project index.

**Consequences**

- Unreviewed Findings are not written to the project index.
- The CLI remains deterministic while the skill handles semantic judgment.
- Discovery agents default to reading the manifest and index before bounded worker review inputs.
- Worker review artifacts avoid semantic recommendations until the Catalog Finalizer stage.
- Review artifacts include compact structural facts: utility class names, source anchors, paths or packages, method signatures, short snippets, template pattern keys, representative instances, and instance anchors.
- Dry-run writes Finding artifacts only; legacy compatibility artifacts are not part of the current CLI contract.
- Discovery Decision Files store accepted entries in their final catalog shape, while suppressions and deferrals preserve enough Finding traceability for future preclassification.
