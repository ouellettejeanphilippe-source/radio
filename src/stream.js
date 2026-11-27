import { useCallback, useEffect, useRef, useState } from 'react'

// A real station's own stream, live: one <audio> for the whole visit. There is nothing to rewind
// and nothing to keep. A pause lets go of the stream, and playing again rejoins the broadcast
// where it is now, not where it was left.

// No sound after this long: the stream isn't coming (a station off the air, or one that only
// plays in its own country).
const SLOW = 15_000

export function useStream(volume) {
  const audio = useRef(null)
  const url = useRef(null)
  // Whether sound is wanted right now: what comes back from the element is ignored otherwise.
  const wanted = useRef(false)
  // Whether the stream asked for has given sound yet.
  const heard = useRef(false)
  const timer = useRef(null)
  // idle | buffering | playing | paused | error
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    const a = new Audio()
    a.preload = 'none'
    audio.current = a
    const sounding = () => {
      if (!wanted.current) return
      heard.current = true
      clearTimeout(timer.current)
      setStatus('playing')
    }
    const starving = () => wanted.current && setStatus('buffering')
    // The stream broke off, or never came.
    const lost = () => {
      if (!wanted.current) return
      wanted.current = false
      clearTimeout(timer.current)
      setStatus('error')
    }
    // Stopped from outside (a call, another app taking the sound): it shows as paused.
    const hushed = () => {
      if (!wanted.current) return
      wanted.current = false
      clearTimeout(timer.current)
      setStatus('paused')
    }
    a.addEventListener('playing', sounding)
    a.addEventListener('waiting', starving)
    a.addEventListener('error', lost)
    a.addEventListener('ended', lost)
    a.addEventListener('pause', hushed)
    return () => {
      wanted.current = false
      clearTimeout(timer.current)
      a.pause()
      a.removeAttribute('src')
      a.load()
    }
  }, [])

  useEffect(() => {
    if (audio.current) audio.current.volume = Math.min(1, Math.max(0, volume / 100))
  }, [volume])

  const start = useCallback(() => {
    const a = audio.current
    if (!a || !url.current) return
    wanted.current = true
    heard.current = false
    setStatus('buffering')
    a.src = url.current
    a.play().catch((e) => {
      // (A play() cut short by the next station isn't a failure.)
      if (!wanted.current || e.name === 'AbortError') return
      wanted.current = false
      setStatus('error')
    })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (!wanted.current || heard.current) return
      wanted.current = false
      a.pause()
      setStatus('error')
    }, SLOW)
  }, [])

  // Lets go of the stream; `as` is how it then shows.
  const release = useCallback((as) => {
    const a = audio.current
    wanted.current = false
    clearTimeout(timer.current)
    if (a) {
      a.pause()
      a.removeAttribute('src')
      a.load()
    }
    setStatus(as)
  }, [])

  const play = useCallback(
    (address) => {
      url.current = address
      start()
    },
    [start],
  )
  // Quiet, whatever it was doing. The address is kept: toggle() plays it again.
  const stop = useCallback(() => release(url.current ? 'paused' : 'idle'), [release])
  const toggle = useCallback(() => (wanted.current ? release('paused') : start()), [release, start])

  return { status, play, stop, toggle }
}
