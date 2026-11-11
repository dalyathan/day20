// The buyer's time zone for this request, so dates read the way her phone shows them.
// The browser sends it (x-tz); anything that isn't a real IANA zone falls back to UTC.
import { AsyncLocalStorage } from "node:async_hooks";

const store = new AsyncLocalStorage();

export function validTz(tz) {
  if (typeof tz !== "string" || tz.length > 64 || !/^[A-Za-z_+\-\/0-9]+$/.test(tz)) return "UTC";
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return "UTC"; }
}
export const withTz = (tz, fn) => store.run(validTz(tz), fn);
export const currentTz = () => store.getStore() || "UTC";
