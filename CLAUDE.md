# CLAUDE.md

## Working on this repo

- **This file is live.** Whenever the purpose, scope, game design, layout, commands or deployment change, update this file in the same piece of work. If something here no longer matches the repo, fix it rather than working around it.
- **Keep the repo lean and clean.** As you work, keep checking for dead code, unused files, unused dependencies, leftover debug logging, stale comments and duplicated logic, and remove them. Don't add files, dependencies or abstractions unless they're needed.

## Purpose

A fully client-side demo of **human verification games that also rank users** for the queue of a hype-release, first-come-first-served (FCFS) web app. The landing page lists six games; Constellations is the first and the model for the rest.

Designing a new or different game? Follow `docs/game-generator-spec-v3.md`, and read `docs/game-history.md` first: it records every game so far, five earlier experiments that play tests found couldn't rank players (removed; in git history), and which checks the current games have and haven't had.

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

- **Constellations** has no server simulation. Its score is the local time from the Start tap to the last lock, plus wrong-pick penalties (`elapsed()` and `lock()` in `games/constellations/main.js`).
- **The five newer games** run on a simulated server. Everything under `shared/server/` and each game's `logic.js` is server code: rules, answers, the clock, penalties, telemetry and the bot-risk scorer. The client (`shared/shell.js`, `shared/render.js`) only forwards raw pointer input and paints the frames it gets back, and the two sides talk only through `shared/transport.js`, which passes JSON as a network would. Pictures and words reach the client as finished images under random ids, never as names.

## Game design: Constellations

The player floats in space with Earth directly below. Constellations (outlines of objects) are scattered all the way round the player and overhead, never below, and each one slowly spins in place. The player drags the sky freely anywhere in the dome, up to straight overhead. A ring marks the centre of the screen. A game is 3 rounds, and in each round thinking and moving happen together rather than in separate steps:

1. **Find.** A random prompt ("Find the object that melts in the sun") appears and the player can drag the sky straight away. Exactly one constellation answers the prompt. The outlines carry no name labels, in the page or the markup: recognising them is part of the task.
2. **Hold.** Holding the ring on a constellation fills it. A full ring on a wrong constellation flashes red, dims that constellation and adds a 5-second penalty to the score, shown as "+5s" beside the timer (which always includes penalties). The DONE screen says how much of the score was penalties. A full ring on the right one fades the object in at the centre of the screen, turned away from its constellation.
3. **Lock.** The player rotates the object with the dial to match the constellation, which keeps spinning. A small dot on the object's centre and a bigger one on the constellation's (shown only once it's found) guide the position. While position and rotation are both within a tight tolerance the ring fills and a soft glow eases in; when either slips it pauses, but never drains, so matched time adds up. There is deliberately no colour switch for "fitted", which a bot could read from one pixel. A full ring locks the round. The hold means the player has to track the spin with the dial: waiting for the constellation to come round to the object only adds a moment per turn.

The score is the total time. Rules that keep it fair:

- Prompts, objects, positions and rotations are randomised per player, but the **amount** of work is fixed: every round the answer is the same angular distance from where the player is looking, and every player gets the same set of rotation amounts in a random order and direction. Constellations spin at different speeds, half clockwise and half anticlockwise. The answer's speed comes from a fixed set (one per round, shuffled per player), and it always spins away from the match, so the spin never shortens one player's rotation and lengthens another's.
- Objects that are arguable for a prompt (`maybe` in `PROMPTS`) are never in the sky with it.
- The field of view is fixed along the screen's longer side, so phones and desktops see the same amount of sky.

Visual noise makes a screen-reading bot's job harder without changing what a human sees: every outline is drawn in slightly varying blues whose brightness and thickness waver over time, corners wobble by a pixel or two, each line between a constellation's stars fades out and back on its own timing (so a few are always missing, never the same ones for long), every star twinkles and, on its own timing, flares up, dims out completely and comes back, growing as it brightens and shrinking to nothing as it dims, and a nebula and Milky Way band in similar blues sit behind everything, drifting round the sky in two opposing layers with waves of brightness rolling through them, so the background is never still. Dark dust wisps drift just in front of the constellations, dimming patches of their lines by up to 75% (never fully) as they pass, so an angle measured from the screen keeps shifting; the held object and centre dots are drawn above them.

## Game design: the five newer games

Each has its own design spec in `games/<name>/DESIGN.md`, in the framework's format, with self-scores and known weak points. They share one shape: 3 rounds of 3 steps; every step is a new prompt with exactly one answer; a wrong commit adds 8 seconds; and each has a continuous phase in which something wanders and one small probe is hidden, so the scorer can measure how the player responds.

| Game | Folder | What the player does |
|---|---|---|
| Trail Forks | `games/trail-forks/` | Drags a dot along a swaying trail that splits, to the one animal that answers the prompt |
| Lights Out | `games/lights-out/` | Memorises a board, then scratches the cover off the thing that answers each clue. The clue and the things are never visible together |
| Word Wheel | `games/word-wheel/` | Scrolls a wheel of words to the one that answers a written clue, and holds it in the window against the wheel's slip |
| Odd Pair | `games/odd-pair/` | Scrolls a row of pairs that belong together and pulls apart the one that doesn't, keeping the link straight as the pair sways |
| Two Halves | `games/two-halves/` | Among floating halves of foods, drags together the two that make the one answering the prompt |

The play area is a centred column no wider than 0.62 of the screen's height, so a desktop shows no more of a game than a phone. The DONE screen shows the scorer's readout; that is for the team while we experiment, and a real release would keep it on the server.

## Stack and layout

- Vite + plain JavaScript (ES modules) + three.js (Constellations only). No framework, no TypeScript.
- `index.html` is the landing page: the list of six games.
- `games/constellations/`: `index.html` (markup, styles and overlays) and `main.js` (all game logic: tunables at the top, then objects and prompts, the scene, game state, rounds, controls, the lock check, and the game loop).
- `games/<name>/` for each newer game: `index.html` (title and instructions), `logic.js` (server-side rules, tunables at the top) and `DESIGN.md`.
- `shared/server/`: `game-server.js` (clock, rounds, steps, penalties, telemetry), `scorer.js` (bot-risk score), `steer.js` (wandering targets, holds and probes), `sprites.js` (draws pictures and words into images), `palette.js`, `random.js`.
- `shared/`: `shell.js` and `shell.css` (start screen, HUD, DONE screen, input forwarding), `render.js` (paints a frame), `transport.js` (the client–server boundary).
- `tools/solve.mjs`: plays every newer game end to end with a solver that can read server state, and audits every frame sent to the client.
- `vite.config.js` sets `base: "./"` so the build works from any host or sub-path, and lists every page to build. Add new games there and to `tools/solve.mjs`.
- `docs/game-generator-spec-v3.md`: the framework for designing games; `docs/game-history.md`: every game, play-test findings and test status.

## Commands

- `npm run dev` starts the dev server.
- `npm run build` builds into `dist/`.
- `npm run preview` serves the built `dist/` locally.
- `npm run solve` checks that every newer game can be finished and leaks nothing to the client. Run it after changing any `logic.js` or anything in `shared/`.

## Testing on a phone

The games need no permissions or secure context, so `npm run dev -- --host` on the LAN works, as does a Netlify branch deploy.

## Deployment

Netlify, configured in `netlify.toml`. Each branch deploys to its own URL:

| Branch | URL |
|---|---|
| `main` (production) | `https://launch-game-experiment.netlify.app` |
| `keanen-dev` | `https://keanen-dev--launch-game-experiment.netlify.app` |
| `evan-dev` | `https://evan-dev--launch-game-experiment.netlify.app` |

## Code style

Match the existing code: no semicolons, single quotes in JS, two-space indent, and plain DOM APIs. Comments explain the *why* behind game and anti-bot decisions. Keep tunable numbers as named constants in the `Tunables` block at the top of each game's `main.js` or `logic.js`.
