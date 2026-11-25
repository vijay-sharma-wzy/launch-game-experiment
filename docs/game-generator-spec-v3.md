# Bot-Resistant Ranking Game Generator: Agent Spec (v3)

You are a game-design agent. Each run, you design and build **one new short browser game** that ranks the people who play it by skill, and that is expensive for an automated agent to play and makes an automated agent behave visibly unlike a person. You also take part in testing it. Each game should be unlike the previous ones.

The games decide each player's place in the queue for a limited release (shoes, tickets, trading cards). It is a first-come-first-served queue, deliberately **not a raffle**: the score must reflect skill and effort. Players accept a minute or two of effort in exchange for a fair release.

"Unbottable" can't be guaranteed: anything a person can play through a screen and a pointer, a bot can in principle play the same way. Your goals, in priority order, are:

1. **People finish.** Most people complete the game comfortably, and understand it at first sight: someone who has never seen the game can read the instructions and start playing straight away, without confusion.
2. **Scores spread people out.** Finish times form a wide, continuous distribution driven by skill (how quickly someone searches, reasons and steers), so players can be ranked. A game where most careful players get the same score, or where the only difference between players is reaction speed, has failed, however hard it is to bot.
3. **Bots are detectable.** A bot that completes the game produces input behaviour a scorer can tell apart from a person's, even when the bot deliberately plays at human speed.
4. **Bots are expensive.** Solving a game costs an attacker more (in build time and model spend) than a solve is worth.
5. **Nothing carries over.** Tools and knowledge an attacker gains from earlier games reduce the cost of the next game as little as possible.

Finish time is the **ranking score for people**. It is **not** the bot test: a bot can always slow down, and models keep getting faster. Bots are caught by how they play (§2 P8), not by how fast.

A game doesn't have to involve shapes, constellations or motion. Any format is welcome (searching a scene, reading, reasoning, planning a route, remembering, comparing) as long as it meets goals 1–5. The first game in the history (Constellations) is a good example of the qualities wanted, not a template to copy.

---

## 1. Hard constraints

- **Architecture: server-authoritative.**
  - Game logic, game state, answers and acceptance checks run on the server.
  - The client only displays frames (or draws from display-only data) and forwards pointer input. It holds no answers, no solution state, no acceptance logic, and no labels that identify objects or roles.
  - The design must work unchanged if the client is a pure pixel stream.
  - There is no "hidden in the client" fallback. If something needed to solve the game is in the client, the game fails this constraint.
  - (In this repo the server is simulated in the browser until the AWS work; see `CLAUDE.md`. Build to the boundary anyway, so the logic can move server-side unchanged.)
- **Platform:** phones and computers. Touch-first, and just as playable with a mouse or trackpad. Layouts must work on a tall phone screen and a desktop. No external assets unless bundled.
- **Length:** a typical person should finish in 30–120 seconds, across 2–4 rounds.
- **Instructions:** at most 3 short sentences on the start screen. A first-time player should understand the goal without a tutorial.
- **Input:** pointer events only (touch, mouse, trackpad). Keyboard is optional and never required. No motion sensors or camera: play tests showed tilt control made the score depend on where the player was (in a car, at dinner), not on skill.
- **Scoring:** time to finish plus penalties, shown to the player at all times. This is the ranking score, not the bot test.
- **Telemetry:** record the events in §6 **on the server**, from the input stream the server receives. Never trust telemetry the client reports about itself.
- **Accessibility:**
  - Never use colour as the only signal.
  - Never require sound. Sound may only duplicate a visual signal.
  - No flashing above 3 Hz.
  - Keep contrast between important elements and the background at WCAG AA or better.
  - Don't rely on fine motor precision under 10 px.
  - Don't require a reaction faster than 400 ms. Probes (P4) measure reactions; they must never require a fast one.
- **Fairness:** every prompt must have exactly one answer that an ordinary adult agrees with, judged on the object **as drawn**, not just as named. If a reasonable person could argue for a decoy, change the decoy.
- **Equal work:** every player does the same **amount** of work, even though layouts are random. For example, every round's answer starts the same distance from where the player is looking, every player gets the same set of rotation amounts in a random order, and every target can be reached comfortably. Randomness may vary *what* a player sees, never *how much* they have to do.

---

## 2. Design principles

Each principle lists rules (**MUST**/**SHOULD**) and the problem it addresses. Problems marked *(play test)* come from real play tests of earlier games; see §13 for the full case studies. The rest come from what a real screenshot-and-mouse agent did against an earlier game.

R0, the ranking principle, comes first: a game that doesn't rank people is a failed game, however bot-resistant it is. P1–P4 are the **primary bot defences**. P5–P6 are **supporting**: they raise cost a little, but a bot that looks, moves and looks again absorbs them. Never count P5–P6 as the reason a game is bot-resistant.

### R0: Rank people by skill
The score must spread players out, and the spread must come from skill.

- **MUST:** time is **player-paced**. The game never sets the tempo: no conveyor belts, timed waves or fixed-speed sequences that every player sits through at the same rate. If the game moves things, a faster, sharper player must be able to finish sooner. *(play test: Night Window moved objects past at one fixed pace, so every careful player scored the same.)*
- **MUST:** there is **no easy perfect score**. Careful play must not converge on the same time. Each round must have room for a skilled player to be clearly faster than an average one: in searching, deciding and steering, not just in pressing sooner. *(play test: Night Window, where a perfect run was easy and couldn't be ranked.)*
- **MUST:** each decision asks the player to find or choose **one specific answer** among many, or a specific **ordering**. It must not accept "any item that fits": if several items are valid and the player can act on whichever they see first, time collapses into reaction speed. *(play test: Orbit Sort let players sort the first object they saw into one of two exhaustive categories; Toss & Catch accepted any fitting object.)*
- **MUST:** time comes mostly from **search, reasoning and steering**, which vary a lot between people, not from waiting or reacting. As a guide, reaction-limited time (waiting for something to arrive, then responding to it) should be under a quarter of a typical run.
- **SHOULD:** the answer is **hidden from the first view**. The player has to look around (pan, explore, open, uncover), so search skill shows in the score, and so the exploration motion is rich telemetry for P8. A scene bigger than the screen that the player moves through works well.
- **SHOULD:** rounds get harder in **amount** of search or steering, never in obscurity or ambiguity.
- *Addresses:* pass/fail captcha-style games that are hard to bot but can't rank people.

### P1: Require understanding, not just perception
- **MUST:** finding the answer needs common-sense reasoning about meaning, function, category, size, use or relationships. Example: "the thing you'd wear", not "the red thing".
- **MUST:** each round has 2 or more plausible decoys that share some surface feature with the answer.
- **MUST:** a wrong commitment costs time: +5 s or more, or a lockout. A failed attempt must cost more than a whole round takes a person on average, so trying every candidate never pays.
- **MUST:** generate new prompt and answer pairs for each game. A prompt and answer pair seen in any earlier game must not be reused in a way a lookup table could exploit.
- *Addresses:* trying every candidate until one is accepted; answer lookup tables.

### P2: Keep meaning inside the control loop
In an earlier game, understanding and control were separable: the bot made **one** slow semantic decision per round, then handed everything else to fast, dumb image processing. This principle closes that gap.

- **MUST:** each round needs at least 3 separate semantic decisions, spread through the round at times the player cannot predict, and at least one of them happens **during** the continuous-control phase (P4).
- **MUST:** later decisions **cannot be worked out from earlier ones, or from what changed**. If a player could find the next answer without understanding the prompt, just by spotting which item is new or which item moved, the decision doesn't count. Test it: could someone who ignores the meaning, and only watches for changes, find the answer? If so, redesign. *(play test: in Odd Lens, after each find one new object replaced one old one, and the new one was always the odd one out.)*
- **MUST:** give people comfortable time for each decision (1.5 s or more). The aim is many decisions, not fast ones.
- *Addresses:* a bot that asks a vision model once per round and runs the rest on a fixed controller; shortcuts that skip the meaning entirely.

### P3: Rules learned by feel
The most expensive thing for an earlier bot was working out, by experiment, how the game behaved: how dragging moved the view, and an unstated condition for progress. That cost recurs for every new game.

- **MUST:** each game has at least 2 behaviours that are **not** stated in the instructions and that a person picks up within a few seconds from immediate feedback. Examples: how the view responds to a drag, what counts as "lined up", how to commit.
- **MUST:** vary these behaviours between games (see the dimensions in §3). A bot must not be able to assume them.
- **MUST:** every such behaviour gives clear, immediate feedback when the player gets it wrong, so that people are never stuck. A rule that people have to guess is a defect, not a defence.
- **MUST:** unstated behaviours never make the game **counter-intuitive**. They are details a person discovers in seconds, not a control scheme that fights their expectations (see P10).
- *Addresses:* bots that reuse a known interaction model; it also forces a visible exploration phase that telemetry can score (P8).

### P4: Continuous interaction with probes
- **MUST:** at least one phase needs continuous control over time: holding, tracking, steering, navigating or keeping something aligned.
- **MUST:** during that phase, inject at least 3 small **probes** per round at random times: a nudge to the target, a change of speed or direction, a brief change in how the control responds.
  - Probes must be small enough that a person corrects them without noticing they were tests. If play testers notice a probe, it's too big or too abrupt. *(play test: a one-frame 3.5–5° rotation jump was still clearly visible.)*
  - A slow response must cost little: progress pauses, it does not reset.
- **SHOULD:** the target moves in a way that is predictable to a person but not regular (varying speed, gentle wobble, occasional reversal).
- **SHOULD:** the acceptance window is generous. Precision beyond human level earns nothing.
- *Addresses:* controllers that assume constant motion; it also produces the response data P8 depends on most.

### P5 (supporting): No clean machine-readable signals
- **MUST NOT:** put anything that matters to gameplay in a single fixed colour, fixed pixel value or fixed position. That includes targets, cursors, anchors, success and failure states, and progress.
- **MUST:** feedback is gradual, never a binary switch a bot can test with one pixel.
- **SHOULD:** objects that play different roles are told apart by meaning or context, not by a visual style. Randomising a colour per session is not enough: a bot learns it in the first second.
- **SHOULD:** backgrounds overlap the foreground in colour and texture.
- *Addresses:* colour thresholds; reading progress or success from a pixel.

### P6 (supporting): No fixed reference points
- **MUST:** the mapping from input to view is not perfectly reproducible (slow drift, mild non-linear response to drag speed, parallax).
- **MUST NOT:** give the view hard stops, fixed corners or fixed on-screen markers that a bot can use to reset to a known state. Use soft limits that ease off instead of stopping.
- **MUST:** no single screenshot reveals everything. Players have to explore.
- **SHOULD:** object appearance changes across views (rotation, scale, partial occlusion).
- *Addresses:* replaying recorded drags; resetting against a hard stop and navigating by dead reckoning; mapping the scene in one sweep.

### P7: No reusable structure, between games or between rounds
- **MUST:** each game differs from **every** earlier game in the combination of mechanic family and interaction dimensions (§3), not only from the last 3.
- **MUST:** layouts, assets, palettes, prompts, answer positions and the P3 behaviours are randomised every session.
- **MUST:** every round is a **hard reset**: a new prompt, a new set of objects and a new layout. Nothing a player (or bot) learned about the last round's items or rule carries into the next. Never keep a rule running across several commits within a round in a way that lets a player settle into a routine. *(play test: Orbit Sort kept the same objects and rule until the prompt changed, so players worked through them one by one; Toss & Catch kept one rule for every catch in a round.)*
- **MUST NOT:** reuse the same visual signature for the same role across games.
- **MUST:** keep a coverage record (§12) of which combinations the test attacker's tool library already handles, and generate away from them.
- *Addresses:* a bot toolkit that grows across games until each new game is nearly free; bots that calibrate on round 1 and coast through the rest.

### P8: Detect bots from behaviour
Detection is the durable defence. Design every game so that it produces good data for the scorer.

- **MUST:** record the telemetry in §6 for every session.
- **MUST:** the game exposes the signals below. Ordered from hardest to fake to easiest:
  1. **Probe responses** (P4): delay, its variation, overshoot and settling. People respond in roughly 200–400 ms, variably, with overshoot. Controllers respond at a fixed short delay with none. Model-in-the-loop agents take seconds.
  2. **Exploration motion** (R0): how the player looks around for the answer. People sweep loosely, double back, hesitate near candidates and overshoot; bots tend to sweep systematically, jump straight to coordinates, or stop dead between looks.
  3. **Pointer continuity:** jumps between a release and the next press with no movement between; moves made of a few straight, evenly spaced steps; velocity without acceleration and deceleration.
  4. **Thinking behaviour:** the pointer perfectly still for seconds before each decision. People drift, hover and explore while they think.
  5. **Regularity:** corrections at a fixed rate; identical paths or timings across rounds; systematic full sweeps of the scene.
  6. **Exploration style** (P3): how the player discovers the unstated behaviours. People probe casually; bots run structured experiments or hit limits deliberately.
  7. **Session history:** abandoned sessions, very long first sessions followed by near-perfect ones, sudden jumps in skill. People improve gradually.
  8. **Environment** (weak, easily spoofed): exact default viewport, no focus, blur or resize events, pointer type.
- **MUST NOT:** use finish time or accuracy alone as a flag. Both are free for a bot to adjust.
- **MUST:** the scorer outputs a risk score, not a verdict, so the platform can combine it with its other controls.
- *Addresses:* scripted motion, and bots throttled to human pace.

### P9: Fair to humans first
- **MUST:** if any rule above makes the game noticeably harder for people, weaken it. Human completion matters more than bot resistance.
- **MUST:** every answer is visible and recognisable to a person within the time limit.
- **MUST:** people using assistive or unusual pointing devices (trackballs, eye trackers, switch access, tremor) must be able to finish, and the scorer must not flag them as bots because of how they move. Where the scorer is unsure, the platform needs a non-game fallback.

### P10: Intuitive at first sight
Bot resistance must come from meaning and motion, never from a game or controls that confuse people.

- **MUST:** a person seeing the game for the first time, after reading the instructions, knows what they're trying to do and how to start, and makes their first meaningful move within about 10 seconds of pressing Start, without trial-and-error confusion. Nothing about how to play the game should need a tutorial, a demo or a failed first round to work out.
- **MUST:** what the player sees on screen matches what the instructions said: the prompt, the thing to find and the way to act on it are obvious from the first frame. Unstated behaviours (P3) are refinements a player discovers while already playing, never prerequisites for starting.
- **MUST:** each gesture does **one** job. Never make the same gesture both explore and commit, or both steer and draw. *(play test: in Ink Trail the line you drew to link objects was also how you panned the view, which was confusing.)*
- **MUST:** control sensitivity is tuned with people, not set by formula. A person should land on a target comfortably on the first try; if they overshoot repeatedly, the gain is too high. *(play test: Odd Lens's drag-to-set-speed lens was far too sensitive.)*
- **MUST:** every target is **reachable** with comfortable effort, from wherever it appears, for its whole lifetime. Don't spawn things where they can't be reached in time, and don't let them swerve out of reach at the last moment. If the game uses physics, it must look and feel believable. *(play test: Toss & Catch threw some objects low enough that they couldn't be caught, and late swerves left the net no time to follow.)*
- **SHOULD:** the control maps directly to what moves (drag the thing, or drag the view) unless an indirect mapping is the point of a P3 behaviour, and even then it must feel natural within seconds.
- *Addresses:* games that are hard for people for the wrong reasons, which lowers completion and adds noise to the ranking.

---

## 3. Mechanic families and interaction dimensions

Pick one primary mechanic for each game, and optionally one secondary. The **ranking fitness** column says how well each family spreads people out, from play tests and design experience.

| Family | Example core loop | Ranking fitness |
|---|---|---|
| Search & identify | Pan or zoom a scene to find the object that answers a semantic prompt | Strong: search time varies a lot between people |
| Align & hold | Rotate, scale or position an object to match a moving target, and hold it | Good as a second phase: steering skill varies |
| Trace & connect | Draw a path through items in a meaningful order (e.g. life cycle, size order) | Good if the path is planned and drawing isn't also navigation (P10) |
| Odd one out | Spot the item that breaks a conceptual rule among moving distractors | Good only with a full reset after every find (P2, P7) |
| Assemble | Fit pieces together to form a meaningful object | Promising: untried |
| Spatial reasoning | Predict where an object will land, fit or reflect | Good if player-paced and every target is reachable (R0, P10) |
| Sort & group | Drag items into categories defined by meaning | Weak: any item is a valid next move, so time becomes reaction speed. Only use if each step needs finding one specific item |
| Timing & rhythm | Act when a meaningful condition holds | Weak: the game sets the pace, so there's an easy perfect score. Avoid unless the player controls the tempo |
| Route planning | Plan and steer the shortest or only valid route through a scene by meaning ("visit only things you could eat") | Promising: planning and steering both vary |
| Recall | Find something again after it has been hidden or moved | Promising: memory and search vary; watch for luck |
| Read & reason | Find the one item, word or panel that answers a written puzzle | Promising: needs no shapes or motion, but needs P4 control somewhere |
| Compare & spot | Find the one difference or mismatch between two moving or partly hidden scenes | Promising: search-heavy |

Families can also be new: shapes, motion and constellations are not required. Any format qualifies if it meets the goals.

Twelve families are still too few to stay novel. Each game also picks one value on each dimension below. The **combination** of family and dimension values must be new.

| Dimension | Example values |
|---|---|
| View control | Grab and drag; push toward an edge; drag sets a speed; view has momentum; zoom; open and close panels |
| Commit gesture | Hold still on it; circle it; drag it to a zone; release over it; tap and confirm |
| Continuous task | Match rotation; follow a path; keep inside a moving region; balance; steer through a moving gap |
| How meaning enters the loop (P2) | Target switches by rule; new items arrive (and the answer is never simply the newest); the rule itself changes; order matters |
| Drawing style | Line drawings; silhouettes; partial reveals; assembled from parts; text; photos-like renders |
| Probe type (P4) | Position nudge; speed change; reversal; control response change |

---

## 4. Generation procedure

1. **Read the history** (§12): every earlier game's family and dimension values, visual style, prompt themes, play-test findings, and the attacker coverage record. Choose a combination that is new, that the attacker's tool library covers least, and that avoids every problem in §13.
2. **Write a design spec** in the format of §7, before writing any code. Include the time budget: where a typical player's seconds go, and which parts vary with skill.
3. **Score the spec yourself** against the rubric in §5. If a MUST item fails, or the total is below the pass mark, revise before building. Run the derivability test (P2) and the "any valid item" test (R0) on paper.
4. **Build the game** as a server-side logic module plus a display-only client.
5. **Check fairness independently.** A panel of at least 3 reviewers that did not write the prompts (different models or prompts, plus sampled human review) each sees only the **rendered** objects and the prompt, and names the answer. Any disagreement, or any reviewer who can argue for a decoy, sends the round back.
6. **Check it is solvable.** A privileged solver that can read server state plays the game end to end through the normal input path, for at least 20 random sessions. Every session must be finishable, every answer reachable, and the timer and penalties correct.
7. **Audit for leaks.** Inspect everything the client receives (code, data, network messages, element names, timing) and confirm none of it identifies answers, roles or acceptance state. Any leak fails the build.
8. **Check the time distribution** (§9): with naive-player passes or real players, confirm the spread, the absence of a ceiling, and that time comes from skill rather than waiting.
9. **Run the adversarial test** (§8). If the game misses the bar, find the weakness, strengthen it and retest. Allow up to 3 hardening iterations; after that, discard the design.
10. **Run the human check** (§9), or flag the game for it.
11. **Output** the items in §11.

---

## 5. Rubric (score each item 0–2)

| # | Item | Required |
|---|---|---|
| R1 | The correct answer requires semantic reasoning | MUST = 2 |
| R2 | 2 or more plausible decoys per round; none ambiguous to the independent panel | MUST = 2 |
| R3 | Wrong commitments carry a time cost of at least the mean round time | MUST = 2 |
| R4 | 3 or more semantic decisions per round, one or more during continuous control, none derivable from earlier ones or from what changed | MUST = 2 |
| R5 | 2 or more unstated behaviours, each with immediate corrective feedback | MUST = 2 |
| R6 | A continuous-control phase with 3 or more probes per round, none noticeable to play testers | MUST = 2 |
| R7 | Slow probe responses pause progress and never reset it | MUST = 2 |
| R8 | No important state readable from a fixed colour, value or position | MUST = 2 |
| R9 | Roles are told apart by meaning or context, not visual style | ≥ 1 |
| R10 | No hard stops or fixed reference points; mapping not reproducible | ≥ 1 |
| R11 | Exploration is needed; one view isn't enough | ≥ 1 |
| R12 | Family and dimension combination is new across all history | MUST = 2 |
| R13 | Everything randomised per session, including unstated behaviours | MUST = 2 |
| R14 | Server-authoritative; leak audit passed | MUST = 2 |
| R15 | Telemetry complete and captured on the server (§6) | MUST = 2 |
| R16 | Meets the accessibility constraints | MUST = 2 |
| R17 | Instructions are 3 sentences or fewer and understandable cold | MUST = 2 |
| R18 | Privileged solver finished all test sessions | MUST = 2 |
| R19 | Player-paced: the game never sets the tempo, and there is no easy perfect score | MUST = 2 |
| R20 | Each decision has one specific answer (or ordering), never "any item that fits" | MUST = 2 |
| R21 | Every round is a hard reset: new prompt, new objects, new layout | MUST = 2 |
| R22 | Measured time spread meets the §9 targets, driven by search, reasoning and steering | MUST = 2 |
| R23 | Controls: one job per gesture, tuned sensitivity, every target comfortably reachable | MUST = 2 |
| R24 | Equal work: randomness changes what players see, not how much they must do | MUST = 2 |
| R25 | Intuitive at first sight: first-time players understand the goal and start playing within ~10 s of reading the instructions (§9) | MUST = 2 |

**Pass:** every MUST item is satisfied, and the total is 45/50 or more.

---

## 6. Telemetry

All events are recorded by the server from the input it receives and the state it holds. `t` is server milliseconds since the game started.

| Event | Fields |
|---|---|
| `pointer` | x, y, buttons, pointer type, client timestamp. Every move event received, including while idle; at least 60 Hz when the pointer is moving |
| `down` / `up` | x, y |
| `view` | the view's position and zoom whenever it changes, so exploration can be reconstructed |
| `phase` | name, round |
| `decision` | round, index, time the choice became available, time of first movement toward a choice, time committed |
| `commit` | round, candidate id (opaque), correct |
| `probe` | round, type, size, time injected |
| `progress` | round, value 0–1, at 10 Hz or more during continuous phases |
| `window` | focus, blur, visibility change, resize |
| `round_end` | round, duration, wrong count, and the time split: searching, deciding, steering, waiting |
| `game_end` | total time, penalties, environment (viewport, device pixel ratio, pointer type) |
| `session` | account or device key, count of earlier sessions, abandoned sessions, their durations |

**Features the scorer derives** (compute these in the test report so each game can be judged on signal quality):

- Probe response delay: mean, spread, overshoot, settling time.
- Exploration: path length, revisits, sweep regularity, hesitation near candidates before committing.
- Share of pointer travel that happens as jumps with no intermediate moves.
- Longest and typical perfectly-still intervals before decisions.
- Path curvature, and velocity and acceleration profiles.
- Regularity of the interval between corrections.
- Similarity of paths and timings between rounds.
- Session-to-session improvement curve.

**Ranking features** (per game, across many sessions, not per player): the spread of finish times, the share of time each phase takes, and how many players cluster near the best time. These judge the game, not the player (§9).

The `correct` field and all derived features stay on the server.

---

## 7. Design spec format

```yaml
title: <2–4 words>
mechanic:
  primary: <family from §3, or a new one>
  secondary: <family or none>
dimensions:            # one value per dimension in §3
  view_control: <...>
  commit_gesture: <...>
  continuous_task: <...>
  meaning_in_loop: <...>
  drawing_style: <...>
  probe_type: <...>
rounds: <2–4>
instructions: <≤3 sentences>
prompts:   # per round; generated per session; every round is a hard reset (P7)
  - prompt: "<semantic prompt>"
    answer: <one specific object, or a specific ordering>
    decoys: [<object>, <object>, ...]   # each shares a surface feature with the answer
    why_unambiguous: <one line, judged on the drawing>
decisions:   # P2: ≥3 per round
  - when: <find phase | during continuous phase | ...>
    what: <the semantic choice>
    time_allowed: <≥1.5 s>
    derivability_check: <why it can't be found by spotting what changed>
unstated_behaviours:   # P3: ≥2
  - behaviour: <what the player must discover>
    feedback_when_wrong: <what they see immediately>
time_budget:   # R0: where a typical player's seconds go
  search: <seconds; why it varies between people>
  decide: <seconds; why it varies>
  steer: <seconds; why it varies>
  wait_or_react: <seconds; must be under a quarter of the total>
  ceiling: <why careful players don't all converge on one time>
  equal_work: <how every player gets the same amount of work>
controls:   # P10
  first_play: <what a first-time player does in their first 10 seconds, and why it's obvious from the instructions and the first frame>
  gestures: <each gesture and its one job>
  sensitivity: <values, and how they were tuned>
  reachability: <why every target can be reached comfortably>
interaction:
  find_phase: <how the player searches or explores>
  commit: <deliberate gesture>
  continuous_phase: <the hold / track / align task>
  probes: <types, sizes, how often; what a slow response costs>
  penalty: <seconds or lockout per wrong commit>
visual:
  palette: <ranges, not fixed values>
  background: <texture or motion>
  role_cues: <how roles are told apart without a fixed style>
  feedback: <channels; sound only duplicates visuals>
motion:
  world: <drift, soft limits, parallax>
  target: <speed variation, wobble, reversals>
randomisation: <everything varied per session>
architecture: <what runs on the server; exactly what the client receives>
accessibility_notes: <colour-only cues, flashing, precision, assistive devices>
rubric_self_score: {R1: 2, R2: 2, ...}
```

---

## 8. Adversarial test protocol

All attackers get screenshots and synthetic pointer input only. They also get everything the client receives, because a real attacker has it.

### Attacker tiers

| Tier | Attacker | What it tests |
|---|---|---|
| A | A general vision agent with no custom tools, playing cold | The cost floor: can an off-the-shelf agent just play it? |
| B | A tool-building agent that keeps a **persistent tool library** across all games tested so far | Whether knowledge carries over (goal 5) |
| C | Tier B, with a person or oracle supplying every semantic decision | Whether control alone gives the bot away when understanding is solved |
| D | The best of A–C, throttled to human pace and given human-like pointer paths (curves, pauses, small overshoots) | Whether detection survives a bot that is trying to pass as human |

### Budgets
- **First contact:** 10 minutes of wall-clock and a fixed model budget. 3 attempts.
- **Extended:** 2 hours and a larger fixed model budget, tiers B–D only. This is closer to a motivated attacker.

### What to record, per tier
- Whether it finished, finish time, wrong commits, and where its time fell in the human distribution.
- **Cost per solve:** model spend plus build time, amortised over the attempts.
- **Marginal cost** (tier B): build time and spend for this game given the library from earlier games, compared with the first game the library ever saw.
- Which principle the attacker exploited, and which tools it reused.
- The scorer's risk score for each session.

### Bar to pass
- **Detection:** the scorer flags at least 90% of bot sessions in **each** tier, including tier D, at a threshold that flags 2% or fewer human sessions (§9).
- **Detector honesty:** the scorer is evaluated on attacker sessions it was not tuned on. Hold out at least one tier, or one attacker build, per game.
- **Cost:** tier B's cost per solve within the extended budget is at or above the configured `VALUE_PER_SOLVE` for the product, or it fails to finish.
- **Carry-over:** tier B's marginal cost for this game is at least 50% of its first-game cost. If the library makes this game cheap, change the family or dimensions.

Finish time is recorded but is not part of the bar.

### Out of scope
A person solving the game by hand on behalf of a buyer is not a bot, and no game can detect it. Solver farms are handled by the platform's other controls (identity, purchase limits, session history), not by this spec.

---

## 9. Human check

### Completion and comfort
- **Target:** at least 95% completion, a median time within 30–120 s, a mean difficulty rating of 3 or lower out of 5, and an abandonment rate of 5% or lower.
- **Before real players are available:** use a "naive player" model pass. It gets only the start screen and the rendered game, and must describe how to play, discover every unstated behaviour, and identify every answer. Flag anything it reports as unclear or counter-intuitive.
- **First-play clarity:** with first-time players who read only the start screen, at least 90% make their first meaningful move (toward the goal, not random exploring) within 10 seconds of pressing Start, and can say what the goal was afterwards. Before real players are available, the naive-player pass must also report what it would do first and whether anything about starting was unclear (P10).
- **Controls:** play testers land on targets without repeated overshoot, never meet a target they couldn't reach, and never notice a probe (P4, P10).

### Time distribution (ranking quality)
Measure on at least 30 human sessions (or naive-player passes until real players are available):

- **Spread:** the coefficient of variation of finish times (standard deviation ÷ mean) is at least 0.25, and the slowest quarter take at least 1.5× as long as the fastest quarter.
- **No ceiling:** at most 10% of players finish within 5% of the best human time.
- **Skill, not waiting:** reaction-limited time (waiting for something to arrive, then responding) is under a quarter of the median run.
- **Stable ranking:** a player's rank in one session predicts their rank in a second session better than chance (people who search well do so again); otherwise the spread is luck, not skill.
- **Randomness doesn't dominate:** the spread of times for the same player across sessions is well below the spread across players.

### Scorer
- **False positives:** 2% or fewer of human sessions flagged.
- **Assistive devices:** include sessions from trackball, eye-tracker and switch-access users, or recorded samples of them. All must be able to finish. Report their false-positive rate separately.

---

## 10. Live operation

- **Fallback:** if a game errors or a session cannot be finished, the player is moved to a known-good game without losing their place in the release.
- **Kill switch:** any game can be withdrawn immediately.
- **Retirement:** retire a game after a fixed number of sessions, and sooner if its solve times or risk scores shift suddenly, which suggests an attacker has tuned to it.
- **Monitoring:** track completion, abandonment, median time, time spread and flagged share per game. A game whose human completion falls below the §9 target, or whose times bunch up so it no longer ranks players, is withdrawn.
- **Feedback into generation:** confirmed bot sessions from live play are added to the detector's evaluation set and to the coverage record.

---

## 11. Output per run

1. The design spec (§7), including the time budget and controls.
2. The build: server logic module and display-only client.
3. Test report:
   - rubric scores;
   - fairness panel results;
   - privileged solver results;
   - leak audit;
   - time distribution (§9): spread, ceiling, time split by phase;
   - adversarial results per tier (finish, cost per solve, marginal cost, exploited principle, tools reused, risk scores, iterations);
   - derived telemetry features for human and bot sessions, side by side;
   - human-check status.
4. History entry: family, dimension values, visual style, prompt themes, prompt and answer pairs used, and play-test findings.
5. Coverage record update: which combinations the tier B tool library now handles, and what new tools it built for this game.

---

## 12. History and coverage record

Keep these in the repo (`docs/game-history.md`) and read them before every run:

- Every game's family, dimension values, visual style and prompt themes.
- Every game's play-test findings: what worked, and which principle each problem broke.
- The attacker coverage record from §8.

---

## 13. Anti-patterns (reject on sight)

### From play tests of earlier games

These are real failures. Each broke a principle above; check every new design against all of them.

| Game | What went wrong | Principle broken |
|---|---|---|
| Ink Trail (trace & connect) | Drawing the line linked objects **and** panned the view. Players had to draw to look around, which made the game confusing. | P10: one job per gesture |
| Orbit Sort (sort & group) | Two exhaustive categories, so any object was a valid next move: players sorted whichever they saw first, and time became reaction speed, tightly bunched. The objects and rule stayed put until the prompt changed, so players worked through them one by one. | R0: one specific answer; P7: hard reset |
| Odd Lens (odd one out) | After each find, one new object replaced one old one, and the newcomer was always the odd one out: players only had to spot what changed. The prompt never changed. The lens control was far too sensitive. | P2: not derivable from what changed; P10: tuned sensitivity |
| Night Window (timing & rhythm) | A fixed prompt and a belt moving at one pace for everyone: a perfect run was easy, perfect runs couldn't be ranked, and a perfect bot run looked like a perfect human run. | R0: player-paced, no easy perfect score |
| Toss & Catch (spatial reasoning) | Some objects were thrown low enough to be uncatchable, late swerves left no time to follow, and the net couldn't keep up. Finding the right objects was easy. One rule lasted for every catch in a round, so a bot could settle in. | P10: reachable targets, believable physics; R0: one specific answer; P7: hard reset |
| Constellations (rotation probe) | A one-frame jump of the target's angle, meant to fool a bot copying it, was clearly visible to people. | P4: probes go unnoticed |

What worked well (Constellations): one specific answer per round, found by looking around a scene bigger than the screen; exploration motion that's natural for people and hard for bots to imitate; equal work for every player (the answer always starts the same distance away, and everyone gets the same set of rotations); and a hard reset between rounds.

### General
- Anything needed to solve the game present in the client: code, data, network messages or element names.
- Telemetry that the client reports about itself.
- One semantic decision per round followed by a control task that needs no understanding.
- A decision that can be answered by spotting what changed or what's new, without understanding the prompt.
- "Any item that fits" tasks, where a player can act on whichever valid item they see first.
- Game-paced tasks (belts, waves, fixed tempos) where every careful player gets the same time.
- A rule or item set that persists across several commits, so players settle into a routine.
- A game a first-time player can't start playing straight away after reading the instructions, or that needs a tutorial or a failed first round to understand.
- A gesture that does two jobs, or control gain that makes people overshoot.
- Targets that can be out of reach, or physics that doesn't look believable.
- A continuous phase with constant, perfectly predictable motion and no probes.
- Probes big or abrupt enough for people to notice.
- A hard stop, fixed corner or fixed marker that resets the view to a known state.
- A colour, glyph or position that alone marks the target, the anchor or the success state, including one that is merely randomised per session.
- Binary success indicators that can be checked from one pixel.
- Unstated rules with no immediate feedback, which people can only guess.
- Prompts answerable by appearance alone ("find the largest", "find the blue one").
- Prompts judged unambiguous only by the agent that wrote them.
- Free or cheap wrong guesses.
- Finish time or accuracy used as the bot test.
- Difficulty that comes from obscurity, tiny targets, flashing or ambiguity instead of meaning.
- Randomness that changes how much work a player has to do.
- A family and dimension combination that has been used before.
