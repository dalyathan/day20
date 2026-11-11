Test material served with the app, so the live checks re-run from a browser on the deployed site
(paste `scripts/live-eval-browser.js` into the console at https://day20.onrender.com):
- `scam_*.png`: screenshots of all 24 scam emails in the regression set (tests/fixtures/scams/).
- `genuine_h8_*.png`: screenshots of 6 genuine emails from held-out set 8 (tests/heldout/honest/).
- `regression-emails.json`: the 60 regression emails (24 scams, 36 genuine), copied from tests/fixtures/.
- `heldout-set8-emails.json`: the 12 genuine emails of held-out set 8, copied from tests/heldout/honest/.
These are made-up test emails, rendered from the .txt files. The demo's "Or as a screenshot" button loads
scam_s2_01.png, the same email as "Use Maya's 3:14 a.m. email".
