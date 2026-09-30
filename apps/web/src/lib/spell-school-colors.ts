/**
 * Spell-school color helpers based on the Details meter school-color table.
 *
 * Details colors are tuned for dark backgrounds; each school also carries a
 * light-theme variant (same hue, ~4.6:1 on white) and resolves to light-dark().
 */
import { themedTextColor } from './data-text-colors'

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
  1: themedTextColor('#797902', '#FFFF00'),
  2: themedTextColor('#897300', '#FFE680'),
  4: themedTextColor('#B95B00', '#FF8000'),
  8: themedTextColor('#458248', '#BEFFBE'),
  16: themedTextColor('#048383', '#80FFFF'),
  32: themedTextColor('#6865E1', '#8080FF'),
  64: themedTextColor('#BB3EBD', '#FF80FF'),
  3: themedTextColor('#7F7704', '#FFF240'),
  5: themedTextColor('#986D05', '#FFB900'),
  6: themedTextColor('#937001', '#FFD266'),
  9: themedTextColor('#568102', '#AFFF23'),
  10: themedTextColor('#5E7F04', '#C1EF6E'),
  12: themedTextColor('#747B04', '#AFB923'),
  17: themedTextColor('#3E851E', '#B3FF99'),
  18: themedTextColor('#5E7E46', '#CCF0B3'),
  20: themedTextColor('#79783A', '#C0C080'),
  24: themedTextColor('#068651', '#69FFAF'),
  33: themedTextColor('#7A7822', '#C6C673'),
  34: themedTextColor('#82725E', '#D3C2AC'),
  36: themedTextColor('#97667F', '#B38099'),
  40: themedTextColor('#377F84', '#6CB3B8'),
  48: themedTextColor('#347AAF', '#80C6FF'),
  65: themedTextColor('#966E06', '#FFCC66'),
  66: themedTextColor('#A0655D', '#FFBDB3'),
  68: themedTextColor('#C54C5B', '#FF808C'),
  72: themedTextColor('#6E776E', '#AFB9AF'),
  80: themedTextColor('#716FA9', '#C0C0FF'),
  84: themedTextColor('#9A628F', '#B37AA8'),
  96: themedTextColor('#9258D3', '#B980FF'),
  28: themedTextColor('#0070DE', '#0070DE'),
  124: themedTextColor('#757575', '#C0C0C0'),
  126: themedTextColor('#1111FF', '#1111FF'),
  127: themedTextColor('#EB0108', '#FF1111'),
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
