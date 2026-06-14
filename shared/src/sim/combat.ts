import { COMBAT } from '../constants'
import { Entity, GameState, entityById, isUnit, setBuildingBlocked } from './state'
import { findPath, nearestWalkable } from './pathfinding'

function centerDist(a: Entity, b: Entity): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Nejbližší nepřátelská entita v dohledu (jiný hráč, ne příroda). */
function enemyInSight(state: GameState, e: Entity, sight: number): Entity | null {
  let best: Entity | null = null
  let bd = sight
  for (const o of state.entities) {
    if (o.owner === e.owner || o.owner < 0 || o.hp <= 0) continue
    const d = centerDist(e, o) - o.radius
    if (d < bd) {
      bd = d
      best = o
    }
  }
  return best
}

export function combatSystem(state: GameState, dt: number): void {
  for (const e of state.entities) {
    if (!isUnit(e.kind)) continue
    if (e.atkCd > 0) e.atkCd -= dt
    const stat = COMBAT[e.kind]

    let tgt = e.target != null ? entityById(state, e.target) ?? null : null
    if (tgt && tgt.hp <= 0) {
      tgt = null
      e.target = null
    }
    // auto-zaměření, když je voják nečinný
    if (!tgt && e.aggro && e.path.length === 0 && e.task !== 'gather') {
      tgt = enemyInSight(state, e, stat.sight)
      e.target = tgt ? tgt.id : null
    }
    if (!tgt) continue

    const d = centerDist(e, tgt) - tgt.radius
    if (d <= stat.range) {
      e.path = []
      if (e.atkCd <= 0) {
        tgt.hp -= stat.damage
        e.atkCd = stat.cooldown
      }
    } else if (e.path.length === 0) {
      const stand = nearestWalkable(state.map, Math.round(tgt.x), Math.round(tgt.y))
      if (stand) e.path = findPath(state.map, e.x, e.y, stand.x, stand.y)
    }
  }
}

/** Odstraní entity s hp<=0, uvolní dlaždice po budovách. */
export function removeDead(state: GameState): void {
  if (!state.entities.some((e) => e.hp <= 0)) return
  for (const e of state.entities) {
    if (e.hp <= 0 && !isUnit(e.kind)) setBuildingBlocked(state, e, false)
  }
  state.entities = state.entities.filter((e) => e.hp > 0)
}
