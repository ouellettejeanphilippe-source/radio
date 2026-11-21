import { useEffect, useState } from 'react'
import { mergeHeard } from './heard.js'

// Keeps favourites, recents, mode, current station and listening history the same on every device,
// through a secret gist on the user's GitHub account (no server of our own).
// Scrobbling logins and per-device things (volume, car mode) stay on each device.

const SYNC_KEY = 'radio:sync' // { token, gistId, user, last }
const STAMPS_KEY = 'radio:sync-stamps' // { [key]: time of the last local change }
const KEYS = ['radio:current', 'radio:mode', 'radio:favs', 'radio:recent', 'radio:heard']
const HEARD = 'radio:heard'
const FILE = 'radio-sync.json'
const API = 'https://api.github.com/'
const PUSH_DELAY = 20_000
const PULL_EVERY = 5 * 60_000

export const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Radio%20(synchro)'

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}
const writeRaw = (key, value) => {
  try {
    setItem.call(localStorage, key, value)
  } catch {
    // Storage full or blocked.
  }
}

export const readSync = () => readJson(SYNC_KEY, null)
function saveSync(s) {
  if (s) writeRaw(SYNC_KEY, JSON.stringify(s))
  else localStorage.removeItem(SYNC_KEY)
  window.dispatchEvent(new Event('radio:sync'))
}

export function useSync() {
  const [sync, setSync] = useState(readSync)
  const [state, setState] = useState(status)
  useEffect(() => {
    const refresh = () => {
      setSync(readSync())
      setState(status)
    }
    window.addEventListener('radio:sync', refresh)
    return () => window.removeEventListener('radio:sync', refresh)
  }, [])
  return { sync, ...state }
}

// --- Watching local changes ------------------------------------------------------------------

// Every write to a synced key goes through localStorage.setItem; stamping it there means the rest
// of the app doesn't need to know about syncing. Ignored: writes that don't change anything (so applying
// a remote value doesn't bounce back) and first writes of a default value on a fresh device (so they
// don't override the other devices).
const setItem = Storage.prototype.setItem
Storage.prototype.setItem = function (key, value) {
  const old = this === localStorage && KEYS.includes(key) ? this.getItem(key) : null
  const watched = old != null && old !== value
  setItem.call(this, key, value)
  if (watched) {
    writeRaw(STAMPS_KEY, JSON.stringify({ ...readJson(STAMPS_KEY, {}), [key]: Date.now() }))
    schedulePush()
  }
}

let pushTimer = null
function schedulePush() {
  if (!readSync() || pushTimer) return
  pushTimer = setTimeout(() => {
    pushTimer = null
    syncNow()
  }, PUSH_DELAY)
}

// --- GitHub ----------------------------------------------------------------------------------

async function gh(path, token, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      ...(init.body && { 'Content-Type': 'application/json' }),
    },
  })
  if (res.status === 401) throw Object.assign(new Error('Jeton GitHub refusé (expiré ou supprimé ?).'), { auth: true })
  if (res.status === 404) throw Object.assign(new Error('Gist de synchro introuvable.'), { missing: true })
  if (!res.ok) throw new Error(`GitHub : erreur ${res.status}`)
  return res.json()
}

function localSnapshot() {
  const data = {}
  for (const key of KEYS) {
    const raw = localStorage.getItem(key)
    if (raw != null) data[key] = JSON.parse(raw)
  }
  return { v: 1, stamps: readJson(STAMPS_KEY, {}), data }
}

async function readGist(sync) {
  const gist = await gh(`gists/${sync.gistId}`, sync.token)
  const file = gist.files?.[FILE]
  if (!file) return null
  const text = file.truncated ? await (await fetch(file.raw_url)).text() : file.content
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const writeGist = (sync, snapshot) =>
  gh(`gists/${sync.gistId}`, sync.token, {
    method: 'PATCH',
    keepalive: JSON.stringify(snapshot).length < 60_000,
    body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(snapshot) } } }),
  })

// Applies the remote copy where it's newer; listening history is combined. Returns the changed keys.
function applyRemote(remote) {
  const stamps = readJson(STAMPS_KEY, {})
  const changed = []
  for (const key of KEYS) {
    if (!(key in (remote.data ?? {}))) continue
    const remoteStamp = remote.stamps?.[key] ?? 0
    let value
    if (key === HEARD) value = mergeHeard(readJson(HEARD, {}), remote.data[key])
    else if (remoteStamp > (stamps[key] ?? 0)) value = remote.data[key]
    else continue
    const raw = JSON.stringify(value)
    if (raw !== localStorage.getItem(key)) {
      writeRaw(key, raw)
      changed.push(key)
    }
    stamps[key] = Math.max(stamps[key] ?? 0, remoteStamp)
  }
  writeRaw(STAMPS_KEY, JSON.stringify(stamps))
  return changed
}

let status = { busy: false, error: null }
const setStatus = (s) => {
  status = { ...status, ...s }
  window.dispatchEvent(new Event('radio:sync'))
}

let running = null
// Pulls, merges, and pushes back if this device has anything the gist doesn't.
export function syncNow() {
  const sync = readSync()
  if (!sync) return Promise.resolve()
  if (running) return running
  running = (async () => {
    setStatus({ busy: true })
    try {
      const remote = (await readGist(sync)) ?? { data: {}, stamps: {} }
      const changed = applyRemote(remote)
      if (changed.length) window.dispatchEvent(new CustomEvent('radio:synced', { detail: changed }))
      const local = localSnapshot()
      if (JSON.stringify(local.data) !== JSON.stringify(remote.data ?? {})) await writeGist(sync, local)
      saveSync({ ...sync, last: Date.now() })
      setStatus({ error: null })
    } catch (e) {
      setStatus({ error: e instanceof TypeError ? 'Pas de connexion à GitHub.' : e.message })
    } finally {
      setStatus({ busy: false })
      running = null
    }
  })()
  return running
}

// --- Setup -----------------------------------------------------------------------------------

// First device: checks the token and finds (or creates) the gist. Other devices reuse it.
export async function enableSync(token) {
  const t = token.trim()
  const user = await gh('user', t)
  let gistId = null
  for (let page = 1; page <= 10 && !gistId; page++) {
    const list = await gh(`gists?per_page=100&page=${page}`, t)
    gistId = list.find((g) => g.files?.[FILE])?.id
    if (list.length < 100) break
  }
  if (!gistId) {
    const gist = await gh('gists', t, {
      method: 'POST',
      body: JSON.stringify({ description: 'Radio : synchro entre appareils', public: false, files: { [FILE]: { content: JSON.stringify(localSnapshot()) } } }),
    })
    gistId = gist.id
  }
  saveSync({ token: t, gistId, user: user.login })
  await syncNow()
}

export function disableSync() {
  saveSync(null)
  setStatus({ error: null })
}

// Link that sets up another device in one tap. It carries the token: only for the owner's devices.
export function deviceLink() {
  const s = readSync()
  if (!s) return null
  const code = btoa(JSON.stringify({ t: s.token, g: s.gistId, u: s.user }))
  return `${location.origin}${location.pathname}#sync=${code}`
}

// Opened from a device link: store it, clean the address bar, sync. Returns true if it was one.
async function takeLinkFromUrl() {
  const m = location.hash.match(/#sync=([^&]+)/)
  if (!m) return false
  history.replaceState(null, '', location.pathname + location.search)
  try {
    const { t, g, u } = JSON.parse(atob(decodeURIComponent(m[1])))
    if (!t || !g) return false
    saveSync({ token: t, gistId: g, user: u })
    return true
  } catch {
    return false
  }
}

// Started once by the app. Resolves to true when the page was opened from a device link.
let started = null
export function startSync() {
  started ??= start()
  return started
}
async function start() {
  const fromLink = await takeLinkFromUrl()
  syncNow()
  document.addEventListener('visibilitychange', () => {
    if (!readSync()) return
    // Leaving: send what's pending. Coming back: catch up with the other devices.
    if (document.visibilityState === 'hidden') {
      clearTimeout(pushTimer)
      pushTimer = null
    }
    syncNow()
  })
  setInterval(() => document.visibilityState === 'visible' && syncNow(), PULL_EVERY)
  return fromLink
}
