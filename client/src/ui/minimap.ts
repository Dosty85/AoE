import { GameMap } from '@shared/types'
import { Entity, isUnit } from '@shared/sim/state'

const TERRAIN_COLOR: Record<string, string> = {
  grass: '#5aa045',
  grass_dark: '#4e9038',
  dirt: '#9b7a4e',
  sand: '#d6bd76',
  water: '#3f7fc4',
}

export class Minimap {
  private canvas = document.createElement('canvas')
  private ctx: CanvasRenderingContext2D
  private bg = document.createElement('canvas') // cache terénu
  private px: number
  private scale: number

  constructor(
    mapSize: number,
    sizePx: number,
    private onJump: (gx: number, gy: number) => void,
  ) {
    this.px = sizePx
    this.scale = sizePx / mapSize
    this.canvas.width = this.bg.width = sizePx
    this.canvas.height = this.bg.height = sizePx
    this.canvas.style.cssText =
      'position:fixed;right:12px;bottom:12px;border:2px solid #6b5a3a;border-radius:6px;' +
      'background:#111;z-index:10;cursor:pointer;'
    this.ctx = this.canvas.getContext('2d')!
    document.body.appendChild(this.canvas)
    this.canvas.addEventListener('pointerdown', (e) => {
      const r = this.canvas.getBoundingClientRect()
      const gx = Math.floor(((e.clientX - r.left) / this.px) * mapSize)
      const gy = Math.floor(((e.clientY - r.top) / this.px) * mapSize)
      this.onJump(gx, gy)
    })
  }

  /** Vykreslí statický terén do cache (volá se jednou + po změnách terénu). */
  drawTerrain(map: GameMap): void {
    const c = this.bg.getContext('2d')!
    const s = this.scale
    for (let gy = 0; gy < map.size; gy++) {
      for (let gx = 0; gx < map.size; gx++) {
        const t = map.tiles[gy * map.size + gx]
        c.fillStyle =
          t.resource === 'wood'
            ? '#2f6b2a'
            : t.resource === 'gold'
              ? '#e0c020'
              : t.resource === 'food'
                ? '#c0392b'
                : TERRAIN_COLOR[t.terrain] ?? '#444'
        c.fillRect(Math.floor(gx * s), Math.floor(gy * s), Math.ceil(s), Math.ceil(s))
      }
    }
  }

  /** Překreslí entity a značku kamery. */
  update(entities: Entity[], me: number, camTile: { gx: number; gy: number }): void {
    const ctx = this.ctx
    const s = this.scale
    ctx.clearRect(0, 0, this.px, this.px)
    ctx.drawImage(this.bg, 0, 0)
    for (const e of entities) {
      ctx.fillStyle = e.owner === me ? '#46d65a' : e.owner < 0 ? '#aaaaaa' : '#e24a3a'
      const r = isUnit(e.kind) ? 1.5 : 3
      ctx.fillRect(e.x * s - r / 2, e.y * s - r / 2, r, r)
    }
    // značka středu kamery
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.strokeRect(camTile.gx * s - 6, camTile.gy * s - 6, 12, 12)
  }
}
