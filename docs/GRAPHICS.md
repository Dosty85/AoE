# Grafika

**Hybridní přístup:** objekty (budovy, jednotky, dekorace) jsou **3D‑renderované sprity** z volných CC0
modelů; **terén a efekty** (dlaždice, výběrové kroužky, health bary, výběrový box) jsou **procedurální**.
Vyrenderované PNG jsou commitnuté v `client/public/sprites/` — **pro hraní ani build není potřeba Blender**.
Když sprity chybí, hra automaticky spadne na čistě procedurální grafiku.

## Izometrie
- Dlaždice 2:1 (`TILE_W=128`, `TILE_H=64`). Projekce v `client/src/render/iso.ts`:
  `screenX = (gx − gy)·64`, `screenY = (gx + gy)·32`. Hloubkové řazení dle `gx + gy`.
- Kotva spritů = bod dotyku se zemí (objekty „stojí" na dlaždici).

## Procedurální vrstva (`client/src/render/art.ts`)
Kreslí se přes PixiJS `Graphics` a zapéká do textur (`generateTexture`). Pokrývá **terén** (tráva, hlína,
písek, voda — izo diamanty se stínováním) a slouží jako **fallback** pro objekty.
`buildArtSet(renderer)` = procedurální terén + (načtené 3D sprity ∥ procedurální objekty).

## 3D render pipeline (`tools/`)
Renderuje 3D modely z pevné izometrické kamery do PNG. Dvoufázově:

1. **`render_sprites.py`** — statické objekty (budovy, dekorace) z prázdné scény, import GLB.
2. **`render_units.py`** — **animované jednotky**: otevírá riggovaný `KnightCharacter.blend`, nastaví akci
   (Idle/Walking) a vyrenderuje snímky (idle 1, walk 8).

Společné: ortografická kamera 2:1 (`rotation_euler=(60°,0,45°)`, `shift_y`), slunce z levého‑horního rohu,
průhledné pozadí. Pro každý objekt: import → poskládání (`compose`: stack=budovy / overlay=postavy) →
škála (`fit`: width=půdorys / height=výška) → volitelný tint → render → kotva (projekce world origin)
do `manifest.json`.

Konfigurace: **`tools/models.json`** (mapování entita→model, škály, tinty, animace).

### Spuštění re‑renderu
```bash
npm run render:sprites
```
Potřebuje **Blender 4.5** (cesta v `package.json` skriptu `render:sprites`) a stažené CC0 modely v
`art-src/` (viz níže). Výstup přepíše `client/public/sprites/`.

## Zdroje (vše CC0, do `art-src/`, gitignored)
| Pack | Použití | Zdroj |
|------|---------|-------|
| Kenney **Castle Kit** | budovy (modulární věže) | kenney.nl/assets/castle-kit |
| Kenney **Nature Kit** | strom, kámen→zlato, keř | kenney.nl/assets/nature-kit |
| Quaternius **Knight** | jednotky (vesničan/voják, animace) | OpenGameArt / quaternius.com |

Vesničan = rytíř s hnědou tunikou, voják = rytíř v oceli (odlišeno přebarvením materiálu „Armor").
Nepřítel se odlišuje runtime tintem (`sprite.tint`).

## Klient (`client/src/render/sprites.ts`)
`loadSprites()` načte `manifest.json` + textury přes PixiJS `Assets`. Jednotky dostanou animace
(`anims: { idle, walk }`); `GameView` z nich dělá `AnimatedSprite` a přepíná **idle/walk podle pohybu**
(detekce přes deltu pozice + `moveTimer`, aby to neblikalo mezi 20 Hz snapshoty v multiplayeru).

## Poznámky / možná vylepšení
- Útok/death animace (akce v blendu existují), 8 směrů natočení, team‑color maska místo tintu.
- Velké modely jsou jen dev‑závislost; běžící hra je na nich nezávislá (PNG jsou commitnuté).
