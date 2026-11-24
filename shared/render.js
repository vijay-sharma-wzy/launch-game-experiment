// CLIENT. Draws one display-only frame from the server onto a 2D canvas. A frame is a
// background and a list of shapes in screen units: (0, 0) is the centre of the screen,
// y points down, and the screen is 1 unit tall. Nothing here knows what a shape is
// or means; it only paints what it's told.
//
// The renderer adds its own small, per-frame noise (vertex jitter, line width and
// alpha wobble) so no pixel stays exactly the same from frame to frame (spec P5).

const jitter = (amount) => (Math.random() - 0.5) * 2 * amount
const hsl = ([h, s, l], a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`

// An outline's points (y up, about -1..1) placed on screen in pixels.
function place(shape, toPx, unit) {
  const [ax, ay] = toPx(shape.at)
  const cos = Math.cos(shape.rot || 0)
  const sin = Math.sin(shape.rot || 0)
  const s = shape.s * unit
  const sx = shape.sx ?? 1
  return shape.pts.map(([x, y]) => [
    ax + s * (x * sx * cos - y * sin) + jitter(0.6),
    ay - s * (x * sx * sin + y * cos) + jitter(0.6),
  ])
}

function tracePolygon(ctx, points, closed = true) {
  ctx.beginPath()
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  if (closed) ctx.closePath()
}

const painters = {
  // An outline, in one of the drawing styles the spec's §3 lists.
  shape(ctx, shape, toPx, unit) {
    const points = place(shape, toPx, unit)
    const alpha = (shape.alpha ?? 1) * (0.92 + jitter(0.06))
    const width = (shape.width ?? 3) * (1 + jitter(0.12))
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    if (shape.look === 'silhouette') {
      tracePolygon(ctx, points)
      ctx.fillStyle = hsl(shape.color, alpha)
      ctx.fill()
      return
    }
    if (shape.look === 'parts') {
      // Assembled from parts: each edge drawn on its own, pulled slightly apart.
      ctx.strokeStyle = hsl(shape.color, alpha)
      ctx.lineWidth = width
      const [cx, cy] = toPx(shape.at)
      points.forEach(([x, y], i) => {
        const [nx, ny] = points[(i + 1) % points.length]
        const mx = (x + nx) / 2 - cx
        const my = (y + ny) / 2 - cy
        const gap = (shape.gap ?? 0.08) * Math.hypot(mx, my)
        const ox = (mx / (Math.hypot(mx, my) || 1)) * gap
        const oy = (my / (Math.hypot(mx, my) || 1)) * gap
        ctx.beginPath()
        ctx.moveTo(x + ox + (nx - x) * 0.08, y + oy + (ny - y) * 0.08)
        ctx.lineTo(nx + ox - (nx - x) * 0.08, ny + oy - (ny - y) * 0.08)
        ctx.stroke()
      })
      return
    }
    if (shape.look === 'reveal') {
      // Partial reveal: a soft blur everywhere, the crisp outline only inside the lens.
      // The blur scales with the screen, so outside the lens an object is only a smudge.
      ctx.save()
      ctx.filter = `blur(${Math.round(unit * 0.014)}px)`
      tracePolygon(ctx, points)
      ctx.strokeStyle = hsl(shape.color, alpha * 0.35)
      ctx.lineWidth = width * 5
      ctx.stroke()
      ctx.restore()
      if (!shape.lens) return
      const [lx, ly] = toPx(shape.lens.at)
      ctx.save()
      ctx.beginPath()
      ctx.arc(lx, ly, shape.lens.r * unit, 0, 2 * Math.PI)
      ctx.clip()
      tracePolygon(ctx, points)
      ctx.strokeStyle = hsl(shape.color, alpha)
      ctx.lineWidth = width
      ctx.stroke()
      ctx.restore()
      return
    }
    tracePolygon(ctx, points)
    ctx.strokeStyle = hsl(shape.color, alpha)
    ctx.lineWidth = width
    ctx.stroke()
  },

  // A progress arc. It starts wherever the server says, so no fixed pixel shows progress.
  ring(ctx, ring, toPx, unit) {
    const [x, y] = toPx(ring.at)
    const r = ring.r * unit
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.strokeStyle = hsl(ring.color, (ring.alpha ?? 1) * 0.25)
    ctx.lineWidth = ring.width ?? 3
    ctx.stroke()
    if (ring.value <= 0) return
    ctx.beginPath()
    ctx.arc(x, y, r, ring.from ?? -Math.PI / 2, (ring.from ?? -Math.PI / 2) + ring.value * 2 * Math.PI)
    ctx.strokeStyle = hsl(ring.color, (ring.alpha ?? 1) * (0.9 + jitter(0.08)))
    ctx.lineWidth = (ring.width ?? 3) * 1.6
    if (ring.glow) {
      ctx.shadowColor = hsl(ring.color, ring.glow)
      ctx.shadowBlur = 16 * ring.glow
    }
    ctx.stroke()
    ctx.shadowBlur = 0
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

  // A soft round light.
  glow(ctx, g, toPx, unit) {
    const [x, y] = toPx(g.at)
    const r = g.r * unit
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, hsl(g.color, g.alpha ?? 1))
    gradient.addColorStop(1, hsl(g.color, 0))
    ctx.fillStyle = gradient
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
  },

  path(ctx, p, toPx) {
    if (p.pts.length < 2) return
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    tracePolygon(ctx, p.pts.map(toPx), false)
    ctx.strokeStyle = hsl(p.color, p.alpha ?? 1)
    ctx.lineWidth = p.width ?? 3
    ctx.stroke()
  },

  text(ctx, t, toPx, unit) {
    const [x, y] = toPx(t.at)
    ctx.font = `600 ${Math.round(t.size * unit)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = hsl(t.color, t.alpha ?? 1)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    ctx.shadowBlur = 6
    ctx.fillText(t.text, x, y)
    ctx.shadowBlur = 0
  },
}

// A slowly drifting, blotchy background in colours near the foreground's, so shapes
// can't be found just by looking for one colour against a plain backdrop.
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
  for (const item of frame.draw ?? []) painters[item.k]?.(ctx, item, toPx, unit)
}
