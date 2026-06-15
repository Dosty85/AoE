import { AnimatedSprite, Graphics, Sprite, Texture } from 'pixi.js'
import { tileAt } from '@shared/types'
import { Entity, EntityKind, BuildingKind, entityById, isUnit, popCap, popUsed } from '@shared/sim/state'
import { canPlace } from '@shared/sim/step'
import { BUILDING_RADIUS } from '@shared/constants'
import { ArtPiece, ArtSet } from '../render/art'
import { Scene } from '../render/scene'
import { tileToWorld, worldToTile, depth } from '../render/iso'
import { Hud, HudContext } from '../ui/hud'
import { Minimap } from '../ui/minimap'
import { SimDriver } from './driver'

export class GameView {
  private sprites = new Map<number, Sprite>()
  private decor = new Map<number, Sprite>() // tileIndex -> dekorace zdroje
  private animState = new Map<number, { sp: AnimatedSprite; anims: Record<string, Texture[]>; current: string; moveTimer: number }>()
  private prevWorld = new Map<number, { x: number; y: number }>()
  private time = 0 // herní čas pro procedurální animace (sekání)
  private selected = new Set<number>()
  private artByKind: Record<EntityKind, ArtPiece>
  private hud: Hud
  private minimap: Minimap
  private me: number
  private centered = false

  private selG = new Graphics()
  private boxG = new Graphics()
  private hpG = new Graphics()

  private keys = new Set<string>()
  private pointer = { x: -1, y: -1 }
  private boxStart: { x: number; y: number } | null = null
  private placing: BuildingKind | null = null
  private ghost: Sprite | null = null
  private overShown = false

  constructor(
    private scene: Scene,
    private art: ArtSet,
    private driver: SimDriver,
  ) {
    this.me = driver.me
    this.artByKind = {
      villager: art.villager,
      soldier: art.soldier,
      townCenter: art.townCenter,
      house: art.house,
      barracks: art.barracks,
    }
    scene.decals.addChild(this.selG)
    scene.overlay.addChild(this.hpG)
    scene.ui.addChild(this.boxG)
    this.hud = new Hud({
      trainVillager: () => this.train('townCenter', 'villager'),
      trainSoldier: () => this.train('barracks', 'soldier'),
      buildHouse: () => this.startPlacing('house'),
      buildBarracks: () => this.startPlacing('barracks'),
    })
    this.renderMap()
    this.minimap = new Minimap(this.map.size, 176, (gx, gy) => this.scene.centerOn(gx, gy))
    this.minimap.drawTerrain(this.map)
    this.setupInput()
    scene.app.ticker.add(() => this.update(scene.app.ticker.deltaMS / 1000))
    ;(window as unknown as { __aoe: unknown }).__aoe = {
      state: this.driver.state,
      me: this.me,
      selectedCount: () => this.selected.size,
      player: () => this.driver.state.players[this.me],
      cmd: (c: Parameters<SimDriver['command']>[0]) => this.driver.command(c),
      centerOn: (gx: number, gy: number) => this.scene.centerOn(gx, gy),
    }
  }

  private get map() {
    return this.driver.state.map
  }

  // ---------- mapa ----------
  private renderMap(): void {
    const m = this.map
    const terrain: Record<string, ArtPiece> = {
      grass: this.art.grass,
      grass_dark: this.art.grass_dark,
      dirt: this.art.dirt,
      sand: this.art.sand,
      water: this.art.water,
    }
    for (let gy = 0; gy < m.size; gy++) {
      for (let gx = 0; gx < m.size; gx++) {
        const idx = gy * m.size + gx
        const t = m.tiles[idx]
        const a = terrain[t.terrain]
        const s = new Sprite(a.texture)
        s.anchor.set(a.anchorX, a.anchorY)
        const w = tileToWorld(gx, gy)
        s.position.set(w.x, w.y)
        this.scene.ground.addChild(s)
        const deco =
          t.resource === 'wood' ? this.art.tree : t.resource === 'gold' ? this.art.gold : t.resource === 'food' ? this.art.berry : null
        if (deco) {
          const d = this.makeSprite(deco)
          d.position.set(w.x, w.y)
          d.zIndex = depth(gx, gy) * 100 + 1
          this.scene.objects.addChild(d)
          this.decor.set(idx, d)
        }
      }
    }
  }

  private removeDepletedDecor(): boolean {
    let changed = false
    for (const [idx, s] of this.decor) {
      if (!this.map.tiles[idx].resource) {
        s.destroy()
        this.decor.delete(idx)
        changed = true
      }
    }
    return changed
  }

  private camTile(): { gx: number; gy: number } {
    const wx = (this.scene.app.screen.width / 2 - this.scene.world.x) / this.scene.world.scale.x
    const wy = (this.scene.app.screen.height / 2 - this.scene.world.y) / this.scene.world.scale.y
    return worldToTile(wx, wy)
  }

  // ---------- entity sprity ----------
  private worldOf(e: Entity): { x: number; y: number } {
    return tileToWorld(e.x, e.y)
  }

  /** Stojí jednotka u dlaždice se zdrojem? (heuristika pro animaci těžby — funguje i v MP) */
  private nearResource(e: Entity): boolean {
    const gx = Math.round(e.x)
    const gy = Math.round(e.y)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = tileAt(this.map, gx + dx, gy + dy)
        if (t && t.resource && t.amount > 0) return true
      }
    }
    return false
  }

  private makeSprite(a: ArtPiece): Sprite {
    let s: Sprite
    if (a.anims) {
      const as = new AnimatedSprite(a.anims.idle)
      as.animationSpeed = (a.fps ?? 10) / 60
      as.play()
      s = as
    } else {
      s = new Sprite(a.texture)
    }
    s.anchor.set(a.anchorX, a.anchorY)
    if (a.scale) s.scale.set(a.scale)
    return s
  }

  private add(e: Entity): Sprite {
    const art = this.artByKind[e.kind]
    const s = this.makeSprite(art)
    const w = this.worldOf(e)
    s.position.set(w.x, w.y)
    this.scene.objects.addChild(s)
    this.sprites.set(e.id, s)
    if (art.anims && s instanceof AnimatedSprite) {
      this.animState.set(e.id, { sp: s, anims: art.anims, current: 'idle', moveTimer: 0 })
    }
    return s
  }

  private syncSprite(e: Entity, s: Sprite): void {
    const w = this.worldOf(e)
    // plynulý lerp (kvůli 20Hz snapshotům v síťovém režimu)
    s.position.x += (w.x - s.position.x) * 0.35
    s.position.y += (w.y - s.position.y) * 0.35
    s.zIndex = depth(e.x, e.y) * 100 + (isUnit(e.kind) ? 10 : 5)
    s.alpha = !isUnit(e.kind) && e.buildLeft > 0 ? 0.5 : 1
    s.tint = e.owner === this.me ? 0xffffff : 0xff8a8a

    // přepínání idle/walk (moveTimer překlene mezery mezi snapshoty) + sekání u zdroje
    const st = this.animState.get(e.id)
    if (st) {
      const prev = this.prevWorld.get(e.id)
      if (prev && Math.hypot(w.x - prev.x, w.y - prev.y) > 0.5) st.moveTimer = 15
      else if (st.moveTimer > 0) st.moveTimer--
      const moving = st.moveTimer > 0
      const chopping = !moving && e.kind === 'villager' && this.nearResource(e)
      const want = moving && st.anims.walk ? 'walk' : 'idle'
      if (want !== st.current) {
        st.current = want
        st.sp.textures = st.anims[want]
        st.sp.play()
      }
      // rytmické máchnutí při těžbě: rychlý náklon dopředu, pomalejší návrat; jinak svisle
      if (chopping) {
        const ph = (this.time * 2.4 + e.id * 0.5) % 1
        const chop = ph < 0.32 ? ph / 0.32 : 1 - (ph - 0.32) / 0.68
        st.sp.rotation = chop * 0.27
      } else {
        st.sp.rotation = 0
      }
    }
    this.prevWorld.set(e.id, { x: w.x, y: w.y })
  }

  private reconcile(): void {
    const alive = new Set<number>()
    for (const e of this.driver.state.entities) {
      alive.add(e.id)
      const s = this.sprites.get(e.id) ?? this.add(e)
      this.syncSprite(e, s)
    }
    for (const [id, s] of this.sprites) {
      if (!alive.has(id)) {
        s.destroy()
        this.sprites.delete(id)
        this.selected.delete(id)
        this.animState.delete(id)
        this.prevWorld.delete(id)
      }
    }
  }

  // ---------- smyčka ----------
  private update(dt: number): void {
    dt = Math.min(dt, 0.05)
    this.time += dt
    this.driver.tick(dt)
    this.reconcile()
    if (this.removeDepletedDecor()) this.minimap.drawTerrain(this.map)
    this.minimap.update(this.driver.state.entities, this.me, this.camTile())
    if (!this.centered) this.tryCenter()
    this.handleCameraPan(dt)
    this.drawSelectionMarkers()
    this.drawHealthBars()
    this.updateHud()
    if (this.placing) this.updateGhost()
    if (this.driver.state.over && !this.overShown) this.showGameOver()
  }

  private showGameOver(): void {
    this.overShown = true
    const win = this.driver.state.winner === this.me
    const o = document.createElement('div')
    o.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.6);z-index:50;font:bold 48px sans-serif;color:' +
      (win ? '#7CFC6B' : '#ff7777') + ';'
    o.textContent = win ? 'VÍTĚZSTVÍ' : 'PORÁŽKA'
    document.body.appendChild(o)
  }

  private tryCenter(): void {
    const tc = this.driver.state.entities.find((e) => e.owner === this.me && e.kind === 'townCenter')
    if (tc) {
      this.scene.centerOn(Math.round(tc.x), Math.round(tc.y))
      this.centered = true
    }
  }

  private updateHud(): void {
    const p = this.driver.state.players[this.me]
    if (!p) return
    this.hud.setResources(p.wood, p.food, p.gold, popUsed(this.driver.state, this.me), popCap(this.driver.state, this.me))
    if (this.placing) return
    const { ctx, queueLen } = this.selectionContext()
    this.hud.setContext(ctx, queueLen)
  }

  private selectionContext(): { ctx: HudContext; queueLen: number } {
    let tc: Entity | undefined
    let bar: Entity | undefined
    let hasVillager = false
    for (const id of this.selected) {
      const e = entityById(this.driver.state, id)
      if (!e) continue
      if (e.kind === 'townCenter') tc = e
      else if (e.kind === 'barracks') bar = e
      else if (e.kind === 'villager') hasVillager = true
    }
    if (tc) return { ctx: 'townCenter', queueLen: tc.queue.length }
    if (bar) return { ctx: 'barracks', queueLen: bar.queue.length }
    if (hasVillager) return { ctx: 'villager', queueLen: 0 }
    return { ctx: 'none', queueLen: 0 }
  }

  private handleCameraPan(dt: number): void {
    const speed = 700 * dt
    let dx = 0
    let dy = 0
    if (this.keys.has('w') || this.keys.has('arrowup')) dy += speed
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy -= speed
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx += speed
    if (this.keys.has('d') || this.keys.has('arrowright')) dx -= speed
    const m = 24
    const W = this.scene.app.screen.width
    const H = this.scene.app.screen.height
    if (this.pointer.x >= 0) {
      if (this.pointer.x < m) dx += speed
      else if (this.pointer.x > W - m) dx -= speed
      if (this.pointer.y < m) dy += speed
      else if (this.pointer.y > H - m) dy -= speed
    }
    if (dx || dy) this.scene.moveCamera(dx, dy)
  }

  private drawSelectionMarkers(): void {
    this.selG.clear()
    for (const id of this.selected) {
      const e = entityById(this.driver.state, id)
      if (!e) continue
      const w = this.worldOf(e)
      const rx = isUnit(e.kind) ? 18 : 34 + e.radius * 30
      this.selG.ellipse(w.x, w.y, rx, rx / 2).stroke({ width: 2, color: 0x4cff5a, alpha: 0.9 })
    }
  }

  private drawHealthBars(): void {
    this.hpG.clear()
    for (const e of this.driver.state.entities) {
      if (e.hp >= e.maxHp) continue
      const w = this.worldOf(e)
      const bw = isUnit(e.kind) ? 26 : 44 + e.radius * 24
      const oy = isUnit(e.kind) ? 36 : 70 + e.radius * 24
      const frac = Math.max(0, e.hp / e.maxHp)
      const x = w.x - bw / 2
      const y = w.y - oy
      this.hpG.rect(x - 1, y - 1, bw + 2, 6).fill({ color: 0x000000, alpha: 0.6 })
      this.hpG.rect(x, y, bw * frac, 4).fill(e.owner === this.me ? 0x46d65a : 0xe24a3a)
    }
  }

  // ---------- akce ----------
  private train(building: 'townCenter' | 'barracks', unit: 'villager' | 'soldier'): void {
    let b: Entity | undefined
    for (const id of this.selected) {
      const e = entityById(this.driver.state, id)
      if (e?.kind === building && e.buildLeft <= 0) {
        b = e
        break
      }
    }
    b ??= this.driver.state.entities.find((e) => e.owner === this.me && e.kind === building && e.buildLeft <= 0)
    if (b) this.driver.command({ type: 'train', buildingId: b.id, unit })
  }

  private startPlacing(kind: BuildingKind): void {
    this.placing = kind
    this.hud.setPlacing(kind === 'house' ? 'dům' : 'kasárna')
    this.ghost = this.makeSprite(this.artByKind[kind])
    this.ghost.alpha = 0.6
    this.scene.objects.addChild(this.ghost)
  }

  private cancelPlacing(): void {
    this.placing = null
    this.ghost?.destroy()
    this.ghost = null
  }

  private hoverTile(): { gx: number; gy: number } {
    const wx = (this.pointer.x - this.scene.world.x) / this.scene.world.scale.x
    const wy = (this.pointer.y - this.scene.world.y) / this.scene.world.scale.y
    return worldToTile(wx, wy)
  }

  private updateGhost(): void {
    if (!this.placing || !this.ghost) return
    const { gx, gy } = this.hoverTile()
    const w = tileToWorld(gx, gy)
    this.ghost.position.set(w.x, w.y)
    this.ghost.zIndex = depth(gx, gy) * 100 + 50
    const ok = canPlace(this.map, gx, gy, BUILDING_RADIUS[this.placing])
    this.ghost.tint = ok ? 0x88ff88 : 0xff7777
  }

  // ---------- vstup ----------
  private canvasPos(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.scene.app.canvas.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }

  private entityCanvasPos(e: Entity): { x: number; y: number } {
    const w = this.worldOf(e)
    return {
      x: w.x * this.scene.world.scale.x + this.scene.world.x,
      y: w.y * this.scene.world.scale.y + this.scene.world.y,
    }
  }

  private setupInput(): void {
    const canvas = this.scene.app.canvas
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase())
      if (e.key === 'Escape') this.cancelPlacing()
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()))

    canvas.addEventListener('pointermove', (e) => {
      this.pointer = this.canvasPos(e.clientX, e.clientY)
      if (this.boxStart) this.drawBox()
    })
    canvas.addEventListener('pointerleave', () => {
      this.pointer = { x: -1, y: -1 }
    })

    canvas.addEventListener('pointerdown', (e) => {
      const p = this.canvasPos(e.clientX, e.clientY)
      if (e.button === 0) {
        if (this.placing) {
          this.placeBuilding()
          return
        }
        this.boxStart = p
      } else if (e.button === 2) {
        if (this.placing) {
          this.cancelPlacing()
          return
        }
        this.issueRightClick(p)
      }
    })

    window.addEventListener('pointerup', (e) => {
      if (e.button !== 0 || !this.boxStart) return
      const p = this.canvasPos(e.clientX, e.clientY)
      const d = Math.hypot(p.x - this.boxStart.x, p.y - this.boxStart.y)
      if (d < 6) this.clickSelect(p, e.shiftKey)
      else this.boxSelect(this.boxStart, p, e.shiftKey)
      this.boxStart = null
      this.boxG.clear()
    })
  }

  private placeBuilding(): void {
    if (!this.placing) return
    const { gx, gy } = this.hoverTile()
    if (canPlace(this.map, gx, gy, BUILDING_RADIUS[this.placing])) {
      this.driver.command({ type: 'build', player: this.me, kind: this.placing, gx, gy })
      this.cancelPlacing()
    }
  }

  private drawBox(): void {
    if (!this.boxStart) return
    const a = this.boxStart
    const b = this.pointer
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    this.boxG
      .clear()
      .rect(x, y, Math.abs(a.x - b.x), Math.abs(a.y - b.y))
      .fill({ color: 0x4cff5a, alpha: 0.12 })
      .stroke({ width: 1.5, color: 0x4cff5a, alpha: 0.8 })
  }

  private ownUnits(): Entity[] {
    return this.driver.state.entities.filter((e) => e.owner === this.me && isUnit(e.kind))
  }

  private clickSelect(p: { x: number; y: number }, additive: boolean): void {
    let best: Entity | null = null
    let bestD = 34
    for (const e of this.driver.state.entities) {
      if (e.owner !== this.me) continue
      const c = this.entityCanvasPos(e)
      const d = Math.hypot(c.x - p.x, c.y - p.y - (isUnit(e.kind) ? 14 : 24))
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    if (!additive) this.selected.clear()
    if (best) this.selected.add(best.id)
  }

  private boxSelect(a: { x: number; y: number }, b: { x: number; y: number }, additive: boolean): void {
    const x0 = Math.min(a.x, b.x)
    const x1 = Math.max(a.x, b.x)
    const y0 = Math.min(a.y, b.y)
    const y1 = Math.max(a.y, b.y)
    if (!additive) this.selected.clear()
    for (const e of this.ownUnits()) {
      const c = this.entityCanvasPos(e)
      const cy = c.y - 14
      if (c.x >= x0 && c.x <= x1 && cy >= y0 && cy <= y1) this.selected.add(e.id)
    }
  }

  private pickEnemyAt(p: { x: number; y: number }): Entity | null {
    let best: Entity | null = null
    let bd = 34
    for (const e of this.driver.state.entities) {
      if (e.owner === this.me || e.owner < 0) continue
      const c = this.entityCanvasPos(e)
      const d = Math.hypot(c.x - p.x, c.y - p.y - (isUnit(e.kind) ? 14 : 24))
      if (d < bd) {
        bd = d
        best = e
      }
    }
    return best
  }

  private selectedUnitIds(): number[] {
    return [...this.selected]
      .map((id) => entityById(this.driver.state, id))
      .filter((e): e is Entity => !!e && isUnit(e.kind))
      .map((e) => e.id)
  }

  private issueRightClick(p: { x: number; y: number }): void {
    if (!this.selected.size) return
    const units = this.selectedUnitIds()

    const enemy = this.pickEnemyAt(p)
    if (enemy && units.length) {
      this.driver.command({ type: 'attack', ids: units, targetId: enemy.id })
      return
    }

    const wx = (p.x - this.scene.world.x) / this.scene.world.scale.x
    const wy = (p.y - this.scene.world.y) / this.scene.world.scale.y
    const t = worldToTile(wx, wy)
    const tile = tileAt(this.map, t.gx, t.gy)
    const villagers = [...this.selected]
      .map((id) => entityById(this.driver.state, id))
      .filter((e): e is Entity => e?.kind === 'villager')
      .map((e) => e.id)

    if (tile?.resource && tile.amount > 0 && villagers.length) {
      this.driver.command({ type: 'gather', ids: villagers, gx: t.gx, gy: t.gy })
    } else if (units.length) {
      this.driver.command({ type: 'move', ids: units, tx: t.gx, ty: t.gy })
    }
  }
}
