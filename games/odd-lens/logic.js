// SERVER ONLY (simulated). Odd Lens: keep a lens on the object that doesn't belong,
// while the set keeps changing. Design spec: DESIGN.md in this folder.
import { OUTLINES, normalised } from '../../shared/objects.js'
import { CATEGORIES, clearlyNot } from '../../shared/server/semantics.js'
import { between, pick, shuffle, randomTimer } from '../../shared/server/random.js'
import { palette } from '../../shared/server/palette.js'

// ---- Tunables ----------------------------------------------------------------
export const ROUNDS = 3
export const PENALTY = 15            // seconds per wrong pick: more than a round takes a person (spec R3)
const GROUPS = ['wear', 'kitchen', 'travel', 'alive'] // categories with 4+ clear members
const STAGES = 3                     // odd ones to find per round; after each, two objects are swapped (P2)
const CLUSTER = 0.22                 // how far the objects sit from the middle of their group
const ITEM_SIZE = 0.06
const LENS = 0.11                    // lens radius: objects show clearly only inside it (unstated)
const ON_TARGET = 0.06               // the lens counts as "on" an object within this distance
const CHOOSE_SECONDS = 1.6           // time on an object to choose it; pauses rather than resets when the lens slips (P4)
const SLIP_DECAY = 0.4               // how fast an unfinished choice fades once the lens leaves
const LENS_GAIN = 5                  // lens speed per unit of drag from where the press started (unstated: drag sets a speed)
const LENS_MAX_SPEED = 0.9
const DRIFT_SPEED = [0.05, 0.09]     // how fast the group drifts
const PROBE_GAP = [1, 2]             // seconds between probes while steering (P4)
const NUDGE = 0.04
const SWAP_SECONDS = 0.6             // fade time when objects are swapped

const SHAPES = Object.fromEntries(Object.keys(OUTLINES).map((name) => [name, normalised(OUTLINES[name])]))

// A set of five: four that clearly share a category and one that clearly doesn't.
// `keep` are objects already on screen that must stay; the odd one must differ from
// `notOdd`, so finding the last one never answers the next.
function configure(keep, notOdd) {
  for (let tries = 0; tries < 1000; tries++) {
    const c = CATEGORIES[pick(GROUPS)]
    const no = clearlyNot(c)
    const inGroup = keep.filter((n) => c.yes.includes(n))
    const out = keep.filter((n) => no.includes(n))
    if (inGroup.length + out.length < keep.length || out.length > 1) continue
    const fresh = shuffle(c.yes.filter((n) => !keep.includes(n))).slice(0, 4 - inGroup.length)
    if (fresh.length < 4 - inGroup.length) continue
    const odd = out[0] ?? pick(no.filter((n) => !keep.includes(n)))
    if (odd === notOdd) continue
    return { odd, add: out.length ? fresh : [...fresh, odd] }
  }
  return null
}

export default function createLogic(api) {
  const look = palette()
  let items = []
  let odd = null
  let stage = 0
  let centre = [0, 0]
  let cluster = CLUSTER   // shrinks on narrow screens so the whole group fits
  let velocity = [0, 0]
  let speedScale = 1
  let lens = [0, 0]
  let lensVel = [0, 0]
  let lensGain = LENS_GAIN
  let gainProbe = 0
  let anchor = null
  let time = 0
  let swappedAt = -Infinity
  let pause = 0
  let nextId = 1
  const probeTimer = randomTimer(PROBE_GAP, probe)

  const itemAt = (item) => {
    const w = time * 0.7 + item.wobble
    return [centre[0] + item.slot[0] + item.offset[0] + 0.015 * Math.sin(w), centre[1] + item.slot[1] + item.offset[1] + 0.015 * Math.cos(w * 1.3)]
  }

  function makeItem(name, slot) {
    return { id: nextId++, name, slot, offset: [0, 0], push: [0, 0], choose: 0, shake: 0, fade: 0, color: look.ink(), rot: between(-0.8, 0.8), wobble: between(0, 6) }
  }

  function newDrift() {
    const a = between(0, 2 * Math.PI)
    const s = between(...DRIFT_SPEED)
    velocity = [Math.cos(a) * s, Math.sin(a) * s]
  }

  function startRound() {
    api.startRound()
    stage = 0
    const set = configure([], null)
    odd = set.odd
    const turn = between(0, 2 * Math.PI)
    cluster = Math.min(CLUSTER, api.aspect / 2 - 0.09)
    items = shuffle(set.add).map((name, i) => makeItem(name, [cluster * Math.cos(turn + (i * 2 * Math.PI) / 5), cluster * Math.sin(turn + (i * 2 * Math.PI) / 5)]))
    newDrift()
    api.openDecision(`${api.round}:0`)
  }

  // After a find, two objects swap out for new ones, which may change both the shared
  // category and which object is odd.
  function swap() {
    for (let tries = 0; tries < 50; tries++) {
      const keep = shuffle(items).slice(0, 3)
      const set = configure(keep.map((i) => i.name), odd)
      if (!set) continue
      const leaving = items.filter((i) => !keep.includes(i))
      items = [...keep, ...set.add.map((name, i) => ({ ...makeItem(name, leaving[i].slot), fade: SWAP_SECONDS }))]
      odd = set.odd
      swappedAt = time
      return
    }
  }

  function probe() {
    const kind = pick(['reverse', 'speed', 'nudge', 'lens'])
    if (kind === 'reverse') {
      velocity = [-velocity[0], -velocity[1]]
      api.probe('reverse', 1)
    } else if (kind === 'speed') {
      speedScale = pick([0.3, 2.5])
      api.probe('speed', speedScale)
    } else if (kind === 'nudge') {
      const target = items.find((i) => i.name === odd)
      const a = between(0, 2 * Math.PI)
      target.push = [Math.cos(a) * NUDGE, Math.sin(a) * NUDGE]
      api.probe('nudge', NUDGE)
    } else {
      lensGain = LENS_GAIN * pick([0.4, 2])
      gainProbe = 0.9
      api.probe('lens', lensGain / LENS_GAIN)
    }
  }

  function choose(item) {
    const correct = item.name === odd
    api.commit(item.id, correct)
    item.choose = 0
    if (!correct) {
      item.shake = 0.5
      return
    }
    api.closeDecision(`${api.round}:${stage}`)
    stage++
    api.progress(stage / STAGES)
    if (stage === STAGES) {
      api.endRound()
      if (api.round === ROUNDS) return api.finish()
      pause = 0.9
      return
    }
    swap()
    api.openDecision(`${api.round}:${stage}`)
  }

  return {
    start() {
      startRound()
    },

    input(e) {
      if (e.kind === 'down') anchor = [e.x, e.y]
      if (e.kind === 'up') anchor = null
    },

    step(dt) {
      time += dt
      const half = [api.aspect / 2, 0.5]
      if (pause > 0) {
        pause -= dt
        if (pause <= 0) {
          pause = 0
          startRound()
        }
      }
      gainProbe = Math.max(0, gainProbe - dt)
      if (!gainProbe) lensGain = LENS_GAIN
      speedScale += (1 - speedScale) * Math.min(1, dt * 0.6)

      // The group drifts, steering softly back when it nears the screen's edge.
      const bound = [Math.max(0.02, half[0] - cluster - 0.1), api.aspect < 1 ? 0.08 : 0.18] // tall screens: keep clear of the prompt
      for (const k of [0, 1]) {
        if (Math.abs(centre[k]) > bound[k]) velocity[k] -= Math.sign(centre[k]) * dt * 0.15
        centre[k] += velocity[k] * speedScale * dt
      }

      // Dragging sets the lens's speed, from where the press began; letting go lets it coast to a stop.
      const p = api.pointer
      const want = anchor && p.down ? [(p.x - anchor[0]) * lensGain, (p.y - anchor[1]) * lensGain] : [0, 0]
      const speed = Math.hypot(...want)
      if (speed > LENS_MAX_SPEED) { want[0] *= LENS_MAX_SPEED / speed; want[1] *= LENS_MAX_SPEED / speed }
      for (const k of [0, 1]) {
        lensVel[k] += (want[k] - lensVel[k]) * Math.min(1, dt * 6)
        lens[k] += lensVel[k] * dt
        if (Math.abs(lens[k]) > half[k]) lens[k] -= (lens[k] - Math.sign(lens[k]) * half[k]) * Math.min(1, dt * 5) // soft edge
      }

      let target = null
      for (const item of items) {
        item.offset[0] += (item.push[0] - item.offset[0]) * Math.min(1, dt * 8)
        item.offset[1] += (item.push[1] - item.offset[1]) * Math.min(1, dt * 8)
        item.push = [item.push[0] * Math.exp(-dt * 0.5), item.push[1] * Math.exp(-dt * 0.5)]
        item.shake = Math.max(0, item.shake - dt)
        item.fade = Math.max(0, item.fade - dt)
        if (item.name === odd) target = item
        if (pause || item.fade) continue
        const on = Math.hypot(lens[0] - itemAt(item)[0], lens[1] - itemAt(item)[1]) < ON_TARGET
        item.choose = on ? item.choose + dt : Math.max(0, item.choose - dt * SLIP_DECAY)
        if (item.choose >= CHOOSE_SECONDS) choose(item)
      }
      if (p.down && target && !pause) {
        api.error(Math.hypot(lens[0] - itemAt(target)[0], lens[1] - itemAt(target)[1]))
        probeTimer(dt)
      }

      // ---- The display-only frame ----
      const draw = []
      for (const item of items) {
        const [x, y] = itemAt(item)
        const shake = item.shake ? 0.015 * Math.sin(item.shake * 60) : 0
        draw.push({ k: 'shape', look: 'reveal', lens: { at: lens, r: LENS }, pts: SHAPES[item.name], at: [x + shake, y], s: ITEM_SIZE, rot: item.rot + time * 0.15, color: item.color, alpha: 1 - item.fade / SWAP_SECONDS, width: 3 })
      }
      const chosen = items.reduce((a, b) => (b.choose > (a?.choose ?? 0) ? b : a), null)
      draw.push({ k: 'circle', at: lens, r: LENS, color: [0, 0, 92], alpha: 0.7, width: 2 })
      if (chosen?.choose > 0) draw.push({ k: 'ring', at: lens, r: LENS + 0.015, value: chosen.choose / CHOOSE_SECONDS, from: time * 0.4, color: chosen.color, width: 3, glow: chosen.choose / CHOOSE_SECONDS })
      if (anchor && p.down) {
        draw.push({ k: 'circle', at: anchor, r: 0.02, color: [0, 0, 92], alpha: 0.5, width: 2 })
        draw.push({ k: 'path', pts: [anchor, [p.x, p.y]], color: [0, 0, 92], alpha: 0.35, width: 2 })
      }
      const changed = time - swappedAt < 2 ? 'Two have changed. ' : ''
      return { bg: look.bg, draw, prompt: pause ? '' : `${changed}Keep the lens on the one that doesn’t belong` }
    },
  }
}
