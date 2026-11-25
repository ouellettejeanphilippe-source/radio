import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ERAS, GAMES, STATIONS } from './stations.js'
import { parseYouTubeId, useYouTubePlayer } from './youtube.js'
import { heardRatio } from './heard.js'
import { startStatic } from './static.js'
import { aimAt, wheelLayout } from './wheel.js'
import META from './meta.json'
import { countScrobblable, finishLastfmLogin, parseSong, scrobblingOn, useScrobbler, useScrobbleSettings } from './scrobble.js'
import Settings from './Settings.jsx'
import GameBand from './GameBand.jsx'
import ConfirmButton from './Confirm.jsx'
import { startSync, useSync } from './sync.js'

const CURRENT_KEY = 'radio:current'
const MODE_KEY = 'radio:mode'
const FAVS_KEY = 'radio:favs'
const RECENT_KEY = 'radio:recent'
const DRIVE_KEY = 'radio:drive'
const LIVE_KEY = 'radio:live'
const KNOWS_WHEEL_KEY = 'radio:knows-wheel'
// On this device: whether a station was playing when the app was last left.
const PLAYING_KEY = 'radio:playing'

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
const SEARCH = 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'
const CLOSE = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
const HEART = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
const HEART_OUTLINE = 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z'
const GEAR = 'M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7 7 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54a7.3 7.3 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.22.38.3.6.22l2.39-.96c.5.38 1.05.7 1.63.94l.36 2.54c.05.24.25.42.49.42h3.84c.24 0 .45-.18.49-.42l.36-2.54a7 7 0 0 0 1.63-.94l2.39.96c.22.08.48 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z'
const LEFT = 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z'
const RIGHT = 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'
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
  // Tiny in-game textures (GTA 2's logos are 64 px wide) are shown as the pixel art they are.
  const [tiny, setTiny] = useState(false)
  const src = sources[index]
  const isLogo = src && src === station.logo
  if (src) {
    return (
      <div className={`cover ${isLogo ? 'cover--logo' : 'cover--thumb'} ${isLogo && tiny ? 'cover--pixel' : ''} ${className}`} style={{ '--c': station.color }}>
        {/* Fandom's image host refuses requests that carry a foreign Referer. */}
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={(e) => setTiny(e.target.naturalWidth > 0 && e.target.naturalWidth < 140)}
          onError={() => setIndex(index + 1)}
        />
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

// The dial: one band shows where you are (the needle, which you can drag) and which parts of the
// recording you've already heard (lit).
function Dial({ rec, time, enabled, live, onSeek, onReset }) {
  const ratio = heardRatio(rec)
  const current = enabled ? time.current : 0
  return (
    <div className="dial">
      <div className="dial-band">
        {rec?.d > 0 &&
          rec.iv.map(([a, b]) => <span key={a} style={{ left: `${(a / rec.d) * 100}%`, width: `${((b - a) / rec.d) * 100}%` }} />)}
        <input
          type="range"
          min="0"
          max={Math.max(1, Math.floor(time.duration))}
          value={Math.floor(current)}
          disabled={!enabled || live}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Position dans l'enregistrement"
          aria-valuetext={fmt(current)}
        />
      </div>
      <div className="dial-foot">
        <span>{fmt(current)}</span>
        {live ? (
          // A broadcast can't be rewound: the needle only shows where it is.
          <span className="dial-heard">
            <span className="lamp">En direct</span>
          </span>
        ) : (
          <span className="dial-heard">
            {PERCENT.format(ratio)} entendu
            {ratio > 0 && <ConfirmButton onConfirm={onReset}>Recommencer</ConfirmButton>}
          </span>
        )}
        <span>{fmt(enabled ? time.duration : 0)}</span>
      </div>
    </div>
  )
}

function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

// GTA-style radio wheel: a game's logos around a ring, the station's name in the middle.
// Tapped open, a tap on a logo tunes in. Held open (a finger kept on the player, or the Q key),
// the parent feeds it the pointer through aim() and tunes to aimed() on release.
function RadioWheel({ ref, title, stations, currentId, hold, onPick, onGame, onClose }) {
  const [pointed, setPointed] = useState(null)
  const aimed = useRef(null)
  const box = useRef(null)
  const { w, h } = useViewport()
  const layout = wheelLayout(stations.length, w, h)
  useImperativeHandle(ref, () => ({
    aim(x, y) {
      const r = box.current.getBoundingClientRect()
      const id = stations[aimAt(layout, x - r.left - r.width / 2, y - r.top - r.height / 2)]?.id ?? null
      if (id === aimed.current) return
      aimed.current = id
      setPointed(id)
      // One tick per logo passed, like a detent.
      if (id) navigator.vibrate?.(4)
    },
    aimed: () => stations.find((st) => st.id === aimed.current) ?? null,
    forget() {
      aimed.current = null
      setPointed(null)
    },
  }))
  // A logo pointed at in another game's wheel doesn't count in this one.
  const shown = stations.find((st) => st.id === pointed) ?? stations.find((st) => st.id === currentId)
  return (
    <div className="wheel-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Roue des radios">
      <div
        ref={box}
        className="wheel"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 2 * layout.rx + layout.item, height: 2 * layout.ry + layout.item, '--item': `${layout.item}px` }}
      >
        {stations.map((st, i) => (
          <button
            key={st.id}
            className={`wheel-item ${st.id === currentId ? 'active' : ''} ${st.id === pointed ? 'aimed' : ''}`}
            style={{ left: `calc(50% + ${layout.pts[i].x.toFixed(1)}px)`, top: `calc(50% + ${layout.pts[i].y.toFixed(1)}px)` }}
            onClick={() => onPick(st)}
            onPointerEnter={() => !hold && setPointed(st.id)}
            onPointerLeave={() => !hold && setPointed(null)}
            aria-label={st.name}
          >
            <Cover station={st} />
          </button>
        ))}
        <div className="wheel-center" style={{ width: Math.min(layout.rx, layout.ry) * 1.24 }}>
          <div className="wheel-game">
            <button className="ctrl" onClick={() => onGame(-1)} aria-label="Jeu précédent">
              <Icon d={LEFT} size={26} />
            </button>
            <span className="wheel-title">{title}</span>
            <button className="ctrl" onClick={() => onGame(1)} aria-label="Jeu suivant">
              <Icon d={RIGHT} size={26} />
            </button>
          </div>
          <div className="wheel-name">{shown?.name ?? 'Choisis un poste'}</div>
          {shown && <div className="wheel-dj">{shown.dj || shown.genre}</div>}
          {hold && <div className="wheel-hint">{pointed ? 'Relâche pour syntoniser' : 'Glisse vers un logo'}</div>}
        </div>
      </div>
    </div>
  )
}

// What the recording holds besides music. Known per game where the rips are consistent,
// otherwise what the uploader says (see scripts/meta.mjs).
const GAME_TALK = { mafia2: 'full', mafia3: 'full', fans: 'full', fo3: 'dj', fonv: 'dj', fo4: 'dj', sdogs: 'music', scarface: 'music', wd2: 'music', wdl: 'music', gtacw: 'music' }
// GTA rips are whole broadcasts, except these: Chinatown Wars has no DJ (above), and for the first
// games and GTA VI it depends on the upload, so the uploader's word is taken.
const GTA_VARIES = ['gtacw', 'gta1', 'gtalondon', 'gta6']
const TALK_LABELS = { full: 'DJ + pubs', dj: 'DJ', music: 'Musique seulement', talk: 'Talk-show' }
function talkOf(st, videoId) {
  if (st.genre === 'Talk') return 'talk'
  if (st.game.startsWith('gta') && !GTA_VARIES.includes(st.game)) return 'full'
  const talk = GAME_TALK[st.game] ?? META[videoId]?.talk
  // Forza Horizon stations have DJs but no ads.
  return st.game.startsWith('fh') && talk === 'full' ? 'dj' : talk
}

const TalkBadge = ({ talk }) => talk && <span className={`badge badge--${talk}`}>{TALK_LABELS[talk]}</span>

// Which line of the tracklist is playing at second t (-1 before the first one).
function trackIndex(tracks, t) {
  if (!tracks || !(t >= 0)) return -1
  let found = -1
  for (let i = 0; i < tracks.length && tracks[i][0] <= t; i++) found = i
  return found
}

// The recording's running order, with the part that is playing lit. A tap jumps there; in live
// mode the list only reads, since a broadcast can't be rewound.
function Tracklist({ station, index, onSeek }) {
  const now = useRef(null)
  const opened = useRef(true)
  useEffect(() => {
    now.current?.scrollIntoView({ block: opened.current ? 'center' : 'nearest' })
    opened.current = false
  }, [index])
  return (
    <ol className="tracks" aria-label="Liste des chansons">
      {station.tracks.map(([start, title], i) => (
        <li key={start}>
          <button
            ref={i === index ? now : null}
            className={`track ${i === index ? 'now' : ''} ${station.songs[i] ? '' : 'track--talk'}`}
            onClick={() => onSeek(start)}
            disabled={!onSeek}
            aria-current={i === index ? 'true' : undefined}
          >
            <span className="track-time">{fmt(start)}</span>
            <span className="track-title">{title}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

// Equalizer bars next to the station's name: moving while it plays.
const Bars = () => (
  <span className="bars" aria-hidden="true">
    <i />
    <i />
    <i />
    <i />
  </span>
)

const gameLabel = (id) => GAMES.find((g) => g.id === id)?.name
// Lower case and no accents, so "electro" finds "Électro".
const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const STATIONS_PLAYABLE = STATIONS.map((st) => {
  const videoId = parseYouTubeId(st.youtube)
  const search = fold(`${st.name} ${st.dj} ${st.genre} ${gameLabel(st.game)}`)
  const tracks = META[videoId]?.tracks
  // Which lines are songs, as opposed to ads, DJ talk and news.
  const songs = tracks?.map(([, title]) => Boolean(parseSong(title, videoId)))
  return { ...st, videoId, talk: talkOf(st, videoId), tracks, songs, search }
}).filter((st) => st.videoId)
// The games that have something to play, in the order of the home screen.
const GAME_IDS = GAMES.map((g) => g.id).filter((id) => STATIONS_PLAYABLE.some((st) => st.game === id))
const eraLabel = (id) => ERAS.find((e) => e.id === id)?.name

const HOLD_MS = 400

// Some browsers still send a click after a long press, even with the touch's default prevented.
function dropNextClick() {
  const drop = (e) => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener('click', drop, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', drop, { capture: true }), 350)
}
// Controls that keep their own long press: holding one of them doesn't open the wheel.
const NO_HOLD = '.ctrl, .drive-btn, .drive-close, .player-mini-play, .player-step, .hold-hint, .now-text, .sheet-dial'

// Tracks a touch and reports whether it became a horizontal or vertical drag. With `hold`, a finger
// that stays put for a moment starts a hold instead: its moves and its release go to hold.move and
// hold.end, and the tap that would follow is dropped.
function useSwipe({ onMove, onEnd, hold }) {
  const ref = useRef(null)
  return {
    onTouchStart: (e) => {
      const before = ref.current
      clearTimeout(before?.timer)
      // A drag on the seek bar moves the playback and the tracklist scrolls: neither is a swipe.
      // A second finger calls everything off.
      if (e.touches.length > 1 || e.target.closest('input, .tracks')) {
        ref.current = null
        if (before?.held) hold.cancel()
        return
      }
      const t = e.touches[0]
      const s = { x: t.clientX, y: t.clientY, axis: null, dx: 0, dy: 0, held: false }
      if (hold && !e.target.closest(NO_HOLD)) {
        s.timer = setTimeout(() => {
          s.held = true
          hold.start(s.x + s.dx, s.y + s.dy)
        }, HOLD_MS)
      }
      ref.current = s
    },
    onTouchMove: (e) => {
      const s = ref.current
      if (!s) return
      const t = e.touches[0]
      if (s.held) return hold.move(t.clientX, t.clientY)
      s.dx = t.clientX - s.x
      s.dy = t.clientY - s.y
      if (!s.axis && Math.hypot(s.dx, s.dy) > 10) {
        s.axis = Math.abs(s.dx) > Math.abs(s.dy) ? 'x' : 'y'
        clearTimeout(s.timer)
      }
      if (s.axis) onMove?.(s)
    },
    onTouchEnd: (e) => {
      const s = ref.current
      ref.current = null
      if (!s) return
      clearTimeout(s.timer)
      if (s.held) {
        // No tap after a hold: it would land on whatever is under the finger.
        if (e.cancelable) e.preventDefault()
        dropNextClick()
        hold.end()
      } else if (s.axis) onEnd(s)
    },
    onTouchCancel: () => {
      const s = ref.current
      ref.current = null
      clearTimeout(s?.timer)
      if (s?.held) hold.cancel()
      onMove?.({ axis: null, dx: 0, dy: 0 })
    },
    // A long press on a logo would otherwise bring up the browser's image menu.
    onContextMenu: (e) => ref.current && e.preventDefault(),
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

// Car screen: giant logo and buttons, swipe anywhere to change station, tap the logo (or hold
// anywhere) for the wheel.
function DriveMode({ station, song, failed, covered, playIcon, modeButton, fav, hold, onFav, onToggle, onStep, onWheel, onClose }) {
  const [dragX, setDragX] = useState(0)
  useWakeLock()
  const swipe = useSwipe({
    onMove: (s) => setDragX(s.axis === 'x' ? s.dx : 0),
    onEnd: (s) => {
      setDragX(0)
      if (s.axis === 'x' && Math.abs(s.dx) > 60) onStep(s.dx < 0 ? 1 : -1)
    },
    hold,
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

// A titled horizontal row of stations; arrows scroll it with a mouse.
function Shelf({ id, title, count, children }) {
  const rowRef = useRef(null)
  const scroll = (dir) => rowRef.current.scrollBy({ left: dir * rowRef.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section className="shelf" id={id}>
      <div className="shelf-head">
        <h2>{title}</h2>
        <span className="shelf-count">
          {count} poste{count > 1 ? 's' : ''}
        </span>
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
  const [searching, setSearching] = useState(false)
  const [currentId, setCurrentId] = useState(() => readJson(CURRENT_KEY, null))
  const [loadedId, setLoadedId] = useState(null)
  const [mode, setMode] = useState(() => readJson(MODE_KEY, 'game'))
  const [live, setLive] = useState(() => readJson(LIVE_KEY, false))
  // The listening screen. 'restored' when the app opens on it because a station was playing at the
  // last visit: it is then already there, instead of sliding up, and one touch on play resumes.
  const [expanded, setExpanded] = useState(() => {
    const id = readJson(PLAYING_KEY, false) && !readJson(DRIVE_KEY, false) && readJson(CURRENT_KEY, null)
    return STATIONS_PLAYABLE.some((st) => st.id === id) ? 'restored' : false
  })
  const [details, setDetails] = useState(false)
  // The radio wheel: which game it shows, and whether a finger or the Q key is holding it open.
  const [wheel, setWheel] = useState(null)
  const [lastVolume, setLastVolume] = useState(80)
  const [dragX, setDragX] = useState(0)
  const [favs, setFavs] = useState(() => readJson(FAVS_KEY, []))
  const [recent, setRecent] = useState(() => readJson(RECENT_KEY, []))
  const [drive, setDrive] = useState(() => readJson(DRIVE_KEY, false))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scrobbleError, setScrobbleError] = useState(null)
  // Whether a held finger has already tuned a station on this device: the hint can then go.
  const [knowsWheel, setKnowsWheel] = useState(() => readJson(KNOWS_WHEEL_KEY, false))
  const scrobbleSettings = useScrobbleSettings()
  const { sync } = useSync()
  const history = useRef([])
  const hostRef = useRef(null)
  const mainRef = useRef(null)
  const stopStatic = useRef(null)
  const wheelRef = useRef(null)
  // While the wheel is held open: where the hold started and whether the pointer has moved since.
  const holding = useRef(null)
  const yt = useYouTubePlayer(hostRef, live)

  const stations = STATIONS_PLAYABLE
  const current = stations.find((st) => st.id === currentId)
  const q = fold(query.trim())
  const visible = stations.filter((st) => !q || st.search.includes(q))
  const shownGames = GAMES.filter((g) => visible.some((st) => st.game === g.id))
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
    localStorage.setItem(LIVE_KEY, JSON.stringify(live))
  }, [live])
  useEffect(() => {
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs))
  }, [favs])
  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
  }, [recent])
  useEffect(() => {
    localStorage.setItem(DRIVE_KEY, JSON.stringify(drive))
  }, [drive])

  // Remembered for the next visit. A pause counts as having stopped; a station that fails or an
  // app that is closed while it plays doesn't.
  useEffect(() => {
    if (yt.status === 'playing') localStorage.setItem(PLAYING_KEY, 'true')
    else if (yt.status === 'paused') localStorage.setItem(PLAYING_KEY, 'false')
  }, [yt.status])

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

  function closeSearch() {
    setQuery('')
    setSearching(false)
  }

  function cycleMode() {
    const i = MODES.findIndex((m) => m.id === mode)
    setMode(MODES[(i + 1) % MODES.length].id)
  }

  function changeLive(on) {
    setLive(on)
    if (on && isCurrentLoaded) yt.goLive()
  }

  // Like in the games, the wheel opens on the current game's stations, whatever the mode.
  const wheelGame = () => current?.game ?? GAME_IDS[0]
  const openWheel = () => setWheel({ game: wheelGame(), hold: false })
  function closeWheel() {
    holding.current = null
    setWheel(null)
  }
  function turnWheel(dir) {
    setWheel((w) => w && { ...w, game: GAME_IDS[(GAME_IDS.indexOf(w.game) + dir + GAME_IDS.length) % GAME_IDS.length] })
  }
  function pickFromWheel(st) {
    if (st.id !== loadedId) playStation(st)
    closeWheel()
  }

  // Holding (a finger on the player, or the Q key) opens the wheel; moving towards a logo aims at
  // it and letting go tunes in, like in the games.
  function holdStart(x, y) {
    if (wheel) return
    holding.current = { x, y, moved: false }
    navigator.vibrate?.(10)
    setWheel({ game: wheelGame(), hold: true })
  }
  function holdMove(x, y) {
    const h = holding.current
    if (!h) return
    // The wheel opens under a finger that hasn't chosen anything yet: wait for it to move.
    if (!h.moved && Math.hypot(x - h.x, y - h.y) < 14) return
    h.moved = true
    wheelRef.current?.aim(x, y)
  }
  // Released on a logo: tune in. A finger released without having moved (`stay`): the wheel stays
  // open, to be tapped. Otherwise it closes and nothing changes.
  function holdEnd(stay) {
    const h = holding.current
    if (!h) return
    holding.current = null
    const st = wheelRef.current?.aimed()
    if (st) {
      pickFromWheel(st)
      // Only a finger teaches the finger hint; the Q hint stays, as shortcuts get forgotten.
      if (!Number.isNaN(h.x) && !knowsWheel) {
        setKnowsWheel(true)
        localStorage.setItem(KNOWS_WHEEL_KEY, 'true')
      }
    } else if (stay && !h.moved) setWheel((w) => w && { ...w, hold: false })
    else setWheel(null)
  }
  const hold = { start: holdStart, move: holdMove, end: () => holdEnd(true), cancel: () => holdEnd(false) }
  // A quick press of Q isn't a hold: the wheel just stays open, to be clicked, and nothing the
  // mouse happened to cross on the way gets tuned.
  function holdToTap() {
    if (!holding.current) return
    holding.current = null
    wheelRef.current?.forget()
    setWheel((w) => w && { ...w, hold: false })
  }

  function closeSettings() {
    setSettingsOpen(false)
    setScrobbleError(null)
  }
  // Escape and the phone's back button close one layer at a time, the top one first.
  function closeTop() {
    if (wheel) closeWheel()
    else if (settingsOpen) closeSettings()
    else if (details) setDetails(false)
    else if (expanded) setExpanded(false)
  }

  const actions = useRef({})
  useEffect(() => {
    actions.current = { togglePlay, step, closeTop, closeWheel, turnWheel, holdStart, holdMove, holdEnd, holdToTap, wheel, loaded: () => loadedId != null }
  })

  useEffect(() => {
    let pressedAt = 0
    const onMouse = (e) => actions.current.holdMove(e.clientX, e.clientY)
    const release = (quick) => {
      window.removeEventListener('mousemove', onMouse)
      if (quick) actions.current.holdToTap()
      else actions.current.holdEnd(false)
    }
    const onKey = (e) => {
      if (e.target.closest('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return
      const a = actions.current
      if (e.key === 'q' || e.key === 'Q') {
        if (e.repeat) return
        // Q closes a wheel that was tapped open; otherwise it holds one open until released.
        if (a.wheel) return a.wheel.hold || a.closeWheel()
        pressedAt = Date.now()
        a.holdStart(NaN, NaN)
        window.addEventListener('mousemove', onMouse)
      } else if (a.wheel && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        e.preventDefault()
        a.turnWheel(e.code === 'ArrowLeft' ? -1 : 1)
      } else if (e.code === 'Space' && !e.target.closest('button')) {
        e.preventDefault()
        a.togglePlay()
      } else if (e.key === '/') {
        e.preventDefault()
        setSearching(true)
      } else if (e.code === 'Escape') a.closeTop()
    }
    const onKeyUp = (e) => (e.key === 'q' || e.key === 'Q') && release(Date.now() - pressedAt < 300)
    const onBlur = () => release(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => actions.current.togglePlay())
      navigator.mediaSession.setActionHandler('pause', () => actions.current.togglePlay())
      navigator.mediaSession.setActionHandler('previoustrack', () => actions.current.step(-1))
      navigator.mediaSession.setActionHandler('nexttrack', () => actions.current.step(1))
    }
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('mousemove', onMouse)
    }
  }, [])

  // A wheel that is being held isn't a layer yet: what's under it must keep receiving the finger
  // that holds it, and it will be gone before a back button could matter.
  const wheelLayer = Boolean(wheel) && !wheel.hold
  // The phone's back button (or a back swipe) closes the top layer instead of leaving the app:
  // while any layer is open, one extra history entry stands in for it.
  const anyLayer = wheelLayer || settingsOpen || drive || expanded
  const layers = useRef({})
  useEffect(() => {
    layers.current = { wheel: wheelLayer, settingsOpen, drive, details, expanded }
  })
  const justLoaded = useRef(true)
  useEffect(() => {
    const atLoad = justLoaded.current
    justLoaded.current = false
    if (anyLayer && !window.history.state?.layer) window.history.pushState({ layer: true }, '')
    else if (!anyLayer && window.history.state?.layer) {
      // An entry left from before a reload has nothing under it in this page: going back from it
      // would load the app a second time, so it just becomes a plain entry.
      if (atLoad) window.history.replaceState(null, '')
      else window.history.back()
    }
  }, [anyLayer])
  useEffect(() => {
    const onPop = () => {
      if (window.history.state?.layer) return
      const open = layers.current
      if (open.wheel) setWheel(null)
      else if (open.settingsOpen) {
        setSettingsOpen(false)
        setScrobbleError(null)
      } else if (open.drive) setDrive(false)
      else if (open.details) setDetails(false)
      else if (open.expanded) setExpanded(false)
      else return
      // Another layer is still open underneath: it keeps an entry.
      if (Object.values(open).filter(Boolean).length > 1) window.history.pushState({ layer: true }, '')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const trackNow = isCurrentLoaded ? trackIndex(current.tracks, yt.time.current) : -1
  const song = trackNow >= 0 ? current.tracks[trackNow][1] : null
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
      if (keys.includes(LIVE_KEY)) setLive(readJson(LIVE_KEY, false))
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
    hold,
  })
  // On the listening screen: sideways changes station, down closes it, up shows the details.
  const sheetSwipe = useSwipe({
    onMove: (s) => setDragX(s.axis === 'x' ? s.dx : 0),
    onEnd: (s) => {
      setDragX(0)
      if (s.axis === 'x' && Math.abs(s.dx) > 70) step(s.dx < 0 ? 1 : -1)
      else if (s.axis === 'y' && s.dy > 90) setExpanded(false)
      else if (s.axis === 'y' && s.dy < -70) setDetails(true)
    },
    hold,
  })
  const detailsSwipe = useSwipe({
    onEnd: (s) => s.axis === 'y' && s.dy > 90 && setDetails(false),
  })

  const playIcon = isCurrentLoaded && isPlaying ? PAUSE : PLAY
  const tuning = isCurrentLoaded && yt.status === 'buffering'
  const pct = isCurrentLoaded && yt.time.duration ? (yt.time.current / yt.time.duration) * 100 : 0
  const dragStyle = dragX ? { transform: `translateX(${dragX}px)`, opacity: Math.max(0.3, 1 - Math.abs(dragX) / 280) } : undefined
  const modeButton = (
    <button className="ctrl ctrl--mode" title={`Changer de poste : ${modeInfo.label}`} onClick={cycleMode}>
      <Icon d={modeInfo.icon} />
      <small>{modeInfo.label}</small>
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
  // Phones use their volume buttons; this only shows with a mouse.
  const volume = (
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
      <input type="range" min="0" max="100" value={yt.volume} aria-label="Volume" onChange={(e) => yt.setVolume(Number(e.target.value))} style={{ '--pct': `${yt.volume}%` }} />
    </div>
  )

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
    <div className="app">
      <div ref={hostRef} className={`audio-host ${details && isCurrentLoaded ? 'audio-host--video' : ''}`} aria-hidden="true" />

      <main ref={mainRef} className="main" style={{ '--accent': current?.color ?? '#535353' }} inert={anyLayer}>
        <header className="main-header">
          {searching ? (
            <div className="search-bar">
              <label className="search-field">
                <Icon d={SEARCH} />
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
                  // Opened by a tap on the search key: typing can start at once.
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
                />
              </label>
              <button className="drive-open drive-open--icon" onClick={closeSearch} aria-label="Fermer la recherche">
                <Icon d={CLOSE} />
              </button>
            </div>
          ) : (
            <div className="mobile-brand">
              <Icon d={RADIO} size={24} />
              <h1>Radio</h1>
              <button className="drive-open drive-open--icon" onClick={() => setSearching(true)} aria-label="Rechercher" title="Rechercher (/)">
                <Icon d={SEARCH} />
              </button>
              <button
                className={`drive-open drive-open--icon ${scrobblingOn(scrobbleSettings) || sync ? 'on' : ''}`}
                onClick={() => setSettingsOpen(true)}
                aria-label="Réglages"
                title="Réglages&nbsp;: écoute en direct, synchro entre appareils, scrobbling"
              >
                <Icon d={GEAR} />
              </button>
              <button className="drive-open" onClick={() => setDrive(true)} aria-label="Mode auto">
                <Icon d={CAR} />
                <span>Mode auto</span>
              </button>
            </div>
          )}
        </header>
        {/* A search already narrows the page down: the band is for the whole catalogue. */}
        {!q && <GameBand games={shownGames} scroller={mainRef} />}
        {!q && favs.length > 0 && (
          <Shelf title="Tes favoris" count={byIds(favs).length}>
            {byIds(favs).map(renderCard)}
          </Shelf>
        )}
        {!q && recent.length > 0 && (
          <Shelf title="Récemment écoutées" count={byIds(recent).length}>
            {byIds(recent).map(renderCard)}
          </Shelf>
        )}
        {shownGames.map((g) => {
          const list = visible.filter((st) => st.game === g.id)
          return (
            <Shelf key={g.id} id={`jeu-${g.id}`} title={g.name} count={list.length}>
              {list.map(renderCard)}
            </Shelf>
          )
        })}
        {!visible.length && (
          <p className="empty">
            Aucune station trouvée.{' '}
            <button className="btn-link" onClick={closeSearch}>
              Effacer la recherche
            </button>
          </p>
        )}
      </main>

      <footer className={`player ${current ? '' : 'player--empty'} ${tuning ? 'is-tuning' : ''}`} style={{ '--accent': current?.color ?? '#535353' }} inert={anyLayer} {...miniSwipe}>
        <button className={`player-left ${dragX ? 'dragging' : ''}`} onClick={() => current && setExpanded(true)} style={dragStyle}>
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
        {/* No swipe or long press with a mouse: prev/next and the wheel show up next to play on computers. */}
        <button className="player-step" onClick={() => step(-1)} aria-label="Station précédente">
          <Icon d={PREV} size={22} />
        </button>
        <button className="player-mini-play" onClick={togglePlay} aria-label="Lecture / pause">
          <Icon d={playIcon} size={26} />
        </button>
        <button className="player-step" onClick={() => step(1)} aria-label="Station suivante">
          <Icon d={NEXT} size={22} />
        </button>
        <button className="player-step" onClick={openWheel} aria-label="Roue des radios" title="Roue des radios (maintenir Q)">
          <Icon d={WHEEL} size={22} />
        </button>
        <span className="player-dial" style={{ '--pct': `${pct}%` }}>
          <i />
        </span>
      </footer>

      {/* The listening screen: the station's sign in the night, and next to nothing else. */}
      {expanded && current && (
        <div
          className={`sheet ${expanded === 'restored' ? 'sheet--restored' : ''} ${isCurrentLoaded && yt.status === 'playing' ? 'is-playing' : ''} ${tuning ? 'is-tuning' : ''}`}
          style={{ '--accent': current.color }}
          inert={details || wheelLayer || settingsOpen}
          {...sheetSwipe}
        >
          <div className="sheet-top">
            <button className="ctrl" onClick={() => setExpanded(false)} aria-label="Fermer">
              <Icon d={CHEVRON} size={30} />
            </button>
            <span className="sheet-game">
              {gameLabel(current.game)}
              {live && <span className="lamp">En direct</span>}
            </span>
            <span className="sheet-top-actions">
              <button className={`ctrl fav ${isFav ? 'on' : ''}`} onClick={() => toggleFav(current)} aria-label="Favori" aria-pressed={isFav}>
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
          <div className="sheet-stage">
            <button className={`sheet-art ${dragX ? 'dragging' : ''}`} onClick={openWheel} aria-label="Roue des radios" style={dragStyle}>
              <Cover key={current.id} station={current} />
            </button>
          </div>
          {/* What's on, in a corner, and one key. Touching the text or the dial opens the details. */}
          <div className="now">
            <button className="now-text" onClick={() => setDetails(true)} title="Liste des chansons, cadran et vidéo">
              <span className="now-name">
                <Bars />
                {current.name}
              </span>
              {failed ? (
                <span className="now-song is-error" role="alert">
                  {FAILED}
                </span>
              ) : (
                <span className="now-song">
                  {song || [current.dj, current.genre].filter(Boolean).join(' · ')}
                  {song && scrobbleStatus?.state === 'done' && <span className="song-scrobble song-scrobble--done"> ✓ envoyée</span>}
                  {song && scrobbleStatus?.state === 'error' && (
                    <span className="song-scrobble song-scrobble--error" title={scrobbleStatus.error}>
                      {' '}
                      ! non envoyée
                    </span>
                  )}
                </span>
              )}
            </button>
            {/* A finger swipes to change station: only a mouse gets the two side keys. */}
            <div className="controls now-keys">{transport}</div>
            <div className="now-side">
              {volume}
              <button className={`hold-hint ${knowsWheel ? 'hold-hint--known' : ''}`} onClick={openWheel}>
                <span className="hold-hint--touch">Garde le doigt appuyé pour la roue</span>
                <span className="hold-hint--key">
                  Garde <kbd>Q</kbd> enfoncé pour la roue
                </span>
              </button>
            </div>
          </div>
          <button className="sheet-dial" onClick={() => setDetails(true)} aria-label="Cadran, liste des chansons et vidéo">
            <span className="player-dial" style={{ '--pct': `${pct}%` }}>
              <i />
            </span>
          </button>
        </div>
      )}

      {/* Behind the dial: the video, the list of songs, the full dial and the swipe mode. */}
      {expanded && details && current && (
        <div className="details" style={{ '--accent': current.color }} inert={wheelLayer || settingsOpen} {...detailsSwipe}>
          <div className="details-inner">
            <div className="sheet-top">
              <button className="ctrl" onClick={() => setDetails(false)} aria-label="Revenir au poste">
                <Icon d={CHEVRON} size={30} />
              </button>
              <span className="sheet-game">{current.name}</span>
              <span className="sheet-top-actions" />
            </div>
            {/* The real YouTube iframe is positioned over this slot (see .audio-host--video). */}
            <div className="video-slot">{!isCurrentLoaded && <Cover key={current.id} station={current} />}</div>
            <div className="chips">
              {current.dj && <span className="badge">{current.dj}</span>}
              <span className="badge">{current.genre}</span>
              <span className="badge">{eraLabel(current.era)}</span>
              <TalkBadge talk={current.talk} />
            </div>
            {current.tracks ? (
              <Tracklist key={current.id} station={current} index={trackNow} onSeek={isCurrentLoaded && !live ? yt.seek : null} />
            ) : (
              <p className="tracks-none">Pas de liste de chansons pour ce poste.</p>
            )}
            <Dial
              rec={yt.heard[current.videoId]}
              time={yt.time}
              enabled={isCurrentLoaded}
              live={live}
              onSeek={yt.seek}
              onReset={() => yt.resetHeard(current.videoId)}
            />
            <div className="legend" id="modes-legend">
              Glisser change de poste
            </div>
            <div className="modes" role="group" aria-labelledby="modes-legend">
              {MODES.map((m) => (
                <button key={m.id} className="mode-key" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
                  <Icon d={m.icon} size={18} />
                  {m.label}
                </button>
              ))}
            </div>
            {volume}
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
          covered={wheelLayer || settingsOpen}
          playIcon={playIcon}
          modeButton={modeButton}
          fav={isFav}
          hold={hold}
          onFav={() => current && toggleFav(current)}
          onToggle={togglePlay}
          onStep={step}
          onWheel={openWheel}
          onClose={() => setDrive(false)}
        />
      )}

      {settingsOpen && (
        <Settings
          count={countScrobblable(stations)}
          total={stations.length}
          live={live}
          onLive={changeLive}
          lastStatus={scrobbleError ? { state: 'error', error: scrobbleError } : lastScrobble}
          onClose={closeSettings}
        />
      )}

      {wheel && (
        <RadioWheel
          ref={wheelRef}
          title={gameLabel(wheel.game)}
          stations={stations.filter((st) => st.game === wheel.game)}
          currentId={currentId}
          hold={wheel.hold}
          onPick={pickFromWheel}
          onGame={turnWheel}
          onClose={closeWheel}
        />
      )}
    </div>
  )
}
