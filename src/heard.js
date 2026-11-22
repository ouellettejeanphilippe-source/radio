// Per-video listening history:
// { [videoId]: { d: duration, iv: [[start, end], ...], p: last position, t: last change, r: last reset } }
const KEY = 'radio:heard'
const MIN_GAP = 60
// Unheard stretches shorter than this are counted as heard, so the history doesn't end up
// full of little holes that would later be played as tiny fragments.
const HOLE = 60
// Back on a station within this delay: carry on exactly where it was left.
const RESUME_WITHIN = 2 * 60_000
// Otherwise the jump into an unheard stretch leaves pieces at least this long on both sides.
const MIN_BLOCK = 5 * 60

export function readHeard() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY)) || {}
    // Older histories may still have small holes.
    for (const rec of Object.values(all)) rec.iv = merge(rec.iv, rec.d)
    return all
  } catch {
    return {}
  }
}

function writeHeard(all) {
  localStorage.setItem(KEY, JSON.stringify(all))
}

function merge(list, d) {
  const sorted = list.map(([a, b]) => [a, b]).sort((a, b) => a[0] - b[0])
  const out = []
  for (const [a, b] of sorted) {
    const last = out[out.length - 1]
    if (last && a <= last[1] + HOLE) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  // Same at both ends of the recording.
  if (d > 0 && out.length) {
    if (out[0][0] <= HOLE) out[0][0] = 0
    if (d - out[out.length - 1][1] <= HOLE) out[out.length - 1][1] = d
  }
  return out
}

export function addHeard(videoId, a, b, d) {
  const all = readHeard()
  const rec = all[videoId] || { d, iv: [] }
  rec.d = d || rec.d
  rec.iv = merge([...rec.iv, [Math.floor(a), Math.ceil(b)]], rec.d)
  rec.p = Math.ceil(b)
  rec.t = Date.now()
  all[videoId] = rec
  writeHeard(all)
  return all
}

export function clearHeard(videoId) {
  const all = readHeard()
  // Kept as an empty record so the reset also reaches the other devices (see mergeHeard).
  if (all[videoId]) all[videoId] = { d: all[videoId].d, iv: [], t: Date.now(), r: Date.now() }
  writeHeard(all)
  return all
}

// Combines two devices' histories: what was heard on either counts, unless one side restarted
// the station after the other's last listen.
export function mergeHeard(a = {}, b = {}) {
  const out = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id]
    const y = b[id]
    if (!x || !y) out[id] = x || y
    else if ((x.r || 0) > (y.t || 0)) out[id] = x
    else if ((y.r || 0) > (x.t || 0)) out[id] = y
    else
      out[id] = {
        d: x.d || y.d,
        iv: merge([...x.iv, ...y.iv], x.d || y.d),
        t: Math.max(x.t || 0, y.t || 0),
        p: (x.t || 0) >= (y.t || 0) ? x.p : y.p,
        ...((x.r || y.r) && { r: Math.max(x.r || 0, y.r || 0) }),
      }
  }
  return out
}

export function heardRatio(rec) {
  if (!rec?.d) return 0
  return Math.min(1, rec.iv.reduce((sum, [a, b]) => sum + (b - a), 0) / rec.d)
}

// Where to start a station. Left less than 2 minutes ago: same spot. Otherwise tune in somewhere in
// the longest unheard stretch (the mix loops, so the timeline is circular), either at its start or
// far enough inside that neither the skipped part nor the rest is a tiny fragment.
export function pickStart(rec, d) {
  if (rec?.p != null && Date.now() - (rec.t || 0) < RESUME_WITHIN && rec.p < d - 5) return { start: rec.p, reset: false }
  const iv = merge((rec?.iv ?? []).map(([a, b]) => [Math.max(0, a), Math.min(d, b)]).filter(([a, b]) => b > a), d)
  if (!iv.length) return { start: Math.random() * d, reset: false }
  let best = { start: 0, len: -1 }
  iv.forEach(([, end], i) => {
    const nextStart = i + 1 < iv.length ? iv[i + 1][0] : iv[0][0] + d
    const len = nextStart - end
    if (len > best.len) best = { start: end, len }
  })
  if (best.len < MIN_GAP) return { start: Math.random() * d, reset: true }
  const room = best.len - 2 * MIN_BLOCK
  // Starting at the very beginning stays one of the possible spots.
  const offset = room > 0 && Math.random() > 0.25 ? MIN_BLOCK + Math.random() * room : 0
  return { start: (best.start + offset) % d, reset: false }
}
