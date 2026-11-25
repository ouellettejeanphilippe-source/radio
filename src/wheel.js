// Where the logos of the radio wheel go, for n stations on a w × h screen.
// Up to a dozen stations fit a circle at a finger's size. Past that (GTA V has 25), the ring
// stretches along the screen's long side into an oval, and the logos are spaced evenly along it.
const WANT = 46 // a logo's size once the ring is crowded
const GAP = 6
const STEPS = 720

// Ramanujan's approximation of an ellipse's perimeter.
const perimeter = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))

export function wheelLayout(n, w, h) {
  const size = Math.min(w * 0.94, h * 0.86, 600)
  let rx = size * 0.39
  let ry = rx
  const need = n * (WANT + GAP)
  const maxRx = w / 2 - WANT / 2 - 12
  const maxRy = h / 2 - WANT / 2 - 12
  while (perimeter(rx, ry) < need) {
    const roomX = maxRx - rx
    const roomY = maxRy - ry
    if (roomX < 4 && roomY < 4) break
    if (roomY >= roomX) ry += 4
    else rx += 4
  }
  const item = Math.max(28, Math.min(size * 0.17, perimeter(rx, ry) / Math.max(n, 1) - GAP))

  // Walk the ellipse from the top, clockwise, and drop a logo every 1/n of its length.
  const at = (k) => {
    const t = -Math.PI / 2 + (k / STEPS) * 2 * Math.PI
    return { x: rx * Math.cos(t), y: ry * Math.sin(t) }
  }
  const length = [0]
  for (let k = 1; k <= STEPS; k++) {
    const a = at(k - 1)
    const b = at(k)
    length.push(length[k - 1] + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const pts = []
  let k = 0
  for (let i = 0; i < n; i++) {
    const target = (i / n) * length[STEPS]
    while (k < STEPS - 1 && length[k + 1] < target) k++
    pts.push(at(k + (target - length[k]) / (length[k + 1] - length[k] || 1)))
  }
  return { rx, ry, item, pts }
}

// The logo a pointer aims at: the nearest one, once the pointer has left the middle of the wheel.
// dx, dy are measured from the wheel's centre. Returns an index, or -1.
export function aimAt({ rx, ry, pts }, dx, dy) {
  if (Math.hypot(dx / rx, dy / ry) < 0.4) return -1
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
