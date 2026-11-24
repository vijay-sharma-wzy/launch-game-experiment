# CLAUDE.md

## Working on this repo

- **This file is live.** Whenever the purpose, scope, game design, layout, commands or deployment change, update this file in the same piece of work. If something here no longer matches the repo, fix it rather than working around it.
- **Keep the repo lean and clean.** As you work, keep checking for dead code, unused files, unused dependencies, leftover debug logging, stale comments and duplicated logic, and remove them. Don't add files, dependencies or abstractions unless they're needed.

## Purpose

A fully client-side demo of **human verification games that also rank users** for the queue of a hype-release, first-come-first-served (FCFS) web app. The site's front page lists six games to compare; each is a candidate for the real release.

New games follow the framework in `docs/game-generator-spec-v2.md` (design spec, rubric, history, telemetry, scorer). Read it before designing or changing a game.

The game will eventually run on AWS (servers, databases, etc.). Until then, this repo **simulates that AWS infra on the client side**. There are no real backends, APIs or third-party services here.

## The problem we're solving: bad user experience

**Bad user experience** is defined as:

> any interaction where the user (a) waits without knowing their status or how long remains, (b) must retry due to errors, time-outs, or lost state, or (c) suffers an outcome that feels arbitrary or unfair relative to other users

Check every feature against all three parts of this definition, with these current exceptions:

- **(b) is mostly infra.** Recovering from errors, time-outs and lost state (retries, resuming sessions, permission-denied recovery) belongs to the real AWS infra work, not this repo.
- **(c) allows some randomness.** We're still experimenting, so per-player randomness in round layouts is acceptable where it's needed. Keep it from dominating the ranking.

## What the game must achieve

- **Good user experience.** Avoid every form of bad user experience defined above. Real users should find the game quick, clear and fair.
- **Filter out bots, and rank humans.** The score decides each user's place in the FCFS queue. This is deliberately **not a raffle**, because the community hates raffles. Skill and speed should earn the spot.
- **Make botting uneconomical, not impossible.** Nothing is unbottable, so the goal is to raise the cost:
  - Eliminate virtual parallelism. One bot instance should not be able to cheaply run many games at once (e.g. in headless browsers or emulators).
  - Make a bot that beats a real human's time very expensive to build.
- **Accepted limitation:** we cannot stop real human click farms, and we don't try to.
- **Phone and computer.** The game is touch-first but must be just as playable with a mouse. It uses no motion sensors and no camera: play tests showed tilt control made the score depend on where the player was (in a car, at dinner).

## Out of scope

This repo is only about what **the game itself** can do to filter bots and rank users. The following are reserved for the real AWS infra work and must not be added here:

- Cloudflare (Turnstile, WAF, bot management)
- Accounts, logins, credit card or identity verification
- ML models that detect humans from gyroscope or other sensor data
- Real databases, API Gateway, Lambda or any other AWS service

## Simulating the AWS infra

Logic that will later run on the server (issuing sessions, timing rounds on the server's clock, validating and storing scores) should live in clearly separated client-side code that mimics a server, so it can be lifted into Lambda later. Do not trust or depend on it as real security; it is a stand-in.

Current state:

- **Games 2–6** run their rules in a simulated server: `shared/server/game-server.js` wraps each game's `logic.js` and owns the clock, penalties, rounds and the telemetry of spec §6, then scores the session with `shared/server/scorer.js`. The client (`shared/shell.js`, `shared/render.js`) only forwards pointer input and draws the display-only frames it gets back, through `shared/transport.js`, which passes every message as JSON as a network would. Anything under `shared/server/` or in a game's `logic.js` is server code: the client must never import it except to create the server, and frames must never carry object names, answers or roles.
- **Game 1** (Constellations) predates this and still runs its rules in `games/constellations/main.js`, timing the score locally.
- Because it all runs in the browser, the answers ship in the bundle: the spec's leak audit (R14) fails by construction until the server code moves to AWS.
- The bot-risk score shown on the DONE screen is a demo readout with guessed thresholds. It needs calibrating on real human and bot sessions before anything acts on it.

## Games

| # | Game | Folder | Family | Design |
|---|---|---|---|---|
| 1 | Constellations | `games/constellations/` | Search & identify, then align & hold | `games/constellations/DESIGN.md` |
| 2 | Ink Trail | `games/ink-trail/` | Trace & connect | `games/ink-trail/DESIGN.md` |
| 3 | Orbit Sort | `games/orbit-sort/` | Sort & group | `games/orbit-sort/DESIGN.md` |
| 4 | Odd Lens | `games/odd-lens/` | Odd one out | `games/odd-lens/DESIGN.md` |
| 5 | Night Window | `games/night-window/` | Timing & rhythm | `games/night-window/DESIGN.md` |
| 6 | Toss & Catch | `games/toss-catch/` | Spatial reasoning | `games/toss-catch/DESIGN.md` |

Each game's `DESIGN.md` is the source of truth for how it plays; keep it updated with the game. `games/HISTORY.md` records every game's family and dimension combination and the attacker coverage record (spec §4, P7): add a row for every new game, and never reuse a combination.

Rules shared by games 2–6:

- 3 rounds; score is time plus 15 s per wrong commit (spec R3), shown in the HUD with a "+15s" flash and broken down on the DONE screen.
- Prompts come from the categories and sizes in `shared/server/semantics.js`. Objects that are `maybe` for a category are never on screen while that category is asked about.
- Progress always pauses rather than resets when the player slips (spec P4), and "fitted" or "right" is never shown by a colour switch alone (spec P5).
- Layouts adapt to tall phone screens as well as desktops.

## Stack and layout

- Vite + plain JavaScript (ES modules). No framework, no TypeScript. Game 1 uses three.js; games 2–6 draw with Canvas 2D.
- `index.html`: the front page listing the six games.
- `games/<name>/`: one folder per game, with its `index.html` and `DESIGN.md`. Game 1 has its rules in `main.js`; games 2–6 have theirs in `logic.js` (server code, tunables at the top), and their `index.html` only wires that logic into the shared shell.
- `games/HISTORY.md`: the family and dimension combinations used, prompt themes, and the attacker coverage record.
- `shared/objects.js`: the 32 hand-drawn object outlines all games draw from.
- `shared/shell.js`, `shell.css`, `render.js`: the display-only client for games 2–6 (start screen, HUD, DONE screen with the bot-risk readout, input forwarding, drawing).
- `shared/transport.js`: the JSON boundary between client and simulated server.
- `shared/server/`: simulated server code: `game-server.js` (clock, penalties, rounds, telemetry), `scorer.js` (features and risk score), `semantics.js` (categories and sizes), `palette.js`, `random.js`.
- `docs/game-generator-spec-v2.md`: the framework every new game follows.
- `vite.config.js`: builds every page (list new games in `GAMES`) and sets `base: "./"` so the build works from any host or sub-path.

## Commands

- `npm run dev` starts the dev server.
- `npm run build` builds into `dist/`.
- `npm run preview` serves the built `dist/` locally.

## Testing on a phone

The game needs no permissions or secure context, so `npm run dev -- --host` on the LAN works, as does a Netlify branch deploy.

## Deployment

Netlify, configured in `netlify.toml`. Each branch deploys to its own URL:

| Branch | URL |
|---|---|
| `main` (production) | `https://launch-game-experiment.netlify.app` |
| `keanen-dev` | `https://keanen-dev--launch-game-experiment.netlify.app` |
| `evan-dev` | `https://evan-dev--launch-game-experiment.netlify.app` |

## Code style

Match the existing code: no semicolons, single quotes in JS, two-space indent, and plain DOM APIs. Comments explain the *why* behind game and anti-bot decisions. Keep tunable numbers as named constants in the `Tunables` block at the top of each game's `main.js` or `logic.js`.
