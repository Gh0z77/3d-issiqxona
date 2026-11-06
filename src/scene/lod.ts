import * as THREE from 'three'
import { HOUSES, SHADE } from './layout'

/**
 * Batafsillik darajasi (LOD): kamera yaqin turgan blokda (bino yoki setkali maydon) minglab kasseta,
 * sug'orish aravasi va purkagich chiziladi; uzoqdagilarda — bitta tekis "ko'chat gilami".
 * Gisterezis: chegarada turganda u yoq-bu yoqqa sakrab turmasin.
 */
export const BLOCKS = [
  ...HOUSES.map((h) => ({ x: h.x, z: h.z, r: 24 })),
  { x: (SHADE.x0 + SHADE.x1) / 2, z: (SHADE.z0 + SHADE.z1) / 2, r: 19 },
]
export const near = BLOCKS.map(() => false)

export function updateNear(cam: THREE.Vector3) {
  BLOCKS.forEach((b, i) => {
    const d = Math.hypot(cam.x - b.x, cam.z - b.z)
    const on = near[i] ? d < b.r + 22 && cam.y < 34 : d < b.r + 15 && cam.y < 26
    near[i] = on
  })
}

