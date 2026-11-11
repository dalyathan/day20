# Contributing to Day 20

Thanks for helping. Maintainer: Surafel Melese Tariku ([@dalyathan](https://github.com/dalyathan)). Day 20 has no dependencies, so setup is just Node 22.13 or newer.

```
npm test              # unit tests, eval gate, MCP smoke test
npm run eval          # every scene and email, split into designed / regression / held-out
npm run replay        # run the app on the saved sandbox case, no keys needed
```

## Ground rules

- **Read-only.** Day 20 never files, escalates, closes, accepts or sends anything in PayPal. A change that
  adds a write call won't be merged.
- **Code decides and speaks.** The model may pick sentence ids and add flags. It never writes text the buyer
  reads and never decides the next step. Keep it that way (`lib/agent.js`, `tests/all.test.js`).
- **Buyer words stay tagged.** Anything the buyer typed is BUYER REPORTS on the one-page case, never
  PAYPAL RECORD or PAYPAL CAN CHECK.

## Adding test emails

- A scam that slips through, or a genuine email flagged red: add it to `tests/heldout/emails/` or
  `tests/heldout/honest/` **before** changing any code, and record the result in `tests/heldout/RESULTS.md`
  with the commit it was scored against.
- Once you fix against it, move it to `tests/fixtures/scams/` or `tests/fixtures/honest/`. It's now a
  regression test, not evidence. Add the set to `scripts/replay-heldout.mjs` so the first score stays reproducible.

## Secrets

Keys live only in `.env` (git-ignored). Never paste them into issues, tests or fixtures.
