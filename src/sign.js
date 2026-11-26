import { useSyncExternalStore } from 'react'

// A station with no picture of its own gets its name written out, like a sign over a door. This
// works out how to write it so that it fills a square: which words go on which line, and how large.

const FACE = '"Pricedown Bl", Impact, "Arial Black", sans-serif'
export const signFont = (px) => `900 ${px}px ${FACE}`
export const SIGN_LINE = 0.94 // a line's height, in ems (the same in index.css)
const ROOM = 0.86 // how much of the square the name may take, each way
const LARGEST = 0.32 // a short name doesn't shout: letters no taller than a third of the square

// Measured with the display face once it has arrived; what was measured before that is redone.
const fitted = new Map()
const waiting = new Set()
let faces = 0
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.addEventListener('loadingdone', () => {
    fitted.clear()
    faces++
    waiting.forEach((redraw) => redraw())
  })
}
const watch = (redraw) => {
  waiting.add(redraw)
  return () => waiting.delete(redraw)
}
// For a component that draws a sign: it draws again when the fonts change.
export const useFaces = () => useSyncExternalStore(watch, () => faces)

let pen
// { lines, size }: the name's lines, and the size of its letters as a share of the square's side.
export function sign(name) {
  if (fitted.has(name)) return fitted.get(name)
  pen ??= document.createElement('canvas').getContext('2d')
  pen.font = signFont(100)
  // A lone « / » or « : » stays at the end of the word before it rather than starting a line.
  const words = name.split(/\s+/).reduce((all, word) => (/^[/:·-]$/.test(word) && all.length ? [...all.slice(0, -1), `${all.at(-1)} ${word}`] : [...all, word]), [])
  let best = { lines: [name], size: 0 }
  // Every way of cutting the name into up to four lines: there are few words in a name.
  for (let cuts = 0; cuts < 1 << (words.length - 1); cuts++) {
    const lines = [[]]
    words.forEach((word, i) => {
      if (i && cuts & (1 << (i - 1))) lines.push([])
      lines.at(-1).push(word)
    })
    if (lines.length > 4) continue
    const text = lines.map((line) => line.join(' '))
    const widest = Math.max(...text.map((line) => pen.measureText(line).width / 100))
    const size = Math.min(ROOM / widest, ROOM / (lines.length * SIGN_LINE), LARGEST)
    if (size > best.size) best = { lines: text, size }
  }
  fitted.set(name, best)
  return best
}

// For where there is no room for a name: two letters of it.
export function initials(name) {
  const words = name
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
  return words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)
}
