# Return compact Markdown with a JSON option

The Tool Catalog CLI returns compact Markdown by default so agents can read query and show results directly. It also supports JSON output for automation, but skill workflows use Markdown unless they need structured integration.

**Consequences**

- Results include fully qualified names or equivalent identifiers, concise usage notes, minimal examples, and file anchors.
- Template code results include representative snippets and references, not long pasted code blocks.
