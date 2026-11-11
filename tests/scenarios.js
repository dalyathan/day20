// The 24 scenes from our dispute game, turned into tests.
// Each scene was played by agents with incentives (buyer, ghost store, honest
// seller, agent, blind PayPal reviewer). Here we keep the case facts and what
// a fair outcome needs from Still Open.
import { readFileSync } from "node:fs";
import { normalize } from "../lib/record.js";

const base = JSON.parse(readFileSync(new URL("./fixtures/sandbox_case.json", import.meta.url), "utf8")).dispute;
const DAY = 86400000;
const OPENED = new Date("2026-09-28T15:00:00Z");

// Build a PayPal-shaped record for a scene.
export function sceneRecord({ amount = "66.00", item = "Item", paidDaysBeforeOpen = 10, status = "WAITING_FOR_SELLER_RESPONSE", stage = "INQUIRY", shipZip = "95131", shipCity = "San Jose", shipState = "CA", trackers = [{ number: "9400111899223197428490", carrier: "USPS" }], refund = null, reason = "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" } = {}) {
  const d = structuredClone(base);
  d.create_time = OPENED.toISOString();
  d.status = status; d.dispute_life_cycle_stage = stage; d.dispute_state = stage === "INQUIRY" ? "REQUIRED_OTHER_PARTY_ACTION" : "UNDER_PAYPAL_REVIEW";
  d.reason = reason;
  d.dispute_amount = { currency_code: "USD", value: amount };
  d.disputed_transactions[0].create_time = new Date(OPENED - paidDaysBeforeOpen * DAY).toISOString();
  d.disputed_transactions[0].items[0].item_name = item;
  if (refund) d.dispute_outcome = { outcome_code: "RESOLVED_BUYER_FAVOUR", amount_refunded: { currency_code: "USD", value: refund } };
  const order = { purchase_units: [{ shipping: { address: { admin_area_2: shipCity, admin_area_1: shipState, postal_code: shipZip, country_code: "US" }, trackers: trackers.map((t) => ({ id: `CAP-${t.number}`, carrier: t.carrier })) } }] };
  return normalize(d, order, []);
}
export const at = (day) => new Date(OPENED.getTime() + day * DAY + 3600000);

const PHISH = `From: PayPal <service@paypal.com>
Subject: Refund issued for your case
The seller has issued a full refund of $70.00 USD. Your case has been resolved. No further action is required.
Please close your case to receive funds: https://paypal-resolutioncentre.com/confirm`;

const RESHIP = `Hi, sorry for the delay! We re-shipped your order. New tracking: 9400111899223197499999.
Please cancel your dispute so our system can release the new package. Thanks!`;

export const SCENES = [
  { id: "01", who: "Maya, ICU nurse · ghost store · tracking delivered in another state", rec: { item: "Dress", amount: "66.00" }, day: 7, facts: { received: "no", tracking: "delivered", deliveredZip: "85705", deliveredCity: "Tucson, AZ", coverage: "goods" }, expect: { kind: "escalate", decidingFact: /85705.*95131/ } },
  { id: "02", who: "Luis, warehouse lead · ghost store · day 19", rec: { item: "Jacket", amount: "58.00" }, day: 19, facts: { received: "no", tracking: "delivered", deliveredZip: "85705", coverage: "goods" }, expect: { kind: "escalate", urgent: true } },
  { id: "03", who: "Nell, 71 · honest seller · UPS lost it, seller answering", rec: { item: "Ceramic lamp", amount: "140.00" }, day: 5, facts: { received: "no", tracking: "stalled", sellerResponding: true, coverage: "goods" }, expect: { kind: "not_yet", protectsHonestSeller: true } },
  { id: "04", who: "Jess, student · item arrived as described, changed her mind", rec: { item: "Dress", amount: "48.00", reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED" }, day: 3, facts: { received: "yes", tracking: "delivered", deliveredZip: "95131", coverage: "goods" }, expect: { kind: "no_case", refusesCheat: true } },
  { id: "05", who: "Marcus H. · sneakers delivered to his ZIP with photo, says not received", rec: { item: "Sneakers", amount: "210.00" }, day: 1, facts: { received: "no", tracking: "delivered", deliveredZip: "95131", coverage: "goods" }, expect: { kind: "check_first", refusesCheat: true } },
  { id: "06", who: "Dani · vintage bag delivered to her ZIP, says not received", rec: { item: "Vintage bag", amount: "95.00" }, day: 7, facts: { received: "no", tracking: "delivered", deliveredZip: "95131", coverage: "goods" }, expect: { kind: "check_first", refusesCheat: true } },
  { id: "07", who: "Ines · counterfeit headphones, overseas return", rec: { item: "Headphones", amount: "89.00", reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED" }, day: 6, facts: { received: "not_as_described", tracking: "delivered", deliveredZip: "95131", whatArrived: "counterfeit, no serial number", coverage: "goods" }, expect: { kind: "snad", bodyHas: /return shipping can be at your expense/i } },
  { id: "08", who: "Hanna · decoy envelope with a hair tie instead of a coat", rec: { item: "Wool coat", amount: "120.00" }, day: 9, facts: { received: "wrong_item", tracking: "delivered", deliveredZip: "95131", whatArrived: "a hair tie", coverage: "goods" }, expect: { kind: "snad", bodyHas: /filed as 'not received'/, pageHas: /review it as 'not as described'/ } },
  { id: "09", who: "Marcus B., paramedic · backordered, label only, honest seller with a date", rec: { item: "Bike helmet", amount: "75.00" }, day: 4, facts: { received: "no", tracking: "label_only", expectedBy: "2026-10-12", coverage: "goods" }, expect: { kind: "not_yet", protectsHonestSeller: true } },
  { id: "10", who: "Denise, coach · ghost store · other city", rec: { item: "Dress", amount: "66.00" }, day: 2, facts: { received: "no", tracking: "delivered", deliveredZip: "92101", deliveredCity: "San Diego, CA", coverage: "goods" }, expect: { kind: "escalate" } },
  { id: "11", who: "Tomás · wrong shirt, honest packing mistake", rec: { item: "Linen shirt", amount: "64.00", reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED" }, day: 2, facts: { received: "wrong_item", tracking: "delivered", deliveredZip: "95131", coverage: "goods" }, expect: { kind: "snad" } },
  { id: "12", who: "Marcus B., single dad · same city, different ZIP", rec: { item: "Suit", amount: "72.00" }, day: 12, facts: { received: "no", tracking: "delivered", deliveredZip: "95112", deliveredCity: "San Jose, CA", coverage: "goods" }, expect: { kind: "escalate", decidingFact: /95112.*95131/ } },
  { id: "13", who: "Ada, ICU nurse · same-city decoy + fake PayPal refund email", rec: { item: "Dress", amount: "70.00" }, day: 10, facts: { received: "no", tracking: "delivered", deliveredZip: "95112", coverage: "goods" }, email: PHISH, expect: { kind: "escalate", overall: "mismatch", report: true } },
  { id: "14", who: "Keisha · $2 scarf decoy, customs label 'Clothing'", rec: { item: "Wool coat", amount: "150.00" }, day: 7, facts: { received: "wrong_item", tracking: "delivered", deliveredZip: "95131", whatArrived: "a $2 scarf", coverage: "goods" }, expect: { kind: "snad" } },
  { id: "15", who: "Dale, trucker · same city, other ZIP · day 19", rec: { item: "Boots", amount: "64.00" }, day: 19, facts: { received: "no", tracking: "delivered", deliveredZip: "95116", coverage: "goods" }, expect: { kind: "escalate", urgent: true } },
  { id: "16", who: "Graciela, 71, Spanish · another state", rec: { item: "Blender", amount: "85.00" }, day: 15, facts: { received: "no", tracking: "delivered", deliveredZip: "78701", deliveredCity: "Austin, TX", coverage: "goods" }, expect: { kind: "escalate" } },
  { id: "17", who: "Marcus B., teacher · delivered to his OLD address, which is on the transaction", rec: { item: "Board game", amount: "110.00", shipZip: "94110", shipCity: "San Francisco" }, day: 4, facts: { received: "no", tracking: "delivered", deliveredZip: "94110", coverage: "goods" }, expect: { kind: "check_first", refusesCheat: true } },
  { id: "18", who: "Tess · paid an Instagram seller as Friends and Family", rec: { item: "Concert tickets", amount: "180.00", trackers: [] }, day: 2, facts: { received: "no", tracking: "none", coverage: "friends_family" }, expect: { kind: "not_covered", refusesCheat: true } },
  { id: "19", who: "Partial-truth buyer · small chip, claims 'broken'", rec: { item: "Table lamp", amount: "130.00", reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED" }, day: 3, facts: { received: "not_as_described", tracking: "delivered", deliveredZip: "95131", whatArrived: "small chip on the base", coverage: "goods" }, expect: { kind: "snad", buyerWordsTagged: true } },
  { id: "20", who: "Accountant · carrier lost it, stuck 12 days, big brand not answering", rec: { item: "Espresso grinder", amount: "240.00" }, day: 8, facts: { received: "no", tracking: "stalled", sellerResponding: false, coverage: "goods" }, expect: { kind: "escalate" } },
  { id: "21", who: "Refurb laptop · condition differs from listing", rec: { item: "Laptop", amount: "450.00", reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED" }, day: 5, facts: { received: "not_as_described", tracking: "delivered", deliveredZip: "95131", coverage: "goods" }, expect: { kind: "snad" } },
  { id: "22", who: "New mom · 'reshipment' label that never moves", rec: { item: "Baby carrier", amount: "90.00" }, day: 11, facts: { received: "no", tracking: "delivered", deliveredZip: "60601", deliveredCity: "Chicago, IL", coverage: "goods" }, email: RESHIP, expect: { kind: "escalate", overall: "careful", findingIds: ["close_request", "tracking_9400111899223197499999"], pageHas: /another tracking number, 9400111899223197499999/ } },
  { id: "23", who: "Line cook · Portugal, normal 3–4 week shipping", rec: { item: "Cork bag", amount: "95.00", paidDaysBeforeOpen: 9 }, day: 1, facts: { received: "no", tracking: "in_transit", expectedBy: "2026-10-15", coverage: "goods" }, expect: { kind: "not_yet", protectsHonestSeller: true } },
  { id: "24", who: "Librarian, the 40th victim of the same store", rec: { item: "Dress", amount: "66.00" }, day: 6, facts: { received: "no", tracking: "delivered", deliveredZip: "85705", coverage: "goods" }, expect: { kind: "escalate" } },
];

// Emails the checker must read right.
export const EMAILS = [
  { id: "E1", name: "Fake 'refund issued' from service@paypal.com", rec: {}, text: PHISH, expect: { overall: "mismatch", report: true } },
  { id: "E2", name: "Real refund, case resolved", rec: { refund: "66.00", status: "RESOLVED", stage: "INQUIRY" }, text: "Your refund of $66.00 has been issued. Your case has been resolved.", expect: { overall: "consistent" } },
  { id: "E3", name: "Seller's 30% 'keep the item' offer", rec: {}, text: "We are offering a partial refund of $19.80 and you can keep the item. Please accept so we can close this.", expect: { overall: "careful", findingIds: ["partial_offer"] } },
  { id: "E4", name: "Reshipment with a number not on the transaction", rec: {}, text: RESHIP, expect: { overall: "careful" } },
  { id: "E5", name: "Gift-card 'verification fee'", rec: {}, text: "To release your refund, pay a $5 verification fee with a gift card within 24 hours.", expect: { overall: "mismatch", findingIds: ["off_platform", "urgency"] } },
  { id: "E6", name: "Lookalike subdomain link", rec: {}, text: "Sign in to view your refund: https://paypal.com.case-review.net/login", expect: { overall: "mismatch" } },
  { id: "E7", name: "Wrong case number", rec: {}, text: "Update on case PP-D-99999999: closed.", expect: { overall: "mismatch" } },
  { id: "E9", name: "Short 'refund of $66.00 has been issued. Case closed.'", rec: {}, text: "Your refund of $66.00 has been issued. Case closed.", expect: { overall: "mismatch", findingIds: ["refund", "closed"] } },
  { id: "E8", name: "Shipping update with the real tracking number (a real number is never proof)", rec: {}, text: "Your order shipped with USPS 9400111899223197428490.", expect: { overall: "careful" } },
];
