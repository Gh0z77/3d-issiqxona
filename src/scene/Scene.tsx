import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, type CameraControlsImpl } from '@react-three/drei'
import * as THREE from 'three'
import { Greenhouses, motion } from './Greenhouse'
import { Crops } from './Crops'
import { Site } from './Site'
import { updateNear } from './lod'
import { Q, tier } from './quality'
import { get, goView, subscribe, useStore, type View } from '../store'
import { setLoading } from '../loading'
import { watch } from './loadwatch'

// Quyosh: janubi-g'arbdan, 49° balandlikda (osmon suratidagi quyosh bilan bir joyda)
const Post = lazy(() => import('./Post'))
if (Q.post) void import('./Post') // effektlar paketi 3D bilan parallel yuklansin

if (import.meta.env.DEV) console.info('sifat:', tier, Q)

const SUN = new THREE.Vector3(-0.39, 0.755, 0.525).normalize()
const SKY_YAW = 0.1002 - Math.atan2(SUN.z, SUN.x) / (Math.PI * 2)

function skyMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: { tSky: { value: map }, uYaw: { value: SKY_YAW }, uFog: { value: new THREE.Color('#cfd9df') } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSky; uniform float uYaw; uniform vec3 uFog; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float u = fract(atan(d.z, d.x) * 0.15915494 + 0.5 + uYaw);
        float el = asin(clamp(d.y, -1.0, 1.0)) * 57.29578;
        float v = clamp(1.0 - (90.0 - el) / 100.8, 0.002, 0.998);
        vec3 col = texture2D(tSky, vec2(u, v)).rgb * 1.15;
        col = mix(uFog, col, smoothstep(-0.01, 0.09, d.y));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
}

/** Osmon gumbazi + undan olingan yorug'lik/aks (PMREM, bir marta). */
function Sky() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const scene = useThree((s) => s.scene)
  const mat = useMemo(() => {
    // Environment birinchi kadrdan oldin bo'lishi shart: aks holda hamma shader ikki marta kompilyatsiya bo'ladi
    // (avval environment'siz, keyin u bilan). Osmon surati kelgach xuddi shu o'lchamda qayta tayyorlanadi.
    const bake = () => {
      const sky = new THREE.Scene()
      sky.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat))
      const pm = new THREE.PMREMGenerator(gl)
      const old = scene.environment
      scene.environment = pm.fromScene(sky, 0, 0.1, 100, { size: 128 }).texture
      scene.environmentIntensity = 0.9
      old?.dispose()
      pm.dispose()
      invalidate()
    }
    const t = new THREE.TextureLoader().load(`/sky/noon${Q.tex}.webp`, bake)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.RepeatWrapping
    const mat = skyMaterial(t)
    bake()
    return mat
  }, [gl, scene, invalidate])
  return (
    <mesh material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[900, 48, 24]} />
    </mesh>
  )
}

function Lights() {
  const sun = useRef<THREE.DirectionalLight>(null!)
  useEffect(() => {
    const c = sun.current.shadow.camera
    c.left = c.bottom = -80
    c.right = c.top = 80
    c.near = 1
    c.far = 400
    c.updateProjectionMatrix()
  }, [])
  return (
    <>
      <hemisphereLight args={['#dfeaf5', '#8a7a62', 0.4]} />
      <directionalLight
        ref={sun}
        position={SUN.clone().multiplyScalar(150).toArray()}
        intensity={3.4}
        color="#fff4e2"
        castShadow
        shadow-mapSize={[Q.shadow, Q.shadow]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  )
}

// Kamera nuqtalari: [joylashuv, qarash nuqtasi]
const VIEWS: Record<View, [number, number, number, number, number, number]> = {
  umumiy: [72, 42, 88, 0, 2, -2],
  tepadan: [0, 165, 2, 0, 0, 0],
  ichkarida: [-17, 1.7, -7.2, -17, 1.1, -30],
  stellaj: [-16.95, 1.45, -9.5, -15.6, 0.75, -13.5],
  setka: [42, 9, 38, 17, 1, 16],
}

// Yer usti: kamera shu tekislikdan pastga tusha olmaydi (CameraControls to'qnashuv tekshiruvi)
const GROUND = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2).translate(0, 0.35, 0))

/**
 * Kamera: camera-controls — g'ildirak bilan silliq (inertsiyali) yaqinlashish, kursor turgan joyga qarab,
 * oldinga scroll qilib binoning ichiga "kirib borish" mumkin (infinityDolly). Ko'rinish tugmalari silliq o'tadi.
 */
function CameraRig() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as CameraControlsImpl | null
  const tick = useStore((s) => s.viewTick)

  useEffect(() => {
    if (!controls) return
    controls.dollyToCursor = true
    controls.infinityDolly = true
    controls.colliderMeshes = [GROUND]
    // Qarash nuqtasi maydon atrofidan uzoqqa ketib qolmasin
    controls.setBoundary(new THREE.Box3(new THREE.Vector3(-260, 0, -260), new THREE.Vector3(260, 60, 260)))
  }, [controls])

  useEffect(() => {
    if (!controls) return
    const s = get()
    const v = VIEWS[s.view]
    // Hosil rejimida o'rtada o'simlik qatori turadi: kamera qatorlar orasidagi yo'lakka suriladi
    const dx = !s.cropId.endsWith('-k') && (s.view === 'ichkarida' || s.view === 'stellaj') ? -1.35 : 0
    const t = new THREE.Vector3(v[3] + dx, v[4], v[5])
    const p = new THREE.Vector3(v[0] + dx, v[1], v[2])
    // Tik ekranda (telefon) gorizontal ko'rish burchagi tor: tashqi ko'rinishlarda kamera uzoqlashadi
    const aspect = window.innerWidth / window.innerHeight
    if (aspect < 1 && s.view !== 'ichkarida' && s.view !== 'stellaj') p.sub(t).multiplyScalar(Math.min(2, 1 / aspect)).add(t)
    void controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, tick > 1)
  }, [tick, controls])

  const gl = useThree((s) => s.gl)
  const inv = useThree((s) => s.invalidate)
  if (import.meta.env.DEV || location.search.includes('debug')) Object.assign(window, { __cam: camera, __controls: controls, __gl: gl, __inv: inv })

  useFrame(() => updateNear(camera.position))
  return null
}

/**
 * Kadr faqat kerak bo'lganda chiziladi (frameloop="demand"): kamera, animatsiya yoki tugma o'zgarsa.
 * Soya xaritasi ham har kadrda emas — faqat sahna o'zgarganda (quyosh qimirlamaydi).
 *
 * Birinchi kadr shaderlar FONDA kompilyatsiya bo'lib (compileAsync, parallel) va teksturalar kelgandan keyingina
 * chiziladi. Aks holda birinchi kadr shaderlarni sinxron kompilyatsiya qilib, sahifani ~10 s qotiradi.
 * Rendering shu yerda (priority 1): effektlar yoqilgan bo'lsa, ularni EffectComposer chizadi.
 */
function Pacer({ composer, onReady, onSlow }: { composer: boolean; onReady: () => void; onSlow: () => void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const cropId = useStore((s) => s.cropId)
  const st = useRef({ compiled: false, ready: false, frames: 0, n: 0, sec: 0 })

  // receiveShadow har xil bo'lsa, bitta material uchun ikkita shader yaratiladi — hammasida bir xil qilamiz
  const prepare = () => scene.traverse((o) => ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints) && (o.receiveShadow = true))
  const shadows = () => {
    prepare()
    gl.shadowMap.needsUpdate = true
    invalidate()
  }

  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    // Shader xatolarini tekshirish har dasturni kompilyatsiya tugashini KUTADI (Windows/ANGLE'da sekundlab) — faqat dev'da
    gl.debug.checkShaderErrors = import.meta.env.DEV
    let alive = true
    const check = () => {
      const s = st.current
      if (!alive || s.ready || !s.compiled || !watch.done) return
      s.ready = true
      onReady()
      shadows()
    }
    ;(async () => {
      // Yashirin qismlar (yaqin LOD, sug'orish aravasi) ham oldindan tayyorlanadi: binoga kirganda qotmasin
      prepare()
      const hidden: THREE.Object3D[] = []
      scene.traverse((o) => !o.visible && (hidden.push(o), (o.visible = true)))
      try {
        await gl.compileAsync(scene, camera)
      } catch {
        // eski brauzer: birinchi kadrda oddiy yo'l bilan kompilyatsiya bo'ladi
      }
      for (const o of hidden) o.visible = false
      st.current.compiled = true
      check()
    })()
    // Har yangi tekstura to'plami kelganda (masalan daraxt barglari) soya qayta hisoblanadi
    const onTex = () => {
      check()
      if (st.current.ready) shadows()
    }
    watch.listeners.add(onTex)
    const off = subscribe(invalidate)
    return () => {
      alive = false
      watch.listeners.delete(onTex)
      off()
    }
  }, [gl, scene, camera, invalidate])
  // Yangi ekin sahnaga qo'shilgandan keyin (commit'dan so'ng) soya yangilanadi
  useEffect(shadows, [cropId])

  useFrame((state, dt) => {
    const s = st.current
    if (!s.ready) return
    // Sekin qurilmada o'zi yengillashadi: ketma-ket chizilgan kadrlar (bekor turish hisoblanmaydi) 2 s davomida
    // o'rtacha 28 FPS'dan past bo'lsa — avval effektlar o'chadi, keyin piksellar kamayadi
    if (dt < 0.25 && s.frames > 2) {
      s.sec += dt
      s.n++
      if (s.sec > 2) {
        if (s.n / s.sec < 28) onSlow()
        s.sec = s.n = 0
      }
    }
    if (!composer) state.gl.render(state.scene, state.camera)
    if (++s.frames === 2) setLoading(100, true)
    if (motion.busy || s.frames < 2) invalidate()
  }, 1)
  return null
}

export default function Scene() {
  // Birinchi kadrdan ekran shakliga mos kamera
  useEffect(() => goView('umumiy'), [])
  const fog = useMemo(() => new THREE.FogExp2('#c9d6e0', 0.0016), [])
  const [post, setPost] = useState(Q.post)
  const [dpr, setDpr] = useState(Q.dpr[1])
  const [ready, setReady] = useState(false)
  return (
    <Canvas
      shadows="percentage" // PCF: three.js PCFSoft turini baribir PCFga almashtiradi — boshidan shunday bo'lsa shaderlar qayta kompilyatsiya bo'lmaydi
      frameloop="demand"
      dpr={[Q.dpr[0], dpr]}
      // Effektlar (post) bo'lmasa, antialiasingni brauzerning o'zi qiladi — eng arzon yo'l
      gl={{ antialias: !Q.post, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 42, near: 0.1, far: 2000, position: VIEWS.umumiy.slice(0, 3) as [number, number, number] }}
    >
      <primitive object={fog} attach="fog" />
      <Sky />
      <Lights />
      <Greenhouses />
      <Crops />
      <Site />
      <CameraControls
        makeDefault
        smoothTime={0.32}
        draggingSmoothTime={0.12}
        dollySpeed={0.7}
        minDistance={0.8}
        maxDistance={260}
        maxPolarAngle={Math.PI / 2 - 0.03}
      />
      <CameraRig />
      <Pacer composer={post && ready} onReady={() => setReady(true)} onSlow={() => (post ? setPost(false) : setDpr((d) => Math.max(0.6, d * 0.85)))} />
      {post && ready && (
        <Suspense fallback={null}>
          <Post />
        </Suspense>
      )}
    </Canvas>
  )
}
