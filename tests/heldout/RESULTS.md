# Held-out results, and how to reproduce them

Each set below was scored **once, by the code as it was before we looked at it**. After that we fixed
what it found and moved it to `tests/fixtures/` as regression tests. So these folders are empty today,
and today's code passing those emails is not evidence. The first measurement is the evidence.

To reproduce each number from the old code:

```
npm run replay-heldout
```

It checks out each commit below in a temporary git worktree and scores the same emails with it.

| Set | Code it was scored against | Result |
|---|---|---|
| Game 4 scam emails (`fixtures/scams/s2_*`), written by a fresh scammer agent | `ab9d746` | **12/12 not called safe; 0/12 flagged red** |
| Game 5 genuine emails (`fixtures/honest/g5_*`) | `b0c3630` | **0/12 not flagged red** (all 12 false alarms) |
| Game 6 genuine emails (`g6_*`), written after the game-5 fixes | `29d4f66` | **5/12 not flagged red** |
| Game 7 genuine emails (`g7_*`), written after the game-6 fixes | `b61f13f` | **11/12 not flagged red** |
| Set 8 genuine emails (`heldout/honest/h8_*`), by a fresh writer who never saw the code, frozen in `c261da7` | `323b54a` (rules) · `2ddc64e` (live model, 3 runs each) | **Rules: 11/12 not flagged red. Live model: 11/12 in each of 3 runs** ([log](../live/heldout-h8-2026-11-11.jsonl)). The model added no false alarm and the evidence check dropped nothing. The miss, h8_01, is the rules reader's: a genuine refund from a *different* shop for a different order, read as a refund on her case. The model can't remove a flag, so it stays red. |

What "not called safe" means: Day 20 only says an email agrees with the case when it claims a refund
or a closed case *and* PayPal's record agrees. A scam rarely does, so "never called safe" is mostly
guaranteed by design. The number that measures the reader is **flagged red**, and it was 0/12.

Set 8 is the first held-out set scored with the live model. It is genuine email only: the next held-out scam
set couldn't be written, because a fresh agent asked to write scam emails was stopped by a safety check, and
we didn't work around it. So the model's catch rate on unseen scams is still unmeasured.
