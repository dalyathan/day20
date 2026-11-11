# Testing Day 20 (for judges)

## Option 1: the live app, no sign-in, about 2 minutes

1. Open the app on a phone or a narrow browser window.
2. Tap **Try it as Maya**. This opens Maya's real PayPal sandbox case: a $66 dress, "item not received". The demo clock sets "today" to day 7 of 20.
3. Tap **Got an email about this case? Check it**, then **Use Maya's 3:14 a.m. email**, then **Check it against my case**.
   - **Expected:** "This email is wrong about your PayPal case. PayPal shows no refund. Your case is still open: 13 days left…"
4. Tap **Why** to see each claim in the email next to PayPal's record. Tap **What Day 20 did** to see the agent's tool calls and the honesty check.
5. Go back and open **One-page case**.
   - **Expected:** the deciding fact comes first: the delivery ZIP on the carrier's page (85705) next to the ship-to address on the transaction (San Jose, CA 95131). Every line is tagged with its source.
6. Paste your own scam email and try to make Day 20 call it safe. If you manage it, please tell us.

**About the demo controls:** the "Replay" chip at the top is the demo control. Use it to move the day (the clock and reminders change) or to switch between the live sandbox case and a replay. "Replay" uses a saved copy of a real sandbox response, and the app labels it everywhere.

## Option 2: run it locally, offline

```bash
git clone https://github.com/dalyathan/day20 && cd day20
npm run replay      # http://localhost:3000, no keys needed
npm test            # unit + integration tests
npm run eval        # 24 scenes + emails + attacks from our adversarial games
```

Node 22.13 or later. No `npm install`, because there are no dependencies.

## Option 3: against your own PayPal sandbox

1. `cp .env.example .env` and add a sandbox app's client ID and secret. Tick "Disputes" in the app's features.
2. `npm run demo` creates a $66 order. Approve it as a sandbox personal account (the link is in `demo-status.json`). Then open an "item not received" dispute in that account's Resolution Center. The script reads the case back live.
3. `npm run live-check DISPUTE_ID` checks every read-only PayPal call Day 20 makes.
4. `npm run dev`, then try it as Maya with `DEMO_DISPUTE_ID` set to your case.

## The MCP server

```bash
REPLAY=1 claude mcp add day20 -- node mcp/server.js
```

Then ask your assistant, for example: "Check this email against PayPal case PP-R-UZH-10198816: …"

## Postman

Import `postman/Day20.postman_collection.json`. Folder 3 holds every read-only PayPal call, in order. Folder 5 tests Day 20's own API, including a test that the fake refund is caught.
