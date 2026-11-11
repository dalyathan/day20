// Reminders the buyer schedules herself, as a calendar file. Silent by default:
// in the game, an "unmissable" reminder got the app muted.
import { clock, phase } from "./record.js";
import { currentTz } from "./tz.js";

// The buyer's calendar day (YYYY-MM-DD in her time zone) containing an instant.
// Reminder days are picked on her calendar, the way her phone shows the dates —
// on UTC days a buyer in Tokyo could see "escalate today" hours early.
const localDay = (d) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: currentTz(), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
// A YYYY-MM-DD day shifted by whole calendar days (UTC arithmetic on the date itself, so DST never shifts the result).
const shiftDay = (day, n) => { const [y, m, d] = day.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };

export function suggestReminders(r, now = new Date()) {
  if (phase(r) !== "open") return [];
  const ck = clock(r, now);
  const closes = new Date(ck.closesAt);
  const today = localDay(now);
  const list = [];
  // A reminder is an all-day event on a calendar day: keep it while its day is today or later in the buyer's zone.
  const push = (day, title, why) => { if (day >= today) list.push({ at: `${day}T00:00:00.000Z`, title, why }); };
  push(localDay(new Date(ck.escalateFrom)), "Day 20: you can escalate your PayPal case today", "7 days since you paid");
  const closeDay = localDay(closes);
  push(shiftDay(closeDay, -5), "Day 20: 5 days left on your PayPal case", "Day 15 of 20");
  push(shiftDay(closeDay, -2), "Day 20: escalate today, your case closes in 2 days", "Day 18 of 20");
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
