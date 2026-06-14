import type { WebSocket } from 'ws'
import { MAP_SIZE, SIM_DT, SIM_HZ } from '@shared/constants'
import { generateMap } from '@shared/sim/mapgen'
import { createState, entityById, GameState, isUnit } from '@shared/sim/state'
import { applyCommand, Command, step } from '@shared/sim/step'
import { initMatch } from '@shared/sim/setup'
import { makeSnapshot, ServerMsg } from '@shared/protocol'

interface Client {
  ws: WebSocket
  player: number
}

export class Room {
  private state: GameState
  private referenceMap: GameState['map']
  private sentDepleted = new Set<number>()
  private clients: Client[] = []
  private queue: Command[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  readonly maxPlayers = 2

  constructor(readonly seed = 12345) {
    this.state = createState(generateMap(seed, MAP_SIZE))
    initMatch(this.state, this.maxPlayers)
    this.referenceMap = generateMap(seed, MAP_SIZE) // baseline pro detekci vytěžených dlaždic
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), 1000 / SIM_HZ)
  }

  addClient(ws: WebSocket): number {
    const player = this.clients.length % this.maxPlayers
    this.clients.push({ ws, player })
    const init: ServerMsg = { t: 'init', seed: this.seed, size: MAP_SIZE, you: player, players: this.maxPlayers }
    ws.send(JSON.stringify(init))
    return player
  }

  removeClient(ws: WebSocket): void {
    this.clients = this.clients.filter((c) => c.ws !== ws)
  }

  /** Příkaz od klienta — ověř vlastnictví, pak zařaď. */
  receive(ws: WebSocket, cmd: Command): void {
    const client = this.clients.find((c) => c.ws === ws)
    if (!client) return
    const safe = this.sanitize(cmd, client.player)
    if (safe) this.queue.push(safe)
  }

  private ownsAll(ids: number[], player: number): number[] {
    return ids.filter((id) => {
      const e = entityById(this.state, id)
      return e && e.owner === player && isUnit(e.kind)
    })
  }

  private sanitize(cmd: Command, player: number): Command | null {
    switch (cmd.type) {
      case 'move':
      case 'gather':
      case 'attack': {
        const ids = this.ownsAll(cmd.ids, player)
        if (!ids.length) return null
        return { ...cmd, ids }
      }
      case 'train': {
        const b = entityById(this.state, cmd.buildingId)
        if (!b || b.owner !== player) return null
        return cmd
      }
      case 'build':
        return { ...cmd, player } // vynuť odesílatele
      default:
        return null
    }
  }

  private tick(): void {
    for (const cmd of this.queue) applyCommand(this.state, cmd)
    this.queue.length = 0
    step(this.state, SIM_DT)
    this.broadcast()
  }

  private collectDepleted(): number[] {
    const out: number[] = []
    const tiles = this.state.map.tiles
    const ref = this.referenceMap.tiles
    for (let i = 0; i < tiles.length; i++) {
      if (ref[i].resource && !tiles[i].resource && !this.sentDepleted.has(i)) {
        this.sentDepleted.add(i)
        out.push(i)
      }
    }
    return out
  }

  private broadcast(): void {
    const msg = JSON.stringify(makeSnapshot(this.state, this.collectDepleted()))
    for (const c of this.clients) {
      if (c.ws.readyState === 1) c.ws.send(msg)
    }
  }
}
