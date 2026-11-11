// The one-page case: what Maya pastes into her PayPal case so the reviewer
// sees the deciding fact first. Every line says where it came from:
//   PAYPAL RECORD    -> copied from a field in PayPal's own record
//   PAYPAL CAN CHECK -> the buyer's reading of a carrier record that PayPal can look
//                       up from a tracking number on the transaction (quoted, not paraphrased)
//   BUYER REPORTS    -> the buyer's own statement
// Shaped by a blind reviewer game: quote the carrier verbatim, never paraphrase a
// "mismatch"; list every tracking number; flag a reason that doesn't fit.
import { money, REASONS } from "./record.js";
import { fmtDate } from "./compare.js";

// Buyer text can't forge lines or tags: one line, no brackets, short.
export const cleanText = (v, n = 200) => (typeof v === "string" ? v.replace(/[\r\n\t]+/g, " ").replace(/[\[\]{}<>`|]/g, "").replace(/\s+/g, " ").trim().slice(0, n) || null : null);
export const cleanZip = (v) => (typeof v === "string" && /^\d{5}(-\d{4})?$/.test(v.trim()) ? v.trim() : null);
export const cleanCity = (v) => (typeof v === "string" && /^[\p{L} .,'-]{2,40}$/u.test(v.trim()) ? v.trim() : null);

export function cleanFacts(f = {}) {
  return { ...f, deliveredZip: cleanZip(f.deliveredZip), deliveredCity: cleanCity(f.deliveredCity), scanText: cleanText(f.scanText, 140), whatArrived: cleanText(f.whatArrived, 120), note: cleanText(f.note, 300) };
}

export function buildPage(r, rawFacts = {}, emailChecks = []) {
  const facts = cleanFacts(rawFacts);
  const lines = [];
  const add = (text, tag) => { if (!lines.some((l) => l.text === text)) lines.push({ text, tag }); }; // no repeated lines
  const onFile = r.trackers || [];
  const track = onFile[0];
  const trackName = track ? `${track.carrier || "Carrier"} ${track.number}` : null;
  const zs = r.shipTo?.zip, zd = facts.deliveredZip ? String(facts.deliveredZip).trim() : null;
  const shipToText = r.shipTo ? `${r.shipTo.city ? `${r.shipTo.city}, ${r.shipTo.state} ` : ""}${zs || ""}`.trim() : null;
  let deciding = null;

  // 1. The deciding fact, as separate facts. Only a validated ZIP goes into a
  //    PAYPAL CAN CHECK line; the buyer's own wording stays under BUYER REPORTS.
  const gotIt = facts.received === "yes";
  if (!gotIt && facts.tracking === "delivered" && zs && zd && zs.slice(0, 5) !== zd.slice(0, 5)) {
    add(track ? `${trackName}, added by the seller to this transaction. Delivery ZIP on the carrier's page: ${zd}.` : `Delivery ZIP on the carrier's page: ${zd}.`, track ? "PAYPAL CAN CHECK" : "BUYER REPORTS");
    add(`Ship-to address on this transaction: ${shipToText}.`, "PAYPAL RECORD");
    deciding = `${lines[0].text} ${lines[1].text}`;
    if (facts.scanText) add(`The carrier's delivery line, as I copied it: "${facts.scanText}".`, "BUYER REPORTS");
  } else if (!gotIt && facts.tracking === "label_only") {
    add(track ? `${trackName}, added by the seller to this transaction: label created, no carrier scan since.` : "The tracking shows a label created, no carrier scan since.", track ? "PAYPAL CAN CHECK" : "BUYER REPORTS");
    deciding = lines[0].text;
  } else if (!gotIt && facts.tracking === "none" && !onFile.length) {
    add("No tracking has been added to this transaction.", "PAYPAL RECORD");
    deciding = lines[0].text;
  } else if (!gotIt && (facts.tracking === "stalled" || facts.tracking === "in_transit")) {
    add(track ? `${trackName}, added by the seller to this transaction: ${facts.tracking === "stalled" ? "no new scan and no delivery scan" : "in transit, no delivery scan"}.` : "The tracking shows no delivery scan.", track ? "PAYPAL CAN CHECK" : "BUYER REPORTS");
    deciding = lines[0].text;
    if (facts.scanText) add(`The last carrier scan, as I copied it: "${facts.scanText}".`, "BUYER REPORTS");
  }

  // 2. Every other tracking number: on file, or sent by email but not on file.
  for (const t of onFile.slice(1)) add(`Also on this transaction: ${t.carrier || ""} ${t.number}.`.replace("  ", " "), "PAYPAL RECORD");
  const emailed = new Set();
  for (const e of emailChecks) for (const f of e.findings || []) if (f.id?.startsWith("tracking_") && f.verdict === "cant_check") emailed.add(f.id.slice(9));
  for (const t of emailed) add(`The seller emailed another tracking number, ${t}. It isn't on this transaction.`, "PAYPAL CAN CHECK");

  // 3. What the buyer says, and a reason that doesn't fit.
  const inr = r.reason === "MERCHANDISE_OR_SERVICE_NOT_RECEIVED";
  if (facts.received === "no") add("I have not received the item.", "BUYER REPORTS");
  if (gotIt) add("I have received the item.", "BUYER REPORTS");
  if (facts.received === "wrong_item" || facts.received === "not_as_described") {
    const what = facts.whatArrived ? `: ${facts.whatArrived}` : "";
    add(facts.received === "wrong_item" ? `I received a different item${what}.` : `The item is not as described${what}.`, "BUYER REPORTS");
    if (inr) add("I filed this as 'not received', but something else arrived. Please review it as 'not as described'.", "BUYER REPORTS");
    if (facts.willingToReturn === true) add("I will return the item if PayPal asks.", "BUYER REPORTS");
  }
  if (facts.note) add(facts.note, "BUYER REPORTS");

  // 4. Emails that contradicted the case record.
  for (const e of emailChecks.filter((x) => x.overall === "mismatch").slice(0, 2)) {
    const c = (e.findings || []).find((f) => f.verdict === "contradicts");
    if (c) add(`On ${fmtDate(e.at)} I received an email claiming "${c.says.toLowerCase()}". This case shows: ${c.record}.${e.reported ? " I forwarded it to phishing@paypal.com." : ""}`, "BUYER REPORTS");
  }

  // 5. The basics, in one line, copied from PayPal's record.
  add(`Case ${r.disputeId} · filed as ${REASONS[r.reason] || r.reason || "dispute"} · ${money(r.amount)}${r.items?.length ? ` · ${r.items.join(", ")}` : ""} · paid ${r.paidAt ? fmtDate(r.paidAt) : "?"} · refund so far: ${r.refund ? money(r.refund) : "none"}.`, "PAYPAL RECORD");
  add("Prepared with Day 20 (read-only); sent by the buyer.", "LABEL");

  const plain = lines.map((l, i) => `${i + 1}. [${l.tag}] ${l.text}`).join("\n");
  return { lines, plain, decidingFact: deciding };
}
