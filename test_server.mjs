import { WebSocket } from 'ws'

const ws = new WebSocket('ws://localhost:8080')
let me = -1
let snaps = 0
let myVillager = null
let startPos = null
let sentMove = false
let lastPos = null

ws.on('open', () => console.log('připojeno'))
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString())
  if (msg.t === 'init') {
    me = msg.you
    console.log('init: jsem hráč', me, 'seed', msg.seed, 'size', msg.size, 'hráčů', msg.players)
  } else if (msg.t === 'snap') {
    snaps++
    const mine = msg.ents.filter((e) => e.owner === me)
    if (snaps === 1) {
      console.log('1. snapshot: entit celkem', msg.ents.length, '| mých', mine.length, '| suroviny', JSON.stringify(msg.players[me]))
      myVillager = mine.find((e) => e.kind === 'villager')
      startPos = { x: myVillager.x, y: myVillager.y }
      // pošli pohyb daleko
      ws.send(JSON.stringify({ t: 'cmd', cmd: { type: 'move', ids: [myVillager.id], tx: Math.round(myVillager.x) + 8, ty: Math.round(myVillager.y) + 4 } }))
      sentMove = true
      console.log('poslán move pro vesničana', myVillager.id, 'z', JSON.stringify(startPos))
    }
    if (sentMove && myVillager) {
      const v = msg.ents.find((e) => e.id === myVillager.id)
      if (v) lastPos = { x: v.x, y: v.y }
    }
    if (snaps >= 60) {
      const d = Math.hypot(lastPos.x - startPos.x, lastPos.y - startPos.y)
      console.log('po ~3s: pozice', JSON.stringify(lastPos), '| posun', d.toFixed(2), 'dlaždic')
      console.log('snapshotů přijato:', snaps)
      console.log(d > 1 ? 'PASS' : 'FAIL')
      ws.close()
      process.exit(0)
    }
  }
})
ws.on('error', (e) => { console.log('chyba:', e.message); process.exit(1) })
setTimeout(() => { console.log('TIMEOUT'); process.exit(1) }, 8000)
