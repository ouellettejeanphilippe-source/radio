import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { BACKDROPS, ERAS, GAMES, SERIES, STATIONS } from './stations.js'
import { parseYouTubeId, useYouTubePlayer } from './youtube.js'
import { heardRatio } from './heard.js'
import { startStatic } from './static.js'
import { aimAt, wheelLayout } from './wheel.js'
import META from './meta.json'
import { countScrobblable, finishLastfmLogin, parseSong, scrobblingOn, useScrobbler, useScrobbleSettings } from './scrobble.js'
import Settings from './Settings.jsx'
import { APP_ICON, holdSession, mediaKey, sessionByDefault, tile } from './session.js'
import { initials, sign, useFaces } from './sign.js'
import { newerBuild, reloadFor } from './update.js'
import ConfirmButton from './Confirm.jsx'
import { startSync, useSync } from './sync.js'
import { useStream } from './stream.js'

const CURRENT_KEY = 'radio:current'
const MODE_KEY = 'radio:mode'
const FAVS_KEY = 'radio:favs'
const RECENT_KEY = 'radio:recent'
// Whether the screen stays on while a station plays: 'plugged' (while the phone charges, as in a
// car), 'always' or 'never'.
const AWAKE_KEY = 'radio:awake'
const LIVE_KEY = 'radio:live'
const KNOWS_WHEEL_KEY = 'radio:knows-wheel'
// On this device: whether the app takes the phone's media controls, and whether their previous /
// next keys go from song to song instead of from station to station.
const CONTROLS_KEY = 'radio:controls'
// What the previous and next keys do: 'station', 'song' or 'hop'.
const KEYS_KEY = 'radio:keys'
const HOP = 30
// The installed app once had a shortcut to a car screen, which opened with ?auto. There is no car
// screen any more: the shortcut, where a phone still has it, opens the app like any other way in.
const OLD_SHORTCUT = new URLSearchParams(window.location.search).has('auto')

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
const OUTSIDE = 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z'
const REPLAY = 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z'
const VOL = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4z'
const MUTE = 'M3 9v6h4l5 5V4L7 9H3zm13.59 3L19 9.59 17.59 8.17 15.17 10.6 12.76 8.17 11.34 9.59 13.76 12l-2.42 2.41 1.42 1.42 2.41-2.42 2.42 2.42L19 14.41z'
const CHEVRON = 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z'
const SHUFFLE = 'M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z'
const GAMEPAD = 'M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4-3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z'
const CALENDAR = 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zM7 11h5v5H7z'
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

// The recording's picture on YouTube: small, or as large as it comes (`big`), then small in case
// the large one doesn't exist.
const thumbs = (st, big) => [...(big ? ['maxresdefault'] : []), 'mqdefault'].map((size) => `https://i.ytimg.com/vi/${st.videoId}/${size}.jpg`)

// A station's picture: its logo; failing that, the recording's own picture where it has one
// (`art`, see stations.js); failing that, its name, written out as a sign (see sign.js), or its
// initials where the picture is small. `big` is for where it is shown large.
// `near`: in the row of stations, whether this is the one in the middle. A show's picture is
// heavy at full size, and only that one is seen large.
function Cover({ station, big, near = true, className = '' }) {
  const picture = big && near ? station.picture : station.thumb
  const sources = [station.logo, station.logoAlt, picture, ...(station.art ? thumbs(station, big) : [])].filter(Boolean)
  const [index, setIndex] = useState(0)
  // Tiny in-game textures (GTA 2's logos are 64 px wide) are shown as the pixel art they are.
  const [tiny, setTiny] = useState(false)
  useFaces()
  const src = sources[index]
  const isLogo = src && (src === station.logo || src === station.logoAlt)
  if (src) {
    return (
      <div
        className={`cover ${isLogo ? 'cover--logo' : 'cover--thumb'} ${src === picture ? 'cover--square' : ''} ${isLogo && tiny ? 'cover--pixel' : ''} ${isLogo && station.paper ? 'cover--paper' : ''} ${className}`}
        style={{ '--c': station.color }}
      >
        {/* Fandom's image host refuses requests that carry a foreign Referer. */}
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            const width = e.target.naturalWidth
            // A picture YouTube doesn't have comes back as a grey placeholder, 120 px wide.
            if (!isLogo && width <= 120) setIndex(index + 1)
            // (A vector file states a size too, often a small one: it isn't pixel art.)
            else setTiny(width > 0 && width < 140 && !/\.svg/i.test(src))
          }}
          onError={() => setIndex(index + 1)}
        />
      </div>
    )
  }
  const { lines, size } = sign(station.name)
  return (
    <div className={`cover cover--gen ${className}`} style={{ '--c': station.color, '--fit': (size * 100).toFixed(1) }}>
      <span className="gen-name">{lines.join('\n')}</span>
      <span className="gen-initials">{initials(station.name)}</span>
    </div>
  )
}

// The picture behind the home screen: the game's city, or the real one. It comes in once it has
// loaded, over the plain night, which is also what stays when there is none or it can't be had.
// `game`: the game, or the one station that has a picture of its own.
function Backdrop({ game }) {
  const picture = BACKDROPS[game]
  const [shown, setShown] = useState(null)
  if (!picture) return null
  return (
    <div key={game} className={`backdrop ${shown === game ? 'is-in' : ''}`}>
      <img
        src={picture.src}
        style={{ objectPosition: picture.at }}
        alt=""
        decoding="async"
        draggable={false}
        referrerPolicy="no-referrer"
        onLoad={() => setShown(game)}
      />
    </div>
  )
}

const PERCENT = new Intl.NumberFormat('fr-CA', { style: 'percent' })

// The dial: one band shows where you are (the needle, which you can drag) and which parts of the
// recording you've already heard (lit).
function Dial({ rec, time, enabled, live, playIcon, onSeek, onHop, onToggle, onReset }) {
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
      <span className="dial-time">{fmt(current)}</span>
      {/* The play key, as on the home screen, between two keys that skip 30 seconds: past a
          glitch, or a song heard twice. */}
      <div className="dial-keys">
        <button className="ctrl hop" disabled={!enabled || live} onClick={() => onHop(-HOP)} title="Reculer de 30 secondes (Maj + ←)" aria-label="Reculer de 30 secondes">
          <Icon d={REPLAY} />
          <span>{HOP}</span>
        </button>
        <button className="ctrl ctrl--main dial-play" onClick={onToggle} title="Lecture / pause (espace)" aria-label="Lecture / pause">
          <Icon d={playIcon} />
        </button>
        <button className="ctrl hop hop--on" disabled={!enabled || live} onClick={() => onHop(HOP)} title="Avancer de 30 secondes (Maj + →)" aria-label="Avancer de 30 secondes">
          <Icon d={REPLAY} />
          <span>{HOP}</span>
        </button>
      </div>
      <span className="dial-time dial-time--end">{fmt(enabled ? time.duration : 0)}</span>
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

// How much a wheel turns as it rolls across the screen: 1 would be a wheel rolling on the ground
// without slipping; less keeps the logos readable on the way.
const ROLL = 0.6

// GTA-style radio wheel: a game's logos around a ring, the station's name in the middle.
// `pages` are the wheel before, the one shown and the one after: { id, title, stations }.
// Tapped open, a press on a logo aims at it and the release tunes in (see startPress); a finger
// that swipes from anywhere else takes the wheel along: it rolls aside with the finger while the
// next game's wheel rolls in, and lets go past a fifth of the screen (or on a flick) finishes the
// move; short of that, it rolls back. Held open (a finger
// kept on the player, or the Q key), the parent feeds it the pointer through aim() and tunes to
// aimed() on release; there is only the one wheel then.
function RadioWheel({ ref, pages, currentId, hold, onPick, onGame, onClose }) {
  const [pointed, setPointed] = useState(null)
  const aimed = useRef(null)
  const track = useRef(null)
  const box = useRef(null)
  // The game the wheel is rolling to, until it gets there: 1, -1, or 0 when it is at rest. And
  // one more turn asked for meanwhile by a key, to make once it has arrived.
  const rolling = useRef(0)
  const queued = useRef(0)
  // A press that began on a logo, while it lasts: where it began, and whether it has moved since.
  const press = useRef(null)
  const [pressing, setPressing] = useState(false)
  const { w, h } = useViewport()
  const stations = pages[1].stations
  const layout = wheelLayout(stations.length, w, h)

  // Puts the wheels where a sideways move of dx pixels takes them, straight in the page: a finger
  // moves many times a second, and three wheels of logos are a lot to draw through React each time.
  const place = (dx, glide) => {
    track.current.classList.toggle('gliding', glide)
    for (const el of track.current.querySelectorAll('.wheel')) {
      const x = Number(el.dataset.k) * w + dx
      el.style.transform = `translateX(${x}px)`
      el.style.opacity = 1 - Math.min(1, Math.abs(x) / w) * 0.7
      el.firstElementChild.style.transform = `rotate(${(x / Number(el.dataset.r)) * ROLL}rad)`
    }
  }
  // Rolls to the next (1) or previous (-1) game, then tells the parent, which hands back the new
  // three wheels: the one that has just arrived in the middle is already drawn there. A second
  // press of a key while it rolls isn't lost (`wait`): it goes once the wheel is there.
  const turn = (dir, wait) => {
    if (rolling.current) {
      if (wait) queued.current = dir
      return
    }
    if (hold) return onGame(dir)
    rolling.current = dir
    place(-dir * w, true)
    setTimeout(() => {
      rolling.current = 0
      track.current?.classList.remove('gliding')
      onGame(dir)
      const next = queued.current
      queued.current = 0
      // Once the new wheels are drawn.
      if (next) setTimeout(() => track.current && turn(next, true), 40)
    }, 250)
  }
  const swipe = useSwipe({
    onMove: (s) => s.axis === 'x' && !rolling.current && place(s.dx, false),
    onEnd: (s) => {
      if (s.axis !== 'x' || rolling.current) return
      // Far enough, or let go on the move in that direction.
      const flick = Math.abs(s.dx) > 24 && s.vx * s.dx > 0 && Math.abs(s.vx) > 0.3
      if (Math.abs(s.dx) > w / 5 || flick) turn(s.dx < 0 ? 1 : -1)
      else place(0, true)
    },
  })
  // A mouse wheel or a trackpad turns it too: a notch is a game.
  const onRoll = (e) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(d) >= 8) turn(d > 0 ? 1 : -1)
  }

  // Aims at the logo nearest to a point of the screen, or at none over the middle of the wheel.
  const aim = (x, y) => {
    const r = box.current.getBoundingClientRect()
    const id = stations[aimAt(layout, x - r.left - r.width / 2, y - r.top - r.height / 2)]?.id ?? null
    if (id === aimed.current) return
    aimed.current = id
    setPointed(id)
    // One tick per logo passed, like a detent.
    if (id) navigator.vibrate?.(4)
  }
  const forget = () => {
    aimed.current = null
    setPointed(null)
  }

  // Pressing a logo doesn't tune yet: it lights up, the light follows the finger (or the mouse)
  // from logo to logo, and the station it is on when the press lets go is the one that starts.
  // Let go over the middle of the wheel, the press chooses nothing.
  const startPress = (id, x, y) => {
    press.current = { x, y, moved: false }
    aimed.current = id
    setPointed(id)
    setPressing(true)
    navigator.vibrate?.(4)
  }
  const movePress = (x, y) => {
    const p = press.current
    // A finger that only trembles stays on the logo it pressed.
    if (!p.moved && Math.hypot(x - p.x, y - p.y) < 8) return
    p.moved = true
    aim(x, y)
  }
  const endPress = (tune) => {
    press.current = null
    setPressing(false)
    const st = tune && stations.find((s) => s.id === aimed.current)
    forget()
    if (st) onPick(st)
  }
  // A touch that starts on a logo of the middle wheel is a press; anywhere else, it rolls the wheels.
  const touch = {
    ...swipe,
    onTouchStart: (e) => {
      const logo = e.touches.length === 1 && !rolling.current && e.target.closest('.wheel[data-k="0"] .wheel-item')
      if (logo) return startPress(logo.dataset.id, e.touches[0].clientX, e.touches[0].clientY)
      // A second finger calls the press off.
      if (press.current) endPress(false)
      swipe.onTouchStart(e)
    },
    onTouchMove: (e) => (press.current ? movePress(e.touches[0].clientX, e.touches[0].clientY) : swipe.onTouchMove(e)),
    onTouchEnd: (e) => {
      if (!press.current) return swipe.onTouchEnd(e)
      // No tap after the press: it would tune a second time.
      if (e.cancelable) e.preventDefault()
      dropNextClick()
      endPress(true)
    },
    onTouchCancel: () => (press.current ? endPress(false) : swipe.onTouchCancel()),
    onContextMenu: (e) => (press.current ? e.preventDefault() : swipe.onContextMenu(e)),
  }
  // The mouse presses the same way. The logo keeps the pointer until the button is let go, so the
  // press goes on even off the wheel.
  const mouse = (st) => ({
    onPointerDown: (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || hold || rolling.current) return
      e.currentTarget.setPointerCapture(e.pointerId)
      startPress(st.id, e.clientX, e.clientY)
    },
    onPointerMove: (e) => e.pointerType === 'mouse' && press.current && movePress(e.clientX, e.clientY),
    onPointerUp: (e) => {
      if (e.pointerType !== 'mouse' || !press.current) return
      // The click that follows would tune a second time.
      dropNextClick()
      endPress(true)
    },
    onLostPointerCapture: (e) => e.pointerType === 'mouse' && press.current && endPress(false),
    // Passing over a logo names it in the middle; not during a press, which names its own.
    onPointerEnter: () => !hold && !press.current && setPointed(st.id),
    onPointerLeave: () => !hold && !press.current && setPointed(null),
  })

  useImperativeHandle(ref, () => ({
    aim,
    aimed: () => stations.find((st) => st.id === aimed.current) ?? null,
    forget,
    turn: (dir) => turn(dir, true),
  }))

  // While a finger holds the wheel open, that finger aims: no swipe then, and no wheels waiting on
  // either side.
  const shown = hold ? [{ ...pages[1], k: 0 }] : pages.map((pg, i) => ({ ...pg, k: i - 1 }))
  return (
    <div ref={track} className="wheel-backdrop" onClick={onClose} onWheel={onRoll} role="dialog" aria-modal="true" aria-label="Roue des radios" {...(hold ? {} : touch)}>
      {shown.map((pg) => {
        const here = pg.k === 0
        const at = here ? layout : wheelLayout(pg.stations.length, w, h)
        // A logo pointed at in another game's wheel doesn't count in this one.
        const named = (here && pg.stations.find((st) => st.id === pointed)) || pg.stations.find((st) => st.id === currentId)
        return (
          <div
            key={pg.id}
            ref={here ? box : undefined}
            className={`wheel ${here && pressing ? 'pressing' : ''}`}
            data-k={pg.k}
            data-r={at.r}
            inert={!here}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 2 * at.r + at.item, height: 2 * at.r + at.item, '--item': `${at.item}px`, transform: `translateX(${pg.k * w}px)`, opacity: here ? 1 : 0.3 }}
          >
            <div className="wheel-ring" style={{ transform: `rotate(${((pg.k * w) / at.r) * ROLL}rad)` }}>
              {pg.stations.map((st, i) => (
                <button
                  key={st.id}
                  className={`wheel-item ${st.id === currentId ? 'active' : ''} ${here && st.id === pointed ? 'aimed' : ''}`}
                  style={{ left: `calc(50% + ${at.pts[i].x.toFixed(1)}px)`, top: `calc(50% + ${at.pts[i].y.toFixed(1)}px)` }}
                  data-id={st.id}
                  onClick={() => onPick(st)}
                  {...mouse(st)}
                  aria-label={st.name}
                >
                  <Cover station={st} />
                </button>
              ))}
            </div>
            <div className="wheel-center" style={{ width: at.r * 1.24 }}>
              <div className="wheel-game">
                <button className="ctrl" onClick={() => turn(-1, true)} aria-label="Jeu précédent">
                  <Icon d={LEFT} size={26} />
                </button>
                <span className="wheel-title">{pg.title}</span>
                <button className="ctrl" onClick={() => turn(1, true)} aria-label="Jeu suivant">
                  <Icon d={RIGHT} size={26} />
                </button>
              </div>
              <div className="wheel-name">{named?.name ?? 'Choisis un poste'}</div>
              {named && <div className="wheel-dj">{named.dj || named.genre}</div>}
              {(hold || (here && pressing)) && <div className="wheel-hint">{pointed ? 'Relâche pour syntoniser' : 'Glisse vers un logo'}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// What the recording holds besides music. Known per game where the rips are consistent,
// otherwise what the uploader says (see scripts/meta.mjs).
const GAME_TALK = { mafia2: 'full', mafia3: 'full', shows: 'dj', fo3: 'dj', fonv: 'dj', fo4: 'dj', sdogs: 'music', scarface: 'music', wd2: 'music', wdl: 'music', gtacw: 'music' }
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
            <Line title={title} videoId={station.videoId} />
          </button>
        </li>
      ))}
    </ol>
  )
}

// A line of the list: a song as its title with who plays it underneath; anything else as it is.
function Line({ title, videoId }) {
  const song = parseSong(title, videoId)
  return (
    <span className="track-what">
      <span className="track-title">{song ? song.track : title}</span>
      {song && <span className="track-by">{song.artist}</span>}
    </span>
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
  // What the recording is known by: YouTube's id for the video, or the show's key at Mixcloud.
  const videoId = st.mixcloud || parseYouTubeId(st.youtube)
  const search = fold(`${st.name} ${st.dj} ${st.genre} ${gameLabel(st.game)}`)
  const tracks = META[videoId]?.tracks
  // Which lines are songs, as opposed to ads, DJ talk and news.
  const songs = tracks?.map(([, title]) => Boolean(parseSong(title, videoId)))
  return { ...st, videoId, talk: talkOf(st, videoId), tracks, songs, search }
}).filter((st) => st.videoId || st.link)
// The ones with a recording, as opposed to the real stations, which open elsewhere: what the
// shuffle, the eras and the counts are about.
const RECORDINGS = STATIONS_PLAYABLE.filter((st) => st.videoId)
// Big Cuppa Radio was first a section of its own, with a station for each show: what a device
// remembers of those is the one station it is now.
const renamed = (id) => (typeof id === 'string' && id.startsWith('bigcuppa-') ? 'shows-big-cuppa-radio' : id)
// Where a real station is on the air, as its play key says it.
const outside = (st) => (st.on === 'TuneIn' ? 'TuneIn' : 'son site')
// What the app can play itself: a recording, or a real station's stream. The rest opens elsewhere.
const playable = (st) => Boolean(st.videoId || st.stream)
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
const NO_HOLD = '.ctrl, .hold-hint, .now-text, .sheet-dial'

// Tracks a touch and reports whether it became a horizontal or vertical drag. With `hold`, a finger
// that stays put for a moment starts a hold instead: its moves and its release go to hold.move and
// hold.end, and the tap that would follow is dropped.
function useSwipe({ onMove, onEnd, hold }) {
  const ref = useRef(null)
  return {
    onTouchStart: (e) => {
      const before = ref.current
      clearTimeout(before?.timer)
      // A drag on the seek bar moves the playback and the list of songs scrolls: neither is a
      // swipe. A second finger calls everything off.
      if (e.touches.length > 1 || e.target.closest('input, .tracks')) {
        ref.current = null
        if (before?.held) hold.cancel()
        return
      }
      const t = e.touches[0]
      // On the row of stations, the browser does the sideways scrolling itself (`strip`).
      const s = { x: t.clientX, y: t.clientY, axis: null, dx: 0, dy: 0, held: false, strip: Boolean(e.target.closest('.stations')), trail: [[e.timeStamp, 0]] }
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
      // The last tenth of a second of the move, to tell a flick from a slow drag when it ends.
      s.trail.push([e.timeStamp, s.dx])
      while (s.trail.length > 1 && e.timeStamp - s.trail[0][0] > 100) s.trail.shift()
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
      // How fast the finger was going sideways when it left, in pixels per millisecond.
      s.vx = (s.dx - s.trail[0][1]) / Math.max(e.timeStamp - s.trail[0][0], 1)
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

// Keeps the screen on while `on` holds (taken again when the page comes back).
function useWakeLock(on) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
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
  }, [on])
}

// Whether the device is charging, where the browser says: on a car's mount, it usually is.
function usePlugged() {
  const [plugged, setPlugged] = useState(false)
  useEffect(() => {
    let battery
    const read = () => setPlugged(Boolean(battery?.charging))
    navigator.getBattery?.().then(
      (b) => {
        battery = b
        read()
        b.addEventListener('chargingchange', read)
      },
      () => {},
    )
    return () => battery?.removeEventListener('chargingchange', read)
  }, [])
  return plugged
}

const FAILED = 'Ne joue pas en ce moment'

// Every station, as a plain list by game: where to look one up by name, DJ, genre or game.
// It is the search too: typing narrows the list.
function Directory({ stations, currentId, favs, onPick, onClose }) {
  const [query, setQuery] = useState('')
  const q = fold(query.trim())
  const shown = stations.filter((st) => !q || st.search.includes(q))
  return (
    <div className="directory" role="dialog" aria-modal="true" aria-label="Tous les postes">
      <div className="directory-inner">
        <div className="search-bar">
          <label className="search-field">
            <Icon d={SEARCH} />
            <input
              className="search"
              type="search"
              name="q"
              aria-label="Rechercher un poste, un DJ, un genre ou un jeu"
              placeholder="Poste, DJ, genre ou jeu…"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              // Opened by a tap on the search key: typing can start at once.
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // The app's own Escape leaves text fields alone; this one closes the list.
              onKeyDown={(e) => e.key === 'Escape' && onClose()}
            />
          </label>
          <button className="ctrl" onClick={onClose} aria-label="Fermer">
            <Icon d={CLOSE} size={26} />
          </button>
        </div>
        <div className="directory-list">
          {GAMES.map((g) => {
            const list = shown.filter((st) => st.game === g.id)
            if (!list.length) return null
            return (
              <section key={g.id}>
                <h2 className="legend">{g.name}</h2>
                {list.map((st) => (
                  <button key={st.id} className={`track ${st.id === currentId ? 'now' : ''}`} onClick={() => onPick(st)} aria-current={st.id === currentId ? 'true' : undefined}>
                    <span className="track-title">{st.name}</span>
                    <span className="directory-sub">
                      {favs.includes(st.id) && <Icon d={HEART} size={12} />}
                      {st.dj || st.genre}
                    </span>
                  </button>
                ))}
              </section>
            )
          })}
          {!shown.length && <p className="tracks-none">Aucun poste trouvé.</p>}
        </div>
      </div>
    </div>
  )
}

// What shows outside the page: the tab's title and, on the lock screen, the notification and a
// car's display, the song when known, otherwise the station.
function showOutside(title, media) {
  document.title = title
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata(media)
}

// The wheels that aren't a game's.
const EXTRAS = { favs: 'Favoris', recent: 'Récemment écoutés' }

function shuffle(list) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// The row of stations across the home screen: the one that is on sits in the middle, full size,
// and its neighbours wait at the edges, small and dim. It scrolls like any list, one station per
// swipe, and tunes to the one it comes to rest on. `held` tells when the wheel is held open: the
// finger that aims on the wheel must not scroll the row underneath.
function Carousel({ list, currentId, held, onChoose, onOpen, onStep }) {
  const strip = useRef(null)
  // The logo nearest the middle while the row moves: it grows before the station changes.
  const [near, setNear] = useState(currentId)
  const placed = useRef(false)
  const ids = list.map((st) => st.id).join(' ')
  const middle = () => {
    const el = strip.current
    const at = el.scrollLeft + el.clientWidth / 2
    let best = null
    for (const item of el.children) {
      const d = Math.abs(item.offsetLeft + item.offsetWidth / 2 - at)
      if (!best || d < best.d) best = { d, id: item.dataset.id }
    }
    return best?.id
  }

  // The station changed from elsewhere (the wheel, a key, the list): bring it to the middle.
  useLayoutEffect(() => {
    const el = strip.current
    const item = [...el.children].find((x) => x.dataset.id === currentId)
    if (!item) return
    setNear(currentId)
    const left = item.offsetLeft + item.offsetWidth / 2 - el.clientWidth / 2
    const calm = !placed.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    placed.current = true
    if (Math.abs(el.scrollLeft - left) > 2) el.scrollTo({ left, behavior: calm ? 'auto' : 'smooth' })
  }, [currentId, ids])

  const state = useRef({})
  useEffect(() => {
    state.current = { currentId, list, held, onChoose, onStep }
  })
  useEffect(() => {
    const el = strip.current
    let frame = 0
    let rest = 0
    const settle = () => {
      const { currentId, list, held, onChoose } = state.current
      const id = middle()
      if (held || !id || id === currentId) return
      const st = list.find((x) => x.id === id)
      if (st) onChoose(st)
    }
    const onScroll = () => {
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0
          setNear(middle())
        })
      }
      clearTimeout(rest)
      rest = setTimeout(settle, 140)
    }
    // A finger that holds the wheel open aims with it: the row stays put.
    const onTouchMove = (e) => state.current.held && e.cancelable && e.preventDefault()
    // A mouse wheel has no sideways: a notch is a station.
    let turned = 0
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      if (Date.now() - turned < 260 || Math.abs(e.deltaY) < 8) return
      turned = Date.now()
      state.current.onStep(e.deltaY > 0 ? 1 : -1)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(frame)
      clearTimeout(rest)
    }
  }, [])

  return (
    <div ref={strip} className="stations" role="group" aria-label="Postes">
      {list.map((st) => (
        <button
          key={st.id}
          data-id={st.id}
          className={`station ${st.id === near ? 'is-near' : ''}`}
          // The one in the middle opens the wheel; a neighbour comes to the middle.
          onClick={() => (st.id === currentId ? onOpen() : onChoose(st))}
          aria-label={st.id === currentId ? `${st.name} : ouvrir la roue des radios` : st.name}
          aria-current={st.id === currentId ? 'true' : undefined}
        >
          <Cover station={st} big near={st.id === near} />
        </button>
      ))}
    </div>
  )
}

// Choosing a game, and the favourites: a sheet that comes up from the bottom on a phone, a panel
// in the middle of the screen on a computer.
function GamePicker({ stations, currentId, favStations, recentStations, onGame, onStation, onClose }) {
  const [tab, setTab] = useState('games')
  const current = stations.find((st) => st.id === currentId)
  // Consecutive games of one series share a heading; the ones without a series follow each other.
  const groups = []
  for (const g of GAMES) {
    const count = stations.filter((st) => st.game === g.id).length
    if (!count) continue
    const last = groups[groups.length - 1]
    if (last && last.series === g.series) last.games.push({ ...g, count })
    else groups.push({ series: g.series, games: [{ ...g, count }] })
  }
  const row = (st) => (
    <button key={st.id} className={`track ${st.id === currentId ? 'now' : ''}`} onClick={() => onStation(st)} aria-current={st.id === currentId ? 'true' : undefined}>
      <span className="track-title">{st.name}</span>
      <span className="directory-sub">{gameLabel(st.game)}</span>
    </button>
  )
  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="picker" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Choisir un jeu">
        <div className="picker-head">
          <div className="modes picker-tabs" role="group" aria-label="Quoi choisir">
            <button className="mode-key" aria-pressed={tab === 'games'} onClick={() => setTab('games')}>
              <Icon d={GAMEPAD} size={18} />
              Jeux
            </button>
            <button className="mode-key" aria-pressed={tab === 'favs'} onClick={() => setTab('favs')}>
              <Icon d={HEART} size={16} />
              Favoris
            </button>
          </div>
          <button className="ctrl" onClick={onClose} aria-label="Fermer">
            <Icon d={CLOSE} size={26} />
          </button>
        </div>
        <div className="picker-body">
          {tab === 'games' &&
            groups.map((group) => (
              <section key={group.games[0].id}>
                {group.series && <h2 className="legend">{SERIES[group.series]}</h2>}
                <div className="picker-grid">
                  {group.games.map((g) => (
                    <button key={g.id} className="game-key" onClick={() => onGame(g.id)} aria-current={current?.game === g.id ? 'true' : undefined}>
                      <b>{g.name}</b>
                      <small>
                        {g.count} poste{g.count > 1 ? 's' : ''} · {g.series === 'real' ? 'FM et AM' : (g.where ?? eraLabel(g.era))}
                      </small>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          {tab === 'favs' && (
            <>
              {favStations.length ? (
                <section>
                  <h2 className="legend">Favoris</h2>
                  {favStations.map(row)}
                </section>
              ) : (
                <p className="tracks-none">Pas encore de favoris. Le cœur à côté du nom d'un poste l'ajoute ici.</p>
              )}
              {recentStations.length > 0 && (
                <section>
                  <h2 className="legend">Récemment écoutés</h2>
                  {recentStations.map(row)}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  // The list of every station, which is also the search.
  const [searching, setSearching] = useState(false)
  // The sheet where a game is chosen.
  const [picking, setPicking] = useState(false)
  // « Aléatoire » follows one shuffled order per visit, so that going back is going back.
  const [shuffled] = useState(() => shuffle(RECORDINGS))
  const [currentId, setCurrentId] = useState(() => {
    // Remembered from before, but no longer among the stations (the list changes): the last one
    // listened to that still is.
    const known = (id) => STATIONS_PLAYABLE.some((st) => st.id === id)
    const id = renamed(readJson(CURRENT_KEY, null))
    return id == null || known(id) ? id : (readJson(RECENT_KEY, []).map(renamed).find(known) ?? null)
  })
  const [loadedId, setLoadedId] = useState(null)
  const [mode, setMode] = useState(() => readJson(MODE_KEY, 'game'))
  const [live, setLive] = useState(() => readJson(LIVE_KEY, false))
  const [details, setDetails] = useState(false)
  // The radio wheel: which game it shows (or 'favs', 'recent'), and whether a finger or the Q key
  // is holding it open.
  const [wheel, setWheel] = useState(null)
  const [lastVolume, setLastVolume] = useState(80)
  const [favs, setFavs] = useState(() => readJson(FAVS_KEY, []).map(renamed))
  const [recent, setRecent] = useState(() => readJson(RECENT_KEY, []).map(renamed))
  const [awake, setAwake] = useState(() => readJson(AWAKE_KEY, 'plugged'))
  const [controls, setControls] = useState(() => readJson(CONTROLS_KEY, sessionByDefault))
  // (An older version had a switch for songs only.)
  const [keys, setKeys] = useState(() => readJson(KEYS_KEY, null) ?? (readJson('radio:skip-songs', false) ? 'song' : 'station'))
  // The current station's tile, drawn for the lock screen: { id, url }.
  const [art, setArt] = useState(null)
  // A newer version is on the server, and couldn't be taken without interrupting something.
  const [updateReady, setUpdateReady] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scrobbleError, setScrobbleError] = useState(null)
  // Whether a held finger has already tuned a station on this device: the hint can then go.
  const [knowsWheel, setKnowsWheel] = useState(() => readJson(KNOWS_WHEEL_KEY, false))
  const scrobbleSettings = useScrobbleSettings()
  const { sync } = useSync()
  const hostRef = useRef(null)
  const stopStatic = useRef(null)
  const wheelRef = useRef(null)
  // While the wheel is held open: where the hold started and whether the pointer has moved since.
  const holding = useRef(null)
  // Mixcloud's player, for the shows that play there: shown, where YouTube's is tucked away.
  const mixHostRef = useRef(null)
  const yt = useYouTubePlayer(hostRef, live, mixHostRef)
  // A real station's live stream; it follows the same volume.
  const air = useStream(yt.volume)

  const stations = STATIONS_PLAYABLE
  const current = stations.find((st) => st.id === currentId)
  const byIds = (ids) => ids.map((id) => stations.find((st) => st.id === id)).filter(Boolean)
  const favStations = byIds(favs)
  const recentStations = byIds(recent)
  // What the wheel can show: favourites and recents when there are any, then every game.
  const wheelPages = [...(favStations.length ? ['favs'] : []), ...(recentStations.length ? ['recent'] : []), ...GAME_IDS]
  const wheelStations = (page) => (page === 'favs' ? favStations : page === 'recent' ? recentStations : stations.filter((st) => st.game === page))
  // What makes the sound for the station that is loaded: a real station's own stream, or
  // YouTube's player for a recording. They answer to the same few words.
  const onAir = Boolean(stations.find((st) => st.id === loadedId)?.stream)
  const status = onAir ? air.status : yt.status
  const toggleSound = onAir ? air.toggle : yt.toggle
  const isPlaying = status === 'playing' || status === 'buffering'
  const isCurrentLoaded = Boolean(current && loadedId === current.id)
  // A show from Mixcloud is on: its player is to be seen.
  const mixShown = Boolean(isCurrentLoaded && current.mixcloud)
  // The line of the list of songs that is playing, and its title.
  const trackNow = isCurrentLoaded ? trackIndex(current.tracks, yt.time.current) : -1
  const song = trackNow >= 0 ? current.tracks[trackNow][1] : null
  // A station made of several recordings (a radio show's episodes): the one that is on, which
  // is said where a song would be.
  const show = isCurrentLoaded ? current.shows?.find((sh) => sh.id === yt.recording) : undefined
  const showName = show?.label
  // What is on, to be read at a glance: a song as its title and who plays it; what isn't a song
  // (an ad, the DJ, the episode of a show) as the one line there is. Lists don't all put the
  // artist first: parseSong knows which way round each is.
  const played = song ? parseSong(song, current.videoId) : null
  const piece = song ? (played ? { title: played.track, by: played.artist } : { title: song }) : showName ? { title: showName } : null
  const onTitle = piece?.title
  const onBy = piece?.by

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
    localStorage.setItem(AWAKE_KEY, JSON.stringify(awake))
  }, [awake])
  useEffect(() => {
    localStorage.setItem(CONTROLS_KEY, JSON.stringify(controls))
  }, [controls])
  useEffect(() => {
    localStorage.setItem(KEYS_KEY, JSON.stringify(keys))
  }, [keys])
  // Come in by the old shortcut: its mark is taken off the address.
  useEffect(() => {
    if (OLD_SHORTCUT) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.hash)
  }, [])

  // The static stops once the new station is playing (or has failed).
  useEffect(() => {
    if (status !== 'buffering') {
      stopStatic.current?.()
      stopStatic.current = null
    }
  }, [status])

  function tune(st) {
    // (A stream plays in the page itself: the phone's controls are the app's without help.)
    if (controls && !st.stream) holdSession(true)
    stopStatic.current?.()
    stopStatic.current = startStatic(yt.volume)
    setCurrentId(st.id)
    setLoadedId(st.id)
    setRecent((list) => [st.id, ...list.filter((id) => id !== st.id)].slice(0, 12))
    if (st.stream) {
      yt.pause()
      air.play(st.stream)
    } else {
      air.stop()
      yt.load(st.videoId, st.length, st.shows)
    }
  }

  function toggleFav(st) {
    setFavs((list) => (list.includes(st.id) ? list.filter((id) => id !== st.id) : [...list, st.id]))
  }

  function playStation(st) {
    if (!playable(st)) return bringUp(st)
    if (st.id !== loadedId) return tune(st)
    if (st.id === currentId) return toggleSound()
    // Back on the station that was left for one that opens elsewhere: it carries on.
    setCurrentId(st.id)
    if (!isPlaying) toggleSound()
  }
  // A real station without a stream isn't played here: it comes up on the screen, whatever was
  // playing goes quiet, and its play key opens it where it is on the air.
  function bringUp(st) {
    yt.pause()
    air.stop()
    setCurrentId(st.id)
  }
  const remember = (st) => setRecent((list) => [st.id, ...list.filter((id) => id !== st.id)].slice(0, 12))

  function togglePlay() {
    if (!current) return stations[0] && playStation(stations[0])
    if (!playable(current)) {
      // From the keyboard; the key on the screen is a link of its own.
      remember(current)
      window.open(current.link, '_blank', 'noopener')
    } else if (isCurrentLoaded) toggleSound()
    else tune(current)
  }

  // The stations in a row with the current one, in the chosen mode: its game's, its era's, or
  // all of them in this visit's shuffled order. It is what the home screen's row shows, and what
  // previous / next walk through.
  // A real station's row is always its city's, and no other row has real stations in it.
  const row = !current
    ? stations
    : current.link || mode === 'game'
      ? stations.filter((st) => st.game === current.game)
      : mode === 'random'
        ? shuffled
        : RECORDINGS.filter((st) => st[mode] === current[mode])

  function step(dir) {
    if (!row.length) return
    const i = row.findIndex((st) => st.id === currentId)
    playStation(row[(i + dir + row.length) % row.length])
  }

  // To a station chosen by sliding the row or from the game picker: the radio follows if it is on;
  // if nothing has played yet, the station is only brought up, ready for the play key.
  function goTo(st) {
    if (loadedId != null) playStation(st)
    else setCurrentId(st.id)
  }

  function pickGame(id) {
    setPicking(false)
    if (current?.game === id) return
    // Back to the station last listened to in that game, when it is still among the recents.
    const target = recentStations.find((st) => st.game === id) ?? stations.find((st) => st.game === id)
    if (target) goTo(target)
  }

  // --- The phone's keys (lock screen, notification, car, assistant, launchers like AutoZen) ---

  function setPlaying(want) {
    if (!current) return want && stations[0] && playStation(stations[0])
    // A key of the phone can't open another app.
    if (!playable(current)) return
    if (!isCurrentLoaded) return want && tune(current)
    if (want !== isPlaying) toggleSound()
  }

  // Previous / next, as the phone, the car or a headset send them. A setting says what they do:
  // change station, like the swipe; go from song to song, where the list of songs is known (next
  // to the following song, previous to the start of this one, or to the one before when it has
  // just begun); or skip 30 seconds. A broadcast can't be moved: live, they change station.
  function skip(dir) {
    if (keys === 'station' || !isCurrentLoaded || live || !current.videoId) return step(dir)
    const list = keys === 'song' && current.tracks
    const songs = list ? list.map((_, i) => i).filter((i) => current.songs[i]) : []
    // No list to go by: 30 seconds, rather than leaving the station.
    if (!songs.length) return yt.hop(dir * HOP)
    let to
    if (dir > 0) to = songs.find((i) => i > trackNow) ?? songs[0]
    else if (current.songs[trackNow] && yt.time.current - list[trackNow][0] > 5) to = trackNow
    else to = songs.findLast((i) => i < trackNow) ?? songs[songs.length - 1]
    yt.skipTo(list[to][0])
  }

  // Rewind / fast-forward, and the notification's own seek bar. A broadcast can't be moved.
  function seekTo(t) {
    if (!isCurrentLoaded || !current.videoId || live || !(yt.time.duration > 0) || !(t >= 0)) return
    yt.seek(Math.min(t, yt.time.duration - 1))
  }
  const nudge = (by) => isCurrentLoaded && current.videoId && !live && yt.hop(by)


  function changeLive(on) {
    setLive(on)
    if (on && isCurrentLoaded && current.videoId) yt.goLive()
  }

  // Like in the games, the wheel opens on the current game's stations, whatever the mode.
  const wheelGame = () => current?.game ?? GAME_IDS[0]
  // With a page from the band (a game, 'favs', 'recent'), or on the current game's.
  const openWheel = (page) => setWheel({ game: typeof page === 'string' ? page : wheelGame(), hold: false })
  function closeWheel() {
    holding.current = null
    setWheel(null)
  }
  function turnWheel(dir) {
    setWheel((w) => w && { ...w, game: wheelPages[(wheelPages.indexOf(w.game) + dir + wheelPages.length) % wheelPages.length] })
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
    else if (searching) setSearching(false)
    else if (picking) setPicking(false)
    else if (details) setDetails(false)
  }

  const actions = useRef({})
  useEffect(() => {
    actions.current = {
      togglePlay,
      setPlaying,
      skip,
      nudge,
      seekTo,
      closeTop,
      closeWheel,
      // The wheel rolls to the next game by itself, then calls turnWheel.
      rollWheel: (dir) => wheelRef.current?.turn(dir),
      holdStart,
      holdMove,
      holdEnd,
      holdToTap,
      wheel,
      loaded: () => loadedId != null,
      // In the middle of something a reload would undo.
      step,
      busy: () => loadedId != null || settingsOpen || searching || picking || Boolean(wheel),
      layered: () => settingsOpen || searching || picking || details,
    }
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
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        // In the wheel, the arrows turn to the next game; on the home screen, to the next station.
        const dir = e.code === 'ArrowLeft' ? -1 : 1
        // With Shift, anywhere but in the wheel: 30 seconds back or on.
        if (e.shiftKey && !a.wheel) a.nudge(dir * HOP)
        else if (a.wheel) a.rollWheel(dir)
        else if (!a.layered() && !e.target.closest('.stations')) a.step(dir)
        else return
        e.preventDefault()
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
    mediaKey('play', () => actions.current.setPlaying(true))
    mediaKey('pause', () => actions.current.setPlaying(false))
    mediaKey('stop', () => actions.current.setPlaying(false))
    mediaKey('previoustrack', () => actions.current.skip(-1))
    mediaKey('nexttrack', () => actions.current.skip(1))
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
  const anyLayer = wheelLayer || settingsOpen || searching || picking || details
  const layers = useRef({})
  useEffect(() => {
    layers.current = { wheel: wheelLayer, settingsOpen, searching, picking, details }
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
      } else if (open.searching) setSearching(false)
      else if (open.picking) setPicking(false)
      else if (open.details) setDetails(false)
      else return
      // Another layer is still open underneath: it keeps an entry.
      if (Object.values(open).filter(Boolean).length > 1) window.history.pushState({ layer: true }, '')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const failed = isCurrentLoaded && status === 'error'
  const { status: scrobbleStatus, last: lastScrobble } = useScrobbler({
    videoId: (isCurrentLoaded && current.videoId) || null,
    tracks: current?.tracks,
    playing: !onAir && yt.status === 'playing',
    time: yt.time,
  })

  // A newer version on the server: taken at once when coming back to an app that is doing nothing,
  // otherwise announced in the settings, where it can be taken with one touch.
  useEffect(() => {
    let gone = false
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      const build = await newerBuild()
      if (!build || gone) return
      if (actions.current.busy() || !reloadFor(build)) setUpdateReady(true)
    }
    check()
    document.addEventListener('visibilitychange', check)
    const every = setInterval(check, 15 * 60_000)
    return () => {
      gone = true
      document.removeEventListener('visibilitychange', check)
      clearInterval(every)
    }
  }, [])

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

  // The station's tile for the lock screen, drawn once per station.
  useEffect(() => {
    if (!current) return
    let stale = false
    tile(current).then((url) => !stale && setArt(url && { id: current.id, url }))
    return () => {
      stale = true
    }
  }, [current])

  useEffect(() => {
    if (!current) return
    showOutside(`${current.name} · Radio`, {
      // A song as its title and its artist, as any player gives them (a car's screen, a
      // scrobbler reading the notification), with the station where the album goes.
      title: onTitle ?? current.name,
      artist: onBy ?? (onTitle ? current.name : current.dj || gameLabel(current.game)),
      album: onBy ? `${current.name} · ${gameLabel(current.game)}` : gameLabel(current.game),
      // The tile drawn for the station, once it is; a recording with a picture of its own shows
      // that. Never nothing: the phone would put the page's small icon there, blown up.
      artwork:
        art?.id === current.id
          ? [{ src: art.url, sizes: '512x512', type: 'image/png' }]
          : current.picture
            ? [{ src: show?.picture ?? current.picture, sizes: '640x640' }, APP_ICON]
            : current.art
              ? [{ src: thumbs(current, true)[0], sizes: '1280x720', type: 'image/jpeg' }, APP_ICON]
              : [APP_ICON],
    })
  }, [current, onTitle, onBy, art, show?.picture])

  // Playing or paused, as the phone should show it; and the silent track that keeps the phone's
  // controls with the app rather than with YouTube's player (see session.js).
  const sounding = isCurrentLoaded && isPlaying
  // There is no car screen: this one is made to be read from a mount too, and stays lit while a
  // station plays, when the phone is charging (as it is in a car) or always, as the setting says.
  const plugged = usePlugged()
  useWakeLock(sounding && (awake === 'always' || (awake === 'plugged' && plugged)))
  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = !isCurrentLoaded ? 'none' : sounding ? 'playing' : 'paused'
    holdSession(controls && sounding && !onAir)
  }, [controls, isCurrentLoaded, sounding, onAir])

  // The phone can stop that track on its own and leave YouTube's playing, which hands the
  // controls back to YouTube. So with each second the recording moves on, the track is put back
  // if it has stopped. (Only then: a recording the phone has stopped too is left alone, and so
  // is whatever it stopped them for.)
  const movedTo = useRef(0)
  useEffect(() => {
    const moved = yt.time.current !== movedTo.current
    movedTo.current = yt.time.current
    if (moved && controls && sounding && !onAir) holdSession(true)
  }, [controls, sounding, onAir, yt.time])

  // Where the recording is, for the notification's progress bar.
  useEffect(() => {
    if (!navigator.mediaSession?.setPositionState) return
    try {
      if (isCurrentLoaded && !onAir && yt.time.duration > 0) {
        navigator.mediaSession.setPositionState({ duration: yt.time.duration, position: Math.min(yt.time.current, yt.time.duration), playbackRate: 1 })
      } else navigator.mediaSession.setPositionState()
    } catch {
      // A position the browser won't take; the bar just stays where it was.
    }
  }, [isCurrentLoaded, onAir, yt.time])

  // No rewinding a broadcast: in live mode, and on a real station, the phone doesn't offer it.
  useEffect(() => {
    const fixed = live || onAir
    mediaKey('seekbackward', fixed ? null : (e) => actions.current.nudge(-(e.seekOffset || 30)))
    mediaKey('seekforward', fixed ? null : (e) => actions.current.nudge(e.seekOffset || 30))
    mediaKey('seekto', fixed ? null : (e) => actions.current.seekTo(e.seekTime))
  }, [live, onAir])

  // On the home screen, with a whole hand and without looking: sideways changes station (the row
  // of stations scrolls by itself; anywhere else, a swipe does it), up shows the details, down
  // the choice of games, and a held finger opens the wheel.
  const sheetSwipe = useSwipe({
    onEnd: (s) => {
      if (s.axis === 'x' && !s.strip && Math.abs(s.dx) > 70) step(s.dx < 0 ? 1 : -1)
      else if (s.axis === 'y' && s.dy < -70 && current && !current.link) setDetails(true)
      else if (s.axis === 'y' && s.dy > 70) setPicking(true)
    },
    hold,
  })
  const detailsSwipe = useSwipe({
    onEnd: (s) => s.axis === 'y' && s.dy > 90 && setDetails(false),
  })

  const playIcon = isCurrentLoaded && isPlaying ? PAUSE : PLAY
  const tuning = isCurrentLoaded && status === 'buffering'
  const pct = isCurrentLoaded && yt.time.duration ? (yt.time.current / yt.time.duration) * 100 : 0
  const transport = (
    <>
      <button className="ctrl" title="Station précédente" aria-label="Station précédente" onClick={() => step(-1)}>
        <Icon d={PREV} />
      </button>
      {current && !playable(current) ? (
        // A real station without a stream plays elsewhere: its key is the way there.
        <a
          className="ctrl ctrl--main"
          href={current.link}
          target="_blank"
          rel="noopener"
          onClick={() => remember(current)}
          title={`Écouter sur ${outside(current)}`}
          aria-label={`Écouter ${current.name} sur ${outside(current)}`}
        >
          <Icon d={OUTSIDE} />
        </a>
      ) : (
        <button className="ctrl ctrl--main" title="Lecture / pause (espace)" aria-label="Lecture / pause" onClick={togglePlay}>
          <Icon d={playIcon} />
        </button>
      )}
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

  return (
    <div className="app">
      <div ref={hostRef} className={`audio-host ${details && isCurrentLoaded ? 'audio-host--video' : ''}`} aria-hidden="true" />

      {/* The home screen is the radio itself: the station's sign in the night, what's on in a corner,
          one key, and the band of games along the bottom. Most of it is left empty on purpose. */}
      <main
        className={`sheet ${isCurrentLoaded && status === 'playing' ? 'is-playing' : ''} ${tuning ? 'is-tuning' : ''}`}
        style={{ '--accent': current?.color ?? '#2b2f34' }}
        inert={anyLayer}
        {...sheetSwipe}
      >
        {current && <Backdrop game={BACKDROPS[current.id] ? current.id : current.game} />}
        <header className="sheet-top">
          <h1 className="sheet-game">
            <button className="game-name" onClick={() => setPicking(true)} title="Choisir un jeu">
              {current ? gameLabel(current.game) : 'Choisis un jeu'}
              <Icon d={CHEVRON} size={18} />
            </button>
            {/* A real station is always live; a recording is when the setting says so. */}
            {(current?.stream || (live && !current?.link)) && <span className="lamp">En direct</span>}
          </h1>
          <span className="sheet-top-actions">
            <button className="ctrl" onClick={() => setSearching(true)} aria-label="Tous les postes" title="Tous les postes (/)">
              <Icon d={SEARCH} size={24} />
            </button>
            <button
              className={`ctrl ${scrobblingOn(scrobbleSettings) || sync || updateReady ? 'on' : ''}`}
              onClick={() => setSettingsOpen(true)}
              aria-label="Réglages"
              title="Réglages&nbsp;: écoute en direct, commandes du téléphone, synchro, scrobbling"
            >
              <Icon d={GEAR} size={24} />
            </button>
          </span>
        </header>
        <div className="sheet-stage">
          {current ? (
            <Carousel list={row} currentId={current.id} held={Boolean(wheel)} onChoose={goTo} onOpen={openWheel} onStep={step} />
          ) : (
            <button className="sheet-art--none" onClick={() => setPicking(true)} aria-label="Choisir un jeu">
              <Icon d={WHEEL} size={72} />
            </button>
          )}
        </div>
        {/* What's on, in a corner, and one key. Touching the text or the dial opens the details. */}
        <div className="now">
          <div className="now-main">
            <button className="now-text" onClick={() => setDetails(true)} disabled={!current || Boolean(current.link)} title="Liste des chansons, cadran et vidéo">
              {/* With something on, the station steps back to a label (its sign is right above)
                  and the song takes the large type: its title, then who plays it. */}
              <span className={`now-name ${piece && !failed ? 'now-name--label' : ''}`}>
                {current && <Bars />}
                {current?.name ?? 'Choisis un poste'}
              </span>
              {failed ? (
                <span className="now-song is-error" role="alert">
                  {FAILED}
                </span>
              ) : piece ? (
                <span className="now-song now-song--piece">
                  <b className="now-title">{piece.title}</b>
                  {(piece.by || song) && (
                    <span className="now-by">
                      {piece.by}
                      {song && scrobbleStatus?.state === 'done' && <span className="song-scrobble song-scrobble--done"> ✓ envoyée</span>}
                      {song && scrobbleStatus?.state === 'error' && (
                        <span className="song-scrobble song-scrobble--error" title={scrobbleStatus.error}>
                          {' '}
                          ! non envoyée
                        </span>
                      )}
                    </span>
                  )}
                </span>
              ) : (
                <span className="now-song">
                  {!current && 'Touche « Choisis un jeu », en haut.'}
                  {current && [current.dj, current.genre].filter(Boolean).join(' · ')}
                </span>
              )}
            </button>
            {current && (
              <button className={`ctrl fav ${isFav ? 'on' : ''}`} onClick={() => toggleFav(current)} aria-label="Favori" aria-pressed={isFav}>
                <Icon d={isFav ? HEART : HEART_OUTLINE} size={24} />
              </button>
            )}
          </div>
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
        {current?.link ? (
          // No recording, so no dial: where else the station is on the air, which is the way to
          // it when it has no stream, or when its stream won't come.
          <a className="sheet-dial sheet-outside legend" href={current.link} target="_blank" rel="noopener" onClick={() => remember(current)}>
            {current.stream ? 'Aussi sur ' : 'En ondes sur '}
            {current.on === 'TuneIn' ? 'TuneIn' : 'le site du poste'}
          </a>
        ) : mixShown ? (
          // A show from Mixcloud: its player sits here, in the dial's place (see .mix-host).
          <div className="sheet-dial sheet-mix" />
        ) : (
          <button className="sheet-dial" onClick={() => setDetails(true)} disabled={!current} aria-label="Cadran, liste des chansons et vidéo">
            <span className="player-dial" style={{ '--pct': `${pct}%` }}>
              <i />
            </span>
          </button>
        )}
      </main>
      {/* Mixcloud's player, which Mixcloud wants seen: along the bottom of the home screen while
          one of its shows is on, and out of the way otherwise. Whatever opens over the home
          screen covers it too. */}
      <div ref={mixHostRef} className={`mix-host ${mixShown ? 'mix-host--shown' : ''}`} inert={!mixShown || anyLayer} />

      {/* Behind the dial: the video, the list of songs, the full dial and the swipe mode. */}
      {details && current && !current.link && (
        <div className={`details ${isCurrentLoaded && isPlaying ? 'is-playing' : ''}`} style={{ '--accent': current.color }} inert={wheelLayer || settingsOpen} {...detailsSwipe}>
          {/* The same night as the home screen, a shade darker: there is more to read here. */}
          <Backdrop game={BACKDROPS[current.id] ? current.id : current.game} />
          <div className="details-inner">
            <div className="sheet-top">
              <button className="ctrl" onClick={() => setDetails(false)} aria-label="Revenir au poste">
                <Icon d={CHEVRON} size={30} />
              </button>
              <span className="sheet-game">{current.name}</span>
              <span className="sheet-top-actions" />
            </div>
            {/* The video, and beside it (under it, on a wide screen) what is on, as on the home
                screen. The real YouTube iframe is positioned over the slot (see
                .audio-host--video). For one of several recordings, the picture is that of the
                one that is on. */}
            <div className="details-head">
              <div className="video-slot">
                {(!isCurrentLoaded || current.mixcloud) && <Cover key={show?.id ?? current.id} station={show ? { ...current, picture: show.picture } : current} big />}
              </div>
              <div className="details-now">
                {piece ? (
                  <>
                    <b className="now-title">{piece.title}</b>
                    {piece.by && <span className="now-by">{piece.by}</span>}
                  </>
                ) : (
                  <>
                    <b className="now-title">{current.dj || current.name}</b>
                    <span className="now-by">{current.genre}</span>
                  </>
                )}
              </div>
            </div>
            <div className="chips">
              {/* (Said beside the video when no song is: not twice.) */}
              {piece && current.dj && <span className="badge">{current.dj}</span>}
              {piece && <span className="badge">{current.genre}</span>}
              <span className="badge">{eraLabel(current.era)}</span>
              <TalkBadge talk={current.talk} />
            </div>
            {current.tracks ? (
              <Tracklist key={current.id} station={current} index={trackNow} onSeek={isCurrentLoaded && !live ? yt.seek : null} />
            ) : (
              <p className="tracks-none">Pas de liste de chansons pour ce poste.</p>
            )}
            <Dial
              rec={yt.heard[show?.id ?? current.videoId]}
              time={yt.time}
              enabled={isCurrentLoaded}
              live={live}
              onSeek={yt.seek}
              onHop={nudge}
              playIcon={playIcon}
              onToggle={togglePlay}
              onReset={() => yt.resetHeard(show?.id ?? current.videoId)}
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


      {settingsOpen && (
        <Settings
          count={countScrobblable(stations)}
          total={RECORDINGS.length}
          live={live}
          onLive={changeLive}
          controls={controls}
          onControls={setControls}
          awake={awake}
          onAwake={setAwake}
          recording={sounding && !onAir}
          keys={keys}
          onKeys={setKeys}
          updateReady={updateReady}
          lastStatus={scrobbleError ? { state: 'error', error: scrobbleError } : lastScrobble}
          onClose={closeSettings}
        />
      )}

      {searching && (
        <Directory
          stations={stations}
          currentId={currentId}
          favs={favs}
          onPick={(st) => {
            if (st.id !== loadedId) playStation(st)
            setSearching(false)
          }}
          onClose={() => setSearching(false)}
        />
      )}

      {picking && (
        <GamePicker
          stations={stations}
          currentId={currentId}
          favStations={favStations}
          recentStations={recentStations}
          onGame={pickGame}
          onStation={(st) => {
            setPicking(false)
            if (st.id !== loadedId) playStation(st)
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {wheel && (
        <RadioWheel
          ref={wheelRef}
          pages={[-1, 0, 1].map((step) => {
            const id = wheelPages[(wheelPages.indexOf(wheel.game) + step + wheelPages.length) % wheelPages.length]
            return { id, title: EXTRAS[id] ?? gameLabel(id), stations: wheelStations(id) }
          })}
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
