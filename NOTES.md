# git-history

A toy. `generate.ts` is a Bun + TypeScript script that creates backdated "fun" commits across one or
more date ranges — handy for filling in a GitHub contribution graph. The repo's own history is fake:
roughly 10,050 randomly generated commits spanning 1970 → 2170 (about 50 per year), all touching
`activity.log`. None of it is real work, so don't read anything into the dates. Serves nobody but
its author's amusement.

- **Stack:** Bun + TypeScript, zero runtime dependencies (`@types/bun` only). Shells out to `git`.
  No datastore, no server, no deploy target.
- **Key commands:**
  - `bun install`
  - `bun generate.ts --range 2024-01-01:2024-03-31` (repeat `--range` for multiple windows)
  - `bun generate.ts --range … --dry-run` — preview without committing
  - `bun run generate -- --range …` · `bun run typecheck` (`tsc --noEmit`)
  - Useful flags: `--min` / `--max` per active day, `--density 0..1`, `--weekends`, `--author`,
    `--coauthor` (repeatable), `--no-claude`, `--repo PATH`, `--file NAME`, `--seed N`.
- **Layout:**
  - `generate.ts` — the whole generator (arg parsing, PRNG, commit loop).
  - `index.ts` — Bun entry stub.
  - `activity.log` — the file every generated commit touches.
  - `README.md` — full flag table and usage. `CLAUDE.md` is generic "prefer Bun over Node" guidance,
    not project-specific.
- **Note:** every commit gets a `Co-Authored-By: Claude …` trailer by default; commits land in the
  current repo and are never pushed automatically — review with `git log --oneline` first.
- **State as of 2026-07-21:** branch `master`, working tree clean (no uncommitted work) when this
  note was written. Remote `origin` → `git@github.com:sebyx07/git-history.git`.
