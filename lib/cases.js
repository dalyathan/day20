// Finds and reads a buyer's cases. Two sources:
//   live   - PayPal's sandbox (or live) API, read-only
//   replay - a saved copy of a real sandbox case, for offline tests and for
//            judges if the sandbox is down. The app always labels which one it shows.
import { readFileSync } from "node:fs";
import { hasCredentials, getDispute, listDisputes, getOrderForCapture, getTrackers } from "./paypal.js";
import { normalize } from "./record.js";

const FIX = new URL("../tests/fixtures/", import.meta.url);
const fixture = (name) => JSON.parse(readFileSync(new URL(name, FIX), "utf8"));

export const DEMO_DISPUTE_ID = process.env.DEMO_DISPUTE_ID || "PP-R-UZH-10198816";
export const source = () => (process.env.REPLAY === "1" || !hasCredentials() ? "replay" : "live");

const cache = new Map();
const TTL = 20000;

export async function readCase(disputeId, { scenario } = {}) {
  if (source() === "replay" || scenario) return replayCase(disputeId, scenario);
  const hit = cache.get(disputeId);
  if (hit && hit.at > Date.now() - TTL) return hit.record;
  const d = await getDispute(disputeId);
  const txId = d.disputed_transactions?.[0]?.seller_transaction_id;
  let order = null, trackers = [], capture = null;
  if (txId) {
    try { ({ order, capture } = await getOrderForCapture(txId)); }
    catch (e) { order = null; console.warn(JSON.stringify({ ev: "paypal_error", call: "capture", dispute: disputeId, error: String(e.message).slice(0, 200) })); }
    trackers = await getTrackers(txId);
  }
  const record = { ...normalize(d, order, trackers, capture), source: "live" };
  cache.set(disputeId, { at: Date.now(), record });
  return record;
}

// Scenarios are clearly-labelled variants of the real replay case, for showing
// stages a single sandbox case can't be in at once.
export const SCENARIOS = {
  open_day7: { label: "Replay: the same case at the open stage", patch: { status: "WAITING_FOR_SELLER_RESPONSE", dispute_state: "REQUIRED_OTHER_PARTY_ACTION", dispute_life_cycle_stage: "INQUIRY" } },
};

function replayCase(disputeId, scenario) {
  // Replay holds one saved case. Don't pretend another ID is it.
  if (disputeId !== DEMO_DISPUTE_ID) throw Object.assign(new Error(`Replay mode only has the saved sandbox case ${DEMO_DISPUTE_ID}. Set PayPal credentials to read ${disputeId}.`), { status: 404 });
  const saved = fixture("sandbox_case.json");
  const order = fixture("sandbox_order.json");
  let dispute = saved.dispute;
  if (scenario && SCENARIOS[scenario]) dispute = { ...dispute, ...SCENARIOS[scenario].patch };
  // The legacy trackers API returned USPS for this number in the live check; the order API omits the carrier.
  const r = normalize(dispute, order, [{ tracking_number: "9400111899223197428490", carrier: "USPS", status: "SHIPPED" }]);
  return { ...r, source: scenario ? "scenario" : "replay", scenario: scenario || null, scenarioLabel: SCENARIOS[scenario]?.label || "Replay of a real sandbox case", fetchedAt: saved.fetchedAt };
}

// Which cases belong to this person?
export async function casesFor(session) {
  if (session.demo || source() === "replay") return [DEMO_DISPUTE_ID];
  if (!session.payerId) return [];
  const list = await listDisputes("page_size=20");
  const ids = (list.items || []).map((x) => x.dispute_id);
  const mine = [];
  for (const id of ids.slice(0, 20)) {
    try {
      const d = await getDispute(id);
      if ((d.disputed_transactions || []).some((t) => t.buyer?.payer_id === session.payerId)) mine.push(id);
    } catch (e) { console.warn(JSON.stringify({ ev: "paypal_error", call: "dispute", dispute: id, error: String(e.message).slice(0, 200) })); }
  }
  return mine;
}
