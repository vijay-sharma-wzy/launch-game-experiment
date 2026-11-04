# CLAUDE.md

## Working on this repo

- **This file is live.** Whenever the purpose, scope, game design, layout, commands or deployment change, update this file in the same piece of work. If something here no longer matches the repo, fix it rather than working around it.
- **Test and build after every change.** Whenever you change the code, run `npm run build` to rebuild `dist/` without being asked, and fix any errors before reporting back. There is no automated test suite, so the test is a successful build plus a check that `npm run preview` serves the page. Say in your reply that the build passed, or show what failed. Motion and camera can't be tested off a phone, so say so when a change depends on them.
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
- **Mobile first.** The game is played on a phone, using its motion sensors and camera.

## Out of scope

This repo is only about what **the game itself** can do to filter bots and rank users. The following are reserved for the real AWS infra work and must not be added here:

- Cloudflare (Turnstile, WAF, bot management)
- Accounts, logins, credit card or identity verification
- ML models that detect humans from gyroscope or other sensor data
- Real databases, API Gateway, Lambda or any other AWS service

## Simulating the AWS infra

Logic that will later run on the server (issuing sessions, timing rounds on the server's clock, validating and storing scores) should live in clearly separated client-side code that mimics a server, so it can be lifted into Lambda later. Do not trust or depend on it as real security; it is a stand-in.

Current state: no server simulation exists yet. The score is just the local time from the first round to the last (`finish()` in `main.js`).

## Stack and layout

- Vite + plain JavaScript (ES modules) + three.js. No framework, no TypeScript.
- `index.html` contains the markup, styles and overlays (the Start page, then the HUD, then the DONE screen).
- `main.js` contains all game logic: tunables at the top, then shapes, scene, rounds, phone orientation mapped to the camera, the overlap check, and the game loop.
- `vite.config.js` sets `base: "./"` so the build works from any host or sub-path.

## Commands

Requires Node.js (installed with Homebrew: `brew install node`). Run `npm install` once to fetch dependencies.

- `npm run dev` starts the dev server.
- `npm run build` builds into `dist/`.
- `npm run preview` serves the built `dist/` locally.

## Testing on a phone

Motion sensors and the camera only work in a secure context (HTTPS or localhost). A LAN address served by `vite --host` is plain HTTP, so sensors won't work there. Test on a phone through a Netlify branch deploy instead.

On iOS, motion permission must be requested from inside a tap handler. That's why the Start button exists.

## Deployment

Netlify, configured in `netlify.toml`. Each branch deploys to its own URL:

| Branch | URL |
|---|---|
| `main` (production) | `https://launch-game-experiment.netlify.app` |
| `keanen-dev` | `https://keanen-dev--launch-game-experiment.netlify.app` |
| `evan-dev` | `https://evan-dev--launch-game-experiment.netlify.app` |

## Code style

Match the existing code: no semicolons, single quotes in JS, two-space indent, and plain DOM APIs. Comments explain the *why* behind game and anti-bot decisions. Keep tunable numbers as named constants in the `Tunables` block at the top of `main.js`.
