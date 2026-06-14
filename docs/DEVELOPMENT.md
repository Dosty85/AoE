# Vývoj

## Předpoklady
- **Node.js 18+** a npm.
- (volitelně) **Blender 4.5** — jen pro re‑render 3D spritů.

## Instalace
```bash
npm install
```

## Spuštění (dev)
Dev běží ve **dvou procesech** (klient přes Vite, server zvlášť):
```bash
npm run dev      # klient na http://localhost:5180 (HMR)
npm run server   # herní WebSocket server na :8080 (tsx watch)
```
V dev režimu se klient připojuje na `ws://<host>:8080` (viz `import.meta.env.DEV` v `client/src/main.ts`).
Pro single‑player („Hra na tomto PC") server netřeba.

> Pozn.: dev port je **5180** (5173 bývá obsazený jiným projektem) — `vite.config.ts` má `strictPort`.

## Produkční běh (jeden proces)
Jak to běží na serveru — klient i WS z jednoho Node procesu:
```bash
npm run build:all                                  # → dist/ + dist-server/server.cjs
PORT=8080 STATIC_DIR=dist node dist-server/server.cjs
# http://localhost:8080  (statika + same-origin WebSocket)
```

## npm skripty
| Skript | Co dělá |
|--------|---------|
| `dev` | Vite dev server (klient) |
| `server` | herní server (tsx watch) |
| `build` | `tsc --noEmit` + `vite build` → `dist/` |
| `build:server` | esbuild bundl serveru → `dist-server/server.cjs` (vč. `ws`) |
| `build:all` | `build` + `build:server` |
| `check` | typecheck (`tsc --noEmit`) |
| `test` | vitest (jednotkové testy sim) |
| `render:sprites` | Blender re‑render spritů (viz [GRAPHICS.md](GRAPHICS.md)) |

## Testy
- **Jednotkové (sim):** `npm test` (vitest) — čistá simulace se testuje bez renderu.
- **Interakční/E2E (Playwright):** skripty `test_*.mjs` v rootu ovládají hru přes headless Chromium
  a ověřují chování (pohyb, ekonomika, boj, vítězství, server, multiplayer, produkční běh, live server).
  Vyžadují běžící klient/server podle testu. Playwright je instalovaný mimo `package.json`
  (`npm i --no-save playwright && npx playwright install chromium`).

  | Skript | Ověřuje |
  |--------|---------|
  | `test_move` | výběr + A\* pohyb |
  | `test_econ` | těžba, výcvik, stavba |
  | `test_combat` | boj, poškození, úmrtí |
  | `test_win` | vítězná podmínka |
  | `test_server` / `test_mp` | autoritativní server / multiplayer (2 klienti) |
  | `test_prod` / `test_remote` | produkční jeden‑proces / živý server |

## Debug API
V běžící hře je na `window.__aoe`:
```js
window.__aoe.state          // GameState (entities, players, map, …)
window.__aoe.me             // index mého hráče
window.__aoe.player()       // můj Player (suroviny)
window.__aoe.selectedCount()
window.__aoe.cmd(cmd)       // poslat příkaz (move/gather/train/build/attack)
```
Hodí se pro rychlé pokusy v konzoli i pro Playwright testy.

## Konvence
- **Veškerá herní logika patří do `shared/src/sim`** (čistá, bez IO/renderu) — testovatelná a sdílená
  klientem i serverem. Render/síť/vstup ji jen volají.
- Balanc a rozměry jsou na jednom místě: `shared/src/constants.ts`.
- Importy uvnitř `@shared/*` jsou bezextenzové (funguje pro Vite, tsx i esbuild s `paths`).
