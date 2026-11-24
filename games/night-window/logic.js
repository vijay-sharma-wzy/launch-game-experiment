// SERVER ONLY (simulated). Night Window: shine a lamp on the objects that fit the rule
// while they pass the window. Design spec: DESIGN.md in this folder.
import { OUTLINES, normalised } from '../../shared/objects.js'
import { CATEGORIES, clearlyNot } from '../../shared/server/semantics.js'
import { between, pick, randomTimer } from '../../shared/server/random.js'
import { palette } from '../../shared/server/palette.js'

// ---- Tunables ----------------------------------------------------------------
export const ROUNDS = 3
export const PENALTY = 15            // seconds for shining on a wrong object: more than a round takes a person (spec R3)
const RULES = ['wear', 'eat', 'alive', 'fly', 'kitchen', 'travel', 'drink']
const COLLECT_PER_RULE = 2           // the rule changes after this many collected...
const RULES_PER_ROUND = 2            // ...this many times a round (P2)
const MATCH_SHARE = 0.45             // share of objects on the belt that fit the current rule
const SPACING = 0.3                  // distance between objects on the belt
const BELT_SPEED = 0.12              // screen heights per second; objects are visible for 5+ s before the window, so nobody has to rush (spec P2)
const WINDOW = 0.2                   // half-width of the window; objects only count inside it (unstated)
const BEAM = 0.07                    // the lamp must be this close to an object to light it (unstated)
const COLLECT_SECONDS = 1            // time in the beam to collect a fitting object; it pauses, not resets, when the beam slips (P4)
const WRONG_SECONDS = 0.6            // time in the beam on a non-fitting object before it counts as a wrong pick (more than the 400 ms the spec allows for reactions)
const LAMP_FOLLOW = 10               // how closely the lamp follows the pointer; probes briefly loosen it
const ITEM_SIZE = 0.065
const PROBE_GAP = [0.9, 1.8]         // seconds between probes while the lamp is on (P4)

const SHAPES = Object.fromEntries(Object.keys(OUTLINES).map((name) => [name, normalised(OUTLINES[name])]))

export default function createLogic(api) {
  const look = palette()
  const frameColor = look.ink()
  let rule
  let rulesUsed = []
  let items = []
  let collected = 0
  let lamp = 0
  let lampLoose = 0
  let beltScale = 1
  let reverse = 0
  let time = 0
  let pause = 0
  let ruleChangedAt = -Infinity
  let nextId = 1
  const probeTimer = randomTimer(PROBE_GAP, probe)

  const fits = (name) => CATEGORIES[rule].yes.includes(name)
  // On a narrow phone screen the window narrows and the belt slows, so objects are
  // still in view for 2+ s before they reach the window.
  const narrowing = () => Math.min(1, api.aspect)
  const windowHalf = () => Math.min(WINDOW, api.aspect * 0.22)
  const spacing = () => Math.min(SPACING, Math.max(0.2, api.aspect * 0.5))
  const sway = () => 0.05 * narrowing() * Math.sin(time * 0.35)
  const inWindow = (item) => Math.abs(item.x - sway()) < windowHalf()

  function nameFor() {
    const showing = items.map((i) => i.name)
    const pool = Math.random() < MATCH_SHARE ? CATEGORIES[rule].yes : clearlyNot(CATEGORIES[rule])
    return pick(pool.filter((n) => !showing.slice(-4).includes(n)))
  }

  function spawn(x) {
    items.push({ id: nextId++, name: nameFor(), x, lit: 0, wrongLit: 0, done: null, fade: 0, color: look.ink(), rot: between(-0.4, 0.4), bob: between(0, 6) })
  }

  function newRule() {
    rule = pick(RULES.filter((r) => !rulesUsed.includes(r)))
    rulesUsed.push(rule)
    ruleChangedAt = time
    // Objects that are arguable under the new rule are swapped for clear ones (spec §1, Fairness).
    const allowed = [...CATEGORIES[rule].yes, ...clearlyNot(CATEGORIES[rule])]
    for (const item of items) {
      item.lit = 0
      item.wrongLit = 0
      if (!item.done && !allowed.includes(item.name)) {
        item.name = nameFor()
        item.fade = 0.5
      }
    }
  }

  function startRound() {
    api.startRound()
    collected = 0
    items = []
    newRule()
    for (let x = api.aspect / 2 - 0.1; x < api.aspect / 2 + 0.6; x += spacing()) spawn(x)
  }

  function probe() {
    const kind = pick(['speed', 'reverse', 'lamp'])
    if (kind === 'speed') {
      beltScale = pick([0.45, 1.9])
      api.probe('speed', beltScale)
    } else if (kind === 'reverse') {
      reverse = 0.6
      api.probe('reverse', 1)
    } else {
      lampLoose = 0.8
      api.probe('lamp', 3)
    }
  }

  function collect(item) {
    item.done = 'yes'
    api.commit(item.id, true)
    api.closeDecision(item.id)
    collected++
    api.progress(collected / (COLLECT_PER_RULE * RULES_PER_ROUND))
    if (collected === COLLECT_PER_RULE * RULES_PER_ROUND) {
      api.endRound()
      if (api.round === ROUNDS) return api.finish()
      pause = 1
      return
    }
    if (collected % COLLECT_PER_RULE === 0) newRule()
  }

  return {
    start() {
      startRound()
    },

    input() {},

    step(dt) {
      time += dt
      if (pause > 0) {
        pause -= dt
        if (pause <= 0) {
          pause = 0
          startRound()
        }
      }
      beltScale += (1 - beltScale) * Math.min(1, dt * 0.7)
      reverse = Math.max(0, reverse - dt)
      lampLoose = Math.max(0, lampLoose - dt)
      const speed = BELT_SPEED * narrowing() * beltScale * (reverse ? -0.6 : 1)

      const p = api.pointer
      lamp += (p.x - lamp) * Math.min(1, dt * (lampLoose ? LAMP_FOLLOW / 3 : LAMP_FOLLOW))
      const on = p.down && !pause

      let aimed = null
      for (const item of items) {
        const wasIn = inWindow(item)
        item.x -= speed * dt
        item.fade = Math.max(0, item.fade - dt)
        if (!wasIn && inWindow(item) && !item.done) api.openDecision(item.id)
        if (wasIn && !inWindow(item)) api.closeDecision(item.id)
        if (item.done || !inWindow(item) || pause) continue
        const under = on && Math.abs(lamp - item.x) < BEAM
        if (fits(item.name)) {
          if (under) item.lit += dt
          if (item.lit >= COLLECT_SECONDS) collect(item)
          if (!aimed || Math.abs(item.x - lamp) < Math.abs(aimed.x - lamp)) aimed = item
        } else if (under) {
          item.wrongLit += dt
          if (item.wrongLit >= WRONG_SECONDS) {
            item.done = 'no'
            api.commit(item.id, false)
            api.closeDecision(item.id)
          }
        }
      }
      items = items.filter((i) => i.x > -api.aspect / 2 - 0.3)
      const last = items.reduce((m, i) => Math.max(m, i.x), -Infinity)
      if (last < api.aspect / 2 + 0.3) spawn(last + spacing())
      if (on && aimed) {
        api.error(Math.abs(lamp - aimed.x))
        probeTimer(dt)
      }

      // ---- The display-only frame ----
      const draw = []
      const wx = sway()
      for (const side of [-1, 1]) {
        const x = wx + side * windowHalf() * (1 + 0.04 * Math.sin(time * 0.8))
        draw.push({ k: 'path', pts: [[x, -0.17], [x, 0.17]], color: frameColor, alpha: 0.7, width: 4 })
      }
      draw.push({ k: 'path', pts: [[wx - windowHalf(), -0.17], [wx + windowHalf(), -0.17]], color: frameColor, alpha: 0.4, width: 2 })
      draw.push({ k: 'path', pts: [[wx - windowHalf(), 0.17], [wx + windowHalf(), 0.17]], color: frameColor, alpha: 0.4, width: 2 })
      if (on) {
        draw.push({ k: 'glow', at: [lamp, 0], r: 0.14, color: [48, 100, 80], alpha: 0.35 })
        draw.push({ k: 'path', pts: [[lamp, 0.45], [lamp, 0.02]], color: [48, 100, 85], alpha: 0.25, width: 10 })
      }
      draw.push({ k: 'circle', at: [lamp, 0.42], r: 0.018, color: [48, 100, 85], fill: on, alpha: on ? 0.9 : 0.5, width: 2 })
      for (const item of items) {
        const inside = inWindow(item)
        const y = 0.012 * Math.sin(time * 1.4 + item.bob)
        const at = [item.x, y]
        draw.push({ k: 'shape', look: 'parts', pts: SHAPES[item.name], at, s: ITEM_SIZE, rot: item.rot, color: item.color, alpha: (inside ? 1 : 0.5) * (item.done ? 0.35 : 1) * (1 - item.fade), width: 3.5 })
        const progress = fits(item.name) ? item.lit / COLLECT_SECONDS : item.wrongLit / WRONG_SECONDS
        if (!item.done && progress > 0) draw.push({ k: 'ring', at, r: ITEM_SIZE * 1.5, value: Math.min(1, progress), from: item.bob, color: item.color, width: 3, glow: Math.min(1, progress) })
        if (item.done === 'no') draw.push({ k: 'text', at, text: '✕', size: 0.08, color: [0, 0, 96] })
      }
      const changed = time - ruleChangedAt < 2.2 && collected > 0 ? 'New rule! ' : ''
      return { bg: look.bg, draw, prompt: pause ? '' : `${changed}Shine on ${CATEGORIES[rule].things}` }
    },
  }
}
