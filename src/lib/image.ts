// FR-15 hash e NFR-01 compressione, con le sole API del browser
export const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const MAX_BYTES = 5 * 1024 * 1024

/** SHA-256 del file originale, prima della compressione (A6). */
export async function sha256(file: Blob): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86))

/** Ridimensiona al lato lungo `maxSide` e ricodifica, eliminando i metadati EXIF. WebP, o JPEG dove il browser non lo supporta. */
export async function resize(file: Blob, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file)  // applica l'orientamento EXIF
  const k = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * k)
  canvas.height = Math.round(bitmap.height * k)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const webp = await toBlob(canvas, 'image/webp')
  if (webp?.type === 'image/webp') return webp
  // Safari non codifica WebP: JPEG su fondo bianco (la trasparenza diventerebbe nera)
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const jpeg = await toBlob(canvas, 'image/jpeg')
  if (!jpeg) throw new Error('encode')
  return jpeg
}

export const extension = (type: string) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[type] ?? 'bin'
