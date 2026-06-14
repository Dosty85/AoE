import { chromium } from 'playwright'

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: 'block' })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()) })
await page.goto('http://localhost:5180/?t=' + Math.floor(Math.random() * 1e9), { waitUntil: 'networkidle' })
await page.getByText('Hra na tomto PC').click()
await page.waitForFunction(() => window.__aoe && window.__aoe.state.entities.length > 0, { timeout: 6000 })
await page.waitForTimeout(800)

const unitsPos = () =>
  page.evaluate(() => {
    const s = window.__aoe.state
    return s.entities.filter((e) => e.kind === 'villager' || e.kind === 'soldier').map((e) => ({ id: e.id, x: e.x, y: e.y }))
  })

const before = await unitsPos()
console.log('jednotek:', before.length)

// výběr boxem přes střed (základna)
await page.mouse.move(490, 250)
await page.mouse.down({ button: 'left' })
await page.mouse.move(820, 520, { steps: 8 })
await page.mouse.up({ button: 'left' })
await page.waitForTimeout(200)
const sel = await page.evaluate(() => window.__aoe.selectedCount())
console.log('vybráno:', sel)

await page.screenshot({ path: 'shot_select.png' })

// pravý klik = pohyb na východ
await page.mouse.click(1050, 360, { button: 'right' })
await page.waitForTimeout(2800)

const after = await unitsPos()
let moved = 0
let maxd = 0
for (const a of after) {
  const b = before.find((x) => x.id === a.id)
  if (!b) continue
  const d = Math.hypot(a.x - b.x, a.y - b.y)
  if (d > 0.3) moved++
  maxd = Math.max(maxd, d)
}
console.log(`pohnulo se: ${moved}/${before.length}, max posun: ${maxd.toFixed(2)} dlaždic`)
await page.screenshot({ path: 'shot_moved.png' })
console.log(moved > 0 ? 'PASS' : 'FAIL')
await browser.close()
