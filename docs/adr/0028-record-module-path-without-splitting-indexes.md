# Record module path without splitting indexes

Multi-module repositories use one project index, while catalog entries record module or subproject path metadata. This preserves cross-module reuse while letting queries filter or explain where a utility artifact or template pattern lives.

**Consequences**

- Backend and frontend modules can share one target project catalog.
- Module path is metadata for filtering and context, not a separate index boundary.
