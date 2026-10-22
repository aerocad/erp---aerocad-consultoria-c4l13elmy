import pb from '@/lib/pocketbase/client'
import { createOne, updateOne } from '@/services/api'
import {
  preProcessarImagemDocumento,
  type PreprocessamentoOpcoes,
} from '@/services/imagePreprocessor'
import type { ContaPagarRecord } from '@/types/crm'

export type TipoDocumentoFiscal =
  | 'nfe'
  | 'nfse'
  | 'cupom_fiscal'
  | 'recibo'
  | 'fatura'
  | 'boleto'
  | 'outro'

export interface ItemFiscalDanfe {
  descricao: string
  quantidade?: number
  valor_unitario?: number
  valor_total?: number
  unidade?: string
  ncm?: string
}

export interface ComprovanteExtraido {
  sucesso: boolean
  tipo_documento: TipoDocumentoFiscal
  fornecedor: string
  cnpj_cpf: string
  data_emissao: string
  numero_documento: string
  serie?: string
  chave_acesso?: string
  destinatario?: string
  cnpj_destinatario?: string
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
  credito_tipo?: 'a_vista' | 'parcelado'
  num_parcelas?: number
  categoria_sugerida:
    | 'despesas_operacionais'
    | 'terceirizados'
    | 'impostos'
    | 'equipamentos'
    | 'folha'
    | 'outros'
  plano_contas_codigo?: string
  plano_contas_nome?: string
  descricao_itens: string
  itens_detalhados?: ItemFiscalDanfe[]
  itens_danfe?: ItemFiscalDanfe[]
  observacoes?: string
  confianca?: 'alta' | 'media' | 'baixa'
  erro?: string
  // Modo Essencial (leitura parcial focada nos 5 campos essenciais)
  modo_essencial?: boolean
  aviso_modo_essencial?: string | null
  // Inferência heurística de categoria por estabelecimento
  inferencia_categoria?: {
    segmento?: string
    descricao_produto_inferido?: string
    categoria?: string
    plano_contas_codigo?: string
    plano_contas_nome?: string
    termo_detectado?: string
  }
  // Metadados da consulta do QR code / SEFAZ
  metadados_qr?: {
    qr_detectado?: boolean
    conteudo_qr?: string
    portal_consultado?: boolean
    aviso_portal?: string | null
    origem?: string
  }
}

export interface BoletoExtraido {
  sucesso: boolean
  beneficiario_fornecedor: string
  cnpj_cpf_beneficiario: string
  pagador_sacado?: string
  linha_digitavel: string
  codigo_barras: string
  numero_documento: string
  valor_documento: number
  valor_desconto: number
  valor_juros_multa: number
  valor_cobrado: number
  data_vencimento: string
  data_documento: string
  banco_emissor?: string
  categoria_sugerida:
    | 'despesas_operacionais'
    | 'terceirizados'
    | 'impostos'
    | 'equipamentos'
    | 'folha'
    | 'outros'
  plano_contas_codigo?: string
  plano_contas_nome?: string
  instrucoes_resumo?: string
  confianca?: 'alta' | 'media' | 'baixa'
  erro?: string
  // Modo Essencial e inferência
  modo_essencial?: boolean
  aviso_modo_essencial?: string | null
  inferencia_categoria?: {
    segmento?: string
    descricao_produto_inferido?: string
    categoria?: string
    plano_contas_codigo?: string
    plano_contas_nome?: string
    termo_detectado?: string
  }
}

export interface ContratoExtraido {
  sucesso: boolean
  numero: string
  titulo: string
  tipo_contrato: 'cliente' | 'prestador_fornecedor' | 'parceria_tecnica' | 'outro'
  partes_envolvidas: string
  objeto: string
  valor_global: number
  forma_pagamento_texto: string
  parcelas_sugeridas?: Array<{ descricao: string; valor: number; vencimento_dias?: number }>
  data_assinatura: string
  data_inicio_vigencia: string
  data_termino_vigencia: string
  indice_reajuste: string
  garante_fiador: string
  confianca?: 'alta' | 'media' | 'baixa'
  aviso?: string
  erro?: string
}

export interface ExtracaoComprovanteResponse {
  sucesso: boolean
  dados: ComprovanteExtraido
  raw_agent_reply?: string | null
}

export interface ExtracaoBoletoResponse {
  sucesso: boolean
  dados: BoletoExtraido
}

export interface ExtracaoContratoResponse {
  sucesso: boolean
  dados: ContratoExtraido
  aviso?: string
}

export interface SocioContratoSocialExtraido {
  nome: string
  cpf_cnpj?: string
  qualificacao?: string
  percentual_participacao?: number
  cotas?: number | null
  valor_participacao?: number | null
}

export interface ContratoSocialExtraido {
  sucesso: boolean
  razao_social: string
  nome_fantasia: string
  cnpj: string
  capital_social: number
  data_constituicao: string
  socios: SocioContratoSocialExtraido[]
  endereco_completo: string
  cidade_uf: string
  cnae_principal: string
  objeto_social: string
  confianca?: 'alta' | 'media' | 'baixa'
  aviso?: string | null
  erro?: string
}

export interface ExtracaoContratoSocialResponse {
  sucesso: boolean
  dados: ContratoSocialExtraido
  aviso?: string | null
}

export const TIPO_DOC_LABELS: Record<TipoDocumentoFiscal, string> = {
  nfe: 'NF-e (Nota de Produtos)',
  nfse: 'NFS-e (Nota de Serviços)',
  cupom_fiscal: 'Cupom Fiscal (NFC-e / SAT)',
  recibo: 'Recibo / Quitação',
  fatura: 'Fatura Comercial',
  boleto: 'Boleto Bancário (Cobrança)',
  outro: 'Outro Comprovante',
}

/**
 * Envia arquivo de imagem ou PDF para o backend extrair dados via agente nativo Skip Cloud.
 * Pré-processa imagens automaticamente (otimização de contraste, redimensionamento para max ~2800px, JPEG ~0.93)
 * antes do upload para garantir a melhor leitura OCR/Visão possível de cupons fiscais e recibos.
 */
export async function extrairDadosComprovante(
  file: File,
  opcoesPreprocessamento?: PreprocessamentoOpcoes,
): Promise<ComprovanteExtraido> {
  // 1. Pré-processar a imagem se for foto/documento de imagem (PDFs passam intactos)
  const { fileOtimizado, alterado, dimensoesOriginais } = await preProcessarImagemDocumento(
    file,
    opcoesPreprocessamento,
  )

  const formData = new FormData()
  formData.append('arquivo', fileOtimizado)

  // Metadados do pré-processamento enviados como campos do FormData
  if (alterado) {
    formData.append('pre_processado', 'true')
    if (dimensoesOriginais) {
      formData.append('dimensoes_originais', JSON.stringify(dimensoesOriginais))
    }
  }

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
  const dados = json.dados

  // Aplica enriquecimento de inferência de categoria por estabelecimento se ainda não definido
  try {
    const { inferirCategoriaPorEstabelecimento } =
      await import('@/services/categoriaInferenciaEngine')
    const inf = inferirCategoriaPorEstabelecimento(
      dados.fornecedor,
      dados.cnpj_cpf,
      dados.descricao_itens,
    )
    if (inf && inf.sucesso) {
      if (!dados.inferencia_categoria) {
        dados.inferencia_categoria = {
          segmento: inf.segmento,
          descricao_produto_inferido: inf.descricaoProdutoInferido,
          categoria: inf.categoria,
          plano_contas_codigo: inf.planoContasCodigo,
          plano_contas_nome: inf.planoContasNome,
          termo_detectado: inf.termoDetectado,
        }
      }
      // Se não havia categoria ou plano definidos, preenche com a inferência
      if (!dados.categoria_sugerida || dados.categoria_sugerida === 'outros') {
        dados.categoria_sugerida = inf.categoria as any
      }
      if (!dados.plano_contas_codigo) {
        dados.plano_contas_codigo = inf.planoContasCodigo
        dados.plano_contas_nome = inf.planoContasNome
      }
    }
  } catch (infErr) {
    console.warn('Erro ao enriquecer inferência no cliente:', infErr)
  }

  return dados
}

export interface ConsultaQrResponse {
  sucesso: boolean
  origem?: string
  chave_acesso?: string
  portal_consultado?: boolean
  aviso_portal?: string | null
  dados: ComprovanteExtraido
  mensagem: string
}

/**
 * Consulta a SEFAZ ou decodifica estrutura oficial no backend a partir da URL/string do QR code
 */
export async function consultarQrCodeFiscalBackend(qrContent: string): Promise<ConsultaQrResponse> {
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL
  const res = await fetch(`${baseUrl}/backend/v1/fiscal/consultar-qr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({ qr_content: qrContent }),
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody?.error || `Falha ao consultar QR Code fiscal (status ${res.status})`)
  }

  return (await res.json()) as ConsultaQrResponse
}

/**
 * Envia arquivo de boleto bancário (PDF ou foto JPG/PNG) para o backend extrair via IA nativa.
 * Fotos de boletos passam pelo pré-processamento de contraste e resolução para leitura nítida do código de barras.
 */
export async function extrairDadosBoleto(
  file: File,
  opcoesPreprocessamento?: PreprocessamentoOpcoes,
): Promise<BoletoExtraido> {
  // 1. Pré-processar a foto se for imagem (PDFs passam intactos)
  const { fileOtimizado, alterado, dimensoesOriginais } = await preProcessarImagemDocumento(
    file,
    opcoesPreprocessamento,
  )

  const formData = new FormData()
  formData.append('arquivo', fileOtimizado)

  if (alterado) {
    formData.append('pre_processado', 'true')
    if (dimensoesOriginais) {
      formData.append('dimensoes_originais', JSON.stringify(dimensoesOriginais))
    }
  }

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL
  const res = await fetch(`${baseUrl}/backend/v1/boletos/extrair`, {
    method: 'POST',
    headers: {
      Authorization: pb.authStore.token,
    },
    body: formData,
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody?.error || `Falha ao processar boleto (status ${res.status})`)
  }

  const json: ExtracaoBoletoResponse = await res.json()
  const dados = json.dados

  // Aplica enriquecimento de inferência de categoria por estabelecimento para boletos
  try {
    const { inferirCategoriaPorEstabelecimento } =
      await import('@/services/categoriaInferenciaEngine')
    const inf = inferirCategoriaPorEstabelecimento(
      dados.beneficiario_fornecedor,
      dados.cnpj_cpf_beneficiario,
      dados.instrucoes_resumo,
    )
    if (inf && inf.sucesso) {
      if (!dados.inferencia_categoria) {
        dados.inferencia_categoria = {
          segmento: inf.segmento,
          descricao_produto_inferido: inf.descricaoProdutoInferido,
          categoria: inf.categoria,
          plano_contas_codigo: inf.planoContasCodigo,
          plano_contas_nome: inf.planoContasNome,
          termo_detectado: inf.termoDetectado,
        }
      }
      if (!dados.categoria_sugerida || dados.categoria_sugerida === 'outros') {
        dados.categoria_sugerida = inf.categoria as any
      }
      if (!dados.plano_contas_codigo) {
        dados.plano_contas_codigo = inf.planoContasCodigo
        dados.plano_contas_nome = inf.planoContasNome
      }
    }
  } catch (infErr) {
    console.warn('Erro ao enriquecer inferência no cliente para boleto:', infErr)
  }

  return dados
}

/**
 * Envia arquivo de contrato social (PDF ou imagem) para o backend extrair via IA Skip Cloud
 */
export async function extrairDadosContratoSocial(
  file: File,
  opcoesPreprocessamento?: PreprocessamentoOpcoes,
): Promise<ContratoSocialExtraido> {
  // Pré-processa imagem se não for PDF
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  let arquivoEnvio = file
  if (!isPdf) {
    const { fileOtimizado } = await preProcessarImagemDocumento(file, opcoesPreprocessamento)
    arquivoEnvio = fileOtimizado
  }

  const formData = new FormData()
  formData.append('arquivo', arquivoEnvio)

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL
  const res = await fetch(`${baseUrl}/backend/v1/contrato-social/extrair`, {
    method: 'POST',
    headers: {
      Authorization: pb.authStore.token,
    },
    body: formData,
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody?.error || `Falha ao processar contrato social (status ${res.status})`)
  }

  const json: ExtracaoContratoSocialResponse = await res.json()
  return json.dados
}

/**
 * Envia arquivo de contrato em PDF para o backend extrair cláusulas e valores via IA nativa
 */
export async function extrairDadosContrato(file: File): Promise<ContratoExtraido> {
  const formData = new FormData()
  formData.append('arquivo', file)

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL
  const res = await fetch(`${baseUrl}/backend/v1/contratos/extrair`, {
    method: 'POST',
    headers: {
      Authorization: pb.authStore.token,
    },
    body: formData,
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody?.error || `Falha ao processar contrato (status ${res.status})`)
  }

  const json: ExtracaoContratoResponse = await res.json()
  return json.dados
}

export interface ArquivoSegregadoUpload {
  file: File
  tipo?: 'boleto' | 'nota_fiscal' | 'comprovante_pix' | 'recibo' | 'contrato' | 'outro'
  nomeOriginal?: string
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
    | 'debito_automatico'
    | 'outro'
  numero_documento?: string
  projetoId?: string | null
  credorId?: string | null
  observacoes?: string
  arquivoComprovante?: File | null
  arquivosComprovantes?: Array<File | ArquivoSegregadoUpload>
  userId?: string | null
  // Novos campos contábeis e conta PJ
  codigo_barras_linha_digitavel?: string
  cnpj_cpf_beneficiario?: string
  valor_desconto?: number
  valor_juros_multa?: number
  plano_contas_codigo?: string
  plano_contas_nome?: string
  conta_bancaria?: string
}

export interface AtualizarContaPagarComComprovanteParams extends SalvarContaPagarComprovanteParams {
  contaId: string
}

/**
 * Atualiza uma conta a pagar existente (modo de reedição/revisão de comprovante),
 * opcionalmente substituindo ou adicionando um novo comprovante se um novo arquivo for enviado.
 */
export async function atualizarContaPagarComComprovante(
  params: AtualizarContaPagarComComprovanteParams,
): Promise<ContaPagarRecord> {
  const {
    contaId,
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
    arquivosComprovantes,
    userId,
  } = params

  const payload: Record<string, unknown> = {
    descricao,
    fornecedor,
    categoria,
    valor,
    data_vencimento: `${data_vencimento} 12:00:00.000Z`,
    forma_pagamento,
    numero_documento: numero_documento || '',
    observacoes: observacoes || '',
    codigo_barras_linha_digitavel: params.codigo_barras_linha_digitavel || '',
    cnpj_cpf_beneficiario: params.cnpj_cpf_beneficiario || '',
    valor_desconto: params.valor_desconto || 0,
    valor_juros_multa: params.valor_juros_multa || 0,
    plano_contas_codigo: params.plano_contas_codigo || '',
    plano_contas_nome: params.plano_contas_nome || '',
    conta_bancaria: params.conta_bancaria || null,
    credor: params.credorId || null,
    projeto: projetoId || null,
  }

  // 1. Atualizar campos cadastrais da conta existente
  const contaAtualizada = await updateOne<ContaPagarRecord>('contas_pagar', contaId, payload)

  // 2. Se um novo arquivo foi selecionado na revisão, fazer o upload mantendo ou atualizando os metadados
  const listaNovosArquivos: ArquivoSegregadoUpload[] = []
  if (arquivosComprovantes && arquivosComprovantes.length > 0) {
    for (const item of arquivosComprovantes) {
      if (item instanceof File) {
        listaNovosArquivos.push({ file: item, nomeOriginal: item.name })
      } else if (item && item.file) {
        listaNovosArquivos.push(item)
      }
    }
  } else if (arquivoComprovante) {
    listaNovosArquivos.push({
      file: arquivoComprovante,
      tipo: forma_pagamento === 'boleto' ? 'boleto' : 'comprovante_pix',
      nomeOriginal: arquivoComprovante.name,
    })
  }

  if (listaNovosArquivos.length > 0) {
    const formData = new FormData()
    for (const item of listaNovosArquivos) {
      formData.append('comprovante', item.file)
    }

    // Metadados dos novos arquivos mesclados com os existentes se houver
    const metadadosNovos = listaNovosArquivos.map((item) => ({
      file: item.file.name,
      tipo: item.tipo || (forma_pagamento === 'boleto' ? 'boleto' : 'comprovante_pix'),
      nome_original: item.nomeOriginal || item.file.name,
      tamanho: item.file.size,
    }))

    const metadadosAtuais = Array.isArray(contaAtualizada.comprovantes_metadados)
      ? contaAtualizada.comprovantes_metadados
      : []

    formData.append(
      'comprovantes_metadados',
      JSON.stringify([...metadadosAtuais, ...metadadosNovos]),
    )
    await pb.collection('contas_pagar').update(contaId, formData)
  }

  // 3. Registrar auditoria de revisão
  try {
    const textoAtividade = `Comprovante revisado/editado manualmente: Conta a pagar de ${fornecedor} atualizada para R$ ${valor.toFixed(2)}`
    await createOne('atividades', {
      usuario: userId || pb.authStore.record?.id || null,
      texto: textoAtividade,
      projeto: projetoId || null,
      tipo: 'financeiro',
    })
  } catch (ativErr) {
    console.log('Não foi possível gravar log de atividade:', ativErr)
  }

  return contaAtualizada
}

/**
 * Cria a conta a pagar pré-preenchida com um ou múltiplos comprovantes anexados de forma segregada
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
    arquivosComprovantes,
    userId,
  } = params

  // 1. Consolidar lista de arquivos para upload
  const listaArquivos: ArquivoSegregadoUpload[] = []
  if (arquivosComprovantes && arquivosComprovantes.length > 0) {
    for (const item of arquivosComprovantes) {
      if (item instanceof File) {
        listaArquivos.push({ file: item, nomeOriginal: item.name })
      } else if (item && item.file) {
        listaArquivos.push(item)
      }
    }
  } else if (arquivoComprovante) {
    listaArquivos.push({
      file: arquivoComprovante,
      tipo: 'boleto',
      nomeOriginal: arquivoComprovante.name,
    })
  }

  // 2. Montar metadados iniciais segregados
  const metadadosIniciais = listaArquivos.map((item) => ({
    file: item.file.name,
    tipo: item.tipo || (item.file.name.toLowerCase().includes('boleto') ? 'boleto' : 'outro'),
    nome_original: item.nomeOriginal || item.file.name,
    tamanho: item.file.size,
  }))

  // 3. Criar registro de conta a pagar
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
    codigo_barras_linha_digitavel: params.codigo_barras_linha_digitavel || '',
    cnpj_cpf_beneficiario: params.cnpj_cpf_beneficiario || '',
    valor_desconto: params.valor_desconto || 0,
    valor_juros_multa: params.valor_juros_multa || 0,
    plano_contas_codigo: params.plano_contas_codigo || '',
    plano_contas_nome: params.plano_contas_nome || '',
    conta_bancaria: params.conta_bancaria || null,
    comprovantes_metadados: metadadosIniciais,
    criado_por: userId || pb.authStore.record?.id || null,
  }

  if (params.credorId) {
    payload.credor = params.credorId
  }

  if (projetoId) {
    payload.projeto = projetoId
  }

  const contaCriada = await createOne<ContaPagarRecord>('contas_pagar', payload)

  // 4. Anexar arquivos de comprovante segregados
  if (listaArquivos.length > 0 && contaCriada.id) {
    const formData = new FormData()
    for (const item of listaArquivos) {
      formData.append('comprovante', item.file)
    }
    // Re-atualiza também metadados se necessário
    formData.append('comprovantes_metadados', JSON.stringify(metadadosIniciais))
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
