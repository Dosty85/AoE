import { GameMap, ResourceKind, tileAt } from '../types'
import { CARRY_CAP, GATHER_RATE, GATHER_RANGE, DROP_RANGE } from '../constants'
import { Entity, GameState, GatherTarget, isDropoff, isUnit, spawn } from './state'
import { findPath, nearestWalkable } from './pathfinding'

function dist(e: Entity, gx: number, gy: number): number {
  return Math.hypot(e.x - gx, e.y - gy)
}

/** Vzdálenost entity k nejbližší dlaždici půdorysu budovy. */
function distToBuilding(e: Entity, b: Entity): number {
  const cx = Math.round(b.x)
  const cy = Math.round(b.y)
  let m = Infinity
  for (let dy = -b.radius; dy <= b.radius; dy++) {
    for (let dx = -b.radius; dx <= b.radius; dx++) {
      m = Math.min(m, Math.hypot(e.x - (cx + dx), e.y - (cy + dy)))
    }
  }
  return m
}

function nearestDropoff(state: GameState, owner: number, x: number, y: number): Entity | null {
  let best: Entity | null = null
  let bd = Infinity
  for (const e of state.entities) {
    if (e.owner !== owner || !isDropoff(e.kind) || e.buildLeft > 0) continue
    const d = Math.hypot(e.x - x, e.y - y)
    if (d < bd) {
      bd = d
      best = e
    }
  }
  return best
}

/** Spirálové hledání nejbližší dlaždice s daným zdrojem. */
export function findNearestResource(map: GameMap, kind: ResourceKind, gx: number, gy: number): GatherTarget | null {
  for (let r = 0; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const t = tileAt(map, gx + dx, gy + dy)
        if (t && t.resource === kind && t.amount > 0) return { gx: gx + dx, gy: gy + dy, kind }
      }
    }
  }
  return null
}

function pathToStandNear(state: GameState, e: Entity, gx: number, gy: number): void {
  const stand = nearestWalkable(state.map, gx, gy)
  if (stand) e.path = findPath(state.map, e.x, e.y, stand.x, stand.y)
}

function villagerGather(state: GameState, e: Entity, dt: number): void {
  const tgt = e.gather
  if (!tgt) {
    e.task = 'idle'
    return
  }
  const tile = tileAt(state.map, tgt.gx, tgt.gy)
  const depleted = !tile || tile.resource !== tgt.kind || tile.amount <= 0

  // plný náklad nebo zdroj došel a něco nesu → odnést do dropoffu
  if (e.carry >= CARRY_CAP || (depleted && e.carry > 0)) {
    const drop = nearestDropoff(state, e.owner, e.x, e.y)
    if (!drop) {
      e.task = 'idle'
      return
    }
    if (distToBuilding(e, drop) <= DROP_RANGE) {
      const pl = state.players[e.owner]
      if (pl && e.carryKind) pl[e.carryKind] += Math.floor(e.carry)
      e.carry = 0
      if (depleted) {
        const next = findNearestResource(state.map, tgt.kind, tgt.gx, tgt.gy)
        if (next) {
          e.gather = next
          pathToStandNear(state, e, next.gx, next.gy)
        } else {
          e.task = 'idle'
        }
      } else {
        pathToStandNear(state, e, tgt.gx, tgt.gy)
      }
    } else if (!e.path.length) {
      const stand = nearestWalkable(state.map, Math.round(drop.x), Math.round(drop.y))
      if (stand) e.path = findPath(state.map, e.x, e.y, stand.x, stand.y)
      else e.task = 'idle'
    }
    return
  }

  // zdroj došel a nic nenesu → najdi nový stejného druhu
  if (depleted) {
    const next = findNearestResource(state.map, tgt.kind, tgt.gx, tgt.gy)
    if (next) {
      e.gather = next
      pathToStandNear(state, e, next.gx, next.gy)
    } else {
      e.task = 'idle'
    }
    return
  }

  // u zdroje → těž; jinak jdi k němu
  if (dist(e, tgt.gx, tgt.gy) <= GATHER_RANGE) {
    e.path = []
    e.carryKind = tgt.kind
    const gained = Math.min(GATHER_RATE * dt, CARRY_CAP - e.carry, tile!.amount)
    e.carry += gained
    tile!.amount -= gained
    if (tile!.amount <= 0) {
      tile!.resource = null
      tile!.blocked = false
    }
  } else if (!e.path.length) {
    pathToStandNear(state, e, tgt.gx, tgt.gy)
  }
}

export function gatherSystem(state: GameState, dt: number): void {
  for (const e of state.entities) {
    if (isUnit(e.kind) && e.task === 'gather') villagerGather(state, e, dt)
  }
}

export function trainSystem(state: GameState, dt: number): void {
  for (const b of state.entities) {
    if (isUnit(b.kind) || b.buildLeft > 0 || !b.queue.length) continue
    const item = b.queue[0]
    item.left -= dt
    if (item.left <= 0) {
      const stand = nearestWalkable(state.map, Math.round(b.x), Math.round(b.y))
      const px = stand ? stand.x : Math.round(b.x)
      const py = stand ? stand.y : Math.round(b.y)
      spawn(state, b.owner, item.kind, px, py)
      b.queue.shift()
    }
  }
}

export function constructionSystem(state: GameState, dt: number): void {
  for (const b of state.entities) {
    if (b.buildLeft > 0) {
      b.buildLeft -= dt
      if (b.buildLeft < 0) b.buildLeft = 0
    }
  }
}
