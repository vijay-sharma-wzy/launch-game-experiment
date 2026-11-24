// SERVER ONLY (simulated). The framework every game's logic runs inside: the
// server-side clock, penalties, rounds, and the telemetry of spec §6, recorded from
// the input the server receives rather than from anything the client says about
// itself.
//
// This is a stand-in for the real AWS backend (see CLAUDE.md). It runs in the browser
// for now, so it is NOT real security: the answers ship in the same bundle. It is
// kept apart from the client, and only reached through shared/transport.js, so it can
// be lifted into a Lambda or WebSocket service unchanged.
import { score } from './scorer.js'

// `createLogic(api)` builds one game's rules. It returns { start(view), input(event),
// step(dt) }: step returns the display-only frame (see shared/render.js).
export function createGameServer(createLogic, { rounds, penaltySeconds }) {
  const events = []
  let started = null
  let view = { w: 1, h: 1, dpr: 1 }
  let lastStep = 0
  let penalty = 0
  let wrong = 0
  let round = 0
  let roundStart = 0
  let roundWrong = 0
  let flashUntil = 0
  let finished = null
  let lastErrorLog = -Infinity
  let lastProgressLog = -Infinity
  let pointerType = 'mouse'
  const pointer = { x: 0, y: 0, down: false }
  const decisions = new Map()
  let decisionIndex = 0

  const now = () => performance.now() - started
  const log = (type, fields = {}) => events.push({ type, t: Math.round(now()), ...fields })

  // Everything a game's logic may use.
  const api = {
    now,
    pointer,
    rounds,
    get round() { return round },
    // Visible area in screen units: height 1, width = aspect ratio.
    get aspect() { return view.w / view.h },
    startRound() {
      round++
      roundStart = now()
      roundWrong = 0
      decisionIndex = 0
      log('phase', { name: 'round', round })
    },
    phase(name) { log('phase', { name, round }) },
    // A semantic choice became available (spec §6 `decision`). Close it when the
    // player commits to something for it.
    openDecision(key) {
      decisions.set(key, { round, index: decisionIndex++, available: now(), firstMove: null })
    },
    closeDecision(key) {
      const d = decisions.get(key)
      if (!d) return
      decisions.delete(key)
      log('decision', { round: d.round, index: d.index, available: Math.round(d.available), firstMove: d.firstMove && Math.round(d.firstMove), committed: Math.round(now()) })
    },
    // `candidate` is an opaque id. A wrong commit costs penaltySeconds.
    commit(candidate, correct) {
      log('commit', { round, candidate, correct })
      if (correct) return
      penalty += penaltySeconds
      wrong++
      roundWrong++
      flashUntil = now() + 1600
    },
    probe(type, size) { log('probe', { round, type, size: Math.round(size * 1000) / 1000 }) },
    // How far the player is from where they're steering (screen units). The scorer
    // measures probe responses from it, so log it while the player is in control.
    error(value) {
      if (now() - lastErrorLog < 30) return
      lastErrorLog = now()
      log('error', { round, value: Math.round(value * 10000) / 10000 })
    },
    progress(value) {
      if (now() - lastProgressLog < 100) return
      lastProgressLog = now()
      log('progress', { round, value: Math.round(value * 100) / 100 })
    },
    endRound() { log('round_end', { round, duration: Math.round(now() - roundStart), wrong: roundWrong }) },
    finish() {
      const total = now() / 1000 + penalty
      log('game_end', { total: Math.round(total * 100) / 100, penalties: penalty, viewport: [view.w, view.h], dpr: view.dpr, pointerType })
      finished = { score: total, penalty, wrong, risk: score(events, view, pointerType) }
    },
  }

  const logic = createLogic(api)

  function input(e) {
    pointerType = e.pointerType || pointerType
    if (e.kind === 'move') {
      log('pointer', { x: e.x, y: e.y, buttons: e.buttons, pointerType: e.pointerType, ct: e.ct })
      for (const d of decisions.values()) if (d.firstMove === null) d.firstMove = now()
    } else {
      log(e.kind, { x: e.x, y: e.y })
    }
    pointer.x = e.x
    pointer.y = e.y
    pointer.down = e.kind === 'down' || (e.kind === 'move' && pointer.down)
    if (e.kind === 'up') pointer.down = false
    if (!finished) logic.input(e)
  }

  function step() {
    const t = now()
    const dt = Math.min(0.1, (t - lastStep) / 1000)
    lastStep = t
    const frame = logic.step(finished ? 0 : dt)
    return {
      ...frame,
      hud: {
        round: Math.max(round, 1),
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
        started = performance.now()
        view = data.view
        log('window', { kind: 'start', w: view.w, h: view.h, dpr: view.dpr })
        logic.start(view)
        return null
      }
      if (started === null) return null
      if (type === 'input') return input(data)
      if (type === 'window') {
        log('window', data)
        if (data.kind === 'resize') view = { ...view, w: data.w, h: data.h }
        return null
      }
      if (type === 'step') return step()
      return null
    },
  }
}
