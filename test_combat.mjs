import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()) })
await page.goto('http://localhost:5180/?t=' + Math.floor(Math.random() * 1e9), { waitUntil: 'networkidle' })
await page.getByText('Hra na tomto PC').click()
await page.waitForFunction(() => window.__aoe && window.__aoe.state.entities.length > 0, { timeout: 6000 })
await page.waitForTimeout(800)

const snap = () => page.evaluate(() => {
  const s = window.__aoe.state
  const mine = s.entities.filter((e) => e.owner === 0)
  const foe = s.entities.filter((e) => e.owner === 1)
  const tc = mine.find((e) => e.kind === 'townCenter')
  return {
    total: s.entities.length,
    mySold: mine.filter((e) => e.kind === 'soldier').length,
    foeSold: foe.filter((e) => e.kind === 'soldier').length,
    tcHp: tc ? Math.round(tc.hp) : -1,
    hpSum: Math.round(s.entities.reduce((a, e) => a + e.hp, 0)),
  }
})

const a = await snap()
console.log('start:', JSON.stringify(a))
// přitáhni nepřátelského vojáka k mému → vynutí střet bez ohledu na vzdálenost základen
await page.evaluate(() => {
  const s = window.__aoe.state
  const mine = s.entities.find((e) => e.owner === 0 && e.kind === 'soldier')
  const foe = s.entities.find((e) => e.owner === 1 && e.kind === 'soldier')
  foe.x = mine.x + 1; foe.y = mine.y; foe.path = []
  foe.target = mine.id; foe.aggro = true
  mine.target = foe.id; mine.aggro = true
})
await page.waitForTimeout(7000)
const b = await snap()
console.log('po 16s:', JSON.stringify(b))

const tookDamage = b.hpSum < a.hpSum
const someoneDied = b.total < a.total
const tcAttacked = b.tcHp < a.tcHp
console.log('proběhlo poškození:', tookDamage, '| úmrtí:', someoneDied, '| TC napaden:', tcAttacked)
console.log(tookDamage ? 'PASS' : 'FAIL')
await page.screenshot({ path: 'shot_combat.png' })
await browser.close()
