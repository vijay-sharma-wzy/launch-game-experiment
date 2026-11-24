# Night Window (game 5)

Spec format from `docs/game-generator-spec-v2.md` §7. Rules: `logic.js` (simulated server). Display: `shared/shell.js` + `shared/render.js`.

```yaml
title: Night Window
mechanic:
  primary: Timing & rhythm
  secondary: none
dimensions:
  view_control: none; the view is fixed and the belt moves on its own
  commit_gesture: hold (press to light the lamp) over the object
  continuous_task: follow a moving target with the lamp
  meaning_in_loop: the rule itself changes (twice a round)
  drawing_style: assembled from parts
  probe_type: speed change, reversal, control response change
rounds: 3
instructions: "Hold to shine the lamp on the objects that fit the rule as they pass the window. The rule changes as you go. Shining on one that doesn’t fit adds 15 seconds."
prompts:
  - prompt: "Shine on things you could eat" (rules from wear, eat, alive, fly, kitchen, travel, drink)
    answer: every passing object in the category
    decoys: the clearly-not objects between them (~55% of the belt)
    why_unambiguous: arguable objects are swapped off the belt whenever the rule changes
decisions:
  - when: during continuous phase, one per object entering the window (many per round)
    what: does this object fit the current rule
    time_allowed: 2+ s; objects are visible on the belt before they reach the window
unstated_behaviours:
  - behaviour: the lamp must be over the object, not just on
    feedback_when_wrong: no ring appears unless the beam is on it
  - behaviour: only objects inside the window count
    feedback_when_wrong: objects outside are dimmer and never light up
interaction:
  find_phase: watch what's coming along the belt
  commit: hold the beam on a fitting object for 1 s
  continuous_phase: keeping the beam on a moving object
  probes: every 0.9–1.8 s while lit; belt speed change, a brief reversal, or a looser lamp for 0.8 s. Progress pauses when the beam slips.
  penalty: 15 s, after 0.6 s of light on a non-fitting object (no faster reaction is ever needed)
visual:
  palette: per-session hue; per-object colours
  background: drifting soft blobs
  role_cues: none; fitting and non-fitting objects look alike, and their rings fill the same way
  feedback: object ring (gradual), dimmed object when collected, ✕ and "+15s" when wrong, "New rule!" text
motion:
  world: the window sways and breathes slightly
  target: belt speed varies, with occasional reversals
randomisation: rules, objects and their order, colours, probe timing and type
architecture: logic.js runs inside shared/server/game-server.js; the client receives shapes, positions, rings, the window and the prompt text. (Simulated in the browser for now; see CLAUDE.md.)
accessibility_notes: no colour-only signals (✕ and text); no flashing; on narrow screens the belt slows so objects are visible for 2+ s before the window
rubric_self_score: {R1: 2, R2: 1, R3: 1, R4: 2, R5: 2, R6: 2, R7: 2, R8: 2, R9: 2, R10: 1, R11: 1, R12: 2, R13: 2, R14: 0, R15: 1, R16: 2, R17: 2, R18: 0}
```

Scoring notes: the instructions state "hold to shine", so the two unstated behaviours are aiming and the window boundary. R10/R11 are 1 because the window is a semi-fixed reference and the belt shows everything in turn. Others as in the Ink Trail notes.
