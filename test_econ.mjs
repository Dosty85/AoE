import { chromium } from 'playwright'

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: 'block' })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()) })
await page.goto('http://localhost:5180/?t=' + Math.floor(Math.random() * 1e9), { waitUntil: 'networkidle' })
await page.getByText('Hra na tomto PC').click()
await page.waitForFunction(() => window.__aoe && window.__aoe.state.entities.length > 0, { timeout: 6000 })
await page.waitForTimeout(800)

const snap = () => page.evaluate(() => {
  const s = window.__aoe.state
  return {
    wood: s.players[0].wood, food: s.players[0].food, gold: s.players[0].gold,
    units: s.entities.filter((e) => e.kind === 'villager' || e.kind === 'soldier').length,
    houses: s.entities.filter((e) => e.kind === 'house').length,
    entities: s.entities.length,
  }
})

const a = await snap()
console.log('start:', JSON.stringify(a))

// --- TĚŽBA: teleportuj vesničana k lesu a nech těžit (robustní vůči poloze základny) ---
const gVil = await page.evaluate(() => {
  const s = window.__aoe.state
  const vil = s.entities.find((e) => e.owner === 0 && e.kind === 'villager')
  let best = null, bd = 1e9
  for (let gy = 0; gy < s.map.size; gy++) for (let gx = 0; gx < s.map.size; gx++) {
    const t = s.map.tiles[gy * s.map.size + gx]
    if (t.resource === 'wood' && t.amount > 0) {
      const d = Math.hypot(gx - vil.x, gy - vil.y)
      if (d < bd) { bd = d; best = { gx, gy } }
    }
  }
  vil.x = best.gx - 1; vil.y = best.gy; vil.path = []
  window.__aoe.cmd({ type: 'gather', ids: [vil.id], gx: best.gx, gy: best.gy })
  return vil.id
})

// --- VÝCVIK: trénuj vesničana z TC ---
await page.evaluate(() => {
  const s = window.__aoe.state
  const tc = s.entities.find((e) => e.kind === 'townCenter')
  window.__aoe.cmd({ type: 'train', buildingId: tc.id, unit: 'villager' })
})
const afterTrain = await snap()
console.log('po zadání výcviku (food -50):', afterTrain.food)

// --- STAVBA: postav dům poblíž ---
await page.evaluate(() => {
  const s = window.__aoe.state
  const tc = s.entities.find((e) => e.kind === 'townCenter')
  window.__aoe.cmd({ type: 'build', player: 0, kind: 'house', gx: Math.round(tc.x) + 5, gy: Math.round(tc.y) })
})
const afterBuild = await snap()
console.log('po zadání stavby (wood -30):', afterBuild.wood, 'domů:', afterBuild.houses)

// počkej na těžbu + dokončení výcviku
await page.waitForTimeout(22000)
const b = await snap()
console.log('konec:', JSON.stringify(b))

const carry = await page.evaluate((id) => {
  const v = window.__aoe.state.entities.find((e) => e.id === id)
  return v ? v.carry : -1
}, gVil)
const woodGained = b.wood > afterBuild.wood || carry > 0 // těžba: buď odložil, nebo právě nese dřevo
const unitTrained = b.units > a.units
const houseBuilt = b.houses > a.houses
console.log('dřevo natěženo:', woodGained, '| vycvičen vesničan:', unitTrained, '| dům postaven:', houseBuilt)
console.log(woodGained && unitTrained && houseBuilt ? 'PASS' : 'FAIL')
await page.screenshot({ path: 'shot_econ.png' })
await browser.close()
