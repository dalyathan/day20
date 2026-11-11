// Web push without dependencies: VAPID (RFC 8292) + aes128gcm payload encryption (RFC 8291),
// built on node:crypto. Plus an optional email fallback through Resend.
// Reminder messages never contain a link to sign in anywhere: they tell the buyer
// to open the PayPal app herself. A reminder that looks like phishing would teach
// her the wrong habit.
import crypto from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const unb64u = (s) => Buffer.from(s, "base64url");

let vapid;
export function vapidKeys() {
  if (vapid) return vapid;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const dir = process.env.DATA_DIR || join(process.cwd(), ".data");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "vapid.json");
    if (existsSync(file)) vapid = JSON.parse(readFileSync(file, "utf8"));
    else {
      const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
      vapid = { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
      writeFileSync(file, JSON.stringify(vapid));
    }
  }
  return vapid;
}

function privateKeyObject({ publicKey, privateKey }) {
  const pub = unb64u(publicKey);
  return crypto.createPrivateKey({ key: { kty: "EC", crv: "P-256", d: privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: "jwk" });
}

export function vapidHeader(endpoint, subject = process.env.VAPID_SUBJECT || "mailto:day20@example.com") {
  const keys = vapidKeys();
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key: privateKeyObject(keys), dsaEncoding: "ieee-p1363" });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.publicKey}`;
}

const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();

export function encrypt(payload, sub, { salt = crypto.randomBytes(16), ecdh = null } = {}) {
  const uaPublic = unb64u(sub.keys.p256dh);
  const authSecret = unb64u(sub.keys.auth);
  const as = ecdh || crypto.createECDH("prime256v1");
  if (!ecdh) as.generateKeys();
  const asPublic = as.getPublicKey();
  const ecdhSecret = as.computeSecret(uaPublic);
  const prkKey = hmac(authSecret, ecdhSecret);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])])).subarray(0, 32);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21); salt.copy(header, 0); header.writeUInt32BE(4096, 16); header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, ct]);
}

// Used by the tests to prove the encryption round-trips (what a browser does).
export function decrypt(body, uaEcdh, authSecret) {
  const salt = body.subarray(0, 16), idlen = body.readUInt8(20), asPublic = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const uaPublic = uaEcdh.getPublicKey();
  const ecdhSecret = uaEcdh.computeSecret(asPublic);
  const prkKey = hmac(authSecret, ecdhSecret);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])])).subarray(0, 32);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  return pt.subarray(0, pt.lastIndexOf(2)).toString();
}

export async function sendPush(sub, message) {
  const body = encrypt(JSON.stringify(message), sub);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: { Authorization: vapidHeader(sub.endpoint), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "normal" },
    body,
    signal: AbortSignal.timeout(10000),
    redirect: "manual",
  });
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}

export async function sendEmail(to, subject, text) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return { ok: false, skipped: true };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "Day 20 <reminders@resend.dev>", to: [to], subject, text }),
    signal: AbortSignal.timeout(10000),
  });
  return { ok: res.ok, status: res.status };
}
