import pb from '@/lib/pocketbase/client'
import { invalidateApiCache } from '@/services/api'
import {
  PLANO_CONTAS_AEROCAD,
  obterItemPlanoContasPorCodigo,
  ItemPlanoContas,
} from '@/lib/planoContas'
import { UserRecord } from '@/types/crm'

export type ColecaoReclassificavel =
  | 'extratos_transacoes'
  | 'contas_pagar'
  | 'contas_receber'
  | 'parcelas'

export interface ReclassificarParametros {
  colecao: ColecaoReclassificavel
  id: string
  codigoNovo: string
  nomeNovo?: string
  codigoAnterior?: string
  nomeAnterior?: string
  descricaoRegistro?: string
  dataRegistro?: string
  user: UserRecord | null
}

export interface ReclassificarResultado {
  sucesso: boolean
  codigo: string
  nome: string
  balanceteDesatualizadoReferencia?: string
}

/**
 * Persiste a reclassificação contábil de um lançamento (extrato, conta_pagar, parcela, conta_receber)
 * Registra a auditoria na coleção auditoria_operacoes_bloco
 * Invalida o cache da API
 * Notifica se houver balancete oficial arquivado para o período que precise de regeneração
 */
export async function reclassificarLancamentoContabil({
  colecao,
  id,
  codigoNovo,
  nomeNovo,
  codigoAnterior,
  nomeAnterior,
  descricaoRegistro,
  dataRegistro,
  user,
}: ReclassificarParametros): Promise<ReclassificarResultado> {
  const conta = obterItemPlanoContasPorCodigo(codigoNovo)
  const nomeFinal = nomeNovo || conta?.nome || 'Conta Contábil Personalizada'

  // 1. Atualizar registro no PocketBase
  const payloadUpdate: Record<string, unknown> = {
    plano_contas_codigo: codigoNovo,
    plano_contas_nome: nomeFinal,
    classificacao_manual: true,
  }

  await pb.collection(colecao).update(id, payloadUpdate)

  // Invalida o cache da coleção
  invalidateApiCache(colecao)

  // 2. Registrar na auditoria_operacoes_bloco
  try {
    const auditoriaPayload = {
      usuario: user?.id || null,
      usuario_nome: user?.name || user?.email || 'Usuário AEROCAD',
      tipo_operacao: 'reclassificacao_contabil',
      descricao: `Reclassificação contábil de "${descricaoRegistro || id}" de [${codigoAnterior || 'Sem conta'} - ${nomeAnterior || 'Automático'}] para [${codigoNovo} - ${nomeFinal}]`,
      entidade: colecao,
      entidade_id: id,
      bloco_nome: 'plano_contas',
      detalhes_json: {
        colecao,
        registro_id: id,
        codigo_anterior: codigoAnterior || null,
        nome_anterior: nomeAnterior || null,
        codigo_novo: codigoNovo,
        nome_novo: nomeFinal,
        data_registro: dataRegistro || null,
      },
      dados_anteriores: {
        plano_contas_codigo: codigoAnterior || null,
        plano_contas_nome: nomeAnterior || null,
      },
      dados_novos: {
        plano_contas_codigo: codigoNovo,
        plano_contas_nome: nomeFinal,
        classificacao_manual: true,
      },
      data_hora: new Date().toISOString(),
      sucesso: true,
    }

    await pb.collection('auditoria_operacoes_bloco').create(auditoriaPayload)
  } catch (errAudit) {
    console.warn('Aviso: Falha ao registrar log de auditoria da reclassificação:', errAudit)
  }

  // 3. Verificar se existe balancete oficial arquivado para o período deste registro
  let referenciaDesatualizada: string | undefined
  if (dataRegistro && dataRegistro.length >= 7) {
    const ref = dataRegistro.slice(0, 7) // YYYY-MM
    try {
      const balancetes = await pb.collection('balancetes_mensais').getList(1, 1, {
        filter: `referencia = "${ref}"`,
      })
      if (balancetes.items.length > 0) {
        referenciaDesatualizada = ref
        // Marca evento local no window para avisar a aba de balancetes
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('aerocad:balancete_desatualizado', {
              detail: { referencia: ref },
            }),
          )
        }
      }
    } catch (_) {
      // Ignora erro de verificação de balancete
    }
  }

  return {
    sucesso: true,
    codigo: codigoNovo,
    nome: nomeFinal,
    balanceteDesatualizadoReferencia: referenciaDesatualizada,
  }
}
