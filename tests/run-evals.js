// Report of the eval suite: `npm run eval`. Totals are split by where the cases came from,
// because a pass rate on attacks we fixed against is not evidence that the agent generalizes.
import { runAll } from "./evals.js";

const results = runAll();
const groups = { designed: "Designed with the code (24 scenes + emails)", regression: "Regression: game 3–4 scam emails we fixed against", "regression-honest": "Regression: game 5–7 genuine emails we fixed false alarms on", "held-out": "Held-out scam emails: frozen, never tuned on", honest: "Held-out genuine emails: frozen, never tuned on (false alarms)" };
const tally = {};
for (const r of results) {
  const failedHard = r.checks.filter((c) => !c.pass && !c.soft);
  const t = (tally[r.group] ||= { cases: 0, casesOk: 0, checks: 0, checksOk: 0, red: 0, attacks: 0 });
  t.cases++; if (!failedHard.length) t.casesOk++;
  for (const c of r.checks.filter((c) => !c.soft)) { t.checks++; if (c.pass) t.checksOk++; }
  const soft = r.checks.find((c) => c.soft); if (soft) { t.attacks++; if (soft.pass) t.red++; }
  console.log(`${failedHard.length ? "✗" : "✓"} ${r.id.padEnd(4)} ${String(r.kind).padEnd(16)} ${r.who}`);
  for (const f of failedHard) console.log(`     FAIL ${f.name}: ${f.detail}`);
}
console.log("");
let allOk = true;
for (const [g, label] of Object.entries(groups)) {
  const t = tally[g]; if (!t) continue;
  if (t.casesOk !== t.cases && g !== "held-out" && g !== "honest") allOk = false;
  console.log(`${label}: ${t.casesOk}/${t.cases} cases, ${t.checksOk}/${t.checks} checks${t.attacks ? ` · flagged red: ${t.red}/${t.attacks}` : ""}`);
}
if (!tally["held-out"] && !tally.honest) {
  console.log("Held-out: none frozen right now. Every set we measured was later tuned on and moved to regression.");
  console.log("  Those first measurements are in tests/heldout/RESULTS.md; `npm run replay-heldout` reproduces them from the old commits.");
}
// Held-out failures are reported, not hidden, and don't fail the build: they're the honest number.
process.exit(allOk ? 0 : 1);
