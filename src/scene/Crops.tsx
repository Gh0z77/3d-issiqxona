import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BENCH, HOUSES, SHADE, SW, benchOffsets, spanCenters } from './layout'
import { M } from './mats'
import { TOP_PAD, cropTextures, trayTexture } from './sprites'
import { near } from './lod'
import { Q } from './quality'
import { crop, useStore } from '../store'
import type { Crop } from '../data/crops'

const UP = new THREE.Vector3(0, 1, 0)
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

const houseMats = HOUSES.map((h) => new THREE.Matrix4().compose(new THREE.Vector3(h.x, 0, h.z), new THREE.Quaternion().setFromAxisAngle(UP, h.rot), new THREE.Vector3(1, 1, 1)))

function rnd(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

/** Vertikal kvadrat normalini biroz yuqoriga og'diramiz: barg "devor" emas, gilamdek yoritilsin. */
function softNormals(g: THREE.BufferGeometry) {
  const n = g.attributes.normal
  const v = new THREE.Vector3()
  for (let i = 0; i < n.count; i++) {
    v.fromBufferAttribute(n, i)
    v.multiplyScalar(0.45).add(UP).normalize()
    n.setXYZ(i, v.x, v.y, v.z)
  }
  return g
}

/** Ko'chat: kasseta bo'ylab 2 ta vertikal + 1 ta ustki kvadrat (balandlik = 1, instansda masshtab). */
const canopyGeo = (() => {
  const a = new THREE.PlaneGeometry(BENCH.trayL, 1).rotateY(Math.PI / 2).translate(-0.07, 0.5, 0)
  const b = new THREE.PlaneGeometry(BENCH.trayL, 1).rotateY(Math.PI / 2).translate(0.07, 0.5, 0)
  // Ustki qatlam kassetadan har tomonga 5 sm katta: barglar qo'shni kassetaga chiqib, chok ko'rinmaydi
  const top = new THREE.PlaneGeometry(BENCH.trayW + 2 * TOP_PAD, BENCH.trayL + 2 * TOP_PAD).rotateX(-Math.PI / 2).translate(0, 0.72, 0)
  return mergeGeometries([softNormals(a), softNormals(b), top], true)
})()
const trayGeo = new THREE.PlaneGeometry(BENCH.trayW, BENCH.trayL).rotateX(-Math.PI / 2).translate(0, 0.03, 0)

const crossGeo = (w: number, h: number) =>
  mergeGeometries([softNormals(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0)), softNormals(new THREE.PlaneGeometry(w, h).rotateY(Math.PI / 2).translate(0, h / 2, 0))])

function leafMat(map: THREE.Texture) {
  return new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.72, envMapIntensity: 0.7 })
}

function inst(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], list: THREE.Matrix4[], cast = false) {
  const m = new THREE.InstancedMesh(geo, mat, list.length)
  list.forEach((x, i) => m.setMatrixAt(i, x))
  m.castShadow = cast
  m.receiveShadow = true
  m.computeBoundingSphere()
  return m
}

/** Uzoqdan ko'rinish uchun "gilam" teksturasi: bitta kasseta (to'q fon + ko'chatlar tepadan), takrorlanadi. */
function carpetTexture(top: THREE.Texture) {
  const src = top.image as HTMLCanvasElement
  const c = document.createElement('canvas')
  c.width = 128
  c.height = Math.round((128 * BENCH.trayL) / BENCH.trayW)
  const g = c.getContext('2d')!
  g.fillStyle = '#2b3034'
  g.fillRect(0, 0, c.width, c.height)
  const pad = (TOP_PAD / (BENCH.trayW + 2 * TOP_PAD)) * src.width
  g.drawImage(src, pad, pad, src.width - 2 * pad, src.height - 2 * pad, 0, 0, c.width, c.height)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

/** Stellaj/to'shak bo'yicha bitta tekislik, UV kasseta soniga teng (tekstura har kassetada takrorlanadi). */
function bedPlane(x: number, y: number, z: number, along: number) {
  const g = new THREE.PlaneGeometry(BENCH.w - 0.12, along * BENCH.stepZ).rotateX(-Math.PI / 2)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * BENCH.across, uv.getY(i) * along)
  return g.translate(x, y, z)
}

type Block = { m: THREE.Matrix4; beds: { x: number; y: number; z: number; along: number }[] }

/** Bloklar: 3 bino (har birida 12 stellaj) + setkali maydon (9 to'shak). Koordinatalar blok ichida. */
const BLOCKS: Block[] = [
  ...houseMats.map((m) => ({
    m,
    beds: spanCenters.flatMap((cx) => benchOffsets.map((ox) => ({ x: cx + ox, y: BENCH.h + 0.03, z: BENCH.z0 + (BENCH.along * BENCH.stepZ) / 2, along: BENCH.along }))),
  })),
  { m: new THREE.Matrix4(), beds: Array.from({ length: 9 }, (_, b) => ({ x: SHADE.x0 + 2.2 + b * 2.7, y: 0.18, z: SHADE.z0 + 1.5 + (44 * BENCH.stepZ) / 2, along: 44 })) },
]

function Seedlings({ c }: { c: Crop }) {
  const blocks = useMemo(() => {
    const r = rnd(7)
    const t = cropTextures(c)
    const side = leafMat(t.side)
    const top = leafMat(t.top)
    // alphaTest + ikki tomon: barg materiallari bilan bitta shader dasturi
    const tray = new THREE.MeshStandardMaterial({ map: trayTexture(c.cells ?? 72), roughness: 0.6, alphaTest: 0.5, side: THREE.DoubleSide })
    const carpet = new THREE.MeshStandardMaterial({ map: carpetTexture(t.top), roughness: 0.85, alphaTest: 0.01, side: THREE.DoubleSide }) // kyorpa bilan bir shader
    const pallet = new THREE.BoxGeometry(1.9, 0.15, 24.2)
    return BLOCKS.map((b, bi) => {
      const g = new THREE.Group()
      g.applyMatrix4(b.m)
      // Yaqindan: har kasseta alohida (instancing)
      const trays: THREE.Matrix4[] = []
      const plants: THREE.Matrix4[] = []
      for (const bed of b.beds)
        for (let i = 0; i < BENCH.across; i++)
          for (let k = 0; k < bed.along; k++) {
            const x = bed.x - 0.75 + i * BENCH.stepX
            const z = bed.z - (bed.along * BENCH.stepZ) / 2 + 0.2725 + k * BENCH.stepZ
            trays.push(new THREE.Matrix4().makeTranslation(x, bed.y, z))
            plants.push(new THREE.Matrix4().compose(_p.set(x, bed.y + 0.03, z), _q.setFromAxisAngle(UP, r() > 0.5 ? Math.PI : 0), _s.set(1, c.height * (0.85 + r() * 0.3), 1)))
          }
      const detail = new THREE.Group()
      detail.add(inst(trayGeo, tray, trays), inst(canopyGeo, [side, side, top], plants))
      // Uzoqdan: har stellaj bitta tekislik
      const far = new THREE.Mesh(mergeGeometries(b.beds.map((d) => bedPlane(d.x, d.y + 0.03 + 0.62 * c.height, d.z, d.along))), carpet)
      far.receiveShadow = true
      g.add(detail, far)
      if (bi === BLOCKS.length - 1) {
        // Setkali maydondagi to'shak tagliklari
        const pm = new THREE.Mesh(mergeGeometries(b.beds.map((d) => pallet.clone().translate(d.x, 0.075, d.z))), M.concrete)
        pm.receiveShadow = true
        g.add(pm)
      }
      return { g, detail, far }
    })
  }, [c])

  useFrame(() => {
    blocks.forEach((b, i) => {
      b.detail.visible = near[i]
      b.far.visible = !near[i]
    })
  })

  useEffect(
    () => () => {
      for (const b of blocks) b.g.traverse((o) => (o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).dispose())
    },
    [blocks],
  )
  return (
    <>
      {blocks.map((b, i) => (
        <primitive key={i} object={b.g} />
      ))}
    </>
  )
}

function Production({ c }: { c: Crop }) {
  const houses = useMemo(() => {
    const r = rnd(11)
    const mat = leafMat(cropTextures(c).tall!)
    const z0 = BENCH.z0
    const plants: THREE.Matrix4[] = []
    const parts: THREE.BufferGeometry[] = []
    const add = (x: number, y: number, z: number) => plants.push(new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromAxisAngle(UP, r() * Math.PI), _s.setScalar(1).setY(0.92 + r() * 0.16)))
    let geo: THREE.BufferGeometry
    if (c.leaf === 'strawberry') {
      // Baland tarnovlar (1.1 m) — fotosuratdagi qulupnay tizimi
      const offs = [-3.2, -1.6, 0, 1.6, 3.2]
      for (const cx of spanCenters)
        for (const o of offs) {
          parts.push(new THREE.BoxGeometry(0.3, 0.18, BENCH.l).translate(cx + o, 1.1, z0 + BENCH.l / 2))
          for (let z = z0 + 1; z < z0 + BENCH.l; z += 3.5) parts.push(new THREE.BoxGeometry(0.04, 1.02, 0.04).translate(cx + o, 0.5, z))
          for (let z = z0 + 0.2; z < z0 + BENCH.l; z += 0.22) add(cx + o + (r() - 0.5) * 0.06, 0.94, z)
        }
      geo = crossGeo(0.45, 0.56)
    } else {
      // Ikki qatorli ekish, substrat matlar (oq) va 3 m balandlikdagi sim
      for (const cx of spanCenters)
        for (const o of [-3.0, -2.4, -0.3, 0.3, 2.4, 3.0]) {
          parts.push(new THREE.BoxGeometry(0.2, 0.1, BENCH.l).translate(cx + o, 0.05, z0 + BENCH.l / 2))
          parts.push(new THREE.CylinderGeometry(0.006, 0.006, BENCH.l, 3, 1, true).rotateX(Math.PI / 2).translate(cx + o, 3.0, z0 + BENCH.l / 2))
          for (let z = z0 + 0.25; z < z0 + BENCH.l; z += 0.5) add(cx + o, 0.1, z)
        }
      geo = crossGeo(0.8, c.height)
    }
    const struct = mergeGeometries(parts.map((p) => p.toNonIndexed()))
    // Har bino alohida guruh: kadrdan tashqaridagi bino umuman chizilmaydi
    return houseMats.map((hm) => {
      const g = new THREE.Group()
      g.applyMatrix4(hm)
      const s = new THREE.Mesh(struct, M.slab)
      s.receiveShadow = true
      g.add(inst(geo, mat, plants, Q.plantShadow && c.leaf !== 'strawberry'), s)
      return g
    })
  }, [c])
  return (
    <>
      {houses.map((g, i) => (
        <primitive key={i} object={g} />
      ))}
    </>
  )
}

export function Crops() {
  const c = useStore((s) => crop(s))
  return c.mode === 'kochat' ? <Seedlings c={c} /> : <Production c={c} />
}

// spanCenters/SW izchilligini tekshirish: 3 gumbaz binoni to'liq qoplaydi
console.assert(Math.abs(spanCenters[2] + SW / 2 - 13) < 1e-6, 'layout')
