# Day 20: 3-minute video script

**Format:** a phone-sized screen recording of the live app, with voiceover. Record it in Chrome: open DevTools, turn on the device toolbar and pick iPhone 14 Pro (390×844). On a Mac, QuickTime → New Screen Recording, then record just that area. Target 2:45 or less.

**Before you record:** in a private window, open the app, tap **Try it as Maya** once and check the case shows "7 of 20" and the PayPal record. Close that window and record in a fresh private window, so you start on the home screen. The live app needs `ANTHROPIC_API_KEY` set for the trace at 2:10 to show the agent's tool calls.

| Time | On screen | Voiceover |
|---|---|---|
| 0:00 | Black screen. The email text types in: **From: PayPal &lt;service@paypal.com&gt;** · "The seller has issued a full refund of $66.00. Your case has been resolved. No further action is required." Time stamp **3:14 a.m.** | "Three fourteen a.m. Maya's an ICU nurse on her break. The dress she bought for her best friend's wedding never came, so she opened a PayPal dispute. Now this email says she's been refunded." |
| 0:15 | Hold on "No further action is required." | "It's not true. And if she believes it and waits, under PayPal's rules her case closes by itself on day 20. After that, it can't be reopened." |
| 0:15 | Maya (animated) stands tall, phone raised: **"It isn't true… Maya isn't giving up."** | (hold on Maya) |
| 0:25 | Home screen: **Day 20 — Emails can lie. Your PayPal case can't.** | "Ghost stores send these on purpose, sometimes through PayPal's own real email addresses. Honest buyers don't lose at review. They lose before it, to the clock." |
| 0:40 | Tap **Try it as Maya**. The case screen: ring **7 of 20**, "13 days left · closes Tue, Dec 1", the PayPal record card. | "Day 20 reads her case from PayPal: read-only, with her consent. This is her PayPal sandbox case, replayed at day 7 of 20." |
| 0:55 | Tap **Got an email about this case? Check it** → **Use Maya's 3:14 a.m. email** → **Check it against my case**. | "She shares the email. Day 20 doesn't trust who sent it. It checks what the email *claims* against what PayPal's record *says*." |
| 1:05 | Result: red card **This email is wrong about your PayPal case.** "PayPal shows no refund. Your case is still open: 13 days left… Don't close it." Hold 3 seconds. | "No refund. Case still open. Thirteen days left. Don't close it." |
| 1:15 | Scroll down to **Why** (already open): "$66.00 was refunded" next to "Refund: none"; the lookalike link; "close your case". Then the **Report it** card. | "Every claim sits side by side with PayPal's record, and she gets the one thing to do: forward it to phishing@paypal.com." |
| 1:30 | Next-step card: **Ask PayPal to step in by Sun, Nov 29**, with the deciding fact. Tap **Escalate in PayPal**, which opens the PayPal sandbox. | "Then her next step. Day 20 never files for her. She taps Escalate in PayPal herself." |
| 1:40 | Tap the **Replay** chip and switch Case to **Live sandbox case**. The ring changes to **⚖ With PayPal**, status "With a PayPal reviewer". | "And this is the same case live from PayPal's sandbox, after she escalated. It's now with a reviewer." |
| 1:50 | **One-page case.** Line 1: the USPS tracking number "added by the seller", with delivery ZIP **85705**. Line 2: ship-to **San Jose, CA 95131**. The tags are visible. | "For the PayPal reviewer — call her Rosa — Day 20 drafts one page. The deciding fact comes first: delivered to 85705, shipped to 95131. Every line says whether PayPal can check it or it's Maya's word." |
| 1:58 | Rosa (animated) at her desk, points at line 1, nods once. **"Rosa reviews PayPal disputes. She'll never meet Maya. All she gets is one page… This time, it reached her in time."** | "Rosa will never meet Maya. All she gets is one page, and she checks line 1 first. This time, it reached her in time." |
| 2:00 | Slow scroll down the tags: PAYPAL RECORD / PAYPAL CAN CHECK / BUYER REPORTS. | "Rosa doesn't get more work. She gets the deciding fact on line one, and a buyer who made it in time." |
| 2:10 | **What Day 20 did** (the trace): read_claim → compare → honesty check passed. Then a quick cut to the terminal running `npm run eval` and its scrolling ✓ lines. | "Under the hood: Claude reads the messy email, but code decides, and code writes every sentence Maya sees. The AI only picks which ones. Its tools are read-only. It can add a warning, never remove one." |
| 2:25 | The terminal's three summary lines (designed / regression / held-out), then `docs/GAMES.md`. | "Who tests the AI? We did, adversarially. Agents played scammers, paid for every fake that got past. When our honesty filter caught zero of thirty-three new harmful sentences, we stopped letting the AI write. On twelve fresh scams, scored before we tuned on them, it called none safe. And honest senders, paid to catch false alarms, pushed clean genuine emails from zero to eleven of twelve." |
| 2:40 | Back to the home screen tagline. Text: **Day 20 · free for buyers · read-only · open source** · "Not affiliated with PayPal. PayPal decides every case." | "Emails can lie. Her case record can't. Day 20." |

**If you're short on time,** cut 2:00–2:10.
**Don't say:** that it wins cases, stops fraud, saves reviewers time at scale, or reads her email inbox. It reads only what she shares.
