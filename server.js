// Day 20 web server. Zero dependencies: Node 22 built-ins only.
import http from "node:http";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize as normPath } from "node:path";
import { readSession, startSession, updateSession, endSession, loginEnabled, loginUrl, finishLogin, safeEqual } from "./lib/auth.js";
import { readCase, casesFor, source, DEMO_DISPUTE_ID, SCENARIOS } from "./lib/cases.js";
import { phase, clock, money, REASONS, STATUS_WORDS } from "./lib/record.js";
import { nextStep } from "./lib/advice.js";
import { esStep } from "./lib/es.js";
import { buildPage, cleanText, cleanZip, cleanCity } from "./lib/onepage.js";
import { runCheck } from "./lib/agent.js";
import { withTz } from "./lib/tz.js";
import { suggestReminders, toICS } from "./lib/reminders.js";
import { dbOk, facts as factsDb, checks as checksDb, push as pushDb, reminders as remDb, forget, cleanup } from "./lib/store.js";
import { vapidKeys, sendPush, sendEmail } from "./lib/push.js";
import { WEB, ENV } from "./lib/paypal.js";

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = new URL("./public/", import.meta.url).pathname;
const DAY = 86400000;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json", ".ico": "image/x-icon" };

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://www.sandbox.paypal.com https://www.paypal.com",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", ...SECURITY_HEADERS });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
};

async function readBody(req, limit = 7_000_000) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error("too large"), { status: 413 }); chunks.push(c); }
  const s = Buffer.concat(chunks).toString("utf8");
  return s ? JSON.parse(s) : {};
}

const owner = (s) => (s.demo ? `demo:${s.sid}` : `pp:${s.payerId}`);
const nowFor = (s, r) => (s.demoDay != null && r?.openedAt ? new Date(new Date(r.openedAt).getTime() + s.demoDay * DAY + 3600000) : new Date());
const isSecure = (req) => (req.headers["x-forwarded-proto"] || "").includes("https");

// Only real browser push services. Anything else would let a caller make us send requests to any host.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
export function pushHostAllowed(endpoint) {
  try { const u = new URL(endpoint); return u.protocol === "https:" && !u.port && PUSH_HOSTS.some((re) => re.test(u.hostname)); } catch { return false; }
}
// The caller's address. A client can put anything at the start of x-forwarded-for; the proxy appends the
// real address, so take the last entry. Cloudflare's own header wins when present (it overwrites it).
export function clientIp(req) {
  const cf = req.headers["cf-connecting-ip"] || req.headers["true-client-ip"];
  if (cf) return String(cf).trim();
  const xff = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
  return xff.length ? xff[xff.length - 1] : String(req.socket?.remoteAddress || "");
}

// Simple per-session and per-address limits on model calls and new demo sessions.
const hits = new Map();
function limited(key, max = 20, windowMs = 3600000) {
  const now = Date.now(); const arr = (hits.get(key) || []).filter((t) => t > now - windowMs);
  arr.push(now); hits.set(key, arr); return arr.length > max;
}
// Forget keys with no recent hits, so made-up keys can't grow memory.
setInterval(() => { const cut = Date.now() - 3600000; for (const [k, v] of hits) if (!v.some((t) => t > cut)) hits.delete(k); }, 600000).unref();

function caseSummary(r, s, f) {
  const now = nowFor(s, r);
  const ph = phase(r);
  return {
    record: r,
    view: {
      id: r.disputeId,
      reason: s.lang === "es" ? ({ MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Artículo no recibido", MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "No es como se describió" }[r.reason] || REASONS[r.reason] || r.reason) : REASONS[r.reason] || r.reason,
      amount: money(r.amount),
      refund: r.refund ? money(r.refund) : "none",
      status: s.lang === "es" ? { open: "Abierto", with_paypal: "Con un revisor de PayPal", your_turn: "Esperando tu respuesta", resolved: "Resuelto" }[ph] : STATUS_WORDS[ph],
      refundWord: s.lang === "es" ? (r.refund ? money(r.refund) : "ninguno") : null,
      rawStatus: r.status,
      phase: ph,
      clock: clock(r, now),
      item: (r.items?.[0] || "").replace(/\s*\(Day 20 demo\)\s*$/i, "") || null,
      seller: r.sellerName,
      shipTo: r.shipTo ? `${r.shipTo.city}, ${r.shipTo.state} ${r.shipTo.zip}` : null,
      tracking: (r.trackers || []).map((t) => `${t.carrier || ""} ${t.number}`.trim()),
      source: r.source,
      sourceLabel: s.lang === "es" ? (r.source === "live" ? `En vivo desde PayPal ${ENV}` : r.source === "scenario" ? "Repetición: el mismo caso en la etapa abierta" : "Repetición de un caso real de sandbox") : r.source === "live" ? `Live from PayPal ${ENV}` : r.scenarioLabel,
    },
    facts: f,
    step: s.lang === "es" ? esStep(nextStep(r, f, now), r, f, now) : nextStep(r, f, now),
    reminders: suggestReminders(r, now),
    scheduled: remDb.list(owner(s), r.disputeId),
    now: now.toISOString(),
    demoDay: s.demoDay ?? null,
    scenario: s.scenario || null,
  };
}

async function api(req, res, url, s) {
  const p = url.pathname;
  const m = req.method;

  if (p === "/api/me" && m === "GET") {
    return send(res, 200, { signedIn: Boolean(s), demo: Boolean(s?.demo), name: s?.name || null, loginEnabled: loginEnabled(), source: source(), env: ENV, scenarios: Object.fromEntries(Object.entries(SCENARIOS).map(([k, v]) => [k, v.label])), lang: s?.lang || "en", demoDay: s?.demoDay ?? null, scenario: s?.scenario || null });
  }
  if (p === "/api/demo" && m === "POST") {
    if (limited("demo:" + clientIp(req), 30)) return send(res, 429, { error: "Too many new demos from here this hour. Try again later." });
    const b = await readBody(req).catch(() => ({}));
    const sess = startSession(res, { demo: true, name: "Maya", demoDay: 7, scenario: SCENARIOS[b.scenario] ? b.scenario : null, lang: b.lang === "es" ? "es" : "en" }, isSecure(req));
    // Maya's own answers, pre-filled so the demo starts where her story does. Labelled as hers everywhere.
    factsDb.set(`demo:${sess.sid}`, DEMO_DISPUTE_ID, { received: "no", tracking: "delivered", deliveredZip: "85705", deliveredCity: "Tucson, AZ", scanText: "Delivered, Front Door/Porch, TUCSON, AZ 85705", coverage: "goods" });
    return send(res, 200, { ok: true, demo: true, sid: undefined, demoDay: sess.demoDay });
  }

  if (!s) return send(res, 401, { error: "Sign in first." });

  if (p === "/api/settings" && m === "POST") {
    const b = await readBody(req);
    const patch = {};
    if (s.demo && "demoDay" in b) patch.demoDay = b.demoDay === null ? null : Math.max(0, Math.min(30, Number(b.demoDay) || 0));
    if (s.demo && "scenario" in b) patch.scenario = SCENARIOS[b.scenario] ? b.scenario : null;
    if ("lang" in b) patch.lang = b.lang === "es" ? "es" : "en";
    updateSession(s, patch);
    return send(res, 200, { ok: true });
  }

  if (p === "/api/disconnect" && m === "POST") {
    forget(owner(s), s.demo ? null : s.payerId);
    endSession(res, s);
    return send(res, 200, { ok: true, deleted: true });
  }

  if (p === "/api/cases" && m === "GET") {
    const ids = await casesFor(s);
    const out = [];
    for (const id of ids) { try { out.push(caseSummary(await readCase(id, { scenario: s.scenario }), s, factsDb.get(owner(s), id)).view); } catch (e) { out.push({ id, error: String(e.message).slice(0, 200) }); } }
    return send(res, 200, { cases: out });
  }

  const cm = p.match(/^\/api\/cases\/([A-Za-z0-9-]{6,40})(\/[a-z.]+)?$/);
  if (cm) {
    const id = cm[1], sub = cm[2] || "";
    const mine = await casesFor(s);
    if (!mine.includes(id)) return send(res, 404, { error: "That case isn't on your account." });
    const r = await readCase(id, { scenario: s.scenario });
    const o = owner(s);

    if (sub === "" && m === "GET") return send(res, 200, { ...caseSummary(r, s, factsDb.get(o, id)), history: checksDb.list(o, id).map(slimCheck) });

    if (sub === "/facts" && m === "POST") {
      const b = await readBody(req);
      const clean = {
        received: pick(b.received, ["no", "yes", "wrong_item", "not_as_described"]),
        tracking: pick(b.tracking, ["delivered", "in_transit", "stalled", "label_only", "none"]),
        deliveredZip: cleanZip(b.deliveredZip), deliveredCity: cleanCity(b.deliveredCity),
        expectedBy: /^\d{4}-\d{2}-\d{2}$/.test(b.expectedBy || "") ? b.expectedBy : null,
        coverage: pick(b.coverage, ["goods", "friends_family", "off_paypal"]),
        sellerResponding: b.sellerResponding === true,
        whatArrived: cleanText(b.whatArrived, 120), note: cleanText(b.note, 300),
        scanText: cleanText(b.scanText, 140), willingToReturn: b.willingToReturn === true,
      };
      factsDb.set(o, id, clean);
      return send(res, 200, caseSummary(r, s, clean));
    }

    if (sub === "/check" && m === "POST") {
      if (limited(o) || limited("ip:" + clientIp(req), 60)) return send(res, 429, { error: "That's a lot of checks for one hour. Try again later." });
      const b = await readBody(req);
      const text = str(b.text, 20000) || "";
      let image = null;
      if (b.image?.data && /^image\/(png|jpeg|webp|gif)$/.test(b.image.type || "")) image = { type: b.image.type, data: String(b.image.data).replace(/^data:[^,]+,/, "") };
      if (!text && !image) return send(res, 400, { error: "Paste the email or add a screenshot." });
      const f = factsDb.get(o, id);
      const history = checksDb.list(o, id);
      const result = await runCheck({ record: r, facts: f, text, image, history, now: nowFor(s, r), lang: s.lang });
      console.log(JSON.stringify({ ev: "check", mode: result.mode, verdict: result.comparison?.overall || null, findings: (result.comparison?.findings || []).map((x) => x.id), notes: result.noteIds || [], ruleHits: result.violations || [], modelError: Boolean(result.modelError) }));
      if (!result.needText) checksDb.add(o, id, nowFor(s, r).toISOString(), { overall: result.comparison.overall, findings: result.comparison.findings, headline: result.comparison.headline, mode: result.mode });
      return send(res, 200, result);
    }

    if (sub === "/reported" && m === "POST") { checksDb.markLastReported(o, id); return send(res, 200, { ok: true }); }

    if (sub === "/page" && m === "GET") {
      const pg = buildPage(r, factsDb.get(o, id), checksDb.list(o, id));
      return send(res, 200, pg);
    }

    if (sub === "/reminders.ics" && m === "GET") {
      const list = suggestReminders(r, nowFor(s, r));
      res.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="day20-${id}.ics"`, ...SECURITY_HEADERS });
      return res.end(toICS(r, list, { appUrl: process.env.PUBLIC_URL || "" }));
    }

    if (sub === "/reminders" && m === "POST") {
      const b = await readBody(req);
      const hour = Math.max(0, Math.min(23, Number(b.hour ?? 16)));
      const tz = Number.isFinite(Number(b.tzOffsetMin)) ? Number(b.tzOffsetMin) : 0; // minutes, as Date.getTimezoneOffset()
      const channel = b.channel === "email" ? "email" : "push";
      const email = channel === "email" ? str(b.email, 200) : null;
      const list = suggestReminders(r, nowFor(s, r)).map((x) => {
        const d = new Date(x.at.slice(0, 10) + "T00:00:00Z");
        return { at: new Date(d.getTime() + hour * 3600000 + tz * 60000).toISOString(), title: x.title, channel, email };
      });
      remDb.replace(o, id, s.demo ? [] : list); // demo sessions preview but don't schedule real sends
      return send(res, 200, { scheduled: s.demo ? [] : list, preview: list, demo: Boolean(s.demo) });
    }
  }

  if (p === "/api/push/key" && m === "GET") return send(res, 200, { key: vapidKeys().publicKey });
  if (p === "/api/push/subscribe" && m === "POST") {
    const b = await readBody(req);
    if (!b?.endpoint || !pushHostAllowed(b.endpoint) || !b.keys?.p256dh || !b.keys?.auth) return send(res, 400, { error: "Bad subscription" });
    pushDb.add(owner(s), { endpoint: b.endpoint, keys: { p256dh: b.keys.p256dh, auth: b.keys.auth } });
    return send(res, 200, { ok: true });
  }
  if (p === "/api/push/test" && m === "POST") {
    const subs = pushDb.forOwner(owner(s));
    const results = [];
    for (const sub of subs) results.push(await sendPush(sub, { title: "Day 20", body: "Reminders are on. Day 20 will never send you a link to sign in." }).catch((e) => ({ ok: false, error: e.message })));
    return send(res, 200, { sent: results.filter((x) => x.ok).length, total: subs.length });
  }

  return send(res, 404, { error: "Not found" });
}

const slimCheck = (c) => ({ at: c.at, overall: c.overall, headline: c.headline, mode: c.mode });
const pick = (v, list) => (list.includes(v) ? v : null);
const str = (v, n) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

async function serveStatic(res, pathname) {
  let file = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!extname(file)) file = "index.html"; // SPA routes
  const full = normPath(join(PUBLIC, file));
  if (!full.startsWith(PUBLIC)) return send(res, 403, "Forbidden", "text/plain");
  try {
    const data = await readFile(full);
    res.writeHead(200, { "Content-Type": TYPES[extname(full)] || "application/octet-stream", "Cache-Control": file === "sw.js" || file === "index.html" ? "no-cache" : "public, max-age=300", ...SECURITY_HEADERS });
    res.end(data);
  } catch { send(res, 404, "Not found", "text/plain"); }
}

export const server = http.createServer((req, res) => withTz(req.headers["x-tz"], () => handle(req, res)));

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname === "/healthz") { const ok = dbOk(); return send(res, ok ? 200 : 503, { ok, db: ok, source: source(), env: ENV }); }

    if (url.pathname === "/auth/paypal") {
      if (!loginEnabled()) return send(res, 400, "Log in with PayPal isn't configured here. Use the demo.", "text/plain");
      const state = crypto.randomBytes(16).toString("hex");
      res.writeHead(302, { Location: loginUrl(state), "Set-Cookie": `d20s=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${isSecure(req) ? "; Secure" : ""}` });
      return res.end();
    }
    if (url.pathname === "/auth/paypal/callback") {
      const state = (req.headers.cookie || "").match(/d20s=([a-f0-9]+)/)?.[1];
      if (!state || !safeEqual(state, url.searchParams.get("state") || "")) return send(res, 400, "Login expired. Try again.", "text/plain");
      const who = await finishLogin(url.searchParams.get("code"));
      startSession(res, { demo: false, payerId: who.payerId, name: who.name, lang: "en" }, isSecure(req));
      res.writeHead(302, { Location: "/#cases" }); return res.end();
    }

    if (url.pathname.startsWith("/api/")) return await api(req, res, url, readSession(req));
    return await serveStatic(res, url.pathname);
  } catch (e) {
    console.error(e);
    send(res, e.status === 413 ? 413 : 500, { error: e.status === 413 ? "That file is too big." : "Something went wrong reading PayPal. Try again in a minute." });
  }
}

// Reminder sender: once a minute, send what's due. Push first, email as fallback.
async function sendDue() {
  for (const r of remDb.due(new Date().toISOString())) {
    let ok = false;
    if (r.channel === "push") {
      for (const sub of pushDb.forOwner(r.owner)) {
        const out = await sendPush(sub, { title: r.title, body: `Case ${r.dispute_id}. Open the PayPal app yourself to act. Day 20 never sends sign-in links.` }).catch(() => ({ ok: false }));
        if (out.gone) pushDb.remove(sub.endpoint);
        ok = ok || out.ok;
      }
    }
    if (!ok && r.email) ok = (await sendEmail(r.email, r.title, `Case ${r.dispute_id}.\n\nOpen the PayPal app yourself to check or escalate your case. Day 20 never sends sign-in links and never asks for passwords or codes.\n\n— Day 20 (not affiliated with PayPal)`).catch(() => ({ ok: false }))).ok;
    remDb.markSent(r.id, new Date().toISOString() + (ok ? "" : " (failed)"));
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  server.listen(PORT, () => console.log(`Day 20 on http://localhost:${PORT} · source: ${source()} · PayPal ${ENV} · demo case ${DEMO_DISPUTE_ID} · web ${WEB}`));
  setInterval(() => sendDue().catch((e) => console.error("reminders", e)), 60000).unref();
  cleanup(); setInterval(() => { try { cleanup(); } catch (e) { console.error("cleanup", e); } }, 6 * 3600000).unref();
}
