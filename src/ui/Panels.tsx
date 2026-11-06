import { useState } from 'react'
import { CROPS, HOUSE, economics, type Calc } from '../data/crops'
import { crop, get, goView, pickCrop, set, useStore, type State, type View } from '../store'

const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']

const num = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ')
function som(n: number) {
  const a = Math.abs(n)
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)} mlrd so‘m`
  if (a >= 1e6) return `${(n / 1e6).toFixed(0)} mln so‘m`
  return `${num(n)} so‘m`
}
function qty(n: number, kochat: boolean) {
  if (kochat) return n >= 1e6 ? `${(n / 1e6).toFixed(2)} mln dona` : `${num(n / 1000)} ming dona`
  return n >= 1000 ? `${(n / 1000).toFixed(1)} tonna` : `${num(n)} kg`
}

function CropPicker() {
  const s = useStore((x) => x)
  const c = crop(s)
  const mode = c.mode
  return (
    <section className="panel panel--left">
      <h2>Nima ekamiz?</h2>
      <div className="seg">
        {(['kochat', 'hosil'] as const).map((m) => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => pickCrop(CROPS.find((x) => x.mode === m)!.id)}>
            {m === 'kochat' ? 'Ko‘chat sotish' : 'Hosil yetishtirish'}
          </button>
        ))}
      </div>
      <ul className="crops">
        {CROPS.filter((x) => x.mode === mode).map((x) => {
          const e = economics(x, { ...s.calc, cycles: x.cycles, price: x.price, cost: x.cost, yieldM2: x.yieldM2 ?? 0 })
          return (
            <li key={x.id}>
              <button className={x.id === c.id ? 'on' : ''} onClick={() => pickCrop(x.id)}>
                <span className="em">{x.emoji}</span>
                <span className="nm">{x.name}</span>
                <span className="pf">{som(e.profit)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="note">{c.note}</p>
      <div className="cal" aria-label="Sotuv oylari">
        {MONTHS.map((m, i) => (
          <span key={m} className={c.sale.includes(i + 1) ? 'on' : ''}>
            {m}
          </span>
        ))}
      </div>
      <p className="cal-cap">Yashil — sotuv / hosil oylari</p>
    </section>
  )
}

function Field({ label, k, step, suffix }: { label: string; k: keyof Calc; step: number; suffix: string }) {
  const v = useStore((s) => s.calc[k])
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={v}
        // Panelni g'ildirak bilan aylantirganda kursor maydon ustidan o'tsa, qiymat tasodifan o'zgarmasin
        onWheel={(e) => e.currentTarget.blur()}
        onChange={(e) => {
          const n = Math.max(0, Number(e.target.value) || 0)
          const calc = get().calc
          set({ calc: { ...calc, [k]: k === 'houses' ? Math.min(3, Math.max(1, Math.round(n))) : n } })
        }}
      />
      <em>{suffix}</em>
    </label>
  )
}

function Economics() {
  const s = useStore((x) => x)
  const c = crop(s)
  const e = economics(c, s.calc)
  const k = c.mode === 'kochat'
  return (
    <section className="panel panel--right">
      <h2>Yillik hisob</h2>
      <div className="big">
        <span>Sof foyda / yil</span>
        <b className={e.profit < 0 ? 'neg' : ''}>{som(e.profit)}</b>
      </div>
      <dl className="rows">
        <dt>{k ? 'Bir aylanishda' : 'Bir navbatda'}</dt>
        <dd>{qty(e.perCycle, k)}</dd>
        <dt>Yiliga</dt>
        <dd>{qty(e.yearly, k)}</dd>
        <dt>Tushum</dt>
        <dd>{som(e.revenue)}</dd>
        <dt>Xarajat</dt>
        <dd>{som(e.costs)}</dd>
        <dt>Qurilish (taxm.)</dt>
        <dd>{som(e.capex)}</dd>
        <dt>Qoplash muddati</dt>
        <dd>{Number.isFinite(e.payback) ? `${e.payback.toFixed(1)} yil` : '—'}</dd>
      </dl>
      <details className="inputs" open>
        <summary>Raqamlarni o‘zgartirish</summary>
        <Field label="Binolar soni" k="houses" step={1} suffix="ta (1–3)" />
        <Field label={k ? 'Aylanish / yil' : 'Navbat / yil'} k="cycles" step={1} suffix="marta" />
        {!k && <Field label="Hosildorlik" k="yieldM2" step={1} suffix="kg/m² yil" />}
        <Field label="Sotuv narxi" k="price" step={k ? 50 : 500} suffix={k ? 'so‘m/dona' : 'so‘m/kg'} />
        <Field label="Tannarx" k="cost" step={k ? 50 : 500} suffix={k ? 'so‘m/dona' : 'so‘m/kg'} />
        <Field label="Qurilish narxi" k="capexM2" step={10000} suffix="so‘m/m²" />
      </details>
      <p className="fine">
        {k
          ? `Har bino: ${HOUSE.benches} stellaj, ${num(HOUSE.trays)} kasseta × ${c.cells} katak, ${Math.round(0.88 * 100)}% sotiladi. Bir aylanish ~${c.days} kun.`
          : `Ekiladigan maydon: ${Math.round(HOUSE.usable * 100)}% (${num(HOUSE.area * HOUSE.usable)} m² / bino).`}{' '}
        Narxlar taxminiy — mahalliy bozor bo‘yicha o‘zgartiring.
      </p>
    </section>
  )
}

const VIEW_LABEL: Record<View, string> = { umumiy: 'Umumiy', tepadan: 'Tepadan', ichkarida: 'Ichkarida', stellaj: 'Stellaj', setka: 'Setkali maydon' }

const TOGGLES: { k: keyof State; on: string; off: string }[] = [
  { k: 'kyorpa', on: 'Kyorpa yopiq', off: 'Kyorpa ochiq' },
  { k: 'sides', on: 'Yon parda ochiq', off: 'Yon parda yopiq' },
  { k: 'water', on: 'Sug‘orish yoqilgan', off: 'Sug‘orish o‘chiq' },
  { k: 'xray', on: 'Plyonka shaffof', off: 'Plyonka oddiy' },
  { k: 'labels', on: 'Yozuvlar bor', off: 'Yozuvlar yo‘q' },
]

export function Panels() {
  const view = useStore((s) => s.view)
  const s = useStore((x) => x)
  const [tab, setTab] = useState<'ekin' | 'hisob' | '3d'>('ekin')
  return (
    <div className={`ui ui--${tab}`}>
      <header className="top">
        <a className="brand" href="https://www.uzgrow.uz" target="_blank" rel="noreferrer">
          <img src="/images/logo.png" alt="UZ GROW" />
          <span>
            <b>Ko‘chatxona · Muzrabod</b>
            <em>3 bino × 26×40 m · 30 sotix · Surxondaryo</em>
          </span>
        </a>
        <nav className="views" aria-label="Kamera">
          {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => goView(v)}>
              {VIEW_LABEL[v]}
            </button>
          ))}
        </nav>
      </header>
      <div className="tabs" role="tablist">
        <button className={tab === 'ekin' ? 'on' : ''} onClick={() => setTab('ekin')}>
          Ekin
        </button>
        <button className={tab === 'hisob' ? 'on' : ''} onClick={() => setTab('hisob')}>
          Hisob
        </button>
        <button className={tab === '3d' ? 'on' : ''} onClick={() => setTab('3d')}>
          Faqat 3D
        </button>
      </div>
      <CropPicker />
      <Economics />
      <footer className="toggles">
        {TOGGLES.map((t) => (
          <button key={t.k} className={s[t.k] ? 'on' : ''} aria-pressed={!!s[t.k]} onClick={() => set({ [t.k]: !s[t.k] })}>
            {s[t.k] ? t.on : t.off}
          </button>
        ))}
        <span className="hint">Chap tugma — aylantirish · o‘ng — surish · g‘ildirak — kursor tomon yaqinlashish</span>
      </footer>
    </div>
  )
}
