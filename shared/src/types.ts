export type TerrainKind = 'grass' | 'grass_dark' | 'dirt' | 'water' | 'sand'

// Co stojí "na" dlaždici (zdroje / dekorace). Budovy a jednotky jsou entity, ne tile.
export type ResourceKind = 'wood' | 'food' | 'gold'

export interface MapTile {
  terrain: TerrainKind
  /** Zdroj na dlaždici (les = wood, keř = food, ložisko = gold), nebo null. */
  resource: ResourceKind | null
  /** Zbývající množství suroviny (0 pokud bez zdroje). */
  amount: number
  /** Neprůchodná (voda, zdroj, budova) — pro pathfinding. */
  blocked: boolean
}

export interface GameMap {
  size: number
  /** Řádkově (index = gy * size + gx). */
  tiles: MapTile[]
}

export function tileAt(map: GameMap, gx: number, gy: number): MapTile | undefined {
  if (gx < 0 || gy < 0 || gx >= map.size || gy >= map.size) return undefined
  return map.tiles[gy * map.size + gx]
}
