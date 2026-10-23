/**
 * SERVIÇO UNIFICADO DE BASE CONTÁBIL — CRM AEROCAD
 *
 * Consolida as 5 fontes oficiais do Plano de Contas:
 * 1. Extratos bancários classificados (com geração de partida dobrada por movimento bancário)
 * 2. Contas a Pagar (reconhecimento e quitações)
 * 3. Contas a Receber (avulsas e projetos / parcelas contratuais)
 * 4. Imobilizado & Ativos Patrimoniais (valor contábil líquido do módulo de Ativos & Patrimônio)
 * 5. Empréstimos & Financiamentos (passivo circulante e não circulante)
 *
 * Regras Contábeis Especiais:
 * - Partida dobrada por movimento bancário:
 *     Entrada bancária: D Banco PJ (1.1.1.01 Inter / 1.1.1.02 Caixa) / C Conta classificada
 *     Saída bancária:   D Conta classificada / C Banco PJ (1.1.1.01 Inter / 1.1.1.02 Caixa)
 * - Contas 2.1.8 e 2.2.3: Não deduzir encargos a apropriar enquanto o passivo estiver registrado
 *   apenas pelo principal (neutras quando não houver lançamentos de apropriação).
 * - Imobilizado: Lê o valor contábil líquido oficial dos ativos (custo - depreciação acumulada).
 */

import {
  PLANO_CONTAS_AEROCAD,
  ItemPlanoContas,
  isContaRedutora,
  classificarTransacaoExtrato,
  classificarContaPagar,
  classificarContaReceber,
  classificarParcela,
  obterItemPlanoContasPorCodigo,
} from '@/lib/planoContas'
import { DEPRECIACAO_PADRAO } from '@/services/balanceteContabilService'
import type {
  AtivoPatrimonioRecord,
  ContaBancariaRecord,
  ContaPagarRecord,
  ContaReceberRecord,
  EmprestimoFinanciamentoRecord,
  ExtratoTransacaoRecord,
  ParcelaRecord,
} from '@/types/crm'

export interface PernaLancamentoContabil {
  id: string
  data: string
  origem: 'extrato' | 'conta_pagar' | 'conta_receber' | 'parcela' | 'ativo' | 'emprestimo'
  registroOrigemId: string
  tipoMovimento: 'debito' | 'credito'
  contaCodigo: string
  contaNome: string
  contaGrupo: string
  valor: number
  descricao: string
  entidade?: string
  documentoRef?: string
  contaBancariaId?: string
  ehPartidaBancaria?: boolean
}

export interface TotaisContaContabil {
  conta: ItemPlanoContas
  volumeDebito: number
  volumeCredito: number
  qtdDebitos: number
  qtdCreditos: number
  qtdLancamentos: number
  saldoPeriodo: number // Positivo conforme natureza devedora ou credora
  naturezaSaldo: 'devedora' | 'credora'
  lancamentos: PernaLancamentoContabil[]
}

export interface ParametrosBaseContabil {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  contasBancarias: ContaBancariaRecord[]
  ativosPatrimonio: AtivoPatrimonioRecord[]
  emprestimosFinanciamentos?: EmprestimoFinanciamentoRecord[]
  extratosTransacoes?: ExtratoTransacaoRecord[]
  ano: string
  mesesFiltro: number[] | null
  contaBancariaId?: string // 'todas' ou id específico
}

export interface ConsolidacaoBaseContabil {
  ano: string
  periodoRotulo: string
  contaBancariaId: string
  pernasContabeis: PernaLancamentoContabil[]
  contasMap: Map<string, TotaisContaContabil>
  totalDebitos: number
  totalCreditos: number
  diferencaPartidas: number
  estaEquilibrado: boolean
  valorImobilizadoLiquidoAtivos: number
  totalGrupo4Liquido: number // Faturamento líquido com dedução de redutoras
  totalGrupo4Bruto: number
  totalGrupo4Redutoras: number
  totalGrupo3Despesas: number
}

// Mapeamento das contas bancárias para as contas contábeis do grupo 1.1.1
export function obterContaContabilBanco(
  contaBancaria?: ContaBancariaRecord | null,
  contaId?: string | null,
  contasBancarias: ContaBancariaRecord[] = [],
): { codigo: string; nome: string } {
  const cb = contaBancaria || (contaId ? contasBancarias.find((c) => c.id === contaId) : null)

  if (!cb) {
    return { codigo: '1.1.1.01', nome: 'Banco Inter PJ (Operacional)' }
  }

  const apelido = (cb.apelido || cb.banco_nome || '').toLowerCase()
  if (apelido.includes('caixa') || apelido.includes('cef')) {
    return { codigo: '1.1.1.02', nome: 'Caixa Econômica Federal PJ (Reserva)' }
  }
  return { codigo: '1.1.1.01', nome: 'Banco Inter PJ (Operacional)' }
}

/**
 * Calcula a depreciação linear de um ativo patrimonial
 */
export function calcularDepreciacaoAtivo(
  valorAquisicao: number,
  dataAquisicao: string,
  vidaUtilMeses: number,
  valorResidual: number = 0,
): { depreciacaoAcumulada: number; valorContabilAtual: number } {
  if (!valorAquisicao || valorAquisicao <= 0) {
    return { depreciacaoAcumulada: 0, valorContabilAtual: 0 }
  }

  if (!dataAquisicao || vidaUtilMeses <= 0) {
    return { depreciacaoAcumulada: 0, valorContabilAtual: valorAquisicao }
  }

  const dataAq = new Date(dataAquisicao)
  if (isNaN(dataAq.getTime())) {
    return { depreciacaoAcumulada: 0, valorContabilAtual: valorAquisicao }
  }

  const hoje = new Date()
  const mesesDecorridos = Math.max(
    0,
    (hoje.getFullYear() - dataAq.getFullYear()) * 12 + (hoje.getMonth() - dataAq.getMonth()),
  )

  const valorDepreciavel = Math.max(0, valorAquisicao - valorResidual)
  const taxaMensal = valorDepreciavel / vidaUtilMeses
  const depreciacaoAcumulada = Math.min(valorDepreciavel, mesesDecorridos * taxaMensal)
  const valorContabilAtual = Math.max(valorResidual, valorAquisicao - depreciacaoAcumulada)

  return { depreciacaoAcumulada, valorContabilAtual }
}

/**
 * Consolida a base contábil completa para uso unificado em Balancete, Balanço e DRE.
 */
export function consolidarBaseContabil({
  parcelas = [],
  contasPagar = [],
  contasReceber = [],
  contasBancarias = [],
  ativosPatrimonio = [],
  emprestimosFinanciamentos = [],
  extratosTransacoes = [],
  ano,
  mesesFiltro,
  contaBancariaId = 'todas',
}: ParametrosBaseContabil): ConsolidacaoBaseContabil {
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

  const anoNumero = ano === 'todos' ? 2026 : Number(ano) || 2026
  let mesInicio = 1
  let mesFim = 12

  if (mesesFiltro && mesesFiltro.length > 0) {
    mesInicio = Math.min(...mesesFiltro)
    mesFim = Math.max(...mesesFiltro)
  }

  const inicioPeriodo = new Date(anoNumero, mesInicio - 1, 1, 0, 0, 0, 0)
  const fimPeriodo = new Date(anoNumero, mesFim, 0, 23, 59, 59, 999)

  const ehNoPeriodo = (dStr?: string | null): boolean => {
    if (!dStr) return false
    const d = parseDataIso(dStr)
    if (!d) return false
    if (ano === 'todos') return true
    return d.getTime() >= inicioPeriodo.getTime() && d.getTime() <= fimPeriodo.getTime()
  }

  const pernasContabeis: PernaLancamentoContabil[] = []

  // -------------------------------------------------------------
  // 1. DEDUPLICAÇÃO E VÍNCULOS ENTRE EXTRATOS E CONTAS
  // -------------------------------------------------------------
  const contasPagarIdsVinculadas = new Set(
    extratosTransacoes
      .filter((tx) => tx.vinculo_tipo === 'conta_pagar' && tx.vinculo_id)
      .map((tx) => tx.vinculo_id),
  )
  const parcelasIdsVinculadas = new Set(
    extratosTransacoes
      .filter((tx) => tx.vinculo_tipo === 'parcela' && tx.vinculo_id)
      .map((tx) => tx.vinculo_id),
  )

  // -------------------------------------------------------------
  // 2. EXTRATOS BANCÁRIOS CLASSIFICADOS (PARTIDA DOBRADA BANCÁRIA)
  // Cada movimento bancário gera D ou C na conta do banco (1.1.1.01 ou 1.1.1.02)
  // e contrapartida na conta classificada.
  // Entrada: D Banco / C Contrapartida
  // Saída:   D Contrapartida / C Banco
  // -------------------------------------------------------------
  extratosTransacoes.forEach((tx) => {
    if (!tx.data || !ehNoPeriodo(tx.data)) return
    if (!matchConta(tx.conta_bancaria)) return

    const val = Math.abs(Number(tx.valor || 0))
    if (val <= 0) return

    // Se já está vinculado a uma conta a pagar ou parcela já processada abaixo, não duplica
    if (tx.vinculo_tipo === 'conta_pagar' && contasPagar.some((c) => c.id === tx.vinculo_id)) {
      return
    }
    if (tx.vinculo_tipo === 'parcela' && parcelas.some((p) => p.id === tx.vinculo_id)) {
      return
    }

    const contaContrapartida = classificarTransacaoExtrato(tx)
    const contaBanco = obterContaContabilBanco(null, tx.conta_bancaria, contasBancarias)
    const dataRef = tx.data.slice(0, 10)
    const docRef = tx.documento_ref || tx.fitid || undefined
    const desc = tx.descricao || 'Movimentação Bancária'

    if (tx.tipo === 'entrada') {
      // Entrada bancária: Débito no Banco, Crédito na Contrapartida
      pernasContabeis.push({
        id: `tx-D-${tx.id}`,
        data: dataRef,
        origem: 'extrato',
        registroOrigemId: tx.id,
        tipoMovimento: 'debito',
        contaCodigo: contaBanco.codigo,
        contaNome: contaBanco.nome,
        contaGrupo: 'Ativo Circulante - Disponibilidades',
        valor: val,
        descricao: `[BANCO] ${desc}`,
        entidade: 'Entrada em Conta PJ',
        documentoRef: docRef,
        contaBancariaId: tx.conta_bancaria,
        ehPartidaBancaria: true,
      })

      pernasContabeis.push({
        id: `tx-C-${tx.id}`,
        data: dataRef,
        origem: 'extrato',
        registroOrigemId: tx.id,
        tipoMovimento: 'credito',
        contaCodigo: contaContrapartida.codigo,
        contaNome: contaContrapartida.nome,
        contaGrupo: contaContrapartida.grupo,
        valor: val,
        descricao: desc,
        entidade: 'Contrapartida Bancária',
        documentoRef: docRef,
        contaBancariaId: tx.conta_bancaria,
      })
    } else {
      // Saída bancária: Débito na Contrapartida, Crédito no Banco
      pernasContabeis.push({
        id: `tx-D-${tx.id}`,
        data: dataRef,
        origem: 'extrato',
        registroOrigemId: tx.id,
        tipoMovimento: 'debito',
        contaCodigo: contaContrapartida.codigo,
        contaNome: contaContrapartida.nome,
        contaGrupo: contaContrapartida.grupo,
        valor: val,
        descricao: desc,
        entidade: 'Contrapartida Bancária',
        documentoRef: docRef,
        contaBancariaId: tx.conta_bancaria,
      })

      pernasContabeis.push({
        id: `tx-C-${tx.id}`,
        data: dataRef,
        origem: 'extrato',
        registroOrigemId: tx.id,
        tipoMovimento: 'credito',
        contaCodigo: contaBanco.codigo,
        contaNome: contaBanco.nome,
        contaGrupo: 'Ativo Circulante - Disponibilidades',
        valor: val,
        descricao: `[BANCO] ${desc}`,
        entidade: 'Saída de Conta PJ',
        documentoRef: docRef,
        contaBancariaId: tx.conta_bancaria,
        ehPartidaBancaria: true,
      })
    }
  })

  // -------------------------------------------------------------
  // 3. CONTAS A PAGAR (PAGAS) COM PARTIDA DOBRADA BANCÁRIA
  // D Despesa/Custo / C Banco PJ (1.1.1.01 ou 1.1.1.02)
  // -------------------------------------------------------------
  contasPagar.forEach((cp) => {
    if (cp.status !== 'pago') return
    const dataRef = (cp.data_pagamento || cp.data_vencimento || '').slice(0, 10)
    if (!dataRef || !ehNoPeriodo(dataRef)) return
    if (!matchConta(cp.conta_bancaria)) return

    const val = Number(cp.valor || 0)
    if (val <= 0) return

    const contaDespesa = classificarContaPagar(cp)
    const contaBanco = obterContaContabilBanco(null, cp.conta_bancaria, contasBancarias)
    const docRef = cp.numero_documento || undefined
    const desc = cp.descricao || 'Despesa Operacional'
    const forn = cp.fornecedor || 'Fornecedor'

    // D Despesa / C Banco
    pernasContabeis.push({
      id: `cp-D-${cp.id}`,
      data: dataRef,
      origem: 'conta_pagar',
      registroOrigemId: cp.id,
      tipoMovimento: 'debito',
      contaCodigo: contaDespesa.codigo,
      contaNome: contaDespesa.nome,
      contaGrupo: contaDespesa.grupo,
      valor: val,
      descricao: desc,
      entidade: forn,
      documentoRef: docRef,
      contaBancariaId: cp.conta_bancaria,
    })

    pernasContabeis.push({
      id: `cp-C-${cp.id}`,
      data: dataRef,
      origem: 'conta_pagar',
      registroOrigemId: cp.id,
      tipoMovimento: 'credito',
      contaCodigo: contaBanco.codigo,
      contaNome: contaBanco.nome,
      contaGrupo: 'Ativo Circulante - Disponibilidades',
      valor: val,
      descricao: `[PAGTO] ${desc}`,
      entidade: forn,
      documentoRef: docRef,
      contaBancariaId: cp.conta_bancaria,
      ehPartidaBancaria: true,
    })
  })

  // -------------------------------------------------------------
  // 4. PARCELAS E CONTAS A RECEBER (RECEBIDAS) COM PARTIDA DOBRADA BANCÁRIA
  // D Banco PJ / C Receita
  // -------------------------------------------------------------
  parcelas.forEach((p) => {
    if (p.status !== 'paga') return
    const dataRef = (p.data_pagamento || p.data_faturamento || p.vencimento || '').slice(0, 10)
    if (!dataRef || !ehNoPeriodo(dataRef)) return
    if (!matchConta(p.conta_bancaria)) return

    const val = Number(p.valor_recebido || p.valor || 0)
    if (val <= 0) return

    const contaReceita = classificarParcela(p)
    const contaBanco = obterContaContabilBanco(null, p.conta_bancaria, contasBancarias)
    const cliNome = p.expand?.cliente?.razao_social || 'Cliente AEROCAD'
    const desc = p.descricao || `Parcela ${p.numero_parcela || 1}`
    const docRef = p.nfse_numero ? `NFS-e ${p.nfse_numero}` : undefined

    // D Banco / C Receita
    pernasContabeis.push({
      id: `parc-D-${p.id}`,
      data: dataRef,
      origem: 'parcela',
      registroOrigemId: p.id,
      tipoMovimento: 'debito',
      contaCodigo: contaBanco.codigo,
      contaNome: contaBanco.nome,
      contaGrupo: 'Ativo Circulante - Disponibilidades',
      valor: val,
      descricao: `[RECEBIMENTO] ${desc}`,
      entidade: cliNome,
      documentoRef: docRef,
      contaBancariaId: p.conta_bancaria,
      ehPartidaBancaria: true,
    })

    pernasContabeis.push({
      id: `parc-C-${p.id}`,
      data: dataRef,
      origem: 'parcela',
      registroOrigemId: p.id,
      tipoMovimento: 'credito',
      contaCodigo: contaReceita.codigo,
      contaNome: contaReceita.nome,
      contaGrupo: contaReceita.grupo,
      valor: val,
      descricao: desc,
      entidade: cliNome,
      documentoRef: docRef,
      contaBancariaId: p.conta_bancaria,
    })
  })

  contasReceber.forEach((cr) => {
    if (cr.status !== 'recebido') return
    const dataRef = (cr.data_recebimento || cr.data_vencimento || '').slice(0, 10)
    if (!dataRef || !ehNoPeriodo(dataRef)) return
    if (!matchConta(cr.conta_bancaria)) return

    const val = Number(cr.valor_recebido || cr.valor || 0)
    if (val <= 0) return

    const contaReceita = classificarContaReceber(cr)
    const contaBanco = obterContaContabilBanco(null, cr.conta_bancaria, contasBancarias)
    const cliNome = cr.cliente_nome || cr.expand?.cliente?.razao_social || 'Cliente Avulso'
    const desc = cr.descricao || 'Receita Avulsa'
    const docRef = cr.numero_documento || undefined

    // D Banco / C Receita
    pernasContabeis.push({
      id: `cr-D-${cr.id}`,
      data: dataRef,
      origem: 'conta_receber',
      registroOrigemId: cr.id,
      tipoMovimento: 'debito',
      contaCodigo: contaBanco.codigo,
      contaNome: contaBanco.nome,
      contaGrupo: 'Ativo Circulante - Disponibilidades',
      valor: val,
      descricao: `[RECEBIMENTO] ${desc}`,
      entidade: cliNome,
      documentoRef: docRef,
      contaBancariaId: cr.conta_bancaria,
      ehPartidaBancaria: true,
    })

    pernasContabeis.push({
      id: `cr-C-${cr.id}`,
      data: dataRef,
      origem: 'conta_receber',
      registroOrigemId: cr.id,
      tipoMovimento: 'credito',
      contaCodigo: contaReceita.codigo,
      contaNome: contaReceita.nome,
      contaGrupo: contaReceita.grupo,
      valor: val,
      descricao: desc,
      entidade: cliNome,
      documentoRef: docRef,
      contaBancariaId: cr.conta_bancaria,
    })
  })

  // -------------------------------------------------------------
  // 5. CÁLCULO DE VALOR LÍQUIDO DOS ATIVOS (MÓDULO DE ATIVOS)
  // Valor contábil líquido = Custo Histórico - Depreciação Acumulada
  // Esperado nos dados reais: R$ 177.490,90
  // -------------------------------------------------------------
  let valorImobilizadoLiquidoAtivos = 0
  ativosPatrimonio.forEach((at) => {
    const vidaUtilConfig =
      at.categoria === 'terreno' || at.categoria === 'goodwill_intangivel'
        ? 0
        : at.vida_util_meses !== undefined
          ? at.vida_util_meses
          : (DEPRECIACAO_PADRAO[at.categoria]?.vidaUtilMeses ?? 120)

    const calc =
      at.categoria === 'terreno' || at.categoria === 'goodwill_intangivel' || vidaUtilConfig === 0
        ? { depreciacaoAcumulada: 0, valorContabilAtual: at.valor_aquisicao }
        : calcularDepreciacaoAtivo(
            at.valor_aquisicao,
            at.data_aquisicao,
            vidaUtilConfig,
            at.valor_residual || 0,
          )

    valorImobilizadoLiquidoAtivos += calc.valorContabilAtual
  })

  // -------------------------------------------------------------
  // 6. TOTALIZAÇÃO DAS CONTAS DO PLANO DE CONTAS
  // -------------------------------------------------------------
  const contasMap = new Map<string, TotaisContaContabil>()

  // Inicializa mapa com todas as contas oficiais
  PLANO_CONTAS_AEROCAD.forEach((item) => {
    const ehDevedora = item.natureza === 'ativo' || item.natureza === 'despesa'
    contasMap.set(item.codigo, {
      conta: item,
      volumeDebito: 0,
      volumeCredito: 0,
      qtdDebitos: 0,
      qtdCreditos: 0,
      qtdLancamentos: 0,
      saldoPeriodo: 0,
      naturezaSaldo: ehDevedora ? 'devedora' : 'credora',
      lancamentos: [],
    })
  })

  // Acumula cada perna
  let totalDebitos = 0
  let totalCreditos = 0

  pernasContabeis.forEach((perna) => {
    if (perna.tipoMovimento === 'debito') {
      totalDebitos += perna.valor
    } else {
      totalCreditos += perna.valor
    }

    let cTot = contasMap.get(perna.contaCodigo)
    if (!cTot) {
      const itemPlano = obterItemPlanoContasPorCodigo(perna.contaCodigo) || {
        codigo: perna.contaCodigo,
        nome: perna.contaNome,
        grupo: perna.contaGrupo,
        natureza: perna.contaCodigo.startsWith('1')
          ? 'ativo'
          : perna.contaCodigo.startsWith('2')
            ? 'passivo'
            : perna.contaCodigo.startsWith('3')
              ? 'despesa'
              : 'receita',
        fixoOuVariavel: 'geral',
        descricao: perna.contaNome,
      }
      const ehDevedora = itemPlano.natureza === 'ativo' || itemPlano.natureza === 'despesa'
      cTot = {
        conta: itemPlano,
        volumeDebito: 0,
        volumeCredito: 0,
        qtdDebitos: 0,
        qtdCreditos: 0,
        qtdLancamentos: 0,
        saldoPeriodo: 0,
        naturezaSaldo: ehDevedora ? 'devedora' : 'credora',
        lancamentos: [],
      }
      contasMap.set(perna.contaCodigo, cTot)
    }

    cTot.qtdLancamentos += 1
    cTot.lancamentos.push(perna)

    if (perna.tipoMovimento === 'debito') {
      cTot.volumeDebito += perna.valor
      cTot.qtdDebitos += 1
    } else {
      cTot.volumeCredito += perna.valor
      cTot.qtdCreditos += 1
    }

    const ehDevedora = cTot.conta.natureza === 'ativo' || cTot.conta.natureza === 'despesa'
    cTot.saldoPeriodo = ehDevedora
      ? cTot.volumeDebito - cTot.volumeCredito
      : cTot.volumeCredito - cTot.volumeDebito
  })

  // Regra 4 do usuário: Não deduzir contas 2.1.8 e 2.2.3 enquanto o passivo
  // estiver registrado só pelo principal (sem lançamentos reais de encargos nelas).
  // Se não houver lançamentos, mantém saldo zero.
  const conta218 = contasMap.get('2.1.8')
  if (conta218 && conta218.qtdLancamentos === 0) {
    conta218.saldoPeriodo = 0
    conta218.volumeDebito = 0
    conta218.volumeCredito = 0
  }
  const conta223 = contasMap.get('2.2.3')
  if (conta223 && conta223.qtdLancamentos === 0) {
    conta223.saldoPeriodo = 0
    conta223.volumeDebito = 0
    conta223.volumeCredito = 0
  }

  // Total do Grupo 4 (Receitas) com dedução de redutoras (ex.: 4.4.1 DAS)
  let totalGrupo4Bruto = 0
  let totalGrupo4Redutoras = 0
  let totalGrupo3Despesas = 0

  contasMap.forEach((c) => {
    if (c.conta.codigo.startsWith('4.')) {
      if (isContaRedutora(c.conta.codigo) || c.conta.redutora) {
        totalGrupo4Redutoras += c.volumeDebito || c.saldoPeriodo || 0
      } else {
        totalGrupo4Bruto += c.volumeCredito || c.saldoPeriodo || 0
      }
    } else if (c.conta.codigo.startsWith('3.')) {
      totalGrupo3Despesas += c.volumeDebito || c.saldoPeriodo || 0
    }
  })

  const totalGrupo4Liquido = totalGrupo4Bruto - totalGrupo4Redutoras
  const diferencaPartidas = Math.abs(totalDebitos - totalCreditos)
  const estaEquilibrado = diferencaPartidas < 0.01

  return {
    ano,
    periodoRotulo: ano === 'todos' ? 'Exercício Completo' : `Exercício ${ano}`,
    contaBancariaId,
    pernasContabeis,
    contasMap,
    totalDebitos,
    totalCreditos,
    diferencaPartidas,
    estaEquilibrado,
    valorImobilizadoLiquidoAtivos,
    totalGrupo4Liquido,
    totalGrupo4Bruto,
    totalGrupo4Redutoras,
    totalGrupo3Despesas,
  }
}
