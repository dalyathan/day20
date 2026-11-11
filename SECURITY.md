# Security

Day 20 holds short-lived sessions and, when Log in with PayPal is on, a PayPal payer ID. It never stores
PayPal access tokens and never writes to PayPal.

## Reporting a vulnerability

Please use GitHub's private reporting: **Security → Report a vulnerability** on this repository.
Don't open a public issue for a security problem. If private reporting isn't available, open an issue titled "Security contact" with no details and we'll reach out. We'll reply within 3 days.

Include what you found, how to reproduce it (replay mode is fine: `npm run replay`), and the impact.
Please test only against your own deployment or replay mode, not other people's data.

## What's in scope

- The web app (`server.js`, `lib/`, `public/`), the MCP server (`mcp/`), and the Postman collection.
- Anything that lets someone read another person's case, make Day 20 send requests to hosts it shouldn't,
  get around the rate limits, or make the AI change what the buyer is told outside the rules in
  `lib/agent.js` (`gateModelClaims`) and `lib/rules.js`.

## Known limits

See `docs/PRIVACY_AND_THREATS.md`.
