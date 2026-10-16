import pb from '@/lib/pocketbase/client'
import { listAll, createOne, updateOne, deleteOne } from '@/services/api'
import type { ContaBancariaRecord } from '@/types/crm'

export interface ContaBancariaFormData {
  apelido: string
  banco_nome: string
  banco_codigo?: string
  agencia?: string
  numero_conta: string
  tipo_conta: 'corrente_pj' | 'poupanca_pj' | 'investimento_pj' | 'outro'
  chave_pix?: string
  saldo_inicial?: number
  ativo?: boolean
  cor_identificacao?: string
  observacoes?: string
}

export async function listarContasBancarias(
  apenasAtivas: boolean = false,
): Promise<ContaBancariaRecord[]> {
  const filter = apenasAtivas ? 'ativo = true' : ''
  return listAll<ContaBancariaRecord>('contas_bancarias', {
    sort: 'apelido',
    filter: filter || undefined,
  })
}

export async function salvarContaBancaria(
  dados: ContaBancariaFormData,
  idExistente?: string,
): Promise<ContaBancariaRecord> {
  const payload = {
    apelido: dados.apelido.trim(),
    banco_nome: dados.banco_nome.trim(),
    banco_codigo: dados.banco_codigo?.trim() || '',
    agencia: dados.agencia?.trim() || '',
    numero_conta: dados.numero_conta.trim(),
    tipo_conta: dados.tipo_conta || 'corrente_pj',
    chave_pix: dados.chave_pix?.trim() || '',
    saldo_inicial: typeof dados.saldo_inicial === 'number' ? dados.saldo_inicial : 0,
    ativo: dados.ativo !== undefined ? dados.ativo : true,
    cor_identificacao: dados.cor_identificacao?.trim() || '#FF6A13',
    observacoes: dados.observacoes?.trim() || '',
  }

  if (idExistente) {
    return updateOne<ContaBancariaRecord>('contas_bancarias', idExistente, payload)
  }
  return createOne<ContaBancariaRecord>('contas_bancarias', payload)
}

export async function alternarStatusContaBancaria(
  id: string,
  novoStatusAtivo: boolean,
): Promise<ContaBancariaRecord> {
  return updateOne<ContaBancariaRecord>('contas_bancarias', id, { ativo: novoStatusAtivo })
}

export async function excluirContaBancaria(id: string): Promise<void> {
  // Verifica se há lançamentos ou extratos vinculados
  const [pagarCount, receberCount, extratosCount] = await Promise.all([
    pb.collection('contas_pagar').getList(1, 1, { filter: `conta_bancaria = "${id}"` }),
    pb.collection('contas_receber').getList(1, 1, { filter: `conta_bancaria = "${id}"` }),
    pb.collection('extratos').getList(1, 1, { filter: `conta_bancaria = "${id}"` }),
  ])

  const totalVinculos = pagarCount.totalItems + receberCount.totalItems + extratosCount.totalItems
  if (totalVinculos > 0) {
    throw new Error(
      `Esta conta bancária possui ${totalVinculos} registro(s) vinculado(s) (contas a pagar/receber ou extratos). Em vez de excluir, desative a conta para manter o histórico financeiro consistente.`,
    )
  }

  await deleteOne('contas_bancarias', id)
}
