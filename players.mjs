// Genera data/players.json (jugadores de hockey) a partir de la API de estadísticas de la NHL (api.nhle.com) y de
// sus drafts (api-web.nhle.com). Se ejecuta a mano de vez en cuando (al empezar cada temporada y después del
// draft, para los rookies nuevos):
//   node players.mjs
// Formato: [[nombre, slug, activo], ...] ordenado por slug
//
// Entran:
// - Todos los que han jugado en la NHL (jugadores y porteros, desde 1917: las cartas vintage también se venden)
// - Los elegidos en los últimos DRAFT_YEARS drafts (aún sin jugar en la NHL: cartas de draft y de la CHL)
// activo: ha jugado esta temporada o la anterior, o es de uno de los últimos drafts

import { writeFile } from 'node:fs/promises'
import { slugify } from './cardParser.js'

const STATS_URL = 'https://api.nhle.com/stats/rest/en'
const DRAFT_URL = 'https://api-web.nhle.com/v1/draft/picks'
const DRAFT_YEARS = 3

// Temporada actual: la NHL empieza en octubre (2026-27 -> 20262027)
const now = new Date()
const seasonStart = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
const seasonId = (start) => `${start}${start + 1}`
const lastDraft = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1

const getJson = async (url) => {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url)
    if(res.ok) return res.json()
    if(attempt >= 4) throw new Error(`${res.status} ${url}`)
    await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
  }
}

// Todas las filas de un informe de estadísticas en una sola petición (limit=-1: paginando, la API corta con 429)
const getReport = async (report, expression, aggregate) => {
  const params = new URLSearchParams({ isAggregate: String(aggregate), isGame: 'false', limit: '-1', cayenneExp: expression })
  const data = await getJson(`${STATS_URL}/${report}/summary?${params}`)
  const rows = data.data || []
  if(rows.length < (data.total || 0)) throw new Error(`${report}: ${rows.length} de ${data.total} filas`)
  return rows
}

const main = async () => {
  // slug -> { name, active, games }: con el mismo nombre (dos Sebastian Aho) se queda el que está en activo y
  // después el de más partidos (el más conocido, el de las cartas)
  const bySlug = new Map()
  const add = (name, active, games) => {
    const clean = String(name || '').replace(/\s+/g, ' ').trim()
    const slug = slugify(clean)
    if(!slug) return
    const rank = active * 1e6 + games
    const current = bySlug.get(slug)
    if(!current || rank > current.rank) bySlug.set(slug, { name: clean, active, rank })
  }

  // Los que han jugado esta temporada o la anterior (temporada regular)
  const recent = `seasonId>=${seasonId(seasonStart - 1)} and gameTypeId=2`
  const activeIds = new Set()
  for (const report of ['skater', 'goalie']) {
    for (const row of await getReport(report, recent, true)) activeIds.add(row.playerId)
  }

  // Carrera completa (temporada regular desde 1917)
  const all = `seasonId>=19171918 and seasonId<=${seasonId(seasonStart)} and gameTypeId=2`
  let nhl = 0
  for (const [report, nameField] of [['skater', 'skaterFullName'], ['goalie', 'goalieFullName']]) {
    for (const row of await getReport(report, all, true)) {
      add(row[nameField], activeIds.has(row.playerId) ? 1 : 0, row.gamesPlayed || 0)
      nhl++
    }
  }

  let drafted = 0
  for (let year = lastDraft - DRAFT_YEARS + 1; year <= lastDraft; year++) {
    let data
    try {
      data = await getJson(`${DRAFT_URL}/${year}/all`)
    } catch (e) {
      console.log(`Draft ${year}: ${e.message}`)
      continue
    }
    for (const pick of data.picks || []) {
      const name = `${pick.firstName?.default || ''} ${pick.lastName?.default || ''}`
      add(name, 1, 0)
      drafted++
    }
  }

  const players = [...bySlug.entries()]
    .map(([slug, e]) => [e.name, slug, e.active])
    .sort((a, b) => a[1].localeCompare(b[1]))

  await writeFile('data/players.json', `[\n${players.map(e => JSON.stringify(e)).join(',\n')}\n]\n`)
  console.log(`${players.length} jugadores (${nhl} filas de la NHL, ${drafted} del draft; ${players.filter(e => e[2]).length} en activo)`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
