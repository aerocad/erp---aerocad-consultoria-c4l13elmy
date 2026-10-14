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
  similaridadeTexto?: number
}

export interface AlertaDuplicidade {
  detectada: boolean
  motivo: string
  lancamentoExistente?: {
    id: string
    tipo: 'conta_pagar' | 'conta_receber' | 'parcela'
    descricao: string
    valor: number
    data: string
    documento?: string
  }
}

/**
 * Verifica se já existe um lançamento com mesmo documento ou mesmo fornecedor/valor/data para evitar duplicidade
 */
export function verificarDuplicidadeLancamento(
  tipo: 'conta_pagar' | 'conta_receber',
  dados: {
    valor: number
    data: string
    numeroDocumento?: string
    fornecedorOuCliente?: string
  },
  contasExistentes: Array<{
    id: string
    valor: number
    data: string
    numero_documento?: string
    fornecedorOuCliente?: string
    descricao?: string
  }>,
): AlertaDuplicidade {
  const dataAlvo = dados.data.slice(0, 10)
  const docAlvo = dados.numeroDocumento?.trim().toLowerCase()

  for (const c of contasExistentes) {
    // 1. Mesmo número de documento não vazio
    if (docAlvo && c.numero_documento && c.numero_documento.trim().toLowerCase() === docAlvo) {
      return {
        detectada: true,
        motivo: `Já existe um lançamento com o mesmo número de documento (${c.numero_documento}) no valor de R$ ${c.valor.toFixed(2)}.`,
        lancamentoExistente: {
          id: c.id,
          tipo,
          descricao: c.descricao || c.fornecedorOuCliente || '',
          valor: c.valor,
          data: c.data,
          documento: c.numero_documento,
        },
      }
    }

    // 2. Mesmo valor exato + mesma data (tolerância 0 dias) + mesmo favorecido
    const diffValor = Math.abs(c.valor - dados.valor)
    const mesmaData = c.data.slice(0, 10) === dataAlvo
    if (diffValor < 0.01 && mesmaData) {
      if (
        dados.fornecedorOuCliente &&
        c.fornecedorOuCliente &&
        dados.fornecedorOuCliente.toLowerCase().includes(c.fornecedorOuCliente.toLowerCase())
      ) {
        return {
          detectada: true,
          motivo: `Possível lançamento duplicado: mesmo fornecedor/cliente (${c.fornecedorOuCliente}), mesmo valor (R$ ${c.valor.toFixed(2)}) e mesma data (${dataAlvo}).`,
          lancamentoExistente: {
            id: c.id,
            tipo,
            descricao: c.descricao || c.fornecedorOuCliente || '',
            valor: c.valor,
            data: c.data,
          },
        }
      }
    }
  }

  return { detectada: false, motivo: '' }
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
    // Busca em contas a pagar cruzando valor, proximidade de data e beneficiário
    const descTx = transacao.descricao.toLowerCase()
    for (const cp of contexto.contasPagar) {
      if (cp.status === 'cancelado') continue
      const diffValor = Math.abs(cp.valor - valorTx)
      if (diffValor <= 0.05) {
        const dataRef = cp.data_pagamento || cp.data_vencimento
        const diffDias = calcularDiferencaDias(transacao.data, dataRef)
        if (diffDias <= toleranciaDias) {
          // Bônus de confiança se nome do fornecedor ou documento bater no extrato
          const matchBeneficiario =
            cp.fornecedor && descTx.includes(cp.fornecedor.toLowerCase().slice(0, 6))
          const matchDoc = cp.numero_documento && descTx.includes(cp.numero_documento.toLowerCase())

          let confianca: 'alta' | 'media' | 'baixa' =
            diffDias <= 1 || matchBeneficiario || matchDoc
              ? 'alta'
              : diffDias <= 3
                ? 'media'
                : 'baixa'

          sugestoes.push({
            tipo: 'conta_pagar',
            id: cp.id,
            titulo: `${cp.fornecedor} — ${cp.descricao}`,
            detalhe: `Vencimento: ${cp.data_vencimento.slice(0, 10)}${cp.status === 'pago' ? ' (Já quitado)' : ''}${matchBeneficiario ? ' · Beneficiário coincide' : ''}`,
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
