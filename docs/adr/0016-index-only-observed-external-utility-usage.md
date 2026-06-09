# Index only observed external utility usage

External utility origins are indexed only when the target project already imports or calls them. The catalog does not crawl or document full external library APIs, because its purpose is to capture project reuse practice rather than replace general dependency documentation.

**Consequences**

- Project-owned utility artifacts can be indexed from source with richer metadata.
- External utility entries are based on observed imports, calls, examples, and file anchors.
