Live checks against the deployed app (Claude on). Each line is one check: group, email id, run, overall verdict
("mismatch" = flagged red), what contradicted PayPal's record, what Claude added over the keyword rules, what the
evidence check dropped, and provenance (commit, model, prompt hash, time).

- `live-2026-11-11-197d0f3.jsonl`: the current check code. 24 scam + 36 genuine regression emails (scams 3 runs,
  genuine 2 runs), plus screenshots of 6 scams and 6 held-out genuine emails.
- `live-2026-11-11-95b7bb3.jsonl`: the same check code (95b7bb3 only changed wording and demo samples): screenshots
  of the other 18 scams, and held-out set 8 as text.
- `deployed-2026-11-11*.jsonl`, `heldout-h8-2026-11-11.jsonl`: earlier versions of the evidence check (v0, v1, v2).

The two 2026-11-11 `live-*` files were run in a browser with `scripts/live-eval-browser.js`, exported in a compact
form and re-expanded: every non-red row was "careful", every check was judged by the model (mode "agent"), and none
failed. Summary: `npm run live-summary`.
