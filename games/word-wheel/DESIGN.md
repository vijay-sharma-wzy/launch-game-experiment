# Word Wheel: design spec

```yaml
title: Word Wheel
mechanic:
  primary: Read & reason
  secondary: Align & hold
dimensions:
  view_control: scroll a wheel with momentum
  commit_gesture: hold it in the window
  continuous_task: balance (hold a word steady against the wheel's slip)
  meaning_in_loop: a new written clue and a new wheel every step
  drawing_style: text
  probe_type: reversal (the slip changes direction and speed)
rounds: 3 (3 clues each)
instructions: Drag the wheel to the word that answers the clue. Keep it in the window until the ring fills. A wrong word adds 8 seconds.
prompts:
  - prompt: "Turn the wheel to two months before March"
    answer: January
    decoys: the other months   # same kind of word, so the type gives nothing away
    why_unambiguous: dates and sums have one answer; colour, opposite and animal clues exclude arguable words
decisions:
  - when: each clue (3 a round), while scrolling
    what: read the clue, work out the answer, recognise it among ten words of the same kind
    time_allowed: unlimited (player-paced)
    derivability_check: every step is a new clue and a new wheel
unstated_behaviours:
  - behaviour: the ring only fills while you keep hold of the wheel and it is nearly still
    feedback_when_wrong: the ring pauses
  - behaviour: the wheel slips under your finger
    feedback_when_wrong: the word slides out of the window and the ring pauses
  - behaviour: a flick keeps the wheel turning; the ends give and spring back
    feedback_when_wrong: immediate, visible motion
time_budget:
  search: 1-3 s scrolling to find the word
  decide: 1-4 s reading and working out the clue; varies most between people
  steer: 1.3 s hold, plus settling
  wait_or_react: 0.45 s between clues (about 8%)
  ceiling: working out the answer before scrolling, and scrolling the right way first time, both vary
  equal_work: the answer starts 3.5, 4.5 and 5.5 words from the window, once each, in a random order and direction
controls:
  first_play: a picker wheel of words under a written clue; dragging it is the only thing to do
  gestures: drag the wheel (the only gesture)
  sensitivity: 1:1 with the finger; the window accepts 0.3 of a word either side (about 25 px on a phone). Not yet tuned with people
  reachability: every word can be scrolled to
interaction:
  find_phase: scroll the wheel; the answer starts out of sight
  commit: hold a word in the window for 1.3 s
  continuous_phase: counter the slip to keep the word in the window
  probes: one per hold (3 a round); the slip reverses and speeds up, eased over about 0.2 s; a slow response pauses the ring
  penalty: 8 s; the word is struck through
visual:
  palette: random hue per session
  background: drifting blobs in the foreground hues
  role_cues: every word is drawn the same way
  feedback: ring, strike-through plus dimming, "+8s" by the timer
motion:
  world: soft ends, slip, momentum
  target: slip wanders irregularly, plus the probe
randomisation: prompts, answers, decoys, positions, order, palette, drift and probe timing, every session; month and sum clues are generated
architecture: all rules, answers and checks are in logic.js, run by shared/server/game-server.js. The client gets pictures as finished images under random ids, shapes in screen units, the prompt text and the HUD; nothing names a thing, an answer or a role (checked on every frame by `npm run solve`); words are sent as images, not text
accessibility_notes: words are large and high-contrast; the hold is long enough that pausing to read doesn't commit; nothing flashes
rubric_self_score: {R1: 2, R2: 2, R3: 2, R4: 2, R5: 2, R6: "?", R7: 2, R8: 2, R9: 2, R10: 2, R11: 2, R12: 2, R13: 2, R14: 2, R15: 2, R16: 2, R17: 2, R18: 2, R19: 2, R20: 2, R21: 2, R22: "?", R23: "?", R24: 2, R25: "?"}
```

Known weak points: text is the easiest thing for a bot to read, so this game relies almost entirely on behaviour (P8) rather than cost; English only.

## Test status

- Privileged solver (spec §4 step 6) and leak audit (step 7): pass, 20 of 20 sessions, on a phone and a desktop viewport, including sessions with one deliberate wrong commit. Run `npm run solve`.
- Fairness panel, time distribution, adversarial tiers and human check (steps 5, 8, 9, 10): **not run**. The self-scores above marked `?` depend on them. See `docs/game-history.md`.
