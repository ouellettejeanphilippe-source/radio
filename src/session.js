// What the phone gets from the app. The lock screen, the notification, a car's buttons, the voice
// assistant and launchers like AutoZen all talk to the page's media session (see App.jsx for the
// title and the keys); this file is what makes that session ours, and its artwork.
import { SIGN_LINE, sign, signFont } from './sign.js'

// The browser hands those controls to the frame that makes the sound. Here that is YouTube's
// player, in its iframe, which knows the video's title and nothing about stations: left alone,
// the phone shows the video and its keys can't change station. So the page plays a track of its
// own alongside, pure silence. Among the frames that play, the top one wins, and the title, the
// artwork and the keys become the app's.
// 30 s long: Chrome ignores sounds under 5 s for the notification.
let keeper
function silence() {
  const rate = 8000
  const samples = rate * 30
  const wav = new DataView(new ArrayBuffer(44 + samples))
  const text = (at, s) => [...s].forEach((c, i) => wav.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  wav.setUint32(4, 36 + samples, true)
  text(8, 'WAVEfmt ')
  wav.setUint32(16, 16, true)
  wav.setUint16(20, 1, true) // PCM
  wav.setUint16(22, 1, true) // mono
  wav.setUint32(24, rate, true)
  wav.setUint32(28, rate, true)
  wav.setUint16(32, 1, true)
  wav.setUint16(34, 8, true)
  text(36, 'data')
  wav.setUint32(40, samples, true)
  // 8-bit samples are unsigned: 128 is silence.
  new Uint8Array(wav.buffer, 44).fill(128)
  return URL.createObjectURL(new Blob([wav.buffer], { type: 'audio/wav' }))
}

// Plays the silent track while a station plays, and stops it with the station.
export function holdSession(playing) {
  if (!playing) return keeper?.pause()
  if (!keeper) {
    keeper = new Audio(silence())
    keeper.loop = true
  }
  // Refused when nothing has been touched yet; the touch that starts a station comes first.
  keeper.play().then(
    () => (refused = null),
    (e) => (refused = e.name),
  )
}

// What the silent track is doing, for the settings panel: 'idle' (never started), 'playing',
// 'paused', or 'refused' with the browser's reason.
let refused = null
export const sessionStatus = () => (!keeper ? { state: 'idle' } : refused ? { state: 'refused', why: refused } : { state: keeper.paused ? 'paused' : 'playing' })

// On iPhones, two sounds at once is a different story that hasn't been tried: off there unless asked.
export const sessionByDefault = !/iPhone|iPad|iPod/.test(navigator.userAgent)

const mix = (hex, share, into) => {
  const part = (c, i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16)
  return `rgb(${[0, 1, 2].map((i) => Math.round(part(hex, i) * share + part(into, i) * (1 - share))).join(' ')})`
}

// The station's tile as a PNG, for the lock screen: the wiki's logos are often SVG, which the
// notification doesn't draw, and they come without the tile the app puts behind them. A station
// without a logo gets its name on the tile, as in the app; one whose recording has a picture of
// its own gets none, and shows that picture instead (see App.jsx).
// Resolves to a blob URL, or to null.
const tiles = new Map()
export function tile(station) {
  if (!station.logo && station.art) return Promise.resolve(null)
  if (!tiles.has(station.id)) {
    const drawn = station.logo ? withLogo(station).catch(() => withName(station)) : withName(station)
    tiles.set(
      station.id,
      drawn.catch(() => null),
    )
    // A dozen is plenty for one outing; older ones are let go.
    if (tiles.size > 12) {
      const [oldest, url] = tiles.entries().next().value
      tiles.delete(oldest)
      url.then((u) => u && URL.revokeObjectURL(u))
    }
  }
  return tiles.get(station.id)
}

const SIZE = 512
// The same tile as in the app: the station's colour from above, fading into the dark.
function blank(station) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const c = canvas.getContext('2d')
  const light = c.createRadialGradient(SIZE / 2, SIZE * 0.35, 0, SIZE / 2, SIZE * 0.35, SIZE * 0.8)
  light.addColorStop(0, mix(station.color, 0.52, '#15171a'))
  light.addColorStop(1, '#060708')
  c.fillStyle = light
  c.fillRect(0, 0, SIZE, SIZE)
  return { canvas, c }
}
const png = (canvas) => new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('empty tile'))), 'image/png'))

function withLogo(station) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Readable from a canvas, and without a Referer, which the wiki's image host refuses.
    img.crossOrigin = 'anonymous'
    img.referrerPolicy = 'no-referrer'
    img.onerror = reject
    img.onload = () => {
      const { canvas, c } = blank(station)
      const w = img.naturalWidth || SIZE
      const h = img.naturalHeight || SIZE
      const scale = Math.min((SIZE * 0.74) / w, (SIZE * 0.74) / h)
      c.drawImage(img, (SIZE - w * scale) / 2, (SIZE - h * scale) / 2, w * scale, h * scale)
      png(canvas).then(resolve, reject)
    }
    img.src = station.logo
  })
}

// The station's name, written as on its sign in the app (see sign.js and .gen-name).
async function withName(station) {
  // The display face, if it isn't there yet; without it the name is written in the next one.
  await document.fonts.load(signFont(SIZE / 4)).catch(() => {})
  const { canvas, c } = blank(station)
  const { lines, size } = sign(station.name)
  // A little smaller than in the app: phones round the tile's corners, some into a circle.
  const px = size * SIZE * 0.84
  c.font = signFont(px)
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.lineJoin = 'round'
  c.lineWidth = px * 0.1
  c.strokeStyle = '#000'
  c.fillStyle = mix(station.color, 0.6, '#ffffff')
  lines.forEach((line, i) => {
    const y = SIZE / 2 + (i - (lines.length - 1) / 2) * px * SIGN_LINE
    c.strokeText(line, SIZE / 2, y)
    c.fillText(line, SIZE / 2, y)
  })
  return png(canvas)
}

// Registers one of the phone's keys; null takes it away. Browsers throw on the keys they don't know.
export function mediaKey(name, handler) {
  try {
    navigator.mediaSession?.setActionHandler(name, handler)
  } catch {
    // Not a key this browser has.
  }
}
