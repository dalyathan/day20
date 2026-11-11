// One command for the whole sandbox setup (seller side, test money only).
// 1) creates Maya's $66 order  2) waits for the sandbox buyer to approve it  3) captures, and the seller adds tracking
// 4) waits for the buyer's dispute  5) reads the case live from PayPal and keeps watching it.
import { writeFileSync } from "node:fs";
import { pp, saveState } from "../lib/paypal.js";

const status = (o) => { writeFileSync(new URL("../demo-status.json", import.meta.url), JSON.stringify({ at: new Date().toISOString(), ...o }, null, 2)); console.log(`[${new Date().toLocaleTimeString()}] ${o.step}${o.detail ? ": " + o.detail : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const order = await pp("/v2/checkout/orders", { method: "POST", body: {
  intent: "CAPTURE",
  purchase_units: [{ reference_id: "maya-dress", description: "Emerald satin midi dress (Still Open demo)", amount: { currency_code: "USD", value: "66.00" } }],
  payment_source: { paypal: { experience_context: { return_url: "https://example.com/approved", cancel_url: "https://example.com/cancelled", shipping_preference: "GET_FROM_FILE", user_action: "PAY_NOW" } } },
}});
const approveUrl = (order.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
saveState({ orderId: order.id });
status({ step: "waiting for buyer approval", orderId: order.id, approveUrl });

for (let i = 0; ; i++) {
  const o = await pp(`/v2/checkout/orders/${order.id}`);
  if (o.status === "APPROVED") break;
  if (i > 180) { status({ step: "gave up waiting for approval" }); process.exit(1); }
  await sleep(5000);
}

const captured = await pp(`/v2/checkout/orders/${order.id}/capture`, { method: "POST" });
const pu = captured.purchase_units[0], cap = pu.payments.captures[0], ship = pu.shipping?.address || {};
const shipTo = `${ship.admin_area_2 || "?"}, ${ship.admin_area_1 || "?"} ${ship.postal_code || ""}`.trim();
saveState({ captureId: cap.id, shipTo: ship, paidAt: cap.create_time });
status({ step: "paid", detail: `$${cap.amount.value}, capture ${cap.id}, ship-to ${shipTo}`, captureId: cap.id, shipTo });

const tracking = "9400111899223197428490";
await pp(`/v2/checkout/orders/${order.id}/track`, { method: "POST", body: { capture_id: cap.id, tracking_number: tracking, carrier: "USPS", notify_payer: false } });
saveState({ trackingNumber: tracking });
status({ step: "waiting for the buyer's dispute", detail: `seller added USPS ${tracking} (demo data)`, captureId: cap.id, shipTo });

let disputeId;
for (let i = 0; !disputeId; i++) {
  const list = await pp(`/v1/customer/disputes?disputed_transaction_id=${cap.id}`);
  disputeId = list.items?.[0]?.dispute_id;
  if (!disputeId) { if (i > 360) { status({ step: "gave up waiting for a dispute" }); process.exit(1); } await sleep(10000); }
}
saveState({ disputeId });

let last = "";
for (;;) {
  const d = await pp(`/v1/customer/disputes/${disputeId}`);
  const day = Math.max(0, Math.floor((Date.now() - new Date(d.create_time)) / 86400000));
  const refunded = d.dispute_outcome?.amount_refunded?.value;
  const line = `${d.status} · Refund: ${refunded ? "$" + refunded : "none"} · Day ${day} of 20`;
  writeFileSync(new URL("../case.json", import.meta.url), JSON.stringify({ fetchedAt: new Date().toISOString(), summary: line, shipTo, dispute: d }, null, 2));
  if (line !== last) { status({ step: "case from PayPal", detail: line, disputeId }); last = line; }
  await sleep(30000);
}
