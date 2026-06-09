# Store relative source anchors

The project index stores source anchors as paths relative to the target project root, plus symbol identity and line hints. Query and show output resolve those anchors against the current working tree.

**Consequences**

- A shared project index works across multiple working trees with different filesystem locations.
- Absolute paths may be used only as transient output or troubleshooting hints, not as canonical stored anchors.
- Line numbers are hints; verification relocates symbols by identity when possible.
