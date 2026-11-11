# Devpost submission: Day 20

**Name:** Day 20
**Tagline:** Emails can lie. Your PayPal case can't.
**Try it:** https://day20.onrender.com (tap "Try it as Maya", no sign-in) · **Code:** https://github.com/dalyathan/day20 (MIT)

## Inspiration

Maya is an ICU nurse. She paid $66 with PayPal for a dress for her best friend's wedding. It never came: the tracking says delivered, in Tucson, Arizona; she lives in San Jose. She opened a PayPal dispute. Then, at 3:14 a.m. on her break, an email from `service@paypal.com`: *"The seller has issued a full refund of $66.00. Your case has been resolved. No further action is required."*

It isn't true. If she believes it, her case closes by itself on day 20, and a closed case can't be reopened. Emails like this are real: security researchers have reported scams sent through PayPal's own genuine `service@paypal.com` address ([Malwarebytes, Apr 2026](https://www.malwarebytes.com/blog/news/2026/04/more-paypal-emails-hijacked-to-deliver-tech-support-scams)), and online shopping was the second most reported fraud category in the FTC's 2024 data ([FTC](https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024)). Maya is our persona; we role-played 24 dispute scenes like hers with AI agents to design Day 20. In those scenes, honest buyers mostly lost *before* review, to the clock and to emails like this, not *at* review.

## What it does

A mobile web app for a buyer with an open PayPal dispute.

- **Reads her case from PayPal, read-only:** status, refund, amount, dates, ship-to ZIP, tracking, and the 20-day clock.
- **Checks any email against that record.** Claude reads the email (or a screenshot); code compares each claim with PayPal's record: refunds, "case closed", requests to close or cancel, lookalike links, requests for codes, stalling. The sender's address is never proof.
- **Answers in one line from PayPal's record:** "PayPal shows no refund. Your case is still open: 13 days left, it closes Tue, Dec 1. Don't close it."
- **Gives the next step**, including "not yet" when an honest seller deserves time and "not covered" when Buyer Protection doesn't apply.
- **Drafts a one-page case for the reviewer:** the deciding fact on line 1, each line labelled `PAYPAL RECORD`, `PAYPAL CAN CHECK` or `BUYER REPORTS`.
- **Reminders she chooses** (day 15 and day 18), silent by default.

It never files, escalates, closes or accepts anything; she does that in PayPal. Read-only is enforced by code: the app only makes GET calls. Pasted emails go to Anthropic's API to be read and aren't stored; reminder emails, if she chooses them, go through Resend.

## How we built it

**Claude reads → code decides → Claude picks which code-written sentences she sees.**

- **PayPal (sandbox):** Disputes API, then the capture's `up` link to Orders v2 for the ship-to address and trackers, plus the Tracking API. Maya's case is a real sandbox dispute: a $66 order, captured, seller tracking added, "item not received". The demo is a labelled replay of it at the open stage, read through our own test seller account; the real case is one tap away.
- **Why not PayPal's Agent Toolkit?** Its dispute tools are merchant-side and include `accept_dispute_claim`. Day 20 is for the buyer and must not be able to act, so it makes only the read calls.
- **Agent:** a Claude tool loop (`read_case`, `read_claim`, `compare`, `next_step`, `draft_page`, `schedule_reminder`, `note_options`, `compose_note`), all read-only. The model can add a warning but never remove one, and a red flag only counts if Claude quotes the sentence and code confirms it's in the email (for a screenshot, in the transcription) and isn't negated or hypothetical; amounts must appear in the email too.
- **Also:** Node 22 with zero dependencies on Render; an MCP server with five read-only functions (it uses the rules reader; your own assistant does the reading); a Postman collection of every PayPal call (its Day 20 folder runs in CI); web push from the RFCs; Spanish.

## Who tests the AI?

AI agents played scammers, a rule-breaker and honest senders, scoring a point for every mistake they caused; each mistake became a test. The biggest lesson: our regex honesty filter caught 0 of 33 new harmful sentences, so **the model no longer writes anything Maya reads.**

**Does Claude help?** Same 60 test emails, run through the deployed app, one run each. These are emails we tuned on, including the evidence check:

| | Rules alone | With Claude |
|---|---|---|
| Scams flagged red (contradicts PayPal's record) | 9 / 24 | **11 / 24** |
| Scams still warned about (red, or "go by your PayPal case, not this email") | 24 / 24 | 24 / 24 |
| Genuine emails flagged red (all still get a caution) | 0 / 36 | **0 / 36** |

**On email it had never seen:** 12 genuine emails by a fresh writer, frozen before scoring: 11/12 not flagged red with rules alone, and 11/12 in each of 3 runs with Claude, so Claude added no false alarm (the miss is a real refund from a different shop). **We haven't measured unseen scams** with the current code: a fresh agent asked to write new ones was stopped by a safety check, and we didn't work around it.

Every email-test number re-runs from the repo (`npm run eval`, `npm run replay-heldout`, `npm run live-eval-deployed`); the agent-game counts (like "0 of 33") are our report.

## Why PayPal would want this

It isn't a "file more claims" button. In 8 of our 24 designed scenes it says **don't escalate yet, or at all**: the seller is answering, check with a neighbour, the item arrived as described, or the purchase isn't covered. The claims that do arrive lead with a fact the reviewer can check on line 1. The metric we'd want to move with PayPal: **fewer valid "item not received" cases closing unescalated on day 20** (lower is better), without more escalations of cases the seller resolves.

## Challenges

- **There's no buyer-side read API.** Log in with PayPal gives identity, not transactions, so the demo reads the case through our seller account. Real buyers need the scope below.
- **Regex can't police a language model.** So the model picks sentences instead of writing them.
- **Our own fixes created false alarms** (the first live run flagged 2 genuine emails red), which is why model flags now need checkable quotes.

## Accomplishments that we're proud of

- The model can't write a sentence Maya reads, and its red flags must quote the email.
- We publish our misses, and every email-test number, including held-out scores from old commits, re-runs from the repo.
- A real sandbox dispute end to end, and a live app judges can try in 30 seconds.

## What we learned

The most useful thing an agent can do here is boring: keep the clock, compare claims with the record, and put the deciding fact on line 1. Persuasion and filing are where the harm is.

## What's next: our asks to PayPal

1. **A buyer-consented, read-only `disputes.read` scope** for the buyer's own cases, so Day 20 works for real buyers.
2. **The carrier's delivered ZIP on the dispute record,** with a mismatch against the ship-to ZIP flagged to the reviewer automatically.
3. **Dispute webhooks for buyer apps,** so reminders follow the case's real status instead of dates.

## Built with

PayPal Disputes API · PayPal Orders v2 · PayPal Captures · PayPal Tracking API · PayPal sandbox · Claude (Anthropic API) · Node.js · Render · MCP · Postman · Web Push (VAPID, RFC 8291)

*Not affiliated with or endorsed by PayPal. Not legal or financial advice. PayPal decides every case.*
