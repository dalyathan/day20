# Devpost submission: Day 20

**Name:** Day 20
**Tagline:** Emails can lie. Your PayPal case can't.

## Inspiration

Almost everyone has tried to get a refund from a far-away store and given up. We played out 24 dispute scenarios with AI agents: ghost stores, honest sellers, opportunist buyers, and a blind PayPal reviewer. PayPal's rules usually worked when the evidence was clear. Honest buyers lost *before* review. They lost to the 20-day clock, to "accept 30% and keep the item" offers, and to fake "your refund has been issued" emails, some delivered through PayPal's own real addresses. One of those players was Maya, an ICU nurse checking her phone at 3:14 a.m.

## What it does

Day 20 is a mobile web app for a buyer with an open PayPal dispute.

- **It reads her case from PayPal, read-only:** status, refund, amount, dates, the ship-to ZIP, and the tracking on file.
- **It checks any email she shares against that record:** refund claims, "case closed", reshipment numbers, lookalike links, requests for codes, and stalling ("no need to escalate"). Who sent the email is never treated as proof.
- **It answers in one line built from PayPal's record.** For example: "PayPal shows no refund. Your case is still open: 13 days left. Don't close it."
- **It tells her the next step.** That includes "not yet" when an honest seller deserves time, and "not covered" when Buyer Protection doesn't apply. It won't help with a false claim.
- **It drafts a one-page case for the PayPal reviewer.** The deciding fact comes first, and every line is tagged `PAYPAL RECORD`, `PAYPAL CAN CHECK` or `BUYER REPORTS`.
- **It sends reminders she chooses** on day 15 and day 18, by web push, email or calendar, silent by default.

Day 20 never files, escalates, closes or accepts anything. She does those in PayPal herself.

## How we built it

- **Runtime:** Node 22 with zero dependencies, hosted on Render, as a PWA front end.
- **PayPal:** Disputes API, Orders v2, Captures, Tracking, and Log in with PayPal, all in the sandbox. Maya's case is a real sandbox dispute: a $66 order, captured, with seller tracking added and a buyer "not received" dispute.
- **Agent:** a Claude tool loop with `read_case`, `read_claim`, `compare`, `next_step`, `draft_page` and `schedule_reminder`, every one of them read-only.
  - Screenshots are transcribed by a separate call with no tools.
  - The verdict and the bottom line come from code, not from the model.
  - The model's note must pass eight honesty rules enforced in code: no claimed actions, no promises, no "use the link", no naming the sender, no "verified", no reason-coaching, no off-PayPal links or phones, and no fact the record doesn't show. If it breaks one, a plain template replaces it.
- **Also shipped:** an MCP server exposing the same read-only tools, a Postman collection of every PayPal call, web push implemented from the RFCs (tested against the RFC 8291 vector), and an eval suite.

## Who tests the AI?

We tested it the way it would be attacked, as games with incentives:

- **Scammer agents** were paid for every fake email the checker called safe. In round one, 7 of 12 got through, because a real case number made an email look "consistent". We changed the design: a real case number never counts as proof, and any email about the case defaults to "careful".
- **A cheat** was paid for false claims that reached the one-page case. It forged a tag through a newline. Buyer text is now sanitised, and only a validated ZIP can sit in a checkable line.
- **A rule-breaker** was paid for harmful notes that passed the rules, and for helpful ones that got blocked. It found 16 misses and 8 false alarms. The rules were rewritten to handle negation, passive voice, domain parsing and fact checks.
- **A blind reviewer ("Rosa")** judged the one-page cases. She caught a buyer's lie because the line was tagged as checkable.

Every successful attack became a regression test. A second round with fresh attackers is reported separately in `docs/GAMES.md`.

## Challenges

- **There's no buyer-side read API.** Log in with PayPal gives identity, not transactions. Our sandbox demo reads the case through the seller account, because we own both test accounts, and we say so.
- **Regex rules can't fully police a language model.** So the model's note is never load-bearing.

## What we learned

The most valuable thing an agent can do here is boring: keep the clock, compare claims with the record, and put the deciding fact on line 1. Persuasion and filing are where the harm is.

## What's next: our asks to PayPal

1. A buyer-side, read-only, per-case scope.
2. A delivered-ZIP vs ship-to-ZIP check before funds are released.
3. A verified-agent lane, with a kill switch the buyer controls.

## Built with

PayPal Disputes API · PayPal Orders v2 · Log in with PayPal · PayPal sandbox · Claude (Anthropic API) · Node.js · Render · MCP · Postman · Web Push (VAPID, RFC 8291)

*Not affiliated with or endorsed by PayPal. Not legal or financial advice. PayPal decides every case.*
