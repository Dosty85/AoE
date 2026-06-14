# AoE RTS

Zjednodušená **izometrická real‑time strategie** v duchu Age of Empires II — běží v prohlížeči,
s **1v1 multiplayerem** přes autoritativní server.

**Stack:** TypeScript · Vite · PixiJS v8 (render) · Node + `ws` (server).
**Grafika:** hybrid — objekty (budovy, jednotky, dekorace) jsou 3D‑renderované sprity z CC0 modelů,
terén a efekty procedurální; jednotky jsou animované. PNG jsou commitnuté, takže pro hraní ani build
**není potřeba Blender**.

🎮 **Živá hra:** http://37.235.109.6/ — otevři, klikni **Multiplayer**, kamarád otevře tutéž adresu.

## Rychlý start (lokálně)
```bash
npm install
npm run dev      # klient → http://localhost:5180
npm run server   # herní server (:8080) — jen pro multiplayer
```
V menu zvol **Hra na tomto PC** (single‑player vs AI, server netřeba) nebo **Multiplayer**.

## Ovládání
| Akce | Ovládání |
|------|----------|
| Výběr | levý klik / tažení rámečkem |
| Pohyb / těžba / útok | pravý klik (zem / zdroj / nepřítel) |
| Výcvik a stavba | panel vlevo dole; `Esc` zruší umisťování |
| Kamera | WASD / šipky / okraje obrazovky / prostřední tlačítko |
| Zoom | kolečko · **Minimapa** klik = přesun kamery |

Cíl: znič nepřátelský Town Center. Ztráta vlastního = porážka.

## Dokumentace
| Dokument | Obsah |
|----------|-------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Vrstvy, sdílená simulace, multiplayer model, protokol, mapa souborů |
| [docs/GAMEPLAY.md](docs/GAMEPLAY.md) | Mechaniky, ceny, staty, balanc, ovládání |
| [docs/GRAPHICS.md](docs/GRAPHICS.md) | Hybridní grafika, 3D render pipeline (Blender), re‑render |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Dev setup, npm skripty, testy, debug API |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Nasazení na VPS, redeploy, provoz, HTTPS později |

## Architektura v kostce
Herní **simulace žije v `shared/src/sim`** jako čistá funkce `step(state, dt)` a běží **identicky** na
klientu (single‑player) i serveru (autoritativní multiplayer). Render (PixiJS), síť (`ws`) a vstup jsou
oddělené vrstvy nad ní. Detaily v [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
shared/src/sim/   čistá herní logika (step, pathfinding, economy, combat, setup)
client/src/       render (PixiJS), game (view + driver), ui (HUD, minimapa)
server/src/       jeden proces: statika (dist/) + WebSocket + autoritativní Room
tools/            Blender render pipeline (3D modely → sprity)
deploy/           systemd unit + deploy skript
```

## Licence assetů
Veškeré 3D modely jsou **CC0** (Kenney Castle/Nature Kit, Quaternius Knight). Žádné originální AoE2 assety.
