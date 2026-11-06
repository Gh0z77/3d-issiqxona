/**
 * Grafika sifati. Qurilmaga qarab tanlanadi (uzgrow loyihasidagi usul):
 *  high   — diskret videokarta: AO, bloom, 4096 soya, o'simlik soyalari
 *  medium — noutbukdagi ichki grafika (Intel/AMD APU): effektlarsiz, oddiy MSAA, 2048 soya
 *  low    — telefon / dasturiy render: kam piksel, 1024 soya, kamroq daraxt
 * ?q=low|medium|high — qo'lda tanlash (sinov uchun).
 */
export type Tier = 'high' | 'medium' | 'low'

const nav = navigator as Navigator & { deviceMemory?: number }
export const isPhone = window.matchMedia('(max-width: 760px)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent)
const weak = (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4

function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return name
  } catch {
    return ''
  }
}
const gpu = gpuName()
const software = /SwiftShader|llvmpipe|Microsoft Basic/i.test(gpu)
const integrated = /Intel|UHD|Iris|Radeon\(TM\) Graphics|Radeon Graphics|Vega \d+ Graphics|Apple GPU|Mali|Adreno|PowerVR/i.test(gpu)

const forced = new URLSearchParams(location.search).get('q')

export const tier: Tier =
  forced === 'low' || forced === 'medium' || forced === 'high' ? forced : isPhone || software ? 'low' : weak || integrated ? 'medium' : 'high'

/** Kadr narxi piksel soniga proporsional: DPR ekran o'lchamidan, pog'ona byudjetiga sig'adigan qilib hisoblanadi. */
function dpr(maxDpr: number, budget: number): [number, number] {
  const fit = Math.sqrt(budget / (window.innerWidth * window.innerHeight))
  const hi = Math.max(0.6, Math.min(maxDpr, window.devicePixelRatio, fit))
  return [Math.min(0.75, hi), hi]
}

export const Q = {
  high: { dpr: dpr(1.5, 2.2e6), post: true, shadow: 4096, plantShadow: true, trees: 1, tex: '' },
  medium: { dpr: dpr(1.25, 1.1e6), post: false, shadow: 2048, plantShadow: false, trees: 1, tex: '-m' },
  low: { dpr: dpr(1.5, 0.6e6), post: false, shadow: 1024, plantShadow: false, trees: 0.5, tex: '-m' },
}[tier]
