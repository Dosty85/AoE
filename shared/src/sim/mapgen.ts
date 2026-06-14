import { GameMap, MapTile, TerrainKind } from '../types'
import { RNG } from './rng'

function blank(terrain: TerrainKind): MapTile {
  return { terrain, resource: null, amount: 0, blocked: false }
}

/** Vykreslí kruhový "blob" do mapy přes callback na každou zasaženou dlaždici. */
function stamp(
  size: number,
  cx: number,
  cy: number,
  radius: number,
  rng: RNG,
  fn: (gx: number, gy: number) => void,
) {
  const r = Math.ceil(radius)
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const gx = cx + dx
      const gy = cy + dy
      if (gx < 0 || gy < 0 || gx >= size || gy >= size) continue
      const dist = Math.sqrt(dx * dx + dy * dy)
      // měkký okraj — čím dál od středu, tím menší šance
      if (dist <= radius * (0.6 + rng.next() * 0.4)) fn(gx, gy)
    }
  }
}

export function generateMap(seed: number, size: number): GameMap {
  const rng = new RNG(seed)
  const tiles: MapTile[] = []
  for (let i = 0; i < size * size; i++) {
    tiles.push(blank(rng.chance(0.18) ? 'grass_dark' : 'grass'))
  }
  const map: GameMap = { size, tiles }
  const at = (gx: number, gy: number) => tiles[gy * size + gx]

  // jezera (voda — neprůchodná)
  const lakes = rng.int(2, 4)
  for (let i = 0; i < lakes; i++) {
    const cx = rng.int(6, size - 6)
    const cy = rng.int(6, size - 6)
    stamp(size, cx, cy, rng.int(2, 4), rng, (gx, gy) => {
      const t = at(gx, gy)
      t.terrain = 'water'
      t.blocked = true
      t.resource = null
    })
  }

  // lesy (dřevo)
  const forests = rng.int(8, 12)
  for (let i = 0; i < forests; i++) {
    const cx = rng.int(2, size - 2)
    const cy = rng.int(2, size - 2)
    stamp(size, cx, cy, rng.int(2, 4), rng, (gx, gy) => {
      const t = at(gx, gy)
      if (t.terrain === 'water' || t.resource) return
      if (rng.chance(0.85)) {
        t.resource = 'wood'
        t.amount = 100
        t.blocked = true
      }
    })
  }

  // ložiska zlata (malé shluky)
  const golds = rng.int(4, 7)
  for (let i = 0; i < golds; i++) {
    const cx = rng.int(3, size - 3)
    const cy = rng.int(3, size - 3)
    stamp(size, cx, cy, 1.4, rng, (gx, gy) => {
      const t = at(gx, gy)
      if (t.terrain === 'water' || t.resource) return
      t.terrain = 'sand'
      t.resource = 'gold'
      t.amount = 150
      t.blocked = true
    })
  }

  // keře s jídlem (rozptýlené)
  const bushes = rng.int(20, 30)
  for (let i = 0; i < bushes; i++) {
    const gx = rng.int(1, size - 1)
    const gy = rng.int(1, size - 1)
    const t = at(gx, gy)
    if (t.terrain === 'water' || t.resource) continue
    t.resource = 'food'
    t.amount = 75
    t.blocked = true
  }

  return map
}
