import * as THREE from 'three'
import { setLoading } from '../loading'

/**
 * Teksturalar yuklanishini kuzatish. mats.ts dan OLDIN import qilinadi: teksturalar modul yuklanishi bilan
 * so'raladi, kuzatuvchi kech qo'yilsa "hammasi yuklandi" xabari o'tib ketadi (kesh bilan qayta kirganda).
 */
export const watch = { done: false, listeners: new Set<() => void>() }

const m = THREE.DefaultLoadingManager
m.onStart = () => (watch.done = false)
m.onProgress = (_, loaded, total) => setLoading((loaded / total) * 90)
m.onLoad = () => {
  watch.done = true
  watch.listeners.forEach((f) => f())
}
