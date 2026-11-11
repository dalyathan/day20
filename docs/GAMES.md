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
| **Scammer 2** | 12 new emails. **12/12 rated "careful" (never "safe")**, and the bottom line (built by code) showed the real record. **0/12 flagged red.** Lies worded without our keywords got a generic warning instead of a contradiction. | The emails are frozen as a held-out set (`tests/heldout/`). We report this number and haven't tuned on it. |

## The numbers, phrased honestly

From `npm run eval`:

- **Designed cases** (24 scenes plus test emails, written alongside the code): all pass. *That shows the code does what we designed, not that it generalizes.*
- **Regression** (game-3 attacks we fixed against): all pass, and 8 of 12 flagged red. *No regressions. It isn't evidence of generalization.*
- **Held-out** (12 game-4 scam emails, frozen, never tuned on):
  - 12 of 12 were never called safe. Every result showed PayPal's real refund status and deadline, by construction: code builds that line.
  - 0 of 12 were flagged as an outright contradiction.

  *This is our honest generalization number. The safe default held. The keyword reader missed paraphrased lies.*
- **Live model:** `npm run live-eval` (run with a real key) reports how often the model's reading raises a "careful" to a red "mismatch", and whether any sentence it showed broke a rule.

## What we'd do next

The held-out result points at the next step. The model is good at reading meaning, so it should raise more flags from paraphrased lies. It can only add flags, never remove them, and it can only pick sentences, never write them. That's why we let it do this. Then we'd write a new held-out set to test it.
