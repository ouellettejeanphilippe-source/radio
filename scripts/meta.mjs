// Builds src/meta.json: for each recording, its tracklist (timestamps and titles) and whether the
// rip has DJ talk and ads or music only, as its title and description say.
//
// Usage: node scripts/meta.mjs
//   reads the public YouTube watch pages. YouTube turns away data centres and busy addresses;
//   from a home connection it goes through. Only the description is read this way.
//
// Usage: YT_API_KEY=<key> node scripts/meta.mjs
//   asks YouTube's official Data API instead (a free key from the Google Cloud console, with
//   « YouTube Data API v3 » enabled). It reads the descriptions too, and, where a description
//   has no list, the comments under the video: uploaders mostly leave the timestamps there. One
//   run over every station costs about 300 of the 10 000 units a key gets per day.
//   (Where the key is kept by a proxy that adds it to the requests, as in a Claude cloud session
//   with a network secret for youtube.googleapis.com: any value for YT_API_KEY, and
//   NODE_USE_ENV_PROXY=1 so that Node goes through that proxy.)
//
// A list can also be pasted by hand into scripts/tracklists/<videoId>.txt (one
// "12:34 Artist - Title" per line, same formats as below): it wins over everything else, and
// needs no network.
//
// Usage: node scripts/meta.mjs --pasted
//   only takes in the pasted lists, without asking YouTube anything.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STATIONS } from '../src/stations.js'
import { parseYouTubeId } from '../src/youtube.js'

const OUT = new URL('../src/meta.json', import.meta.url)
const LISTS = new URL('./tracklists/', import.meta.url)

const toSec = (t) => t.split(':').reduce((acc, n) => acc * 60 + Number(n), 0)

// Lines like "12:34 Artist - Title", "1:02:03 - Artist – Title", "(0:00) Title", "Title 12:34" or,
// numbered, "01. 0:00:08 Artist — Title".
function parseTracks(desc) {
  const tracks = []
  for (const raw of desc.split('\n')) {
    const line = raw.trim()
    const TS = '(?:\\d{1,2}:)?\\d{1,2}:\\d{2}'
    let m = line.match(new RegExp(`^(?:\\d{1,3}[.)]\\s+)?[[(]?(${TS})(?:\\s*[-–—]\\s*${TS})?[\\])]?\\s*[-–—:|.]?\\s*(.+)$`))
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

// --- The official API ------------------------------------------------------------------------

const KEY = process.env.YT_API_KEY
async function api(path, params) {
  // The key goes in a header rather than in the address, so it stays out of logs.
  const res = await fetch(`https://youtube.googleapis.com/youtube/v3/${path}?${new URLSearchParams(params)}`, { headers: { 'X-goog-api-key': KEY } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${body.error?.message ?? ''}`.trim()), { reason: body.error?.errors?.[0]?.reason })
  return body
}

// Titles and descriptions, fifty videos to a request.
async function fetchByApi(ids) {
  const found = {}
  for (let i = 0; i < ids.length; i += 50) {
    const { items = [] } = await api('videos', { part: 'snippet,contentDetails', id: ids.slice(i, i + 50).join(','), maxResults: 50 })
    for (const v of items) {
      // "PT3H51M18S": the length, which tells a whole list from one that stops early.
      const [, h = 0, m = 0, sec = 0] = (v.contentDetails?.duration ?? '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/) ?? []
      found[v.id] = { title: v.snippet?.title ?? '', desc: v.snippet?.description ?? '', channel: v.snippet?.channelId ?? '', length: h * 3600 + m * 60 + Number(sec) }
    }
  }
  return found
}

// A comment that only says "2:31 best part" isn't a tracklist: a list has at least this many lines.
const LIST_MIN = 6

// Lines with timestamps aren't always a list of songs: listeners also post their favourite
// moments, jokes told by the minute, or bare bookmarks. What counts as a list:
// - its lines say something (not numbers or dates alone, not "Track 7");
// - it goes a good way into the recording, when the length is known;
// - and, when it isn't the uploader's own, most lines read as "artist - title" or "title by
//   artist": a stranger's sentences by the minute are not taken for songs.
const NAMED = /\S\s*[-–—]\s*\S|\sby\s/i
const EMPTY = /^(track\s*\d+|[\d\s:.,/-]*|\w{3,9}\.? \d{1,2},? \d{4}.*)$/i
function isList(tracks, { own = false, length = 0 } = {}) {
  if (tracks.length < (own ? 3 : LIST_MIN)) return false
  if (tracks.filter(([, title]) => EMPTY.test(title)).length > tracks.length * 0.3) return false
  if (length > 0 && tracks[tracks.length - 1][0] < length * 0.4) return false
  return own || tracks.filter(([, title]) => NAMED.test(title)).length >= tracks.length * 0.4
}

// The comment under a video that is its tracklist, among the hundred YouTube finds most
// relevant: the uploader's own if there is one, otherwise the longest; '' when there is none, or
// when comments are closed.
async function fetchListComment(id, { channel, length }) {
  let items
  try {
    ;({ items = [] } = await api('commentThreads', { part: 'snippet', videoId: id, order: 'relevance', maxResults: 100, textFormat: 'plainText' }))
  } catch (e) {
    if (e.reason === 'commentsDisabled' || e.reason === 'videoNotFound') return ''
    throw e
  }
  let best = ''
  let most = 0
  for (const thread of items) {
    const comment = thread.snippet?.topLevelComment?.snippet ?? {}
    const text = comment.textOriginal ?? comment.textDisplay ?? ''
    const own = Boolean(channel) && comment.authorChannelId?.value === channel
    const tracks = parseTracks(text)
    if (!isList(tracks, { own, length })) continue
    // (The uploader's word counts for more than any stranger's.)
    const weight = tracks.length + (own ? 1000 : 0)
    if (weight > most) [best, most] = [text, weight]
  }
  return best
}

// What was read is cached outside the repo, so a second run only asks for what is new.
const CACHE = join(tmpdir(), 'radio-yt-details.json')
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
const save = () => writeFileSync(CACHE, JSON.stringify(cache))
const djs = Object.fromEntries(STATIONS.map((st) => [parseYouTubeId(st.youtube), st.dj]))
const ids = Object.keys(djs).filter((id) => id !== 'null')
if (process.argv.includes('--pasted')) {
  // Nothing is asked of YouTube: what the last run found stays, and the pasted lists go in.
} else if (KEY) {
  try {
    Object.assign(cache, await fetchByApi(ids.filter((id) => !cache[id])))
    save()
    // Comments, for the videos whose description has no list (and no pasted one either).
    for (const id of ids) {
      const entry = cache[id]
      if (!entry || entry.comment != null || isList(parseTracks(entry.desc), { own: true, length: entry.length }) || existsSync(new URL(`${id}.txt`, LISTS))) continue
      entry.comment = await fetchListComment(id, entry)
      save()
    }
  } catch (e) {
    console.log('YouTube API:', e.message, '— what was read so far is kept')
  }
} else {
  // Three failures in a row mean YouTube is turning this machine away for now: no point insisting.
  let failures = 0
  for (const id of ids.filter((id) => !cache[id])) {
    try {
      cache[id] = await fetchDetails(id)
      save()
      failures = 0
    } catch (e) {
      console.log(id, 'ERROR', e.message)
      if (e.message.includes('429') || ++failures >= 3) break
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
}

// What an earlier run found, unless it wouldn't be taken for a list today.
const kept = (tracks = [], length) => (isList(tracks, { own: true, length }) ? tracks : [])

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
  const { title, desc, comment = '' } = cache[id]
  // A pasted list first, then the uploader's own, then a listener's.
  // (The description is the uploader's own; a comment was weighed when it was picked.)
  const described = pasted.length ? [] : parseTracks(desc).filter((_, i, all) => isList(all, { own: true, length: cache[id].length }))
  const commented = pasted.length || described.length ? [] : parseTracks(comment)
  // A list found by an earlier run isn't lost because this one finds none (a description edited
  // since, a comment that slid out of the hundred).
  const tracks = pasted.length ? pasted : described.length ? described : commented.length ? commented : kept(previous[id]?.tracks, cache[id].length)
  const talk = detectTalk(`${title}\n${desc}`, djs[id])
  if (talk || tracks.length) meta[id] = { ...(talk && { talk }), ...(tracks.length && { tracks }) }
  const from = pasted.length ? '(pasted list)' : tracks === commented && tracks.length ? '(from a comment)' : ''
  console.log(id, String(tracks.length).padStart(3), talk ?? '-', from, title.slice(0, 70))
}
const missing = ids.filter((id) => !cache[id]).length
if (missing) console.log(`${missing} videos not fetched this time: their previous data is kept; run again later`)
if (!KEY && !process.argv.includes('--pasted')) console.log('Only descriptions were read. With YT_API_KEY set, the comments are searched for lists too (see the top of this file).')
writeFileSync(OUT, JSON.stringify(meta) + '\n')
console.log(`${Object.keys(meta).length}/${ids.length} with data, ${Object.values(meta).filter((x) => x.tracks).length} tracklists`)
