/**
 * Scanner e Decodificador de QR Code Fiscal Brasileiro (NFC-e / SAT-CF-e / DANFE)
 * Processa imagens (JPG, PNG, WEBP) e documentos PDF no navegador.
 *
 * Padrões suportados:
 * 1. NFC-e SEFAZ: URL com query param de chave de acesso (p=..., chNFe=..., C=...).
 * 2. SAT CF-e (SP/CE): string formatada com delimitador pipe:
 *    chave_consulta|data_hora|valor_total|CPF_ou_CNPJ|campo_assinaturaQRCODE
 * 3. DANFE NF-e (Ato Concessório / QR Code adicional da NF-e).
 */

import { loadJsQR } from '@/services/jsqrLoader'
import { loadPdfJs } from '@/services/pdfJsLoader'
import type { ComprovanteExtraido } from '@/services/comprovantesVision'

export interface DadosChaveDecomposta {
  chave: string
  uf: string
  ano_mes: string
  data_aproximada: string
  cnpj_emitente: string
  cnpj_cru: string
  modelo: string
  tipo_documento: 'nfe' | 'cupom_fiscal'
  serie: string
  numero_documento: string
}

export interface ResultadoLeituraQr {
  sucesso: boolean
  qrEncontrado: boolean
  conteudoBruto?: string
  chaveAcesso?: string
  dadosDecompostos?: DadosChaveDecomposta | null
  origemPadrao?: 'sat_pipe' | 'sefaz_url' | 'chave_direta' | 'desconhecido'
  dadosSugeridos?: Partial<ComprovanteExtraido>
  mensagem: string
}

const TABELA_UF_IBGE: Record<string, string> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
}

/**
 * Extrai chave de acesso de 44 dígitos numéricos de qualquer texto / URL / QR Code
 */
export function extrairChaveAcesso44(texto: string): string {
  if (!texto) return ''

  // 1. Procura sequência contínua de 44 dígitos
  const matchContinuo = texto.match(/\b\d{44}\b/)
  if (matchContinuo) return matchContinuo[0]

  // 2. Parâmetro chNFe, chave, p, C na query string
  const matchParam = texto.match(/(?:chNFe|chave|p|C)=([0-9]{44})/i)
  if (matchParam) return matchParam[1]

  // 3. Padrão SEFAZ v2: p=35...|2|1|1|...
  const matchP2 = texto.match(/[?&]p=([0-9]{44})[|%7C]/i)
  if (matchP2) return matchP2[1]

  return ''
}

/**
 * Decompõe a chave de 44 dígitos nos seus campos oficiais de acordo com o manual da NF-e / NFC-e:
 * cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)
 */
export function decomporChaveAcesso(chave: string): DadosChaveDecomposta | null {
  const chaveLimpa = chave.replace(/\D/g, '')
  if (chaveLimpa.length !== 44) return null

  const cUF = chaveLimpa.substring(0, 2)
  const aamm = chaveLimpa.substring(2, 6)
  const ano = '20' + aamm.substring(0, 2)
  const mes = aamm.substring(2, 4)
  const cnpjCru = chaveLimpa.substring(6, 20)
  const modelo = chaveLimpa.substring(20, 22)
  const serie = chaveLimpa.substring(22, 25).replace(/^0+/, '') || '1'
  const nNF = chaveLimpa.substring(25, 34).replace(/^0+/, '') || ''

  const cnpjFmt = cnpjCru.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  const tipoDoc = modelo === '65' || modelo === '59' ? 'cupom_fiscal' : 'nfe'

  return {
    chave: chaveLimpa,
    uf: TABELA_UF_IBGE[cUF] || cUF,
    ano_mes: `${ano}-${mes}`,
    data_aproximada: `${ano}-${mes}-01`,
    cnpj_emitente: cnpjFmt,
    cnpj_cru: cnpjCru,
    modelo,
    tipo_documento: tipoDoc,
    serie,
    numero_documento: nNF,
  }
}

/**
 * Analisa e extrai informações estruturadas da string bruta decodificada de um QR code
 */
export function interpretarConteudoQr(qrString: string): ResultadoLeituraQr {
  const texto = (qrString || '').trim()
  if (!texto) {
    return {
      sucesso: false,
      qrEncontrado: false,
      mensagem: 'Conteúdo do QR code vazio.',
    }
  }

  // CASO 1: SAT CF-e (padrão com pipes "|")
  if (texto.includes('|') && !texto.startsWith('http')) {
    const partes = texto.split('|')
    const chaveSat = extrairChaveAcesso44(partes[0] || '')
    const dataHoraStr = partes[1] || '' // AAAAMMDDHHMMSS
    const valorSatStr = partes[2] || ''
    const cpfCnpjDest = partes[3] || ''

    let dataEmissaoSat = new Date().toISOString().slice(0, 10)
    if (dataHoraStr.length >= 8) {
      dataEmissaoSat = `${dataHoraStr.substring(0, 4)}-${dataHoraStr.substring(4, 6)}-${dataHoraStr.substring(6, 8)}`
    }

    const valorTotalNum = parseFloat(valorSatStr.replace(',', '.')) || 0
    const decomposto = chaveSat ? decomporChaveAcesso(chaveSat) : null

    return {
      sucesso: true,
      qrEncontrado: true,
      conteudoBruto: texto,
      chaveAcesso: chaveSat,
      dadosDecompostos: decomposto,
      origemPadrao: 'sat_pipe',
      dadosSugeridos: {
        tipo_documento: 'cupom_fiscal',
        fornecedor: decomposto ? `Fornecedor CNPJ ${decomposto.cnpj_emitente}` : '',
        cnpj_cpf: decomposto ? decomposto.cnpj_emitente : '',
        data_emissao: dataEmissaoSat,
        numero_documento: decomposto ? decomposto.numero_documento : '',
        serie: decomposto ? decomposto.serie : '',
        valor_total: valorTotalNum,
        valor_impostos: null,
        forma_pagamento_sugerida: 'pix',
        categoria_sugerida: 'despesas_operacionais',
        plano_contas_codigo: '3.1.4',
        plano_contas_nome: 'Despesas de Viagens e Campo',
        descricao_itens: 'Despesa Cupom Fiscal Eletrônico SAT (Extrato)',
        observacoes: chaveSat ? `Chave SAT: ${chaveSat}` : '',
        confianca: 'alta',
      },
      mensagem: 'QR Code do SAT CF-e decodificado com sucesso!',
    }
  }

  // CASO 2: URL de SEFAZ (NFC-e / DANFE)
  const chave = extrairChaveAcesso44(texto)
  const decomposto = chave ? decomporChaveAcesso(chave) : null

  if (chave && decomposto) {
    const isNfce = decomposto.modelo === '65'
    return {
      sucesso: true,
      qrEncontrado: true,
      conteudoBruto: texto,
      chaveAcesso: chave,
      dadosDecompostos: decomposto,
      origemPadrao: texto.startsWith('http') ? 'sefaz_url' : 'chave_direta',
      dadosSugeridos: {
        tipo_documento: decomposto.tipo_documento,
        fornecedor: `Fornecedor CNPJ ${decomposto.cnpj_emitente}`,
        cnpj_cpf: decomposto.cnpj_emitente,
        data_emissao: decomposto.data_aproximada,
        numero_documento: decomposto.numero_documento,
        serie: decomposto.serie,
        valor_total: 0,
        valor_impostos: null,
        forma_pagamento_sugerida: 'pix',
        categoria_sugerida: 'despesas_operacionais',
        plano_contas_codigo: isNfce ? '3.1.4' : '3.1.1',
        plano_contas_nome: isNfce
          ? 'Despesas de Viagens e Campo'
          : 'Despesas Administrativas Gerais & Escritório',
        descricao_itens: `${isNfce ? 'NFC-e' : 'DANFE NF-e'} nº ${decomposto.numero_documento} (${decomposto.uf})`,
        observacoes: `Chave de Acesso: ${chave}`,
        confianca: 'media',
      },
      mensagem: `Chave de acesso de 44 dígitos identificada no QR Code (${decomposto.uf} / ${decomposto.tipo_documento.toUpperCase()}).`,
    }
  }

  // Caso genérico onde leu algo que não é chave SEFAZ nem SAT
  return {
    sucesso: true,
    qrEncontrado: true,
    conteudoBruto: texto,
    origemPadrao: 'desconhecido',
    dadosSugeridos: {
      tipo_documento: 'outro',
      observacoes: `Conteúdo lido do QR Code: ${texto}`,
      confianca: 'baixa',
    },
    mensagem: 'QR Code lido, mas sem formato padrão de 44 dígitos de NF-e/NFC-e/SAT.',
  }
}

/**
 * Tenta ler o QR Code de um Canvas usando jsQR com múltiplas resoluções e tentativas de inversão
 */
function tentarLerQrCanvas(
  canvas: HTMLCanvasElement,
  jsQR: ReturnType<typeof loadJsQR> extends Promise<infer T> ? T : never,
): string | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  const w = canvas.width
  const h = canvas.height
  const imgData = ctx.getImageData(0, 0, w, h)

  // 1. Tentativa direta na imagem completa
  const code = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' })
  if (code && code.data && code.data.trim()) {
    return code.data.trim()
  }

  // 2. Foco na metade inferior (onde normalmente fica o QR Code da NFC-e e SAT)
  try {
    const halfH = Math.floor(h / 2)
    const lowerData = ctx.getImageData(0, halfH, w, h - halfH)
    const codeLower = jsQR(lowerData.data, w, h - halfH, { inversionAttempts: 'attemptBoth' })
    if (codeLower && codeLower.data && codeLower.data.trim()) {
      return codeLower.data.trim()
    }
  } catch {
    /* intentionally ignored */
  }

  // 3. Foco no quadrante inferior direito (comum em DANFE NF-e e cupons)
  try {
    const halfW = Math.floor(w / 2)
    const halfH = Math.floor(h / 2)
    const quadData = ctx.getImageData(halfW, halfH, w - halfW, h - halfH)
    const codeQuad = jsQR(quadData.data, w - halfW, h - halfH, {
      inversionAttempts: 'attemptBoth',
    })
    if (codeQuad && codeQuad.data && codeQuad.data.trim()) {
      return codeQuad.data.trim()
    }
  } catch {
    /* intentionally ignored */
  }

  return null
}

/**
 * Carrega arquivo de imagem em Canvas para leitura do QR Code
 */
async function canvasDeImagem(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      // Limita dimensões máximas a 2560px para não estourar memória do canvas mantendo nitidez
      let w = img.naturalWidth || img.width
      let h = img.naturalHeight || img.height
      const maxDim = 2560
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h)
        w = Math.round(w * ratio)
        h = Math.round(h * ratio)
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        reject(new Error('Falha ao obter contexto 2d'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(new Error(`Falha ao carregar imagem para canvas: ${e}`))
    }
    img.src = url
  })
}

/**
 * Rasteriza a primeira página de um arquivo PDF em um Canvas
 */
async function canvasDePdf(file: File): Promise<HTMLCanvasElement> {
  const pdfLib = await loadPdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfLib.getDocument({ data: new Uint8Array(arrayBuffer) })
  const pdfDoc = await loadingTask.promise
  const page = await pdfDoc.getPage(1)

  // Escala 2.0 garante resolução nítida suficiente para o jsQR decodificar o código
  const viewport = page.getViewport({ scale: 2.0 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Falha ao criar canvas do PDF')
  }

  const renderContext = {
    canvasContext: ctx,
    viewport: { width: viewport.width, height: viewport.height },
  }

  await page.render(renderContext).promise
  return canvas
}

/**
 * Função principal: detecta e decodifica o QR code a partir de qualquer imagem ou PDF
 */
export async function escanearQrCodeDocumento(file: File): Promise<ResultadoLeituraQr> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  try {
    const jsQR = await loadJsQR()

    let canvas: HTMLCanvasElement
    if (isPdf) {
      canvas = await canvasDePdf(file)
    } else {
      canvas = await canvasDeImagem(file)
    }

    const qrRaw = tentarLerQrCanvas(canvas, jsQR)

    if (!qrRaw) {
      return {
        sucesso: false,
        qrEncontrado: false,
        mensagem:
          'Nenhum QR Code detectado nesta imagem ou página do PDF. Você pode prosseguir com a leitura visual com IA ou preenchimento manual.',
      }
    }

    return interpretarConteudoQr(qrRaw)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[QRScanner] Falha na decodificação do QR:', msg)
    return {
      sucesso: false,
      qrEncontrado: false,
      mensagem: `Não foi possível processar o QR Code (${msg}). Prosseguindo com OCR visual.`,
    }
  }
}
