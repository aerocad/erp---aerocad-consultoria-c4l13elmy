import pb from '@/lib/pocketbase/client'
import type { ContaPagarRecord, TipoDocumentoSegregado, DocumentoMetadadoItem } from '@/types/crm'

export const TIPO_DOCUMENTO_SEGREGADO_CONFIG: Record<
  TipoDocumentoSegregado,
  {
    label: string
    shortLabel: string
    tone: 'blue' | 'green' | 'amber' | 'purple' | 'gray' | 'red'
    badgeBg: string
    badgeText: string
    badgeBorder: string
    icon: string
  }
> = {
  boleto: {
    label: 'Boleto Bancário',
    shortLabel: 'Boleto',
    tone: 'amber',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    icon: 'Barcode',
  },
  nota_fiscal: {
    label: 'Nota Fiscal (NF-e / NFS-e)',
    shortLabel: 'Nota Fiscal',
    tone: 'blue',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-200',
    icon: 'FileText',
  },
  comprovante_pix: {
    label: 'Comprovante PIX / TED',
    shortLabel: 'Comprovante PIX',
    tone: 'green',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
    icon: 'CheckCircle2',
  },
  recibo: {
    label: 'Recibo / Quitação',
    shortLabel: 'Recibo',
    tone: 'purple',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200',
    icon: 'Receipt',
  },
  contrato: {
    label: 'Contrato / Proposta',
    shortLabel: 'Contrato',
    tone: 'gray',
    badgeBg: 'bg-neutral-100',
    badgeText: 'text-neutral-800',
    badgeBorder: 'border-neutral-200',
    icon: 'FileSpreadsheet',
  },
  outro: {
    label: 'Outro Documento',
    shortLabel: 'Outro',
    tone: 'gray',
    badgeBg: 'bg-neutral-100',
    badgeText: 'text-neutral-600',
    badgeBorder: 'border-neutral-200',
    icon: 'Paperclip',
  },
}

/**
 * Heurística rápida para detectar o tipo de documento a partir do nome do arquivo
 * e/ou campos pré-identificados (linha digitável, etc.)
 */
export function detectarTipoDocumentoHeuristica(
  nomeArquivo: string,
  extra?: { temLinhaDigitavel?: boolean; textoExtraido?: string },
): TipoDocumentoSegregado {
  const nome = (nomeArquivo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (extra?.temLinhaDigitavel) {
    return 'boleto'
  }

  // 1. Boleto
  if (
    nome.includes('boleto') ||
    nome.includes('bloqueto') ||
    nome.includes('fatura') ||
    nome.includes('cobranca') ||
    nome.includes('linha_digitavel') ||
    nome.includes('duplicata')
  ) {
    return 'boleto'
  }

  // 2. Nota Fiscal
  if (
    nome.includes('danfe') ||
    nome.includes('nfse') ||
    nome.includes('nfe') ||
    nome.includes('nf-e') ||
    nome.includes('nfs-e') ||
    nome.includes('nota_fiscal') ||
    nome.includes('notafiscal') ||
    nome.includes('xml')
  ) {
    return 'nota_fiscal'
  }

  // 3. Comprovante PIX ou TED
  if (
    nome.includes('pix') ||
    nome.includes('ted') ||
    nome.includes('doc') ||
    nome.includes('comprovante') ||
    nome.includes('pagamento') ||
    nome.includes('transf') ||
    nome.includes('extrato')
  ) {
    return 'comprovante_pix'
  }

  // 4. Recibo
  if (nome.includes('recibo') || nome.includes('quitacao') || nome.includes('cupom')) {
    return 'recibo'
  }

  // 5. Contrato
  if (
    nome.includes('contrato') ||
    nome.includes('aditivo') ||
    nome.includes('proposta') ||
    nome.includes('termo')
  ) {
    return 'contrato'
  }

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
