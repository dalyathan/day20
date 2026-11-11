# Day 20

**Emails can lie. Your PayPal case can't.**

Day 20 is a read-only assistant for PayPal buyers with an open dispute. It reads the buyer's real case record from PayPal, checks any email about the case against that record, tells her the next step and the real deadline, and drafts a one-page case for the PayPal reviewer. Filing, escalating and closing stay with her, in PayPal.

<p>
<img src="docs/screens/case.png" width="240" alt="Case screen: day 7 of 20, 13 days left, and a button to check an email">
<img src="docs/screens/check.png" width="240" alt="Result: this email is wrong about your PayPal case. PayPal shows no refund. Your case is still open: 13 days left.">
<img src="docs/screens/onepage.png" width="240" alt="One-page case for the PayPal reviewer, every line tagged by source">
</p>

> **Try it:** open the live app, tap **Try it as Maya**, then **Got an email about this case? Check it** → **Use Maya's 3:14 a.m. email** → **Check it against my case**. No sign-in needed. See [TESTING.md](docs/TESTING.md).

## The problem

Maya is an ICU nurse. She bought a $66 dress for her best friend's wedding, paid with PayPal for the protection, and it never came. The tracking says delivered, in Tucson, Arizona; she lives in San Jose. She opened a dispute.

Then, at 3:14 a.m. on a break, she gets an email from `service@paypal.com`: *"The seller has issued a full refund of $66.00. Your case has been resolved. No further action is required."*

It isn't true. If she believes it and stops watching, her case closes by itself on day 20 and can't be reopened. Ghost stores send emails like this because tired, honest buyers give up, and real PayPal addresses have been abused to deliver them.

In our 24-scene dispute game, honest buyers mostly lost **before** review, to the clock and to traps, not **at** review.

## What Day 20 does

| | |
|---|---|
| **Reads her case** (read-only) | Status, refund, amount, dates, ship-to ZIP, and the tracking on file, from PayPal's APIs |
| **Checks an email against it** | Refund claimed vs refund on file, "case closed" vs status, reshipment numbers vs tracking on file, lookalike links, requests for codes, stalling ("no need to escalate"). The sender is never treated as proof. |
| **Tells her the next step** | Including **"not yet"** when an honest seller deserves time, and **"not covered"** when Buyer Protection doesn't apply. It never helps a false claim. |
| **Keeps the deadline** | Day 15 and day 18 reminders she chooses, by web push, email or calendar. Silent by default. |
| **Drafts the one-page case** | The deciding fact first. Every line is tagged `PAYPAL RECORD`, `PAYPAL CAN CHECK` or `BUYER REPORTS`, so the reviewer knows what to verify. |

**What it never does:** file, escalate, close or accept anything; message the seller; ask for a password or code; send sign-in links. The code has no function that writes to PayPal.

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
            AI note               ◀── checked against 8 honesty rules; replaced if it breaks one
            one-page case         ◀── built by code; buyer text sanitised and tagged as hers
```

- **The model reads; code decides.** The model reads messy emails and screenshots and writes a short note. The verdict (`mismatch` / `careful` / `consistent`), the bottom line and the one-page case are computed by code from PayPal's record. With no API key, or if the model is down, the same pipeline runs on rules alone.
- **Screenshots are transcribed first** by a call with no tools, so the rule-based reader sees every word the model sees.
- **Honesty rules in code** ([`lib/rules.js`](lib/rules.js)): no claimed actions, no promises, no "use the link", no naming a sender, no "verified", no reason-coaching, no off-PayPal links or phone numbers, and no fact the record doesn't show.

### PayPal APIs used

| Call | Why |
|---|---|
| `POST /v1/oauth2/token` | Client-credentials token (read-only use) |
| `GET /v1/customer/disputes`, `GET /v1/customer/disputes/{id}` | The case: status, reason, amount, outcome, dates |
| `GET /v2/payments/captures/{id}` → `GET /v2/checkout/orders/{id}` | Ship-to address and trackers, for the delivery-ZIP check |
| `GET /v1/shipping/trackers?transaction_id=` | Tracking numbers the seller added |
| Log in with PayPal (`/signin/authorize`, `/v1/identity/oauth2/userinfo`) | Identity: her payer ID, used to find her cases in the sandbox demo |
| Sandbox setup only: `POST /v2/checkout/orders`, `/capture`, `/track` | Builds Maya's real sandbox case ([`scripts/demo.js`](scripts/demo.js)) |

All of these are in the [Postman collection](postman/Day20.postman_collection.json).

## Who tests the AI?

We tested Day 20 the way it will be attacked, with agents playing every side under incentives (`docs/GAMES.md`):

- **24 dispute scenes** (ghost stores, honest sellers, opportunist buyers, a blind PayPal reviewer) became the eval suite: `npm run eval`.
- **Adversarial rounds.** Scammer agents scored points for every fake email the checker rated safe. A cheat scored points for every false claim it got onto the one-page case. A rule-breaker scored points for harmful AI notes that passed the rules, and for helpful ones that were wrongly blocked. Every attack that worked became a regression test, and we report results on **new** attacks separately (see `docs/GAMES.md`).
- **Unit tests:** web push encryption against the RFC 8291 test vector; the agent loop with a mocked model that tries to break rules; model-down fallback; the server end to end.

```
npm test        # unit + integration
npm run eval    # the scenario and attack suite, one line per case
```

## Run it

Node 22.13+, no dependencies.

```bash
npm run replay                 # offline, with a saved copy of a real sandbox case
cp .env.example .env           # then fill in sandbox keys
npm run live-check             # proves every PayPal call against the sandbox
npm run dev                    # http://localhost:3000
```

Deploy: [`render.yaml`](render.yaml) (Render Blueprint). Enter secrets in Render's form, never in the repo.

**MCP server** (the same read-only tools for any AI assistant):

```bash
claude mcp add day20 -- node /path/to/day20/mcp/server.js
```

Tools: `day20_read_case`, `day20_check_email`, `day20_next_step`, `day20_draft_page`, `day20_reminders`.

## What we'd ask PayPal for

1. **A buyer-side, read-only, per-case scope.** Log in with PayPal gives identity, not transactions. Today the sandbox demo reads the case through the demo seller account, because we own both test accounts.
2. **A delivered-ZIP vs ship-to-ZIP check** before funds are released on "delivered" tracking.
3. **A verified-agent lane:** an agent identity on what the reviewer sees, with a kill switch the buyer controls.

## Limits

- The demo clock shifts "today" to show day 7. Everything else is read live from the sandbox, or from a labelled replay of a real sandbox case.
- "Delivered to ZIP 85705" is the buyer's reading of the carrier page. It's tagged so the reviewer looks it up.
- Regex rules can't catch everything a model might write. That's why the model's note is never load-bearing.

[Privacy and threat model](docs/PRIVACY_AND_THREATS.md) · MIT licensed · Not affiliated with or endorsed by PayPal. Not legal or financial advice. PayPal decides every case.
