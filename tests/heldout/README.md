# Held-out attacks

Written by fresh agents after the last change to the email checker (`docs/GAMES.md`). Frozen: we report results
on these and don't tune the checker on them. When we fix something they reveal, they move to
`tests/fixtures/scams/` (regression), and a new held-out set gets written.

- `emails/`: scam emails (must never read as safe; ideally flagged red)
- `honest/`: genuine emails a buyer with an open case could get (must never be flagged red)
