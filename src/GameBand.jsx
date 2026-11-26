import { useEffect, useLayoutEffect, useRef } from 'react'
import { SERIES } from './stations.js'

// The way in to every station, drawn like the tuner band: a series is a band, printed once, and
// each game is a mark on it. A touch on a mark opens that game's wheel, and the needle sits on the
// game of the station that is on. `extras` are marks that come first and aren't games (favourites,
// recents); like games, they are { id, name, mark }.
export default function GameBand({ extras, games, active, onOpen }) {
  const well = useRef(null)
  const needle = useRef(null)
  const placed = useRef(false)
  const marks = [...extras, ...games].map((g) => g.id).join(' ')

  // A mouse wheel has one axis: over the band, it moves along the band.
  useEffect(() => {
    const el = well.current
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // The needle slides to the active mark, and the band keeps that mark in view.
  useLayoutEffect(() => {
    const mark = active && well.current.querySelector(`[data-game="${active}"]`)
    needle.current.style.opacity = mark ? 1 : 0
    if (!mark) return
    const x = mark.offsetLeft + mark.offsetWidth / 2
    needle.current.style.transform = `translateX(${x}px)`
    // Already in place when the app opens; a slide only when the station changes.
    const calm = !placed.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    placed.current = true
    well.current.scrollTo({ left: x - well.current.clientWidth / 2, behavior: calm ? 'auto' : 'smooth' })
  }, [active, marks])

  // The extras stand together; consecutive games of one series share a group; a game without a
  // series is a group of its own.
  const groups = extras.length ? [{ games: extras }] : []
  for (const g of games) {
    const last = groups[groups.length - 1]
    if (g.series && last?.series === g.series) last.games.push(g)
    else groups.push({ series: g.series, games: [g] })
  }

  return (
    <nav className="gameband" aria-label="Ouvrir la roue d'un jeu">
      <div ref={well} className="gameband-well">
        <div className="gameband-scale">
          {groups.map((group) => (
            <div key={group.games[0].id} className="gameband-group">
              {group.series && (
                <span className="gameband-series" aria-hidden="true">
                  {SERIES[group.series]}
                </span>
              )}
              {group.games.map((g) => (
                <button key={g.id} className="gameband-mark" data-game={g.id} aria-label={g.name} aria-current={g.id === active ? 'true' : undefined} onClick={() => onOpen(g.id)}>
                  {g.mark}
                </button>
              ))}
            </div>
          ))}
          <i ref={needle} className="gameband-needle" />
        </div>
      </div>
    </nav>
  )
}
