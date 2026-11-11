// Reminders the buyer schedules herself, as a calendar file. Silent by default:
// in the game, an "unmissable" reminder got the app muted.
import { clock, phase } from "./record.js";

const DAY = 86400000;

export function suggestReminders(r, now = new Date()) {
  if (phase(r) !== "open") return [];
  const ck = clock(r, now);
  const closes = new Date(ck.closesAt);
  const list = [];
  const esc = new Date(ck.escalateFrom);
  if (esc > now) list.push({ at: esc.toISOString(), title: "Day 20: you can escalate your PayPal case today", why: "7 days since you paid" });
  const d15 = new Date(closes - 5 * DAY), d18 = new Date(closes - 2 * DAY);
  if (d15 > now) list.push({ at: d15.toISOString(), title: "Day 20: 5 days left on your PayPal case", why: "Day 15 of 20" });
  if (d18 > now) list.push({ at: d18.toISOString(), title: "Day 20: escalate today, your case closes in 2 days", why: "Day 18 of 20" });
  return list;
}

export function toICS(r, reminders, { alarm = false, appUrl = "" } = {}) {
  const stamp = ics(new Date());
  const events = reminders.map((x, i) => [
    "BEGIN:VEVENT",
    `UID:day20-${r.disputeId}-${i}@day20`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${x.at.slice(0, 10).replace(/-/g, "")}`,
    `SUMMARY:${esc(x.title)}`,
    `DESCRIPTION:${esc(`Case ${r.disputeId}. ${x.why}. Open the PayPal app yourself to escalate. ${appUrl ? "Day 20: " + appUrl : ""}`)}`,
    "TRANSP:TRANSPARENT",
    ...(alarm ? ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Day 20 reminder", "TRIGGER:PT9H", "END:VALARM"] : []),
    "END:VEVENT",
  ].join("\r\n"));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Day 20//Buyer reminders//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR", ""].join("\r\n");
}

const ics = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
