// Radio-tuning static played while a station loads, like flicking the dial in the games.
let ctx
let noise

function setup() {
  ctx = new AudioContext()
  // Two seconds of white noise with random crackles, looped.
  const len = ctx.sampleRate * 2
  noise = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (Math.random() < 0.0015 ? 3 : 0.6)
}

// Starts the static at the player's volume (0-100) and returns a function that fades it out.
export function startStatic(volume) {
  if (!window.AudioContext || volume <= 0) return () => {}
  try {
    if (!ctx) setup()
    ctx.resume()
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.loop = true
    src.loopStart = Math.random()
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1600
    band.Q.value = 0.6
    const gain = ctx.createGain()
    const level = 0.22 * (volume / 100)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(level, ctx.currentTime + 0.05)
    // Fades out after 4 s even if the station hasn't started.
    gain.gain.setValueAtTime(level, ctx.currentTime + 4)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 4.6)
    src.connect(band).connect(gain).connect(ctx.destination)
    src.start(0, src.loopStart)
    src.stop(ctx.currentTime + 4.7)
    let stopped = false
    return () => {
      if (stopped) return
      stopped = true
      const now = ctx.currentTime
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.35)
      try {
        src.stop(now + 0.4)
      } catch {
        // Already stopped on its own.
      }
    }
  } catch {
    return () => {}
  }
}
