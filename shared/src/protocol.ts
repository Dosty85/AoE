import { Entity, GameState } from './sim/state'
import { Command } from './sim/step'

/** Kompaktní stav entity posílaný klientům (jen co je potřeba pro render). */
export interface EntitySnap {
  id: number
  owner: number
  kind: Entity['kind']
  x: number
  y: number
  hp: number
  maxHp: number
  buildLeft: number
  radius: number
}

export interface PlayerSnap {
  wood: number
  food: number
  gold: number
}

export type ServerMsg =
  | { t: 'init'; seed: number; size: number; you: number; players: number }
  | { t: 'snap'; tick: number; players: PlayerSnap[]; ents: EntitySnap[]; depleted: number[]; over: boolean; winner: number | null }
  | { t: 'full' } // placeholder pro budoucí delta sync

export type ClientMsg = { t: 'cmd'; cmd: Command }

export function snapEntity(e: Entity): EntitySnap {
  return {
    id: e.id,
    owner: e.owner,
    kind: e.kind,
    x: Math.round(e.x * 100) / 100,
    y: Math.round(e.y * 100) / 100,
    hp: Math.round(e.hp),
    maxHp: e.maxHp,
    buildLeft: e.buildLeft > 0 ? 1 : 0,
    radius: e.radius,
  }
}

export function makeSnapshot(state: GameState, depleted: number[]): ServerMsg {
  return {
    t: 'snap',
    tick: state.tick,
    players: state.players.map((p) => ({ wood: Math.floor(p.wood), food: Math.floor(p.food), gold: Math.floor(p.gold) })),
    ents: state.entities.map(snapEntity),
    depleted,
    over: state.over,
    winner: state.winner,
  }
}
