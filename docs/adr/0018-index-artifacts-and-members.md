# Index artifacts and members

The project index stores both utility artifacts and their callable members. Query results prefer the most relevant member while preserving the owning artifact, origin, language, framework, and file anchors.

**Consequences**

- Agents can identify the exact method or exported function to call.
- Artifact-level context remains available for origin priority, broader inspection, and show results.
- Accepting a utility artifact does not imply indexing every callable member. Discovery agents select reusable public members and exclude deprecated, internal, compatibility-only, or business-specific methods.
- Overloaded methods are represented as one logical member with multiple signatures and source anchors, so consulting results stay capability-oriented without losing call details.
- Multiple overload signatures are stored in a dedicated `member_signatures` table rather than a JSON blob on the member row.
