// One command to prove every PayPal call Still Open makes works against the sandbox.
//   npm run live-check
// Read-only: it only GETs. Prints a pass/fail line per call, never prints secrets.
import { getToken, getDispute, listDisputes, getOrderForCapture, getTrackers, ENV } from "../lib/paypal.js";
import { normalize, phase, clock, money } from "../lib/record.js";
import { extractClaims } from "../lib/claims.js";
import { compare } from "../lib/compare.js";
import { writeFileSync } from "node:fs";

const id = process.argv[2] || process.env.DEMO_DISPUTE_ID || "PP-R-UZH-10198816";
const line = (ok, what, detail = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${what}${detail ? "  ·  " + detail : ""}`);
let failures = 0;
const step = async (what, fn) => { try { const d = await fn(); line(true, what, d); } catch (e) { failures++; line(false, what, String(e.message).slice(0, 220)); } };

console.log(`Still Open live check · PayPal ${ENV} · case ${id}\n`);
let dispute, order, trackers = [];
await step("OAuth token (client credentials)", async () => { const t = await getToken(); return `scopes include disputes: ${/disputes/.test(t.scope) ? "yes" : "no"}`; });
await step("List disputes", async () => { const l = await listDisputes("page_size=5"); return `${(l.items || []).length} found`; });
await step("Read the case", async () => { dispute = await getDispute(id); return `${dispute.status} · ${dispute.reason}`; });
const tx = dispute?.disputed_transactions?.[0]?.seller_transaction_id;
await step("Capture → order (ship-to address)", async () => { order = (await getOrderForCapture(tx)).order; const a = order?.purchase_units?.[0]?.shipping?.address; return a ? `${a.admin_area_2}, ${a.admin_area_1} ${a.postal_code}` : "no order link (ship-to unavailable)"; });
await step("Tracking on the transaction", async () => { trackers = await getTrackers(tx); const ot = order?.purchase_units?.[0]?.shipping?.trackers || []; return `${trackers.length} via /v1/shipping/trackers, ${ot.length} on the order`; });
await step("Normalize + compare a fake refund email", async () => {
  const r = normalize(dispute, order, trackers);
  const cmp = compare(extractClaims("The seller has issued a full refund of $66.00. Your case has been resolved."), r);
  writeFileSync(new URL("../tests/fixtures/live_record.json", import.meta.url), JSON.stringify({ fetchedAt: new Date().toISOString(), record: r, order }, null, 2));
  return `${phase(r)} · refund ${r.refund ? money(r.refund) : "none"} · ship-to ZIP ${r.shipTo?.zip || "?"} · email reads "${cmp.overall}"${phase(r) === "open" ? ` · day ${clock(r).day} of 20` : ""}`;
});
await step("Anthropic API key present", async () => { if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is empty in .env (the app still works on rules)"); return "set"; });

console.log(`\n${failures ? `${failures} check(s) failed.` : "All checks passed."} Saved the live record to tests/fixtures/live_record.json`);
process.exit(failures ? 1 : 0);
