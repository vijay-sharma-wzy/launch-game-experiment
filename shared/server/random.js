// SERVER ONLY. Small randomness helpers shared by the games' logic.
export const between = (low, high) => low + Math.random() * (high - low)
export const pick = (list) => list[Math.floor(Math.random() * list.length)]
export const sign = () => (Math.random() < 0.5 ? -1 : 1)

export function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Calls `fire` at random moments, `gap` seconds apart on average, while `step` is
// called: used for probes (spec P4), so a player can't predict them.
export function randomTimer([low, high], fire) {
  let wait = between(low, high)
  return (dt) => {
    wait -= dt
    if (wait > 0) return
    wait = between(low, high)
    fire()
  }
}
