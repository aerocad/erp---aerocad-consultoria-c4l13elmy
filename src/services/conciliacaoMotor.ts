/**
 * Motor de conciliação bancária simples:
 * Sugere correspondência entre uma transação de extrato e itens do CRM:
 * - Entradas: parcelas a receber (ou já faturadas) e contas a receber
 * - Saídas: contas a pagar
 * Critérios: valor correspondente (tolerância de até R$ 0,05) e proximidade de data (±3 dias por padrão, ou mais).
 */

import type {
  ContaPagarRecord,
  ContaReceberRecord,
  ExtratoTransacaoRecord,
  ParcelaRecord,
} from '@/types/crm'

export interface SugestaoConciliacao {
  tipo: 'parcela' | 'conta_pagar' | 'conta_receber'
  id: string
  titulo: string
  detalhe: string
  valor: number
  dataReferencia: string
  diferencaDias: number
  confianca: 'alta' | 'media' | 'baixa'
}

function calcularDiferencaDias(data1Str: string, data2Str: string): number {
  if (!data1Str || !data2Str) return 999
  const d1 = new Date(data1Str.slice(0, 10))
  const d2 = new Date(data2Str.slice(0, 10))
  const diffMs = Math.abs(d1.getTime() - d2.getTime())
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export function encontrarSugestoesConciliacao(
  transacao:
    | ExtratoTransacaoRecord
    | { data: string; valor: number; tipo: 'entrada' | 'saida'; descricao: string },
  contexto: {
    parcelas: ParcelaRecord[]
    contasPagar: ContaPagarRecord[]
    contasReceber: ContaReceberRecord[]
  },
  toleranciaDias = 5,
): SugestaoConciliacao[] {
  const sugestoes: SugestaoConciliacao[] = []
  const valorTx = Number(transacao.valor)

  if (transacao.tipo === 'saida') {
    // Busca em contas a pagar
    for (const cp of contexto.contasPagar) {
      if (cp.status === 'cancelado') continue
      const diffValor = Math.abs(cp.valor - valorTx)
      if (diffValor <= 0.05) {
        const dataRef = cp.data_pagamento || cp.data_vencimento
        const diffDias = calcularDiferencaDias(transacao.data, dataRef)
        if (diffDias <= toleranciaDias) {
          const confianca = diffDias <= 1 ? 'alta' : diffDias <= 3 ? 'media' : 'baixa'
          sugestoes.push({
            tipo: 'conta_pagar',
            id: cp.id,
            titulo: `${cp.fornecedor} — ${cp.descricao}`,
            detalhe: `Vencimento: ${cp.data_vencimento.slice(0, 10)}${cp.status === 'pago' ? ' (Já quitado)' : ''}`,
            valor: cp.valor,
            dataReferencia: dataRef,
            diferencaDias: diffDias,
            confianca,
          })
        }
      }
    }
  } else {
    // Entrada: busca em parcelas do CRM
    for (const p of contexto.parcelas) {
      const valorComp = p.valor_recebido && p.valor_recebido > 0 ? p.valor_recebido : p.valor
      const diffValor = Math.abs(valorComp - valorTx)
      if (diffValor <= 0.05) {
        const dataRef = p.data_pagamento || p.data_faturamento || p.vencimento
        const diffDias = calcularDiferencaDias(transacao.data, dataRef)
        if (diffDias <= toleranciaDias) {
          const confianca = diffDias <= 1 ? 'alta' : diffDias <= 3 ? 'media' : 'baixa'
          const numNf = p.nf_numero ? `NFS-e nº ${p.nf_numero}` : ''
          const proj = p.expand?.projeto?.numero || ''
          const cli = p.expand?.cliente?.razao_social || ''
          sugestoes.push({
            tipo: 'parcela',
            id: p.id,
            titulo: `${numNf || p.descricao} ${proj ? `· ${proj}` : ''}`,
            detalhe: `${cli ? `Cliente: ${cli} · ` : ''}Venc/Fat: ${dataRef.slice(0, 10)}${p.status === 'paga' ? ' (Quitada)' : ''}`,
            valor: valorComp,
            dataReferencia: dataRef,
            diferencaDias: diffDias,
            confianca,
          })
        }
      }
    }

    // Entrada: busca em contas a receber avulsas
    for (const cr of contexto.contasReceber) {
      if (cr.status === 'cancelado') continue
      const diffValor = Math.abs(cr.valor - valorTx)
      if (diffValor <= 0.05) {
        const dataRef = cr.data_recebimento || cr.data_vencimento
        const diffDias = calcularDiferencaDias(transacao.data, dataRef)
        if (diffDias <= toleranciaDias) {
          const confianca = diffDias <= 1 ? 'alta' : diffDias <= 3 ? 'media' : 'baixa'
          sugestoes.push({
            tipo: 'conta_receber',
            id: cr.id,
            titulo: `${cr.cliente_nome} — ${cr.descricao}`,
            detalhe: `Vencimento: ${cr.data_vencimento.slice(0, 10)}${cr.status === 'recebido' ? ' (Já recebido)' : ''}`,
            valor: cr.valor,
            dataReferencia: dataRef,
            diferencaDias: diffDias,
            confianca,
          })
        }
      }
    }
  }

  // Ordena por menor diferença de dias
  return sugestoes.sort((a, b) => a.diferencaDias - b.diferencaDias)
}
