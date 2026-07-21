---
description: Write a concise, self-contained execution plan to docs/plans/<YYYY>/<MM>/<DD>/<1NN>-<slug>/ for another AI to implement
argument-hint: [what you want done]
allowed-tools: Write, Read, Glob, Grep, Task, Bash
---

# /planx

Produce a concise plan another AI can execute with zero extra context. Plan only — no implementation, no commit generation, no edits outside the plan dir.

## Goal
$ARGUMENTS

## Steps

1. **Resolve path.** `date +%Y`, `date +%m`, `date +%d`. `Glob docs/plans/<YYYY>/<MM>/<DD>/1*` → next number = highest `1NN-*` + 1, else `101`. Slug = kebab-case, max 5 words. Plan dir: `docs/plans/<YYYY>/<MM>/<DD>/<1NN>-<slug>/`.

2. **Explore.** Read `generate.ts` and the flag table in `README.md`; find the arg-parsing and day-sampling blocks (`file:line`). A `Task` Explore agent is overkill for a repo this small — only fan out if the ask spans several files.

   **Do not plan git worktrees.** The executor works directly in this checkout; parallel agents share it. Never write `isolation: worktree` or per-agent worktree dirs into a plan. This tool writes commits into the repo it runs in — a second working tree is actively dangerous.

3. **Write the plan as multiple files** — never one big `plan.md`. Always `overview.md` plus one `<NN>-<aspect>.md` per separable area (e.g. `01-flags.md`, `02-sampling.md`, `03-readme.md`).

   **`overview.md`**:

```markdown
# <Title>

## Goal
1-2 sentences: what + why.

## Context
- Bun + TypeScript, single entry `generate.ts`. Bun APIs over Node (`Bun.$`, `Bun.file`, built-in .env).
- Reference patterns: `generate.ts:NN` — follow this for Z.

## Plan files (execute in order)
1. [`01-<aspect>.md`](01-<aspect>.md) — one line.

## Done when
- `bun generate.ts --range … --dry-run` shows the expected preview; README flag table matches the CLI.

## Risks / open questions
```

   **Each `<NN>-<aspect>.md`**: `## Files to change` (`path:line` — what, why) · `## Steps` (ordered, concrete) · `## Verify` (`bun generate.ts --range YYYY-MM-DD:YYYY-MM-DD --dry-run` first, `bun test` if applicable) · `## Done when`.

4. **Write a `status.yml`** in the plan dir. New plans start `not_started` / `0%`. `created_by`/`owner` from `git config user.name`; leave `worked_by: ""`.

```yaml
plan: <1NN>-<slug>
title: <human title>
status: not_started        # not_started | in_progress | blocked | complete | superseded
created_by: <git user.name>
worked_by: ""
owner: <git user.name>
percent: 0
current_focus: ""
slices:
  - file: 01-<aspect>.md
    status: not_started
    percent: 0
evidence: []
notes: ""
last_updated: <YYYY-MM-DD>
```

## Rules
- Compact English. Fragments over sentences. `file:line` refs over prose.
- Reference-only: point at code, don't paste it.
- No checkboxes. `status.yml` is the only tracker.
- Self-contained: executor reads `overview.md`, its slice, and the files those cite.
- Bun over Node throughout (`CLAUDE.md`). Every new flag gets a README table row with its default.
- Always verify with `--dry-run`; never plan a real run against a repo with real history.

## Output
```
✓ docs/plans/<YYYY>/<MM>/<DD>/<1NN>-<slug>/overview.md
  + 01-<aspect>.md, … + status.yml
Next: run an executor on overview.md.
```
