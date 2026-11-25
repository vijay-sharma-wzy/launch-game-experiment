// The solvability check and leak audit of the game framework (docs/game-generator-spec-v3.md
// §4 steps 6 and 7). A privileged solver, which may read the server's state through
// each game's `hint`, plays every game end to end through the same message path the
// client uses, on a simulated clock. Run it with `npm run solve`.
//
// It checks that every session can be finished, that the score is the time plus the
// penalties, and that nothing the client is sent names a thing, an answer or a role.
import { connect } from '../shared/transport.js'
import { createGameServer } from '../shared/server/game-server.js'

const GAMES = ['trail-forks', 'lights-out', 'word-wheel', 'odd-pair', 'two-halves']
const SESSIONS = 20
const FRAME = 1000 / 60
const SPEED = 1.2            // fastest the solver moves the pointer (screen heights a second)
const LIMIT = 300_000        // ms of game time before a session counts as stuck
const VIEWS = [{ w: 390, h: 844, dpr: 3 }, { w: 1440, h: 900, dpr: 2 }] // a phone and a desktop
const SENT_AS_TEXT = ['k', 'id', 'url', 'prompt'] // the only strings a frame may carry

// The sprite painter needs a canvas, which Node doesn't have. The solver never looks
// at pictures, so a canvas that accepts every call and draws nothing is enough.
const blank = new Proxy(function () {}, { get: (_, key) => (key === 'toDataURL' ? () => 'data:,' : key === 'measureText' ? () => ({ width: 80, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 80, actualBoundingBoxAscent: 80, actualBoundingBoxDescent: 0 }) : blank), apply: () => blank, set: () => true })
globalThis.document = { createElement: () => blank }

function audit(value, key, path) {
  if (typeof value === 'string' && !SENT_AS_TEXT.includes(key)) throw new Error(`text sent to the client at ${path}: ${value}`)
  if (['answer', 'correct', 'yes', 'odd', 'food', 'tile'].includes(key)) throw new Error(`server state sent to the client at ${path}`)
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) audit(v, Array.isArray(value) ? key : k, `${path}.${k}`)
}

async function play(game, session) {
  const { default: createLogic, ROUNDS, STEPS, PENALTY } = await import(`../games/${game}/logic.js`)
  let time = 0
  let logic
  const link = connect(createGameServer((api) => (logic = createLogic(api)), { rounds: ROUNDS, steps: STEPS, penaltySeconds: PENALTY, clock: () => time }))
  const wrongFirst = session % 4 === 0 // some sessions make one deliberate mistake, to check the penalty
  const pointer = { x: 0, y: 0.3, down: false }
  const send = (kind) => link.send('input', { kind, x: pointer.x, y: pointer.y, buttons: pointer.down ? 1 : 0, pointerType: 'mouse', ct: Math.round(time) })
  link.send('start', { view: VIEWS[session % VIEWS.length] })

  for (;;) {
    time += FRAME
    const frame = link.send('step')
    audit({ ...frame, done: null }, '', 'frame')
    if (frame.done) {
      const expected = time / 1000 + frame.done.penalty
      if (Math.abs(frame.done.score - expected) > 0.05) throw new Error(`score ${frame.done.score} is not time + penalties (${expected})`)
      if (wrongFirst && frame.done.penalty < PENALTY) throw new Error('a wrong commit was not penalised')
      if (!wrongFirst && frame.done.penalty) throw new Error('the solver was penalised without making a mistake')
      return { seconds: frame.done.score, risk: frame.done.risk.risk }
    }
    if (time > LIMIT) throw new Error(`stuck in round ${frame.hud.round}`)

    const want = logic.hint(time / 1000, wrongFirst)
    if (!want.down) {
      if (pointer.down) { pointer.down = false; send('up') }
      continue
    }
    const [dx, dy] = [want.x - pointer.x, want.y - pointer.y]
    const far = Math.hypot(dx, dy)
    const reach = Math.min(1, (SPEED * FRAME) / 1000 / (far || 1))
    pointer.x += dx * reach
    pointer.y += dy * reach
    send('move')
    if (!pointer.down && far < 0.004) { pointer.down = true; send('down') }
    else if (pointer.down && want.tap) { pointer.down = false; send('up') }
  }
}

let failed = false
for (const game of GAMES) {
  const times = []
  const risks = []
  for (let session = 0; session < SESSIONS; session++) {
    try {
      const { seconds, risk } = await play(game, session)
      times.push(seconds)
      risks.push(risk)
    } catch (error) {
      failed = true
      console.log(`${game} session ${session}: FAILED: ${error.message}`)
    }
  }
  const sorted = times.sort((a, b) => a - b)
  // The solver moves like the crudest bot: straight lines at one speed, with no lag.
  // Its risk scores show whether the scorer notices.
  console.log(`${game}: ${times.length}/${SESSIONS} finished, ${sorted[0]?.toFixed(1)}s to ${sorted.at(-1)?.toFixed(1)}s, risk ${Math.min(...risks).toFixed(2)} to ${Math.max(...risks).toFixed(2)}`)
}
process.exit(failed ? 1 : 0)
