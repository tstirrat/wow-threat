/**
 * v1 chart-first wireframe: state, URL sync, rendering and interactions.
 *
 * Plain DOM + canvas. Rendering is "redraw everything" on each state change,
 * batched to one animation frame. See NOTES.md for the interaction model.
 */
/* global WF */
;(() => {
  // ===========================================================================
  // Utilities
  // ===========================================================================

  const $ = (sel) => document.querySelector(sel)
  const esc = (str) =>
    String(str).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

  function fmtTime(ms, precise = false) {
    const neg = ms < 0
    const abs = Math.abs(Math.round(ms))
    const m = Math.floor(abs / 60000)
    const s = Math.floor((abs % 60000) / 1000)
    const frac = precise ? `.${String(abs % 1000).padStart(3, '0')}` : ''
    return `${neg ? '-' : ''}${m}:${String(s).padStart(2, '0')}${frac}`
  }

  function fmtNum(v) {
    const a = Math.abs(v)
    if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`
    if (a >= 1e4) return `${(v / 1e3).toFixed(1)}k`
    return Math.round(v).toLocaleString()
  }

  const fmtPct = (v) => (Number.isFinite(v) ? `${Math.round(v)}%` : '—')

  function loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem('wf-v1-prefs') ?? '{}')
    } catch {
      return {}
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(
        'wf-v1-prefs',
        JSON.stringify({
          display: state.display,
          railCollapsed: state.ui.railCollapsed,
          rosterHidden: state.ui.rosterHidden,
          breakdownOpen: state.ui.breakdownOpen,
          signedIn: state.ui.signedIn,
          starredReports: [...state.ui.starredReports],
          starredGuilds: [...state.ui.starredGuilds],
        }),
      )
    } catch {
      // Storage is a convenience only.
    }
  }

  // ===========================================================================
  // State
  // ===========================================================================

  const prefs = loadPrefs()

  const state = {
    view: 'home',
    reportCode: null,
    pullId: 1,
    targetId: null,
    visible: new Set(),
    pinned: new Set(),
    focus: null,
    cursor: null,
    xRange: null,
    yRange: null,
    mode: 'abs',
    thresholds: false,
    analysis: { buffs: true, emu: true, overrides: {} },
    display: {
      theme: 'system',
      bossMelee: true,
      eventDots: true,
      resourceDots: true,
      fixate: true,
      tpsWindow: 5,
      ...(prefs.display ?? {}),
    },
    ui: {
      railCollapsed: prefs.railCollapsed ?? false,
      rosterHidden: prefs.rosterHidden ?? false,
      railTab: 'outline',
      breakdownOpen: prefs.breakdownOpen ?? true,
      settingsOpen: false,
      overridesOpen: null,
      railOpen: false,
      rosterOpen: false,
      mobileTab: 'chart',
      signedIn: prefs.signedIn ?? false,
      starredReports: new Set(prefs.starredReports ?? ['Qw2eR4tY6uI8oP0a']),
      starredGuilds: new Set(prefs.starredGuilds ?? ['pp']),
      openGuilds: new Set(),
      expandedSpells: new Set(),
      rosterFilter: '',
      playing: false,
      speed: 1,
    },
  }

  const report = () => WF.getReport(state.reportCode)
  const pull = () =>
    report().pulls.find((p) => p.id === state.pullId) ?? report().pulls[0]
  const target = () =>
    pull().targets.find((t) => t.id === state.targetId) ?? pull().targets[0]
  const sim = () => WF.simulate(report(), pull(), target(), state.analysis)
  const windowRange = () => state.xRange ?? [0, sim().D]
  const player = (pid) => WF.PLAYERS_BY_ID.get(pid)

  // ===========================================================================
  // Theme
  // ===========================================================================

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

  function isDark() {
    if (state.display.theme === 'dark') return true
    if (state.display.theme === 'light') return false
    return darkQuery.matches
  }

  function applyTheme() {
    const root = document.documentElement
    if (state.display.theme === 'system') delete root.dataset.theme
    else root.dataset.theme = state.display.theme
  }

  /** Class colour for the active theme. */
  const colorOf = (pid) => {
    const p = player(pid)
    return isDark() ? p.colorDark : p.colorLight
  }

  /** Canvas colours, read from the CSS tokens. */
  function chartColors() {
    const css = getComputedStyle(document.documentElement)
    const get = (name) => css.getPropertyValue(name).trim()
    return {
      text: get('--text'),
      muted: get('--muted'),
      bg: get('--bg'),
      grid: get('--chart-grid'),
      frame: get('--chart-frame'),
      cursor: get('--chart-cursor'),
      hover: get('--chart-hover'),
      threshold: get('--chart-threshold'),
      shade: get('--chart-shade'),
      veil: get('--chart-veil'),
      melee: get('--chart-melee'),
    }
  }

  /** Black or white text, whichever reads better on a hex colour. */
  function inkOn(hex) {
    const n = parseInt(hex.slice(1), 16)
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
    return lum > 0.55 ? '#111' : '#fff'
  }

  // ===========================================================================
  // URL contract
  // ===========================================================================

  const idList = (str) =>
    (str ?? '')
      .split(',')
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)

  const rangeParam = (str) => {
    if (!str) return null
    const [a, b] = str.split('_').map(Number)
    return Number.isFinite(a) && Number.isFinite(b) && b > a ? [a, b] : null
  }

  /**
   * Overrides in the URL: players joined by ",", each "pid.item.item".
   * Items: "<buff><0|1>" (e.g. salv0) and "t<talentIndex>r<rank>" (e.g. t0r3).
   */
  function serializeOverrides(all) {
    return Object.entries(all)
      .map(([pid, ov]) => {
        const p = player(Number(pid))
        const buffs = Object.entries(ov.buffs ?? {}).map(([k, v]) => `${k}${v ? 1 : 0}`)
        const talents = WF.talentsFor(p)
          .map((t, i) => (ov.talents?.[t.name] !== undefined ? `t${i}r${ov.talents[t.name]}` : null))
          .filter(Boolean)
        return [pid, ...buffs, ...talents].join('.')
      })
      .join(',')
  }

  function parseOverrides(str) {
    const all = {}
    ;(str ?? '').split(',').filter(Boolean).forEach((chunk) => {
      const [pidStr, ...items] = chunk.split('.')
      const p = player(Number(pidStr))
      if (!p) return
      const ov = {}
      items.forEach((item) => {
        const tm = item.match(/^t(\d+)r(\d+)$/)
        const bm = item.match(/^([a-z]+)([01])$/)
        if (tm) {
          const t = WF.talentsFor(p)[Number(tm[1])]
          if (t) ov.talents = { ...ov.talents, [t.name]: Math.min(t.max, Number(tm[2])) }
        } else if (bm && WF.BUFFS.some((b) => b.key === bm[1])) {
          ov.buffs = { ...ov.buffs, [bm[1]]: bm[2] === '1' }
        }
      })
      if (Object.keys(ov).length) all[p.id] = ov
    })
    return all
  }

  function readUrl() {
    const hash = location.hash.replace(/^#/, '')
    const [path, query = ''] = hash.split('?')
    const parts = path.split('/').filter(Boolean)
    if (parts[0] !== 'report' || !parts[1]) {
      state.view = 'home'
      return
    }
    const q = new URLSearchParams(query)
    state.view = 'report'
    state.reportCode = parts[1]
    state.pullId = Number(q.get('pull')) || 1
    state.targetId = q.get('target')
    const ids = new Set(pull().playerIds)
    state.visible = q.has('players')
      ? new Set(idList(q.get('players')).filter((id) => ids.has(id)))
      : new Set(ids)
    state.pinned = new Set(idList(q.get('pinned')))
    state.analysis = {
      buffs: q.get('buffs') !== '0',
      emu: q.get('emu') !== '0',
      overrides: parseOverrides(q.get('ov')),
    }
    const focus = q.get('focus')
    state.focus =
      focus === 'none'
        ? null
        : focus && ids.has(Number(focus))
          ? Number(focus)
          : WF.topTank(sim())
    state.cursor = q.has('t') ? Number(q.get('t')) : null
    state.xRange = rangeParam(q.get('x'))
    state.yRange = rangeParam(q.get('y'))
    state.mode = q.get('mode') === 'rel' ? 'rel' : 'abs'
    state.thresholds = q.get('thr') === '1'
  }

  function writeUrl(push = false) {
    let hash = '#/'
    if (state.view === 'report') {
      const q = new URLSearchParams()
      q.set('pull', state.pullId)
      q.set('target', target().id)
      const all = pull().playerIds
      if (state.visible.size !== all.length) {
        q.set('players', [...state.visible].join(','))
      }
      if (state.pinned.size) q.set('pinned', [...state.pinned].join(','))
      q.set('focus', state.focus ?? 'none')
      if (state.cursor !== null) q.set('t', Math.round(state.cursor))
      if (state.xRange) q.set('x', state.xRange.map(Math.round).join('_'))
      if (state.yRange) q.set('y', state.yRange.map(Math.round).join('_'))
      if (state.mode === 'rel') q.set('mode', 'rel')
      if (state.thresholds) q.set('thr', '1')
      if (!state.analysis.buffs) q.set('buffs', '0')
      if (!state.analysis.emu) q.set('emu', '0')
      const ov = serializeOverrides(state.analysis.overrides)
      if (ov) q.set('ov', ov)
      hash = `#/report/${state.reportCode}?${q.toString().replace(/%2C/g, ',')}`
    }
    if (hash === location.hash) return
    if (push) history.pushState(null, '', hash)
    else history.replaceState(null, '', hash)
  }

  // ===========================================================================
  // Navigation
  // ===========================================================================

  /** Apply pin/visibility/focus rules when the pull or report changes. */
  function enterPull(pullId, targetId = null) {
    const prevFocus = state.focus
    state.pullId = pullId
    state.targetId = targetId ?? pull().targets[0].id
    const ids = new Set(pull().playerIds)
    state.visible = state.pinned.size
      ? new Set([...state.pinned].filter((id) => ids.has(id)))
      : new Set(ids)
    state.focus =
      prevFocus && ids.has(prevFocus) ? prevFocus : WF.topTank(sim())
    state.cursor = null
    state.xRange = null
    state.yRange = null
    state.ui.expandedSpells.clear()
    stopPlayback()
  }

  function openReport(code) {
    state.view = 'report'
    state.reportCode = code
    state.ui.railTab = 'outline'
    state.ui.railOpen = false
    enterPull(1)
    commit(true)
  }

  function goHome() {
    state.view = 'home'
    state.ui.railTab = 'library'
    stopPlayback()
    commit(true)
  }

  function stepPull(dir) {
    const pulls = report().pulls
    const i = pulls.findIndex((p) => p.id === state.pullId)
    const next = pulls[i + dir]
    if (!next) return
    enterPull(next.id)
    commit(true)
  }

  function setTarget(id) {
    state.targetId = id
    state.cursor = null
    state.xRange = null
    state.yRange = null
    commit(true)
  }

  function parseReportInput(text) {
    const trimmed = text.trim()
    const fromUrl = trimmed.match(/warcraftlogs\.com\/reports\/([A-Za-z0-9]+)/)
    if (fromUrl) return fromUrl[1]
    if (/^[A-Za-z0-9]{16}$/.test(trimmed)) return trimmed
    return null
  }

  // ===========================================================================
  // Render scheduling
  // ===========================================================================

  let frame = 0
  function commit(push = false) {
    writeUrl(push)
    savePrefs()
    if (!frame) frame = requestAnimationFrame(renderAll)
  }

  function redrawCanvases() {
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0
      if (state.view === 'report') {
        drawChart()
        drawRibbon()
        drawOverview()
      }
    })
  }

  function renderAll() {
    frame = 0
    applyTheme()
    const app = $('#app')
    app.classList.toggle('is-home', state.view === 'home')
    app.classList.toggle('rail-collapsed', state.ui.railCollapsed)
    app.classList.toggle('rail-open', state.ui.railOpen)
    app.classList.toggle('roster-open', state.ui.rosterOpen)
    app.classList.toggle('roster-hidden', state.ui.rosterHidden)
    app.classList.toggle('tab-breakdown', state.ui.mobileTab === 'breakdown')
    $('#home').hidden = state.view !== 'home'
    $('#analysis').hidden = state.view !== 'report'
    document.querySelectorAll('[data-action="mobile-tab"]').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.tab === state.ui.mobileTab)),
    )

    renderBar()
    renderRail()
    renderSettings()
    renderOverrides()
    if (state.view === 'home') {
      renderHome()
      return
    }
    renderTransport()
    renderRoster()
    renderBreakdown()
    drawChart()
    drawRibbon()
    drawOverview()
  }

  // ===========================================================================
  // Rail: outline + library
  // ===========================================================================

  function renderRail() {
    const inReport = state.view === 'report'
    const tab = inReport ? state.ui.railTab : 'library'
    const collapsed = state.ui.railCollapsed
    const head = `
      <div class="rail-top">
        <a href="#/" class="home-link" data-action="home">${collapsed ? 'WT' : 'WOW Threat'}</a>
        <button class="desktop-only" data-action="rail-collapse" aria-label="${collapsed ? 'Expand' : 'Collapse'} navigation">${collapsed ? '»' : '«'}</button>
      </div>
      <div class="rail-head" role="tablist">
        <button role="tab" data-action="rail-tab" data-tab="outline" aria-pressed="${tab === 'outline'}" ${inReport ? '' : 'disabled'}>${collapsed ? 'Pulls' : 'This report'}</button>
        <button role="tab" data-action="rail-tab" data-tab="library" aria-pressed="${tab === 'library'}">${collapsed ? 'Lib' : 'Library'}</button>
      </div>`
    const body =
      tab === 'outline' && inReport ? renderOutline() : renderLibrary()
    $('#rail').innerHTML = `${head}<div class="rail-body">${body}</div>`
  }

  function renderOutline() {
    const rep = report()
    const starred = state.ui.starredReports.has(rep.code)
    return `
      <div class="report-head">
        <div class="title-row">
          <strong>${esc(rep.title)}</strong>
          <button data-action="toggle-star" aria-pressed="${starred}" aria-label="${starred ? 'Unstar' : 'Star'} this report">${starred ? '★' : '☆'}</button>
        </div>
        <span class="muted">${esc(rep.guild)} · ${esc(rep.date)}</span>
      </div>
      <ul class="pull-list">
        ${rep.pulls
          .map((p) => {
            const current = p.id === state.pullId
            const targets = current
              ? `<ul class="target-list">${p.targets
                  .map(
                    (t) =>
                      `<li><button data-action="select-target" data-target="${t.id}" class="${t.id === target().id ? 'is-current' : ''}">${esc(t.name)}</button></li>`,
                  )
                  .join('')}</ul>`
              : ''
            return `<li>
              <button data-action="select-pull" data-pull="${p.id}" class="${current ? 'is-current' : ''}">
                <span>#${p.id} ${esc(p.name)}</span>
                <span class="pull-meta">${p.outcome === 'kill' ? 'Kill' : `Wipe at ${p.pct}%`} · ${fmtTime(p.durationMs)}</span>
              </button>${targets}</li>`
          })
          .join('')}
      </ul>`
  }

  function libItem(r) {
    const starred = state.ui.starredReports.has(r.code)
    return `<li class="lib-guild">
      <button class="lib-item" data-action="load-report" data-code="${r.code}">
        <span>${esc(r.title)}</span>
        <span class="pull-meta">${esc(r.guild ?? '')}${r.guild ? ' · ' : ''}${esc(r.date)}</span>
      </button>
      <button data-action="star-report" data-code="${r.code}" aria-pressed="${starred}" aria-label="${starred ? 'Unstar' : 'Star'} ${esc(r.title)}">${starred ? '★' : '☆'}</button>
    </li>`
  }

  function renderLibrary() {
    const lib = WF.LIBRARY
    const signedIn = state.ui.signedIn
    const starredReports = [
      ...lib.recent,
      ...lib.starred,
      ...lib.myLogs,
      ...lib.guilds.flatMap((g) => g.reports.map((r) => ({ ...r, guild: g.name }))),
    ].filter(
      (r, i, all) =>
        state.ui.starredReports.has(r.code) &&
        all.findIndex((x) => x.code === r.code) === i,
    )
    const guildBlock = (g) => {
      const open = state.ui.openGuilds.has(g.id)
      const starred = state.ui.starredGuilds.has(g.id)
      return `<li>
        <div class="lib-guild">
          <button data-action="toggle-guild" data-guild="${g.id}" aria-expanded="${open}">${open ? '▾' : '▸'} ${esc(g.name)} <span class="muted">${esc(g.server)}</span></button>
          <button data-action="star-guild" data-guild="${g.id}" aria-pressed="${starred}" aria-label="${starred ? 'Unstar' : 'Star'} guild">${starred ? '★' : '☆'}</button>
        </div>
        ${open ? `<ul class="lib-list" style="margin-left:12px">${g.reports.map((r) => libItem({ ...r, guild: '' })).join('')}</ul>` : ''}
      </li>`
    }
    const signInPrompt = `<p class="muted">Sign in with Warcraft Logs to see this. <button class="link" data-action="sign-in">Sign in</button></p>`
    const myGuilds = lib.guilds.filter((g) => g.member)
    const starredGuilds = lib.guilds.filter((g) => state.ui.starredGuilds.has(g.id))
    return `
      <section class="lib-section"><h3>Recent</h3><ul class="lib-list">${lib.recent.map(libItem).join('')}</ul></section>
      <section class="lib-section"><h3>Starred reports</h3>${
        starredReports.length
          ? `<ul class="lib-list">${starredReports.map(libItem).join('')}</ul>`
          : '<p class="muted">Star a report to keep it here.</p>'
      }</section>
      <section class="lib-section"><h3>Starred guilds</h3>${
        starredGuilds.length
          ? `<ul class="lib-list">${starredGuilds.map(guildBlock).join('')}</ul>`
          : '<p class="muted">Star any guild, even one you are not in, to follow its reports.</p>'
      }</section>
      <section class="lib-section"><h3>My guilds</h3>${
        signedIn ? `<ul class="lib-list">${myGuilds.map(guildBlock).join('')}</ul>` : signInPrompt
      }</section>
      <section class="lib-section"><h3>My logs</h3>${
        signedIn ? `<ul class="lib-list">${lib.myLogs.map(libItem).join('')}</ul>` : signInPrompt
      }</section>`
  }

  // ===========================================================================
  // Home
  // ===========================================================================

  function renderHome() {
    const home = $('#home')
    if (home.querySelector('#home-open')) return
    home.innerHTML = `
      <form class="home-open" id="home-open">
        <label for="home-input"><h2>Open a Warcraft Logs report</h2></label>
        <div class="home-row">
          <input id="home-input" placeholder="https://fresh.warcraftlogs.com/reports/…" autocomplete="off" />
          <button class="primary">Open</button>
        </div>
        <p class="error" id="home-error" hidden></p>
        <p class="muted">Paste a report link. Press <kbd>⌘O</kbd> from anywhere to open another. Your starred reports and guilds are in the sidebar.</p>
      </form>`
    $('#home-input').focus()
  }

  // ===========================================================================
  // Toolbar
  // ===========================================================================

  const ICONS = {
    settings:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-2.2 3.2"/><path d="M6.6 6.6C3.8 8.3 2 12 2 12s3 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>',
    sliders:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>',
    tank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    healer:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    roster:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>',
  }

  /** The chart bar is the app's only top bar: chart controls left, app actions right. */
  function renderBar() {
    const inReport = state.view === 'report'
    const account = state.ui.signedIn
      ? `<button data-action="sign-out" title="Signed in with Warcraft Logs. Click to sign out.">Tstirrat<span class="long"> (sign out)</span></button>`
      : `<button data-action="sign-in" title="Sign in with Warcraft Logs">Sign in</button>`
    const right = `<div class="bar-right">
        ${account}
        <button class="icon" data-action="toggle-settings" aria-pressed="${state.ui.settingsOpen}" aria-label="Settings" title="Settings (,)">${ICONS.settings}</button>
        ${inReport ? `<button class="icon" data-action="toggle-roster" aria-pressed="${isMobile() ? state.ui.rosterOpen : !state.ui.rosterHidden}" aria-label="${state.ui.rosterHidden ? 'Show' : 'Hide'} roster" title="Roster (R)">${ICONS.roster}</button>` : ''}
      </div>`
    // Open report leads the bar; a divider separates it from the chart controls.
    const menu = `<button class="only-mobile" data-action="mobile-rail" aria-label="Open navigation">Menu</button>
      <button data-action="open-report">Open<span class="long"> report</span> <kbd>⌘O</kbd></button>
      <span class="bar-divider" aria-hidden="true"></span>`
    if (!inReport) {
      $('#bar').innerHTML = `${menu}<span class="muted">Home</span>${right}`
      return
    }
    const zoomed = Boolean(state.xRange || state.yRange)
    const p = pull()
    $('#bar').innerHTML = `
      ${menu}
      <span class="bar-title" title="Pull and target">#${p.id} ${esc(p.name)} · ${p.outcome === 'kill' ? 'Kill' : `Wipe ${p.pct}%`}${p.targets.length > 1 ? ` › ${esc(target().name)}` : ''}</span>
      <div class="group" role="group" aria-label="Threat scale">
        <button data-action="mode" data-mode="abs" aria-pressed="${state.mode === 'abs'}">Absolute</button>
        <button data-action="mode" data-mode="rel" aria-pressed="${state.mode === 'rel'}" title="Toggle with A">% of aggro</button>
      </div>
      <button data-action="reset-zoom" ${zoomed ? '' : 'disabled'}>Reset zoom</button>
      ${right}`
  }

  /** Transport row under the overview: window, playback and cursor. */
  function renderTransport() {
    const [a, b] = windowRange()
    $('#transport').innerHTML = `
      <span class="readout">Window ${fmtTime(a)}–${fmtTime(b)}</span>
      <div class="group">
        <button data-action="toggle-play" aria-pressed="${state.ui.playing}">${state.ui.playing ? 'Pause' : 'Play'} <kbd>Space</kbd></button>
        <select data-change="speed" aria-label="Playback speed">
          ${[1, 2, 4, 8].map((sp) => `<option value="${sp}" ${sp === state.ui.speed ? 'selected' : ''}>${sp}×</option>`).join('')}
        </select>
      </div>
      <div class="group">
        <span class="readout">Cursor ${state.cursor === null ? '—' : fmtTime(state.cursor, true)}</span>
        ${state.cursor === null ? '' : '<button data-action="clear-cursor">Clear</button>'}
      </div>`
  }

  const isMobile = () => window.matchMedia('(max-width: 760px)').matches

  // ===========================================================================
  // Roster
  // ===========================================================================

  function rosterTime() {
    return state.cursor ?? windowRange()[1]
  }

  function renderRoster() {
    const s = sim()
    const t = rosterTime()
    const seg = WF.segmentAt(s, t)
    const holderVal = WF.valueAt(s, seg.pid, t)
    const filter = state.ui.rosterFilter.toLowerCase()
    const deadAt = new Set(
      s.markers.filter((mk) => mk.type === 'death' && mk.t <= t).map((mk) => mk.pid),
    )

    const rows = s.players
      .map((p) => {
        const v = WF.valueAt(s, p.id, t)
        // Rolling TPS: threat gained over the last N seconds before the roster time.
        const from = Math.max(0, t - state.display.tpsWindow * 1000)
        const tps = t > from ? (v - WF.valueAt(s, p.id, from)) / ((t - from) / 1000) : 0
        return { p, v, tps, pct: holderVal > 0 ? (v / holderVal) * 100 : NaN }
      })
      .filter((r) => !filter || r.p.name.toLowerCase().includes(filter))
      .sort((x, y) => y.v - x.v)
    const max = Math.max(1, ...rows.map((r) => r.v))
    const absent = [...state.pinned]
      .filter((id) => !s.players.some((p) => p.id === id))
      .map(player)

    const row = ({ p, v, tps, pct }) => {
      const visible = state.visible.has(p.id)
      const pinned = state.pinned.has(p.id)
      const tags = [
        p.role !== 'dps' ? `<span class="tag">${p.role}</span>` : '',
        seg.pid === p.id
          ? `<span class="tag strong">${seg.kind === 'fixate' ? 'fixated' : 'aggro'}</span>`
          : '',
        deadAt.has(p.id) ? '<span class="tag">dead</span>' : '',
      ].join('')
      const badge = overridesOf(p.id)
        ? `<span class="ov-badge" data-action="open-overrides" data-pid="${p.id}" title="Overrides: ${esc(overrideSummary(p.id).join(', '))}. Click to edit.">${ICONS.sliders}</span>`
        : '<span></span>'
      return `<li class="roster-row ${state.focus === p.id ? 'is-focus' : ''} ${visible ? '' : 'is-hidden'}">
        <button class="ricon" data-action="toggle-visible" data-pid="${p.id}" aria-pressed="${!visible}" aria-label="${visible ? 'Hide' : 'Show'} ${esc(p.name)}" title="${visible ? 'Hide' : 'Show'} line">${visible ? ICONS.eye : ICONS.eyeOff}</button>
        <button class="ricon pin" data-action="toggle-pin" data-pid="${p.id}" aria-pressed="${pinned}" aria-label="${pinned ? 'Unpin' : 'Pin'} ${esc(p.name)}" title="${pinned ? 'Unpin' : 'Pin across pulls'}">${ICONS.pin}</button>
        <button class="roster-main" data-action="focus" data-pid="${p.id}" aria-label="Focus ${esc(p.name)}" title="Click to focus · double-click to show only this player">
          <span class="swatch" style="background:${colorOf(p.id)}"></span>
          <span class="roster-name">${esc(p.name)}${tags}</span>
          ${badge}
          <span class="num">${fmtNum(v)}</span>
          <span class="num">${fmtPct(pct)}</span>
          <span class="num">${fmtNum(tps)}</span>
          <span class="bar-meter"><i style="width:${(v / max) * 100}%"></i></span>
        </button>
      </li>`
    }
    const absentRow = (p) => `<li class="roster-row is-absent">
        <button class="ricon" disabled aria-label="Not in this pull">${ICONS.eyeOff}</button>
        <button class="ricon pin" data-action="toggle-pin" data-pid="${p.id}" aria-pressed="true" aria-label="Unpin ${esc(p.name)}" title="Unpin">${ICONS.pin}</button>
        <span class="roster-main"><span class="swatch" style="background:${colorOf(p.id)}"></span><span class="roster-name">${esc(p.name)} <span class="tag">not in this pull</span></span><span></span><span></span><span></span><span></span></span>
      </li>`


    const tankIds = s.players.filter((p) => p.role === 'tank').map((p) => p.id)
    const sameSet = (ids) => state.visible.size === ids.length && ids.every((id) => state.visible.has(id))
    const showing =
      state.visible.size === s.players.length
        ? 'all'
        : sameSet(tankIds)
          ? 'tanks'
          : sameSet(topIds(5))
            ? 'top'
            : 'custom'
    const refocus =
      document.activeElement?.dataset?.input === 'roster-filter'
    $('#roster').innerHTML = `
      <div class="roster-head">
        <div class="row roster-title">
          <h2>Roster</h2>
          <button data-action="open-overrides" aria-pressed="${Boolean(state.ui.overridesOpen)}" title="Player buff and talent overrides (O)">${ICONS.sliders} Overrides${overrideCount() ? ` <span class="tag strong">${overrideCount()}</span>` : ''}</button>
        </div>
        <div class="row">
          <input type="search" placeholder="Filter players" aria-label="Filter players" data-input="roster-filter" value="${esc(state.ui.rosterFilter)}" />
          <div class="group" role="group" aria-label="Show players">
            <button data-action="toggle-all" aria-pressed="${showing === 'all'}" title="${showing === 'all' ? 'Hide everyone' : 'Show everyone'}">All</button>
            <button data-action="show-tanks" aria-pressed="${showing === 'tanks'}">Tanks</button>
            <button data-action="show-top" aria-pressed="${showing === 'top'}" title="Top five by threat at ${state.cursor === null ? 'the end of the window' : 'the cursor'}">Top 5</button>
          </div>
        </div>
      </div>
      <div class="roster-cols"><span></span><span>Player</span><span></span><span class="num">Threat</span><span class="num">% aggro</span><span class="num" title="Threat per second over the last ${state.display.tpsWindow}s">TPS ${state.display.tpsWindow}s</span></div>
      <ul class="roster-list">${rows.map(row).join('')}${absent.map(absentRow).join('')}</ul>`

    // Keep the filter input focused while typing.
    if (refocus) {
      const input = document.querySelector('[data-input="roster-filter"]')
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    }
  }

  function eventMath(e) {
    if (e.coeff === null) return esc(e.note ?? '')
    const base =
      e.kind === 'energize'
        ? `${e.raw} rage`
        : e.bonus
          ? `(${fmtNum(e.raw)} + ${fmtNum(e.bonus)} bonus)`
          : `${fmtNum(e.raw)} ${e.kind === 'heal' ? 'healing' : 'dmg'}`
    return `${base} × ${e.coeff.toFixed(3)} = <strong>${e.threat >= 0 ? '+' : ''}${fmtNum(e.threat)}</strong>`
  }

  /** Tooltip rows for a set of events that share one timestamp. */
  function tipEvents(list) {
    return `<ul class="tip-events">${list
      .map((e) => {
        const mods = e.mods.length
          ? e.mods.map((m) => `${esc(m.name)} ×${m.mult}${m.overridden ? ' <em>(override)</em>' : ''}`).join(' · ')
          : e.coeff === null
            ? ''
            : 'No modifiers'
        return `<li>
          <div class="event-top">
            <span><strong>${esc(e.spell)}</strong>${e.hitType !== 'hit' ? ` <span class="tag">${e.hitType}</span>` : ''}</span>
            <span class="num">→ ${fmtNum(e.cum)}</span>
          </div>
          <div class="event-math">${eventMath(e)}</div>
          ${mods ? `<div class="event-mods">${mods}</div>` : ''}
        </li>`
      })
      .join('')}</ul>`
  }

  // ===========================================================================
  // Player info drawer: summary + spell breakdown for the focused player
  // ===========================================================================

  /** Window stats for the summary column. */
  function playerStats(p, a, b, events) {
    const s = sim()
    // Closest to pulling: highest share of the holder's threat while not holding aggro.
    let peak = null
    events.forEach((e) => {
      const seg = WF.segmentAt(s, e.t)
      // Fixates force aggro regardless of threat, so they say nothing about pulling.
      if (seg.pid === p.id || seg.kind === 'fixate') return
      const hv = WF.valueAt(s, seg.pid, e.t)
      if (hv <= 0) return
      const ratio = (e.cum / hv) * 100
      if (!peak || ratio > peak.ratio) peak = { ratio, t: e.t, holder: seg.pid }
    })
    const held = s.segments
      .filter((sg) => sg.pid === p.id && sg.kind === 'aggro')
      .reduce((acc, sg) => acc + Math.max(0, Math.min(sg.end, b) - Math.max(sg.start, a)), 0)
    return {
      peak,
      held,
      taunts: events.filter((e) => e.kind === 'taunt').length,
      deaths: events.filter((e) => e.kind === 'death').length,
    }
  }

  function renderSummary(p, a, b, events, total, secs) {
    const st = playerStats(p, a, b, events)
    const owner = p.owner ? player(p.owner) : null
    const talents = WF.talentsFor(p)
      .map((t) => {
        const rank = WF.talentRank(p, t, state.analysis)
        const changed = overridesOf(p.id)?.talents?.[t.name] !== undefined
        return `<li>${esc(t.name)} ${rank}/${t.max} <span class="muted">×${(1 + t.perRank * rank).toFixed(2)}${t.schools ? ` ${t.schools.join('/')}` : ''}</span>${changed ? ' <em>(override)</em>' : ''}</li>`
      })
      .join('')
    const limit = p.range === 'melee' ? 110 : 130
    return `<dl class="info-summary">
      <dt>Class</dt><dd>${esc(p.cls)} · ${esc(p.role)}${owner ? ` of ${esc(owner.name)}` : ''} · ${esc(p.range)}</dd>
      <dt>Threat talents</dt><dd>${talents ? `<ul class="plain">${talents}</ul>` : '<span class="muted">None</span>'}</dd>
      <dt>Threat</dt><dd class="num-left">${fmtNum(total)} <span class="muted">· ${fmtNum(total / secs)} TPS over ${fmtTime(b - a)}</span></dd>
      <dt>Aggro held</dt><dd class="num-left">${st.held ? `${fmtTime(st.held)} <span class="muted">(${fmtPct((st.held / (b - a)) * 100)})</span>` : '<span class="muted">Never</span>'}</dd>
      <dt>Closest to pulling</dt><dd>${
        st.peak
          ? `<button class="link" data-action="jump" data-t="${st.peak.t}">${fmtPct(st.peak.ratio)} of ${esc(player(st.peak.holder).name)} at ${fmtTime(st.peak.t, true)}</button> <span class="muted">pulls at ${limit}%</span>`
          : '<span class="muted">Held aggro the whole window</span>'
      }</dd>
      ${st.taunts || st.deaths ? `<dt>Events</dt><dd>${[st.taunts ? `${st.taunts} taunt${st.taunts > 1 ? 's' : ''}` : '', st.deaths ? `${st.deaths} death${st.deaths > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}</dd>` : ''}
    </dl>`
  }

  function roleIcon(p) {
    if (p.role === 'tank') return `<span class="role-icon" title="Tank">${ICONS.tank}</span>`
    if (p.role === 'healer') return `<span class="role-icon" title="Healer">${ICONS.healer}</span>`
    if (p.role === 'pet') return '<span class="tag">pet</span>'
    return ''
  }

  function renderBreakdown() {
    const open = state.ui.breakdownOpen || state.ui.mobileTab === 'breakdown'
    const drawer = $('#drawer')
    drawer.classList.toggle('is-closed', !open)
    const [a, b] = windowRange()
    const secs = (b - a) / 1000
    const p = state.focus ? player(state.focus) : null

    const head = `<div class="drawer-head">
      <button class="desktop-only" data-action="toggle-breakdown" aria-expanded="${open}" title="${open ? 'Collapse' : 'Expand'} player info (I)">${open ? '▾' : '▸'} Player info <kbd>I</kbd></button>
      ${p ? `<h2 style="color:${colorOf(p.id)}">${esc(p.name)}</h2>${roleIcon(p)}${auraIcons(p)}` : ''}
      ${p && overridesOf(p.id) ? `<button class="link" data-action="open-overrides" data-pid="${p.id}">Overrides: ${esc(overrideSummary(p.id).join(', '))}</button>` : ''}
      <button class="push desktop-only" data-action="shortcuts">Shortcuts <kbd>?</kbd></button>
    </div>`

    if (!p) {
      drawer.innerHTML = `${head}<div class="drawer-body"><p class="empty">Focus a player to see their summary and which spells made their threat in this window. Click a line on the chart or a name in the roster.</p></div>`
      return
    }

    const events = sim().events.filter(
      (e) => e.pid === p.id && e.t >= a && e.t <= b,
    )
    const groups = new Map()
    events.forEach((e) => {
      const g = groups.get(e.spell) ?? {
        spell: e.spell,
        school: e.school,
        hits: 0,
        raw: 0,
        bonus: 0,
        threat: 0,
        sample: e,
        special: e.coeff === null,
      }
      g.hits += 1
      g.raw += e.raw
      g.bonus += e.bonus
      g.threat += e.threat
      g.sample = e
      groups.set(e.spell, g)
    })
    const rows = [...groups.values()].sort((x, y) => y.threat - x.threat)
    const total = rows.reduce((acc, g) => acc + g.threat, 0)
    const positive = rows.filter((g) => g.threat > 0).reduce((acc, g) => acc + g.threat, 0)

    const body = rows
      .map((g) => {
        const expanded = state.ui.expandedSpells.has(g.spell)
        const coeff = g.special
          ? '—'
          : g.sample.kind === 'energize'
            ? '5 / rage'
            : `×${g.sample.coeff.toFixed(3)}`
        const mods = g.sample.mods.length
          ? g.sample.mods.map((m) => `${esc(m.name)} ×${m.mult}${m.overridden ? ' <em>(override)</em>' : ''}`).join(' · ')
          : g.special
            ? esc(g.sample.note ?? '')
            : 'No modifiers apply to this spell'
        return `<tr class="spell-row" data-action="expand-spell" data-spell="${esc(g.spell)}" aria-expanded="${expanded}">
            <td>${expanded ? '▾' : '▸'} ${esc(g.spell)} <span class="muted">${esc(g.school)}</span></td>
            <td class="num">${g.hits}</td>
            <td class="num">${g.special ? '—' : fmtNum(g.raw)}</td>
            <td class="num">${g.bonus ? fmtNum(g.bonus) : '—'}</td>
            <td class="num">${coeff}</td>
            <td class="num">${fmtNum(g.threat)}</td>
            <td class="num">${fmtNum(g.threat / secs)}</td>
            <td class="num">${g.threat > 0 ? fmtPct((g.threat / positive) * 100) : '—'}</td>
          </tr>
          ${expanded ? `<tr class="mod-row"><td colspan="8">Coefficient: ${mods}</td></tr>` : ''}`
      })
      .join('')

    drawer.innerHTML = `${head}<div class="drawer-body info-body">
      ${renderSummary(p, a, b, events, total, secs)}
      <div class="info-spells"><table>
      <thead><tr><th>Spell</th><th class="num">Hits</th><th class="num">Raw</th><th class="num">Bonus</th><th class="num">Coeff</th><th class="num">Threat</th><th class="num">TPS</th><th class="num">% of gain</th></tr></thead>
      <tbody>${body || '<tr><td colspan="8" class="empty">No events in this window.</td></tr>'}
        <tr class="total-row"><td>Net total</td><td class="num">${events.length}</td><td></td><td></td><td></td><td class="num">${fmtNum(total)}</td><td class="num">${fmtNum(total / secs)}</td><td></td></tr>
      </tbody></table></div></div>`
  }

  /** Threat-affecting auras the focused player starts with, as spell icons. */
  function auraIcons(p) {
    const auras = WF.aurasFor(p, state.analysis)
    if (!auras.length) return '<span class="muted">No threat auras</span>'
    return `<span class="auras" aria-label="Initial threat auras">${auras
      .map(
        (a) => `<span class="aura" title="${esc(a.name)} ×${a.mult}"><img src="https://wow.zamimg.com/images/wow/icons/medium/${a.icon}.jpg" alt="${esc(a.name)}" width="20" height="20" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'aura-fallback',textContent:'${esc(a.name)
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)}'}))" /></span>`,
      )
      .join('')}</span>`
  }

  // ===========================================================================
  // Threat overrides
  // ===========================================================================

  const overridesOf = (pid) => state.analysis.overrides[pid]
  const overrideCount = () => Object.keys(state.analysis.overrides).length

  /** Set (or clear, with value undefined) one buff or talent override. */
  function setOverride(pid, kind, key, value) {
    const all = structuredClone(state.analysis.overrides)
    const ov = all[pid] ?? {}
    const group = { ...(ov[kind] ?? {}) }
    if (value === undefined) delete group[key]
    else group[key] = value
    if (Object.keys(group).length) ov[kind] = group
    else delete ov[kind]
    if (Object.keys(ov).length) all[pid] = ov
    else delete all[pid]
    state.analysis.overrides = all
    commit()
  }

  function clearOverrides(pid) {
    const all = { ...state.analysis.overrides }
    if (pid === undefined) state.analysis.overrides = {}
    else {
      delete all[pid]
      state.analysis.overrides = all
    }
    commit()
  }

  /** Short human summary of one player's overrides. */
  function overrideSummary(pid) {
    const ov = overridesOf(pid)
    if (!ov) return []
    const p = player(pid)
    const buffs = WF.BUFFS.filter((b) => ov.buffs?.[b.key] !== undefined).map(
      (b) => `${b.name}: ${ov.buffs[b.key] ? 'on' : 'off'}`,
    )
    const talents = WF.talentsFor(p)
      .filter((t) => ov.talents?.[t.name] !== undefined)
      .map((t) => `${t.name} ${ov.talents[t.name]}/${t.max}`)
    return [...buffs, ...talents]
  }

  function openOverrides(pid = 'all') {
    state.ui.overridesOpen = pid
    state.ui.settingsOpen = false
    commit()
  }

  function renderOverrides() {
    const el = $('#overrides')
    const mode = state.ui.overridesOpen
    el.hidden = !mode || state.view !== 'report'
    if (el.hidden) return
    const head = (title, back = false) => `
      <div class="panel-head">
        ${back ? '<button data-action="open-overrides">← All overrides</button>' : ''}
        <h2>${title}</h2>
        <button data-action="close-overrides">Close</button>
      </div>`

    if (mode === 'all') {
      const ids = Object.keys(state.analysis.overrides).map(Number)
      const candidates = sim().players.filter((p) => !overridesOf(p.id))
      el.innerHTML = `
        ${head('Threat overrides')}
        <p class="hint">Force buffs on or off and change threat talents per player. Overrides win over buff inference, last for the whole report, and are included in shared links.</p>
        <div class="row">
          <button data-action="clear-overrides" ${ids.length ? '' : 'disabled'}>Clear all${ids.length ? ` (${ids.length})` : ''}</button>
        </div>
        ${
          ids.length
            ? `<ul class="ov-list">${ids
                .map(
                  (pid) => `<li>
                    <div class="ov-item-head">
                      <span><span class="swatch" style="background:${colorOf(pid)}"></span> <strong>${esc(player(pid).name)}</strong> <span class="muted">${esc(player(pid).cls)}</span></span>
                      <span class="row">
                        <button data-action="open-overrides" data-pid="${pid}">Edit</button>
                        <button data-action="clear-player-overrides" data-pid="${pid}">Clear</button>
                      </span>
                    </div>
                    <div class="muted">${overrideSummary(pid).map(esc).join(' · ')}</div>
                  </li>`,
                )
                .join('')}</ul>`
            : '<p class="empty">No overrides yet. Right-click a player in the roster or on the chart, or pick one below.</p>'
        }
        <label class="ov-add">Override a player
          <select data-change="ov-add">
            <option value="">Choose…</option>
            ${candidates.map((p) => `<option value="${p.id}">${esc(p.name)} (${esc(p.cls)})</option>`).join('')}
          </select>
        </label>`
      return
    }

    const pid = mode
    const p = player(pid)
    const ov = overridesOf(pid) ?? {}
    const an = state.analysis
    const buffRow = (b) => {
      const forced = ov.buffs?.[b.key]
      const inferred = WF.buffInferred(p, b, an)
      const opt = (label, value, pressed) =>
        `<button data-action="ov-buff" data-pid="${pid}" data-key="${b.key}" data-val="${value}" aria-pressed="${pressed}">${label}</button>`
      return `<div class="ov-row">
        <span>${esc(b.name)} <span class="muted">×${b.mult}</span></span>
        <span class="group" role="group" aria-label="${esc(b.name)}">
          ${opt(`Auto (${inferred ? 'on' : 'off'})`, 'auto', forced === undefined)}
          ${opt('On', 'on', forced === true)}
          ${opt('Off', 'off', forced === false)}
        </span>
      </div>`
    }
    const talents = WF.talentsFor(p)
    const talentRow = (t) => {
      const rank = WF.talentRank(p, t, an)
      const overridden = ov.talents?.[t.name] !== undefined
      const mult = (r) => (1 + t.perRank * r).toFixed(2)
      return `<div class="ov-row">
        <span>${esc(t.name)}${t.schools ? ` <span class="muted">(${t.schools.join('/')})</span>` : ''}${overridden ? ' <span class="tag strong">changed</span>' : ''}</span>
        <select data-change="ov-talent" data-pid="${pid}" data-talent="${esc(t.name)}" aria-label="${esc(t.name)} rank">
          ${Array.from({ length: t.max + 1 }, (_, r) => `<option value="${r}" ${r === rank ? 'selected' : ''}>${r}/${t.max} ×${mult(r)}${r === t.max ? ' (log)' : ''}</option>`).join('')}
        </select>
      </div>`
    }
    // Before/after: same report with this player's overrides removed.
    const t = rosterTime()
    const without = { ...an, overrides: { ...an.overrides } }
    delete without.overrides[pid]
    const now = WF.valueAt(sim(), pid, t)
    const before = WF.valueAt(WF.simulate(report(), pull(), target(), without), pid, t)
    el.innerHTML = `
      ${head(`<span class="swatch" style="background:${colorOf(pid)}"></span> ${esc(p.name)} <span class="muted">${esc(p.cls)} ${esc(p.role)}</span>`, true)}
      <p class="hint">Applies to every pull in this report. Included in shared links.</p>
      <fieldset>
        <legend>Buffs</legend>
        ${WF.BUFFS.map(buffRow).join('')}
      </fieldset>
      <fieldset>
        <legend>Threat talents</legend>
        ${talents.length ? talents.map(talentRow).join('') : `<p class="hint">${p.role === 'pet' ? 'Pets have no threat talents.' : 'No threat talents for this class and spec.'}</p>`}
      </fieldset>
      <p class="ov-effect">Threat at ${fmtTime(t)}: <strong>${fmtNum(now)}</strong> <span class="muted">(without these overrides: ${fmtNum(before)})</span></p>
      <div class="row">
        <button data-action="clear-player-overrides" data-pid="${pid}" ${overridesOf(pid) ? '' : 'disabled'}>Reset ${esc(p.name)}</button>
      </div>`
  }

  // ===========================================================================
  // Settings
  // ===========================================================================

  function renderSettings() {
    const el = $('#settings')
    el.hidden = !state.ui.settingsOpen
    if (!state.ui.settingsOpen) return
    const d = state.display
    const an = state.analysis
    const n = overrideCount()
    el.innerHTML = `
      <div class="panel-head">
        <h2>Settings</h2>
        <button data-action="toggle-settings">Close</button>
      </div>
      <fieldset>
        <legend>Chart</legend>
        <p class="hint">Included in shared links.</p>
        <label><input type="checkbox" data-change="thresholds" ${state.thresholds ? 'checked' : ''} /> Pull thresholds (110% melee / 130% ranged) <kbd>T</kbd></label>
      </fieldset>
      <fieldset>
        <legend>My display</legend>
        <p class="hint">Saved in this browser. Not included in shared links.</p>
        <label>Theme
          <select data-change="theme" aria-label="Theme">
            ${['system', 'light', 'dark'].map((th) => `<option value="${th}" ${d.theme === th ? 'selected' : ''}>${th[0].toUpperCase()}${th.slice(1)}</option>`).join('')}
          </select>
        </label>
        <label><input type="checkbox" data-change="display" data-key="eventDots" ${d.eventDots ? 'checked' : ''} /> Spell event dots on lines</label>
        <label><input type="checkbox" data-change="display" data-key="bossMelee" ${d.bossMelee ? 'checked' : ''} /> Boss melee dots (red)</label>
        <label><input type="checkbox" data-change="display" data-key="resourceDots" ${d.resourceDots ? 'checked' : ''} /> Resource change dots (rage gain, small)</label>
        <label><input type="checkbox" data-change="display" data-key="fixate" ${d.fixate ? 'checked' : ''} /> Shade fixate windows on the chart</label>
        <label>Roster TPS over the last
          <select data-change="tps-window" aria-label="Rolling TPS window">
            ${[3, 5, 10, 30].map((v) => `<option value="${v}" ${d.tpsWindow === v ? 'selected' : ''}>${v}s</option>`).join('')}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <legend>This analysis</legend>
        <p class="hint">Changes the threat numbers. Included in shared links so everyone sees the same chart.</p>
        <label><input type="checkbox" data-change="analysis" data-key="emu" ${an.emu ? 'checked' : ''} /> Threat reduction emulation (Feign Death, etc.)</label>
        <label><input type="checkbox" data-change="analysis" data-key="buffs" ${an.buffs ? 'checked' : ''} /> Infer common threat buffs (Blessing of Salvation)</label>
        <p class="hint">Per-player buff and talent overrides win over inference.</p>
        ${state.view === 'report' ? `<div class="row"><button data-action="open-overrides">Player overrides${n ? ` (${n})` : ''} <kbd>O</kbd></button></div>` : ''}
      </fieldset>`
  }

  // ===========================================================================
  // Chart geometry + sampling
  // ===========================================================================

  const PAD = { l: 56, r: 12, t: 12, b: 22 }
  let sampleCache = { key: '', data: null }

  function setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
    }
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    return { ctx, w, h }
  }

  /** Per-pixel samples of every player (and the aggro holder) in the window. */
  function samples(plotW) {
    const s = sim()
    const [a, b] = windowRange()
    const n = Math.max(2, Math.floor(plotW))
    const key = `${s.key}|${a}|${b}|${n}|${state.mode}`
    if (sampleCache.key === key) return sampleCache.data
    const times = new Float64Array(n + 1)
    const holder = new Float64Array(n + 1)
    for (let i = 0; i <= n; i += 1) {
      times[i] = a + ((b - a) * i) / n
      const seg = WF.segmentAt(s, times[i])
      holder[i] = WF.valueAt(s, seg.pid, times[i])
    }
    const byPid = new Map()
    s.players.forEach((p) => {
      const arr = new Float64Array(n + 1)
      for (let i = 0; i <= n; i += 1) {
        const v = WF.valueAt(s, p.id, times[i])
        arr[i] =
          state.mode === 'rel'
            ? holder[i] > 0
              ? Math.min(400, (v / holder[i]) * 100)
              : 0
            : v
      }
      byPid.set(p.id, arr)
    })
    const data = { n, times, holder, byPid }
    sampleCache = { key, data }
    return data
  }

  function chartGeom(w, h) {
    const plotW = w - PAD.l - PAD.r
    const plotH = h - PAD.t - PAD.b
    const smp = samples(plotW)
    const [x0, x1] = windowRange()
    let y0 = 0
    let y1
    if (state.yRange) {
      ;[y0, y1] = state.yRange
    } else if (state.mode === 'rel') {
      let max = 140
      state.visible.forEach((pid) => {
        const arr = smp.byPid.get(pid)
        if (arr) arr.forEach((v) => (max = Math.max(max, Math.min(v, 250))))
      })
      y1 = max * 1.05
    } else {
      let max = 100
      state.visible.forEach((pid) => {
        const arr = smp.byPid.get(pid)
        if (arr) arr.forEach((v) => (max = Math.max(max, v)))
      })
      if (state.thresholds) smp.holder.forEach((v) => (max = Math.max(max, v * 1.1)))
      y1 = max * 1.06
    }
    return {
      plotW,
      plotH,
      smp,
      x0,
      x1,
      y0,
      y1,
      xOf: (t) => PAD.l + ((t - x0) / (x1 - x0)) * plotW,
      tOf: (x) => x0 + ((x - PAD.l) / plotW) * (x1 - x0),
      yOf: (v) => PAD.t + plotH - ((v - y0) / (y1 - y0)) * plotH,
      vOf: (y) => y0 + ((PAD.t + plotH - y) / plotH) * (y1 - y0),
    }
  }

  function niceStep(range, target) {
    const raw = range / target
    const mag = 10 ** Math.floor(Math.log10(raw))
    const norm = raw / mag
    return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  }

  // ===========================================================================
  // Chart drawing
  // ===========================================================================

  const pointer = { x: null, y: null, down: null, drag: null, hit: null }

  const timeIndex = new Map()
  const meleeIndex = new Map()

  /** Event timestamps per sim (events are already time-sorted). */
  function eventTimes(s) {
    let arr = timeIndex.get(s.key)
    if (!arr) {
      arr = s.events.map((e) => e.t)
      timeIndex.set(s.key, arr)
    }
    return arr
  }

  function meleeMarkers(s) {
    let arr = meleeIndex.get(s.key)
    if (!arr) {
      arr = s.markers.filter((mk) => mk.type === 'bossMelee')
      meleeIndex.set(s.key, arr)
    }
    return arr
  }

  /** Visible players' events with a <= t <= b. */
  function eventsIn(s, a, b) {
    const times = eventTimes(s)
    const out = []
    for (let i = WF.lastAtOrBefore(times, a - 1) + 1; i < times.length && times[i] <= b; i += 1) {
      const e = s.events[i]
      if (state.visible.has(e.pid)) out.push(e)
    }
    return out
  }

  /** Y value of an event dot: the player's threat right after that event. */
  function dotValue(e) {
    if (state.mode !== 'rel') return e.cum
    const s = sim()
    const hv = WF.valueAt(s, WF.segmentAt(s, e.t).pid, e.t)
    return hv > 0 ? Math.min(400, (e.cum / hv) * 100) : 0
  }

  function dotRadius(g) {
    const pxPerSec = g.plotW / ((g.x1 - g.x0) / 1000)
    return pxPerSec < 3 ? 1.6 : pxPerSec < 12 ? 2.2 : 3
  }

  function drawChart() {
    const canvas = $('#chart')
    const { ctx, w, h } = setupCanvas(canvas)
    const g = chartGeom(w, h)
    const s = sim()
    const c = chartColors()
    ctx.font = '11px system-ui'

    // Fixate shading.
    if (state.display.fixate) {
      s.markers
        .filter((mk) => mk.type === 'fixate')
        .forEach((mk) => {
          const xa = Math.max(PAD.l, g.xOf(mk.t))
          const xb = Math.min(PAD.l + g.plotW, g.xOf(mk.end))
          if (xb <= xa) return
          ctx.fillStyle = c.shade
          ctx.fillRect(xa, PAD.t, xb - xa, g.plotH)
          ctx.fillStyle = c.muted
          ctx.textAlign = 'left'
          ctx.fillText(`Fixate: ${player(mk.pid).name}`, xa + 4, PAD.t + 12)
        })
    }

    // Grid + axes.
    ctx.strokeStyle = c.grid
    ctx.fillStyle = c.muted
    ctx.lineWidth = 1
    const yStep = niceStep(g.y1 - g.y0, 6)
    ctx.textAlign = 'right'
    for (let v = Math.ceil(g.y0 / yStep) * yStep; v <= g.y1; v += yStep) {
      const y = Math.round(g.yOf(v)) + 0.5
      ctx.beginPath()
      ctx.moveTo(PAD.l, y)
      ctx.lineTo(PAD.l + g.plotW, y)
      ctx.stroke()
      ctx.fillText(state.mode === 'rel' ? `${Math.round(v)}%` : fmtNum(v), PAD.l - 6, y + 4)
    }
    const xStep = niceStep((g.x1 - g.x0) / 1000, 8) * 1000
    ctx.textAlign = 'center'
    for (let t = Math.ceil(g.x0 / xStep) * xStep; t <= g.x1; t += xStep) {
      const x = Math.round(g.xOf(t)) + 0.5
      ctx.beginPath()
      ctx.moveTo(x, PAD.t)
      ctx.lineTo(x, PAD.t + g.plotH)
      ctx.stroke()
      ctx.fillText(fmtTime(t, xStep < 1000), x, h - 6)
    }
    ctx.strokeStyle = c.frame
    ctx.strokeRect(PAD.l + 0.5, PAD.t + 0.5, g.plotW, g.plotH)

    ctx.save()
    ctx.beginPath()
    ctx.rect(PAD.l, PAD.t, g.plotW, g.plotH)
    ctx.clip()

    // Thresholds.
    if (state.thresholds) {
      ctx.strokeStyle = c.threshold
      ctx.lineWidth = 1
      const levels = [
        { f: 1.1, dash: [6, 4], label: '110% melee pull' },
        { f: 1.3, dash: [2, 3], label: '130% ranged pull' },
      ]
      levels.forEach(({ f, dash, label }) => {
        ctx.setLineDash(dash)
        ctx.beginPath()
        if (state.mode === 'rel') {
          const y = g.yOf(f * 100)
          ctx.moveTo(PAD.l, y)
          ctx.lineTo(PAD.l + g.plotW, y)
        } else {
          g.smp.holder.forEach((v, i) => {
            const x = PAD.l + (i / g.smp.n) * g.plotW
            const y = g.yOf(v * f)
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          })
        }
        ctx.stroke()
        ctx.setLineDash([])
        const lastV = state.mode === 'rel' ? f * 100 : g.smp.holder[g.smp.n] * f
        ctx.fillStyle = c.threshold
        ctx.textAlign = 'right'
        ctx.fillText(label, PAD.l + g.plotW - 4, g.yOf(lastV) - 4)
      })
    }
    if (state.mode === 'rel') {
      ctx.strokeStyle = c.frame
      ctx.beginPath()
      ctx.moveTo(PAD.l, g.yOf(100))
      ctx.lineTo(PAD.l + g.plotW, g.yOf(100))
      ctx.stroke()
    }

    // Player lines: unfocused first, focused on top.
    const order = [...state.visible].sort((x, y) => (x === state.focus) - (y === state.focus))
    order.forEach((pid) => {
      const arr = g.smp.byPid.get(pid)
      if (!arr) return
      const focused = pid === state.focus
      ctx.strokeStyle = colorOf(pid)
      ctx.globalAlpha = state.focus && !focused ? 0.4 : 1
      ctx.lineWidth = focused ? 2.75 : 1.25
      // Pets share their owner's class colour, so draw them dashed.
      ctx.setLineDash(player(pid).role === 'pet' ? [6, 3] : [])
      ctx.beginPath()
      arr.forEach((v, i) => {
        const x = PAD.l + (i / g.smp.n) * g.plotW
        const y = g.yOf(v)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    })
    ctx.setLineDash([])
    ctx.globalAlpha = 1

    // Event dots: spell events in the line colour, resource changes smaller.
    const r = dotRadius(g)
    eventsIn(s, g.x0, g.x1).forEach((e) => {
      const resource = e.kind === 'energize'
      if (resource ? !state.display.resourceDots : !state.display.eventDots) return
      const focused = e.pid === state.focus
      ctx.globalAlpha = state.focus && !focused ? 0.4 : 1
      ctx.fillStyle = colorOf(e.pid)
      ctx.beginPath()
      ctx.arc(g.xOf(e.t), g.yOf(dotValue(e)), resource ? r * 0.55 : focused ? r + 0.5 : r, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // Boss melee dots: red, on the line of whoever got hit.
    if (state.display.bossMelee) {
      ctx.fillStyle = c.melee
      meleeMarkers(s).forEach((mk) => {
        if (mk.t < g.x0 || mk.t > g.x1 || !state.visible.has(mk.pid)) return
        ctx.beginPath()
        ctx.arc(g.xOf(mk.t), g.yOf(valueForMode(mk.pid, mk.t)), r + 0.6, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // Cursor.
    if (state.cursor !== null && state.cursor >= g.x0 && state.cursor <= g.x1) {
      const x = Math.round(g.xOf(state.cursor)) + 0.5
      ctx.strokeStyle = c.cursor
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, PAD.t)
      ctx.lineTo(x, PAD.t + g.plotH)
      ctx.stroke()
      state.visible.forEach((pid) => {
        ctx.fillStyle = colorOf(pid)
        ctx.strokeStyle = c.bg
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(x, g.yOf(valueForMode(pid, state.cursor)), pid === state.focus ? 4.5 : 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      })
    }

    // Hover crosshair + hovered point ring.
    if (pointer.x !== null && !pointer.drag && pointer.x >= PAD.l && pointer.x <= PAD.l + g.plotW) {
      ctx.strokeStyle = c.hover
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      const hx = pointer.hit ? pointer.hit.x : pointer.x
      ctx.moveTo(hx + 0.5, PAD.t)
      ctx.lineTo(hx + 0.5, PAD.t + g.plotH)
      ctx.stroke()
      ctx.setLineDash([])
      if (pointer.hit) {
        ctx.strokeStyle = c.cursor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(pointer.hit.x, pointer.hit.y, r + 4, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Drag rectangle.
    if (pointer.drag) {
      const { x0, y0, x1, y1 } = pointer.drag
      ctx.fillStyle = c.shade
      ctx.strokeStyle = c.cursor
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))
      ctx.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0))
      ctx.setLineDash([])
    }
    ctx.restore()

    if (state.mode === 'rel') {
      ctx.fillStyle = c.muted
      ctx.textAlign = 'left'
      ctx.fillText('% of aggro holder', PAD.l + 4, PAD.t + g.plotH - 6)
    }
  }

  function valueForMode(pid, t) {
    const s = sim()
    const v = WF.valueAt(s, pid, t)
    if (state.mode !== 'rel') return v
    const hv = WF.valueAt(s, WF.segmentAt(s, t).pid, t)
    return hv > 0 ? (v / hv) * 100 : 0
  }

  /** Nearest visible line to a pixel, within a tolerance. */
  function lineAt(x, y, g) {
    const i = Math.round(((x - PAD.l) / g.plotW) * g.smp.n)
    if (i < 0 || i > g.smp.n) return null
    let best = null
    state.visible.forEach((pid) => {
      const arr = g.smp.byPid.get(pid)
      if (!arr) return
      // Check neighbours so vertical steps are clickable too.
      const lo = Math.min(arr[Math.max(0, i - 2)], arr[i], arr[Math.min(g.smp.n, i + 2)])
      const hi = Math.max(arr[Math.max(0, i - 2)], arr[i], arr[Math.min(g.smp.n, i + 2)])
      const yLo = g.yOf(hi)
      const yHi = g.yOf(lo)
      const d = y < yLo ? yLo - y : y > yHi ? y - yHi : 0
      const bias = pid === state.focus ? -1 : 0
      if (d <= 6 && (!best || d + bias < best.d)) best = { pid, d: d + bias }
    })
    return best ? best.pid : null
  }

  /** Nearest event or boss-melee dot to a pixel, within 14px. */
  function nearestPoint(x, y, g) {
    const s = sim()
    const tol = 14
    const dt = ((g.x1 - g.x0) / g.plotW) * tol
    const t = g.tOf(x)
    let best = null
    const consider = (pid, et, v, kind) => {
      const px = g.xOf(et)
      const py = g.yOf(v)
      const d = Math.hypot(px - x, py - y) - (pid === state.focus ? 2 : 0)
      if (d <= tol && (!best || d < best.d)) best = { pid, t: et, x: px, y: py, d, kind }
    }
    eventsIn(s, t - dt, t + dt).forEach((e) => {
      if (e.kind === 'energize' && !state.display.resourceDots) return
      consider(e.pid, e.t, dotValue(e), 'event')
    })
    if (state.display.bossMelee) {
      meleeMarkers(s).forEach((mk) => {
        if (Math.abs(mk.t - t) > dt || !state.visible.has(mk.pid)) return
        consider(mk.pid, mk.t, valueForMode(mk.pid, mk.t), 'melee')
      })
    }
    return best
  }

  /** Snap a time to the nearest event of a visible player within px tolerance. */
  function snapTime(t, g) {
    const tol = ((g.x1 - g.x0) / g.plotW) * 8
    let best = null
    eventsIn(sim(), t - tol, t + tol).forEach((e) => {
      const d = Math.abs(e.t - t)
      if (!best || d < best.d) best = { t: e.t, d }
    })
    return best ? best.t : Math.round(t)
  }

  // ===========================================================================
  // Chart interactions
  // ===========================================================================

  function chartPoint(evt) {
    const rect = $('#chart').getBoundingClientRect()
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top, w: rect.width, h: rect.height }
  }

  function initChart() {
    const canvas = $('#chart')
    const tip = $('#hover-tip')

    canvas.addEventListener('pointerdown', (evt) => {
      const pt = chartPoint(evt)
      pointer.down = { x: pt.x, y: pt.y }
      canvas.setPointerCapture(evt.pointerId)
    })

    canvas.addEventListener('pointermove', (evt) => {
      const pt = chartPoint(evt)
      pointer.x = pt.x
      pointer.y = pt.y
      const g = chartGeom(pt.w, pt.h)
      if (pointer.down) {
        const dx = pt.x - pointer.down.x
        const dy = pt.y - pointer.down.y
        if (pointer.drag || Math.hypot(dx, dy) > 5) {
          const clampX = (x) => Math.min(PAD.l + g.plotW, Math.max(PAD.l, x))
          const clampY = (y) => Math.min(PAD.t + g.plotH, Math.max(PAD.t, y))
          pointer.drag = {
            x0: clampX(pointer.down.x),
            y0: clampY(pointer.down.y),
            x1: clampX(pt.x),
            y1: clampY(pt.y),
          }
          pointer.hit = null
          tip.hidden = true
          redrawCanvases()
          return
        }
      }
      pointer.hit = nearestPoint(pt.x, pt.y, g)
      updateHoverTip(pt, g)
      redrawCanvases()
    })

    canvas.addEventListener('pointerup', (evt) => {
      const pt = chartPoint(evt)
      const g = chartGeom(pt.w, pt.h)
      if (pointer.drag) {
        const { x0, y0, x1, y1 } = pointer.drag
        const ta = g.tOf(Math.min(x0, x1))
        const tb = g.tOf(Math.max(x0, x1))
        if (tb - ta >= 300) {
          state.xRange = [ta, tb]
          // A flat drag (under 12px tall) only zooms time.
          if (Math.abs(y1 - y0) >= 12) {
            state.yRange = [g.vOf(Math.max(y0, y1)), g.vOf(Math.min(y0, y1))]
          }
        }
      } else if (pointer.down) {
        const hit = nearestPoint(pt.x, pt.y, g)
        const pid = hit && hit.d <= 8 ? hit.pid : lineAt(pt.x, pt.y, g)
        if (pid) {
          state.focus = pid
        } else if (pt.x >= PAD.l && pt.x <= PAD.l + g.plotW) {
          stopPlayback()
          state.cursor = snapTime(g.tOf(pt.x), g)
        }
      }
      pointer.down = null
      pointer.drag = null
      commit()
    })

    canvas.addEventListener('pointerleave', () => {
      pointer.x = null
      pointer.hit = null
      tip.hidden = true
      redrawCanvases()
    })

    canvas.addEventListener('dblclick', () => resetZoom())
  }

  const nameHtml = (pid) =>
    `<strong style="color:${colorOf(pid)}">${esc(player(pid).name)}</strong>`

  /** Tooltip anchored to the nearest dot, listing every event at that moment. */
  function updateHoverTip(pt, g) {
    const tip = $('#hover-tip')
    if (pt.x < PAD.l || pt.x > PAD.l + g.plotW) {
      tip.hidden = true
      return
    }
    const s = sim()
    const hit = pointer.hit
    let html
    let ax = pt.x
    let ay = pt.y
    if (hit) {
      const seg = WF.segmentAt(s, hit.t)
      const v = WF.valueAt(s, hit.pid, hit.t)
      const hv = WF.valueAt(s, seg.pid, hit.t)
      const share =
        seg.pid === hit.pid
          ? `<span class="tag strong">${seg.kind === 'fixate' ? 'fixated' : 'aggro'}</span>`
          : hv > 0
            ? `<span class="muted">${fmtPct((v / hv) * 100)} of ${esc(player(seg.pid).name)}</span>`
            : ''
      const list = eventsIn(s, hit.t, hit.t).filter(
        (e) => e.pid === hit.pid && (state.display.resourceDots || e.kind !== 'energize'),
      )
      html = `<div class="tip-head"><span>${nameHtml(hit.pid)} ${share}</span><span class="num">${fmtTime(hit.t, true)}</span></div>
        ${meleeMarkers(s).some((mk) => mk.t === hit.t && mk.pid === hit.pid) ? `<div class="tip-melee">Boss melee hit ${esc(player(hit.pid).name)}</div>` : ''}
        ${list.length ? tipEvents(list) : ''}
        <div class="tip-hint">Click to focus ${esc(player(hit.pid).name)}</div>`
      ax = hit.x
      ay = hit.y
    } else {
      // Away from any dot, only shaded areas (fixates) get a tooltip.
      const t = g.tOf(pt.x)
      const fixate = state.display.fixate
        ? s.markers.find((mk) => mk.type === 'fixate' && t >= mk.t && t <= mk.end)
        : null
      if (!fixate) {
        tip.hidden = true
        return
      }
      html = `<div class="tip-head"><span>Fixated on ${nameHtml(fixate.pid)}</span><span class="num">${fmtTime(fixate.t, true)}–${fmtTime(fixate.end, true)}</span></div>
        <div class="muted">Boss ignores threat for ${((fixate.end - fixate.t) / 1000).toFixed(1)}s</div>`
    }
    tip.innerHTML = html
    tip.hidden = false
    const tw = tip.offsetWidth
    const th = tip.offsetHeight
    const left = ax + 16 + tw > pt.w ? ax - 16 - tw : ax + 16
    const top = Math.min(pt.h - th - 4, Math.max(4, ay - th / 2))
    tip.style.left = `${Math.max(4, left)}px`
    tip.style.top = `${top}px`
  }

  function resetZoom() {
    state.xRange = null
    state.yRange = null
    commit()
  }

  // ===========================================================================
  // Aggro ribbon
  // ===========================================================================

  function ribbonGeom(w) {
    const [x0, x1] = windowRange()
    const plotW = w - PAD.l - PAD.r
    return {
      x0,
      x1,
      plotW,
      xOf: (t) => PAD.l + ((t - x0) / (x1 - x0)) * plotW,
      tOf: (x) => x0 + ((x - PAD.l) / plotW) * (x1 - x0),
    }
  }

  function drawRibbon() {
    const { ctx, w, h } = setupCanvas($('#ribbon'))
    const g = ribbonGeom(w)
    const s = sim()
    const c = chartColors()
    ctx.font = '11px system-ui'
    ctx.fillStyle = c.muted
    ctx.textAlign = 'right'
    ctx.fillText('Aggro', PAD.l - 6, h / 2 + 4)

    ctx.save()
    ctx.beginPath()
    ctx.rect(PAD.l, 0, g.plotW, h)
    ctx.clip()

    const top = 3
    const bandH = h - 6
    s.segments.forEach((seg) => {
      const xa = g.xOf(seg.start)
      const xb = g.xOf(seg.end)
      if (xb < PAD.l || xa > PAD.l + g.plotW) return
      const color = colorOf(seg.pid)
      ctx.fillStyle = color
      ctx.fillRect(xa, top, xb - xa, bandH)
      // Fixates keep the class colour, hatched so they read as forced.
      if (seg.kind === 'fixate') {
        ctx.save()
        ctx.beginPath()
        ctx.rect(xa, top, xb - xa, bandH)
        ctx.clip()
        ctx.strokeStyle = inkOn(color)
        ctx.globalAlpha = 0.35
        ctx.lineWidth = 2
        for (let x = xa - bandH; x < xb; x += 7) {
          ctx.beginPath()
          ctx.moveTo(x, top + bandH)
          ctx.lineTo(x + bandH, top)
          ctx.stroke()
        }
        ctx.restore()
      }
      ctx.strokeStyle = c.bg
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(Math.round(xa) + 0.5, top)
      ctx.lineTo(Math.round(xa) + 0.5, top + bandH)
      ctx.stroke()
      const vis = Math.min(xb, PAD.l + g.plotW) - Math.max(xa, PAD.l)
      const label = seg.kind === 'fixate' ? `Fixate: ${player(seg.pid).name}` : player(seg.pid).name
      if (vis > ctx.measureText(label).width + 10) {
        ctx.fillStyle = inkOn(color)
        ctx.textAlign = 'left'
        ctx.fillText(label, Math.max(xa, PAD.l) + 4, top + bandH / 2 + 4)
      }
    })

    if (state.cursor !== null) {
      const x = Math.round(g.xOf(state.cursor)) + 0.5
      ctx.strokeStyle = c.cursor
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    ctx.restore()
  }

  function initRibbon() {
    const canvas = $('#ribbon')
    const tip = $('#ribbon-tip')
    const segAt = (evt) => {
      const rect = canvas.getBoundingClientRect()
      const x = evt.clientX - rect.left
      if (x < PAD.l || x > rect.width - PAD.r) return null
      return { x, rect, seg: WF.segmentAt(sim(), ribbonGeom(rect.width).tOf(x)) }
    }
    canvas.addEventListener('pointermove', (evt) => {
      const hit = segAt(evt)
      canvas.style.cursor = hit ? 'pointer' : 'default'
      if (!hit) {
        tip.hidden = true
        return
      }
      const { seg } = hit
      tip.innerHTML = `${seg.kind === 'fixate' ? 'Fixated on' : 'Aggro:'} ${nameHtml(seg.pid)} <span class="num">${fmtTime(seg.start, true)}–${fmtTime(seg.end, true)}</span> <span class="muted">(${((seg.end - seg.start) / 1000).toFixed(1)}s) · click to jump</span>`
      tip.hidden = false
      tip.style.left = `${Math.min(hit.rect.width - tip.offsetWidth - 4, Math.max(4, hit.x + 10))}px`
      tip.style.top = `${-tip.offsetHeight - 4}px`
    })
    canvas.addEventListener('pointerleave', () => (tip.hidden = true))
    canvas.addEventListener('click', (evt) => {
      const hit = segAt(evt)
      if (!hit) return
      state.cursor = hit.seg.start
      ensureCursorVisible()
      commit()
    })
  }

  // ===========================================================================
  // Overview strip
  // ===========================================================================

  const overview = { mode: null, startT: 0, startRange: null }

  function drawOverview() {
    const { ctx, w, h } = setupCanvas($('#overview'))
    const s = sim()
    const c = chartColors()
    const plotW = w - PAD.l - PAD.r
    const xOf = (t) => PAD.l + (t / s.D) * plotW
    let max = 1
    state.visible.forEach((pid) => {
      const ser = s.series.get(pid)
      if (ser) ser.v.forEach((v) => (max = Math.max(max, v)))
    })
    ctx.font = '11px system-ui'
    ctx.fillStyle = c.muted
    ctx.textAlign = 'right'
    ctx.fillText('Fight', PAD.l - 6, h / 2 + 4)
    const n = Math.floor(plotW / 2)
    state.visible.forEach((pid) => {
      ctx.strokeStyle = colorOf(pid)
      ctx.globalAlpha = pid === state.focus ? 1 : 0.45
      ctx.lineWidth = pid === state.focus ? 1.5 : 1
      ctx.beginPath()
      for (let i = 0; i <= n; i += 1) {
        const t = (s.D * i) / n
        const x = xOf(t)
        const y = h - 4 - (WF.valueAt(s, pid, t) / max) * (h - 8)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    })
    ctx.globalAlpha = 1
    const [a, b] = windowRange()
    if (state.xRange) {
      ctx.fillStyle = c.veil
      ctx.fillRect(PAD.l, 0, xOf(a) - PAD.l, h)
      ctx.fillRect(xOf(b), 0, PAD.l + plotW - xOf(b), h)
    }
    ctx.strokeStyle = c.cursor
    ctx.lineWidth = 1.5
    ctx.strokeRect(xOf(a), 1, Math.max(2, xOf(b) - xOf(a)), h - 2)
    if (state.cursor !== null) {
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(xOf(state.cursor), 0)
      ctx.lineTo(xOf(state.cursor), h)
      ctx.stroke()
    }
  }

  function initOverview() {
    const canvas = $('#overview')
    const toT = (evt) => {
      const rect = canvas.getBoundingClientRect()
      const plotW = rect.width - PAD.l - PAD.r
      return Math.min(sim().D, Math.max(0, ((evt.clientX - rect.left - PAD.l) / plotW) * sim().D))
    }
    canvas.addEventListener('pointerdown', (evt) => {
      canvas.setPointerCapture(evt.pointerId)
      const t = toT(evt)
      const [a, b] = windowRange()
      overview.startT = t
      overview.startRange = [a, b]
      overview.mode = state.xRange && t >= a && t <= b ? 'pan' : 'select'
    })
    canvas.addEventListener('pointermove', (evt) => {
      if (!overview.mode) return
      const t = toT(evt)
      const D = sim().D
      if (overview.mode === 'pan') {
        const [a, b] = overview.startRange
        const width = b - a
        const na = Math.min(D - width, Math.max(0, a + (t - overview.startT)))
        state.xRange = [na, na + width]
      } else if (Math.abs(t - overview.startT) > D / 200) {
        state.xRange = [Math.min(t, overview.startT), Math.max(t, overview.startT)]
      }
      redrawAll()
    })
    canvas.addEventListener('pointerup', () => {
      overview.mode = null
      commit()
    })
    canvas.addEventListener('dblclick', () => resetZoom())
  }

  function redrawAll() {
    if (!frame) frame = requestAnimationFrame(renderAll)
  }

  // ===========================================================================
  // Playback (folded into the cursor)
  // ===========================================================================

  let playFrame = 0
  let lastTick = 0
  let lastPanelRender = 0

  function startPlayback() {
    const [a, b] = windowRange()
    if (state.cursor === null || state.cursor >= b || state.cursor < a) state.cursor = a
    state.ui.playing = true
    lastTick = performance.now()
    playFrame = requestAnimationFrame(tick)
    commit()
  }

  function stopPlayback() {
    if (!state.ui.playing) return
    state.ui.playing = false
    cancelAnimationFrame(playFrame)
  }

  function tick(now) {
    const dt = now - lastTick
    lastTick = now
    const [, b] = windowRange()
    state.cursor = Math.min(b, state.cursor + dt * state.ui.speed)
    if (state.cursor >= b) {
      stopPlayback()
      commit()
      return
    }
    if (now - lastPanelRender > 120) {
      lastPanelRender = now
      renderRoster()
      renderTransport()
    }
    drawChart()
    drawRibbon()
    drawOverview()
    playFrame = requestAnimationFrame(tick)
  }

  function ensureCursorVisible() {
    if (state.cursor === null || !state.xRange) return
    const [a, b] = state.xRange
    if (state.cursor >= a && state.cursor <= b) return
    const width = b - a
    const D = sim().D
    const na = Math.min(D - width, Math.max(0, state.cursor - width / 2))
    state.xRange = [na, na + width]
  }

  /** Move the cursor to the previous/next event timestamp. */
  function stepEvent(dir) {
    const s = sim()
    const pool = s.events.filter((e) =>
      state.focus ? e.pid === state.focus : state.visible.has(e.pid),
    )
    if (pool.length === 0) return
    const cur = state.cursor ?? (dir > 0 ? -1 : Infinity)
    const next =
      dir > 0 ? pool.find((e) => e.t > cur) : [...pool].reverse().find((e) => e.t < cur)
    if (!next) return
    state.cursor = next.t
    ensureCursorVisible()
    commit()
  }

  // ===========================================================================
  // Actions
  // ===========================================================================

  /** The n players with the most threat at the roster's time. */
  const topIds = (n) => rosterOrder().slice(0, n)

  const rosterOrder = () => {
    const s = sim()
    const t = rosterTime()
    return [...s.players]
      .sort((x, y) => WF.valueAt(s, y.id, t) - WF.valueAt(s, x.id, t))
      .map((p) => p.id)
  }

  const actions = {
    home: (el, evt) => {
      evt.preventDefault()
      goHome()
    },
    'open-report': () => openDialog(),
    'toggle-settings': () => {
      state.ui.settingsOpen = !state.ui.settingsOpen
      if (state.ui.settingsOpen) state.ui.overridesOpen = null
      commit()
    },
    'sign-in': () => {
      state.ui.signedIn = true
      commit()
    },
    'sign-out': () => {
      state.ui.signedIn = false
      commit()
    },
    'toggle-star': () => toggleSet(state.ui.starredReports, state.reportCode),
    'star-report': (el) => toggleSet(state.ui.starredReports, el.dataset.code),
    'star-guild': (el) => toggleSet(state.ui.starredGuilds, el.dataset.guild),
    'toggle-guild': (el) => toggleSet(state.ui.openGuilds, el.dataset.guild),
    'load-report': (el) => openReport(el.dataset.code),
    'rail-tab': (el) => {
      state.ui.railTab = el.dataset.tab
      if (state.ui.railCollapsed) state.ui.railCollapsed = false
      commit()
    },
    'rail-collapse': () => {
      state.ui.railCollapsed = !state.ui.railCollapsed
      commit()
    },
    'select-pull': (el) => {
      enterPull(Number(el.dataset.pull))
      state.ui.railOpen = false
      commit(true)
    },
    'select-target': (el) => {
      state.ui.railOpen = false
      setTarget(el.dataset.target)
    },
    'toggle-visible': (el) => {
      const pid = Number(el.dataset.pid)
      toggleSet(state.visible, pid)
    },
    'toggle-pin': (el) => toggleSet(state.pinned, Number(el.dataset.pid)),
    focus: (el) => {
      const pid = Number(el.dataset.pid)
      state.focus = state.focus === pid ? null : pid
      state.visible.add(pid)
      state.ui.expandedSpells.clear()
      commit()
    },
    // All is a toggle: from a partial set it shows everyone, from everyone it hides all.
    'toggle-all': () => {
      const everyone = sim().players.map((p) => p.id)
      state.visible = state.visible.size === everyone.length ? new Set() : new Set(everyone)
      commit()
    },
    'show-top': () => {
      state.visible = new Set(topIds(5))
      commit()
    },
    'show-tanks': () => {
      state.visible = new Set(sim().players.filter((p) => p.role === 'tank').map((p) => p.id))
      commit()
    },
    mode: (el) => {
      state.mode = el.dataset.mode
      state.yRange = null
      commit()
    },
    'reset-zoom': () => resetZoom(),
    'open-overrides': (el) => {
      const pid = el.dataset.pid ? Number(el.dataset.pid) : 'all'
      const same = state.ui.overridesOpen === pid
      // The roster button toggles; links and badges always open.
      if (same && el.closest('.roster-head')) {
        state.ui.overridesOpen = null
        commit()
      } else openOverrides(pid)
    },
    'close-overrides': () => {
      state.ui.overridesOpen = null
      commit()
    },
    'clear-overrides': () => clearOverrides(),
    'clear-player-overrides': (el) => clearOverrides(Number(el.dataset.pid)),
    'ov-buff': (el) => {
      const v = el.dataset.val
      setOverride(Number(el.dataset.pid), 'buffs', el.dataset.key, v === 'auto' ? undefined : v === 'on')
    },
    jump: (el) => {
      stopPlayback()
      state.cursor = Number(el.dataset.t)
      ensureCursorVisible()
      commit()
    },
    'toggle-play': () => (state.ui.playing ? (stopPlayback(), commit()) : startPlayback()),
    'clear-cursor': () => {
      stopPlayback()
      state.cursor = null
      commit()
    },
    'toggle-breakdown': () => {
      state.ui.breakdownOpen = !state.ui.breakdownOpen
      commit()
    },
    'expand-spell': (el) => toggleSet(state.ui.expandedSpells, el.dataset.spell),
    'mobile-rail': () => {
      state.ui.railOpen = !state.ui.railOpen
      state.ui.rosterOpen = false
      commit()
    },
    'toggle-roster': () => {
      if (isMobile()) {
        state.ui.rosterOpen = !state.ui.rosterOpen
        state.ui.railOpen = false
      } else {
        state.ui.rosterHidden = !state.ui.rosterHidden
      }
      commit()
      redrawCanvases()
    },
    'mobile-tab': (el) => {
      state.ui.mobileTab = el.dataset.tab
      commit()
    },
    shortcuts: () => $('#shortcuts').showModal(),
  }

  function toggleSet(set, value) {
    if (set.has(value)) set.delete(value)
    else set.add(value)
    commit()
  }

  const changes = {
    pull: (el) => {
      enterPull(Number(el.value))
      commit(true)
    },
    target: (el) => setTarget(el.value),
    thresholds: (el) => {
      state.thresholds = el.checked
      commit()
    },
    speed: (el) => {
      state.ui.speed = Number(el.value)
      commit()
    },
    display: (el) => {
      state.display[el.dataset.key] = el.checked
      commit()
    },
    'ov-add': (el) => {
      if (el.value) openOverrides(Number(el.value))
    },
    'ov-talent': (el) => {
      const pid = Number(el.dataset.pid)
      const t = WF.talentsFor(player(pid)).find((x) => x.name === el.dataset.talent)
      const rank = Number(el.value)
      setOverride(pid, 'talents', t.name, rank === t.max ? undefined : rank)
    },
    'tps-window': (el) => {
      state.display.tpsWindow = Number(el.value)
      commit()
    },
    theme: (el) => {
      state.display.theme = el.value
      commit()
    },
    analysis: (el) => {
      state.analysis[el.dataset.key] = el.checked
      commit()
    },
  }

  // ===========================================================================
  // Dialogs
  // ===========================================================================

  function openDialog() {
    const dlg = $('#open-dialog')
    $('#open-error').hidden = true
    $('#open-input').value = ''
    dlg.showModal()
  }

  function initDialogs() {
    $('#open-form').addEventListener('submit', (evt) => {
      if (evt.submitter && evt.submitter.value === 'cancel') return
      const code = parseReportInput($('#open-input').value)
      if (!code) {
        evt.preventDefault()
        const err = $('#open-error')
        err.textContent =
          "That doesn't look like a Warcraft Logs report. Paste a link like https://fresh.warcraftlogs.com/reports/aB3dK9xQ2mN7pL4r"
        err.hidden = false
        return
      }
      openReport(code)
    })

    document.addEventListener('submit', (evt) => {
      if (evt.target.id !== 'home-open') return
      evt.preventDefault()
      const code = parseReportInput($('#home-input').value)
      if (!code) {
        const err = $('#home-error')
        err.textContent = "That doesn't look like a Warcraft Logs report URL. Paste the full link from your browser's address bar."
        err.hidden = false
        return
      }
      openReport(code)
    })

    const input = $('#switcher-input')
    const list = $('#switcher-list')
    let active = 0
    const entries = () =>
      state.view === 'report'
        ? report().pulls.flatMap((p) =>
            p.targets.map((t) => ({
              label: `#${p.id} ${p.name} (${p.outcome === 'kill' ? 'Kill' : `Wipe ${p.pct}%`}) — ${t.name}`,
              pull: p.id,
              target: t.id,
            })),
          )
        : []
    const filtered = () => {
      const q = input.value.toLowerCase().split(/\s+/).filter(Boolean)
      return entries().filter((e) => q.every((w) => e.label.toLowerCase().includes(w)))
    }
    const paint = () => {
      const items = filtered()
      active = Math.min(active, Math.max(0, items.length - 1))
      list.innerHTML = items
        .map(
          (e, i) =>
            `<li class="${i === active ? 'is-active' : ''}"><button type="button" data-i="${i}">${esc(e.label)}</button></li>`,
        )
        .join('')
    }
    const choose = (e) => {
      if (!e) return
      $('#switcher').close()
      if (e.pull !== state.pullId) enterPull(e.pull, e.target)
      else state.targetId = e.target
      commit(true)
    }
    input.addEventListener('input', () => {
      active = 0
      paint()
    })
    input.addEventListener('keydown', (evt) => {
      if (evt.key === 'ArrowDown') active += 1
      else if (evt.key === 'ArrowUp') active = Math.max(0, active - 1)
      else if (evt.key === 'Enter') {
        evt.preventDefault()
        choose(filtered()[active])
        return
      } else return
      evt.preventDefault()
      paint()
    })
    list.addEventListener('click', (evt) => {
      const btn = evt.target.closest('button')
      if (btn) choose(filtered()[Number(btn.dataset.i)])
    })
    window.openSwitcher = () => {
      if (state.view !== 'report') return
      input.value = ''
      active = 0
      paint()
      $('#switcher').showModal()
    }

    $('#shortcut-list').innerHTML = SHORTCUTS.map(
      ([k, d]) => `<dt><kbd>${esc(k)}</kbd></dt><dd>${esc(d)}</dd>`,
    ).join('')
  }

  const SHORTCUTS = [
    ['⌘O', 'Open a report from a URL'],
    ['⌘K', 'Jump to a pull or target'],
    ['⌘← / ⌘→', 'Previous / next pull'],
    ['← / →', 'Step the cursor to the previous / next event (focused player, or all visible)'],
    ['Shift + ← / →', 'Move the cursor 1 second'],
    ['Space', 'Play / pause from the cursor'],
    ['[ / ]', 'Focus the player above / below in the roster'],
    ['Double-click roster row', 'Show only that player (again to show everyone)'],
    ['P', 'Pin / unpin the focused player'],
    ['H', 'Hide / show the focused player'],
    ['I', 'Show / hide player info'],
    ['O', 'Player buff and talent overrides'],
    ['Right-click a player', 'Player menu: focus, show only, pin, overrides'],
    ['R', 'Show / hide the roster'],
    ['A', 'Toggle absolute / % of aggro holder'],
    ['T', 'Toggle pull threshold lines'],
    ['0 or double-click', 'Reset zoom'],
    ['Esc', 'Close panel, or clear the cursor'],
    [',', 'Settings'],
    ['?', 'This list'],
  ]

  // ===========================================================================
  // Keyboard
  // ===========================================================================

  function onKey(evt) {
    const mod = evt.metaKey || evt.ctrlKey
    if (mod && evt.key.toLowerCase() === 'o') {
      evt.preventDefault()
      openDialog()
      return
    }
    if (mod && evt.key.toLowerCase() === 'k') {
      evt.preventDefault()
      window.openSwitcher()
      return
    }
    if (document.querySelector('dialog[open]')) return
    const tag = evt.target.tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (evt.key === 'Escape') evt.target.blur()
      return
    }
    if (state.view !== 'report') return
    // Let Space/Enter activate a focused button instead of playback.
    if (tag === 'BUTTON' && (evt.key === ' ' || evt.key === 'Enter')) return

    const key = evt.key
    if (mod && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      evt.preventDefault()
      stepPull(key === 'ArrowLeft' ? -1 : 1)
      return
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      evt.preventDefault()
      const dir = key === 'ArrowLeft' ? -1 : 1
      stopPlayback()
      if (evt.shiftKey) {
        state.cursor = Math.min(sim().D, Math.max(0, (state.cursor ?? windowRange()[0]) + dir * 1000))
        ensureCursorVisible()
        commit()
      } else stepEvent(dir)
      return
    }
    const handlers = {
      ' ': () => (state.ui.playing ? (stopPlayback(), commit()) : startPlayback()),
      '[': () => cycleFocus(-1),
      ']': () => cycleFocus(1),
      p: () => state.focus && toggleSet(state.pinned, state.focus),
      h: () => state.focus && toggleSet(state.visible, state.focus),
      i: () => actions['toggle-breakdown'](),
      o: () => {
        state.ui.overridesOpen = state.ui.overridesOpen ? null : 'all'
        if (state.ui.overridesOpen) state.ui.settingsOpen = false
        commit()
      },
      r: () => actions['toggle-roster'](),
      a: () => {
        state.mode = state.mode === 'rel' ? 'abs' : 'rel'
        state.yRange = null
        commit()
      },
      t: () => {
        state.thresholds = !state.thresholds
        commit()
      },
      0: () => resetZoom(),
      ',': () => actions['toggle-settings'](),
      '?': () => $('#shortcuts').showModal(),
      Escape: () => {
        if (closeContextMenu()) return
        if (state.ui.settingsOpen) state.ui.settingsOpen = false
        else if (state.ui.overridesOpen) state.ui.overridesOpen = null
        else if (state.ui.rosterOpen || state.ui.railOpen) {
          state.ui.rosterOpen = false
          state.ui.railOpen = false
        } else {
          stopPlayback()
          state.cursor = null
        }
        commit()
      },
    }
    // Single-key shortcuts never fire with ⌘/Ctrl/Alt (so ⌘R still reloads),
    // and letters also need Shift up.
    if (mod || evt.altKey) return
    if (/^[a-z]$/i.test(key) && evt.shiftKey) return
    const handler = handlers[key.length === 1 ? key.toLowerCase() : key] ?? handlers[key]
    if (handler) {
      evt.preventDefault()
      handler()
    }
  }

  function cycleFocus(dir) {
    const order = rosterOrder().filter((id) => state.visible.has(id))
    if (order.length === 0) return
    const i = order.indexOf(state.focus)
    const next = order[(i + dir + order.length) % order.length] ?? order[0]
    state.focus = next
    state.ui.expandedSpells.clear()
    commit()
  }

  // ===========================================================================
  // Player context menu (right-click a roster row or a line)
  // ===========================================================================

  function openContextMenu(pid, x, y) {
    const menu = $('#ctx-menu')
    const p = player(pid)
    const item = (cmd, label) =>
      `<button role="menuitem" data-action="ctx" data-cmd="${cmd}" data-pid="${pid}">${label}</button>`
    menu.innerHTML = `
      <div class="ctx-title"><span class="swatch" style="background:${colorOf(pid)}"></span> ${esc(p.name)}</div>
      ${item('focus', state.focus === pid ? 'Unfocus' : 'Focus')}
      ${item('only', 'Show only this player')}
      ${item('visible', state.visible.has(pid) ? 'Hide line' : 'Show line')}
      ${item('pin', state.pinned.has(pid) ? 'Unpin' : 'Pin across pulls')}
      <hr />
      ${item('overrides', 'Override buffs and talents…')}
      ${overridesOf(pid) ? item('clear', 'Clear overrides') : ''}`
    menu.hidden = false
    const r = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(4, Math.min(x, innerWidth - r.width - 4))}px`
    menu.style.top = `${Math.max(4, Math.min(y, innerHeight - r.height - 4))}px`
    menu.querySelector('button').focus()
  }

  /** Close the menu; returns whether it was open. */
  function closeContextMenu() {
    const menu = $('#ctx-menu')
    if (menu.hidden) return false
    menu.hidden = true
    return true
  }

  actions.ctx = (el) => {
    const pid = Number(el.dataset.pid)
    closeContextMenu()
    switch (el.dataset.cmd) {
      case 'focus':
        state.focus = state.focus === pid ? null : pid
        state.visible.add(pid)
        break
      case 'only':
        state.visible = new Set([pid])
        state.focus = pid
        break
      case 'visible':
        if (state.visible.has(pid)) state.visible.delete(pid)
        else state.visible.add(pid)
        break
      case 'pin':
        if (state.pinned.has(pid)) state.pinned.delete(pid)
        else state.pinned.add(pid)
        break
      case 'overrides':
        openOverrides(pid)
        return
      case 'clear':
        clearOverrides(pid)
        return
    }
    commit()
  }

  document.addEventListener('contextmenu', (evt) => {
    const row = evt.target.closest('.roster-row')
    const main = row && row.querySelector('.roster-main[data-pid]')
    if (main) {
      evt.preventDefault()
      openContextMenu(Number(main.dataset.pid), evt.clientX, evt.clientY)
      return
    }
    if (evt.target.id === 'chart') {
      const pt = chartPoint(evt)
      const g = chartGeom(pt.w, pt.h)
      const hit = nearestPoint(pt.x, pt.y, g)
      const pid = hit ? hit.pid : lineAt(pt.x, pt.y, g)
      if (pid) {
        evt.preventDefault()
        openContextMenu(pid, evt.clientX, evt.clientY)
      }
    }
  })

  document.addEventListener('pointerdown', (evt) => {
    if (!evt.target.closest('#ctx-menu')) closeContextMenu()
  })
  window.addEventListener('resize', closeContextMenu)
  window.addEventListener('blur', closeContextMenu)

  $('#ctx-menu').addEventListener('keydown', (evt) => {
    const items = [...$('#ctx-menu').querySelectorAll('button')]
    const i = items.indexOf(document.activeElement)
    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
      evt.preventDefault()
      evt.stopPropagation()
      const next = (i + (evt.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next].focus()
    } else if (evt.key === 'Escape') {
      evt.stopPropagation()
      closeContextMenu()
    } else if (evt.key !== 'Enter' && evt.key !== ' ' && evt.key !== 'Tab') {
      evt.stopPropagation()
    }
  })

  // ===========================================================================
  // Boot
  // ===========================================================================

  document.addEventListener('click', (evt) => {
    const el = evt.target.closest('[data-action]')
    if (!el || el.disabled) return
    const fn = actions[el.dataset.action]
    if (fn) fn(el, evt)
  })

  // Double-clicking a roster row isolates that player; again restores everyone.
  document.addEventListener('dblclick', (evt) => {
    const el = evt.target.closest('.roster-main[data-pid]')
    if (!el) return
    const pid = Number(el.dataset.pid)
    const isolated = state.visible.size === 1 && state.visible.has(pid)
    state.visible = isolated ? new Set(sim().players.map((p) => p.id)) : new Set([pid])
    state.focus = pid
    state.ui.expandedSpells.clear()
    commit()
  })

  document.addEventListener('change', (evt) => {
    const el = evt.target.closest('[data-change]')
    if (!el) return
    const fn = changes[el.dataset.change]
    if (fn) fn(el)
  })

  document.addEventListener('input', (evt) => {
    if (evt.target.dataset.input !== 'roster-filter') return
    state.ui.rosterFilter = evt.target.value
    renderRoster()
  })

  document.addEventListener('keydown', onKey)
  window.addEventListener('hashchange', () => {
    readUrl()
    redrawAll()
  })
  window.addEventListener('popstate', () => {
    readUrl()
    redrawAll()
  })
  darkQuery.addEventListener('change', () => redrawAll())
  new ResizeObserver(() => redrawCanvases()).observe($('#chart-wrap'))

  initChart()
  initRibbon()
  initOverview()
  initDialogs()
  readUrl()
  if (state.view === 'home') state.ui.railTab = 'library'
  renderAll()
})()
