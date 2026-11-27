// Builds src/shows.json: the episodes of the radio shows that are stations (see BIG_CUPPA and
// its neighbours in src/stations.js). A show is a station made of its episodes, as a game's
// station is made of its songs; they play in Mixcloud's player, each by its key there.
//
//   node scripts/shows.mjs
//
// It reads Mixcloud's public API (no key). Run it again to take in new episodes, or when
// uploads have gone: most of these are archives kept by listeners, and they come and go.
import { writeFileSync } from 'node:fs'

const OUT = new URL('../src/shows.json', import.meta.url)
// The most recent ones are plenty: at two hours a show, 120 of them is ten days of radio.
const MOST = 120

const MONTHS = { jan: 'Janvier', feb: 'Février', march: 'Mars', april: 'Avril', may: 'Mai', june: 'Juin', july: 'Juillet', aug: 'Août', august: 'Août', sep: 'Septembre', september: 'Septembre', oct: 'Octobre', october: 'Octobre', nov: 'Novembre', dec: 'Décembre', december: 'Décembre' }
// "R o b b e r s" as some titles are typed.
const unspaced = (s) => s.replace(/\b(?:\p{L} ){2,}\p{L}\b/gu, (m) => m.replace(/ /g, ''))
const tidy = (s) =>
  unspaced(s)
    .replace(/\.mp3$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.])/g, '$1')
    .replace(/^[\s\-–:,.|]+|[\s\-–:,.|]+$/g, '')

// Each show: whose uploads (`from`), which of them (`match`, and not `skip`), and what to call
// an episode on screen (`label`, from its title).
const SHOWS = {
  'big-cuppa-radio': {
    from: ['bigcupparadio'],
    match: /./,
    label: (name) => {
      const m = name.match(/Show #(\d+)\s*-\s*Big Cuppa Radio - (\w+) (\d{4})(?: \((.*)\))?/)
      if (!m) return /world cuppa/i.test(name) ? 'World Cuppa Radio #1 · extrait' : tidy(name)
      const guest = m[4]?.replace('ft. ', 'avec ').replace('USA special', 'spéciale États-Unis')
      return `Show #${m[1]} · ${MONTHS[m[2].toLowerCase()] ?? m[2]} ${m[3]}${guest ? ` · ${guest}` : ''}`
    },
  },
  'do-you': {
    from: ['do_you_radio'],
    match: /Breakfast Show w\/ Charl/i,
    label: (name) => tidy(name.replace(/^The Do!! You!!! Breakfast Show w\/ Charl\w+ Bones/i, '').replace(/^\s*(and|&|with|w\/)\s+/i, 'avec ')),
  },
  'mark-lamarr': {
    from: ['godseternaljukebox'],
    match: /^God's Jukebox/i,
    label: (name) => tidy(name.replace(/^God's Jukebox/i, '')),
  },
  'theme-time': {
    from: ['OldGreyOwl'],
    match: /^Part .*Bob Dylan/i,
    label: (name) => {
      const theme = tidy(name.replace(/^Part\s+\S+\s+Bob Dylan\s+theme\s*(time|hour)?\s*radio\s*(hour)?/i, ''))
      return theme ? theme[0].toUpperCase() + theme.slice(1) : tidy(name)
    },
  },
  'kenny-everett': {
    from: ['david-myers4', 'BJleDJ'],
    match: /Kenny Everett/i,
    label: (name) => tidy(name.replace(/^(The )?Kenny Everett( Show| Breakfast Show)?/i, '').replace(/\bShow\b,?/i, '')),
  },
  'mark-and-lard': {
    from: ['midlandanorak'],
    match: /Mark\s*(&|and)\s*Lard/i,
    skip: /edited out/i,
    label: (name) => tidy(name.replace(/Mark\s*(&|and)\s*Lard/i, '').replace(/BBC Radio 1/i, '').replace(/\s-\s(?=-|$)/g, ' ')),
  },
  'joe-strummer': {
    from: ['gary-riley2'],
    match: /Strummer.*(London\s*Calling|World Service)/i,
    label: (name) => tidy(name.replace(/Joe Strummer/i, '').replace(/London\s*Calling/i, '').replace(/BBC World Service( Radio)?/i, '').replace(/Episode/i, 'Épisode')),
  },
  'wolfman-jack': {
    from: ['DJTOBY1979'],
    match: /Wolfman Jack/i,
    label: (name) => tidy(name.replace(/^(The )?Wolfman Jack( Show)?/i, '')),
  },
}

async function uploads(user) {
  const out = []
  let url = `https://api.mixcloud.com/${user}/cloudcasts/?limit=100`
  // (An account can hold thousands; the newest 2000 are looked through.)
  while (url && out.length < 2000) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${user}: ${res.status}`)
    const page = await res.json()
    out.push(...page.data)
    url = page.paging?.next
  }
  return out
}

// The picture's path at Mixcloud, without the size (see MC in src/stations.js).
const path = (pictures) => pictures?.extra_large?.replace(/^https:\/\/thumbnailer\.mixcloud\.com\/unsafe\/\d+x\d+\//, '') ?? ''

const shows = {}
for (const [id, show] of Object.entries(SHOWS)) {
  const all = (await Promise.all(show.from.map(uploads))).flat()
  // The picture of whoever puts the show up: the show's own, where the show does it itself.
  const profile = path((await (await fetch(`https://api.mixcloud.com/${show.from[0]}/`)).json()).pictures)
  const episodes = all
    .filter((c) => show.match.test(c.name) && !show.skip?.test(c.name) && c.audio_length > 600)
    .sort((a, b) => b.created_time.localeCompare(a.created_time))
    .slice(0, MOST)
    // In the order they were put up, which is the order they go by when live.
    .reverse()
    .map((c) => [c.key, c.audio_length, show.label(c.name), path(c.pictures)])
  shows[id] = { profile, episodes }
  const hours = Math.round(episodes.reduce((sum, e) => sum + e[1], 0) / 3600)
  console.log(`${id}: ${episodes.length} épisodes, ${hours} h (sur ${all.length} mises en ligne)`)
}
writeFileSync(OUT, JSON.stringify(shows) + '\n')
