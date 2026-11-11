# Privacy and threat model

Still Open is a read-only assistant for a buyer with an open PayPal dispute. It's built around the scams that target people in that situation, so it has to be careful not to become one.

## What Still Open stores

| Data | Why | Where | How long |
|---|---|---|---|
| A session cookie (random ID, HMAC-signed) | Keeps you signed in | SQLite on the server | Until you disconnect; the cookie expires after 60 days, and demo data is deleted after 7 days |
| Your PayPal payer ID (if you use Log in with PayPal) | To find your cases | SQLite | Until you disconnect |
| Your answers about tracking and delivery | To work out your next step | SQLite | Until you disconnect |
| The result of each email check (the claims and the findings) | To list it on your one-page case | SQLite | Until you disconnect |
| Reminders you set, and an email address if you choose email reminders | To send them | SQLite | Until sent, or you disconnect |
| A web-push subscription (if you turn on notifications) | To send reminders | SQLite | Until you disconnect |

**Still Open doesn't store** your PayPal password (it never sees it), PayPal's access token, the email text you paste, or your screenshot. Pasted text and screenshots are processed for that one check and dropped. If an AI model is configured, the text or image goes to Anthropic's API for that check.

**The kill switch.** "Disconnect and delete my data" removes every row Still Open has for you, including sessions on your other devices, in one step.

## What Still Open can't do, by construction

- **It can't file, escalate, close or accept anything.** The server, the agent and the MCP server only make GET calls to PayPal, plus the token request. The only writes in the repo are in the sandbox setup script (`scripts/demo.js`), which plays the seller to build the demo case. The AI model's tools are all read-only (`lib/agent.js`).
- **It can't message the seller.** There's no channel to the seller.
- **It can't move money.**

## Threats we designed against

| Threat | What could go wrong | What Still Open does |
|---|---|---|
| Fake "refund issued" email, even from a genuine PayPal address | The buyer stops watching and her case closes on day 20 | Checks the email's claims against PayPal's case record. The sender address is never treated as proof, because real PayPal addresses have been abused to deliver scams. |
| Lookalike links (`paypal.com.case-review.net`) | Credential theft, then the scammer closes the case from inside her account | Flags any link that isn't on paypal.com and tells her to open the PayPal app herself |
| Prompt injection inside a pasted email | The email tells the AI to say "all clear" | The email is wrapped as data. The model can only call read-only tools. The verdict (`mismatch`, `careful`, `consistent`) comes from code. The buyer only ever sees sentences written by code: the model picks which ones, so injected text can't put words on her screen. |
| The AI over-promises or invents facts | False hope, or a padded case that hurts her with the reviewer | The model can't write what she reads; it picks from sentences code wrote from PayPal's record. The honesty rules (R1–R8 in `lib/rules.js`) run as a tripwire. The one-page case is built by code from PayPal's record and her own tagged words. |
| A buyer lies to Still Open | A false claim reaches PayPal | Her words are tagged as hers. Anything PayPal can check (a carrier scan behind a tracking number on the transaction) is labelled so the reviewer checks it. A lie becomes easier to catch, not harder. |
| Fake "Still Open" messages | Scammers impersonate the app | Still Open never sends sign-in links, never asks for a code or a password, and never asks you to pay. Reminders say only "open the PayPal app yourself". |
| Session theft | Someone reads her case | HttpOnly, SameSite=Lax, Secure cookies; a strict Content Security Policy (scripts from our own origin only); no third-party scripts. |
| Our own server is compromised | Exposure of what's stored | We store little, and nothing that can act on her PayPal account. |

## How to tell the real Still Open from a fake

The real Still Open never emails or texts you a link to sign in, never asks for a one-time code, and never asks you to pay anything. If something claiming to be Still Open does any of these, it isn't us.

## Limits we're open about

- **Login.** Log in with PayPal gives identity only. To read a buyer's own disputes in production, PayPal would need to offer a buyer-side, read-only, per-case scope. In the sandbox demo, Still Open reads the case through the demo seller account, because we own both test accounts.
- **Your word, not PayPal's.** "Delivered to ZIP 85705" is what you read on the carrier's page. It's tagged so the PayPal reviewer looks it up.
- **What Still Open isn't.** It isn't legal advice and it isn't affiliated with PayPal. PayPal decides every case.
