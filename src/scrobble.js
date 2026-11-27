import { useEffect, useRef, useState } from 'react'
import { md5 } from './md5.js'

// Sends the songs heard on stations with a tracklist to ListenBrainz and/or Last.fm.
// Everything happens in the browser: the ListenBrainz token and the Last.fm session stay in localStorage.

const SETTINGS_KEY = 'radio:scrobble'
const QUEUE_KEY = 'radio:scrobble-queue'
const LB_API = 'https://api.listenbrainz.org/1/'
const LFM_API = 'https://ws.audioscrobbler.com/2.0/'
const CLIENT = 'Radio'

// Last.fm app key/secret baked in at build time (VITE_LASTFM_KEY / VITE_LASTFM_SECRET), or typed in the settings.
const LFM_KEY = import.meta.env.VITE_LASTFM_KEY || ''
const LFM_SECRET = import.meta.env.VITE_LASTFM_SECRET || ''

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: scrobbling still works for this session.
  }
}

// --- Song titles -----------------------------------------------------------------------------

// These recordings list "Title - Artist" instead of "Artist - Title".
const TITLE_FIRST = new Set([
  '6x5lj1Ssd3Y',
  '8ecauPD5TTs',
  'a849BeTKco4',
  'tHZF__xY-Wo',
  // GTA VI, as its uploader lists it.
  'gYU6LoX2MAw',
  'Z_Kcq0-wmJ4',
  'Kvarw9q9Zh4',
  'qtrFpZpj13g',
  'ZSCLM_kGzkU',
  'Hr4UgN6UbSw',
  'Y_ELedvsw7U',
  '-P5WQoSdhHg',
  'W_e5eUNgIqE',
  'vSgT06Fwrb4',
  '13V3vbCH4cw',
  'GqLYAUj9Gco',
  'kyaZvQSUF4k',
  'adG_RoLgOfo',
  'fqMm_h9VKPc',
  'zYTQuZuzSqY',
  '-RwK09PE-lw',
  'LxdLqlBJIV0',
  'ZF_ae0Nyb5A',
  '5EEEOXYH4f4',
])
// Tracklist entries that aren't songs: ads, news, DJ bits, call-ins…
const NOT_SONG =
  /^(commercials?|ads?|advert(isement)?s?|ident|intro|outro|news|weather|dj(?=\s*$)|guest|caller|call|segment|interlude|promo|jingle|station id|skit|break|talk|interview|\w+ call|mike and david show|weazel)\b/i

const unquote = (s) =>
  s
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s*=\s*$/, '')
    .trim()
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .trim()

// "Artist - Title" from a tracklist line, or null when the line isn't a song.
export function parseSong(line, videoId) {
  let s = line
    .trim()
    .replace(/^[^\p{L}\p{N}("“!]+/u, '') // emoji / bullets
    .replace(/^(song\s*)?\d+\s*[-–—.:]\s*/i, '') // "SONG 1 — " / "1 — "
  if (/^\(.*\)$/.test(s)) s = s.slice(1, -1)
  const m = s.match(/^(.+?)\s+[-–—]\s*(.+)$/)
  if (!m) return null
  let [, artist, track] = m
  if (TITLE_FIRST.has(videoId)) [artist, track] = [track, artist]
  artist = unquote(artist)
  if ((artist.match(/\(/g) || []).length > (artist.match(/\)/g) || []).length) artist += ')'
  track = unquote(track)
  if (!artist || !track || NOT_SONG.test(artist) || NOT_SONG.test(track)) return null
  return { artist, track }
}

// --- Settings --------------------------------------------------------------------------------

export function readSettings() {
  return readJson(SETTINGS_KEY, {})
}
function saveSettings(s) {
  writeJson(SETTINGS_KEY, s)
  window.dispatchEvent(new Event('radio:scrobble'))
  return s
}
const update = (patch) => saveSettings({ ...readSettings(), ...patch })

export const lastfmKeys = (s = readSettings()) => ({ key: s.lfmKey || LFM_KEY, secret: s.lfmSecret || LFM_SECRET })

export function useScrobbleSettings() {
  const [settings, setSettings] = useState(readSettings)
  useEffect(() => {
    const refresh = () => setSettings(readSettings())
    window.addEventListener('radio:scrobble', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('radio:scrobble', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  return settings
}

// --- ListenBrainz ----------------------------------------------------------------------------

async function lbFetch(path, token, body) {
  const res = await fetch(LB_API + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Token ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || `ListenBrainz\u00a0: erreur ${res.status}`), { retry: res.status >= 500 || res.status === 429 })
  return data
}

export async function connectListenBrainz(token) {
  const t = token.trim()
  const data = await lbFetch('validate-token', t)
  if (!data.valid) throw new Error('Jeton ListenBrainz invalide. Recopie-le depuis listenbrainz.org/settings.')
  update({ lbToken: t, lbUser: data.user_name })
  return data.user_name
}
export const disconnectListenBrainz = () => update({ lbToken: undefined, lbUser: undefined })

const lbMeta = (song) => ({
  artist_name: song.artist,
  track_name: song.track,
  additional_info: {
    media_player: CLIENT,
    submission_client: CLIENT,
    music_service: 'youtube.com',
    ...(song.duration && { duration: Math.round(song.duration) }),
    ...(song.url && { origin_url: song.url }),
  },
})

// --- Last.fm ---------------------------------------------------------------------------------

function sign(params, secret) {
  const base = Object.keys(params)
    .sort()
    .map((k) => k + params[k])
    .join('')
  return md5(base + secret)
}

async function lfmCall(params, { key, secret }) {
  const all = { ...params, api_key: key }
  const body = new URLSearchParams({ ...all, api_sig: sign(all, secret), format: 'json' })
  const res = await fetch(LFM_API, { method: 'POST', body })
  const data = await res.json().catch(() => ({}))
  if (data.error || !res.ok) {
    // 11/16: service temporarily unavailable; 29: rate limit.
    const retry = res.status >= 500 || [11, 16, 29].includes(data.error)
    throw Object.assign(new Error(`Last.fm\u00a0: ${data.message || `erreur ${res.status}`}`), { retry, code: data.error })
  }
  return data
}

// Sends the user to Last.fm to allow the app; Last.fm comes back here with ?token=.
export function startLastfmLogin() {
  const { key } = lastfmKeys()
  const cb = location.origin + location.pathname
  location.href = `https://www.last.fm/api/auth/?api_key=${encodeURIComponent(key)}&cb=${encodeURIComponent(cb)}`
}

// Called once at startup: finishes the Last.fm login when the URL carries its token.
export async function finishLastfmLogin() {
  const url = new URL(location.href)
  const token = url.searchParams.get('token')
  if (!token) return null
  url.searchParams.delete('token')
  history.replaceState(null, '', url)
  const keys = lastfmKeys()
  if (!keys.key || !keys.secret) return null
  const data = await lfmCall({ method: 'auth.getSession', token }, keys)
  update({ lfmSession: data.session.key, lfmUser: data.session.name })
  return data.session.name
}
export const disconnectLastfm = () => update({ lfmSession: undefined, lfmUser: undefined })
export const setLastfmKeys = (key, secret) => update({ lfmKey: key.trim() || undefined, lfmSecret: secret.trim() || undefined })

const lfmParams = (song) => ({
  artist: song.artist,
  track: song.track,
  ...(song.duration && { duration: String(Math.round(song.duration)) }),
})

// --- Sending ---------------------------------------------------------------------------------

function services(s = readSettings()) {
  const list = []
  if (s.lbToken) list.push('lb')
  const keys = lastfmKeys(s)
  if (s.lfmSession && keys.key && keys.secret) list.push('lfm')
  return list
}
export const scrobblingOn = (s) => services(s).length > 0

async function send(service, kind, song) {
  const s = readSettings()
  if (service === 'lb') {
    const payload = kind === 'now' ? [{ track_metadata: lbMeta(song) }] : [{ listened_at: song.ts, track_metadata: lbMeta(song) }]
    return lbFetch('submit-listens', s.lbToken, { listen_type: kind === 'now' ? 'playing_now' : 'single', payload })
  }
  const params =
    kind === 'now'
      ? { method: 'track.updateNowPlaying', ...lfmParams(song), sk: s.lfmSession }
      : // A radio picked the song, not the listener.
        { method: 'track.scrobble', ...lfmParams(song), timestamp: String(song.ts), chosenByUser: '0', sk: s.lfmSession }
  try {
    return await lfmCall(params, lastfmKeys(s))
  } catch (e) {
    // 9: session revoked on last.fm.
    if (e.code === 9) disconnectLastfm()
    throw e
  }
}

// Scrobbles that couldn't be sent (offline in the car…) are kept and retried.
const readQueue = () => readJson(QUEUE_KEY, [])
let flushing = false
async function flushQueue() {
  if (flushing || !navigator.onLine) return
  flushing = true
  try {
    const active = services()
    let queue = readQueue().filter((q) => active.includes(q.service))
    for (const item of [...queue]) {
      try {
        await send(item.service, 'scrobble', item.song)
      } catch (e) {
        // Still offline or server trouble: try again later. Any other error drops the item.
        if (e instanceof TypeError || e.retry) break
      }
      queue = queue.filter((q) => q !== item)
      writeJson(QUEUE_KEY, queue)
    }
  } finally {
    flushing = false
  }
}
if (typeof window !== 'undefined') window.addEventListener('online', flushQueue)

async function scrobble(song, onResult) {
  const results = await Promise.all(
    services().map(async (service) => {
      try {
        await send(service, 'scrobble', song)
        return null
      } catch (e) {
        // Network down (TypeError) or server trouble: keep it for later.
        if (e instanceof TypeError || e.retry) {
          writeJson(QUEUE_KEY, [...readQueue(), { service, song }].slice(-500))
          return null
        }
        return e.message
      }
    }),
  )
  const error = results.find(Boolean)
  onResult(error ? { state: 'error', error, song } : { state: 'done', song })
  if (!error) flushQueue()
}

const nowPlaying = (song) => services().forEach((service) => send(service, 'now', song).catch(() => {}))

// --- Following the player --------------------------------------------------------------------

// Like Last.fm's rule: a song counts once half of it (or 4 minutes) has been heard, if it lasts 30 s or more.
const MIN_LENGTH = 30
const MAX_NEEDED = 240
const NOW_PLAYING_AFTER = 5

function segmentAt(tracks, t, duration) {
  let i = -1
  while (i + 1 < tracks.length && tracks[i + 1][0] <= t) i++
  if (i < 0) return null
  const end = tracks[i + 1]?.[0] ?? duration
  return { index: i, start: tracks[i][0], length: end - tracks[i][0], title: tracks[i][1] }
}

// Watches the playback position and sends "now playing" + scrobbles for the station's songs.
// Returns { status, last }: where the current song stands (null, { state: 'now' | 'done' | 'error', song, error })
// and the last scrobble attempt.
export function useScrobbler({ videoId, tracks, playing, time }) {
  const settings = useScrobbleSettings()
  const on = scrobblingOn(settings)
  const ref = useRef(null)
  const [status, setStatus] = useState(null)
  const [last, setLast] = useState(null)

  useEffect(() => {
    if (on) flushQueue()
  }, [on])

  useEffect(() => {
    const cur = ref.current
    if (!on || !tracks || !videoId || !playing || !(time.duration > 0)) {
      if (cur) cur.lastPos = null
      return
    }
    const seg = segmentAt(tracks, time.current, time.duration)
    if (!seg) return
    const key = `${videoId}:${seg.index}`
    let state = cur
    if (!cur || cur.key !== key) {
      const parsed = parseSong(seg.title, videoId)
      state = ref.current = {
        key,
        song: parsed && {
          ...parsed,
          duration: seg.length,
          url: `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seg.start)}s`,
        },
        length: seg.length,
        listened: 0,
        nowSent: false,
        sent: false,
        lastPos: null,
        lastWall: 0,
      }
    }
    if (!state.song) return
    const now = Date.now()
    const delta = state.lastPos == null ? 0 : time.current - state.lastPos
    // Only count normal playback, not seeks.
    if (delta > 0 && delta < (now - state.lastWall) / 1000 + 3) state.listened += delta
    state.lastPos = time.current
    state.lastWall = now

    if (!state.nowSent && state.listened >= NOW_PLAYING_AFTER) {
      state.nowSent = true
      nowPlaying(state.song)
      setStatus({ key, state: 'now', song: state.song })
    }
    if (!state.sent && state.length >= MIN_LENGTH && state.listened >= Math.min(state.length / 2, MAX_NEEDED)) {
      state.sent = true
      // Listening start time, estimated from what was heard.
      const ts = Math.floor((now - state.listened * 1000) / 1000)
      const song = { ...state.song, ts }
      scrobble(song, (r) => {
        setLast(r)
        setStatus({ key, ...r })
      })
    }
  }, [on, videoId, tracks, playing, time])

  // The status only applies while the same song is playing.
  const seg = on && videoId && tracks && time.duration > 0 ? segmentAt(tracks, time.current, time.duration) : null
  const shown = seg && status?.key === `${videoId}:${seg.index}` ? status : null
  return { status: shown, last }
}

// How many stations have songs that can be scrobbled.
export const countScrobblable = (stations) => stations.filter((st) => st.tracks?.some(([, t]) => parseSong(t, st.videoId))).length
