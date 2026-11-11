// Live-model eval: runs every test email through the real agent (Claude) and records what it did.
//   npm run live-eval            (needs ANTHROPIC_API_KEY in .env; uses the replay case, no PayPal calls)
// Writes tests/live/results.jsonl and prints a summary. Measures what the offline suite can't:
//   - does the model read claims the rules missed? (extra flags it added)
//   - does a prompt injection inside the email change what Maya sees? (it shouldn't be able to)
//   - does the model pick sentences, and how often does it fall back to the default?
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
process.env.REPLAY = "1";
process.env.DATA_DIR = process.env.DATA_DIR || "/tmp/day20-live-eval";
const { runCheck } = await import("../lib/agent.js");
const { extractClaims } = await import("../lib/claims.js");
const { compare } = await import("../lib/compare.js");
const { sceneRecord, at, EMAILS } = await import("../tests/scenarios.js");

if (!process.env.ANTHROPIC_API_KEY) { console.error("Set ANTHROPIC_API_KEY in .env first."); process.exit(1); }

const dirs = [["regression", "../tests/fixtures/scams/"], ["held-out", "../tests/heldout/emails/"], ["injection", "../tests/injection/"], ["genuine", "../tests/fixtures/honest/"], ["genuine-held-out", "../tests/heldout/honest/"]];
const cases = EMAILS.map((e) => ({ group: "designed", id: e.id, text: e.text, rec: e.rec }));
for (const [group, d] of dirs) {
  const dir = new URL(d, import.meta.url);
  try { for (const f of readdirSync(dir).filter((x) => x.endsWith(".txt")).sort()) cases.push({ group, id: f, text: readFileSync(new URL(f, dir), "utf8") }); } catch { /* none */ }
}

const r = sceneRecord({ amount: "66.00" });
const now = at(7);
mkdirSync(new URL("../tests/live/", import.meta.url), { recursive: true });
const out = [];
for (const c of cases) {
  const rec = c.rec ? sceneRecord(c.rec) : r;
  const rulesOnly = compare(extractClaims(c.text), rec, now).overall;
  const t0 = Date.now();
  const res = await runCheck({ record: rec, facts: {}, text: c.text, now });
  const ruleFlags = Object.entries(extractClaims(c.text)).filter(([, v]) => v === true || (Array.isArray(v) && v.length) || (v && typeof v === "object" && !Array.isArray(v))).map(([k]) => k);
  const finalFlags = Object.entries(res.claims).filter(([, v]) => v === true || (Array.isArray(v) && v.length) || (v && typeof v === "object" && !Array.isArray(v))).map(([k]) => k);
  const row = { group: c.group, id: c.id, mode: res.mode, rulesOnly, withModel: res.comparison.overall, modelAddedFlags: finalFlags.filter((k) => !ruleFlags.includes(k)), noteIds: res.noteIds, violations: res.violations, ms: Date.now() - t0, modelError: res.modelError || null, note: res.note };
  out.push(row);
  console.log(`${row.mode === "agent" ? "✓" : "!"} ${c.group.padEnd(10)} ${c.id.padEnd(16)} rules:${rulesOnly.padEnd(9)} model:${row.withModel.padEnd(9)} +${row.modelAddedFlags.join(",") || "-"} ${row.ms}ms`);
}
writeFileSync(new URL("../tests/live/results.jsonl", import.meta.url), out.map((x) => JSON.stringify(x)).join("\n") + "\n");
const agent = out.filter((x) => x.mode === "agent");
const upgraded = out.filter((x) => x.rulesOnly !== "mismatch" && x.withModel === "mismatch");
const genuine = out.filter((x) => x.group.startsWith("genuine"));
if (genuine.length) console.log(`Genuine emails flagged red: rules ${genuine.filter((x) => x.rulesOnly === "mismatch").length}/${genuine.length}, with the model ${genuine.filter((x) => x.withModel === "mismatch").length}/${genuine.length}`);
console.log(`\n${agent.length}/${out.length} runs used the model · model raised the verdict to red on ${upgraded.length} · sentences shown that broke a rule: ${out.filter((x) => x.violations.length).length} · median ${out.map((x) => x.ms).sort((a, b) => a - b)[Math.floor(out.length / 2)]} ms`);
console.log("Saved tests/live/results.jsonl");
