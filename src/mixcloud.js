// Mixcloud's player, for the shows that live there (Big Cuppa Radio). It is Mixcloud's own
// widget, in its frame, driven through the small API Mixcloud gives for it; here it is dressed as
// YouTube's player, with the same orders and the same reports, so that the rest of the app (the
// start where listening left off, the skips, the live clock: see youtube.js) treats a show like
// any other recording.
// Mixcloud asks that its widget stay visible on the page, so unlike YouTube's it isn't tucked
// away: the app shows it along the bottom of the home screen while a show is on (see .mix-host).
let api
function loadApi() {
  api ||= new Promise((resolve, reject) => {
    if (window.Mixcloud?.PlayerWidget) return resolve(window.Mixcloud)
    const s = document.createElement('script')
    s.src = 'https://widget.mixcloud.com/media/js/widgetApi.js'
    s.onload = () => resolve(window.Mixcloud)
    s.onerror = () => {
      // Offline, or blocked: the next show tries again.
      api = null
      reject(new Error('Mixcloud'))
    }
    document.head.appendChild(s)
  })
  return api
}

// YouTube's numbers for what a player is doing.
const ENDED = 0
const PLAYING = 1
const PAUSED = 2
const BUFFERING = 3

// The widget answers by message, and a show that won't load never answers: nothing waits on it
// for ever.
const within = (ms, promise) => Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))])
// How long a show gets to start before it is called a failure.
const SLOW = 20_000

export class MixPlayer {
  // `report` and `fail` are YouTube's onStateChange and onError.
  constructor(host, key, length, { volume, report, fail }) {
    Object.assign(this, { key, volume, report, fail, t: 0, d: length || 0, state: -1, wanted: true, over: false, begun: false })
    loadApi()
      .then((Mixcloud) => {
        // The frame is made once the API is there and handed to it at once, as Mixcloud shows:
        // the widget then introduces itself once, when it has loaded.
        const frame = document.createElement('iframe')
        frame.title = 'Lecteur Mixcloud'
        frame.allow = 'autoplay; encrypted-media'
        this.first = this.key
        frame.src = `https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&mini=1&feed=${encodeURIComponent(this.first)}`
        host.replaceChildren(frame)
        this.frame = frame
        return Mixcloud.PlayerWidget(frame).ready
      })
      .then(
        (widget) => this.wire(widget),
        () => this.fail(),
      )
    this.expect()
  }

  wire(w) {
    this.w = w
    w.setVolume?.(this.volume / 100)
    this.listen()
    // Another show was asked for while the widget was getting ready, or the first one still is.
    if (this.key !== this.first) w.load(this.key, this.wanted)
    else if (this.wanted) w.play()
    this.poll = setInterval(() => {
      // Should the widget introduce itself again, its API hands out new events and drops the
      // ears on the old ones.
      if (w.events.play !== this.ears) this.listen()
      // Its own reports can stall while the page is out of sight, or get lost; the question
      // still gets through, and where the show is says whether it plays.
      if (this.wanted && this.state !== PAUSED && this.state !== ENDED) within(1500, w.getPosition()).then((p) => typeof p === 'number' && this.note(p))
    }, 1000)
  }

  listen() {
    const { events } = this.w
    this.ears = events.play
    events.buffering.on(() => this.state !== PAUSED && this.set(BUFFERING))
    events.play.on(() => this.started())
    // The widget says "paused" as it arrives and while it changes show, before anything has
    // played: only a show that has begun can be paused by it (by its own key, say).
    events.pause.on(() => this.begun && this.set(PAUSED))
    events.ended.on(() => {
      this.over = true
      this.set(ENDED)
    })
    events.error.on(() => this.fail())
    events.progress.on((position, duration) => this.note(position, duration))
  }

  // A show that hasn't begun after a while isn't coming.
  expect() {
    clearTimeout(this.late)
    this.late = setTimeout(() => this.wanted && this.state !== PLAYING && this.state !== PAUSED && this.fail(), SLOW)
  }

  set(state) {
    this.state = state
    this.report({ data: state, target: this })
  }

  // Playing: said once the length is known, which the app asks for at that moment.
  started() {
    if (this.starting) return
    this.starting = true
    within(2000, this.w.getDuration()).then((d) => {
      this.starting = false
      if (d > 0) this.d = d
      this.over = false
      // (Stopped meanwhile: the widget's own report of that came first, and stands.)
      if (!this.wanted) return
      this.begun = true
      this.set(PLAYING)
    })
  }

  note(position, duration) {
    const moved = position > this.t
    this.t = position
    if (duration > 0) this.d = duration
    // Sound going by without a word that it started (after a wait for the network, say).
    if (moved && (this.state === -1 || this.state === BUFFERING)) this.started()
  }

  // --- The orders, as YouTube's player takes them ---

  loadVideoById(key, length) {
    Object.assign(this, { key, t: 0, d: length || 0, state: -1, wanted: true, over: false, begun: false })
    this.expect()
    this.w?.load(key, true)
  }
  playVideo() {
    this.wanted = true
    if (!this.w) return this.expect()
    // Over: from the top.
    if (this.over) this.w.load(this.key, true)
    else this.w.play()
  }
  pauseVideo() {
    this.wanted = false
    this.w?.pause()
    // A show that hasn't begun has nothing to report: the stop is said here.
    if (!this.begun) this.set(PAUSED)
  }
  // Resolves to whether the show moved: Mixcloud doesn't allow it on every show, for every listener.
  seekTo(t) {
    if (!this.w || this.over) return Promise.resolve(false)
    return within(6000, this.w.seek(t)).then((ok) => {
      if (ok === true) this.t = t
      return ok === true
    })
  }
  setVolume(v) {
    this.volume = v
    this.w?.setVolume?.(v / 100)
  }
  unMute() {}
  getCurrentTime() {
    return this.t
  }
  getDuration() {
    return this.d
  }
  getPlayerState() {
    return this.state
  }
  getIframe() {
    return this.frame
  }
  destroy() {
    clearInterval(this.poll)
    clearTimeout(this.late)
    this.frame?.remove()
  }
}
