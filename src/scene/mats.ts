import './loadwatch' // birinchi bo'lib: teksturalar so'ralishidan oldin
import * as THREE from 'three'
import { patternTexture } from './sprites'
import { Q } from './quality'

/** Poly Haven PBR teksturalari (uzgrow loyihasidan, CC0). 1 UV birlik = 1 m bo'lgan geometriyaga mo'ljallangan. */
const loader = new THREE.TextureLoader()

function tex(path: string, srgb: boolean, size: number) {
  const t = loader.load(path.replace('.webp', `${Q.tex}.webp`))
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 8
  t.repeat.set(1 / size, 1 / size)
  return t
}

function pbr(name: string, size: number, color = '#ffffff', extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    map: tex(`/textures/${name}_diff.webp`, true, size),
    normalMap: tex(`/textures/${name}_nor.webp`, false, size),
    roughnessMap: tex(`/textures/${name}_rough.webp`, false, size),
    color,
    ...extra,
  })
}

/** Geometriya UV'larini metrga o'tkazadi (tekstura o'lchami haqiqiy bo'lsin). */
export function meterUV(geo: THREE.BufferGeometry, axes: 'xz' | 'xy' | 'zy' = 'xz') {
  const p = geo.attributes.position
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = axes === 'zy' ? p.getZ(i) : p.getX(i)
    uv[i * 2 + 1] = axes === 'xz' ? p.getZ(i) : p.getY(i)
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

function pattern(kind: Parameters<typeof patternTexture>[0], repeat: number) {
  const t = patternTexture(kind)
  t.repeat.set(repeat, repeat)
  return t
}

// Bir xil "turdagi" materiallar bitta shader dasturini bo'lishadi (kompilyatsiya — kuchsiz kartada eng sekin joy).
// Shuning uchun xaritasiz materiallarga ham kerak bo'lsa oq xarita beriladi, shaffoflik faqat zarur joyda.
export const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
WHITE.colorSpace = THREE.SRGBColorSpace
WHITE.needsUpdate = true

export const M = {
  // --- oddiy (xaritasiz, shaffof emas): bitta dastur ---
  steel: new THREE.MeshStandardMaterial({ color: '#b9bec2', metalness: 0.75, roughness: 0.38 }),
  steelDark: new THREE.MeshStandardMaterial({ color: '#7d858b', metalness: 0.6, roughness: 0.5 }),
  white: new THREE.MeshStandardMaterial({ color: '#eef0ee', roughness: 0.55 }),
  duct: new THREE.MeshStandardMaterial({ color: '#f3f1e8', roughness: 0.7 }),
  yellow: new THREE.MeshStandardMaterial({ color: '#f2b51d', roughness: 0.5, metalness: 0.2 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2b3034', roughness: 0.7 }),
  glass: new THREE.MeshStandardMaterial({ color: '#2d4250', roughness: 0.08, metalness: 0.6 }),
  slab: new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.65 }),
  groundCover: new THREE.MeshStandardMaterial({ color: '#2a2d2c', roughness: 0.95 }),

  // --- shaffof plyonka va to'r: bitta dastur ---
  // Plyonka: 200 mk, sut rangiga moyil (nurni sochadi). Soya tashlamaydi.
  film: new THREE.MeshStandardMaterial({ color: '#eaf3f5', transparent: true, opacity: 0.26, roughness: 0.25, metalness: 0, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.4 }),
  // Hasharot to'ri (50 mesh)
  net: new THREE.MeshStandardMaterial({ color: '#dfe5e2', transparent: true, opacity: 0.32, roughness: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  // Soyabon setka (50–60%): yarim shaffof — uzoqdan ham ichidagi ko'chat ko'rinadi
  shade: new THREE.MeshStandardMaterial({ color: '#1f3b2b', transparent: true, opacity: 0.62, roughness: 0.95, side: THREE.DoubleSide, depthWrite: false }),

  // --- naqshli (xarita + alphaTest, ikki tomonli): kyorpa, panjara, uzoqdagi ko'chat gilami — bitta dastur ---
  // Termo-parda (kyorpa) — alyuminiyli yo'l-yo'l mato
  screen: new THREE.MeshStandardMaterial({ map: pattern('screen', 1.5), color: '#ffffff', alphaTest: 0.01, metalness: 0.35, roughness: 0.45, side: THREE.DoubleSide }),
  benchGrid: new THREE.MeshStandardMaterial({ map: pattern('grid', 12), color: '#ffffff', alphaTest: 0.4, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide }),
  fence: new THREE.MeshStandardMaterial({ map: pattern('fence', 6), color: '#ffffff', alphaTest: 0.4, metalness: 0.4, roughness: 0.6, side: THREE.DoubleSide }),

  // --- PBR teksturali (rang + normal + g'adir-budurlik xaritasi): bitta dastur ---
  concrete: pbr('concrete', 2.2, '#d9d6cf'),
  gravel: pbr('gravel', 2, '#b3aa9b'),
  grass: pbr('grass', 3, '#b7c28f'),
  furrows: pbr('furrows', 4, '#cdb79a'),
  corrugated: new THREE.MeshStandardMaterial({
    map: WHITE,
    normalMap: tex('/textures/corrugated_nor.webp', false, 0.9),
    roughnessMap: tex('/textures/corrugated_rough.webp', false, 0.9),
    color: '#e4e7e6',
    metalness: 0.2,
    roughness: 0.7,
  }),
  roofGreen: new THREE.MeshStandardMaterial({
    map: WHITE,
    normalMap: tex('/textures/corrugated_nor.webp', false, 1.35),
    roughnessMap: tex('/textures/corrugated_rough.webp', false, 1.35),
    color: '#2f6f55',
    metalness: 0.45,
    roughness: 0.6,
  }),
}
