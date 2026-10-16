/**
 * Carregador dinâmico do PDF.js para rasterização de primeira página em canvas
 * Permite leitura de QR Code em documentos fiscais (DANFE / NFC-e) salvos em PDF.
 */

export interface PDFPageProxy {
  getViewport: (options: { scale: number }) => {
    width: number
    height: number
  }
  render: (options: {
    canvasContext: CanvasRenderingContext2D
    viewport: { width: number; height: number }
  }) => { promise: Promise<void> }
}

export interface PDFDocumentProxy {
  numPages: number
  getPage: (pageNumber: number) => Promise<PDFPageProxy>
}

export interface PDFLib {
  GlobalWorkerOptions: {
    workerSrc: string
  }
  getDocument: (source: { data: ArrayBuffer | Uint8Array }) => {
    promise: Promise<PDFDocumentProxy>
  }
}

let cachedPDFLib: PDFLib | null = null

const PDFJS_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js'
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
const PDFJS_FALLBACK_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.min.js'
const PDFJS_FALLBACK_WORKER =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.worker.min.js'

export async function loadPdfJs(): Promise<PDFLib> {
  if (cachedPDFLib) return cachedPDFLib

  const win = window as unknown as { pdfjsLib?: PDFLib }
  if (win.pdfjsLib && typeof win.pdfjsLib.getDocument === 'function') {
    cachedPDFLib = win.pdfjsLib
    return cachedPDFLib
  }

  const tentarCarregar = async (scriptUrl: string, workerUrl: string) => {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = scriptUrl
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Falha ao carregar script ${scriptUrl}`))
      document.head.appendChild(script)
    })

    if (win.pdfjsLib && typeof win.pdfjsLib.getDocument === 'function') {
      win.pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
      cachedPDFLib = win.pdfjsLib
      return cachedPDFLib
    }
    throw new Error('pdfjsLib não disponível no escopo global')
  }

  try {
    return await tentarCarregar(PDFJS_CDN_URL, PDFJS_WORKER_URL)
  } catch (err1) {
    console.warn('[pdfJsLoader] Falha cdnjs, tentando jsDelivr fallback:', err1)
    try {
      return await tentarCarregar(PDFJS_FALLBACK_CDN, PDFJS_FALLBACK_WORKER)
    } catch (err2) {
      throw new Error(`Não foi possível carregar o motor PDF.js para rasterização: ${err2}`)
    }
  }
}
