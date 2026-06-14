import { createServer } from 'node:http'
import { join } from 'node:path'
import { WebSocketServer } from 'ws'
import { ClientMsg } from '@shared/protocol'
import { Room } from './room'
import { createStaticHandler } from './static'

const PORT = Number(process.env.PORT ?? 8080)
const STATIC_DIR = process.env.STATIC_DIR ?? join(process.cwd(), 'dist')

// Jeden proces: HTTP servíruje statický klient (dist/) a na stejném portu běží WebSocket.
const server = createServer(createStaticHandler(STATIC_DIR))
const wss = new WebSocketServer({ server })

// MVP: jediná místnost pro 2 hráče. (Lobby s více místnostmi lze přidat později.)
const room = new Room(12345)
room.start()

wss.on('connection', (ws) => {
  const player = room.addClient(ws)
  console.log(`[server] hráč ${player} připojen`)

  ws.on('message', (data) => {
    let msg: ClientMsg
    try {
      msg = JSON.parse(data.toString())
    } catch {
      return
    }
    if (msg.t === 'cmd') room.receive(ws, msg.cmd)
  })

  ws.on('close', () => {
    room.removeClient(ws)
    console.log(`[server] hráč ${player} odpojen`)
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] AoE RTS běží na http://0.0.0.0:${PORT}  (statika: ${STATIC_DIR})`)
})
