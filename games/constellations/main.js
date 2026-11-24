import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { OUTLINES, normalised } from '../../shared/objects.js'

// ---- Tunables ----------------------------------------------------------------
const DEG = Math.PI / 180
const ROUNDS = 3                // rounds per game; several short ones, so a single slip averages out
const SKY_COUNT = 8             // constellations in the sky each round; exactly one answers the prompt
const DISTANCE = 5              // how far the constellations sit from the player (world units)
const SIZE = 0.9                // half the width/height of every object's bounding box (world units)
const LONG_FOV = 75 * DEG       // field of view along the screen's longer side, so a phone and a desktop see the same amount of sky
const HOLD_SECONDS = 1.5        // how long the ring must stay on a constellation to test it; long enough that trial and error loses to thinking
const HOVER_RADIUS = 6 * DEG    // how close to screen centre a constellation must be for the ring to fill; deliberately loose
const FADE_SECONDS = 0.4        // how long the object takes to fade in after a correct hold
const PAN_DISTANCE = 50 * DEG   // every round the answer sits exactly this far from where the player is looking, so nobody is ranked on a lucky layout...
const RING_COUNT = 3            // ...and so do some wrong ones, so that distance alone doesn't give the answer away
// How far the object is turned from its constellation when it fades in, one entry
// per round. Each player gets these in a random order and direction: every round
// differs, but everyone does the same total rotation and never a trivially small one.
const ROTATE_AMOUNTS = [70 * DEG, 110 * DEG, 150 * DEG]
// Every constellation spins in place, so its shape is never seen at one fixed angle.
// Speeds are seconds per full turn; lower is faster.
const SPIN_SECONDS = [16, 32]   // each wrong constellation picks a speed in this range, so speed doesn't mark out the answer
// The answer's speed changes how hard it is to track with the dial, so it isn't left
// to chance: one per round, and every player gets the same set in a random order.
const ANSWER_SPIN_SECONDS = [19, 24, 29]
const POS_TOLERANCE = 0.8 * DEG // how close the constellation must be to screen centre for the lock ring to fill
const TILT_TOLERANCE = 3 * DEG  // how well the rotation must match for the lock ring to fill
const LOCK_SECONDS = 5          // total time the match must be held to lock (it adds up across slips); long enough that the spinning answer has to be tracked with the dial, not waited for
const MIN_SEPARATION = 30 * DEG // smallest angle between two constellations, so they never overlap
const SKY_ELEVATION = [15 * DEG, 75 * DEG] // constellations sit all the way round the player, between these heights above the horizon; never below
const START_ELEVATION = 8 * DEG // where the player looks at the start: just above the horizon, with Earth in view
const HORIZON_DIP = 5 * DEG     // how far below eye level Earth's horizon sits
const TURN_PER_PIXEL = 0.5 * DEG  // rotation per pixel dragged on the dial; geared down for fine control
const TURN_PER_WHEEL = 0.03 * DEG // rotation per unit of mouse wheel, so desktop players can pan and rotate at once; one notch must not jump the tolerance
const LOCK_PAUSE = 600          // ms the matched object stays on screen before the next round
const WRONG_PENALTY = 5         // seconds added to the score for each wrong constellation tested, so guessing costs far more than thinking (the Start page states it too)
const HELD_DOT_SIZE = 8         // pixels; the dot at the held object's centre...
const TARGET_DOT_SIZE = 18      // ...sits inside the answer's bigger centre dot when the position is about right

// Visual noise. None of it changes the shape a human sees, but it breaks the shortcuts
// a screen-reading bot relies on: one fixed colour, a plain background, clean
// outlines, and an instant on/off signal for "fitted".
const LINE_HUE_SPREAD = 0.04       // each corner's line colour drifts this far either side of the base blue (1 = the whole colour wheel)...
const LINE_LIGHTNESS_SPREAD = 0.12 // ...and this much lighter or darker, so a single colour threshold misses parts of the outline
const SHIMMER = 0.2                // each constellation's brightness wavers by up to this fraction, out of step with the others
const LINE_WIDTHS = [1.5, 2.8]     // pixels; each outline's thickness wavers between these
const JITTER = 0.015               // how far each corner wanders, as a fraction of an object's half-size (about 1–2 px on a phone)
const NEBULA_TURN_SECONDS = [90, 60] // the nebula is two layers drifting round the sky in opposite directions, one full turn in this long each...
const NEBULA_PULSE = 0.4           // ...with waves of brightness rolling through them, up to this fraction brighter or darker
const WISPS = 50                   // dark dust wisps drifting just in front of the constellations, dimming patches of their lines as they pass...
const WISP_DIM = 0.75              // ...by up to this fraction, so a line is never hidden completely...
const WISP_TURN_SECONDS = 100      // ...going once round the sky in this long
const STAR_CYCLE_SECONDS = [4, 12] // every star (in the background and at constellation corners) twinkles, and once per this many seconds, random per star, flares up, later dims out completely, and comes back
const STAR_SWELL = 0.5             // a star's size grows with its brightness (size = normal size × brightness ^ this), so it swells as it flares (about 1.5× at the peak) and shrinks to nothing as it dims out
const LINE_FADE_SHARE = 0.2        // each line between a constellation's stars is faded out about this share of the time...
const LINE_FADE_SECONDS = [4, 9]   // ...once per this many seconds, random per line, so a few lines are always missing but never the same ones for long
const GLOW_SECONDS = 0.35          // the "fitted" glow eases in and out this slowly instead of snapping on and off

const HELD_COLOR = 0xffd166     // the object the player is fitting
const LOCKED_COLOR = 0x4dff88

// ---- Objects and prompts -----------------------------------------------------
// The shared hand-drawn outlines (see shared/objects.js), centred and scaled so every
// object looks about the same size in the sky. This game uses only these objects: its
// prompts' yes and maybe lists below are written against exactly this set. They are
// never labelled: recognising them, at whatever angle they sit in the sky, is part of
// the task.
const OBJECTS = Object.fromEntries([
  'key', 'house', 'rocket', 'tree', 'fish', 'car', 'mushroom', 'boat', 'hammer', 'umbrella', 'chair', 'plane',
  'spoon', 'bottle', 'pencil', 'boot', 'bell', 'apple', 'candle', 'cactus', 'crown', 'icecream', 'glass',
].map((name) => [name, normalised(OUTLINES[name])]))

// "Find the object that ...". `yes` objects answer the prompt. `maybe` objects
// are arguable, so they are never in the sky with that prompt: a player must not
// lose time to a judgement call. Every other object is a clear "no". Comparisons
// ("the biggest") work the same way: anything close in size is a `maybe`.
const PROMPTS = [
  { text: 'is alive and lives in water', yes: ['fish'] },
  { text: 'is alive but is not a plant', yes: ['fish'], maybe: ['mushroom', 'apple'] },
  { text: 'grows in a desert', yes: ['cactus'], maybe: ['tree'] },
  { text: 'is a plant', yes: ['tree', 'cactus'], maybe: ['mushroom', 'apple'] },
  { text: 'is a fruit', yes: ['apple'], maybe: ['mushroom', 'cactus', 'tree'] },
  { text: 'is the biggest in real life', yes: ['house', 'plane', 'rocket'], maybe: ['tree', 'boat', 'car', 'bell', 'cactus'] },
  { text: 'is the smallest in real life', yes: ['key'], maybe: ['spoon', 'pencil', 'candle', 'mushroom', 'apple', 'bell', 'glass', 'icecream', 'fish', 'crown', 'bottle'] },
  { text: 'you would want in the rain', yes: ['umbrella'], maybe: ['boot', 'house', 'car', 'boat', 'plane', 'rocket', 'tree'] },
  { text: 'travels through the air', yes: ['plane', 'rocket'], maybe: ['umbrella'] },
  { text: 'travels on water', yes: ['boat'], maybe: ['fish', 'bottle'] },
  { text: 'has wheels', yes: ['car'], maybe: ['plane', 'chair', 'rocket'] },
  { text: 'people live in', yes: ['house'], maybe: ['boat', 'tree', 'car'] },
  { text: 'melts in the sun', yes: ['icecream', 'candle'] },
  { text: 'gives light', yes: ['candle'], maybe: ['rocket'] },
  { text: 'you would wear', yes: ['boot', 'crown'] },
  { text: 'rings when you shake it', yes: ['bell'], maybe: ['key', 'bottle'] },
  { text: 'you would write with', yes: ['pencil'] },
  { text: 'you would drink from', yes: ['glass', 'bottle'], maybe: ['spoon'] },
  { text: 'you would eat soup with', yes: ['spoon'] },
  { text: 'you would build with', yes: ['hammer'], maybe: ['pencil', 'key'] },
  { text: 'opens a lock', yes: ['key'] },
  { text: 'you would sit on', yes: ['chair'], maybe: ['car', 'boat', 'plane', 'house'] },
]

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Each round gets a different prompt, one object that answers it (listed first)
// and SKY_COUNT - 1 that clearly don't. Answers aren't reused across rounds
// where that's possible.
function planRounds() {
  const amounts = shuffle(ROTATE_AMOUNTS)
  const spins = shuffle(ANSWER_SPIN_SECONDS)
  const used = []
  return shuffle(PROMPTS).slice(0, ROUNDS).map(({ text, yes, maybe = [] }, i) => {
    const fresh = yes.filter((name) => !used.includes(name))
    const answer = shuffle(fresh.length ? fresh : yes)[0]
    used.push(answer)
    const wrong = Object.keys(OBJECTS).filter((name) => !yes.includes(name) && !maybe.includes(name))
    return {
      text,
      names: [answer, ...shuffle(wrong).slice(0, SKY_COUNT - 1)],
      rotate: amounts[i] * (Math.random() < 0.5 ? -1 : 1),
      spinSeconds: spins[i],
    }
  })
}

// ---- Scene -------------------------------------------------------------------
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100) // sits at the origin
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(devicePixelRatio)
document.body.prepend(renderer.domElement) // first in the body, so the overlays draw on top
scene.add(camera)

function resize() {
  const aspect = innerWidth / innerHeight
  camera.aspect = aspect
  // three.js takes the vertical field of view; in landscape, shrink it so the horizontal one is LONG_FOV.
  camera.fov = (aspect > 1 ? 2 * Math.atan(Math.tan(LONG_FOV / 2) / aspect) : LONG_FOV) / DEG
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
}
addEventListener('resize', resize)
resize()

// The view is a free rotation rather than separate left/right and up/down angles, so
// it can pass straight overhead without getting stuck (see the drag handler below).
camera.rotation.set(START_ELEVATION, 0, 0, 'YXZ')

// The direction the camera faces for a given yaw and pitch.
function direction(yaw, pitch) {
  return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
}

// A soft round dot, used for every star.
function dotTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  gradient.addColorStop(0, '#fff')
  gradient.addColorStop(0.3, '#fff')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(canvas)
}
const dot = dotTexture()
const starMaterial = (size, opacity) =>
  new THREE.PointsMaterial({ map: dot, size, sizeAttenuation: false, transparent: true, opacity, depthWrite: false })

// A texture for the inside of a sphere (longitude across, latitude down), painted with
// soft elliptical blobs that wrap round the left/right edge so the seam doesn't show.
// The pixels are worked out here rather than drawn with canvas gradients, because
// browsers dither gradients in a regular pattern that shows as a grid once stretched
// over the sky. Rounding adds a little random noise instead, so no banding shows.
const SKY_MAP = [1024, 512]
function skyTexture(paint) {
  const [w, h] = SKY_MAP
  const light = new Float32Array(w * h * 3)
  const blob = (x, y, rx, ry, rgb, alpha) => {
    for (let py = Math.max(0, Math.floor(y - ry)); py < Math.min(h, y + ry); py++) {
      for (let dx = -Math.ceil(rx); dx <= rx; dx++) {
        const d2 = (dx / rx) ** 2 + ((py - y) / ry) ** 2
        if (d2 >= 1) continue
        const a = alpha * (1 - d2) ** 2
        const i = (py * w + ((Math.round(x) + dx) % w + w) % w) * 3
        for (let c = 0; c < 3; c++) light[i + c] += rgb[c] * a
      }
    }
  }
  paint(blob, w, h)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(w, h)
  for (let p = 0; p < w * h; p++) {
    for (let c = 0; c < 3; c++) image.data[p * 4 + c] = light[p * 3 + c] + Math.random() - 0.5
    image.data[p * 4 + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping // so it can drift round and round
  return texture
}
const latitudeToY = (latitude, h) => (0.5 - latitude / Math.PI) * h

// A moving nebula and Milky Way band in the same blues as the constellations, so a
// bot can't find the outlines just by looking for blue pixels next to dark ones, and
// can't subtract a still background either. It's painted on the inside of a big
// sphere. The band and clouds keep away from the top of the map, which pinches
// together straight overhead. Just the light: the shader adds the dark sky underneath.
const nebulaTexture = () => skyTexture((blob, w, h) => {
  // The Milky Way: a tilted great circle round the sky, which is a wave on this map.
  const tilt = (25 + Math.random() * 20) * DEG
  const shift = Math.random() * 2 * Math.PI
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * w
    const latitude = Math.atan(Math.tan(tilt) * Math.sin(x / w * 2 * Math.PI + shift))
    const r = 8 + Math.random() * 22
    blob(x, latitudeToY(latitude, h) + (Math.random() - 0.5) * h * 0.07, r, r, [110, 168, 255], 0.03 + Math.random() * 0.04)
  }
  // Nebula clouds, between about 55° up and the horizon.
  for (let i = 0; i < 45; i++) {
    const rgb = [[110, 168, 255], [80, 110, 220], [150, 120, 255]][i % 3]
    const r = 30 + Math.random() * 80
    blob(Math.random() * w, h * (0.2 + Math.random() * 0.32), r, r, rgb, 0.05 + Math.random() * 0.07)
  }
})

// Two copies of the nebula, one flipped so they never line up, drift round the sky in
// opposite directions, and waves of brightness roll through them.
const nebulaMaterial = new THREE.ShaderMaterial({
  uniforms: {
    map: { value: nebulaTexture() },
    time: { value: 0 },
    drift: { value: new THREE.Vector2(1 / NEBULA_TURN_SECONDS[0], -1 / NEBULA_TURN_SECONDS[1]) },
    pulse: { value: NEBULA_PULSE },
  },
  side: THREE.BackSide,
  depthWrite: false,
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vDir;
    void main() {
      vUv = uv;
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D map;
    uniform float time;
    uniform vec2 drift;
    uniform float pulse;
    varying vec2 vUv;
    varying vec3 vDir;
    void main() {
      vec3 a = texture2D(map, vUv + vec2(time * drift.x, 0.0)).rgb;
      vec3 b = texture2D(map, vec2(1.0 - vUv.x + time * drift.y, vUv.y)).rgb;
      float wave = 1.0 + pulse * sin(vDir.x * 4.0 + vDir.z * 3.0 + time * 0.7) * sin(vDir.y * 5.0 - time * 0.45);
      gl_FragColor = vec4(vec3(0.008, 0.016, 0.04) + (a + 0.8 * b) * wave, 1.0);
    }`,
})
const nebula = new THREE.Mesh(new THREE.SphereGeometry(90, 64, 32), nebulaMaterial)
nebula.renderOrder = -1 // behind everything
scene.add(nebula)

// Dark dust wisps on a sphere just inside the constellations, drifting slowly round
// the sky. Where one passes over an outline it dims that part of the lines, so a bot
// measuring the outline's angle from the screen gets readings that shift as the dust
// moves; a person just sees a shape passing behind thin cloud. Each wisp is a short
// streak of overlapping blobs, kept between about 10° and 75° up, where the
// constellations are.
const wispTexture = () => skyTexture((blob, w, h) => {
  for (let i = 0; i < WISPS; i++) {
    let x = Math.random() * w
    let y = latitudeToY((10 + Math.random() * 65) * DEG, h)
    for (let part = 0; part < 6; part++) {
      blob(x, y, 20 + Math.random() * 25, 5 + Math.random() * 7, [255, 255, 255], 0.6 + Math.random() * 0.4)
      x += 10 + Math.random() * 20
      y += (Math.random() - 0.5) * 8
    }
  }
})
const wisps = new THREE.Mesh(
  new THREE.SphereGeometry(DISTANCE - 0.5, 64, 32),
  new THREE.MeshBasicMaterial({
    color: 0x02040a, alphaMap: wispTexture(), opacity: WISP_DIM, transparent: true, side: THREE.BackSide, depthTest: false, depthWrite: false,
  }),
)
wisps.renderOrder = 0.5 // over the constellations (0), under the held object and the centre dots (1 and up), which are never dimmed
scene.add(wisps)

// Each star's own timing.
const randomIn = ([low, high]) => low + Math.random() * (high - low)
function starTiming() {
  return {
    rate: 0.8 + Math.random() * 1.6,
    phase: Math.random() * 2 * Math.PI,
    period: randomIn(STAR_CYCLE_SECONDS),
    offset: Math.random(),
  }
}

// A star's brightness at time t (1 = normal). It twinkles all the time, and once per
// period flares up, settles, later dims out completely, then comes back.
function starBrightness(star, t) {
  const twinkle = 0.75 + 0.25 * Math.sin(t * star.rate + star.phase)
  const p = (t / star.period + star.offset) % 1
  const flare = 1.2 * Math.exp(-p * 12)
  const out = THREE.MathUtils.smoothstep(p, 0.55, 0.65) * (1 - THREE.MathUtils.smoothstep(p, 0.8, 0.9))
  return twinkle * (1 + flare) * (1 - out)
}

// A star: a soft round core with faint four-point spikes, which only really show when
// a star swells as it flares.
function starTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const c = size / 2
  const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.5)
  core.addColorStop(0, 'rgba(255,255,255,1)')
  core.addColorStop(0.35, 'rgba(255,255,255,0.8)')
  core.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = core
  ctx.fillRect(0, 0, size, size)
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const spike = ctx.createLinearGradient(c - dx * c, c - dy * c, c + dx * c, c + dy * c)
    spike.addColorStop(0, 'rgba(255,255,255,0)')
    spike.addColorStop(0.5, 'rgba(255,255,255,0.45)')
    spike.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = spike
    ctx.fillRect(dx ? 0 : c - 1, dy ? 0 : c - 1, dx ? size : 2, dy ? size : 2)
  }
  return new THREE.CanvasTexture(canvas)
}
const starSprite = starTexture()
const SPRITE_SCALE = 2.5 // the sprite leaves room round the core for the spikes, so it's drawn this much bigger than the star's core size

// Stars with their own brightness and size each, which the built-in points material
// can't do. Drawn additively, so a star dimmed to black adds nothing and is gone.
// `size` is the star's core size in pixels at normal brightness.
const starsMaterial = (size) => new THREE.ShaderMaterial({
  uniforms: { map: { value: starSprite }, size: { value: size * SPRITE_SCALE * renderer.getPixelRatio() }, swell: { value: STAR_SWELL } },
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  vertexShader: `
    attribute float brightness;
    uniform float size;
    uniform float swell;
    varying float vBrightness;
    void main() {
      vBrightness = brightness;
      gl_PointSize = size * pow(max(brightness, 0.0), swell);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D map;
    varying float vBrightness;
    void main() {
      gl_FragColor = vec4(vec3(min(vBrightness, 1.0) * texture2D(map, gl_PointCoord).a), 1.0);
    }`,
})
function brightnessAttribute(count) {
  return new THREE.Float32BufferAttribute(new Float32Array(count).fill(1), 1)
}
function setStarBrightness(attribute, timings, t, scale) {
  timings.forEach((star, i) => attribute.setX(i, scale * starBrightness(star, t)))
  attribute.needsUpdate = true
}

// Background stars, all around. Earth hides the ones below the horizon.
const BACKGROUND_STARS = 1500
const backgroundPositions = []
for (let i = 0; i < BACKGROUND_STARS; i++) backgroundPositions.push(...new THREE.Vector3().randomDirection().multiplyScalar(60).toArray())
const backgroundTimings = Array.from({ length: BACKGROUND_STARS }, starTiming)
const backgroundStars = new THREE.Points(
  new THREE.BufferGeometry()
    .setAttribute('position', new THREE.Float32BufferAttribute(backgroundPositions, 3))
    .setAttribute('brightness', brightnessAttribute(BACKGROUND_STARS)),
  starsMaterial(3),
)
scene.add(backgroundStars)

// Earth, directly below the player. Oceans, land and cloud are random blobs drawn
// onto a canvas; each is repeated across the edges so the texture tiles seamlessly.
function earthTexture() {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#0a2f6b'
  ctx.fillRect(0, 0, size, size)
  const cluster = (color, spread, radius) => {
    const cx = Math.random() * size
    const cy = Math.random() * size
    ctx.fillStyle = color
    for (let i = 0; i < 22; i++) {
      const x = cx + (Math.random() - 0.5) * spread
      const y = cy + (Math.random() - 0.5) * spread
      const r = radius * (0.5 + Math.random())
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          ctx.beginPath()
          ctx.arc(x + ox, y + oy, r, 0, 2 * Math.PI)
          ctx.fill()
        }
      }
    }
  }
  for (let i = 0; i < 10; i++) cluster(['#2f7d4a', '#5d8a48', '#a58f5c'][i % 3], 220, 40)
  for (let i = 0; i < 30; i++) cluster('rgba(255,255,255,0.18)', 160, 22)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return texture
}

// Only the cap of the sphere under the player is ever visible, so only that is
// built. The shader maps the texture straight down onto it, lets it drift so the
// planet turns, and fades to a blue haze at the horizon like an atmosphere.
const EARTH_RADIUS = 300
const earthMaterial = new THREE.ShaderMaterial({
  uniforms: { map: { value: earthTexture() }, drift: { value: 0 } },
  vertexShader: `
    varying vec3 vWorld;
    varying vec3 vNormal;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      vNormal = normalize(position);
      gl_Position = projectionMatrix * viewMatrix * world;
    }`,
  fragmentShader: `
    uniform sampler2D map;
    uniform float drift;
    varying vec3 vWorld;
    varying vec3 vNormal;
    void main() {
      vec3 toCamera = normalize(cameraPosition - vWorld);
      float haze = pow(1.0 - max(dot(vNormal, toCamera), 0.0), 3.0);
      vec3 surface = texture2D(map, vWorld.xz * 0.03 + vec2(drift, 0.0)).rgb;
      gl_FragColor = vec4(mix(surface, vec3(0.5, 0.8, 1.0), haze), 1.0);
    }`,
})
const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 128, 16, 0, 2 * Math.PI, 0, HORIZON_DIP + 3 * DEG), earthMaterial)
earth.position.y = -EARTH_RADIUS / Math.cos(HORIZON_DIP) // puts the horizon HORIZON_DIP below eye level
scene.add(earth)

// A blue near the constellation blue, shifted a little in hue and lightness, so the
// outline is never one exact colour.
const BASE_BLUE = new THREE.Color(0x6ea8ff).getHSL({})
function nearBlue() {
  const spread = (amount) => (Math.random() * 2 - 1) * amount
  return new THREE.Color().setHSL(BASE_BLUE.h + spread(LINE_HUE_SPREAD), BASE_BLUE.s, BASE_BLUE.l + spread(LINE_LIGHTNESS_SPREAD))
}

// One line outline and one set of corner stars per object, shared by every copy.
// Line2 instead of a plain line because WebGL draws plain lines 1px wide. Each corner
// gets its own shade of blue, blended along the lines, its own wobble and star
// timing, and each line its own fade timing.
const GEOMETRY = {}
for (const name in OBJECTS) {
  const points = OBJECTS[name]
  const colors = points.map(nearBlue)
  GEOMETRY[name] = {
    line: new LineGeometry()
      .setPositions([...points, points[0]].flatMap(([x, y]) => [x, y, 0]))
      .setColors([...colors, colors[0]].flatMap((c) => [c.r, c.g, c.b])),
    stars: new THREE.BufferGeometry()
      .setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(([x, y]) => [x, y, 0]), 3))
      .setAttribute('brightness', brightnessAttribute(points.length)),
    colors,
    wobble: points.map(() => [Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI]),
    starTimings: points.map(starTiming),
    lineFades: points.map(() => ({ period: randomIn(LINE_FADE_SECONDS), offset: Math.random() })),
  }
}

// How visible a line is at time t (1 = fully). Each line is mostly there, but once per
// period it fades nearly out for about LINE_FADE_SHARE of the time, then back.
const FADE_LEVEL = -Math.cos(Math.PI * LINE_FADE_SHARE) // the line is half faded when its wave dips below this
function lineVisibility({ period, offset }, t) {
  const wave = Math.sin(2 * Math.PI * (t / period + offset))
  return 0.05 + 0.95 * THREE.MathUtils.smoothstep(wave, FADE_LEVEL - 0.15, FADE_LEVEL + 0.15)
}

// Animate an object's outline: move every corner (its lines and its star) by a pixel
// or two, smoothly, so a bot's estimate of the outline is never exactly the same twice;
// fade each line in and out; and twinkle, flare and dim the corner stars.
function animateOutline(name, t) {
  const { line, stars, colors, wobble: phases, starTimings, lineFades } = GEOMETRY[name]
  const points = OBJECTS[name].map(([x, y], i) => [
    x + JITTER * Math.sin(t * 2.1 + phases[i][0]),
    y + JITTER * Math.sin(t * 2.6 + phases[i][1]),
  ])
  const segments = line.attributes.instanceStart.data // each segment's start and end positions, one after another
  const segmentColors = line.attributes.instanceColorStart.data // and its start and end colours, the same way
  points.forEach(([x, y], i) => {
    const next = (i + 1) % points.length
    const [nx, ny] = points[next]
    segments.array.set([x, y, 0, nx, ny, 0], i * 6)
    stars.attributes.position.setXY(i, x, y)
    // The lines are drawn additively, so scaling a line's colour towards black fades it out.
    const v = lineVisibility(lineFades[i], t)
    const [a, b] = [colors[i], colors[next]]
    segmentColors.array.set([a.r * v, a.g * v, a.b * v, b.r * v, b.g * v, b.b * v], i * 6)
  })
  segments.needsUpdate = true
  segmentColors.needsUpdate = true
  stars.attributes.position.needsUpdate = true
  setStarBrightness(stars.attributes.brightness, starTimings, t, 1)
}

const constellationStars = starsMaterial(9)
// Constellations the player has tested and found wrong are dimmed, so nobody re-tests one.
const rejectedLine = new LineMaterial({ color: 0x26344d, linewidth: 2, depthTest: false })
const rejectedStars = starMaterial(9, 0.25)

// Each constellation has its own line materials, so its brightness and thickness can
// waver on their own timing. The wide, faint second line is a soft glow around it.
function makeConstellation(name) {
  const group = new THREE.Group()
  const line = new Line2(GEOMETRY[name].line, new LineMaterial({
    linewidth: LINE_WIDTHS[0], vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
  }))
  const glow = new Line2(GEOMETRY[name].line, new LineMaterial({
    linewidth: 8, vertexColors: true, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
  }))
  group.add(line, new THREE.Points(GEOMETRY[name].stars, constellationStars), glow)
  group.userData.name = name
  group.userData.phase = Math.random() * 100
  group.scale.setScalar(SIZE)
  return group
}

// Waver a constellation's brightness and line thickness.
function shimmer(constellation, t) {
  const [line] = constellation.children
  const phase = constellation.userData.phase
  line.material.color.setScalar(1 + SHIMMER * Math.sin(t * 1.7 + phase))
  line.material.linewidth = LINE_WIDTHS[0] + (LINE_WIDTHS[1] - LINE_WIDTHS[0]) * (0.5 + 0.5 * Math.sin(t * 1.1 + phase * 1.3))
}

// The object the player has found, pinned to the centre of the screen. It sits at
// the same distance as the constellations, so it is the same size on screen.
const held = new Line2(GEOMETRY.key.line, new LineMaterial({ color: HELD_COLOR, linewidth: 4, depthTest: false, transparent: true }))
held.position.z = -DISTANCE
held.scale.setScalar(SIZE)
held.renderOrder = 1 // drawn over the constellations
held.visible = false
camera.add(held)

// Centre dots that guide the position while fitting: a small one on the held object
// and a bigger one on the answer. The answer's dot is only added once it's found,
// so it never gives the answer away.
const centrePoint = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))
const heldDot = new THREE.Points(centrePoint, starMaterial(HELD_DOT_SIZE, 1))
const targetDot = new THREE.Points(centrePoint, starMaterial(TARGET_DOT_SIZE, 1))
heldDot.material.depthTest = targetDot.material.depthTest = false
targetDot.material.color.set(0x6ea8ff) // the constellation blue
targetDot.renderOrder = 1 // over the dust wisps
heldDot.renderOrder = 2 // drawn over the answer's dot
held.add(heldDot)

// ---- Game state ----------------------------------------------------------------
const rounds = planRounds()
let phase = 'start' // 'start' -> ('search' -> 'rotate' -> 'locked') per round -> 'done'
let round = 0
let startTime
let penalty = 0     // seconds added for wrong picks so far
let sky = []        // this round's constellations
let target          // the one that answers the prompt
let rejected        // the ones the player has tested and found wrong
let hovered         // the one under the ring right now
let progress = 0    // 0..1, how full the ring is
let turn = 0        // rotation of the held object, anticlockwise, in radians
let glow = 0        // 0..1, how strongly the ring glows while the object is fitted

// The score so far: time since Start plus any penalties, so the timer on screen
// always shows exactly what the player's score would be.
const elapsed = () => (performance.now() - startTime) / 1000 + penalty

const roundEl = document.getElementById('round')
const timerEl = document.getElementById('timer')
const penaltyEl = document.getElementById('penalty')
const promptEl = document.getElementById('prompt')
const ringEl = document.getElementById('ring')
const fillEl = document.getElementById('fill')
const dialEl = document.getElementById('dial')
const RING_LENGTH = 251.3 // circumference of the SVG ring (2 * pi * 40)

// ---- Rounds ------------------------------------------------------------------
function inSky(d) {
  const elevation = Math.asin(d.y)
  return elevation >= SKY_ELEVATION[0] && elevation <= SKY_ELEVATION[1]
}

// Directions for this round's constellations, the answer first. The first
// RING_COUNT sit exactly PAN_DISTANCE from where the player is looking, in random
// directions; the rest go anywhere in the sky.
function scatter() {
  const forward = camera.getWorldDirection(new THREE.Vector3())
  const onRing = () => forward.clone().applyAxisAngle(new THREE.Vector3().randomDirection().cross(forward).normalize(), PAN_DISTANCE)
  const anywhere = () => direction(Math.random() * 2 * Math.PI, SKY_ELEVATION[0] + Math.random() * (SKY_ELEVATION[1] - SKY_ELEVATION[0]))
  for (;;) { // if a layout boxes itself in with no room left, start it again
    const directions = []
    for (let tries = 0; directions.length < SKY_COUNT && tries < 500; tries++) {
      const d = directions.length < RING_COUNT ? onRing() : anywhere()
      if (inSky(d) && directions.every((other) => other.angleTo(d) >= MIN_SEPARATION)) directions.push(d)
    }
    if (directions.length === SKY_COUNT) return directions
  }
}

// The prompt and the sky arrive together and the player can move straight away:
// working out the answer and hunting for it happen at the same time.
function startRound() {
  for (const constellation of sky) scene.remove(constellation)
  held.visible = false
  dialEl.style.display = 'none'

  round++
  roundEl.textContent = `Round ${round} / ${ROUNDS}`
  const { text, names, rotate, spinSeconds } = rounds[round - 1]
  promptEl.textContent = `Find the object that ${text}`

  sky = scatter().map((d, i) => {
    const constellation = makeConstellation(names[i])
    constellation.position.copy(d).multiplyScalar(DISTANCE)
    // Face the player, upright as seen when centred on screen, then roll at random.
    constellation.rotation.set(Math.asin(d.y), Math.atan2(-d.x, -d.z), 0, 'YXZ')
    constellation.rotateZ(Math.random() * 2 * Math.PI)
    // The answer keeps spinning while the player rotates it, so its direction is not
    // left to chance: it always spins away from the match (a positive spin lowers its
    // apparent tilt), so it never shortens one player's turn and lengthens another's.
    // The rest alternate, so every sky has an even mix of clockwise and anticlockwise
    // and the direction never hints at which one is the answer. They're scattered at
    // random, so alternating by list order still looks random in the sky.
    const direction = i === 0 ? -Math.sign(rotate) : i % 2 ? 1 : -1
    const seconds = i === 0 ? spinSeconds : SPIN_SECONDS[0] + Math.random() * (SPIN_SECONDS[1] - SPIN_SECONDS[0])
    constellation.userData.spin = direction * 2 * Math.PI / seconds // radians per second
    scene.add(constellation)
    return constellation
  })
  target = sky[0]
  rejected = new Set()
  hovered = undefined
  progress = 0
  ringEl.style.display = 'block'
  phase = 'search'
}

// Replays a CSS animation class, even if it's already playing.
function flash(element, className) {
  element.classList.remove(className)
  element.getBoundingClientRect()
  element.classList.add(className)
}

// A full ring on the wrong constellation costs WRONG_PENALTY seconds. Say "no"
// clearly, and show the penalty next to the timer as it jumps, so neither looks
// like a glitch.
function reject(constellation) {
  rejected.add(constellation)
  constellation.children[0].material = rejectedLine
  constellation.children[1].material = rejectedStars
  constellation.children[2].visible = false // no glow
  penalty += WRONG_PENALTY
  penaltyEl.textContent = `+${WRONG_PENALTY}s`
  flash(ringEl, 'wrong')
  flash(penaltyEl, 'show')
}

// A full ring on the right one: its object fades in, turned away from the
// constellation by this round's amount, and the dial appears to rotate it. The
// amount is measured from how the constellation looks on screen right now, so a
// tilted view never makes anyone's turn longer or shorter.
function reveal() {
  turn = rounds[round - 1].rotate - apparentTilt()
  held.geometry = target.children[0].geometry
  target.add(targetDot) // moves it off last round's answer
  held.material.opacity = 0
  held.material.color.set(HELD_COLOR)
  held.visible = true
  progress = 0 // the ring now shows the lock hold
  glow = 0
  ringEl.classList.remove('wrong')
  dialEl.style.display = 'flex'
  phase = 'rotate'
}

// ---- Controls ------------------------------------------------------------------
// Calls handler(dx, dy) as a finger or the mouse drags across the element. Each
// pointer is tracked separately, so one thumb can pan while the other rotates.
function onDrag(element, handler) {
  const last = new Map()
  element.addEventListener('pointerdown', (e) => {
    element.setPointerCapture(e.pointerId)
    last.set(e.pointerId, [e.clientX, e.clientY])
  })
  element.addEventListener('pointermove', (e) => {
    const from = last.get(e.pointerId)
    if (!from || (phase !== 'search' && phase !== 'rotate')) return
    handler(e.clientX - from[0], e.clientY - from[1])
    last.set(e.pointerId, [e.clientX, e.clientY])
  })
  const end = (e) => last.delete(e.pointerId)
  element.addEventListener('pointerup', end)
  element.addEventListener('pointercancel', end)
}

// Drag the sky: it follows the finger in every direction, anywhere in the dome.
// Each drag turns the view about its own screen axes, which works the same
// overhead as at the horizon; separate left/right and up/down angles would jam
// straight up, where left/right stops meaning anything.
const X_AXIS = new THREE.Vector3(1, 0, 0)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const ORIGIN = new THREE.Vector3()
const step = new THREE.Quaternion()
const level = new THREE.Quaternion()
const lookMatrix = new THREE.Matrix4()
const looking = new THREE.Vector3()
const lookDirection = () => looking.set(0, 0, -1).applyQuaternion(camera.quaternion)

const screenUp = new THREE.Vector3()

// The view must stay above the horizon (Earth is down there) and must not tip over
// backwards past straight up, which would leave the player upside down. Looking
// straight up is fine.
const inDome = () => lookDirection().y >= 0 && screenUp.set(0, 1, 0).applyQuaternion(camera.quaternion).y >= -1e-9

// Turn the view. If the full turn would leave the dome, take the biggest half,
// quarter, ... of it that doesn't, so the view slides right up to the edge.
function turnView(axis, angle) {
  const before = camera.quaternion.clone()
  for (let i = 0; i < 10; i++, angle /= 2) {
    camera.quaternion.copy(before).multiply(step.setFromAxisAngle(axis, angle))
    if (inDome()) return
  }
  camera.quaternion.copy(before)
}

onDrag(renderer.domElement, (dx, dy) => {
  const perPixel = camera.fov * DEG / innerHeight
  turnView(Y_AXIS, dx * perPixel) // no limit: the player can turn all the way round
  turnView(X_AXIS, dy * perPixel)
  // Free turning lets the view tilt sideways. Straighten it fully near the horizon,
  // so Earth stays at the bottom of the screen and the player stays oriented, and
  // less and less higher up, so nothing fights the finger near the top.
  const d = lookDirection()
  level.setFromRotationMatrix(lookMatrix.lookAt(ORIGIN, d, Y_AXIS))
  camera.quaternion.slerp(level, (1 - d.y ** 2) ** 2)
})

// Drag the dial (or scroll the mouse wheel) to rotate the held object.
onDrag(dialEl, (dx) => { turn -= dx * TURN_PER_PIXEL })
addEventListener('wheel', (e) => {
  if (phase === 'rotate') turn -= e.deltaY * TURN_PER_WHEEL
}, { passive: true })

// ---- Lock ----------------------------------------------------------------------
// How far the target's "up" is turned from the screen's "up", seen from the camera.
function apparentTilt() {
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(target.quaternion)
  up.applyQuaternion(camera.quaternion.clone().invert())
  return Math.atan2(up.x, up.y)
}

// Tilt: does the held object's rotation cancel the target's apparent tilt? The
// objects have no rotational symmetry, so only one rotation matches.
function isMatched() {
  const off = apparentTilt() + turn
  return Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) < TILT_TOLERANCE
}

function lock() {
  held.material.opacity = 1
  held.material.color.set(LOCKED_COLOR)
  ringEl.style.display = 'none'
  ringEl.style.filter = ''
  if (round < ROUNDS) {
    phase = 'locked'
    return setTimeout(startRound, LOCK_PAUSE)
  }
  // Last round: the clock stops at the moment of the lock.
  const seconds = elapsed()
  phase = 'done'
  timerEl.textContent = `${seconds.toFixed(2)}s`
  setTimeout(() => {
    dialEl.style.display = 'none'
    promptEl.textContent = ''
    document.getElementById('score').textContent = `${seconds.toFixed(2)}s`
    const wrong = penalty / WRONG_PENALTY
    if (wrong) document.getElementById('penalties').textContent = `Includes +${penalty}s for ${wrong} wrong ${wrong === 1 ? 'pick' : 'picks'}`
    document.getElementById('done').style.display = 'flex'
  }, LOCK_PAUSE)
}

// ---- Game loop -----------------------------------------------------------------
const forward = new THREE.Vector3()
let lastTime = 0

function loop(now) {
  const dt = (now - lastTime) / 1000
  lastTime = now
  const t = now / 1000
  earthMaterial.uniforms.drift.value = now * 0.000002
  nebulaMaterial.uniforms.time.value = t
  wisps.rotation.y = t * 2 * Math.PI / WISP_TURN_SECONDS
  camera.getWorldDirection(forward)

  setStarBrightness(backgroundStars.geometry.attributes.brightness, backgroundTimings, t, 0.7)

  // Spin every constellation in place, the answer too while the player turns the
  // dial, so fitting it means tracking a moving shape. Only a locked answer stops,
  // so the match stays lined up on screen.
  for (const c of sky) {
    if (c !== target || phase === 'search' || phase === 'rotate') c.rotateZ(c.userData.spin * dt)
    if (!rejected.has(c)) shimmer(c, t)
    animateOutline(c.userData.name, t)
  }

  if (phase === 'search') {
    // The ring fills only while it stays on one untested constellation, and
    // empties the moment it leaves, so panning across the sky tests nothing.
    const over = sky.find((c) => !rejected.has(c) && forward.angleTo(c.position) < HOVER_RADIUS)
    progress = over && over === hovered ? progress + dt / HOLD_SECONDS : 0
    hovered = over
    if (progress >= 1) {
      progress = 0
      if (over === target) reveal()
      else reject(over)
    }
    fillEl.style.strokeDashoffset = RING_LENGTH * (1 - progress)
  }
  if (phase === 'rotate') {
    held.material.opacity = Math.min(1, held.material.opacity + dt / FADE_SECONDS)
    held.rotation.z = turn
    dialEl.style.backgroundPositionX = `${-turn / TURN_PER_PIXEL}px` // the tick marks slide with the rotation
    // The lock ring fills while position and rotation are both right and pauses when
    // either slips. It never drains: time spent matched adds up, so a slip costs only
    // the time it takes to get back on. A full ring locks the round. There's no colour
    // switch for "fitted", which a bot could read from a single pixel: a soft glow
    // eases in and out instead, and the filling ring itself is the main sign.
    const matched = forward.angleTo(target.position) < POS_TOLERANCE && isMatched()
    if (matched) progress = Math.min(1, progress + dt / LOCK_SECONDS)
    glow += ((matched ? 1 : 0) - glow) * Math.min(1, dt / GLOW_SECONDS)
    ringEl.style.filter = `drop-shadow(0 0 ${(12 * glow).toFixed(1)}px rgba(255, 209, 102, ${(0.8 * glow).toFixed(2)}))`
    fillEl.style.strokeDashoffset = RING_LENGTH * (1 - progress)
    if (progress >= 1) lock()
  }
  if (phase === 'search' || phase === 'rotate' || phase === 'locked') timerEl.textContent = `${elapsed().toFixed(2)}s`

  renderer.render(scene, camera)
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

// ---- Start ---------------------------------------------------------------------
document.querySelector('#start button').onclick = () => {
  document.getElementById('start').style.display = 'none'
  startTime = performance.now()
  startRound()
}
document.querySelector('#done button').onclick = () => location.reload()
