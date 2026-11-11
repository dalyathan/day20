# Devpost submission: Day 20

**Name:** Day 20
**Tagline:** Emails can lie. Your PayPal case can't.
**Try it:** https://day20.onrender.com (tap "Try it as Maya", no sign-in) · **Code:** https://github.com/dalyathan/day20 (MIT)

**In one line:** a fake "your refund is already in your balance" email, sent as a screenshot, checked against the buyer's real PayPal case: keyword rules can't read it, Claude can, and code makes the call.

## Inspiration

Maya is an ICU nurse. She paid $66 with PayPal for a dress for her best friend's wedding. It never came: the tracking says delivered, in Tucson, Arizona; she lives in San Jose. She opened a PayPal dispute.

At 3:14 a.m., on her break, an email arrives from "PayPal Service" about her case: *"Just a quick note so you're not left wondering. Your $66.00 is already sitting in your PayPal balance on our side… Everything looks good from here."*

No link, no "click here", nothing a keyword filter flags. And it isn't true. The seller wrote it; he can see her case number. The `service@paypal.com` on the From line proves nothing: display names can be faked, and anyone with a PayPal account can even get PayPal's real servers to deliver their own words in an invoice or money-request note ([KnowBe4](https://blog.knowbe4.com/paypal-scam-from-paypal), [Malwarebytes](https://www.malwarebytes.com/blog/news/2026/04/more-paypal-emails-hijacked-to-deliver-tech-support-scams)). If Maya believes it and waits, her case closes by itself on Tue, Dec 1, day 20. A closed case can't be reopened, and the $66 is gone.

She has ten minutes on a night break, so Day 20's answer is one line, and the deadline is a date, not a rule to look up. Online shopping was the second most reported fraud category in the FTC's 2024 data ([FTC](https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024)). Maya is our persona, not a real user: we role-played 24 dispute scenes like hers with AI agents to design Day 20. In those scenes, honest buyers mostly lost *before* review, to the clock and to emails like this one, not *at* review.

**How her night ends in the demo:** Maya screenshots the email and asks Day 20. It says the email is wrong: PayPal shows no refund, and the case is open, 13 days before it closes. She checks the USPS page herself, types in the Tucson ZIP, and escalates in PayPal. Her one-page case opens with the two ZIPs the reviewer can check. At 3:19 a.m. she's back with her patients. The reviewer decides; Day 20 only made sure the case was still open when Maya acted.

## What it does

Day 20 is a buyer safety layer for PayPal disputes, built so PayPal could ship it inside its own dispute screens (it's MIT-licensed).

- **Reads her case from PayPal:** status, refund, amount, dates, ship-to ZIP, tracking, and the 20-day clock.
- **Checks any email or screenshot against that record.** Claude reads it; code compares each claim with PayPal's record: refunds, "case closed", requests to close or cancel, lookalike links, requests for codes, stalling. The sender's address is never proof.
- **Answers in one line from PayPal's record:** "PayPal shows no refund. Your case is still open: 13 days left, it closes Tue, Dec 1. Don't close it."
- **Keeps her own check apart from PayPal's record.** The delivered ZIP is what Maya read on the carrier's page. It's labelled "Your check", beside "PayPal's record: your ship-to ZIP".
- **Gives the next step,** including "not yet" when an honest seller deserves time and "not covered" when Buyer Protection doesn't apply.
- **Drafts a one-page case for the reviewer.** Its first two lines are the facts she can check: the carrier's delivered ZIP (on tracking the seller added) and PayPal's ship-to ZIP. Every line is labelled `PAYPAL RECORD`, `PAYPAL CAN CHECK` or `BUYER REPORTS`.
- **Reminders she chooses** (day 15 and day 18), silent by default.

It never files, escalates, closes or accepts anything. She does that in PayPal. Its PayPal client refuses any call that isn't a read, and a test checks that; the only writes are the setup scripts that create the sandbox case. Pasted emails go to Anthropic's API to be read. Day 20 doesn't keep the email text, but Anthropic's API data policy applies. Reminder emails, if she chooses them, go through Resend.

## What Claude does, and what it doesn't

Claude makes two decisions:
1. **What does this email claim?** It reads reworded lies and screenshots that keyword rules can't. A red flag only counts if Claude quotes the sentence and code confirms it's in the email and isn't negated or hypothetical. (For a screenshot the quote is checked against Claude's own transcription, so that check is weaker.) Amounts must appear in the email too.
2. **Which code-written sentences does Maya read?** Code writes every sentence; Claude picks from them. Claude can add a warning but never remove one. (We haven't measured whether Claude's choice beats a fixed order.)

Code decides the rest: each claim against PayPal's record, the verdict, the deadline and the next step.

**Results on the deployed app, with Claude on** (claude-sonnet-5-5; check code at commit 197d0f3, unchanged in 95b7bb3). Raw rows: [`tests/live/`](https://github.com/dalyathan/day20/tree/main/tests/live); summary: `npm run live-summary`; re-run them yourself by pasting `scripts/live-eval-browser.js` into the browser console on the live site.

| | Keyword rules alone | With Claude |
|---|---|---|
| Scam emails flagged red (the 24 we tuned on) | 9 / 24 | **11 / 24 in each of 3 runs** (the same 11 every time) |
| Genuine emails wrongly flagged red (36) | 0 / 36 | **0 / 36 in each of 2 runs** |
| Scam **screenshots** flagged red (all 24, one run) | can't read images | **11 / 24: the same 11 as the text** |

- **What Claude adds on text is narrow: 2 of 24, both reworded refund lies like Maya's** ("already sitting in your PayPal balance"). It catches them in all 3 runs. The other 13 scams aren't flagged red by either reader; they get the amber "go by your PayPal case, not this email", which every email that isn't flagged red gets, genuine ones included.
- **On screenshots, Claude is the only reader.** It transcribes the image, then the same checks run. Over all 24 scam screenshots it flagged the same 11 as the text versions, so reading an image costs nothing. Screenshots of 6 held-out genuine emails: 1 flagged, the same different-shop refund the rules flag as text.
- **Genuine email it had never seen** (held-out set 8: 12 emails by a fresh writer, frozen before scoring): 11/12 left alone in each of 3 runs at commit 2ddc64e, and in 1 run on the current code (95b7bb3). Keyword rules alone also score 11/12, and Claude can't remove a flag, so this shows Claude **added no false alarm**, not that it fixed one.
- **Not measured:** unseen scams (a fresh agent asked to write new ones was stopped by a safety check, and we didn't work around it), and whether Claude's choice of sentences beats a fixed order.


## How we built it

- **PayPal (sandbox):** Disputes API, then the capture's `up` link to Orders v2 for the ship-to address and trackers, plus the Tracking API. Maya's case is a real sandbox dispute: a $66 order, captured, seller tracking added, "item not received". The demo is a labelled replay of it at the open stage, read through our own test seller account.
- **Why not PayPal's Agent Toolkit?** Its dispute tools are merchant-side and include `accept_dispute_claim`. Day 20 is for the buyer and must not be able to act, so it makes only the read calls.
- **Agent:** a Claude tool loop, all read-only. Most of its tools just hand Claude the case, the comparison and the sentence options; the two decisions above are the real work.
- **Also:** Node 22 with zero dependencies on Render; an MCP server with five read-only functions (it uses the rules reader, and your own assistant does the reading); a Postman collection of every PayPal call (its Day 20 folder runs in CI); web push from the RFCs; Spanish.

## Who tests the AI?

AI agents played scammers and honest senders and scored a point for every mistake they caused; each mistake became a test. When a regex filter on the model's own sentences caught 0 of 33 harmful ones, we stopped letting the model write anything Maya reads.

## Why PayPal would want this

It isn't a "file more claims" button. In 8 of our 24 designed scenes it says **don't escalate yet, or at all**: the seller is answering, check with a neighbour, the item arrived as described, or the purchase isn't covered. The claims that do arrive open with the two facts a reviewer can check. The metric we'd want to move with PayPal: **fewer valid "item not received" cases closing unescalated on day 20**, without more escalations of cases the seller resolves.

## Challenges

- **An outside app can't read a buyer's case yet.** PayPal's API lists a `disputes/read-buyer` scope, but we found no way for a third-party app to get a buyer's consent for it (Log in with PayPal gives identity, not transactions). So the demo reads the case through our own seller account.
- **Regex can't police a language model.** So the model picks sentences instead of writing them.
- **Our own fixes created false alarms.** The first live run flagged 2 genuine emails red, which is why Claude's flags now need checkable quotes.

## Accomplishments that we're proud of

- The model can't write a sentence Maya reads, and its red flags must quote the email.
- Read-only isn't just a promise: the PayPal client refuses writes, and a test proves it.
- We publish our misses, and every email-test number re-runs, including held-out scores from old commits.

## What we learned

The most useful thing an agent can do here is boring: keep the clock, compare claims with the record, and put the checkable facts first. Persuasion and filing are where the harm is.

## What's next: our asks to PayPal

1. **Label seller-written text in PayPal's own emails.** Invoice and money-request notes arrive from `service@paypal.com`. Mark them "written by the seller", and block refund claims and dispute case numbers in them.
2. **Put the carrier's delivered ZIP on the dispute record,** and flag a mismatch with the ship-to ZIP to the reviewer. That helps reviewers whether or not anyone uses Day 20.
3. **Let buyers consent to `disputes/read-buyer` for an outside app,** and extend dispute webhooks to buyers, so reminders follow the case's real status. Or ship Day 20 inside PayPal's dispute screens: it's MIT-licensed and only reads.

## Built with

PayPal Disputes API · PayPal Orders v2 · PayPal Captures · PayPal Tracking API · PayPal sandbox · Claude (Anthropic API) · Node.js · Render · MCP · Postman · Web Push (VAPID, RFC 8291)

*Not affiliated with or endorsed by PayPal. Not legal or financial advice. PayPal decides every case.*
