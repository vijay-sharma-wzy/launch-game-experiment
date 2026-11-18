import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'

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
const HELD_DOT_SIZE = 8         // pixels; the dot at the held object's centre...
const TARGET_DOT_SIZE = 18      // ...sits inside the answer's bigger centre dot when the position is about right

const HELD_COLOR = 0xffd166     // the object the player is fitting
const ON_TARGET_COLOR = 0xffffff // position is right, rotation still to do
const LOCKED_COLOR = 0x4dff88

// ---- Objects and prompts -----------------------------------------------------
// Hand-drawn outlines. None has rotational symmetry (mirror symmetry is fine),
// so only one rotation matches its constellation. They are never labelled:
// recognising them, at whatever angle they sit in the sky, is part of the task.
const OBJECTS = {
  key:      [[-0.15, 1], [0.15, 1], [0.4, 0.75], [0.4, 0.45], [0.15, 0.2], [0.1, 0.2], [0.1, -0.4], [0.4, -0.4], [0.4, -0.6], [0.1, -0.6], [0.1, -0.75], [0.4, -0.75], [0.4, -1], [-0.1, -1], [-0.1, 0.2], [-0.15, 0.2], [-0.4, 0.45], [-0.4, 0.75]],
  house:    [[0, 1], [0.35, 0.65], [0.35, 0.9], [0.6, 0.9], [0.6, 0.4], [0.9, 0.1], [0.7, 0.1], [0.7, -1], [-0.7, -1], [-0.7, 0.1], [-0.9, 0.1]],
  rocket:   [[0, 1], [0.3, 0.5], [0.3, -0.4], [0.7, -0.9], [0.7, -1], [0.25, -0.8], [-0.25, -0.8], [-0.7, -1], [-0.7, -0.9], [-0.3, -0.4], [-0.3, 0.5]],
  tree:     [[0, 1], [0.4, 0.4], [0.2, 0.4], [0.6, -0.1], [0.3, -0.1], [0.8, -0.7], [0.15, -0.7], [0.15, -1], [-0.15, -1], [-0.15, -0.7], [-0.8, -0.7], [-0.3, -0.1], [-0.6, -0.1], [-0.2, 0.4], [-0.4, 0.4]],
  fish:     [[1, 0], [0.6, 0.4], [0.1, 0.5], [-0.4, 0.2], [-1, 0.6], [-0.8, 0], [-1, -0.6], [-0.4, -0.2], [0.1, -0.5], [0.6, -0.4]],
  car:      [[-1, -0.3], [-1, 0.1], [-0.6, 0.15], [-0.35, 0.55], [0.35, 0.55], [0.6, 0.15], [1, 0.05], [1, -0.3], [0.75, -0.3], [0.7, -0.5], [0.45, -0.5], [0.4, -0.3], [-0.4, -0.3], [-0.45, -0.5], [-0.7, -0.5], [-0.75, -0.3]],
  mushroom: [[-0.9, 0.1], [-0.75, 0.55], [-0.4, 0.9], [0, 1], [0.4, 0.9], [0.75, 0.55], [0.9, 0.1], [0.25, 0.1], [0.3, -1], [-0.3, -1], [-0.25, 0.1]],
  boat:     [[-1, -0.4], [-0.1, -0.4], [-0.1, 1], [0.7, -0.2], [0, -0.2], [0, -0.4], [1, -0.4], [0.7, -1], [-0.7, -1]],
  hammer:   [[-0.15, 1], [0.8, 1], [0.8, 0.5], [0.15, 0.5], [0.15, -1], [-0.15, -1], [-0.15, 0.55], [-0.5, 0.68], [-0.85, 0.45], [-0.6, 0.85]],
  umbrella: [[-1, 0.2], [-0.8, 0.65], [-0.4, 0.95], [0, 1], [0.4, 0.95], [0.8, 0.65], [1, 0.2], [0.5, 0.35], [0.05, 0.2], [0.05, -0.75], [0.15, -0.85], [0.3, -0.65], [0.4, -0.65], [0.4, -0.9], [0.15, -1], [-0.05, -0.9], [-0.05, 0.2], [-0.5, 0.35]],
  chair:    [[-0.6, 1], [-0.4, 1], [-0.4, 0], [0.6, 0], [0.6, -1], [0.4, -1], [0.4, -0.2], [-0.4, -0.2], [-0.4, -1], [-0.6, -1]],
  plane:    [[0, 1], [0.12, 0.6], [0.12, 0.2], [1, -0.15], [1, -0.35], [0.12, -0.2], [0.1, -0.7], [0.4, -0.9], [0.4, -1], [-0.4, -1], [-0.4, -0.9], [-0.1, -0.7], [-0.12, -0.2], [-1, -0.35], [-1, -0.15], [-0.12, 0.2], [-0.12, 0.6]],
  spoon:    [[0, 1], [0.2, 0.95], [0.33, 0.8], [0.36, 0.6], [0.28, 0.38], [0.1, 0.22], [0.07, -0.9], [0, -1], [-0.07, -0.9], [-0.1, 0.22], [-0.28, 0.38], [-0.36, 0.6], [-0.33, 0.8], [-0.2, 0.95]],
  bottle:   [[-0.13, 1], [0.13, 1], [0.13, 0.88], [0.09, 0.88], [0.09, 0.55], [0.32, 0.25], [0.32, -1], [-0.32, -1], [-0.32, 0.25], [-0.09, 0.55], [-0.09, 0.88], [-0.13, 0.88]],
  pencil:   [[-0.15, 1], [0.15, 1], [0.15, -0.6], [0, -1], [-0.15, -0.6]],
  boot:     [[-0.5, 1], [0.05, 1], [0.05, -0.2], [0.6, -0.4], [0.8, -0.65], [0.8, -1], [-0.1, -1], [-0.1, -0.88], [-0.25, -0.88], [-0.25, -1], [-0.5, -1]],
  bell:     [[0, 1], [0.1, 0.9], [0.1, 0.8], [0.4, 0.6], [0.55, 0.2], [0.6, -0.4], [0.85, -0.7], [0.15, -0.7], [0.15, -0.85], [0, -1], [-0.15, -0.85], [-0.15, -0.7], [-0.85, -0.7], [-0.6, -0.4], [-0.55, 0.2], [-0.4, 0.6], [-0.1, 0.8], [-0.1, 0.9]],
  apple:    [[0.04, 0.55], [0.3, 0.7], [0.65, 0.6], [0.85, 0.25], [0.8, -0.3], [0.5, -0.8], [0.2, -0.95], [0, -0.85], [-0.2, -0.95], [-0.5, -0.8], [-0.8, -0.3], [-0.85, 0.25], [-0.65, 0.6], [-0.3, 0.7], [-0.04, 0.55], [-0.04, 0.85], [0.12, 1], [0.2, 0.95], [0.04, 0.8]],
  candle:   [[0, 1], [0.15, 0.75], [0.1, 0.55], [0.03, 0.5], [0.03, 0.4], [0.25, 0.4], [0.25, -1], [-0.25, -1], [-0.25, 0.4], [-0.03, 0.4], [-0.03, 0.5], [-0.1, 0.55], [-0.15, 0.75]],
  cactus:   [[-0.1, 1], [0.1, 1], [0.18, 0.9], [0.18, 0.1], [0.45, 0.1], [0.45, 0.5], [0.7, 0.5], [0.7, -0.15], [0.18, -0.15], [0.18, -1], [-0.18, -1], [-0.18, -0.4], [-0.7, -0.4], [-0.7, 0.3], [-0.45, 0.3], [-0.45, -0.15], [-0.18, -0.15], [-0.18, 0.9]],
  crown:    [[-0.9, 0.6], [-0.45, 0], [0, 0.8], [0.45, 0], [0.9, 0.6], [0.75, -0.7], [-0.75, -0.7]],
  icecream: [[0, -1], [0.45, 0.2], [0.55, 0.2], [0.5, 0.6], [0.3, 0.9], [0, 1], [-0.3, 0.9], [-0.5, 0.6], [-0.55, 0.2], [-0.45, 0.2]],
  glass:    [[-0.5, 1], [0.5, 1], [0.45, 0.5], [0.25, 0.15], [0.05, 0.05], [0.05, -0.85], [0.4, -0.92], [0.4, -1], [-0.4, -1], [-0.4, -0.92], [-0.05, -0.85], [-0.05, 0.05], [-0.25, 0.15], [-0.45, 0.5]],
}

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

// Centre each outline on its bounding box and scale its longer side to 2 (-1..1),
// so every object looks about the same size in the sky.
for (const name in OBJECTS) {
  const xs = OBJECTS[name].map((p) => p[0])
  const ys = OBJECTS[name].map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const scale = 2 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  OBJECTS[name] = OBJECTS[name].map(([x, y]) => [(x - cx) * scale, (y - cy) * scale])
}

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

// Background stars, all around. Earth hides the ones below the horizon.
const backgroundStars = []
for (let i = 0; i < 1500; i++) backgroundStars.push(...new THREE.Vector3().randomDirection().multiplyScalar(60).toArray())
scene.add(new THREE.Points(
  new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(backgroundStars, 3)),
  starMaterial(3, 0.7),
))

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

// One line outline and one set of corner stars per object, shared by every copy.
// Line2 instead of a plain line because WebGL draws plain lines 1px wide.
const GEOMETRY = {}
for (const name in OBJECTS) {
  const points = OBJECTS[name]
  GEOMETRY[name] = {
    line: new LineGeometry().setPositions([...points, points[0]].flatMap(([x, y]) => [x, y, 0])),
    stars: new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(([x, y]) => [x, y, 0]), 3)),
  }
}
const constellationLine = new LineMaterial({ color: 0x6ea8ff, linewidth: 2, depthTest: false })
const constellationStars = starMaterial(9, 1)
// Constellations the player has tested and found wrong are dimmed, so nobody re-tests one.
const rejectedLine = new LineMaterial({ color: 0x26344d, linewidth: 2, depthTest: false })
const rejectedStars = starMaterial(9, 0.25)

function makeConstellation(name) {
  const group = new THREE.Group()
  group.add(new Line2(GEOMETRY[name].line, constellationLine), new THREE.Points(GEOMETRY[name].stars, constellationStars))
  group.scale.setScalar(SIZE)
  return group
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
heldDot.renderOrder = 2 // drawn over the answer's dot
held.add(heldDot)

// ---- Game state ----------------------------------------------------------------
const rounds = planRounds()
let phase = 'start' // 'start' -> ('search' -> 'rotate' -> 'locked') per round -> 'done'
let round = 0
let startTime
let sky = []        // this round's constellations
let target          // the one that answers the prompt
let rejected        // the ones the player has tested and found wrong
let hovered         // the one under the ring right now
let progress = 0    // 0..1, how full the ring is
let turn = 0        // rotation of the held object, anticlockwise, in radians

const elapsed = () => (performance.now() - startTime) / 1000

const roundEl = document.getElementById('round')
const timerEl = document.getElementById('timer')
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

// A full ring on the wrong constellation. No penalty beyond the time the hold
// took, but say "no" clearly so it doesn't look like the game missed the hold.
function reject(constellation) {
  rejected.add(constellation)
  constellation.children[0].material = rejectedLine
  constellation.children[1].material = rejectedStars
  ringEl.classList.remove('wrong')
  ringEl.getBoundingClientRect() // restart the animation if it's already playing
  ringEl.classList.add('wrong')
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
  held.visible = true
  progress = 0 // the ring now shows the lock hold
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
  ringEl.classList.remove('holding', 'slipping')
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
    document.getElementById('done').style.display = 'flex'
  }, LOCK_PAUSE)
}

// ---- Game loop -----------------------------------------------------------------
const forward = new THREE.Vector3()
let lastTime = 0

function loop(now) {
  const dt = (now - lastTime) / 1000
  lastTime = now
  earthMaterial.uniforms.drift.value = now * 0.000002
  camera.getWorldDirection(forward)

  // Spin every constellation in place, the answer too while the player turns the
  // dial, so fitting it means tracking a moving shape. Only a locked answer stops,
  // so the match stays lined up on screen.
  for (const c of sky) {
    if (c !== target || phase === 'search' || phase === 'rotate') c.rotateZ(c.userData.spin * dt)
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
    // The lock ring fills green while position and rotation are both right, and turns
    // red and pauses when either slips. It never drains: time spent matched adds up,
    // so a slip costs only the time it takes to get back on. A full ring locks the round.
    const onTarget = forward.angleTo(target.position) < POS_TOLERANCE
    held.material.color.set(onTarget ? ON_TARGET_COLOR : HELD_COLOR)
    const matched = onTarget && isMatched()
    if (matched) progress = Math.min(1, progress + dt / LOCK_SECONDS)
    ringEl.classList.toggle('holding', matched)
    ringEl.classList.toggle('slipping', !matched)
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
