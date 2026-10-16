import pb from '@/lib/pocketbase/client'
import type { ContaPagarRecord, CredorRecord, CategoriaCredor, TipoPessoaCredor } from '@/types/crm'
import { formatarDocumento, limparDocumento } from '@/services/importacaoParser'

export interface DadosEstabelecimentoConta {
  /** Nome ou razão social extraído do comprovante/conta */
  nome: string
  /** CNPJ ou CPF formatado */
  cnpjCpf: string
  /** Apenas números do documento */
  documentoLimpo: string
  /** Tipo pessoa inferido */
  tipoPessoa: TipoPessoaCredor
  /** Categoria padrão inferida para o credor */
  categoriaSugerida: CategoriaCredor
  /** Se possui ao menos nome válido ou documento */
  temDadosValidos: boolean
  /** Se possui comprovante ou metadado anexado */
  temComprovante: boolean
  /** Credor existente sugerido caso encontre match por documento ou similaridade */
  credorExistenteSugerido: CredorRecord | null
  /** Motivo da correspondência (documento_exato ou nome_semelhante) */
  motivoCorrespondencia?: 'documento_exato' | 'nome_semelhante'
}

/**
 * Normaliza strings para comparação fonética/textual (sem acentos, minúsculo, sem pontuação supérflua)
 */
function normalizarTextoParaComparacao(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Tenta extrair CNPJ ou CPF a partir de texto livre (ex: observações da conta)
 */
export function extrairDocumentoDeTexto(texto: string): string {
  if (!texto) return ''
  // 1. Procura padrão explícito de CNPJ (com ou sem máscara)
  const matchCnpj = texto.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/)
  if (matchCnpj) {
    return matchCnpj[0]
  }
  // 2. Procura padrão explícito de CPF
  const matchCpf = texto.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/)
  if (matchCpf) {
    return matchCpf[0]
  }
  // 3. Procura padrão "CNPJ: 12345678901234" ou "CPF: 12345678901"
  const matchChave = texto.match(/(?:cnpj|cpf)\s*[:=]?\s*([0-9./-]+)/i)
  if (matchChave && matchChave[1]) {
    const limpo = limparDocumento(matchChave[1])
    if (limpo.length === 14 || limpo.length === 11) {
      return formatarDocumento(limpo)
    }
  }
  return ''
}

/**
 * Mapeia a categoria da conta a pagar para uma categoria compatível de Credor
 */
export function inferirCategoriaCredorPorConta(
  categoriaConta?: string,
  fornecedorNome?: string,
): CategoriaCredor {
  const cat = categoriaConta || ''
  const nomeNorm = normalizarTextoParaComparacao(fornecedorNome || '')

  if (
    cat === 'impostos' ||
    nomeNorm.includes('receita federal') ||
    nomeNorm.includes('prefeitura') ||
    nomeNorm.includes('darf') ||
    nomeNorm.includes('das')
  ) {
    return 'impostos_orgaos_publicos'
  }
  if (cat === 'folha') {
    return 'folha_encargos'
  }
  if (
    cat === 'terceirizados' ||
    nomeNorm.includes('engenharia') ||
    nomeNorm.includes('consultoria') ||
    nomeNorm.includes('servico')
  ) {
    return 'fornecedor_servicos'
  }
  if (
    cat === 'equipamentos' ||
    nomeNorm.includes('hardware') ||
    nomeNorm.includes('informatica') ||
    nomeNorm.includes('suprimentos')
  ) {
    return 'fornecedor_material'
  }
  if (
    nomeNorm.includes('aluguel') ||
    nomeNorm.includes('locacao') ||
    nomeNorm.includes('imobiliaria')
  ) {
    return 'locador'
  }
  if (nomeNorm.includes('condominio') || nomeNorm.includes('loteamento')) {
    return 'condominio'
  }
  if (
    nomeNorm.includes('energia') ||
    nomeNorm.includes('cemig') ||
    nomeNorm.includes('copasa') ||
    nomeNorm.includes('sabesp') ||
    nomeNorm.includes('telecom') ||
    nomeNorm.includes('vivo') ||
    nomeNorm.includes('claro') ||
    nomeNorm.includes('tim')
  ) {
    return 'utilidades'
  }
  if (
    nomeNorm.includes('banco') ||
    nomeNorm.includes('itau') ||
    nomeNorm.includes('bradesco') ||
    nomeNorm.includes('santander') ||
    nomeNorm.includes('inter')
  ) {
    return 'instituicao_financeira'
  }
  if (nomeNorm.includes('contabil') || nomeNorm.includes('contabilidade')) {
    return 'contador'
  }

  return 'outros'
}

/**
 * Procura um credor pré-existente na base que coincida por documento ou nome aproximado
 */
export function encontrarCredorCorrespondente(
  nomeBusca: string,
  documentoBusca: string,
  listaCredores: CredorRecord[],
): { credor: CredorRecord; motivo: 'documento_exato' | 'nome_semelhante' } | null {
  const docLimpo = limparDocumento(documentoBusca)
  const nomeNorm = normalizarTextoParaComparacao(nomeBusca)

  // 1. Tentar primeiro por documento exato (CNPJ ou CPF)
  if (docLimpo && (docLimpo.length === 11 || docLimpo.length === 14)) {
    const achadoDoc = listaCredores.find((c) => {
      const cDoc = limparDocumento(c.cnpj_cpf || '')
      return cDoc && cDoc === docLimpo
    })
    if (achadoDoc) {
      return { credor: achadoDoc, motivo: 'documento_exato' }
    }
  }

  // 2. Se não achou por doc, tentar por similaridade forte de Razão Social / Nome Fantasia
  if (nomeNorm && nomeNorm.length >= 4) {
    const achadoNome = listaCredores.find((c) => {
      const cRazao = normalizarTextoParaComparacao(c.nome_razao_social || '')
      const cFantasia = normalizarTextoParaComparacao(c.nome_fantasia || '')

      if (!cRazao && !cFantasia) return false

      // Match exato normalizado
      if (cRazao === nomeNorm || cFantasia === nomeNorm) return true

      // Substring significativa (mínimo 5 caracteres para evitar falsos positivos)
      if (nomeNorm.length >= 5) {
        if (cRazao && (cRazao.includes(nomeNorm) || nomeNorm.includes(cRazao))) return true
        if (cFantasia && (cFantasia.includes(nomeNorm) || nomeNorm.includes(cFantasia))) return true
      }
      return false
    })

    if (achadoNome) {
      return { credor: achadoNome, motivo: 'nome_semelhante' }
    }
  }

  return null
}

/**
 * Extrai dados consolidados do estabelecimento da Conta a Pagar (lendo campos gravados por OCR/IA ou observações)
 */
export function extrairDadosEstabelecimentoConta(
  conta: ContaPagarRecord,
  listaCredores: CredorRecord[] = [],
): DadosEstabelecimentoConta {
  const temComprovante = Boolean(
    (Array.isArray(conta.comprovante) && conta.comprovante.length > 0) ||
    (typeof conta.comprovante === 'string' && conta.comprovante.trim().length > 0) ||
    (Array.isArray(conta.comprovantes_metadados) && conta.comprovantes_metadados.length > 0),
  )

  // Documento gravado na conta (cnpj_cpf_beneficiario) ou tentar extrair das observações
  let docRaw = conta.cnpj_cpf_beneficiario || ''
  if (!docRaw && conta.observacoes) {
    docRaw = extrairDocumentoDeTexto(conta.observacoes)
  }

  const docLimpo = limparDocumento(docRaw)
  const docFormatado = formatarDocumento(docLimpo)

  // Nome do fornecedor/estabelecimento
  let nomeRaw = (conta.fornecedor || '').trim()
  // Se o nome for genérico de fallback, tenta limpar
  const nomesGenericos = [
    'despesa / estabelecimento a identificar',
    'estabelecimento a identificar',
    'beneficiário / fornecedor a identificar',
    'despesa a identificar',
    'despesa operacional',
    'a identificar',
    'fornecedor',
  ]
  const ehGenerico = nomesGenericos.includes(nomeRaw.toLowerCase())

  const nomeFinal = ehGenerico ? '' : nomeRaw

  const tipoPessoa: TipoPessoaCredor = docLimpo.length === 11 ? 'pf' : 'pj'
  const categoriaSugerida = inferirCategoriaCredorPorConta(conta.categoria, nomeFinal)

  // Tem dados válidos se tiver nome não genérico com pelo menos 3 caracteres OU se tiver documento válido
  const temDadosValidos =
    (Boolean(nomeFinal) && nomeFinal.length >= 3) ||
    Boolean(docLimpo && (docLimpo.length === 11 || docLimpo.length === 14))

  // Match de credor existente
  const match = encontrarCredorCorrespondente(nomeFinal, docLimpo, listaCredores)

  return {
    nome: nomeFinal,
    cnpjCpf: docFormatado,
    documentoLimpo: docLimpo,
    tipoPessoa,
    categoriaSugerida,
    temDadosValidos,
    temComprovante,
    credorExistenteSugerido: match ? match.credor : null,
    motivoCorrespondencia: match ? match.motivo : undefined,
  }
}

/**
 * Vincula uma Conta a Pagar a um Credor existente no PocketBase e registra a auditoria
 */
export async function vincularCredorAContaPagar(
  contaId: string,
  credor: CredorRecord,
  usuarioId?: string | null,
): Promise<ContaPagarRecord> {
  const payload: Record<string, unknown> = {
    credor: credor.id,
    fornecedor: credor.nome_razao_social,
  }

  // Se a conta não tiver cnpj_cpf_beneficiario preenchido, atualiza com o do credor
  if (credor.cnpj_cpf) {
    payload.cnpj_cpf_beneficiario = credor.cnpj_cpf
  }

  const atualizada = await pb.collection('contas_pagar').update<ContaPagarRecord>(contaId, payload)

  // Auditoria no CRM
  try {
    await pb.collection('atividades').create({
      usuario: usuarioId || pb.authStore.record?.id || null,
      texto: `Credor vinculado à conta a pagar: "${credor.nome_razao_social}" (${credor.cnpj_cpf || 'sem doc'}) associado à despesa "${atualizada.descricao}"`,
      projeto: atualizada.projeto || null,
      tipo: 'financeiro',
    })
  } catch (err) {
    console.warn('Falha ao gravar atividade de auditoria:', err)
  }

  return atualizada
}
