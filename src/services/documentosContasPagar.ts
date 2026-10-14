import pb from '@/lib/pocketbase/client'
import type { ContaPagarRecord, TipoDocumentoSegregado, DocumentoMetadadoItem } from '@/types/crm'

export const TIPO_DOCUMENTO_SEGREGADO_CONFIG: Record<
  TipoDocumentoSegregado,
  {
    label: string
    shortLabel: string
    natureza: 'cobranca' | 'liquidacao' | 'fiscal' | 'contratual' | 'outro'
    naturezaLabel: string
    tone: 'blue' | 'green' | 'amber' | 'purple' | 'gray' | 'red'
    badgeBg: string
    badgeText: string
    badgeBorder: string
    icon: string
    chipBg: string
    chipText: string
    chipBorder: string
    descricaoPapel: string
  }
> = {
  boleto: {
    label: 'Boleto Bancário (Cobrança)',
    shortLabel: 'Boleto',
    natureza: 'cobranca',
    naturezaLabel: 'Cobrança a Pagar',
    tone: 'amber',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-950 font-bold',
    badgeBorder: 'border-amber-400 shadow-xs',
    chipBg: 'bg-amber-500 text-white',
    chipText: 'text-white font-bold',
    chipBorder: 'border-amber-600',
    icon: 'Barcode',
    descricaoPapel: 'Título de cobrança / linha digitável (a pagar)',
  },
  comprovante_pix: {
    label: 'Comprovante PIX / TED (Liquidação)',
    shortLabel: 'Comprovante PIX/TED',
    natureza: 'liquidacao',
    naturezaLabel: 'Pagamento Efetivado',
    tone: 'green',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-950 font-bold',
    badgeBorder: 'border-emerald-400 shadow-xs',
    chipBg: 'bg-emerald-600 text-white',
    chipText: 'text-white font-bold',
    chipBorder: 'border-emerald-700',
    icon: 'ArrowLeftRight',
    descricaoPapel: 'Comprovante de pagamento bancário já liquidado',
  },
  recibo: {
    label: 'Recibo de Quitação',
    shortLabel: 'Recibo',
    natureza: 'liquidacao',
    naturezaLabel: 'Quitação Efetuada',
    tone: 'purple',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-950 font-bold',
    badgeBorder: 'border-purple-300',
    chipBg: 'bg-purple-600 text-white',
    chipText: 'text-white font-bold',
    chipBorder: 'border-purple-700',
    icon: 'Receipt',
    descricaoPapel: 'Declaração formal de quitação assinada',
  },
  nota_fiscal: {
    label: 'Nota Fiscal (NF-e / NFS-e)',
    shortLabel: 'Nota Fiscal',
    natureza: 'fiscal',
    naturezaLabel: 'Documento Fiscal',
    tone: 'blue',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-950 font-semibold',
    badgeBorder: 'border-sky-300',
    chipBg: 'bg-sky-600 text-white',
    chipText: 'text-white font-semibold',
    chipBorder: 'border-sky-700',
    icon: 'FileText',
    descricaoPapel: 'Nota fiscal de serviços ou mercadorias',
  },
  contrato: {
    label: 'Contrato / Ordem de Compra',
    shortLabel: 'Contrato',
    natureza: 'contratual',
    naturezaLabel: 'Instrumento Contratual',
    tone: 'gray',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800 font-semibold',
    badgeBorder: 'border-slate-300',
    chipBg: 'bg-slate-700 text-white',
    chipText: 'text-white font-medium',
    chipBorder: 'border-slate-800',
    icon: 'FileSpreadsheet',
    descricaoPapel: 'Instrumento contratual, proposta ou aditivo',
  },
  outro: {
    label: 'Outro / Não classificado',
    shortLabel: 'Não classificado',
    natureza: 'outro',
    naturezaLabel: 'Pendente de Classificação',
    tone: 'gray',
    badgeBg: 'bg-neutral-100',
    badgeText: 'text-neutral-700',
    badgeBorder: 'border-neutral-300 border-dashed',
    chipBg: 'bg-neutral-600 text-white',
    chipText: 'text-neutral-200',
    chipBorder: 'border-neutral-400',
    icon: 'HelpCircle',
    descricaoPapel: 'Arquivo sem indicação clara no nome (necessita classificação manual)',
  },
}

/**
 * Heurística criteriosa para classificar o tipo de documento.
 * Se o arquivo for scan genérico (ex: scan001.pdf, foto.jpg, img_1234, doc.pdf)
 * sem palavra-chave específica, retorna "outro" para exigir classificação manual explícita.
 */
export function detectarTipoDocumentoHeuristica(
  nomeArquivo: string,
  extra?: { temLinhaDigitavel?: boolean; textoExtraido?: string },
): TipoDocumentoSegregado {
  if (extra?.temLinhaDigitavel) {
    return 'boleto'
  }

  const nomeLimpo = (nomeArquivo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // remove extensão final
    .replace(/\.[a-z0-9]+$/i, '')
    // troca separadores por espaço para isolamento de tokens
    .replace(/[._\-+/\\(),;:]/g, ' ')
    .trim()

  const tokens = nomeLimpo.split(/\s+/).filter(Boolean)
  const textoCompleto = ` ${tokens.join(' ')} `

  // Extra extra: se passou texto extraído com linha digitável
  if (extra?.textoExtraido) {
    const textoUpper = extra.textoExtraido.toUpperCase()
    if (
      textoUpper.includes('LINHA DIGITAVEL') ||
      textoUpper.includes('CODIGO DE BARRAS') ||
      textoUpper.includes('RECIBO DO SACADO')
    ) {
      return 'boleto'
    }
  }

  // 1. BOLETO / GUIA DE COBRANÇA
  // "boleto", "bloqueto", "guia", "fatura", "dam", "dae", "darf", "gps", "das", "cobranca", "duplicata", "linha digitavel"
  const ehBoleto =
    tokens.some((t) =>
      [
        'boleto',
        'bloqueto',
        'guia',
        'guias',
        'fatura',
        'faturas',
        'dam',
        'dae',
        'darf',
        'gps',
        'das',
        'cobranca',
        'duplicata',
      ].includes(t),
    ) ||
    textoCompleto.includes(' boleto ') ||
    textoCompleto.includes(' bloqueto ') ||
    textoCompleto.includes(' fatura ') ||
    textoCompleto.includes(' linha digitavel ') ||
    textoCompleto.includes(' guia de recolhimento ') ||
    textoCompleto.includes(' guia previdencia ') ||
    textoCompleto.includes(' guia darf ')

  if (ehBoleto) {
    return 'boleto'
  }

  // 2. COMPROVANTE DE PAGAMENTO / LIQUIDAÇÃO BANCÁRIA
  // "pix", "ted", "doc", "comprovante", "recibo de pagamento", "transferencia", "extrato"
  const ehComprovante =
    tokens.some((t) =>
      ['pix', 'ted', 'comprovante', 'comprovantes', 'transferencia', 'transf', 'extrato'].includes(
        t,
      ),
    ) ||
    textoCompleto.includes(' pix ') ||
    textoCompleto.includes(' ted ') ||
    textoCompleto.includes(' doc bancario ') ||
    textoCompleto.includes(' comprovante ') ||
    textoCompleto.includes(' comprovante pix ') ||
    textoCompleto.includes(' comprovante ted ') ||
    textoCompleto.includes(' comprovante de pagamento ') ||
    textoCompleto.includes(' comprovante de transferencia ') ||
    textoCompleto.includes(' recibo de pagamento ') ||
    textoCompleto.includes(' transferencia bancaria ') ||
    textoCompleto.includes(' extrato ') ||
    textoCompleto.includes(' pagamento efetuado ') ||
    textoCompleto.includes(' debito realizado ')

  if (ehComprovante) {
    return 'comprovante_pix'
  }

  // 3. RECIBO / QUITAÇÃO FORMAL
  const ehRecibo =
    tokens.some((t) =>
      ['recibo', 'recibos', 'quitacao', 'quitas', 'cupom', 'cupons'].includes(t),
    ) ||
    textoCompleto.includes(' termo de quitacao ') ||
    textoCompleto.includes(' declaracao de quitacao ')

  if (ehRecibo) {
    return 'recibo'
  }

  // 4. NOTA FISCAL
  const ehNotaFiscal =
    tokens.some((t) => ['danfe', 'nfse', 'nfe', 'nfs', 'nf', 'notafiscal', 'xml'].includes(t)) ||
    textoCompleto.includes(' nota fiscal ') ||
    textoCompleto.includes(' danfe ') ||
    textoCompleto.includes(' nfse ') ||
    textoCompleto.includes(' nfe ') ||
    textoCompleto.includes(' nf e ') ||
    textoCompleto.includes(' nfs e ')

  if (ehNotaFiscal) {
    return 'nota_fiscal'
  }

  // 5. CONTRATO / PROPOSTA
  const ehContrato =
    tokens.some((t) => ['contrato', 'aditivo', 'proposta', 'termo', 'os', 'ordem'].includes(t)) ||
    textoCompleto.includes(' contrato ') ||
    textoCompleto.includes(' aditivo contratual ') ||
    textoCompleto.includes(' ordem de compra ')

  if (ehContrato) {
    return 'contrato'
  }

  // 6. Se for nome genérico sem pista ("scan001", "foto", "img_1234", "documento", "arquivo", etc.)
  // Marca explicitamente como "outro" para exigir classificação manual
  return 'outro'
}

/**
 * Normaliza a lista de arquivos salvos no campo comprovante da conta a pagar
 * O PocketBase retorna string ou string[] dependendo se é multiple ou único legado
 */
export function extrairArquivosComprovante(conta: ContaPagarRecord): string[] {
  if (!conta.comprovante) return []
  if (Array.isArray(conta.comprovante)) {
    return conta.comprovante.filter(Boolean)
  }
  if (typeof conta.comprovante === 'string') {
    const limpo = conta.comprovante.trim()
    if (!limpo) return []
    // Se veio serializado em JSON
    if (limpo.startsWith('[') && limpo.endsWith(']')) {
      try {
        const parsed = JSON.parse(limpo)
        if (Array.isArray(parsed)) return parsed.filter(Boolean)
      } catch {
        // fallback
      }
    }
    return [limpo]
  }
  return []
}

/**
 * Segrega os documentos salvos em uma conta a pagar, associando o metadado
 * (tipo, nome amigável, tamanho) com a URL do PocketBase
 */
export interface DocumentoSegregadoVisualizacao {
  fileName: string
  url: string
  tipo: TipoDocumentoSegregado
  nomeOriginal: string
  tamanho?: number
  isImage: boolean
  isPdf: boolean
}

export function obterDocumentosSegregados(
  conta: ContaPagarRecord,
): DocumentoSegregadoVisualizacao[] {
  const arquivos = extrairArquivosComprovante(conta)
  if (arquivos.length === 0) return []

  const metadados: DocumentoMetadadoItem[] = Array.isArray(conta.comprovantes_metadados)
    ? conta.comprovantes_metadados
    : []

  return arquivos.map((file, idx) => {
    // Tenta encontrar metadado pelo nome do arquivo gravado ou por correspondência de índice
    const meta =
      metadados.find((m) => m.file === file) ||
      metadados.find(
        (m) => file.includes(m.file) || (m.nome_original && file.includes(m.nome_original)),
      ) ||
      metadados[idx]

    const tipo: TipoDocumentoSegregado =
      meta?.tipo || detectarTipoDocumentoHeuristica(meta?.nome_original || file)
    const nomeOriginal = meta?.nome_original || file.replace(/^[^_]+_[^_]+_/, '') // remove prefixos gerados
    const ext = file.split('.').pop()?.toLowerCase() || ''
    const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)
    const isPdf = ext === 'pdf'

    return {
      fileName: file,
      url: pb.files.getURL(conta, file),
      tipo,
      nomeOriginal,
      tamanho: meta?.tamanho,
      isImage,
      isPdf,
    }
  })
}
