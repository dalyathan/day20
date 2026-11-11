// Minimal PayPal REST client. No dependencies: uses Node's built-in fetch.
// Day 20 only ever READS from PayPal. There is no function here that files,
// escalates, closes, accepts an offer, sends a message or moves money.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export const ENV = process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
export const BASE = ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
export const WEB = ENV === "live" ? "https://www.paypal.com" : "https://www.sandbox.paypal.com";

export const hasCredentials = () => {
  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_CLIENT_SECRET;
  return Boolean(id && secret && !id.startsWith("paste"));
};

let cached;
export async function getToken() {
  if (cached && cached.expires > Date.now()) return cached;
  if (!hasCredentials()) throw new Error("Fill in PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env");
  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_CLIENT_SECRET;
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Token request failed (${res.status}): ${JSON.stringify(json)}`);
  cached = { token: json.access_token, scope: json.scope || "", expires: Date.now() + (json.expires_in - 60) * 1000 };
  return cached;
}

export async function pp(path, { method = "GET", body, token } = {}) {
  const bearer = token || (await getToken()).token;
  const res = await fetch(path.startsWith("http") ? path : `${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 500) }; }
  if (!res.ok) {
    const err = new Error(`${method} ${path} failed (${res.status}): ${JSON.stringify(json).slice(0, 800)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// ---- Read-only helpers used by the app ----

export const getDispute = (id) => pp(`/v1/customer/disputes/${encodeURIComponent(id)}`);
export const listDisputes = (query = "page_size=50") => pp(`/v1/customer/disputes?${query}`);

// The dispute doesn't carry the ship-to address or tracking. The capture links
// "up" to its order, and the order has both.
export async function getOrderForCapture(captureId) {
  const cap = await pp(`/v2/payments/captures/${encodeURIComponent(captureId)}`);
  const up = (cap.links || []).find((l) => l.rel === "up" && /checkout\/orders/.test(l.href));
  if (!up) return { capture: cap, order: null };
  // If the order can't be read, keep the capture: its refund status still counts.
  const order = await pp(up.href).catch(() => null);
  return { capture: cap, order };
}

// Legacy tracking API: trackers the seller added to a transaction.
export async function getTrackers(transactionId) {
  try {
    const r = await pp(`/v1/shipping/trackers?transaction_id=${encodeURIComponent(transactionId)}`);
    return r.trackers || [];
  } catch (e) {
    // No trackers is normal (404). Anything else is an error we shouldn't read as "no tracking on file".
    if (!/\b404\b/.test(String(e.message))) console.warn(JSON.stringify({ ev: "paypal_error", call: "trackers", error: String(e.message).slice(0, 200) }));
    return [];
  }
}

// ---- Local state for the setup scripts (not used by the server) ----
const STATE = new URL("../.day20-state.json", import.meta.url);
export const loadState = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {});
export const saveState = (patch) => { const s = { ...loadState(), ...patch }; writeFileSync(STATE, JSON.stringify(s, null, 2)); return s; };
