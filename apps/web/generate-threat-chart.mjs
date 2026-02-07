#!/usr/bin/env node
/**
 * Threat Chart Generator
 *
 * Builds a standalone HTML chart for threat progression against a selected boss.
 * Requires the API to be running and accessible via apiBase.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

const DEFAULT_API_BASE = 'http://127.0.0.1:8787'
const DEFAULT_TOP_PLAYERS = 8

/**
 * Parse CLI args.
 * Supported:
 * --reportId <id>
 * --fightId <number>
 * --bossId <number>
 * --apiBase <url>
 * --out <path>
 * --topPlayers <number>
 */
function parseArgs(argv) {
  const args = {}

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--') {
      continue
    }
    if (!token.startsWith('--')) {
      continue
    }

    const key = token.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }

    args[key] = value
    i++
  }

  const reportId = args.reportId
  const fightId = Number(args.fightId)
  const bossId = Number(args.bossId)
  const apiBase = (args.apiBase ?? DEFAULT_API_BASE).replace(/\/$/, '')
  const topPlayers = args.topPlayers
    ? Math.max(1, Number(args.topPlayers))
    : DEFAULT_TOP_PLAYERS

  if (!reportId) {
    throw new Error('Missing required --reportId')
  }
  if (!Number.isFinite(fightId)) {
    throw new Error('Missing or invalid --fightId')
  }
  if (!Number.isFinite(bossId)) {
    throw new Error('Missing or invalid --bossId')
  }
  if (!Number.isFinite(topPlayers)) {
    throw new Error('Invalid --topPlayers')
  }

  const defaultOut = resolve(
    process.cwd(),
    `apps/web/threat-chart-${reportId}-fight-${fightId}-boss-${bossId}.html`,
  )

  return {
    reportId,
    fightId,
    bossId,
    apiBase,
    topPlayers,
    out: args.out ? resolve(process.cwd(), args.out) : defaultOut,
  }
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Request failed ${response.status} ${url}\n${body}`)
  }
  return response.json()
}

function getPalette(size) {
  const base = [
    '#58a6ff',
    '#3fb950',
    '#f2cc60',
    '#ff7b72',
    '#a371f7',
    '#ffa657',
    '#79c0ff',
    '#7ee787',
    '#d2a8ff',
    '#c9d1d9',
  ]

  const colors = []
  for (let i = 0; i < size; i++) {
    colors.push(base[i % base.length])
  }
  return colors
}

function buildChartModel({
  reportId,
  fightId,
  bossId,
  fightData,
  eventsData,
  topPlayers,
}) {
  const players = (fightData.actors ?? []).filter((actor) => actor.type === 'Player')
  const playerMap = new Map(players.map((player) => [player.id, player]))
  const boss = (fightData.enemies ?? []).find((enemy) => enemy.id === bossId)

  const pointsByPlayer = new Map()

  for (const event of eventsData.events ?? []) {
    if (typeof event.timestamp !== 'number') continue

    const changes = event?.threat?.changes ?? []
    for (const change of changes) {
      if (change.targetId !== bossId) continue
      if (!playerMap.has(change.sourceId)) continue

      const existing = pointsByPlayer.get(change.sourceId) ?? []
      existing.push({
        timestamp: event.timestamp,
        amount: change.amount,
        total: change.total,
        operator: change.operator,
      })
      pointsByPlayer.set(change.sourceId, existing)
    }
  }

  const allSeries = Array.from(pointsByPlayer.entries())
    .map(([playerId, points]) => {
      const player = playerMap.get(playerId)
      const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp)
      const maxTotal = sorted.reduce((max, point) => Math.max(max, point.total), 0)

      return {
        playerId,
        playerName: player?.name ?? `Player ${playerId}`,
        playerClass: player?.subType ?? 'Unknown',
        points: sorted,
        maxTotal,
      }
    })
    .sort((a, b) => b.maxTotal - a.maxTotal)

  const selectedSeries = allSeries.slice(0, topPlayers)

  if (selectedSeries.length === 0) {
    throw new Error(
      `No threat points found for bossId=${bossId} in report=${reportId} fight=${fightId}`,
    )
  }

  const minTimestamp = selectedSeries
    .flatMap((series) => series.points.map((point) => point.timestamp))
    .reduce((min, ts) => Math.min(min, ts), Number.POSITIVE_INFINITY)

  const normalizedSeries = selectedSeries.map((series) => ({
    ...series,
    points: series.points.map((point) => ({
      ...point,
      seconds: Number(((point.timestamp - minTimestamp) / 1000).toFixed(3)),
    })),
  }))

  return {
    reportId,
    fightId,
    fightName: fightData.name,
    bossId,
    bossName: boss?.name ?? `Boss ${bossId}`,
    totalEvents: eventsData?.summary?.totalEvents ?? 0,
    selectedPlayerCount: normalizedSeries.length,
    availablePlayerCount: allSeries.length,
    generatedAt: new Date().toISOString(),
    series: normalizedSeries,
  }
}

function buildHtml(model) {
  const colors = getPalette(model.series.length)
  const dataJson = JSON.stringify({
    ...model,
    colors,
  }).replace(/</g, '\\u003c')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Threat Debug Chart - ${model.reportId} Fight ${model.fightId}</title>
    <style>
      :root {
        --bg: #0b1220;
        --panel: #101a2d;
        --line: #22314f;
        --text: #e5ecf5;
        --muted: #9ba9bf;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 20px;
        background: radial-gradient(circle at top, #14213d, var(--bg) 55%);
        color: var(--text);
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .panel {
        max-width: 980px;
        margin: 0 auto;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--panel);
        padding: 16px;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 20px;
      }
      .meta {
        color: var(--muted);
        margin-bottom: 12px;
        line-height: 1.5;
      }
      .chart-frame {
        width: min(900px, 100%);
        aspect-ratio: 16 / 9;
        margin: 0 auto;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 8px;
        background: rgba(6, 11, 20, 0.5);
      }
      #chart {
        width: 100%;
        height: 100%;
      }
      details {
        margin-top: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
      }
      th, td {
        text-align: left;
        padding: 6px 8px;
        border-bottom: 1px solid var(--line);
        font-size: 13px;
      }
      th { color: var(--muted); }
    </style>
  </head>
  <body>
    <section class="panel">
      <h1>Threat Debug Chart</h1>
      <div id="meta" class="meta"></div>
      <div class="chart-frame">
        <canvas id="chart"></canvas>
      </div>
      <details>
        <summary>Series Summary</summary>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Class</th>
              <th>Points</th>
              <th>Max Total Threat</th>
            </tr>
          </thead>
          <tbody id="seriesRows"></tbody>
        </table>
      </details>
    </section>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      const model = ${dataJson}

      const metaEl = document.getElementById('meta')
      metaEl.textContent =
        'Report ' + model.reportId +
        ' | Fight ' + model.fightId + ': ' + model.fightName +
        ' | Boss ' + model.bossName + ' (#' + model.bossId + ')' +
        ' | Players shown ' + model.selectedPlayerCount + '/' + model.availablePlayerCount +
        ' | Events ' + model.totalEvents +
        ' | Generated ' + model.generatedAt

      const rowsEl = document.getElementById('seriesRows')
      for (const s of model.series) {
        const tr = document.createElement('tr')
        tr.innerHTML =
          '<td>' + s.playerName + ' (#' + s.playerId + ')</td>' +
          '<td>' + s.playerClass + '</td>' +
          '<td>' + s.points.length + '</td>' +
          '<td>' + Math.round(s.maxTotal).toLocaleString() + '</td>'
        rowsEl.appendChild(tr)
      }

      const datasets = model.series.map((series, index) => ({
        label: series.playerName + ' (' + series.playerClass + ')',
        data: series.points.map((point) => ({
          x: point.seconds,
          y: point.total,
          amount: point.amount,
          operator: point.operator,
        })),
        borderColor: model.colors[index],
        backgroundColor: model.colors[index] + '33',
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.12,
      }))

      const ctx = document.getElementById('chart').getContext('2d')
      new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'nearest', intersect: false },
          plugins: {
            legend: {
              labels: { color: '#e5ecf5', boxWidth: 12 },
            },
            tooltip: {
              callbacks: {
                title(items) {
                  if (!items.length) return ''
                  return 't=' + items[0].parsed.x.toFixed(2) + 's'
                },
                label(item) {
                  const raw = item.raw
                  const delta = raw.amount >= 0 ? '+' + raw.amount : String(raw.amount)
                  return item.dataset.label + ': total=' + Math.round(raw.y) + ', delta=' + delta + ', op=' + raw.operator
                },
              },
            },
          },
          scales: {
            x: {
              type: 'linear',
              title: { display: true, text: 'Fight Time (s)', color: '#e5ecf5' },
              ticks: { color: '#9ba9bf' },
              grid: { color: 'rgba(155, 169, 191, 0.15)' },
            },
            y: {
              title: { display: true, text: 'Total Threat', color: '#e5ecf5' },
              ticks: { color: '#9ba9bf' },
              grid: { color: 'rgba(155, 169, 191, 0.15)' },
            },
          },
        },
      })
    </script>
  </body>
</html>`
}

async function main() {
  const opts = parseArgs(process.argv)
  const fightUrl = `${opts.apiBase}/v1/reports/${opts.reportId}/fights/${opts.fightId}`
  const eventsUrl = `${opts.apiBase}/v1/reports/${opts.reportId}/fights/${opts.fightId}/events`

  const [fightData, eventsData] = await Promise.all([
    fetchJson(fightUrl),
    fetchJson(eventsUrl),
  ])

  const model = buildChartModel({
    reportId: opts.reportId,
    fightId: opts.fightId,
    bossId: opts.bossId,
    fightData,
    eventsData,
    topPlayers: opts.topPlayers,
  })

  const html = buildHtml(model)
  await mkdir(dirname(opts.out), { recursive: true })
  await writeFile(opts.out, html, 'utf8')

  process.stdout.write(`Saved chart: ${opts.out}\n`)
  process.stdout.write(
    `Boss: ${model.bossName} (#${model.bossId}) | Players shown: ${model.selectedPlayerCount}\n`,
  )
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.stderr.write(
    'Usage: pnpm chart:threat -- --reportId <id> --fightId <id> --bossId <id> [--apiBase <url>] [--topPlayers <n>] [--out <file>]\n',
  )
  process.exit(1)
})
