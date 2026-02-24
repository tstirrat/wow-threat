# AGENTS.md

## Threat Config Authoring Guide

Use this package guide when adding or updating class/raid threat configs in
`packages/config/src/**`.

## Mandatory Config Version Bumps

- Any effective threat-config change must bump the owning config `version` in:
  - `packages/config/src/era/index.ts`
  - `packages/config/src/sod/index.ts`
  - `packages/config/src/tbc/index.ts`
- Era changes require bumping all three versions (Era + SoD + TBC/Anniversary),
  because SoD and TBC import/inherit Era config behavior.

## Core Rule: Declare Spells First

Every config file should define a top-level `Spells` object near the top of the
module, then use `Spells.<Name>` everywhere below.

- Start from inherited era/base spells when applicable (`...EraSpells`)
- Add local spell IDs with clear names
- Avoid raw numeric spell IDs in config logic whenever possible

```ts
export const Spells = {
  ...EraSpells,
  MySpell: 1234, // https://www.wowhead.com/tbc/spell=1234/
  AnotherSpell: 1235, // https://www.wowhead.com/tbc/spell=1235/
} as const
```

## Mandatory Wowhead Links

When adding a spell to `Spells`, include an inline comment with a direct Wowhead
URL for that exact spell ID so maintainers can click through quickly.

Use the Wowhead branch that matches the config era:

- Era/Classic: `https://www.wowhead.com/classic/spell=<id>/`
- TBC: `https://www.wowhead.com/tbc/spell=<id>/`
- Retail (if used): `https://www.wowhead.com/spell=<id>/`

If a spell ID is custom/internal and has no Wowhead page, add a short comment
explaining the source instead.

## Use Named Spells in Config Sections

After `Spells` is declared, all config sections should reference those named
entries for readability:

- `auraModifiers`
- `abilities`
- `abilityGroups`
- `auraImplications`
- `talentAdjustments`
- helper sets/arrays/maps used by these sections

Prefer:

```ts
[Spells.MySpell]: () => ({ ... })
```

Avoid:

```ts
[1234]: () => ({ ... })
```

## Recommended File Structure

1. Imports
2. `Spells` (`...EraSpells` + local additions + Wowhead links)
3. Optional `SetIds`/constants/helper sets
4. Helper functions
5. Exported config object (`ClassThreatConfig`/raid config), using `Spells.*`

## Example Pattern

```ts
import type { ClassThreatConfig } from '@wow-threat/shared'

import { Spells as EraSpells, someClassConfig as eraConfig } from '../era/path'

export const Spells = {
  ...EraSpells,
  MySpell: 1234, // https://www.wowhead.com/tbc/spell=1234/
  AnotherSpell: 1235, // https://www.wowhead.com/tbc/spell=1235/
} as const

export const someClassConfig: ClassThreatConfig = {
  ...eraConfig,
  auraModifiers: {
    ...eraConfig.auraModifiers,
    [Spells.MySpell]: () => {
      return {
        source: 'ability',
        name: 'My Spell',
        value: 1.3,
      }
    },
  },
}
```
