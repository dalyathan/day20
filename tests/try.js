// Game helper. Usage:
//   node tests/try.js email <file>   -> how Still Open reads an email against Maya's open case (day 7)
//   node tests/try.js note "<text>"  -> which honesty rules a sentence breaks
//   node tests/try.js facts '<json>' -> next step + one-page case for buyer-entered facts (Maya's open case, day 7)
import { readFileSync } from "node:fs";
process.env.REPLAY = "1"; process.env.DATA_DIR = "/tmp/day20-try";
const { readCase } = await import("../lib/cases.js");
const { extractClaims } = await import("../lib/claims.js");
const { compare } = await import("../lib/compare.js");
const { checkText, templateNote } = await import("../lib/rules.js");
const { nextStep } = await import("../lib/advice.js");
const { buildPage } = await import("../lib/onepage.js");
const [mode, arg] = process.argv.slice(2);
const r = await readCase("PP-R-UZH-10198816", { scenario: "open_day7" });
const now = new Date(new Date(r.openedAt).getTime() + 7 * 86400000 + 3600000);
if (mode === "email") {
  const text = readFileSync(arg, "utf8");
  const claims = extractClaims(text);
  const cmp = compare(claims, r, now);
  console.log(JSON.stringify({ overall: cmp.overall, headline: cmp.headline, report: cmp.report, bottomLine: cmp.bottomLine, findings: cmp.findings.map((f) => `${f.verdict}: ${f.says} | record: ${f.record}`), claimsRead: claims, note: templateNote(cmp, nextStep(r, {}, now)) }, null, 2));
} else if (mode === "note") {
  const { phase } = await import("../lib/record.js");
  console.log(JSON.stringify({ text: arg, broken: checkText(arg, { record: r, phase: phase(r), stepKind: "escalate" }) }));
} else if (mode === "facts") {
  const f = JSON.parse(arg);
  const s = nextStep(r, f, now);
  console.log(JSON.stringify({ step: { kind: s.kind, title: s.title, body: s.body }, page: buildPage(r, f, []).plain }, null, 2));
} else console.log("usage: node tests/try.js email <file> | note '<text>' | facts '<json>'");
