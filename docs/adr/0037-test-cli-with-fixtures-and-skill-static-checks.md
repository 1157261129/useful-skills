# Test the CLI with fixtures and skill static checks

The Tool Catalog CLI is tested against fixture projects for Java, Vue, external utility usage, and recurring template patterns. Skill Markdown files are checked statically for frontmatter, naming, required workflow steps, and CLI command consistency.

**Consequences**

- Discovery and consulting behavior can be verified without scanning real user projects in tests.
- Skill documentation stays aligned with the CLI command contract.
