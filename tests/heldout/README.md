# Held-out sets

**`honest/` holds set 8** (12 genuine emails by a fresh writer, frozen before scoring, not tuned on). Sets 4–7 were
scored here first, then tuned on and moved to `tests/fixtures/` as regression tests. Every first score is in
[RESULTS.md](RESULTS.md), and `npm run replay-heldout` re-scores them from the commits they were scored against
(CI fails if a number drifts).

To add a new held-out set, create `emails/` (scam emails: must never read as safe) or `honest/` (genuine emails:
must never be flagged red) here, add the files **before changing any code**, run `npm run eval`, and record the
result and commit in RESULTS.md. See CONTRIBUTING.md.
