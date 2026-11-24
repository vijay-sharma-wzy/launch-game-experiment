# Orbit Sort (game 3)

Spec format from `docs/game-generator-spec-v2.md` §7. Rules: `logic.js` (simulated server). Display: `shared/shell.js` + `shared/render.js`.

```yaml
title: Orbit Sort
mechanic:
  primary: Sort & group
  secondary: none
dimensions:
  view_control: view has momentum (drag empty space to flick the orbit round; it coasts to a stop)
  commit_gesture: drag it to a zone and keep it there
  continuous_task: keep inside a moving region (the basket wanders)
  meaning_in_loop: the rule itself changes (twice a round)
  drawing_style: line drawings
  probe_type: position nudge, speed change, reversal, control response change
rounds: 3
instructions: "Drag each object into the basket it belongs in. The baskets’ rule changes as you go. Wrong drops add 15 seconds."
prompts:
  - prompt: "Sort them: could wear or couldn’t wear" (rules from wear, eat, alive, fly, kitchen, travel, drink; each used once per game)
    answer: each object's basket by meaning
    decoys: the other objects in orbit, mixed in and out of the category
    why_unambiguous: objects that are arguable for the current rule (`maybe` in shared/server/semantics.js) leave the orbit when the rule changes
decisions:
  - when: during continuous phase, one per sort (4 per round)
    what: which basket the carried object belongs in
    time_allowed: unlimited
  - when: mid-round
    what: re-sort under a new rule the player could not predict
    time_allowed: unlimited
unstated_behaviours:
  - behaviour: a basket only takes an object kept inside it for ~0.9 s
    feedback_when_wrong: a ring fills round the basket; letting go early sends the object back into orbit at no cost
  - behaviour: dragging empty space spins the orbit, with momentum
    feedback_when_wrong: the orbit turns under the finger at once
interaction:
  find_phase: objects circle, so each is only near the pointer some of the time
  commit: hold the object inside a basket until its ring fills
  continuous_phase: keeping the object inside a wandering basket
  probes: every 0.8–1.6 s while carrying; a basket nudge of 0.05, a wander speed change, a wander reversal, or a looser carry for 0.8 s. Progress pauses outside the basket; it never resets.
  penalty: 15 s per wrong drop
visual:
  palette: per-session hue; per-object line colours
  background: drifting soft blobs
  role_cues: baskets are told apart only by their text labels (meaning)
  feedback: basket ring (gradual), "New rule!" text, "+15s" text
motion:
  world: orbit turns on its own and with momentum after a flick
  target: baskets wander on smooth, varying paths
randomisation: rules, objects, which side is "yes", orbit direction, phases, colours, probe timing and type
architecture: logic.js runs inside shared/server/game-server.js; the client receives shapes, positions, rings, labels and the prompt text. (Simulated in the browser for now; see CLAUDE.md.)
accessibility_notes: labels are text, not colours; no flashing; baskets are large; on tall phone screens the layout stacks the baskets below the orbit
rubric_self_score: {R1: 2, R2: 1, R3: 1, R4: 2, R5: 2, R6: 2, R7: 2, R8: 2, R9: 2, R10: 1, R11: 1, R12: 2, R13: 2, R14: 0, R15: 1, R16: 2, R17: 2, R18: 0}
```

Scoring notes: R10/R11 are 1 because the whole board fits on one screen (motion and changing sets supply the variety instead). R2, R3, R14, R15 and R18 as in the Ink Trail notes.
