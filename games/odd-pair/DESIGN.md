# Odd Pair: design spec

```yaml
title: Odd Pair
mechanic:
  primary: Compare & spot
  secondary: Search & identify
dimensions:
  view_control: grab and drag (a row wider than the screen)
  commit_gesture: pull it apart
  continuous_task: keep a stretched link straight as the pair sways
  meaning_in_loop: the kind of belonging changes every step (food, works with, makes or becomes)
  drawing_style: colour icons joined in pairs
  probe_type: reversal (the pair's sway changes direction)
rounds: 3 (3 rows each; 7, 8, then 9 pairs)
instructions: Drag sideways to look along the row and find the one pair that doesn't belong together. Pull it apart and keep it stretched until it gives. A wrong pair adds 8 seconds.
prompts:
  - prompt: "Animals and what they eat: pull apart the pair that's wrong"
    answer: rabbit with a fish
    decoys: monkey-banana, mouse-cheese, dog-bone, bee-flower   # all animal-with-food
    why_unambiguous: wrong pairs are hand-picked to be impossible, not just unusual; the row never holds a second copy of either thing
decisions:
  - when: each row (3 a round), while scrolling
    what: judge every pair against the stated relationship until one fails
    time_allowed: unlimited (player-paced)
    derivability_check: every row is new; the odd pair is made of the same kinds of thing as the rest
unstated_behaviours:
  - behaviour: a sideways drag scrolls and an up-or-down drag on a thing pulls it
    feedback_when_wrong: the row moves, or the thing comes away, at once
  - behaviour: the link only gives while it is stretched far enough and still straight
    feedback_when_wrong: the link thins as it stretches; the ring pauses when it slants
  - behaviour: let go early and the thing springs back
    feedback_when_wrong: visible
time_budget:
  search: 3-8 s a row; the odd pair starts off screen, and pairs take a moment each to judge
  decide: spread through the search
  steer: 1.1 s hold, plus the pull
  wait_or_react: 0.45 s between rows (about 6%)
  ceiling: how quickly each pair is judged varies a lot; more pairs each round
  equal_work: the odd pair starts 2, 3 and 4 pairs from the middle of the screen, once each, in a random order and direction
controls:
  first_play: a row of joined pairs runs off both sides of the screen; dragging sideways moves it
  gestures: sideways drag (scroll); up-or-down drag on a thing (pull). The first movement decides, and it stays that way
  sensitivity: 1:1; pull 0.11 of screen height; straightness within 0.035. Not yet tuned with people
  reachability: the row scrolls to every pair; ends give and spring back
interaction:
  find_phase: scroll the row
  commit: pull one thing away from its partner and hold
  continuous_phase: follow the pair's sway to keep the link straight
  probes: one per pull (3 a round); the sway reverses, eased over about 0.2 s; a slow response pauses the ring
  penalty: 8 s; the pair is dimmed and barred
visual:
  palette: random hue per session
  background: drifting blobs in the foreground hues
  role_cues: the odd pair is drawn like every other pair
  feedback: link thickness, ring, dim plus bar, "+8s" by the timer
motion:
  world: soft ends; pairs float
  target: the pulled pair sways irregularly, plus the probe
randomisation: prompts, answers, decoys, positions, order, palette, drift and probe timing, every session
architecture: all rules, answers and checks are in logic.js, run by shared/server/game-server.js. The client gets pictures as finished images under random ids, shapes in screen units, the prompt text and the HUD; nothing names a thing, an answer or a role (checked on every frame by `npm run solve`)
accessibility_notes: things are about 80 px on a phone; pull and straightness windows are wide; nothing flashes
rubric_self_score: {R1: 2, R2: 2, R3: 2, R4: 2, R5: 2, R6: "?", R7: 2, R8: 2, R9: 2, R10: 2, R11: 2, R12: 2, R13: 2, R14: 2, R15: 2, R16: 2, R17: 2, R18: 2, R19: 2, R20: 2, R21: 2, R22: "?", R23: "?", R24: 2, R25: "?"}
```

Known weak points: scroll and pull share the drag gesture, split by direction, which needs a play test against P10; a few icons (bamboo, chestnut, sushi) are newer or less familiar.

## Test status

- Privileged solver (spec §4 step 6) and leak audit (step 7): pass, 20 of 20 sessions, on a phone and a desktop viewport, including sessions with one deliberate wrong commit. Run `npm run solve`.
- Fairness panel, time distribution, adversarial tiers and human check (steps 5, 8, 9, 10): **not run**. The self-scores above marked `?` depend on them. See `docs/game-history.md`.
