// Turns PayPal's raw dispute (+ the order behind it) into one plain record.
// Every field here comes from PayPal. Nothing the buyer or an email says is
// ever written into this object; that separation is what the app is built on.

const DAY = 86400000;

export function normalize(dispute, order = null, trackers = [], capture = null) {
  const tx = (dispute.disputed_transactions || [])[0] || {};
  const pu = order?.purchase_units?.[0] || {};
  const addr = pu.shipping?.address || null;
  const orderTrackers = (pu.shipping?.trackers || []).map((t) => ({
    number: String(t.id || "").split("-").pop() || t.tracking_number,
    carrier: t.carrier || null,
    status: t.status || null,
  }));
  const legacyTrackers = (trackers || []).map((t) => ({ number: t.tracking_number, carrier: t.carrier, status: t.status }));
  // Same number from both APIs: keep one, and fill in whatever either one knows (the order API omits the carrier).
  const byNumber = new Map();
  for (const t of [...orderTrackers, ...legacyTrackers].filter((x) => x.number)) {
    const prev = byNumber.get(t.number) || {};
    byNumber.set(t.number, { number: t.number, carrier: prev.carrier || t.carrier || null, status: prev.status || t.status || null });
  }
  const allTrackers = [...byNumber.values()];

  // A refund can be on the dispute, or made directly on the payment (outside the dispute).
  // Only COMPLETED refunds count: a dispute hold shows up as a PENDING refund on the order.
  const cap = capture || pu.payments?.captures?.[0] || null;
  const completedRefunds = (pu.payments?.refunds || []).filter((x) => x.status === "COMPLETED").reduce((sum, x) => sum + Number(x.amount?.value || 0), 0);
  const refundedOnCapture = cap && (cap.status === "REFUNDED" || cap.status === "PARTIALLY_REFUNDED")
    ? (completedRefunds || (cap.status === "REFUNDED" ? Number(cap.amount?.value || 0) : 0)) : 0;
  const refunded = dispute.dispute_outcome?.amount_refunded?.value
    || (dispute.fund_movements || []).filter((m) => m.party === "BUYER" && m.type === "CREDIT").map((m) => m.amount?.value)[0]
    || (refundedOnCapture ? refundedOnCapture.toFixed(2) : null);
  // PARTIALLY_REFUNDED with no amount we can see: still a refund, amount unknown. Never "no refund".
  const partialUnknown = !refunded && cap?.status === "PARTIALLY_REFUNDED";

  return {
    source: "paypal",
    disputeId: dispute.dispute_id,
    status: dispute.status || null,                       // OPEN, WAITING_FOR_BUYER_RESPONSE, UNDER_REVIEW, RESOLVED ...
    state: dispute.dispute_state || null,                 // e.g. UNDER_PAYPAL_REVIEW
    stage: dispute.dispute_life_cycle_stage || null,      // INQUIRY, CHARGEBACK, ...
    reason: dispute.reason || null,
    amount: dispute.dispute_amount || tx.gross_amount || null,
    openedAt: dispute.create_time || null,
    updatedAt: dispute.update_time || null,
    paidAt: tx.create_time || null,
    buyerResponseDue: dispute.buyer_response_due_date || null,
    sellerResponseDue: dispute.seller_response_due_date || null,
    sellerName: tx.seller?.name || null,
    buyerPayerId: tx.buyer?.payer_id || null,
    items: (tx.items || []).map((i) => i.item_name).filter(Boolean),
    transactionId: tx.seller_transaction_id || null,
    buyerTransactionId: tx.buyer_transaction_id || null,
    refund: refunded ? { value: refunded, currency: dispute.dispute_amount?.currency_code || "USD" } : partialUnknown ? { value: null, partial: true, currency: dispute.dispute_amount?.currency_code || "USD" } : null,
    outcome: dispute.dispute_outcome?.outcome_code || null,
    sellerOffer: dispute.offer?.seller_offered_amount || null,
    shipTo: addr ? { line1: addr.address_line_1 || null, city: addr.admin_area_2 || null, state: addr.admin_area_1 || null, zip: addr.postal_code || null, country: addr.country_code || null } : null,
    trackers: allTrackers,
  };
}


// Where the case is in PayPal's process, in buyer words.
export function phase(r) {
  const s = (r.status || "").toUpperCase();
  if (s === "RESOLVED" || s === "CLOSED" || r.outcome) return "resolved";
  // In the inquiry stage, WAITING_FOR_BUYER_RESPONSE usually just means the seller replied: the 20-day
  // clock is still running. Only after escalation does it mean PayPal is waiting on her for something.
  if (s === "WAITING_FOR_BUYER_RESPONSE") return (r.stage || "INQUIRY") === "INQUIRY" ? "open" : "your_turn";
  if (s === "UNDER_REVIEW" || r.state === "UNDER_PAYPAL_REVIEW") return "with_paypal";
  if ((r.stage || "INQUIRY") === "INQUIRY") return "open";
  return "with_paypal";
}

// The 20-day clock only applies while the dispute is open between buyer and seller.
export function clock(r, now = new Date()) {
  const opened = new Date(r.openedAt);
  const day = Math.max(0, Math.floor((now - opened) / DAY));
  const closesAt = new Date(opened.getTime() + 20 * DAY);
  const paid = r.paidAt ? new Date(r.paidAt) : opened;
  const escalateFrom = new Date(Math.max(opened.getTime(), paid.getTime() + 7 * DAY));
  return {
    day,
    of: 20,
    daysLeft: Math.max(0, 20 - day),
    closesAt: closesAt.toISOString(),
    escalateFrom: escalateFrom.toISOString(),
    canEscalateNow: now >= escalateFrom && now < closesAt,
    lapsed: now >= closesAt,
  };
}

export function money(a) {
  if (!a) return "none";
  const v = a.value ?? a.amount, c = a.currency_code || a.currency || "USD";
  if (v == null && a.partial) return "a partial amount";
  return c === "USD" ? `$${Number(v).toFixed(2)}` : `${Number(v).toFixed(2)} ${c}`;
}

export const REASONS = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Not as described",
  UNAUTHORISED: "Unauthorized payment",
  UNAUTHORIZED: "Unauthorized payment",
};

export const STATUS_WORDS = {
  open: "Open",
  your_turn: "Waiting for you",
  with_paypal: "With a PayPal reviewer",
  resolved: "Resolved",
};
