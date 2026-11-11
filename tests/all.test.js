import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.DATA_DIR = "/tmp/day20-test-" + process.pid;
process.env.REPLAY = "1";

const { runAll } = await import("./evals.js");
const { checkText } = await import("../lib/rules.js");
const { encrypt, decrypt } = await import("../lib/push.js");
const { runCheck } = await import("../lib/agent.js");
const { sceneRecord, at } = await import("./scenarios.js");

test("eval suite: designed and regression cases pass (held-out is reported by npm run eval, not gated)", () => {
  for (const r of runAll().filter((x) => !["held-out", "honest"].includes(x.group))) for (const c of r.checks.filter((c) => !c.soft)) assert.ok(c.pass, `${r.id} ${c.name}: ${c.detail}`);
});

test("the rules-only red rate on the scam regression set doesn't drop below what we publish (9/24)", () => {
  const scams = runAll().filter((x) => x.group === "regression");
  const red = scams.filter((x) => x.kind === "mismatch").length;
  assert.equal(scams.length, 24);
  assert.ok(red >= 9, `only ${red}/24 scams flagged red; the README says 9/24 for rules alone`);
});

test("honesty rules catch what the AI must never write", () => {
  const bad = {
    R1: "Good news, I escalated your case to PayPal.",
    R2: "You will definitely win this one.",
    R3: "Click the link in the email to confirm.",
    R4: "The seller sent this email to trick you.",
    R5: "Your delivery address is verified.",
    R6: "You could file it as unauthorized instead.",
    R7: "See https://bit.ly/refund-now for details.",
    R8: "Your refund has been issued.",
  };
  const ctx = { record: sceneRecord({ amount: "66.00" }), phase: "open", stepKind: "escalate" };
  for (const [id, text] of Object.entries(bad)) assert.ok(checkText(text, ctx).includes(id), `${id} missed: ${text}`);
  const good = "This email says $66 was refunded, but your PayPal case shows no refund. Don't use its links; forward it to phishing@paypal.com. Your case closes on Dec 1 unless you escalate in the PayPal app.";
  assert.deepEqual(checkText(good), []);
  assert.deepEqual(checkText("PayPal's record shows your case is open."), []);
});

test("red-team sentences from game 3: harmful ones caught, helpful ones kept", async () => {
  const { NOTES } = await import("./redteam_notes.js");
  const ctx = { record: sceneRecord({ amount: "66.00" }), phase: "open", stepKind: "escalate" };
  for (const [id, t] of NOTES) {
    const v = checkText(t, ctx);
    if (id.startsWith("M")) assert.ok(v.length > 0, `${id} missed: ${t}`);
    else assert.deepEqual(v, [], `${id} false alarm ${v}: ${t}`);
  }
});

test("web push encryption matches the RFC 8291 test vector", () => {
  const as = crypto.createECDH("prime256v1");
  as.setPrivateKey(Buffer.from("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw", "base64url"));
  const sub = { keys: { p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" } };
  const out = encrypt("When I grow up, I want to be a watermelon", sub, { salt: Buffer.from("DGv6ra1nlYgDCS1FRnbzlw", "base64url"), ecdh: as });
  assert.equal(out.toString("base64url"), "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
  const ua = crypto.createECDH("prime256v1"); ua.generateKeys(); const auth = crypto.randomBytes(16);
  const body = encrypt("hello", { keys: { p256dh: ua.getPublicKey().toString("base64url"), auth: auth.toString("base64url") } });
  assert.equal(decrypt(body, ua, auth), "hello");
});

test("the model can't put its own words in front of the buyer, and can't act", async () => {
  const realFetch = globalThis.fetch;
  process.env.ANTHROPIC_API_KEY = "test";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    const content = calls === 1
      ? [{ type: "tool_use", id: "t1", name: "read_case", input: {} }, { type: "tool_use", id: "t2", name: "read_claim", input: { refundClaimed: { amount: 70 } } }, { type: "tool_use", id: "t3", name: "compare", input: {} }]
      : calls === 2
        ? [{ type: "text", text: "I escalated your case and you will definitely win." }, { type: "tool_use", id: "t4", name: "compose_note", input: { ids: ["f_refund", "made_up_id", "report"] } }]
        : [{ type: "text", text: "Done." }];
    return new Response(JSON.stringify({ content, stop_reason: calls <= 2 ? "tool_use" : "end_turn" }), { status: 200 });
  };
  try {
    const r = sceneRecord({ amount: "70.00" });
    const out = await runCheck({ record: r, facts: {}, text: "Your refund has been processed.", now: at(5) });
    assert.equal(out.mode, "agent");
    assert.ok(!/escalated|definitely/.test(out.note), "model free text must never be shown");
    assert.deepEqual(out.noteIds, ["bottom", "f_refund", "report"]);
    assert.deepEqual(out.violations, []);
    assert.equal(out.comparison.overall, "mismatch");
  } finally { globalThis.fetch = realFetch; delete process.env.ANTHROPIC_API_KEY; }
});

test("Spanish: the buyer sees Spanish sentences written by code", async () => {
  const out = await runCheck({ record: sceneRecord({ amount: "66.00" }), facts: {}, text: "Su reembolso ya fue procesado. Su caso ha sido cerrado.", now: at(7), lang: "es" });
  assert.equal(out.comparison.overall, "mismatch");
  assert.match(out.note, /PayPal no muestra ningún reembolso/);
});

test("if the model is down, the rules still answer", async () => {
  const realFetch = globalThis.fetch;
  process.env.ANTHROPIC_API_KEY = "test";
  globalThis.fetch = async () => { throw new Error("network down"); };
  try {
    const out = await runCheck({ record: sceneRecord(), facts: {}, text: "Your case has been closed. No further action is required.", now: at(5) });
    assert.equal(out.mode, "rules");
    assert.equal(out.comparison.overall, "mismatch");
    assert.ok(out.modelError);
  } finally { globalThis.fetch = realFetch; delete process.env.ANTHROPIC_API_KEY; }
});

test("server: demo, case, check, page, disconnect", async () => {
  const { server } = await import("../server.js");
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { "content-type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return { status: res.status, json: await res.json().catch(() => null), headers: res.headers };
  };
  try {
    assert.equal((await call("GET", "/api/cases")).status, 401);
    await call("POST", "/api/demo", {});
    const list = await call("GET", "/api/cases");
    const id = list.json.cases[0].id;
    const c = await call("GET", `/api/cases/${id}`);
    assert.equal(c.json.view.refund, "none");
    assert.ok(c.headers.get("content-security-policy").includes("script-src 'self'"));
    const chk = await call("POST", `/api/cases/${id}/check`, { text: "The seller has issued a full refund of $66.00. Your case has been resolved." });
    assert.equal(chk.json.comparison.overall, "mismatch");
    const pg = await call("GET", `/api/cases/${id}/page`);
    assert.ok(pg.json.plain.includes("refund so far: none"));
    assert.equal((await call("GET", "/api/cases/PP-D-00000000")).status, 404);
    // Push subscriptions only to real browser push services (no requests to arbitrary hosts).
    const keys = { p256dh: "x", auth: "y" };
    assert.equal((await call("POST", "/api/push/subscribe", { endpoint: "https://169.254.169.254/latest", keys })).status, 400);
    assert.equal((await call("POST", "/api/push/subscribe", { endpoint: "https://fcm.googleapis.com.evil.test/x", keys })).status, 400);
    assert.equal((await call("POST", "/api/push/subscribe", { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys })).status, 200);
    // A forged session cookie is refused.
    const good = cookie; cookie = good.replace(/\.[^.]*$/, ".AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    assert.equal((await call("GET", "/api/cases")).status, 401);
    cookie = good;
    await call("POST", "/api/disconnect");
    assert.equal((await call("GET", "/api/cases")).status, 401);
  } finally { server.close(); }
});

test("dates follow the buyer's time zone; bad zones fall back to UTC", async () => {
  const { withTz } = await import("../lib/tz.js");
  const { fmtDate } = await import("../lib/compare.js");
  const at = "2026-12-01T03:00:00Z"; // still Nov 30 in California
  assert.equal(fmtDate(at), "Tue, Dec 1");
  assert.equal(withTz("America/Los_Angeles", () => fmtDate(at)), "Mon, Nov 30");
  assert.equal(withTz("../../etc", () => fmtDate(at)), "Tue, Dec 1");
});

test("MCP server: lists read-only tools, reads the saved case, refuses other IDs in replay", async () => {
  const { spawn } = await import("node:child_process");
  const p = spawn(process.execPath, [new URL("../mcp/server.js", import.meta.url).pathname], { env: { ...process.env, REPLAY: "1" }, stdio: ["pipe", "pipe", "pipe"] });
  const lines = []; let buf = "";
  p.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const ask = async (id, method, params) => {
    p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    for (let t = 0; t < 100; t++) { const m = lines.find((x) => x.id === id); if (m) return m; await new Promise((r) => setTimeout(r, 30)); }
    throw new Error("no reply " + method);
  };
  try {
    const init = await ask(1, "initialize", { protocolVersion: "2025-06-18" });
    assert.match(init.result.instructions, /REPLAY MODE/);
    const list = await ask(2, "tools/list");
    assert.ok(list.result.tools.length >= 5 && list.result.tools.every((t) => t.annotations?.readOnlyHint));
    const ok = await ask(3, "tools/call", { name: "day20_read_case", arguments: { dispute_id: "PP-R-UZH-10198816" } });
    assert.ok(!ok.result.isError);
    const other = await ask(4, "tools/call", { name: "day20_read_case", arguments: { dispute_id: "PP-D-12345" } });
    assert.ok(other.result.isError && /only has the saved sandbox case/.test(other.result.content[0].text));
  } finally { p.kill(); }
});

test("model red flags need a plain quoted sentence (live false alarms g5_02, g7_01; live catches s2_01, s2_08)", async () => {
  const { gateModelClaims } = await import("../lib/agent.js");
  const { readFileSync } = await import("node:fs");
  const f = (n) => readFileSync(new URL(`./fixtures/${n}.txt`, import.meta.url), "utf8");
  const gate = (field, quote, text) => gateModelClaims({}, { [field]: true, evidence: quote ? { [field]: quote } : undefined }, text).kept[field] === true;
  // Kept: the model caught reworded refund lies the keyword reader missed.
  assert.ok(gate("refundClaimed", "Your $66.00 is already sitting in your PayPal balance on our side", f("scams/s2_01")));
  assert.ok(gate("refundClaimed", "We've gone ahead and taken care of the $66.00 on our end today - it's done, finished, handled.", f("scams/s2_08")));
  // Dropped: conditional, offer, negated, cherry-picked, invented, or no quote at all.
  assert.ok(!gate("refundClaimed", "If you accept it there, the refund of $20 would be sent to your PayPal balance right away.", f("honest/g5_02")));
  assert.ok(!gate("refundClaimed", "I'd also like to offer you a partial refund of $20 for the hassle.", f("honest/g5_02")));
  assert.ok(!gate("refundClaimed", "No refund has been issued on this transaction yet.", f("honest/g7_01")));
  assert.ok(!gate("refundClaimed", "refund has been issued on this transaction", f("honest/g7_01")));
  assert.ok(!gate("refundClaimed", "Your refund of $66 has been issued.", f("scams/s2_01")));
  assert.ok(!gate("refundClaimed", null, f("scams/s2_01")));
  // Fields that can't turn an email red pass through without evidence.
  assert.equal(gateModelClaims({}, { urgency: true }, "x").kept.urgency, true);
});

test("gate judges the clause that makes the claim (live miss on s2_01, Nov 11)", async () => {
  const { gateModelClaims } = await import("../lib/agent.js");
  const { readFileSync } = await import("node:fs");
  const t = readFileSync(new URL("./fixtures/scams/s2_01.txt", import.meta.url), "utf8");
  const g = (q) => gateModelClaims({}, { refundClaimed: true, evidence: { refundClaimed: q } }, t).kept.refundClaimed === true;
  assert.ok(g("Your $66.00 is already sitting in your PayPal balance on our side - take a look under Activity when you get a chance and it should be there for you."));
  assert.ok(!g("take a look under Activity when you get a chance and it should be there for you."));
});

test("gate: requests may be conditional but must ask (live miss on scam_06, Nov 11)", async () => {
  const { gateModelClaims } = await import("../lib/agent.js");
  const { readFileSync } = await import("node:fs");
  const f = (n) => readFileSync(new URL(`./fixtures/${n}.txt`, import.meta.url), "utf8");
  const g = (field, q, t) => gateModelClaims({}, { [field]: true, evidence: { [field]: q } }, t).kept[field] === true;
  assert.ok(g("asksToCloseCase", "If that works for you, please end the PayPal claim from your side and reply \"OK\" to this email.", f("scams/scam_06")));
  assert.ok(g("asksForSecret", "Please reply to this email with that code before the end of the day so the refund isn't sent back to the seller.", f("scams/scam_11")));
  // PayPal's own "you can close the case" is permission, not a request; "you don't need to close" is negated.
  assert.ok(!g("asksToCloseCase", "If you've resolved this with the seller, you can close the case in the Resolution Center.", f("honest/g5_07")));
  assert.ok(!g("asksToCloseCase", "you don't need to close or change your PayPal case because of it", f("honest/g7_03")));
  // Statements of fact still can't be conditional.
  assert.ok(!g("refundClaimed", "If you accept it there, the refund of $20 would be sent to your PayPal balance right away.", f("honest/g5_02")));
});

test("gate keeps real catches the engineer judge found it dropping (round 2)", async () => {
  const { gateModelClaims } = await import("../lib/agent.js");
  const g = (q, t = q) => gateModelClaims({}, { refundClaimed: true, evidence: { refundClaimed: q } }, t).kept.refundClaimed === true;
  assert.ok(g("After reviewing your case, we've sent the $66.00 back to your account."));
  assert.ok(g("We can confirm the $66.00 is back in your PayPal balance."));
  assert.ok(g("We've sent the $66.00 back, so there's no need to escalate."));
  assert.ok(g("Your $66.00 refund is done - check your balance.", "Hi,\n\nYour $66.00 refund is done – check your balance.\n"));
  assert.ok(!g("The refund of $66.00 would be sent once you close the case."));
  assert.ok(!g("A refund may be issued after review."));
});

test("gate: a hypothetical after the quote still blocks; full-sentence quotes work (AI-assurance judge, round 2)", async () => {
  const { gateModelClaims } = await import("../lib/agent.js");
  const { readFileSync } = await import("node:fs");
  const g = (q, t = q) => gateModelClaims({}, { refundClaimed: true, evidence: { refundClaimed: q } }, t).kept.refundClaimed === true;
  const t = "Hi Maya,\n\nYour partial refund of $20 will be sent to your balance as soon as you accept it.\n";
  assert.ok(!g("Your partial refund of $20 will be sent to your balance", t));
  const s201 = readFileSync(new URL("./fixtures/scams/s2_01.txt", import.meta.url), "utf8");
  assert.ok(g("Your $66.00 is already sitting in your PayPal balance on our side - take a look under Activity when you get a chance and it should be there for you.", s201));
});

test("gate: case IDs and links must be in the email as written (AI-assurance judge, round 2)", async () => {
  const { gateModelClaims } = await import("../lib/agent.js");
  const t = "Hi Maya, your order #JL1042 shipped. Questions: hello@juniperandlace.com or https://juniperandlace.com/help";
  const k = gateModelClaims({}, { caseIds: ["JL1042", "PP-R-ABC-12345678"], links: ["https://juniperandlace.com/help", "https://paypa1-secure.com"] }, t).kept;
  assert.deepEqual(k.caseIds, []);
  assert.deepEqual(k.links, ["https://juniperandlace.com/help"]);
});

test("refunds made on the payment count; a partial refund of unknown size is never 'no refund'", async () => {
  const { normalize, money } = await import("../lib/record.js");
  const d = { dispute_id: "PP-R-AAA-11111111", disputed_transactions: [{}], dispute_amount: { value: "66.00", currency_code: "USD" } };
  const order = (capStatus, refunds) => ({ purchase_units: [{ payments: { captures: [{ status: capStatus, amount: { value: "66.00" } }], refunds } }] });
  assert.equal(normalize(d, order("REFUNDED", [{ status: "COMPLETED", amount: { value: "66.00" } }])).refund.value, "66.00");
  assert.equal(normalize(d, order("PARTIALLY_REFUNDED", [{ status: "COMPLETED", amount: { value: "20.00" } }])).refund.value, "20.00");
  // The dispute hold shows as a PENDING refund: not a refund.
  assert.equal(normalize(d, order("COMPLETED", [{ status: "PENDING", amount: { value: "66.00" } }])).refund, null);
  // Order unreadable but the capture says partially refunded: amount unknown, still a refund.
  const r = normalize(d, null, [], { status: "PARTIALLY_REFUNDED", amount: { value: "66.00" } });
  assert.equal(money(r.refund), "a partial amount");
});

test("rate limits key on the real address: proxy headers only when the deployment trusts that proxy", async () => {
  const { clientIp } = await import("../server.js");
  const req = (h) => ({ headers: h, socket: { remoteAddress: "10.0.0.1" } });
  const spoof = { "x-forwarded-for": "1.2.3.4, 203.0.113.9", "cf-connecting-ip": "198.51.100.7" };
  assert.equal(clientIp(req(spoof), undefined), "10.0.0.1");        // nothing trusted: a client can send any header
  assert.equal(clientIp(req(spoof), "cloudflare"), "198.51.100.7"); // behind Cloudflare, which overwrites it
  assert.equal(clientIp(req(spoof), "xff"), "203.0.113.9");          // last hop, appended by your own proxy
});

test("seller replied during the inquiry (WAITING_FOR_BUYER_RESPONSE): the 20-day clock still runs (PayPal judge, repo round)", async () => {
  const { phase } = await import("../lib/record.js");
  const { suggestReminders } = await import("../lib/reminders.js");
  const { compare } = await import("../lib/compare.js");
  const { extractClaims } = await import("../lib/claims.js");
  const r = { ...sceneRecord({ amount: "66.00" }), status: "WAITING_FOR_BUYER_RESPONSE", stage: "INQUIRY" };
  assert.equal(phase(r), "open");
  assert.ok(suggestReminders(r, at(7)).length > 0);
  const f = compare(extractClaims("Good news! Everything is handled. No further action is required."), r, at(7)).findings.find((x) => x.id === "no_action");
  assert.equal(f.verdict, "caution");
  // After escalation, the same status means PayPal is waiting on her.
  assert.equal(phase({ ...r, stage: "CHARGEBACK" }), "your_turn");
});

test("model requests send only parameters the model accepts (a rejected temperature silently disabled the AI live)", async () => {
  const realFetch = globalThis.fetch; const bodies = [];
  globalThis.fetch = async (url, opts) => { bodies.push(JSON.parse(opts.body)); return new Response(JSON.stringify({ content: [{ type: "tool_use", id: "t", name: "compose_note", input: { ids: ["bottom"] } }], stop_reason: "end_turn" }), { status: 200 }); };
  process.env.ANTHROPIC_API_KEY = "test";
  try {
    await runCheck({ record: sceneRecord({ amount: "66.00" }), text: "Your refund has been issued.", now: at(7) });
    assert.ok(bodies.length > 0);
    for (const b of bodies) assert.deepEqual(Object.keys(b).filter((k) => !["model", "max_tokens", "system", "tools", "messages"].includes(k)), []);
  } finally { globalThis.fetch = realFetch; delete process.env.ANTHROPIC_API_KEY; }
});

test("model amounts must appear in the email; emailed tracking numbers are the buyer's report (security judge, Devpost round)", async () => {
  const { gateModelClaims } = await import("../lib/agent.js");
  const t = "Hi Maya,\n\nYour $66.00 is already sitting in your PayPal balance on our side.\n";
  const q = "Your $66.00 is already sitting in your PayPal balance on our side.";
  assert.equal(gateModelClaims({}, { refundClaimed: { amount: 66 }, evidence: { refundClaimed: q } }, t).kept.refundClaimed.amount, 66);
  assert.equal(gateModelClaims({}, { refundClaimed: { amount: 6600 }, evidence: { refundClaimed: q } }, t).kept.refundClaimed.amount, null);
  const { buildPage } = await import("../lib/onepage.js");
  const r = sceneRecord({ amount: "66.00" });
  const pg = buildPage(r, {}, [{ findings: [{ id: "tracking_FAKE123456789", verdict: "cant_check" }] }]);
  const line = pg.lines.find((l) => l.text.includes("FAKE123456789"));
  assert.equal(line.tag, "BUYER REPORTS");
});

test("the PayPal client refuses writes unless a setup script opts in (read-only by construction)", async () => {
  const { pp } = await import("../lib/paypal.js");
  const realFetch = globalThis.fetch; let called = 0;
  globalThis.fetch = async () => { called++; return new Response("{}", { status: 200 }); };
  try {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) await assert.rejects(pp("/v1/customer/disputes/X/accept-claim", { method, token: "t" }), /read-only/);
    assert.equal(called, 0);
    await pp("/v1/customer/disputes/X", { token: "t" });
    assert.equal(called, 1);
  } finally { globalThis.fetch = realFetch; }
});

test("a refund for another purchase isn't called a lie about her case, and she keeps scam emails as evidence (judge round 3)", async () => {
  const { readFileSync } = await import("node:fs");
  const r = await runCheck({ record: sceneRecord(), facts: {}, text: readFileSync(new URL("./heldout/honest/h8_01.txt", import.meta.url), "utf8"), now: at(7) });
  assert.equal(r.comparison.overall, "careful");
  assert.equal(r.comparison.report, false);
  assert.ok(r.comparison.findings.some((f) => f.id === "refund_other"));
  const scam = await runCheck({ record: sceneRecord(), facts: {}, now: at(7), text: "From: PayPal <service@paypal.com>\nSubject: Refund issued\n\nThe seller has issued a full refund of $66.00 USD. Your case has been resolved."});
  assert.equal(scam.comparison.overall, "mismatch");
  assert.ok(!/delete it/i.test(scam.note) && /keep it/i.test(scam.note));
});
