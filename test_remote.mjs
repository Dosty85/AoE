import { chromium } from 'playwright'
const URL = process.argv[2] || 'http://37.235.109.6/'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const mkPage = async () => {
  const c = await browser.newContext({ viewport: { width: 1100, height: 720 }, serviceWorkers: 'block' })
  const p = await c.newPage()
  p.on('pageerror', (e) => console.log('[pageerror]', e.message))
  p.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()) })
  await p.goto(URL, { waitUntil: 'networkidle' })
  return p
}
const join = async (p) => {
  await p.getByText('Multiplayer').click()
  await p.waitForFunction(() => window.__aoe && window.__aoe.state.entities.length > 0, { timeout: 12000 })
}

const p1 = await mkPage(); await join(p1)
const me1 = await p1.evaluate(() => window.__aoe.me)
const p2 = await mkPage(); await join(p2)
const me2 = await p2.evaluate(() => window.__aoe.me)
console.log('hráč 1:', me1, '| hráč 2:', me2)

const moved = await p1.evaluate(() => {
  const s = window.__aoe.state, me = window.__aoe.me
  const v = s.entities.find((e) => e.owner === me && e.kind === 'villager')
  window.__aoe.cmd({ type: 'move', ids: [v.id], tx: Math.round(v.x) + 8, ty: Math.round(v.y) + 5 })
  return { id: v.id, x: Math.round(v.x * 10) / 10, y: Math.round(v.y * 10) / 10 }
})
await p1.waitForTimeout(3500)
const seen = await p2.evaluate((id) => {
  const v = window.__aoe.state.entities.find((e) => e.id === id)
  return v ? { x: Math.round(v.x * 10) / 10, y: Math.round(v.y * 10) / 10 } : null
}, moved.id)
const d = seen ? Math.hypot(seen.x - moved.x, seen.y - moved.y) : 0
console.log('posun viditelný u hráče 2:', d.toFixed(2), 'dlaždic')
await p2.screenshot({ path: 'shot_remote.png' })
console.log(me1 === 0 && me2 === 1 && d > 1 ? 'PASS' : 'FAIL')
await browser.close()
