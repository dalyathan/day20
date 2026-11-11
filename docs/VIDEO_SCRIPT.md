# Video: Day 20 (1:43, captions, no voiceover)

The video has no narration: every word on screen is a caption. Phone footage is a scripted recording of the
app in replay mode (the saved sandbox case, at day 7 of 20). Maya and Rosa are animated SVG characters from
`public/characters.js`. Scene files are rendered separately and joined; the times below are the joined cut.

| Time | On screen | Caption |
|---|---|---|
| 0:00–0:09 | Night. A PayPal-looking email: "Case PP-R-UZH-10198816: refund issued … No further action is required." | "3:14 a.m. Maya is an ICU nurse. The $66 dress for her best friend's wedding never came, so she opened a PayPal dispute. Then, on her break, this arrived." |
| 0:09–0:17 | Maya (animated): hand on hip, phone up. | "It isn't true. If she believes it and waits, her case closes by itself on day 20. Under PayPal's rules, a closed case can't be reopened. Maya isn't giving up." |
| 0:17–0:24 | Phone: case screen, ring 7 of 20, "13 days left · closes Tue, Dec 1", outlined **Escalate in PayPal ↗** with "Opens PayPal. Day 20 isn't PayPal." | "Day 20 reads her case from PayPal. Read-only: status, refund, amount, ship-to ZIP, tracking, and the 20-day clock." Small print: "Demo: a labelled replay of our own PayPal sandbox case, read through our test seller account, at day 7 of 20." |
| 0:24–0:32 | Phone: she pastes the email; the result appears. | "She shares the email. Day 20 doesn't trust who sent it. It checks what the email claims against what PayPal's record says." |
| 0:32–0:43 | Phone: "This email is wrong about your PayPal case", each claim next to the record, "Report it". | "No refund. Case open. 13 days left. Don't close it. Each claim sits next to PayPal's record, and she gets one thing to do: forward it to phishing@paypal.com." |
| 0:43–0:48 | Phone: next step, "Ask PayPal to step in by Sun, Nov 29". | "Her next step, and the real deadline. The deciding fact goes on line 1, the first thing the reviewer reads. Day 20 never files for her: she taps Escalate in PayPal herself." |
| 0:48–0:52 | Phone: demo clock switched to the case's real sandbox status, "With a PayPal reviewer". | "The same sandbox case, at its real status. Still a saved replay: the case is now with a PayPal reviewer." |
| 0:52–1:01 | Phone: the one-page case, every line tagged. | "For the reviewer: the deciding fact, first. Every line says where it came from: PayPal's record, something PayPal can check, or Maya's own words." |
| 1:01–1:10 | Rosa (animated), the judge, pointing at line 1. | "The judge. Rosa reviews PayPal disputes. She'll never meet Maya. All she gets is one page, and she checks line 1 first. This time, Maya's page reached her before day 20." |
| 1:10–1:20 | Under the hood. | "Claude reads. Code decides. The model reads messy emails, and screenshots transcribed with no tools. Code decides the verdict, the deadline, the next step, from PayPal's record. Code writes every sentence Maya sees; the AI only picks which ones. Read-only tools: its red flags must use the email's own words. It can't file anything." |
| 1:20–1:35 | Who tests the AI? | "We attacked it with agents, scored on points." Scammers: 7 of 12 slipped through round one, fixed. Rule-breaker: our honesty filter caught 0 of 33, so the AI stopped writing. Honest senders: clean genuine emails 0 → 5 → 11 of 12. Held-out scams: none called safe (mostly by design). "The honest gap: rules alone flagged 0 of 12 red. Reworded lies need the model, so its red flags must quote the email." |
| 1:35–1:43 | End card. | "Emails can lie. Her case record can't. Day 20 · Free for buyers · read-only · open source (MIT). Built on PayPal's sandbox APIs. Not affiliated with or endorsed by PayPal. PayPal decides every case." |

## Rebuilding it

Recording and rendering scripts aren't in the repo (they drive a local browser). The phone flow is: home →
"Try it as Maya" → "Check it" → sample email → result → case → demo clock to the real status → one-page case.
