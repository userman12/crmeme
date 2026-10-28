// PNG segnaposto generati con il solo zlib di Node (seed e test)
import { crc32, deflateSync } from 'node:zlib'

// ── PNG minimale (RGB 8 bit) con solo zlib di Node ─────────────────────────
export function png(w: number, h: number, pixel: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) raw.set(pixel(x, y), y * (w * 3 + 1) + 1 + x * 3)
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc32(body), body.length + 4)
    return out
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return [f(0), f(8), f(4)]
}

// Segnaposto: fasce "didascalia" sopra e sotto, righe diagonali al centro
export function placeholder(i: number, w: number, h: number): Buffer {
  const hue = (i * 47) % 360
  const stripe = 20 + (i % 5) * 8
  return png(w, h, (x, y) => {
    if (y < h * 0.15 || y > h * 0.85) return [30, 30, 30]
    return Math.floor((x + y * (i % 2 ? 1 : -1) + w) / stripe) % 2 ? hsl(hue, 0.6, 0.55) : hsl(hue, 0.5, 0.75)
  })
}

