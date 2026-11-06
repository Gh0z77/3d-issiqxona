import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ARCH_R, BENCH, GH, HOUSES, SW, archY, benchOffsets, spanCenters } from './layout'
import { M, WHITE, meterUV } from './mats'
import { near } from './lod'
import { get } from '../store'

const HL = GH.L / 2
const gutterXs = Array.from({ length: GH.SPANS + 1 }, (_, i) => -GH.W / 2 + i * SW)
const bayZs = Array.from({ length: GH.L / GH.BAY + 1 }, (_, i) => -HL + i * GH.BAY)
const ROLL = { bottom: 0.45, top: 2.2 } // yon parda ochiladigan oraliq

const _q = new THREE.Quaternion()
const _s = new THREE.Vector3(1, 1, 1)
const _p = new THREE.Vector3()
const Y = new THREE.Vector3(0, 1, 0)
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const T = (x: number, y: number, z: number, ry = 0) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromAxisAngle(Y, ry), _s)
const houseMat = (h: (typeof HOUSES)[number]) => T(h.x, 0, h.z, h.rot)

/** a → b ingichka quvur (silindr). */
function strut(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 5) {
  const d = b.clone().sub(a)
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg, 1, true)
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()), _s))
  return g
}

/** Bitta gumbazning ark profili (markaz 0). */
const archPts = (n = 24) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const dx = -SW / 2 + (SW * i) / n
    return new THREE.Vector3(dx, archY(dx), 0)
  })

/** Tom plyonkasi: arklar orasida yengil "yostiqcha" (shamol bosimidan). */
function roofGeo() {
  const nx = 18
  const nz = 40
  const pos: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const dx = -SW / 2 + (SW * i) / nx
      const z = -HL + (GH.L * j) / nz
      const sag = 0.07 * Math.sin(Math.PI * (((z + HL) / GH.BAY) % 1))
      pos.push(dx * (1 - sag / ARCH_R), archY(dx) - sag * 0.6, z)
    }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i
      idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Old/orqa devor: 3 gumbaz silueti, old tomonda darvoza teshigi. */
function endWallGeo(door: boolean) {
  const s = new THREE.Shape()
  s.moveTo(-GH.W / 2, 0)
  s.lineTo(GH.W / 2, 0)
  for (let k = GH.SPANS - 1; k >= 0; k--) for (const p of archPts(16).reverse()) s.lineTo(spanCenters[k] + p.x, p.y)
  s.closePath()
  if (door) {
    const h = new THREE.Path()
    h.moveTo(-1.6, 0)
    h.lineTo(-1.6, 3)
    h.lineTo(1.6, 3)
    h.lineTo(1.6, 0)
    h.closePath()
    s.holes.push(h)
  }
  return new THREE.ShapeGeometry(s, 8)
}

const plane = (w: number, h: number) => new THREE.PlaneGeometry(w, h)

/** Bitta binoning qimirlamaydigan qismlari, material bo'yicha (mahalliy koordinatalarda). */
function staticParts() {
  const steel: THREE.BufferGeometry[] = []
  const film: THREE.BufferGeometry[] = []
  const net: THREE.BufferGeometry[] = []
  const concrete: THREE.BufferGeometry[] = []
  const floor: THREE.BufferGeometry[] = []
  const duct: THREE.BufferGeometry[] = []
  const yellow: THREE.BufferGeometry[] = []

  // Karkas: ustunlar, ark + ferma, tarnovlar, progonlar, devor tirgaklari, darvoza ramkasi
  for (const x of gutterXs) for (const z of bayZs) steel.push(new THREE.BoxGeometry(0.1, GH.GUTTER, 0.1).translate(x, GH.GUTTER / 2, z))
  const truss = mergeGeometries([
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPts(24)), 20, 0.035, 5),
    strut(v(-SW / 2, GH.GUTTER, 0), v(SW / 2, GH.GUTTER, 0), 0.025),
    ...[-1, 1].flatMap((s) => [
      strut(v((s * SW) / 2, GH.GUTTER, 0), v((s * SW) / 5, archY(SW / 5), 0), 0.018, 4),
      strut(v((s * SW) / 5, GH.GUTTER, 0), v((s * SW) / 5, archY(SW / 5), 0), 0.018, 4),
      strut(v((s * SW) / 5, GH.GUTTER, 0), v(0, archY(0), 0), 0.018, 4),
    ]),
  ])
  for (const cx of spanCenters) for (const z of bayZs) steel.push(truss.clone().translate(cx, 0, z))
  for (const x of gutterXs) steel.push(new THREE.BoxGeometry(0.28, 0.16, GH.L).translate(x, GH.GUTTER + 0.02, 0))
  for (const cx of spanCenters) for (const dx of [-SW * 0.28, 0, SW * 0.28]) steel.push(strut(v(cx + dx, archY(dx) - 0.03, -HL), v(cx + dx, archY(dx) - 0.03, HL), 0.022))
  for (const x of [-GH.W / 2, GH.W / 2]) for (const y of [ROLL.bottom, ROLL.top]) steel.push(strut(v(x, y, -HL), v(x, y, HL), 0.025))
  for (const z of [-HL, HL])
    for (const cx of spanCenters)
      for (const dx of [-SW / 4, SW / 4]) {
        if (z === HL && cx === spanCenters[1]) continue
        steel.push(new THREE.BoxGeometry(0.06, archY(dx), 0.06).translate(cx + dx, archY(dx) / 2, z))
      }
  steel.push(new THREE.BoxGeometry(0.1, 3.05, 0.1).translate(-1.62, 1.52, HL), new THREE.BoxGeometry(0.1, 3.05, 0.1).translate(1.62, 1.52, HL), new THREE.BoxGeometry(3.34, 0.1, 0.1).translate(0, 3.02, HL))
  // Sug'orish aravasi relslari
  for (const cx of spanCenters) for (const d of [-0.25, 0.25]) steel.push(strut(v(cx + d, 2.95, -HL + 0.5), v(cx + d, 2.95, HL - 0.5), 0.02, 4))

  // Qoplama: tom, old/orqa devor, yon devor tepasi (qotirilgan), hasharot to'ri
  const roof = roofGeo()
  for (const cx of spanCenters) film.push(roof.clone().translate(cx, 0, 0))
  film.push(endWallGeo(false).translate(0, 0, -HL), endWallGeo(true).translate(0, 0, HL))
  for (const s of [-1, 1]) {
    const x = (s * GH.W) / 2
    film.push(plane(GH.L, GH.GUTTER - ROLL.top).rotateY(Math.PI / 2).translate(x, (GH.GUTTER + ROLL.top) / 2, 0))
    net.push(plane(GH.L, ROLL.top - ROLL.bottom).rotateY(Math.PI / 2).translate(x - s * 0.05, (ROLL.top + ROLL.bottom) / 2, 0))
    concrete.push(meterUV(new THREE.BoxGeometry(0.2, ROLL.bottom, GH.L).translate(x, ROLL.bottom / 2, 0), 'zy'))
  }

  // Pol: qora gilam (agrotekstil), darvoza oldida beton yo'lak
  floor.push(plane(GH.W, GH.L - 3).rotateX(-Math.PI / 2).translate(0, 0.005, -1.5))
  concrete.push(meterUV(plane(GH.W, 3).rotateX(-Math.PI / 2).translate(0, 0.01, HL - 1.5)))

  // Isitish: har gumbazda zaxira havo isitgichi + perforatsiyali havo yengi
  for (const cx of spanCenters) {
    duct.push(new THREE.CylinderGeometry(0.22, 0.22, GH.L - 4, 12, 1, true).rotateX(Math.PI / 2).translate(cx, 0.3, -1))
    yellow.push(new THREE.BoxGeometry(0.9, 1.1, 1.3).translate(cx, 0.75, -HL + 0.9), new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8).translate(cx + 0.25, 2.2, -HL + 0.6))
  }
  return { steel, film, net, concrete, floor, duct, yellow }
}

/** Uchala binoning qimirlamaydigan qismlari — har material uchun BITTA mesh (kam draw call). */
function buildStatic() {
  const parts = staticParts()
  const g = new THREE.Group()
  const mats: Record<keyof typeof parts, [THREE.Material, boolean]> = {
    steel: [M.steel, true],
    film: [M.film, false],
    net: [M.net, false],
    concrete: [M.concrete, true],
    floor: [M.groundCover, false],
    duct: [M.duct, false],
    yellow: [M.yellow, true],
  }
  for (const key of Object.keys(parts) as (keyof typeof parts)[]) {
    const local = mergeGeometries(parts[key])
    const all = mergeGeometries(HOUSES.map((h) => local.clone().applyMatrix4(houseMat(h))))
    const m = new THREE.Mesh(all, mats[key][0])
    m.castShadow = mats[key][1]
    m.receiveShadow = key !== 'film' && key !== 'net'
    if (key === 'film' || key === 'net') m.renderOrder = 2
    g.add(m)
  }
  return g
}

/** Yuradigan stellajlar (uchala bino) — 2 ta InstancedMesh. Ko'chat rejimida ko'rinadi. */
function buildBenches() {
  const g = new THREE.Group()
  const at: THREE.Matrix4[] = []
  for (const h of HOUSES) for (const cx of spanCenters) for (const ox of benchOffsets) at.push(houseMat(h).multiply(T(cx + ox, 0, BENCH.z0 + BENCH.l / 2)))
  const top = meterUV(plane(BENCH.w, BENCH.l).rotateX(-Math.PI / 2).translate(0, BENCH.h, 0))
  const rim = mergeGeometries([
    new THREE.BoxGeometry(0.04, 0.09, BENCH.l).translate(-BENCH.w / 2, BENCH.h, 0),
    new THREE.BoxGeometry(0.04, 0.09, BENCH.l).translate(BENCH.w / 2, BENCH.h, 0),
    new THREE.BoxGeometry(BENCH.w, 0.09, 0.04).translate(0, BENCH.h, -BENCH.l / 2),
    new THREE.BoxGeometry(BENCH.w, 0.09, 0.04).translate(0, BENCH.h, BENCH.l / 2),
    // stellaj ostidagi aylanuvchi quvurlar (stellaj shu quvurlarda yonga suriladi)
    ...[-0.45, 0.45].map((x) => new THREE.CylinderGeometry(0.024, 0.024, BENCH.l, 6, 1, true).rotateX(Math.PI / 2).translate(x, BENCH.h - 0.12, 0)),
    // oyoqlar har 3.5 m da
    ...Array.from({ length: 11 }, (_, i) => -BENCH.l / 2 + 0.3 + i * 3.54).flatMap((z) => [
      new THREE.BoxGeometry(0.04, BENCH.h - 0.14, 0.04).translate(-0.45, (BENCH.h - 0.14) / 2, z),
      new THREE.BoxGeometry(0.04, BENCH.h - 0.14, 0.04).translate(0.45, (BENCH.h - 0.14) / 2, z),
      new THREE.BoxGeometry(BENCH.w, 0.04, 0.04).translate(0, BENCH.h - 0.05, z),
    ]),
  ])
  // Instansli po'lat: oq xarita + alphaTest bilan barg/kasseta shaderi bilan bir dastur (kompilyatsiya kamroq)
  const rimMat = new THREE.MeshStandardMaterial({ map: WHITE, color: M.steel.color, metalness: M.steel.metalness, roughness: M.steel.roughness, alphaTest: 0.5, side: THREE.DoubleSide })
  for (const [geo, mat, cast] of [
    [top, M.benchGrid, false],
    [rim, rimMat, true],
  ] as const) {
    const m = new THREE.InstancedMesh(geo, mat, at.length)
    at.forEach((x, i) => m.setMatrixAt(i, x))
    m.castShadow = cast
    m.receiveShadow = true
    m.computeBoundingSphere()
    g.add(m)
  }
  return g
}

/** Qimirlaydigan qismlar (har bino uchun): kyorpa, yon parda, sug'orish aravasi. */
function buildMoving(h: (typeof HOUSES)[number]) {
  const g = new THREE.Group()
  g.applyMatrix4(houseMat(h))
  const screens: THREE.Mesh[] = []
  const rolls: { sheet: THREE.Object3D; tube: THREE.Object3D }[] = []
  const booms: THREE.Object3D[] = []

  // Termo-parda (kyorpa): har gumbazda, chap tarnovga yig'iladi (scale.x)
  const scGeo = meterUV(plane(SW - 0.1, GH.L - 0.4).rotateX(-Math.PI / 2).translate((SW - 0.1) / 2, 0, 0))
  for (const cx of spanCenters) {
    const sc = new THREE.Mesh(scGeo, M.screen)
    sc.position.set(cx - SW / 2 + 0.05, GH.GUTTER - 0.12, 0)
    sc.scale.x = 0.05
    screens.push(sc)
    g.add(sc)
  }
  // Yon parda: pastki chetidan yuqoriga o'raladi
  const sheetGeo = plane(GH.L, ROLL.top - ROLL.bottom).translate(0, -(ROLL.top - ROLL.bottom) / 2, 0).rotateY(Math.PI / 2)
  const tubeGeo = new THREE.CylinderGeometry(0.05, 0.05, GH.L, 6, 1, true).rotateX(Math.PI / 2)
  for (const s of [-1, 1]) {
    const roll = new THREE.Group()
    roll.position.set((s * GH.W) / 2 + s * 0.06, ROLL.top, 0)
    const sheet = new THREE.Mesh(sheetGeo, M.film)
    sheet.renderOrder = 2
    const tube = new THREE.Mesh(tubeGeo, M.white)
    roll.add(sheet, tube)
    rolls.push({ sheet, tube })
    g.add(roll)
  }
  // Sug'orish aravasi: bitta geometriya (arava + osma + quvur + 15 forsunka)
  const boomGeo = mergeGeometries(
    [
      new THREE.BoxGeometry(0.7, 0.35, 0.6).translate(0, 2.75, 0),
      new THREE.BoxGeometry(0.06, 0.6, 0.06).translate(0, 2.3, 0),
      new THREE.CylinderGeometry(0.035, 0.035, SW - 0.6, 6, 1, true).rotateZ(Math.PI / 2).translate(0, 2.0, 0),
      ...Array.from({ length: 15 }, (_, i) => new THREE.CylinderGeometry(0.02, 0.012, 0.07, 5).translate(-SW / 2 + 0.4 + (i * (SW - 0.8)) / 14, 1.95, 0)),
    ].map((x) => x.toNonIndexed()),
  )
  for (const cx of spanCenters) {
    const boom = new THREE.Group()
    boom.position.x = cx
    boom.add(new THREE.Mesh(boomGeo, M.dark), makeSpray())
    booms.push(boom)
    g.add(boom)
  }
  return { g, screens, rolls, booms }
}

/** Suv purkash: boom ostida tushayotgan tomchilar (faqat yaqin binoda hisoblanadi). */
function makeSpray() {
  const N = 150
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
  const pts = new THREE.Points(geo, sprayMat)
  pts.frustumCulled = false
  pts.userData.seed = Float32Array.from({ length: N }, () => Math.random())
  return pts
}
const sprayMat = new THREE.PointsMaterial({ color: '#cfe9ff', size: 0.035, transparent: true, opacity: 0.8, depthWrite: false })

/** Hozir biror narsa harakatlanyaptimi — Scene shunga qarab keyingi kadrni so'raydi. */
export const motion = { busy: false }

export function Greenhouses() {
  const { stat, benches, moving, rig } = useMemo(() => {
    return { stat: buildStatic(), benches: buildBenches(), moving: HOUSES.map(buildMoving), rig: { kyorpa: 0, sides: 1 } }
  }, [])

  useFrame((state, dt) => {
    const s = get()
    const t = state.clock.elapsedTime
    const k = 1 - Math.exp(-2.2 * Math.min(dt, 0.1))
    const tk = s.kyorpa ? 1 : 0
    const ts = s.sides ? 1 : 0
    rig.kyorpa = Math.abs(tk - rig.kyorpa) < 0.002 ? tk : rig.kyorpa + (tk - rig.kyorpa) * k
    rig.sides = Math.abs(ts - rig.sides) < 0.002 ? ts : rig.sides + (ts - rig.sides) * k
    const kochat = s.cropId.endsWith('-k')
    benches.visible = kochat
    M.film.opacity = s.xray ? 0.07 : 0.26
    let busy = rig.kyorpa !== tk || rig.sides !== ts

    moving.forEach((h, hi) => {
      for (const sc of h.screens) sc.scale.x = 0.05 + 0.95 * rig.kyorpa
      for (const r of h.rolls) {
        r.sheet.scale.y = Math.max(0.02, 1 - rig.sides)
        r.tube.position.y = -(ROLL.top - ROLL.bottom) * (1 - rig.sides)
      }
      // Arava va purkagich faqat kamera yaqin turgan binoda (uzoqdan baribir ko'rinmaydi)
      const show = kochat && near[hi]
      h.booms.forEach((b, bi) => {
        b.visible = show
        if (!show) return
        const spray = b.children[1] as THREE.Points
        spray.visible = s.water
        if (!s.water) return
        busy = true
        b.position.z = Math.sin(t * 0.045 + hi * 2.2 + bi * 1.3) * 17 - 1
        const pos = spray.geometry.attributes.position as THREE.BufferAttribute
        const seed = spray.userData.seed as Float32Array
        for (let i = 0; i < seed.length; i++) {
          const f = (t * 1.6 + seed[i] * 7) % 1
          pos.setXYZ(i, -SW / 2 + 0.4 + ((i % 15) * (SW - 0.8)) / 14 + (seed[(i * 7) % seed.length] - 0.5) * 0.35 * f, 1.9 - f * 0.95, (seed[(i * 13) % seed.length] - 0.5) * 0.3 * f)
        }
        pos.needsUpdate = true
      })
    })
    motion.busy = busy
  })

  return (
    <>
      <primitive object={stat} />
      <primitive object={benches} />
      {moving.map((h, i) => (
        <primitive key={i} object={h.g} />
      ))}
    </>
  )
}
