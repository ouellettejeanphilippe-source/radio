// Per-video listening history: { [videoId]: { d: duration, iv: [[start, end], ...] } }
const KEY = 'radio:heard'
const MIN_GAP = 60

export function readHeard() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

function writeHeard(all) {
  localStorage.setItem(KEY, JSON.stringify(all))
}

function merge(list) {
  const sorted = [...list].sort((a, b) => a[0] - b[0])
  const out = []
  for (const [a, b] of sorted) {
    const last = out[out.length - 1]
    if (last && a <= last[1] + 2) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

export function addHeard(videoId, a, b, d) {
  const all = readHeard()
  const rec = all[videoId] || { d, iv: [] }
  rec.d = d || rec.d
  rec.iv = merge([...rec.iv, [Math.floor(a), Math.ceil(b)]])
  all[videoId] = rec
  writeHeard(all)
  return all
}

export function clearHeard(videoId) {
  const all = readHeard()
  delete all[videoId]
  writeHeard(all)
  return all
}

export function heardRatio(rec) {
  if (!rec?.d) return 0
  return Math.min(1, rec.iv.reduce((sum, [a, b]) => sum + (b - a), 0) / rec.d)
}

// The mix loops, so the timeline is circular: find the longest unheard stretch
// and start near its beginning, with a little randomness so it still feels like tuning in.
export function pickStart(rec, d) {
  const iv = merge((rec?.iv ?? []).map(([a, b]) => [Math.max(0, a), Math.min(d, b)]).filter(([a, b]) => b > a))
  if (!iv.length) return { start: Math.random() * d, reset: false }
  let best = { start: 0, len: -1 }
  iv.forEach(([, end], i) => {
    const nextStart = i + 1 < iv.length ? iv[i + 1][0] : iv[0][0] + d
    const len = nextStart - end
    if (len > best.len) best = { start: end, len }
  })
  if (best.len < MIN_GAP) return { start: Math.random() * d, reset: true }
  const offset = Math.random() * Math.min(best.len * 0.1, 120)
  return { start: (best.start + offset) % d, reset: false }
}
