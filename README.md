# AoE RTS

Zjednodušená izometrická RTS v duchu Age of Empires II — běží v prohlížeči, s 1v1 multiplayerem.
TypeScript + Vite + PixiJS (render) + Node/`ws` (autoritativní server).

**Grafika je hybridní:** objekty (budovy, jednotky, dekorace) jsou sprity vyrenderované z CC0 3D
modelů (Kenney Castle/Nature Kit, Quaternius Knight) přes Blender; terén a efekty jsou procedurální.
**Jednotky jsou animované** (idle/chůze — přepíná se podle pohybu). Vyrenderované PNG jsou commitnuté
v `client/public/sprites/` — **pro hraní ani build Blender netřeba**. Re-render: `npm run render:sprites`
(potřebuje Blender + CC0 modely v `art-src/`). Chybí-li sprity, hra spadne na procedurální grafiku.

## Spuštění

```bash
npm install          # jednorázově
npm run dev          # klient na http://localhost:5180
npm run server       # herní server (ws://localhost:8080) — jen pro multiplayer
```

Otevři `http://localhost:5180` a vyber:

- **Hra na tomto PC** — single-player proti jednoduchému AI (server netřeba).
- **Multiplayer** — připojí se k serveru. Spusť `npm run server`, otevři hru ve dvou
  oknech/zařízeních (první = hráč 1, druhý = hráč 2). Kamarád přes LAN/tunel míří na
  `ws://<tvuj-host>:8080`.

## Ovládání

| Akce | Ovládání |
|------|----------|
| Výběr | levý klik / tažení rámečkem |
| Pohyb / těžba / útok | pravý klik (na zem / na zdroj / na nepřítele) |
| Výcvik a stavba | panel vlevo dole (podle vybrané budovy/vesničana) |
| Kamera | WASD / šipky / okraje obrazovky / prostřední tlačítko |
| Zoom | kolečko |
| Minimapa | klik = přesun kamery |
| Zrušit stavbu | Esc / pravý klik |

Cíl: znič nepřátelský Town Center. Ztráta vlastního = porážka.

## Struktura

```
shared/src/sim/   herní logika (čistá, běží na klientu i serveru): step, pathfinding, economy, combat, setup
shared/src/protocol.ts   síťové zprávy
client/src/render/       PixiJS render, izo projekce, procedurální grafika (art.ts)
client/src/game/         view.ts (render+vstup), driver.ts (Local/Net)
client/src/ui/           HUD, minimapa
server/src/              ws server + autoritativní místnost (room.ts)
```

Architektura: simulace v `shared/sim` je čistá funkce `step(state, dt)` a běží **identicky**
na klientu (single-player) i serveru (multiplayer). V multiplayeru server drží autoritativní
stav, klienti posílají příkazy a renderují snapshoty.

## Testy

Playwright skripty v rootu (`test_*.mjs`) ověřují pohyb, ekonomiku, boj, server, multiplayer
a vítěznou podmínku. Vyžadují běžící `npm run dev` (a `npm run server` pro `test_server`/`test_mp`).
