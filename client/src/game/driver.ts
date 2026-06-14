import { MAP_SIZE } from '@shared/constants'
import { generateMap } from '@shared/sim/mapgen'
import { createState, spawn, Entity, GameState } from '@shared/sim/state'
import { applyCommand, Command, step } from '@shared/sim/step'
import { EntitySnap, ServerMsg } from '@shared/protocol'
import { clearBaseAreas } from '@shared/sim/setup'

/** Abstrakce nad zdrojem simulace — lokální (single-player) nebo síťový (server). */
export interface SimDriver {
  readonly state: GameState
  readonly me: number
  command(c: Command): void
  tick(dt: number): void
}

// ---------------- LOKÁLNÍ (single-player + jednoduché AI) ----------------
export class LocalDriver implements SimDriver {
  readonly state: GameState
  readonly me = 0
  private readonly enemy = 1

  constructor(map = generateMap(12345, MAP_SIZE)) {
    this.state = createState(map)
    this.setup(map)
  }

  private setup(map: GameState['map']): void {
    const add = (n = 200) => this.state.players.push({ id: this.state.players.length, wood: n, food: n, gold: 100 })
    add()
    add()
    const size = map.size
    const bases: Array<[number, number]> = [
      [9, size - 10],
      [size - 10, 9],
    ]
    bases.forEach(([cx, cy], owner) => {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const t = map.tiles[(cy + dy) * size + (cx + dx)]
          if (!t) continue
          if (t.terrain === 'water') t.terrain = 'grass'
          t.resource = null
          t.amount = 0
          t.blocked = false
        }
      }
      spawn(this.state, owner, 'townCenter', cx, cy)
      spawn(this.state, owner, 'house', cx + 3, cy - 2)
      spawn(this.state, owner, 'barracks', cx - 2, cy + 3)
      spawn(this.state, owner, 'villager', cx - 1, cy - 1)
      spawn(this.state, owner, 'villager', cx + 1, cy - 1)
      spawn(this.state, owner, 'villager', cx + 1, cy + 1)
      spawn(this.state, owner, 'soldier', cx - 1, cy + 1)
      spawn(this.state, owner, 'soldier', cx, cy + 2)
    })
    // AI: nepřátelští vojáci vyrazí na můj Town Center
    const myTc = this.state.entities.find((e) => e.owner === this.me && e.kind === 'townCenter')
    if (myTc) {
      for (const s of this.state.entities) {
        if (s.owner === this.enemy && s.kind === 'soldier') s.target = myTc.id
      }
    }
  }

  command(c: Command): void {
    applyCommand(this.state, c)
  }

  tick(dt: number): void {
    step(this.state, dt)
  }
}

// ---------------- SÍŤOVÝ (autoritativní server) ----------------
function fromSnap(es: EntitySnap): Entity {
  return {
    id: es.id,
    owner: es.owner,
    kind: es.kind,
    x: es.x,
    y: es.y,
    hp: es.hp,
    maxHp: es.maxHp,
    speed: 0,
    path: [],
    task: 'idle',
    gather: null,
    carry: 0,
    carryKind: null,
    harvestT: 0,
    target: null,
    atkCd: 0,
    aggro: false,
    queue: [],
    buildLeft: es.buildLeft,
    radius: es.radius,
  }
}

export class NetDriver implements SimDriver {
  readonly state: GameState
  readonly me: number
  private ws: WebSocket

  private constructor(ws: WebSocket, state: GameState, me: number) {
    this.ws = ws
    this.state = state
    this.me = me
    ws.onmessage = (ev) => this.onMessage(ev.data as string)
  }

  static connect(url: string): Promise<NetDriver> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      ws.onerror = () => reject(new Error('WebSocket chyba — běží server? (npm run server)'))
      ws.onmessage = (ev) => {
        const msg: ServerMsg = JSON.parse(ev.data as string)
        if (msg.t === 'init') {
          const map = generateMap(msg.seed, msg.size)
          clearBaseAreas(map, msg.players) // sjednoť terén základen se serverem
          resolve(new NetDriver(ws, createState(map), msg.you))
        }
      }
    })
  }

  private onMessage(data: string): void {
    const msg: ServerMsg = JSON.parse(data)
    if (msg.t !== 'snap') return
    this.state.tick = msg.tick
    this.state.entities = msg.ents.map(fromSnap)
    this.state.players = msg.players.map((p, i) => ({ id: i, wood: p.wood, food: p.food, gold: p.gold }))
    this.state.over = msg.over
    this.state.winner = msg.winner
    for (const idx of msg.depleted) {
      const t = this.state.map.tiles[idx]
      if (t) {
        t.resource = null
        t.amount = 0
        t.blocked = false
      }
    }
  }

  command(c: Command): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'cmd', cmd: c }))
  }

  tick(): void {
    /* stav řídí snapshoty ze serveru */
  }
}
