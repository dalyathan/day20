# Video: Day 20 (2:07, captions, no voiceover)

No narration: every word on screen is a caption. Phone footage is a scripted recording of the app with the saved
sandbox case (replay, set to "open" at day 7). The two email checks show **responses captured from the live app
with Claude on** (day20.onrender.com, commit 6c9528a), rendered by the same app, and the captions say so. Maya and
Rosa are animated SVG characters from `public/characters.js`.

| Time | On screen | Caption |
|---|---|---|
| 0:00–0:07 | Night. A PayPal-looking email: "refund issued … No further action is required … please close your case". | "3:14 a.m. Maya, an ICU nurse, is on her break. Her PayPal case is open. Then this arrives." |
| 0:07–0:15 | Maya (animated). | "It isn't true. If she believes it and waits, her case closes by itself on day 20. Under PayPal's rules, a closed case can't be reopened. Maya isn't giving up." |
| 0:15–0:22 | Phone: case screen, 7 of 20, closes Tue, Dec 1. | "Day 20 reads her PayPal case. Read-only: status, refund, ship-to ZIP, tracking, and the 20-day clock." Small: "Demo: our own sandbox case, read through our test seller account and set to 'open' at day 7. Real buyers would need a read-only scope from PayPal." |
| 0:22–0:28 | Phone: she pastes the email; "Checking…" while Claude reads. | "She pastes the email. Claude reads it. Code checks each claim against PayPal's record." Small: "Recorded from the live app with Claude on." |
| 0:28–0:37 | Phone: "This email is wrong", report it, next step. | "It's wrong. No refund. Case open. First: report it to phishing@paypal.com. Then: escalate before day 20." |
| 0:37–0:43 | Phone: the AI summary ("the AI picked these sentences"). | "Claude picks what she reads. Every sentence is written by code from her PayPal record. The AI only chooses which ones." |
| 0:43–0:56 | Phone: a second email, "Your $66.00 is already sitting in your PayPal balance", then a zoom on the trace: `read_claim (rules) → case PP-…` and, highlighted, `read_claim (Claude) → added what the rules missed: refund $66; no action needed`. | "A lie the keyword rules miss. Rules saw only a case number. Claude caught the refund claim, and code checked its quote." |
| 0:56–1:03 | Phone: next step, "Ask PayPal to step in by Sun, Nov 29", outlined Escalate button. | "Escalate by Sun, Nov 29. Two days before the case closes on Tue, Dec 1. Day 20 never files: she taps Escalate in PayPal herself." |
| 1:03–1:08 | Phone: the case at its real sandbox status, "With a PayPal reviewer". | "The real sandbox case, today. PayPal moved it to review on its own. (Still a saved replay.)" |
| 1:08–1:18 | Phone: the one-page case, every line tagged. | "For the reviewer: the deciding fact first. Every line is labelled: PayPal's record, something PayPal can check, or Maya's own words." |
| 1:18–1:27 | Rosa (animated), the reviewer. | "Rosa reviews PayPal disputes. She'll never meet Maya. She reads the case, and checks line 1 of Maya's page first. This time, Maya acts before day 20." |
| 1:27–1:36 | Under the hood. | "Claude reads. Code decides. Claude reads messy emails and screenshots. Code decides the verdict and the deadline. Code writes every sentence Maya sees. Claude's red flags must quote the email." |
| 1:36–1:45 | Same 60 test emails. | Scams flagged red: rules alone 9/24, with Claude 11/24. Genuine emails wrongly flagged red: 0/36 and 0/36. "Emails we had tuned on. Every scam still got at least 'go by your PayPal case, not this email'." |
| 1:45–1:53 | Email it had never seen. | "12 new genuine emails: 11 left alone, in all 3 runs with Claude. The one miss: a real refund from a different shop. Unseen scams with Claude: not measured yet." |
| 1:53–2:00 | How we tested it. | "AI agents played scammers and honest senders, scoring a point for every mistake they caused. Each mistake became a test. The email-test numbers re-run from the repo." |
| 2:00–2:07 | End card. | "Emails can lie. Your PayPal case can't. Day 20 · day20.onrender.com · Sandbox prototype · read-only by code · free for buyers · open source (MIT). Built on PayPal's sandbox APIs. Not affiliated with or endorsed by PayPal. PayPal decides every case." |
