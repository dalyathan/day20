// Replays each held-out measurement against the code as it was *before* we tuned on that set.
// Each set was later moved to regression and fixed against, so today's code is not evidence.
// This checks out the old commit in a temporary git worktree and scores the emails with it.
//   node scripts/replay-heldout.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const git = (...a) => execFileSync("git", ["-C", root, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

// [set, files, commit the code was at when the set was first scored, kind, published result, sha256 of the emails]
// The script fails if the emails changed or the result differs from tests/heldout/RESULTS.md.
const ROUNDS = [
  ["Game 4 scam emails", "tests/fixtures/scams", /^s2_/, "ab9d746", "scam", "12/12 not called safe, 0/12 flagged red", "55b503ab6aa9181c"],
  ["Game 5 genuine emails", "tests/fixtures/honest", /^g5_/, "b0c3630", "genuine", "0/12 clean (not flagged red)", "e02a64861fe1c98a"],
  ["Game 6 genuine emails", "tests/fixtures/honest", /^g6_/, "29d4f66", "genuine", "5/12 clean (not flagged red)", "d8ed9cf55f1175cf"],
  ["Game 7 genuine emails", "tests/fixtures/honest", /^g7_/, "b61f13f", "genuine", "11/12 clean (not flagged red)", "30403afcada14cfc"],
];
let failed = 0;
if (git("rev-parse", "--is-shallow-repository") === "true") { console.log("This is a shallow clone. Run `git fetch --unshallow` first: the replay checks out old commits."); process.exit(1); }

const out = [];
for (const [name, dir, re, commit, kind, expected, sha] of ROUNDS) {
  const wt = mkdtempSync(join(tmpdir(), "d20-"));
  try {
    git("worktree", "add", "--detach", "-f", wt, commit);
    const imp = (p) => import(pathToFileURL(join(wt, p)).href);
    const { extractClaims } = await imp("lib/claims.js");
    const { compare } = await imp("lib/compare.js");
    const { sceneRecord, at } = await imp("tests/scenarios.js");
    const r = sceneRecord({ amount: "66.00" });
    const files = readdirSync(join(root, dir)).filter((f) => re.test(f) && f.endsWith(".txt")).sort();
    const hash = createHash("sha256").update(files.map((f) => readFileSync(join(root, dir, f))).reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0))).digest("hex").slice(0, 16);
    if (hash !== sha) { console.log(`✗ ${name}: the emails changed (sha ${hash}, expected ${sha})`); failed++; continue; }
    const verdicts = files.map((f) => compare(extractClaims(readFileSync(join(root, dir, f), "utf8")), r, at(7)).overall);
    const n = files.length, red = verdicts.filter((v) => v === "mismatch").length, safe = verdicts.filter((v) => v === "consistent").length;
    const line = kind === "scam"
      ? `${name} at ${commit}: ${n - safe}/${n} not called safe, ${red}/${n} flagged red`
      : `${name} at ${commit}: ${n - red}/${n} clean (not flagged red)`;
    const ok = line.endsWith(expected);
    if (!ok) failed++;
    out.push(line); console.log(`${ok ? "✓" : "✗"} ${line}${ok ? "" : `  (published: ${expected})`}`);
  } finally {
    try { git("worktree", "remove", "--force", wt); } catch {}
    rmSync(wt, { recursive: true, force: true });
  }
}
if (failed) { console.log(`${failed} held-out number(s) don't match tests/heldout/RESULTS.md`); process.exit(1); }
console.log("All held-out numbers match tests/heldout/RESULTS.md.");
