// SERVER ONLY. The moving parts of every game's continuous phase (spec P4): things
// that wander so the player has to keep steering, and the small probes hidden in
// that wandering whose responses the scorer measures.
import { between } from './random.js'

// A point that wanders near its home at about `speed` (screen units a second), never
// further than about `reach`, and never regularly: it keeps picking a new heading,
// eases into it, and is pulled gently back when it strays.
export function createDrift({ reach, speed }) {
  let x = 0
  let y = 0
  let vx = 0
  let vy = 0
  let aimX = 0
  let aimY = 0
  let wait = 0
  function aim(angle = between(0, 2 * Math.PI)) {
    const s = between(0.6, 1) * speed
    aimX = Math.cos(angle) * s
    aimY = Math.sin(angle) * s
    wait = between(0.8, 2)
  }
  aim()
  return {
    get x() { return x },
    get y() { return y },
    step(dt) {
      wait -= dt
      if (wait <= 0) aim()
      const ease = Math.min(1, dt * 5)
      vx += (aimX - (x / reach) * speed - vx) * ease
      vy += (aimY - (y / reach) * speed - vy) * ease
      x += vx * dt
      y += vy * dt
    },
    // A probe: turn to head roughly back the way it came, a little faster. It eases
    // in over a few frames like any other change of heading, so a person just keeps
    // following, while a controller that assumed steady motion falls behind.
    // Returns the size of the change, for the telemetry.
    probe() {
      const before = Math.hypot(aimX, aimY)
      aim(Math.atan2(-aimY, -aimX) + between(-0.6, 0.6))
      aimX *= 1.3
      aimY *= 1.3
      return before + Math.hypot(aimX, aimY)
    },
  }
}

// A ring that fills while the player keeps something lined up for `seconds`. It
// pauses when they slip and never drains (a slow response must cost little), and it
// fires one probe at a moment the player can't predict. One hold per step is three
// or more probes a round.
export function createHold(api, { seconds, probe, type = 'reversal' }) {
  let value = 0
  let probeAt = between(0.15, 0.55)
  return {
    get value() { return value },
    reset() {
      value = 0
      probeAt = between(0.15, 0.55)
    },
    // Call every frame of the hold. `error` is how far off the player is (screen
    // units); `inside` is whether that's close enough. True once the ring is full.
    step(dt, inside, error) {
      api.steer(error)
      if (inside) value = Math.min(1, value + dt / seconds)
      api.progress(value)
      if (probeAt !== null && value >= probeAt) {
        probeAt = null
        api.probe(type, probe())
      }
      return value >= 1
    },
  }
}
