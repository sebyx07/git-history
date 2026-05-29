# git-history

Bun + TypeScript script that backdates "fun" commits across one or more date
ranges — handy for filling in a contribution graph. Purely for fun.

## Run

```sh
bun install

# one range
bun generate.ts --range 2024-01-01:2024-03-31

# two (or more) ranges — repeat --range
bun generate.ts --range 2024-01-01:2024-03-31 --range 2024-09-01:2024-12-31

# preview without committing
bun generate.ts --range 2024-01-01:2024-01-31 --dry-run
```

Or via the npm script: `bun run generate -- --range 2024-01-01:2024-03-31`.

## Authors & co-authors

Every commit gets a `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer by
default. Add more, override the author, or drop the Claude trailer:

```sh
bun generate.ts --range 2024-01-01:2024-02-01 \
  --author "sebi <gore.sebyx@yahoo.com>" \
  --coauthor "Ada Lovelace <ada@example.com>" \
  --coauthor "Alan Turing <alan@example.com>" \
  --no-claude   # omit the default Claude co-author
```

## Flags

| Flag | Default | Meaning |
|---|---|---|
| `--range S:E` | — | Date range `YYYY-MM-DD:YYYY-MM-DD`. Repeatable. |
| `--start` / `--end` | — | Single-range fallback if `--range` isn't given. |
| `--min N` | `1` | Min commits on an active day. |
| `--max N` | `4` | Max commits on an active day. |
| `--density 0..1` | `0.7` | Chance a given eligible day gets any commits. |
| `--weekends` | off | Include Saturdays/Sundays. |
| `--author "Name <email>"` | git config | Author + committer identity. |
| `--coauthor "Name <email>"` | — | Add a `Co-Authored-By` trailer. Repeatable. |
| `--no-claude` | off | Drop the default Claude co-author trailer. |
| `--repo PATH` | cwd | Target git working tree. |
| `--file NAME` | `activity.log` | File touched by each commit. |
| `--seed N` | random | Seed the PRNG for reproducible runs. |
| `--dry-run` | off | Print planned commits without writing. |

Commits land in the current repo by default. Review with
`git log --oneline`, then push manually once you're happy.
