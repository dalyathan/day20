Live checks against the deployed app (Claude on). Each line is one check: group, email id, run, overall verdict
("mismatch" = flagged red), what contradicted PayPal's record, what Claude added over the keyword rules, what the
evidence check dropped, and provenance (commit, model, prompt hash, time).

- `live-2026-11-11-f6ee466.jsonl`: the current check code. 24 scam + 36 genuine regression emails (scams 3 runs,
  genuine 2 runs), plus screenshots of 6 scams and 6 held-out genuine emails.
- `live-2026-11-11-9d80462.jsonl`: the same check code (9d80462 only changed wording and demo samples): screenshots
  of the other 18 scams, and held-out set 8 as text.
- `live-2026-11-11-c1c97e4.jsonl`: after the round-3 fix (refunds of another amount; keep scam emails as evidence): the
  real-world set (tests/realworld/, 3 runs), set 8 (1 run) and the 24 scams (1 run). Adds `cautions` and `report`.
- `deployed-2026-11-11*.jsonl`, `heldout-h8-2026-11-11.jsonl`: earlier versions of the evidence check (v0, v1, v2).
- `genuine-2026-11-11.jsonl`, `results-2026-11-11.jsonl`: earlier runs, not used in the summary (`npm run live-summary` reads only `live-*.jsonl`).

The three 2026-11-11 `live-*` files were run in a browser with `scripts/live-eval-browser.js`, exported in a compact
form and re-expanded: every non-red row was "careful", every check was judged by the model (mode "agent"), and none
failed. Summary: `npm run live-summary`.

## Commit ids (relabelled on Nov 12, 2026)

On Nov 12 the repository history was rewritten so that every commit has the same author (the project's maintainer). The code in every commit is unchanged, but every commit id changed. The commit ids in these files and file names were updated to match:

| Before | After |
|---|---|
| 197d0f3 | f6ee466 |
| 95b7bb3 | 9d80462 |
| f0c0afd | c1c97e4 |
| 2ddc64e | b2cee73 |
| c261da7 | 1b14b11 |
| 323b54a | ac986e4 |
| b61f13f | 6779cfb |
| 29d4f66 | f3716ac |
| b0c3630 | febc9ce |
| ab9d746 | 3e51c67 |
