# Game history and coverage record

Spec §4 step 1 and P7: every new game must use a family and dimension combination not used here, and should steer away from what the attacker's tool library already handles. Add a row for each new game.

**Status (2026-11-25):** only game 1, Constellations, is live (at the site root). Games 2–6 were removed after the play tests below; their code, design specs and the shared simulated server, telemetry and scorer they ran on are in git history (commit `e081f9e`, under `games/` and `shared/`), and can be recovered with `git show e081f9e:<path>`.

## Games

| # | Game | Family (primary / secondary) | View control | Commit gesture | Continuous task | Meaning in the loop | Drawing style | Probes |
|---|---|---|---|---|---|---|---|---|
| 1 | Constellations | Search & identify / Align & hold | grab and drag (free sky dome) | hold still on it | match rotation | once per round (predates the spec) | line drawings on a 3D sky | none |
| 2 | Ink Trail | Trace & connect / Search & identify | push toward an edge | linger on it while drawing | follow a path | order matters + a new item arrives | silhouettes | nudge, speed, control response |
| 3 | Orbit Sort | Sort & group | view has momentum | drag it to a zone and keep it there | keep inside a moving region | the rule itself changes | line drawings | nudge, speed, reversal, control response |
| 4 | Odd Lens | Odd one out / Search & identify | drag sets a speed | hold still on it | track a drifting target | new items arrive | partial reveals | reversal, speed, nudge, control response |
| 5 | Night Window | Timing & rhythm | none (world scrolls itself) | hold over it | follow a moving target | the rule itself changes | assembled from parts | speed, reversal, control response |
| 6 | Toss & Catch | Spatial reasoning | view follows with momentum | hold open as it lands | steer under a falling object | new items arrive | line drawings | nudge (gust), speed (gravity), control response |

Families not yet used as primary: Align & hold (only as game 1's secondary), Assemble, and the new families in spec v3 §3 (Route planning, Recall, Read & reason, Compare & spot).

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

## Prompt themes

Games 2–6 drew objects from `shared/objects.js` (32 outlines) and meanings from `shared/server/semantics.js` (both removed; in git history):

- Categories: wear, eat, alive, fly, kitchen, travel, drink, shelter, water (each with clear and arguable members).
- Real-life size order (Ink Trail), with every pair at least 2.5× apart.
- Game 1 keeps its own prompt list in `main.js`.

Known carry-over risk (spec goal 5): games 2–6 all reused the same 32 outlines and category lists, so an attacker who builds an outline recogniser and a category table for one game reuses both in the others. The drawing style changes per game (silhouette, line, blur, parts), which raises the recogniser's cost but doesn't remove the reuse. A per-game asset set and generated prompts would.

## Attacker coverage record

No adversarial testing (spec §8) has been run on games 2–6 yet: none in this project, by choice. Fill this in from those runs: which combinations the tier B tool library now handles, and which tools it built for each game.
