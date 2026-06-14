import { GameMap, tileAt } from '../types'
import {
  BUILDING_COST,
  BUILDING_RADIUS,
  BUILD_TIME,
  Cost,
  TRAIN_TIME,
  UNIT_COST,
} from '../constants'
import {
  BuildingKind,
  Entity,
  GameState,
  Player,
  UnitKind,
  Vec,
  entityById,
  isUnit,
  popCap,
  popUsed,
  checkVictory,
} from './state'
import { spawn } from './state'
import { findPath, nearestWalkable } from './pathfinding'
import { constructionSystem, findNearestResource, gatherSystem, trainSystem } from './economy'
import { combatSystem, removeDead } from './combat'

export type Command =
  | { type: 'move'; ids: number[]; tx: number; ty: number }
  | { type: 'gather'; ids: number[]; gx: number; gy: number }
  | { type: 'train'; buildingId: number; unit: UnitKind }
  | { type: 'build'; player: number; kind: BuildingKind; gx: number; gy: number }
  | { type: 'attack'; ids: number[]; targetId: number }

// ---- suroviny ----
export function canAfford(p: Player, c: Cost): boolean {
  return (p.wood >= (c.wood ?? 0)) && p.food >= (c.food ?? 0) && p.gold >= (c.gold ?? 0)
}
function pay(p: Player, c: Cost): void {
  p.wood -= c.wood ?? 0
  p.food -= c.food ?? 0
  p.gold -= c.gold ?? 0
}

/** Lze na (cx,cy) s daným poloměrem postavit budovu? */
export function canPlace(map: GameMap, cx: number, cy: number, radius: number): boolean {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const t = tileAt(map, cx + dx, cy + dy)
      if (!t || t.blocked || t.terrain === 'water') return false
    }
  }
  return true
}

/** Rozmístí n jednotek do bloku kolem cíle — spirála přes průchodné dlaždice. */
export function formationTargets(map: GameMap, n: number, cx: number, cy: number): Vec[] {
  cx = Math.round(cx)
  cy = Math.round(cy)
  const out: Vec[] = []
  const used = new Set<number>()
  const tryAdd = (x: number, y: number) => {
    const w = nearestWalkable(map, x, y)
    if (!w) return
    const k = w.y * 100000 + w.x
    if (used.has(k)) return
    used.add(k)
    out.push(w)
  }
  for (let r = 0; out.length < n && r < 14; r++) {
    for (let dy = -r; dy <= r && out.length < n; dy++) {
      for (let dx = -r; dx <= r && out.length < n; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        tryAdd(cx + dx, cy + dy)
      }
    }
  }
  while (out.length < n) out.push({ x: cx, y: cy })
  return out
}

export function applyCommand(state: GameState, cmd: Command): void {
  switch (cmd.type) {
    case 'move': {
      const movers = cmd.ids
        .map((id) => entityById(state, id))
        .filter((e): e is Entity => !!e && isUnit(e.kind))
      const targets = formationTargets(state.map, movers.length, cmd.tx, cmd.ty)
      movers.forEach((e, i) => {
        e.task = 'idle'
        e.gather = null
        e.target = null
        const t = targets[i] ?? targets[targets.length - 1]
        e.path = findPath(state.map, e.x, e.y, t.x, t.y)
      })
      break
    }
    case 'attack': {
      for (const id of cmd.ids) {
        const e = entityById(state, id)
        if (!e || !isUnit(e.kind)) continue
        e.task = 'idle'
        e.gather = null
        e.aggro = true
        e.target = cmd.targetId
        e.path = []
      }
      break
    }
    case 'gather': {
      const tile = tileAt(state.map, cmd.gx, cmd.gy)
      const target =
        tile && tile.resource && tile.amount > 0
          ? { gx: cmd.gx, gy: cmd.gy, kind: tile.resource }
          : null
      for (const id of cmd.ids) {
        const e = entityById(state, id)
        if (!e || e.kind !== 'villager') continue
        const t = target ?? (tile?.resource ? findNearestResource(state.map, tile.resource, cmd.gx, cmd.gy) : null)
        if (!t) continue
        e.task = 'gather'
        e.gather = t
        const stand = nearestWalkable(state.map, t.gx, t.gy)
        if (stand) e.path = findPath(state.map, e.x, e.y, stand.x, stand.y)
      }
      break
    }
    case 'train': {
      const b = entityById(state, cmd.buildingId)
      if (!b || isUnit(b.kind) || b.buildLeft > 0) break
      const p = state.players[b.owner]
      if (!p) break
      const cost = UNIT_COST[cmd.unit]
      if (!canAfford(p, cost)) break
      if (popUsed(state, b.owner) >= popCap(state, b.owner)) break
      pay(p, cost)
      b.queue.push({ kind: cmd.unit, left: TRAIN_TIME[cmd.unit], total: TRAIN_TIME[cmd.unit] })
      break
    }
    case 'build': {
      const p = state.players[cmd.player]
      if (!p) break
      const radius = BUILDING_RADIUS[cmd.kind]
      if (!canPlace(state.map, cmd.gx, cmd.gy, radius)) break
      const cost = BUILDING_COST[cmd.kind]
      if (!canAfford(p, cost)) break
      pay(p, cost)
      spawn(state, cmd.player, cmd.kind, cmd.gx, cmd.gy, BUILD_TIME[cmd.kind])
      break
    }
  }
}

function moveAlong(e: Entity, dt: number): void {
  let remaining = e.speed * dt
  while (remaining > 0 && e.path.length) {
    const wp = e.path[0]
    const dx = wp.x - e.x
    const dy = wp.y - e.y
    const d = Math.hypot(dx, dy)
    if (d <= remaining) {
      e.x = wp.x
      e.y = wp.y
      e.path.shift()
      remaining -= d
    } else {
      e.x += (dx / d) * remaining
      e.y += (dy / d) * remaining
      remaining = 0
    }
  }
}

/** Jeden krok simulace o pevný čas dt (sekundy). */
export function step(state: GameState, dt: number): void {
  state.tick++
  for (const e of state.entities) {
    if (e.path.length) moveAlong(e, dt)
  }
  gatherSystem(state, dt)
  trainSystem(state, dt)
  constructionSystem(state, dt)
  combatSystem(state, dt)
  removeDead(state)
  checkVictory(state)
}
