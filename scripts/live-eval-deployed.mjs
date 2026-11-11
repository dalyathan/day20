// Runs every regression email through a deployed Day 20 (model on, if the server has a key) and writes
// one JSON line per email: verdict, mode, which findings contradict the record, and what the evidence gate dropped.
//   APP_URL=https://day20.onrender.com node scripts/live-eval-deployed.mjs > tests/live/deployed-$(date +%F).jsonl
// The server allows 20 checks per demo session and 60 per address per hour, so this starts a new demo every 10.
import { readdirSync, readFileSync } from "node:fs";

const APP = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const CASE = process.env.DEMO_DISPUTE_ID || "PP-R-UZH-10198816";
// SETS: comma-separated dir:group pairs under tests/ (default: the regression sets). REPEAT: runs per email.
//   SETS=heldout/honest/:genuine-held-out REPEAT=3 APP_URL=… node scripts/live-eval-deployed.mjs
const root = new URL("../tests/", import.meta.url);
const set = (dir, group) => readdirSync(new URL(dir, root)).filter((f) => f.endsWith(".txt")).sort()
  .map((f) => ({ group, id: f.replace(/\.txt$/, ""), text: readFileSync(new URL(dir + f, root), "utf8") }));
const SETS = (process.env.SETS || "fixtures/scams/:scam-regression,fixtures/honest/:genuine").split(",").map((x) => x.split(":"));
const REPEAT = Math.max(1, Number(process.env.REPEAT || 1));
const emails = SETS.flatMap(([dir, group]) => set(dir, group)).flatMap((e) => Array.from({ length: REPEAT }, (_, run) => ({ ...e, run: run + 1 })));

let cookie = "";
const call = async (path, body) => {
  const res = await fetch(APP + path, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  return res.json();
};

const info = await fetch(APP + "/healthz").then((r) => r.json());
const prov = { model: info.model ?? null, temperature: info.temperature ?? null, promptHash: info.promptHash ?? null, commit: info.commit ?? null, at: new Date().toISOString() };
console.error(`app ${APP} · ${JSON.stringify(prov)}`);
const tally = { scamRed: 0, scams: 0, genuineRed: 0, genuine: 0, model: 0 };
for (let i = 0; i < emails.length; i++) {
  if (i % 10 === 0) await call("/api/demo", { scenario: "open_day7" });
  const e = emails[i], t0 = Date.now();
  const r = await call(`/api/cases/${CASE}/check`, { text: e.text });
  const row = { group: e.group, id: e.id, run: e.run, overall: r.comparison?.overall ?? null, mode: r.mode ?? null,
    contradicts: (r.comparison?.findings || []).filter((f) => f.verdict === "contradicts").map((f) => f.id).join(","),
    gateDropped: (r.trace || []).filter((s) => /dropped/.test(s.step)).map((s) => s.result).join("; "),
    violations: (r.violations || []).length, ...prov, modelError: r.modelError ? String(r.modelError).slice(0, 120) : null, error: r.error || null, ms: Date.now() - t0 };
  console.log(JSON.stringify(row));
  const red = row.overall === "mismatch";
  if (/genuine/.test(e.group)) { tally.genuine++; tally.genuineRed += red; } else { tally.scams++; tally.scamRed += red; }
  tally.model += row.mode === "agent";
}
console.error(`scams red ${tally.scamRed}/${tally.scams} · genuine red ${tally.genuineRed}/${tally.genuine} · judged by the model ${tally.model}/${emails.length}`);
