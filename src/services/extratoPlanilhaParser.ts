/**
 * Parser para extratos bancários em formato CSV ou XLSX com auto-detecção de colunas brasileiras.
 */

import { loadSheetJS } from './sheetjsLoader'
import type { OfxExtratoParsed, OfxTransacaoParsed } from './extratoOfxParser'

function parseDateCell(val: unknown): string {
  if (!val) return new Date().toISOString().slice(0, 10)
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10)
  }
  const str = String(val).trim()
  // Padrão DD/MM/AAAA ou DD/MM/AA
  const brMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (brMatch) {
    const d = brMatch[1].padStart(2, '0')
    const m = brMatch[2].padStart(2, '0')
    let y = brMatch[3]
    if (y.length === 2) y = `20${y}`
    return `${y}-${m}-${d}`
  }
  // Padrão YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  return new Date().toISOString().slice(0, 10)
}

function parseValorCell(val: unknown): { valor: number; isNegative: boolean } {
  if (typeof val === 'number') {
    return { valor: Math.abs(val), isNegative: val < 0 }
  }
  let str = String(val || '').trim()
  const isNegative =
    str.includes('-') ||
    (str.startsWith('(') && str.endsWith(')')) ||
    str.toUpperCase().includes(' D')
  str = str.replace(/[R$\s()D]/gi, '')
  // Troca pontos por nada se for milhar brasileiro (ex: 1.250,50)
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.')
  } else if (str.includes(',')) {
    str = str.replace(',', '.')
  }
  const num = parseFloat(str) || 0
  return { valor: Math.abs(num), isNegative }
}

export async function parsePlanilhaExtrato(file: File): Promise<OfxExtratoParsed> {
  const xlsx = await loadSheetJS()
  const buffer = await file.arrayBuffer()
  const workbook = xlsx.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // Converte linhas brutas para identificar cabeçalho
  const rawRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    blankrows: false,
    raw: false,
  })

  if (!rawRows.length) {
    throw new Error('O arquivo de extrato está vazio ou não possui linhas utilizáveis.')
  }

  // Detecta nomes de colunas
  const sample = rawRows[0]
  const keys = Object.keys(sample)

  const dateKey = keys.find((k) => /data|dt|dia|data.*lan[cç]/i.test(k)) || keys[0]
  const descKey =
    keys.find((k) => /hist[oó]rico|descri[cç][aã]o|detalhe|memo|transa[cç][aã]o/i.test(k)) ||
    keys[1]
  const valorKey = keys.find((k) => /valor|quantia|lan[cç]amento|montante/i.test(k)) || keys[2]
  const tipoKey = keys.find((k) => /tipo|d\/c|natureza|cr[eé]dito\/d[eé]bito/i.test(k))
  const docKey = keys.find((k) => /doc|documento|num.*doc/i.test(k))

  const transacoes: OfxTransacaoParsed[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]
    const rawDesc = String(row[descKey] || '').trim()
    const rawDate = row[dateKey]
    const rawVal = row[valorKey]

    // Ignora linhas de saldo anterior, totais ou cabeçalho residual
    if (!rawDesc && !rawVal) continue
    if (/saldo\s+(anterior|do\s+dia|atual|bloqueado|final)/i.test(rawDesc)) continue

    const { valor, isNegative } = parseValorCell(rawVal)
    if (valor === 0 && !rawDesc) continue

    let tipo: 'entrada' | 'saida' = isNegative ? 'saida' : 'entrada'
    if (tipoKey && row[tipoKey]) {
      const t = String(row[tipoKey]).trim().toUpperCase()
      if (t.includes('D') || t.includes('DÉB') || t.includes('DEB') || t.includes('SAÍ')) {
        tipo = 'saida'
      } else if (t.includes('C') || t.includes('CRÉ') || t.includes('CRE') || t.includes('ENT')) {
        tipo = 'entrada'
      }
    }

    const docRef = docKey && row[docKey] ? String(row[docKey]).trim() : undefined
    const fitid = `csv_${i}_${Math.random().toString(36).slice(2, 7)}`

    transacoes.push({
      fitid,
      tipo,
      data: parseDateCell(rawDate),
      valor,
      valorOriginal: tipo === 'saida' ? -valor : valor,
      descricao: rawDesc || 'Lançamento bancário',
      documentoRef: docRef,
    })
  }

  // Ordena por data
  transacoes.sort((a, b) => a.data.localeCompare(b.data))

  const dataInicio = transacoes[0]?.data
  const dataFim = transacoes[transacoes.length - 1]?.data

  return {
    banco: 'Extrato Importado',
    dataInicio,
    dataFim,
    transacoes,
  }
}
