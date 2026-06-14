import { Assets, Texture } from 'pixi.js'
import { ArtPiece } from './art'

/** Měřítko zobrazení renderovaných spritů (kalibrace na velikost dlaždice). */
const SPRITE_SCALE = 0.5

interface ManifestEntry {
  file: string
  anchorX: number
  anchorY: number
  scale?: number
  fps?: number
  anims?: Record<string, string[]>
}

/**
 * Načte 3D-renderované sprity z `client/public/sprites/` (manifest + textury).
 * Vrací mapu kind -> ArtPiece, nebo null když sprity chybí (→ fallback na procedurální).
 */
export async function loadSprites(): Promise<Record<string, ArtPiece> | null> {
  let manifest: Record<string, ManifestEntry>
  try {
    const res = await fetch('sprites/manifest.json')
    if (!res.ok) return null
    manifest = await res.json()
  } catch {
    return null
  }
  const out: Record<string, ArtPiece> = {}
  for (const [name, m] of Object.entries(manifest)) {
    try {
      const scale = m.scale ?? SPRITE_SCALE
      if (m.anims) {
        const anims: Record<string, Texture[]> = {}
        for (const [key, files] of Object.entries(m.anims)) {
          anims[key] = await Promise.all(files.map((f) => Assets.load(`sprites/${f}`) as Promise<Texture>))
        }
        const idle = anims.idle ?? Object.values(anims)[0]
        out[name] = { texture: idle[0], anchorX: m.anchorX, anchorY: m.anchorY, scale, anims, fps: m.fps ?? 10 }
      } else {
        const texture: Texture = await Assets.load(`sprites/${m.file}`)
        out[name] = { texture, anchorX: m.anchorX, anchorY: m.anchorY, scale }
      }
    } catch {
      // jeden chybějící sprite nevadí — zbytek se použije, kind spadne na fallback
    }
  }
  return Object.keys(out).length ? out : null
}
