// Where the logos of the radio wheel go, for n stations on a w × h screen: always on a circle.
// Up to a dozen stations get the roomy wheel. Past that (GTA V has 25), the circle grows as far
// as the screen allows, and then the logos shrink to fit around it.
const WANT = 46 // a logo's size once the ring is crowded, when there is room for it
const GAP = 5

export function wheelLayout(n, w, h) {
  const count = Math.max(n, 1)
  const size = Math.min(w * 0.94, h * 0.86, 600)
  const roomy = size * 0.39
  // The radius at which the logos are WANT wide, and the largest one whose logos still stay on screen.
  const wanted = (count * (WANT + GAP)) / (2 * Math.PI)
  const fits = (Math.min(w, h, 616) / 2 - 8 + GAP / 2) / (1 + Math.PI / count)
  const r = Math.max(roomy, Math.min(wanted, fits))
  const item = Math.max(24, Math.min(size * 0.17, (2 * Math.PI * r) / count - GAP))

  // From the top, clockwise.
  const pts = Array.from({ length: n }, (_, i) => {
    const t = -Math.PI / 2 + (i / n) * 2 * Math.PI
    return { x: r * Math.cos(t), y: r * Math.sin(t) }
  })
  return { r, item, pts }
}

// The logo a pointer aims at: the nearest one, once the pointer has left the middle of the wheel.
// dx, dy are measured from the wheel's centre. Returns an index, or -1.
export function aimAt({ r, pts }, dx, dy) {
  if (Math.hypot(dx, dy) < r * 0.4) return -1
  let best = -1
  let bestDist = Infinity
  pts.forEach((p, i) => {
    const dist = Math.hypot(dx - p.x, dy - p.y)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  })
  return best
}
