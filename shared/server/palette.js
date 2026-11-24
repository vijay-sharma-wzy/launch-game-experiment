// SERVER ONLY. A colour scheme picked fresh every session from ranges rather than fixed
// values (spec P5, P7): a dark background, and foreground colours whose hues also
// appear in the background's soft blobs, so no single colour picks out the shapes.
// Foregrounds stay light against a dark background for contrast (spec §1).
import { between } from './random.js'

export function palette() {
  const hue = between(0, 360)
  const ink = (shift = 0) => [Math.round((hue + 180 + shift + between(-30, 30)) % 360), Math.round(between(55, 85)), Math.round(between(68, 80))]
  return {
    ink,
    bg: {
      color: [Math.round(hue), Math.round(between(25, 45)), Math.round(between(8, 13))],
      blobs: Array.from({ length: 7 }, () => [Math.random(), Math.random(), between(0.15, 0.4), ink(), between(0.08, 0.18)]),
    },
  }
}
