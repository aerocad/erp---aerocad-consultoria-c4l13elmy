import {
  ParcelaRecord,
  ContaPagarRecord,
  ContaReceberRecord,
  ContaBancariaRecord,
  AtivoPatrimonioRecord,
} from '@/types/crm'
import { PLANO_CONTAS_AEROCAD } from '@/lib/planoContas'
import {
  calcularDepreciacaoLinear,
  DEPRECIACAO_PADRAO,
} from '@/components/financeiro/AtivosPatrimonioTab'

export interface LinhaBalanceteContabil {
  codigo: string
  descricao: string
  grau: number // 1: Sintética (ex: 1), 2: Sintética (ex: 1.1), 3: Analítica (ex: 1.1.1)
  natureza: 'D' | 'C' // Devedora ou Credora
  saldoAnterior: number
  debitos: number
  creditos: number
  saldoFinal: number
  saldoFinalNatureza: 'D' | 'C'
  contaBancariaNome?: string
}

export interface BalanceteVerificacaoResultado {
  periodoRotulo: string
  ano: string
  contaBancariaId: string
  contaBancariaNome: string
  dataGeracao: string
  linhas: LinhaBalanceteContabil[]
  totalSaldoAnteriorDevedor: number
  totalSaldoAnteriorCredor: number
  totalDebitos: number
  totalCreditos: number
  totalSaldoFinalDevedor: number
  totalSaldoFinalCredor: number
  estaEquilibrado: number // diferença entre débitos e créditos
  diferencaSaldoFinal: number
  quantidadeContas: number
}

interface ParametrosCalculoBalancete {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  contasBancarias: ContaBancariaRecord[]
  ativosPatrimonio: AtivoPatrimonioRecord[]
  ano: string
  mesesFiltro: number[] | null
  periodoRotulo: string
  contaBancariaId: string
}

export function calcularBalanceteVerificacao({
  parcelas,
  contasPagar,
  contasReceber,
  contasBancarias,
  ativosPatrimonio,
  ano,
  mesesFiltro,
  periodoRotulo,
  contaBancariaId,
}: ParametrosCalculoBalancete): BalanceteVerificacaoResultado {
  // 1. Identifica conta bancária ativa
  const contaAtivaNome =
    contaBancariaId === 'todas'
      ? 'Todas as Contas PJ (Consolidado)'
      : contasBancarias.find((c) => c.id === contaBancariaId)?.apelido ||
        contasBancarias.find((c) => c.id === contaBancariaId)?.banco_nome ||
        'Conta PJ Específica'

  const matchConta = (itemContaId?: string | null): boolean => {
    if (contaBancariaId === 'todas') return true
    return itemContaId === contaBancariaId
  }

  const parseDataIso = (dataStr?: string | null): Date | null => {
    if (!dataStr) return null
    const parts = dataStr.slice(0, 10).split('-')
    if (parts.length < 3) return null
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  }

  // Determinar limites do período de análise
  let anoNumero = ano === 'todos' ? 2026 : Number(ano) || 2026
  let mesInicio = 1
  let mesFim = 12

  if (mesesFiltro && mesesFiltro.length > 0) {
    mesInicio = Math.min(...mesesFiltro)
    mesFim = Math.max(...mesesFiltro)
  }

  const inicioPeriodo = new Date(anoNumero, mesInicio - 1, 1, 0, 0, 0, 0)
  const fimPeriodo = new Date(anoNumero, mesFim, 0, 23, 59, 59, 999)

  const ehAntesPeriodo = (dStr?: string | null): boolean => {
    if (!dStr) return false
    const d = parseDataIso(dStr)
    if (!d) return false
    if (ano === 'todos') return false
    return d.getTime() < inicioPeriodo.getTime()
  }

  const ehNoPeriodo = (dStr?: string | null): boolean => {
    if (!dStr) return false
    const d = parseDataIso(dStr)
    if (!d) return false
    if (ano === 'todos') return true
    return d.getTime() >= inicioPeriodo.getTime() && d.getTime() <= fimPeriodo.getTime()
  }

  // Contas bancárias consideradas
  const contasConsideradas =
    contaBancariaId === 'todas'
      ? contasBancarias
      : contasBancarias.filter((c) => c.id === contaBancariaId)

  // -------------------------------------------------------------
  // APURAÇÃO DE MOVIMENTAÇÕES BANCÁRIAS (CONTA 1.1.1 - DISPONIBILIDADES)
  // -------------------------------------------------------------
  let dispSaldoAnterior = 0
  let dispDebitosPeriodo = 0 // Entradas no banco são Débitos no Ativo
  let dispCreditosPeriodo = 0 // Saídas do banco são Créditos no Ativo

  for (const cb of contasConsideradas) {
    dispSaldoAnterior += cb.saldo_inicial || 0

    // Parcelas de projetos recebidas
    parcelas.forEach((p) => {
      if (p.conta_bancaria !== cb.id || p.status !== 'paga') return
      const dataRef = p.data_pagamento || p.data_faturamento || p.vencimento
      const v = p.valor_recebido || p.valor || 0
      if (ehAntesPeriodo(dataRef)) {
        dispSaldoAnterior += v
      } else if (ehNoPeriodo(dataRef)) {
        dispDebitosPeriodo += v
      }
    })

    // Receitas avulsas recebidas
    contasReceber.forEach((cr) => {
      if (cr.conta_bancaria !== cb.id || cr.status !== 'recebido') return
      const dataRef = cr.data_recebimento || cr.data_vencimento
      const v = cr.valor_recebido || cr.valor || 0
      if (ehAntesPeriodo(dataRef)) {
        dispSaldoAnterior += v
      } else if (ehNoPeriodo(dataRef)) {
        dispDebitosPeriodo += v
      }
    })

    // Contas a pagar pagas
    contasPagar.forEach((cp) => {
      if (cp.conta_bancaria !== cb.id || cp.status !== 'pago') return
      const dataRef = cp.data_pagamento || cp.data_vencimento
      const v = cp.valor || 0
      if (ehAntesPeriodo(dataRef)) {
        dispSaldoAnterior -= v
      } else if (ehNoPeriodo(dataRef)) {
        dispCreditosPeriodo += v
      }
    })
  }

  const dispSaldoFinal = dispSaldoAnterior + dispDebitosPeriodo - dispCreditosPeriodo

  // -------------------------------------------------------------
  // APURAÇÃO DE CLIENTES A FATURAR / RECEBER (CONTA 1.1.2)
  // -------------------------------------------------------------
  let cliSaldoAnterior = 0
  let cliDebitosPeriodo = 0 // Emissão de faturamento aumenta direitos (Débito)
  let cliCreditosPeriodo = 0 // Liquidação/Recebimento baixa direitos (Crédito)

  parcelas.forEach((p) => {
    if (!matchConta(p.conta_bancaria)) return
    const v = p.valor || 0
    const dFat = p.data_faturamento || p.vencimento
    const dPag = p.data_pagamento

    if (ehAntesPeriodo(dFat)) {
      cliSaldoAnterior += v
      if (p.status === 'paga' && ehAntesPeriodo(dPag)) {
        cliSaldoAnterior -= p.valor_recebido || v
      } else if (p.status === 'paga' && ehNoPeriodo(dPag)) {
        cliCreditosPeriodo += p.valor_recebido || v
      }
    } else if (ehNoPeriodo(dFat)) {
      cliDebitosPeriodo += v
      if (p.status === 'paga' && ehNoPeriodo(dPag)) {
        cliCreditosPeriodo += p.valor_recebido || v
      }
    }
  })

  const cliSaldoFinal = Math.max(0, cliSaldoAnterior + cliDebitosPeriodo - cliCreditosPeriodo)

  // -------------------------------------------------------------
  // IMOBILIZADO E ATIVOS (CONTA 1.2)
  // -------------------------------------------------------------
  let ativosCustoHistorico = 0
  let ativosDepreciacaoAcumulada = 0

  ativosPatrimonio.forEach((at) => {
    const calc = calcularDepreciacaoLinear(
      at.valor_aquisicao,
      at.data_aquisicao,
      at.vida_util_meses || DEPRECIACAO_PADRAO[at.categoria]?.vidaUtilMeses || 120,
      at.valor_residual || 0,
    )
    ativosCustoHistorico += at.valor_aquisicao
    ativosDepreciacaoAcumulada += calc.depreciacaoAcumulada
  })

  // -------------------------------------------------------------
  // PASSIVO CIRCULANTE: FORNECEDORES E CONTAS A PAGAR (CONTA 2.1)
  // Natureza Credora: Créditos aumentam obrigações, Débitos baixam pagamentos
  // -------------------------------------------------------------
  let fornSaldoAnterior = 0
  let fornCreditosPeriodo = 0 // Reconhecimento de despesa / título a pagar
  let fornDebitosPeriodo = 0 // Quitação de despesa baixa passivo (Débito)

  contasPagar.forEach((cp) => {
    if (!matchConta(cp.conta_bancaria)) return
    const v = cp.valor || 0
    const dVenc = cp.data_vencimento
    const dPag = cp.data_pagamento

    if (ehAntesPeriodo(dVenc)) {
      if (cp.status !== 'pago' || (dPag && !ehAntesPeriodo(dPag))) {
        fornSaldoAnterior += v
      }
      if (cp.status === 'pago' && ehNoPeriodo(dPag)) {
        fornDebitosPeriodo += v
      }
    } else if (ehNoPeriodo(dVenc)) {
      fornCreditosPeriodo += v
      if (cp.status === 'pago' && ehNoPeriodo(dPag)) {
        fornDebitosPeriodo += v
      }
    }
  })

  const fornSaldoFinal = Math.max(0, fornSaldoAnterior + fornCreditosPeriodo - fornDebitosPeriodo)

  // -------------------------------------------------------------
  // RECEITAS (CONTA 4) - Natureza Credora
  // -------------------------------------------------------------
  let recDebitosPeriodo = 0
  let recCreditosPeriodo = 0 // Receitas são lançadas a Crédito

  parcelas.forEach((p) => {
    if (!matchConta(p.conta_bancaria) || p.status !== 'paga') return
    const dataRef = p.data_pagamento || p.data_faturamento || p.vencimento
    if (ehNoPeriodo(dataRef)) {
      recCreditosPeriodo += p.valor_recebido || p.valor || 0
    }
  })

  contasReceber.forEach((cr) => {
    if (!matchConta(cr.conta_bancaria) || cr.status !== 'recebido') return
    const dataRef = cr.data_recebimento || cr.data_vencimento
    if (ehNoPeriodo(dataRef)) {
      recCreditosPeriodo += cr.valor_recebido || cr.valor || 0
    }
  })

  // -------------------------------------------------------------
  // DESPESAS OPERACIONAIS, CUSTOS E TRIBUTOS (CONTA 3) - Natureza Devedora
  // Débitos aumentam despesas
  // -------------------------------------------------------------
  let despDebitosPeriodo = 0
  let despCreditosPeriodo = 0

  contasPagar.forEach((cp) => {
    if (!matchConta(cp.conta_bancaria) || cp.status !== 'pago') return
    const dataRef = cp.data_pagamento || cp.data_vencimento
    if (ehNoPeriodo(dataRef)) {
      despDebitosPeriodo += cp.valor || 0
    }
  })

  // -------------------------------------------------------------
  // PATRIMÔNIO LÍQUIDO / CAPITAL SOCIAL / RESULTADOS (CONTA 2.2)
  // -------------------------------------------------------------
  const ativoTotalFinal =
    dispSaldoFinal + cliSaldoFinal + (ativosCustoHistorico - ativosDepreciacaoAcumulada)
  const passivoExigivelFinal = fornSaldoFinal
  const plTotalFinal = Math.max(0, ativoTotalFinal - passivoExigivelFinal)
  const capitalSocial = Math.min(plTotalFinal, 50000)
  const lucrosAcumulados = Math.max(0, plTotalFinal - capitalSocial)

  // -------------------------------------------------------------
  // MONTAGEM DAS LINHAS DO BALANCETE (PADRÃO PLANO DE CONTAS AEROCAD)
  // -------------------------------------------------------------
  const linhas: LinhaBalanceteContabil[] = []

  // 1. ATIVO
  linhas.push({
    codigo: '1',
    descricao: 'ATIVO TOTAL',
    grau: 1,
    natureza: 'D',
    saldoAnterior:
      dispSaldoAnterior + cliSaldoAnterior + ativosCustoHistorico - ativosDepreciacaoAcumulada,
    debitos: dispDebitosPeriodo + cliDebitosPeriodo,
    creditos: dispCreditosPeriodo + cliCreditosPeriodo,
    saldoFinal: ativoTotalFinal,
    saldoFinalNatureza: 'D',
  })

  linhas.push({
    codigo: '1.1',
    descricao: 'ATIVO CIRCULANTE',
    grau: 2,
    natureza: 'D',
    saldoAnterior: dispSaldoAnterior + cliSaldoAnterior,
    debitos: dispDebitosPeriodo + cliDebitosPeriodo,
    creditos: dispCreditosPeriodo + cliCreditosPeriodo,
    saldoFinal: dispSaldoFinal + cliSaldoFinal,
    saldoFinalNatureza: 'D',
  })

  linhas.push({
    codigo: '1.1.1',
    descricao: 'Disponibilidades (Bancos Conta Movimento PJ)',
    grau: 3,
    natureza: 'D',
    saldoAnterior: dispSaldoAnterior,
    debitos: dispDebitosPeriodo,
    creditos: dispCreditosPeriodo,
    saldoFinal: dispSaldoFinal,
    saldoFinalNatureza: dispSaldoFinal >= 0 ? 'D' : 'C',
    contaBancariaNome: contaAtivaNome,
  })

  // Detalhamento por conta PJ individual quando aplicável
  if (contaBancariaId === 'todas' && contasConsideradas.length > 0) {
    contasConsideradas.forEach((cb, idx) => {
      let subSaldoAnt = cb.saldo_inicial || 0
      let subDebitos = 0
      let subCreditos = 0

      parcelas.forEach((p) => {
        if (p.conta_bancaria !== cb.id || p.status !== 'paga') return
        const d = p.data_pagamento || p.vencimento
        const val = p.valor_recebido || p.valor || 0
        if (ehAntesPeriodo(d)) subSaldoAnt += val
        else if (ehNoPeriodo(d)) subDebitos += val
      })
      contasReceber.forEach((cr) => {
        if (cr.conta_bancaria !== cb.id || cr.status !== 'recebido') return
        const d = cr.data_recebimento || cr.data_vencimento
        const val = cr.valor_recebido || cr.valor || 0
        if (ehAntesPeriodo(d)) subSaldoAnt += val
        else if (ehNoPeriodo(d)) subDebitos += val
      })
      contasPagar.forEach((cp) => {
        if (cp.conta_bancaria !== cb.id || cp.status !== 'pago') return
        const d = cp.data_pagamento || cp.data_vencimento
        const val = cp.valor || 0
        if (ehAntesPeriodo(d)) subSaldoAnt -= val
        else if (ehNoPeriodo(d)) subCreditos += val
      })

      const subFinal = subSaldoAnt + subDebitos - subCreditos
      linhas.push({
        codigo: `1.1.1.${idx + 1}`,
        descricao: `  └ ${cb.apelido || cb.banco_nome} (Ag: ${cb.agencia || '-'} / CC: ${cb.numero_conta || '-'})`,
        grau: 3,
        natureza: 'D',
        saldoAnterior: subSaldoAnt,
        debitos: subDebitos,
        creditos: subCreditos,
        saldoFinal: subFinal,
        saldoFinalNatureza: subFinal >= 0 ? 'D' : 'C',
        contaBancariaNome: cb.apelido || cb.banco_nome,
      })
    })
  }

  linhas.push({
    codigo: '1.1.2',
    descricao: 'Clientes e Medições a Receber de Projetos',
    grau: 3,
    natureza: 'D',
    saldoAnterior: cliSaldoAnterior,
    debitos: cliDebitosPeriodo,
    creditos: cliCreditosPeriodo,
    saldoFinal: cliSaldoFinal,
    saldoFinalNatureza: 'D',
  })

  linhas.push({
    codigo: '1.2',
    descricao: 'ATIVO NÃO CIRCULANTE (Imobilizado & Bens)',
    grau: 2,
    natureza: 'D',
    saldoAnterior: ativosCustoHistorico - ativosDepreciacaoAcumulada,
    debitos: 0,
    creditos: 0,
    saldoFinal: ativosCustoHistorico - ativosDepreciacaoAcumulada,
    saldoFinalNatureza: 'D',
  })

  // 2. PASSIVO E PATRIMÔNIO LÍQUIDO
  linhas.push({
    codigo: '2',
    descricao: 'PASSIVO E PATRIMÔNIO LÍQUIDO',
    grau: 1,
    natureza: 'C',
    saldoAnterior: fornSaldoAnterior + plTotalFinal,
    debitos: fornDebitosPeriodo,
    creditos: fornCreditosPeriodo,
    saldoFinal: fornSaldoFinal + plTotalFinal,
    saldoFinalNatureza: 'C',
  })

  linhas.push({
    codigo: '2.1',
    descricao: 'PASSIVO CIRCULANTE (Obrigações e Fornecedores)',
    grau: 2,
    natureza: 'C',
    saldoAnterior: fornSaldoAnterior,
    debitos: fornDebitosPeriodo,
    creditos: fornCreditosPeriodo,
    saldoFinal: fornSaldoFinal,
    saldoFinalNatureza: 'C',
  })

  linhas.push({
    codigo: '2.1.1',
    descricao: 'Fornecedores e Contas a Pagar Comerciais',
    grau: 3,
    natureza: 'C',
    saldoAnterior: fornSaldoAnterior,
    debitos: fornDebitosPeriodo,
    creditos: fornCreditosPeriodo,
    saldoFinal: fornSaldoFinal,
    saldoFinalNatureza: 'C',
  })

  linhas.push({
    codigo: '2.2',
    descricao: 'PATRIMÔNIO LÍQUIDO',
    grau: 2,
    natureza: 'C',
    saldoAnterior: plTotalFinal,
    debitos: 0,
    creditos: 0,
    saldoFinal: plTotalFinal,
    saldoFinalNatureza: 'C',
  })

  linhas.push({
    codigo: '2.2.1',
    descricao: 'Capital Social Subscrito e Integralizado',
    grau: 3,
    natureza: 'C',
    saldoAnterior: capitalSocial,
    debitos: 0,
    creditos: 0,
    saldoFinal: capitalSocial,
    saldoFinalNatureza: 'C',
  })

  linhas.push({
    codigo: '2.2.2',
    descricao: 'Lucros e Resultados Acumulados do Exercício',
    grau: 3,
    natureza: 'C',
    saldoAnterior: lucrosAcumulados,
    debitos: 0,
    creditos: 0,
    saldoFinal: lucrosAcumulados,
    saldoFinalNatureza: 'C',
  })

  // 3. DESPESAS E CUSTOS OPERACIONAIS (Natureza Devedora)
  linhas.push({
    codigo: '3',
    descricao: 'DESPESAS E CUSTOS OPERACIONAIS',
    grau: 1,
    natureza: 'D',
    saldoAnterior: 0,
    debitos: despDebitosPeriodo,
    creditos: despCreditosPeriodo,
    saldoFinal: despDebitosPeriodo - despCreditosPeriodo,
    saldoFinalNatureza: 'D',
  })

  // Subgrupos de despesas baseados no PLANO_CONTAS_AEROCAD
  const categoriasDesp = [
    { codigo: '3.1', desc: 'Despesas Fixas e Administrativas' },
    { codigo: '3.2', desc: 'Custos Diretos e Terceirizados de Projetos' },
    { codigo: '3.3', desc: 'Impostos e Encargos sobre Faturamento' },
  ]

  categoriasDesp.forEach((cat) => {
    let catDebitos = 0
    contasPagar.forEach((cp) => {
      if (!matchConta(cp.conta_bancaria) || cp.status !== 'pago') return
      const dataRef = cp.data_pagamento || cp.data_vencimento
      if (!ehNoPeriodo(dataRef)) return

      const cod = cp.plano_contas_codigo || ''
      // Se possui código contábil explícito (definido ou reclassificado), prioriza-o
      if (cod) {
        if (cod.startsWith(cat.codigo)) {
          catDebitos += cp.valor || 0
        }
      } else {
        if (cat.codigo === '3.3' && cp.categoria === 'impostos') {
          catDebitos += cp.valor || 0
        } else if (
          cat.codigo === '3.2' &&
          (cp.categoria === 'terceirizados' || Boolean(cp.projeto))
        ) {
          catDebitos += cp.valor || 0
        } else if (cat.codigo === '3.1') {
          const ehImp = cp.categoria === 'impostos'
          const ehTerc = cp.categoria === 'terceirizados' || Boolean(cp.projeto)
          if (!ehImp && !ehTerc) catDebitos += cp.valor || 0
        }
      }
    })

    linhas.push({
      codigo: cat.codigo,
      descricao: cat.desc,
      grau: 2,
      natureza: 'D',
      saldoAnterior: 0,
      debitos: catDebitos,
      creditos: 0,
      saldoFinal: catDebitos,
      saldoFinalNatureza: 'D',
    })
  })

  // 4. RECEITAS OPERACIONAIS (Natureza Credora)
  linhas.push({
    codigo: '4',
    descricao: 'RECEITAS OPERACIONAIS E FATURAMENTO',
    grau: 1,
    natureza: 'C',
    saldoAnterior: 0,
    debitos: recDebitosPeriodo,
    creditos: recCreditosPeriodo,
    saldoFinal: recCreditosPeriodo - recDebitosPeriodo,
    saldoFinalNatureza: 'C',
  })

  linhas.push({
    codigo: '4.1',
    descricao: 'Receita com Projetos e Pareceres Aeronáuticos',
    grau: 2,
    natureza: 'C',
    saldoAnterior: 0,
    debitos: 0,
    creditos: recCreditosPeriodo,
    saldoFinal: recCreditosPeriodo,
    saldoFinalNatureza: 'C',
  })

  // -------------------------------------------------------------
  // TOTALIZAÇÃO DE TESTAGEM (DÉBITOS = CRÉDITOS)
  // Somente linhas analíticas de grau 2 e 3 ou grau 1 não repetido
  // -------------------------------------------------------------
  // Para fins contábeis de conferência de partidas dobradas:
  const totalDebitos =
    dispDebitosPeriodo + cliDebitosPeriodo + fornDebitosPeriodo + despDebitosPeriodo
  const totalCreditos =
    dispCreditosPeriodo + cliCreditosPeriodo + fornCreditosPeriodo + recCreditosPeriodo

  const totalSaldoFinalDevedor =
    dispSaldoFinal +
    cliSaldoFinal +
    (ativosCustoHistorico - ativosDepreciacaoAcumulada) +
    (despDebitosPeriodo - despCreditosPeriodo)
  const totalSaldoFinalCredor =
    fornSaldoFinal + plTotalFinal + (recCreditosPeriodo - recDebitosPeriodo)

  return {
    periodoRotulo,
    ano,
    contaBancariaId,
    contaBancariaNome: contaAtivaNome,
    dataGeracao: new Date().toISOString(),
    linhas,
    totalSaldoAnteriorDevedor:
      dispSaldoAnterior + cliSaldoAnterior + ativosCustoHistorico - ativosDepreciacaoAcumulada,
    totalSaldoAnteriorCredor: fornSaldoAnterior + plTotalFinal,
    totalDebitos,
    totalCreditos,
    totalSaldoFinalDevedor,
    totalSaldoFinalCredor,
    estaEquilibrado: Math.abs(totalDebitos - totalCreditos),
    diferencaSaldoFinal: Math.abs(totalSaldoFinalDevedor - totalSaldoFinalCredor),
    quantidadeContas: linhas.length,
  }
}
