/**
 * Carregador dinâmico e resiliente do jsQR no navegador
 * Suporta múltiplos CDNs (jsDelivr, cdnjs, unpkg) com fallbacks automáticos.
 */

export interface QRCodePoint {
  x: number
  y: number
}

export interface QRCodeResult {
  data: string
  binaryData: number[]
  chunks: Array<{ type: string; bytes: number[] }>
  version: number
  location: {
    topRightCorner: QRCodePoint
    topLeftCorner: QRCodePoint
    bottomRightCorner: QRCodePoint
    bottomLeftCorner: QRCodePoint
    topRightFinderPattern: QRCodePoint
    topLeftFinderPattern: QRCodePoint
    bottomLeftFinderPattern: QRCodePoint
    bottomRightAlignmentPattern?: QRCodePoint
  }
}

export type JsQRFunction = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' },
) => QRCodeResult | null

let cachedJsQR: JsQRFunction | null = null

const JSQR_CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js',
  'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js',
]

export async function loadJsQR(): Promise<JsQRFunction> {
  if (cachedJsQR) return cachedJsQR

  const win = window as unknown as { jsQR?: JsQRFunction }
  if (typeof win.jsQR === 'function') {
    cachedJsQR = win.jsQR
    return cachedJsQR
  }

  let lastError: unknown = null
  for (const url of JSQR_CDN_URLS) {
    try {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = url
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Falha ao carregar script jsQR de ${url}`))
        document.head.appendChild(script)
      })

      if (typeof win.jsQR === 'function') {
        cachedJsQR = win.jsQR
        return cachedJsQR
      }
    } catch (err) {
      lastError = err
      console.warn(`[jsQRLoader] Falha no CDN ${url}:`, err)
    }
  }

  throw new Error(
    `Não foi possível carregar o decodificador de QR Code. (${lastError instanceof Error ? lastError.message : String(lastError)})`,
  )
}
