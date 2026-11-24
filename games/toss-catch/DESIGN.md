# Toss & Catch (game 6)

Spec format from `docs/game-generator-spec-v2.md` §7. Rules: `logic.js` (simulated server). Display: `shared/shell.js` + `shared/render.js`.

```yaml
title: Toss & Catch
mechanic:
  primary: Spatial reasoning
  secondary: none
dimensions:
  view_control: the view follows the net with momentum (field ~1.6 screens wide)
  commit_gesture: release over it, inverted: hold the net open as the object lands in it
  continuous_task: steer a springy net under a falling object
  meaning_in_loop: new items arrive (a throw every 1.3–2 s)
  drawing_style: line drawings
  probe_type: position nudge (gust), speed change (gravity), control response change (net spring)
rounds: 3
instructions: "Catch only the things that fit the prompt. Wrong catches add 15 seconds."
prompts:
  - prompt: "Catch only things you could drink from" (one rule per round from wear, eat, alive, fly, kitchen, travel, drink)
    answer: every thrown object in the category (4 to catch per round)
    decoys: clearly-not objects thrown between them (~55%)
    why_unambiguous: only clearly-in and clearly-out objects are thrown for a rule
decisions:
  - when: during continuous phase, one per throw (many per round)
    what: catch this one or let it fall
    time_allowed: 2.2–2.8 s of flight
unstated_behaviours:
  - behaviour: the net only catches while held open (pressed)
    feedback_when_wrong: the net's mouth visibly widens when pressed, and objects bounce off a closed net
  - behaviour: the net swings after the pointer like a spring and overshoots
    feedback_when_wrong: you see the net swing past and settle
  - behaviour: the view follows the net, so throws come in from off-screen
    feedback_when_wrong: the scene slides as the net moves
interaction:
  find_phase: watch throws come in from both sides
  commit: have the net open under a fitting object as it lands
  continuous_phase: steering under a moving landing point
  probes: every 0.9–1.7 s while a fitting object is in the air; a gust (±0.12 sideways speed), gravity ×0.6 or ×1.4 for 1 s, or a slack net spring for 0.8 s. A miss costs only the time until the next fitting throw.
  penalty: 15 s per wrong catch
visual:
  palette: per-session hue; per-object colours
  background: drifting soft blobs
  role_cues: none; fitting and non-fitting objects look alike
  feedback: catch ring by the net (gradual), ✕ and "+15s" when wrong, glow while open
motion:
  world: view follows the net with momentum
  target: ballistic arcs with spin; gusts and gravity changes
randomisation: rules, objects, sides, arcs, colours, probe timing and type
architecture: logic.js runs inside shared/server/game-server.js; the client receives shapes, positions, the net and the prompt text. (Simulated in the browser for now; see CLAUDE.md.)
accessibility_notes: no colour-only signals; no flashing; the open net is ~135 px wide at 800 px tall; catching needs timing within a 2+ s flight, never a fast reaction
rubric_self_score: {R1: 2, R2: 1, R3: 1, R4: 2, R5: 2, R6: 2, R7: 2, R8: 2, R9: 2, R10: 2, R11: 2, R12: 2, R13: 2, R14: 0, R15: 1, R16: 2, R17: 2, R18: 0}
```

Scoring notes: as in the Ink Trail notes.
