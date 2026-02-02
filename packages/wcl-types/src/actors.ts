/**
 * WCL Actor Types
 */

export interface Actor {
  id: number
  name: string
  type: string // "Player", "NPC", "Pet"
  subType: string // Class for players, creature type for NPCs
  petOwner: number | null
}

export interface Enemy {
  id: number
  guid: number // Global unique creature ID
  name: string
  instanceCount: number // Multiple of same enemy
  type: 'Boss' | 'Add' | 'Trash'
}

export type ActorType =
  | 'Player'
  | 'Pet' // Player pets (hunter pet, warlock demon)
  | 'Guardian' // Summoned guardians (arcanite dragonling, etc.)
  | 'Companion' // Other friendly NPCs

export interface FightActor {
  id: number
  name: string
  type: ActorType
  class: string | null // WoW class for players, null for NPCs
  spec: string | null
  role: 'Tank' | 'Healer' | 'DPS' | null
  petOwner: number | null // Owner actor ID if this is a pet/companion
}
