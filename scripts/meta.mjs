// Builds src/meta.json from the public YouTube watch pages: the tracklist (timestamps in the
// description) and whether the title/description says the rip has DJ talk and ads or music only.
// Usage: node scripts/meta.mjs
//
// Many uploaders leave the timestamps out of the description; they are often in a comment under
// the video instead. Paste such a list as it is into scripts/tracklists/<videoId>.txt (one
// "12:34 Artist - Title" per line, same formats as below) and run the script again: it wins over
// the description, and needs no network.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STATIONS } from '../src/stations.js'
import { parseYouTubeId } from '../src/youtube.js'

const OUT = new URL('../src/meta.json', import.meta.url)
const LISTS = new URL('./tracklists/', import.meta.url)

const toSec = (t) => t.split(':').reduce((acc, n) => acc * 60 + Number(n), 0)

// Lines like "12:34 Artist - Title", "1:02:03 - Artist – Title", "(0:00) Title" or "Title 12:34".
function parseTracks(desc) {
  const tracks = []
  for (const raw of desc.split('\n')) {
    const line = raw.trim()
    const TS = '(?:\\d{1,2}:)?\\d{1,2}:\\d{2}'
    let m = line.match(new RegExp(`^[[(]?(${TS})(?:\\s*[-–—]\\s*${TS})?[\\])]?\\s*[-–—:|.]?\\s*(.+)$`))
    let t, title
    if (m) [, t, title] = m
    else if ((m = line.match(new RegExp(`^(?:\\d+[.)]\\s*)?(.+?)\\s*[-–—|]?\\s*[[(]?(${TS})[\\])]?$`)))) [, title, t] = m
    else continue
    title = title
      .replace(/^\d+[.)]\s+/, '')
      .replace(/^[\s•·*>/|\-–—]+/, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (title.endsWith(')') && !title.includes('(')) title = title.slice(0, -1).trim()
    if (/^".*"$/.test(title)) title = title.slice(1, -1)
    if (!title || title.length > 120) continue
    tracks.push([toSec(t), title])
  }
  tracks.sort((a, b) => a[0] - b[0])
  // Timestamps must start near 0 and keep going up, or it isn't a tracklist.
  if (tracks.length < 3 || tracks[0][0] > 600) return []
  return tracks.filter((tr, i) => i === 0 || tr[0] > tracks[i - 1][0])
}

const MUSIC_ONLY = /\b(no|without|w\/o|minus)\s+(the\s+)?(dj|djs|host|talk|talking|commercials?|ads?|adverts?|chatter|dialogue)\b|\b(music|songs?)\s+only\b|\bonly\s+(music|songs)\b|\bno\s+talk\b/i
const WITH_ADS = /\b(with|w\/|incl\.?|including|\+)\s*(the\s+)?(dj|djs|commercials?|ads?|adverts?|news\w*)\b|\b(dj|djs)\s*(&|and|\+|,)\s*(commercials?|ads?|adverts?)\b|\b(commercials?|adverts?)\b|\bfull\s+(uncut\s+)?(radio|station|broadcast)\b|\bcomplete\s+(radio|station)\b|\bradio\s+complet[oa]\b/i

// 'music' when the uploader says there is no talk, 'full' when they mention DJ + ads,
// 'dj' when the station's DJ is named in the title or description.
function detectTalk(text, dj) {
  if (MUSIC_ONLY.test(text)) return 'music'
  if (WITH_ADS.test(text)) return 'full'
  if (dj && text.toLowerCase().includes(dj.toLowerCase())) return 'dj'
}

async function fetchDetails(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: { 'Accept-Language': 'en-US,en;q=0.9', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', Cookie: 'CONSENT=YES+1' },
  })
  const html = await res.text()
  const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:var|<\/script>)/s)
  if (!m) throw new Error(`no player response (${res.status})`)
  const d = JSON.parse(m[1]).videoDetails ?? {}
  return { title: d.title ?? '', desc: d.shortDescription ?? '' }
}

// Raw pages are cached outside the repo so re-runs only fetch new videos (YouTube rate-limits).
const CACHE = join(tmpdir(), 'radio-yt-details.json')
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
const djs = Object.fromEntries(STATIONS.map((st) => [parseYouTubeId(st.youtube), st.dj]))
const ids = Object.keys(djs).filter((id) => id !== 'null')
// Three failures in a row mean YouTube is turning this machine away for now: no point insisting.
let failures = 0
for (const id of ids.filter((id) => !cache[id])) {
  try {
    cache[id] = await fetchDetails(id)
    writeFileSync(CACHE, JSON.stringify(cache))
    failures = 0
  } catch (e) {
    console.log(id, 'ERROR', e.message)
    if (e.message.includes('429') || ++failures >= 3) break
  }
  await new Promise((r) => setTimeout(r, 1500))
}

// A video that couldn't be fetched this time keeps what the last run found, so a run without
// network (or one YouTube turns away) never empties the file.
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
const meta = {}
for (const id of ids) {
  const list = new URL(`${id}.txt`, LISTS)
  const pasted = existsSync(list) ? parseTracks(readFileSync(list, 'utf8')) : []
  if (!cache[id]) {
    const kept = { ...previous[id], ...(pasted.length && { tracks: pasted }) }
    if (kept.talk || kept.tracks) meta[id] = kept
    continue
  }
  const { title, desc } = cache[id]
  const tracks = pasted.length ? pasted : parseTracks(desc)
  const talk = detectTalk(`${title}\n${desc}`, djs[id])
  if (talk || tracks.length) meta[id] = { ...(talk && { talk }), ...(tracks.length && { tracks }) }
  console.log(id, String(tracks.length).padStart(3), talk ?? '-', pasted.length ? '(pasted list)' : '', title.slice(0, 70))
}
const missing = ids.filter((id) => !cache[id]).length
if (missing) console.log(`${missing} videos not fetched this time: their previous data is kept; run again later`)
writeFileSync(OUT, JSON.stringify(meta) + '\n')
console.log(`${Object.keys(meta).length}/${ids.length} with data, ${Object.values(meta).filter((x) => x.tracks).length} tracklists`)
