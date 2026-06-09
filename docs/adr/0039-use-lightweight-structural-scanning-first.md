# Use lightweight structural scanning first

The first version does not depend on Java, TypeScript, or Vue parser libraries. Discovery uses file paths, package names, imports, annotations, exports, method signatures, call-site patterns, and structural fingerprints to identify high-confidence candidates.

**Consequences**

- Installation stays simple and dependency-light.
- Ambiguous structures are reported for review instead of being force-indexed.
