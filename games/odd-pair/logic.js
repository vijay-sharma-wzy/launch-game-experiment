// SERVER ONLY (simulated). Odd Pair: scroll a row of pairs that belong together, find
// the one pair that doesn't, and pull it apart. Design and spec scores: DESIGN.md.
import { emoji } from '../../shared/server/sprites.js'
import { palette } from '../../shared/server/palette.js'
import { createDrift, createHold } from '../../shared/server/steer.js'
import { pick, shuffle, sign } from '../../shared/server/random.js'

// ---- Tunables ----------------------------------------------------------------
export const ROUNDS = 3
export const STEPS = 3
export const PENALTY = 8      // seconds per wrong pair: more than a step takes, so guessing never pays
const PAIRS = [7, 8, 9]       // pairs in the row, by round: later rounds have more to check
const AWAY = [2, 3, 4]        // how many pairs the odd one starts from the middle of the screen, one per step in a random order (equal work)
const GAP = 0.2               // distance between pairs (screen units; the screen is 1 tall)
const TOP = -0.06             // height of each pair's upper thing
const BOTTOM = 0.12           // and its lower thing
const ICON = 0.095            // height of a thing
const TOUCH = 0.055           // how close a press must be to a thing to take hold of it
const LOCK = 0.012            // how far a drag goes before it's read as a pull (up or down) or a scroll (sideways)
const PULL = 0.11             // how far a thing must be pulled from its partner for the link to start giving
const HOLD_SECONDS = 1.1
const STRAIGHT = 0.035        // how far to one side of its partner the pulled thing may be: the pull has to follow the pair as it sways
const SWAY = { reach: 0.045, speed: 0.035 } // how the pair sways while it's being pulled; the probe is a change in that sway
const END_GIVE = 0.4          // scrolling past either end moves the row this much as far: a soft limit, not a hard stop
const WANDER = { reach: 0.01, speed: 0.012 } // pairs are never quite still

// ---- Pairs -------------------------------------------------------------------
// Each theme is a kind of belonging, with pairs that clearly belong and `wrong`
// pairs that clearly don't. A wrong pair is never one a person could argue for
// (no "umbrella and sun"), and the row never holds a second copy of either thing.
const THEMES = [
  {
    prompt: 'Animals and what they eat: pull apart the pair that’s wrong',
    pairs: [['🐒', '🍌'], ['🐇', '🥕'], ['🐁', '🧀'], ['🐕', '🦴'], ['🐝', '🌼'], ['🐼', '🎋'], ['🐿️', '🌰'], ['🐈', '🐟'], ['🐄', '🌿'], ['🐦', '🐛'], ['🐻', '🍯'], ['🐘', '🥜'], ['🐔', '🌽']],
    wrong: [['🐝', '🦴'], ['🐇', '🐟'], ['🐄', '🦴'], ['🐼', '🐟'], ['🐿️', '🦴'], ['🐘', '🐟'], ['🐔', '🦴'], ['🐇', '🦴']],
  },
  {
    prompt: 'Things that work together: pull apart the pair that’s wrong',
    pairs: [['🔑', '🔒'], ['✂️', '📄'], ['✏️', '📓'], ['🖌️', '🎨'], ['🏹', '🎯'], ['⚽', '🥅'], ['🎣', '🐟'], ['🔦', '🔋'], ['✉️', '📮'], ['☂️', '🌧️'], ['🕶️', '☀️'], ['🥄', '🍲'], ['🔧', '🔩'], ['🔭', '⭐'], ['🚂', '🛤️'], ['🚗', '⛽']],
    wrong: [['🔑', '🍲'], ['🏹', '🔒'], ['⚽', '🔩'], ['🔧', '🍲'], ['✉️', '🥅'], ['🥄', '🎯'], ['🔭', '🥅'], ['☂️', '🔩'], ['🕶️', '🔒'], ['🚂', '🎯']],
  },
  {
    prompt: 'What things make or become: pull apart the pair that’s wrong',
    pairs: [['🐄', '🥛'], ['🐔', '🥚'], ['🐝', '🍯'], ['🐑', '🧶'], ['🌾', '🍞'], ['🍇', '🍷'], ['🥔', '🍟'], ['🌽', '🍿'], ['🐛', '🦋'], ['🌱', '🌳'], ['🍎', '🥧'], ['🐟', '🍣'], ['❄️', '⛄'], ['☁️', '🌧️']],
    wrong: [['🐑', '🥚'], ['🐔', '🧶'], ['🐄', '🍯'], ['🐝', '🥛'], ['🐛', '🍞'], ['❄️', '🍯'], ['🐟', '🧶'], ['🌱', '🥚'], ['☁️', '🥚'], ['🍎', '🧶']],
  },
]

export default function createLogic(api) {
  const colors = palette()
  const linkColor = colors.ink()
  const ringColor = colors.ink(120)
  let themes = []
  let away = []
  let prompt = ''
  let pairs = []        // { things: [upper sprite, lower sprite], x, drift, tried, apart }
  let odd = 0           // index of the pair that doesn't belong
  let scroll = 0        // where along the row the middle of the screen is
  let drag = null       // { mode: 'undecided' | 'scroll' | 'pull', from, pair, which }
  let pull = [0, 0]     // how far the held thing has been pulled from its place
  let sway = createDrift(SWAY) // how far the pulled pair has swayed sideways since it was taken hold of
  let wrongs = 0
  const hold = createHold(api, { seconds: HOLD_SECONDS, probe: () => sway.probe() })

  const centre = (pair) => pair.x - scroll + pair.drift.x
  const spot = (pair, which) => [centre(pair), (which ? BOTTOM : TOP) + pair.drift.y]

  function begin({ round, step }) {
    if (step === 0) {
      themes = shuffle(THEMES)
      away = shuffle(AWAY)
    }
    const theme = themes[step]
    const count = PAIRS[round - 1]
    const mismatch = pick(theme.wrong)
    const fine = shuffle(theme.pairs.filter((p) => !p.some((thing) => mismatch.includes(thing)))).slice(0, count - 1)
    // Put the odd pair where the row can start the set distance from it, either side.
    const side = sign()
    odd = Math.floor(Math.random() * (count - away[step])) + (side > 0 ? away[step] : 0)
    fine.splice(odd, 0, mismatch)
    pairs = fine.map((things, i) => ({ things: things.map((thing) => api.sprite(emoji(thing))), x: i * GAP, drift: createDrift(WANDER), tried: false, apart: 0 }))
    scroll = (odd - side * away[step]) * GAP
    drag = null
    pull = [0, 0]
    hold.reset()
    prompt = theme.prompt
  }

  function release() {
    drag = null
    hold.reset()
  }

  function input(e) {
    if (e.kind === 'down') {
      // A press on a thing may become a pull; anywhere else it can only scroll.
      let held = null
      for (const pair of pairs) for (const which of [0, 1]) if (!pair.tried && Math.hypot(e.x - spot(pair, which)[0], e.y - spot(pair, which)[1]) < TOUCH) held = { pair, which }
      drag = { mode: 'undecided', from: [e.x, e.y], last: e.x, ...held }
      sway = createDrift(SWAY)
    }
    if (e.kind === 'up') release()
    if (e.kind !== 'move' || !drag) return
    const [dx, dy] = [e.x - drag.from[0], e.y - drag.from[1]]
    // One gesture, one job: the first movement decides whether this drag scrolls the
    // row (sideways) or pulls a thing (up or down), and it stays that way.
    if (drag.mode === 'undecided' && Math.hypot(dx, dy) > LOCK) drag.mode = drag.pair && Math.abs(dy) > Math.abs(dx) ? 'pull' : 'scroll'
    if (drag.mode === 'scroll') {
      const beyond = scroll < 0 || scroll > (pairs.length - 1) * GAP
      scroll -= (e.x - drag.last) * (beyond ? END_GIVE : 1)
    }
    if (drag.mode === 'pull') pull = [dx, dy]
    drag.last = e.x
  }

  function step(dt) {
    for (const pair of pairs) {
      pair.drift.step(dt)
      if (pair.apart) pair.apart = Math.min(1, pair.apart + dt * 3)
    }
    if (drag?.mode === 'pull') sway.step(dt)
    if (drag?.mode !== 'pull') pull = [pull[0] * (1 - Math.min(1, dt * 12)), pull[1] * (1 - Math.min(1, dt * 12))] // let go: it springs back
    if (drag?.mode !== 'scroll') scroll += (Math.max(0, Math.min((pairs.length - 1) * GAP, scroll)) - scroll) * Math.min(1, dt * 6)
    api.view(scroll)

    // The held thing is where the pointer put it; its partner has swayed off to one
    // side. The link gives only while it's stretched far enough and still straight.
    const slant = pull[0] - sway.x
    const stretch = Math.hypot(slant, pull[1])
    if (drag?.mode === 'pull' && !api.busy && hold.step(dt, stretch >= PULL && Math.abs(slant) < STRAIGHT, Math.abs(slant) + Math.max(0, PULL - stretch))) {
      // The link gives. Only now does the player find out whether the pair was the odd one.
      api.commit(drag.pair.things[0].id, drag.pair === pairs[odd])
      if (drag.pair === pairs[odd]) {
        drag.pair.apart = 0.01
        api.next()
      } else {
        drag.pair.tried = true
        wrongs++
      }
      pull = [0, 0]
      release()
    }

    const draw = []
    for (const pair of pairs) {
      if (Math.abs(centre(pair)) > api.width / 2 + ICON) continue
      const held = drag?.mode === 'pull' && drag.pair === pair ? drag.which : null
      const places = [0, 1].map((which) => {
        const [x, y] = spot(pair, which)
        const fly = pair.apart * 0.08 * (which ? 1 : -1) // a pair pulled apart drifts apart
        if (held === which) return [x + pull[0], y + pull[1]]
        if (held !== null) return [x + sway.x, y]
        return [x, y + fly]
      })
      const strain = held === null ? 0 : Math.min(1, Math.max(0, stretch) / PULL)
      // The link thins as it's stretched: gradual feedback, with no single "far enough" switch.
      if (!pair.apart) draw.push({ k: 'path', pts: places, color: linkColor, width: 6 - 4 * strain, alpha: pair.tried ? 0.25 : 0.7 })
      places.forEach((at, which) => draw.push({ k: 'sprite', id: pair.things[which].id, at, h: ICON, alpha: pair.tried ? 0.4 : 1 }))
      // A pair already tried is dimmed and tied with a bar, so it isn't marked by brightness alone.
      if (pair.tried) draw.push({ k: 'path', pts: [[centre(pair) - 0.03, (TOP + BOTTOM) / 2 + pair.drift.y], [centre(pair) + 0.03, (TOP + BOTTOM) / 2 + pair.drift.y]], color: ringColor, width: 5 })
      if (held !== null) draw.push({ k: 'ring', at: [(places[0][0] + places[1][0]) / 2, (places[0][1] + places[1][1]) / 2], r: 0.022, value: hold.value, color: ringColor, from: 1 })
    }
    return { bg: colors.bg, draw, prompt }
  }

  function hint(_, wrongFirst) {
    const goal = pairs[wrongFirst && !wrongs ? (odd > 0 ? odd - 1 : odd + 1) : odd]
    const { x, y, down } = api.pointer
    const off = centre(goal)
    if (drag?.mode === 'pull') return { x: drag.from[0] + sway.x, y: spot(goal, 1)[1] + PULL + 0.05, down: true }
    if (Math.abs(off) > 0.03) {
      // Scroll the row: press on empty space below the things and drag sideways.
      if (!down) return { x: Math.sign(off) * 0.15, y: 0.34, down: true }
      if (drag?.mode === 'undecided' && drag.pair) return { x, y, down: false }
      if (Math.abs(x) > 0.2 && Math.sign(x) !== Math.sign(off)) return { x, y, down: false } // run out of screen: lift and take a fresh grip
      return { x: x - Math.max(-0.05, Math.min(0.05, off)), y: 0.34, down: true }
    }
    if (down && drag?.mode !== 'undecided') return { x, y, down: false }
    if (!down) return { x: spot(goal, 1)[0], y: spot(goal, 1)[1], down: true }
    return { x: spot(goal, 1)[0], y: spot(goal, 1)[1] + PULL + 0.05, down: true }
  }

  return { begin, input, step, hint }
}
