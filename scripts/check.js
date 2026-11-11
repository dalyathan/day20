// Step 0: can we talk to PayPal's sandbox, and does the app have the disputes permission?
import { getToken, BASE } from "../lib/paypal.js";
const t = await getToken();
const scopes = t.scope.split(" ");
const has = (s) => scopes.some((x) => x.includes(s));
console.log(`Connected to ${BASE}`);
console.log(`Disputes permission:   ${has("disputes") ? "yes" : "NO - tick Customer disputes in the app settings"}`);
console.log(`Payments permission:   ${has("payments") || has("checkout") ? "yes" : "unclear"}`);
console.log(`Tracking permission:   ${has("shipping") || has("tracking") ? "yes" : "unclear"}`);
