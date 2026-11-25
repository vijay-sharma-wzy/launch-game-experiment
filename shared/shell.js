// CLIENT. The display-only shell every game after Constellations runs in: the start
// screen, the HUD, the DONE screen, the canvas, and the loop that forwards raw
// pointer input to the server and draws whatever frame comes back. It holds no game
// rules, answers or labels; it can't tell a right move from a wrong one.
import './shell.css'
import { connect } from './transport.js'
import { addSprites, render } from './render.js'

export function runGame({ title, instructions, server }) {
  const link = connect(server)
  document.title = `${title} · LAUNCH`
  document.body.insertAdjacentHTML('beforeend', `
    <canvas></canvas>
    <div class="hud"><span class="round"></span><span><span class="penalty"></span><span class="timer"></span></span></div>
    <div class="prompt"></div>
    <div class="overlay start">
      <h1></h1>
      <p></p>
      <button class="primary">Start</button>
      <a class="back" href="../../">← All games</a>
    </div>
    <div class="overlay done">
      <h1>DONE</h1>
      <div class="score"></div>
      <p class="penalties"></p>
      <details class="readout"><summary>Bot-risk readout (demo)</summary><table></table></details>
      <button class="primary">Play again</button>
      <a class="back" href="../../">← All games</a>
    </div>`)
  const $ = (selector) => document.querySelector(selector)
  $('.start h1').textContent = title
  $('.start p').textContent = instructions

  const canvas = $('canvas')
  const ctx = canvas.getContext('2d')
  let w = 0
  let h = 0
  function resize() {
    const dpr = devicePixelRatio || 1
    w = innerWidth
    h = innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()

  // Raw pointer input, in screen units (screen centre is 0, 0; the screen is 1 tall).
  // The client never interprets it; the server decides what it means.
  const forward = (kind) => (e) => {
    if (kind === 'down') canvas.setPointerCapture(e.pointerId)
    link.send('input', {
      kind,
      x: (e.clientX - w / 2) / h,
      y: (e.clientY - h / 2) / h,
      buttons: e.buttons,
      pointerType: e.pointerType,
      ct: Math.round(e.timeStamp),
    })
  }
  canvas.addEventListener('pointerdown', forward('down'))
  canvas.addEventListener('pointermove', forward('move'))
  canvas.addEventListener('pointerup', forward('up'))
  canvas.addEventListener('pointercancel', forward('up'))
  addEventListener('resize', () => {
    resize()
    link.send('window', { kind: 'resize', w, h })
  })
  addEventListener('focus', () => link.send('window', { kind: 'focus' }))
  addEventListener('blur', () => link.send('window', { kind: 'blur' }))
  document.addEventListener('visibilitychange', () => link.send('window', { kind: document.visibilityState }))

  let shownPenalty = 0
  let finished = false
  function loop(now) {
    const frame = link.send('step')
    if (frame) {
      addSprites(frame.sprites)
      render(ctx, frame, w, h, now / 1000)
      $('.round').textContent = `Round ${frame.hud.round} / ${frame.hud.rounds}`
      $('.timer').textContent = `${frame.hud.time.toFixed(2)}s`
      $('.prompt').textContent = frame.prompt ?? ''
      if (frame.hud.penalty && !shownPenalty) {
        const el = $('.penalty')
        el.textContent = `+${frame.hud.penalty}s`
        el.classList.remove('show')
        el.getBoundingClientRect() // restart the animation
        el.classList.add('show')
      }
      shownPenalty = frame.hud.penalty
      if (frame.done && !finished) {
        finished = true
        showDone(frame.done)
      }
    }
    requestAnimationFrame(loop)
  }

  function showDone({ score, penalty, wrong, risk }) {
    $('.score').textContent = `${score.toFixed(2)}s`
    $('.penalties').textContent = wrong ? `Includes +${penalty}s for ${wrong} wrong ${wrong === 1 ? 'pick' : 'picks'}` : ''
    const rows = [['Risk score (0 human – 1 bot)', risk.risk ?? 'not enough data'], ...Object.entries(risk.features), ...Object.entries(risk.indicators).map(([k, v]) => [`↳ ${k}`, v])]
    $('.readout table').innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')
    $('.prompt').textContent = ''
    $('.done').style.display = 'flex'
  }

  $('.start button').onclick = () => {
    $('.start').style.display = 'none'
    link.send('start', { view: { w, h, dpr: devicePixelRatio || 1 } })
  }
  $('.done button').onclick = () => location.reload()
  requestAnimationFrame(loop)
}
