// SERVER ONLY (simulated). Word Wheel: turn a wheel of words to the one that answers
// a written clue, and hold it there. Design and spec scores: DESIGN.md.
import { word } from '../../shared/server/sprites.js'
import { palette } from '../../shared/server/palette.js'
import { createDrift, createHold } from '../../shared/server/steer.js'
import { between, pick, shuffle, sign } from '../../shared/server/random.js'

// ---- Tunables ----------------------------------------------------------------
export const ROUNDS = 3
export const STEPS = 3
export const PENALTY = 8      // seconds per wrong word: more than a step takes, so guessing never pays
const WORDS = 11              // words on the wheel: the answer and ten others of the same kind
const AWAY = [3.5, 4.5, 5.5]  // how many words the answer starts from the window, one per step in a random order: out of sight, and the same total turning for everyone (equal work)
const CENTRE = 0.06           // height of the window on screen (screen units; the screen is 1 tall, y down)
const SPACING = 0.1           // distance between words at the window
const CURVE = 0.4             // how far round the drum each word is from the next (radians)
const WORD_HEIGHT = 0.05
const ZONE = 0.3              // how close to the window a word must sit to count (in words): generous, so precision earns nothing
const STILL = 1.5             // the wheel must be turning slower than this for the hold to count (words a second)
const HOLD_SECONDS = 1.3      // long enough that pausing to read a word doesn't commit to it
const FRICTION = 3            // how fast a flicked wheel slows (per second)
const SLIP = { reach: 0.6, speed: 0.3 } // the wheel creeps under the finger (in words), so holding a word means steering against it
const END_GIVE = 0.4          // dragging past either end moves the wheel this much as far: a soft limit, not a hard stop

// ---- Clues -------------------------------------------------------------------
// Each kind of clue returns { clue, answer, others }: one answer and at least ten
// other words of the same kind, so the right word can't be picked out by its type.
// Dates and sums are generated, so there is no fixed list of clues to memorise.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const NUMBERS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
const COLOURS = { red: 'a ripe tomato', orange: 'a carrot', yellow: 'a ripe banana', green: 'fresh grass', blue: 'a clear daytime sky', purple: 'lavender flowers', pink: 'a flamingo', brown: 'milk chocolate', black: 'coal', white: 'fresh snow', grey: 'an elephant' }
const OPPOSITES = [['deep', 'shallow'], ['wide', 'narrow'], ['early', 'late'], ['full', 'empty'], ['smooth', 'rough'], ['sharp', 'blunt'], ['wet', 'dry'], ['heavy', 'light']]
const ONE_WAY = ['light'] // "the opposite of light" could be heavy or dark, so it is never asked
const ANIMALS = ['dog', 'cat', 'cow', 'horse', 'sheep', 'pig', 'hen', 'duck', 'frog', 'bee', 'owl', 'bat', 'whale', 'camel', 'spider', 'snail', 'eagle', 'shark', 'penguin', 'kangaroo', 'giraffe', 'elephant']
// `maybe` animals are arguable for the clue, so they are never on the wheel with it.
const ANIMAL_CLUES = [
  { clue: 'makes honey', answer: 'bee' },
  { clue: 'has a very long neck', answer: 'giraffe' },
  { clue: 'has a trunk', answer: 'elephant' },
  { clue: 'carries its baby in a pouch', answer: 'kangaroo' },
  { clue: 'is a bird that swims but cannot fly', answer: 'penguin', maybe: ['hen', 'duck'] },
  { clue: 'spins a web', answer: 'spider' },
  { clue: 'has a hump', answer: 'camel' },
  { clue: 'sleeps hanging upside down', answer: 'bat' },
  { clue: 'is a bird that hunts at night', answer: 'owl', maybe: ['eagle'] },
  { clue: 'carries its shell on its back', answer: 'snail' },
  { clue: 'barks', answer: 'dog' },
  { clue: 'is the largest animal in the sea', answer: 'whale', maybe: ['shark'] },
]

const KINDS = {
  month() {
    const from = Math.floor(Math.random() * 12)
    const [by, phrase] = pick([[1, 'the month after'], [-1, 'the month before'], [2, 'two months after'], [-2, 'two months before']])
    const answer = MONTHS[(from + by + 12) % 12]
    return { clue: `${phrase} ${MONTHS[from]}`, answer, others: MONTHS.filter((m) => m !== answer) }
  },
  sum() {
    const a = Math.floor(between(3, 10))
    const b = Math.floor(between(3, 10))
    const [value, clue] = pick([
      [a + b, `${NUMBERS[a - 1]} plus ${NUMBERS[b - 1]}`],
      [a, `${NUMBERS[a + b - 1]} minus ${NUMBERS[b - 1]}`],
      [2 * a, `twice ${NUMBERS[a - 1]}`],
      [a, `half of ${NUMBERS[2 * a - 1]}`],
    ])
    // The other words are the nearest numbers, so a rough guess isn't enough.
    const near = NUMBERS.map((_, i) => i + 1).filter((n) => n !== value).sort((m, n) => Math.abs(m - value) - Math.abs(n - value))
    return { clue, answer: NUMBERS[value - 1], others: near.slice(0, WORDS - 1).map((n) => NUMBERS[n - 1]) }
  },
  colour() {
    const answer = pick(Object.keys(COLOURS))
    return { clue: `the colour of ${COLOURS[answer]}`, answer, others: Object.keys(COLOURS).filter((c) => c !== answer) }
  },
  opposite() {
    const pair = pick(OPPOSITES)
    const [answer, of] = ONE_WAY.includes(pair[1]) || Math.random() < 0.5 ? [pair[1], pair[0]] : pair
    return { clue: `the opposite of ${of}`, answer, others: OPPOSITES.flat().filter((w) => w !== answer && w !== of) }
  },
  animal() {
    const { clue, answer, maybe = [] } = pick(ANIMAL_CLUES)
    return { clue: `the animal that ${clue}`, answer, others: ANIMALS.filter((a) => a !== answer && !maybe.includes(a)) }
  },
}

export default function createLogic(api) {
  const colors = palette()
  const frameColor = colors.ink()
  const ringColor = colors.ink(120)
  let deck = []
  let away = []
  let prompt = ''
  let words = []        // { sprite, struck }
  let answer = 0        // index of the right word
  let turned = 0        // which word the player has turned to (a fraction is between two words)
  let slip = createDrift(SLIP)
  let speed = 0         // words a second, from the latest drag, carried on when flicked
  let touched = false   // nothing counts until the player has moved the wheel this step
  let lastY = 0
  let lastMove = 0
  let heldWord = null   // the word the hold is filling for
  let wrongs = 0
  const hold = createHold(api, { seconds: HOLD_SECONDS, probe: () => slip.probe() / SLIP.speed, type: 'reversal' })

  const position = () => turned + slip.y // the word at the window, slip included

  function begin({ step }) {
    if (step === 0) away = shuffle(AWAY)
    if (!deck.length) deck = shuffle(Object.keys(KINDS))
    const { clue, answer: right, others } = KINDS[deck.pop()]()
    const list = shuffle(others).slice(0, WORDS - 1)
    // Put the answer where the window can start the set distance from it, either side.
    const side = sign()
    const room = WORDS - Math.ceil(away[step])
    answer = Math.floor(between(0, room)) + (side > 0 ? Math.ceil(away[step]) : 0)
    list.splice(answer, 0, right)
    words = list.map((text) => ({ sprite: api.sprite(word(text)), struck: false }))
    slip = createDrift(SLIP)
    turned = answer - side * away[step]
    speed = 0
    touched = false
    heldWord = null
    hold.reset()
    prompt = `Turn the wheel to ${clue}`
  }

  function input(e) {
    if (e.kind === 'down') lastY = e.y
    if (e.kind !== 'move' || !api.pointer.down) return
    // Dragging down brings earlier words into the window, like any picker wheel.
    const beyond = position() < 0 || position() > WORDS - 1
    const by = (-(e.y - lastY) / SPACING) * (beyond ? END_GIVE : 1)
    lastY = e.y
    turned += by
    speed = speed * 0.5 + (by / Math.max(0.008, (api.now() - lastMove) / 1000)) * 0.5
    lastMove = api.now()
    touched = true
  }

  function step(dt) {
    slip.step(dt)
    if (dt && !api.pointer.down) {
      turned += speed * dt
      speed *= Math.exp(-FRICTION * dt)
      // Past either end, ease back: a soft limit, so there's no hard stop to reset against.
      const back = Math.max(0, Math.min(WORDS - 1, position())) - position()
      turned += back * Math.min(1, dt * 6)
    } else if (dt) {
      speed *= Math.exp(-12 * dt) // a finger resting still isn't a flick
    }
    api.view(0, position())

    const at = Math.round(position())
    const error = Math.abs(position() - at)
    if (at !== heldWord) {
      heldWord = at
      hold.reset()
    }
    const settling = touched && api.pointer.down && Math.abs(speed) < STILL && !api.busy
    if (settling && words[at] && !words[at].struck && hold.step(dt, error < ZONE, error * SPACING)) {
      api.commit(words[at].sprite.id, at === answer)
      if (at === answer) api.next()
      else {
        words[at].struck = true
        hold.reset()
        wrongs++
      }
    }

    const edge = api.width / 2
    const draw = [-1, 1].map((side) => ({ k: 'path', pts: [[-edge + 0.03, CENTRE + side * SPACING * 0.5], [edge - 0.03, CENTRE + side * SPACING * 0.5]], color: frameColor, width: 2, alpha: 0.6 }))
    words.forEach((w, i) => {
      const angle = (i - position()) * CURVE
      if (Math.abs(angle) > 1.45) return
      const y = CENTRE + (SPACING / CURVE) * Math.sin(angle)
      const size = Math.cos(angle)
      draw.push({ k: 'sprite', id: w.sprite.id, at: [0, y], h: WORD_HEIGHT * size, alpha: size ** 1.5 * (w.struck ? 0.35 : 1) })
      // A word already tried is dimmed and struck through, so it isn't marked by brightness alone.
      if (w.struck) draw.push({ k: 'path', pts: [[-0.5 * WORD_HEIGHT * w.sprite.aspect * size, y], [0.5 * WORD_HEIGHT * w.sprite.aspect * size, y]], color: ringColor, width: 3, alpha: size })
    })
    draw.push({ k: 'ring', at: [edge - 0.05, CENTRE], r: 0.022, value: hold.value, color: ringColor, from: 0 })
    return { bg: colors.bg, draw, prompt }
  }

  function hint(_, wrongFirst) {
    const goal = wrongFirst && !wrongs ? (answer > 0 ? answer - 1 : answer + 1) : answer
    const { x, y, down } = api.pointer
    if (!down) return { x: 0, y: CENTRE, down: true }
    if (Math.abs(y) > 0.38) return { x, y, down: false } // run out of screen: lift and take a fresh grip
    return { x: 0, y: y + Math.max(-0.05, Math.min(0.05, (position() - goal) * SPACING)), down: true }
  }

  return { begin, input, step, hint }
}
