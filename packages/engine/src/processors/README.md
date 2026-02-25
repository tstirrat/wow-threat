# Engine Fight Processors

This directory contains built-in fight processors for `@wow-threat/engine`.

Processors are lightweight plugins that participate in a two-pass lifecycle:

1. Prepass (`init` -> `visitPrepass` -> `finalizePrepass`)
2. Main event pass (`beforeFightState` -> fight state update -> `afterFightState`)

The engine runs all registered processors in a shared request scope and exposes
that shared state through a typed namespace.

## Current Built-ins

- `party-detection`
  - Active only when `inferThreatReduction` is enabled.
  - Builds inferred party assignments from party-scoped spell hit events
    (e.g. Prayer of Healing, Prayer of Fortitude, Circle of Healing, paladin
    auras, shouts, and other party-bounded aura effects).
  - Persists assignments to namespace as actor->group and group->members
    lookups.
  - Includes friendly pets in the owning player's inferred group.
- `tranquil-air-emulation`
  - Active only when `inferThreatReduction` is enabled.
  - Watches Tranquil Air Totem summon events and emulates party aura state.
  - Applies/removes Tranquil Air aura mutations for inferred party members
    within 30 yards (6000 positional units) of the summon point.
  - Uses shared party-assignment namespace data from `party-detection`.
- `infer-initial-buffs`
  - Always active when a fight has friendly players or pets.
  - Infers start-of-fight buff auras from first observed
    `applybuff`/`refreshbuff`/`removebuff` transitions.
  - Adds combatantinfo aura snapshots into the canonical initial buff seed set.
  - Skips inference when the aura is already present in seeded initial auras
    or combatantinfo aura snapshots.
- `minmax-salvation`
  - Active only when `inferThreatReduction` is enabled.
  - Uses `report.rankings` + fight composition to infer non-tank Salvation
    seeds.
  - Checks canonical initial buffs (`seeded + inferred`) and only adds
    Salvation for non-tanks missing both `1038` and `25895`.
  - Applies Salvation only when the actor has fewer long-term Blessings than
    the total paladin count in the fight.

## Registration Model

`ThreatEngine` owns processor registration. Built-in factories are declared in
`index.ts` and installed by default when a `ThreatEngine` instance is created.

```ts
const engine = new ThreatEngine()
const output = engine.processEvents(input)
```

To add custom behavior in tests or experiments:

```ts
const engine = new ThreatEngine({
  processorFactories: [myFactory],
})
```

or register incrementally:

```ts
engine.registerProcessorFactory(myFactory)
```

## Shared Namespace

Processors communicate through typed namespace keys from
`../event-processors`:

- `createProcessorDataKey<T>(id)`
- `namespace.get(key)`
- `namespace.set(key, value)`

For initial-aura seed augmentation, use:

- `addInitialAuraAddition(namespace, actorId, auraId)`
- `initialAuraAdditionsKey`

The engine merges seed additions before main pass processing.

## Factory Context

Factories receive request-scoped context:

- `report`: full report metadata (or `null`)
- `fight`: selected fight metadata (or `null`)
- `inferThreatReduction`: flag from API/UI request

Use this context to decide whether to return a processor instance or `null`.

## Testing Strategy

Processor tests in this directory focus on:

- prepass inference behavior
- namespace outputs and edge-case precedence
- activation conditions (factory returns `null` when not applicable)

Integration behavior across the full threat pipeline remains covered by
`threat-engine.test.ts` and API route tests.
