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

What "not called safe" means: Day 20 only says an email agrees with the case when it claims a refund
or a closed case *and* PayPal's record agrees. A scam rarely does, so "never called safe" is mostly
guaranteed by design. The number that measures the reader is **flagged red**, and it was 0/12.

The next held-out scam set couldn't be written: a fresh agent asked to write scam emails was stopped by a
safety check, and we didn't work around it. Next sets go in `emails/` and `honest/`.
