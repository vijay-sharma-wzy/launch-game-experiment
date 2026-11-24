// SERVER ONLY (simulated). Ink Trail: draw a line through objects in size order.
// Design spec: DESIGN.md in this folder.
import { OUTLINES, normalised } from '../../shared/objects.js'
import { SIZE_CM, SIZE_GAP, ALL } from '../../shared/server/semantics.js'
import { between, pick, shuffle, randomTimer } from '../../shared/server/random.js'
import { palette } from '../../shared/server/palette.js'

// ---- Tunables ----------------------------------------------------------------
export const ROUNDS = 3
export const PENALTY = 15          // seconds per wrong link: more than a round takes a person (spec R3)
const START_ITEMS = 4              // objects to link at the start of each round...
const ARRIVE_AFTER = 2             // ...and one more arrives after this many links, so the order can't be planned up front (P2)
const ITEM_SIZE = 0.07             // half-size of an object, in screen heights
const ITEM_GAP = 0.34              // smallest distance between two objects
const WORLD = [1.0, 0.85]          // half-width (in screen widths) and half-height of the field; bigger than the screen, so players explore (P6)
const LINK_SECONDS = 0.45          // how long the pen must linger on an object to link it (unstated: the ring shows it filling)
const LINGER_DECAY = 0.5           // how fast an unfinished linger fades when the pen moves away, so brushing past never links
const EDGE = 0.1                   // pointer this close to a screen edge pushes the view that way (unstated)
const PUSH_SPEED = 1.1             // view speed at the very edge; it eases in, so the push is soft and not reproducible
const PEN_FOLLOW = 22              // how quickly the pen follows the pointer; probes briefly loosen it
const PROBE_GAP = [1.2, 2.6]       // seconds between probes while the player is drawing (P4)
const NUDGE = 0.04                 // how far a nudge moves the next object
const ROUND_PAUSE = 0.9            // seconds between rounds

// ---- Setup -------------------------------------------------------------------
const SHAPES = Object.fromEntries(ALL.map((name) => [name, normalised(OUTLINES[name])]))
const BY_SIZE = [...ALL].sort((a, b) => SIZE_CM[a] - SIZE_CM[b])
const farApart = (names) => names.every((a) => names.every((b) => a === b || Math.max(SIZE_CM[a], SIZE_CM[b]) / Math.min(SIZE_CM[a], SIZE_CM[b]) >= SIZE_GAP))

// START_ITEMS objects whose sizes are all far apart, so their order is never arguable.
function pickSet() {
  for (;;) {
    const names = shuffle(BY_SIZE).slice(0, START_ITEMS)
    if (farApart(names)) return names
  }
}

export default function createLogic(api) {
  const look = palette()
  let view = { aspect: 1 }
  let world = [1, 1]
  let items = []
  let order = []          // names, in the order they must be linked
  let ascending = true
  let linked = []
  let trail = []
  let pen = [0, 0]
  let penLoose = 0        // seconds left of a "looser pen" probe
  let cam = [0, 0]
  let camVel = [0, 0]
  let time = 0
  let pause = 0
  let arrivedAt = -Infinity
  let probeEffect = 0
  let nextId = 1
  let probeTimer

  const toWorld = ([x, y]) => [x + cam[0], y + cam[1]]
  const toScreen = ([x, y]) => [x - cam[0], y - cam[1]]
  const nextItem = () => items.find((i) => i.name === order[linked.length])

  function place() {
    for (;;) {
      const at = [between(-world[0] + 0.15, world[0] - 0.15), between(-world[1] + 0.15, world[1] - 0.15)]
      if (items.every((i) => Math.hypot(i.home[0] - at[0], i.home[1] - at[1]) >= ITEM_GAP) && Math.hypot(at[0], at[1]) > 0.12) return at
    }
  }

  function addItem(name) {
    const home = place()
    items.push({
      id: nextId++, name, home, offset: [0, 0], push: [0, 0], linger: 0, shake: 0,
      color: look.ink(), rot: between(-0.5, 0.5), wobble: between(0, 6), drift: between(0.6, 1.2),
    })
  }

  function startRound() {
    api.startRound()
    ascending = Math.random() < 0.5
    items = []
    linked = []
    trail = []
    for (const name of pickSet()) addItem(name)
    sortOrder()
    arrivedAt = -Infinity
    api.openDecision(`${api.round}:0`)
    probeTimer = randomTimer(PROBE_GAP, probe)
  }

  function sortOrder() {
    const names = items.map((i) => i.name).sort((a, b) => SIZE_CM[a] - SIZE_CM[b])
    order = ascending ? names : names.reverse()
  }

  // One more object, which must still come later than everything linked so far and be
  // far apart in size from every object on the field.
  function arrive() {
    const done = linked.map((i) => i.name)
    const last = SIZE_CM[done.at(-1)]
    const fits = ALL.filter((n) => !items.some((i) => i.name === n) && (ascending ? SIZE_CM[n] > last : SIZE_CM[n] < last) && farApart([...items.map((i) => i.name), n]))
    if (!fits.length) return
    addItem(pick(fits))
    sortOrder()
    arrivedAt = time
  }

  // Probes (P4): a small nudge to the next object, a burst of drift, or a looser pen.
  function probe() {
    if (!api.pointer.down || pause) return
    const target = nextItem()
    const kind = pick(['nudge', 'drift', 'pen'])
    if (kind === 'nudge' && target) {
      const a = between(0, 2 * Math.PI)
      target.push = [Math.cos(a) * NUDGE, Math.sin(a) * NUDGE]
      api.probe('nudge', NUDGE)
    } else if (kind === 'drift') {
      probeEffect = 1.2
      api.probe('drift', 3)
    } else {
      penLoose = 0.8
      api.probe('pen', 3)
    }
  }

  function link(item) {
    const correct = item.name === order[linked.length]
    api.commit(item.id, correct)
    item.linger = 0
    if (!correct) {
      item.shake = 0.5
      return
    }
    api.closeDecision(`${api.round}:${linked.length}`)
    linked.push(item)
    api.progress(linked.length / order.length)
    if (linked.length === ARRIVE_AFTER) arrive()
    if (linked.length === order.length) {
      api.endRound()
      if (api.round === ROUNDS) return api.finish()
      pause = ROUND_PAUSE
      return
    }
    api.openDecision(`${api.round}:${linked.length}`)
  }

  function where(item) {
    const w = item.wobble + time * item.drift * (1 + probeEffect)
    return [item.home[0] + item.offset[0] + 0.03 * Math.sin(w), item.home[1] + item.offset[1] + 0.03 * Math.cos(w * 0.8)]
  }

  return {
    start(v) {
      view = { aspect: v.w / v.h }
      world = [WORLD[0] * view.aspect, WORLD[1]]
      startRound()
    },

    input(e) {
      if (e.kind === 'down') {
        pen = toWorld([e.x, e.y])
        trail.push(null) // a lifted pen starts a new stroke
      }
    },

    step(dt) {
      time += dt
      view.aspect = api.aspect
      probeEffect = Math.max(0, probeEffect - dt)
      penLoose = Math.max(0, penLoose - dt)
      if (pause > 0) {
        pause -= dt
        if (pause <= 0) {
          pause = 0
          startRound()
        }
      }

      // Push the view by drawing near a screen edge; it eases in and out, drifts a
      // little on its own, and springs softly back if pushed past the field.
      const p = api.pointer
      const half = [view.aspect / 2, 0.5]
      const push = (d) => (p.down && d < EDGE ? ((EDGE - d) / EDGE) ** 2 * PUSH_SPEED : 0)
      const want = [push(p.x + half[0]) * -1 + push(half[0] - p.x), push(p.y + half[1]) * -1 + push(half[1] - p.y)]
      for (const k of [0, 1]) {
        const limit = Math.max(0, world[k] - half[k] + 0.1)
        const spring = Math.abs(cam[k]) > limit ? -(cam[k] - Math.sign(cam[k]) * limit) * 4 : 0
        camVel[k] += (want[k] + spring - camVel[k]) * Math.min(1, dt * 4)
        cam[k] += camVel[k] * dt + 0.004 * Math.sin(time * 0.3 + k) * dt
      }

      // The pen follows the pointer a little behind, and inks while pressed.
      const target = toWorld([p.x, p.y])
      const f = Math.min(1, dt * (penLoose ? PEN_FOLLOW / 3 : PEN_FOLLOW))
      pen = [pen[0] + (target[0] - pen[0]) * f, pen[1] + (target[1] - pen[1]) * f]
      if (p.down && !pause) {
        trail.push([...pen])
        if (trail.length > 600) trail.splice(0, trail.length - 600)
      }

      for (const item of items) {
        item.offset[0] += (item.push[0] - item.offset[0]) * Math.min(1, dt * 8)
        item.offset[1] += (item.push[1] - item.offset[1]) * Math.min(1, dt * 8)
        item.shake = Math.max(0, item.shake - dt)
        if (linked.includes(item) || pause) continue
        const near = Math.hypot(pen[0] - where(item)[0], pen[1] - where(item)[1]) < ITEM_SIZE * 1.3
        item.linger = p.down && near ? item.linger + dt : Math.max(0, item.linger - dt * LINGER_DECAY)
        if (item.linger >= LINK_SECONDS) link(item)
      }

      const next = nextItem()
      if (p.down && next && !pause) {
        api.error(Math.hypot(pen[0] - where(next)[0], pen[1] - where(next)[1]))
        probeTimer(dt)
      }

      // ---- The display-only frame ----
      const draw = []
      for (let i = 1; i < linked.length; i++) {
        draw.push({ k: 'path', pts: [toScreen(where(linked[i - 1])), toScreen(where(linked[i]))], color: linked[i].color, alpha: 0.9, width: 4 })
      }
      let stroke = []
      const flush = () => stroke.length > 1 && draw.push({ k: 'path', pts: stroke, color: look.bg.blobs[0][3], alpha: 0.55, width: 3 })
      for (const point of trail) {
        if (!point) { flush(); stroke = []; continue }
        stroke.push(toScreen(point))
      }
      flush()
      for (const item of items) {
        const [x, y] = toScreen(where(item))
        const shake = item.shake ? 0.015 * Math.sin(item.shake * 60) : 0
        draw.push({ k: 'shape', look: 'silhouette', pts: SHAPES[item.name], at: [x + shake, y], s: ITEM_SIZE, rot: item.rot, color: item.color, alpha: linked.includes(item) ? 0.45 : 0.95 })
        if (item.linger > 0) draw.push({ k: 'ring', at: [x, y], r: ITEM_SIZE * 1.45, value: item.linger / LINK_SECONDS, from: item.wobble, color: item.color, width: 3 })
      }
      if (p.down) draw.push({ k: 'circle', at: toScreen(pen), r: 0.008, color: [0, 0, 100], fill: true, alpha: 0.9 })
      if (Math.hypot(want[0], want[1]) > 0.05) {
        draw.push({ k: 'glow', at: [Math.sign(want[0]) * half[0], Math.sign(want[1]) * half[1]], r: 0.35, color: [0, 0, 100], alpha: Math.min(0.25, Math.hypot(...want) / 4) })
      }
      const arrived = time - arrivedAt < 2.5 ? ' · one more just appeared' : ''
      return {
        bg: look.bg,
        draw,
        prompt: pause ? '' : `Link them from ${ascending ? 'smallest to biggest' : 'biggest to smallest'} in real life${arrived}`,
      }
    },
  }
}
