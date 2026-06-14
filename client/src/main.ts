import { buildArtSet } from './render/art'
import { Scene } from './render/scene'
import { GameView } from './game/view'
import { LocalDriver, NetDriver, SimDriver } from './game/driver'

const mount = document.getElementById('app')!

async function startGame(makeDriver: () => Promise<SimDriver> | SimDriver): Promise<void> {
  const scene = await Scene.create(mount)
  const art = await buildArtSet(scene.app.renderer)
  const driver = await makeDriver()
  new GameView(scene, art, driver)
}

function showMenu(): void {
  const menu = document.createElement('div')
  menu.style.cssText =
    'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'gap:16px;background:#1b2417;color:#f0e6c8;font:16px sans-serif;z-index:100;'
  menu.innerHTML = '<h1 style="font-size:34px;margin:0 0 8px">AoE RTS</h1>'

  const btn = (label: string, sub: string): HTMLButtonElement => {
    const b = document.createElement('button')
    b.style.cssText =
      'width:280px;padding:14px;border:1px solid #6b5a3a;border-radius:8px;background:#3a2f1c;' +
      'color:#f0e6c8;font:15px sans-serif;cursor:pointer;text-align:center;'
    b.innerHTML = `<b>${label}</b><br><span style="font-size:12px;color:#cdbf99">${sub}</span>`
    return b
  }

  const single = btn('Hra na tomto PC', '1 hráč proti jednoduchému AI')
  const multi = btn('Multiplayer', 'připojit se k serveru (ws://' + location.hostname + ':8080)')
  const status = document.createElement('div')
  status.style.cssText = 'font-size:13px;color:#cdbf99;min-height:18px'

  single.onclick = () => {
    menu.remove()
    void startGame(() => new LocalDriver())
  }
  // dev: klient běží na Vite (:5180), server zvlášť na :8080
  // prod: klient i WS servíruje jeden Node proces na stejném originu (ws/wss dle protokolu)
  const wsUrl = import.meta.env.DEV
    ? `ws://${location.hostname}:8080`
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`
  multi.onclick = () => {
    status.textContent = 'Připojuji se…'
    startGame(() => NetDriver.connect(wsUrl))
      .then(() => menu.remove())
      .catch((err) => {
        status.textContent = String(err.message ?? err)
      })
  }

  menu.append(single, multi, status)
  document.body.appendChild(menu)
}

showMenu()
