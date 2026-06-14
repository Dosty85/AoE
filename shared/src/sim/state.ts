import { GameMap, ResourceKind, tileAt } from '../types'
import { BASE_POP } from '../constants'

export type UnitKind = 'villager' | 'soldier'
export type BuildingKind = 'townCenter' | 'house' | 'barracks'
export type EntityKind = UnitKind | BuildingKind

export const UNIT_KINDS: ReadonlySet<EntityKind> = new Set<EntityKind>(['villager', 'soldier'])
export const isUnit = (k: EntityKind): k is UnitKind => UNIT_KINDS.has(k)

export interface Vec {
  x: number
  y: number
}

export type UnitTask = 'idle' | 'gather'

export interface GatherTarget {
  gx: number
  gy: number
  kind: ResourceKind
}

export interface TrainItem {
  kind: UnitKind
  left: number // zbývající sekundy
  total: number
}

export interface Entity {
  id: number
  owner: number // index hráče, -1 = neutrál/příroda
  kind: EntityKind
  x: number // pozice ve world-tile souřadnicích (float), střed dlaždice = celé číslo
  y: number
  hp: number
  maxHp: number
  speed: number // dlaždice za sekundu (0 = nehybné, budovy)
  path: Vec[] // zbývající waypointy (středy dlaždic)
  // --- jednotky (vesničan) ---
  task: UnitTask
  gather: GatherTarget | null
  carry: number
  carryKind: ResourceKind | null
  harvestT: number
  // --- boj ---
  target: number | null // id zaměřeného nepřítele
  atkCd: number // zbývající cooldown útoku
  aggro: boolean // sám zaměřuje nepřátele v dosahu (vojáci ano)
  // --- budovy ---
  queue: TrainItem[]
  buildLeft: number // >0 = ve výstavbě, 0 = hotovo
  radius: number // půdorys (poloměr v dlaždicích)
}

export interface Player {
  id: number
  wood: number
  food: number
  gold: number
}

export interface GameState {
  map: GameMap
  entities: Entity[]
  players: Player[]
  nextId: number
  tick: number
  over: boolean
  winner: number | null
}

export function createState(map: GameMap): GameState {
  return { map, entities: [], players: [], nextId: 1, tick: 0, over: false, winner: null }
}

/** Hráč je poražen, když ztratí všechny Town Center. Zbude-li jeden, vyhrává. */
export function checkVictory(state: GameState): void {
  if (state.over || state.players.length < 2) return
  const alive: number[] = []
  for (let p = 0; p < state.players.length; p++) {
    if (state.entities.some((e) => e.owner === p && e.kind === 'townCenter')) alive.push(p)
  }
  if (alive.length <= 1) {
    state.over = true
    state.winner = alive[0] ?? null
  }
}

export function addPlayer(state: GameState, wood = 200, food = 200, gold = 100): Player {
  const p: Player = { id: state.players.length, wood, food, gold }
  state.players.push(p)
  return p
}

export function playerById(state: GameState, id: number): Player | undefined {
  return state.players[id]
}

export const isDropoff = (k: EntityKind): boolean => k === 'townCenter'

/** Využitá populace hráče = jednotky + zařazené ve frontách. */
export function popUsed(state: GameState, owner: number): number {
  let n = 0
  for (const e of state.entities) {
    if (e.owner !== owner) continue
    if (isUnit(e.kind)) n++
    else n += e.queue.length
  }
  return n
}

/** Populační strop hráče = základ + domy. */
export function popCap(state: GameState, owner: number): number {
  let cap = BASE_POP
  for (const e of state.entities) {
    if (e.owner === owner && e.kind === 'house' && e.buildLeft <= 0) cap += 5
  }
  return cap
}

const STATS: Record<EntityKind, { hp: number; speed: number; radius: number }> = {
  villager: { hp: 40, speed: 2.6, radius: 0 },
  soldier: { hp: 70, speed: 2.2, radius: 0 },
  townCenter: { hp: 1000, speed: 0, radius: 1 },
  house: { hp: 250, speed: 0, radius: 0 },
  barracks: { hp: 500, speed: 0, radius: 0 },
}

/** Nastaví/zruší blokaci půdorysu budovy. */
export function setBuildingBlocked(state: GameState, e: Entity, blocked: boolean): void {
  const cx = Math.round(e.x)
  const cy = Math.round(e.y)
  for (let dy = -e.radius; dy <= e.radius; dy++) {
    for (let dx = -e.radius; dx <= e.radius; dx++) {
      const t = tileAt(state.map, cx + dx, cy + dy)
      if (t) t.blocked = blocked
    }
  }
}

export function spawn(
  state: GameState,
  owner: number,
  kind: EntityKind,
  x: number,
  y: number,
  buildLeft = 0,
): Entity {
  const s = STATS[kind]
  const e: Entity = {
    id: state.nextId++,
    owner,
    kind,
    x,
    y,
    hp: s.hp,
    maxHp: s.hp,
    speed: s.speed,
    path: [],
    task: 'idle',
    gather: null,
    carry: 0,
    carryKind: null,
    harvestT: 0,
    target: null,
    atkCd: 0,
    aggro: kind === 'soldier',
    queue: [],
    buildLeft: isUnit(kind) ? 0 : buildLeft,
    radius: s.radius,
  }
  state.entities.push(e)
  if (!isUnit(kind)) setBuildingBlocked(state, e, true)
  return e
}

export function entityById(state: GameState, id: number): Entity | undefined {
  return state.entities.find((e) => e.id === id)
}
