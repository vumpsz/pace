// Generates build/icon.png (512x512) and public/icon-*.png with no dependencies.
// Dark rounded square, one gold rising curve: the pace line.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encodePNG(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

function render(size, { padding = 0.1 } = {}) {
  const px = Buffer.alloc(size * size * 4)
  const bg = [0x0b, 0x0d, 0x11]
  const gold = [0xe9, 0xb9, 0x49]
  const radius = size * 0.22
  const inset = size * padding
  const box = size - inset * 2
  const inBox = (x, y) => {
    const lx = x - inset
    const ly = y - inset
    if (lx < 0 || ly < 0 || lx > box || ly > box) return false
    const cx = Math.max(radius, Math.min(box - radius, lx))
    const cy = Math.max(radius, Math.min(box - radius, ly))
    return (lx - cx) ** 2 + (ly - cy) ** 2 <= radius * radius
  }
  // curve: y = a * exp(k x) normalised across the box, drawn as a thick stroke
  const curve = (t) => {
    const k = 2.6
    return (Math.exp(k * t) - 1) / (Math.exp(k) - 1)
  }
  const stroke = size * 0.075
  const x0 = inset + box * 0.18
  const x1 = inset + box * 0.82
  const yTop = inset + box * 0.2
  const yBot = inset + box * 0.8
  const dist = (x, y) => {
    let best = Infinity
    for (let i = 0; i <= 200; i++) {
      const t = i / 200
      const cx = x0 + (x1 - x0) * t
      const cy = yBot - (yBot - yTop) * curve(t)
      const d = Math.hypot(x - cx, y - cy)
      if (d < best) best = d
    }
    return best
  }
  const ss = 3
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0
      let g = 0
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const fx = x + (sx + 0.5) / ss
          const fy = y + (sy + 0.5) / ss
          if (inBox(fx, fy)) {
            a++
            if (dist(fx, fy) <= stroke / 2) g++
          }
        }
      const alpha = a / (ss * ss)
      const gm = g / (ss * ss)
      const i = (y * size + x) * 4
      px[i] = Math.round(bg[0] * (1 - gm) + gold[0] * gm)
      px[i + 1] = Math.round(bg[1] * (1 - gm) + gold[1] * gm)
      px[i + 2] = Math.round(bg[2] * (1 - gm) + gold[2] * gm)
      px[i + 3] = Math.round(alpha * 255)
    }
  }
  return px
}

mkdirSync('build', { recursive: true })
mkdirSync('public', { recursive: true })
writeFileSync('build/icon.png', encodePNG(512, render(512, { padding: 0 })))
writeFileSync('public/icon-512.png', encodePNG(512, render(512, { padding: 0.06 })))
writeFileSync('public/icon-192.png', encodePNG(192, render(192, { padding: 0.06 })))
console.log('icons written')
