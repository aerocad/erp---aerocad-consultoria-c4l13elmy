import pb from '@/lib/pocketbase/client'
import { loadPdfJs } from '@/services/pdfJsLoader'
import type { OfxTransacaoParsed } from './extratoOfxParser'

export interface ExtratoPdfExtracaoProgresso {
  etapa: 'preparando' | 'rasterizando' | 'ia' | 'concluido' | 'erro'
  mensagem: string
  paginaAtual?: number
  totalPaginas?: number
  percentual?: number
}

export interface ExtratoPdfParsed {
  banco?: string
  agencia?: string
  conta?: string
  dataInicio?: string
  dataFim?: string
  saldoFinal?: number
  totalTransacoes: number
  totalEntradas: number
  totalSaidas: number
  transacoes: OfxTransacaoParsed[]
  linhasNaoInterpretadas?: number
  aviso?: string | null
  sucesso: boolean
  rasterizado?: boolean
}

/**
 * Converte uma página de PDF em canvas e extrai imagem JPEG
 */
async function rasterizarPaginaPdfParaBlob(
  pdfDoc: any,
  pageNumber: number,
  scale = 1.75,
): Promise<Blob> {
  const page = await pdfDoc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Falha ao instanciar canvas 2D para PDF')

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('Falha ao exportar canvas para Blob'))
      },
      'image/jpeg',
      0.92,
    )
  })
}

/**
 * Extrai texto textual nativo da página via PDF.js caso haja camada selecionável
 */
async function extrairTextoPaginaPdf(pdfDoc: any, pageNumber: number): Promise<string> {
  try {
    const page = await pdfDoc.getPage(pageNumber)
    const textContent = await page.getTextContent()
    if (!textContent || !Array.isArray(textContent.items)) return ''

    let text = ''
    let lastY: number | null = null

    for (const item of textContent.items) {
      if (!('str' in item)) continue
      const str = item.str
      const transform = item.transform
      const currentY = transform && transform[5] ? Math.round(transform[5]) : null

      if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
        text += '\n'
      } else if (text.length > 0 && !text.endsWith('\n') && !text.endsWith(' ')) {
        text += ' '
      }

      text += str
      lastY = currentY
    }

    return text.trim()
  } catch (err) {
    console.warn(`[extratoPdfParser] Erro ao extrair texto da página ${pageNumber}:`, err)
    return ''
  }
}

/**
 * Envia um arquivo ou página para o endpoint de IA de extratos
 */
async function enviarParaIaExtrato(
  fileOrBlob: File | Blob,
  fileName: string,
  textoPagina?: string,
): Promise<{ sucesso: boolean; dados?: any; aviso?: string; error?: string }> {
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL
  const formData = new FormData()

  if (fileOrBlob instanceof File) {
    formData.append('arquivo', fileOrBlob)
  } else {
    formData.append('arquivo', fileOrBlob, fileName)
  }

  if (textoPagina) {
    formData.append('texto_pagina', textoPagina)
  }

  const res = await fetch(`${baseUrl}/backend/v1/extratos/extrair-pdf`, {
    method: 'POST',
    headers: {
      Authorization: pb.authStore.token,
    },
    body: formData,
  })

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}))
    throw new Error(errJson?.error || `Falha HTTP ${res.status} ao extrair extrato por IA`)
  }

  return await res.json()
}

/**
 * Função principal para extrair transações de um arquivo PDF de extrato bancário.
 * Suporta extração direta via texto / $documents.toMarkdown e processamento página a página
 * via rasterização quando necessário.
 */
export async function extrairExtratoPdf(
  file: File,
  onProgress?: (p: ExtratoPdfExtracaoProgresso) => void,
): Promise<ExtratoPdfParsed> {
  onProgress?.({
    etapa: 'preparando',
    mensagem: `Carregando extrato "${file.name}"...`,
    percentual: 5,
  })

  let pdfDoc: any = null
  let totalPaginas = 1

  try {
    const pdfLib = await loadPdfJs()
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfLib.getDocument({ data: new Uint8Array(arrayBuffer) })
    pdfDoc = await loadingTask.promise
    totalPaginas = pdfDoc.numPages || 1
  } catch (pdfErr) {
    console.warn('[extratoPdfParser] PDF.js indisponível para contagem de páginas:', pdfErr)
  }

  // Se o PDF tiver apenas 1 ou 2 páginas e conseguirmos ler o texto nativo diretamente
  let textoCamadas = ''
  if (pdfDoc && totalPaginas > 0) {
    for (let p = 1; p <= Math.min(totalPaginas, 10); p++) {
      const txt = await extrairTextoPaginaPdf(pdfDoc, p)
      if (txt) {
        textoCamadas += `--- PÁGINA ${p} ---\n${txt}\n\n`
      }
    }
  }

  // Se tem camada de texto selecionável ou PDF pequeno (até 5 páginas), processa em lote direto
  if (textoCamadas.trim().length > 100 || totalPaginas <= 2 || !pdfDoc) {
    onProgress?.({
      etapa: 'ia',
      mensagem: `Analisando extrato bancário com IA de visão e documentos...`,
      percentual: 50,
      totalPaginas,
    })

    try {
      const res = await enviarParaIaExtrato(file, file.name, textoCamadas || undefined)
      if (
        res.sucesso &&
        res.dados &&
        Array.isArray(res.dados.transacoes) &&
        res.dados.transacoes.length > 0
      ) {
        const dados = res.dados
        onProgress?.({
          etapa: 'concluido',
          mensagem: `${dados.transacoes.length} transações identificadas com sucesso!`,
          percentual: 100,
        })

        return {
          sucesso: true,
          banco: dados.banco,
          agencia: dados.agencia,
          conta: dados.conta,
          dataInicio: dados.dataInicio,
          dataFim: dados.dataFim,
          saldoFinal: dados.saldoFinal,
          totalTransacoes: dados.totalTransacoes || dados.transacoes.length,
          totalEntradas: dados.totalEntradas || 0,
          totalSaidas: dados.totalSaidas || 0,
          transacoes: dados.transacoes,
          linhasNaoInterpretadas: dados.linhasNaoInterpretadas || 0,
          aviso: res.aviso,
          rasterizado: false,
        }
      }
    } catch (fastErr) {
      console.warn('[extratoPdfParser] Tentativa direta falhou, tentando rasterização:', fastErr)
    }
  }

  // Processamento página a página para PDFs maiores ou escaneados (sem camada de texto limpa)
  const todasTransacoes: OfxTransacaoParsed[] = []
  let bancoDetectado = ''
  let contaDetectada = ''
  let agenciaDetectada = ''
  let saldoFinalDetectado: number | undefined
  let dataInicioDetectada: string | undefined
  let dataFimDetectada: string | undefined
  let totalEntradas = 0
  let totalSaidas = 0
  let linhasNaoLidas = 0

  const maxPaginasProcessar = Math.min(totalPaginas, 15) // segurança contra estouro de limites

  for (let p = 1; p <= maxPaginasProcessar; p++) {
    onProgress?.({
      etapa: 'rasterizando',
      mensagem: `Processando página ${p} de ${maxPaginasProcessar}...`,
      paginaAtual: p,
      totalPaginas: maxPaginasProcessar,
      percentual: Math.round(10 + (p / maxPaginasProcessar) * 80),
    })

    try {
      let blobPagina: Blob | null = null
      if (pdfDoc) {
        blobPagina = await rasterizarPaginaPdfParaBlob(pdfDoc, p)
      }

      const txtPagina = pdfDoc ? await extrairTextoPaginaPdf(pdfDoc, p) : ''
      const resPagina = await enviarParaIaExtrato(
        blobPagina || file,
        `${file.name}_pag_${p}.jpg`,
        txtPagina || undefined,
      )

      if (resPagina.sucesso && resPagina.dados) {
        const d = resPagina.dados
        if (!bancoDetectado && d.banco) bancoDetectado = d.banco
        if (!contaDetectada && d.conta) contaDetectada = d.conta
        if (!agenciaDetectada && d.agencia) agenciaDetectada = d.agencia
        if (d.saldoFinal) saldoFinalDetectado = d.saldoFinal
        if (d.dataInicio && (!dataInicioDetectada || d.dataInicio < dataInicioDetectada)) {
          dataInicioDetectada = d.dataInicio
        }
        if (d.dataFim && (!dataFimDetectada || d.dataFim > dataFimDetectada)) {
          dataFimDetectada = d.dataFim
        }

        if (Array.isArray(d.transacoes)) {
          for (const tx of d.transacoes) {
            todasTransacoes.push({
              ...tx,
              fitid: tx.fitid || `PDF_P${p}_${todasTransacoes.length + 1}_${tx.valor}`,
            })
            if (tx.tipo === 'entrada') totalEntradas += tx.valor
            else totalSaidas += tx.valor
          }
        }

        if (d.linhasNaoInterpretadas) {
          linhasNaoLidas += d.linhasNaoInterpretadas
        }
      }
    } catch (pageErr) {
      console.warn(`[extratoPdfParser] Falha na página ${p}:`, pageErr)
      linhasNaoLidas++
    }
  }

  const sucessoGeral = todasTransacoes.length > 0

  onProgress?.({
    etapa: sucessoGeral ? 'concluido' : 'erro',
    mensagem: sucessoGeral
      ? `${todasTransacoes.length} movimentações extraídas com sucesso!`
      : 'Não foi possível extrair transações deste PDF. Importe o arquivo OFX ou RET do banco.',
    percentual: 100,
  })

  return {
    sucesso: sucessoGeral,
    banco: bancoDetectado || 'Banco Comercial PJ',
    agencia: agenciaDetectada,
    conta: contaDetectada,
    dataInicio: dataInicioDetectada || new Date().toISOString().slice(0, 10),
    dataFim: dataFimDetectada || new Date().toISOString().slice(0, 10),
    saldoFinal: saldoFinalDetectado || 0,
    totalTransacoes: todasTransacoes.length,
    totalEntradas: Number(totalEntradas.toFixed(2)),
    totalSaidas: Number(totalSaidas.toFixed(2)),
    transacoes: todasTransacoes,
    linhasNaoInterpretadas: linhasNaoLidas,
    aviso: sucessoGeral
      ? null
      : 'Não foi possível extrair as movimentações deste PDF. Confira as transações na conferência ou importe o OFX/.RET do banco, que é mais preciso.',
    rasterizado: true,
  }
}
