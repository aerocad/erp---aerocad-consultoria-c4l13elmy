/**
 * Serviço de Cálculo e Gestão de Valuation Contábil / Econômico da AEROCAD
 *
 * Métodos contemplados:
 * 1. Valor Patrimonial Contábil (Ativos - Passivos = PL Contábil)
 * 2. Rentabilidade e Capacidade de Geração de Caixa (Receita Bruta, EBITDA, Lucro Líquido e Margens)
 * 3. Múltiplos de Mercado (EBITDA e Receita Líquida em 3 cenários: Conservador, Médio e Otimista)
 * 4. Fluxo de Caixa Projetado (baseado em parcelas a receber previstas e médias históricas)
 * 5. Ajustes Subjetivos / Intangíveis (Goodwill, Homologações DECEA/ANAC, Acervo Técnico)
 * 6. Confiabilidade dos Dados Contábeis (balancetes arquivados, lançamentos sem plano de contas, contas reatribuídas)
 */

import pb from '@/lib/pocketbase/client'
import type {
  ParcelaRecord,
  ContaPagarRecord,
  ContaReceberRecord,
  ContaBancariaRecord,
  AtivoPatrimonioRecord,
  ExtratoTransacaoRecord,
  BalanceteMensalRecord,
  EmpresaRecord,
} from '@/types/crm'
import { calcularDepreciacaoLinear } from '@/components/financeiro/AtivosPatrimonioTab'
import { loadSheetJS } from '@/services/sheetjsLoader'
import { formatCurrency, isValoresOcultos, VALOR_MASCARADO } from '@/lib/format'

export interface MultiplosConfig {
  ebitdaConservador: number
  ebitdaMedio: number
  ebitdaOtimista: number
  receitaConservador: number
  receitaMedio: number
  receitaOtimista: number
  pesoPatrimonial: number // ex: 20%
  pesoEbitda: number // ex: 50%
  pesoReceita: number // ex: 30%
}

export const MULTIPLOS_PADRAO: MultiplosConfig = {
  ebitdaConservador: 3.0,
  ebitdaMedio: 4.5,
  ebitdaOtimista: 6.0,
  receitaConservador: 0.5,
  receitaMedio: 0.8,
  receitaOtimista: 1.2,
  pesoPatrimonial: 0.2, // 20%
  pesoEbitda: 0.5, // 50%
  pesoReceita: 0.3, // 30%
}

export interface AjusteSubjetivoItem {
  id: string
  tipo: 'positivo' | 'negativo'
  titulo: string
  categoria:
    | 'acervo_tecnico'
    | 'reputacao_decea_anac'
    | 'carteira_clientes'
    | 'equipe_tecnica'
    | 'passivo_contingente'
    | 'outro'
  valor: number
  justificativa?: string
}

export interface ConfiabilidadeDados {
  totalBalancetesArquivados: number
  competenciasEsperadasAno: number
  totalTransacoesExtrato: number
  transacoesSemClassificacao: number
  transacoesSemContaBancaria: number
  percentualConfiabilidade: number
  nivel: 'alta' | 'moderada' | 'atencao'
  alertas: string[]
}

export interface CenariosValuation {
  conservador: number
  medio: number
  otimista: number
}

export interface ValuationCalculado {
  dataCalculo: string
  anoExercicio: number
  empresa: {
    razaoSocial: string
    nomeFantasia: string
    cnpj: string
    capitalSocialContratual: number
  }
  // 1. Valor Patrimonial Contábil
  patrimonio: {
    disponibilidadesBancarias: number
    contasReceberCirculante: number
    imobilizadoCustoHistorico: number
    imobilizadoDepreciacaoAcumulada: number
    imobilizadoLiquido: number
    ativoCirculanteTotal: number
    ativoNaoCirculanteTotal: number
    ativoTotal: number
    passivoCirculanteTotal: number
    patrimonioLiquidoContabil: number
  }
  // 2. Rentabilidade & EBITDA
  rentabilidade: {
    receitaBruta: number
    deducoesTributarias: number
    receitaLiquida: number
    custosDiretosProjetos: number
    margemContribuicao: number
    despesasOperacionaisFixas: number
    depreciacaoEstimadaExercicio: number
    lucroOperacionalEBIT: number
    ebitda: number
    lucroLiquido: number
    margemEbitdaPercentual: number
    margemLiquidaPercentual: number
  }
  // 3. Múltiplos e Cenários
  multiplosUsados: MultiplosConfig
  cenariosEbitda: CenariosValuation
  cenariosReceita: CenariosValuation
  cenariosPonderados: CenariosValuation
  // 4. Fluxo de Caixa Projetado
  fluxoProjetado: {
    totalReceberPrevistoAberto: number
    mediaReceitaMensalRealizada: number
    mediaDespesaMensalRealizada: number
    mediaResultadoMensal: number
    projecao12MesesResultado: number
    parcelasContratuaisQtd: number
  }
  // 5. Ajustes Subjetivos
  ajustes: {
    itens: AjusteSubjetivoItem[]
    totalPositivo: number
    totalNegativo: number
    totalLiquidoIntangiveis: number
  }
  // 6. Resultado Final Consolidado
  resultadoFinal: {
    cenarioConservadorTotal: number
    cenarioMedioTotal: number
    cenarioOtimistaTotal: number
    faixaEstimada: string
    valorReferenciaSugerido: number
  }
  // Indicadores de Apoio
  indicadoresApoio: {
    liquidezCorrente: number
    endividamentoGeral: number
    retornoSobrePL: number
    coberturaCustosFixosMeses: number
  }
  // Diagnóstico de Confiabilidade
  confiabilidade: ConfiabilidadeDados
}

export interface ValuationRecordItem {
  id: string
  titulo: string
  data_avaliacao: string
  periodo_referencia: string
  metodo_principal: string
  multiplos_usados: MultiplosConfig
  ajustes_subjetivos: AjusteSubjetivoItem[]
  resultado_consolidado: any
  indicadores_apoio: any
  confiabilidade_dados: any
  usuario_criador?: string
  usuario_nome?: string
  observacoes?: string
  created: string
  updated: string
}

/**
 * Executa o cálculo econômico do Valuation da AEROCAD com base nos registros contábeis
 */
export function calcularValuationAerocad(params: {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  contasBancarias: ContaBancariaRecord[]
  ativosPatrimonio: AtivoPatrimonioRecord[]
  extratosTransacoes?: ExtratoTransacaoRecord[]
  balancetes?: BalanceteMensalRecord[]
  empresa?: EmpresaRecord | null
  anoExercicio?: number
  multiplos?: MultiplosConfig
  ajustesSubjetivos?: AjusteSubjetivoItem[]
}): ValuationCalculado {
  const {
    parcelas = [],
    contasPagar = [],
    contasReceber = [],
    contasBancarias = [],
    ativosPatrimonio = [],
    extratosTransacoes = [],
    balancetes = [],
    empresa,
    anoExercicio = new Date().getFullYear(),
    multiplos = MULTIPLOS_PADRAO,
    ajustesSubjetivos = [],
  } = params

  const anoStr = String(anoExercicio)

  // 1. Disponibilidades Bancárias (Saldos das contas bancárias PJ)
  const saldosPorConta = contasBancarias.map((cb) => {
    const entradasParc = parcelas
      .filter((p) => p.conta_bancaria === cb.id && p.status === 'paga')
      .reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0)
    const entradasAvul = contasReceber
      .filter((cr) => cr.conta_bancaria === cb.id && cr.status === 'recebido')
      .reduce((acc, cr) => acc + (cr.valor_recebido || cr.valor || 0), 0)
    const saidasPagar = contasPagar
      .filter((cp) => cp.conta_bancaria === cb.id && cp.status === 'pago')
      .reduce((acc, cp) => acc + (cp.valor || 0), 0)
    return (cb.saldo_inicial || 0) + entradasParc + entradasAvul - saidasPagar
  })
  const disponibilidadesBancarias = saldosPorConta.reduce((acc, s) => acc + s, 0)

  // Contas a Receber em Aberto (Circulante)
  const contasReceberCirculante =
    parcelas.filter((p) => p.status !== 'paga').reduce((acc, p) => acc + (p.valor || 0), 0) +
    contasReceber
      .filter((cr) => cr.status === 'pendente')
      .reduce((acc, cr) => acc + (cr.valor || 0), 0)

  const ativoCirculanteTotal = disponibilidadesBancarias + contasReceberCirculante

  // Imobilizado e Depreciação (Ativo Não Circulante)
  let imobilizadoCustoHistorico = 0
  let imobilizadoDepreciacaoAcumulada = 0
  let depreciacaoEstimadaExercicio = 0

  for (const at of ativosPatrimonio) {
    if (at.status === 'baixado_alienado') continue
    const custo = at.valor_aquisicao || 0
    imobilizadoCustoHistorico += custo

    const vidaUtilConfig =
      at.categoria === 'terreno' ? 0 : at.vida_util_meses !== undefined ? at.vida_util_meses : 120

    const calc = calcularDepreciacaoLinear(
      custo,
      at.data_aquisicao || new Date().toISOString(),
      vidaUtilConfig,
      at.valor_residual || 0,
      at.categoria,
    )
    imobilizadoDepreciacaoAcumulada += calc.depreciacaoAcumulada

    // Estimativa de depreciação anual proporcional (12 meses de depreciação)
    if (vidaUtilConfig > 0) {
      const depMensal = (custo - (at.valor_residual || 0)) / vidaUtilConfig
      depreciacaoEstimadaExercicio += depMensal * 12
    }
  }

  const imobilizadoLiquido = Math.max(
    0,
    imobilizadoCustoHistorico - imobilizadoDepreciacaoAcumulada,
  )
  const ativoNaoCirculanteTotal = imobilizadoLiquido
  const ativoTotal = ativoCirculanteTotal + ativoNaoCirculanteTotal

  // Passivo Circulante (Contas a Pagar Pendentes)
  const passivoCirculanteTotal = contasPagar
    .filter((cp) => cp.status === 'pendente')
    .reduce((acc, cp) => acc + (cp.valor || 0), 0)

  // Patrimônio Líquido Contábil (Ativo Total - Passivo Total)
  const patrimonioLiquidoContabil = ativoTotal - passivoCirculanteTotal

  // 2. RENTABILIDADE DO EXERCÍCIO (DRE)
  // Receitas do Exercício Selecionado
  const parcelasExercicio = parcelas.filter((p) => {
    const dt = p.data_pagamento || p.data_faturamento || p.vencimento || ''
    return dt.startsWith(anoStr) && p.status === 'paga'
  })
  const avulsasExercicio = contasReceber.filter((cr) => {
    const dt = cr.data_recebimento || cr.data_vencimento || ''
    return dt.startsWith(anoStr) && cr.status === 'recebido'
  })

  let receitaBruta =
    parcelasExercicio.reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0) +
    avulsasExercicio.reduce((acc, cr) => acc + (cr.valor_recebido || cr.valor || 0), 0)

  // Se o ano corrente ainda tiver poucos dados (ex: início do ano ou base histórica recente),
  // se a receita for zero, calcula com base nos últimos 12 meses ou histórico total
  if (receitaBruta === 0) {
    receitaBruta =
      parcelas
        .filter((p) => p.status === 'paga')
        .reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0) +
      contasReceber
        .filter((cr) => cr.status === 'recebido')
        .reduce((acc, cr) => acc + (cr.valor_recebido || cr.valor || 0), 0)
  }

  // Despesas do Exercício
  let despesasPagas = contasPagar.filter((cp) => {
    const dt = cp.data_pagamento || cp.data_vencimento || ''
    return dt.startsWith(anoStr) && cp.status === 'pago'
  })
  if (despesasPagas.length === 0) {
    despesasPagas = contasPagar.filter((cp) => cp.status === 'pago')
  }

  // Deduções e Tributos (Grupo 3.3 ou categorias fiscais)
  const deducoesTributarias = despesasPagas
    .filter((cp) => {
      const cod = cp.plano_contas_codigo || ''
      if (cod) return cod.startsWith('3.3')
      return (
        cp.categoria === 'impostos' ||
        cp.descricao?.toLowerCase().includes('iss') ||
        cp.descricao?.toLowerCase().includes('das')
      )
    })
    .reduce((acc, cp) => acc + (cp.valor || 0), 0)

  const receitaLiquida = Math.max(0, receitaBruta - deducoesTributarias)

  // Custos Diretos de Projetos
  const custosDiretosProjetos = despesasPagas
    .filter((cp) => {
      const cod = cp.plano_contas_codigo || ''
      if (cod) return cod.startsWith('3.2') || cod === '3.1.4' || cod === '3.1.5'
      return cp.categoria === 'terceirizados' || Boolean(cp.projeto)
    })
    .reduce((acc, cp) => acc + (cp.valor || 0), 0)

  const margemContribuicao = receitaLiquida - custosDiretosProjetos

  // Despesas Operacionais Fixas
  const despesasOperacionaisFixas = despesasPagas
    .filter((cp) => {
      const cod = cp.plano_contas_codigo || ''
      if (cod) {
        const ehImp = cod.startsWith('3.3')
        const ehCusto = cod.startsWith('3.2') || cod === '3.1.4' || cod === '3.1.5'
        return !ehImp && !ehCusto
      }
      const ehImp = cp.categoria === 'impostos'
      const ehCusto = cp.categoria === 'terceirizados' || Boolean(cp.projeto)
      return !ehImp && !ehCusto
    })
    .reduce((acc, cp) => acc + (cp.valor || 0), 0)

  const lucroOperacionalEBIT = margemContribuicao - despesasOperacionaisFixas
  const lucroLiquido = lucroOperacionalEBIT
  // EBITDA = EBIT + Depreciação e Amortização estimada
  const ebitda = Math.max(0, lucroOperacionalEBIT + depreciacaoEstimadaExercicio)

  const margemEbitdaPercentual = receitaBruta > 0 ? (ebitda / receitaBruta) * 100 : 0
  const margemLiquidaPercentual = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0

  // 3. MÚLTIPLOS DE MERCADO E CENÁRIOS
  // Múltiplos sobre EBITDA
  const cenariosEbitda: CenariosValuation = {
    conservador: ebitda * (multiplos.ebitdaConservador || 3.0),
    medio: ebitda * (multiplos.ebitdaMedio || 4.5),
    otimista: ebitda * (multiplos.ebitdaOtimista || 6.0),
  }

  // Múltiplos sobre Receita
  const cenariosReceita: CenariosValuation = {
    conservador: receitaLiquida * (multiplos.receitaConservador || 0.5),
    medio: receitaLiquida * (multiplos.receitaMedio || 0.8),
    otimista: receitaLiquida * (multiplos.receitaOtimista || 1.2),
  }

  // Média ponderada com Patrimônio Líquido
  const pPl = multiplos.pesoPatrimonial || 0.2
  const pEb = multiplos.pesoEbitda || 0.5
  const pRec = multiplos.pesoReceita || 0.3
  const somaPesos = pPl + pEb + pRec || 1

  const cenariosPonderados: CenariosValuation = {
    conservador:
      (patrimonioLiquidoContabil * pPl +
        cenariosEbitda.conservador * pEb +
        cenariosReceita.conservador * pRec) /
      somaPesos,
    medio:
      (patrimonioLiquidoContabil * pPl +
        cenariosEbitda.medio * pEb +
        cenariosReceita.medio * pRec) /
      somaPesos,
    otimista:
      (patrimonioLiquidoContabil * pPl +
        cenariosEbitda.otimista * pEb +
        cenariosReceita.otimista * pRec) /
      somaPesos,
  }

  // 4. FLUXO DE CAIXA PROJETADO
  const parcelasPendentes = parcelas.filter((p) => p.status !== 'paga')
  const totalReceberPrevistoAberto = parcelasPendentes.reduce((acc, p) => acc + (p.valor || 0), 0)

  // Média mensal das competências fechadas (base balancetes ou transações)
  let mediaReceitaMensalRealizada = 0
  let mediaDespesaMensalRealizada = 0

  if (balancetes.length > 0) {
    const totalRecBal = balancetes.reduce((acc, b) => acc + (b.receita_total || 0), 0)
    const totalDespBal = balancetes.reduce((acc, b) => acc + (b.despesa_total || 0), 0)
    mediaReceitaMensalRealizada = totalRecBal / balancetes.length
    mediaDespesaMensalRealizada = totalDespBal / balancetes.length
  } else {
    // Estimativa a partir do exercício
    mediaReceitaMensalRealizada = receitaBruta / 12
    mediaDespesaMensalRealizada =
      (deducoesTributarias + custosDiretosProjetos + despesasOperacionaisFixas) / 12
  }

  const mediaResultadoMensal = mediaReceitaMensalRealizada - mediaDespesaMensalRealizada
  const projecao12MesesResultado = mediaResultadoMensal * 12

  // 5. AJUSTES SUBJETIVOS (GOODWILL / INTANGÍVEIS)
  const itensAjuste = Array.isArray(ajustesSubjetivos) ? ajustesSubjetivos : []
  let totalPositivo = 0
  let totalNegativo = 0

  for (const item of itensAjuste) {
    const val = Number(item.valor) || 0
    if (item.tipo === 'positivo') {
      totalPositivo += Math.abs(val)
    } else {
      totalNegativo += Math.abs(val)
    }
  }

  const totalLiquidoIntangiveis = totalPositivo - totalNegativo

  // 6. RESULTADO FINAL CONSOLIDADO (Ponderado + Intangíveis)
  const cenarioConservadorTotal = Math.max(
    0,
    cenariosPonderados.conservador + totalLiquidoIntangiveis,
  )
  const cenarioMedioTotal = Math.max(0, cenariosPonderados.medio + totalLiquidoIntangiveis)
  const cenarioOtimistaTotal = Math.max(0, cenariosPonderados.otimista + totalLiquidoIntangiveis)

  const faixaEstimada = `${formatCurrency(cenarioConservadorTotal)} a ${formatCurrency(
    cenarioOtimistaTotal,
  )}`

  // Indicadores de Apoio
  const liquidezCorrente =
    passivoCirculanteTotal > 0 ? ativoCirculanteTotal / passivoCirculanteTotal : 99.9
  const endividamentoGeral = ativoTotal > 0 ? (passivoCirculanteTotal / ativoTotal) * 100 : 0
  const retornoSobrePL =
    patrimonioLiquidoContabil > 0 ? (lucroLiquido / patrimonioLiquidoContabil) * 100 : 0
  const coberturaCustosFixosMeses =
    despesasOperacionaisFixas > 0 ? disponibilidadesBancarias / (despesasOperacionaisFixas / 12) : 0

  // Confiabilidade dos Dados Contábeis
  const totalBalancetesArquivados = balancetes.length
  const totalTransacoesExtrato = extratosTransacoes.length
  const transacoesSemClassificacao = extratosTransacoes.filter(
    (tx) => !tx.plano_contas_codigo || tx.plano_contas_codigo.trim() === '',
  ).length
  const transacoesSemContaBancaria = extratosTransacoes.filter(
    (tx) => !tx.conta_bancaria || tx.conta_bancaria.trim() === '',
  ).length

  const alertas: string[] = []
  if (transacoesSemClassificacao > 0) {
    alertas.push(
      `Existem ${transacoesSemClassificacao} transações de extrato sem classificação contábil (plano de contas vazio).`,
    )
  }
  if (transacoesSemContaBancaria > 0) {
    alertas.push(
      `Existem ${transacoesSemContaBancaria} transações sem identificação da conta bancária PJ correspondente.`,
    )
  }
  if (totalBalancetesArquivados < 3) {
    alertas.push(
      `Apenas ${totalBalancetesArquivados} competência(s) com balancete formalmente arquivado no CRM.`,
    )
  }

  let pontosConfiabilidade = 100
  if (transacoesSemClassificacao > 50) pontosConfiabilidade -= 30
  else if (transacoesSemClassificacao > 10) pontosConfiabilidade -= 15
  else if (transacoesSemClassificacao > 0) pontosConfiabilidade -= 5

  if (transacoesSemContaBancaria > 0) pontosConfiabilidade -= 10
  if (totalBalancetesArquivados < 2) pontosConfiabilidade -= 20
  else if (totalBalancetesArquivados < 6) pontosConfiabilidade -= 10

  pontosConfiabilidade = Math.max(20, Math.min(100, pontosConfiabilidade))

  const nivel: 'alta' | 'moderada' | 'atencao' =
    pontosConfiabilidade >= 80 ? 'alta' : pontosConfiabilidade >= 50 ? 'moderada' : 'atencao'

  return {
    dataCalculo: new Date().toISOString(),
    anoExercicio,
    empresa: {
      razaoSocial: empresa?.razao_social || 'AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA',
      nomeFantasia: empresa?.nome_fantasia || 'AEROCAD CONSULTORIA & AEROPORTOS',
      cnpj: empresa?.cnpj || '28.036.597/0001-43',
      capitalSocialContratual: empresa?.capital_social || 278000,
    },
    patrimonio: {
      disponibilidadesBancarias,
      contasReceberCirculante,
      imobilizadoCustoHistorico,
      imobilizadoDepreciacaoAcumulada,
      imobilizadoLiquido,
      ativoCirculanteTotal,
      ativoNaoCirculanteTotal,
      ativoTotal,
      passivoCirculanteTotal,
      patrimonioLiquidoContabil,
    },
    rentabilidade: {
      receitaBruta,
      deducoesTributarias,
      receitaLiquida,
      custosDiretosProjetos,
      margemContribuicao,
      despesasOperacionaisFixas,
      depreciacaoEstimadaExercicio,
      lucroOperacionalEBIT,
      ebitda,
      lucroLiquido,
      margemEbitdaPercentual,
      margemLiquidaPercentual,
    },
    multiplosUsados: multiplos,
    cenariosEbitda,
    cenariosReceita,
    cenariosPonderados,
    fluxoProjetado: {
      totalReceberPrevistoAberto,
      mediaReceitaMensalRealizada,
      mediaDespesaMensalRealizada,
      mediaResultadoMensal,
      projecao12MesesResultado,
      parcelasContratuaisQtd: parcelasPendentes.length,
    },
    ajustes: {
      itens: itensAjuste,
      totalPositivo,
      totalNegativo,
      totalLiquidoIntangiveis,
    },
    resultadoFinal: {
      cenarioConservadorTotal,
      cenarioMedioTotal,
      cenarioOtimistaTotal,
      faixaEstimada,
      valorReferenciaSugerido: cenarioMedioTotal,
    },
    indicadoresApoio: {
      liquidezCorrente,
      endividamentoGeral,
      retornoSobrePL,
      coberturaCustosFixosMeses,
    },
    confiabilidade: {
      totalBalancetesArquivados,
      competenciasEsperadasAno: 12,
      totalTransacoesExtrato,
      transacoesSemClassificacao,
      transacoesSemContaBancaria,
      percentualConfiabilidade: pontosConfiabilidade,
      nivel,
      alertas,
    },
  }
}

/**
 * Persiste uma nova avaliação de Valuation na coleção 'valuations'
 */
export async function salvarValuation(dados: {
  titulo: string
  periodoReferencia: string
  metodoPrincipal?: string
  multiplos: MultiplosConfig
  ajustes: AjusteSubjetivoItem[]
  resultado: ValuationCalculado
  usuarioId?: string
  usuarioNome?: string
  observacoes?: string
}): Promise<ValuationRecordItem> {
  const payload = {
    titulo: dados.titulo.trim(),
    data_avaliacao: new Date().toISOString().slice(0, 10),
    periodo_referencia: dados.periodoReferencia,
    metodo_principal: dados.metodoPrincipal || 'combinado',
    multiplos_usados: dados.multiplos,
    ajustes_subjetivos: dados.ajustes,
    resultado_consolidado: {
      patrimonioLiquido: dados.resultado.patrimonio.patrimonioLiquidoContabil,
      ebitda: dados.resultado.rentabilidade.ebitda,
      receitaLiquida: dados.resultado.rentabilidade.receitaLiquida,
      cenarioConservador: dados.resultado.resultadoFinal.cenarioConservadorTotal,
      cenarioMedio: dados.resultado.resultadoFinal.cenarioMedioTotal,
      cenarioOtimista: dados.resultado.resultadoFinal.cenarioOtimistaTotal,
      totalIntangiveis: dados.resultado.ajustes.totalLiquidoIntangiveis,
    },
    indicadores_apoio: dados.resultado.indicadoresApoio,
    confiabilidade_dados: dados.resultado.confiabilidade,
    usuario_criador: dados.usuarioId || null,
    usuario_nome: dados.usuarioNome || 'Diretoria AEROCAD',
    observacoes: dados.observacoes || '',
  }

  const record = await pb.collection('valuations').create<ValuationRecordItem>(payload)
  return record
}

/**
 * Lista histórico de avaliações salvas
 */
export async function listarValuations(): Promise<ValuationRecordItem[]> {
  try {
    const list = await pb.collection('valuations').getFullList<ValuationRecordItem>({
      sort: '-created',
      requestKey: null,
    })
    return list
  } catch (err) {
    console.error('Erro ao listar valuations:', err)
    return []
  }
}

/**
 * Exclui uma avaliação salva
 */
export async function excluirValuation(id: string): Promise<boolean> {
  try {
    await pb.collection('valuations').delete(id)
    return true
  } catch (err) {
    console.error('Erro ao excluir valuation:', err)
    throw err
  }
}

/**
 * Exporta os dados consolidados do Valuation para planilha XLSX multi-aba
 * Abas: Parâmetros, Patrimônio, Rentabilidade, Cenários
 */
export async function exportarValuationXlsx(
  valuation: ValuationCalculado,
  usuarioNome: string = 'Diretoria AEROCAD',
): Promise<void> {
  const xlsx = await loadSheetJS()
  const ocultar = isValoresOcultos()
  const valFormat = (v: number) => (ocultar ? VALOR_MASCARADO : v)

  const dataEmissao = new Date().toLocaleDateString('pt-BR')
  const horaEmissao = new Date().toLocaleTimeString('pt-BR')

  // 1. ABA: PARÂMETROS & HIPÓTESES
  const aoaParametros: unknown[][] = [
    ['AEROCAD CONSULTORIA & AEROPORTOS — RELATÓRIO ECONÔMICO DE VALUATION'],
    [`Empresa: ${valuation.empresa.razaoSocial} | CNPJ: ${valuation.empresa.cnpj}`],
    [`Emissão: ${dataEmissao} às ${horaEmissao} | Responsável: ${usuarioNome}`],
    [],
    ['PARÂMETRO / HIPÓTESE', 'VALOR / PESO', 'DESCRIÇÃO'],
    [
      'Múltiplo EBITDA (Conservador)',
      `${valuation.multiplosUsados.ebitdaConservador}x`,
      'Cenário conservador para negócios técnicos especializados',
    ],
    [
      'Múltiplo EBITDA (Médio)',
      `${valuation.multiplosUsados.ebitdaMedio}x`,
      'Múltiplo de referência central de mercado consultivo',
    ],
    [
      'Múltiplo EBITDA (Otimista)',
      `${valuation.multiplosUsados.ebitdaOtimista}x`,
      'Cenário de expansão de demanda aeroportuária',
    ],
    [
      'Múltiplo Receita (Conservador)',
      `${valuation.multiplosUsados.receitaConservador}x`,
      'Fração conservadora sobre a receita líquida anual',
    ],
    [
      'Múltiplo Receita (Médio)',
      `${valuation.multiplosUsados.receitaMedio}x`,
      'Múltiplo típico de engenharia e consultoria',
    ],
    [
      'Múltiplo Receita (Otimista)',
      `${valuation.multiplosUsados.receitaOtimista}x`,
      'Cenário de valorização de receita recorrente',
    ],
    [
      'Ponderação Patrimônio Líquido',
      `${valuation.multiplosUsados.pesoPatrimonial * 100}%`,
      'Peso contábil no valor final consolidado',
    ],
    [
      'Ponderação Múltiplo EBITDA',
      `${valuation.multiplosUsados.pesoEbitda * 100}%`,
      'Peso da capacidade de geração de caixa operacional',
    ],
    [
      'Ponderação Múltiplo Receita',
      `${valuation.multiplosUsados.pesoReceita * 100}%`,
      'Peso do volume de contratos e faturamento líquido',
    ],
    [],
    ['CONFIABILIDADE DOS DADOS CONTÁBEIS'],
    [
      'Índice de Confiabilidade',
      `${valuation.confiabilidade.percentualConfiabilidade}%`,
      'Classificação técnica',
    ],
    [
      'Nível',
      valuation.confiabilidade.nivel.toUpperCase(),
      'Baseado nas conciliações e balancetes arquivados',
    ],
    [
      'Competências com Balancete',
      `${valuation.confiabilidade.totalBalancetesArquivados} meses`,
      'Arquivados no CRM',
    ],
    [
      'Lançamentos sem Plano de Contas',
      `${valuation.confiabilidade.transacoesSemClassificacao}`,
      'Pendências identificadas',
    ],
  ]

  // 2. ABA: PATRIMÔNIO CONTÁBIL
  const aoaPatrimonio: unknown[][] = [
    ['COMPOSIÇÃO DO VALOR PATRIMONIAL CONTÁBIL — AEROCAD'],
    [`Exemplo de balanço gerencial em ${dataEmissao}`],
    [],
    ['CONTA / GRUPO PATRIMONIAL', 'VALOR CONTÁBIL (R$)', 'NATUREZA'],
    [
      '(+) Disponibilidades em Contas Bancárias PJ',
      valFormat(valuation.patrimonio.disponibilidadesBancarias),
      'Ativo Circulante',
    ],
    [
      '(+) Contas e Parcelas a Receber (Projetos e Avulsos)',
      valFormat(valuation.patrimonio.contasReceberCirculante),
      'Ativo Circulante',
    ],
    [
      '= TOTAL DO ATIVO CIRCULANTE',
      valFormat(valuation.patrimonio.ativoCirculanteTotal),
      'Subtotal Ativo',
    ],
    [],
    [
      '(+) Imobilizado a Custo Histórico',
      valFormat(valuation.patrimonio.imobilizadoCustoHistorico),
      'Ativo Não Circulante',
    ],
    [
      '(-) Depreciação Acumulada Linear (NBC TG 27)',
      valFormat(-valuation.patrimonio.imobilizadoDepreciacaoAcumulada),
      'Conta Redutora Ativo',
    ],
    [
      '= ATIVO IMOBILIZADO LÍQUIDO',
      valFormat(valuation.patrimonio.imobilizadoLiquido),
      'Subtotal Ativo Não Circulante',
    ],
    [],
    ['TOTAL GERAL DO ATIVO', valFormat(valuation.patrimonio.ativoTotal), 'Ativo Total'],
    [],
    [
      '(-) Passivo Circulante (Contas a Pagar em Aberto)',
      valFormat(valuation.patrimonio.passivoCirculanteTotal),
      'Passivo Circulante',
    ],
    [
      '= PATRIMÔNIO LÍQUIDO CONTÁBIL (PL)',
      valFormat(valuation.patrimonio.patrimonioLiquidoContabil),
      'PL Contábil Líquido',
    ],
  ]

  // 3. ABA: RENTABILIDADE & EBITDA
  const aoaRentabilidade: unknown[][] = [
    ['DEMONSTRATIVO DE RENTABILIDADE E RESULTADO — AEROCAD'],
    [`Exercício de Referência: ${valuation.anoExercicio}`],
    [],
    ['DEGRAU DRE', 'VALOR (R$)', 'MARGEM %'],
    ['Receita Operacional Bruta', valFormat(valuation.rentabilidade.receitaBruta), '100.0%'],
    [
      '(-) Deduções e Impostos sobre Serviços',
      valFormat(-valuation.rentabilidade.deducoesTributarias),
      '—',
    ],
    ['(=) Receita Operacional Líquida', valFormat(valuation.rentabilidade.receitaLiquida), '—'],
    [
      '(-) Custos Diretos dos Projetos Aeronáuticos',
      valFormat(-valuation.rentabilidade.custosDiretosProjetos),
      '—',
    ],
    ['(=) Margem de Contribuição', valFormat(valuation.rentabilidade.margemContribuicao), '—'],
    [
      '(-) Despesas Operacionais e Administrativas',
      valFormat(-valuation.rentabilidade.despesasOperacionaisFixas),
      '—',
    ],
    [
      '(=) Lucro Operacional (EBIT)',
      valFormat(valuation.rentabilidade.lucroOperacionalEBIT),
      `${valuation.rentabilidade.margemLiquidaPercentual.toFixed(1)}%`,
    ],
    [
      '(+) Depreciação e Amortização Estimada',
      valFormat(valuation.rentabilidade.depreciacaoEstimadaExercicio),
      '—',
    ],
    [
      '(=) EBITDA / LAJIDA',
      valFormat(valuation.rentabilidade.ebitda),
      `${valuation.rentabilidade.margemEbitdaPercentual.toFixed(1)}%`,
    ],
    [
      '(=) Lucro Líquido do Exercício',
      valFormat(valuation.rentabilidade.lucroLiquido),
      `${valuation.rentabilidade.margemLiquidaPercentual.toFixed(1)}%`,
    ],
  ]

  // 4. ABA: CENÁRIOS DE VALUATION
  const aoaCenarios: unknown[][] = [
    ['QUADRO-RESUMO DE VALUATION — CENÁRIOS CONSOLIDADOS AEROCAD'],
    [`Faixa Calculada: ${valuation.resultadoFinal.faixaEstimada}`],
    [],
    ['MÉTODO / ABORDAGEM', 'CONSERVADOR (R$)', 'MÉDIO (R$)', 'OTIMISTA (R$)'],
    [
      'Múltiplos sobre EBITDA',
      valFormat(valuation.cenariosEbitda.conservador),
      valFormat(valuation.cenariosEbitda.medio),
      valFormat(valuation.cenariosEbitda.otimista),
    ],
    [
      'Múltiplos sobre Receita Líquida',
      valFormat(valuation.cenariosReceita.conservador),
      valFormat(valuation.cenariosReceita.medio),
      valFormat(valuation.cenariosReceita.otimista),
    ],
    [
      'Valor Patrimonial Contábil (Referência)',
      valFormat(valuation.patrimonio.patrimonioLiquidoContabil),
      valFormat(valuation.patrimonio.patrimonioLiquidoContabil),
      valFormat(valuation.patrimonio.patrimonioLiquidoContabil),
    ],
    [
      'Média Ponderada (PL + EBITDA + Receita)',
      valFormat(valuation.cenariosPonderados.conservador),
      valFormat(valuation.cenariosPonderados.medio),
      valFormat(valuation.cenariosPonderados.otimista),
    ],
    [
      '(+) Ajustes Intangíveis / Goodwill Informados',
      valFormat(valuation.ajustes.totalLiquidoIntangiveis),
      valFormat(valuation.ajustes.totalLiquidoIntangiveis),
      valFormat(valuation.ajustes.totalLiquidoIntangiveis),
    ],
    [],
    [
      'VALUATION FINAL CONSOLIDADO (R$)',
      valFormat(valuation.resultadoFinal.cenarioConservadorTotal),
      valFormat(valuation.resultadoFinal.cenarioMedioTotal),
      valFormat(valuation.resultadoFinal.cenarioOtimistaTotal),
    ],
    [],
    ['AJUSTES SUBJETIVOS / ATIVOS INTANGÍVEIS DETALHADOS'],
    ['Título / Descrição', 'Tipo', 'Categoria', 'Valor (R$)'],
  ]

  for (const item of valuation.ajustes.itens) {
    aoaCenarios.push([
      item.titulo,
      item.tipo === 'positivo' ? 'Acréscimo (+)' : 'Dedução (-)',
      item.categoria,
      valFormat(item.valor),
    ])
  }

  const workbook = xlsx.utils.book_new()

  const wsParametros = xlsx.utils.aoa_to_sheet(aoaParametros)
  wsParametros['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 45 }]
  xlsx.utils.book_append_sheet(workbook, wsParametros, 'Parâmetros')

  const wsPatrimonio = xlsx.utils.aoa_to_sheet(aoaPatrimonio)
  wsPatrimonio['!cols'] = [{ wch: 45 }, { wch: 22 }, { wch: 25 }]
  xlsx.utils.book_append_sheet(workbook, wsPatrimonio, 'Patrimônio')

  const wsRentabilidade = xlsx.utils.aoa_to_sheet(aoaRentabilidade)
  wsRentabilidade['!cols'] = [{ wch: 45 }, { wch: 22 }, { wch: 15 }]
  xlsx.utils.book_append_sheet(workbook, wsRentabilidade, 'Rentabilidade')

  const wsCenarios = xlsx.utils.aoa_to_sheet(aoaCenarios)
  wsCenarios['!cols'] = [{ wch: 40 }, { wch: 22 }, { wch: 22 }, { wch: 22 }]
  xlsx.utils.book_append_sheet(workbook, wsCenarios, 'Cenários')

  const filename = `valuation_aerocad_${valuation.anoExercicio}_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`

  if (typeof xlsx.writeFile === 'function') {
    xlsx.writeFile(workbook, filename)
  } else {
    const wbout = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}
