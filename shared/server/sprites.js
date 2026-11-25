// SERVER ONLY (simulated). Draws the pictures and words a game shows, and hands the
// client finished images. The client never learns which emoji or word an image is:
// it gets pixels under a random id (see `sprite` in game-server.js), exactly as it
// would if the real server streamed them (spec §1).
//
// The pictures are the device's own emoji, so they need no asset files. They look a
// little different on each platform; a real release would bundle its own drawings.
const SIZE = 144
const FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
const cache = new Map()

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

// The emoji drawn with its visible bounds centred, so that cutting it down the middle
// gives two fair halves.
function drawn(char) {
  const c = canvas(SIZE, SIZE)
  const ctx = c.getContext('2d')
  ctx.font = `${SIZE * 0.72}px ${FONT}`
  ctx.textBaseline = 'alphabetic'
  const m = ctx.measureText(char)
  const x = (SIZE - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft)) / 2
  const y = (SIZE + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent)) / 2
  ctx.fillText(char, x, y)
  return c
}

const cached = (key, make) => cache.get(key) ?? cache.set(key, make()).get(key)

export const emoji = (char) => cached(char, () => ({ url: drawn(char).toDataURL(), aspect: 1 }))

// The left and right halves of an emoji, as two separate pictures.
export const emojiHalves = (char) => cached(`${char}/2`, () => {
  const whole = drawn(char)
  return [0, SIZE / 2].map((from) => {
    const half = canvas(SIZE / 2, SIZE)
    half.getContext('2d').drawImage(whole, from, 0, SIZE / 2, SIZE, 0, 0, SIZE / 2, SIZE)
    return { url: half.toDataURL(), aspect: 0.5 }
  })
})

// A word or short label as a picture, so text that matters to the game never
// reaches the client as text.
export const word = (text) => cached(`"${text}"`, () => {
  const height = 64
  const font = `600 ${height * 0.7}px system-ui, sans-serif`
  const measure = canvas(1, 1).getContext('2d')
  measure.font = font
  const width = Math.ceil(measure.measureText(text).width) + 16
  const c = canvas(width, height)
  const ctx = c.getContext('2d')
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#f4f1e8'
  ctx.fillText(text, width / 2, height / 2)
  return { url: c.toDataURL(), aspect: width / height }
})
