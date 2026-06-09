# Resolve target project root explicitly

The CLI resolves the target project root by preferring an explicit `--root` argument, then the Git repository root, then the current working directory. This root is used for relative source anchors and project identity detection.

**Consequences**

- Agents can run commands from subdirectories without corrupting relative paths.
- Projects with unusual layout can override root detection.
