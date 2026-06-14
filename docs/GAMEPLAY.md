# Hratelnost a balanc

Zjednodušená obdoba AoE2. Cíl: **zničit nepřátelský Town Center**. Ztráta vlastního = porážka
(`checkVictory` v `shared/src/sim/state.ts`).

## Suroviny
Tři suroviny (kámen vynechán): **dřevo** 🪵, **jídlo** 🍖, **zlato** 🪙. Na mapě jako dlaždice se zdrojem:
- les → dřevo, ložisko (písek) → zlato, keř → jídlo.
Vesničan těží do kapacity, vrátí náklad do **Town Center** (dropoff), pak se vrací ke zdroji; po vytěžení
si sám najde nejbližší zdroj stejného druhu.

## Jednotky a budovy
| Entita | HP | Rychlost (dl/s) | Půdorys |
|--------|----|-----|---------|
| Vesničan | 40 | 2.6 | 1×1 |
| Voják | 70 | 2.2 | 1×1 |
| Town Center | 1000 | — | 3×3 (radius 1) |
| Dům | 250 | — | 1×1 |
| Kasárna | 500 | — | 1×1 |

## Ceny a časy
| Akce | Cena | Čas |
|------|------|-----|
| Vesničan (Town Center) | 50 jídlo | 6 s |
| Voják (Kasárna) | 60 jídlo + 20 zlato | 8 s |
| Dům | 30 dřevo | 8 s |
| Kasárna | 150 dřevo | 14 s |
| Town Center | 350 dřevo | 30 s |

## Populace
`pop = 5 (základ) + 5 × postavený dům`, strop `MAX_POP = 200`. Výcvik je blokován při dosažení stropu
(zařazené ve frontě se počítají). Funkce `popUsed/popCap` v `state.ts`.

## Ekonomika (konstanty)
| Konstanta | Hodnota | Význam |
|-----------|---------|--------|
| `CARRY_CAP` | 10 | kolik vesničan unese |
| `GATHER_RATE` | 1.3 / s | rychlost těžby |
| `GATHER_RANGE` | 1.6 | dosah k těžbě |
| `DROP_RANGE` | 1.8 | dosah k odložení do budovy |

## Boj
Auto‑zaměřování: jednotka s `aggro` (vojáci) si v dohledu sama najde nejbližší nepřátelskou entitu,
když je nečinná. Pravým klikem na nepřítele zadáš cílený útok.

| | Damage | Dosah | Cooldown | Dohled |
|--|--------|-------|----------|--------|
| Vesničan | 3 | 1.2 | 1.3 s | 4 |
| Voják | 11 | 1.3 | 1.0 s | 7 |

Budovy neútočí (žádné věže). Po smrti (`hp ≤ 0`) je entita odstraněna; u budov se uvolní dlaždice.

## Mapa
Čtvercový grid **48×48**, deterministicky generovaný ze seedu (`mapgen.ts`): tráva, jezera (neprůchodná
voda), shluky lesů, ložiska zlata, keře. Základny se rozmísťují do protilehlých rohů a okolí se vyčistí
(voda→tráva), aby základna stála na souši (`setup.ts`).

## Ovládání
| Akce | Ovládání |
|------|----------|
| Výběr | levý klik / tažení rámečkem (jen vlastní jednotky) |
| Pohyb | pravý klik na zem |
| Těžba | pravý klik na zdroj (vesničan) |
| Útok | pravý klik na nepřítele |
| Výcvik / stavba | panel vlevo dole (dle vybrané budovy/vesničana), `Esc` zruší stavbu |
| Kamera | WASD / šipky / okraje obrazovky / prostřední tlačítko |
| Zoom | kolečko |
| Minimapa | klik = přesun kamery |

Všechny hodnoty jsou v `shared/src/constants.ts` — snadné doladění balancu na jednom místě.
