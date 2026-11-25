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
