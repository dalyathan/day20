import { STR } from "./i18n.js";

const $app = document.getElementById("app");
let ME = null;
let lang = localStorage.getItem("d20lang") || "en";
const t = (k) => (STR[lang] && STR[lang][k]) || STR.en[k] || k;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (iso) => new Date(iso).toLocaleDateString(lang === "es" ? "es-US" : "en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || `Error ${res.status}`), { status: res.status });
  return json;
}

function toast(msg) {
  const el = document.createElement("div"); el.className = "toast"; el.textContent = msg; document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
async function copy(text) { try { await navigator.clipboard.writeText(text); toast(t("copied")); } catch { toast(text); } }

const MOON = `<svg class="moon" viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="g" cx="40%" cy="40%"><stop offset="0" stop-color="#fdf3d8"/><stop offset="1" stop-color="#e9d6a6"/></radialGradient></defs><circle cx="100" cy="100" r="58" fill="url(#g)" opacity=".9"/><circle cx="126" cy="86" r="56" fill="#0e1726"/>${Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2 - Math.PI / 2; return `<circle cx="${100 + 84 * Math.cos(a)}" cy="${100 + 84 * Math.sin(a)}" r="${i < 7 ? 4 : 3}" fill="${i < 7 ? "#7bd3a8" : "#33425f"}"/>`; }).join("")}</svg>`;
const LOGO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a9.5 9.5 0 1 1-6.7 2.8" fill="none" stroke="#7bd3a8" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="2.6" fill="#f3efe6"/></svg>`;

function ring(view) {
  const c = view.clock, ph = view.phase;
  const R = 46, C = 2 * Math.PI * R;
  let label = "", sub = "", frac = 0, color = "#7bd3a8";
  if (ph === "open") { label = `${Math.min(c.day, 20)}`; sub = t("dayOf"); frac = Math.min(1, c.day / 20); color = c.daysLeft <= 3 ? "#ff8a7a" : c.day >= 7 ? "#ffd27a" : "#7bd3a8"; }
  else if (ph === "with_paypal") { label = "⚖"; sub = t("withPayPal"); frac = 1; color = "#8fb4ff"; }
  else if (ph === "resolved") { label = "✓"; sub = t("resolved"); frac = 1; }
  else { label = "!"; sub = view.status; frac = 1; color = "#ffd27a"; }
  const ticks = Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2 - Math.PI / 2; const on = ph === "open" && i < c.day; return `<circle cx="${56 + 53 * Math.cos(a)}" cy="${56 + 53 * Math.sin(a)}" r="2" fill="${on ? color : "#33425f"}"/>`; }).join("");
  return `<svg class="ring" viewBox="0 0 112 112" role="img" aria-label="${esc(label + " " + sub)}">${ticks}<circle cx="56" cy="56" r="${R}" fill="none" stroke="#24324c" stroke-width="7"/><circle cx="56" cy="56" r="${R}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C * frac} ${C}" transform="rotate(-90 56 56)"/><text x="56" y="${ph === "open" ? 60 : 62}" text-anchor="middle" font-size="${ph === "open" ? 34 : 30}" fill="#fff">${esc(label)}</text><text x="56" y="80" text-anchor="middle" font-size="10.5" fill="#b9c2d3" font-family="system-ui">${esc(sub)}</text></svg>`;
}

function topbar({ back = null, title = "" } = {}) {
  return `<header class="top"><div class="row">${back ? `<a class="back" href="${back}">‹ ${esc(title || "Back")}</a>` : `<a class="brand" href="#">${LOGO} Still Open</a>`}<div><button class="iconbtn" data-act="lang">${t("lang")}</button>${ME?.signedIn ? `<button class="iconbtn" data-act="menu" aria-label="Settings">⋯</button>` : ""}</div></div>${ME?.demo ? demobar() : ""}</header>`;
}

let DEMO = { day: 7, scenario: null };
let DEMO_OPEN = false;
function demobar() {
  const sc = Object.entries(ME.scenarios || {});
  const live = ME.source === "live" && !DEMO.scenario;
  if (!DEMO_OPEN) return `<button class="demochip" data-act="demotoggle"><span class="pill ${live ? "live" : "replay"}">${live ? t("liveCase") : "Replay"}</span> Demo · ${t("demoDay").replace(/^.*: /, "")} ${DEMO.day ?? "–"} ▾</button>`;
  return `<div class="demobar"><div class="line"><span>${t("demoDay")} <b id="dd">${DEMO.day ?? t("realTime")}</b></span><button class="iconbtn" data-act="demotoggle">▴</button></div>
  <input type="range" min="0" max="21" value="${DEMO.day ?? 0}" data-act="demoday" aria-label="Demo day">
  <div class="line"><span>${t("scenario")}</span><select data-act="scenario"><option value="">${ME.source === "live" ? t("liveCase") : "Replay of the sandbox case"}</option>${sc.map(([k, v]) => `<option value="${k}" ${DEMO.scenario === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div></div>`;
}

const foot = () => `<div class="foot">${t("disclaimer")}<br><a href="#privacy">Privacy &amp; safety</a> · <a href="https://github.com/dalyathan/day20" rel="noopener">Source (MIT)</a></div>`;

// ---------------- Screens ----------------

function home() {
  $app.innerHTML = `
  <section class="hero">${MOON}<div style="position:relative">
    <div class="brand" style="font-size:15px;opacity:.85">${LOGO} Still Open</div>
    <h1 style="margin-top:36px">Still Open</h1>
    <div class="tag">${t("tagline")}</div>
    <p class="sub">${t("heroSub")}</p>
  </div></section>
  <div class="pad stack">
    ${ME?.loginEnabled ? `<button class="btn paypal stacked" data-act="consent">${t("continuePP")}<span class="sub">${t("sandbox")}</span></button>` : ""}
    <button class="btn dark stacked" data-act="demo">${t("tryDemo")}<span class="sub">${t("demoSub")}</span></button>
    <div class="card"><div class="kicker">${t("does")}</div><ul class="list does"><li>${t("does1")}</li><li>${t("does2")}</li><li>${t("does3")}</li><li>${t("does4")}</li></ul></div>
    <div class="card"><div class="kicker">${t("never")}</div><ul class="list never"><li>${t("never1")}</li><li>${t("never2")}</li><li>${t("never3")}</li><li>${t("never4")}</li></ul></div>
    <div style="text-align:right"><button class="iconbtn" style="color:var(--muted)" data-act="lang">${t("lang")}</button></div>
  </div>
  <div id="consent" class="hidden" style="position:fixed;inset:0;background:rgba(14,23,38,.6);display:flex;align-items:flex-end;justify-content:center;z-index:5">
    <div class="card" style="max-width:480px;width:100%;border-radius:22px 22px 0 0;padding:22px">
      <h2>${t("consentTitle")}</h2>
      <p class="small" style="margin-top:8px">${t("consentBody")}</p>
      <div class="kicker" style="margin-top:12px">${t("does")}</div><ul class="list does"><li>${t("does1")}</li></ul>
      <div class="kicker" style="margin-top:10px">${t("never")}</div><ul class="list never"><li>${t("never1")}</li><li>${t("never2")}</li></ul>
      <a class="btn paypal" href="/auth/paypal" style="margin-top:14px">${t("agree")}</a>
      <button class="btn ghost" data-act="closeconsent" style="margin-top:8px">${t("cancel")}</button>
    </div></div>
  ${foot()}`;
}

async function casesScreen() {
  $app.innerHTML = `${topbar()}<div class="pad"><h2>${t("yourCases")}</h2><div id="list" class="stack" style="margin-top:12px"><p class="small">…</p></div></div>${foot()}`;
  const { cases } = await api("/api/cases");
  if (cases.length === 1 && !cases[0].error) { location.hash = `#case/${cases[0].id}`; return; }
  document.getElementById("list").innerHTML = cases.length ? cases.map((c) => c.error ? `<div class="card red">${esc(c.id)}: ${esc(c.error)}</div>` : `<a class="tile" href="#case/${esc(c.id)}"><b>${esc(c.item || c.reason)}</b><span>${esc(c.status)} · ${esc(c.amount)} · ${esc(c.id)}</span></a>`).join("") : `<p>${t("noCases")}</p>`;
}

let CASE = null;
async function loadCase(id) { CASE = await api(`/api/cases/${encodeURIComponent(id)}`); return CASE; }

function caseHeader(v) {
  const sub = v.phase === "open" ? `${v.clock.daysLeft} ${t("daysLeft")} · ${t("closes")} ${fmt(v.clock.closesAt)}` : esc(v.status);
  return `<div class="casehead">${ring(v)}<div class="meta"><div class="item">${esc(v.item || v.reason)}</div><div class="sub">${esc(v.amount)} · ${esc(v.reason)}</div><div class="sub">${sub}</div><div style="margin-top:8px"><span class="pill ${v.source === "live" ? "live" : "replay"}">${esc(v.sourceLabel)}</span></div></div></div>`;
}

function stepCard(s) {
  const tone = s.kind === "not_covered" ? "amber" : s.kind === "escalate" ? (s.urgent ? "red urgent" : "emerald") : s.kind === "with_paypal" ? "blue" : s.kind === "not_yet" || s.kind === "check_first" ? "amber" : "";
  let action = "";
  if (s.action) {
    const href = s.action.href === "paypal:resolution" ? `${ME.env === "live" ? "https://www.paypal.com" : "https://www.sandbox.paypal.com"}/resolutioncenter` : s.action.href.startsWith("#") ? `#${s.action.href.slice(1)}/${CASE.view.id}` : s.action.href;
    const ext = /^https?:/.test(href);
    action = `<a class="btn ${s.action.href === "paypal:resolution" ? "paypal" : "dark"}" href="${esc(href)}" ${ext ? 'target="_blank" rel="noopener"' : ""} style="margin-top:12px">${esc(s.action.label)}</a>${s.action.note ? `<p class="tiny" style="margin:8px 0 0">${esc(s.action.note)}</p>` : ""}`;
  }
  return `<div class="card ${tone}"><div class="kicker">${t("nextStep")}</div><h3>${esc(s.title)}</h3><p style="margin-top:6px">${esc(s.body)}</p>${action}</div>`;
}

function recordCard(v) {
  return `<div class="card"><div class="kicker">${t("fromPayPal")} <span class="src record">${t("paypalRecordTag")}</span></div><table class="record">
    <tr><td>${t("status")}</td><td>${esc(v.status)}</td></tr>
    <tr><td>${t("refund")}</td><td>${esc(v.refundWord || v.refund)}</td></tr>
    <tr><td>${t("amount")}</td><td>${esc(v.amount)}</td></tr>
    ${v.shipTo ? `<tr><td>${t("shipTo")}</td><td>${esc(v.shipTo)}</td></tr>` : ""}
    ${v.tracking.length ? `<tr><td>${t("tracking")}</td><td class="mono">${esc(v.tracking.join(", "))}</td></tr>` : ""}
    <tr><td>${t("caseId")}</td><td>${esc(v.id)}</td></tr></table></div>`;
}

async function caseScreen(id) {
  $app.innerHTML = `${topbar()}<div class="pad"><p class="small">…</p></div>`;
  const c = await loadCase(id);
  const v = c.view;
  $app.innerHTML = `${topbar()}
  <div class="top" style="margin-top:-22px;padding-top:4px;border-radius:0 0 22px 22px">${caseHeader(v)}</div>
  <div class="pad stack">
    <a class="btn primary big" href="#check/${esc(id)}">✉️ ${t("gotEmail")}</a>
    ${stepCard(c.step)}
    <div class="grid2">
      <a class="tile" href="#page/${esc(id)}"><span class="ico">📄</span><b>${t("onePage")}</b><span>${t("onePageSub")}</span></a>
      <a class="tile" href="#facts/${esc(id)}"><span class="ico">📦</span><b>${t("whatHappened")}</b><span>${t("whatHappenedSub")}</span></a>
      <a class="tile" href="#reminders/${esc(id)}"><span class="ico">⏰</span><b>${t("reminders")}</b><span>${c.scheduled.length ? `${c.scheduled.length} set` : t("remindersSub")}</span></a>
      <a class="tile" href="#check/${esc(id)}"><span class="ico">✉️</span><b>${t("checkEmail")}</b><span>${t("checkEmailSub")}</span></a>
    </div>
    ${recordCard(v)}
    ${c.history?.length ? `<div class="card"><div class="kicker">${t("emailsChecked")}</div>${c.history.map((h) => `<div class="small" style="padding:6px 0;border-top:1px solid var(--line)">${fmt(h.at)} · ${esc(h.headline)}</div>`).join("")}</div>` : ""}
  </div>${foot()}`;
}

let SHOT = null;
async function checkScreen(id) {
  if (!CASE || CASE.view.id !== id) await loadCase(id);
  SHOT = null;
  $app.innerHTML = `${topbar({ back: `#case/${id}`, title: CASE.view.item ? "Case" : "Back" })}
  <div class="pad stack">
    <h2>${t("checkEmail")}</h2>
    <p class="small">${t("checkIntro")}</p>
    ${ME.demo ? `<button class="btn light" data-act="sample">📩 ${t("useSample")}</button>` : ""}
    <label for="em">${t("pasteEmail")}</label>
    <textarea id="em" placeholder="From: service@paypal.com&#10;Subject: Your refund has been issued&#10;…"></textarea>
    <label class="filebtn" for="shot">📷 ${t("addScreenshot")}</label>
    <input id="shot" type="file" accept="image/*" class="hidden">
    <img id="thumb" class="thumb hidden" alt="Screenshot to check">
    <button class="btn primary" data-act="runcheck">${t("checkIt")}</button>
    <div id="result"></div>
  </div>${foot()}`;
  document.getElementById("shot").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 5_000_000) return toast("That image is too big (max 5 MB).");
    const data = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
    SHOT = { type: f.type, data: String(data).split(",")[1] };
    const img = document.getElementById("thumb"); img.src = data; img.classList.remove("hidden");
  });
}

const SAMPLE = `From: PayPal <service@paypal.com>
Subject: Case PP-R-UZH-10198816: refund issued

Hello Maya,

Good news! The seller has issued a full refund of $66.00 USD for your dispute PP-R-UZH-10198816.
Your case has been resolved. No further action is required.

To receive your funds faster, please close your case and confirm your account here:
https://paypal-resolution-center.help/confirm

Funds may take 5-10 business days to appear.

PayPal Resolution Center`;

async function runCheck() {
  const id = CASE.view.id;
  const text = document.getElementById("em").value.trim();
  if (!text && !SHOT) return toast("Paste the email or add a screenshot.");
  const btn = document.querySelector('[data-act="runcheck"]'); btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ${t("checking")}`;
  try {
    const r = await api(`/api/cases/${encodeURIComponent(id)}/check`, { method: "POST", body: { text, image: SHOT } });
    renderResult(r);
  } catch (e) { toast(e.message); }
  btn.disabled = false; btn.textContent = t("checkIt");
}

function renderResult(r) {
  const el = document.getElementById("result");
  if (r.needText) { el.innerHTML = `<div class="card amber">${esc(r.message)}</div>`; return; }
  const c = r.comparison;
  const tone = c.overall === "mismatch" ? "red" : c.overall === "careful" ? "amber" : c.overall === "consistent" ? "emerald" : "";
  const icon = { contradicts: "✕", matches: "✓", caution: "!", cant_check: "?", neutral: "·" };
  el.innerHTML = `
  <div class="card ${tone} verdictcard"><div class="verdict">${esc(c.headline)}</div><p class="bottomline">${esc(c.bottomLine || "")}</p></div>
  ${c.report ? `<div class="card"><div class="kicker">${t("report")}</div><p>${t("reportBody")}</p><div class="row2"><button class="btn light small" data-act="copyphish">${t("copyAddr")}</button><button class="btn light small" data-act="reported">${t("iForwarded")}</button></div></div>` : ""}
  ${stepCard(r.step)}
  <details class="why" ${c.overall === "mismatch" ? "open" : ""}><summary>${t("why")} (${c.findings.length})</summary>${c.findings.map((f) => `<div class="finding"><div class="mark ${f.verdict}">${icon[f.verdict] || "·"}</div><div>
      <div class="vs"><div><div class="kicker">${t("emailSays")}</div>${esc(f.says)}</div><div class="rec"><div class="kicker">${f.source === "paypal_rule" ? t("paypalRules") : t("recordSays")}</div>${esc(f.record)}</div></div>
      <div class="adv">${esc(f.advice)}</div></div></div>`).join("")}
    ${c.senderNote ? `<p class="tiny" style="margin-top:8px">${esc(c.senderNote)}</p>` : ""}</details>
  ${r.mode === "agent" ? `<div class="bubble"><div class="who">${t("aiNote")}</div>${esc(r.note)}</div>` : ""}
  <details><summary>${t("whatDid")}</summary><div class="trace">${r.trace.map((x) => `<div><b>${esc(x.step)}</b> → ${esc(x.result)}</div>`).join("")}${r.violations?.length ? `<div>${t("rulesBroken")}: ${esc(r.violations.join(", "))}</div>` : ""}<div>${r.mode === "agent" ? "Mode: AI model + rules" : "Mode: rules only (no AI model)"}</div></div></details>`;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function pageScreen(id) {
  if (!CASE || CASE.view.id !== id) await loadCase(id);
  const pg = await api(`/api/cases/${encodeURIComponent(id)}/page`);
  $app.innerHTML = `${topbar({ back: `#case/${id}`, title: "Case" })}
  <div class="pad stack"><h2>${t("pageTitle")}</h2><p class="small">${t("pageIntro")}</p>
  <div class="page">${pg.lines.map((l, i) => `<div class="pline ${i === 0 ? "first" : ""}"><span class="src ${l.tag === "BUYER REPORTS" ? "buyer" : l.tag === "LABEL" ? "label" : l.tag === "PAYPAL RECORD" ? "record" : ""}">${esc(l.tag)}</span><div>${esc(l.text)}</div></div>`).join("")}</div>
  <button class="btn primary" data-act="copypage">${t("copy")}</button>
  <div class="card blue"><div class="kicker">${t("wherePaste")}</div><p>${t("wherePasteBody")}</p></div>
  <p class="tiny">PAYPAL RECORD = copied from PayPal's record of your case. PAYPAL CAN CHECK = what you read on the carrier's page, which PayPal can look up from a tracking number on your transaction. BUYER REPORTS = your own words.</p>
  </div>${foot()}`;
  document.querySelector('[data-act="copypage"]').onclick = () => copy(pg.plain);
}

async function factsScreen(id) {
  if (!CASE || CASE.view.id !== id) await loadCase(id);
  const f = { ...CASE.facts };
  const chips = (name, opts) => `<div class="choices" data-name="${name}">${opts.map(([v, l]) => `<button type="button" class="choice" data-v="${v}" aria-pressed="${String(f[name]) === v}">${l}</button>`).join("")}</div>`;
  $app.innerHTML = `${topbar({ back: `#case/${id}`, title: "Case" })}
  <div class="pad"><h2>${t("whatHappened")}</h2><p class="small">This is your own report. Still Open labels it "BUYER REPORTS" everywhere, except where PayPal can check it.</p>
  <label>${t("arrived")}</label>${chips("received", [["no", t("no")], ["wrong_item", t("wrongItem")], ["not_as_described", t("notAsDescribed")], ["yes", t("yes")]])}
  <label>${t("trackSays")}</label>${chips("tracking", [["delivered", t("delivered")], ["in_transit", t("inTransit")], ["stalled", t("stalled")], ["label_only", t("labelOnly")], ["none", t("noTracking")]])}
  <div id="delw"><label>${t("deliveredWhere")}</label><div class="grid2"><input type="text" id="dcity" placeholder="${t("city")}" value="${esc(f.deliveredCity || "")}"><input type="text" id="dzip" inputmode="numeric" placeholder="${t("zip")}" value="${esc(f.deliveredZip || "")}"></div></div>
  <div id="scanw"><label for="scan">${t("scanLine")}</label><input type="text" id="scan" maxlength="140" placeholder="Delivered, Front Door, TUCSON, AZ 85705" value="${esc(f.scanText || "")}"><p class="tiny" style="margin-top:4px">${t("scanHelp")}</p></div>
  <div id="retw"><label>${t("willReturn")}</label>${chips("willingToReturn", [["true", t("yesReturn")], ["false", t("noReturn")]])}</div>
  <div id="expw"><label for="exp">${t("expected")}</label><input type="date" id="exp" value="${esc(f.expectedBy || "")}"></div>
  <label>${t("howPaid")}</label>${chips("coverage", [["goods", t("goods")], ["friends_family", t("ff")], ["off_paypal", t("offPP")]])}
  <label for="note">Anything else, in one sentence</label><input type="text" id="note" maxlength="300" value="${esc(f.note || "")}">
  <button class="btn primary" data-act="savefacts" style="margin-top:18px">${t("save")}</button></div>${foot()}`;
  const sync = () => { document.getElementById("delw").classList.toggle("hidden", f.tracking !== "delivered"); document.getElementById("scanw").classList.toggle("hidden", !["delivered", "stalled"].includes(f.tracking)); document.getElementById("retw").classList.toggle("hidden", !["wrong_item", "not_as_described"].includes(f.received)); document.getElementById("expw").classList.toggle("hidden", !["in_transit", "label_only"].includes(f.tracking)); };
  sync();
  $app.querySelectorAll(".choices").forEach((g) => g.addEventListener("click", (e) => {
    const b = e.target.closest(".choice"); if (!b) return;
    f[g.dataset.name] = b.dataset.v === "true" ? true : b.dataset.v === "false" ? false : b.dataset.v;
    g.querySelectorAll(".choice").forEach((x) => x.setAttribute("aria-pressed", x === b));
    sync();
  }));
  document.querySelector('[data-act="savefacts"]').onclick = async () => {
    const body = { ...f, deliveredCity: document.getElementById("dcity").value, deliveredZip: document.getElementById("dzip").value, expectedBy: document.getElementById("exp").value, scanText: document.getElementById("scan").value, note: document.getElementById("note").value };
    await api(`/api/cases/${encodeURIComponent(id)}/facts`, { method: "POST", body });
    toast(t("saved")); location.hash = `#case/${id}`;
  };
}

async function remindersScreen(id) {
  if (!CASE || CASE.view.id !== id) await loadCase(id);
  const list = CASE.reminders;
  $app.innerHTML = `${topbar({ back: `#case/${id}`, title: "Case" })}
  <div class="pad stack"><h2>${t("remTitle")}</h2><p class="small">${t("remBody")}</p>
  ${list.length ? `<div class="card">${list.map((r) => `<div style="padding:8px 0;border-top:1px solid var(--line)"><b>${fmt(r.at)}</b><div class="small">${esc(r.title.replace(/^Still Open: /, ""))} · ${esc(r.why)}</div></div>`).join("")}</div>` : `<div class="card">${CASE.view.phase === "open" ? "No reminders left before the deadline." : "The 20-day clock isn't running on this case, so there's nothing to remind you about."}</div>`}
  ${list.length ? `
  <label for="hour">${t("remTime")}</label><select id="hour" class="field">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === 16 ? "selected" : ""}>${String(h).padStart(2, "0")}:00</option>`).join("")}</select>
  <label>${t("remHow")}</label><div class="choices" id="chan"><button class="choice" data-v="push" aria-pressed="true">${t("push")}</button><button class="choice" data-v="email" aria-pressed="false">${t("email")}</button></div>
  <input type="email" id="remail" class="hidden" placeholder="you@example.com" style="margin-top:8px">
  <button class="btn primary" data-act="saverem">${t("turnOn")}</button>
  <a class="btn light" href="/api/cases/${encodeURIComponent(id)}/reminders.ics">📅 ${t("calendar")}</a>
  ${CASE.scheduled.length ? `<p class="small">Scheduled: ${CASE.scheduled.map((s) => `${fmt(s.at)} (${s.channel})`).join(", ")}</p>` : ""}` : ""}
  </div>${foot()}`;
  if (!list.length) return;
  let chan = "push";
  document.getElementById("chan").onclick = (e) => { const b = e.target.closest(".choice"); if (!b) return; chan = b.dataset.v; document.querySelectorAll("#chan .choice").forEach((x) => x.setAttribute("aria-pressed", x === b)); document.getElementById("remail").classList.toggle("hidden", chan !== "email"); };
  document.querySelector('[data-act="saverem"]').onclick = async () => {
    if (chan === "push") { const ok = await enablePush(); if (!ok) return; }
    const r = await api(`/api/cases/${encodeURIComponent(id)}/reminders`, { method: "POST", body: { hour: Number(document.getElementById("hour").value), tzOffsetMin: new Date().getTimezoneOffset(), channel: chan, email: document.getElementById("remail").value } });
    toast(r.demo ? `Demo: ${r.preview.length} reminders previewed, none sent` : `${r.scheduled.length} reminders set`);
  };
}

async function enablePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) { toast("This browser can't do notifications. Use email or the calendar."); return false; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast("Notifications are off. Use email or the calendar."); return false; }
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api("/api/push/key");
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)) });
  await api("/api/push/subscribe", { method: "POST", body: sub.toJSON() });
  return true;
}

function privacyScreen() {
  $app.innerHTML = `${topbar({ back: "#", title: "Back" })}<div class="pad stack"><h2>Privacy &amp; safety</h2>
  <div class="card"><div class="kicker">What Still Open stores</div><ul class="list"><li>Your session, and your PayPal payer ID if you connect PayPal (not your password, not PayPal's access token).</li><li>Your answers about tracking and delivery.</li><li>The result of each email check (claims and findings, not the email itself).</li><li>Reminders you set, and your email address if you choose email reminders.</li></ul></div>
  <div class="card"><div class="kicker">${t("never")}</div><ul class="list never"><li>${t("never1")}</li><li>${t("never2")}</li><li>${t("never3")}</li><li>${t("never4")}</li></ul></div>
  <div class="card"><div class="kicker">How to tell the real Still Open from a fake</div><p>The real Still Open never emails or texts you a link to sign in, never asks for a code, and never asks you to pay anything. Reminders only tell you to open the PayPal app yourself.</p></div>
  <div class="card"><div class="kicker">Kill switch</div><p>"Disconnect" deletes everything Still Open holds about you, at once.</p>${ME?.signedIn ? `<button class="btn ghost" data-act="disconnect">${t("disconnect")}</button>` : ""}</div>
  <p class="small">${t("disclaimer")}</p></div>`;
}

// ---------------- Router & events ----------------

async function route() {
  const [name, id] = location.hash.slice(1).split("/");
  window.scrollTo(0, 0);
  try {
    if (name === "privacy") return privacyScreen();
    if (!ME?.signedIn) return home();
    if (name === "case" && id) return await caseScreen(id);
    if (name === "check" && id) return await checkScreen(id);
    if (name === "page" && id) return await pageScreen(id);
    if (name === "facts" && id) return await factsScreen(id);
    if (name === "reminders" && id) return await remindersScreen(id);
    return await casesScreen();
  } catch (e) {
    if (e.status === 401) { ME = await api("/api/me"); return home(); }
    $app.innerHTML = `${topbar()}<div class="pad"><div class="card red">${esc(e.message)}</div></div>`;
  }
}

document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-act]"); if (!a) return;
  const act = a.dataset.act;
  if (act === "lang") { lang = lang === "en" ? "es" : "en"; localStorage.setItem("d20lang", lang); document.documentElement.lang = lang; if (ME?.signedIn) api("/api/settings", { method: "POST", body: { lang } }).catch(() => {}); return route(); }
  if (act === "consent") return document.getElementById("consent").classList.remove("hidden");
  if (act === "closeconsent") return document.getElementById("consent").classList.add("hidden");
  if (act === "demo") { await api("/api/demo", { method: "POST", body: { lang, scenario: "open_day7" } }); ME = await api("/api/me"); DEMO = { day: 7, scenario: "open_day7" }; location.hash = "#cases"; return route(); }
  if (act === "runcheck") return runCheck();
  if (act === "sample") { document.getElementById("em").value = SAMPLE; return; }
  if (act === "copyphish") return copy("phishing@paypal.com");
  if (act === "reported") { await api(`/api/cases/${encodeURIComponent(CASE.view.id)}/reported`, { method: "POST" }).catch(() => {}); a.textContent = "✓ " + t("noted"); a.disabled = true; return; }
  if (act === "demotoggle") { DEMO_OPEN = !DEMO_OPEN; return route(); }
  if (act === "menu") { location.hash = "#privacy"; return; }
  if (act === "disconnect") { await api("/api/disconnect", { method: "POST" }); ME = await api("/api/me"); toast(t("disconnected")); location.hash = ""; return route(); }
});
document.addEventListener("change", async (e) => {
  const a = e.target.closest("[data-act]"); if (!a) return;
  if (a.dataset.act === "demoday") { DEMO.day = Number(a.value); await api("/api/settings", { method: "POST", body: { demoDay: DEMO.day } }); route(); }
  if (a.dataset.act === "scenario") { DEMO.scenario = a.value || null; await api("/api/settings", { method: "POST", body: { scenario: DEMO.scenario } }); route(); }
});
document.addEventListener("input", (e) => { if (e.target.dataset?.act === "demoday") { const dd = document.getElementById("dd"); if (dd) dd.textContent = e.target.value; } });
window.addEventListener("hashchange", route);

(async () => {
  document.documentElement.lang = lang;
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  ME = await api("/api/me").catch(() => ({ signedIn: false }));
  if (ME.demo) DEMO = { day: ME.demoDay, scenario: ME.scenario };
  route();
})();
