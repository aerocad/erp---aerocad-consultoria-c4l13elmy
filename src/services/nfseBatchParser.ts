import JSZip from 'jszip'
import {
  autoMapearColunasNfse,
  parsePlanilhaNfse,
  parseXmlNfse,
  type NfseDadoExtraido,
} from './nfseParser'
import { loadSheetJS } from './sheetjsLoader'

export interface ArquivoNaoReconhecido {
  nome: string
  caminho?: string
  motivo: string
  tamanho?: number
}

export interface ArquivoLoteEstatistica {
  nome: string
  tipo: 'xml' | 'planilha' | 'zip'
  qtdNotas: number
}

export interface ResultadoProcessamentoLoteNfse {
  notas: NfseDadoExtraido[]
  arquivosNaoReconhecidos: ArquivoNaoReconhecido[]
  arquivosProcessados: ArquivoLoteEstatistica[]
  totalArquivosLidos: number
  totalNotasExtraidas: number
  temPlanilhas: boolean
  linhasPlanilhaBrutas?: Record<string, unknown>[]
  colunasDetectadasPlanilha?: string[]
  mapaColunasPlanilha?: Record<string, string>
}

// Limite generoso padrão para arquivos ZIP (50 MB)
export const MAX_ZIP_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

// Retorna se o arquivo é um arquivo oculto ou lixo comum de compactadores (macOS __MACOSX, .DS_Store, pastas)
function isArquivoIgnorado(nomeArquivo: string): boolean {
  const normalizado = nomeArquivo.replace(/\\/g, '/')
  const partes = normalizado.split('/')
  const nomeBase = partes[partes.length - 1]

  if (!nomeBase) return true
  if (normalizado.startsWith('__MACOSX/')) return true
  if (nomeBase.startsWith('.')) return true
  if (nomeBase === 'Thumbs.db' || nomeBase === 'desktop.ini') return true
  return false
}

// Verifica se a extensão é suportada diretamente como nota fiscal (XML) ou planilha
export function isExtensaoNfseSuportada(nomeArquivo: string): boolean {
  const lower = nomeArquivo.toLowerCase()
  return (
    lower.endsWith('.xml') ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.zip')
  )
}

/**
 * Descompacta um arquivo ZIP e extrai as notas contidas nos arquivos XML e planilhas internas.
 * Arquivos que não forem XML ou planilha (ou que falharem no parse) são registrados como não reconhecidos.
 */
export async function extrairNotasDeZip(
  zipFile: File | Blob,
  zipNome: string,
): Promise<{
  notas: NfseDadoExtraido[]
  arquivosNaoReconhecidos: ArquivoNaoReconhecido[]
  arquivosProcessados: ArquivoLoteEstatistica[]
  linhasPlanilhaBrutas: Record<string, unknown>[]
  colunasDetectadasPlanilha: string[]
  mapaColunasPlanilha: Record<string, string>
}> {
  if (zipFile.size > MAX_ZIP_SIZE_BYTES) {
    throw new Error(
      `O arquivo ZIP "${zipNome}" excede o limite máximo permitido de 50 MB (tamanho: ${(
        zipFile.size /
        (1024 * 1024)
      ).toFixed(1)} MB).`,
    )
  }

  const jszip = new JSZip()
  let zipConteudo: JSZip
  try {
    const arrayBuffer = await zipFile.arrayBuffer()
    zipConteudo = await jszip.loadAsync(arrayBuffer)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Não foi possível abrir o arquivo ZIP "${zipNome}": ${msg}`)
  }

  const notas: NfseDadoExtraido[] = []
  const arquivosNaoReconhecidos: ArquivoNaoReconhecido[] = []
  const arquivosProcessados: ArquivoLoteEstatistica[] = []
  let linhasPlanilhaBrutas: Record<string, unknown>[] = []
  let colunasDetectadasPlanilha: string[] = []
  let mapaColunasPlanilha: Record<string, string> = {}

  // Iterar pelas entradas do ZIP
  const entries = Object.keys(zipConteudo.files)

  for (const entryPath of entries) {
    const zipEntry = zipConteudo.files[entryPath]
    if (zipEntry.dir) continue
    if (isArquivoIgnorado(entryPath)) continue

    const nomeBase = entryPath.split('/').pop() || entryPath
    const lower = nomeBase.toLowerCase()

    // 1. Arquivo XML de NFS-e
    if (lower.endsWith('.xml')) {
      try {
        const xmlTexto = await zipEntry.async('string')
        const notasDoXml = parseXmlNfse(xmlTexto, nomeBase)

        if (notasDoXml.length === 0) {
          arquivosNaoReconhecidos.push({
            nome: nomeBase,
            caminho: entryPath,
            motivo: 'Arquivo XML sem estrutura reconhecida de NFS-e (ABRASF/GDF)',
          })
        } else {
          notas.push(...notasDoXml)
          arquivosProcessados.push({
            nome: nomeBase,
            tipo: 'xml',
            qtdNotas: notasDoXml.length,
          })
        }
      } catch (xmlErr: unknown) {
        const msg = xmlErr instanceof Error ? xmlErr.message : String(xmlErr)
        arquivosNaoReconhecidos.push({
          nome: nomeBase,
          caminho: entryPath,
          motivo: `Erro ao analisar XML: ${msg.replace(/^Error:\s*/, '')}`,
        })
      }
      continue
    }

    // 2. Planilha XLSX, XLS ou CSV dentro do zip
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
      try {
        const planilhaBuffer = await zipEntry.async('arraybuffer')
        const XLSX = await loadSheetJS()
        const wb = XLSX.read(planilhaBuffer, { type: 'array' })

        let chosenSheet = wb.SheetNames[0]
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName]
          if (!ws) continue
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
          if (rows.length > 0) {
            chosenSheet = sheetName
            break
          }
        }

        const ws = wb.Sheets[chosenSheet]
        if (!ws) {
          arquivosNaoReconhecidos.push({
            nome: nomeBase,
            caminho: entryPath,
            motivo: 'Planilha sem abas com dados válidos',
          })
          continue
        }

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        const colunas = rows.length > 0 ? Object.keys(rows[0]) : []
        const mapa = autoMapearColunasNfse(colunas)
        const notasDaPlanilha = parsePlanilhaNfse(rows, mapa)

        if (notasDaPlanilha.length === 0) {
          arquivosNaoReconhecidos.push({
            nome: nomeBase,
            caminho: entryPath,
            motivo: 'Nenhuma nota fiscal encontrada nas linhas da planilha',
          })
        } else {
          notas.push(...notasDaPlanilha)
          arquivosProcessados.push({
            nome: nomeBase,
            tipo: 'planilha',
            qtdNotas: notasDaPlanilha.length,
          })
          // Guarda linhas para conferência de mapeamento se for a primeira planilha
          if (linhasPlanilhaBrutas.length === 0) {
            linhasPlanilhaBrutas = rows
            colunasDetectadasPlanilha = colunas
            mapaColunasPlanilha = mapa
          }
        }
      } catch (planilhaErr: unknown) {
        const msg = planilhaErr instanceof Error ? planilhaErr.message : String(planilhaErr)
        arquivosNaoReconhecidos.push({
          nome: nomeBase,
          caminho: entryPath,
          motivo: `Erro ao ler planilha: ${msg.replace(/^Error:\s*/, '')}`,
        })
      }
      continue
    }

    // 3. Outros formatos (PDFs de DANFE, TXT, imagens etc.)
    if (lower.endsWith('.pdf')) {
      arquivosNaoReconhecidos.push({
        nome: nomeBase,
        caminho: entryPath,
        motivo: 'DANFE em PDF ignorado (o importador utiliza o XML ou planilha da NFS-e)',
      })
    } else {
      arquivosNaoReconhecidos.push({
        nome: nomeBase,
        caminho: entryPath,
        motivo: 'Formato não suportado (aceitos: XML, XLSX, CSV)',
      })
    }
  }

  return {
    notas,
    arquivosNaoReconhecidos,
    arquivosProcessados,
    linhasPlanilhaBrutas,
    colunasDetectadasPlanilha,
    mapaColunasPlanilha,
  }
}

/**
 * Deduplica notas extraídas dentro do lote baseado na chave única da nota:
 * "numero_prestador" (ou número puro se prestador não informado)
 */
export function deduplicarNotasLote(notas: NfseDadoExtraido[]): {
  unicas: NfseDadoExtraido[]
  duplicadasNoLote: number
} {
  const vistos = new Set<string>()
  const unicas: NfseDadoExtraido[] = []
  let duplicadasNoLote = 0

  for (const n of notas) {
    const chave = `${(n.numero || '').trim().toLowerCase()}_${(n.prestadorCnpjCpf || '').trim().toLowerCase()}`
    if (vistos.has(chave)) {
      duplicadasNoLote++
      continue
    }
    vistos.add(chave)
    unicas.push(n)
  }

  return { unicas, duplicadasNoLote }
}

/**
 * Processa múltiplos arquivos enviados de uma só vez (combinação de ZIPs, XMLs e planilhas).
 */
export async function processarArquivosEmLote(
  files: File[],
): Promise<ResultadoProcessamentoLoteNfse> {
  if (!files || files.length === 0) {
    throw new Error('Nenhum arquivo selecionado para importação.')
  }

  const todasNotas: NfseDadoExtraido[] = []
  const arquivosNaoReconhecidos: ArquivoNaoReconhecido[] = []
  const arquivosProcessados: ArquivoLoteEstatistica[] = []
  let temPlanilhas = false
  let linhasPlanilhaBrutas: Record<string, unknown>[] = []
  let colunasDetectadasPlanilha: string[] = []
  let mapaColunasPlanilha: Record<string, string> = {}

  for (const file of files) {
    const lower = file.name.toLowerCase()

    // 1. Arquivo ZIP
    if (lower.endsWith('.zip')) {
      try {
        const resultadoZip = await extrairNotasDeZip(file, file.name)
        todasNotas.push(...resultadoZip.notas)
        arquivosNaoReconhecidos.push(...resultadoZip.arquivosNaoReconhecidos)
        arquivosProcessados.push(...resultadoZip.arquivosProcessados)

        if (resultadoZip.linhasPlanilhaBrutas.length > 0) {
          temPlanilhas = true
          if (linhasPlanilhaBrutas.length === 0) {
            linhasPlanilhaBrutas = resultadoZip.linhasPlanilhaBrutas
            colunasDetectadasPlanilha = resultadoZip.colunasDetectadasPlanilha
            mapaColunasPlanilha = resultadoZip.mapaColunasPlanilha
          }
        }
      } catch (zipErr: unknown) {
        const msg = zipErr instanceof Error ? zipErr.message : String(zipErr)
        arquivosNaoReconhecidos.push({
          nome: file.name,
          motivo: msg.replace(/^Error:\s*/, ''),
          tamanho: file.size,
        })
      }
      continue
    }

    // 2. Arquivo XML individual
    if (lower.endsWith('.xml')) {
      try {
        const xmlTexto = await file.text()
        const notasDoXml = parseXmlNfse(xmlTexto, file.name)

        if (notasDoXml.length === 0) {
          arquivosNaoReconhecidos.push({
            nome: file.name,
            motivo: 'Arquivo XML sem estrutura reconhecida de NFS-e (ABRASF/GDF)',
            tamanho: file.size,
          })
        } else {
          todasNotas.push(...notasDoXml)
          arquivosProcessados.push({
            nome: file.name,
            tipo: 'xml',
            qtdNotas: notasDoXml.length,
          })
        }
      } catch (xmlErr: unknown) {
        const msg = xmlErr instanceof Error ? xmlErr.message : String(xmlErr)
        arquivosNaoReconhecidos.push({
          nome: file.name,
          motivo: `Erro no XML: ${msg.replace(/^Error:\s*/, '')}`,
          tamanho: file.size,
        })
      }
      continue
    }

    // 3. Planilha XLSX, XLS ou CSV individual
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
      try {
        const XLSX = await loadSheetJS()
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })

        let chosenSheet = wb.SheetNames[0]
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName]
          if (!ws) continue
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
          if (rows.length > 0) {
            chosenSheet = sheetName
            break
          }
        }

        const ws = wb.Sheets[chosenSheet]
        if (!ws) {
          arquivosNaoReconhecidos.push({
            nome: file.name,
            motivo: 'Planilha sem abas válidas',
            tamanho: file.size,
          })
          continue
        }

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        const colunas = rows.length > 0 ? Object.keys(rows[0]) : []
        const mapa = autoMapearColunasNfse(colunas)
        const notasDaPlanilha = parsePlanilhaNfse(rows, mapa)

        if (notasDaPlanilha.length === 0) {
          arquivosNaoReconhecidos.push({
            nome: file.name,
            motivo: 'Nenhuma nota fiscal encontrada nas linhas da planilha',
            tamanho: file.size,
          })
        } else {
          todasNotas.push(...notasDaPlanilha)
          arquivosProcessados.push({
            nome: file.name,
            tipo: 'planilha',
            qtdNotas: notasDaPlanilha.length,
          })
          temPlanilhas = true
          if (linhasPlanilhaBrutas.length === 0) {
            linhasPlanilhaBrutas = rows
            colunasDetectadasPlanilha = colunas
            mapaColunasPlanilha = mapa
          }
        }
      } catch (planilhaErr: unknown) {
        const msg = planilhaErr instanceof Error ? planilhaErr.message : String(planilhaErr)
        arquivosNaoReconhecidos.push({
          nome: file.name,
          motivo: `Erro ao ler planilha: ${msg.replace(/^Error:\s*/, '')}`,
          tamanho: file.size,
        })
      }
      continue
    }

    // 4. Outros formatos não aceitos
    arquivosNaoReconhecidos.push({
      nome: file.name,
      motivo: 'Formato não suportado. Aceitos: .zip, .xml, .xlsx, .xls, .csv',
      tamanho: file.size,
    })
  }

  // Deduplicar notas dentro do lote para evitar duplicidade de notas repetidas em múltiplos XMLs/zips
  const { unicas } = deduplicarNotasLote(todasNotas)

  return {
    notas: unicas,
    arquivosNaoReconhecidos,
    arquivosProcessados,
    totalArquivosLidos: files.length,
    totalNotasExtraidas: unicas.length,
    temPlanilhas,
    linhasPlanilhaBrutas,
    colunasDetectadasPlanilha,
    mapaColunasPlanilha,
  }
}
