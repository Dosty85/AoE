export interface HudCallbacks {
  trainVillager(): void
  trainSoldier(): void
  buildHouse(): void
  buildBarracks(): void
}

export type HudContext = 'townCenter' | 'barracks' | 'villager' | 'none'

function el(tag: string, style: string, text = ''): HTMLElement {
  const e = document.createElement(tag)
  e.style.cssText = style
  if (text) e.textContent = text
  return e
}

const BTN =
  'padding:8px 12px;margin:4px 4px 0 0;border:1px solid #6b5a3a;border-radius:6px;' +
  'background:#3a2f1c;color:#f0e6c8;font:13px sans-serif;cursor:pointer;'

export class Hud {
  private wood = el('span', 'margin-right:18px')
  private food = el('span', 'margin-right:18px')
  private gold = el('span', 'margin-right:18px')
  private pop = el('span', '')
  private panel = el('div', '')
  private btnVillager: HTMLElement
  private btnSoldier: HTMLElement
  private btnHouse: HTMLElement
  private btnBarracks: HTMLElement
  private hint = el('div', 'margin-top:6px;color:#cdbf99;font:12px sans-serif')

  constructor(cb: HudCallbacks) {
    const bar = el(
      'div',
      'position:fixed;top:0;left:0;right:0;height:40px;display:flex;align-items:center;' +
        'padding:0 16px;background:rgba(20,16,8,0.85);color:#f0e6c8;font:14px sans-serif;' +
        'border-bottom:1px solid #6b5a3a;z-index:10;',
    )
    bar.append(this.wood, this.food, this.gold, this.pop)
    document.body.appendChild(bar)

    this.panel = el(
      'div',
      'position:fixed;left:12px;bottom:12px;min-width:200px;padding:10px;' +
        'background:rgba(20,16,8,0.85);border:1px solid #6b5a3a;border-radius:8px;z-index:10;',
    )
    this.btnVillager = el('button', BTN, '+ Vesničan (50 j.)')
    this.btnSoldier = el('button', BTN, '+ Voják (60 j. 20 z.)')
    this.btnHouse = el('button', BTN, 'Dům (30 d.)')
    this.btnBarracks = el('button', BTN, 'Kasárna (150 d.)')
    this.btnVillager.onclick = cb.trainVillager
    this.btnSoldier.onclick = cb.trainSoldier
    this.btnHouse.onclick = cb.buildHouse
    this.btnBarracks.onclick = cb.buildBarracks
    this.panel.append(this.btnVillager, this.btnSoldier, this.btnHouse, this.btnBarracks, this.hint)
    document.body.appendChild(this.panel)
    this.setContext('none')
  }

  setResources(wood: number, food: number, gold: number, pop: number, cap: number): void {
    this.wood.textContent = `🪵 ${Math.floor(wood)}`
    this.food.textContent = `🍖 ${Math.floor(food)}`
    this.gold.textContent = `🪙 ${Math.floor(gold)}`
    this.pop.textContent = `👥 ${pop}/${cap}`
  }

  setContext(ctx: HudContext, queueLen = 0): void {
    const show = (e: HTMLElement, on: boolean) => (e.style.display = on ? 'inline-block' : 'none')
    show(this.btnVillager, ctx === 'townCenter')
    show(this.btnSoldier, ctx === 'barracks')
    show(this.btnHouse, ctx === 'villager')
    show(this.btnBarracks, ctx === 'villager')
    if (ctx === 'none') this.hint.textContent = 'Vyber jednotku nebo budovu (levý klik / tažení).'
    else if (ctx === 'villager') this.hint.textContent = 'Pravý klik na zdroj = těžba. Postav budovu.'
    else if (ctx === 'townCenter') this.hint.textContent = `Town Center — fronta: ${queueLen}`
    else this.hint.textContent = `Kasárna — fronta: ${queueLen}`
  }

  setPlacing(kind: string | null): void {
    this.hint.textContent = kind
      ? `Umísti ${kind}: levý klik = postavit, pravý klik / Esc = zrušit.`
      : this.hint.textContent
  }
}
