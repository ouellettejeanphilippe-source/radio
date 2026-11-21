import { useCallback, useEffect, useRef, useState } from 'react'
import { addHeard, clearHeard, pickStart, readHeard } from './heard.js'

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

export function useYouTubePlayer(hostRef) {
  const playerRef = useRef(null)
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
            e.target.setVolume(volumeRef.current)
            if (pendingRef.current) e.target.loadVideoById(pendingRef.current)
            pendingRef.current = null
          },
          onStateChange: (e) => {
            const S = YT.PlayerState
            if (e.data === S.PLAYING) {
              if (needsStartRef.current) {
                needsStartRef.current = false
                const d = e.target.getDuration()
                if (d > 120) {
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
            }
            else if (e.data === S.BUFFERING) setStatus('buffering')
            else if (e.data === S.ENDED) {
              lastRef.current = null
              e.target.seekTo(0, true)
              e.target.playVideo()
            }
          },
          onError: () => setStatus('error'),
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
    }
  }, [hostRef])

  useEffect(() => {
    if (status !== 'playing') {
      lastRef.current = null
      return
    }
    const t = setInterval(() => {
      const p = playerRef.current
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

  const load = useCallback((videoId) => {
    videoIdRef.current = videoId
    needsStartRef.current = true
    lastRef.current = null
    userPausedRef.current = false
    setStatus('buffering')
    setTime({ current: 0, duration: 0 })
    if (readyRef.current) playerRef.current.loadVideoById(videoId)
    else pendingRef.current = videoId
  }, [])

  const toggle = useCallback(() => {
    const p = playerRef.current
    if (!readyRef.current) return
    const playing = p.getPlayerState() === window.YT.PlayerState.PLAYING
    userPausedRef.current = playing
    if (playing) p.pauseVideo()
    else p.playVideo()
  }, [])

  const seek = useCallback((t) => {
    if (!readyRef.current) return
    lastRef.current = null
    playerRef.current.seekTo(t, true)
    setTime((x) => ({ ...x, current: t }))
  }, [])

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
  }, [])

  return { status, time, volume, heard, resetHeard, load, toggle, seek, setVolume }
}
