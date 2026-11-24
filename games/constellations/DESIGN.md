# Constellations (game 1)

The first game, built before the framework in `docs/game-generator-spec-v2.md`. It is a three.js page with its rules in `main.js` on the client: it predates the simulated server in `shared/server/`, so it does not meet the spec's server-authoritative or telemetry requirements, and its rounds have one semantic decision each (spec P2 asks for three).

## How it plays

The player floats in space with Earth directly below. Constellations (outlines of objects) are scattered all the way round the player and overhead, never below, and each one slowly spins in place. The player drags the sky freely anywhere in the dome, up to straight overhead. A ring marks the centre of the screen. A game is 3 rounds, and in each round thinking and moving happen together rather than in separate steps:

1. **Find.** A random prompt ("Find the object that melts in the sun") appears and the player can drag the sky straight away. Exactly one constellation answers the prompt. The outlines carry no name labels, in the page or the markup: recognising them is part of the task.
2. **Hold.** Holding the ring on a constellation fills it. A full ring on a wrong constellation flashes red, dims that constellation and adds a 5-second penalty to the score, shown as "+5s" beside the timer (which always includes penalties). The DONE screen says how much of the score was penalties. A full ring on the right one fades the object in at the centre of the screen, turned away from its constellation.
3. **Lock.** The player rotates the object with the dial to match the constellation, which keeps spinning. A small dot on the object's centre and a bigger one on the constellation's (shown only once it's found) guide the position. While position and rotation are both within a tight tolerance the ring fills and a soft glow eases in; when either slips it pauses, but never drains, so matched time adds up. There is deliberately no colour switch for "fitted", which a bot could read from one pixel. A full ring locks the round. The hold means the player has to track the spin with the dial: waiting for the constellation to come round to the object only adds a moment per turn.

The score is the total time. Rules that keep it fair:

- Prompts, objects, positions and rotations are randomised per player, but the **amount** of work is fixed: every round the answer is the same angular distance from where the player is looking, and every player gets the same set of rotation amounts in a random order and direction. Constellations spin at different speeds, half clockwise and half anticlockwise. The answer's speed comes from a fixed set (one per round, shuffled per player), and it always spins away from the match, so the spin never shortens one player's rotation and lengthens another's.
- Objects that are arguable for a prompt (`maybe` in `PROMPTS`) are never in the sky with it.
- The field of view is fixed along the screen's longer side, so phones and desktops see the same amount of sky.

Visual noise makes a screen-reading bot's job harder without changing what a human sees: every outline is drawn in slightly varying blues whose brightness and thickness waver over time, corners wobble by a pixel or two, each line between a constellation's stars fades out and back on its own timing (so a few are always missing, never the same ones for long), every star twinkles and, on its own timing, flares up, dims out completely and comes back, growing as it brightens and shrinking to nothing as it dims, and a nebula and Milky Way band in similar blues sit behind everything, drifting round the sky in two opposing layers with waves of brightness rolling through them, so the background is never still. Dark dust wisps drift just in front of the constellations, dimming patches of their lines by up to 75% (never fully) as they pass, so an angle measured from the screen keeps shifting; the held object and centre dots are drawn above them.

## Tried and removed

- A one-frame "teleport" of the answer's angle while fitting, meant to throw off a bot copying the angle from the screen. Even at 3.5–5° for a single frame it was too noticeable to players.
- Slowly stretching ("breathing") outlines. Removed by request.
