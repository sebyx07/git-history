#!/usr/bin/env bun
/**
 * generate.ts — programmatically backdate "fun" commits across date ranges.
 *
 * Two scheduling modes:
 *   --per-year N   exactly N commits per calendar year, random dates/times
 *   (default)      per-day rolls using --min/--max/--density/--weekends
 *
 * Commits are built with `git fast-import` (one pass, fast even at 10k+),
 * dated as raw `@<epoch> +0000` seconds so timezones and the 1970 epoch
 * boundary can't produce negative/garbage timestamps. Every commit carries
 * random text plus a `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer
 * unless --no-claude is passed.
 *
 *   bun generate.ts --range 1970-01-01:2170-01-01 --per-year 50
 *   bun generate.ts --range 2024-01-01:2024-03-31 --dry-run
 *
 * The fun commits only touch the activity file; point --repo elsewhere to
 * target another working tree. Push manually once you're happy.
 */

import { $ } from "bun";

type Person = { name: string; email: string };
type Range = { startMs: number; endMs: number };

type Args = {
  ranges: Range[];
  perYear?: number;
  min: number;
  max: number;
  weekends: boolean;
  density: number;
  repo: string;
  file: string;
  author?: Person;
  coauthors: Person[];
  branch?: string;
  dryRun: boolean;
  seed?: number;
};

// Appended to every commit unless --no-claude is passed.
const CLAUDE_COAUTHOR: Person = {
  name: "Claude Opus 4.8 (1M context)",
  email: "noreply@anthropic.com",
};

// Earliest safe epoch second: noon UTC on 1970-01-01, so no commit can land
// on a zero/negative timestamp regardless of timezone.
const MIN_EPOCH = 12 * 3600;

const USAGE =
  "Usage: bun generate.ts --range YYYY-MM-DD:YYYY-MM-DD [--range ...]\n" +
  "  [--per-year N] | [--min N] [--max N] [--density 0..1] [--weekends]\n" +
  '  [--author "Name <email>"] [--coauthor "Name <email>"]... [--no-claude]\n' +
  "  [--repo path] [--file name] [--branch name] [--seed N] [--dry-run]";

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function collect(argv: string[], name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${name}` && argv[i + 1] !== undefined) out.push(argv[++i]!);
  }
  return out;
}

// Parse YYYY-MM-DD as noon UTC (tz-free, avoids epoch edge cases).
function parseDateMs(s: string): number {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) die(`Invalid date: "${s}". Use YYYY-MM-DD.`);
  const ms = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, 12, 0, 0);
  if (isNaN(ms)) die(`Invalid date: "${s}".`);
  return ms;
}

function parsePerson(s: string): Person {
  const m = s.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!m) die(`Invalid person "${s}". Expected: "Name <email@host>".`);
  return { name: m[1]!, email: m[2]! };
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (name: string) => argv.includes(`--${name}`);

  const rawRanges = collect(argv, "range");
  const ranges: Range[] = [];
  if (rawRanges.length > 0) {
    for (const r of rawRanges) {
      const [a, b] = r.split(":");
      if (!a || !b) die(`Invalid --range "${r}". Expected start:end.`);
      const startMs = parseDateMs(a);
      const endMs = parseDateMs(b);
      if (startMs > endMs) die(`Range start after end: "${r}".`);
      ranges.push({ startMs, endMs });
    }
  } else {
    const s = get("start");
    const e = get("end");
    if (!s || !e) die(USAGE);
    const startMs = parseDateMs(s);
    const endMs = parseDateMs(e);
    if (startMs > endMs) die("--start must be on or before --end.");
    ranges.push({ startMs, endMs });
  }

  const perYearRaw = get("per-year");
  const perYear = perYearRaw !== undefined ? Number(perYearRaw) : undefined;
  if (perYear !== undefined && (!Number.isFinite(perYear) || perYear <= 0)) {
    die("--per-year must be a positive number.");
  }

  const min = Number(get("min") ?? 1);
  const max = Number(get("max") ?? 4);
  if (min < 0 || max < min) die("Require 0 <= --min <= --max.");

  return {
    ranges,
    perYear,
    min,
    max,
    weekends: has("weekends"),
    density: Number(get("density") ?? 0.7),
    repo: get("repo") ?? process.cwd(),
    file: get("file") ?? "activity.log",
    author: get("author") ? parsePerson(get("author")!) : undefined,
    coauthors: [
      ...(has("no-claude") ? [] : [CLAUDE_COAUTHOR]),
      ...collect(argv, "coauthor").map(parsePerson),
    ],
    branch: get("branch"),
    dryRun: has("dry-run"),
    seed: get("seed") ? Number(get("seed")) : undefined,
  };
}

// Seedable PRNG (mulberry32) for reproducible runs with --seed.
function makeRng(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rngRef = { fn: Math.random as () => number };
const pick = <T>(arr: T[]): T => arr[Math.floor(rngRef.fn() * arr.length)]!;
const randInt = (lo: number, hi: number) =>
  Math.floor(rngRef.fn() * (hi - lo + 1)) + lo;

// ---- random text -----------------------------------------------------------
const ADJ = ["swift", "quiet", "bold", "lazy", "fuzzy", "bright", "silent",
  "rusty", "cosmic", "gentle", "sharp", "hidden", "ancient", "neon", "misty",
  "velvet", "amber", "frosty", "crimson", "feral"];
const NOUN = ["fox", "river", "ember", "cipher", "lantern", "comet", "willow",
  "pixel", "harbor", "meadow", "falcon", "granite", "tide", "beacon", "circuit",
  "glacier", "thicket", "marble", "signal", "orchard"];
const VERB = ["wander", "ignite", "drift", "whisper", "orbit", "render",
  "forge", "ripple", "kindle", "scatter", "polish", "unfold", "compile",
  "echo", "gather", "summon", "weave", "trace", "anchor", "spark"];

const randomSubject = () => `${pick(VERB)} the ${pick(ADJ)} ${pick(NOUN)}`;
const randomLine = () =>
  Array.from({ length: randInt(4, 9) }, () =>
    rngRef.fn() < 0.5 ? pick(ADJ) : pick(NOUN),
  ).join(" ");

// ---- scheduling -------------------------------------------------------------
function pushSafe(secs: number[], ms: number) {
  secs.push(Math.max(MIN_EPOCH, Math.floor(ms / 1000)));
}

function buildSchedule(args: Args): number[] {
  const secs: number[] = [];
  for (const range of args.ranges) {
    if (args.perYear) {
      const sy = new Date(range.startMs).getUTCFullYear();
      const ey = new Date(range.endMs).getUTCFullYear();
      for (let y = sy; y <= ey; y++) {
        const lo = Math.max(range.startMs, Date.UTC(y, 0, 1, 0, 0, 0));
        const hi = Math.min(range.endMs, Date.UTC(y, 11, 31, 23, 59, 59));
        if (lo > hi) continue;
        for (let i = 0; i < args.perYear; i++) {
          pushSafe(secs, lo + Math.floor(rngRef.fn() * (hi - lo + 1)));
        }
      }
    } else {
      for (let ms = range.startMs; ms <= range.endMs; ms += 86400000) {
        const dow = new Date(ms).getUTCDay();
        if ((dow === 0 || dow === 6) && !args.weekends) continue;
        if (rngRef.fn() > args.density) continue;
        const count = randInt(args.min, args.max);
        for (let i = 0; i < count; i++) {
          const dayStart = ms - 12 * 3600000; // back to 00:00 UTC
          pushSafe(secs, dayStart + randInt(9, 18) * 3600000 + randInt(0, 3599) * 1000);
        }
      }
    }
  }
  secs.sort((a, b) => a - b);
  return secs;
}

// ---- main -------------------------------------------------------------------
async function main() {
  const args = parseArgs(Bun.argv.slice(2));
  rngRef.fn = makeRng(args.seed);

  const isRepo = await $`git -C ${args.repo} rev-parse --is-inside-work-tree`
    .quiet()
    .nothrow();
  if (isRepo.exitCode !== 0) die(`Not a git repository: ${args.repo}`);

  // Resolve author identity (defaults to repo's git config).
  const cfg = async (key: string) =>
    (await $`git -C ${args.repo} config ${key}`.quiet().nothrow().text()).trim();
  const author: Person = args.author ?? {
    name: (await cfg("user.name")) || "sebi",
    email: (await cfg("user.email")) || "gore.sebyx@yahoo.com",
  };

  // Resolve target branch (use the repo's current/unborn branch by default).
  const branch =
    args.branch ||
    (await $`git -C ${args.repo} symbolic-ref --short HEAD`
      .quiet()
      .nothrow()
      .text()).trim() ||
    "main";

  const trailer =
    args.coauthors.length > 0
      ? "\n\n" +
        args.coauthors
          .map((c) => `Co-Authored-By: ${c.name} <${c.email}>`)
          .join("\n")
      : "";

  const schedule = buildSchedule(args);
  if (schedule.length === 0) die("Nothing to do: schedule is empty.");

  if (args.dryRun) {
    console.log(`Would create ${schedule.length} commit(s) on "${branch}".`);
    console.log(`Author: ${author.name} <${author.email}>`);
    if (args.coauthors.length) {
      console.log("Co-authors:");
      for (const c of args.coauthors) console.log(`  ${c.name} <${c.email}>`);
    }
    console.log("\nSample:");
    for (const sec of [schedule[0]!, schedule[schedule.length - 1]!]) {
      const iso = new Date(sec * 1000).toISOString().replace(".000Z", "Z");
      console.log(`  ${iso}  ${randomSubject()}`);
    }
    return;
  }

  // Build a single fast-import stream. Each commit replaces the activity file
  // with one line of random text — keeps the stream tiny even at 10k commits.
  const enc = (s: string) => Buffer.byteLength(s, "utf8");
  const parts: string[] = [];
  let mark = 0;
  for (const sec of schedule) {
    mark++;
    const message = `${randomSubject()}${trailer}`;
    const content = `${randomLine()}\n`;
    parts.push(`commit refs/heads/${branch}`);
    parts.push(`mark :${mark}`);
    parts.push(`author ${author.name} <${author.email}> ${sec} +0000`);
    parts.push(`committer ${author.name} <${author.email}> ${sec} +0000`);
    parts.push(`data ${enc(message)}`);
    parts.push(message);
    parts.push(`M 100644 inline ${args.file}`);
    parts.push(`data ${enc(content)}`);
    parts.push(content.slice(0, -1)); // join re-adds the trailing newline
  }
  const stream = parts.join("\n") + "\n";

  console.log(`Importing ${schedule.length} commit(s) onto "${branch}"…`);
  const proc = Bun.spawn(
    ["git", "-C", args.repo, "fast-import", "--quiet", "--date-format=raw"],
    { stdin: "pipe", stdout: "inherit", stderr: "inherit" },
  );
  proc.stdin.write(stream);
  await proc.stdin.end();
  const code = await proc.exited;
  if (code !== 0) die(`git fast-import failed (exit ${code}).`);

  // Materialise the imported history into the working tree (keeps untracked
  // source files in place).
  await $`git -C ${args.repo} reset --hard ${branch}`.quiet();

  console.log(
    `\nCreated ${schedule.length} commit(s) on "${branch}" in ${args.repo}.`,
  );
  console.log(`Review with: git -C ${args.repo} log --oneline | head`);
}

main();
