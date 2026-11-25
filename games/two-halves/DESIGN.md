# Two Halves: design spec

```yaml
title: Two Halves
mechanic:
  primary: Assemble
  secondary: Search & identify
dimensions:
  view_control: none (one table)
  commit_gesture: drag it onto its other half and keep it there
  continuous_task: match position (follow a floating half)
  meaning_in_loop: a new prompt and a new table every step
  drawing_style: partial reveals (every picture is cut in half)
  probe_type: reversal (the other half changes heading)
rounds: 3 (3 tables each; 4, 5, then 6 foods, so 8 to 12 halves)
instructions: Find the two halves of the food that answers the prompt. Drag one onto the other and keep them together until they join. A wrong food adds 8 seconds.
prompts:
  - prompt: "Join the two halves of the food that is sour and yellow"
    answer: lemon
    decoys: [banana, cheese, corn, honey]   # other yellow foods
    why_unambiguous: arguable foods are listed as `maybe` per prompt and never dealt with it
decisions:
  - when: each table (3 a round)
    what: which food answers the prompt, then recognising each of its halves among the others
    time_allowed: unlimited (player-paced)
    derivability_check: every table is a new prompt and a new set of foods
unstated_behaviours:
  - behaviour: halves of different foods don't join
    feedback_when_wrong: no ring appears
  - behaviour: the halves have to stay lined up until the ring fills
    feedback_when_wrong: the ring pauses
  - behaviour: halves float, so the one being joined to has to be followed
    feedback_when_wrong: the ring pauses as it slips away
time_budget:
  search: 2-6 s a table finding two halves among 8-12
  decide: 1-2 s
  steer: 0.9 s hold, plus the drag
  wait_or_react: 0.45 s between tables (about 7%)
  ceiling: recognising things from halves varies a lot; more halves each round
  equal_work: the answer's halves start 0.24, 0.30 and 0.36 of the screen apart, once each, in a random order
controls:
  first_play: half-pictures on a table and a prompt that says to join two of them
  gestures: drag a half (the only gesture)
  sensitivity: 1:1; the fit window is 0.022 of screen height (about 18 px on a phone). Not yet tuned with people
  reachability: everything is on screen
interaction:
  find_phase: look over the table
  commit: line one half up against the other for 0.9 s
  continuous_phase: follow the floating half
  probes: one per join (3 a round); a change of heading eased over about 0.2 s; a slow response pauses the ring
  penalty: 8 s; the wrong food is dimmed and crossed out
visual:
  palette: random hue per session
  background: drifting blobs in the foreground hues
  role_cues: every half is drawn the same way and in a random order
  feedback: ring, dim plus cross, "+8s" by the timer
motion:
  world: static table
  target: halves float irregularly, plus the probe
randomisation: prompts, answers, decoys, positions, order, palette, drift and probe timing, every session
architecture: all rules, answers and checks are in logic.js, run by shared/server/game-server.js. The client gets pictures as finished images under random ids, shapes in screen units, the prompt text and the HUD; nothing names a thing, an answer or a role (checked on every frame by `npm run solve`); each half is a separate image
accessibility_notes: halves are about 90 px tall on a phone; nothing flashes; no reaction is timed
rubric_self_score: {R1: 2, R2: 2, R3: 2, R4: 1, R5: 2, R6: "?", R7: 2, R8: 2, R9: 2, R10: 1, R11: 0, R12: 2, R13: 2, R14: 2, R15: 2, R16: 2, R17: 2, R18: 2, R19: 2, R20: 2, R21: 2, R22: "?", R23: "?", R24: 2, R25: "?"}
```

Known weak points: everything is visible from the first view (R11); a step has one prompt, so the three semantic decisions a round come one per table (R4); some halves (thin or symmetrical foods) may be hard to recognise and need a play test.

## Test status

- Privileged solver (spec §4 step 6) and leak audit (step 7): pass, 20 of 20 sessions, on a phone and a desktop viewport, including sessions with one deliberate wrong commit. Run `npm run solve`.
- Fairness panel, time distribution, adversarial tiers and human check (steps 5, 8, 9, 10): **not run**. The self-scores above marked `?` depend on them. See `docs/game-history.md`.
