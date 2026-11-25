# Game history and coverage record

Spec §4 step 1 and P7: every new game must use a family and dimension combination not used here, and should steer away from what the attacker's tool library already handles. Add a row for each new game.

**Status (2026-11-25):** six games are live, listed on the site's landing page: game 1 (Constellations) and games 7–11 below, built to spec v3. Games 2–6 were removed after the play tests below; their code and design specs are in git history (commit `e081f9e`, under `games/`), and can be recovered with `git show e081f9e:<path>`.

## Games

| # | Game | Family (primary / secondary) | View control | Commit gesture | Continuous task | Meaning in the loop | Drawing style | Probes |
|---|---|---|---|---|---|---|---|---|
| 1 | Constellations | Search & identify / Align & hold | grab and drag (free sky dome) | hold still on it | match rotation | once per round (predates the spec) | line drawings on a 3D sky | none |
| 2 | Ink Trail | Trace & connect / Search & identify | push toward an edge | linger on it while drawing | follow a path | order matters + a new item arrives | silhouettes | nudge, speed, control response |
| 3 | Orbit Sort | Sort & group | view has momentum | drag it to a zone and keep it there | keep inside a moving region | the rule itself changes | line drawings | nudge, speed, reversal, control response |
| 4 | Odd Lens | Odd one out / Search & identify | drag sets a speed | hold still on it | track a drifting target | new items arrive | partial reveals | reversal, speed, nudge, control response |
| 5 | Night Window | Timing & rhythm | none (world scrolls itself) | hold over it | follow a moving target | the rule itself changes | assembled from parts | speed, reversal, control response |
| 6 | Toss & Catch | Spatial reasoning | view follows with momentum | hold open as it lands | steer under a falling object | new items arrive | line drawings | nudge (gust), speed (gravity), control response |
| 7 | Trail Forks | Route planning | none (each fork fits the screen) | drag it there | follow a path | new prompt at every fork | colour icons | nudge (the trail's bends shift) |
| 8 | Lights Out | Recall / Search & identify | open and close (lights switch) | scratch it off | keep rubbing inside a floating cover | new clue after every find and every relight | colour icons under covers | nudge (cover changes heading) |
| 9 | Word Wheel | Read & reason / Align & hold | scroll a wheel with momentum | hold it in the window | balance against the wheel's slip | new written clue and wheel every step | text | reversal (slip) |
| 10 | Odd Pair | Compare & spot / Search & identify | grab and drag (a row) | pull it apart | keep a stretched link straight | the kind of belonging changes every step | colour icons in pairs | reversal (sway) |
| 11 | Two Halves | Assemble / Search & identify | none (one table) | drag it onto its other half | match position | new prompt and table every step | partial reveals (pictures cut in half) | reversal (other half changes heading) |

Families not yet used as primary: Align & hold (only as a secondary).

## Play-test findings

Games 2–6 were built to the v2 spec. Play tests (2026-11-25) found that none of them ranks players well; spec v3 turns each problem into a rule (§13).

| Game | Verdict | Main problems | v3 rule |
|---|---|---|---|
| 1 Constellations | Works well | One specific answer, found by looking around; natural exploration motion; equal work; hard reset each round. Its one-frame rotation probe was visible and was removed. | The model to learn from (not to copy) |
| 2 Ink Trail | Confusing | Drawing both linked objects and panned the view | P10 one job per gesture |
| 3 Orbit Sort | Intuitive, doesn't rank | Any object was a valid next move, so time was reaction speed; objects and rule persisted, so players sorted one by one | R0 one specific answer; P7 hard reset |
| 4 Odd Lens | Intuitive, doesn't rank | The newly swapped-in object was always the odd one; prompt never changed; lens too sensitive | P2 not derivable from changes; P10 tuned sensitivity |
| 5 Night Window | Can't rank | Fixed prompt and pace, so a perfect run is easy and identical for everyone (and for bots) | R0 player-paced, no easy perfect score |
| 6 Toss & Catch | Too hard to control | Unreachable throws, late swerves, a net too slow to follow; one rule per round let a bot settle in | P10 reachable targets; R0; P7 |

## Games 7–11: what has and hasn't been tested

Each game's design spec, self-scores and known weak points are in `games/<name>/DESIGN.md`.

| Spec step | Status |
|---|---|
| §4.6 Privileged solver | Pass: 20 of 20 sessions a game, phone and desktop viewports, some with a deliberate wrong commit (`npm run solve`) |
| §4.7 Leak audit | Pass for frames: every frame is checked for text or server state (`npm run solve`). The answers still ship in the same bundle, as with any simulated server here |
| §4.5 Fairness panel | Not run. Prompts were written and checked by one agent only |
| §4.8, §9 Time distribution and human check | Not run. No human has played games 7–11 |
| §8 Adversarial tiers | Not run |

What the solver's sessions show about the scorer: the solver moves in straight lines at one speed with no lag, and scores a risk of about 0.7 in Trail Forks, Word Wheel, Odd Pair and Two Halves, but about 0 in Lights Out, where its sine-wave scribble passes for rubbing. The scorer's thresholds are uncalibrated guesses until there are human sessions to fit them to.

Structure shared by games 7–11 (a carry-over risk, spec goal 5): three rounds of three steps, one prompt and one answer per step, and a ring that fills during the continuous phase. A bot built for one of them knows the shape of the others.

## Prompt themes

Games 2–6 drew objects from `shared/objects.js` (32 outlines) and meanings from `shared/server/semantics.js` (both removed; in git history):

- Categories: wear, eat, alive, fly, kitchen, travel, drink, shelter, water (each with clear and arguable members).
- Real-life size order (Ink Trail), with every pair at least 2.5× apart.
- Game 1 keeps its own prompt list in `games/constellations/main.js`.

Games 7–11 each keep their own things and prompts in their `logic.js`, with no shared list, so a category table built for one doesn't transfer:

- Trail Forks: 24 animals; what an animal does or has (spins a web, has a hump).
- Lights Out: 34 household things; what a thing is used for.
- Word Wheel: words only; generated dates and sums, colours of things, opposites, animal facts.
- Odd Pair: pairs that belong (animal and food, things that work together, what things make or become) and hand-picked pairs that don't.
- Two Halves: 32 foods; what a food is, does or comes from.

They all draw the device's own emoji (sent to the client as images), so one emoji recogniser covers four of them. A real release would bundle its own drawings per game.

## Attacker coverage record

No adversarial testing (spec §8) has been run on games 2–11 yet: none in this project, by choice. Fill this in from those runs: which combinations the tier B tool library now handles, and which tools it built for each game.
