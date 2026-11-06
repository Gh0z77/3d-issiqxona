/**
 * Ekinlar va iqtisod. Narxlar 2026-yil Surxondaryo bozori uchun TAXMINIY — saytda foydalanuvchi o'zgartira oladi.
 * kochat: birlik = 1 dona ko'chat; hosil: birlik = 1 kg.
 */
export type Leaf = 'tomato' | 'pepper' | 'eggplant' | 'cucumber' | 'melon' | 'cabbage' | 'strawberry'
export type Mode = 'kochat' | 'hosil'

export type Crop = {
  id: string
  mode: Mode
  name: string
  emoji: string
  leaf: Leaf
  green: string // barg rangi
  cells?: number // kasseta katakchalari (faqat ko'chat)
  height: number // m: ko'chat bo'yi yoki o'simlik bo'yi
  days: number // bir aylanish (ko'chat) yoki ekishdan birinchi hosilgacha
  cycles: number // yiliga aylanishlar (ko'chat) / navbatlar (hosil)
  yieldM2?: number // kg/m² yiliga (faqat hosil)
  price: number // so'm / birlik
  cost: number // so'm / birlik: urug', substrat, o'g'it, ish haqi, isitish, elektr
  sale: number[] // sotuv oylari (1..12)
  note: string
}

export const CROPS: Crop[] = [
  { id: 'pomidor-k', mode: 'kochat', name: 'Pomidor ko‘chati', emoji: '🍅', leaf: 'tomato', green: '#3f7a2c', cells: 128, height: 0.16, days: 40, cycles: 3, price: 900, cost: 450, sale: [2, 3, 4, 8, 9], note: 'Eng ko‘p so‘raladigan ko‘chat. Ochiq dala (fevral–aprel) va kuzgi issiqxonalar (avgust–sentyabr) uchun.' },
  { id: 'qalampir-k', mode: 'kochat', name: 'Qalampir ko‘chati', emoji: '🌶️', leaf: 'pepper', green: '#2f6b2a', cells: 128, height: 0.13, days: 55, cycles: 2, price: 800, cost: 400, sale: [3, 4, 5], note: 'Sekin o‘sadi (55 kun), lekin barqaror talab. Bahorda ochiq dala uchun.' },
  { id: 'baqlajon-k', mode: 'kochat', name: 'Baqlajon ko‘chati', emoji: '🍆', leaf: 'eggplant', green: '#4d7337', cells: 72, height: 0.15, days: 55, cycles: 2, price: 900, cost: 450, sale: [3, 4, 5], note: 'Issiqni yaxshi ko‘radi — Surxondaryo uchun mos ekin.' },
  { id: 'bodring-k', mode: 'kochat', name: 'Bodring ko‘chati', emoji: '🥒', leaf: 'cucumber', green: '#4c8a30', cells: 72, height: 0.14, days: 25, cycles: 4, price: 1000, cost: 550, sale: [2, 3, 4, 8, 9, 10], note: 'Eng tez aylanadi (25 kun) — yiliga 4 marta.' },
  { id: 'tarvuz-k', mode: 'kochat', name: 'Payvand tarvuz ko‘chati', emoji: '🍉', leaf: 'melon', green: '#45803a', cells: 72, height: 0.15, days: 40, cycles: 2, price: 4000, cost: 2200, sale: [2, 3, 4], note: 'Qovoqqa payvand qilingan. Eng yuqori foyda, lekin malakali payvandchi kerak.' },
  { id: 'karam-k', mode: 'kochat', name: 'Karam ko‘chati', emoji: '🥬', leaf: 'cabbage', green: '#6f9a86', cells: 128, height: 0.12, days: 35, cycles: 3, price: 300, cost: 120, sale: [3, 4, 7, 8], note: 'Arzon, lekin hajmi katta. Yozgi aylanish setkali maydonda chiniqtiriladi.' },
  { id: 'qulupnay-k', mode: 'kochat', name: 'Qulupnay ko‘chati', emoji: '🍓', leaf: 'strawberry', green: '#3d7a35', cells: 50, height: 0.15, days: 50, cycles: 2, price: 3000, cost: 1500, sale: [8, 9, 10], note: 'Kassetali (tray) qulupnay ko‘chati — kuzgi ekish uchun, narxi yuqori.' },

  { id: 'pomidor-h', mode: 'hosil', name: 'Pomidor (hosil)', emoji: '🍅', leaf: 'tomato', green: '#3d7a2c', height: 2.4, days: 75, cycles: 2, yieldM2: 20, price: 9000, cost: 5000, sale: [4, 5, 6, 10, 11, 12], note: 'Kuzgi (avgust ekish) va bahorgi (yanvar ekish) navbat. Kam isitish bilan ~20 kg/m².' },
  { id: 'bodring-h', mode: 'hosil', name: 'Bodring (hosil)', emoji: '🥒', leaf: 'cucumber', green: '#4c8a30', height: 2.6, days: 45, cycles: 3, yieldM2: 25, price: 7000, cost: 4000, sale: [3, 4, 5, 6, 10, 11], note: 'Tez hosilga kiradi, yiliga 3 navbat. Yozda issiq tufayli tanaffus.' },
  { id: 'qulupnay-h', mode: 'hosil', name: 'Qulupnay (hosil)', emoji: '🍓', leaf: 'strawberry', green: '#3d7a35', height: 0.35, days: 70, cycles: 1, yieldM2: 5, price: 35000, cost: 18000, sale: [12, 1, 2, 3, 4, 5], note: 'Baland tarnovlarda (rasmdagidek). Qish–bahor hosili, narxi eng yuqori payt.' },
]

/** Bino va ko'chatxona o'lchamlari (ovozli xabar va loyiha rasmidan). */
export const HOUSE = {
  count: 3,
  width: 26,
  length: 40,
  area: 26 * 40, // 1040 m² ≈ 10 sotix
  benches: 12, // har binoda: 3 gumbaz × 4 stellaj
  benchArea: 12 * 1.8 * 36, // 777.6 m²
  trays: 12 * 6 * 66, // 4752 kasseta
  usable: 0.85, // hosil rejimida ekiladigan ulush
}

export const SELLABLE = 0.88 // unib chiqish va saralashdan keyin sotiladigan ulush
export const CAPEX_M2 = 550_000 // so'm/m²: karkas + plyonka + kyorpa + stellaj + sug'orish aravasi + zaxira isitgich

export type Calc = { houses: number; cycles: number; price: number; cost: number; capexM2: number; yieldM2: number }

export function defaults(c: Crop): Calc {
  return { houses: HOUSE.count, cycles: c.cycles, price: c.price, cost: c.cost, capexM2: CAPEX_M2, yieldM2: c.yieldM2 ?? 0 }
}

export function economics(c: Crop, k: Calc) {
  const perCycle = c.mode === 'kochat' ? Math.round(k.houses * HOUSE.trays * (c.cells ?? 0) * SELLABLE) : Math.round(k.houses * HOUSE.area * HOUSE.usable * (k.yieldM2 / Math.max(1, k.cycles)))
  const yearly = perCycle * k.cycles
  const revenue = yearly * k.price
  const costs = yearly * k.cost
  const profit = revenue - costs
  const capex = k.houses * HOUSE.area * k.capexM2
  return { perCycle, yearly, revenue, costs, profit, capex, payback: profit > 0 ? capex / profit : Infinity }
}

// O'z-o'zini tekshirish: pomidor ko'chati, 3 bino → bir aylanishda ~1.6 mln dona
const t = economics(CROPS[0], defaults(CROPS[0]))
console.assert(t.perCycle === Math.round(3 * 4752 * 128 * 0.88) && t.yearly === t.perCycle * 3, 'economics', t)
