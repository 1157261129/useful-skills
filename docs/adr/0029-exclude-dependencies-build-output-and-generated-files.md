# Exclude dependencies, build output, and generated files

Discovery excludes common dependency directories, build output, coverage output, generated sources, IDE metadata, minified files, source maps, and lockfiles by default. In Git projects it also respects `.gitignore` by using tracked and unignored files as the scan base. Include and exclude overrides can adjust the scan scope.

**Consequences**

- Catalog entries are less likely to come from generated or third-party copied code.
- Agents can override scan scope for unusual project layouts.
