/**
 * Yer va binolar joylashuvi (three.js: Y yuqoriga, -Z shimol, +X sharq). 1 birlik = 1 m.
 * Yer: Google xaritadagi 0.67 ga ≈ 68 m (sharq–g'arb) × 98 m (shimol–janub), sharqida yo'l.
 */
export const PLOT = { w: 68, l: 98 }

// Bino: 26 × 40 m, 3 gumbaz, yon devor 3.2 m, eng baland nuqta 5.6 m (loyiha rasmidagi o'lchamlar)
export const GH = { W: 26, L: 40, SPANS: 3, GUTTER: 3.2, RIDGE: 5.6, BAY: 4 }
export const SW = GH.W / GH.SPANS
const S = GH.RIDGE - GH.GUTTER
export const ARCH_R = S / 2 + (SW * SW) / (8 * S)

/** Gumbaz markazidan dx masofadagi tom balandligi. */
export const archY = (dx: number) => GH.GUTTER + Math.sqrt(Math.max(0, ARCH_R * ARCH_R - dx * dx)) - (ARCH_R - S)

export const spanCenters = Array.from({ length: GH.SPANS }, (_, i) => -GH.W / 2 + SW * (i + 0.5))

// Eshik +Z tomonda (mahalliy). Janubiy bino 180° burilgan — eshiklar o'rtadagi yo'lga qaraydi.
export const HOUSES = [
  { x: -17, z: -25, rot: 0, name: '1-bino' },
  { x: 17, z: -25, rot: 0, name: '2-bino' },
  { x: -17, z: 23, rot: Math.PI, name: '3-bino' },
]

// Yuradigan stellajlar: har gumbazda 4 ta, 1.8 × 36 m, balandligi 0.8 m, bitta "suzuvchi" yo'lak 0.6 m
export const BENCH = { w: 1.8, l: 36, h: 0.8, z0: -19, trayW: 0.28, trayL: 0.54, stepX: 0.3, stepZ: 0.545, across: 6, along: 66 }
export const benchOffsets = (() => {
  const l = -SW / 2 + 0.43
  return [l + 0.9, l + 2.7, l + 5.1, l + 6.9]
})()

// Setkali chiniqtirish maydoni (janubi-sharq), xizmat binosi va suv hovuzi
export const SHADE = { x0: 4, x1: 30, z0: 3, z1: 30, h: 3 }
export const SERVICE = { x: 13, z: 39, w: 14, d: 9, h: 4 }
export const TANK = { x: 26, z: 39, r: 3, h: 3.2 }
