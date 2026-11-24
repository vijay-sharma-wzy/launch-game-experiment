# Ink Trail (game 2)

Spec format from `docs/game-generator-spec-v2.md` §7. Rules: `logic.js` (simulated server). Display: `shared/shell.js` + `shared/render.js`.

```yaml
title: Ink Trail
mechanic:
  primary: Trace & connect
  secondary: Search & identify
dimensions:
  view_control: push toward an edge (only while drawing; eases in, soft spring at the field's edge)
  commit_gesture: linger on it while drawing
  continuous_task: follow a path (steer a lagging pen onto drifting objects)
  meaning_in_loop: order matters, and a new object arrives mid-round
  drawing_style: silhouettes
  probe_type: position nudge, drift speed change, control response change (looser pen)
rounds: 3
instructions: "Hold and draw a line through the objects in the order the prompt asks. Wrong links add 15 seconds."
prompts:
  - prompt: "Link them from smallest to biggest in real life" (or biggest to smallest; random per round)
    answer: the size order of 4 objects, then 5 when one arrives
    decoys: every not-yet-due object on the field is a wrong next link
    why_unambiguous: every pair of objects on the field differs in everyday size by at least 2.5× (SIZE_GAP), e.g. key / bottle / chair / tree
decisions:
  - when: during continuous phase, one per link (4–5 per round)
    what: which remaining object is next in size order
    time_allowed: unlimited; nothing moves away
  - when: during continuous phase, after the 2nd link
    what: where the newly arrived object fits in the order
    time_allowed: unlimited
unstated_behaviours:
  - behaviour: an object links only when the pen lingers on it (~0.45 s)
    feedback_when_wrong: a ring fills round the object while you linger and fades when you move on
  - behaviour: drawing near a screen edge slides the view that way
    feedback_when_wrong: the view moves at once and that edge glows
  - behaviour: the pen trails the pointer, and sometimes trails it more
    feedback_when_wrong: the ink dot is always drawn where the pen really is
interaction:
  find_phase: the field is about 2 × 1.7 screens; objects off-screen must be found by pushing the view
  commit: linger on an object while drawing
  continuous_phase: steering the pen onto slowly drifting objects
  probes: every 1.2–2.6 s while drawing; nudge of 0.04 screen heights to the next object, a burst of faster drift, or a looser pen for 0.8 s. A slow response only delays the link.
  penalty: 15 s per wrong link
visual:
  palette: per-session hue; silhouette colours vary per object, background blobs share their hues
  background: drifting soft blobs
  role_cues: none: every object looks alike; only size meaning sets the order
  feedback: linger ring (gradual), shake and "+15s" text on a wrong link, solid lines between linked objects
motion:
  world: view drift, eased push, soft spring at the field's edge
  target: each object wobbles on its own timing; probes change drift speed
randomisation: objects, order direction, layout, colours, rotations, probe timing and type
architecture: logic.js runs inside shared/server/game-server.js; the client receives only shapes, positions, rings, paths and the prompt text. No object names cross the wire. (Simulated in the browser for now; see CLAUDE.md.)
accessibility_notes: no colour-only signals (wrong links also shake and show "+15s"); no flashing; objects are ~110 px across at 800 px tall; no timed reactions
rubric_self_score: {R1: 2, R2: 1, R3: 1, R4: 2, R5: 2, R6: 2, R7: 2, R8: 2, R9: 2, R10: 2, R11: 2, R12: 2, R13: 2, R14: 0, R15: 1, R16: 2, R17: 2, R18: 0}
```

Scoring notes: R2 and R3 need the independent fairness panel and real round times; R14 fails until the logic runs on a real server (the answers currently ship in the browser bundle); R15 lacks the `session` event, which needs accounts; R18 needs the privileged solver, which hasn't been run.
