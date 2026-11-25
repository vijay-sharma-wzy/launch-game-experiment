// CLIENT. Draws one display-only frame from the server onto a 2D canvas. A frame is a
// background and a list of things to paint, in screen units: (0, 0) is the centre of
// the screen, y points down, and the screen is 1 unit tall. Nothing here knows what
// anything is or means; pictures arrive as finished images under random ids.
//
// The renderer adds its own small, per-frame noise (position jitter, line width and
// alpha wobble) so no pixel stays exactly the same from frame to frame (spec P5).

const jitter = (amount) => (Math.random() - 0.5) * 2 * amount
const hsl = ([h, s, l], a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`
const images = new Map()

// Pictures the server has sent, kept by id for the frames that use them.
export function addSprites(sprites) {
  for (const { id, url } of sprites) {
    const image = new Image()
    image.src = url
    images.set(id, image)
  }
}

const painters = {
  // A picture, `h` tall, optionally turned.
  sprite(ctx, s, toPx, unit) {
    const image = images.get(s.id)
    if (!image?.complete || !image.naturalWidth) return
    const [x, y] = toPx(s.at)
    const h = s.h * unit
    const w = h * (image.naturalWidth / image.naturalHeight)
    ctx.save()
    ctx.globalAlpha = (s.alpha ?? 1) * (0.96 + jitter(0.04))
    ctx.translate(x + jitter(0.4), y + jitter(0.4))
    ctx.rotate(s.rot ?? 0)
    ctx.scale(s.sx ?? 1, 1)
    ctx.drawImage(image, -w / 2, -h / 2, w, h)
    ctx.restore()
  },

  // A rounded rectangle, filled or outlined.
  rect(ctx, r, toPx, unit) {
    const [x, y] = toPx(r.at)
    const w = r.w * unit
    const h = r.h * unit
    ctx.beginPath()
    ctx.roundRect(x - w / 2, y - h / 2, w, h, (r.r ?? 0) * unit)
    if (r.fill) {
      ctx.fillStyle = hsl(r.color, r.alpha ?? 1)
      ctx.fill()
    } else {
      ctx.strokeStyle = hsl(r.color, r.alpha ?? 1)
      ctx.lineWidth = (r.width ?? 2) * (1 + jitter(0.1))
      ctx.stroke()
    }
  },

  // A progress arc. It starts wherever the server says, so no fixed pixel shows progress.
  ring(ctx, ring, toPx, unit) {
    const [x, y] = toPx(ring.at)
    const r = ring.r * unit
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.strokeStyle = hsl(ring.color, (ring.alpha ?? 1) * 0.3)
    ctx.lineWidth = ring.width ?? 3
    ctx.stroke()
    if (ring.value <= 0) return
    ctx.beginPath()
    ctx.arc(x, y, r, ring.from ?? -Math.PI / 2, (ring.from ?? -Math.PI / 2) + ring.value * 2 * Math.PI)
    ctx.strokeStyle = hsl(ring.color, (ring.alpha ?? 1) * (0.9 + jitter(0.08)))
    ctx.lineWidth = (ring.width ?? 3) * 1.8
    ctx.stroke()
  },

  circle(ctx, c, toPx, unit) {
    const [x, y] = toPx(c.at)
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.5, c.r * unit), 0, 2 * Math.PI)
    if (c.fill) {
      ctx.fillStyle = hsl(c.color, c.alpha ?? 1)
      ctx.fill()
    } else {
      ctx.strokeStyle = hsl(c.color, c.alpha ?? 1)
      ctx.lineWidth = c.width ?? 2
      ctx.stroke()
    }
  },

  // An open line through points.
  path(ctx, p, toPx) {
    if (p.pts.length < 2) return
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    p.pts.map(toPx).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.strokeStyle = hsl(p.color, (p.alpha ?? 1) * (0.94 + jitter(0.06)))
    ctx.lineWidth = (p.width ?? 3) * (1 + jitter(0.08))
    ctx.stroke()
  },
}

// A slowly drifting, blotchy background in colours near the foreground's, so nothing
// can be found just by looking for one colour against a plain backdrop.
function paintBackground(ctx, w, h, bg, time) {
  const [hue, sat, light] = bg.color
  const gradient = ctx.createLinearGradient(0, 0, w, h)
  gradient.addColorStop(0, hsl([hue, sat, light]))
  gradient.addColorStop(1, hsl([hue + 30, sat, Math.max(4, light - 4)]))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
  for (const [i, blob] of (bg.blobs ?? []).entries()) {
    const x = (blob[0] + 0.03 * Math.sin(time * 0.2 + i)) * w
    const y = (blob[1] + 0.03 * Math.cos(time * 0.17 + i * 2)) * h
    const r = blob[2] * h
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, hsl(blob[3], blob[4] * (0.8 + 0.2 * Math.sin(time * 0.5 + i))))
    g.addColorStop(1, hsl(blob[3], 0))
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
  }
}

export function render(ctx, frame, w, h, time) {
  const unit = h
  const toPx = ([x, y]) => [w / 2 + x * unit, h / 2 + y * unit]
  if (frame.bg) paintBackground(ctx, w, h, frame.bg, time)
  // The play area is a column no wider than a phone, so every device shows the same
  // amount of the game. Anything beyond it is clipped and the sides are dimmed.
  const column = frame.column * unit
  ctx.save()
  ctx.beginPath()
  ctx.rect((w - column) / 2, 0, column, h)
  ctx.clip()
  for (const item of frame.draw ?? []) painters[item.k]?.(ctx, item, toPx, unit)
  ctx.restore()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.fillRect(0, 0, (w - column) / 2, h)
  ctx.fillRect((w + column) / 2, 0, (w - column) / 2, h)
}
