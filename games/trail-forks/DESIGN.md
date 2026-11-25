# Trail Forks: design spec

```yaml
title: Trail Forks
mechanic:
  primary: Route planning
  secondary: none
dimensions:
  view_control: none (each fork fits the screen; the next one replaces it)
  commit_gesture: drag it there (arriving at the end of a branch)
  continuous_task: follow a path
  meaning_in_loop: a new prompt at every fork; the choice is made while already steering
  drawing_style: colour icons
  probe_type: position nudge (the trail's bends shift under the dot)
rounds: 3 (3 forks each; 3, 4, then 5 branches)
instructions: Drag the dot along the trail to the animal that answers the prompt. Each round the trail splits more ways. A wrong animal adds 8 seconds.
prompts:
  - prompt: "Lead the dot to the animal that sleeps hanging upside down"
    answer: bat
    decoys: [owl, eagle, butterfly, bee]   # other things with wings
    why_unambiguous: no other animal in the set does; arguable animals are listed as `maybe` per prompt and never shown with it
decisions:
  - when: at each fork (3 a round), on the shared stretch before the split
    what: which one animal answers this fork's prompt
    time_allowed: unlimited (player-paced)
    derivability_check: every fork is a new prompt and a new set of animals; nothing persists to compare against
unstated_behaviours:
  - behaviour: the dot only follows while the pointer stays close to it
    feedback_when_wrong: the dot stops and a tether stretches from it to the pointer
  - behaviour: near the fork the dot goes with whichever branch the pointer follows, and you can back up and choose again until you arrive
    feedback_when_wrong: the dot visibly moves onto the other branch
  - behaviour: the trail sways, so the path has to be followed, not memorised
    feedback_when_wrong: the dot falls behind (tether)
time_budget:
  search: 1-3 s a fork reading 3-5 animals; varies with reading and recognition speed
  decide: 0.5-2 s; overlaps the shared stretch
  steer: 1-2 s a fork; faster players risk leaving the dot behind
  wait_or_react: 0.45 s between forks (about 10%)
  ceiling: steering speed trades against losing the dot, and deciding early enough to never stop is hard
  equal_work: every branch is the same length with the same bends; the same number of forks and branches for everyone
controls:
  first_play: the dot pulses at the bottom of a trail that leads to pictures; the prompt says where to take it
  gestures: drag the dot (the only gesture)
  sensitivity: 1:1; grab radius 0.075 of screen height. Not yet tuned with people
  reachability: every animal is at the end of a branch on screen
interaction:
  find_phase: read the animals around the fork
  commit: arrive at the end of a branch
  continuous_phase: keep the pointer with the dot along a swaying trail
  probes: one per fork on the shared stretch (3 a round); the bends shift by 0.6-0.9 rad of phase over about 0.2 s; a slow response only leaves the dot waiting
  penalty: 8 s; the branch closes and the dot slides back to the fork
visual:
  palette: random hue per session; trail and dot colours drawn from ranges
  background: drifting blobs in the foreground hues
  role_cues: the answer looks like any other animal
  feedback: tether, pulse on the idle dot, dim plus cross on a closed branch, "+8s" by the timer
motion:
  world: static view; trails sway continuously
  target: bends shift irregularly, plus the probe
randomisation: prompts, answers, decoys, positions, order, palette, drift and probe timing, every session
architecture: all rules, answers and checks are in logic.js, run by shared/server/game-server.js. The client gets pictures as finished images under random ids, shapes in screen units, the prompt text and the HUD; nothing names a thing, an answer or a role (checked on every frame by `npm run solve`)
accessibility_notes: closed branches are crossed out as well as dimmed; grab radius about 60 px on a phone; nothing flashes; no reaction is timed
rubric_self_score: {R1: 2, R2: 2, R3: 2, R4: 2, R5: 2, R6: "?", R7: 2, R8: 2, R9: 2, R10: 1, R11: 0, R12: 2, R13: 2, R14: 2, R15: 2, R16: 2, R17: 2, R18: 2, R19: 2, R20: 2, R21: 2, R22: "?", R23: "?", R24: 2, R25: "?"}
```

Known weak points: nothing is hidden from the first view of a fork (R11), so search is short; the penalty (8 s) is set against a step, not a whole round (R3 read per decision).

## Test status

- Privileged solver (spec §4 step 6) and leak audit (step 7): pass, 20 of 20 sessions, on a phone and a desktop viewport, including sessions with one deliberate wrong commit. Run `npm run solve`.
- Fairness panel, time distribution, adversarial tiers and human check (steps 5, 8, 9, 10): **not run**. The self-scores above marked `?` depend on them. See `docs/game-history.md`.
