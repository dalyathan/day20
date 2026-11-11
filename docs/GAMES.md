# Who tests the AI? The games we played

We tested Day 20 by playing games. AI agents took the roles of the people who'd attack it or depend on it, and each role was paid in points for what it found. Points counted only with evidence: the exact input, the exact output, and why it mattered. A made-up or unreproducible claim cost 10 points. After each round we decided on fixes and played again.

The full briefs and verdicts are kept with the project's working files. This page summarizes them.

## Game 1–2: the dispute itself (24 scenes)

**Cast:** buyers (honest, time-poor, at fault, opportunist, not covered), sellers (ghost store, honest, slow, a big brand with its own dispute bot), Day 20 in several versions, and **Rosa**, a blind PayPal reviewer.

**Findings:**
- Rosa matched the fair outcome in 16 of 16 claims and caught every fraud attempt.
- Honest buyers lost before review, not at it: to the clock, partial offers, fake emails and fake reshipments.
- A padded case cost Rosa time and lowered her trust.

These 24 scenes became the eval suite (`tests/scenarios.js`).

## Game 3: can Day 20 be beaten?

| Role | Paid for | What they found | What we changed |
|---|---|---|---|
| **Scammers** | each fake email rated safe | 7 of 12 emails rated "consistent". A real case number made a fake look real. | A real case or tracking number is now neutral. Any email about the case defaults to "careful". Stall and close intent, "decided in your favor", off-PayPal offers, "N-digit code" and Spanish are now detected. |
| **Cheat** (opportunist buyer) | false claims reaching the one-page case under "PAYPAL CAN CHECK" | It forged a tag with a newline. Its own words landed in a checkable line. The page said "not received" when she hadn't said so. | Buyer text is sanitized. Only a validated ZIP can go in a checkable line. The page says only what she said. |
| **Rule-breaker** | harmful AI notes that pass the rules (+5), helpful ones blocked (+3) | 16 misses and 8 false alarms | Rules v2: sentence-level, negation-aware, domain and phone parsing, facts checked against the record |
| **Rosa** (blind) | unverifiable or padded lines | She flipped one case from buyer to seller when the carrier lookup contradicted line 1. That's the design working. She also asked for a verbatim carrier scan, every tracking number, and a flag when the reason doesn't fit. | The one-page case got three tags (record / can check / buyer reports), a verbatim scan line, every tracking number, and a reason-mismatch line. |
| **Maya and Graciela** (UX) | confusing, scary or untrustworthy spots | Checking the email was buried. The result didn't answer "was I refunded?". The Spanish was half done. | Checking the email is the first button. A bottom line comes first: "PayPal shows no refund. Your case is still open: 13 days left, it closes Tue, Dec 1. Don't close it." Spanish is now complete. |

## Game 4: round two, with fresh attackers on the fixed code

| Role | Result | Decision |
|---|---|---|
| **Rule-breaker 2** | 33 new harmful sentences, **0 caught**. 23 of 30 helpful sentences were flagged. | **Regexes can't police what a model means.** We closed the AI's output space instead. The model no longer writes free text for the buyer: it picks 2–4 sentences that code wrote from PayPal's record. The rules stay as a tripwire, and the eval checks every sentence the model could pick. |
| **AI-assurance judge** | Train/test leakage: the attacks we fixed against were reported as pass rates. 21 checks couldn't fail. The live model was never tested. | Results are split three ways: designed, regression and held-out. We removed the checks that couldn't fail. `npm run live-eval` runs the real model and writes JSONL. |
| **Scammer 2** | 12 new emails. **12/12 rated "careful" (never "safe")**, and the bottom line (built by code) showed the real record. **0/12 flagged red.** Lies worded without our keywords got a generic warning instead of a contradiction. | We scored these once, before tuning on them, and report that number. Game 5's sentence-level rewrite then changed the reader, so the set moved to regression (`tests/fixtures/scams/s2_*`). `npm run replay-heldout` re-scores it with the code at `ab9d746` to reproduce 12/12 and 0/12. |

## Games 5–7: does it cry wolf?

A checker that calls everything a scam is useless. It would also make Maya report an honest seller who's trying to fix things. So we paid **honest senders** for false alarms: genuine emails that are true for her record (a seller asking for time, PayPal's own case notices, USPS, her bank, her own calendar reminder, a friend's advice) that Day 20 flagged red.

| Round | Genuine emails flagged red | What we changed |
|---|---|---|
| Game 5 | **12 of 12**. Whole-text patterns read "I haven't issued a refund yet" as a refund, "Once a case is closed…" as a closed case, and "PayPal will never ask for your password" as a request for one. Any non-PayPal link counted as a contradiction. | We rewrote the reader to work **sentence by sentence**. It only reads claims from sentences that assert something: not negated, not conditional, not generic. A carrier's own "case closed" isn't her PayPal case. A plain link is a caution, not a contradiction. "Report to phishing@paypal.com" appears only on real phishing signs. |
| Game 6 (fresh writer) | **7 of 12**. Our negation pattern matched any word ending in "nt" ("payment"). Someone else's dispute ("my claim", "on our side") counted as hers. PayPal's own link domains were read as lookalikes. A bank's Zelle promo was read as a payment request. | We fixed the negation bug and added whose-case checks. We allow-listed PayPal's own domains. Off-platform payment only counts as a request aimed at her. A full-amount offer is described as a full refund. |
| Game 7 (fresh writer) | **1 of 12**: a store newsletter's returns policy ("can be returned … for a refund") was read as her refund. Three findings were wrong (a negated "wait", a FedEx "by end of day" read as urgency, another package's delivery). | Policy and "can/may" lines count as conditional. Negation now applies to stall detection. Urgency is read sentence by sentence and skips carrier lines. |

The cost of fewer false alarms: on the scam regression set, "flagged red" moved between 8 and 10 of 24 (9 now). Every scam stayed at least "careful".

**A note on what we couldn't run:** a fresh agent asked to write a new round of scam emails declined, stopped by a safety check. We didn't try to get around it. So our only held-out scam number is the game-4 one, measured before the game-5 rewrite. We haven't measured the current reader on unseen scams.

## The numbers, phrased honestly

From `npm run eval`:

- **Designed cases** (24 scenes plus test emails, written alongside the code): all pass. *That shows the code does what we designed, not that it generalizes.*
- **Regression** (attacks and false alarms we fixed): all pass. *That shows no regressions. It isn't evidence of generalization.*
- **Held-out scams** (game 4, measured before we tuned on them): 12 of 12 were never called safe, and 0 of 12 were flagged red. *"Never called safe" is mostly guaranteed by design (only a refund or closed-case claim that matches the record reads as agreeing). Flagged red is the real measure, and the keyword reader missed every reworded lie.*
- **Held-out genuine emails** (each round measured before we tuned on it):
  - game 5: 0 of 12 clean;
  - game 6: 5 of 12 clean;
  - game 7: 11 of 12 clean.

  Each set was then fixed and moved to regression, where all 36 genuine emails are now clean.

No set is held out right now: each one we measured was then tuned on. The first measurements are in `tests/heldout/RESULTS.md`, and `npm run replay-heldout` reproduces every one of them from the commit it was scored against.
- **Live model:** run `npm run live-eval` with a real key.

## What we'd do next

The keyword reader is a floor. Reworded lies need the model's reading. But the model can only add flags, so more reading means more caution, and the false-alarm games show that caution has a cost. The next step is to measure both rates with the live model, on fresh sets in both directions.
