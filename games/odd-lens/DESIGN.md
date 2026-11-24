# Odd Lens (game 4)

Spec format from `docs/game-generator-spec-v2.md` §7. Rules: `logic.js` (simulated server). Display: `shared/shell.js` + `shared/render.js`.

```yaml
title: Odd Lens
mechanic:
  primary: Odd one out
  secondary: Search & identify
dimensions:
  view_control: drag sets a speed (joystick from where the press began)
  commit_gesture: hold still on it (keep the lens on it ~1.6 s)
  continuous_task: track a drifting target with the lens
  meaning_in_loop: new items arrive (two swap after each find, which can change the category and the odd one)
  drawing_style: partial reveals (blurred smudges, crisp only inside the lens)
  probe_type: reversal, speed change, position nudge, control response change
rounds: 3
instructions: "Find the object that doesn’t belong with the others and keep the lens on it. The set keeps changing. Wrong picks add 15 seconds."
prompts:
  - prompt: "Keep the lens on the one that doesn’t belong"
    answer: the one object outside the shared category (wear, kitchen, travel, alive)
    decoys: the four that share it
    why_unambiguous: the odd one is never `maybe` for the group's category; for example boot, hat, sock, shirt and a car
decisions:
  - when: during continuous phase, 3 per round
    what: which object is odd now, after each swap
    time_allowed: unlimited
unstated_behaviours:
  - behaviour: dragging sets the lens's speed and direction rather than its position
    feedback_when_wrong: the lens moves off at once, and a line from the press point shows the drag
  - behaviour: objects are only clear inside the lens
    feedback_when_wrong: they sharpen the moment the lens passes over them
  - behaviour: the lens must stay on an object to choose it
    feedback_when_wrong: a ring fills round the lens and fades when it slips
interaction:
  find_phase: sweep the lens over the smudges to see what they are
  commit: keep the lens on one object until its ring fills
  continuous_phase: tracking the drifting group with a speed-controlled lens
  probes: every 1–2 s while steering; group reversal, a speed change, a 0.04 nudge to the odd object, or a lens gain change for 0.9 s. Progress pauses when the lens slips.
  penalty: 15 s per wrong pick
visual:
  palette: per-session hue; per-object line colours
  background: drifting soft blobs
  role_cues: none; the odd one looks like the rest
  feedback: lens ring (gradual), shake and "+15s" on a wrong pick, "Two have changed." text
motion:
  world: none (the lens has a soft edge)
  target: the group drifts, steers softly off the edges, each object wobbles
randomisation: category, objects, odd one, slots, drift, colours, probe timing and type
architecture: logic.js runs inside shared/server/game-server.js; the client receives shapes, positions, the lens and the prompt text. (Simulated in the browser for now; see CLAUDE.md.)
accessibility_notes: no colour-only signals; no flashing; the lens is generous (on-target within ~48 px at 800 px tall); speed control may be hard for some assistive devices and needs testing
rubric_self_score: {R1: 2, R2: 1, R3: 1, R4: 2, R5: 2, R6: 2, R7: 2, R8: 2, R9: 2, R10: 1, R11: 2, R12: 2, R13: 2, R14: 0, R15: 1, R16: 1, R17: 2, R18: 0}
```

Scoring notes: R16 is 1 until speed-control steering is tried with assistive devices. Others as in the Ink Trail notes.
