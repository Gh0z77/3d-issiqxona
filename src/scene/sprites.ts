import * as THREE from 'three'
import type { Crop, Leaf } from '../data/crops'

/**
 * Ekin suratlari brauzerning o'zida canvas'da chiziladi: har ekinning o'z barg shakli
 * (pomidor — patsimon, bodring — panjasimon, tarvuz — chuqur kesik, qulupnay — uch bargli ...).
 * Model yuklash shart emas, ekin almashganda bir zumda yangilanadi.
 */

function rng(seed: number) {
  let s = seed % 2147483647 || 1
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function cv(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function texture(c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Rangni yorqinroq/to'qroq qilish (k > 1 yorqin). */
function tone(hex: string, k: number, hueShift = 0) {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL((hsl.h + hueShift + 1) % 1, hsl.s, Math.min(0.92, hsl.l * k))
  return `#${c.getHexString()}`
}

type Ctx = CanvasRenderingContext2D

/** Bitta barg: (0,0) dan +X tomonga, uzunligi len. */
function leafShape(g: Ctx, kind: Leaf, len: number, r: () => number) {
  g.beginPath()
  if (kind === 'cucumber' || kind === 'melon') {
    // Panjasimon (bodring) yoki chuqur kesik (tarvuz) barg: qutb koordinatalarida
    const R = len / 2
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2
      const lobe = kind === 'melon' ? 0.42 + 0.58 * Math.pow(Math.abs(Math.cos(a * 2.5)), 0.55) : 0.84 + 0.16 * Math.cos(a * 5)
      const notch = 1 - 0.35 * Math.exp(-Math.pow((a - Math.PI) / 0.25, 2)) // band qismidagi kesik
      const rr = R * lobe * notch * (1 + (r() - 0.5) * 0.04)
      const x = R + Math.cos(a) * rr
      const y = Math.sin(a) * rr * 0.92
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
  } else if (kind === 'cabbage') {
    const R = len / 2
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2
      const rr = R * (0.92 + 0.08 * Math.sin(a * 9))
      const x = R * 0.95 + Math.cos(a) * rr
      const y = Math.sin(a) * rr * 0.85
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
  } else {
    // Cho'ziq barg; qalampir — ingichka, baqlajon — keng, pomidor/qulupnay bargchalari — tishli
    const w = len * (kind === 'pepper' ? 0.2 : kind === 'eggplant' ? 0.34 : 0.3)
    const teeth = kind === 'tomato' || kind === 'strawberry'
    const N = 22
    const pts: [number, number][] = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const half = Math.sin(Math.PI * Math.pow(t, 0.8)) * w
      const tooth = teeth ? 1 + (i % 2 ? 0.12 : -0.05) : 1
      pts.push([t * len, -half * tooth])
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N
      const half = Math.sin(Math.PI * Math.pow(t, 0.8)) * w
      const tooth = teeth ? 1 + (i % 2 ? 0.12 : -0.05) : 1
      pts.push([t * len, half * tooth])
    }
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  }
  g.closePath()
}

function paintLeaf(g: Ctx, kind: Leaf, base: string, len: number, r: () => number, light = 1) {
  const k = (0.85 + r() * 0.3) * light
  const grad = g.createLinearGradient(0, -len * 0.3, len, len * 0.3)
  grad.addColorStop(0, tone(base, k * 1.18))
  grad.addColorStop(1, tone(base, k * 0.82))
  leafShape(g, kind, len, r)
  g.fillStyle = grad
  g.fill()
  g.lineWidth = Math.max(0.6, len * 0.02)
  g.strokeStyle = tone(base, k * 0.6)
  g.stroke()
  // Markaziy tomir
  g.beginPath()
  g.moveTo(len * 0.04, 0)
  g.lineTo(len * (kind === 'cucumber' || kind === 'melon' || kind === 'cabbage' ? 0.55 : 0.9), 0)
  g.strokeStyle = tone(base, k * 1.45)
  g.lineWidth = Math.max(0.8, len * 0.025)
  g.stroke()
}

/** Pomidor patsimon bargi / qulupnay uch bargi — bir nechta bargchadan. Boshqalar oddiy barg. */
function compoundLeaf(g: Ctx, kind: Leaf, base: string, len: number, r: () => number, light = 1) {
  if (kind === 'tomato') {
    g.strokeStyle = tone(base, 0.9)
    g.lineWidth = Math.max(1, len * 0.03)
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(len, 0)
    g.stroke()
    for (const t of [0.3, 0.55, 0.78]) {
      for (const s of [-1, 1]) {
        g.save()
        g.translate(len * t, 0)
        g.rotate(s * (0.9 + r() * 0.3))
        paintLeaf(g, 'tomato', base, len * 0.36, r, light)
        g.restore()
      }
    }
    g.save()
    g.translate(len * 0.92, 0)
    paintLeaf(g, 'tomato', base, len * 0.36, r, light)
    g.restore()
    return
  }
  if (kind === 'strawberry') {
    g.strokeStyle = tone(base, 1.2)
    g.lineWidth = Math.max(1, len * 0.03)
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(len * 0.45, 0)
    g.stroke()
    for (const a of [-0.75, 0, 0.75]) {
      g.save()
      g.translate(len * 0.45, 0)
      g.rotate(a)
      paintLeaf(g, 'strawberry', base, len * 0.55, r, light)
      g.restore()
    }
    return
  }
  paintLeaf(g, kind, base, len, r, light)
}

function stemColor(c: Crop) {
  return c.leaf === 'eggplant' ? '#6b4a6e' : c.leaf === 'cabbage' ? '#9fb7a6' : tone(c.green, 1.35)
}

/** Ko'chat yon ko'rinishi: bitta qator (kasseta uzunligi bo'ylab). */
function seedlingSide(c: Crop) {
  const [cnv, g] = cv(512, 256)
  const r = rng(c.id.length * 977 + 11)
  const cells = c.cells ?? 72
  const n = cells >= 128 ? 16 : cells >= 72 ? 12 : 10
  for (const layer of [0, 1]) {
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5 + layer * 0.5) / n) * 512 + (r() - 0.5) * 10
      const top = 256 * (0.28 + r() * 0.16)
      const light = layer ? 0.78 : 1
      g.strokeStyle = tone(stemColor(c), light)
      g.lineWidth = 5
      g.beginPath()
      g.moveTo(x, 256)
      g.quadraticCurveTo(x + (r() - 0.5) * 18, (256 + top) / 2, x + (r() - 0.5) * 8, top)
      g.stroke()
      // urug'palla bargchalar
      for (const s of [-1, 1]) {
        g.save()
        g.translate(x, 256 * 0.72)
        g.rotate(-Math.PI / 2 + s * 1.05)
        paintLeaf(g, c.leaf === 'cabbage' ? 'cabbage' : 'pepper', tone(c.green, 1.1), 34, r, light)
        g.restore()
      }
      // chin barglar
      const leaves = 3 + Math.floor(r() * 2)
      for (let j = 0; j < leaves; j++) {
        g.save()
        g.translate(x, top + 6)
        g.rotate(-Math.PI / 2 + (j / (leaves - 1) - 0.5) * 2.4 + (r() - 0.5) * 0.3)
        compoundLeaf(g, c.leaf, c.green, 70 + r() * 30, r, light)
        g.restore()
      }
    }
  }
  return texture(cnv)
}

/** Ustki qatlam kassetadan shuncha (m) kattaroq — Crops.tsx bilan bir xil. */
export const TOP_PAD = 0.05
const TRAY_W = 0.28
const TRAY_L = 0.54

/** Ko'chat tepadan: kasseta katakchalari bo'yicha zich "gilam", barglar chetdan chiqib turadi. */
function seedlingTop(c: Crop) {
  const W = 512
  const H = Math.round((W * (TRAY_L + 2 * TOP_PAD)) / (TRAY_W + 2 * TOP_PAD))
  const [cnv, g] = cv(W, H)
  const r = rng(c.id.length * 131 + 7)
  const cells = c.cells ?? 72
  const cols = cells >= 128 ? 8 : cells >= 72 ? 6 : 5
  const rows = cells / cols
  const px = W / (TRAY_W + 2 * TOP_PAD) // piksel / m
  const ox = TOP_PAD * px
  const cw = (TRAY_W * px) / cols
  const ch = (TRAY_L * px) / rows
  g.shadowColor = 'rgba(0,0,0,0.5)'
  g.shadowBlur = 8
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const cx = ox + (x + 0.5) * cw + (r() - 0.5) * cw * 0.2
      const cy = ox + (y + 0.5) * ch + (r() - 0.5) * ch * 0.2
      const leaves = c.leaf === 'cabbage' ? 4 : 3 + Math.floor(r() * 2)
      const a0 = r() * Math.PI * 2
      for (let j = 0; j < leaves; j++) {
        g.save()
        g.translate(cx, cy)
        g.rotate(a0 + (j / leaves) * Math.PI * 2 + (r() - 0.5) * 0.4)
        compoundLeaf(g, c.leaf, c.green, Math.min(cw, ch) * (0.95 + r() * 0.45), r)
        g.restore()
      }
    }
  return texture(cnv)
}

function fruit(g: Ctx, x: number, y: number, rad: number, ripe: number, kind: Leaf) {
  const red = kind === 'strawberry' ? ['#ff5a4f', '#c3121b', '#7a0710'] : ['#ff7a52', '#d8261a', '#8a120c']
  const green = ['#cfe58a', '#78a83a', '#3d6420']
  const pal = ripe > 0.5 ? red : green
  const grad = g.createRadialGradient(x - rad * 0.35, y - rad * 0.35, rad * 0.1, x, y, rad)
  grad.addColorStop(0, pal[0])
  grad.addColorStop(0.6, pal[1])
  grad.addColorStop(1, pal[2])
  g.fillStyle = grad
  g.beginPath()
  if (kind === 'strawberry') {
    g.moveTo(x - rad, y - rad * 0.6)
    g.quadraticCurveTo(x, y - rad * 1.1, x + rad, y - rad * 0.6)
    g.quadraticCurveTo(x + rad * 0.8, y + rad * 0.8, x, y + rad * 1.5)
    g.quadraticCurveTo(x - rad * 0.8, y + rad * 0.8, x - rad, y - rad * 0.6)
  } else g.arc(x, y, rad, 0, Math.PI * 2)
  g.fill()
  if (kind === 'strawberry') {
    g.fillStyle = '#f7e27a'
    for (let i = 0; i < 9; i++) g.fillRect(x - rad * 0.6 + (i % 3) * rad * 0.55, y - rad * 0.3 + Math.floor(i / 3) * rad * 0.5, 1.6, 1.6)
  }
  g.fillStyle = 'rgba(255,255,255,0.55)'
  g.beginPath()
  g.arc(x - rad * 0.35, y - rad * 0.4, rad * 0.18, 0, Math.PI * 2)
  g.fill()
}

/** Hosil rejimi: baland o'simlik (pomidor, bodring) yoki qulupnay to'pi. */
function plantTall(c: Crop) {
  const r = rng(c.id.length * 313 + 5)
  if (c.leaf === 'strawberry') {
    const [cnv, g] = cv(256, 320)
    // barglar yuqorida (tarnov ustida), mevalar pastga osilib turadi
    for (let j = 0; j < 9; j++) {
      g.save()
      g.translate(128 + (r() - 0.5) * 30, 150)
      g.rotate(-Math.PI / 2 + (j / 8 - 0.5) * 2.6)
      compoundLeaf(g, 'strawberry', c.green, 120 + r() * 30, r)
      g.restore()
    }
    g.strokeStyle = '#7f9a4c'
    g.lineWidth = 2
    for (let j = 0; j < 6; j++) {
      const x = 40 + j * 35 + (r() - 0.5) * 12
      const y = 210 + r() * 70
      g.beginPath()
      g.moveTo(128, 160)
      g.quadraticCurveTo(x, 170, x, y - 14)
      g.stroke()
      fruit(g, x, y, 13 + r() * 4, r() > 0.25 ? 1 : 0, 'strawberry')
    }
    return texture(cnv)
  }
  const [cnv, g] = cv(256, 1024)
  // ip (shpagat) — o'simlik shunga o'raladi
  g.strokeStyle = 'rgba(235,225,200,0.9)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(128, 0)
  g.lineTo(128, 1024)
  g.stroke()
  let x = 128
  const stem: [number, number][] = []
  for (let y = 1024; y > 20; y -= 64) {
    x = 128 + Math.sin(y * 0.02) * 10
    stem.push([x, y])
  }
  g.strokeStyle = tone(stemColor(c), 0.95)
  g.lineWidth = 7
  g.beginPath()
  stem.forEach(([sx, sy], i) => (i ? g.lineTo(sx, sy) : g.moveTo(sx, sy)))
  g.stroke()
  stem.forEach(([sx, sy], i) => {
    const s = i % 2 ? 1 : -1
    g.save()
    g.translate(sx, sy)
    g.rotate((s > 0 ? 0 : Math.PI) + s * (0.25 + r() * 0.3))
    if (s < 0) g.scale(1, -1)
    compoundLeaf(g, c.leaf, c.green, (c.leaf === 'tomato' ? 120 : 105) + r() * 20, r, 0.85 + (i / stem.length) * 0.3)
    g.restore()
    const h = 1 - sy / 1024
    if (c.leaf === 'tomato' && i % 2 === 0 && h > 0.15 && h < 0.75) {
      // pomidor shingili: pastdagilari pishgan
      const ripe = h < 0.45 ? 1 : 0
      for (let k = 0; k < 5; k++) fruit(g, sx + s * (24 + k * 12) + (r() - 0.5) * 8, sy + 22 + Math.sin(k) * 10, 13 + r() * 3, ripe, 'tomato')
    }
    if (c.leaf === 'cucumber' && i % 2 === 1 && h > 0.12 && h < 0.8) {
      const fx = sx + s * 22
      const grad = g.createLinearGradient(fx - 8, 0, fx + 8, 0)
      grad.addColorStop(0, '#4e8a2c')
      grad.addColorStop(0.5, '#86b84f')
      grad.addColorStop(1, '#2e5e1a')
      g.fillStyle = grad
      g.beginPath()
      g.ellipse(fx, sy + 55, 9, 50, s * 0.12, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#f2cf2a'
      g.beginPath()
      g.arc(fx + s * 4, sy + 6, 7, 0, Math.PI * 2)
      g.fill()
    }
  })
  return texture(cnv)
}

const cache = new Map<string, { side: THREE.Texture; top: THREE.Texture; tall: THREE.Texture | null }>()

export function cropTextures(c: Crop) {
  let t = cache.get(c.id)
  if (!t) {
    t = c.mode === 'kochat' ? { side: seedlingSide(c), top: seedlingTop(c), tall: null } : { side: seedlingSide(c), top: seedlingTop(c), tall: plantTall(c) }
    cache.set(c.id, t)
  }
  return t
}

/** Kasseta ustki yuzi: katakchalar ichida torf. */
export function trayTexture(cells: number) {
  const [cnv, g] = cv(128, 256)
  g.fillStyle = '#30363b'
  g.fillRect(0, 0, 128, 256)
  const cols = cells >= 128 ? 8 : cells >= 72 ? 6 : 5
  const rows = cells / cols
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const cx = ((x + 0.5) / cols) * 128
      const cy = ((y + 0.5) / rows) * 256
      const rad = (128 / cols) * 0.4
      g.fillStyle = '#3b2c21'
      g.beginPath()
      g.arc(cx, cy, rad, 0, Math.PI * 2)
      g.fill()
    }
  return texture(cnv)
}

/** Takrorlanuvchi naqshlar: stellaj to'ri, termo-parda, panjara. */
export function patternTexture(kind: 'grid' | 'screen' | 'fence') {
  const [cnv, g] = cv(64, 64)
  if (kind === 'grid') {
    g.strokeStyle = '#c9ced1'
    g.lineWidth = 3
    g.strokeRect(1.5, 1.5, 61, 61)
  } else if (kind === 'screen') {
    for (let x = 0; x < 64; x += 8) {
      g.fillStyle = (x / 8) % 2 ? '#e9ecee' : '#c9d0d4'
      g.fillRect(x, 0, 7, 64)
    }
  } else {
    g.strokeStyle = '#8e969b'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(0, 32)
    g.lineTo(32, 0)
    g.lineTo(64, 32)
    g.lineTo(32, 64)
    g.closePath()
    g.stroke()
  }
  return texture(cnv, true)
}
