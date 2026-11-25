import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SERIES } from './stations.js'

// The home screen's index, built like the tuner band: a series is a band, printed once, and each
// game is a mark on it. The needle sits on the game the page is scrolled to, and a tap on a mark
// takes the page there. It sticks to the top once the header has scrolled away.
// `games` are the ones with a shelf on the page (their sections have the id `jeu-<id>`), and
// `scroller` is the element that scrolls them.
export default function GameBand({ games, scroller }) {
  const [active, setActive] = useState(null)
  const [stuck, setStuck] = useState(false)
  const nav = useRef(null)
  const well = useRef(null)
  const needle = useRef(null)
  // After a tap, the page travels past other games on its way: the needle waits at the destination.
  const travelling = useRef(false)
  const ids = games.map((g) => g.id).join(' ')

  useEffect(() => {
    const el = scroller.current
    const list = ids.split(' ')
    let frame = 0
    let idle = 0
    const read = () => {
      frame = 0
      // Stuck: the band no longer sits right under the header that precedes it.
      const header = nav.current.previousElementSibling
      setStuck(header ? nav.current.getBoundingClientRect().top - header.getBoundingClientRect().bottom > 9 : el.scrollTop > 0)
      if (travelling.current) return
      // The game whose shelf has reached the band; at the very bottom, the last one.
      const line = el.scrollTop + nav.current.offsetHeight + 32
      let found = null
      for (const id of list) {
        const shelf = document.getElementById(`jeu-${id}`)
        if (!shelf || shelf.offsetTop > line) break
        found = id
      }
      if (found && el.scrollTop + el.clientHeight >= el.scrollHeight - 2) found = list[list.length - 1]
      // At the top of the page, the first game is where you are, unless favourites or recents come first.
      if (!found && document.getElementById(`jeu-${list[0]}`)?.previousElementSibling === nav.current) found = list[0]
      setActive(found)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read)
      if (travelling.current) {
        clearTimeout(idle)
        idle = setTimeout(() => {
          travelling.current = false
          read()
        }, 140)
      }
    }
    read()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
      clearTimeout(idle)
    }
  }, [scroller, ids])

  // A mouse wheel has one axis: over the band, it moves along the band instead of the page.
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
    well.current.scrollTo({ left: x - well.current.clientWidth / 2, behavior: calm() ? 'auto' : 'smooth' })
  }, [active, ids])

  function go(id) {
    const shelf = document.getElementById(`jeu-${id}`)
    if (!shelf) return
    travelling.current = true
    setActive(id)
    shelf.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' })
    // Already there: no scroll event will come to end the trip.
    setTimeout(() => (travelling.current = false), 1200)
  }

  // Consecutive games of one series share a group; a game without a series is a group of its own.
  const groups = []
  for (const g of games) {
    const last = groups[groups.length - 1]
    if (g.series && last?.series === g.series) last.games.push(g)
    else groups.push({ series: g.series, games: [g] })
  }

  return (
    <nav ref={nav} className={`gameband ${stuck ? 'is-stuck' : ''}`} aria-label="Aller à un jeu">
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
                <button key={g.id} className="gameband-mark" data-game={g.id} aria-label={g.name} aria-current={g.id === active ? 'true' : undefined} onClick={() => go(g.id)}>
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

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
