import { useSyncExternalStore } from 'react'

/** Yuklanish holati. 3D paket (three.js) uni to'ldiradi; asosiy paket three.js'siz qoladi. */
let state = { progress: 0, done: false }
const subs = new Set<() => void>()

export function setLoading(progress: number, done = false) {
  state = { progress: Math.max(state.progress, progress), done: state.done || done }
  subs.forEach((f) => f())
}

export const useLoading = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
  )
