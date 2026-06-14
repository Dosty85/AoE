import { GameMap } from '../types'
import { GameState, addPlayer, spawn } from './state'

/** Rohové pozice základen podle počtu hráčů (zrcadlené). */
export function baseCorners(size: number, players: number): Array<[number, number]> {
  const all: Array<[number, number]> = [
    [9, 9],
    [size - 10, size - 10],
    [size - 10, 9],
    [9, size - 10],
  ]
  return all.slice(0, players)
}

/**
 * Vyčistí okolí základen (voda → tráva, odstraní suroviny, odblokuje).
 * Deterministické — spouští shodně server i klient, aby seděl terén.
 */
export function clearBaseAreas(map: GameMap, players: number): void {
  const size = map.size
  for (const [cx, cy] of baseCorners(size, players)) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const gx = cx + dx
        const gy = cy + dy
        if (gx < 0 || gy < 0 || gx >= size || gy >= size) continue
        const t = map.tiles[gy * size + gx]
        if (!t) continue
        if (t.terrain === 'water') t.terrain = 'grass'
        t.resource = null
        t.amount = 0
        t.blocked = false
      }
    }
  }
}

/** Rozmístí základny a jednotky pro N hráčů (server-side). */
export function initMatch(state: GameState, players = 2): void {
  clearBaseAreas(state.map, players)
  baseCorners(state.map.size, players).forEach(([cx, cy], owner) => {
    addPlayer(state)
    spawn(state, owner, 'townCenter', cx, cy)
    spawn(state, owner, 'house', cx + 3, cy - 2)
    spawn(state, owner, 'barracks', cx - 2, cy + 3)
    spawn(state, owner, 'villager', cx - 1, cy - 1)
    spawn(state, owner, 'villager', cx + 1, cy - 1)
    spawn(state, owner, 'villager', cx + 1, cy + 1)
  })
}
