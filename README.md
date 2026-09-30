# Skills Library

This repository stores agent skills in the standard directory layout:

```
skills/
  <skill-name>/
    SKILL.md
```

Each skill directory name must match the `name` field in its `SKILL.md` frontmatter. Optional skill resources such as `agents/`, `scripts/`, `references/`, and `assets/` stay inside the skill directory.

## Available Skills

| Skill | Description |
|-------|-------------|
| `conventional-commit` | Drafts and validates Git commit messages that follow the Conventional Commits specification and use Chinese as the primary commit language |
| `paseo-dispatch` | Dispatches read-only document and data dictionary extraction to GPT-6-Luna subagents through Paseo |
| `write-a-prompt` | Generates focused prompts for vibe-coding and coding-agent sessions from a concrete software task |

## Install

Install all skills from GitHub:

```bash
npx skills@latest add 1157261129/useful-skills --all
```

Each skill contains `SKILL.md` and may additionally include:

- **REFERENCE.md** - Additional reference documentation (if applicable)
- **EXAMPLES.md** - Practical examples demonstrating the skill in action (if applicable)
- **agents/** - Agent configurations (optional)
- **scripts/** - Supporting scripts (optional)
- **references/** - Supporting reference material (optional)
- **assets/** - Supporting assets (optional)
