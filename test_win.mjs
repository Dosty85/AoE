import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 }, serviceWorkers: 'block' })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()) })
await page.goto('http://localhost:5180/?t=' + Math.floor(Math.random() * 1e9), { waitUntil: 'networkidle' })

await page.getByText('Hra na tomto PC').click()
await page.waitForFunction(() => window.__aoe && window.__aoe.state.entities.length > 0, { timeout: 6000 })

const before = await page.evaluate(() => {
  const s = window.__aoe.state
  return { me: window.__aoe.me, players: s.players.length, ents: s.entities.length, over: s.over }
})
console.log('start:', JSON.stringify(before))

// sraz nepřátelský Town Center na 0 HP
await page.evaluate(() => {
  const s = window.__aoe.state
  const me = window.__aoe.me
  const foeTc = s.entities.find((e) => e.owner !== me && e.kind === 'townCenter')
  foeTc.hp = 0
})
await page.waitForTimeout(1200)

const after = await page.evaluate(() => ({ over: window.__aoe.state.over, winner: window.__aoe.state.winner, me: window.__aoe.me }))
const overlay = await page.locator('text=VÍTĚZSTVÍ').count()
console.log('po sražení TC:', JSON.stringify(after), '| overlay VÍTĚZSTVÍ:', overlay)

await page.screenshot({ path: 'shot_win.png' })
const ok = after.over && after.winner === after.me && overlay === 1
console.log(ok ? 'PASS' : 'FAIL')
await browser.close()
