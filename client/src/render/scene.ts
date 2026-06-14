import { Application, Container, Sprite } from 'pixi.js'
import { GameMap } from '@shared/types'
import { ArtPiece, ArtSet } from './art'
import { tileToWorld, depth } from './iso'

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export class Scene {
  readonly app: Application
  readonly world: Container // kamera (posun + zoom)
  readonly ground: Container // dlaždice
  readonly decals: Container // značky pod objekty (výběr, cíle)
  readonly objects: Container // dekorace, budovy, jednotky (řazené dle hloubky)
  readonly overlay: Container // nad objekty, world-space (health bary)
  readonly ui: Container // screen-space overlay (výběrový box, HUD)

  private dragging = false
  private lastX = 0
  private lastY = 0

  private constructor(app: Application) {
    this.app = app
    this.world = new Container()
    this.ground = new Container()
    this.decals = new Container()
    this.objects = new Container()
    this.overlay = new Container()
    this.ui = new Container()
    this.objects.sortableChildren = true
    this.world.addChild(this.ground)
    this.world.addChild(this.decals)
    this.world.addChild(this.objects)
    this.world.addChild(this.overlay)
    app.stage.addChild(this.world)
    app.stage.addChild(this.ui)
    this.setupCamera()
  }

  /** Klientské pixely (vůči canvasu) -> world souřadnice (před iso projekcí). */
  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.app.canvas.getBoundingClientRect()
    return {
      x: (clientX - r.left - this.world.x) / this.world.scale.x,
      y: (clientY - r.top - this.world.y) / this.world.scale.y,
    }
  }

  moveCamera(dx: number, dy: number): void {
    this.world.x += dx
    this.world.y += dy
  }

  static async create(mount: HTMLElement): Promise<Scene> {
    const app = new Application()
    await app.init({
      background: 0x1d1f21,
      resizeTo: window,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    mount.appendChild(app.canvas)
    return new Scene(app)
  }

  /** Umístí sprite na grid pozici s daným artem; vrací sprite pro pozdější update. */
  placeObject(art: ArtPiece, gx: number, gy: number, layerBias = 0): Sprite {
    const s = new Sprite(art.texture)
    s.anchor.set(art.anchorX, art.anchorY)
    const w = tileToWorld(gx, gy)
    s.position.set(w.x, w.y)
    s.zIndex = depth(gx, gy) * 100 + layerBias
    this.objects.addChild(s)
    return s
  }

  /** Vykreslí terén + zdroje z mapy. */
  renderMap(map: GameMap, art: ArtSet): void {
    const terrainArt: Record<string, ArtPiece> = {
      grass: art.grass,
      grass_dark: art.grass_dark,
      dirt: art.dirt,
      sand: art.sand,
      water: art.water,
    }
    for (let gy = 0; gy < map.size; gy++) {
      for (let gx = 0; gx < map.size; gx++) {
        const t = map.tiles[gy * map.size + gx]
        const a = terrainArt[t.terrain]
        const s = new Sprite(a.texture)
        s.anchor.set(a.anchorX, a.anchorY)
        const w = tileToWorld(gx, gy)
        s.position.set(w.x, w.y)
        this.ground.addChild(s)
        if (t.resource === 'wood') this.placeObject(art.tree, gx, gy, 1)
        else if (t.resource === 'gold') this.placeObject(art.gold, gx, gy, 1)
        else if (t.resource === 'food') this.placeObject(art.berry, gx, gy, 1)
      }
    }
  }

  /** Vystředí kameru na grid pozici. */
  centerOn(gx: number, gy: number): void {
    const w = tileToWorld(gx, gy)
    this.world.position.set(
      this.app.screen.width / 2 - w.x * this.world.scale.x,
      this.app.screen.height / 2 - w.y * this.world.scale.y,
    )
  }

  private setupCamera(): void {
    const canvas = this.app.canvas
    // posun pouze prostředním tlačítkem (levé = výběr, pravé = příkaz)
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 1) return
      e.preventDefault()
      this.dragging = true
      this.lastX = e.clientX
      this.lastY = e.clientY
    })
    window.addEventListener('pointerup', (e) => {
      if (e.button === 1) this.dragging = false
    })
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return
      this.world.x += e.clientX - this.lastX
      this.world.y += e.clientY - this.lastY
      this.lastX = e.clientX
      this.lastY = e.clientY
    })
    // potlač kontextové menu, ať pravé tlačítko slouží jako příkaz
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
        const next = clamp(this.world.scale.x * factor, 0.4, 2.5)
        const rect = canvas.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const wx = (mx - this.world.x) / this.world.scale.x
        const wy = (my - this.world.y) / this.world.scale.y
        this.world.scale.set(next)
        this.world.x = mx - wx * next
        this.world.y = my - wy * next
      },
      { passive: false },
    )
  }
}
