import { useCallback, useEffect, useRef, useState } from 'react'
import { addHeard, clearHeard, clearHeardOf, following, liveSpot, liveStart, pickRecording, pickStart, readHeard } from './heard.js'
import { MixPlayer } from './mixcloud.js'

let apiPromise
function loadApi() {
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      if (window.YT?.Player) return resolve(window.YT)
      window.onYouTubeIframeAPIReady = () => resolve(window.YT)
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(s)
    })
  }
  return apiPromise
}

export function parseYouTubeId(value) {
  if (!value) return null
  const v = value.trim()
  const m = v.match(/(?:v=|youtu\.be\/|embed\/|live\/|shorts\/)([\w-]{11})/)
  if (m) return m[1]
  return /^[\w-]{11}$/.test(v) ? v : null
}

// The players behind every recording: YouTube's for nearly all of them, and Mixcloud's for the
// shows that live there, made on the first one asked for. A recording's id says which: a show's
// is its key at Mixcloud, which starts with a slash. Mixcloud's player takes the same orders and
// gives the same reports as YouTube's (see mixcloud.js), so one set of rules runs both.
const onMixcloud = (id) => id.startsWith('/')
// The player of the recording that is loaded, once it takes orders.
const pick = (mixRef, playerRef, readyRef, videoIdRef) =>
  videoIdRef.current && onMixcloud(videoIdRef.current) ? mixRef.current : readyRef.current ? playerRef.current : null

export function useYouTubePlayer(hostRef, live, mixHostRef) {
  const playerRef = useRef(null)
  const mixRef = useRef(null)
  // What a player reports, for the one made later.
  const eventsRef = useRef(null)
  // A station made of several recordings (Big Cuppa Radio's shows): the list, as [{ id, length }];
  // and where to begin the one being loaded when that isn't for the usual rule to say.
  const listRef = useRef(null)
  const startRef = useRef(null)
  const nextRef = useRef(null)
  // The recording that is loaded: the station's own, or the one of its several that is on.
  const [recording, setRecording] = useState(null)
  const liveRef = useRef(live)
  useEffect(() => {
    liveRef.current = live
  })
  const readyRef = useRef(false)
  const pendingRef = useRef(null)
  const videoIdRef = useRef(null)
  // Applied on the first PLAYING event, once the duration is known.
  const needsStartRef = useRef(false)
  // Last sampled position; null after a seek/load so jumps aren't counted as heard.
  const lastRef = useRef(null)
  const userPausedRef = useRef(false)
  const hiddenAtRef = useRef(0)
  const visibleAtRef = useRef(0)
  const [status, setStatus] = useState('idle')
  const [time, setTime] = useState({ current: 0, duration: 0 })
  const [heard, setHeard] = useState(readHeard)
  const [volume, setVolumeState] = useState(() => Number(localStorage.getItem('radio:volume') ?? 80))
  const volumeRef = useRef(volume)

  useEffect(() => {
    let cancelled = false
    const host = hostRef.current
    // YouTube's numbers for what a player is doing, which Mixcloud's speaks too.
    const S = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 }
    // The player that isn't the loaded recording's has just been told to stop: its word on that
    // is not this recording's.
    const mine = (e) => e.target === (videoIdRef.current && onMixcloud(videoIdRef.current) ? mixRef.current : playerRef.current)
    const events = {
      onStateChange: (e) => {
        if (!mine(e)) return
        if (e.data === S.PLAYING) {
          if (needsStartRef.current) {
            needsStartRef.current = false
            const d = e.target.getDuration()
            const at = startRef.current
            startRef.current = null
            // Said beforehand (one of several recordings, joined where the clock is).
            if (at != null) {
              if (at >= 1) e.target.seekTo(Math.min(at, Math.max(0, d - 5)), true)
            } else if (d > 120 && liveRef.current) e.target.seekTo(liveStart(d), true)
            else if (d > 120) {
              const id = videoIdRef.current
              const { start, reset } = pickStart(readHeard()[id], d)
              if (reset) setHeard(clearHeard(id))
              e.target.seekTo(start, true)
            }
            lastRef.current = null
          }
          setStatus('playing')
        } else if (e.data === S.PAUSED) {
          // The embed pauses itself when the page is hidden (phone switched to another app).
          // A pause right after hiding that the user didn't ask for gets undone; later pauses
          // (e.g. from lock-screen controls) are respected.
          const hidden = document.visibilityState === 'hidden'
          const justHidden = hidden && (hiddenAtRef.current < visibleAtRef.current || Date.now() - hiddenAtRef.current < 3000)
          if (justHidden && !userPausedRef.current) {
            e.target.playVideo()
            return
          }
          setStatus('paused')
        } else if (e.data === S.BUFFERING) setStatus('buffering')
        else if (e.data === S.ENDED) {
          lastRef.current = null
          // One of several: on to another. Alone: round again.
          if (listRef.current) return nextRef.current(true)
          e.target.seekTo(0, true)
          e.target.playVideo()
        }
      },
      onError: (e) => (!e || mine(e)) && setStatus('error'),
    }
    eventsRef.current = events
    loadApi().then((YT) => {
      if (cancelled) return
      const el = document.createElement('div')
      host.appendChild(el)
      playerRef.current = new YT.Player(el, {
        width: '100%',
        height: '100%',
        playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, iv_load_policy: 3 },
        events: {
          onReady: (e) => {
            readyRef.current = true
            // Nothing in the embed can be operated (controls: 0), so Tab skips it.
            e.target.getIframe().tabIndex = -1
            e.target.setVolume(volumeRef.current)
            if (pendingRef.current) e.target.loadVideoById(pendingRef.current)
            pendingRef.current = null
          },
          ...events,
        },
      })
    })
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAtRef.current = Date.now()
      else visibleAtRef.current = Date.now()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      playerRef.current?.destroy()
      playerRef.current = null
      readyRef.current = false
      host.replaceChildren()
      mixRef.current?.destroy()
      mixRef.current = null
    }
  }, [hostRef])

  useEffect(() => {
    if (status !== 'playing') {
      lastRef.current = null
      return
    }
    const t = setInterval(() => {
      const p = pick(mixRef, playerRef, readyRef, videoIdRef)
      if (!p?.getCurrentTime || needsStartRef.current) return
      const current = p.getCurrentTime()
      const duration = p.getDuration()
      setTime({ current, duration })
      const last = lastRef.current
      if (last != null && current > last && current - last < 3) {
        setHeard(addHeard(videoIdRef.current, last, current, duration))
      }
      lastRef.current = current
    }, 1000)
    return () => clearInterval(t)
  }, [status])

  // Loads one recording. `length`: its length in seconds where it is known beforehand (a show's
  // is); `at`: where to begin it, when that is already decided.
  const start = useCallback(
    (videoId, length, at = null) => {
      // From one player to the other: the one being left goes quiet.
      const was = videoIdRef.current
      if (was && onMixcloud(was) !== onMixcloud(videoId)) {
        if (onMixcloud(was)) mixRef.current?.pauseVideo()
        else if (readyRef.current) playerRef.current.pauseVideo()
        else pendingRef.current = null
      }
      videoIdRef.current = videoId
      startRef.current = at
      needsStartRef.current = true
      lastRef.current = null
      userPausedRef.current = false
      setRecording(videoId)
      setStatus('buffering')
      setTime({ current: 0, duration: 0 })
      if (onMixcloud(videoId)) {
        if (mixRef.current) mixRef.current.loadVideoById(videoId, length)
        else {
          mixRef.current = new MixPlayer(mixHostRef.current, videoId, length, {
            volume: volumeRef.current,
            report: (e) => eventsRef.current.onStateChange(e),
            fail: () => eventsRef.current.onError({ target: mixRef.current }),
          })
        }
      } else if (readyRef.current) playerRef.current.loadVideoById(videoId)
      else pendingRef.current = videoId
    },
    [mixHostRef],
  )

  // One of a station's several recordings. Live, the one the clock is in, where it is in it;
  // otherwise the one just left or one with something still to hear (see heard.js), and the usual
  // rule says where in it. `ended`: the one that was on has just finished.
  const startOne = useCallback(
    (ended) => {
      const list = listRef.current
      if (liveRef.current) {
        let spot = liveSpot(list)
        // The clock still in the last seconds of the one that has just ended: on to the next.
        if (ended && spot.id === videoIdRef.current && spot.at > spot.length / 2) spot = { ...following(list, spot.id), at: 0 }
        return start(spot.id, spot.length, spot.at)
      }
      const { id, reset } = pickRecording(list, readHeard(), ended ? videoIdRef.current : null)
      if (reset) setHeard(clearHeardOf(list))
      start(id, list.find((r) => r.id === id).length)
    },
    [start],
  )
  useEffect(() => {
    nextRef.current = startOne
  }, [startOne])

  // Tunes into a station: its recording, or one of its several (`list`).
  const load = useCallback(
    (videoId, length, list) => {
      listRef.current = list ?? null
      if (list) startOne(false)
      else start(videoId, length)
    },
    [start, startOne],
  )

  // Live: jump to where the broadcast is now.
  const goLive = useCallback(() => {
    const p = pick(mixRef, playerRef, readyRef, videoIdRef)
    if (!p || needsStartRef.current) return
    // Several recordings: the clock may be in another one by now.
    if (listRef.current) {
      const spot = liveSpot(listRef.current)
      if (spot.id !== videoIdRef.current) return start(spot.id, spot.length, spot.at)
      lastRef.current = null
      return p.seekTo(spot.at, true)
    }
    const d = p.getDuration()
    if (!(d > 120)) return
    lastRef.current = null
    p.seekTo(liveStart(d), true)
  }, [start])

  const toggle = useCallback(() => {
    const p = pick(mixRef, playerRef, readyRef, videoIdRef)
    if (!p) return
    // Still tuning in counts as playing, as on the key: pressed then, it stops the station.
    // (1 and 3: playing and buffering, in YouTube's numbers.)
    const state = p.getPlayerState()
    const playing = state === 1 || state === 3
    userPausedRef.current = playing
    if (playing) p.pauseVideo()
    else {
      // The broadcast went on during the pause.
      if (liveRef.current) goLive()
      p.playVideo()
    }
  }, [goLive])

  // Quiet, whatever it was doing: playing, or still tuning in.
  const pause = useCallback(() => {
    const p = pick(mixRef, playerRef, readyRef, videoIdRef)
    if (!p) return
    userPausedRef.current = true
    p.pauseVideo()
  }, [])

  const seek = useCallback((t) => {
    const p = pick(mixRef, playerRef, readyRef, videoIdRef)
    if (!p) return
    lastRef.current = null
    p.seekTo(t, true)
    setTime((x) => ({ ...x, current: t }))
  }, [])

  // A skip: to a given second, or `by` seconds from where the player is. Unlike a move of the
  // needle, what a skip passes over on the way forward counts as heard: it is how a glitch, a
  // song played twice or one that isn't wanted gets passed, and it shouldn't come back later as
  // a stretch still to hear.
  const skipTo = useCallback((t, by) => {
    const p = pick(mixRef, playerRef, readyRef, videoIdRef)
    if (!p || needsStartRef.current) return
    const d = p.getDuration()
    if (!(d > 0)) return
    const id = videoIdRef.current
    const from = p.getCurrentTime()
    const to = Math.max(0, Math.min(by == null ? t : from + by, d - 1))
    const passed = () => to > from && setHeard(addHeard(id, from, to, d))
    lastRef.current = null
    // Mixcloud says whether the show moved (it doesn't let every show be moved in); YouTube's
    // player always moves.
    const moved = p.seekTo(to, true)
    if (moved?.then) moved.then((ok) => ok && passed())
    else passed()
    setTime((x) => ({ ...x, current: to }))
  }, [])
  const hop = useCallback((by) => skipTo(null, by), [skipTo])

  // Another device's listening history arrived (see sync.js).
  useEffect(() => {
    const onSynced = (e) => e.detail.includes('radio:heard') && setHeard(readHeard())
    window.addEventListener('radio:synced', onSynced)
    return () => window.removeEventListener('radio:synced', onSynced)
  }, [])

  const resetHeard = useCallback((videoId) => setHeard(clearHeard(videoId)), [])

  const setVolume = useCallback((v) => {
    volumeRef.current = v
    setVolumeState(v)
    localStorage.setItem('radio:volume', String(v))
    const p = playerRef.current
    if (readyRef.current) {
      p.setVolume(v)
      if (v > 0) p.unMute()
    }
    mixRef.current?.setVolume(v)
  }, [])

  return { status, time, volume, heard, recording, resetHeard, load, toggle, pause, seek, skipTo, hop, goLive, setVolume }
}
