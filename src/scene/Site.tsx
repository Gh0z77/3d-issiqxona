import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { HOUSES, PLOT, SERVICE, SHADE, TANK } from './layout'
import { M, meterUV } from './mats'
import { Q } from './quality'
import { crop, goView, useStore, type View } from '../store'
import { HOUSE } from '../data/crops'

const UP = new THREE.Vector3(0, 1, 0)

function plane(w: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(meterUV(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, y, z)), mat)
  m.receiveShadow = true
  return m
}

/** Terak (uzgrow loyihasidagi suratdan): ikki ko'rinish kesishgan tekislikda. */
function trees(spots: [number, number, number][]) {
  const map = new THREE.TextureLoader().load('/foliage/poplar.webp')
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  const mk = (u0: number, rot: number) => {
    const g = new THREE.PlaneGeometry(5.9, 16.2).translate(0, 8.1, 0)
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * 0.5)
    return g.rotateY(rot)
  }
  const geo = mergeGeometries([mk(0, 0), mk(0.5, Math.PI / 2)])
  const mat = new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 })
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45 })
  const m = new THREE.InstancedMesh(geo, mat, spots.length)
  m.customDepthMaterial = depth
  const q = new THREE.Quaternion()
  spots.forEach(([x, z, s], i) => m.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(UP, (i * 2.39) % 6.28), new THREE.Vector3(s, s, s))))
  m.castShadow = true
  m.receiveShadow = true
  m.computeBoundingSphere()
  return m
}

function build() {
  const g = new THREE.Group()
  const hw = PLOT.w / 2
  const hl = PLOT.l / 2

  // Yer: atrofi o't, g'arb va shimolda haydalgan dalalar, maydon ichi shag'al
  g.add(plane(1400, 1400, M.grass, 0, 0, 0))
  g.add(plane(160, 260, M.furrows, -hw - 95, 0.01, 0), plane(130, 120, M.furrows, -10, 0.012, -hl - 75), plane(130, 120, M.furrows, -20, 0.012, hl + 72))
  g.add(plane(PLOT.w, PLOT.l, M.gravel, 0, 0.02, 0))
  // Sharqdagi asfalt yo'l va kirish
  g.add(plane(8, 900, M.concrete, hw + 9, 0.025, 0), plane(10, 7, M.concrete, hw + 2.5, 0.03, -1))

  // Panjara: ustunlar har 3 m da, sharqda 7 m darvoza
  const posts: THREE.BufferGeometry[] = []
  const nets: THREE.BufferGeometry[] = []
  const side = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(1, Math.round(len / 3))
    for (let i = 0; i <= n; i++) posts.push(new THREE.CylinderGeometry(0.04, 0.04, 2.1, 6).translate(x0 + ((x1 - x0) * i) / n, 1.05, z0 + ((z1 - z0) * i) / n))
    const p = new THREE.PlaneGeometry(len, 2).translate(len / 2, 1, 0)
    meterUV(p, 'xy')
    p.rotateY(-Math.atan2(z1 - z0, x1 - x0)).translate(x0, 0, z0)
    nets.push(p)
  }
  side(-hw, -hl, hw, -hl)
  side(hw, -hl, hw, -4.5)
  side(hw, 2.5, hw, hl)
  side(hw, hl, -hw, hl)
  side(-hw, hl, -hw, -hl)
  const pm = new THREE.Mesh(mergeGeometries(posts), M.steelDark)
  pm.castShadow = true
  g.add(pm, new THREE.Mesh(mergeGeometries(nets), M.fence))

  // Setkali chiniqtirish maydoni: ustunlar, tepasi va yonlari soyabon setka (50–60%)
  const sp: THREE.BufferGeometry[] = []
  const sx = 7
  const sz = 7
  for (let i = 0; i < sx; i++)
    for (let j = 0; j < sz; j++) sp.push(new THREE.CylinderGeometry(0.05, 0.05, SHADE.h, 6).translate(SHADE.x0 + ((SHADE.x1 - SHADE.x0) * i) / (sx - 1), SHADE.h / 2, SHADE.z0 + ((SHADE.z1 - SHADE.z0) * j) / (sz - 1)))
  const spm = new THREE.Mesh(mergeGeometries(sp), M.steel)
  spm.castShadow = true
  const sw = SHADE.x1 - SHADE.x0
  const sd = SHADE.z1 - SHADE.z0
  const roof = plane(sw, sd, M.shade, (SHADE.x0 + SHADE.x1) / 2, SHADE.h, (SHADE.z0 + SHADE.z1) / 2)
  roof.castShadow = true
  const walls = [
    new THREE.PlaneGeometry(sw, SHADE.h - 0.6).translate((SHADE.x0 + SHADE.x1) / 2, SHADE.h / 2 + 0.3, SHADE.z0),
    new THREE.PlaneGeometry(sw, SHADE.h - 0.6).translate((SHADE.x0 + SHADE.x1) / 2, SHADE.h / 2 + 0.3, SHADE.z1),
    new THREE.PlaneGeometry(sd, SHADE.h - 0.6).rotateY(Math.PI / 2).translate(SHADE.x1, SHADE.h / 2 + 0.3, (SHADE.z0 + SHADE.z1) / 2),
  ].map((p) => meterUV(p, 'xy'))
  g.add(spm, roof, new THREE.Mesh(mergeGeometries(walls), M.shade))

  // Xizmat binosi: unib chiqish xonasi (issiq, 25–28°C), ombor, osmos filtr
  const S = SERVICE
  const wallGeo = mergeGeometries([
    meterUV(new THREE.PlaneGeometry(S.w, S.h).translate(S.x, S.h / 2, S.z + S.d / 2), 'xy'),
    meterUV(new THREE.PlaneGeometry(S.w, S.h).rotateY(Math.PI).translate(S.x, S.h / 2, S.z - S.d / 2), 'xy'),
    meterUV(new THREE.PlaneGeometry(S.d, S.h).rotateY(Math.PI / 2).translate(S.x + S.w / 2, S.h / 2, S.z), 'xy'),
    meterUV(new THREE.PlaneGeometry(S.d, S.h).rotateY(-Math.PI / 2).translate(S.x - S.w / 2, S.h / 2, S.z), 'xy'),
  ])
  const walls2 = new THREE.Mesh(wallGeo, M.corrugated)
  walls2.castShadow = walls2.receiveShadow = true
  const roof2 = new THREE.Mesh(meterUV(new THREE.BoxGeometry(S.w + 0.6, 0.12, S.d + 0.6)), M.roofGreen)
  roof2.position.set(S.x, S.h + 0.25, S.z)
  roof2.rotation.x = 0.06
  roof2.castShadow = true
  const door = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.1), M.steelDark)
  door.position.set(S.x - 3, 1.5, S.z - S.d / 2 - 0.02)
  const wins = new THREE.Mesh(mergeGeometries([1.5, 5].map((dx) => new THREE.BoxGeometry(1.6, 1, 0.08).translate(S.x + dx, 2.2, S.z - S.d / 2 - 0.02))), M.glass)
  g.add(walls2, roof2, door, wins)

  // Suv hovuzi (bak) va nasos
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(TANK.r, TANK.r, TANK.h, 40, 1, true).translate(TANK.x, TANK.h / 2, TANK.z), M.corrugated)
  const lid = new THREE.Mesh(new THREE.ConeGeometry(TANK.r + 0.1, 0.8, 40).translate(TANK.x, TANK.h + 0.4, TANK.z), M.white)
  const pump = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1).translate(TANK.x - 4.2, 0.5, TANK.z + 1), M.steelDark)
  for (const m of [tank, lid, pump]) m.castShadow = m.receiveShadow = true
  g.add(tank, lid, pump)

  // Qo'shni katta issiqxona majmuasi (xaritada sharqda) — oddiy hajm, sahnaga miqyos beradi
  const nb = new THREE.Mesh(new THREE.BoxGeometry(70, 6, 110).translate(hw + 55, 3, -60), new THREE.MeshStandardMaterial({ color: '#dfe6e8', roughness: 0.35, metalness: 0.3 }))
  nb.castShadow = nb.receiveShadow = true
  g.add(nb)

  // Teraklar: yo'l bo'ylab va g'arbiy chegara (shamoldan himoya — "afg'on" shamoli)
  const r = (s: number) => ((Math.sin(s * 91.7) * 43758.5) % 1 + 1) % 1
  const spots: [number, number, number][] = []
  for (let z = -200; z < 200; z += 7) spots.push([hw + 15 + r(z) * 2, z + r(z + 1) * 3, 0.8 + r(z + 2) * 0.35])
  for (let z = -120; z < 120; z += 6) spots.push([-hw - 8 - r(z + 3) * 3, z + r(z + 4) * 2, 0.75 + r(z + 5) * 0.4])
  for (let x = -hw - 8; x < hw + 6; x += 8) spots.push([x + r(x) * 3, -hl - 9 - r(x + 1) * 2, 0.8 + r(x + 2) * 0.3])
  g.add(trees(Q.trees < 1 ? spots.filter((_, i) => i % 2 === 0) : spots))
  return g
}

type Pin = { at: [number, number, number]; title: string; text: string; view?: View }

const H1 = HOUSES[0]
const PINS: Pin[] = [
  { at: [H1.x + 1.2, 1.25, H1.z + 4], title: 'Yuradigan stellajlar', text: 'Har binoda 12 ta, 1.8×36 m. Foydali maydon 75% — oddiy stellajda 60%.', view: 'stellaj' },
  { at: [H1.x + 7, 2.35, H1.z - 3], title: 'Sug‘orish aravasi', text: 'Relsda yuradi, har kassetani bir xil sug‘oradi. Qo‘lda sug‘orishdan 3–4 baravar tejamli.' },
  { at: [H1.x - 7, 3.4, H1.z - 8], title: 'Termo-parda (kyorpa)', text: 'Qishda issiqni ushlaydi (+5…8°C), yozda 50–60% soya beradi.' },
  { at: [H1.x - 13.2, 1.4, H1.z + 10], title: 'Yon parda + hasharot to‘ri', text: 'Yozda ochiladi. 50 mesh to‘r oqqanot va tripsni kiritmaydi.' },
  { at: [H1.x + 8.7, 1.6, H1.z - 19], title: 'Zaxira isitgich', text: '~120–150 kVt / bino. Sovuq kechada ko‘chatni saqlaydi. Havo yengi stellaj ostida.' },
  { at: [(SHADE.x0 + SHADE.x1) / 2, SHADE.h + 0.6, (SHADE.z0 + SHADE.z1) / 2], title: 'Setkali maydon', text: 'Ko‘chat sotishdan oldin shu yerda 5–7 kun chiniqtiriladi (adaptatsiya).', view: 'setka' },
  { at: [SERVICE.x, SERVICE.h + 1.2, SERVICE.z], title: 'Unib chiqish xonasi', text: '25–28°C issiq xona, ombor va osmos filtr (suv sho‘rligi EC < 1.0).' },
  { at: [TANK.x, TANK.h + 1.4, TANK.z], title: 'Suv hovuzi', text: '~90 m³ zaxira, nasos va filtr.' },
]

export function Site() {
  const group = useMemo(build, [])
  const labels = useStore((s) => s.labels)
  const c = useStore((s) => crop(s))
  const per = Math.round(HOUSE.trays * (c.cells ?? 0) * 0.88)

  return (
    <>
      <primitive object={group} />
      {labels && (
        <>
          {PINS.map((p) => (
            <Html key={p.title} position={p.at} center zIndexRange={[5, 0]} className="pin-wrap">
              <button className="pin" onClick={() => p.view && goView(p.view)}>
                <span className="pin-dot" />
                <span className="pin-card">
                  <b>{p.title}</b>
                  <span>{p.text}</span>
                </span>
              </button>
            </Html>
          ))}
          {HOUSES.map((h) => (
            <Html key={h.name} position={[h.x, 6.4, h.z]} center zIndexRange={[5, 0]} className="pin-wrap">
              <div className="house-tag">
                <b>{h.name}</b>
                <span>26×40 m · 10.4 sotix</span>
                <span>{c.mode === 'kochat' ? `${(per / 1000).toFixed(0)} ming ko‘chat / aylanish` : c.name}</span>
              </div>
            </Html>
          ))}
        </>
      )}
    </>
  )
}
