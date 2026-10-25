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
    thresholds: true,
    analysis: { buffs: true, emu: true, noSalv: [] },
    display: {
      bossMelee: true,
      fixate: true,
      energize: true,
      hoverTip: true,
      ...(prefs.display ?? {}),
    },
    ui: {
      railCollapsed: prefs.railCollapsed ?? false,
      railTab: 'outline',
      breakdownOpen: prefs.breakdownOpen ?? true,
      settingsOpen: false,
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
      noSalv: idList(q.get('nosalv')),
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
    state.thresholds = q.get('thr') !== '0'
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
      if (!state.thresholds) q.set('thr', '0')
      if (!state.analysis.buffs) q.set('buffs', '0')
      if (!state.analysis.emu) q.set('emu', '0')
      if (state.analysis.noSalv.length) {
        q.set('nosalv', state.analysis.noSalv.join(','))
      }
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
    const app = $('#app')
    app.classList.toggle('is-home', state.view === 'home')
    app.classList.toggle('rail-collapsed', state.ui.railCollapsed)
    app.classList.toggle('rail-open', state.ui.railOpen)
    app.classList.toggle('roster-open', state.ui.rosterOpen)
    app.classList.toggle('tab-breakdown', state.ui.mobileTab === 'breakdown')
    $('#home').hidden = state.view !== 'home'
    $('#analysis').hidden = state.view !== 'report'
    document.querySelectorAll('[data-action="mobile-tab"]').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.tab === state.ui.mobileTab)),
    )

    renderHeader()
    renderRail()
    renderSettings()
    if (state.view === 'home') {
      renderHome()
      return
    }
    renderToolbar()
    renderRoster()
    renderBreakdown()
    drawChart()
    drawRibbon()
    drawOverview()
  }

  // ===========================================================================
  // Header
  // ===========================================================================

  function renderHeader() {
    const crumbs = $('#crumbs')
    if (state.view === 'home') {
      crumbs.innerHTML = '<span class="muted">Home</span>'
    } else {
      const rep = report()
      const starred = state.ui.starredReports.has(rep.code)
      crumbs.innerHTML = `
        <span class="report-title" title="${esc(rep.title)}">${esc(rep.title)}</span>
        <button class="star" data-action="toggle-star" aria-pressed="${starred}">${starred ? 'Starred' : 'Star'}</button>
        <span class="sep">/</span>
        <select data-change="pull" aria-label="Pull">
          ${rep.pulls
            .map(
              (p) =>
                `<option value="${p.id}" ${p.id === state.pullId ? 'selected' : ''}>#${p.id} ${esc(p.name)} (${p.outcome === 'kill' ? 'Kill' : `Wipe ${p.pct}%`})</option>`,
            )
            .join('')}
        </select>
        <span class="sep">/</span>
        <select data-change="target" aria-label="Target">
          ${pull()
            .targets.map(
              (t) =>
                `<option value="${t.id}" ${t.id === target().id ? 'selected' : ''}>${esc(t.name)}</option>`,
            )
            .join('')}
        </select>`
    }
    $('#account').innerHTML = state.ui.signedIn
      ? `<button data-action="sign-out" title="Signed in with Warcraft Logs. Click to sign out.">Tstirrat<span class="long"> (sign out)</span></button>`
      : `<button data-action="sign-in">Sign in<span class="long"> with Warcraft Logs</span></button>`
  }

  // ===========================================================================
  // Rail: outline + library
  // ===========================================================================

  function renderRail() {
    const inReport = state.view === 'report'
    const tab = inReport ? state.ui.railTab : 'library'
    const collapsed = state.ui.railCollapsed
    const head = `
      <div class="rail-head">
        <div class="tabs" role="tablist">
          <button role="tab" data-action="rail-tab" data-tab="outline" aria-pressed="${tab === 'outline'}" ${inReport ? '' : 'disabled'}>${collapsed ? 'Pulls' : 'This report'}</button>
          <button role="tab" data-action="rail-tab" data-tab="library" aria-pressed="${tab === 'library'}">${collapsed ? 'Lib' : 'Library'}</button>
        </div>
        <button class="desktop-only" data-action="rail-collapse" aria-label="${collapsed ? 'Expand' : 'Collapse'} navigation">${collapsed ? '»' : '«'}</button>
      </div>`
    const body =
      tab === 'outline' && inReport ? renderOutline() : renderLibrary()
    $('#rail').innerHTML = `${head}<div class="rail-body">${body}</div>`
  }

  function renderOutline() {
    const rep = report()
    return `
      <p class="muted" style="margin:2px 6px 8px">${esc(rep.guild)} · ${esc(rep.date)}</p>
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
    $('#home').innerHTML = `
      <div class="home-inner">
        <form class="home-open" id="home-open">
          <input id="home-input" placeholder="Paste a Warcraft Logs report URL" aria-label="Warcraft Logs report URL" />
          <button class="primary">Open</button>
        </form>
        <p class="error" id="home-error" hidden></p>
        <p class="muted">Wireframe note: the rail shows the same library. On home it is the main content; inside a report it is one click away.</p>
        <div class="home-cols">${renderLibrary()}</div>
      </div>`
  }

  // ===========================================================================
  // Toolbar
  // ===========================================================================

  function renderToolbar() {
    const [a, b] = windowRange()
    const zoomed = Boolean(state.xRange || state.yRange)
    $('#toolbar').innerHTML = `
      <div class="group">
        <label for="preset">Show</label>
        <select id="preset" data-change="preset">
          <option value="">Custom (${state.visible.size})</option>
          <option value="all">Everyone</option>
          <option value="tanks">Tanks only</option>
          <option value="focus-tanks">Focused + tanks</option>
          <option value="focus">Focused only</option>
          <option value="pinned">Pinned only</option>
        </select>
      </div>
      <div class="group" role="group" aria-label="Threat scale">
        <button data-action="mode" data-mode="abs" aria-pressed="${state.mode === 'abs'}">Absolute</button>
        <button data-action="mode" data-mode="rel" aria-pressed="${state.mode === 'rel'}">% of aggro holder</button>
      </div>
      <label class="group"><input type="checkbox" data-change="thresholds" ${state.thresholds ? 'checked' : ''} /> Pull thresholds (110% / 130%)</label>
      <div class="group">
        <span class="readout">Window ${fmtTime(a)}–${fmtTime(b)}</span>
        <button data-action="reset-zoom" ${zoomed ? '' : 'disabled'}>Reset zoom</button>
      </div>
      <div class="group">
        <button data-action="toggle-play" aria-pressed="${state.ui.playing}">${state.ui.playing ? 'Pause' : 'Play'}</button>
        <select data-change="speed" aria-label="Playback speed">
          ${[1, 2, 4, 8].map((s) => `<option value="${s}" ${s === state.ui.speed ? 'selected' : ''}>${s}×</option>`).join('')}
        </select>
        <span class="readout">Cursor ${state.cursor === null ? '—' : fmtTime(state.cursor, true)}</span>
        ${state.cursor === null ? '' : '<button data-action="clear-cursor">Clear</button>'}
      </div>
      <button class="desktop-only" data-action="shortcuts">Shortcuts <kbd>?</kbd></button>`
  }

  // ===========================================================================
  // Roster + events at t
  // ===========================================================================

  function rosterTime() {
    return state.cursor ?? windowRange()[1]
  }

  function renderRoster() {
    const s = sim()
    const t = rosterTime()
    const [a, b] = windowRange()
    const seg = WF.segmentAt(s, t)
    const holderVal = WF.valueAt(s, seg.pid, t)
    const filter = state.ui.rosterFilter.toLowerCase()
    const deadAt = new Set(
      s.markers.filter((mk) => mk.type === 'death' && mk.t <= t).map((mk) => mk.pid),
    )

    const rows = s.players
      .map((p) => {
        const v = WF.valueAt(s, p.id, t)
        const tps = (WF.valueAt(s, p.id, b) - WF.valueAt(s, p.id, a)) / ((b - a) / 1000)
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
      return `<li class="roster-row ${state.focus === p.id ? 'is-focus' : ''} ${visible ? '' : 'is-hidden'}">
        <button data-action="toggle-visible" data-pid="${p.id}" aria-pressed="${visible}" aria-label="${visible ? 'Hide' : 'Show'} ${esc(p.name)}">${visible ? 'On' : 'Off'}</button>
        <button data-action="toggle-pin" data-pid="${p.id}" aria-pressed="${pinned}" aria-label="${pinned ? 'Unpin' : 'Pin'} ${esc(p.name)}">Pin</button>
        <button class="roster-main" data-action="focus" data-pid="${p.id}" aria-label="Focus ${esc(p.name)}">
          <span class="swatch" style="background:${p.color}"></span>
          <span class="roster-name">${esc(p.name)}${tags}</span>
          <span class="num">${fmtNum(v)}</span>
          <span class="num">${fmtPct(pct)}</span>
          <span class="num">${fmtNum(tps)}</span>
          <span class="bar"><i style="width:${(v / max) * 100}%"></i></span>
        </button>
      </li>`
    }
    const absentRow = (p) => `<li class="roster-row is-absent">
        <button disabled>—</button>
        <button data-action="toggle-pin" data-pid="${p.id}" aria-pressed="true" aria-label="Unpin ${esc(p.name)}">Pin</button>
        <span class="roster-main"><span class="swatch" style="background:${p.color}"></span><span class="roster-name">${esc(p.name)} <span class="tag">not in this pull</span></span><span></span><span></span><span></span></span>
      </li>`

    const label =
      state.cursor === null
        ? `Roster at end of window (${fmtTime(t)})`
        : `Roster at ${fmtTime(t, true)}`

    const refocus =
      document.activeElement?.dataset?.input === 'roster-filter'
    $('#roster').innerHTML = `
      <div class="roster-head">
        <div class="row"><h2>${label}</h2></div>
        <div class="row">
          <input type="search" placeholder="Filter players" aria-label="Filter players" data-input="roster-filter" value="${esc(state.ui.rosterFilter)}" />
          <button data-action="show-all">All on</button>
          <button data-action="hide-all">All off</button>
        </div>
      </div>
      <div class="roster-cols"><span></span><span>Player</span><span class="num">Threat</span><span class="num">% aggro</span><span class="num">TPS</span></div>
      <ul class="roster-list">${rows.map(row).join('')}${absent.map(absentRow).join('')}</ul>
      <section class="events" aria-live="polite">${renderEventsAtT()}</section>`

    // Keep the filter input focused while typing.
    if (refocus) {
      const input = document.querySelector('[data-input="roster-filter"]')
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    }
  }

  /** Events at the latest timestamp <= cursor, for visible players. */
  function eventsAtCursor() {
    if (state.cursor === null) return { t: null, list: [] }
    const s = sim()
    const relevant = s.events.filter(
      (e) =>
        state.visible.has(e.pid) &&
        e.t <= state.cursor &&
        (state.display.energize || e.kind !== 'energize'),
    )
    if (relevant.length === 0) return { t: null, list: [] }
    const t = relevant[relevant.length - 1].t
    const list = relevant
      .filter((e) => e.t === t)
      .sort((x, y) => (y.pid === state.focus) - (x.pid === state.focus))
    return { t, list }
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

  function renderEventsAtT() {
    const { t, list } = eventsAtCursor()
    if (state.cursor === null) {
      return `<h3>Events at cursor</h3><p class="muted">Click empty chart space to place a cursor. Every event at that exact moment, with its threat math, shows here. ←/→ steps event by event.</p>`
    }
    if (t === null) {
      return `<h3>Events at cursor</h3><p class="muted">No events from visible players before ${fmtTime(state.cursor, true)}.</p>`
    }
    return `<h3>${list.length} event${list.length === 1 ? '' : 's'} at ${fmtTime(t, true)}</h3>
      <ul class="event-group">${list
        .map((e) => {
          const p = player(e.pid)
          const mods = e.mods.length
            ? e.mods.map((m) => `${esc(m.name)} ×${m.mult}`).join(' · ')
            : e.coeff === null
              ? ''
              : 'No modifiers'
          return `<li class="event ${e.pid === state.focus ? 'is-focus' : ''}">
            <div class="event-top">
              <span><span class="swatch" style="display:inline-block;background:${p.color}"></span> ${esc(p.name)} · <strong>${esc(e.spell)}</strong>${e.hitType !== 'hit' ? ` <span class="tag">${e.hitType}</span>` : ''}</span>
              <span class="num">→ ${fmtNum(e.cum)}</span>
            </div>
            <div class="event-math">${eventMath(e)}</div>
            ${mods ? `<div class="event-mods">${mods}</div>` : ''}
          </li>`
        })
        .join('')}</ul>`
  }

  // ===========================================================================
  // Breakdown drawer
  // ===========================================================================

  function renderBreakdown() {
    const open = state.ui.breakdownOpen || state.ui.mobileTab === 'breakdown'
    const drawer = $('#drawer')
    drawer.classList.toggle('is-closed', !open)
    const [a, b] = windowRange()
    const secs = (b - a) / 1000
    const p = state.focus ? player(state.focus) : null

    const head = `<div class="drawer-head">
      <button class="desktop-only" data-action="toggle-breakdown" aria-expanded="${open}">${open ? 'Hide' : 'Show'} breakdown <kbd>B</kbd></button>
      <h2>${p ? `${esc(p.name)} — spell breakdown` : 'Spell breakdown'}</h2>
      <span class="muted">Window ${fmtTime(a)}–${fmtTime(b)} (${secs.toFixed(1)}s)</span>
      ${p ? `<span class="muted">Initial auras: ${esc(initialAuras(p))}</span>` : ''}
    </div>`

    if (!p) {
      drawer.innerHTML = `${head}<div class="drawer-body"><p class="empty">Focus a player to see which spells made their threat in this window. Click a line on the chart or a name in the roster.</p></div>`
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
          ? g.sample.mods.map((m) => `${esc(m.name)} ×${m.mult}`).join(' · ')
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

    drawer.innerHTML = `${head}<div class="drawer-body"><table>
      <thead><tr><th>Spell</th><th class="num">Hits</th><th class="num">Raw</th><th class="num">Bonus</th><th class="num">Coeff</th><th class="num">Threat</th><th class="num">TPS</th><th class="num">% of gain</th></tr></thead>
      <tbody>${body || '<tr><td colspan="8" class="empty">No events in this window.</td></tr>'}
        <tr class="total-row"><td>Net total</td><td class="num">${events.length}</td><td></td><td></td><td></td><td class="num">${fmtNum(total)}</td><td class="num">${fmtNum(total / secs)}</td><td></td></tr>
      </tbody></table></div>`
  }

  function initialAuras(p) {
    const kit = WF.kitFor(p)
    const names = kit.mods.filter((m) => !m.schools).map((m) => m.name)
    if (state.analysis.buffs && p.role !== 'tank' && !state.analysis.noSalv.includes(p.id)) {
      names.push('Blessing of Salvation')
    }
    return names.length ? names.join(', ') : 'none affecting threat'
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
    const players = state.view === 'report' ? sim().players.filter((p) => p.role !== 'tank') : []
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h2>Settings</h2>
        <button data-action="toggle-settings">Close</button>
      </div>
      <fieldset>
        <legend>My display</legend>
        <p class="hint">Saved in this browser. Not included in shared links.</p>
        <label><input type="checkbox" data-change="display" data-key="bossMelee" ${d.bossMelee ? 'checked' : ''} /> Boss melee markers on the event lane</label>
        <label><input type="checkbox" data-change="display" data-key="fixate" ${d.fixate ? 'checked' : ''} /> Shade fixate windows on the chart</label>
        <label><input type="checkbox" data-change="display" data-key="energize" ${d.energize ? 'checked' : ''} /> Include energize (rage gain) events in the inspector</label>
        <label><input type="checkbox" data-change="display" data-key="hoverTip" ${d.hoverTip ? 'checked' : ''} /> Hover tooltip on the chart</label>
      </fieldset>
      <fieldset>
        <legend>This analysis</legend>
        <p class="hint">Changes the threat numbers. Included in shared links so everyone sees the same chart.</p>
        <label><input type="checkbox" data-change="analysis" data-key="emu" ${an.emu ? 'checked' : ''} /> Threat reduction emulation (Feign Death, etc.)</label>
        <label><input type="checkbox" data-change="analysis" data-key="buffs" ${an.buffs ? 'checked' : ''} /> Infer common threat buffs (Blessing of Salvation)</label>
        <div>
          <strong>Player overrides</strong>
          <p class="hint">Remove inferred Salvation from specific players.</p>
          ${players.length === 0 ? '<p class="hint">Open a report to set overrides.</p>' : ''}
          ${an.noSalv
            .map(
              (id) =>
                `<div class="override-row"><span>${esc(player(id).name)}: no Salvation</span><button data-action="remove-override" data-pid="${id}">Remove</button></div>`,
            )
            .join('')}
          ${
            players.length
              ? `<div class="override-row"><select data-change="add-override" aria-label="Add override for player">
                  <option value="">Add override…</option>
                  ${players.filter((p) => !an.noSalv.includes(p.id)).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
                </select></div>`
              : ''
          }
        </div>
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

  const pointer = { x: null, y: null, down: null, drag: null }

  function drawChart() {
    const canvas = $('#chart')
    const { ctx, w, h } = setupCanvas(canvas)
    const g = chartGeom(w, h)
    const s = sim()

    // Fixate shading.
    if (state.display.fixate) {
      s.markers
        .filter((mk) => mk.type === 'fixate')
        .forEach((mk) => {
          const xa = Math.max(PAD.l, g.xOf(mk.t))
          const xb = Math.min(PAD.l + g.plotW, g.xOf(mk.end))
          if (xb <= xa) return
          ctx.fillStyle = 'rgba(0,0,0,0.06)'
          ctx.fillRect(xa, PAD.t, xb - xa, g.plotH)
          ctx.fillStyle = '#555'
          ctx.font = '11px system-ui'
          ctx.fillText(`Fixate: ${player(mk.pid).name}`, xa + 4, PAD.t + 12)
        })
    }

    // Grid + axes.
    ctx.strokeStyle = '#e4e4e4'
    ctx.fillStyle = '#5e5e5e'
    ctx.font = '11px system-ui'
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
    ctx.strokeStyle = '#999'
    ctx.strokeRect(PAD.l + 0.5, PAD.t + 0.5, g.plotW, g.plotH)

    ctx.save()
    ctx.beginPath()
    ctx.rect(PAD.l, PAD.t, g.plotW, g.plotH)
    ctx.clip()

    // Thresholds.
    if (state.thresholds) {
      ctx.strokeStyle = '#444'
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
        ctx.fillStyle = '#444'
        ctx.textAlign = 'right'
        ctx.fillText(label, PAD.l + g.plotW - 4, g.yOf(lastV) - 4)
      })
      if (state.mode === 'rel') {
        ctx.strokeStyle = '#999'
        ctx.beginPath()
        ctx.moveTo(PAD.l, g.yOf(100))
        ctx.lineTo(PAD.l + g.plotW, g.yOf(100))
        ctx.stroke()
      }
    }

    // Player lines: unfocused first, focused on top.
    const order = [...state.visible].sort(
      (x, y) => (x === state.focus) - (y === state.focus),
    )
    order.forEach((pid) => {
      const arr = g.smp.byPid.get(pid)
      if (!arr) return
      const focused = pid === state.focus
      ctx.strokeStyle = player(pid).color
      ctx.globalAlpha = state.focus && !focused ? 0.4 : 1
      ctx.lineWidth = focused ? 2.75 : 1.25
      ctx.beginPath()
      arr.forEach((v, i) => {
        const x = PAD.l + (i / g.smp.n) * g.plotW
        const y = g.yOf(v)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    })
    ctx.globalAlpha = 1

    // Cursor.
    if (state.cursor !== null && state.cursor >= g.x0 && state.cursor <= g.x1) {
      const x = Math.round(g.xOf(state.cursor)) + 0.5
      ctx.strokeStyle = '#111'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, PAD.t)
      ctx.lineTo(x, PAD.t + g.plotH)
      ctx.stroke()
      state.visible.forEach((pid) => {
        const v = valueForMode(pid, state.cursor)
        ctx.fillStyle = player(pid).color
        ctx.beginPath()
        ctx.arc(x, g.yOf(v), pid === state.focus ? 4 : 2.5, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // Hover crosshair.
    if (pointer.x !== null && !pointer.drag && pointer.x >= PAD.l && pointer.x <= PAD.l + g.plotW) {
      ctx.strokeStyle = '#aaa'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(pointer.x + 0.5, PAD.t)
      ctx.lineTo(pointer.x + 0.5, PAD.t + g.plotH)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Drag rectangle.
    if (pointer.drag) {
      const { x0, y0, x1, y1 } = pointer.drag
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      ctx.strokeStyle = '#333'
      ctx.setLineDash([4, 3])
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))
      ctx.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0))
      ctx.setLineDash([])
    }
    ctx.restore()

    if (state.mode === 'rel') {
      ctx.fillStyle = '#5e5e5e'
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

  /** Snap a time to the nearest event of a visible player within px tolerance. */
  function snapTime(t, g) {
    const tol = ((g.x1 - g.x0) / g.plotW) * 8
    let best = null
    sim().events.forEach((e) => {
      if (!state.visible.has(e.pid)) return
      const d = Math.abs(e.t - t)
      if (d <= tol && (!best || d < best.d)) best = { t: e.t, d }
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
          tip.hidden = true
          redrawCanvases()
          return
        }
      }
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
        const pid = lineAt(pt.x, pt.y, g)
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
      tip.hidden = true
      redrawCanvases()
    })

    canvas.addEventListener('dblclick', () => resetZoom())
  }

  function updateHoverTip(pt, g) {
    const tip = $('#hover-tip')
    if (!state.display.hoverTip || pt.x < PAD.l || pt.x > PAD.l + g.plotW) {
      tip.hidden = true
      return
    }
    const t = g.tOf(pt.x)
    const pid = lineAt(pt.x, pt.y, g)
    const s = sim()
    const seg = WF.segmentAt(s, t)
    let html = `<strong>${fmtTime(t, true)}</strong>`
    if (pid) {
      const v = WF.valueAt(s, pid, t)
      const hv = WF.valueAt(s, seg.pid, t)
      html += ` · ${esc(player(pid).name)} ${fmtNum(v)}${seg.pid !== pid && hv > 0 ? ` (${fmtPct((v / hv) * 100)} of ${esc(player(seg.pid).name)})` : ' (has aggro)'}<br><span class="muted">Click to focus this player</span>`
    } else {
      html += ` · aggro: ${esc(player(seg.pid).name)}<br><span class="muted">Click to set cursor · drag to zoom · double-click to reset</span>`
    }
    tip.innerHTML = html
    tip.hidden = false
    const left = pt.x + 14 + 260 > pt.w ? pt.x - 14 - tip.offsetWidth : pt.x + 14
    tip.style.left = `${Math.max(0, left)}px`
    tip.style.top = `${Math.max(0, pt.y - 40)}px`
  }

  function resetZoom() {
    state.xRange = null
    state.yRange = null
    commit()
  }

  // ===========================================================================
  // Aggro ribbon + event lane
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
    ctx.font = '11px system-ui'
    ctx.fillStyle = '#5e5e5e'
    ctx.textAlign = 'right'
    ctx.fillText('Aggro', PAD.l - 6, 15)
    ctx.fillText('Events', PAD.l - 6, 38)

    ctx.save()
    ctx.beginPath()
    ctx.rect(PAD.l, 0, g.plotW, h)
    ctx.clip()

    s.segments.forEach((seg) => {
      const xa = g.xOf(seg.start)
      const xb = g.xOf(seg.end)
      if (xb < PAD.l || xa > PAD.l + g.plotW) return
      const p = player(seg.pid)
      ctx.fillStyle = p.color
      ctx.globalAlpha = seg.kind === 'fixate' ? 0.3 : 0.55
      ctx.fillRect(xa, 4, xb - xa, 16)
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#fff'
      ctx.strokeRect(xa + 0.5, 4.5, xb - xa, 15)
      const vis = Math.min(xb, PAD.l + g.plotW) - Math.max(xa, PAD.l)
      if (vis > 60) {
        ctx.fillStyle = '#111'
        ctx.textAlign = 'left'
        ctx.fillText(
          seg.kind === 'fixate' ? `Fixate: ${p.name}` : p.name,
          Math.max(xa, PAD.l) + 4,
          16,
        )
      }
    })

    if (state.display.bossMelee) {
      ctx.strokeStyle = '#bbb'
      s.markers
        .filter((mk) => mk.type === 'bossMelee')
        .forEach((mk) => {
          const x = Math.round(g.xOf(mk.t)) + 0.5
          ctx.beginPath()
          ctx.moveTo(x, h - 6)
          ctx.lineTo(x, h - 1)
          ctx.stroke()
        })
    }

    s.markers.forEach((mk) => {
      const x = g.xOf(mk.t)
      const y = 36
      const p = player(mk.pid)
      ctx.lineWidth = 1.5
      if (mk.type === 'taunt') {
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.moveTo(x, y - 6)
        ctx.lineTo(x + 6, y + 5)
        ctx.lineTo(x - 6, y + 5)
        ctx.closePath()
        ctx.fill()
      } else if (mk.type === 'aggroLoss') {
        ctx.strokeStyle = '#111'
        ctx.beginPath()
        ctx.moveTo(x - 6, y - 5)
        ctx.lineTo(x + 6, y - 5)
        ctx.lineTo(x, y + 6)
        ctx.closePath()
        ctx.stroke()
      } else if (mk.type === 'death') {
        ctx.strokeStyle = '#111'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x - 5, y - 5)
        ctx.lineTo(x + 5, y + 5)
        ctx.moveTo(x + 5, y - 5)
        ctx.lineTo(x - 5, y + 5)
        ctx.stroke()
      } else if (mk.type === 'fd') {
        ctx.strokeStyle = p.color
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.stroke()
      }
    })
    ctx.lineWidth = 1

    if (state.cursor !== null) {
      const x = Math.round(g.xOf(state.cursor)) + 0.5
      ctx.strokeStyle = '#111'
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    ctx.restore()
  }

  const MARKER_LABEL = {
    taunt: (mk) => `Taunt: ${player(mk.pid).name} took aggro from ${player(mk.from).name}`,
    aggroLoss: (mk) => `Aggro lost: ${player(mk.pid).name} → ${player(mk.to).name}`,
    death: (mk) => `Death: ${player(mk.pid).name}`,
    fd: (mk) => `Feign Death: ${player(mk.pid).name}`,
    fixate: (mk) => `Fixate: ${player(mk.pid).name}`,
  }

  function ribbonHit(x, y, w) {
    const g = ribbonGeom(w)
    const s = sim()
    if (y > 24) {
      let best = null
      s.markers.forEach((mk) => {
        if (!MARKER_LABEL[mk.type] || mk.type === 'fixate') return
        const d = Math.abs(g.xOf(mk.t) - x)
        if (d <= 7 && (!best || d < best.d)) best = { mk, d }
      })
      if (best) return { t: best.mk.t, label: MARKER_LABEL[best.mk.type](best.mk) }
      return null
    }
    const t = g.tOf(x)
    const seg = WF.segmentAt(s, t)
    return {
      t: seg.start,
      label: `${seg.kind === 'fixate' ? 'Fixated' : 'Aggro'}: ${player(seg.pid).name} ${fmtTime(seg.start)}–${fmtTime(seg.end)}`,
    }
  }

  function initRibbon() {
    const canvas = $('#ribbon')
    const tip = $('#ribbon-tip')
    canvas.addEventListener('pointermove', (evt) => {
      const rect = canvas.getBoundingClientRect()
      const x = evt.clientX - rect.left
      const y = evt.clientY - rect.top
      const hit = x >= PAD.l ? ribbonHit(x, y, rect.width) : null
      canvas.style.cursor = hit ? 'pointer' : 'default'
      if (!hit) {
        tip.hidden = true
        return
      }
      tip.textContent = `${fmtTime(hit.t, true)} · ${hit.label} (click to jump)`
      tip.hidden = false
      tip.style.left = `${Math.min(rect.width - tip.offsetWidth, Math.max(0, x + 10))}px`
      tip.style.top = `-28px`
    })
    canvas.addEventListener('pointerleave', () => (tip.hidden = true))
    canvas.addEventListener('click', (evt) => {
      const rect = canvas.getBoundingClientRect()
      const hit = ribbonHit(evt.clientX - rect.left, evt.clientY - rect.top, rect.width)
      if (!hit) return
      state.cursor = hit.t
      ensureCursorVisible()
      commit()
    })
  }

  // ===========================================================================
  // Overview strip
  // ===========================================================================

  const overview = { mode: null, startX: 0, startRange: null }

  function drawOverview() {
    const { ctx, w, h } = setupCanvas($('#overview'))
    const s = sim()
    const plotW = w - PAD.l - PAD.r
    const xOf = (t) => PAD.l + (t / s.D) * plotW
    let max = 1
    state.visible.forEach((pid) => {
      const ser = s.series.get(pid)
      if (ser) ser.v.forEach((v) => (max = Math.max(max, v)))
    })
    ctx.font = '11px system-ui'
    ctx.fillStyle = '#5e5e5e'
    ctx.textAlign = 'right'
    ctx.fillText('Fight', PAD.l - 6, h / 2 + 4)
    const n = Math.floor(plotW / 2)
    state.visible.forEach((pid) => {
      ctx.strokeStyle = player(pid).color
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
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillRect(PAD.l, 0, xOf(a) - PAD.l, h)
      ctx.fillRect(xOf(b), 0, PAD.l + plotW - xOf(b), h)
    }
    ctx.strokeStyle = '#111'
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
      renderToolbar()
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
    'show-all': () => {
      state.visible = new Set(sim().players.map((p) => p.id))
      commit()
    },
    'hide-all': () => {
      state.visible = new Set(state.focus ? [state.focus] : [])
      commit()
    },
    mode: (el) => {
      state.mode = el.dataset.mode
      state.yRange = null
      commit()
    },
    'reset-zoom': () => resetZoom(),
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
    'remove-override': (el) => {
      state.analysis.noSalv = state.analysis.noSalv.filter((id) => id !== Number(el.dataset.pid))
      commit()
    },
    'mobile-rail': () => {
      state.ui.railOpen = !state.ui.railOpen
      state.ui.rosterOpen = false
      commit()
    },
    'mobile-roster': () => {
      state.ui.rosterOpen = !state.ui.rosterOpen
      state.ui.railOpen = false
      commit()
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
    preset: (el) => {
      const s = sim()
      const tanks = s.players.filter((p) => p.role === 'tank').map((p) => p.id)
      const f = state.focus ? [state.focus] : []
      const sets = {
        all: s.players.map((p) => p.id),
        tanks,
        'focus-tanks': [...f, ...tanks],
        focus: f,
        pinned: [...state.pinned],
      }
      if (sets[el.value]) state.visible = new Set(sets[el.value])
      commit()
    },
    display: (el) => {
      state.display[el.dataset.key] = el.checked
      commit()
    },
    analysis: (el) => {
      state.analysis[el.dataset.key] = el.checked
      commit()
    },
    'add-override': (el) => {
      if (el.value) state.analysis.noSalv = [...state.analysis.noSalv, Number(el.value)]
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
    ['P', 'Pin / unpin the focused player'],
    ['H', 'Hide / show the focused player'],
    ['B', 'Show / hide the breakdown'],
    ['R', 'Toggle absolute / % of aggro holder'],
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
      b: () => actions['toggle-breakdown'](),
      r: () => {
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
        if (state.ui.settingsOpen) state.ui.settingsOpen = false
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
  // Boot
  // ===========================================================================

  document.addEventListener('click', (evt) => {
    const el = evt.target.closest('[data-action]')
    if (!el || el.disabled) return
    const fn = actions[el.dataset.action]
    if (fn) fn(el, evt)
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
  new ResizeObserver(() => redrawCanvases()).observe($('#chart-wrap'))

  initChart()
  initRibbon()
  initOverview()
  initDialogs()
  readUrl()
  if (state.view === 'home') state.ui.railTab = 'library'
  renderAll()
})()
