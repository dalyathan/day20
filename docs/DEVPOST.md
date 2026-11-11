# Devpost submission: Day 20

**Name:** Day 20
**Tagline:** Emails can lie. Your PayPal case can't.
**Try it:** https://day20.onrender.com (tap "Try it as Maya", no sign-in) · **Code:** https://github.com/dalyathan/day20 (MIT)

**In one line:** Day 20 checks any email about a PayPal dispute against the buyer's real case, and never calls a scam safe. Claude reads the email or a screenshot; code makes the call and keeps the 20-day clock.

**Why not just open the PayPal app?** The app shows the status, but not whether *this email* is lying, which of its claims are false, or what to do before the case closes by itself.

## Inspiration

Maya is an ICU nurse. She paid $66 with PayPal for a dress for her best friend's wedding. It never came: the tracking says delivered, in Tucson, Arizona; she lives in San Jose. She opened a PayPal dispute.

At 3:14 a.m., on her break, an email arrives from "PayPal Service" about her case: *"Just a quick note so you're not left wondering. Your $66.00 is already sitting in your PayPal balance on our side… Everything looks good from here."*

No link, no "click here", nothing a keyword filter flags. And it isn't true. The seller wrote it; he can see her case number. The `service@paypal.com` on the From line proves nothing: display names can be faked, and anyone with a PayPal account can even get PayPal's real servers to deliver their own words in an invoice or money-request note ([KnowBe4](https://blog.knowbe4.com/paypal-scam-from-paypal), [Malwarebytes](https://www.malwarebytes.com/blog/news/2026/04/more-paypal-emails-hijacked-to-deliver-tech-support-scams)). If Maya believes it and waits, her case closes by itself on Tue, Dec 1, day 20. A closed case can't be reopened, and the $66 is gone.

She has ten minutes on a night break, so Day 20's answer is one line, and the deadline is a date, not a rule to look up. Online shopping was the second most reported fraud category in the FTC's 2024 data ([FTC](https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024)).

**How her night ends in the demo:** Maya checks the USPS page herself and types in the Tucson ZIP. Then she screenshots the email and asks Day 20. It says the email is wrong: PayPal shows no refund, and the case is open, 13 days before it closes. She escalates in PayPal. Her one-page case opens with the two ZIPs the reviewer can check. At 3:19 a.m. she's back with her patients. On Dec 1 her case is with a reviewer, not closed. The reviewer decides; Day 20 only made sure the case was still open when Maya acted.

*Maya is a persona. We designed Day 20 by role-playing 24 dispute scenes like hers with AI agents; in them, honest buyers mostly lost before review, to the clock and to emails like this one.*

## What it does

Day 20 is a buyer safety layer for PayPal disputes, built so PayPal could ship it inside its own dispute screens (it's MIT-licensed).

- **Reads her case from PayPal:** status, refund, amount, dates, ship-to ZIP, tracking, and the 20-day clock.
- **Checks any email or screenshot against that record.** Claude reads it; code compares each claim with PayPal's record: refunds, "case closed", requests to close or cancel, lookalike links, requests for codes, stalling. The sender's address is never proof.
- **Answers in one line from PayPal's record:** "PayPal shows no refund. Your case is still open: 13 days left, it closes Tue, Dec 1. Don't close it."
- **Keeps her own check apart from PayPal's record.** The delivered ZIP is what Maya read on the carrier's page. It's labelled "Your check", beside "PayPal's record: your ship-to ZIP".
- **Gives the next step,** including "not yet" when an honest seller deserves time and "not covered" when Buyer Protection doesn't apply.
- **Drafts a one-page case for the reviewer.** Its first two lines are the facts she can check: the carrier's delivered ZIP (on tracking the seller added) and PayPal's ship-to ZIP. Every line is labelled `PAYPAL RECORD`, `PAYPAL CAN CHECK` or `BUYER REPORTS`, and the last says who prepared it.
- **Reminders she chooses** (day 15 and day 18), silent by default.

It never files, escalates, closes or accepts anything. She does that in PayPal. It's read-only by code: its PayPal client refuses any call that isn't a read, and a test checks that. (The sandbox credentials themselves could write; the only writes are the setup scripts that create the sandbox case.) Pasted emails go to Anthropic's API to be read, under Anthropic's API data policy. Day 20 doesn't store the email; it keeps the extracted facts (amounts, link hosts, tracking numbers, the verdict) with the case so the one-page case can cite them. Demo data is deleted after 7 days; a signed-in buyer's data stays until she taps Disconnect, which deletes it on every device. Day 20 never asks for a PayPal password or code, and never sends sign-in links. Reminder emails, if she chooses them, go through Resend.

## What Claude does, and what it doesn't

Claude makes two decisions:
1. **What does this email claim?** It reads reworded lies and screenshots that keyword rules can't. A red flag Claude adds only counts if it quotes the sentence and code confirms it's in the email and isn't negated or hypothetical. (For a screenshot the quote is checked against Claude's own transcription, so that check is weaker.) Amounts must appear in the email too.
2. **Which code-written sentences does Maya read?** Code writes every sentence; Claude picks from them. (We haven't measured whether Claude's choice beats a fixed order.)

On pasted text, Claude can add a warning but never remove one: the keyword rules always run too. On a screenshot Claude is the only reader, so it could miss a claim, but the worst case is still amber ("go by your PayPal case"), never "safe".

Code decides the rest: each claim against PayPal's record, the verdict, the deadline and the next step.

**Results on the deployed app, with Claude on** (claude-sonnet-5-5). Raw rows are in [`tests/live/`](https://github.com/dalyathan/day20/tree/main/tests/live) (exported from the browser and re-expanded; see its README), `npm run live-summary` prints the table, `npm run realworld` re-checks the rules-only column offline (with OCR for screenshots), and `scripts/live-eval-browser.js` re-runs it from the console on the live site.

**What Claude adds, in one sentence:** it reads screenshots, and it catches reworded refund lies the keyword rules miss, like Maya's "already sitting in your PayPal balance" (2 of our 24 test scams, in every run).

**No scam was ever called safe.** In an open case, every email that isn't flagged red gets the amber "Go by your PayPal case, not this email", genuine ones too; green is only possible when PayPal's record agrees with a refund or closed-case claim. That floor is by design, so the rows below measure what goes beyond it. The rules-only column is run offline (`npm run realworld`, `npm run eval`); the Claude column on the live app.

| | Keyword rules alone | With Claude |
|---|---|---|
| **Real messages scam sellers sent buyers** (6, quoted word for word in public threads, never tuned on): told "Don't close it" | 5 / 6 | **5 / 6 in all 3 runs**; Claude added nothing |
| Scam emails flagged red (24, tuned on) | 9 / 24 | **11 / 24 in each of 3 runs**, the same 11 |
| Scam screenshots flagged red (all 24, 1 run) | 9 / 24 with OCR (tesseract) first; the app itself can't read images without Claude | **11 / 24**, the same 11 as the text |
| Genuine emails wrongly flagged red (36, tuned on) | 0 / 36 | **0 / 36 in each of 2 runs** |
| Genuine **screenshots** wrongly flagged red (6 from set 8, 1 run, before the fix below) | 1 / 6 with OCR first | 1 / 6 (h8_01, the other-shop refund) |

- **The real-world set is the honest test, and Claude adds nothing there.** Five of the six are "close the dispute and we'll refund you"; the keyword rules already catch that request and say "Don't close it." The sixth threatens that a dispute "could result in zero funds being returned"; both readers give it only the general amber warning. None of the six claims anything about her case's record, so none is red. ([sources](https://github.com/dalyathan/day20/blob/main/tests/realworld/SOURCES.md))
- **What Claude adds is narrow: 2 of 24 tuned-on scams, both reworded refund lies**, including Maya's own email (it's in our test set). It catches them in every run as text (3 runs) and as a screenshot (1 run). On a screenshot, Claude reads what OCR plus the same rules would, plus those 2.
- **Genuine email it had never seen** (set 8: 12 emails by a fresh writer, frozen before scoring): 11/12 left alone in every run so far (3 runs at commit 2ddc64e, 1 at 95b7bb3), the same as the rules alone, so Claude added no false alarm. The miss was a real $27.50 refund from another shop, flagged red and marked "report it". We fixed that after scoring (a refund of another amount that doesn't name her case is now "may be another purchase"), so set 8 is now 12/12 as text (1 run; the screenshots weren't re-run) and no longer counts as unseen. The trade: a refund lie that gives another amount and doesn't name her case is now amber, not red, though she's still told her case is open and not to close it.
- **Commits:** tuned-on runs at 197d0f3 and 95b7bb3 (same check code); the real-world set, set 8 and a scam re-run at f0c0afd, after the fix above (scams: 11/24 again, the same 11). After that, one more gate: a "case decided / money on its way" claim added by Claude now needs a quote too. No measured red flag relied on one (they all came from the rules), so the numbers above stand. **Not measured:** unseen scams written to beat Day 20 (an AI agent asked to write them was stopped by a safety check, and we didn't work around it), and whether Claude's choice of sentences beats a fixed order.

## How we built it

- **PayPal (sandbox):** Disputes API, then the capture's `up` link to Orders v2 for the ship-to address and trackers, plus the Tracking API. Maya's case is a real sandbox dispute: a $66 order, captured, seller tracking added, "item not received". We created it in one sitting, so it was paid and disputed minutes apart, and PayPal has since moved it to review. The demo is a labelled replay of it set back to the open stage at day 7, read through our own test seller account.
- **Why not PayPal's Agent Toolkit?** It can be configured to list and get disputes only, but it runs on merchant credentials, and we wanted the no-writes guarantee in our own small client, enforced and tested in code. The MCP server could sit on the Toolkit's read actions instead.
- **Agent:** a Claude tool loop, all read-only. Most of its tools just hand Claude the case, the comparison and the sentence options; the two decisions above are the real work.
- **Also:** Node 22 with zero dependencies on Render; an MCP server with five read-only functions (it uses the rules reader, and your own assistant does the reading); a Postman collection of every PayPal call (its Day 20 folder runs in CI); web push from the RFCs; Spanish.

## Who tests the AI?

AI agents played scammers and honest senders and scored a point for every mistake they caused; each mistake became a test. When a regex filter on the model's own sentences caught 0 of 33 harmful ones (our game report; those game files aren't in the repo), we stopped letting the model write anything Maya reads.

## Why PayPal would want this

It isn't a "file more claims" button. In 8 of our 24 designed scenes it says **don't escalate yet, or at all**: the seller is answering, check with a neighbour, the item arrived as described, or the purchase isn't covered. The claims that do arrive open with the two facts a reviewer can check. The metric we'd want to move with PayPal: **fewer valid "item not received" cases closing unescalated on day 20**, without more escalations of cases the seller resolves.

## Challenges

- **An outside app can't read a buyer's case yet.** PayPal's API lists a `disputes/read-buyer` scope, but we found no way for a third-party app to get a buyer's consent for it (Log in with PayPal gives identity, not transactions). So the demo reads the case through our own seller account.
- **Regex can't police a language model.** So the model picks sentences instead of writing them.
- **Our own fixes created false alarms.** The first live run flagged 2 genuine emails red, which is why Claude's flags now need checkable quotes.

## Accomplishments that we're proud of

- The model can't write a sentence Maya reads, and its red flags must quote the email.
- Read-only by code: the PayPal client refuses writes, and a test checks it.
- We publish our misses, and every email-test number re-runs, including held-out scores from old commits.

## What we learned

The most useful thing an agent can do here is boring: keep the clock, compare claims with the record, and put the checkable facts first. Persuasion and filing are where the harm is.

## What's next: our asks to PayPal

1. **Label seller-written text in PayPal's own emails.** Invoice and money-request notes arrive from `service@paypal.com`. Mark them "written by the seller", and block refund claims and dispute case numbers in them.
2. **Show the buyer the delivery mismatch before day 20.** Reviewers already check proof of delivery against the ship-to address; buyers don't see that comparison until it's too late. Put the carrier's delivered ZIP next to the ship-to ZIP on the buyer's case page.
3. **An OAuth consent flow for `disputes/read-buyer`, and buyer-side delivery of the `CUSTOMER.DISPUTE.*` webhooks,** so an outside app can read only the buyer's own cases, with her permission, and reminders follow the case's real status.

## Built with

PayPal Disputes API · PayPal Orders v2 · PayPal Captures · PayPal Tracking API · PayPal sandbox · Claude (Anthropic API) · Node.js · Render · MCP · Postman · Web Push (VAPID, RFC 8291)

*Not affiliated with or endorsed by PayPal. Not legal or financial advice. PayPal decides every case.*
