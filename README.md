# Skills Library

This repository stores agent skills in the standard directory layout:

```
skills/
  <skill-name>/
    SKILL.md
```

Each skill directory name must match the `name` field in its `SKILL.md` frontmatter. Optional skill resources such as `agents/`, `scripts/`, `references/`, and `assets/` stay inside the skill directory.

## Available Skills

### Java/Spring Engineering

| Skill | Description |
|-------|-------------|
| `java-spring-engineering` | Progressive Java/Spring guidance for implementation, review, tests, concurrency, performance, architecture, REST contracts, and security |

The canonical skill routes each task to one primary reference and loads specialist rules or examples only when the code requires them. The following names remain short compatibility aliases for explicit requests only: `java-clean-code`, `java-code-review`, `java-test-quality`, and `spring-boot-patterns`.

### General Skills

| Skill | Description |
|-------|-------------|
| `conventional-commit` | Drafts and validates Git commit messages that follow the Conventional Commits specification and use Chinese as the primary commit language |
| `grill-me` | Runs a relentless interview to sharpen a plan or design |
| `grill-with-docs` | Runs a plan or design interview while creating ADRs and a glossary |
| `improve-codebase-architecture` | Scans a codebase for deepening opportunities and presents an architecture report |
| `setup-matt-pocock-skills` | Configures issue tracking, triage labels, and domain documentation for engineering skills |
| `write-a-prompt` | Generates focused prompts for vibe-coding and coding-agent sessions from a concrete software task |

## Install

Install all skills from GitHub:

```bash
npx skills@latest add 1157261129/useful-skills --all
```

Install the canonical Java/Spring skill:

```bash
npx skills@latest add 1157261129/useful-skills --skill java-spring-engineering
```

Install a compatibility alias only when an existing prompt explicitly names it:

```bash
npx skills@latest add 1157261129/useful-skills --skill java-code-review
```

Each skill contains `SKILL.md` and may additionally include:

- **REFERENCE.md** - Additional reference documentation (if applicable)
- **EXAMPLES.md** - Practical examples demonstrating the skill in action (if applicable)
- **agents/** - Agent configurations (optional)
- **scripts/** - Supporting scripts (optional)
- **references/** - Supporting reference material (optional)
- **assets/** - Supporting assets (optional)

`java-spring-engineering` keeps domain rules and examples under `references/` for progressive discovery. Do not load all reference files by default.

## Imported Skills

The Java review and pattern skills are adapted from [`decebals/claude-code-java`](https://github.com/decebals/claude-code-java), `.claude/skills`, under the MIT License, Copyright (c) 2026 Decebal Suiu.

The `grill-me`, `grill-with-docs`, `improve-codebase-architecture`, and `setup-matt-pocock-skills` skills are imported from [`mattpocock/skills`](https://github.com/mattpocock/skills), commit `c55ee46073ed923f86ce59a5eb3b6d895095d1b7`.
