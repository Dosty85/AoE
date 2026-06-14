import { GameMap, tileAt } from '../types'
import { Vec } from './state'

function walkable(map: GameMap, gx: number, gy: number): boolean {
  const t = tileAt(map, gx, gy)
  return !!t && !t.blocked
}

const NEIGHBORS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.4142],
  [1, -1, 1.4142],
  [-1, 1, 1.4142],
  [-1, -1, 1.4142],
]

function key(gx: number, gy: number): number {
  return gy * 100000 + gx
}

/**
 * A* na gridu. Vrací seznam waypointů (středy dlaždic) od startu (vyjma) k cíli.
 * `goalBlockedOk` = cíl smí být neprůchodný (např. jdu k surovině/budově a zastavím vedle).
 * Prázdné pole = cesta neexistuje nebo už jsme tam.
 */
export function findPath(
  map: GameMap,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  goalBlockedOk = false,
): Vec[] {
  sx = Math.round(sx)
  sy = Math.round(sy)
  tx = Math.round(tx)
  ty = Math.round(ty)
  if (sx === tx && sy === ty) return []
  if (!goalBlockedOk && !walkable(map, tx, ty)) {
    const alt = nearestWalkable(map, tx, ty)
    if (!alt) return []
    tx = alt.x
    ty = alt.y
  }

  const h = (gx: number, gy: number) => Math.hypot(gx - tx, gy - ty)
  const open: { gx: number; gy: number; f: number }[] = [{ gx: sx, gy: sy, f: h(sx, sy) }]
  const came = new Map<number, number>()
  const g = new Map<number, number>([[key(sx, sy), 0]])
  const closed = new Set<number>()

  while (open.length) {
    // vyber uzel s nejmenším f (lineárně — grid je malý)
    let bi = 0
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i
    const cur = open.splice(bi, 1)[0]
    const ck = key(cur.gx, cur.gy)
    if (cur.gx === tx && cur.gy === ty) return reconstruct(came, ck)
    if (closed.has(ck)) continue
    closed.add(ck)

    for (const [dx, dy, cost] of NEIGHBORS) {
      const nx = cur.gx + dx
      const ny = cur.gy + dy
      const nk = key(nx, ny)
      const isGoal = nx === tx && ny === ty
      const passable = isGoal && goalBlockedOk ? true : walkable(map, nx, ny)
      if (!passable || closed.has(nk)) continue
      // zákaz "prořezávání" rohů u diagonál
      if (dx !== 0 && dy !== 0) {
        if (!walkable(map, cur.gx + dx, cur.gy) || !walkable(map, cur.gx, cur.gy + dy)) continue
      }
      const ng = (g.get(ck) ?? Infinity) + cost
      if (ng < (g.get(nk) ?? Infinity)) {
        came.set(nk, ck)
        g.set(nk, ng)
        open.push({ gx: nx, gy: ny, f: ng + h(nx, ny) })
      }
    }
  }
  return []
}

function reconstruct(came: Map<number, number>, end: number): Vec[] {
  const path: Vec[] = []
  let cur: number | undefined = end
  while (cur !== undefined) {
    const gx = cur % 100000
    const gy = Math.floor(cur / 100000)
    path.push({ x: gx, y: gy })
    cur = came.get(cur)
  }
  path.reverse()
  path.shift() // vyhoď start
  return path
}

/** Najde nejbližší průchodnou dlaždici kolem (gx,gy) spirálovým hledáním. */
export function nearestWalkable(map: GameMap, gx: number, gy: number): Vec | null {
  if (walkable(map, gx, gy)) return { x: gx, y: gy }
  for (let r = 1; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        if (walkable(map, gx + dx, gy + dy)) return { x: gx + dx, y: gy + dy }
      }
    }
  }
  return null
}
