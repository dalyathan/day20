# Devpost submission: Day 20

**Name:** Day 20
**Tagline:** Emails can lie. Your PayPal case can't. Day 20 checks any email or screenshot about a PayPal dispute against the buyer's real case, and keeps the 20-day clock.
**Try it:** https://day20.onrender.com (tap "Try it as Maya", no sign-in) · **Code:** https://github.com/dalyathan/day20 (MIT) · **Video:** https://youtu.be/7K4jMCAOZwI

**In one line:** Day 20 checks any email about a PayPal dispute against the buyer's real case, and tells her what's true, what isn't, and what to do before the case closes by itself.

## Inspiration

Maya is an ICU nurse. She paid $66 with PayPal for a dress for her best friend's wedding. It never came: the tracking says delivered, in Tucson, Arizona; she lives in San Jose. She opened a PayPal dispute.

At 3:14 a.m., on her break, an email arrives from "PayPal Service" about her case: *"Just a quick note so you're not left wondering. Your $66.00 is already sitting in your PayPal balance on our side… Everything looks good from here."*

No link, no "click here", nothing a spam filter would flag. And it isn't true. If Maya believes it and waits, her case closes by itself on day 20, and a closed case can't be reopened. The $66 is gone.

Emails like this work because they look real: they can name a real case number and even arrive from a real PayPal address ([KnowBe4](https://blog.knowbe4.com/paypal-scam-from-paypal), [Malwarebytes](https://www.malwarebytes.com/blog/news/2026/04/more-paypal-emails-hijacked-to-deliver-tech-support-scams)). Online shopping was the second most reported fraud category in the FTC's 2024 data ([FTC](https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024)). Maya has ten minutes on a night break, so Day 20's answer is one line, and the deadline is a date.

**How her night ends:** she checks the USPS page and types in the Tucson ZIP. She screenshots the email and asks Day 20: *"This email is wrong about your PayPal case. PayPal shows no refund. Your case is still open: 13 days left, it closes Tue, Dec 1. Don't close it."* She escalates in PayPal. At 3:19 a.m. she's back with her patients, and on Dec 1 her case is with a PayPal reviewer instead of closed.

## What it does

- **Reads her case from PayPal:** status, refund, amount, ship-to ZIP, tracking, and the 20-day clock.
- **Checks any email or screenshot against it.** Refund claims, "your case is closed", requests to close or cancel, lookalike links, requests for codes, stalling. It judges the claims, not the sender.
- **Answers in one line**, from PayPal's record, with the deadline as a date.
- **Gives the next step**, including "not yet" when an honest seller deserves time and "not covered" when Buyer Protection doesn't apply.
- **Drafts a one-page case for the reviewer**, with the two facts she can check first: the carrier's delivered ZIP and PayPal's ship-to ZIP. Every line is labelled PayPal record, PayPal can check, or buyer reports.
- **Reminders on day 15 and day 18**, if she wants them.
- **Works in English and Spanish.**

It only reads. Escalating, closing or accepting is always her call, in PayPal.

## How PayPal and Claude work together

- **PayPal** is the source of truth: Day 20 reads the dispute, follows it to the order for the ship-to address and tracking, and keeps the clock.
- **Claude** reads the email or the screenshot and works out what it claims, even when the lie is reworded with no link and no keyword. Every red flag it raises must quote the email (for a screenshot, the text it read from it).
- **Day 20** compares each claim with PayPal's record, decides the verdict and the deadline, and writes every sentence Maya reads. So the answer always comes from her case, never from the model's opinion.

## Results, on the live app

- **Maya's email was caught in every run**, as text and as a screenshot. Keyword rules alone don't catch it; Claude's quote-checked reading does. (It's one of the 24 scam emails we tuned on.)
- **Scams flagged red: 11 of 24 with Claude**, 9 of 24 with keyword rules alone. None was called safe: on an open case no email can get green, so every other scam got "Go by your PayPal case, not this email" and the real deadline.
- **Genuine emails flagged red: 0 of 36.** On 12 more, written later by someone who never saw the code: 1 before a fix (a real refund from another shop), 0 after.
- **Real messages scam sellers sent buyers** (6, quoted in PayPal Community threads, never tuned on): 5 of 6 told "Don't close it" in every run. The rules already did that; Claude added nothing there.

`npm run live-summary` recomputes every number from the saved results in [`tests/live/`](https://github.com/dalyathan/day20/tree/main/tests/live).

## How we built it

- **PayPal sandbox:** Disputes API, the capture's link to Orders v2, and the Tracking API. Maya's case is a real sandbox dispute: a $66 order, captured, tracking added, "item not received". The demo replays it at day 7, with its status set back to open (labelled "Replay" in the app).
- **Claude (Anthropic API)** as a read-only tool loop, with its claims checked by Day 20 before they count.
- **Node.js** with zero dependencies, on Render; web push for reminders; an MCP server so any assistant can check an email against a case; a Postman collection of every PayPal call.
- **Testing:** AI agents played scammers and honest senders and scored a point for every mistake they caused; each mistake became a test.

## Challenges

- **Making the AI safe to trust at 3 a.m.** We stopped letting the model write anything Maya reads. It picks from sentences Day 20 has written, and its red flags must quote the email.
- **Reading a buyer's case from outside PayPal.** Today the demo reads a sandbox case; real buyers need the consent flow below.

## Accomplishments that we're proud of

- The answer always comes from PayPal's record, never from the model's opinion.
- It reads screenshots, because that's how people actually share a scary email.
- It's read-only: Day 20 refuses any PayPal call that would change something, and a test checks it.

## What we learned

The most useful thing an assistant can do here is simple: keep the clock, compare claims with the record, and put the checkable facts first.

## What's next: our asks to PayPal

1. **Label seller-written text in PayPal's own emails**, and block refund claims and case numbers in invoice and money-request notes.
2. **Show the buyer the delivery mismatch before day 20:** the carrier's delivered ZIP next to the ship-to ZIP on her case page.
3. **A buyer consent flow for `disputes/read-buyer`, plus buyer-side dispute webhooks**, so an app like Day 20 can read only her own cases, with her permission. Today we found no way for a buyer to grant that scope: Log in with PayPal gives identity only.
4. **Or build it in:** a "Got an email about this case? Check it" button on the case page in the Resolution Center, which already has the record. Day 20 is the open-source prototype.

## Built with

PayPal Disputes API · PayPal Orders v2 · PayPal Tracking API · PayPal sandbox · Claude (Anthropic API) · Node.js · Render · MCP · Postman · Web Push

*Not affiliated with or endorsed by PayPal. PayPal decides every case.*
