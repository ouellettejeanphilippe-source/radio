// Is there a newer build on the server than the one running? An installed app that stays open keeps
// its old code, and the host lets the page be cached for ten minutes: without this, a version just
// published can take a while to reach a phone, with nothing to say which one it is running.

// The bundle this code runs from, e.g. index-DTJPOjHz.js (its name changes with every build).
const RUNNING = new URL(import.meta.url).pathname.split('/').pop()

// When this build was made, for the settings panel.
export const BUILT = import.meta.env.VITE_BUILD ? new Date(import.meta.env.VITE_BUILD) : null

export async function newerBuild() {
  if (!import.meta.env.PROD) return false
  try {
    // Straight from the network: an address never asked before gets past the host's ten-minute
    // cache, and the service worker lets ?fresh requests through.
    const page = await (await fetch(`./?fresh=${Date.now()}`, { cache: 'no-store' })).text()
    const served = page.match(/assets\/(index-[\w-]+\.js)/)?.[1]
    return Boolean(served) && served !== RUNNING && served
  } catch {
    return false
  }
}

// Reloads for a newer build, once per build: if the reload still brings the old page (a cache in
// between), the app doesn't go round in circles.
export function reloadFor(build) {
  try {
    if (sessionStorage.getItem('radio:reloaded-for') === build) return false
    sessionStorage.setItem('radio:reloaded-for', build)
  } catch {
    return false
  }
  window.location.reload()
  return true
}
