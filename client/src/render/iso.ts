import { TILE_W, TILE_H } from '@shared/constants'

const HW = TILE_W / 2
const HH = TILE_H / 2

/** Grid (gx, gy) -> world pixel souřadnice středu horní plochy dlaždice. */
export function tileToWorld(gx: number, gy: number): { x: number; y: number } {
  return {
    x: (gx - gy) * HW,
    y: (gx + gy) * HH,
  }
}

/** Inverze: world pixel -> zlomkové grid souřadnice. Floor dá index dlaždice. */
export function worldToTile(wx: number, wy: number): { gx: number; gy: number } {
  const a = wx / HW
  const b = wy / HH
  return {
    gx: Math.floor((a + b) / 2),
    gy: Math.floor((b - a) / 2),
  }
}

/** Hloubkové řazení: dlaždice/entity dál "vzadu" (menší gx+gy) se kreslí dřív. */
export function depth(gx: number, gy: number): number {
  return gx + gy
}
