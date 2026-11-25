// SERVER ONLY (simulated). Lights Out: memorise where things are, then find the one
// that answers a clue after they've been covered. Design and spec scores: DESIGN.md.
import { emoji, word } from '../../shared/server/sprites.js'
import { palette } from '../../shared/server/palette.js'
import { createDrift } from '../../shared/server/steer.js'
import { between, pick, shuffle } from '../../shared/server/random.js'

// ---- Tunables ----------------------------------------------------------------
export const ROUNDS = 3
export const STEPS = 3
export const PENALTY = 8      // seconds per wrong cover: more than a step takes, so guessing never pays
const ITEMS = [6, 8, 10]      // things to memorise, by round
const CLUES = 5               // clues ready per round: three to answer, and spares so relighting never brings the same clue back
const COLUMNS = 3
const GAP = 0.14              // distance between tiles (screen units; the screen is 1 tall)
const TILE = 0.115            // width and height of a tile
const ICON = 0.085            // height of a thing
const TOP = -0.2              // height of the first row
const NEED = 0.45             // how much rubbing takes a cover off: a few short strokes, never one accidental swipe
const FADE = 0.12             // how fast rubbing wears off a cover the player has left (a second)
const STROKE = 0.08           // longest move counted as one stroke; anything longer is a jump, not a rub
const SHOW = 900              // ms a wrong thing stays uncovered: long enough to re-learn it
const WANDER = { reach: 0.02, speed: 0.022 } // covers float, so rubbing one means following it
const RECENT = 300            // ms of rubbing whose middle is compared with the cover's, to see how well the player follows it
const BUTTON = { at: [0, 0.42], w: 0.27, h: 0.065 }

// ---- Things and clues ----------------------------------------------------------
// "Scratch the cover off the thing that ...". `yes` things answer the clue. `maybe`
// things are arguable, so they are never on the board with it.
const THINGS = ['🔑', '✂️', '🔨', '🕯️', '☂️', '⏰', '📞', '🧲', '🔦', '🧹', '🧺', '🧦', '🧤', '👓', '🎩', '👟', '📖', '✏️', '🔒', '💡', '🧼', '🍴', '🥄', '🔪', '☕', '🧯', '📷', '🎧', '🧭', '🔔', '📎', '🖌️', '🔧', '🧸']
const PROMPTS = [
  { text: 'cuts paper', yes: ['✂️'], maybe: ['🔪'] },
  { text: 'opens a lock', yes: ['🔑'] },
  { text: 'drives in a nail', yes: ['🔨'], maybe: ['🔧'] },
  { text: 'wakes you up in the morning', yes: ['⏰'], maybe: ['📞', '🔔', '☕'] },
  { text: 'keeps the rain off you', yes: ['☂️'], maybe: ['🎩'] },
  { text: 'lights your way and runs on batteries', yes: ['🔦'], maybe: ['💡', '📞'] },
  { text: 'burns with a flame', yes: ['🕯️'] },
  { text: 'sweeps the floor', yes: ['🧹'] },
  { text: 'you wear on your hands', yes: ['🧤'] },
  { text: 'you wear inside your shoes', yes: ['🧦'], maybe: ['👟'] },
  { text: 'helps you read small print', yes: ['👓'], maybe: ['💡', '🔦'] },
  { text: 'you eat soup with', yes: ['🥄'], maybe: ['🍴'] },
  { text: 'sticks to a fridge door', yes: ['🧲'] },
  { text: 'you wash your hands with', yes: ['🧼'] },
  { text: 'takes photographs', yes: ['📷'], maybe: ['📞'] },
  { text: 'points north', yes: ['🧭'] },
  { text: 'you wear over your ears to hear music', yes: ['🎧'] },
  { text: 'puts out a fire', yes: ['🧯'] },
  { text: 'tightens a bolt', yes: ['🔧'] },
  { text: 'you sharpen and write with', yes: ['✏️'] },
  { text: 'clips sheets of paper together', yes: ['📎'] },
  { text: 'you paint with', yes: ['🖌️'] },
  { text: 'you carry the washing in', yes: ['🧺'] },
  { text: 'a small child cuddles in bed', yes: ['🧸'] },
]

export default function createLogic(api) {
  const colors = palette()
  const coverColor = colors.ink()
  const markColor = colors.ink(120)
  const labels = { off: api.sprite(word('Lights off')), on: api.sprite(word('Lights on')) }
  let time = 0
  let tiles = []        // { sprite, home, drift, rub, marks, open, shownUntil, probeAt }
  let queue = []        // clues not yet answered: { text, tile }
  let clue = null       // the clue on screen, once the lights are off
  let lit = true        // lights on: everything visible, no clue. The clue and the things are never visible together
  let pressed = false   // did this press start on the button?
  let last = null       // previous pointer position, for measuring strokes
  let rubbing = null    // the tile under the pointer this frame
  let strokes = []      // recent rubbing: [time, x, y]
  let wrongs = 0

  const place = (tile) => [tile.home[0] + tile.drift.x, tile.home[1] + tile.drift.y]
  const over = (box, x, y) => Math.abs(x - box.at[0]) < box.w / 2 && Math.abs(y - box.at[1]) < box.h / 2
  const covered = (tile) => !lit && !tile.open && api.now() >= tile.shownUntil

  // A new board: pick clues that each have exactly one answer on it and nothing
  // arguable, then fill the rest with things none of those clues could mean.
  function deal(count) {
    const chosen = []
    for (const prompt of shuffle(PROMPTS)) {
      const meanings = [...prompt.yes, ...(prompt.maybe ?? [])]
      const answer = pick(prompt.yes)
      const clash = chosen.some((c) => meanings.includes(c.answer) || c.meanings.includes(answer))
      if (!clash && chosen.length < CLUES) chosen.push({ text: prompt.text, answer, meanings })
    }
    const taken = chosen.flatMap((c) => c.meanings)
    const things = shuffle([...chosen.map((c) => c.answer), ...shuffle(THINGS.filter((t) => !taken.includes(t))).slice(0, count - chosen.length)])
    const rows = Math.ceil(count / COLUMNS)
    tiles = things.map((thing, i) => {
      const inRow = Math.min(COLUMNS, count - Math.floor(i / COLUMNS) * COLUMNS)
      return {
        sprite: api.sprite(emoji(thing)),
        home: [((i % COLUMNS) - (inRow - 1) / 2) * GAP, TOP + Math.floor(i / COLUMNS) * GAP + (4 - rows) * GAP * 0.3],
        drift: createDrift(WANDER),
        rub: 0,
        marks: [],
        open: false,
        shownUntil: 0,
        probeAt: between(0.2, 0.6),
      }
    })
    queue = chosen.map((c) => ({ text: c.text, tile: tiles[things.indexOf(c.answer)] }))
  }

  function begin({ round, step }) {
    if (step === 0) {
      deal(ITEMS[round - 1])
      lit = true
      clue = null
    } else {
      clue = queue.shift()
    }
  }

  function input(e) {
    if (e.kind === 'down') {
      pressed = over(BUTTON, e.x, e.y)
      last = [e.x, e.y]
    }
    if (e.kind === 'up' && pressed && over(BUTTON, e.x, e.y)) {
      lit = !lit
      // Every time the lights go out the clue is a different one, so relighting is
      // for re-learning the board, never for looking up the answer to a clue in hand.
      if (!lit) {
        if (clue) queue.push(clue)
        clue = queue.shift()
      }
    }
    if (e.kind !== 'move' || !api.pointer.down || lit) return
    const tile = tiles.find((t) => covered(t) && over({ at: place(t), w: TILE, h: TILE }, e.x, e.y))
    const moved = last ? Math.hypot(e.x - last[0], e.y - last[1]) : 0
    last = [e.x, e.y]
    rubbing = tile && moved <= STROKE ? tile : null
    if (!rubbing) return
    tile.rub += moved
    strokes.push([api.now(), e.x, e.y])
    tile.marks.push([e.x - place(tile)[0], e.y - place(tile)[1]])
    if (tile.marks.length > 60) tile.marks.shift()
  }

  function step(dt) {
    time += dt
    for (const tile of tiles) {
      tile.drift.step(dt)
      if (tile !== rubbing) tile.rub = Math.max(0, tile.rub - FADE * dt)
      if (!tile.rub) tile.marks = []
    }
    if (rubbing && !api.busy) {
      const tile = rubbing
      const [x, y] = place(tile)
      // Strokes go back and forth across the cover, so the pointer itself is rarely on
      // its centre. The middle of the last few strokes is what follows the cover.
      strokes = strokes.filter(([t]) => t > api.now() - RECENT)
      const middle = strokes.reduce((sum, [, sx, sy]) => [sum[0] + sx / strokes.length, sum[1] + sy / strokes.length], [0, 0])
      if (strokes.length) api.steer(Math.hypot(middle[0] - x, middle[1] - y))
      api.progress(Math.min(1, tile.rub / NEED))
      if (tile.probeAt !== null && tile.rub / NEED >= tile.probeAt) {
        tile.probeAt = null
        api.probe('nudge', tile.drift.probe())
      }
      if (tile.rub >= NEED) {
        // The cover comes off. Only now does the player see what was under it.
        api.commit(tile.sprite.id, tile === clue.tile)
        tile.rub = 0
        tile.marks = []
        if (tile === clue.tile) {
          tile.open = true
          api.next()
        } else {
          tile.shownUntil = api.now() + SHOW
          wrongs++
        }
      }
    }
    if (!api.pointer.down) rubbing = null

    const draw = []
    for (const tile of tiles) {
      const at = place(tile)
      const wrong = !lit && !tile.open && api.now() < tile.shownUntil
      if (covered(tile)) {
        draw.push({ k: 'rect', at, w: TILE, h: TILE, r: 0.015, color: coverColor, fill: true, alpha: 0.5 }, { k: 'rect', at, w: TILE, h: TILE, r: 0.015, color: coverColor, width: 2 })
        if (tile.marks.length > 1) draw.push({ k: 'path', pts: tile.marks.map(([x, y]) => [at[0] + x, at[1] + y]), color: markColor, width: 5, alpha: 0.3 + 0.6 * Math.min(1, tile.rub / NEED) })
        continue
      }
      draw.push({ k: 'rect', at, w: TILE, h: TILE, r: 0.015, color: coverColor, width: 1, alpha: 0.4 }, { k: 'sprite', id: tile.sprite.id, at, h: ICON, alpha: wrong ? 0.5 : 1 })
      if (wrong) draw.push({ k: 'path', pts: [[at[0] - 0.04, at[1] - 0.04], [at[0] + 0.04, at[1] + 0.04]], color: markColor, width: 4 }, { k: 'path', pts: [[at[0] + 0.04, at[1] - 0.04], [at[0] - 0.04, at[1] + 0.04]], color: markColor, width: 4 })
    }
    draw.push({ k: 'rect', ...BUTTON, r: 0.03, color: markColor, fill: true, alpha: 0.25 }, { k: 'rect', ...BUTTON, r: 0.03, color: markColor, width: 2 }, { k: 'sprite', id: (lit ? labels.off : labels.on).id, at: BUTTON.at, h: 0.04 })
    return { bg: colors.bg, draw, prompt: lit ? 'Memorise where everything is, then tap Lights off' : `Scratch the cover off the thing that ${clue.text}` }
  }

  function hint(seconds, wrongFirst) {
    if (lit) return { x: BUTTON.at[0], y: BUTTON.at[1], down: true, tap: true }
    const goal = wrongFirst && !wrongs ? tiles.find((t) => t !== clue.tile && covered(t)) : clue.tile
    const [x, y] = place(goal)
    return { x: x + 0.035 * Math.sin(seconds * 16), y: y + 0.02 * Math.sin(seconds * 11), down: true }
  }

  return { begin, input, step, hint }
}
