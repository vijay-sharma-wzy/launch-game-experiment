// SERVER ONLY (simulated). The framework every game's logic runs inside: the server's
// clock, penalties, rounds and steps, and the telemetry of spec §6, recorded from the
// input the server receives rather than from anything the client says about itself.
//
// This is a stand-in for the real AWS backend (see CLAUDE.md). It runs in the browser
// for now, so it is NOT real security: the answers ship in the same bundle. It is
// kept apart from the client, and only reached through shared/transport.js, so it can
// be lifted into a Lambda or WebSocket service unchanged.
import { score } from './scorer.js'

const COLUMN = 0.62  // widest the play area gets, as a share of the screen's height: a desktop sees no more than a phone
const PAUSE = 450    // ms a finished step stays on screen before the next one
const FLASH = 1600   // ms the "+Ns" penalty note shows

// A game is `rounds` rounds of `steps` steps. Every step is one decision with one
// specific answer (spec R0), and a hard reset from the step before (spec P7).
//
// `createLogic(api)` builds one game's rules. It returns:
//   begin({ round, step })  set up a step
//   input(event)            a raw pointer event
//   step(dt)                advance, and return the display-only frame (shared/render.js)
//   hint(time, wrongFirst)  where a perfect player's pointer would be; only the solver
//                           (tools/solve.mjs) calls it, and no message handler reaches it
export function createGameServer(createLogic, { rounds, steps, penaltySeconds, clock = () => performance.now() }) {
  const events = []
  let started = null
  let view = { w: 1, h: 1, dpr: 1 }
  let lastStep = 0
  let penalty = 0
  let wrong = 0
  let round = 0
  let step = 0
  let roundStart = 0
  let roundWrong = 0
  let split = null       // this round's time by activity, in ms (spec §6 `round_end`)
  let steering = false   // did the logic say the player was in the continuous phase this frame?
  let pauseUntil = null
  let flashUntil = 0
  let finished = null
  let decision = null
  let outbox = []        // sprites the client hasn't been sent yet
  let lastErrorLog = -Infinity
  let lastProgressLog = -Infinity
  let lastView = ''
  let pointerType = 'mouse'
  const pointer = { x: 0, y: 0, down: false }

  const now = () => clock() - started
  const log = (type, fields = {}) => events.push({ type, t: Math.round(now()), ...fields })
  const id = () => Math.random().toString(36).slice(2, 10)

  // Everything a game's logic may use.
  const api = {
    now,
    pointer,
    get round() { return round },
    get busy() { return pauseUntil !== null || finished !== null },
    // Width of the play area in screen units (the screen is 1 tall).
    get width() { return Math.min(view.w / view.h, COLUMN) },
    // Queue a picture (from sprites.js) for the client and return the opaque handle
    // frames refer to it by. The id is random per use, so it says nothing about what
    // the picture shows, even when the same picture is used twice.
    sprite({ url, aspect }) {
      const sprite = { id: id(), aspect }
      outbox.push({ id: sprite.id, url })
      return sprite
    },
    // `candidate` is an opaque id. A wrong commit costs penaltySeconds.
    commit(candidate, correct) {
      log('commit', { round, candidate, correct })
      if (correct) return
      penalty += penaltySeconds
      wrong++
      roundWrong++
      flashUntil = now() + FLASH
    },
    // The step is done: show it for a moment, then move on.
    next() {
      log('decision', { round, index: step, available: Math.round(decision.available), firstMove: decision.firstMove && Math.round(decision.firstMove), committed: Math.round(now()) })
      split.decide += (decision.firstMove ?? now()) - decision.available
      decision = null
      pauseUntil = now() + PAUSE
    },
    probe(type, size) { log('probe', { round, type, size: Math.round(size * 1000) / 1000 }) },
    // Call every frame the player is in the continuous phase, with how far they are
    // from where they're steering (screen units). The scorer measures probe responses
    // from it.
    steer(error) {
      steering = true
      if (now() - lastErrorLog < 30) return
      lastErrorLog = now()
      log('error', { round, value: Math.round(error * 10000) / 10000 })
    },
    progress(value) {
      if (now() - lastProgressLog < 100) return
      lastProgressLog = now()
      log('progress', { round, value: Math.round(value * 100) / 100 })
    },
    // Where the view is, whenever the logic moves it, so exploration can be reconstructed.
    view(x, y = 0) {
      const key = `${x.toFixed(3)},${y.toFixed(3)}`
      if (key === lastView) return
      lastView = key
      log('view', { x: +x.toFixed(3), y: +y.toFixed(3) })
    },
  }

  const logic = createLogic(api)

  function begin() {
    if (step === 0) {
      roundStart = now()
      roundWrong = 0
      split = { search: 0, decide: 0, steer: 0, wait: 0 }
    }
    log('phase', { name: 'step', round, step })
    decision = { available: now(), firstMove: null }
    logic.begin({ round, step })
  }

  function advance() {
    pauseUntil = null
    if (step < steps - 1) {
      step++
      return begin()
    }
    const ms = (value) => Math.round(value)
    log('round_end', { round, duration: ms(now() - roundStart), wrong: roundWrong, search: ms(Math.max(0, split.search - split.decide)), decide: ms(split.decide), steer: ms(split.steer), wait: ms(split.wait) })
    if (round < rounds) {
      round++
      step = 0
      return begin()
    }
    const total = now() / 1000 + penalty
    log('game_end', { total: Math.round(total * 100) / 100, penalties: penalty, viewport: [view.w, view.h], dpr: view.dpr, pointerType })
    finished = { score: total, penalty, wrong, risk: score(events, view, pointerType) }
  }

  function input(e) {
    pointerType = e.pointerType || pointerType
    if (e.kind === 'move') {
      log('pointer', { x: e.x, y: e.y, buttons: e.buttons, pointerType: e.pointerType, ct: e.ct })
      if (decision && decision.firstMove === null) decision.firstMove = now()
    } else {
      log(e.kind, { x: e.x, y: e.y })
    }
    pointer.x = e.x
    pointer.y = e.y
    if (e.kind === 'down') pointer.down = true
    if (e.kind === 'up') pointer.down = false
    if (!api.busy) logic.input(e)
  }

  function tick() {
    const t = now()
    const dt = Math.min(100, t - lastStep)
    lastStep = t
    if (pauseUntil !== null && t >= pauseUntil) advance()
    steering = false
    const frame = logic.step(finished ? 0 : dt / 1000)
    if (split && !finished) split[pauseUntil !== null ? 'wait' : steering ? 'steer' : 'search'] += dt
    const sprites = outbox
    outbox = []
    return {
      ...frame,
      sprites,
      column: api.width,
      hud: {
        round,
        rounds,
        time: finished ? finished.score : t / 1000 + penalty,
        penalty: t < flashUntil ? penaltySeconds : 0,
      },
      done: finished,
    }
  }

  return {
    handle(type, data) {
      if (type === 'start') {
        started = clock()
        view = data.view
        log('window', { kind: 'start', w: view.w, h: view.h, dpr: view.dpr })
        round = 1
        begin()
        return null
      }
      if (started === null) return null
      if (type === 'input') return input(data)
      if (type === 'window') {
        log('window', data)
        if (data.kind === 'resize') view = { ...view, w: data.w, h: data.h }
        return null
      }
      if (type === 'step') return tick()
      return null
    },
  }
}
