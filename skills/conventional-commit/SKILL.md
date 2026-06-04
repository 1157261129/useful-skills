---
name: conventional-commit
description: Drafts and validates Git commit messages that follow the Conventional Commits specification and use Chinese as the primary commit language. Use when writing, reviewing, or fixing commit messages; choosing types or scopes; marking breaking changes; adding bodies or issue footers.
---

# Conventional Commit

Use this skill to produce concise, accurate Conventional Commit messages.
Derive the message from the actual diff, issue, or user-provided summary.
Use Chinese as the default language for descriptions, bodies, and change impact.
If the change mixes unrelated work, recommend separate commits before drafting one broad message.

## Core Format

```text
type(scope): description
type: description
type(scope)!: description
```

Rules:

- `type` and `description` are required.
- `scope` is optional; use it only when it clarifies the changed area.
- `!` marks a breaking change and must not be used for ordinary changes.
- Keep syntax tokens such as `type`, `scope`, `BREAKING CHANGE`, `Closes`, `Fixes`, and `Refs` in their standard form.
- Write the description primarily in Chinese; keep it concise, specific, action-oriented, and free of a trailing period.
- Prefer one logical change per commit.

## Type Reference

Use repository-specific types when they exist. Otherwise use this common set:

| Type | When to use | Example |
|------|-------------|---------|
| `feat` | User-facing feature or capability | `feat(auth): 添加 OAuth2 登录` |
| `fix` | Bug fix | `fix(api): 处理空用户响应` |
| `refactor` | Code change without behavior change | `refactor(db): 抽取查询构建器` |
| `perf` | Performance improvement | `perf(search): 添加邮箱查询索引` |
| `docs` | Documentation only | `docs: 更新 API 示例` |
| `test` | Tests only | `test(auth): 覆盖令牌刷新` |
| `style` | Formatting only | `style: 格式化源文件` |
| `build` | Build system or dependency packaging | `build: 切换到 hatch` |
| `ci` | CI configuration or automation | `ci: 添加 Python 3.12 任务` |
| `chore` | Maintenance that does not fit other types | `chore: 更新锁文件` |
| `revert` | Revert a prior commit | `revert: revert "feat(auth): 添加 OAuth2 登录"` |

## Body and Footers

Add a body when the header does not explain the rationale, impact, or main implementation details. Separate the header, body, and footers with blank lines.

```text
feat(auth): 添加 JWT 认证

- 添加登录和注册接口
- 使用 argon2 存储密码哈希
- 通过中间件保护认证路由

Closes #42
```

Footer guidance:

- Use `Closes #42` or `Fixes #42` when merging should close the issue.
- Use `Refs #42` when the commit only relates to the issue.
- Use `Co-authored-by: Name <email>` for co-authored work.

## Breaking Changes

Mark breaking changes only when consumers must change usage, configuration, or integration code.

Use `!` in the header for visibility. Add a `BREAKING CHANGE:` footer when
migration context is useful.

```text
feat(api)!: 要求使用 bearer token

BREAKING CHANGE: API 客户端必须发送 Authorization: Bearer 请求头，
不再支持原有的 X-API-Key 请求头。
```

## Drafting Workflow

1. Inspect the diff, issue, or user-provided change summary.
2. Choose the narrowest accurate type.
3. Add a scope only if it improves clarity.
4. Write a short Chinese description unless the repository or user requires another language.
5. Add a body for non-obvious rationale or impact.
6. Add breaking-change and issue footers when required.

## Verification Checklist

- [ ] Header follows `type(scope): description`, `type: description`, or `type(scope)!: description`
- [ ] Commit type matches the actual nature of the change
- [ ] Scope is short and meaningful, or omitted
- [ ] Description uses Chinese as the primary language unless overridden
- [ ] Body explains non-obvious context in Chinese when needed
- [ ] Breaking change marker is present only when required
- [ ] Issue footer closes or references issues intentionally
