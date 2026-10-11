/**
 * Carregador resiliente do SheetJS no navegador (via CDN ESM com fallbacks).
 * Carrega dinamicamente a biblioteca xlsx quando o usuário seleciona uma planilha.
 */

// Declaração de tipos mínimos para SheetJS
export interface XLSXLib {
  read: (
    data: ArrayBuffer | string | Uint8Array,
    opts?: { type?: 'array' | 'binary' | 'buffer' | 'base64' | 'string' },
  ) => XLSXWorkbook
  write: (
    workbook: XLSXWorkbook,
    opts?: { bookType?: string; type?: 'array' | 'base64' | 'binary' | 'buffer' | 'string' },
  ) => ArrayBuffer | Uint8Array | string
  writeFile: (workbook: XLSXWorkbook, filename: string, opts?: { bookType?: string }) => void
  utils: {
    sheet_to_json: <T = Record<string, unknown>>(
      worksheet: XLSXWorksheet,
      opts?: { header?: number | string[]; defval?: unknown; blankrows?: boolean; raw?: boolean },
    ) => T[]
    book_new: () => XLSXWorkbook
    aoa_to_sheet: (data: unknown[][], opts?: Record<string, unknown>) => XLSXWorksheet
    json_to_sheet: (data: unknown[], opts?: Record<string, unknown>) => XLSXWorksheet
    book_append_sheet: (workbook: XLSXWorkbook, worksheet: XLSXWorksheet, name?: string) => void
  }
}

export interface XLSXWorkbook {
  SheetNames: string[]
  Sheets: Record<string, XLSXWorksheet>
}

export type XLSXWorksheet = Record<string, unknown>

let cachedXLSX: XLSXLib | null = null

const CDN_URLS = [
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs',
  'https://esm.sh/xlsx@0.18.5',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm',
]

export async function loadSheetJS(): Promise<XLSXLib> {
  if (cachedXLSX) return cachedXLSX

  // Verifica se já está em window.XLSX (caso tenha script tag)
  const win = window as unknown as { XLSX?: XLSXLib }
  if (win.XLSX && typeof win.XLSX.read === 'function') {
    cachedXLSX = win.XLSX
    return cachedXLSX
  }

  let lastError: unknown = null
  for (const url of CDN_URLS) {
    try {
      /* @vite-ignore */
      const mod = (await import(/* @vite-ignore */ url)) as { default?: XLSXLib } & XLSXLib
      const xlsxInstance = mod.read ? mod : mod.default
      if (xlsxInstance && typeof xlsxInstance.read === 'function') {
        cachedXLSX = xlsxInstance
        return cachedXLSX
      }
    } catch (err) {
      lastError = err
      console.warn(`[SheetJS] Falha ao carregar de ${url}:`, err)
    }
  }

  // Fallback: carregar script tag clássica
  try {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Falha ao carregar script XLSX standalone'))
      document.head.appendChild(script)
    })
    if (win.XLSX && typeof win.XLSX.read === 'function') {
      cachedXLSX = win.XLSX
      return cachedXLSX
    }
  } catch (err) {
    lastError = err
  }

  throw new Error(
    `Não foi possível carregar a biblioteca de leitura de planilhas. Verifique a conexão. (${
      lastError instanceof Error ? lastError.message : String(lastError)
    })`,
  )
}
