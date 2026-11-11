// Replays each held-out measurement against the code as it was *before* we tuned on that set.
// Each set was later moved to regression and fixed against, so today's code is not evidence.
// This checks out the old commit in a temporary git worktree and scores the emails with it.
//   node scripts/replay-heldout.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(new URL("..", import.meta.url).pathname);
const git = (...a) => execFileSync("git", ["-C", root, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

// [set, files, commit the code was at when the set was first scored, kind]
const ROUNDS = [
  ["Game 4 scam emails", "tests/fixtures/scams", /^s2_/, "ab9d746", "scam"],
  ["Game 5 genuine emails", "tests/fixtures/honest", /^g5_/, "b0c3630", "genuine"],
  ["Game 6 genuine emails", "tests/fixtures/honest", /^g6_/, "29d4f66", "genuine"],
  ["Game 7 genuine emails", "tests/fixtures/honest", /^g7_/, "b61f13f", "genuine"],
];

const out = [];
for (const [name, dir, re, commit, kind] of ROUNDS) {
  const wt = mkdtempSync(join(tmpdir(), "d20-"));
  try {
    git("worktree", "add", "--detach", "-f", wt, commit);
    const imp = (p) => import(pathToFileURL(join(wt, p)).href);
    const { extractClaims } = await imp("lib/claims.js");
    const { compare } = await imp("lib/compare.js");
    const { sceneRecord, at } = await imp("tests/scenarios.js");
    const r = sceneRecord({ amount: "66.00" });
    const files = readdirSync(join(root, dir)).filter((f) => re.test(f) && f.endsWith(".txt")).sort();
    const verdicts = files.map((f) => compare(extractClaims(readFileSync(join(root, dir, f), "utf8")), r, at(7)).overall);
    const n = files.length, red = verdicts.filter((v) => v === "mismatch").length, safe = verdicts.filter((v) => v === "consistent").length;
    const line = kind === "scam"
      ? `${name} at ${commit}: ${n - safe}/${n} not called safe, ${red}/${n} flagged red`
      : `${name} at ${commit}: ${n - red}/${n} clean (not flagged red)`;
    out.push(line); console.log(line);
  } finally {
    try { git("worktree", "remove", "--force", wt); } catch {}
    rmSync(wt, { recursive: true, force: true });
  }
}
