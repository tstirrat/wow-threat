/**
 * Spell-school color helpers based on the Details meter school-color table.
 */

const schoolMaskByLabel: Record<string, number> = {
  physical: 1,
  holy: 2,
  fire: 4,
  nature: 8,
  frost: 16,
  shadow: 32,
  arcane: 64,
}

const schoolMaskByAlias: Record<string, number> = {
  holystrike: 3,
  flamestrike: 5,
  holyfire: 6,
  stormstrike: 9,
  holystorm: 10,
  firestorm: 12,
  froststrike: 17,
  holyfrost: 18,
  frostfire: 20,
  froststorm: 24,
  elemental: 28,
  shadowstrike: 33,
  shadowholy: 34,
  shadowflame: 36,
  shadowstorm: 40,
  shadowfrost: 48,
  spellstrike: 65,
  divine: 66,
  spellfire: 68,
  spellstorm: 72,
  spellfrost: 80,
  chimeric: 84,
  spellshadow: 96,
  chromatic: 124,
  magic: 126,
  chaos: 127,
}

const schoolColorByMask: Record<number, string> = {
  1: '#FFFF00',
  2: '#FFE680',
  4: '#FF8000',
  8: '#BEFFBE',
  16: '#80FFFF',
  32: '#8080FF',
  64: '#FF80FF',
  3: '#FFF240',
  5: '#FFB900',
  6: '#FFD266',
  9: '#AFFF23',
  10: '#C1EF6E',
  12: '#AFB923',
  17: '#B3FF99',
  18: '#CCF0B3',
  20: '#C0C080',
  24: '#69FFAF',
  33: '#C6C673',
  34: '#D3C2AC',
  36: '#B38099',
  40: '#6CB3B8',
  48: '#80C6FF',
  65: '#FFCC66',
  66: '#FFBDB3',
  68: '#FF808C',
  72: '#AFB9AF',
  80: '#C0C0FF',
  84: '#B37AA8',
  96: '#B980FF',
  28: '#0070DE',
  124: '#C0C0C0',
  126: '#1111FF',
  127: '#FF1111',
}

function parseSchoolMaskFromParts(parts: string[]): number | null {
  const mask = parts.reduce((total, part) => {
    const bit = schoolMaskByLabel[part]
    if (!bit) {
      return total
    }

    return total | bit
  }, 0)

  return mask > 0 ? mask : null
}

/**
 * Resolve a spell school color from a single school label or combo label.
 */
export function resolveSpellSchoolColor(school: string | null): string | null {
  if (!school) {
    return null
  }

  const normalized = school.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const aliasMask = schoolMaskByAlias[normalized]
  if (aliasMask && schoolColorByMask[aliasMask]) {
    return schoolColorByMask[aliasMask]
  }

  const mask = parseSchoolMaskFromParts(
    normalized
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean),
  )
  if (!mask) {
    return null
  }

  return schoolColorByMask[mask] ?? null
}

/**
 * Resolve a spell school color from an ordered set of normalized labels.
 */
export function resolveSpellSchoolColorFromLabels(
  schoolLabels: string[],
): string | null {
  const mask = parseSchoolMaskFromParts(
    schoolLabels.map((label) => label.trim().toLowerCase()).filter(Boolean),
  )
  if (!mask) {
    return null
  }

  return schoolColorByMask[mask] ?? null
}
