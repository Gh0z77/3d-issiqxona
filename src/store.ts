import { useSyncExternalStore } from 'react'
import { CROPS, defaults, type Calc } from './data/crops'

export type View = 'umumiy' | 'tepadan' | 'ichkarida' | 'stellaj' | 'setka'

const state = {
  cropId: CROPS[0].id,
  calc: defaults(CROPS[0]) as Calc,
  view: 'umumiy' as View,
  viewTick: 0, // bir xil ko'rinish qayta bosilsa ham kamera qaytsin
  kyorpa: false, // termo-parda yopiq
  sides: true, // yon pardalar ochiq
  water: true, // sug'orish aravasi ishlayapti
  xray: false, // plyonka shaffof
  labels: true,
}
export type State = typeof state

let snap = { ...state }
const subs = new Set<() => void>()

export function set(patch: Partial<State>) {
  snap = { ...snap, ...patch }
  subs.forEach((f) => f())
}
export const get = () => snap

/** Har qanday o'zgarishda chaqiriladi (3D sahna yangi kadr so'rashi uchun). */
export function subscribe(f: () => void) {
  subs.add(f)
  return () => subs.delete(f)
}

export function useStore<T>(pick: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => pick(snap))
}

export const crop = (s: State = snap) => CROPS.find((c) => c.id === s.cropId)!

export function pickCrop(id: string) {
  const c = CROPS.find((x) => x.id === id)!
  set({ cropId: id, calc: { ...defaults(c), houses: snap.calc.houses, capexM2: snap.calc.capexM2 } })
}

export const goView = (view: View) => set({ view, viewTick: snap.viewTick + 1 })
