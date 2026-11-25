// SERVER ONLY (simulated). Two Halves: among scattered halves of foods, join the two
// that make the one answering the prompt. Design and spec scores: DESIGN.md.
import { emojiHalves } from '../../shared/server/sprites.js'
import { palette } from '../../shared/server/palette.js'
import { createDrift, createHold } from '../../shared/server/steer.js'
import { between, pick, shuffle } from '../../shared/server/random.js'

// ---- Tunables ----------------------------------------------------------------
export const ROUNDS = 3
export const STEPS = 3
export const PENALTY = 8      // seconds per wrong food: more than a step takes, so guessing never pays
const FOODS = [4, 5, 6]       // foods cut in half, by round: later rounds have more halves to search
const APART = [0.24, 0.3, 0.36] // how far apart the answer's halves start, one per step in a random order (equal work)
const HEIGHT = 0.11           // height of a half (screen units; the screen is 1 tall); it is half as wide
const TOUCH = 0.055           // how close a press must be to a half to pick it up
const ROOM = 0.105            // smallest distance between two halves when they're dealt
const AREA = { top: -0.22, bottom: 0.42, margin: 0.05 }
const FIT = 0.022             // how closely two halves must line up to count: about 18 px on a phone, so precision earns nothing
const NEAR = 0.07             // within this, the player is clearly trying to join them, so the steering is measured
const HOLD_SECONDS = 0.9
const WANDER = { reach: 0.02, speed: 0.022 } // halves float, so the one being joined to has to be followed; fast enough that a person's lag behind a probe can be measured

// ---- Foods and prompts ---------------------------------------------------------
// "Join the two halves of the food that ...". `yes` foods answer the prompt. `maybe`
// foods are arguable, so they are never on the table with it.
const FOOD = ['🍎', '🍊', '🍋', '🍉', '🍓', '🍒', '🍇', '🍌', '🍍', '🥕', '🌽', '🍄', '🍞', '🧀', '🥚', '🍕', '🍔', '🍩', '🍪', '🎂', '🍦', '🍫', '🍯', '☕', '🥛', '🍿', '🥨', '🍅', '🥔', '🥦', '🌶️', '🥐']
const PROMPTS = [
  { text: 'you peel, and monkeys love', yes: ['🍌'] },
  { text: 'is sour and yellow', yes: ['🍋'] },
  { text: 'wears its seeds on the outside', yes: ['🍓'], maybe: ['🌽'] },
  { text: 'is red inside a thick green rind', yes: ['🍉'] },
  { text: 'grows underground and rabbits love', yes: ['🥕'], maybe: ['🥔'] },
  { text: 'is a ring with a hole in the middle', yes: ['🍩'], maybe: ['🥨'] },
  { text: 'a hen lays', yes: ['🥚'] },
  { text: 'bees make', yes: ['🍯'] },
  { text: 'you put birthday candles on', yes: ['🎂'], maybe: ['🍩', '🍪'] },
  { text: 'is frozen and served in a cone', yes: ['🍦'] },
  { text: 'is made from milk and full of holes', yes: ['🧀'] },
  { text: 'pops in a hot pan', yes: ['🍿'], maybe: ['🌽', '🥚'] },
  { text: 'is a hot drink', yes: ['☕'], maybe: ['🥛'] },
  { text: 'is baked as a loaf and sliced', yes: ['🍞'], maybe: ['🎂', '🥐'] },
  { text: 'grows in bunches on a vine and makes wine', yes: ['🍇'] },
  { text: 'burns your mouth with its heat', yes: ['🌶️'], maybe: ['☕', '🍕'] },
  { text: 'is a slice with cheese and toppings', yes: ['🍕'] },
  { text: 'is a patty in a bun', yes: ['🍔'] },
  { text: 'grows as an ear wrapped in a husk', yes: ['🌽'] },
  { text: 'is a fungus', yes: ['🍄'] },
  { text: 'has a spiky crown of leaves', yes: ['🍍'] },
  { text: 'comes from a cow and you drink it cold', yes: ['🥛'] },
  { text: 'is twisted into a knot and salted', yes: ['🥨'] },
  { text: 'is the fruit that ketchup is made from', yes: ['🍅'] },
]

export default function createLogic(api) {
  const colors = palette()
  const ringColor = colors.ink(120)
  const deck = shuffle(PROMPTS)
  let apart = []
  let prompt = ''
  let halves = []       // { sprite, food, side: -1 left | 1 right, home, drift, joined, spoiled }
  let answer = 0        // which food answers the prompt
  let held = null       // the half being dragged
  let grip = [0, 0]     // where on the half it was picked up
  let partner = null    // the half it's being lined up with
  let wrongs = 0
  const hold = createHold(api, { seconds: HOLD_SECONDS, probe: () => partner.drift.probe() })

  const place = (half) => [half.home[0] + half.drift.x, half.home[1] + half.drift.y]
  // How far `a` is from sitting flush against `b` to make a whole: a left half belongs
  // half a width to the left of a right half, and the other way round.
  const misfit = (a, b) => Math.hypot(place(a)[0] - place(b)[0] - a.side * HEIGHT * 0.5, place(a)[1] - place(b)[1])

  function begin({ round, step }) {
    if (step === 0) apart = shuffle(APART)
    const { text, yes, maybe = [] } = deck.shift()
    const right = pick(yes)
    const foods = shuffle([right, ...shuffle(FOOD.filter((f) => !yes.includes(f) && !maybe.includes(f))).slice(0, FOODS[round - 1] - 1)])
    answer = foods.indexOf(right)
    prompt = `Join the two halves of the food that ${text}`

    const edge = api.width / 2 - AREA.margin
    const inside = ([x, y]) => Math.abs(x) <= edge && y >= AREA.top && y <= AREA.bottom
    const anywhere = () => [between(-edge, edge), between(AREA.top, AREA.bottom)]
    const spots = []
    const clear = (p, room) => inside(p) && spots.every((s) => Math.hypot(p[0] - s[0], p[1] - s[1]) >= room)
    // The answer's halves go down first, the set distance apart; the rest fill in
    // around them, as far from each other as there's room for.
    for (;;) {
      const first = anywhere()
      const angle = between(0, 2 * Math.PI)
      const second = [first[0] + Math.cos(angle) * apart[step], first[1] + Math.sin(angle) * apart[step]]
      if (!inside(second)) continue
      spots.push(first, second)
      break
    }
    for (let room = ROOM, tries = 0; spots.length < foods.length * 2; tries++) {
      const p = anywhere()
      if (clear(p, room)) spots.push(p)
      else if (tries % 200 === 199) room *= 0.92
    }
    const rest = shuffle(spots.slice(2))
    halves = foods.flatMap((food, i) => emojiHalves(food).map((picture, n) => ({
      sprite: api.sprite(picture),
      food: i,
      side: n ? 1 : -1,
      home: i === answer ? spots[n] : rest.pop(),
      drift: createDrift(WANDER),
      joined: false,
      spoiled: false,
    })))
    halves = shuffle(halves) // so the order they're drawn in says nothing
    held = partner = null
    hold.reset()
  }

  function input(e) {
    if (e.kind === 'down') {
      const loose = halves.filter((h) => !h.joined)
      loose.sort((a, b) => Math.hypot(e.x - place(a)[0], e.y - place(a)[1]) - Math.hypot(e.x - place(b)[0], e.y - place(b)[1]))
      const [x, y] = loose.length ? place(loose[0]) : [9, 9]
      held = Math.hypot(e.x - x, e.y - y) < TOUCH ? loose[0] : null
      grip = [x - e.x, y - e.y]
    }
    if (e.kind === 'up') held = null
  }

  function step(dt) {
    for (const half of halves) if (half !== held) half.drift.step(dt)
    if (held && !api.busy) {
      // The held half goes exactly where the pointer takes it, kept on the table.
      const edge = api.width / 2 - 0.02
      held.home = [Math.max(-edge, Math.min(edge, api.pointer.x + grip[0])) - held.drift.x, Math.max(-0.3, Math.min(0.46, api.pointer.y + grip[1])) - held.drift.y]
      // Only two halves of the same food join. Halves of different foods just don't fit.
      const match = halves.find((h) => h.food === held.food && h !== held)
      if (match !== partner) {
        partner = match
        hold.reset()
      }
      const error = misfit(held, match)
      if (error < NEAR && hold.step(dt, error < FIT, error)) {
        // The halves fuse. Only now does the player find out whether it was the right food.
        api.commit(held.sprite.id, held.food === answer)
        held.joined = match.joined = true
        held.drift = match.drift
        held.home = [match.home[0] + held.side * HEIGHT * 0.5, match.home[1]]
        if (held.food === answer) api.next()
        else {
          held.spoiled = match.spoiled = true
          wrongs++
        }
        held = null
      }
    } else if (!held) {
      hold.reset()
    }

    const draw = []
    for (const half of [...halves.filter((h) => h !== held), ...(held ? [held] : [])]) {
      const at = place(half)
      draw.push({ k: 'sprite', id: half.sprite.id, at, h: HEIGHT, alpha: half.spoiled ? 0.35 : 1 })
      // A wrong food is dimmed and crossed out, so it isn't marked by brightness alone.
      if (half.spoiled && half.side < 0) {
        const [x, y] = [at[0] + HEIGHT * 0.25, at[1]]
        draw.push({ k: 'path', pts: [[x - 0.04, y - 0.04], [x + 0.04, y + 0.04]], color: ringColor, width: 4 }, { k: 'path', pts: [[x + 0.04, y - 0.04], [x - 0.04, y + 0.04]], color: ringColor, width: 4 })
      }
    }
    if (held && hold.value > 0) draw.push({ k: 'ring', at: [place(partner)[0] - partner.side * HEIGHT * 0.25, place(partner)[1]], r: HEIGHT * 0.72, value: hold.value, color: ringColor, from: 2 })
    return { bg: colors.bg, draw, prompt }
  }

  function hint(_, wrongFirst) {
    const goal = wrongFirst && !wrongs ? (answer + 1) % (halves.length / 2) : answer
    const [mine, other] = halves.filter((h) => h.food === goal)
    if (api.pointer.down && held !== mine) return { x: api.pointer.x, y: api.pointer.y, down: false }
    if (!held) return { x: place(mine)[0], y: place(mine)[1], down: true }
    return { x: place(other)[0] + mine.side * HEIGHT * 0.5 - grip[0], y: place(other)[1] - grip[1], down: true }
  }

  return { begin, input, step, hint }
}
