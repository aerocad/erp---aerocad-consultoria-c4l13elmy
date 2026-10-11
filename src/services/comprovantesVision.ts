import pb from '@/lib/pocketbase/client'
import { createOne } from '@/services/api'
import type { ContaPagarRecord } from '@/types/crm'

export type TipoDocumentoFiscal = 'nfe' | 'nfse' | 'cupom_fiscal' | 'recibo' | 'fatura' | 'outro'

export interface ComprovanteExtraido {
  sucesso: boolean
  tipo_documento: TipoDocumentoFiscal
  fornecedor: string
  cnpj_cpf: string
  data_emissao: string
  numero_documento: string
  valor_total: number
  valor_impostos: number | null
  forma_pagamento_sugerida:
    | 'pix'
    | 'ted_doc'
    | 'boleto'
    | 'cartao_credito'
    | 'cartao_debito'
    | 'dinheiro'
    | 'outro'
  categoria_sugerida:
    | 'despesas_operacionais'
    | 'terceirizados'
    | 'impostos'
    | 'equipamentos'
    | 'folha'
    | 'outros'
  descricao_itens: string
  observacoes?: string
  confianca?: 'alta' | 'media' | 'baixa'
  erro?: string
}

export interface ExtracaoComprovanteResponse {
  sucesso: boolean
  dados: ComprovanteExtraido
  raw_agent_reply?: string | null
}

export const TIPO_DOC_LABELS: Record<TipoDocumentoFiscal, string> = {
  nfe: 'NF-e (Nota de Produtos)',
  nfse: 'NFS-e (Nota de Serviços)',
  cupom_fiscal: 'Cupom Fiscal (NFC-e / SAT)',
  recibo: 'Recibo / Quitação',
  fatura: 'Fatura Comercial / Boleto',
  outro: 'Outro Comprovante',
}

/**
 * Envia arquivo de imagem ou PDF para o backend extrair dados via agente nativo Skip Cloud
 */
export async function extrairDadosComprovante(file: File): Promise<ComprovanteExtraido> {
  const formData = new FormData()
  formData.append('arquivo', file)

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL
  const res = await fetch(`${baseUrl}/backend/v1/comprovantes/extrair`, {
    method: 'POST',
    headers: {
      Authorization: pb.authStore.token,
    },
    body: formData,
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody?.error || `Falha ao processar comprovante (status ${res.status})`)
  }

  const json: ExtracaoComprovanteResponse = await res.json()
  return json.dados
}

export interface SalvarContaPagarComprovanteParams {
  descricao: string
  fornecedor: string
  categoria:
    | 'despesas_operacionais'
    | 'terceirizados'
    | 'impostos'
    | 'equipamentos'
    | 'folha'
    | 'outros'
  valor: number
  data_vencimento: string
  forma_pagamento:
    | 'pix'
    | 'ted_doc'
    | 'boleto'
    | 'cartao_credito'
    | 'cartao_debito'
    | 'dinheiro'
    | 'outro'
  numero_documento?: string
  projetoId?: string | null
  observacoes?: string
  arquivoComprovante: File
  userId?: string | null
}

/**
 * Cria a conta a pagar pré-preenchida com o comprovante anexado e registra a atividade de auditoria
 */
export async function salvarContaPagarComComprovante(
  params: SalvarContaPagarComprovanteParams,
): Promise<ContaPagarRecord> {
  const {
    descricao,
    fornecedor,
    categoria,
    valor,
    data_vencimento,
    forma_pagamento,
    numero_documento,
    projetoId,
    observacoes,
    arquivoComprovante,
    userId,
  } = params

  // 1. Criar registro de conta a pagar
  const payload: Record<string, unknown> = {
    descricao,
    fornecedor,
    categoria,
    valor,
    data_vencimento: `${data_vencimento} 12:00:00.000Z`,
    status: 'pendente',
    forma_pagamento,
    numero_documento: numero_documento || '',
    observacoes: observacoes || '',
    criado_por: userId || pb.authStore.record?.id || null,
  }

  if (projetoId) {
    payload.projeto = projetoId
  }

  const contaCriada = await createOne<ContaPagarRecord>('contas_pagar', payload)

  // 2. Anexar arquivo do comprovante ao campo file existente
  if (arquivoComprovante && contaCriada.id) {
    const formData = new FormData()
    formData.append('comprovante', arquivoComprovante)
    await pb.collection('contas_pagar').update(contaCriada.id, formData)
  }

  // 3. Registrar atividade de auditoria no CRM
  try {
    const textoAtividade = `Comprovante fotografado/anexado via IA: Conta a pagar criada para ${fornecedor} (R$ ${valor.toFixed(2)}) com vencimento em ${data_vencimento.split('-').reverse().join('/')}`
    await createOne('atividades', {
      usuario: userId || pb.authStore.record?.id || null,
      texto: textoAtividade,
      projeto: projetoId || null,
      tipo: 'financeiro',
    })
  } catch (ativErr) {
    console.log('Não foi possível gravar log de atividade:', ativErr)
  }

  return contaCriada
}
