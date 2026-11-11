#!/usr/bin/env node
// Still Open as an MCP server (stdio), so any AI assistant can use the same
// read-only buyer-side tools. Zero dependencies: JSON-RPC 2.0, one message per line.
//
//   claude mcp add day20 -- node /path/to/day20/mcp/server.js
//   (env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV=sandbox; or REPLAY=1 for the saved case)
//
// Every tool here is read-only. None of them can file, escalate, close, accept or send anything.
import { createInterface } from "node:readline";
import { readCase } from "../lib/cases.js";
import { phase, clock, money, STATUS_WORDS } from "../lib/record.js";
import { extractClaims } from "../lib/claims.js";
import { compare } from "../lib/compare.js";
import { nextStep } from "../lib/advice.js";
import { buildPage } from "../lib/onepage.js";
import { suggestReminders } from "../lib/reminders.js";

const FACTS = {
  type: "object",
  description: "What the buyer reports. Always treated as the buyer's word.",
  properties: {
    received: { type: "string", enum: ["no", "yes", "wrong_item", "not_as_described"] },
    tracking: { type: "string", enum: ["delivered", "in_transit", "stalled", "label_only", "none"] },
    deliveredZip: { type: "string" }, deliveredCity: { type: "string" },
    expectedBy: { type: "string", description: "YYYY-MM-DD" },
    coverage: { type: "string", enum: ["goods", "friends_family", "off_paypal"] },
    sellerResponding: { type: "boolean" }, whatArrived: { type: "string" }, note: { type: "string" },
    scanText: { type: "string", description: "The carrier scan line, copied exactly" }, willingToReturn: { type: "boolean" },
  },
};
const ID = { dispute_id: { type: "string", description: "PayPal case ID, e.g. PP-R-UZH-10198816" } };
const RO = { readOnlyHint: true, destructiveHint: false, openWorldHint: true };

const TOOLS = [
  { name: "day20_read_case", description: "Read a PayPal dispute: status, refund, amount, dates, ship-to ZIP, tracking on file, and the 20-day clock. Read-only.", inputSchema: { type: "object", properties: ID, required: ["dispute_id"] }, annotations: RO },
  { name: "day20_check_email", description: "Check what an email claims about a PayPal case (refund issued, case closed, reshipment, offers, links) against PayPal's record. The sender address is never treated as proof.", inputSchema: { type: "object", properties: { ...ID, email_text: { type: "string" } }, required: ["dispute_id", "email_text"] }, annotations: RO },
  { name: "day20_next_step", description: "The buyer's next step and real deadline, from PayPal's record and what she reports. Includes 'not yet' when an honest seller deserves time, and 'not covered' when Buyer Protection doesn't apply.", inputSchema: { type: "object", properties: { ...ID, facts: FACTS }, required: ["dispute_id"] }, annotations: RO },
  { name: "day20_draft_page", description: "Draft the one-page case the buyer pastes into PayPal herself. Deciding fact first; every line tagged PAYPAL RECORD, PAYPAL CAN CHECK or BUYER REPORTS.", inputSchema: { type: "object", properties: { ...ID, facts: FACTS }, required: ["dispute_id"] }, annotations: RO },
  { name: "day20_reminders", description: "Suggested reminder dates before the case closes on day 20. The buyer adds them herself.", inputSchema: { type: "object", properties: ID, required: ["dispute_id"] }, annotations: RO },
];

async function call(name, a = {}) {
  const r = await readCase(a.dispute_id);
  const now = new Date();
  switch (name) {
    case "day20_read_case": {
      const ph = phase(r);
      return { caseId: r.disputeId, status: STATUS_WORDS[ph], paypalStatus: r.status, reason: r.reason, amount: money(r.amount), refund: r.refund ? money(r.refund) : "none", paidAt: r.paidAt, openedAt: r.openedAt, shipTo: r.shipTo, trackingOnFile: r.trackers, clock: ph === "open" ? clock(r, now) : "not running", source: r.source };
    }
    case "day20_check_email": return compare(extractClaims(String(a.email_text || "")), r, now);
    case "day20_next_step": return nextStep(r, a.facts || {}, now);
    case "day20_draft_page": return buildPage(r, a.facts || {}, []);
    case "day20_reminders": return suggestReminders(r, now);
    default: throw new Error(`Unknown tool ${name}`);
  }
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  let m; try { m = JSON.parse(line); } catch { return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); }
  const reply = (result) => m.id !== undefined && send({ jsonrpc: "2.0", id: m.id, result });
  const fail = (code, message) => m.id !== undefined && send({ jsonrpc: "2.0", id: m.id, error: { code, message } });
  try {
    if (m.method === "initialize") return reply({ protocolVersion: m.params?.protocolVersion || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "day20", version: "1.0.0" }, instructions: "Read-only tools for a PayPal buyer with an open dispute. Never claim you filed or escalated anything: the buyer does that in PayPal." });
    if (m.method === "notifications/initialized" || m.method?.startsWith("notifications/")) return;
    if (m.method === "ping") return reply({});
    if (m.method === "tools/list") return reply({ tools: TOOLS });
    if (m.method === "tools/call") {
      try {
        const out = await call(m.params?.name, m.params?.arguments || {});
        return reply({ content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: Array.isArray(out) ? { items: out } : out });
      } catch (e) { return reply({ content: [{ type: "text", text: String(e.message || e) }], isError: true }); }
    }
    return fail(-32601, `Method not found: ${m.method}`);
  } catch (e) { return fail(-32603, String(e.message || e)); }
});
