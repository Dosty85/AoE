# Architektura

## Přehled
Webová izometrická RTS (Age of Empires II „lite") s autoritativním 1v1 multiplayerem.
Stack: **TypeScript** napříč, **Vite** (build/dev), **PixiJS v8** (WebGL render), **Node + `ws`** (server).

Klíčová myšlenka: **herní simulace je čistá a sdílená**. Stejný kód běží na klientu (single‑player)
i na serveru (autoritativní multiplayer). Render, síť a vstup jsou oddělené vrstvy nad ní.

```
            ┌──────────────────────────── shared/sim (čistá logika) ───────────────────────────┐
            │  step(state, dt): pohyb → těžba → výcvik → stavba → boj → úmrtí → vítězná podmínka │
            └───────────────────────────────────────────────────────────────────────────────────┘
                          ▲                                                  ▲
          single‑player   │ pouští lokálně                 multiplayer       │ autorita
          ┌───────────────┴───────────────┐                 ┌────────────────┴───────────────────┐
          │ LocalDriver (client)          │                 │ Room (server) ── ws ── NetDriver    │
          │  + jednoduché AI              │                 │  snapshoty 20 Hz, příkazy od klientů │
          └───────────────────────────────┘                 └─────────────────────────────────────┘
                          ▲                                                  ▲
                          └──────────────── GameView (render + vstup, PixiJS) ┘
```

## Vrstvy
| Vrstva | Kde | Odpovědnost |
|--------|-----|-------------|
| **Simulace** | `shared/src/sim/` | Veškerá herní logika. Žádné IO/render. Pevný krok `step(state, dt)`. |
| **Protokol** | `shared/src/protocol.ts` | Zprávy klient↔server, kompaktní snapshot entit. |
| **Render** | `client/src/render/` | PixiJS scéna, izo projekce, grafika (art). |
| **Hra/vstup** | `client/src/game/` | `GameView` (sprity, výběr, příkazy, kamera) + `SimDriver` (lokální/síťový). |
| **UI** | `client/src/ui/` | HUD, minimapa (mimo Pixi, DOM/canvas). |
| **Server** | `server/src/` | HTTP statika + WebSocket + autoritativní `Room`. |

## Sdílená simulace (`shared/src/sim`)
- **`state.ts`** — datový model: `GameState { map, entities[], players[], over, winner, tick }`,
  `Entity`, `Player`. Pomocné: `spawn`, `popUsed/popCap`, `checkVictory`, `createState`.
- **`step.ts`** — `step(state, dt)` (orchestruje systémy) a `applyCommand(state, cmd)`. `Command` =
  `move | gather | train | build | attack`. Také `formationTargets`, `canPlace`, `canAfford`.
- **`pathfinding.ts`** — A\* na gridu (8 směrů, zákaz prořezávání rohů), `nearestWalkable`.
- **`economy.ts`** — stavový automat těžby (vesničan → zdroj → návrat do dropoffu), výcvik z fronty, výstavba.
- **`combat.ts`** — auto‑zaměřování, útok/cooldown, smrt, odstranění mrtvých.
- **`mapgen.ts`** + **`rng.ts`** — deterministická generace mapy (mulberry32; stejný seed = stejná mapa).
- **`setup.ts`** — `initMatch` / `clearBaseAreas` — deterministické rozmístění základen (běží na serveru
  i klientu, aby seděl terén).

Pořadí v `step`: pohyb → `gatherSystem` → `trainSystem` → `constructionSystem` → `combatSystem` →
`removeDead` → `checkVictory`.

## Multiplayer model
**Autoritativní server s pevným tickem** (ne deterministický lockstep — vyhýbáme se peklu determinismu floatů).
- Klient posílá **příkazy** (`{t:'cmd', cmd}`), ne stav.
- Server (`server/src/room.ts`) drží jediný `GameState`, tickuje na `SIM_HZ` (20 Hz), ověřuje vlastnictví
  entit (`sanitize`) a broadcastuje **snapshot** všem.
- Klient (`NetDriver`) nahradí stav ze snapshotu a renderuje; pozice sprite **lerpuje** pro plynulost mezi snapshoty.

### Protokol (`shared/src/protocol.ts`)
- **S→C** `ServerMsg`:
  - `init` `{ seed, size, you, players }` — při připojení; klient si vygeneruje mapu ze `seed`.
  - `snap` `{ tick, players[], ents[], depleted[], over, winner }` — periodický stav. `ents` jsou
    **kompaktní** (`EntitySnap`: id, owner, kind, x, y, hp, maxHp, buildLeft, radius). `depleted` = indexy
    vytěžených dlaždic (klient odstraní dekoraci).
- **C→S** `ClientMsg`: `{ t:'cmd', cmd }`.

### Driver abstrakce (`client/src/game/driver.ts`)
`SimDriver { state, me, command(c), tick(dt) }`:
- **`LocalDriver`** — single‑player: drží stav, `command` aplikuje lokálně, `tick` volá `step`; obsahuje
  jednoduché AI (nepřátelští vojáci míří na můj Town Center).
- **`NetDriver`** — `command` pošle na server, `tick` nic nedělá (stav řídí snapshoty).

`GameView` je na driveru nezávislý — stejný render/vstup pro obě varianty.

## Server (`server/src`)
Jeden Node proces:
- **`index.ts`** — `http.createServer` se statickým handlerem (`static.ts`) **+** `WebSocketServer({ server })`
  na stejném portu. `PORT`/`STATIC_DIR` z env.
- **`room.ts`** — autoritativní místnost: tick loop, fronta příkazů, validace vlastnictví, snapshoty,
  detekce vytěžených dlaždic (diff vůči referenční mapě).
- **`static.ts`** — minimální statický file server pro `dist/` (MIME + SPA fallback).

## Mapa souborů
```
shared/src/
  constants.ts        # rozměry, ceny, staty, balanc (viz docs/GAMEPLAY.md)
  types.ts            # GameMap, MapTile, ResourceKind
  protocol.ts         # síťové zprávy
  sim/{rng,mapgen,setup,state,pathfinding,economy,combat,step}.ts
client/
  index.html
  src/main.ts                 # menu (single/multiplayer), bootstrap
  src/render/{iso,art,sprites,scene}.ts
  src/game/{view,driver}.ts
  src/ui/{hud,minimap}.ts
  public/sprites/             # 3D-renderované PNG + manifest.json (commitnuté)
server/src/{index,room,static}.ts
tools/{render_sprites,render_units}.py, models.json   # Blender render pipeline
deploy/{aoe.service, deploy.sh}
vite.config.ts, tsconfig.json, package.json           # v rootu
```

Viz též [GAMEPLAY.md](GAMEPLAY.md), [GRAPHICS.md](GRAPHICS.md), [DEVELOPMENT.md](DEVELOPMENT.md),
[DEPLOYMENT.md](DEPLOYMENT.md).
