// SERVER ONLY (simulated). Orbit Sort: drag orbiting objects into the basket whose
// meaning fits; the rule changes mid-round. Design spec: DESIGN.md in this folder.
import { OUTLINES, normalised } from '../../shared/objects.js'
import { CATEGORIES, clearlyNot } from '../../shared/server/semantics.js'
import { between, pick, shuffle, sign, randomTimer } from '../../shared/server/random.js'
import { palette } from '../../shared/server/palette.js'

// ---- Tunables ----------------------------------------------------------------
export const ROUNDS = 3
export const PENALTY = 15           // seconds per wrong drop: more than a round takes a person (spec R3)
const RULES = ['wear', 'eat', 'alive', 'fly', 'kitchen', 'travel', 'drink'] // categories with enough clear members
const SORTS_PER_RULE = 2            // the rule changes after this many sorts...
const RULES_PER_ROUND = 2           // ...this many times a round, so later choices can't be planned (P2)
const IN_ORBIT = 5                  // objects circling at any time
const ORBITS = [0.2, 0.33]          // ring radii
const ORBIT_SPEED = 0.25            // radians per second, on its own
const SPIN_DECAY = 1.5              // how fast a flick of the ring slows down (unstated: drag empty space to spin it)
const ITEM_SIZE = 0.055
const GRAB_RADIUS = 0.075
const BASKET_RADIUS = 0.13
const ACCEPT_SECONDS = 0.9          // an object must stay inside a basket this long to be dropped (unstated: the ring shows it filling)
const CARRY_FOLLOW = 20             // how closely a carried object follows the pointer; probes briefly loosen it
const PROBE_GAP = [0.8, 1.6]        // seconds between probes while carrying (P4)
const NUDGE = 0.05

const SHAPES = Object.fromEntries(Object.keys(OUTLINES).map((name) => [name, normalised(OUTLINES[name])]))

export default function createLogic(api) {
  const look = palette()
  const direction = sign()
  let rule
  let yesSide = 1
  let items = []
  let held = null
  let fill = 0
  let sorts = 0
  let rulesUsed = []
  let angle = 0
  let spin = 0
  let spinning = null
  let time = 0
  let wander = 0
  let wanderSpeed = 1
  let wanderDir = 1
  let carryLoose = 0
  let ruleChangedAt = -Infinity
  let nextId = 1
  let roundPause = 0
  const baskets = [-1, 1].map((side) => ({ side, push: [0, 0], offset: [0, 0], color: look.ink() }))
  const ringColor = look.ink()
  const probeTimer = randomTimer(PROBE_GAP, probe)

  const belongs = (name) => CATEGORIES[rule].yes.includes(name)
  const allowed = () => [...CATEGORIES[rule].yes, ...clearlyNot(CATEGORIES[rule])]

  // Where things go on this screen. On a wide screen the baskets sit either side of the
  // orbit; on a tall phone screen they sit below it and the orbit shrinks to fit.
  function layout() {
    const narrow = api.aspect < 1
    const scale = narrow ? Math.min(1, (api.aspect / 2 - 0.06) / ORBITS[1]) : 1
    return {
      centre: narrow ? [0, -0.08] : [0, 0],
      orbits: ORBITS.map((r) => r * scale),
      basket: narrow ? Math.min(BASKET_RADIUS, api.aspect / 4 - 0.02) : BASKET_RADIUS,
      home: (side) => (narrow ? [side * (api.aspect / 4), 0.32] : [side * (api.aspect / 2 - 0.2), 0]),
      sway: narrow ? 0.04 : 0.18,
      item: narrow ? 0.7 : 1, // objects shrink with the orbit so neighbours never overlap
    }
  }

  function basketAt(b) {
    const { home, sway } = layout()
    const [hx, hy] = home(b.side)
    const x = hx + 0.25 * sway * Math.sin(wander * 0.9 + b.side)
    const y = hy + sway * Math.sin(wander + b.side * 1.7)
    return [x + b.offset[0], y + b.offset[1]]
  }

  function itemAt(item) {
    const { centre, orbits } = layout()
    const a = angle + item.phase
    return [centre[0] + orbits[item.ring] * Math.cos(a), centre[1] + orbits[item.ring] * Math.sin(a)]
  }

  // Top the orbit up to IN_ORBIT objects that are clearly in or clearly out of the
  // current rule, keeping both kinds present.
  function refill() {
    const showing = items.map((i) => i.name)
    while (items.length < IN_ORBIT) {
      const yes = items.filter((i) => belongs(i.name)).length
      const pool = (yes < 2 ? CATEGORIES[rule].yes : yes > 3 ? clearlyNot(CATEGORIES[rule]) : allowed()).filter((n) => !showing.includes(n))
      const name = pick(pool)
      showing.push(name)
      const taken = items.map((i) => i.phase)
      let phase = between(0, 2 * Math.PI)
      for (let tries = 0; tries < 30 && taken.some((p) => Math.abs(Math.atan2(Math.sin(p - phase), Math.cos(p - phase))) < 0.9); tries++) phase = between(0, 2 * Math.PI)
      items.push({ id: nextId++, name, ring: items.length % 2, phase, color: look.ink(), rot: between(-0.6, 0.6) })
    }
  }

  function newRule() {
    rule = pick(RULES.filter((r) => !rulesUsed.includes(r)))
    rulesUsed.push(rule)
    yesSide = sign()
    ruleChangedAt = time
    // Objects that are arguable under the new rule leave the orbit (spec §1, Fairness).
    items = items.filter((i) => i === held || allowed().includes(i.name))
    if (held && !allowed().includes(held.name)) { held = null; fill = 0 }
    refill()
    api.openDecision(`${api.round}:${sorts}`)
  }

  function startRound() {
    api.startRound()
    sorts = 0
    items = []
    held = null
    newRule()
  }

  function probe() {
    const kind = pick(['nudge', 'speed', 'reverse', 'carry'])
    if (kind === 'nudge') {
      const b = pick(baskets)
      const a = between(0, 2 * Math.PI)
      b.push = [Math.cos(a) * NUDGE, Math.sin(a) * NUDGE]
      api.probe('nudge', NUDGE)
    } else if (kind === 'speed') {
      wanderSpeed = pick([0.4, 2.2])
      api.probe('speed', wanderSpeed)
    } else if (kind === 'reverse') {
      wanderDir *= -1
      api.probe('reverse', 1)
    } else {
      carryLoose = 0.8
      api.probe('carry', 3)
    }
  }

  function drop(basket) {
    const correct = belongs(held.name) === (basket.side === yesSide)
    api.commit(held.id, correct)
    fill = 0
    if (!correct) {
      held = null // it flies back into orbit
      return
    }
    api.closeDecision(`${api.round}:${sorts}`)
    items = items.filter((i) => i !== held)
    held = null
    sorts++
    api.progress(sorts / (SORTS_PER_RULE * RULES_PER_ROUND))
    if (sorts === SORTS_PER_RULE * RULES_PER_ROUND) {
      api.endRound()
      if (api.round === ROUNDS) return api.finish()
      roundPause = 0.9
      return
    }
    if (sorts % SORTS_PER_RULE === 0) newRule()
    else {
      refill()
      api.openDecision(`${api.round}:${sorts}`)
    }
  }

  return {
    start() {
      startRound()
    },

    input(e) {
      if (e.kind === 'down') {
        const grab = items.find((i) => Math.hypot(itemAt(i)[0] - e.x, itemAt(i)[1] - e.y) < GRAB_RADIUS * layout().item)
        if (grab) {
          held = grab
          held.at = itemAt(grab)
          fill = 0
        } else {
          const [cx, cy] = layout().centre
          spinning = Math.atan2(e.y - cy, e.x - cx)
        }
      } else if (e.kind === 'move' && spinning !== null) {
        const [cx, cy] = layout().centre
        const a = Math.atan2(e.y - cy, e.x - cx)
        const turn = Math.atan2(Math.sin(a - spinning), Math.cos(a - spinning))
        angle += turn
        spin = spin * 0.6 + turn * 60 * 0.4
        spinning = a
      } else if (e.kind === 'up') {
        held = null // let go early: it drifts back into orbit, no penalty
        fill = 0
        spinning = null
      }
    },

    step(dt) {
      time += dt
      carryLoose = Math.max(0, carryLoose - dt)
      wander += dt * wanderSpeed * wanderDir
      wanderSpeed += (1 - wanderSpeed) * Math.min(1, dt * 0.8)
      if (roundPause > 0) {
        roundPause -= dt
        if (roundPause <= 0) startRound()
      }
      if (spinning === null) spin *= Math.exp(-SPIN_DECAY * dt)
      angle += (ORBIT_SPEED * direction + (spinning === null ? spin : 0)) * dt
      for (const b of baskets) {
        b.offset[0] += (b.push[0] - b.offset[0]) * Math.min(1, dt * 6)
        b.offset[1] += (b.push[1] - b.offset[1]) * Math.min(1, dt * 6)
        b.push = [b.push[0] * Math.exp(-dt), b.push[1] * Math.exp(-dt)]
      }

      if (held && api.pointer.down) {
        const f = Math.min(1, dt * (carryLoose ? CARRY_FOLLOW / 3 : CARRY_FOLLOW))
        held.at = [held.at[0] + (api.pointer.x - held.at[0]) * f, held.at[1] + (api.pointer.y - held.at[1]) * f]
        const nearest = baskets.reduce((a, b) => (Math.hypot(...sub(basketAt(a), held.at)) < Math.hypot(...sub(basketAt(b), held.at)) ? a : b))
        const distance = Math.hypot(...sub(basketAt(nearest), held.at))
        api.error(distance)
        probeTimer(dt)
        if (distance < layout().basket) fill += dt / ACCEPT_SECONDS // outside, it pauses rather than resets (P4)
        if (fill >= 1) drop(nearest)
      }

      // ---- The display-only frame ----
      const draw = []
      const L = layout()
      for (const b of baskets) {
        const at = basketAt(b)
        draw.push({ k: 'circle', at, r: L.basket, color: b.color, alpha: 0.55, width: 3 })
        draw.push({ k: 'text', at: [at[0], at[1] - L.basket - 0.04], text: CATEGORIES[rule].label[b.side === yesSide ? 0 : 1], size: api.aspect < 1 ? 0.026 : 0.032, color: [0, 0, 96] })
      }
      if (held) {
        const b = baskets.reduce((a, c) => (Math.hypot(...sub(basketAt(a), held.at)) < Math.hypot(...sub(basketAt(c), held.at)) ? a : c))
        if (fill > 0) draw.push({ k: 'ring', at: basketAt(b), r: L.basket + 0.02, value: Math.min(1, fill), from: wander, color: held.color, width: 4, glow: Math.min(1, fill) })
      }
      for (const ring of L.orbits) draw.push({ k: 'circle', at: L.centre, r: ring, color: ringColor, alpha: 0.12, width: 1 })
      for (const item of items) {
        const at = item === held ? item.at : itemAt(item)
        draw.push({ k: 'shape', look: 'line', pts: SHAPES[item.name], at, s: ITEM_SIZE * L.item, rot: item.rot + angle * 0.3, color: item.color, width: 3.5 })
      }
      const changed = time - ruleChangedAt < 2.2 && sorts > 0 ? 'New rule! ' : ''
      return { bg: look.bg, draw, prompt: roundPause > 0 ? '' : `${changed}Sort them: ${CATEGORIES[rule].label[0]} or ${CATEGORIES[rule].label[1]}` }
    },
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
