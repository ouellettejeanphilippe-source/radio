import { useEffect, useRef, useState } from 'react'
import { GAMES, STATIONS } from './stations.js'
import { parseYouTubeId, useYouTubePlayer } from './youtube.js'
import { heardRatio } from './heard.js'

const CURRENT_KEY = 'radio:current'

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
const CHEVRON = 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z'
const RADIO ='M20 6H8.3l8.26-3.34L15.88 1 3.24 6.15A2 2 0 0 0 2 8v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zM7 20a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm13-8h-2v-2h-2v2H4V8h16v4z'

function Cover({ station, className = '' }) {
  const [failed, setFailed] = useState(false)
  const src = station.logo || (station.videoId && `https://i.ytimg.com/vi/${station.videoId}/hqdefault.jpg`)
  if (src && !failed) {
    return <img className={`cover ${className}`} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
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

const STATIONS_PLAYABLE = STATIONS.map((st) => ({ ...st, videoId: parseYouTubeId(st.youtube) })).filter((st) => st.videoId)

export default function App() {
  const [game, setGame] = useState('all')
  const [query, setQuery] = useState('')
  const [currentId, setCurrentId] = useState(() => readJson(CURRENT_KEY, null))
  const [loadedId, setLoadedId] = useState(null)
  const [lastVolume, setLastVolume] = useState(80)
  const [expanded, setExpanded] = useState(false)
  const touchY = useRef(0)
  const hostRef = useRef(null)
  const yt = useYouTubePlayer(hostRef)

  const stations = STATIONS_PLAYABLE
  const current = stations.find((st) => st.id === currentId)
  const playable = stations
  const q = query.trim().toLowerCase()
  const visible = stations.filter(
    (st) => (game === 'all' || st.game === game) && (!q || `${st.name} ${st.dj} ${st.genre}`.toLowerCase().includes(q)),
  )
  const isPlaying = yt.status === 'playing' || yt.status === 'buffering'
  const isCurrentLoaded = current && loadedId === current.id

  useEffect(() => {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(currentId))
  }, [currentId])

  function playStation(st) {
    if (st.id === loadedId) return yt.toggle()
    setCurrentId(st.id)
    setLoadedId(st.id)
    yt.load(st.videoId)
  }

  function togglePlay() {
    if (!current) return playable[0] && playStation(playable[0])
    if (isCurrentLoaded) yt.toggle()
    else playStation(current)
  }

  function step(dir) {
    if (!playable.length) return
    const i = playable.findIndex((st) => st.id === currentId)
    playStation(playable[(i + dir + playable.length) % playable.length])
  }

  const actions = useRef({})
  useEffect(() => {
    actions.current = { togglePlay, step }
  })

  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.target.closest('input, textarea, button')) return
      e.preventDefault()
      actions.current.togglePlay()
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
    if (!current || !('mediaSession' in navigator)) return
    const gameName = GAMES.find((g) => g.id === current.game)?.name
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.name,
      artist: current.dj || gameName,
      album: gameName,
      artwork: current.videoId ? [{ src: `https://i.ytimg.com/vi/${current.videoId}/hqdefault.jpg` }] : [],
    })
    document.title = `${current.name} · Radio`
  }, [current])

  const playIcon = isCurrentLoaded && isPlaying ? PAUSE : PLAY
  const pct = isCurrentLoaded && yt.time.duration ? (yt.time.current / yt.time.duration) * 100 : 0
  const controls = (
    <div className="controls">
      <button className="ctrl" title="Station précédente" onClick={() => step(-1)}>
        <Icon d={PREV} />
      </button>
      <button className="ctrl ctrl--main" title="Lecture / pause (espace)" onClick={togglePlay}>
        <Icon d={playIcon} />
      </button>
      <button className="ctrl" title="Station suivante" onClick={() => step(1)}>
        <Icon d={NEXT} />
      </button>
    </div>
  )
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

  const gameLabel = (id) => GAMES.find((g) => g.id === id)?.name
  const heading = game === 'all' ? 'Toutes les stations' : gameLabel(game)

  return (
    <div className="app">
      <div ref={hostRef} className="audio-host" aria-hidden="true" />
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
          <nav className="chips">
            {[{ id: 'all', name: 'Toutes' }, ...GAMES].map((g) => (
              <button key={g.id} className={`chip ${game === g.id ? 'active' : ''}`} onClick={() => setGame(g.id)}>
                {g.name}
              </button>
            ))}
          </nav>
          <h1>{heading}</h1>
        </header>
        <div className="grid">
          {visible.map((st) => {
            const active = st.id === currentId
            return (
              <button key={st.id} className={`card ${active ? 'active' : ''}`} onClick={() => playStation(st)}>
                <div className="card-cover">
                  <Cover key={st.logo + st.videoId} station={st} />
                  {heardRatio(yt.heard[st.videoId]) > 0 && (
                    <span className="card-heard" style={{ '--pct': `${heardRatio(yt.heard[st.videoId]) * 100}%` }} />
                  )}
                  <span className="card-play">
                    <Icon d={active && loadedId === st.id && isPlaying ? PAUSE : PLAY} size={22} />
                  </span>
                </div>
                <div className="card-title">{st.name}</div>
                <div className="card-sub">
                  {game === 'all' && `${gameLabel(st.game)} · `}
                  {st.dj || st.genre}
                </div>
              </button>
            )
          })}
          {!visible.length && <p className="empty">Aucune station trouvée.</p>}
        </div>
      </main>

      <aside className="now panel">
        <h3>En lecture</h3>
        <div className={`now-art ${isCurrentLoaded && isPlaying ? 'playing' : ''}`}>
          {current ? <Cover key={current.id + current.videoId} station={current} /> : <Icon d={RADIO} size={64} />}
        </div>
        {current ? (
          <div className="now-info">
            <div className="now-title">{current.name}</div>
            <div className="now-sub">{gameLabel(current.game)}</div>
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
            {current.videoId && (
              <HeardMap rec={yt.heard[current.videoId]} position={isCurrentLoaded ? yt.time.current : null} onReset={() => yt.resetHeard(current.videoId)} />
            )}
            {yt.status === 'error' && <p className="error">Cette station ne joue pas en ce moment. Essaie-en une autre.</p>}
          </div>
        ) : (
          <p className="now-empty">Choisis une station pour commencer.</p>
        )}
      </aside>

      <footer className={`player ${current ? '' : 'player--empty'}`} style={{ '--accent': current?.color ?? '#535353' }}>
        <div className="player-left" onClick={() => current && setExpanded(true)}>
          {current && (
            <>
              <Cover key={current.id + current.videoId} station={current} className="cover--small" />
              <div>
                <div className="player-title">{current.name}</div>
                <div className="player-sub">{current.dj || gameLabel(current.game)}</div>
              </div>
            </>
          )}
        </div>
        <button className="player-mini-play" onClick={togglePlay} aria-label="Lecture / pause">
          <Icon d={playIcon} size={26} />
        </button>
        <span className="player-line" style={{ '--pct': `${pct}%` }} />

        <div className="player-center">
          {controls}
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
        <div
          className="sheet"
          style={{ '--accent': current.color }}
          onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
          onTouchEnd={(e) => {
            if (e.changedTouches[0].clientY - touchY.current > 90) setExpanded(false)
          }}
        >
          <div className="sheet-top">
            <button className="ctrl" onClick={() => setExpanded(false)} aria-label="Fermer">
              <Icon d={CHEVRON} size={28} />
            </button>
            <span>{gameLabel(current.game)}</span>
            <span style={{ width: 28 }} />
          </div>
          <div className={`sheet-art ${isCurrentLoaded && isPlaying ? 'playing' : ''}`}>
            <Cover key={current.id + current.videoId} station={current} />
          </div>
          <div className="sheet-title">{current.name}</div>
          <div className="sheet-sub">{[current.dj, current.genre].filter(Boolean).join(' · ')}</div>
          {progress}
          {controls}
          {current.videoId && (
            <HeardMap rec={yt.heard[current.videoId]} position={isCurrentLoaded ? yt.time.current : null} onReset={() => yt.resetHeard(current.videoId)} />
          )}
          {yt.status === 'error' && <p className="error">Cette station ne joue pas en ce moment. Essaie-en une autre.</p>}
        </div>
      )}
    </div>
  )
}
