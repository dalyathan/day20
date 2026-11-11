# Held-out sets

**Empty right now.** Every set we scored here was then tuned on and moved to `tests/fixtures/` as regression
tests. Their first scores, against the code before tuning, are in [RESULTS.md](RESULTS.md), and
`npm run replay-heldout` re-scores them from those commits (CI fails if a number drifts).

To add a new held-out set, create `emails/` (scam emails: must never read as safe) or `honest/` (genuine emails:
must never be flagged red) here, add the files **before changing any code**, run `npm run eval`, and record the
result and commit in RESULTS.md. See CONTRIBUTING.md.
