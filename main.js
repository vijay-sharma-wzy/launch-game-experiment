import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'

// ---- Tunables ----------------------------------------------------------------
const ROUNDS = 5              // rounds per game
const SHAPE_COUNT = 5         // shapes placed around the player each round (max: number of SHAPES below)
const DISTANCE = 5            // how far the shapes sit from the player (world units)
const SIZE = 1                // half the width/height of every shape's bounding box (world units)
const LINE_WIDTH = 5          // outline thickness in pixels; thin lines get lost against the camera feed
const HALO_WIDTH = 3          // black border each side of an outline, so it stands out on light and dark backgrounds
const FILL_SECONDS = 5        // time to fill the progress ring
const POS_TOLERANCE = 0.06    // how close the shape must be to screen centre (screen runs -1..1)
const TILT_TOLERANCE = 10 * Math.PI / 180 // how well rotation must match (radians)
const MIN_SEPARATION = 50 * Math.PI / 180 // smallest angle between two shapes, so they never overlap on screen
const FLOOR_CUTOUT = 90 * Math.PI / 180  // width of the cone cut out straight below the player, so no shapes at their feet
const MAX_TURN = 90 * Math.PI / 180      // furthest a shape can be left or right of "forward"; nothing further behind

let startTime // when the first round began, for the score

// ---- Pages: name -> start ----------------------------------------------------
// Show one of the pre-game pages and hide the rest. showPage(null) hides them all.
function showPage(id) {
  for (const page of document.querySelectorAll('.page')) page.style.display = page.id === id ? 'flex' : 'none'
}

// Page 1: username. Pressing Next (or Enter) goes to page 2.
const usernameInput = document.getElementById('username')
document.getElementById('name').onsubmit = (e) => {
  e.preventDefault() // stop the form reloading the page
  if (usernameInput.value.trim()) showPage('start')
}

// ---- Shapes ----------------------------------------------------------------
// Hand-drawn outlines with clearly different silhouettes. None has rotational
// symmetry (mirror symmetry is fine), so only one rotation matches the target.
const SHAPES = {
  triangle:  [[0, 1], [-0.6, -0.8], [0.6, -0.8]],
  house:     [[0, 1], [0.8, 0.3], [0.8, -0.9], [-0.8, -0.9], [-0.8, 0.3]],
  arrow:     [[0, 1], [0.8, 0.1], [0.3, 0.1], [0.3, -1], [-0.3, -1], [-0.3, 0.1], [-0.8, 0.1]],
  L:         [[-0.7, 1], [-0.1, 1], [-0.1, -0.3], [0.7, -0.3], [0.7, -1], [-0.7, -1]],
  trapezoid: [[-0.4, 0.7], [0.4, 0.7], [1, -0.7], [-1, -0.7]],
  chevron:   [[-1, 0.6], [0, -0.2], [1, 0.6], [1, 0], [0, -0.8], [-1, 0]],
  T:         [[-0.9, 1], [0.9, 1], [0.9, 0.5], [0.25, 0.5], [0.25, -1], [-0.25, -1], [-0.25, 0.5], [-0.9, 0.5]],
  flag:      [[-0.6, 1], [0.7, 0.5], [-0.4, 0], [-0.4, -1], [-0.6, -1]],
}

// Centre a shape on its bounding box and scale it so its longer side is 2 * SIZE,
// so every shape looks about the same size. Returns a closed x,y,z list for LineGeometry.
function shapePositions(points) {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const scale = (2 * SIZE) / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  return [...points, points[0]].flatMap(([x, y]) => [(x - cx) * scale, (y - cy) * scale, 0])
}

// Line2 instead of a plain line because WebGL draws plain lines 1px wide. Each outline
// gets a wider black copy behind it as a halo, so it reads against any room.
// Depth testing is off (the shapes never overlap in the world), so draw order is
// just renderOrder: halo first, then the coloured line on top.
function makeOutline(geometry, color, order) {
  const line = new Line2(geometry, new LineMaterial({ color, linewidth: LINE_WIDTH, depthTest: false }))
  const halo = new Line2(geometry, new LineMaterial({ color: 0x000000, linewidth: LINE_WIDTH + 2 * HALO_WIDTH, depthTest: false }))
  halo.renderOrder = order
  line.renderOrder = order + 1
  line.add(halo) // a child, so it follows the line's position and rotation
  return line
}

// The play area: the sphere around the player, minus a cone straight below them
// and minus everything behind them (more than MAX_TURN left or right of forward).
// Pick a random direction on the whole sphere and re-roll until it lands in the play area.
let forwardYaw = 0 // compass heading the player faced when they tapped Start

function randomPlayDirection() {
  const d = new THREE.Vector3().randomDirection() // here "forward" is -Z, as for an unrotated camera
  const angleFromFloor = Math.acos(-d.y)
  const turn = Math.atan2(d.x, -d.z) // 0 = straight ahead, ±90° = directly left/right
  if (angleFromFloor < FLOOR_CUTOUT / 2 || Math.abs(turn) > MAX_TURN) return randomPlayDirection()
  return d.applyAxisAngle(new THREE.Vector3(0, 1, 0), forwardYaw) // swing round to face the player's real forward
}

// ---- Scene -------------------------------------------------------------------
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 100) // sits at the origin
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) // transparent, so the camera feed shows through
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(devicePixelRatio)
document.getElementById('video').after(renderer.domElement) // after the video so it draws on top
scene.add(camera)

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

// ---- Rounds ------------------------------------------------------------------
const roundEl = document.getElementById('round')
let round = 0
let shapes = []
let target            // the shape the player has to find this round
let targetOutline     // its white copy, pinned to the centre of the screen
let progress = 0      // 0..1

function startRound() {
  for (const shape of shapes) scene.remove(shape)
  if (targetOutline) camera.remove(targetOutline)

  // Pick SHAPE_COUNT different shapes and scatter them over the play area, facing inward,
  // with a random roll so the player has to match the rotation too.
  const names = Object.keys(SHAPES).sort(() => Math.random() - 0.5).slice(0, SHAPE_COUNT)
  shapes = []
  while (shapes.length < SHAPE_COUNT) {
    const direction = randomPlayDirection()
    if (shapes.some((s) => s.position.angleTo(direction) < MIN_SEPARATION)) continue // too close to another, re-roll
    const geometry = new LineGeometry().setPositions(shapePositions(SHAPES[names[shapes.length]]))
    const shape = makeOutline(geometry, 0x00ffff, 0)
    shape.position.copy(direction.multiplyScalar(DISTANCE))
    shape.lookAt(0, 0, 0)
    shape.rotateZ(Math.random() * 2 * Math.PI)
    scene.add(shape)
    shapes.push(shape)
  }

  // Pick the target and pin a copy of its outline to the camera so it stays centred on screen.
  target = shapes[Math.floor(Math.random() * SHAPE_COUNT)]
  targetOutline = makeOutline(target.geometry, 0xffffff, 2) // drawn over the cyan shapes
  targetOutline.position.z = -DISTANCE // same distance as the real shapes => same on-screen size
  camera.add(targetOutline)

  progress = 0
  round++
  roundEl.textContent = `Round ${round} / ${ROUNDS}`
}

// ---- Phone orientation -> camera -------------------------------------------------
// Converts the phone's alpha/beta/gamma into a camera rotation (same maths as
// three.js's old DeviceOrientationControls).
const flipX = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2) // -90° around X: phone lies flat -> camera looks forward

addEventListener('deviceorientation', (e) => {
  if (e.alpha === null) return
  const toRad = Math.PI / 180
  const screenAngle = (screen.orientation?.angle ?? 0) * toRad
  camera.quaternion.setFromEuler(new THREE.Euler(e.beta * toRad, e.alpha * toRad, -e.gamma * toRad, 'YXZ'))
  camera.quaternion.multiply(flipX)
  camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -screenAngle))
})

// ---- Overlap check -------------------------------------------------------------
function isOverlapping() {
  // Position: where does the target land on screen? (0,0 = centre, z<1 = in front of us)
  const onScreen = target.position.clone().project(camera)
  if (onScreen.z > 1 || onScreen.x ** 2 + onScreen.y ** 2 > POS_TOLERANCE ** 2) return false

  // Tilt: angle between the shape's "up" and the screen's "up". The shapes have
  // no rotational symmetry, so only one rotation matches.
  const shapeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(target.quaternion)
  shapeUp.applyQuaternion(camera.quaternion.clone().invert()) // now in camera space
  return Math.abs(Math.atan2(shapeUp.x, shapeUp.y)) < TILT_TOLERANCE
}

// ---- Game loop -----------------------------------------------------------------
const ringEl = document.getElementById('ring')
const RING_LENGTH = 377 // circumference of the SVG ring (2 * pi * 60)
let lastTime = 0

function loop(now) {
  const dt = (now - lastTime) / 1000
  lastTime = now

  progress += (isOverlapping() ? dt : -dt) / FILL_SECONDS
  progress = Math.min(1, Math.max(0, progress))
  ringEl.style.strokeDashoffset = RING_LENGTH * (1 - progress)

  renderer.render(scene, camera)

  if (progress >= 1) {
    if (round === ROUNDS) return finish() // stop the loop; refresh the page to play again
    startRound()
  }
  requestAnimationFrame(loop)
}

// All rounds done: stop the clock and show the time.
function finish() {
  const seconds = (performance.now() - startTime) / 1000
  document.getElementById('done').style.display = 'flex'
  document.getElementById('scores').textContent = `${usernameInput.value.trim()}: ${seconds.toFixed(2)}s`
}

// ---- Start ---------------------------------------------------------------------
// Page 2: Start.
// iOS only sends motion data after the user grants permission from a tap, so ask
// for that first, while we're still directly inside the tap handler.
document.querySelector('#start button').onclick = async () => {
  if (DeviceOrientationEvent.requestPermission) {
    const result = await DeviceOrientationEvent.requestPermission()
    if (result !== 'granted') return alert('Motion permission is required to play')
  }

  // Rear camera as the background. If it's refused the game still works on a dark background.
  try {
    const video = document.getElementById('video')
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    await video.play()
  } catch (err) {
    console.warn('No camera background:', err)
  }

  showPage(null)
  // Lock in "forward" as the way the phone faces now (ignoring up/down tilt).
  const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
  forwardYaw = Math.atan2(-facing.x, -facing.z)

  lastTime = startTime = performance.now()
  startRound()
  requestAnimationFrame(loop)
}
