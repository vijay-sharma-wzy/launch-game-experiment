// SERVER ONLY (simulated). Trail Forks: lead a dot along a trail that splits, to the
// one animal that answers the prompt. Design and spec scores: DESIGN.md.
import { emoji } from '../../shared/server/sprites.js'
import { palette } from '../../shared/server/palette.js'
import { between, pick, shuffle, sign } from '../../shared/server/random.js'

// ---- Tunables ----------------------------------------------------------------
export const ROUNDS = 3
export const STEPS = 3
export const PENALTY = 8      // seconds per wrong animal: more than a step takes, so guessing never pays
const CHOICES = [3, 4, 5]     // animals to choose between, by round: later rounds have more to read
const START = [0, 0.43]       // where the dot starts (screen units; the screen is 1 tall, y down)
const FORK = [0, 0.13]        // where the trail splits. The shared stretch below it lets a player set off while still reading
const FAN = Math.PI / 2       // the branches fan out up to this far either side of straight up
const EDGE = 0.11             // gap between the outermost animal's branch end and the side of the play area
const ICON = 0.075            // height of an animal
const BEND = 0.022            // how far the trail bends from a straight line. Every branch is the same length with the same bends (equal work)
const GRAB = 0.075            // how close the pointer must stay to the dot to pull it
const REACH = 0.1             // how far along the trail the dot can be pulled in one frame; stops it being flung to the end
const SETTLED = 0.5           // up to this far along a branch the dot still moves to whichever branch the pointer is nearest; after it, the choice is made
const SWAY = 0.5              // how far the bends shift as the trail sways (radians of phase)
const KICK = [0.6, 0.9]       // the probe: the shared stretch's bends shift by this much more while the dot is on it
const BACK_SPEED = 2.5        // how fast the dot slides back to the fork after a wrong animal (branch lengths a second)

// ---- Animals and prompts -----------------------------------------------------
// "Lead the dot to the animal that ...". `yes` animals answer the prompt. `maybe`
// animals are arguable, so they never appear with it. Every other animal is a clear no.
const ANIMALS = ['🐘', '🐧', '🦒', '🐝', '🐢', '🦉', '🐟', '🐸', '🦋', '🐍', '🐎', '🐄', '🐑', '🐓', '🦇', '🕷️', '🐪', '🦘', '🐬', '🦅', '🐌', '🐜', '🦀', '🐙']
const PROMPTS = [
  { text: 'has a trunk', yes: ['🐘'] },
  { text: 'carries its home on its back', yes: ['🐌', '🐢'], maybe: ['🦀'] },
  { text: 'is a bird but cannot fly', yes: ['🐧'], maybe: ['🐓'] },
  { text: 'makes honey', yes: ['🐝'] },
  { text: 'has the longest neck', yes: ['🦒'] },
  { text: 'hoots at night', yes: ['🦉'] },
  { text: 'sleeps hanging upside down', yes: ['🦇'] },
  { text: 'spins a web', yes: ['🕷️'] },
  { text: 'has a hump', yes: ['🐪'] },
  { text: 'carries its baby in a pouch', yes: ['🦘'] },
  { text: 'has eight arms', yes: ['🐙'], maybe: ['🕷️'] },
  { text: 'walks sideways', yes: ['🦀'] },
  { text: 'slithers and has no legs', yes: ['🐍'], maybe: ['🐌'] },
  { text: 'gives us wool', yes: ['🐑'], maybe: ['🐪'] },
  { text: 'is kept for its milk', yes: ['🐄'], maybe: ['🐑', '🐪', '🐎'] },
  { text: 'was once a caterpillar', yes: ['🦋'] },
  { text: 'was once a tadpole', yes: ['🐸'] },
  { text: 'is a mammal that lives in the sea', yes: ['🐬'] },
  { text: 'people ride', yes: ['🐎'], maybe: ['🐪', '🐘', '🐄'] },
  { text: 'lives in a nest underground with thousands of others', yes: ['🐜'], maybe: ['🐝'] },
  { text: 'crows at sunrise', yes: ['🐓'] },
]

const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

export default function createLogic(api) {
  const colors = palette()
  const trailColor = colors.ink()
  const dotColor = colors.ink(120)
  const deck = shuffle(PROMPTS)
  let time = 0
  let prompt = ''
  let trunk = null    // the shared stretch: { from, end, waves, phase, rate, kick, kickTo }
  let branches = []   // one per animal: the same, plus { sprite, closed }
  let answer = 0      // index of the branch that leads to the answer
  let dot = { on: null, u: 0 } // which stretch the dot is on, and how far along it (0..1)
  let grabbed = false
  let sliding = false // sliding back to the fork after a wrong animal
  let probeAt = null  // how far along the shared stretch the probe fires
  let wrongs = 0

  // A point on a stretch of trail: a straight line bent sideways by a wave that is
  // pinned at both ends and shifts over time, so the trail is never still.
  function point(s, u) {
    const [x, y] = lerp(s.from, s.end, u)
    const length = distance(s.from, s.end)
    const bend = BEND * Math.sin(Math.PI * u) ** 2 * Math.sin(s.waves * Math.PI * u + s.phase + SWAY * Math.sin(time * s.rate) + s.kick)
    return [x - ((s.end[1] - s.from[1]) / length) * bend, y + ((s.end[0] - s.from[0]) / length) * bend]
  }
  const stretch = (from, end, waves) => ({ from, end, waves, phase: pick([0, Math.PI]), rate: between(0.7, 1.3), kick: 0, kickTo: 0 })
  const here = () => point(dot.on, dot.u)

  function begin({ round }) {
    const { text, yes, maybe = [] } = deck.shift()
    const count = CHOICES[round - 1]
    const right = pick(yes)
    const others = shuffle(ANIMALS.filter((a) => !yes.includes(a) && !maybe.includes(a))).slice(0, count - 1)
    const animals = shuffle([right, ...others])
    answer = animals.indexOf(right)
    prompt = `Lead the dot to the animal that ${text}`

    // The animals sit on an arc around the fork, so every branch is the same length.
    const radius = api.width / 2 - EDGE
    const waves = pick([1, 1.5, 2])
    trunk = stretch(START, FORK, 2)
    branches = animals.map((animal, i) => {
      const angle = -FAN + (2 * FAN * i) / (count - 1)
      return { ...stretch(FORK, [FORK[0] + radius * Math.sin(angle), FORK[1] - radius * Math.cos(angle)], waves), sprite: api.sprite(emoji(animal)), closed: false }
    })
    dot = { on: trunk, u: 0 }
    grabbed = false
    sliding = false
    probeAt = between(0.3, 0.65)
  }

  function input(e) {
    if (e.kind === 'down' && !sliding) grabbed = distance([e.x, e.y], here()) < GRAB
    if (e.kind === 'up') grabbed = false
  }

  // Pull the dot along the trail toward the pointer, as far as REACH allows. Near the
  // fork the branches run close together, so the dot goes with whichever open branch
  // the pointer is following; once it is well along one, it stays on it.
  function follow() {
    const p = [api.pointer.x, api.pointer.y]
    const open = branches.filter((b) => !b.closed)
    const choosing = dot.on === trunk ? dot.u > 0.85 : dot.u < SETTLED // from just below the fork
    const spots = []
    const along = (s, from, to) => {
      const span = REACH / distance(s.from, s.end)
      for (let i = 0; i <= 12; i++) {
        const u = Math.max(0, Math.min(1, from - span + ((to - from + 2 * span) * i) / 12))
        spots.push({ on: s, u })
      }
    }
    if (dot.on === trunk) along(trunk, dot.u, dot.u)
    else if (!choosing) along(dot.on, dot.u, dot.u)
    if (choosing) {
      const u = dot.on === trunk ? 0 : dot.u
      for (const b of open) along(b, u, u)
      if (dot.on !== trunk && u < 0.2) spots.push({ on: trunk, u: 1 }) // backing down to the fork
    }
    const nearest = spots.reduce((best, spot) => (distance(p, point(spot.on, spot.u)) < distance(p, point(best.on, best.u)) ? spot : best))
    if (distance(p, point(nearest.on, nearest.u)) < GRAB) dot = nearest
    api.steer(distance(p, here()))

    if (dot.on === trunk) {
      api.progress(dot.u / 2)
      if (probeAt !== null && dot.u >= probeAt) {
        probeAt = null
        trunk.kickTo = sign() * between(...KICK)
        api.probe('nudge', Math.abs(trunk.kickTo))
      }
      return
    }
    api.progress(0.5 + dot.u / 2)
    if (dot.u < 0.995) return
    // Arrived. Only now does the player find out whether it was the right animal.
    const right = dot.on === branches[answer]
    api.commit(dot.on.sprite.id, right)
    grabbed = false
    if (right) return api.next()
    dot.on.closed = true
    sliding = true
    wrongs++
  }

  function step(dt) {
    time += dt
    if (!trunk) return {}
    trunk.kick += (trunk.kickTo - trunk.kick) * Math.min(1, dt * 6)
    if (sliding) {
      dot.u -= dt * BACK_SPEED
      if (dot.u <= 0) {
        dot = { on: trunk, u: 1 }
        sliding = false
      }
    } else if (grabbed && !api.busy) follow()

    const line = (s) => Array.from({ length: 25 }, (_, i) => point(s, i / 24))
    const draw = [{ k: 'path', pts: line(trunk), color: trailColor, width: 9, alpha: 0.5 }]
    for (const b of branches) {
      draw.push({ k: 'path', pts: line(b), color: trailColor, width: 9, alpha: b.closed ? 0.15 : 0.5 })
      const out = ICON * 0.75 / distance(FORK, b.end)
      const [x, y] = lerp(FORK, b.end, 1 + out)
      draw.push({ k: 'sprite', id: b.sprite.id, at: [x, y], h: ICON, alpha: b.closed ? 0.35 : 1 })
      // A closed branch is dimmed and crossed out, so it isn't marked by brightness alone.
      if (b.closed) draw.push({ k: 'path', pts: [[x - 0.03, y - 0.03], [x + 0.03, y + 0.03]], color: dotColor, width: 4 }, { k: 'path', pts: [[x + 0.03, y - 0.03], [x - 0.03, y + 0.03]], color: dotColor, width: 4 })
    }
    const at = here()
    const p = [api.pointer.x, api.pointer.y]
    // The dot only follows while the pointer stays close. Pull too far ahead and a
    // thin tether shows the dot has been left behind.
    if (grabbed && distance(p, at) > GRAB * 0.5) draw.push({ k: 'path', pts: [at, p], color: dotColor, width: 2, alpha: 0.5 })
    if (!grabbed && !sliding) draw.push({ k: 'circle', at, r: 0.034 + 0.006 * Math.sin(time * 4), color: dotColor, alpha: 0.6 })
    draw.push({ k: 'circle', at, r: 0.022, color: dotColor, fill: true })
    return { bg: colors.bg, draw, prompt }
  }

  function hint(_, wrongFirst) {
    const goal = branches[wrongFirst && !wrongs ? (answer + 1) % branches.length : answer]
    if (sliding || (api.pointer.down && !grabbed)) return { x: api.pointer.x, y: api.pointer.y, down: false }
    if (!grabbed) return { x: here()[0], y: here()[1], down: true }
    const ahead = dot.on === trunk ? (dot.u < 0.8 ? point(trunk, dot.u + 0.2) : point(goal, 0.3)) : point(goal, Math.min(1, dot.u + 0.2))
    return { x: ahead[0], y: ahead[1], down: true }
  }

  return { begin, input, step, hint }
}
