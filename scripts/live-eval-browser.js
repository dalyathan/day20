// Re-runs the live email tests from a browser, on the deployed app, with Claude on.
// Open https://day20.onrender.com, open the browser console, paste this file, and wait.
// It starts its own demo sessions and keeps to the app's limits (20 checks per session,
// 60 per address per hour), so a full run of 192 checks takes about 3.5 hours.
// Progress is kept in window.EVAL.rows and localStorage "d20eval"; when it ends,
// copy(EVAL.rows.map(r => JSON.stringify(r)).join("\n")) puts the JSONL on your clipboard.
//
// What it checks:
//   - SHOTS: screenshots in /samples (scam_*.png and genuine_h8_*.png), sent as images (no text).
//   - TEXT:  the 60 regression emails in /samples/regression-emails.json, REPEAT times each.
//   - HELDOUT (optional): pass your own [{group, id, text}] list as window.EXTRA before pasting.
window.EVAL = { rows: [], done: false, started: new Date().toISOString(), err: null };
(async () => {
  const CASE = "PP-R-UZH-10198816";
  const REPEAT = window.REPEAT || 3;
  const SHOTS = window.SHOTS || ["scam_s2_01", "scam_s2_08", "scam_scam_01", "scam_scam_05", "scam_scam_09", "scam_scam_11",
    "genuine_h8_01", "genuine_h8_02", "genuine_h8_03", "genuine_h8_04", "genuine_h8_05", "genuine_h8_06"];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const info = await fetch("/healthz", { cache: "no-store" }).then((r) => r.json());
  const prov = { model: info.model, promptHash: info.promptHash, commit: info.commit };
  const emails = window.SKIP_TEXT ? [] : await fetch("/samples/regression-emails.json").then((r) => r.json());
  const jobs = [];
  for (const s of SHOTS) jobs.push({ group: s.startsWith("scam") ? "scam-screenshot" : "genuine-screenshot", id: s, run: 1, shot: s });
  for (let run = 1; run <= REPEAT; run++) for (const e of emails) jobs.push({ group: e.group, id: e.id, run, text: e.text });
  for (const e of window.EXTRA || []) jobs.push({ run: 1, ...e });
  const b64 = async (name) => {
    const blob = await fetch("/samples/" + name + ".png").then((r) => r.blob());
    const d = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    return String(d).split(",")[1];
  };
  let n = 0;
  for (const j of jobs) {
    if (n % 10 === 0) {
      for (let k = 0; k < 5; k++) {
        const r = await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenario: "open_day7" }) });
        if (r.ok) break; await sleep(60000);
      }
    }
    const body = j.shot ? { text: "", image: { type: "image/png", data: await b64(j.shot) } } : { text: j.text };
    let r = {}, status, t0 = Date.now();
    for (let k = 0; k < 6; k++) {
      try {
        const res = await fetch(`/api/cases/${CASE}/check`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        status = res.status; r = await res.json().catch(() => ({})); if (res.ok) break;
      } catch (e) { status = String(e); r = {}; }
      await sleep(65000);
    }
    const row = { group: j.group, id: j.id, run: j.run, overall: r.comparison?.overall ?? null, mode: r.mode ?? null,
      contradicts: (r.comparison?.findings || []).filter((f) => f.verdict === "contradicts").map((f) => f.id).join(","),
      gateDropped: (r.trace || []).filter((s) => /dropped/.test(s.step)).map((s) => s.result).join("; "),
      claudeAdded: (r.trace || []).filter((s) => s.step === "read_claim (Claude)").map((s) => s.result).join("; "),
      needText: !!r.needText, ...prov, modelError: r.modelError ? String(r.modelError).slice(0, 120) : null, error: r.error || null,
      status, ms: Date.now() - t0, at: new Date().toISOString() };
    window.EVAL.rows.push(row); n++;
    try { localStorage.setItem("d20eval", JSON.stringify(window.EVAL.rows)); } catch {}
    await sleep(61000);
  }
  window.EVAL.done = true;
})().catch((e) => { window.EVAL.err = String(e); });
