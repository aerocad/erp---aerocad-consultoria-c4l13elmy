import pb from '@/lib/pocketbase/client'
import type { CredorRecord, ContaPagarRecord, CategoriaCredor, TipoPessoaCredor } from '@/types/crm'

export const CATEGORIA_CREDOR_LABELS: Record<CategoriaCredor, string> = {
  fornecedor_servicos: 'Fornecedor de Serviços',
  fornecedor_material: 'Fornecedor de Material',
  locador: 'Locador / Aluguel',
  condominio: 'Condomínio',
  utilidades: 'Utilidades (Energia, Água, Telecom)',
  impostos_orgaos_publicos: 'Impostos & Órgãos Públicos',
  instituicao_financeira: 'Instituição Financeira / Banco',
  folha_encargos: 'Folha de Pagamento & Encargos',
  contador: 'Contabilidade & Consultoria',
  outros: 'Outros',
}

export const TIPO_PESSOA_LABELS: Record<TipoPessoaCredor, string> = {
  pj: 'Pessoa Jurídica (PJ)',
  pf: 'Pessoa Física (PF)',
}

export interface CredorFormData {
  nome_razao_social: string
  nome_fantasia?: string
  cnpj_cpf: string
  tipo_pessoa: TipoPessoaCredor
  categoria: CategoriaCredor
  email?: string
  telefone?: string
  endereco?: string
  cidade_uf?: string
  banco_nome?: string
  banco_agencia?: string
  banco_conta?: string
  chave_pix?: string
  status: 'ativo' | 'inativo'
  observacoes?: string
}

export interface ImpactoExclusaoCredor {
  podeExcluir: boolean
  totalContasVinculadas: number
  contasAbertas: number
  contasPagas: number
  valorTotalAberto: number
  valorTotalPago: number
  mensagem: string
}

/**
 * Busca todos os credores ativos/inativos ordenados por nome
 */
export async function listarCredores(): Promise<CredorRecord[]> {
  return await pb.collection('credores').getFullList<CredorRecord>({
    sort: 'nome_razao_social',
    expand: 'criado_por',
    requestKey: null,
  })
}

/**
 * Busca credor por documento (CNPJ ou CPF) limpando pontuação
 */
export async function buscarCredorPorDocumento(cnpjCpf: string): Promise<CredorRecord | null> {
  const limpo = cnpjCpf.replace(/\D/g, '')
  if (!limpo) return null

  try {
    const todos = await pb.collection('credores').getFullList<CredorRecord>({
      requestKey: null,
    })
    const achado = todos.find((c) => c.cnpj_cpf.replace(/\D/g, '') === limpo)
    return achado || null
  } catch (err) {
    console.warn('Erro ao buscar credor por documento:', err)
    return null
  }
}

/**
 * Busca credor por aproximação de nome ou razão social
 */
export async function buscarCredorPorNome(nome: string): Promise<CredorRecord | null> {
  const limpo = nome.trim().toLowerCase()
  if (!limpo || limpo.length < 3) return null

  try {
    const todos = await pb.collection('credores').getFullList<CredorRecord>({
      requestKey: null,
    })
    const achado = todos.find((c) => {
      const r = (c.nome_razao_social || '').toLowerCase()
      const f = (c.nome_fantasia || '').toLowerCase()
      return (
        r.includes(limpo) || limpo.includes(r) || (f && (f.includes(limpo) || limpo.includes(f)))
      )
    })
    return achado || null
  } catch (err) {
    console.warn('Erro ao buscar credor por nome:', err)
    return null
  }
}

/**
 * Salva (cria ou atualiza) um credor
 */
export async function salvarCredor(
  dados: CredorFormData,
  id?: string,
  arquivosAnexos?: File[],
): Promise<CredorRecord> {
  const payload: Record<string, unknown> = {
    nome_razao_social: dados.nome_razao_social.trim(),
    nome_fantasia: dados.nome_fantasia?.trim() || '',
    cnpj_cpf: dados.cnpj_cpf.trim(),
    tipo_pessoa: dados.tipo_pessoa,
    categoria: dados.categoria,
    email: dados.email?.trim() || '',
    telefone: dados.telefone?.trim() || '',
    endereco: dados.endereco?.trim() || '',
    cidade_uf: dados.cidade_uf?.trim() || '',
    banco_nome: dados.banco_nome?.trim() || '',
    banco_agencia: dados.banco_agencia?.trim() || '',
    banco_conta: dados.banco_conta?.trim() || '',
    chave_pix: dados.chave_pix?.trim() || '',
    status: dados.status,
    observacoes: dados.observacoes?.trim() || '',
  }

  let credor: CredorRecord
  if (id) {
    credor = await pb.collection('credores').update<CredorRecord>(id, payload)
  } else {
    payload.criado_por = pb.authStore.record?.id || null
    credor = await pb.collection('credores').create<CredorRecord>(payload)
  }

  // Upload de anexos caso enviados
  if (arquivosAnexos && arquivosAnexos.length > 0 && credor.id) {
    const formData = new FormData()
    for (const f of arquivosAnexos) {
      formData.append('anexos', f)
    }
    credor = await pb.collection('credores').update<CredorRecord>(credor.id, formData)
  }

  return credor
}

/**
 * Analisa o impacto antes de excluir um credor (vínculos com contas a pagar)
 */
export async function verificarImpactoExclusaoCredor(
  credorId: string,
): Promise<ImpactoExclusaoCredor> {
  try {
    const contas = await pb.collection('contas_pagar').getFullList<ContaPagarRecord>({
      filter: `credor = "${credorId}"`,
      requestKey: null,
    })

    const totalContasVinculadas = contas.length
    const contasAbertas = contas.filter(
      (c) => c.status !== 'pago' && c.status !== 'cancelado',
    ).length
    const contasPagas = contas.filter((c) => c.status === 'pago').length
    const valorTotalAberto = contas
      .filter((c) => c.status !== 'pago' && c.status !== 'cancelado')
      .reduce((acc, c) => acc + (c.valor || 0), 0)
    const valorTotalPago = contas
      .filter((c) => c.status === 'pago')
      .reduce((acc, c) => acc + (c.valor || 0), 0)

    if (totalContasVinculadas > 0) {
      return {
        podeExcluir: false,
        totalContasVinculadas,
        contasAbertas,
        contasPagas,
        valorTotalAberto,
        valorTotalPago,
        mensagem: `Existem ${totalContasVinculadas} conta(s) a pagar vinculada(s) a este credor (${contasAbertas} em aberto, ${contasPagas} pagas). Para manter a integridade fiscal e contábil, inative o credor em vez de excluí-lo.`,
      }
    }

    return {
      podeExcluir: true,
      totalContasVinculadas: 0,
      contasAbertas: 0,
      contasPagas: 0,
      valorTotalAberto: 0,
      valorTotalPago: 0,
      mensagem:
        'Este credor não possui contas a pagar vinculadas e pode ser excluído com segurança.',
    }
  } catch (err) {
    console.warn('Erro ao verificar impacto de exclusão:', err)
    return {
      podeExcluir: false,
      totalContasVinculadas: 0,
      contasAbertas: 0,
      contasPagas: 0,
      valorTotalAberto: 0,
      valorTotalPago: 0,
      mensagem: 'Não foi possível verificar os vínculos deste credor.',
    }
  }
}

/**
 * Exclui o credor se não houver contas vinculadas
 */
export async function excluirCredor(credorId: string): Promise<void> {
  const impacto = await verificarImpactoExclusaoCredor(credorId)
  if (!impacto.podeExcluir) {
    throw new Error(impacto.mensagem)
  }
  await pb.collection('credores').delete(credorId)
}

/**
 * Altera status do credor para inativo (alternativa segura à exclusão)
 */
export async function desativarCredor(credorId: string): Promise<CredorRecord> {
  return await pb.collection('credores').update<CredorRecord>(credorId, {
    status: 'inativo',
  })
}
