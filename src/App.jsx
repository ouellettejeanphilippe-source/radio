import { useEffect, useRef, useState } from 'react'
import { ERAS, GAMES, STATIONS } from './stations.js'
import { parseYouTubeId, useYouTubePlayer } from './youtube.js'
import { heardRatio } from './heard.js'
import { startStatic } from './static.js'
import META from './meta.json'
import { countScrobblable, finishLastfmLogin, scrobblingOn, useScrobbler, useScrobbleSettings } from './scrobble.js'
import Settings from './Settings.jsx'
import ConfirmButton from './Confirm.jsx'
import { startSync, useSync } from './sync.js'

const CURRENT_KEY = 'radio:current'
const MODE_KEY = 'radio:mode'
const FAVS_KEY = 'radio:favs'
const RECENT_KEY = 'radio:recent'
const DRIVE_KEY = 'radio:drive'

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
const CAR = 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM5 11l1.5-4.5h11L19 11H5z'
const CLOSE = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
const HEART = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
const HEART_OUTLINE = 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z'
const GEAR = 'M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7 7 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54a7.3 7.3 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.22.38.3.6.22l2.39-.96c.5.38 1.05.7 1.63.94l.36 2.54c.05.24.25.42.49.42h3.84c.24 0 .45-.18.49-.42l.36-2.54a7 7 0 0 0 1.63-.94l2.39.96c.22.08.48 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z'
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
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} referrerPolicy="no-referrer" onError={() => setIndex(index + 1)} />
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

const PERCENT = new Intl.NumberFormat('fr-CA', { style: 'percent' })

function HeardMap({ rec, position, onReset }) {
  const ratio = heardRatio(rec)
  return (
    <div className="heard">
      <div className="heard-head">
        <span>Tu as entendu {PERCENT.format(ratio)} de cette station</span>
        {ratio > 0 && <ConfirmButton onConfirm={onReset}>Recommencer</ConfirmButton>}
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

// What the recording holds besides music. Known per game where the rips are consistent,
// otherwise what the uploader says (see scripts/meta.mjs).
const GAME_TALK = { mafia2: 'full', mafia3: 'full', fans: 'full', fo3: 'dj', fonv: 'dj', fo4: 'dj', sdogs: 'music', scarface: 'music', wd2: 'music', wdl: 'music' }
const TALK_LABELS = { full: 'DJ + pubs', dj: 'DJ', music: 'Musique seulement', talk: 'Talk-show' }
function talkOf(st, videoId) {
  if (st.genre === 'Talk') return 'talk'
  if (st.game.startsWith('gta')) return 'full'
  const talk = GAME_TALK[st.game] ?? META[videoId]?.talk
  // Forza Horizon stations have DJs but no ads.
  return st.game.startsWith('fh') && talk === 'full' ? 'dj' : talk
}

const TalkBadge = ({ talk }) => talk && <span className={`badge badge--${talk}`}>{TALK_LABELS[talk]}</span>

// Song playing at second t, from the tracklist in the video description.
function trackAt(tracks, t) {
  if (!tracks || !(t >= 0)) return null
  let found = null
  for (const [start, title] of tracks) {
    if (start > t) break
    found = title
  }
  return found
}

const gameLabel = (id) => GAMES.find((g) => g.id === id)?.name
// Lower case and no accents, so "electro" finds "Électro".
const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const STATIONS_PLAYABLE = STATIONS.map((st) => {
  const videoId = parseYouTubeId(st.youtube)
  const search = fold(`${st.name} ${st.dj} ${st.genre} ${gameLabel(st.game)}`)
  return { ...st, videoId, talk: talkOf(st, videoId), tracks: META[videoId]?.tracks, search }
}).filter((st) => st.videoId)
const eraLabel = (id) => ERAS.find((e) => e.id === id)?.name

// Tracks a touch and reports whether it became a horizontal or vertical drag.
function useSwipe({ onMove, onEnd }) {
  const ref = useRef(null)
  return {
    onTouchStart: (e) => {
      // A drag on the seek bar moves the playback, it isn't a swipe to the next station.
      if (e.target.closest('input')) return
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

// Keeps the screen on while the component is mounted (re-acquired when the page comes back).
function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock
    let done = false
    const request = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then(
        (l) => (done ? l.release() : (lock = l)),
        () => {},
      )
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      done = true
      document.removeEventListener('visibilitychange', request)
      lock?.release()
    }
  }, [])
}

// Car screen: giant logo and buttons, swipe anywhere to change station, tap the logo for the wheel.
function DriveMode({ station, song, failed, covered, playIcon, modeButton, fav, onFav, onToggle, onStep, onWheel, onClose }) {
  const [dragX, setDragX] = useState(0)
  useWakeLock()
  const swipe = useSwipe({
    onMove: (s) => setDragX(s.axis === 'x' ? s.dx : 0),
    onEnd: (s) => {
      setDragX(0)
      if (s.axis === 'x' && Math.abs(s.dx) > 60) onStep(s.dx < 0 ? 1 : -1)
    },
  })
  return (
    <div className="drive" style={{ '--accent': station?.color ?? '#535353' }} inert={covered} {...swipe}>
      <div className="drive-top">
        <button className="drive-close" onClick={onClose}>
          <Icon d={CLOSE} size={26} />
          <span>Quitter</span>
        </button>
        {modeButton}
        <button className={`ctrl drive-fav ${fav ? 'on' : ''}`} onClick={onFav} disabled={!station} aria-label="Favori">
          <Icon d={fav ? HEART : HEART_OUTLINE} size={30} />
        </button>
      </div>
      <button
        className={`drive-art ${dragX ? 'dragging' : ''}`}
        onClick={onWheel}
        disabled={!station}
        aria-label="Roue des radios"
        style={{ transform: dragX ? `translateX(${dragX}px)` : undefined, opacity: dragX ? Math.max(0.3, 1 - Math.abs(dragX) / 300) : undefined }}
      >
        {station ? <Cover key={station.id} station={station} /> : <Icon d={RADIO} size={96} />}
      </button>
      <div className="drive-info">
        <div className="drive-name">{station?.name ?? 'Choisis une station'}</div>
        {failed ? (
          <div className="drive-song is-error" role="alert">
            {FAILED}
          </div>
        ) : (
          <div className="drive-song">{song || (station && [station.dj, gameLabel(station.game)].filter(Boolean).join(' · '))}</div>
        )}
      </div>
      <div className="drive-controls">
        <button className="drive-btn" onClick={() => onStep(-1)} aria-label="Station précédente">
          <Icon d={PREV} size={48} />
        </button>
        <button className="drive-btn drive-btn--main" onClick={onToggle} aria-label="Lecture / pause">
          <Icon d={playIcon} size={56} />
        </button>
        <button className="drive-btn" onClick={() => onStep(1)} aria-label="Station suivante">
          <Icon d={NEXT} size={48} />
        </button>
      </div>
    </div>
  )
}

const FAILED = 'Ne joue pas en ce moment'

const LEFT = 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z'
const RIGHT = 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'

// A titled horizontal row of stations; arrows scroll it with a mouse.
function Shelf({ title, children }) {
  const rowRef = useRef(null)
  const scroll = (dir) => rowRef.current.scrollBy({ left: dir * rowRef.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2>{title}</h2>
        <span className="shelf-arrows">
          <button className="ctrl" onClick={() => scroll(-1)} aria-label="Défiler à gauche">
            <Icon d={LEFT} size={26} />
          </button>
          <button className="ctrl" onClick={() => scroll(1)} aria-label="Défiler à droite">
            <Icon d={RIGHT} size={26} />
          </button>
        </span>
      </div>
      <div className="row" ref={rowRef}>
        {children}
      </div>
    </section>
  )
}

export default function App() {
  const [query, setQuery] = useState('')
  const [currentId, setCurrentId] = useState(() => readJson(CURRENT_KEY, null))
  const [loadedId, setLoadedId] = useState(null)
  const [mode, setMode] = useState(() => readJson(MODE_KEY, 'game'))
  const [expanded, setExpanded] = useState(false)
  const [wheelOpen, setWheelOpen] = useState(false)
  const [lastVolume, setLastVolume] = useState(80)
  const [dragX, setDragX] = useState(0)
  const [favs, setFavs] = useState(() => readJson(FAVS_KEY, []))
  const [recent, setRecent] = useState(() => readJson(RECENT_KEY, []))
  const [drive, setDrive] = useState(() => readJson(DRIVE_KEY, false))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scrobbleError, setScrobbleError] = useState(null)
  const scrobbleSettings = useScrobbleSettings()
  const { sync } = useSync()
  const history = useRef([])
  const hostRef = useRef(null)
  const stopStatic = useRef(null)
  const yt = useYouTubePlayer(hostRef)

  const stations = STATIONS_PLAYABLE
  const current = stations.find((st) => st.id === currentId)
  const q = fold(query.trim())
  const visible = stations.filter((st) => !q || st.search.includes(q))
  const byIds = (ids) => ids.map((id) => stations.find((st) => st.id === id)).filter(Boolean)
  const isPlaying = yt.status === 'playing' || yt.status === 'buffering'
  const isCurrentLoaded = Boolean(current && loadedId === current.id)
  const modeInfo = MODES.find((m) => m.id === mode) ?? MODES[0]

  useEffect(() => {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(currentId))
  }, [currentId])
  useEffect(() => {
    localStorage.setItem(MODE_KEY, JSON.stringify(mode))
  }, [mode])
  useEffect(() => {
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs))
  }, [favs])
  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
  }, [recent])
  useEffect(() => {
    localStorage.setItem(DRIVE_KEY, JSON.stringify(drive))
  }, [drive])

  // The static stops once the new station is playing (or has failed).
  useEffect(() => {
    if (yt.status !== 'buffering') {
      stopStatic.current?.()
      stopStatic.current = null
    }
  }, [yt.status])

  function tune(st) {
    stopStatic.current?.()
    stopStatic.current = startStatic(yt.volume)
    setCurrentId(st.id)
    setLoadedId(st.id)
    setRecent((list) => [st.id, ...list.filter((id) => id !== st.id)].slice(0, 12))
    yt.load(st.videoId)
  }

  function toggleFav(st) {
    setFavs((list) => (list.includes(st.id) ? list.filter((id) => id !== st.id) : [...list, st.id]))
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
    actions.current = { togglePlay, step, loaded: () => loadedId != null }
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
        setSettingsOpen(false)
        setScrobbleError(null)
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

  // The phone's back button (or a back swipe) closes the top layer instead of leaving the app:
  // while any layer is open, one extra history entry stands in for it.
  const anyLayer = wheelOpen || settingsOpen || drive || expanded
  const layers = useRef({})
  useEffect(() => {
    layers.current = { wheelOpen, settingsOpen, drive, expanded }
  })
  useEffect(() => {
    if (anyLayer && !window.history.state?.layer) window.history.pushState({ layer: true }, '')
    else if (!anyLayer && window.history.state?.layer) window.history.back()
  }, [anyLayer])
  useEffect(() => {
    const onPop = () => {
      if (window.history.state?.layer) return
      const open = layers.current
      if (open.wheelOpen) setWheelOpen(false)
      else if (open.settingsOpen) {
        setSettingsOpen(false)
        setScrobbleError(null)
      } else if (open.drive) setDrive(false)
      else if (open.expanded) setExpanded(false)
      else return
      // Another layer is still open underneath: it keeps an entry.
      if (Object.values(open).filter(Boolean).length > 1) window.history.pushState({ layer: true }, '')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const song = isCurrentLoaded ? trackAt(current.tracks, yt.time.current) : null
  const failed = isCurrentLoaded && yt.status === 'error'
  const { status: scrobbleStatus, last: lastScrobble } = useScrobbler({
    videoId: isCurrentLoaded ? current.videoId : null,
    tracks: current?.tracks,
    playing: yt.status === 'playing',
    time: yt.time,
  })

  // Back from Last.fm's login page with ?token=: finish connecting.
  useEffect(() => {
    finishLastfmLogin().then(
      (name) => name && setSettingsOpen(true),
      (e) => {
        setScrobbleError(e.message)
        setSettingsOpen(true)
      },
    )
  }, [])

  // Sync between devices: start it, and take in what other devices changed.
  useEffect(() => {
    startSync().then((fromLink) => fromLink && setSettingsOpen(true))
    const onSynced = (e) => {
      const keys = e.detail
      if (keys.includes(FAVS_KEY)) setFavs(readJson(FAVS_KEY, []))
      if (keys.includes(RECENT_KEY)) setRecent(readJson(RECENT_KEY, []))
      if (keys.includes(MODE_KEY)) setMode(readJson(MODE_KEY, 'game'))
      // Take the synced station only while nothing is playing here, so it doesn't change under the listener.
      if (keys.includes(CURRENT_KEY) && !actions.current.loaded()) setCurrentId(readJson(CURRENT_KEY, null))
    }
    window.addEventListener('radio:synced', onSynced)
    return () => window.removeEventListener('radio:synced', onSynced)
  }, [])
  const isFav = Boolean(current && favs.includes(current.id))

  useEffect(() => {
    if (!current) return
    document.title = `${current.name} · Radio`
    if (!('mediaSession' in navigator)) return
    // Lock screen / car display: the song when known, otherwise the station.
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song || current.name,
      artist: song ? current.name : current.dj || gameLabel(current.game),
      album: gameLabel(current.game),
      artwork: [{ src: current.logo || `https://i.ytimg.com/vi/${current.videoId}/hqdefault.jpg` }],
    })
  }, [current, song])

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
        aria-label="Position dans l'enregistrement"
        aria-valuetext={fmt(isCurrentLoaded ? yt.time.current : 0)}
        style={{ '--pct': `${pct}%` }}
      />
      <span>{fmt(isCurrentLoaded ? yt.time.duration : 0)}</span>
    </div>
  )
  const modeButton = (
    <button className="ctrl ctrl--mode" title={`Changer de poste\u00a0: ${modeInfo.label}`} onClick={cycleMode}>
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
      <button className="ctrl" title="Station précédente" aria-label="Station précédente" onClick={() => step(-1)}>
        <Icon d={PREV} />
      </button>
      <button className="ctrl ctrl--main" title="Lecture / pause (espace)" aria-label="Lecture / pause" onClick={togglePlay}>
        <Icon d={playIcon} />
      </button>
      <button className="ctrl" title="Station suivante" aria-label="Station suivante" onClick={() => step(1)}>
        <Icon d={NEXT} />
      </button>
    </>
  )

  // Like in the games, the wheel shows the current game's stations, whatever the mode.
  const wheelStations = current ? stations.filter((st) => st.game === current.game) : []
  const wheelTitle = current ? gameLabel(current.game) : ''

  function renderCard(st) {
    const active = st.id === currentId
    const heard = heardRatio(yt.heard[st.videoId])
    return (
      <button key={st.id} className={`card ${active ? 'active' : ''}`} onClick={() => playStation(st)}>
        <div className="card-cover">
          <Cover station={st} />
          {/* Most stations have DJ + ads; only the exceptions are flagged on the tiles. */}
          {st.talk !== 'full' && <TalkBadge talk={st.talk} />}
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

      <main className="main" style={{ '--accent': current?.color ?? '#535353' }} inert={anyLayer}>
        <header className="main-header">
          <div className="mobile-brand">
            <Icon d={RADIO} size={24} />
            <h1>Radio</h1>
            <button
              className={`drive-open drive-open--icon ${scrobblingOn(scrobbleSettings) || sync ? 'on' : ''}`}
              onClick={() => setSettingsOpen(true)}
              aria-label="Réglages"
              title="Réglages&nbsp;: synchro entre appareils, scrobbling"
            >
              <Icon d={GEAR} />
            </button>
            <button className="drive-open" onClick={() => setDrive(true)} aria-label="Mode auto">
              <Icon d={CAR} />
              <span>Mode auto</span>
            </button>
          </div>
          <input
            className="search"
            type="search"
            name="q"
            aria-label="Rechercher une station, un DJ, un genre ou un jeu"
            placeholder="Station, DJ, genre ou jeu…"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </header>
        {!q && favs.length > 0 && <Shelf title="Tes favoris">{byIds(favs).map(renderCard)}</Shelf>}
        {!q && recent.length > 0 && <Shelf title="Récemment écoutées">{byIds(recent).map(renderCard)}</Shelf>}
        {GAMES.map((g) => {
          const list = visible.filter((st) => st.game === g.id)
          if (!list.length) return null
          return (
            <Shelf key={g.id} title={g.name}>
              {list.map(renderCard)}
            </Shelf>
          )
        })}
        {!visible.length && (
          <p className="empty">
            Aucune station trouvée.{' '}
            <button className="btn-link" onClick={() => setQuery('')}>
              Effacer la recherche
            </button>
          </p>
        )}
      </main>

      <footer className={`player ${current ? '' : 'player--empty'}`} style={{ '--accent': current?.color ?? '#535353' }} inert={anyLayer} {...miniSwipe}>
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
                {failed ? (
                  <div className="player-sub is-error" role="alert">
                    {FAILED}
                  </div>
                ) : (
                  <div className="player-sub">{song || current.dj || gameLabel(current.game)}</div>
                )}
              </div>
            </>
          )}
        </button>
        {/* No swipe with a mouse: prev/next show up next to play on computers. */}
        <button className="player-step" onClick={() => step(-1)} aria-label="Station précédente">
          <Icon d={PREV} size={22} />
        </button>
        <button className="player-mini-play" onClick={togglePlay} aria-label="Lecture / pause">
          <Icon d={playIcon} size={26} />
        </button>
        <button className="player-step" onClick={() => step(1)} aria-label="Station suivante">
          <Icon d={NEXT} size={22} />
        </button>
        <span className="player-line" style={{ '--pct': `${pct}%` }} />
      </footer>

      {expanded && current && (
        <div className="sheet" style={{ '--accent': current.color }} inert={wheelOpen || settingsOpen}>
          <div className="sheet-inner" {...sheetSwipe}>
            <div className="sheet-top">
              <button className="ctrl" onClick={() => setExpanded(false)} aria-label="Fermer">
                <Icon d={CHEVRON} size={30} />
              </button>
              <span>{gameLabel(current.game)}</span>
              <span className="sheet-top-actions">
                <button className={`ctrl fav ${isFav ? 'on' : ''}`} onClick={() => toggleFav(current)} aria-label="Favori">
                  <Icon d={isFav ? HEART : HEART_OUTLINE} size={26} />
                </button>
                <button
                  className="ctrl"
                  onClick={() => {
                    setExpanded(false)
                    setDrive(true)
                  }}
                  aria-label="Mode auto"
                >
                  <Icon d={CAR} size={26} />
                </button>
              </span>
            </div>
            {/* The real YouTube iframe is positioned over this slot (see .audio-host--video). */}
            <div className="video-slot">{!isCurrentLoaded && <Cover key={current.id} station={current} />}</div>
            <div className="sheet-title">{current.name}</div>
            <div className="sheet-sub">
              {[current.dj, current.genre, eraLabel(current.era)].filter(Boolean).join(' · ')} <TalkBadge talk={current.talk} />
            </div>
            {song && (
              <div className="song">
                ♪ {song}
                {scrobbleStatus && (
                  <span className={`song-scrobble song-scrobble--${scrobbleStatus.state}`} title={scrobbleStatus.error}>
                    {scrobbleStatus.state === 'done' ? ' ✓ envoyée' : scrobbleStatus.state === 'error' ? ' ! non envoyée' : ''}
                  </span>
                )}
              </div>
            )}
            {progress}
            <div className="controls controls--big">
              {modeButton}
              {transport}
              {wheelButton}
            </div>
            {/* Phones use their volume buttons; this only shows with a mouse. */}
            <div className="volume">
              <button
                className="ctrl"
                title="Muet"
                aria-label="Muet"
                aria-pressed={yt.volume === 0}
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
                aria-label="Volume"
                onChange={(e) => yt.setVolume(Number(e.target.value))}
                style={{ '--pct': `${yt.volume}%` }}
              />
            </div>
            <HeardMap rec={yt.heard[current.videoId]} position={isCurrentLoaded ? yt.time.current : null} onReset={() => yt.resetHeard(current.videoId)} />
            {failed && (
              <p className="error" role="alert">
                Cette station ne joue pas en ce moment. Essaie-en une autre.
              </p>
            )}
          </div>
        </div>
      )}

      {drive && (
        <DriveMode
          station={current}
          song={song}
          failed={failed}
          covered={wheelOpen || settingsOpen}
          playIcon={playIcon}
          modeButton={modeButton}
          fav={isFav}
          onFav={() => current && toggleFav(current)}
          onToggle={togglePlay}
          onStep={step}
          onWheel={() => setWheelOpen(true)}
          onClose={() => setDrive(false)}
        />
      )}

      {settingsOpen && (
        <Settings
          count={countScrobblable(stations)}
          total={stations.length}
          lastStatus={scrobbleError ? { state: 'error', error: scrobbleError } : lastScrobble}
          onClose={() => {
            setSettingsOpen(false)
            setScrobbleError(null)
          }}
        />
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
