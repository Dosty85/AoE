// Izometrická dlaždice: poměr 2:1
export const TILE_W = 128
export const TILE_H = 64

// Velikost mapy (čtvercový grid MAP_SIZE x MAP_SIZE)
export const MAP_SIZE = 48

// Logický tick simulace (Hz) — pevný krok pro deterministické chování
export const SIM_HZ = 20
export const SIM_DT = 1 / SIM_HZ

// ---- ekonomika ----
export const CARRY_CAP = 10 // kolik unese vesničan
export const GATHER_RATE = 1.3 // surovin za sekundu
export const GATHER_RANGE = 1.6 // vzdálenost ke zdroji pro těžbu
export const DROP_RANGE = 1.8 // vzdálenost k budově pro odložení
export const BASE_POP = 5
export const POP_PER_HOUSE = 5
export const MAX_POP = 200

export type Cost = { wood?: number; food?: number; gold?: number }

export const UNIT_COST: Record<'villager' | 'soldier', Cost> = {
  villager: { food: 50 },
  soldier: { food: 60, gold: 20 },
}
export const TRAIN_TIME: Record<'villager' | 'soldier', number> = {
  villager: 6,
  soldier: 8,
}
export const BUILDING_COST: Record<'townCenter' | 'house' | 'barracks', Cost> = {
  townCenter: { wood: 350 },
  house: { wood: 30 },
  barracks: { wood: 150 },
}
export const BUILD_TIME: Record<'townCenter' | 'house' | 'barracks', number> = {
  townCenter: 30,
  house: 8,
  barracks: 14,
}
// půdorys budovy (poloměr v dlaždicích kolem středu, 0 = 1×1)
export const BUILDING_RADIUS: Record<'townCenter' | 'house' | 'barracks', number> = {
  townCenter: 1,
  house: 0,
  barracks: 0,
}

// ---- boj ----
export interface CombatStat {
  damage: number
  range: number // dosah útoku v dlaždicích
  cooldown: number // sekundy mezi útoky
  sight: number // poloměr automatického zaměření
}
export const COMBAT: Record<'villager' | 'soldier', CombatStat> = {
  villager: { damage: 3, range: 1.2, cooldown: 1.3, sight: 4 },
  soldier: { damage: 11, range: 1.3, cooldown: 1.0, sight: 7 },
}
