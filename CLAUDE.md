# CLAUDE.md

## Working on this repo

- **This file is live.** Whenever the purpose, scope, game design, layout, commands or deployment change, update this file in the same piece of work. If something here no longer matches the repo, fix it rather than working around it.
- **Keep the repo lean and clean.** As you work, keep checking for dead code, unused files, unused dependencies, leftover debug logging, stale comments and duplicated logic, and remove them. Don't add files, dependencies or abstractions unless they're needed.

## Purpose

A fully client-side demo of a **human verification game that also ranks users** for the queue of a hype-release, first-come-first-served (FCFS) web app.

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

Current state: no server simulation exists yet. The score is just the local time from the Start tap to the last lock (`elapsed()` and `lock()` in `main.js`).

## Game design

The player floats in space with Earth directly below. Constellations (outlines of objects) are scattered all the way round the player and overhead, never below. A ring marks the centre of the screen. A game is 3 rounds, and in each round thinking and moving happen together rather than in separate steps:

1. **Find.** A random prompt ("Find the object that melts in the sun") appears and the player can drag the sky straight away. Exactly one constellation answers the prompt. The outlines carry no name labels, in the page or the markup: recognising them is part of the task.
2. **Hold.** Holding the ring on a constellation fills it. A full ring on a wrong constellation flashes red and dims that constellation; there is no explicit penalty, because the time the hold took is the penalty. A full ring on the right one fades the object in at the centre of the screen, turned away from its constellation.
3. **Lock.** The player rotates the object with the dial. The round locks the instant position and rotation are both within a tight tolerance.

The score is the total time. Rules that keep it fair:

- Prompts, objects, positions and rotations are randomised per player, but the **amount** of work is fixed: every round the answer is the same angular distance from where the player is looking, and every player gets the same set of rotation amounts in a random order and direction.
- Objects that are arguable for a prompt (`maybe` in `PROMPTS`) are never in the sky with it.
- The field of view is fixed along the screen's longer side, so phones and desktops see the same amount of sky.

## Stack and layout

- Vite + plain JavaScript (ES modules) + three.js. No framework, no TypeScript.
- `index.html` contains the markup, styles and overlays (the HUD, the prompt, the ring, the rotation dial, the Start page and the DONE screen).
- `main.js` contains all game logic: tunables at the top, then objects and prompts, the scene (stars, Earth, constellations), game state, rounds, controls, the lock check, and the game loop.
- `vite.config.js` sets `base: "./"` so the build works from any host or sub-path.

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

Match the existing code: no semicolons, single quotes in JS, two-space indent, and plain DOM APIs. Comments explain the *why* behind game and anti-bot decisions. Keep tunable numbers as named constants in the `Tunables` block at the top of `main.js`.
