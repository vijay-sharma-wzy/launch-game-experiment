// SERVER ONLY. Turns one session's telemetry into the features of spec §6 and a 0..1
// bot-risk score (spec P8). It is a risk score, not a verdict: the platform combines
// it with its other controls.
//
// The thresholds are first guesses from typical human motor-control ranges (reactions
// of roughly 200–400 ms that vary, curved paths that speed up and slow down), not
// fitted to data. They must be calibrated on real human and bot sessions, including
// people using trackballs, eye trackers, switch access or with a tremor, before
// anyone acts on the score.

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const spread = (xs) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)))
const clamp01 = (x) => Math.max(0, Math.min(1, x))
// 0 below `low`, 1 above `high`, a straight ramp between.
const ramp = (x, low, high) => clamp01((x - low) / (high - low))

export function score(events, view, pointerType) {
  const px = view.h // screen units to pixels
  const features = {}
  const indicators = {}

  // 1. Probe responses: the player has started correcting once the steering error
  // stops growing, so the response delay is the time from the probe to the error's
  // peak, and settling is the time until it's back near where it started.
  const errors = events.filter((e) => e.type === 'error')
  const delays = []
  const settles = []
  for (const probe of events.filter((e) => e.type === 'probe')) {
    const before = errors.filter((e) => e.t <= probe.t).at(-1)
    const after = errors.filter((e) => e.t > probe.t && e.t <= probe.t + 2500)
    if (!before || after.length < 5) continue
    let peak = after[0]
    for (const e of after) {
      if (e.value > peak.value) peak = e
      else if (e.value < peak.value * 0.85) break
    }
    if (peak.value < before.value + 2 / px) continue // too small to register: the player wasn't steering
    delays.push(peak.t - probe.t)
    const settled = after.find((e) => e.t > peak.t && e.value <= before.value + 2 / px)
    if (settled) settles.push(settled.t - probe.t)
  }
  features.probesMeasured = delays.length
  if (delays.length >= 3) {
    features.probeDelayMs = Math.round(mean(delays))
    features.probeDelaySpreadMs = Math.round(spread(delays))
    // Faster than a person can react, or the seconds a model-in-the-loop takes.
    indicators.probeDelay = Math.max(1 - ramp(features.probeDelayMs, 150, 220), ramp(features.probeDelayMs, 900, 1500))
    // Controllers respond at the same delay every time; people vary.
    indicators.probeDelaySpread = 1 - ramp(features.probeDelaySpreadMs, 30, 70)
  }
  if (settles.length) features.probeSettleMs = Math.round(mean(settles))

  // 2. Pointer continuity. A finger only moves while touching, so for touch the path
  // restarts at every press; a mouse is tracked throughout.
  let travel = 0
  let jumped = 0
  let constant = 0
  let straight = 0
  let triples = 0
  let presses = 0
  let teleports = 0
  let last = null
  let prev = null
  let lastSpeed = null
  for (const e of events) {
    if (e.type === 'down') {
      presses++
      if (last && Math.hypot(e.x - last.x, e.y - last.y) * px > 30) teleports++
      if (pointerType !== 'mouse') { last = null; prev = null; lastSpeed = null }
    }
    if (e.type !== 'pointer') continue
    if (last) {
      const d = Math.hypot(e.x - last.x, e.y - last.y) * px
      travel += d
      if (d > 40) jumped += d
      const dt = e.ct - last.ct
      const speed = dt > 0 ? d / dt : null
      if (prev && speed && lastSpeed && d > 0.5) {
        triples++
        if (Math.abs(speed - lastSpeed) / Math.max(speed, lastSpeed) < 0.02) constant++
        const turn = Math.abs(Math.atan2(e.y - last.y, e.x - last.x) - Math.atan2(last.y - prev.y, last.x - prev.x))
        if (Math.min(turn, 2 * Math.PI - turn) < Math.PI / 180) straight++
      }
      lastSpeed = speed
    }
    prev = last
    last = e
  }
  if (travel > 200) {
    features.jumpShare = Math.round((jumped / travel) * 100) / 100
    indicators.jumps = ramp(features.jumpShare, 0.05, 0.25)
  }
  if (triples > 30) {
    features.constantSpeedShare = Math.round((constant / triples) * 100) / 100
    features.straightShare = Math.round((straight / triples) * 100) / 100
    indicators.constantSpeed = ramp(features.constantSpeedShare, 0.1, 0.4)
    indicators.straightLines = ramp(features.straightShare, 0.2, 0.6)
  }
  if (pointerType === 'mouse' && presses >= 3) {
    features.teleportPressShare = Math.round((teleports / presses) * 100) / 100
    indicators.teleportPresses = ramp(features.teleportPressShare, 0.2, 0.6)
  }

  // 3. Thinking behaviour: a mouse that is perfectly still for seconds before each
  // decision. (A finger off the screen is still by nature, so touch is skipped.)
  const decisions = events.filter((e) => e.type === 'decision')
  if (pointerType === 'mouse' && decisions.length >= 3) {
    const stillFor = decisions.map((d) => (d.firstMove ?? d.committed) - d.available)
    features.stillBeforeDecisionShare = Math.round(stillFor.filter((ms) => ms >= 1500).length / decisions.length * 100) / 100
    features.longestStillBeforeDecisionMs = Math.max(...stillFor)
    indicators.stillThinking = ramp(features.stillBeforeDecisionShare, 0.3, 0.8)
  }

  // 4. Environment (weak, easily faked): did the window ever lose focus or resize?
  features.windowEvents = events.filter((e) => e.type === 'window').length - 1

  // Probe responses are the hardest signal to fake, so they count double.
  const weights = { probeDelay: 2, probeDelaySpread: 2 }
  const names = Object.keys(indicators)
  const total = names.reduce((sum, n) => sum + (weights[n] ?? 1), 0)
  const risk = names.length ? names.reduce((sum, n) => sum + indicators[n] * (weights[n] ?? 1), 0) / total : null
  for (const n of names) indicators[n] = Math.round(indicators[n] * 100) / 100
  return { risk: risk === null ? null : Math.round(risk * 100) / 100, features, indicators }
}
