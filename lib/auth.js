// Sessions (signed cookie) and Log in with PayPal (OpenID Connect, sandbox by default).
// Log in with PayPal gives identity only: who the buyer is. It does not let us
// read her transactions. In the sandbox demo, Day 20 matches her payer ID to the
// disputes on the demo seller account (we own both test accounts). In production
// this needs a buyer-side read scope that PayPal doesn't offer yet; that's our ask.
import crypto from "node:crypto";
import { sessions } from "./store.js";
import { BASE, WEB } from "./paypal.js";

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const sign = (v) => crypto.createHmac("sha256", SECRET).update(v).digest("base64url").slice(0, 32);

export function readSession(req) {
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith("d20="));
  if (!raw) return null;
  const [sid, mac] = raw.slice(4).split(".");
  if (!sid || !mac || sign(sid) !== mac) return null;
  const data = sessions.get(sid);
  return data ? { sid, ...data } : null;
}

export function startSession(res, data, secure) {
  const sid = crypto.randomBytes(18).toString("base64url");
  sessions.set(sid, data);
  res.setHeader("Set-Cookie", `d20=${sid}.${sign(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 60}${secure ? "; Secure" : ""}`);
  return { sid, ...data };
}

export function updateSession(s, patch) { const { sid, ...rest } = s; const next = { ...rest, ...patch }; sessions.set(sid, next); return { sid, ...next }; }

export function endSession(res, s) {
  if (s) sessions.del(s.sid);
  res.setHeader("Set-Cookie", "d20=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

export const loginEnabled = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_RETURN_URL);

export function loginUrl(state) {
  const scopes = process.env.PAYPAL_LOGIN_SCOPES || "openid profile email https://uri.paypal.com/services/paypalattributes";
  const q = new URLSearchParams({ flowEntry: "static", client_id: process.env.PAYPAL_CLIENT_ID, response_type: "code", scope: scopes, redirect_uri: process.env.PAYPAL_RETURN_URL, state });
  return `${WEB}/signin/authorize?${q}`;
}

export async function finishLogin(code) {
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const tok = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code }),
  }).then(async (r) => ({ ok: r.ok, json: await r.json() }));
  if (!tok.ok) throw new Error(`PayPal login failed: ${JSON.stringify(tok.json).slice(0, 200)}`);
  const info = await fetch(`${BASE}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, { headers: { Authorization: `Bearer ${tok.json.access_token}` } })
    .then(async (r) => ({ ok: r.ok, json: await r.json() }));
  if (!info.ok) throw new Error(`PayPal user info failed: ${JSON.stringify(info.json).slice(0, 200)}`);
  // We keep only what we need to find her cases. The PayPal access token is not stored.
  return { payerId: info.json.payer_id || null, userId: info.json.user_id || null, name: info.json.name || info.json.given_name || "there" };
}
