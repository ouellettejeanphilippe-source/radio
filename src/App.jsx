import { useEffect, useRef, useState } from 'react'
import { ERAS, GAMES, STATIONS } from './stations.js'
import { parseYouTubeId, useYouTubePlayer } from './youtube.js'
import { heardRatio } from './heard.js'

const CURRENT_KEY = 'radio:current'
const MODE_KEY = 'radio:mode'

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function fmt(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00'
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
)
const PLAY = 'M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z'
const PAUSE = 'M6 5h4v14H6zM14 5h4v14h-4z'
const PREV = 'M6 6h2v12H6zm3.5 6 8.5 6V6z'
const NEXT = 'M16 6h2v12h-2zM6 18l8.5-6L6 6z'
const VOL = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4z'
const MUTE = 'M3 9v6h4l5 5V4L7 9H3zm13.59 3L19 9.59 17.59 8.17 15.17 10.6 12.76 8.17 11.34 9.59 13.76 12l-2.42 2.41 1.42 1.42 2.41-2.42 2.42 2.42L19 14.41z'
const RADIO = 'M20 6H8.3l8.26-3.34L15.88 1 3.24 6.15A2 2 0 0 0 2 8v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zM7 20a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm13-8h-2v-2h-2v2H4V8h16v4z'
const CHEVRON = 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z'
const SHUFFLE = 'M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z'
const GAMEPAD = 'M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4-3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z'
const CALENDAR = 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zM7 11h5v5H7z'
const WHEEL = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 0 1 7.75 6h-3.1A5 5 0 0 0 13 7.1V4.06c-.33-.04-.66-.06-1-.06zm-1 .06V7.1A5 5 0 0 0 7.35 10h-3.1A8 8 0 0 1 11 4.06zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-7.75 5h3.1A5 5 0 0 0 11 16.9v3.04A8 8 0 0 1 4.25 14zm12.4 0h3.1A8 8 0 0 1 13 19.94V16.9A5 5 0 0 0 16.65 14z'

const MODES = [
  { id: 'game', label: 'Même jeu', icon: GAMEPAD },
  { id: 'era', label: 'Même époque', icon: CALENDAR },
  { id: 'random', label: 'Aléatoire', icon: SHUFFLE },
]

const thumb = (st) => `https://i.ytimg.com/vi/${st.videoId}/mqdefault.jpg`

// Logo on a tile in the station's colour; falls back to the video thumbnail, then to initials.
function Cover({ station, className = '' }) {
  const sources = [station.logo, thumb(station)].filter(Boolean)
  const [index, setIndex] = useState(0)
  const src = sources[index]
  const isLogo = src && src === station.logo
  if (src) {
    return (
      <div className={`cover ${isLogo ? 'cover--logo' : 'cover--thumb'} ${className}`} style={{ '--c': station.color }}>
        {/* Fandom's image host refuses requests that carry a foreign Referer. */}
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setIndex(index + 1)} />
      </div>
    )
  }
  const initials = station.name
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return (
    <div className={`cover cover--gen ${className}`} style={{ '--c': station.color }}>
      <span>{initials}</span>
    </div>
  )
}

function HeardMap({ rec, position, onReset }) {
  const ratio = heardRatio(rec)
  return (
    <div className="heard">
      <div className="heard-head">
        <span>Tu as entendu {Math.round(ratio * 100)} % de cette station</span>
        {ratio > 0 && (
          <button className="btn-link" onClick={onReset}>
            Recommencer
          </button>
        )}
      </div>
      <div className="heard-bar">
        {rec?.d > 0 &&
          rec.iv.map(([a, b]) => <span key={a} style={{ left: `${(a / rec.d) * 100}%`, width: `${((b - a) / rec.d) * 100}%` }} />)}
        {rec?.d > 0 && position != null && <i style={{ left: `${(position / rec.d) * 100}%` }} />}
      </div>
    </div>
  )
}

// GTA-style radio wheel: logos around a circle, current station name in the middle.
function RadioWheel({ title, stations, currentId, onPick, onClose }) {
  const [hoverId, setHoverId] = useState(null)
  const shown = stations.find((st) => st.id === (hoverId ?? currentId)) ?? stations[0]
  const n = stations.length
  return (
    <div className="wheel-backdrop" onClick={onClose}>
      <div className="wheel" onClick={(e) => e.stopPropagation()} style={{ '--n': n }}>
        <div className="wheel-ring" />
        {stations.map((st, i) => {
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2
          return (
            <button
              key={st.id}
              className={`wheel-item ${st.id === currentId ? 'active' : ''}`}
              style={{ '--x': Math.cos(angle).toFixed(4), '--y': Math.sin(angle).toFixed(4) }}
              onClick={() => onPick(st)}
              onPointerEnter={() => setHoverId(st.id)}
              onPointerLeave={() => setHoverId(null)}
              aria-label={st.name}
            >
              <Cover station={st} />
            </button>
          )
        })}
        <div className="wheel-center">
          <div className="wheel-title">{title}</div>
          {shown && <div className="wheel-name">{shown.name}</div>}
          {shown?.dj && <div className="wheel-dj">{shown.dj}</div>}
        </div>
      </div>
    </div>
  )
}

const STATIONS_PLAYABLE = STATIONS.map((st) => ({ ...st, videoId: parseYouTubeId(st.youtube) })).filter((st) => st.videoId)
const gameLabel = (id) => GAMES.find((g) => g.id === id)?.name
const eraLabel = (id) => ERAS.find((e) => e.id === id)?.name

// Tracks a touch and reports whether it became a horizontal or vertical drag.
function useSwipe({ onMove, onEnd }) {
  const ref = useRef(null)
  return {
    onTouchStart: (e) => {
      const t = e.touches[0]
      ref.current = { x: t.clientX, y: t.clientY, axis: null, dx: 0, dy: 0 }
    },
    onTouchMove: (e) => {
      const s = ref.current
      if (!s) return
      s.dx = e.touches[0].clientX - s.x
      s.dy = e.touches[0].clientY - s.y
      if (!s.axis && Math.hypot(s.dx, s.dy) > 10) s.axis = Math.abs(s.dx) > Math.abs(s.dy) ? 'x' : 'y'
      if (s.axis) onMove?.(s)
    },
    onTouchEnd: () => {
      const s = ref.current
      ref.current = null
      if (s?.axis) onEnd(s)
    },
    onTouchCancel: () => {
      ref.current = null
      onMove?.({ axis: null, dx: 0, dy: 0 })
    },
  }
}

export default function App() {
  const [game, setGame] = useState('all')
  const [query, setQuery] = useState('')
  const [currentId, setCurrentId] = useState(() => readJson(CURRENT_KEY, null))
  const [loadedId, setLoadedId] = useState(null)
  const [mode, setMode] = useState(() => readJson(MODE_KEY, 'game'))
  const [expanded, setExpanded] = useState(false)
  const [wheelOpen, setWheelOpen] = useState(false)
  const [lastVolume, setLastVolume] = useState(80)
  const [dragX, setDragX] = useState(0)
  const history = useRef([])
  const hostRef = useRef(null)
  const yt = useYouTubePlayer(hostRef)

  const stations = STATIONS_PLAYABLE
  const current = stations.find((st) => st.id === currentId)
  const q = query.trim().toLowerCase()
  const visible = stations.filter(
    (st) => (game === 'all' || st.game === game) && (!q || `${st.name} ${st.dj} ${st.genre}`.toLowerCase().includes(q)),
  )
  const isPlaying = yt.status === 'playing' || yt.status === 'buffering'
  const isCurrentLoaded = Boolean(current && loadedId === current.id)
  const modeInfo = MODES.find((m) => m.id === mode) ?? MODES[0]

  useEffect(() => {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(currentId))
  }, [currentId])
  useEffect(() => {
    localStorage.setItem(MODE_KEY, JSON.stringify(mode))
  }, [mode])

  function tune(st) {
    setCurrentId(st.id)
    setLoadedId(st.id)
    yt.load(st.videoId)
  }

  function playStation(st) {
    if (st.id === loadedId) return yt.toggle()
    if (current) history.current.push(current.id)
    tune(st)
  }

  function togglePlay() {
    if (!current) return stations[0] && playStation(stations[0])
    if (isCurrentLoaded) yt.toggle()
    else tune(current)
  }

  // Stations reachable from the current one in the chosen mode (same game, same era, or everything).
  function neighbours() {
    if (!current || mode === 'random') return stations
    return stations.filter((st) => st[mode] === current[mode])
  }

  function step(dir) {
    if (mode === 'random') {
      if (dir < 0 && history.current.length) {
        const prev = stations.find((st) => st.id === history.current.pop())
        if (prev) return tune(prev)
      }
      const others = stations.filter((st) => st.id !== currentId)
      return playStation(others[Math.floor(Math.random() * others.length)])
    }
    const list = neighbours()
    if (!list.length) return
    const i = list.findIndex((st) => st.id === currentId)
    playStation(list[(i + dir + list.length) % list.length])
  }

  function cycleMode() {
    const i = MODES.findIndex((m) => m.id === mode)
    setMode(MODES[(i + 1) % MODES.length].id)
  }

  const actions = useRef({})
  useEffect(() => {
    actions.current = { togglePlay, step }
  })

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea')) return
      if (e.code === 'Space' && !e.target.closest('button')) {
        e.preventDefault()
        actions.current.togglePlay()
      } else if (e.code === 'Escape') {
        setWheelOpen(false)
        setExpanded(false)
      }
    }
    window.addEventListener('keydown', onKey)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => actions.current.togglePlay())
      navigator.mediaSession.setActionHandler('pause', () => actions.current.togglePlay())
      navigator.mediaSession.setActionHandler('previoustrack', () => actions.current.step(-1))
      navigator.mediaSession.setActionHandler('nexttrack', () => actions.current.step(1))
    }
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!current) return
    document.title = `${current.name} · Radio`
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.name,
      artist: current.dj || gameLabel(current.game),
      album: gameLabel(current.game),
      artwork: [{ src: current.logo || `https://i.ytimg.com/vi/${current.videoId}/hqdefault.jpg` }],
    })
  }, [current])

  const miniSwipe = useSwipe({
    onMove: (s) => setDragX(s.axis === 'x' ? s.dx : 0),
    onEnd: (s) => {
      setDragX(0)
      if (s.axis === 'x' && Math.abs(s.dx) > 70) step(s.dx < 0 ? 1 : -1)
      else if (s.axis === 'y' && s.dy < -50 && current) setExpanded(true)
    },
  })
  const sheetSwipe = useSwipe({
    onEnd: (s) => {
      if (s.axis === 'x' && Math.abs(s.dx) > 70) step(s.dx < 0 ? 1 : -1)
      else if (s.axis === 'y' && s.dy > 90) setExpanded(false)
    },
  })

  const playIcon = isCurrentLoaded && isPlaying ? PAUSE : PLAY
  const pct = isCurrentLoaded && yt.time.duration ? (yt.time.current / yt.time.duration) * 100 : 0
  const progress = (
    <div className="progress">
      <span>{fmt(isCurrentLoaded ? yt.time.current : 0)}</span>
      <input
        type="range"
        min="0"
        max={Math.max(1, Math.floor(yt.time.duration))}
        value={isCurrentLoaded ? Math.floor(yt.time.current) : 0}
        disabled={!isCurrentLoaded}
        onChange={(e) => yt.seek(Number(e.target.value))}
        style={{ '--pct': `${pct}%` }}
      />
      <span>{fmt(isCurrentLoaded ? yt.time.duration : 0)}</span>
    </div>
  )
  const modeButton = (
    <button className="ctrl ctrl--mode" title={`Changer de poste : ${modeInfo.label}`} onClick={cycleMode}>
      <Icon d={modeInfo.icon} />
      <small>{modeInfo.label}</small>
    </button>
  )
  const wheelButton = (
    <button className="ctrl ctrl--mode" title="Roue des radios" onClick={() => setWheelOpen(true)} disabled={!current}>
      <Icon d={WHEEL} />
      <small>Roue</small>
    </button>
  )
  const transport = (
    <>
      <button className="ctrl" title="Station précédente" onClick={() => step(-1)}>
        <Icon d={PREV} />
      </button>
      <button className="ctrl ctrl--main" title="Lecture / pause (espace)" onClick={togglePlay}>
        <Icon d={playIcon} />
      </button>
      <button className="ctrl" title="Station suivante" onClick={() => step(1)}>
        <Icon d={NEXT} />
      </button>
    </>
  )

  // Like in the games, the wheel always shows the current game's stations.
  const wheelStations = current ? stations.filter((st) => st.game === current.game) : []
  const wheelTitle = current ? gameLabel(current.game) : ''

  function renderCard(st) {
    const active = st.id === currentId
    const heard = heardRatio(yt.heard[st.videoId])
    return (
      <button key={st.id} className={`card ${active ? 'active' : ''}`} onClick={() => playStation(st)}>
        <div className="card-cover">
          <Cover station={st} />
          {heard > 0 && <span className="card-heard" style={{ '--pct': `${heard * 100}%` }} />}
          <span className="card-play">
            <Icon d={active && isCurrentLoaded && isPlaying ? PAUSE : PLAY} size={22} />
          </span>
        </div>
        <div className="card-title">{st.name}</div>
        <div className="card-sub">{st.dj || st.genre}</div>
      </button>
    )
  }

  return (
    <div className={`app ${expanded ? 'is-expanded' : ''}`}>
      <div ref={hostRef} className={`audio-host ${expanded && isCurrentLoaded ? 'audio-host--video' : ''}`} aria-hidden="true" />

      <aside className="sidebar panel">
        <div className="brand">
          <Icon d={RADIO} size={28} />
          <span>Radio</span>
        </div>
        <nav>
          {[{ id: 'all', name: 'Toutes' }, ...GAMES].map((g) => (
            <button key={g.id} className={`nav-item ${game === g.id ? 'active' : ''}`} onClick={() => setGame(g.id)}>
              <span>{g.name}</span>
              <span className="count">{g.id === 'all' ? stations.length : stations.filter((st) => st.game === g.id).length}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main panel" style={{ '--accent': current?.color ?? '#535353' }}>
        <header className="main-header">
          <div className="mobile-brand">
            <Icon d={RADIO} size={24} />
            <span>Radio</span>
          </div>
          <input className="search" type="search" placeholder="Rechercher une station, un DJ, un genre…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {game !== 'all' && <h1>{gameLabel(game)}</h1>}
        </header>
        {game === 'all' ? (
          GAMES.map((g) => {
            const list = visible.filter((st) => st.game === g.id)
            if (!list.length) return null
            return (
              <section key={g.id} className="shelf">
                <h2>{g.name}</h2>
                <div className="row">{list.map(renderCard)}</div>
              </section>
            )
          })
        ) : (
          <div className="grid">{visible.map(renderCard)}</div>
        )}
        {!visible.length && <p className="empty">Aucune station trouvée.</p>}
      </main>

      <aside className="now panel">
        <h3>En lecture</h3>
        <button className="now-art" onClick={() => current && setExpanded(true)} disabled={!current}>
          {current ? <Cover key={current.id} station={current} /> : <Icon d={RADIO} size={64} />}
        </button>
        {current ? (
          <div className="now-info">
            <div className="now-title">{current.name}</div>
            <div className="now-sub">
              {gameLabel(current.game)} · {eraLabel(current.era)}
            </div>
            <dl>
              {current.dj && (
                <>
                  <dt>DJ</dt>
                  <dd>{current.dj}</dd>
                </>
              )}
              <dt>Genre</dt>
              <dd>{current.genre}</dd>
            </dl>
            <HeardMap rec={yt.heard[current.videoId]} position={isCurrentLoaded ? yt.time.current : null} onReset={() => yt.resetHeard(current.videoId)} />
            {yt.status === 'error' && <p className="error">Cette station ne joue pas en ce moment. Essaie-en une autre.</p>}
          </div>
        ) : (
          <p className="now-empty">Choisis une station pour commencer.</p>
        )}
      </aside>

      <footer className={`player ${current ? '' : 'player--empty'}`} style={{ '--accent': current?.color ?? '#535353' }} {...miniSwipe}>
        <button
          className={`player-left ${dragX ? 'dragging' : ''}`}
          onClick={() => current && setExpanded(true)}
          style={{ transform: dragX ? `translateX(${dragX}px)` : undefined, opacity: dragX ? Math.max(0.3, 1 - Math.abs(dragX) / 250) : undefined }}
        >
          {current && (
            <>
              <Cover key={current.id} station={current} className="cover--small" />
              <div>
                <div className="player-title">{current.name}</div>
                <div className="player-sub">{current.dj || gameLabel(current.game)}</div>
              </div>
            </>
          )}
        </button>
        <button className="player-mini-play" onClick={togglePlay} aria-label="Lecture / pause">
          <Icon d={playIcon} size={26} />
        </button>
        <span className="player-line" style={{ '--pct': `${pct}%` }} />

        <div className="player-center">
          <div className="controls">
            {modeButton}
            {transport}
            {wheelButton}
          </div>
          {progress}
        </div>

        <div className="player-right">
          <button
            className="ctrl"
            title="Muet"
            onClick={() => {
              if (yt.volume > 0) {
                setLastVolume(yt.volume)
                yt.setVolume(0)
              } else yt.setVolume(lastVolume || 80)
            }}
          >
            <Icon d={yt.volume > 0 ? VOL : MUTE} />
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={yt.volume}
            onChange={(e) => yt.setVolume(Number(e.target.value))}
            style={{ '--pct': `${yt.volume}%` }}
          />
        </div>
      </footer>

      {expanded && current && (
        <div className="sheet" style={{ '--accent': current.color }}>
          <div className="sheet-inner" {...sheetSwipe}>
            <div className="sheet-top">
              <button className="ctrl" onClick={() => setExpanded(false)} aria-label="Fermer">
                <Icon d={CHEVRON} size={30} />
              </button>
              <span>{gameLabel(current.game)}</span>
              <span className="sheet-top-spacer" />
            </div>
            {/* The real YouTube iframe is positioned over this slot (see .audio-host--video). */}
            <div className="video-slot">{!isCurrentLoaded && <Cover key={current.id} station={current} />}</div>
            <div className="sheet-title">{current.name}</div>
            <div className="sheet-sub">{[current.dj, current.genre, eraLabel(current.era)].filter(Boolean).join(' · ')}</div>
            {progress}
            <div className="controls controls--big">
              {modeButton}
              {transport}
              {wheelButton}
            </div>
            <HeardMap rec={yt.heard[current.videoId]} position={isCurrentLoaded ? yt.time.current : null} onReset={() => yt.resetHeard(current.videoId)} />
            {yt.status === 'error' && <p className="error">Cette station ne joue pas en ce moment. Essaie-en une autre.</p>}
          </div>
        </div>
      )}

      {wheelOpen && current && (
        <RadioWheel
          title={wheelTitle}
          stations={wheelStations}
          currentId={currentId}
          onPick={(st) => {
            if (st.id !== currentId) playStation(st)
            setWheelOpen(false)
          }}
          onClose={() => setWheelOpen(false)}
        />
      )}
    </div>
  )
}
