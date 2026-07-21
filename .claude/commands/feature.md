---
description: End-to-end feature workflow for git-history — understand, explore generate.ts, build, verify with --dry-run, commit.
argument-hint: <what you want built, plain language>
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill
---

# /feature

This is a small **Bun + TypeScript toy**: `generate.ts` backdates "fun" commits across one or more date ranges to fill a contribution graph. The repo's own commit history is fake and deliberately so — don't treat it as real work, and don't try to "fix" it.

## Request
$ARGUMENTS

**The prompt is the context.** Small repo, small changes — "just do it" is the default. Stop for a true blocker (anything that would rewrite real history in another repo, or a flag that could push).

## No git worktrees

**Work directly in this checkout.** Parallel `Task` agents share this one working tree — never pass `isolation: worktree`, never create a per-agent worktree dir. Coordinate by splitting files. (This tool writes commits into the repo it runs in, so a second working tree is actively dangerous here.)

## The flow

1. **Understand.** Restate the goal in a line. Most changes are a new flag or a change to how days/commits are sampled.

2. **Explore.** Read `generate.ts` end-to-end (it's short) plus `README.md`'s flag table. Grep for the flag-parsing block before adding a new flag.

3. **Build.** Bun-first, per `CLAUDE.md`: `bun <file>` not `node`, `bun install`, `Bun.$` instead of execa, `Bun.file` over `node:fs`, built-in `.env` loading (no dotenv). Keep the CLI surface honest — every new flag gets a row in the README table with its default.

4. **Verify — always dry-run first.**

```sh
bun install
bun generate.ts --range 2024-01-01:2024-01-31 --dry-run   # preview, writes nothing
bun test                                                   # if tests exist for the change
```
   Only run without `--dry-run` in a throwaway repo or when the user explicitly asks. Never point it at a repo with real history.

5. **Commit.** One commit describing the change. Update `README.md` in the same commit when the CLI surface moved.

## Notes

- Commits get a `Co-Authored-By: Claude` trailer by default; `--no-claude` drops it, `--coauthor` adds more, `--author` overrides.
- Defaults worth remembering: `--min 1`, `--max 4`, `--density 0.7`, weekends off.

## Output

```
Change:   <one line>
Files:    <files>
Dry run:  <what the preview showed>
README:   updated / n-a
```
