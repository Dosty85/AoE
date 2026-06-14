import { Graphics, Rectangle, Renderer, Texture } from 'pixi.js'
import { TILE_W, TILE_H } from '@shared/constants'
import { loadSprites } from './sprites'

const HW = TILE_W / 2
const HH = TILE_H / 2

export interface ArtPiece {
  texture: Texture
  anchorX: number
  anchorY: number
  scale?: number // měřítko zobrazení (renderované sprity); procedurální = 1
  anims?: Record<string, Texture[]> // animace (idle/walk) pro jednotky
  fps?: number
}

// ---- barevné utility ----
function shade(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f))
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f))
  const b = Math.min(255, Math.round((color & 0xff) * f))
  return (r << 16) | (g << 8) | b
}

function bake(
  renderer: Renderer,
  draw: (g: Graphics) => void,
  frame: Rectangle,
  anchorX: number,
  anchorY: number,
): ArtPiece {
  const g = new Graphics()
  draw(g)
  const texture = renderer.generateTexture({ target: g, frame, resolution: 2, antialias: true })
  g.destroy()
  return { texture, anchorX, anchorY }
}

function diamond(g: Graphics, hw: number, hh: number, cy: number, color: number): void {
  g.poly([0, cy - hh, hw, cy, 0, cy + hh, -hw, cy]).fill(color)
}

// ---- DLAŽDICE (anchor uprostřed) ----
const TILE_FRAME = new Rectangle(-HW, -HH, TILE_W, TILE_H)

function tile(renderer: Renderer, base: number, speckle: number): ArtPiece {
  return bake(
    renderer,
    (g) => {
      // hlavní plocha
      diamond(g, HW, HH, 0, base)
      // jemný horní highlight
      diamond(g, HW * 0.92, HH * 0.92, 0, shade(base, 1.06))
      diamond(g, HW * 0.7, HH * 0.7, 0, base)
      // textura
      const dots: [number, number][] = [
        [-30, -6], [20, 8], [-10, 12], [34, -4], [4, -12], [-44, 2], [48, 4], [-18, -10],
      ]
      for (const [dx, dy] of dots) g.circle(dx, dy, 2.2).fill(speckle)
      // obrys pro čitelnou mřížku
      g.poly([0, -HH, HW, 0, 0, HH, -HW, 0]).stroke({ width: 1, color: shade(base, 0.7), alpha: 0.6 })
    },
    TILE_FRAME,
    0.5,
    0.5,
  )
}

function waterTile(renderer: Renderer): ArtPiece {
  const base = 0x3f7fc4
  return bake(
    renderer,
    (g) => {
      diamond(g, HW, HH, 0, base)
      diamond(g, HW * 0.9, HH * 0.9, 0, shade(base, 1.12))
      // vlny
      g.ellipse(-16, -2, 14, 4).fill({ color: 0xffffff, alpha: 0.25 })
      g.ellipse(18, 8, 12, 3.5).fill({ color: 0xffffff, alpha: 0.2 })
      g.ellipse(2, 14, 10, 3).fill({ color: 0xffffff, alpha: 0.18 })
      g.poly([0, -HH, HW, 0, 0, HH, -HW, 0]).stroke({ width: 1, color: shade(base, 0.7), alpha: 0.5 })
    },
    TILE_FRAME,
    0.5,
    0.5,
  )
}

// ---- DEKORACE / ZDROJE (anchor dole uprostřed = stojí na dlaždici) ----
function objFrame(boxH: number, widen = 1): Rectangle {
  const w = TILE_W * widen
  return new Rectangle(-w / 2, -boxH, w, boxH)
}

function tree(renderer: Renderer): ArtPiece {
  const boxH = 64
  return bake(
    renderer,
    (g) => {
      // stín na zemi
      g.ellipse(0, -4, 18, 8).fill({ color: 0x000000, alpha: 0.18 })
      // kmen
      g.rect(-4, -26, 8, 24).fill(0x6b4a2b)
      // koruna — vrstvené koule pro objem
      const greens = [0x2f6b2a, 0x3a8534, 0x4a9d42]
      const blobs: [number, number, number, number][] = [
        [0, -34, 20, 0], [-12, -28, 14, 0], [12, -28, 14, 0], [-6, -46, 14, 1], [8, -44, 13, 1], [0, -54, 12, 2],
      ]
      for (const [x, y, r, ci] of blobs) g.circle(x, y, r).fill(greens[ci])
      g.circle(-6, -50, 6).fill({ color: 0x6fc05f, alpha: 0.5 })
    },
    objFrame(boxH),
    0.5,
    1.0,
  )
}

function goldRocks(renderer: Renderer): ArtPiece {
  const boxH = 30
  return bake(
    renderer,
    (g) => {
      g.ellipse(0, -3, 22, 9).fill({ color: 0x000000, alpha: 0.15 })
      const rocks: [number, number, number][] = [
        [-12, -8, 9], [8, -7, 10], [-2, -14, 9], [14, -12, 7], [-14, -14, 6],
      ]
      for (const [x, y, r] of rocks) {
        g.ellipse(x, y, r, r * 0.8).fill(0xc9a227)
        g.ellipse(x - r * 0.25, y - r * 0.3, r * 0.45, r * 0.35).fill(0xf2d65a)
      }
    },
    objFrame(boxH),
    0.5,
    1.0,
  )
}

function berryBush(renderer: Renderer): ArtPiece {
  const boxH = 30
  return bake(
    renderer,
    (g) => {
      g.ellipse(0, -3, 18, 7).fill({ color: 0x000000, alpha: 0.15 })
      g.circle(0, -12, 14).fill(0x2f6b2a)
      g.circle(-9, -10, 9).fill(0x3a8534)
      g.circle(9, -11, 9).fill(0x3a8534)
      const berries: [number, number][] = [[-6, -14], [4, -10], [9, -16], [-2, -8], [-11, -12], [12, -12]]
      for (const [x, y] of berries) g.circle(x, y, 2.4).fill(0xc0392b)
    },
    objFrame(boxH),
    0.5,
    1.0,
  )
}

// ---- BUDOVY (iso hranol + jehlanová střecha) ----
interface BuildingSpec {
  footprint: number // násobek dlaždice
  wallH: number
  roofH: number
  wall: number
  roof: number
}

function building(renderer: Renderer, s: BuildingSpec): ArtPiece {
  const fw = HW * s.footprint
  const fh = HH * s.footprint
  const boxH = s.wallH + s.roofH + fh + 6
  return bake(
    renderer,
    (g) => {
      // stín
      g.ellipse(0, -2, fw * 0.95, fh * 0.95).fill({ color: 0x000000, alpha: 0.2 })
      const top = -s.wallH // y horní hrany zdí
      // stěny — levá-přední (světlejší), pravá-přední (tmavší). Viditelné jsou ty směrem dolů (k divákovi).
      g.poly([-fw, 0, 0, fh, 0, fh + top, -fw, top]).fill(shade(s.wall, 0.9))
      g.poly([0, fh, fw, 0, fw, top, 0, fh + top]).fill(shade(s.wall, 0.74))
      // svislé hrany rohů zdí
      g.poly([0, fh, 0, fh + top]).stroke({ width: 1, color: shade(s.wall, 0.6), alpha: 0.4 })
      // jehlanová střecha. Body horní hrany zdí:
      // N (zadní) = (0, top - fh), S (přední) = (0, top + fh), W = (-fw, top), E = (fw, top)
      const apex = top - s.roofH
      // zadní plochy nejdřív (jsou schované za přední)
      g.poly([-fw, top, 0, top - fh, 0, apex]).fill(shade(s.roof, 1.12)) // levá-zadní
      g.poly([0, top - fh, fw, top, 0, apex]).fill(shade(s.roof, 1.0)) // pravá-zadní
      // přední plochy nakonec (překreslí zadní, správné překrytí)
      g.poly([-fw, top, 0, top + fh, 0, apex]).fill(shade(s.roof, 0.92)) // levá-přední
      g.poly([0, top + fh, fw, top, 0, apex]).fill(shade(s.roof, 0.78)) // pravá-přední
      // hřebenové hrany pro ostřejší siluetu
      g.poly([-fw, top, 0, apex]).stroke({ width: 1, color: shade(s.roof, 0.5), alpha: 0.5 })
      g.poly([fw, top, 0, apex]).stroke({ width: 1, color: shade(s.roof, 0.5), alpha: 0.5 })
      g.poly([0, top + fh, 0, apex]).stroke({ width: 1, color: shade(s.roof, 0.5), alpha: 0.4 })
    },
    objFrame(boxH, Math.max(1, s.footprint)),
    0.5,
    1.0,
  )
}

// ---- JEDNOTKY (jednoduchá iso figurka v barvě týmu) ----
function unit(renderer: Renderer, body: number, helmet: number | null): ArtPiece {
  const boxH = 38
  return bake(
    renderer,
    (g) => {
      g.ellipse(0, -2, 9, 4).fill({ color: 0x000000, alpha: 0.22 })
      // tělo
      g.roundRect(-6, -22, 12, 20, 4).fill(body)
      g.roundRect(-6, -22, 5, 20, 4).fill(shade(body, 1.2))
      // hlava
      g.circle(0, -27, 6).fill(0xe8b88a)
      if (helmet !== null) {
        g.poly([-6, -27, 6, -27, 4, -33, -4, -33]).fill(helmet)
        g.rect(-6, -28, 12, 2).fill(shade(helmet, 0.8))
      }
    },
    objFrame(boxH),
    0.5,
    1.0,
  )
}

// ---- registr veškerého artu ----
export interface ArtSet {
  grass: ArtPiece
  grass_dark: ArtPiece
  dirt: ArtPiece
  sand: ArtPiece
  water: ArtPiece
  tree: ArtPiece
  gold: ArtPiece
  berry: ArtPiece
  townCenter: ArtPiece
  house: ArtPiece
  barracks: ArtPiece
  villager: ArtPiece
  soldier: ArtPiece
}

export function buildArt(renderer: Renderer): ArtSet {
  return {
    grass: tile(renderer, 0x5aa045, 0x4e9038),
    grass_dark: tile(renderer, 0x4e9038, 0x447f31),
    dirt: tile(renderer, 0x9b7a4e, 0x876a42),
    sand: tile(renderer, 0xd6bd76, 0xc4a95f),
    water: waterTile(renderer),
    tree: tree(renderer),
    gold: goldRocks(renderer),
    berry: berryBush(renderer),
    townCenter: building(renderer, { footprint: 1.5, wallH: 46, roofH: 58, wall: 0xd8cdb0, roof: 0x5a8f4a }),
    house: building(renderer, { footprint: 0.8, wallH: 26, roofH: 30, wall: 0xe0d4b4, roof: 0xb5483a }),
    barracks: building(renderer, { footprint: 1.15, wallH: 34, roofH: 40, wall: 0xb9a886, roof: 0x8a5a3a }),
    villager: unit(renderer, 0x2d6cb5, null),
    soldier: unit(renderer, 0x6b6f78, 0x9aa0aa),
  }
}

/**
 * Kompletní sada: procedurální terén + (3D-renderované sprity objektů ∥ procedurální fallback).
 * Když `client/public/sprites/` chybí, vrátí čistě procedurální `buildArt`.
 */
export async function buildArtSet(renderer: Renderer): Promise<ArtSet> {
  const proc = buildArt(renderer)
  const loaded = await loadSprites()
  if (!loaded) return proc
  const pick = (k: keyof ArtSet): ArtPiece => loaded[k] ?? proc[k]
  return {
    ...proc,
    townCenter: pick('townCenter'),
    house: pick('house'),
    barracks: pick('barracks'),
    villager: pick('villager'),
    soldier: pick('soldier'),
    tree: pick('tree'),
    gold: pick('gold'),
    berry: pick('berry'),
  }
}
