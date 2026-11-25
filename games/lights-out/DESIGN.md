# Lights Out: design spec

```yaml
title: Lights Out
mechanic:
  primary: Recall
  secondary: Search & identify
dimensions:
  view_control: open and close (a lights switch shows the things or the clue, never both)
  commit_gesture: scratch it off
  continuous_task: keep rubbing inside a floating cover
  meaning_in_loop: a new clue after every find, and a different clue every time the lights go out
  drawing_style: colour icons under covers
  probe_type: position nudge (the cover changes heading)
rounds: 3 (3 clues each; 6, 8, then 10 things)
instructions: Memorise where everything is, then tap Lights off to get a clue. Scratch the cover off the thing that answers it. A wrong cover adds 8 seconds.
prompts:
  - prompt: "Scratch the cover off the thing that points north"
    answer: compass
    decoys: [alarm clock, magnet, key, torch]   # other small metal objects
    why_unambiguous: each board is built so every clue has exactly one answer on it and nothing arguable (`maybe`)
decisions:
  - when: each clue (3 a round), with the things hidden
    what: which remembered thing answers the clue, and where it was
    time_allowed: unlimited (player-paced)
    derivability_check: the board doesn't change between clues, so there is no change to spot; the clue can't be seen while the things are visible
unstated_behaviours:
  - behaviour: a cover takes several strokes; one swipe across the board does nothing lasting
    feedback_when_wrong: scratch marks appear and build up; marks on a cover you leave fade
  - behaviour: relighting the board swaps the clue for a different one
    feedback_when_wrong: the new clue is shown as soon as the lights go out
  - behaviour: covers float, so the rubbing has to follow them
    feedback_when_wrong: marks stop building when the strokes miss
time_budget:
  search: 4-10 s a round studying the board; varies with memory
  decide: 1-3 s a clue recalling where the answer was
  steer: 1-1.5 s a clue scratching
  wait_or_react: 0.45 s between clues (about 8%)
  ceiling: study time trades against wrong covers and relighting; more things each round
  equal_work: the same number of things and clues, and the same amount of rubbing, for everyone
controls:
  first_play: the things are on screen with one button, "Lights off"; the prompt says to memorise and tap it
  gestures: tap the button (lights); rub a cover (commit)
  sensitivity: 0.45 screen heights of rubbing a cover. Not yet tuned with people
  reachability: every cover is on screen
interaction:
  find_phase: study the lit board, at the player's own pace
  commit: scratch a cover off
  continuous_phase: rubbing while the cover floats
  probes: one per cover scratched (3 or more a round); a change of heading eased over about 0.2 s; a slow response only wastes strokes
  penalty: 8 s; the wrong thing is shown for 0.9 s (which helps re-learn it), then covered again
visual:
  palette: random hue per session
  background: drifting blobs in the foreground hues
  role_cues: all covers are identical
  feedback: scratch marks, the uncovered thing, dim plus cross when wrong, "+8s" by the timer
motion:
  world: static board
  target: covers float irregularly, plus the probe
randomisation: prompts, answers, decoys, positions, order, palette, drift and probe timing, every session
architecture: all rules, answers and checks are in logic.js, run by shared/server/game-server.js. The client gets pictures as finished images under random ids, shapes in screen units, the prompt text and the HUD; nothing names a thing, an answer or a role (checked on every frame by `npm run solve`)
accessibility_notes: covers are about 95 px on a phone; strokes can be any direction or size; nothing flashes; no reaction is timed
rubric_self_score: {R1: 2, R2: 2, R3: 2, R4: 1, R5: 2, R6: "?", R7: 2, R8: 2, R9: 2, R10: 1, R11: 1, R12: 2, R13: 2, R14: 2, R15: 2, R16: 2, R17: 2, R18: 2, R19: 2, R20: 2, R21: 1, R22: "?", R23: "?", R24: 2, R25: "?"}
```

Known weak points: the board persists across a round's three clues, which is what recall needs but is not a full hard reset per commit (R21), and a bot that captions the board once answers all three clues (R4). The solver's sine-wave scribble scores a risk of about 0, so rubbing is easy to fake to the current scorer.

## Test status

- Privileged solver (spec §4 step 6) and leak audit (step 7): pass, 20 of 20 sessions, on a phone and a desktop viewport, including sessions with one deliberate wrong commit. Run `npm run solve`.
- Fairness panel, time distribution, adversarial tiers and human check (steps 5, 8, 9, 10): **not run**. The self-scores above marked `?` depend on them. See `docs/game-history.md`.
