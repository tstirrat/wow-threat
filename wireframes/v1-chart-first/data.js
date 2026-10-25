/**
 * Fake report data and a tiny threat simulation for the v1 wireframe.
 *
 * Everything here is invented and deterministic per report/pull/target, so
 * links reproduce the same chart. Nothing is imported from the app; the
 * numbers only need to be plausible enough to exercise the interactions.
 */
// eslint-disable-next-line no-unused-vars
const WF = (() => {
  // ===========================================================================
  // Helpers
  // ===========================================================================

  function rng(seed) {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  function hash(str) {
    let h = 2166136261
    for (const c of str) {
      h ^= c.charCodeAt(0)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }

  const m = (name, mult, schools = null) => ({ name, mult, schools })
  const s = (name, school, min, max, bonus = 0, w = 1, spellMult = 1) => ({
    name,
    school,
    min,
    max,
    bonus,
    w,
    spellMult,
  })
  const heal = (name, min, max, w = 1) => ({
    ...s(name, 'holy', min, max, 0, w, 0.5),
    kind: 'heal',
  })

  // ===========================================================================
  // Roster and class kits
  // ===========================================================================

  // Light-theme class colours so lines stay legible on white.
  const CLASS_COLORS = {
    Warrior: '#9B6C41',
    Paladin: '#C44884',
    Hunter: '#608029',
    Rogue: '#8E7318',
    Priest: '#6b6b6b',
    Shaman: '#0070DD',
    Mage: '#08809C',
    Warlock: '#7366D6',
    Druid: '#CB4F00',
  }

  const PLAYERS = [
    { id: 1, name: 'Brakka', cls: 'Warrior', role: 'tank', range: 'melee' },
    { id: 2, name: 'Oakhide', cls: 'Druid', role: 'tank', range: 'melee' },
    { id: 3, name: 'Vexa', cls: 'Rogue', role: 'dps', range: 'melee' },
    { id: 4, name: 'Sneakpeek', cls: 'Rogue', role: 'dps', range: 'melee' },
    { id: 5, name: 'Grimtusk', cls: 'Warrior', role: 'dps', range: 'melee' },
    { id: 6, name: 'Stormfist', cls: 'Shaman', role: 'dps', range: 'melee' },
    { id: 7, name: 'Kallen', cls: 'Paladin', role: 'dps', range: 'melee' },
    { id: 8, name: 'Pyrelle', cls: 'Mage', role: 'dps', range: 'ranged' },
    { id: 9, name: 'Frostbyte', cls: 'Mage', role: 'dps', range: 'ranged' },
    { id: 10, name: 'Ashveil', cls: 'Mage', role: 'dps', range: 'ranged' },
    { id: 11, name: 'Hexlord', cls: 'Warlock', role: 'dps', range: 'ranged' },
    { id: 12, name: 'Morwen', cls: 'Warlock', role: 'dps', range: 'ranged' },
    { id: 13, name: 'Quickshot', cls: 'Hunter', role: 'dps', range: 'ranged' },
    { id: 14, name: 'Bramblearrow', cls: 'Hunter', role: 'dps', range: 'ranged' },
    { id: 15, name: 'Shadowmend', cls: 'Priest', role: 'dps', range: 'ranged' },
    { id: 16, name: 'Lumina', cls: 'Priest', role: 'healer', range: 'ranged' },
    { id: 17, name: 'Brightwater', cls: 'Shaman', role: 'healer', range: 'ranged' },
    { id: 18, name: 'Holyfist', cls: 'Paladin', role: 'healer', range: 'ranged' },
    { id: 19, name: 'Thornroot', cls: 'Druid', role: 'healer', range: 'ranged' },
  ].map((p) => ({ ...p, color: CLASS_COLORS[p.cls] }))

  const PLAYERS_BY_ID = new Map(PLAYERS.map((p) => [p.id, p]))

  // Relative threat output (1.0 = main tank pace) so some players live close
  // to the pull thresholds.
  const PACE = {
    Brakka: 1,
    Oakhide: 0.72,
    Vexa: 0.95,
    Sneakpeek: 0.74,
    Grimtusk: 0.86,
    Stormfist: 0.6,
    Kallen: 0.55,
    Pyrelle: 1.12,
    Frostbyte: 0.82,
    Ashveil: 0.7,
    Hexlord: 1.02,
    Morwen: 0.72,
    Quickshot: 0.92,
    Bramblearrow: 0.64,
    Shadowmend: 0.6,
    Lumina: 0.22,
    Brightwater: 0.18,
    Holyfist: 0.2,
    Thornroot: 0.16,
  }

  const REACTIVE = {
    thorns: s('Thorns', 'nature', 60, 60),
    retAura: s('Retribution Aura', 'holy', 35, 35),
    spikes: s('Thorium Spikes', 'fire', 25, 35),
  }

  const KITS = {
    'Warrior:tank': {
      mods: [m('Defensive Stance', 1.3), m('Defiance (5/5)', 1.15)],
      spells: [
        s('Sunder Armor', 'physical', 0, 0, 301, 3),
        s('Heroic Strike', 'physical', 700, 1100, 194, 3),
        s('Revenge', 'physical', 450, 700, 355, 2),
        s('Shield Slam', 'physical', 900, 1300, 254, 2),
        s('Melee', 'physical', 500, 900, 0, 4),
      ],
      reactive: [REACTIVE.thorns, REACTIVE.retAura, REACTIVE.spikes],
      rage: true,
    },
    'Druid:tank': {
      mods: [m('Bear Form', 1.3), m('Feral Instinct (5/5)', 1.15)],
      spells: [
        s('Maul', 'physical', 700, 1000, 322, 3, 1.75),
        s('Swipe', 'physical', 300, 450, 0, 2, 1.75),
        s('Lacerate', 'physical', 200, 300, 267, 2),
        s('Faerie Fire (Feral)', 'nature', 0, 0, 108, 1),
        s('Melee', 'physical', 400, 700, 0, 4),
      ],
      reactive: [REACTIVE.thorns, REACTIVE.retAura],
      rage: true,
    },
    'Rogue:dps': {
      mods: [m('Rogue base threat', 0.71)],
      spells: [
        s('Sinister Strike', 'physical', 700, 950, 0, 4),
        s('Melee', 'physical', 400, 700, 0, 5),
        s('Eviscerate', 'physical', 1800, 2600, 0, 1),
        s('Instant Poison', 'nature', 250, 330, 0, 3),
      ],
    },
    'Warrior:dps': {
      mods: [m('Berserker Stance', 0.8)],
      spells: [
        s('Bloodthirst', 'physical', 1100, 1500, 0, 2),
        s('Whirlwind', 'physical', 900, 1300, 0, 2),
        s('Heroic Strike', 'physical', 900, 1300, 194, 2),
        s('Melee', 'physical', 700, 1100, 0, 4),
      ],
    },
    'Shaman:dps': {
      mods: [],
      spells: [
        s('Stormstrike', 'physical', 1000, 1400, 0, 1),
        s('Melee', 'physical', 600, 900, 0, 4),
        s('Windfury Attack', 'physical', 600, 900, 0, 2),
        s('Earth Shock', 'nature', 700, 900, 0, 1, 2),
      ],
    },
    'Paladin:dps': {
      mods: [],
      spells: [
        s('Seal of Command', 'holy', 500, 800, 0, 3),
        s('Crusader Strike', 'physical', 800, 1100, 0, 2),
        s('Melee', 'physical', 700, 1000, 0, 4),
        s('Consecration', 'holy', 150, 200, 0, 2),
      ],
    },
    'Mage:dps': {
      mods: [
        m('Arcane Subtlety (2/2)', 0.6, ['arcane']),
        m('Frost Channeling (3/3)', 0.9, ['frost']),
        m('Burning Soul (2/2)', 0.9, ['fire']),
      ],
      spells: [
        s('Frostbolt', 'frost', 1200, 1600, 0, 4),
        s('Fireball', 'fire', 1500, 2000, 0, 2),
        s('Arcane Missiles', 'arcane', 1300, 1700, 0, 1),
        s('Scorch', 'fire', 700, 900, 0, 1),
      ],
    },
    'Warlock:dps': {
      mods: [m('Destructive Reach (2/2)', 0.9, ['shadow', 'fire'])],
      spells: [
        s('Shadow Bolt', 'shadow', 1500, 2100, 0, 5),
        s('Corruption', 'shadow', 400, 500, 0, 2),
        s('Immolate', 'fire', 700, 900, 0, 1),
        s('Curse of Agony', 'shadow', 300, 400, 0, 1),
      ],
    },
    'Hunter:dps': {
      mods: [],
      spells: [
        s('Auto Shot', 'physical', 500, 800, 0, 4),
        s('Steady Shot', 'physical', 700, 1000, 0, 3),
        s('Multi-Shot', 'physical', 600, 900, 0, 1),
        s('Arcane Shot', 'arcane', 600, 800, 0, 1),
      ],
    },
    'Priest:dps': {
      mods: [m('Shadow Affinity (3/3)', 0.75, ['shadow'])],
      spells: [
        s('Mind Blast', 'shadow', 1100, 1400, 0, 2),
        s('Mind Flay', 'shadow', 400, 550, 0, 4),
        s('Shadow Word: Pain', 'shadow', 300, 400, 0, 2),
      ],
    },
    'Priest:healer': {
      mods: [m('Silent Resolve (5/5)', 0.8)],
      spells: [
        heal('Greater Heal', 2500, 3500, 2),
        heal('Flash Heal', 1200, 1600, 3),
        heal('Renew', 600, 800, 3),
      ],
    },
    'Shaman:healer': {
      mods: [m('Healing Grace (3/3)', 0.85)],
      spells: [
        heal('Chain Heal', 1500, 2200, 4),
        heal('Healing Wave', 2200, 3000, 1),
        heal('Lesser Healing Wave', 1000, 1300, 2),
      ],
    },
    'Paladin:healer': {
      mods: [],
      spells: [
        heal('Holy Light', 2200, 3000, 2),
        heal('Flash of Light', 700, 900, 4),
      ],
    },
    'Druid:healer': {
      mods: [m('Subtlety (5/5)', 0.8)],
      spells: [
        heal('Rejuvenation', 500, 700, 3),
        heal('Lifebloom', 400, 600, 3),
        heal('Regrowth', 1400, 1900, 1),
        heal('Healing Touch', 2500, 3200, 1),
      ],
    },
  }

  const SALVATION = m('Blessing of Salvation', 0.7)

  const kitFor = (p) => KITS[`${p.cls}:${p.role}`]

  /** Modifiers that apply to one spell for one player under the given options. */
  function modsFor(player, spell, opts) {
    const kit = kitFor(player)
    const mods = kit.mods.filter(
      (mod) => !mod.schools || mod.schools.includes(spell.school),
    )
    const out = mods.map((mod) => ({ name: mod.name, mult: mod.mult }))
    if (spell.spellMult !== 1) {
      out.push({
        name: spell.kind === 'heal' ? 'Healing threat' : `${spell.name} (spell)`,
        mult: spell.spellMult,
      })
    }
    if (
      opts.buffs &&
      player.role !== 'tank' &&
      !opts.noSalv.includes(player.id)
    ) {
      out.push({ name: SALVATION.name, mult: SALVATION.mult })
    }
    return out
  }

  const coeffOf = (mods) => mods.reduce((acc, mod) => acc * mod.mult, 1)

  // ===========================================================================
  // Reports, pulls and the library
  // ===========================================================================

  const MAULGAR_TARGETS = [
    { id: 'maulgar', name: 'High King Maulgar', primary: true },
    { id: 'kiggler', name: 'Kiggler the Crazed' },
    { id: 'blindeye', name: 'Blindeye the Seer' },
    { id: 'olm', name: 'Olm the Summoner' },
    { id: 'krosh', name: 'Krosh Firehand' },
  ]
  const GRUUL_TARGETS = [{ id: 'gruul', name: 'Gruul the Dragonkiller', primary: true }]

  const ALL_IDS = PLAYERS.map((p) => p.id)
  const GRUUL_IDS = ALL_IDS.filter((id) => id !== 4)

  const PULL_TEMPLATES = [
    { boss: 'High King Maulgar', outcome: 'wipe', pct: 62, dur: 182000, targets: MAULGAR_TARGETS, ids: ALL_IDS },
    { boss: 'High King Maulgar', outcome: 'wipe', pct: 31, dur: 211000, targets: MAULGAR_TARGETS, ids: ALL_IDS },
    { boss: 'High King Maulgar', outcome: 'kill', pct: 0, dur: 268000, targets: MAULGAR_TARGETS, ids: ALL_IDS },
    { boss: 'Gruul the Dragonkiller', outcome: 'wipe', pct: 48, dur: 196000, targets: GRUUL_TARGETS, ids: GRUUL_IDS },
    { boss: 'Gruul the Dragonkiller', outcome: 'kill', pct: 0, dur: 301000, targets: GRUUL_TARGETS, ids: GRUUL_IDS },
  ]

  const LIBRARY = {
    recent: [
      { code: 'aB3dK9xQ2mN7pL4r', title: "Gruul's Lair", guild: 'Hand of Ragnaros', date: 'Oct 22' },
      { code: 'Zt8wQ1vR5yU2iO9p', title: "Gruul's Lair + Magtheridon", guild: 'Salt and Pepper', date: 'Oct 20' },
      { code: 'Lm4nB7vC1xZ8aS3d', title: 'Karazhan', guild: 'Hand of Ragnaros', date: 'Oct 18' },
    ],
    starred: [
      { code: 'Qw2eR4tY6uI8oP0a', title: "Gruul's Lair (first kill)", guild: 'Hand of Ragnaros', date: 'Sep 30' },
    ],
    myLogs: [
      { code: 'aB3dK9xQ2mN7pL4r', title: "Gruul's Lair", guild: 'Hand of Ragnaros', date: 'Oct 22' },
      { code: 'Hj5kL7mN9bV1cX3z', title: 'Karazhan (alt run)', guild: '—', date: 'Oct 19' },
    ],
    guilds: [
      {
        id: 'hor',
        name: 'Hand of Ragnaros',
        server: 'Dreamscythe',
        member: true,
        reports: [
          { code: 'aB3dK9xQ2mN7pL4r', title: "Gruul's Lair", date: 'Oct 22' },
          { code: 'Lm4nB7vC1xZ8aS3d', title: 'Karazhan', date: 'Oct 18' },
          { code: 'Pq9wE3rT5yU7iO1k', title: "Gruul's Lair", date: 'Oct 15' },
        ],
      },
      {
        id: 'sp',
        name: 'Salt and Pepper',
        server: 'Nightslayer',
        member: true,
        reports: [
          { code: 'Zt8wQ1vR5yU2iO9p', title: "Gruul's Lair + Magtheridon", date: 'Oct 20' },
          { code: 'Rf6gT8hY0uJ2kI4l', title: 'Karazhan', date: 'Oct 13' },
        ],
      },
      {
        id: 'pp',
        name: 'Progress Pending',
        server: 'Spineshatter',
        member: false,
        reports: [
          { code: 'Vb1nM3kL5jH7gF9d', title: "Gruul's Lair + Magtheridon", date: 'Oct 21' },
          { code: 'Cx2zA4sD6fG8hJ0k', title: 'Serpentshrine Cavern', date: 'Oct 16' },
        ],
      },
    ],
  }

  const titleByCode = new Map(
    [
      ...LIBRARY.recent,
      ...LIBRARY.starred,
      ...LIBRARY.myLogs,
      ...LIBRARY.guilds.flatMap((g) => g.reports.map((r) => ({ ...r, guild: g.name }))),
    ].map((r) => [r.code, r]),
  )

  /** Build a fake report. Every code gets the same raid with different rolls. */
  function getReport(code) {
    const known = titleByCode.get(code)
    return {
      code,
      title: known ? known.title : `Report ${code.slice(0, 6)}`,
      guild: known ? known.guild : 'Unknown guild',
      date: known ? known.date : 'Oct 24',
      pulls: PULL_TEMPLATES.map((tpl, i) => ({
        id: i + 1,
        name: tpl.boss,
        outcome: tpl.outcome,
        pct: tpl.pct,
        durationMs: tpl.dur,
        targets: tpl.targets,
        playerIds: tpl.ids,
      })),
    }
  }

  // ===========================================================================
  // Simulation
  // ===========================================================================

  const BASE_TPS = 760
  const simCache = new Map()

  /**
   * Simulate one pull against one target. Returns every event with its
   * cumulative threat, per-player series, aggro-holder segments and markers.
   */
  function simulate(report, pull, target, opts) {
    const key = `${report.code}|${pull.id}|${target.id}|${opts.buffs}|${opts.emu}|${opts.noSalv.join(',')}`
    const cached = simCache.get(key)
    if (cached) return cached

    const r = rng(hash(`${report.code}:${pull.id}:${target.id}`))
    const D = pull.durationMs
    const players = pull.playerIds.map((id) => PLAYERS_BY_ID.get(id))
    const mainTankId = target.primary ? 1 : 2
    const offTankId = mainTankId === 1 ? 2 : 1
    const aggression = (pull.outcome === 'wipe' ? 1.08 : 0.96) * (0.95 + r() * 0.1)
    const isMain = target.primary

    // --- proactive events -------------------------------------------------
    const queue = []
    players.forEach((p) => {
      const kit = kitFor(p)
      let pace = PACE[p.name] ?? 0.5
      if (p.role === 'tank') pace = p.id === mainTankId ? 1 : 0.72
      else if (!isMain) pace *= 0.55
      const desired = BASE_TPS * pace * (p.role === 'tank' ? 1 : aggression)
      // Interval assumes Salvation on non-tanks so toggling buff inference
      // changes output rather than being absorbed.
      const assumeOpts = { buffs: true, noSalv: [] }
      const totalW = kit.spells.reduce((a, sp) => a + sp.w, 0)
      const avg =
        kit.spells.reduce(
          (a, sp) =>
            a +
            sp.w *
              ((sp.min + sp.max) / 2 + sp.bonus) *
              coeffOf(modsFor(p, sp, assumeOpts)),
          0,
        ) / totalW
      const interval = Math.min(4, Math.max(0.25, (avg * 1.05) / desired)) * 1000

      // Non-tanks wait a few seconds for the tank to open.
      let t = Math.floor(r() * interval) + (p.role === 'tank' ? 0 : 3000)
      while (t < D) {
        let pick = r() * totalW
        const spell = kit.spells.find((sp) => (pick -= sp.w) < 0) ?? kit.spells[0]
        const roll = r()
        const hitType = roll < 0.05 ? 'miss' : roll < 0.17 ? 'crit' : 'hit'
        const base = spell.min + r() * (spell.max - spell.min)
        const raw = hitType === 'miss' ? 0 : Math.round(base * (hitType === 'crit' ? 2 : 1))
        queue.push({
          t,
          kind: spell.kind ?? 'damage',
          pid: p.id,
          spell,
          raw,
          bonus: hitType === 'miss' ? 0 : spell.bonus,
          hitType,
        })
        t += Math.floor(interval * (0.6 + r() * 0.8))
      }
    })

    // --- scripted events --------------------------------------------------
    if (isMain) {
      queue.push({ t: Math.floor(D * 0.33), kind: 'taunt', pid: offTankId })
      queue.push({ t: Math.floor(D * 0.67), kind: 'taunt', pid: mainTankId })
      if (pull.name === 'High King Maulgar') {
        const ranged = players.filter((p) => p.range === 'ranged' && p.role === 'dps')
        const victim = ranged[Math.floor(r() * ranged.length)]
        const start = Math.floor(D * 0.5)
        queue.push({ t: start, kind: 'fixateStart', pid: victim.id, until: start + 6000 })
        queue.push({ t: start + 6000, kind: 'fixateEnd', pid: victim.id })
      }
    }
    players
      .filter((p) => p.cls === 'Hunter')
      .forEach((p) => {
        queue.push({ t: Math.floor(D * (0.2 + r() * 0.3)), kind: 'fd', pid: p.id })
        queue.push({ t: Math.floor(D * (0.55 + r() * 0.35)), kind: 'fd', pid: p.id })
      })
    for (let t = 1500; t < D; t += 1900 + Math.floor(r() * 200)) {
      queue.push({ t, kind: 'swing', pid: 0 })
    }
    queue.sort((a, b) => a.t - b.t)

    // --- run --------------------------------------------------------------
    const threat = new Map(players.map((p) => [p.id, 0]))
    const series = new Map(players.map((p) => [p.id, { t: [0], v: [0] }]))
    const dead = new Set()
    const events = []
    const markers = []
    const segments = [{ start: 0, end: D, pid: mainTankId, kind: 'aggro' }]
    const pending = []
    const lastTaunt = new Map()
    let holder = mainTankId
    let fixate = null

    const byId = (id) => PLAYERS_BY_ID.get(id)
    const record = (ev) => {
      ev.cum = threat.get(ev.pid)
      ev.id = events.length
      events.push(ev)
      const ser = series.get(ev.pid)
      ser.t.push(ev.t)
      ser.v.push(ev.cum)
    }
    const setHolder = (pid, t, kind = 'aggro') => {
      const last = segments[segments.length - 1]
      if (last.pid === pid && last.kind === kind) return
      if (last.start === t) {
        last.pid = pid
        last.kind = kind
        return
      }
      last.end = t
      segments.push({ start: t, end: D, pid, kind })
    }
    const schedule = (item) => {
      pending.push(item)
      pending.sort((a, b) => a.t - b.t)
    }
    const reassign = (t) => {
      const alive = players.filter((p) => !dead.has(p.id))
      if (alive.length === 0) return
      const top = alive.reduce((a, b) => (threat.get(b.id) > threat.get(a.id) ? b : a))
      holder = top.id
      setHolder(holder, t)
      if (top.role !== 'tank') respondTo(top.id, t)
    }
    // A tank usually taunts back; otherwise the puller dies a few seconds later.
    const respondTo = (pullerId, t) => {
      schedule({ t: t + 2200 + Math.floor(r() * 1800), kind: 'death', pid: pullerId })
      const tank = [mainTankId, offTankId].find(
        (id) => !dead.has(id) && t - (lastTaunt.get(id) ?? -1e9) > 10000,
      )
      if (tank && r() < (pull.outcome === 'wipe' ? 0.5 : 0.85)) {
        schedule({ t: t + 900 + Math.floor(r() * 700), kind: 'taunt', pid: tank })
      }
    }
    const check = (pid, t) => {
      if (fixate || pid === holder || dead.has(pid)) return
      const p = byId(pid)
      const limit = threat.get(holder) * (p.range === 'melee' ? 1.1 : 1.3)
      if (threat.get(pid) > limit && threat.get(pid) > 0) {
        markers.push({ t, type: 'aggroLoss', pid: holder, to: pid })
        holder = pid
        setHolder(pid, t)
        if (p.role !== 'tank') respondTo(pid, t)
      }
    }
    const apply = (ev) => {
      const p = byId(ev.pid)
      const mods = modsFor(p, ev.spell, opts)
      const coeff = coeffOf(mods)
      const delta = (ev.raw + ev.bonus) * coeff
      threat.set(ev.pid, threat.get(ev.pid) + delta)
      record({
        t: ev.t,
        pid: ev.pid,
        kind: ev.kind,
        spell: ev.spell.name,
        school: ev.spell.school,
        hitType: ev.hitType ?? 'hit',
        raw: ev.raw,
        bonus: ev.bonus,
        mods,
        coeff,
        threat: delta,
      })
      check(ev.pid, ev.t)
    }
    const taunt = (pid, t) => {
      if (dead.has(pid)) return
      lastTaunt.set(pid, t)
      const before = threat.get(pid)
      const after = Math.max(before, threat.get(holder))
      threat.set(pid, after)
      record({
        t,
        pid,
        kind: 'taunt',
        spell: 'Taunt',
        school: 'physical',
        hitType: 'hit',
        raw: 0,
        bonus: 0,
        mods: [],
        coeff: null,
        threat: after - before,
        note: `Threat set to ${byId(holder).name}'s (${Math.round(after)})`,
      })
      markers.push({ t, type: 'taunt', pid, from: holder })
      if (!fixate) {
        holder = pid
        setHolder(pid, t)
      }
    }
    const die = (pid, t) => {
      if (dead.has(pid) || holder !== pid) return
      dead.add(pid)
      const before = threat.get(pid)
      threat.set(pid, 0)
      record({
        t,
        pid,
        kind: 'death',
        spell: 'Death',
        school: 'physical',
        hitType: 'hit',
        raw: 0,
        bonus: 0,
        mods: [],
        coeff: null,
        threat: -before,
        note: 'Threat cleared on death',
      })
      markers.push({ t, type: 'death', pid })
      if (fixate && fixate.pid === pid) fixate = null
      reassign(t)
    }
    const flush = (t) => {
      while (pending.length && pending[0].t <= t) {
        const item = pending.shift()
        if (item.t >= D) continue
        if (item.kind === 'death') die(item.pid, item.t)
        else taunt(item.pid, item.t)
      }
    }

    queue.forEach((item) => {
      flush(item.t)
      if (item.pid && dead.has(item.pid)) return
      switch (item.kind) {
        case 'damage':
        case 'heal':
          apply(item)
          break
        case 'taunt':
          taunt(item.pid, item.t)
          break
        case 'fixateStart':
          fixate = { pid: item.pid, until: item.until }
          setHolder(item.pid, item.t, 'fixate')
          markers.push({ t: item.t, end: item.until, type: 'fixate', pid: item.pid })
          break
        case 'fixateEnd':
          if (!fixate) break
          fixate = null
          setHolder(holder, item.t)
          break
        case 'fd': {
          const before = threat.get(item.pid)
          if (opts.emu) threat.set(item.pid, 0)
          record({
            t: item.t,
            pid: item.pid,
            kind: 'fd',
            spell: 'Feign Death',
            school: 'physical',
            hitType: 'hit',
            raw: 0,
            bonus: 0,
            mods: [],
            coeff: null,
            threat: opts.emu ? -before : 0,
            note: opts.emu ? 'Threat reset by Feign Death' : 'Threat reduction emulation off: no change',
          })
          markers.push({ t: item.t, type: 'fd', pid: item.pid })
          if (opts.emu && holder === item.pid) reassign(item.t)
          break
        }
        case 'swing': {
          const victimId = fixate ? fixate.pid : holder
          if (dead.has(victimId)) break
          markers.push({ t: item.t, type: 'bossMelee', pid: victimId })
          const victim = byId(victimId)
          const kit = kitFor(victim)
          ;(kit.reactive ?? []).forEach((spell) =>
            apply({ t: item.t, kind: 'damage', pid: victimId, spell, raw: spell.min, bonus: 0, hitType: 'hit' }),
          )
          if (kit.rage) {
            const rage = 8 + Math.floor(r() * 10)
            threat.set(victimId, threat.get(victimId) + rage * 5)
            record({
              t: item.t,
              pid: victimId,
              kind: 'energize',
              spell: 'Rage gain (damage taken)',
              school: 'physical',
              hitType: 'hit',
              raw: rage,
              bonus: 0,
              mods: [{ name: '5 threat per rage, not modified by stance', mult: 5 }],
              coeff: 5,
              threat: rage * 5,
            })
          }
          break
        }
      }
    })
    flush(D)

    const result = { key, D, players, events, series, segments, markers, mainTankId }
    simCache.set(key, result)
    return result
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  /** Index of the last element in a sorted array with value <= x, or -1. */
  function lastAtOrBefore(arr, x) {
    let lo = 0
    let hi = arr.length - 1
    let ans = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (arr[mid] <= x) {
        ans = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    return ans
  }

  /** Cumulative threat of one player at time t. */
  function valueAt(sim, pid, t) {
    const ser = sim.series.get(pid)
    if (!ser) return 0
    const i = lastAtOrBefore(ser.t, t)
    return i < 0 ? 0 : ser.v[i]
  }

  /** Aggro segment covering time t. */
  function segmentAt(sim, t) {
    const seg = sim.segments.find((sg) => t >= sg.start && t < sg.end)
    return seg ?? sim.segments[sim.segments.length - 1]
  }

  /** Tank with the most threat over the whole fight, or null. */
  function topTank(sim) {
    const tanks = sim.players.filter((p) => p.role === 'tank')
    if (tanks.length === 0) return null
    const total = (pid) =>
      sim.events.filter((e) => e.pid === pid && e.threat > 0).reduce((a, e) => a + e.threat, 0)
    return tanks.reduce((a, b) => (total(b.id) > total(a.id) ? b : a)).id
  }

  return {
    PLAYERS,
    PLAYERS_BY_ID,
    LIBRARY,
    getReport,
    simulate,
    valueAt,
    segmentAt,
    topTank,
    lastAtOrBefore,
    kitFor,
    modsFor,
  }
})()
