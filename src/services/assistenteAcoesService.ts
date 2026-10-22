import pb from '@/lib/pocketbase/client'
import type { ItemPlanoContas } from '@/lib/planoContas'
import { PLANO_CONTAS_AEROCAD, removerContaExtraPlano } from '@/lib/planoContas'
import { salvarCredor, type CredorFormData } from '@/services/credores'
import { desfazerUltimaOperacaoBloco } from '@/services/assistenteIa'

export interface PlanoContasCustomizadaRecord extends ItemPlanoContas {
  id: string
  ativo: boolean
  criado_por?: string
  created: string
  updated: string
}

export interface PropostaAcaoData {
  tipo: 'criar_conta_plano' | 'criar_credor' | 'reclassificar'
  titulo: string
  descricao: string
  dados: Record<string, unknown>
}

export interface ExecucaoAcaoResultado {
  sucesso: boolean
  auditId: string
  mensagem: string
  dadosResultado?: Record<string, unknown>
}

/**
 * Lista as contas customizadas salvas no banco
 */
export async function listarContasCustomizadas(): Promise<PlanoContasCustomizadaRecord[]> {
  try {
    const list = await pb
      .collection('plano_contas_customizadas')
      .getFullList<PlanoContasCustomizadaRecord>({
        filter: 'ativo = true',
        sort: 'codigo',
        requestKey: null,
      })
    return list
  } catch (err) {
    console.warn('Erro ao carregar contas contábeis customizadas:', err)
    return []
  }
}

/**
 * Retorna todo o plano de contas: base fixa + contas customizadas ativas
 */
export async function obterPlanoContasCompleto(): Promise<ItemPlanoContas[]> {
  const customizadas = await listarContasCustomizadas()
  const codigosExistentes = new Set(PLANO_CONTAS_AEROCAD.map((i) => i.codigo))

  const extras: ItemPlanoContas[] = customizadas
    .filter((c) => !codigosExistentes.has(c.codigo))
    .map((c) => ({
      codigo: c.codigo,
      nome: c.nome,
      natureza: c.natureza,
      grupo: c.grupo,
      fixoOuVariavel: c.fixoOuVariavel,
      descricao: c.descricao,
    }))

  return [...PLANO_CONTAS_AEROCAD, ...extras]
}

/**
 * Cria uma nova conta no plano de contas com registro na auditoria para desfazer
 */
export async function criarContaPlanoContasComAuditoria(conta: {
  codigo: string
  nome: string
  natureza: 'ativo' | 'passivo' | 'patrimonio_liquido' | 'receita' | 'despesa'
  grupo: string
  fixoOuVariavel?: 'fixo' | 'variavel'
  descricao?: string
}): Promise<{ conta: PlanoContasCustomizadaRecord; auditId: string }> {
  const userId = pb.authStore.record?.id
  const payload = {
    codigo: conta.codigo.trim(),
    nome: conta.nome.trim(),
    natureza: conta.natureza,
    grupo: conta.grupo.trim(),
    fixoOuVariavel: conta.fixoOuVariavel || 'fixo',
    descricao: conta.descricao?.trim() || '',
    ativo: true,
    criado_por: userId || null,
  }

  // 1. Cria na coleção 'plano_contas_customizadas'
  const novaConta = await pb
    .collection('plano_contas_customizadas')
    .create<PlanoContasCustomizadaRecord>(payload)

  // 2. Grava log de auditoria reversível na coleção 'auditoria_operacoes_bloco'
  let auditId = ''
  try {
    const audit = await pb.collection('auditoria_operacoes_bloco').create({
      usuario: userId,
      tipo_operacao: 'criar_conta_plano',
      colecao_alvo: 'plano_contas_customizadas',
      descricao: `Criação da conta contábil ${novaConta.codigo} - ${novaConta.nome} via Assistente Financeiro`,
      alteracoes_solicitadas: payload,
      total_registros_afetados: 1,
      total_falhas: 0,
      snapshot_anterior: [
        { id: novaConta.id, registro_id: novaConta.id, codigo: novaConta.codigo },
      ],
      desfeito: false,
    })
    auditId = audit.id
  } catch (auditErr) {
    console.warn('Aviso: Falha ao gravar auditoria da criação de conta contábil:', auditErr)
  }

  return { conta: novaConta, auditId }
}

/**
 * Cria um novo credor com auditoria para possibilitar reversão
 */
export async function criarCredorComAuditoria(
  dados: CredorFormData,
): Promise<{ credorId: string; auditId: string }> {
  const userId = pb.authStore.record?.id
  const credor = await salvarCredor(dados)

  let auditId = ''
  try {
    const audit = await pb.collection('auditoria_operacoes_bloco').create({
      usuario: userId,
      tipo_operacao: 'criar_credor',
      colecao_alvo: 'credores',
      descricao: `Cadastro de credor "${credor.nome_razao_social}" via Assistente Financeiro`,
      alteracoes_solicitadas: dados,
      total_registros_afetados: 1,
      total_falhas: 0,
      snapshot_anterior: [
        { id: credor.id, registro_id: credor.id, nome: credor.nome_razao_social },
      ],
      desfeito: false,
    })
    auditId = audit.id
  } catch (auditErr) {
    console.warn('Aviso: Falha ao gravar auditoria de credor:', auditErr)
  }

  return { credorId: credor.id, auditId }
}

/**
 * Executa uma ação proposta pelo Assistente Financeiro após confirmação explícita do usuário
 */
export async function executarAcaoFinanceira(
  proposta: PropostaAcaoData,
): Promise<ExecucaoAcaoResultado> {
  const { tipo, dados } = proposta

  if (tipo === 'criar_conta_plano') {
    const codigo = String(dados.codigo || '').trim()
    const nome = String(dados.nome || '').trim()
    const natureza = dados.natureza as any
    const grupo = String(dados.grupo || '').trim()

    if (!codigo || !nome || !natureza || !grupo) {
      throw new Error(
        'Parâmetros insuficientes para criar conta contábil (código, nome, natureza e grupo são obrigatórios).',
      )
    }

    const { conta, auditId } = await criarContaPlanoContasComAuditoria({
      codigo,
      nome,
      natureza,
      grupo,
      fixoOuVariavel: dados.fixoOuVariavel as any,
      descricao: dados.descricao as string,
    })

    return {
      sucesso: true,
      auditId,
      mensagem: `Conta ${conta.codigo} (${conta.nome}) criada com sucesso no Plano de Contas!`,
      dadosResultado: conta as any,
    }
  }

  if (tipo === 'criar_credor') {
    const nomeRazao = String(dados.nome_razao_social || '').trim()
    if (!nomeRazao) {
      throw new Error('Nome ou Razão Social do credor é obrigatório.')
    }

    const credorForm: CredorFormData = {
      nome_razao_social: nomeRazao,
      nome_fantasia: dados.nome_fantasia ? String(dados.nome_fantasia) : '',
      cnpj_cpf: dados.cnpj_cpf ? String(dados.cnpj_cpf) : '',
      tipo_pessoa: (dados.tipo_pessoa as any) || 'pj',
      categoria: (dados.categoria as any) || 'outros',
      email: dados.email ? String(dados.email) : '',
      telefone: dados.telefone ? String(dados.telefone) : '',
      status: 'ativo',
      observacoes: dados.observacoes
        ? String(dados.observacoes)
        : 'Cadastrado via Assistente Financeiro',
    }

    const { credorId, auditId } = await criarCredorComAuditoria(credorForm)
    return {
      sucesso: true,
      auditId,
      mensagem: `Credor "${nomeRazao}" cadastrado com sucesso!`,
      dadosResultado: { id: credorId, nome: nomeRazao },
    }
  }

  throw new Error(`Tipo de ação "${tipo}" não suportado para execução direta.`)
}

/**
 * Reverte a ação financeira executada utilizando a auditoria existente do app
 */
export async function desfazerAcaoFinanceira(
  auditId?: string,
): Promise<{ sucesso: boolean; mensagem: string }> {
  // Se for criação de conta no plano de contas, remove também do cache em memória
  if (auditId) {
    try {
      const audit = await pb.collection('auditoria_operacoes_bloco').getOne(auditId)
      if (audit && audit.tipo_operacao === 'criar_conta_plano') {
        const raw = audit.snapshot_anterior
        const snap = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (Array.isArray(snap) && snap[0]?.id) {
          removerContaExtraPlano(snap[0].id)
        }
      }
    } catch {
      /* intentionally ignored */
    }
  }

  const res = await desfazerUltimaOperacaoBloco(auditId)
  return {
    sucesso: res.sucesso,
    mensagem: res.mensagem,
  }
}
