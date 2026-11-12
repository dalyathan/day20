# Day 20

[![test](https://github.com/dalyathan/day20/actions/workflows/test.yml/badge.svg)](https://github.com/dalyathan/day20/actions/workflows/test.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE) · Live: **https://day20.onrender.com**

**Demo video (2:20):** https://youtu.be/7K4jMCAOZwI

**Emails can lie. Your PayPal case can't.**

Day 20 is a read-only assistant for PayPal buyers with an open dispute. It reads the buyer's real case record from PayPal, checks any email about the case against that record, tells her the next step and the real deadline, and drafts a one-page case for the PayPal reviewer. Filing, escalating and closing stay with her, in PayPal.

<p>
<img src="docs/screens/case.png" width="240" alt="Case screen: day 7 of 20, 13 days left, and a button to check an email">
<img src="docs/screens/check.png" width="240" alt="Result: this email is wrong about your PayPal case. PayPal shows no refund. Your case is still open: 13 days left.">
<img src="docs/screens/onepage.png" width="240" alt="One-page case for the PayPal reviewer, every line tagged by source">
<img src="docs/screens/case_es.png" width="240" alt="The case screen in Spanish">
</p>

> **Try it:** open **https://day20.onrender.com**, tap **Try it as Maya**, then **Got an email about this case? Check it** → **Use Maya's 3:14 a.m. email** → **Check it against my case**. No sign-in needed. See [TESTING.md](docs/TESTING.md).
>
> **Run it in 30 seconds** (Node 22.13+, no dependencies, no keys): `git clone https://github.com/dalyathan/day20 && cd day20 && npm test && npm run replay`, then open http://localhost:3000.
>
>
> **In one line:** on 24 scam emails we tuned on, keyword rules alone flag 9 red; with Claude, 11, in every run. 0 of 36 genuine emails are flagged red, and every scam gets at least "Go by your PayPal case" with the real deadline. On 6 real scam messages we never tuned on, Claude added nothing. Details and caveats [below](#who-tests-the-ai).

## The problem

Maya is an ICU nurse. She bought a $66 dress for her best friend's wedding, paid with PayPal for the protection, and it never came. The tracking says delivered, in Tucson, Arizona; she lives in San Jose. She opened a dispute.

Then, at 3:14 a.m. on a break, she gets an email from `service@paypal.com`: *"Just a quick note so you're not left wondering. Your $66.00 is already sitting in your PayPal balance on our side… Everything looks good from here."* No link, no "click here", nothing a keyword filter would flag.

It isn't true. If she believes it and stops watching, then under PayPal's current rules her case closes by itself after 20 days unless she escalates, and a closed case can't be reopened. Ghost stores send emails like this because tired, honest buyers give up. Security researchers have reported scams delivered from PayPal's own genuine `service@paypal.com` address, by abusing PayPal features (Malwarebytes, [Dec 2025](https://www.malwarebytes.com/blog/news/2025/12/paypal-closes-loophole-that-let-scammers-send-real-emails-with-fake-purchase-notices) and [Apr 2026](https://www.malwarebytes.com/blog/news/2026/04/more-paypal-emails-hijacked-to-deliver-tech-support-scams)).

To design it, we role-played 24 dispute scenes with AI agents (an exercise, not data about real buyers). In those scenes, honest buyers mostly lost **before** review, to the clock and to traps, not **at** review.

## What Day 20 does

| | |
|---|---|
| **Reads her case** (read-only) | Status, refund, amount, dates, ship-to ZIP, and the tracking on file, from PayPal's APIs |
| **Checks an email against it** | Refund claimed vs refund on file, "case closed" vs status, reshipment numbers vs tracking on file, lookalike links, requests for codes, stalling ("no need to escalate"). The sender is never treated as proof. |
| **Tells her the next step** | Including **"not yet"** when an honest seller deserves time, and **"not covered"** when Buyer Protection doesn't apply. It never helps a false claim. |
| **Tracks the deadline** | Day 15 and day 18 reminders she chooses, by web push, email or calendar. Silent by default. |
| **Drafts the one-page case** | The checkable facts first: line 1 is the carrier's delivered ZIP (on tracking the seller added), line 2 is PayPal's ship-to ZIP. Every line is tagged `PAYPAL RECORD`, `PAYPAL CAN CHECK` or `BUYER REPORTS`, so the reviewer knows what to verify. |

**What it never does:** file, escalate, close or accept anything; message the seller; ask for a password or code; send sign-in links. The app, the agent and the MCP server only read from PayPal; the only writes are in the sandbox setup script, which plays the seller to build the demo case.

## Why PayPal would want this

Day 20 isn't a "file more claims" button. In the 24 dispute scenes we designed, it tells the buyer to escalate in 10 and to tell PayPal what actually arrived in 6. In the other 8 it says **don't escalate yet, or don't escalate at all**: the seller is answering and tracking is only stalled, she should check with a neighbour first, the item arrived as described, or the purchase isn't covered. That's designed behaviour, not a measured outcome: the aim is that honest sellers keep their sales and weak claims don't reach reviewers. The claims that do arrive come with a one-page case where the key fact is in the first two lines, tagged with what PayPal can check. (The tags are plain text a buyer could edit; they guide the reviewer, they don't prove anything.) And buyers stop losing protection because a fake email told them to wait out the 20 days. What we'd want to measure with PayPal: how many INR cases close by themselves on day 20 without escalating.

## How it works

```
 Maya ── pastes email / screenshot ─┐
                                     ▼
                      ┌──────────────────────────┐   read-only    ┌──────────────────────┐
                      │  Agent loop (Claude)     │──────tools────▶│ PayPal sandbox APIs  │
                      │  read_case  read_claim   │                │ Disputes · Orders ·  │
                      │  compare    next_step    │◀───────────────│ Captures · Tracking  │
                      │  draft_page schedule_rem.│                └──────────────────────┘
                      └────────────┬─────────────┘
                                   ▼
            verdict + bottom line ◀── computed by code from PayPal's record, never by the model
            what Maya reads       ◀── sentences written by code; the model only picks which ones
            one-page case         ◀── built by code; buyer text sanitised and tagged as hers
```

- **The model reads; code decides and speaks.** Claude reads messy emails and screenshots (`read_claim`). Code computes the verdict (`mismatch` / `careful` / `consistent`), the bottom line, the next step and the one-page case from PayPal's record. The model then **picks** 2–4 sentences, written by code, for Maya to see (`compose_note`). It can't write its own.
- **The model can't remove a warning.** Its claims are OR-merged with the rule reader's, so it can add a flag but never remove one. Any email is at least "careful": Day 20 calls an email "consistent" only when a refund or closed claim it read agrees with PayPal's record.
- **Screenshots are transcribed first** by a call with no tools, so the rule reader sees every word the model sees.
- **No model, still an answer.** With no API key, or with the model down, the rule reader produces the verdict and default sentences on its own.

### PayPal APIs used

| Call | Why |
|---|---|
| `POST /v1/oauth2/token` | Client-credentials token. The token itself is a full merchant token; Day 20's code only uses it for GETs |
| `GET /v1/customer/disputes`, `GET /v1/customer/disputes/{id}` | The case: status, reason, amount, outcome, dates |
| `GET /v2/payments/captures/{id}` → `GET /v2/checkout/orders/{id}` | Ship-to address and trackers, for the delivery-ZIP check |
| `GET /v1/shipping/trackers?transaction_id=` | Tracking numbers the seller added |
| Log in with PayPal (`/signin/authorize`, `/v1/identity/oauth2/userinfo`) | Identity: her payer ID, used to find her cases. Code path in `lib/auth.js` (covered by the Postman folder 4 requests, not by automated tests), **off on the live demo** (it needs a return URL registered on the app); the demo uses "Try it as Maya" |
| Sandbox setup only: `POST /v2/checkout/orders`, `/capture`, `/track` | Builds Maya's real sandbox case ([`scripts/demo.js`](scripts/demo.js)) |

All of these are in the [Postman collection](postman/Day20.postman_collection.json).

## Who tests the AI?

We tested it by playing games. Agents attacked Day 20 for points, with evidence required ([docs/GAMES.md](docs/GAMES.md)).

- **Scammers** scored a point for every fake email the checker rated safe. In round one, 7 of 12 got through, so a real case number stopped counting as proof.
- **A cheat** forged a "PAYPAL CAN CHECK" line with a newline. Buyer text is now sanitized.
- **A rule-breaker** showed that regexes can't police what a language model means: 0 of 33 new harmful sentences were caught. **So we closed the model's output space.** It now picks sentences written by code instead of writing its own.
- **A blind PayPal reviewer** shaped the one-page case.
- **Honest senders** scored a point for genuine emails that Day 20 flagged red. In round one, all 12 were flagged. A checker that cries wolf makes Maya report honest sellers, so we rewrote the reader to work sentence by sentence.
- **An AI-assurance judge** caught us reporting fixed-against attacks as pass rates. We now split the numbers.

`npm run eval` reports where each case came from, because a pass rate on cases we fixed against isn't evidence:

| Group | What it is | Result |
|---|---|---|
| Designed | 24 dispute scenes plus test emails, written with the code | all pass |
| Regression | 24 scam emails and 36 genuine emails from the games, fixed against | every scam at least "careful" (9/24 red); no genuine email flagged red |
| **Held-out scams** (rules only, no model) | 12 game-4 emails, scored once before we tuned on them | **0/12 flagged red**; 12/12 never called safe (mostly by design) |
| **Held-out genuine emails** (rules only, no model) | fresh writers each round, scored before tuning | **not flagged red: 0/12 → 5/12 → 11/12** over games 5–7 |
| **Held-out genuine emails, set 8** (rules, and the live model 3×) | 12 by a fresh writer who never saw the code, frozen before scoring | **not flagged red: 11/12 with rules, 11/12 in each live-model run**; the model added no false alarm. The miss is a real refund from a different shop ([RESULTS.md](tests/heldout/RESULTS.md)) |

Sets 4–7 were then tuned on and moved to regression. Set 8 was held out until one fix after scoring (h8_01, below), so it is no longer unseen. `npm run replay-heldout` re-scores each set with the commit it was first scored against and reproduces the numbers above ([RESULTS.md](tests/heldout/RESULTS.md)).

**Live model** (`npm run live-eval`, Claude on 36 test emails, Nov 11):
- 36 of 36 runs completed.
- The model's reading turned 2 "careful" results into red mismatches that the rules missed.
- 3 prompt-injection emails: the model's verdict matched the rules-only verdict on the same email each time, and no rule was broken. (The model can only add flags, so an injection can't remove one. We didn't run injection-free copies as a separate control.)
- No sentence shown tripped the honesty rules. (A tripwire, not proof: every sentence shown is written by code, and the rules alone missed harmful model-written text in game 3.)
- Median time was 4.7 s.

**How the evidence check got here** (three versions of the check, one run each, all 24 scam and 36 genuine regression emails, Nov 11). The current code's repeated runs are in the next table.

| Version | Scams flagged red | Genuine emails flagged red | Judged by the model |
|---|---|---|---|
| Rules alone (no model) | 9/24 | 0/36 | 0/60 |
| Model, no evidence check ([check v0 run](tests/live/deployed-2026-11-11.jsonl)) | 11/24 | **2/31** (of the 31 genuine emails the model judged) | 55/60 (credit ran out; the last 5, all genuine, fell back to rules and still answered) |
| Model + evidence check v1 ([check v1 run](tests/live/deployed-2026-11-11-gate1.jsonl)) | 10/24 | 0/36 | 60/60 |
| Model + evidence check v2 ([check v2 run](tests/live/deployed-2026-11-11-gate2.jsonl)) | **11/24** | **0/36** | 60/60 |

- Check v0: the model caught 2 reworded refund lies the keyword reader missed, but also flagged 2 genuine emails red: a seller's "if you accept, the refund of $20 would be sent" and a PayPal chat saying "no refund has been issued yet".
- So a model flag that can turn an email red now needs evidence. A refund, closed case, close request, code request or off-PayPal payment needs the exact sentence quoted, and code checks it's in the email and isn't negated or hypothetical. Case IDs, links and tracking numbers must appear in the email as written.
- v1 was too strict: it dropped a real catch because the sentence went on to say "it should be there". v2 judges the clause that makes the claim, lets requests be conditional ("if that works for you, please end the claim"), and keeps the engineer judge's must-stay-red sentences ("We can confirm the $66.00 is back").
- Check v2 kept every catch and no false alarm. The check also stopped one false alarm by itself: on g5_12 the model listed a case ID that isn't in the email. No sentence shown tripped the honesty rules (a tripwire; every sentence shown is written by code); median 5.2 s.
- These are the same 60 emails we tuned on, so they show the check works as designed, not how it does on unseen email. One run per email.

**Current code, repeated on the deployed app** (Claude on, Nov 11; check code at commit f6ee466, unchanged in 9d80462; `npm run live-summary` prints this from the raw rows; re-run by pasting `scripts/live-eval-browser.js` into the browser console on the live site):

| | Keyword rules alone | With Claude |
|---|---|---|
| Scam emails flagged red (24, tuned on) | 9/24 | **11/24 in each of 3 runs**, the same 11 each time ([rows](tests/live/live-2026-11-11-f6ee466.jsonl)) |
| Genuine emails flagged red (36) | 0/36 | **0/36 in each of 2 runs** |
| Scam screenshots flagged red (all 24, 1 run) | can't read images | **11/24**, the same 11 as text ([rows](tests/live/live-2026-11-11-9d80462.jsonl) and the first file) |
| Held-out set 8, genuine, flagged red | 1/12 | 1/12 as text (1 run), 1/6 as screenshots; the same h8_01 every time |
| **Real messages scam sellers sent buyers** (6, quoted in public threads, never tuned on; [sources](tests/realworld/SOURCES.md)): got Day 20's "Don't close it" | 5/6 | **5/6 in each of 3 runs**; Claude added nothing; none red, none called safe ([rows](tests/live/live-2026-11-11-c1c97e4.jsonl)) |
| After the round-3 fix (c1c97e4): set 8 flagged red / scams flagged red | 0/12 / 9/24 | **0/12** (h8_01 fixed after scoring, so set 8 is no longer unseen) / **11/24**, the same 11 |

Claude's 2 extra catches on text (s2_01, s2_08) are reworded refund lies; s2_01 is Maya's 3:14 a.m. email in the demo. The rows were exported from the browser in a compact form and re-expanded (every non-red row was "careful"; no check failed or fell back to rules).

Raw results: [`tests/live/`](tests/live/).

Our honest reading: the safe default holds, and false alarms fell sharply once the reader went sentence by sentence. The keyword reader still misses reworded lies, and catching those is the model's job. `npm run live-eval` measures it with a real key. We couldn't run a fresh scam-writing round after game 4: the agent declined, stopped by a safety check, and we didn't work around it.

```
npm test        # unit + integration: RFC 8291 vector, model can't speak or act, model-down fallback, Spanish, server (push allowlist, forged cookies), time zones, MCP smoke test
npm run eval    # one line per case, with totals per group
npm run replay-heldout  # re-score each held-out set with the commit it was first scored against
```

## Run it

Node 22.13+, no dependencies, macOS, Linux or Windows.

**Offline, no keys (1 minute):**

```bash
git clone https://github.com/dalyathan/day20
cd day20
npm test                       # unit + integration tests
npm run eval                   # every scene and email, by group
npm run replay                 # then open http://localhost:3000 and tap "Try it as Maya" (Ctrl+C to stop)
```

Replay serves a saved copy of a real sandbox dispute and order. One detail is filled in by hand: the carrier name on the tracker, which the order API omits. `npm run replay-heldout` needs the full git history (not `--depth 1`).

**With your own PayPal sandbox (about 15 minutes):** you need a sandbox dispute of your own; the demo case can only be read live with the maintainer's keys. Follow [TESTING.md, option 3](docs/TESTING.md): create a sandbox app with Disputes enabled, `cp .env.example .env` and add your keys, run `npm run demo` to create and pay an order, open a dispute as the sandbox buyer, put its ID in `DEMO_DISPUTE_ID`, then:

```bash
npm run live-check             # every read-only PayPal call behind the case screen, against your case (not Log in with PayPal)
npm run dev                    # http://localhost:3000; the demo chip can switch to "Live sandbox case"
```

The AI is optional: add `ANTHROPIC_API_KEY` to `.env` to turn it on; without it Day 20 runs on rules alone.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/dalyathan/day20)

The button uses [`render.yaml`](render.yaml) (Render Blueprint): one web service on Render's paid **starter** plan with a 1 GB disk for SQLite (about $7/month; `render.yaml` notes how to use the free plan without the disk), and `/healthz` checks the database. With no keys it runs in replay mode on the saved sandbox case. Enter secrets in Render's form, never in the repo.

**Postman:** import `postman/Day20.postman_collection.json` and the environment next to it. Run request 1, then folder 3: each request saves the next ID (dispute → capture → order) and checks the response.

**MCP server** (the same read-only tools for any AI assistant that speaks MCP; with merchant sandbox keys it reads cases on that account, and with no keys only the saved demo case):

```bash
claude mcp add day20 -- node /path/to/day20/mcp/server.js
```

Tools: `day20_read_case`, `day20_check_email`, `day20_next_step`, `day20_draft_page`, `day20_reminders`.

## What we'd ask PayPal for

1. **Build it in:** a "Got an email about this case? Check it" button on the case page in the Resolution Center, which already has the record. Day 20 is the open-source prototype.
2. **Label seller-written text in PayPal's own emails**, and block refund claims and case numbers in invoice and money-request notes.
3. **Show the buyer the delivery mismatch before day 20:** the carrier's delivered ZIP next to the ship-to ZIP on her case page.
4. **Or, for outside apps, a buyer consent flow for `disputes/read-buyer`, plus buyer-side dispute webhooks**, so an app like Day 20 can read only her own cases, with her permission. Today we found no way for a buyer to grant that scope: Log in with PayPal gives identity only, so the sandbox demo reads the case through our own demo seller account.

## Limits

- The demo opens a labelled **replay** of Maya's real sandbox case, shown at the open stage with the demo clock at day 7. (The real sandbox case went to PayPal review minutes after it was opened, so it can't show the open stage live.) Switch the demo chip to "Live sandbox case" to see the real, current case read from PayPal.
- "Delivered to ZIP 85705" is the buyer's reading of the carrier page. It's tagged so the reviewer looks it up.
- Without the model, the email checker reads keywords: paraphrased lies get a generic "careful" warning, not a red contradiction (see the held-out result). The model catches some of them, and only with a quoted sentence code can check.
- The live model path is tested with `npm run live-eval`, which needs a real key. The offline suite mocks it.

## Maintainer

Surafel Melese Tariku ([@dalyathan](https://github.com/dalyathan), surafelmelese09@gmail.com). Most of the code and docs were written with Claude (Anthropic) as a coding partner, as the `Co-Authored-By` lines on the commits show; design decisions, testing direction and accounts are the maintainer's. Security reports: see [SECURITY.md](SECURITY.md).

[Privacy and threat model](docs/PRIVACY_AND_THREATS.md) · MIT licensed · Not affiliated with or endorsed by PayPal. Not legal or financial advice. PayPal decides every case.
