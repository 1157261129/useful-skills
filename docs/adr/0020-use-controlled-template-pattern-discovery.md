# Use controlled template pattern discovery

The first version does not perform general-purpose clone detection. Template discovery uses language-specific structural fingerprints and controlled pattern detectors, then relies on the worker review and Catalog Finalizer flow to decide whether frequent Findings represent useful Template Code.

**Consequences**

- Discovery favors reusable implementation patterns over raw textual similarity.
- Common business-flow similarity is not enough to create a template entry.
