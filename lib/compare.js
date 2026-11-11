// Compares what an email claims against PayPal's record of the case.
// Rule: the email's sender is never evidence. Genuine PayPal addresses have
// been abused to deliver scams, so only the case record decides.
import { phase, clock, money, STATUS_WORDS } from "./record.js";

// Each finding: { id, says, record, verdict, source, advice }
// verdict: "contradicts" | "matches" | "cant_check" | "caution"
// source:  "paypal_record" (a field PayPal returned) | "paypal_rule" (published PayPal rule) | "email_only"
export function compare(claims, r, now = new Date()) {
  const f = [];
  const ph = phase(r);
  const ck = clock(r, now);
  const statusLine = `${STATUS_WORDS[ph] || r.status || "Unknown"}${r.refund ? ` · Refund: ${money(r.refund)}` : " · Refund: none"}`;

  if (claims.refundClaimed) {
    const amt = claims.refundClaimed.amount != null ? `$${claims.refundClaimed.amount.toFixed(2)}` : "a refund";
    if (r.refund) {
      const same = claims.refundClaimed.amount == null || Math.abs(Number(r.refund.value) - claims.refundClaimed.amount) < 0.01;
      f.push({ id: "refund", says: `${amt} was refunded`, record: `Refund: ${money(r.refund)}`, verdict: same ? "matches" : "contradicts", source: "paypal_record",
        advice: same ? "The refund is on your PayPal case." : "The amount doesn't match your case. Trust the PayPal app." });
    } else {
      f.push({ id: "refund", says: `${amt} was refunded`, record: "Refund: none", verdict: "contradicts", source: "paypal_record",
        advice: "Your PayPal case shows no refund. A real refund through PayPal shows on the case and in your PayPal activity." });
    }
  }

  if (claims.noActionNeeded && !claims.caseClosedClaimed) {
    f.push({ id: "no_action", says: "Says no action is needed", record: ph === "open" ? `${statusLine} · closes ${fmtDate(ck.closesAt)} unless you escalate` : statusLine, verdict: ph === "open" ? "caution" : "neutral", source: "paypal_record",
      advice: ph === "open" ? `That can be true while PayPal waits for the seller. But your case still closes by itself on ${fmtDate(ck.closesAt)} unless you escalate.` : "Your case is with PayPal." });
  }

  if (claims.caseClosedClaimed) {
    const closed = ph === "resolved";
    f.push({ id: "closed", says: "Your case is closed or resolved", record: statusLine,
      verdict: closed ? "matches" : "contradicts", source: "paypal_record",
      advice: closed ? "PayPal's record agrees the case is resolved." : ph === "open"
        ? `Your case is still open. If nothing changes, it closes by itself on day 20 (${fmtDate(ck.closesAt)}) and can't be reopened.`
        : "Your case is still active with PayPal." });
  }

  if (claims.asksToCloseCase) {
    f.push({ id: "close_request", says: "Asks you to close or cancel your case", record: `A closed case can't be reopened. Yours: ${statusLine}`, verdict: "caution", source: "paypal_rule",
      advice: "Don't close it. Under PayPal's rules a closed case can't be reopened, and a full refund through PayPal closes the case automatically, so you never need to close it to get paid." });
  }

  if (claims.partialOffer || claims.keepItemOffer) {
    const o = claims.partialOffer;
    const what = o?.percent ? `${o.percent}% back` : o?.amount ? `$${o.amount.toFixed(2)} back` : "a partial refund";
    f.push({ id: "partial_offer", says: `Offers ${what}${claims.keepItemOffer ? " and says you can keep the item" : ""}`, record: `Accepting closes the case. Disputed: ${money(r.amount)}`, verdict: "caution", source: "paypal_rule",
      advice: o?.offPayPal ? "Money sent outside PayPal isn't protected, and ending the case for it leaves you with nothing if it never comes. You can ignore it." : "Under PayPal's rules, accepting a partial refund closes the case for good. You can decline it, or ignore it. Declining doesn't weaken your case." });
  }

  if (claims.trackingNumbers.length) {
    const known = new Set((r.trackers || []).map((t) => String(t.number).replace(/\s/g, "")));
    for (const t of claims.trackingNumbers.slice(0, 3)) {
      const onFile = known.has(t);
      f.push({ id: `tracking_${t}`, says: `Tracking ${t}${claims.reshipmentClaimed ? " (a reshipment)" : ""}`, record: onFile ? "On your PayPal transaction" : (known.size ? `Not on your transaction (on file: ${[...known].join(", ")})` : "No tracking on your transaction"),
        verdict: onFile ? "neutral" : "cant_check", source: "paypal_record",
        advice: onFile ? "This is the tracking number the seller added in PayPal. Scammers know it too, so it doesn't make the email real. Check the carrier's page yourself." : "This number isn't on your PayPal transaction. A new label alone doesn't mean anything shipped. Don't let it run out your clock." });
    }
  } else if (claims.reshipmentClaimed) {
    f.push({ id: "reshipment", says: "Says the item was shipped again", record: (r.trackers || []).length ? `Tracking on file: ${r.trackers.map((t) => t.number).join(", ")}` : "No tracking on your transaction",
      verdict: "cant_check", source: "paypal_record", advice: "There's no new tracking on your PayPal case. Keep your case open until the item is actually in your hands." });
  }

  if (claims.outcomeClaimed && !claims.refundClaimed) {
    const done = ph === "resolved" || r.refund;
    f.push({ id: "outcome", says: "Says the case was decided for you, or your money is on its way", record: statusLine, verdict: done ? "matches" : "contradicts", source: "paypal_record",
      advice: done ? "PayPal's record agrees." : `PayPal's record shows no refund and no decision. If you wait on this email, your case closes by itself on ${fmtDate(ck.closesAt)}.` });
  }

  if (claims.asksToWait) {
    f.push({ id: "wait", says: "Asks you to wait, or not to escalate", record: ph === "open" ? `Your case closes by itself on ${fmtDate(ck.closesAt)} (day 20)` : statusLine, verdict: ph === "open" ? "caution" : "neutral", source: "paypal_record",
      advice: ph === "open" ? `Waiting is how cases lapse. Nothing in an email moves PayPal's deadline. If it isn't solved by ${fmtDate(new Date(new Date(ck.closesAt) - 2 * 86400000))}, escalate in PayPal.` : "Your case is already with PayPal, so there's nothing to escalate." });
  }

  if (claims.deliveredClaimed) {
    const t = (r.trackers || [])[0];
    f.push({ id: "delivered", says: "Says your package was delivered", record: t ? `Check ${t.carrier || "the carrier"} ${t.number} yourself` : "No tracking on your transaction", verdict: "cant_check", source: "paypal_record",
      advice: "An email can't prove delivery. Open the carrier's own site, type in the tracking number from your PayPal transaction, and compare the delivery ZIP with your address." });
  }

  for (const id of claims.caseIds) {
    f.push({ id: `caseid_${id}`, says: `Mentions case ${id}`, record: `Your case: ${r.disputeId}`, verdict: id === r.disputeId ? "neutral" : "contradicts", source: "paypal_record",
      advice: id === r.disputeId ? "The case number is real. Scammers can see it too, so a real number doesn't make the email real." : "That isn't your case number." });
  }

  if (claims.asksToSignInOrVerify || claims.asksForSecret || claims.links.length || claims.phones.length) {
    const foreign = claims.links.map(host).filter((h) => h && !/(^|\.)paypal\.com$/i.test(h));
    const lookalike = foreign.find((h) => /paypal|pay-pal|paypa1/i.test(h));
    const what = claims.asksForSecret ? "Asks for a password or code" : claims.asksToSignInOrVerify ? "Asks you to sign in or confirm your account" : "Contains links or phone numbers";
    f.push({ id: "links", says: lookalike ? `${what}, with a link to ${lookalike}` : foreign.length ? `${what} (link to ${foreign[0]})` : what,
      record: lookalike ? `${lookalike} is not paypal.com` : "Open PayPal yourself, not from an email", verdict: lookalike ? "contradicts" : "caution", source: "paypal_rule",
      advice: "Don't use the links or phone numbers in the email. Open the PayPal app yourself. Never share a password or a one-time code." });
  }

  if (claims.asksForSecret) {
    f.push({ id: "secret", says: "Asks you for a code or password", record: "Never share one. Anyone who asks wants into your account.", verdict: "contradicts", source: "paypal_rule",
      advice: "Don't reply with any code. With your code, a scammer can sign in as you and close your case from inside your account." });
  }

  if (claims.asksForOffPlatformPayment) {
    f.push({ id: "off_platform", says: "Mentions gift cards, crypto, Zelle or a wire", record: "Refunds never need you to pay", verdict: "contradicts", source: "paypal_rule",
      advice: "PayPal refunds never need you to pay anything. A request for gift cards, crypto or a transfer is a scam sign." });
  }

  if (claims.urgency) {
    f.push({ id: "urgency", says: "Pushes you to act fast", record: ph === "open" ? `Your real deadline: day 20, ${fmtDate(ck.closesAt)}` : statusLine, verdict: "caution", source: "paypal_record",
      advice: "Go by the dates on your PayPal case, not the email's." });
  }

  if (!f.some((x) => x.verdict !== "neutral")) {
    f.push({ id: "unverified", says: "Nothing here matches a claim I can check", record: statusLine, verdict: "cant_check", source: "paypal_record",
      advice: "That doesn't make it real. Only what's on your PayPal case counts. If the email says anything happened, look for it in the PayPal app yourself." });
  }

  // A real case number or tracking number never makes an email "real": scammers see both.
  // "Matches" needs a status claim (refund, closed) that agrees with PayPal's record, and nothing else wrong.
  const contradictions = f.filter((x) => x.verdict === "contradicts").length;
  const cautions = f.filter((x) => x.verdict === "caution" || x.verdict === "cant_check").length;
  const substantiveMatch = f.some((x) => x.verdict === "matches");
  let overall;
  if (contradictions) overall = "mismatch";
  else if (cautions) overall = "careful";
  else if (substantiveMatch) overall = "consistent";
  else overall = "careful"; // Day 20 never calls an email safe unless a status claim agrees with PayPal's record.

  return {
    overall,
    headline: headline(overall),
    bottomLine: bottomLine(overall, r, ph, ck),
    findings: f,
    // Only send her to phishing@paypal.com on real phishing signs, so she never reports an honest seller.
    report: f.some((x) => (x.verdict === "contradicts" && ["refund", "closed", "outcome", "secret", "off_platform", "links"].includes(x.id)) || x.id.startsWith("caseid_") && x.verdict === "contradicts"),
    senderNote: claims.sender ? "The sender's address isn't proof either way. Real PayPal addresses have been abused to send scams, so Day 20 checks the claims, not the sender." : null,
  };
}

function headline(o) {
  return {
    mismatch: "This email is wrong about your PayPal case.",
    careful: "Don't act on this email. Go by your PayPal case.",
    consistent: "This email agrees with your PayPal case.",
    nothing_to_check: "This email doesn't say anything about your case.",
  }[o];
}

// The one line Maya needs at 3 a.m., built only from PayPal's record.
function bottomLine(o, r, ph, ck) {
  const refund = r.refund ? `PayPal shows a refund of ${money(r.refund)}.` : "PayPal shows no refund.";
  const state = ph === "open" ? `Your case is still open: ${ck.daysLeft} days left, it closes ${fmtDate(ck.closesAt)}. Don't close it.`
    : ph === "with_paypal" ? "Your case is with a PayPal reviewer. Don't close it."
    : ph === "your_turn" ? "PayPal is waiting for your reply in the case."
    : "PayPal shows your case as resolved.";
  if (o === "consistent") return `${refund} ${ph === "resolved" ? "Your case is resolved." : state}`;
  return `${refund} ${state}`;
}

const host = (u) => { try { return new URL(/^https?:/i.test(u) ? u : `https://${u}`).hostname.toLowerCase(); } catch { return null; } };

export const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
