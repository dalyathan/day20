// Summarises live-eval JSONL files: red ("mismatch") counts per group and run, and per-email consistency.
//   node scripts/live-summary.mjs tests/live/live-*.jsonl
import { readFileSync } from "node:fs";
const rows = process.argv.slice(2).flatMap((f) => readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const key = (r) => `${r.group} @ ${String(r.commit).slice(0, 7)}`;
const groups = [...new Set(rows.map(key))];
for (const g of groups) {
  const gr = rows.filter((r) => key(r) === g);
  const runs = [...new Set(gr.map((r) => r.run))].sort();
  const perRun = runs.map((k) => { const x = gr.filter((r) => r.run === k); return `${x.filter((r) => r.overall === "mismatch").length}/${x.length}`; });
  const ids = [...new Set(gr.map((r) => r.id))];
  const always = ids.filter((id) => gr.filter((r) => r.id === id).every((r) => r.overall === "mismatch")).length;
  const ever = ids.filter((id) => gr.some((r) => r.id === id && r.overall === "mismatch")).length;
  const notModel = gr.filter((r) => r.mode !== "agent").length;
  const closeWarn = gr.some((r) => "cautions" in r) ? ` · told "Don't close it" per run ${runs.map((k) => { const x = gr.filter((r) => r.run === k); return `${x.filter((r) => /close_request/.test(r.cautions || "")).length}/${x.length}`; }).join(", ")}` : "";
  console.log(`${g}${closeWarn ? "" : ""}: red per run ${perRun.join(", ")} · red in every run ${always}/${ids.length} · red in any run ${ever}/${ids.length}${notModel ? ` · ${notModel} not judged by the model` : ""}${closeWarn}`);
}
const commits = [...new Set(rows.map((r) => r.commit))];
console.log(`commits: ${commits.join(", ")} · model: ${[...new Set(rows.map((r) => r.model))].join(", ")}`);
