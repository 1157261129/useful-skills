# Implement the CLI as Node.js ESM without a build step

The shared Tool Catalog CLI is implemented as Node.js ESM JavaScript and runs directly without a TypeScript compilation step. This keeps skill installation simple while still fitting TypeScript, JavaScript, and Vue file scanning.

**Consequences**

- The CLI source is executable JavaScript, not generated build output.
- Heavy parser dependencies are avoided in the first version unless a detector proves they are necessary.
