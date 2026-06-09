# Discovery suggests extraction but does not edit code

When recurring template code appears extractable into a utility artifact, the discovery skill reports the opportunity only if the pattern is frequent, non-business-specific, has no equivalent existing utility, and can be extracted behind a stable method signature. Code changes require user approval and should be handled by a separate implementation subagent. After a successful extraction, the main agent triggers incremental rediscovery for the changed files or modules.

**Consequences**

- Discovery does not modify target project code.
- Extraction recommendations must include the repeated pattern, affected references, missing equivalent utility, and the proposed utility shape.
- Failed extraction attempts do not update the index.
