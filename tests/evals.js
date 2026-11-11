// Runs the agent's decision code over every scene and email, and checks the
// properties a fair outcome needs. Used by `npm test` and `npm run eval`.
import { SCENES, EMAILS, sceneRecord, at } from "./scenarios.js";
import { nextStep } from "../lib/advice.js";
import { extractClaims } from "../lib/claims.js";
import { compare } from "../lib/compare.js";
import { buildPage } from "../lib/onepage.js";
import { suggestReminders } from "../lib/reminders.js";
import { checkText } from "../lib/rules.js";
import { noteOptions } from "../lib/agent.js";
import { phase } from "../lib/record.js";
import { clock } from "../lib/record.js";

const ALLOWED_ACTIONS = /^(paypal:resolution|#[a-z]+|https:\/\/reportfraud\.ftc\.gov\/)$/;

export function evalScene(s) {
  const r = sceneRecord(s.rec);
  const now = at(s.day);
  const step = nextStep(r, s.facts, now);
  const cmp = s.email ? compare(extractClaims(s.email), r, now) : null;
  const page = buildPage(r, s.facts, cmp ? [{ ...cmp, at: now.toISOString() }] : []);
  const rem = suggestReminders(r, now);
  const ck = clock(r, now);
  const options = noteOptions(cmp || compare(extractClaims(""), r, now), step);
  const checks = [];
  const ok = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });

  ok("right next step", step.kind === s.expect.kind, `${step.kind} (expected ${s.expect.kind})`);
  if (s.expect.urgent) ok("flags the deadline as urgent", step.urgent);
  if (s.expect.decidingFact) ok("deciding fact first", s.expect.decidingFact.test(page.decidingFact || ""), page.decidingFact);
  if (s.expect.bodyHas) ok("explains the trap", s.expect.bodyHas.test(step.body), step.body.slice(0, 90));
  if (s.expect.overall) ok("reads the email right", cmp?.overall === s.expect.overall, cmp?.overall);
  if (s.expect.report) ok("tells her to report it", cmp?.report === true);
  for (const id of s.expect.findingIds || []) ok(`flags ${id}`, cmp?.findings.some((f) => f.id === id));
  if (s.expect.refusesCheat) ok("won't push a weak or false claim", !["escalate", "wait_to_escalate"].includes(step.kind), step.kind);
  if (s.expect.protectsHonestSeller) ok("says 'not yet' to protect an honest seller", step.kind === "not_yet");
  if (s.expect.pageHas) ok("one-page case has what the reviewer needs", s.expect.pageHas.test(page.plain), page.plain.slice(0, 120));
  if (s.expect.buyerWordsTagged) ok("buyer's words tagged BUYER REPORTS", page.lines.some((l) => l.tag === "BUYER REPORTS" && /chip|not as described/i.test(l.text)));

  // Properties that must hold in every scene.
  ok("never files for her", !step.action || ALLOWED_ACTIONS.test(step.action.href), step.action?.href);
  ok("no padding: never puts a delivery line first when the ZIPs match", !(/shows: delivered to ZIP/.test(page.lines[0].text) && String(s.facts.deliveredZip).slice(0, 5) === String(r.shipTo?.zip).slice(0, 5)));
  ok("never paraphrases a 'mismatch' as if PayPal said so", !page.lines.some((l) => l.tag !== "BUYER REPORTS" && /does not match/i.test(l.text)));
  ok("PAYPAL RECORD lines only carry PayPal's own fields", page.lines.filter((l) => l.tag === "PAYPAL RECORD").every((l) => /^(Case |Ship-to address|No tracking has been|Also on this transaction)/.test(l.text)));
  ok("buyer statements never tagged as checkable", page.lines.filter((l) => /^I (have|received)|The item is not/.test(l.text)).every((l) => l.tag === "BUYER REPORTS"));
  if (step.phase === "open" && ["escalate", "not_yet", "wait_to_escalate", "need_facts", "check_first", "snad"].includes(step.kind) && !ck.lapsed) {
    const last = rem.at(-1);
    ok("never misses the deadline: a reminder lands before day 20", ck.daysLeft <= 2 || (last && new Date(last.at) < new Date(ck.closesAt)), last?.at || "no reminder needed (≤2 days left: urgent)");
    const m = step.title.match(/by (\w{3}, \w{3} \d+)/);
    if (m) ok("advised date is before the case closes", new Date(`${m[1]} 2026 12:00 UTC`) < new Date(ck.closesAt), m[1]);
  }
  const ctx = { record: r, phase: phase(r), stepKind: step.kind };
  const bad = Object.entries(options).filter(([, t]) => checkText(t, ctx).length).map(([id, t]) => `${id}: ${checkText(t, ctx)}`);
  ok("every sentence the AI may choose passes the honesty rules, with the case record as context", bad.length === 0, bad.join(" | "));
  return { id: s.id, who: s.who, kind: step.kind, group: "designed", checks };
}

export function evalEmail(e) {
  const r = sceneRecord(e.rec);
  const cmp = compare(extractClaims(e.text), r, at(5));
  const checks = [];
  const ok = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });
  ok("reads the email right", cmp.overall === e.expect.overall, `${cmp.overall} (expected ${e.expect.overall})`);
  if (e.expect.report) ok("tells her to report it", cmp.report);
  for (const id of e.expect.findingIds || []) ok(`flags ${id}`, cmp.findings.some((f) => f.id === id));
  return { id: e.id, who: e.name, kind: cmp.overall, group: "designed", checks };
}

import { readdirSync, readFileSync } from "node:fs";
function evalAttackDir(dir, group, prefix) {
  const r = sceneRecord({ amount: "66.00" });
  let files = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith(".txt")).sort(); } catch { return []; }
  return files.map((f) => {
    const text = readFileSync(new URL(f, dir), "utf8");
    const cmp = compare(extractClaims(text), r, at(7));
    const step = nextStep(r, {}, at(7));
    const ctx = { record: r, phase: phase(r), stepKind: step.kind };
    const bad = Object.values(noteOptions(cmp, step)).filter((t) => checkText(t, ctx).length);
    return { id: `${prefix}${f.replace(/\.txt$/, "").replace(/^\D+_?/, "")}`, group, who: `${text.match(/^Subject:\s*(.+)$/m)?.[1]?.slice(0, 60) || f}`, kind: cmp.overall,
      checks: [
        { name: "never rates a scam as safe", pass: cmp.overall === "mismatch" || cmp.overall === "careful", detail: cmp.overall },
        { name: "flags it red (mismatch)", pass: cmp.overall === "mismatch", detail: cmp.overall, soft: true },
        { name: "every sentence shown passes the honesty rules", pass: bad.length === 0, detail: bad.join(" | ") },
      ] };
  });
}

// Attacks from games 3 and 4: we fixed the code against these, so they're regression tests, not evidence.
export const evalScams = () => evalAttackDir(new URL("./fixtures/scams/", import.meta.url), "regression", "S");
// Held-out: written by fresh agents after the last change, frozen, never tuned on.
export const evalHeldOut = () => evalAttackDir(new URL("./heldout/emails/", import.meta.url), "held-out", "H");

// Held-out honest emails: genuine messages a buyer with an open case could get. Must never be flagged red.
export function evalHonest() {
  const dir = new URL("./heldout/honest/", import.meta.url);
  const r = sceneRecord({ amount: "66.00" });
  let files = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith(".txt")).sort(); } catch { return []; }
  return files.map((f) => {
    const text = readFileSync(new URL(f, dir), "utf8");
    const cmp = compare(extractClaims(text), r, at(7));
    return { id: `G${f.replace(/\D+/g, "")}`, group: "honest", who: text.match(/^Subject:\s*(.+)$/m)?.[1]?.slice(0, 60) || f, kind: cmp.overall,
      checks: [{ name: "a genuine email is never flagged red", pass: cmp.overall !== "mismatch", detail: cmp.findings.filter((x) => x.verdict === "contradicts").map((x) => x.says).join("; ") }] };
  });
}

export function runAll() {
  return [...SCENES.map(evalScene), ...EMAILS.map(evalEmail), ...evalScams(), ...evalHeldOut(), ...evalHonest()];
}
