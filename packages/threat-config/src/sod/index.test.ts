/**
 * Season of Discovery Config Tests
 */
import {
  checkExists,
  createApplyBuffEvent,
  createApplyDebuffEvent,
  createCastEvent,
  createDamageEvent,
  createMockActorContext,
} from '@wow-threat/shared'
import type { ThreatContext } from '@wow-threat/shared/src/types'
import type { GearItem } from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import { bwlAbilities as eraBwlAbilities } from '../era/raids/bwl'
import { sodConfig } from './index'

function createContext(event: ThreatContext['event']): ThreatContext {
  const normalizedEvent =
    event.type === 'damage'
      ? createDamageEvent(event)
      : event.type === 'cast'
        ? createCastEvent(event)
        : event.type === 'applydebuff'
          ? createApplyDebuffEvent(event)
          : event.type === 'applybuff'
            ? createApplyBuffEvent(event)
            : event

  return {
    event: normalizedEvent,
    amount: normalizedEvent.type === 'damage' ? normalizedEvent.amount : 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: normalizedEvent.sourceID, name: 'Source', class: null },
    targetActor: {
      id: normalizedEvent.targetID,
      name: 'Target',
      class: 'warrior',
    },
    encounterId: null,
    spellSchoolMask: 0,
    actors: createMockActorContext(),
  }
}

describe('sod config', () => {
  it('resolves season id 3 reports', () => {
    expect(
      sodConfig.resolve({
        report: {
          startTime: Date.UTC(2026, 0, 13),
          masterData: {
            gameVersion: 2,
          },
          zone: {},
          fights: [{ classicSeasonID: 3 }],
        },
      }),
    ).toBe(true)
  })

  it('resolves discovery partition reports', () => {
    expect(
      sodConfig.resolve({
        report: {
          startTime: Date.UTC(2026, 0, 13),
          masterData: {
            gameVersion: 2,
          },
          zone: {
            partitions: [{ id: 1, name: 'Discovery P8' }],
          },
          fights: [],
        },
      }),
    ).toBe(true)
  })

  it('infers cloak and gloves enchant auras from combatant gear', () => {
    const gear: GearItem[] = [
      {
        id: 1,
        itemLevel: 1,
        permanentEnchant: 25072,
      } as GearItem,
      {
        id: 2,
        itemLevel: 1,
        permanentEnchant: 25084,
      } as GearItem,
    ]

    const auras = sodConfig.gearImplications?.(gear) ?? []
    expect(auras).toContain(25072)
    expect(auras).toContain(25084)
  })

  it('applies sod global gear aura modifiers', () => {
    const glovesThreat = checkExists(
      sodConfig.auraModifiers?.[25072]?.(
        createContext(
          createDamageEvent({
            timestamp: 1000,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 2,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: 1,
            amount: 100,
          }),
        ),
      ),
    )
    const cloakSubtlety = checkExists(
      sodConfig.auraModifiers?.[25084]?.(
        createContext(
          createDamageEvent({
            timestamp: 1000,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 2,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: 1,
            amount: 100,
          }),
        ),
      ),
    )
    const eyeOfDiminution = checkExists(
      sodConfig.auraModifiers?.[1219503]?.(
        createContext(
          createDamageEvent({
            timestamp: 1000,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 2,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: 1,
            amount: 100,
          }),
        ),
      ),
    )

    expect(glovesThreat.value).toBe(1.02)
    expect(cloakSubtlety.value).toBe(0.98)
    expect(eyeOfDiminution.value).toBe(0.3)
  })

  it('keeps inherited broodlord handler from era bwl abilities', () => {
    expect(sodConfig.abilities?.[18670]).toBe(eraBwlAbilities[18670])
  })

  it('applies boss cast threat wipes to all actors on source enemy', () => {
    const formula = sodConfig.abilities?.[20566]
    expect(formula).toBeDefined()

    const result = checkExists(
      formula?.(
        createContext(
          createCastEvent({
            timestamp: 1200,
            sourceID: 11502,
            sourceIsFriendly: false,
            sourceInstance: 0,
            targetID: 1,
            targetIsFriendly: true,
            targetInstance: 0,
            abilityGameID: 20566,
          }),
        ),
      ),
    )

    expect(result.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0,
      target: 'all',
    })
  })

  it('tracks chromaggus time lapse as aggro loss state markers', () => {
    expect(sodConfig.aggroLossBuffs?.has(23310)).toBe(true)
    expect(sodConfig.aggroLossBuffs?.has(23311)).toBe(true)
    expect(sodConfig.aggroLossBuffs?.has(23312)).toBe(true)
  })

  it('implements sod-specific raid threat drop handlers', () => {
    const castThreatWipeAllSpellIds = [20566, 23138, 26561, 24408]

    castThreatWipeAllSpellIds.forEach((spellId) => {
      const formula = sodConfig.abilities?.[spellId]
      const result = checkExists(
        formula?.(
          createContext(
            createCastEvent({
              timestamp: 1500,
              sourceID: 11502,
              sourceIsFriendly: false,
              sourceInstance: 0,
              targetID: 1,
              targetIsFriendly: true,
              targetInstance: 0,
              abilityGameID: spellId,
            }),
          ),
        ),
      )

      expect(result.effects?.[0]).toEqual({
        type: 'modifyThreat',
        multiplier: 0,
        target: 'all',
      })
    })

    const twinEmperorsTeleport = checkExists(
      sodConfig.abilities?.[800]?.(
        createContext(
          createApplyBuffEvent({
            timestamp: 1550,
            sourceID: 15276,
            sourceIsFriendly: false,
            sourceInstance: 0,
            targetID: 15275,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: 800,
          }),
        ),
      ),
    )

    expect(twinEmperorsTeleport.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0,
      target: 'all',
    })

    const applyDebuffThreatWipeSpellIds = [24690]
    applyDebuffThreatWipeSpellIds.forEach((spellId) => {
      const formula = sodConfig.abilities?.[spellId]
      const result = checkExists(
        formula?.(
          createContext(
            createApplyDebuffEvent({
              timestamp: 1600,
              sourceID: 11502,
              sourceIsFriendly: false,
              sourceInstance: 0,
              targetID: 1,
              targetIsFriendly: true,
              targetInstance: 0,
              abilityGameID: spellId,
            }),
          ),
        ),
      )

      expect(result.effects?.[0]).toEqual({
        type: 'modifyThreat',
        multiplier: 0,
        target: 'target',
      })
    })

    const hitBasedThreatModifierCases: Array<[number, number]> = [
      [26102, 0],
      [26580, 0],
      [11130, 0.5],
    ]

    hitBasedThreatModifierCases.forEach(([spellId, multiplier]) => {
      const formula = sodConfig.abilities?.[spellId]
      const result = checkExists(
        formula?.(
          createContext(
            createDamageEvent({
              timestamp: 1700,
              sourceID: 11502,
              sourceIsFriendly: false,
              sourceInstance: 0,
              targetID: 1,
              targetIsFriendly: true,
              targetInstance: 0,
              abilityGameID: spellId,
              amount: 0,
            }),
          ),
        ),
      )

      expect(result.effects?.[0]).toEqual({
        type: 'modifyThreat',
        multiplier,
        target: 'target',
      })
    })
  })

  it('implements sod-specific misc ability threat formulas', () => {
    const giftOfArthas = checkExists(
      sodConfig.abilities?.[11374]?.(
        createContext(
          createApplyDebuffEvent({
            timestamp: 1800,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 2,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: 11374,
          }),
        ),
      ),
    )
    const thunderfuryDebuff = checkExists(
      sodConfig.abilities?.[21992]?.(
        createContext(
          createApplyDebuffEvent({
            timestamp: 1900,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 2,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: 21992,
          }),
        ),
      ),
    )
    const thunderfuryDamage = checkExists(
      sodConfig.abilities?.[21992]?.(
        createContext(
          createDamageEvent({
            timestamp: 1900,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 2,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: 21992,
            amount: 100,
          }),
        ),
      ),
    )
    const dragonbreath = checkExists(
      sodConfig.abilities?.[467271]?.(
        createContext(
          createDamageEvent({
            timestamp: 1900,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 2,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: 467271,
            amount: 100,
          }),
        ),
      ),
    )
    const razorbramble = checkExists(
      sodConfig.abilities?.[1213816]?.(
        createContext(
          createDamageEvent({
            timestamp: 1900,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 2,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: 1213816,
            amount: 100,
          }),
        ),
      ),
    )
    const noThreat = checkExists(
      sodConfig.abilities?.[20007]?.(
        createContext(
          createCastEvent({
            timestamp: 1900,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 2,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: 20007,
          }),
        ),
      ),
    )

    expect(giftOfArthas.value).toBe(90)
    expect(thunderfuryDebuff.value).toBe(90)
    expect(thunderfuryDamage.value).toBe(100)
    expect(dragonbreath.value).toBe(225)
    expect(razorbramble.value).toBe(200)
    expect(noThreat.formula).toBe('0')
    expect(noThreat.value).toBe(0)
  })

  it('keeps inherited nefarian class-call handlers from era bwl abilities', () => {
    expect(sodConfig.abilities?.[23397]).toBe(eraBwlAbilities[23397])
    expect(sodConfig.abilities?.[23398]).toBe(eraBwlAbilities[23398])
  })
})
