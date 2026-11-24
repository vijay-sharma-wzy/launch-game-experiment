// SERVER ONLY (simulated). Toss & Catch: steer a net to catch only the thrown objects
// that fit the prompt. Design spec: DESIGN.md in this folder.
import { OUTLINES, normalised } from '../../shared/objects.js'
import { CATEGORIES, clearlyNot } from '../../shared/server/semantics.js'
import { between, pick, shuffle, sign, randomTimer } from '../../shared/server/random.js'
import { palette } from '../../shared/server/palette.js'

// ---- Tunables ----------------------------------------------------------------
export const ROUNDS = 3
export const PENALTY = 15            // seconds per wrong catch: more than a round takes a person (spec R3)
const RULES = ['wear', 'eat', 'alive', 'fly', 'kitchen', 'travel', 'drink']
const CATCHES = 4                    // fitting objects to catch per round
const MATCH_SHARE = 0.45             // share of thrown objects that fit
const THROW_GAP = [1.3, 2]           // seconds between throws; each one is a new decision (P2)
const FIELD = 0.8                    // half-width of the field, in screen widths: wider than the screen, so the view follows the net (unstated)
const GRAVITY = 0.75                 // screen heights per second squared
const FLIGHT = [2.2, 2.8]            // seconds from throw to landing: time to decide and get there (spec P2: at least 1.5 s)
const NET_Y = 0.36                   // height of the net's mouth
const MOUTH = [0.05, 0.17]           // net mouth width, closed and open (unstated: press and hold to open it)
const NET_SPRING = 30                // the net swings after the pointer and overshoots a little (unstated)
const NET_DAMPING = 7
const VIEW_FOLLOW = 2.5              // the view follows the net with momentum
const ITEM_SIZE = 0.05
const PROBE_GAP = [0.9, 1.7]         // seconds between probes while a fitting object is in the air (P4)
const GUST = 0.12                    // sideways speed a gust adds

const SHAPES = Object.fromEntries(Object.keys(OUTLINES).map((name) => [name, normalised(OUTLINES[name])]))

export default function createLogic(api) {
  const look = palette()
  const netColor = look.ink()
  const rules = shuffle(RULES).slice(0, ROUNDS)
  let rule
  let items = []
  let caught = 0
  let net = { x: 0, v: 0 }
  let spring = NET_SPRING
  let springProbe = 0
  let gravity = GRAVITY
  let gravityProbe = 0
  let cam = 0
  let throwIn = 0
  let time = 0
  let pause = 0
  let nextId = 1
  const probeTimer = randomTimer(PROBE_GAP, probe)

  const fits = (name) => CATEGORIES[rule].yes.includes(name)
  const half = () => api.aspect / 2
  const field = () => FIELD * api.aspect

  // Where an object will cross the net's height, from its current path.
  function landing(item) {
    const dy = NET_Y - item.y
    const t = (item.vy + Math.sqrt(Math.max(0, item.vy ** 2 + 2 * gravity * dy))) / gravity
    return item.x + item.vx * t
  }

  function toss() {
    const pool = Math.random() < MATCH_SHARE ? CATEGORIES[rule].yes : clearlyNot(CATEGORIES[rule])
    const fresh = pool.filter((n) => !items.some((i) => i.name === n))
    const name = pick(fresh.length ? fresh : pool)
    const from = sign()
    const x = from * (field() + 0.1)
    const target = between(-field() + 0.15, field() - 0.15)
    const t = between(...FLIGHT)
    const y = between(-0.1, 0.25)
    const vx = (target - x) / t
    const vy = (NET_Y - y - 0.5 * GRAVITY * t * t) / t
    const item = { id: nextId++, name, x, y, vx, vy, spin: between(-2, 2), rot: between(0, 6), color: look.ink(), state: 'air' }
    items.push(item)
    api.openDecision(item.id)
  }

  function startRound() {
    api.startRound()
    rule = rules[api.round - 1]
    caught = 0
    items = []
    throwIn = 0.6
  }

  function probe() {
    const kind = pick(['gust', 'gravity', 'net'])
    if (kind === 'gust') {
      const target = items.find((i) => i.state === 'air' && fits(i.name))
      if (!target) return
      target.vx += sign() * GUST
      api.probe('gust', GUST)
    } else if (kind === 'gravity') {
      gravity = GRAVITY * pick([0.6, 1.4])
      gravityProbe = 1
      api.probe('gravity', gravity / GRAVITY)
    } else {
      spring = NET_SPRING * 0.35
      springProbe = 0.8
      api.probe('net', 0.35)
    }
  }

  function land(item, inNet) {
    api.closeDecision(item.id)
    if (!inNet) {
      item.state = 'missed' // no penalty: a fitting object that's missed is just time lost
      return
    }
    const correct = fits(item.name)
    api.commit(item.id, correct)
    item.state = correct ? 'caught' : 'wrong'
    item.until = time + 0.8 // shown in the net for a moment
    item.vx = 0
    item.vy = 0
    if (!correct) return
    caught++
    api.progress(caught / CATCHES)
    if (caught < CATCHES) return
    api.endRound()
    if (api.round === ROUNDS) return api.finish()
    pause = 1
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
      springProbe = Math.max(0, springProbe - dt)
      if (!springProbe) spring = NET_SPRING
      gravityProbe = Math.max(0, gravityProbe - dt)
      if (!gravityProbe) gravity = GRAVITY

      // The net swings toward the pointer like a spring, so it overshoots a little;
      // the view follows the net with momentum, and the field's edges are soft.
      const p = api.pointer
      const want = Math.max(-field(), Math.min(field(), p.x + cam))
      net.v += (spring * (want - net.x) - NET_DAMPING * net.v) * dt
      net.x += net.v * dt
      cam += (Math.max(-field() + half(), Math.min(field() - half(), net.x)) - cam) * Math.min(1, dt * VIEW_FOLLOW)
      const open = p.down && !pause
      const mouth = open ? MOUTH[1] : MOUTH[0]

      if (!pause) {
        throwIn -= dt
        if (throwIn <= 0) {
          toss()
          throwIn = between(...THROW_GAP)
        }
      }

      for (const item of items) {
        if (item.state !== 'air') {
          if (item.state === 'caught' || item.state === 'wrong') item.x += (net.x - item.x) * Math.min(1, dt * 10)
          if (item.state === 'missed') { item.vy += gravity * dt; item.y += item.vy * dt }
          continue
        }
        const before = item.y
        item.vy += gravity * dt
        item.x += item.vx * dt
        item.y += item.vy * dt
        item.rot += item.spin * dt
        if (before < NET_Y && item.y >= NET_Y) {
          const inMouth = Math.abs(item.x - net.x) < mouth / 2 + ITEM_SIZE * 0.4
          if (inMouth && !open) {
            item.vy = -Math.abs(item.vy) * 0.4 // bounces off a closed net
            item.y = NET_Y - 0.001
          } else {
            land(item, inMouth)
          }
        }
      }
      items = items.filter((i) => (i.state === 'air' || i.state === 'missed' ? i.y < 1.2 : time < i.until))
      const flying = items.filter((i) => i.state === 'air' && fits(i.name))
      if (flying.length) {
        const nearest = flying.reduce((a, b) => (Math.abs(landing(a) - net.x) < Math.abs(landing(b) - net.x) ? a : b))
        api.error(Math.abs(landing(nearest) - net.x))
        probeTimer(dt)
      }

      // ---- The display-only frame ----
      const draw = []
      const sx = (x) => x - cam
      draw.push({ k: 'path', pts: [[sx(-field()), NET_Y + 0.09], [sx(field()), NET_Y + 0.09]], color: netColor, alpha: 0.25, width: 2 })
      for (const item of items) {
        const at = [sx(item.x), item.state === 'caught' || item.state === 'wrong' ? NET_Y + 0.02 : item.y]
        draw.push({ k: 'shape', look: 'line', pts: SHAPES[item.name], at, s: ITEM_SIZE, rot: item.rot, color: item.color, alpha: item.state === 'caught' ? 0.4 : 1, width: 3.5 })
        if (item.state === 'wrong') draw.push({ k: 'text', at, text: '✕', size: 0.07, color: [0, 0, 96] })
      }
      const nx = sx(net.x)
      draw.push({ k: 'path', pts: [[nx - mouth / 2, NET_Y], [nx - mouth / 2 + 0.02, NET_Y + 0.08], [nx + mouth / 2 - 0.02, NET_Y + 0.08], [nx + mouth / 2, NET_Y]], color: netColor, alpha: 0.9, width: 4 })
      if (open) draw.push({ k: 'glow', at: [nx, NET_Y + 0.03], r: 0.12, color: netColor, alpha: 0.25 })
      draw.push({ k: 'ring', at: [nx + mouth / 2 + 0.05, NET_Y + 0.04], r: 0.025, value: caught / CATCHES, from: time * 0.3, color: netColor, width: 3 })
      return { bg: look.bg, draw, prompt: pause ? '' : `Catch only ${CATEGORIES[rule].things}` }
    },
  }
}
