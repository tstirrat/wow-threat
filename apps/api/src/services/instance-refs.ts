/**
 * Shared instance-aware IDs and key helpers for fight-state trackers.
 */

export type ActorId = number
export type EnemyId = number
export type InstanceId = number

export interface ActorReference {
  id: ActorId
  instanceId?: InstanceId
}

export interface EnemyReference {
  id: EnemyId
  instanceId?: InstanceId
}

export interface ActorInstanceReference {
  id: ActorId
  instanceId: InstanceId
}

export interface EnemyInstanceReference {
  id: EnemyId
  instanceId: InstanceId
}

export type ActorKey = string & { readonly __brand: 'ActorKey' }
export type EnemyKey = string & { readonly __brand: 'EnemyKey' }

export function normalizeInstanceId(instanceId?: InstanceId): InstanceId {
  return instanceId ?? 0
}

export function toActorInstanceReference(
  actor: ActorReference,
): ActorInstanceReference {
  return {
    id: actor.id,
    instanceId: normalizeInstanceId(actor.instanceId),
  }
}

export function toEnemyInstanceReference(
  enemy: EnemyReference,
): EnemyInstanceReference {
  return {
    id: enemy.id,
    instanceId: normalizeInstanceId(enemy.instanceId),
  }
}

export function buildActorKey(actor: ActorReference): ActorKey {
  const normalized = toActorInstanceReference(actor)
  return `${normalized.id}:${normalized.instanceId}` as ActorKey
}

export function buildEnemyKey(enemy: EnemyReference): EnemyKey {
  const normalized = toEnemyInstanceReference(enemy)
  return `${normalized.id}:${normalized.instanceId}` as EnemyKey
}

export function parseActorKey(actorKey: ActorKey): ActorInstanceReference {
  const [idRaw, instanceRaw] = actorKey.split(':')
  return {
    id: Number(idRaw),
    instanceId: Number(instanceRaw),
  }
}

export function parseEnemyKey(enemyKey: EnemyKey): EnemyInstanceReference {
  const [idRaw, instanceRaw] = enemyKey.split(':')
  return {
    id: Number(idRaw),
    instanceId: Number(instanceRaw),
  }
}
