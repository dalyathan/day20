// "What should I do next?" One answer, always with an action.
// Inputs: PayPal's record + what the buyer tells us (facts). Facts are tagged
// as the buyer's in everything we show to PayPal.
import { phase, clock, money } from "./record.js";
import { fmtDate } from "./compare.js";

const DAY = 86400000;

export function nextStep(r, facts = {}, now = new Date()) {
  const ph = phase(r);
  const ck = clock(r, now);
  const zipShip = norm(r.shipTo?.zip);
  const zipDelivered = norm(facts.deliveredZip);
  const paidDaysAgo = r.paidAt ? Math.floor((now - new Date(r.paidAt)) / DAY) : null;
  const urgent = ph === "open" && ck.daysLeft <= 3;

  const out = (kind, title, body, action = null, extra = {}) => ({ kind, title, body, action, urgent: urgent && kind !== "not_covered" && kind !== "resolved", phase: ph, clock: ck, ...extra });
  const escalateAction = { label: "Escalate in PayPal", href: "paypal:resolution" };

  if (ph === "resolved") return out("resolved", "Your case is resolved", r.refund ? `PayPal's record shows a refund of ${money(r.refund)}.` : "PayPal's record shows this case as resolved.", null);

  if (facts.coverage === "friends_family" || facts.coverage === "off_paypal") {
    return out("not_covered", "PayPal Buyer Protection likely doesn't cover this",
      facts.coverage === "friends_family"
        ? "Payments sent as Friends and Family aren't covered by Buyer Protection. Filing it as something else would be a false claim, and Day 20 won't help with that."
        : "This payment didn't go through PayPal checkout, so Buyer Protection doesn't apply.",
      { label: "Report the scam", href: "https://reportfraud.ftc.gov/", note: "Also report the seller's account in PayPal, and tell your bank if you paid by card." });
  }
  if (paidDaysAgo != null && paidDaysAgo > 180) {
    return out("not_covered", "This is past PayPal's 180-day window", "Buyer Protection disputes have to be opened within 180 days of payment.",
      { label: "Report the scam", href: "https://reportfraud.ftc.gov/" });
  }

  if (ph === "your_turn") {
    return out("respond", "PayPal is waiting for you", `Reply to PayPal's request in the case${r.buyerResponseDue ? ` by ${fmtDate(r.buyerResponseDue)}` : ""}. If you don't, the case can close.`,
      { label: "Open the case in PayPal", href: "paypal:resolution" });
  }

  if (ph === "with_paypal") {
    return out("with_paypal", "A PayPal reviewer has your case",
      "There's nothing to escalate. Make sure your one-page case is attached, and answer any request from PayPal by its due date. Don't accept side deals from the seller by email.",
      { label: "Copy my one-page case", href: "#page" });
  }

  // ---- open: the 20-day clock is running ----
  const recv = facts.received;
  if (recv === "wrong_item" || recv === "not_as_described") {
    const wrongReason = r.reason === "MERCHANDISE_OR_SERVICE_NOT_RECEIVED";
    return out("snad", "This is a 'not as described' case",
      `${wrongReason ? "Your case is filed as 'not received', but you got something else. Tell PayPal what arrived when you escalate, with photos of the item and the label. " : "Take photos of the item, the packaging and the label. "}PayPal may ask you to return it, and return shipping can be at your expense, so keep the receipt and tracking. Escalate before ${fmtDate(ck.closesAt)}.`,
      escalateAction);
  }
  if (recv === "yes") {
    return out("no_case", "You have the item",
      "If it's what you ordered, there's nothing to claim. Close the case only after you're satisfied, because a closed case can't be reopened.", null);
  }

  const t = facts.tracking;
  if (t === "delivered" && zipDelivered && zipShip) {
    if (zipDelivered !== zipShip) {
      const fact = `Your check: the carrier's page says delivered to ZIP ${facts.deliveredZip}${facts.deliveredCity ? ` (${facts.deliveredCity})` : ""}. PayPal's record: your ship-to ZIP on this payment is ${r.shipTo.zip}.`;
      return ck.canEscalateNow
        ? out("escalate", `Ask PayPal to step in by ${fmtDate(new Date(new Date(ck.closesAt) - 2 * DAY))}`, `${fact} That's the key fact, and PayPal can check it. It's the first two lines of your one-page case, the first thing the reviewer reads. In PayPal, tap Escalate on your case to ask a reviewer to decide. If you don't by day 20 (${fmtDate(ck.closesAt)}), it closes and can't be reopened.`, escalateAction, { decidingFact: fact })
        : out("wait_to_escalate", `You can escalate from ${fmtDate(ck.escalateFrom)}`, `${fact} PayPal usually lets you escalate 7 days after you paid. Day 20 will remind you that day.`, { label: "Add the reminder", href: "#reminders" }, { decidingFact: fact });
    }
    return out("check_first", "Tracking shows delivery to your ZIP",
      "Check with neighbors, your building and the carrier first, and ask the carrier where it was scanned. When proof of delivery matches your address, PayPal usually sides with the seller. If it's still missing, say exactly that and no more.",
      { label: "Add a reminder for day 15", href: "#reminders" });
  }

  if (t === "in_transit" || t === "label_only") {
    const expected = facts.expectedBy ? new Date(facts.expectedBy) : null;
    if (expected && now < expected) {
      const tooLate = expected >= new Date(ck.closesAt);
      return out("not_yet", tooLate ? `Not yet, but don't wait past ${fmtDate(new Date(new Date(ck.closesAt) - 2 * DAY))}` : `Not yet: give it until ${fmtDate(expected)}`,
        tooLate
          ? `The seller's delivery date is after your case closes on ${fmtDate(ck.closesAt)}. Keep the case open. If it hasn't arrived by ${fmtDate(new Date(new Date(ck.closesAt) - 2 * DAY))}, escalate so you don't lose your protection.`
          : "It's still on its way. Escalating now could hurt an honest seller. Keep the case open, and Day 20 will remind you before the deadline.",
        { label: "Add reminders", href: "#reminders" });
    }
    if (t === "label_only") {
      const fact = "A shipping label was created, but the carrier has no scan of the package.";
      return out("escalate", `Ask PayPal to step in by ${fmtDate(new Date(new Date(ck.closesAt) - 2 * DAY))}`, `${fact} A label alone doesn't show anything shipped.`, escalateAction, { decidingFact: fact });
    }
  }
  if (t === "stalled" && facts.sellerResponding && ck.daysLeft > 6) {
    const by = new Date(new Date(ck.closesAt) - 5 * DAY);
    return out("not_yet", `Give the seller until ${fmtDate(by)}`,
      `Tracking is stuck, but the seller is answering. Honest sellers often fix a lost parcel with a refund or a replacement. If it isn't solved by ${fmtDate(by)}, escalate; your case closes by itself on ${fmtDate(ck.closesAt)}.`,
      { label: "Add reminders", href: "#reminders" });
  }
  if (t === "stalled" || t === "none" || t === "in_transit") {
    const fact = t === "none" ? "The seller hasn't added any tracking." : t === "in_transit" ? "Tracking shows it in transit, with no delivery scan." : "Tracking hasn't moved and there's no delivery scan.";
    return out(ck.canEscalateNow ? "escalate" : "wait_to_escalate", ck.canEscalateNow ? `Ask PayPal to step in by ${fmtDate(new Date(new Date(ck.closesAt) - 2 * DAY))}` : `You can escalate from ${fmtDate(ck.escalateFrom)}`,
      `${fact} ${facts.sellerResponding ? "The seller is answering, so give them a short deadline first. " : ""}Your case closes by itself on ${fmtDate(ck.closesAt)} if it isn't escalated.`,
      ck.canEscalateNow ? escalateAction : { label: "Add the reminder", href: "#reminders" }, { decidingFact: fact });
  }

  return out("need_facts", "Tell Day 20 what the tracking says",
    `Your case is open: day ${ck.day} of 20. It closes by itself on ${fmtDate(ck.closesAt)} unless you escalate. Add what the tracking page says, and Day 20 will tell you the next step.`,
    { label: "Add tracking details", href: "#facts" });
}

const norm = (z) => (z ? String(z).trim().slice(0, 5) : "");
