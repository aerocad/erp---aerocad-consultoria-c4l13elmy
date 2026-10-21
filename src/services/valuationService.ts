/**
 * Serviço de Cálculo e Gestão de Valuation Contábil / Econômico da AEROCAD
 *
 * Módulos e Métodos Contemplados:
 * 1. Série Histórica Multianual (evolução ano a ano, variação %, margens)
 * 2. Valor Patrimonial Contábil & Valor Substantivo (Ativo Ajustado com Goodwill e Contingências)
 * 3. Múltiplos de Mercado (EBITDA e Receita Líquida em 3 cenários)
 * 4. Fluxo de Caixa Descontado (FCD/DCF 5 anos + Perpetuidade Gordon Shapiro + VPL)
 * 5. Matriz de Sensibilidade Bidimensional (Taxa de Desconto WACC vs Taxa de Crescimento g)
 * 6. Qualidade da Receita e Concentração por Cliente (Top 1, 3 e 5)
 * 7. Decomposição de Despesas por Grupo Contábil e Plano de Contas
 * 8. Capital de Giro e Indicadores de Liquidez / Eficiência Operacional
 * 9. Composição Final Ponderada Configurável (pesos de FCD, Múltiplos EBITDA, Receita e Substantivo)
 * 10. Confiabilidade dos Dados Contábeis
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
  ProjetoRecord,
  ClienteRecord,
} from '@/types/crm'
import { calcularDepreciacaoLinear } from '@/components/financeiro/AtivosPatrimonioTab'
import { loadSheetJS } from '@/services/sheetjsLoader'
import { formatCurrency, isValoresOcultos, VALOR_MASCARADO } from '@/lib/format'
import { obterItemPlanoContasPorCodigo } from '@/lib/planoContas'

export interface MultiplosConfig {
  ebitdaConservador: number
  ebitdaMedio: number
  ebitdaOtimista: number
  receitaConservador: number
  receitaMedio: number
  receitaOtimista: number
  pesoPatrimonial: number // ex: 0.2
  pesoEbitda: number // ex: 0.5
  pesoReceita: number // ex: 0.3
}

export const MULTIPLOS_PADRAO: MultiplosConfig = {
  ebitdaConservador: 3.0,
  ebitdaMedio: 4.5,
  ebitdaOtimista: 6.0,
  receitaConservador: 0.5,
  receitaMedio: 0.8,
  receitaOtimista: 1.2,
  pesoPatrimonial: 0.2,
  pesoEbitda: 0.5,
  pesoReceita: 0.3,
}

// Parâmetros para Fluxo de Caixa Descontado (FCD / DCF)
export interface DcfParametrosConfig {
  wacc: number // Taxa de desconto anual (ex: 14.5% = 0.145)
  crescimentoPerpetuo: number // Taxa de crescimento na perpetuidade (ex: 3.5% = 0.035)
  taxasCrescimentoAnual: [number, number, number, number, number] // Projeção anos 1 a 5 (ex: [0.12, 0.10, 0.08, 0.07, 0.05])
  margemEbitdaProjetada: number // Margem EBITDA esperada na projeção (ex: 28% = 0.28)
  aliquotaImposto: number // Alíquota estimada IRPJ/CSLL (ex: 15% = 0.15)
  reinvestimentoPercentual: number // Reinvestimento em Capex + Capital Giro (% do EBIT, ex: 10% = 0.10)
}

export const DCF_PADRAO: DcfParametrosConfig = {
  wacc: 0.145, // 14.5% a.a. (Custo médio ponderado de capital típico de consultoria técnica)
  crescimentoPerpetuo: 0.035, // 3.5% a.a. (inflação de longo prazo / crescimento conservador)
  taxasCrescimentoAnual: [0.12, 0.1, 0.08, 0.07, 0.05], // Anos 1 a 5
  margemEbitdaProjetada: 0.28, // 28%
  aliquotaImposto: 0.15, // 15%
  reinvestimentoPercentual: 0.1, // 10% do EBIT
}

// Composição Ponderada Configurável dos Métodos
export interface ComposicaoPesosConfig {
  pesoDcf: number // ex: 40% (0.40)
  pesoMultiplosEbitda: number // ex: 30% (0.30)
  pesoMultiplosReceita: number // ex: 15% (0.15)
  pesoValorSubstantivo: number // ex: 15% (0.15)
}

export const COMPOSICAO_PESOS_PADRAO: ComposicaoPesosConfig = {
  pesoDcf: 0.4, // 40%
  pesoMultiplosEbitda: 0.3, // 30%
  pesoMultiplosReceita: 0.15, // 15%
  pesoValorSubstantivo: 0.15, // 15%
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

// Projeção do Fluxo de Caixa Descontado (Ano 1 a 5 + Perpetuidade)
export interface ProjecaoDcfAno {
  ano: number
  anoNumero: number
  taxaCrescimento: number
  receitaBruta: number
  receitaLiquida: number
  ebitda: number
  ebit: number
  impostos: number
  reinvestimentoCapexGiro: number
  fluxoCaixaLivre: number
  fatorDesconto: number
  fluxoPresente: number
}

export interface DcfResultado {
  parametros: DcfParametrosConfig
  projecoesAnuais: ProjecaoDcfAno[]
  somaVplFluxosExplicitos: number
  fluxoAnoTerminal: number
  valorPerpetuidadeNominal: number
  valorPerpetuidadePresente: number
  valorEmpresaFcdTotal: number // Enterprise Value (EV)
  caixaLiquido: number // Disponibilidades - Dívidas
  valorPatrimonialFcd: number // Equity Value
  cenariosFcd: CenariosValuation // Conservador (WACC +1.5%), Médio, Otimista (WACC -1.5%)
}

// Célula da Matriz de Sensibilidade (WACC vs g)
export interface SensibilidadeCelula {
  wacc: number
  crescimentoPerpetuo: number
  deltaWacc: string // ex: "-2pp", "-1pp", "Base", "+1pp", "+2pp"
  deltaG: string // ex: "-1pp", "Base", "+1pp"
  valorFcd: number
  valorConsolidadoPonderado: number
  isBase?: boolean
}

// Série Histórica Multianual
export interface SerieHistoricaAno {
  ano: number
  receitaBruta: number
  receitaLiquida: number
  tributos: number
  custosDiretos: number
  margemContribuicao: number
  despesasFixas: number
  ebitda: number
  depreciacao: number
  lucroLiquido: number
  margemEbitda: number
  margemLiquida: number
  variacaoReceitaPercentual: number | null
  variacaoEbitdaPercentual: number | null
  variacaoLucroPercentual: number | null
  totalLancamentos: number
}

// Decomposição de Despesas
export interface GrupoDespesaItem {
  codigoGrupo: string
  nomeGrupo: string
  valorTotal: number
  percentualSobreTotal: number
  percentualSobreReceita: number
  quantidadeLancamentos: number
  contas: Array<{
    codigo: string
    nome: string
    valor: number
    percentual: number
  }>
}

// Qualidade e Concentração da Receita
export interface ConcentracaoClienteItem {
  posicao: number
  clienteId?: string
  clienteNome: string
  cnpjCpf?: string
  totalFaturado: number
  percentualSobreReceita: number
  quantidadeProjetosOuParcelas: number
}

export interface QualidadeReceita {
  totalClientesAtivos: number
  faturamentoTop1: number
  percentualTop1: number
  faturamentoTop3: number
  percentualTop3: number
  faturamentoTop5: number
  percentualTop5: number
  topClientes: ConcentracaoClienteItem[]
  indiceHHI: number // Hirschman-Herfindahl Index
  classificacaoRiscoConcentracao: 'baixo' | 'moderado' | 'elevado'
  alertas: string[]
}

// Capital de Giro e Prazos Médios
export interface CapitalGiroAnalise {
  contasReceberTotal: number
  contasPagarTotal: number
  disponibilidades: number
  capitalGiroLiquido: number // Ativo Circulante - Passivo Circulante
  necessidadeCapitalGiro: number // Contas a Receber - Contas a Pagar
  saldoTesouraria: number
  prazoMedioRecebimentoDias: number // PMR aproximado
  prazoMedioPagamentoDias: number // PMP aproximado
  cicloOperacionalDias: number
  liquidezCorrente: number
  liquidezSeca: number
  liquidezGeral: number
}

// Valor Substantivo (Ativo Ajustado)
export interface ValorSubstantivo {
  patrimonioLiquidoContabil: number
  ajustesAtivoSubjetivo: number
  passivosContingentesDeducoes: number
  totalLiquidoIntangiveis: number
  valorSubstantivoAjustado: number
  cenariosSubstantivo: CenariosValuation
}

// Composição Final Ponderada Multimétodos
export interface MetodoValuationResumo {
  chave: 'dcf' | 'multiplos_ebitda' | 'multiplos_receita' | 'valor_substantivo'
  nome: string
  descricao: string
  peso: number
  valorConservador: number
  valorMedio: number
  valorOtimista: number
  valorPonderadoContribuicao: number
}

export interface ComposicaoMultimetodos {
  pesosConfig: ComposicaoPesosConfig
  metodos: MetodoValuationResumo[]
  faixaFinalConservadora: number
  faixaFinalMedia: number
  faixaFinalOtimista: number
  faixaFormatada: string
  valorReferenciaSugerido: number
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
  // 3. Múltiplos e Cenários Tradicionais
  multiplosUsados: MultiplosConfig
  cenariosEbitda: CenariosValuation
  cenariosReceita: CenariosValuation
  cenariosPonderados: CenariosValuation
  // 4. Fluxo de Caixa Projetado Contratual
  fluxoProjetado: {
    totalReceberPrevistoAberto: number
    mediaReceitaMensalRealizada: number
    mediaDespesaMensalRealizada: number
    mediaResultadoMensal: number
    projecao12MesesResultado: number
    parcelasContratuaisQtd: number
  }
  // 5. Ajustes Subjetivos / Intangíveis
  ajustes: {
    itens: AjusteSubjetivoItem[]
    totalPositivo: number
    totalNegativo: number
    totalLiquidoIntangiveis: number
  }
  // 6. Novos Métodos Avançados
  dcf: DcfResultado
  valorSubstantivo: ValorSubstantivo
  composicaoMultimetodos: ComposicaoMultimetodos
  matrizSensibilidade: SensibilidadeCelula[][]
  // 7. Análises Profundas Complementares
  serieHistorica: SerieHistoricaAno[]
  decomposicaoDespesas: GrupoDespesaItem[]
  qualidadeReceita: QualidadeReceita
  capitalGiro: CapitalGiroAnalise
  // 8. Resultado Final Consolidado Geral
  resultadoFinal: {
    cenarioConservadorTotal: number
    cenarioMedioTotal: number
    cenarioOtimistaTotal: number
    faixaEstimada: string
    valorReferenciaSugerido: number
  }
  // 9. Indicadores de Apoio
  indicadoresApoio: {
    liquidezCorrente: number
    endividamentoGeral: number
    retornoSobrePL: number
    coberturaCustosFixosMeses: number
  }
  // 10. Diagnóstico de Confiabilidade
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
 * Executa o cálculo econômico completo do Valuation da AEROCAD com todos os 4 métodos e análises profundas
 */
export function calcularValuationAerocad(params: {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  contasBancarias: ContaBancariaRecord[]
  ativosPatrimonio: AtivoPatrimonioRecord[]
  extratosTransacoes?: ExtratoTransacaoRecord[]
  balancetes?: BalanceteMensalRecord[]
  projetos?: ProjetoRecord[]
  clientes?: ClienteRecord[]
  empresa?: EmpresaRecord | null
  anoExercicio?: number
  multiplos?: MultiplosConfig
  dcfConfig?: DcfParametrosConfig
  composicaoPesos?: ComposicaoPesosConfig
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
    projetos = [],
    clientes = [],
    empresa,
    anoExercicio = new Date().getFullYear(),
    multiplos = MULTIPLOS_PADRAO,
    dcfConfig = DCF_PADRAO,
    composicaoPesos = COMPOSICAO_PESOS_PADRAO,
    ajustesSubjetivos = [],
  } = params

  const anoStr = String(anoExercicio)

  // 1. DISPONIBILIDADES BANCÁRIAS E ATIVO CIRCULANTE
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

  // Patrimônio Líquido Contábil
  const patrimonioLiquidoContabil = ativoTotal - passivoCirculanteTotal

  // 2. RENTABILIDADE DO EXERCÍCIO SELECIONADO
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

  // Se ano corrente ainda com poucos dados, fallback seguro para últimos 12 meses/histórico
  if (receitaBruta === 0) {
    receitaBruta =
      parcelas
        .filter((p) => p.status === 'paga')
        .reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0) +
      contasReceber
        .filter((cr) => cr.status === 'recebido')
        .reduce((acc, cr) => acc + (cr.valor_recebido || cr.valor || 0), 0)
  }

  let despesasPagas = contasPagar.filter((cp) => {
    const dt = cp.data_pagamento || cp.data_vencimento || ''
    return dt.startsWith(anoStr) && cp.status === 'pago'
  })
  if (despesasPagas.length === 0) {
    despesasPagas = contasPagar.filter((cp) => cp.status === 'pago')
  }

  // Deduções e Tributos (Grupo 3.3)
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
  const ebitda = Math.max(0, lucroOperacionalEBIT + depreciacaoEstimadaExercicio)

  const margemEbitdaPercentual = receitaBruta > 0 ? (ebitda / receitaBruta) * 100 : 0
  const margemLiquidaPercentual = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0

  // 3. MÚLTIPLOS DE MERCADO
  const cenariosEbitda: CenariosValuation = {
    conservador: ebitda * (multiplos.ebitdaConservador || 3.0),
    medio: ebitda * (multiplos.ebitdaMedio || 4.5),
    otimista: ebitda * (multiplos.ebitdaOtimista || 6.0),
  }

  const cenariosReceita: CenariosValuation = {
    conservador: receitaLiquida * (multiplos.receitaConservador || 0.5),
    medio: receitaLiquida * (multiplos.receitaMedio || 0.8),
    otimista: receitaLiquida * (multiplos.receitaOtimista || 1.2),
  }

  const pPl = multiplos.pesoPatrimonial || 0.2
  const pEb = multiplos.pesoEbitda || 0.5
  const pRec = multiplos.pesoReceita || 0.3
  const somaPesosMultiplos = pPl + pEb + pRec || 1

  const cenariosPonderados: CenariosValuation = {
    conservador:
      (patrimonioLiquidoContabil * pPl +
        cenariosEbitda.conservador * pEb +
        cenariosReceita.conservador * pRec) /
      somaPesosMultiplos,
    medio:
      (patrimonioLiquidoContabil * pPl +
        cenariosEbitda.medio * pEb +
        cenariosReceita.medio * pRec) /
      somaPesosMultiplos,
    otimista:
      (patrimonioLiquidoContabil * pPl +
        cenariosEbitda.otimista * pEb +
        cenariosReceita.otimista * pRec) /
      somaPesosMultiplos,
  }

  // 4. FLUXO DE CAIXA PROJETADO CONTRATUAL
  const parcelasPendentes = parcelas.filter((p) => p.status !== 'paga')
  const totalReceberPrevistoAberto = parcelasPendentes.reduce((acc, p) => acc + (p.valor || 0), 0)

  let mediaReceitaMensalRealizada = 0
  let mediaDespesaMensalRealizada = 0

  if (balancetes.length > 0) {
    const totalRecBal = balancetes.reduce((acc, b) => acc + (b.receita_total || 0), 0)
    const totalDespBal = balancetes.reduce((acc, b) => acc + (b.despesa_total || 0), 0)
    mediaReceitaMensalRealizada = totalRecBal / balancetes.length
    mediaDespesaMensalRealizada = totalDespBal / balancetes.length
  } else {
    mediaReceitaMensalRealizada = receitaBruta / 12
    mediaDespesaMensalRealizada =
      (deducoesTributarias + custosDiretosProjetos + despesasOperacionaisFixas) / 12
  }

  const mediaResultadoMensal = mediaReceitaMensalRealizada - mediaDespesaMensalRealizada
  const projecao12MesesResultado = mediaResultadoMensal * 12

  // 5. AJUSTES SUBJETIVOS / ATIVOS INTANGÍVEIS E PASSIVOS CONTINGENTES
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

  // =========================================================================
  // NOVO MÉTODO 1: VALOR SUBSTANTIVO (ATIVO AJUSTADO)
  // Patrimônio Líquido contábil ajustado por ativos intangíveis avaliados e contingências
  // =========================================================================
  const valorSubstantivoBase = patrimonioLiquidoContabil + totalLiquidoIntangiveis
  const valorSubstantivo: ValorSubstantivo = {
    patrimonioLiquidoContabil,
    ajustesAtivoSubjetivo: totalPositivo,
    passivosContingentesDeducoes: totalNegativo,
    totalLiquidoIntangiveis,
    valorSubstantivoAjustado: Math.max(0, valorSubstantivoBase),
    cenariosSubstantivo: {
      conservador: Math.max(
        0,
        patrimonioLiquidoContabil + totalPositivo * 0.7 - totalNegativo * 1.3,
      ),
      medio: Math.max(0, valorSubstantivoBase),
      otimista: Math.max(0, patrimonioLiquidoContabil + totalPositivo * 1.2 - totalNegativo * 0.8),
    },
  }

  // =========================================================================
  // NOVO MÉTODO 2: FLUXO DE CAIXA DESCONTADO (FCD / DCF 5 ANOS + PERPETUIDADE)
  // =========================================================================
  const baseReceitaLiquida =
    receitaLiquida > 0 ? receitaLiquida : Math.max(receitaBruta * 0.9, 100000)
  const baseMargemEbitda =
    margemEbitdaPercentual > 5 && margemEbitdaPercentual < 70
      ? margemEbitdaPercentual / 100
      : dcfConfig.margemEbitdaProjetada || 0.28

  const projecoesAnuais: ProjecaoDcfAno[] = []
  let receitaCorrente = baseReceitaLiquida
  let somaVplFluxosExplicitos = 0

  for (let i = 0; i < 5; i++) {
    const anoNum = i + 1
    const taxaCresc = dcfConfig.taxasCrescimentoAnual[i] ?? 0.08
    receitaCorrente = receitaCorrente * (1 + taxaCresc)
    const recBrutaEst = receitaCorrente / 0.9 // estimativa
    const ebitdaEst = receitaCorrente * baseMargemEbitda
    const depEst = depreciacaoEstimadaExercicio * (1 + i * 0.05)
    const ebitEst = Math.max(0, ebitdaEst - depEst)
    const impostosEst = ebitEst * (dcfConfig.aliquotaImposto || 0.15)
    const reinvestEst = ebitEst * (dcfConfig.reinvestimentoPercentual || 0.1)
    // FCL = EBIT * (1 - T) + Depreciação - Capex/Giro
    const fluxoCaixaLivre = ebitEst - impostosEst + depEst - reinvestEst

    const fatorDesconto = Math.pow(1 + dcfConfig.wacc, anoNum)
    const fluxoPresente = fluxoCaixaLivre / fatorDesconto
    somaVplFluxosExplicitos += fluxoPresente

    projecoesAnuais.push({
      ano: anoExercicio + anoNum,
      anoNumero: anoNum,
      taxaCrescimento: taxaCresc,
      receitaBruta: recBrutaEst,
      receitaLiquida: receitaCorrente,
      ebitda: ebitdaEst,
      ebit: ebitEst,
      impostos: impostosEst,
      reinvestimentoCapexGiro: reinvestEst,
      fluxoCaixaLivre,
      fatorDesconto,
      fluxoPresente,
    })
  }

  // Perpetuidade Gordon Shapiro
  // Valor Terminal = FCL_ano5 * (1 + g) / (WACC - g)
  const fclAno5 = projecoesAnuais[4].fluxoCaixaLivre
  const g = dcfConfig.crescimentoPerpetuo
  const wacc = dcfConfig.wacc
  const taxaDenominador = Math.max(0.02, wacc - g)
  const fluxoAnoTerminal = fclAno5 * (1 + g)
  const valorPerpetuidadeNominal = fluxoAnoTerminal / taxaDenominador
  const fatorDescontoAno5 = Math.pow(1 + wacc, 5)
  const valorPerpetuidadePresente = valorPerpetuidadeNominal / fatorDescontoAno5

  const valorEmpresaFcdTotal = somaVplFluxosExplicitos + valorPerpetuidadePresente
  // Caixa Líquido = Disponibilidades Bancárias - Dívidas Circulantes
  const caixaLiquido = disponibilidadesBancarias - passivoCirculanteTotal
  const valorPatrimonialFcd = Math.max(0, valorEmpresaFcdTotal + caixaLiquido)

  // Função auxiliar de cálculo rápido de FCD para sensibilidade e cenários
  const calcularFcdRapido = (taxaW: number, taxaG: number): number => {
    let rec = baseReceitaLiquida
    let vplExpl = 0
    let fclFinal = 0
    for (let i = 0; i < 5; i++) {
      const tc = dcfConfig.taxasCrescimentoAnual[i] ?? 0.08
      rec = rec * (1 + tc)
      const eb = rec * baseMargemEbitda
      const dep = depreciacaoEstimadaExercicio * (1 + i * 0.05)
      const ebit = Math.max(0, eb - dep)
      const fcl =
        ebit * (1 - (dcfConfig.aliquotaImposto || 0.15)) +
        dep -
        ebit * (dcfConfig.reinvestimentoPercentual || 0.1)
      vplExpl += fcl / Math.pow(1 + taxaW, i + 1)
      if (i === 4) fclFinal = fcl
    }
    const denom = Math.max(0.015, taxaW - taxaG)
    const vPerpNom = (fclFinal * (1 + taxaG)) / denom
    const vPerpPres = vPerpNom / Math.pow(1 + taxaW, 5)
    return Math.max(0, vplExpl + vPerpPres + caixaLiquido)
  }

  const cenariosFcd: CenariosValuation = {
    conservador: calcularFcdRapido(wacc + 0.02, Math.max(0.015, g - 0.01)),
    medio: valorPatrimonialFcd,
    otimista: calcularFcdRapido(Math.max(0.08, wacc - 0.02), g + 0.01),
  }

  const dcf: DcfResultado = {
    parametros: dcfConfig,
    projecoesAnuais,
    somaVplFluxosExplicitos,
    fluxoAnoTerminal,
    valorPerpetuidadeNominal,
    valorPerpetuidadePresente,
    valorEmpresaFcdTotal,
    caixaLiquido,
    valorPatrimonialFcd,
    cenariosFcd,
  }

  // =========================================================================
  // NOVO RECURSO: MATRIZ DE SENSIBILIDADE BIDIMENSIONAL (WACC vs g)
  // Variações de WACC (-2pp, -1pp, Base, +1pp, +2pp) × g (-1pp, Base, +1pp)
  // =========================================================================
  const deltasWacc = [-0.02, -0.01, 0, 0.01, 0.02]
  const deltasG = [-0.01, 0, 0.01]
  const matrizSensibilidade: SensibilidadeCelula[][] = deltasWacc.map((dW) => {
    const waccVar = Math.max(0.07, wacc + dW)
    const labelW =
      dW === 0 ? 'Base' : dW > 0 ? `+${(dW * 100).toFixed(0)}pp` : `${(dW * 100).toFixed(0)}pp`

    return deltasG.map((dG) => {
      const gVar = Math.max(0.01, g + dG)
      const labelG =
        dG === 0 ? 'Base' : dG > 0 ? `+${(dG * 100).toFixed(0)}pp` : `${(dG * 100).toFixed(0)}pp`
      const valFcd = calcularFcdRapido(waccVar, gVar)

      // Cálculo correspondente do valor final ponderado com este FCD
      const pwDcf = composicaoPesos.pesoDcf
      const pwEb = composicaoPesos.pesoMultiplosEbitda
      const pwRec = composicaoPesos.pesoMultiplosReceita
      const pwSub = composicaoPesos.pesoValorSubstantivo
      const totalPesos = pwDcf + pwEb + pwRec + pwSub || 1

      const valConsolidado =
        (valFcd * pwDcf +
          cenariosEbitda.medio * pwEb +
          cenariosReceita.medio * pwRec +
          valorSubstantivo.valorSubstantivoAjustado * pwSub) /
        totalPesos

      return {
        wacc: waccVar,
        crescimentoPerpetuo: gVar,
        deltaWacc: labelW,
        deltaG: labelG,
        valorFcd: valFcd,
        valorConsolidadoPonderado: valConsolidado,
        isBase: dW === 0 && dG === 0,
      }
    })
  })

  // =========================================================================
  // NOVO MÉTODO 3: COMPOSIÇÃO FINAL PONDERADA E CONFIGURÁVEL
  // 4 métodos combinados com pesos definidos pelo usuário
  // =========================================================================
  const pwDcf = composicaoPesos.pesoDcf
  const pwEb = composicaoPesos.pesoMultiplosEbitda
  const pwRec = composicaoPesos.pesoMultiplosReceita
  const pwSub = composicaoPesos.pesoValorSubstantivo
  const totalSomaPesos = pwDcf + pwEb + pwRec + pwSub || 1

  const metodosResumo: MetodoValuationResumo[] = [
    {
      chave: 'dcf',
      nome: 'Fluxo de Caixa Descontado (FCD / DCF)',
      descricao: `Projeção 5 anos + perpetuidade (${(dcfConfig.wacc * 100).toFixed(1)}% a.a. WACC, ${(dcfConfig.crescimentoPerpetuo * 100).toFixed(1)}% g)`,
      peso: pwDcf / totalSomaPesos,
      valorConservador: cenariosFcd.conservador,
      valorMedio: cenariosFcd.medio,
      valorOtimista: cenariosFcd.otimista,
      valorPonderadoContribuicao: (cenariosFcd.medio * pwDcf) / totalSomaPesos,
    },
    {
      chave: 'multiplos_ebitda',
      nome: 'Múltiplos de EBITDA (LAJIDA)',
      descricao: `Múltiplos ${multiplos.ebitdaConservador}x / ${multiplos.ebitdaMedio}x / ${multiplos.ebitdaOtimista}x sobre geração operacional`,
      peso: pwEb / totalSomaPesos,
      valorConservador: cenariosEbitda.conservador,
      valorMedio: cenariosEbitda.medio,
      valorOtimista: cenariosEbitda.otimista,
      valorPonderadoContribuicao: (cenariosEbitda.medio * pwEb) / totalSomaPesos,
    },
    {
      chave: 'multiplos_receita',
      nome: 'Múltiplos de Receita Líquida',
      descricao: `Múltiplos ${multiplos.receitaConservador}x / ${multiplos.receitaMedio}x / ${multiplos.receitaOtimista}x sobre carteira faturada`,
      peso: pwRec / totalSomaPesos,
      valorConservador: cenariosReceita.conservador,
      valorMedio: cenariosReceita.medio,
      valorOtimista: cenariosReceita.otimista,
      valorPonderadoContribuicao: (cenariosReceita.medio * pwRec) / totalSomaPesos,
    },
    {
      chave: 'valor_substantivo',
      nome: 'Valor Substantivo (Ativo Ajustado)',
      descricao:
        'Patrimônio Líquido contábil ajustado por acervo técnico, licenças e contingências',
      peso: pwSub / totalSomaPesos,
      valorConservador: valorSubstantivo.cenariosSubstantivo.conservador,
      valorMedio: valorSubstantivo.valorSubstantivoAjustado,
      valorOtimista: valorSubstantivo.cenariosSubstantivo.otimista,
      valorPonderadoContribuicao:
        (valorSubstantivo.valorSubstantivoAjustado * pwSub) / totalSomaPesos,
    },
  ]

  const faixaFinalConservadora = metodosResumo.reduce(
    (acc, m) => acc + m.valorConservador * m.peso,
    0,
  )
  const faixaFinalMedia = metodosResumo.reduce((acc, m) => acc + m.valorMedio * m.peso, 0)
  const faixaFinalOtimista = metodosResumo.reduce((acc, m) => acc + m.valorOtimista * m.peso, 0)

  const composicaoMultimetodos: ComposicaoMultimetodos = {
    pesosConfig: composicaoPesos,
    metodos: metodosResumo,
    faixaFinalConservadora,
    faixaFinalMedia,
    faixaFinalOtimista,
    faixaFormatada: `${formatCurrency(faixaFinalConservadora)} a ${formatCurrency(faixaFinalOtimista)}`,
    valorReferenciaSugerido: faixaFinalMedia,
  }

  // =========================================================================
  // NOVO RECURSO: SÉRIE HISTÓRICA MULTIANUAL (EVOLUÇÃO ANO A ANO COM COMPARAÇÃO %)
  // =========================================================================
  const anosEncontrados = new Set<number>()
  anosEncontrados.add(anoExercicio)
  anosEncontrados.add(anoExercicio - 1)
  anosEncontrados.add(anoExercicio - 2)

  for (const p of parcelas) {
    const dt = p.data_pagamento || p.vencimento || ''
    if (dt.length >= 4) {
      const y = parseInt(dt.slice(0, 4), 10)
      if (y > 2018 && y <= anoExercicio) anosEncontrados.add(y)
    }
  }
  for (const cp of contasPagar) {
    const dt = cp.data_pagamento || cp.data_vencimento || ''
    if (dt.length >= 4) {
      const y = parseInt(dt.slice(0, 4), 10)
      if (y > 2018 && y <= anoExercicio) anosEncontrados.add(y)
    }
  }

  const anosOrdenados = Array.from(anosEncontrados).sort((a, b) => a - b)
  const serieHistorica: SerieHistoricaAno[] = []

  let recAnoAnterior: number | null = null
  let ebAnoAnterior: number | null = null
  let lucAnoAnterior: number | null = null

  for (const ano of anosOrdenados) {
    const aStr = String(ano)
    const parcAno = parcelas.filter((p) => {
      const dt = p.data_pagamento || p.data_faturamento || p.vencimento || ''
      return dt.startsWith(aStr) && p.status === 'paga'
    })
    const avulsasAno = contasReceber.filter((cr) => {
      const dt = cr.data_recebimento || cr.data_vencimento || ''
      return dt.startsWith(aStr) && cr.status === 'recebido'
    })

    const recB =
      parcAno.reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0) +
      avulsasAno.reduce((acc, cr) => acc + (cr.valor_recebido || cr.valor || 0), 0)

    const despAno = contasPagar.filter((cp) => {
      const dt = cp.data_pagamento || cp.data_vencimento || ''
      return dt.startsWith(aStr) && cp.status === 'pago'
    })

    const trib = despAno
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

    const recL = Math.max(0, recB - trib)

    const cDir = despAno
      .filter((cp) => {
        const cod = cp.plano_contas_codigo || ''
        if (cod) return cod.startsWith('3.2') || cod === '3.1.4' || cod === '3.1.5'
        return cp.categoria === 'terceirizados' || Boolean(cp.projeto)
      })
      .reduce((acc, cp) => acc + (cp.valor || 0), 0)

    const mContr = recL - cDir

    const dFix = despAno
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

    const lucOp = mContr - dFix
    const depAno = depreciacaoEstimadaExercicio
    const eb = Math.max(0, lucOp + depAno)
    const lucL = lucOp

    const mEb = recB > 0 ? (eb / recB) * 100 : 0
    const mLiq = recB > 0 ? (lucL / recB) * 100 : 0

    const varRec =
      recAnoAnterior && recAnoAnterior > 0 ? ((recB - recAnoAnterior) / recAnoAnterior) * 100 : null
    const varEb =
      ebAnoAnterior && ebAnoAnterior > 0 ? ((eb - ebAnoAnterior) / ebAnoAnterior) * 100 : null
    const varLuc =
      lucAnoAnterior && lucAnoAnterior > 0 ? ((lucL - lucAnoAnterior) / lucAnoAnterior) * 100 : null

    serieHistorica.push({
      ano,
      receitaBruta: recB,
      receitaLiquida: recL,
      tributos: trib,
      custosDiretos: cDir,
      margemContribuicao: mContr,
      despesasFixas: dFix,
      ebitda: eb,
      depreciacao: depAno,
      lucroLiquido: lucL,
      margemEbitda: mEb,
      margemLiquida: mLiq,
      variacaoReceitaPercentual: varRec,
      variacaoEbitdaPercentual: varEb,
      variacaoLucroPercentual: varLuc,
      totalLancamentos: parcAno.length + avulsasAno.length + despAno.length,
    })

    recAnoAnterior = recB
    ebAnoAnterior = eb
    lucAnoAnterior = lucL
  }

  // =========================================================================
  // NOVO RECURSO: DECOMPOSIÇÃO DE DESPESAS POR GRUPO E CONTA CONTÁBIL
  // =========================================================================
  const totalDespesasTodas = despesasPagas.reduce((acc, cp) => acc + (cp.valor || 0), 0)
  const gruposMap = new Map<
    string,
    { nome: string; contas: Map<string, { nome: string; valor: number }> }
  >()

  // Grupos estruturados do plano de contas
  const gruposNomesPadrao: Record<string, string> = {
    '3.1': '3.1 — Despesas Administrativas & Infraestrutura',
    '3.2': '3.2 — Custos Diretos & Subcontratação Técnica',
    '3.3': '3.3 — Deduções Fiscais e Tributos',
    '3.4': '3.4 — Pessoal, Folha e Encargos',
    '3.5': '3.5 — Despesas Financeiras e Bancárias',
    '3.6': '3.6 — Investimentos e Ativos',
    outros: '3.9 — Outras Despesas Operacionais',
  }

  for (const cp of despesasPagas) {
    const cod = cp.plano_contas_codigo || ''
    let grupoKey = 'outros'
    if (cod.startsWith('3.1')) grupoKey = '3.1'
    else if (cod.startsWith('3.2')) grupoKey = '3.2'
    else if (cod.startsWith('3.3')) grupoKey = '3.3'
    else if (cod.startsWith('3.4')) grupoKey = '3.4'
    else if (cod.startsWith('3.5')) grupoKey = '3.5'
    else if (cod.startsWith('3.6')) grupoKey = '3.6'
    else if (cp.categoria === 'impostos') grupoKey = '3.3'
    else if (cp.categoria === 'terceirizados') grupoKey = '3.2'
    else if (cp.categoria === 'folha') grupoKey = '3.4'

    if (!gruposMap.has(grupoKey)) {
      gruposMap.set(grupoKey, {
        nome: gruposNomesPadrao[grupoKey] || grupoKey,
        contas: new Map(),
      })
    }

    const gObj = gruposMap.get(grupoKey)!
    const contaCod = cod || (cp.categoria ? `cat.${cp.categoria}` : 'diversos')
    const itemConta = obterItemPlanoContasPorCodigo(cod)
    const contaNome = itemConta?.nome || cp.descricao || cp.categoria || 'Despesa Avulsa'

    const atual = gObj.contas.get(contaCod) || { nome: contaNome, valor: 0 }
    atual.valor += cp.valor || 0
    gObj.contas.set(contaCod, atual)
  }

  const decomposicaoDespesas: GrupoDespesaItem[] = Array.from(gruposMap.entries())
    .map(([grupoKey, gObj]) => {
      const contasArr = Array.from(gObj.contas.entries()).map(([cCod, cObj]) => ({
        codigo: cCod,
        nome: cObj.nome,
        valor: cObj.valor,
        percentual: totalDespesasTodas > 0 ? (cObj.valor / totalDespesasTodas) * 100 : 0,
      }))

      const valorGrupo = contasArr.reduce((acc, c) => acc + c.valor, 0)
      return {
        codigoGrupo: grupoKey,
        nomeGrupo: gObj.nome,
        valorTotal: valorGrupo,
        percentualSobreTotal: totalDespesasTodas > 0 ? (valorGrupo / totalDespesasTodas) * 100 : 0,
        percentualSobreReceita: receitaBruta > 0 ? (valorGrupo / receitaBruta) * 100 : 0,
        quantidadeLancamentos: contasArr.length,
        contas: contasArr.sort((a, b) => b.valor - a.valor),
      }
    })
    .sort((a, b) => b.valorTotal - a.valorTotal)

  // =========================================================================
  // NOVO RECURSO: QUALIDADE DA RECEITA E CONCENTRAÇÃO POR CLIENTE (TOP 1, 3, 5)
  // =========================================================================
  const clientesMap = new Map<string, { nome: string; cnpj?: string; valor: number; qtd: number }>()

  // Processar parcelas pagas no exercício
  for (const p of parcelasExercicio) {
    const val = p.valor_recebido || p.valor || 0
    let cliNome = 'Cliente Não Identificado'
    let cliId = p.cliente || ''

    if (p.cliente) {
      const cObj = clientes.find((c) => c.id === p.cliente)
      if (cObj) cliNome = cObj.razao_social || cObj.nome_fantasia || cliNome
    }
    if (cliNome === 'Cliente Não Identificado' && p.projeto) {
      const proj = projetos.find((pr) => pr.id === p.projeto)
      if (proj && proj.cliente) {
        cliId = proj.cliente
        const cObj = clientes.find((c) => c.id === proj.cliente)
        if (cObj) cliNome = cObj.razao_social || cObj.nome_fantasia || cliNome
      }
    }

    const key = cliId || cliNome
    const reg = clientesMap.get(key) || { nome: cliNome, valor: 0, qtd: 0 }
    reg.valor += val
    reg.qtd += 1
    clientesMap.set(key, reg)
  }

  // Complementar com contas a receber liquidadas
  for (const cr of avulsasExercicio) {
    const val = cr.valor_recebido || cr.valor || 0
    let cliNome = cr.cliente_nome || 'Cliente Avulso'
    const key = cr.cliente || cliNome
    const reg = clientesMap.get(key) || { nome: cliNome, valor: 0, qtd: 0 }
    reg.valor += val
    reg.qtd += 1
    clientesMap.set(key, reg)
  }

  const clientesRankeados = Array.from(clientesMap.entries())
    .map(([key, c], idx) => ({
      posicao: idx + 1,
      clienteId: key.length === 15 ? key : undefined,
      clienteNome: c.nome,
      totalFaturado: c.valor,
      percentualSobreReceita: receitaBruta > 0 ? (c.valor / receitaBruta) * 100 : 0,
      quantidadeProjetosOuParcelas: c.qtd,
    }))
    .sort((a, b) => b.totalFaturado - a.totalFaturado)
    .map((c, idx) => ({ ...c, posicao: idx + 1 }))

  const faturamentoTop1 = clientesRankeados[0]?.totalFaturado || 0
  const percentualTop1 = receitaBruta > 0 ? (faturamentoTop1 / receitaBruta) * 100 : 0

  const faturamentoTop3 = clientesRankeados.slice(0, 3).reduce((acc, c) => acc + c.totalFaturado, 0)
  const percentualTop3 = receitaBruta > 0 ? (faturamentoTop3 / receitaBruta) * 100 : 0

  const faturamentoTop5 = clientesRankeados.slice(0, 5).reduce((acc, c) => acc + c.totalFaturado, 0)
  const percentualTop5 = receitaBruta > 0 ? (faturamentoTop5 / receitaBruta) * 100 : 0

  // Cálculo do Índice HHI (Herfindahl-Hirschman)
  let somaQuadradosPercentuais = 0
  for (const c of clientesRankeados) {
    somaQuadradosPercentuais += Math.pow(c.percentualSobreReceita, 2)
  }
  const indiceHHI = Math.round(somaQuadradosPercentuais)

  let classificacaoRiscoConcentracao: 'baixo' | 'moderado' | 'elevado' = 'baixo'
  const alertasConcentracao: string[] = []

  if (percentualTop1 > 50 || percentualTop3 > 75 || indiceHHI > 2500) {
    classificacaoRiscoConcentracao = 'elevado'
    alertasConcentracao.push(
      `Alta concentração de faturamento: o maior cliente responde por ${percentualTop1.toFixed(1)}% e os 3 maiores somam ${percentualTop3.toFixed(1)}% da receita.`,
    )
  } else if (percentualTop1 > 30 || percentualTop3 > 50 || indiceHHI > 1500) {
    classificacaoRiscoConcentracao = 'moderado'
    alertasConcentracao.push(
      `Concentração moderada de receita: os 3 principais clientes representam ${percentualTop3.toFixed(1)}% do faturamento.`,
    )
  } else {
    classificacaoRiscoConcentracao = 'baixo'
  }

  const qualidadeReceita: QualidadeReceita = {
    totalClientesAtivos: clientesRankeados.length,
    faturamentoTop1,
    percentualTop1,
    faturamentoTop3,
    percentualTop3,
    faturamentoTop5,
    percentualTop5,
    topClientes: clientesRankeados.slice(0, 10),
    indiceHHI,
    classificacaoRiscoConcentracao,
    alertas: alertasConcentracao,
  }

  // =========================================================================
  // NOVO RECURSO: CAPITAL DE GIRO, LIQUIDEZ E EFICIÊNCIA OPERACIONAL
  // =========================================================================
  const capitalGiroLiquido = ativoCirculanteTotal - passivoCirculanteTotal
  const necessidadeCapitalGiro = contasReceberCirculante - passivoCirculanteTotal
  const saldoTesouraria = disponibilidadesBancarias

  // Prazos Médios (aproximações com base nos 360 dias)
  const faturamentoDiario = receitaBruta > 0 ? receitaBruta / 360 : 1
  const comprasDiarias = totalDespesasTodas > 0 ? totalDespesasTodas / 360 : 1
  const prazoMedioRecebimentoDias = Math.min(
    180,
    Math.round(contasReceberCirculante / faturamentoDiario),
  )
  const prazoMedioPagamentoDias = Math.min(180, Math.round(passivoCirculanteTotal / comprasDiarias))
  const cicloOperacionalDias = Math.max(0, prazoMedioRecebimentoDias - prazoMedioPagamentoDias)

  const liquidezCorrente =
    passivoCirculanteTotal > 0 ? ativoCirculanteTotal / passivoCirculanteTotal : 99.9
  const liquidezSeca =
    passivoCirculanteTotal > 0 ? ativoCirculanteTotal / passivoCirculanteTotal : 99.9
  const liquidezGeral = passivoCirculanteTotal > 0 ? ativoTotal / passivoCirculanteTotal : 99.9

  const capitalGiro: CapitalGiroAnalise = {
    contasReceberTotal: contasReceberCirculante,
    contasPagarTotal: passivoCirculanteTotal,
    disponibilidades: disponibilidadesBancarias,
    capitalGiroLiquido,
    necessidadeCapitalGiro,
    saldoTesouraria,
    prazoMedioRecebimentoDias,
    prazoMedioPagamentoDias,
    cicloOperacionalDias,
    liquidezCorrente,
    liquidezSeca,
    liquidezGeral,
  }

  // 6. RESULTADO FINAL CONSOLIDADO GERAL (Usando a nova Composição Multimétodos)
  const cenarioConservadorTotal = Math.max(0, faixaFinalConservadora)
  const cenarioMedioTotal = Math.max(0, faixaFinalMedia)
  const cenarioOtimistaTotal = Math.max(0, faixaFinalOtimista)

  const faixaEstimada = `${formatCurrency(cenarioConservadorTotal)} a ${formatCurrency(
    cenarioOtimistaTotal,
  )}`

  // Indicadores de Apoio
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
    dcf,
    valorSubstantivo,
    composicaoMultimetodos,
    matrizSensibilidade,
    serieHistorica,
    decomposicaoDespesas,
    qualidadeReceita,
    capitalGiro,
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
      valorFcd: dados.resultado.dcf.valorPatrimonialFcd,
      valorSubstantivo: dados.resultado.valorSubstantivo.valorSubstantivoAjustado,
      pesosComposicao: dados.resultado.composicaoMultimetodos.pesosConfig,
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
 * Abas:
 * 1. Resumo & Parâmetros
 * 2. Composição Multimétodos
 * 3. Série Histórica
 * 4. FCD (DCF 5 Anos)
 * 5. Sensibilidade (WACC × g)
 * 6. Qualidade & Concentração
 * 7. Decomposição Despesas
 * 8. Capital de Giro & Balanço
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

  // 1. ABA: RESUMO & HIPÓTESES
  const aoaParametros: unknown[][] = [
    ['AEROCAD CONSULTORIA & AEROPORTOS — RELATÓRIO ECONÔMICO DE VALUATION'],
    [`Empresa: ${valuation.empresa.razaoSocial} | CNPJ: ${valuation.empresa.cnpj}`],
    [`Emissão: ${dataEmissao} às ${horaEmissao} | Responsável: ${usuarioNome}`],
    [],
    ['QUADRO FINAL CONSOLIDADO', 'VALOR ESTIMADO (R$)', 'DESCRIÇÃO'],
    [
      'Cenário Conservador',
      valFormat(valuation.resultadoFinal.cenarioConservadorTotal),
      'Piso ponderado de segurança',
    ],
    [
      'Cenário Central / Médio (Referência)',
      valFormat(valuation.resultadoFinal.cenarioMedioTotal),
      'Valor justo central AEROCAD',
    ],
    [
      'Cenário Otimista',
      valFormat(valuation.resultadoFinal.cenarioOtimistaTotal),
      'Expansão de mercado aeroportuário',
    ],
    [
      'Faixa Estimada Combinada',
      valuation.resultadoFinal.faixaEstimada,
      'Faixa de negociação sugerida',
    ],
    [],
    ['HIPÓTESES DOS MÉTODOS', 'VALOR / PESO', 'DESCRIÇÃO'],
    [
      'Peso Fluxo de Caixa Descontado (FCD)',
      `${(valuation.composicaoMultimetodos.pesosConfig.pesoDcf * 100).toFixed(0)}%`,
      'Peso na composição final',
    ],
    [
      'Peso Múltiplos sobre EBITDA',
      `${(valuation.composicaoMultimetodos.pesosConfig.pesoMultiplosEbitda * 100).toFixed(0)}%`,
      'Peso na composição final',
    ],
    [
      'Peso Múltiplos sobre Receita',
      `${(valuation.composicaoMultimetodos.pesosConfig.pesoMultiplosReceita * 100).toFixed(0)}%`,
      'Peso na composição final',
    ],
    [
      'Peso Valor Substantivo (Ativo Ajustado)',
      `${(valuation.composicaoMultimetodos.pesosConfig.pesoValorSubstantivo * 100).toFixed(0)}%`,
      'Peso na composição final',
    ],
    [
      'Taxa de Desconto WACC (FCD)',
      `${(valuation.dcf.parametros.wacc * 100).toFixed(1)}% a.a.`,
      'Custo médio ponderado de capital',
    ],
    [
      'Taxa de Crescimento Perpétuo g (FCD)',
      `${(valuation.dcf.parametros.crescimentoPerpetuo * 100).toFixed(1)}% a.a.`,
      'Crescimento na perpetuidade',
    ],
    [
      'Múltiplo EBITDA (Médio)',
      `${valuation.multiplosUsados.ebitdaMedio}x`,
      'Múltiplo central s/ geração de caixa',
    ],
    [
      'Múltiplo Receita (Médio)',
      `${valuation.multiplosUsados.receitaMedio}x`,
      'Múltiplo central s/ faturamento líquido',
    ],
    [],
    ['CONFIABILIDADE DOS DADOS CONTÁBEIS'],
    [
      'Índice de Confiabilidade',
      `${valuation.confiabilidade.percentualConfiabilidade}%`,
      'Classificação técnica',
    ],
    ['Nível', valuation.confiabilidade.nivel.toUpperCase(), 'Classificação contábil'],
    [
      'Balancetes Arquivados',
      `${valuation.confiabilidade.totalBalancetesArquivados} meses`,
      'Competências com fechamento formal',
    ],
    [
      'Lançamentos sem Plano de Contas',
      `${valuation.confiabilidade.transacoesSemClassificacao}`,
      'Pendências de conciliação',
    ],
  ]

  // 2. ABA: COMPOSIÇÃO MULTIMÉTODOS
  const aoaComposicao: unknown[][] = [
    ['COMPOSIÇÃO PONDERADA MULTIMÉTODOS — VALUATION AEROCAD'],
    [`Exercício de Referência: ${valuation.anoExercicio}`],
    [],
    [
      'MÉTODO DE AVALIAÇÃO',
      'PESO (%)',
      'CONSERVADOR (R$)',
      'MÉDIO / BASE (R$)',
      'OTIMISTA (R$)',
      'CONTRIBUIÇÃO PONDERADA (R$)',
    ],
  ]
  for (const m of valuation.composicaoMultimetodos.metodos) {
    aoaComposicao.push([
      m.nome,
      `${(m.peso * 100).toFixed(1)}%`,
      valFormat(m.valorConservador),
      valFormat(m.valorMedio),
      valFormat(m.valorOtimista),
      valFormat(m.valorPonderadoContribuicao),
    ])
  }
  aoaComposicao.push([])
  aoaComposicao.push([
    'VALOR TOTAL CONSOLIDADO PONDERADO',
    '100.0%',
    valFormat(valuation.composicaoMultimetodos.faixaFinalConservadora),
    valFormat(valuation.composicaoMultimetodos.faixaFinalMedia),
    valFormat(valuation.composicaoMultimetodos.faixaFinalOtimista),
    valFormat(valuation.composicaoMultimetodos.faixaFinalMedia),
  ])

  // 3. ABA: SÉRIE HISTÓRICA MULTIANUAL
  const aoaSérie: unknown[][] = [
    ['SÉRIE HISTÓRICA MULTIANUAL — DEMONSTRATIVO DE RENTABILIDADE (DRE)'],
    [`Evolução por competência e exercício anual`],
    [],
    [
      'EXERCÍCIO',
      'RECEITA BRUTA (R$)',
      'VAR. REC. %',
      'TRIBUTOS (R$)',
      'RECEITA LÍQUIDA (R$)',
      'CUSTOS DIRETOS (R$)',
      'MARGEM CONTR. (R$)',
      'DESPESAS FIXAS (R$)',
      'EBITDA (R$)',
      'VAR. EBITDA %',
      'MARGEM EBITDA %',
      'LUCRO LÍQUIDO (R$)',
      'MARGEM LÍQUIDA %',
    ],
  ]
  for (const s of valuation.serieHistorica) {
    aoaSérie.push([
      `Ano ${s.ano}`,
      valFormat(s.receitaBruta),
      s.variacaoReceitaPercentual !== null
        ? `${s.variacaoReceitaPercentual > 0 ? '+' : ''}${s.variacaoReceitaPercentual.toFixed(1)}%`
        : '—',
      valFormat(-s.tributos),
      valFormat(s.receitaLiquida),
      valFormat(-s.custosDiretos),
      valFormat(s.margemContribuicao),
      valFormat(-s.despesasFixas),
      valFormat(s.ebitda),
      s.variacaoEbitdaPercentual !== null
        ? `${s.variacaoEbitdaPercentual > 0 ? '+' : ''}${s.variacaoEbitdaPercentual.toFixed(1)}%`
        : '—',
      `${s.margemEbitda.toFixed(1)}%`,
      valFormat(s.lucroLiquido),
      `${s.margemLiquida.toFixed(1)}%`,
    ])
  }

  // 4. ABA: FCD (DCF 5 ANOS)
  const aoaDcf: unknown[][] = [
    ['FLUXO DE CAIXA DESCONTADO (FCD / DCF) — PROJEÇÃO DE 5 ANOS + PERPETUIDADE'],
    [
      `WACC: ${(valuation.dcf.parametros.wacc * 100).toFixed(1)}% a.a. | Crescimento Perpétuo g: ${(valuation.dcf.parametros.crescimentoPerpetuo * 100).toFixed(1)}% a.a.`,
    ],
    [],
    [
      'ANO',
      'CRESC. %',
      'RECEITA LÍQUIDA (R$)',
      'EBITDA (R$)',
      'EBIT (R$)',
      '(-) IMPOSTOS (R$)',
      '(-) CAPEX/GIRO (R$)',
      'FLUXO LIVRE FCL (R$)',
      'FATOR DESC.',
      'VPL PRESENTE (R$)',
    ],
  ]
  for (const p of valuation.dcf.projecoesAnuais) {
    aoaDcf.push([
      `Ano ${p.anoNumero} (${p.ano})`,
      `${(p.taxaCrescimento * 100).toFixed(1)}%`,
      valFormat(p.receitaLiquida),
      valFormat(p.ebitda),
      valFormat(p.ebit),
      valFormat(-p.impostos),
      valFormat(-p.reinvestimentoCapexGiro),
      valFormat(p.fluxoCaixaLivre),
      p.fatorDesconto.toFixed(4),
      valFormat(p.fluxoPresente),
    ])
  }
  aoaDcf.push([])
  aoaDcf.push([
    'Soma dos Fluxos Explícitos (VPL Anos 1 a 5)',
    valFormat(valuation.dcf.somaVplFluxosExplicitos),
  ])
  aoaDcf.push([
    'Fluxo no Ano Terminal (Ano 5 * (1 + g))',
    valFormat(valuation.dcf.fluxoAnoTerminal),
  ])
  aoaDcf.push(['Valor da Perpetuidade Nominal', valFormat(valuation.dcf.valorPerpetuidadeNominal)])
  aoaDcf.push([
    'Valor da Perpetuidade a Valor Presente',
    valFormat(valuation.dcf.valorPerpetuidadePresente),
  ])
  aoaDcf.push([
    'Valor da Empresa (Enterprise Value - EV)',
    valFormat(valuation.dcf.valorEmpresaFcdTotal),
  ])
  aoaDcf.push([
    '(+) Disponibilidades Bancárias - Dívidas (Caixa Líquido)',
    valFormat(valuation.dcf.caixaLiquido),
  ])
  aoaDcf.push([
    'VALOR PATRIMONIAL FCD (EQUITY VALUE)',
    valFormat(valuation.dcf.valorPatrimonialFcd),
  ])

  // 5. ABA: MATRIZ DE SENSIBILIDADE
  const cabecalhoSensibilidade = ['Taxa WACC \\ Crescimento g']
  for (const c of valuation.matrizSensibilidade[0]) {
    cabecalhoSensibilidade.push(`g = ${(c.crescimentoPerpetuo * 100).toFixed(1)}% (${c.deltaG})`)
  }
  const aoaSensibilidade: unknown[][] = [
    ['MATRIZ DE SENSIBILIDADE — VALOR PATRIMONIAL FCD (R$)'],
    ['Variação cruzada da Taxa de Desconto (WACC) e Taxa de Crescimento na Perpetuidade (g)'],
    [],
    cabecalhoSensibilidade,
  ]
  for (const linha of valuation.matrizSensibilidade) {
    const row = [`WACC = ${(linha[0].wacc * 100).toFixed(1)}% (${linha[0].deltaWacc})`]
    for (const cel of linha) {
      row.push(valFormat(cel.valorFcd) as string)
    }
    aoaSensibilidade.push(row)
  }

  // 6. ABA: QUALIDADE E CONCENTRAÇÃO DA RECEITA
  const aoaConcentracao: unknown[][] = [
    ['QUALIDADE DA RECEITA & CONCENTRAÇÃO POR CLIENTE'],
    [
      `Exercício: ${valuation.anoExercicio} | Total de Clientes Ativos: ${valuation.qualidadeReceita.totalClientesAtivos}`,
    ],
    [],
    ['INDICADOR DE CONCENTRAÇÃO', 'VALOR / PERCENTUAL', 'CLASSIFICAÇÃO'],
    [
      'Faturamento Top 1 Maior Cliente',
      `${formatCurrency(valuation.qualidadeReceita.faturamentoTop1)} (${valuation.qualidadeReceita.percentualTop1.toFixed(1)}%)`,
      'Concentração individual',
    ],
    [
      'Faturamento Top 3 Maiores Clientes',
      `${formatCurrency(valuation.qualidadeReceita.faturamentoTop3)} (${valuation.qualidadeReceita.percentualTop3.toFixed(1)}%)`,
      'Concentração agrupada',
    ],
    [
      'Faturamento Top 5 Maiores Clientes',
      `${formatCurrency(valuation.qualidadeReceita.faturamentoTop5)} (${valuation.qualidadeReceita.percentualTop5.toFixed(1)}%)`,
      'Concentração agrupada',
    ],
    [
      'Índice HHI (Herfindahl-Hirschman)',
      `${valuation.qualidadeReceita.indiceHHI} pontos`,
      `Risco ${valuation.qualidadeReceita.classificacaoRiscoConcentracao.toUpperCase()}`,
    ],
    [],
    [
      'RANKING DOS MAIORES CLIENTES',
      'FATURAMENTO NO EXERCÍCIO (R$)',
      'PARTICIPAÇÃO %',
      'QTD PROJETOS / MEDIÇÕES',
    ],
  ]
  for (const c of valuation.qualidadeReceita.topClientes) {
    aoaConcentracao.push([
      `#${c.posicao} ${c.clienteNome}`,
      valFormat(c.totalFaturado),
      `${c.percentualSobreReceita.toFixed(1)}%`,
      c.quantidadeProjetosOuParcelas,
    ])
  }

  // 7. ABA: DECOMPOSIÇÃO DE DESPESAS
  const aoaDespesas: unknown[][] = [
    ['DECOMPOSIÇÃO DE DESPESAS POR GRUPO CONTÁBIL E PLANO DE CONTAS'],
    [`Exercício: ${valuation.anoExercicio}`],
    [],
    [
      'GRUPO / CONTA CONTÁBIL',
      'VALOR TOTAL (R$)',
      'PARTICIPAÇÃO S/ DESPESAS %',
      'PARTICIPAÇÃO S/ RECEITA %',
    ],
  ]
  for (const g of valuation.decomposicaoDespesas) {
    aoaDespesas.push([
      `[GRUPO] ${g.nomeGrupo}`,
      valFormat(g.valorTotal),
      `${g.percentualSobreTotal.toFixed(1)}%`,
      `${g.percentualSobreReceita.toFixed(1)}%`,
    ])
    for (const c of g.contas) {
      aoaDespesas.push([
        `   • ${c.codigo} - ${c.nome}`,
        valFormat(c.valor),
        `${c.percentual.toFixed(1)}%`,
        '—',
      ])
    }
  }

  // 8. ABA: CAPITAL DE GIRO & PATRIMÔNIO
  const aoaCapitalGiro: unknown[][] = [
    ['CAPITAL DE GIRO, LIQUIDEZ E BALANÇO CONTÁBIL'],
    [`Balanço gerencial de ${dataEmissao}`],
    [],
    ['INDICADOR / CONTA', 'VALOR (R$)', 'CLASSIFICAÇÃO'],
    [
      'Disponibilidades Bancárias PJ',
      valFormat(valuation.capitalGiro.disponibilidades),
      'Ativo Circulante',
    ],
    [
      'Contas e Parcelas a Receber',
      valFormat(valuation.capitalGiro.contasReceberTotal),
      'Ativo Circulante',
    ],
    [
      'Passivo Circulante (Contas a Pagar)',
      valFormat(valuation.capitalGiro.contasPagarTotal),
      'Passivo Circulante',
    ],
    [
      'Capital de Giro Líquido (Ativo Circ - Pass Circ)',
      valFormat(valuation.capitalGiro.capitalGiroLiquido),
      'Folga de Liquidez',
    ],
    [
      'Necessidade de Capital de Giro (NCG)',
      valFormat(valuation.capitalGiro.necessidadeCapitalGiro),
      'Rec. Operacionais - Pag. Operacionais',
    ],
    [
      'Prazo Médio de Recebimento (PMR)',
      `${valuation.capitalGiro.prazoMedioRecebimentoDias} dias`,
      'Eficiência de Cobrança',
    ],
    [
      'Prazo Médio de Pagamento (PMP)',
      `${valuation.capitalGiro.prazoMedioPagamentoDias} dias`,
      'Prazo Médio com Fornecedores',
    ],
    [
      'Ciclo Operacional Líquido',
      `${valuation.capitalGiro.cicloOperacionalDias} dias`,
      'PMR - PMP',
    ],
    [
      'Índice de Liquidez Corrente',
      `${valuation.capitalGiro.liquidezCorrente.toFixed(2)}x`,
      'Ativo Circulante / Passivo Circulante',
    ],
    [],
    ['VALOR SUBSTANTIVO (ATIVO AJUSTADO)'],
    [
      'Patrimônio Líquido Contábil (PL)',
      valFormat(valuation.valorSubstantivo.patrimonioLiquidoContabil),
      'Contábil',
    ],
    [
      '(+) Ativos Intangíveis Subjetivos (Goodwill, Acervo, ANAC)',
      valFormat(valuation.valorSubstantivo.ajustesAtivoSubjetivo),
      'Ativo Intangível',
    ],
    [
      '(-) Passivos Contingentes / Riscos',
      valFormat(-valuation.valorSubstantivo.passivosContingentesDeducoes),
      'Passivo Contingente',
    ],
    [
      '(=) Valor Substantivo Ajustado Final',
      valFormat(valuation.valorSubstantivo.valorSubstantivoAjustado),
      'Base Patrimonial Ajustada',
    ],
  ]

  const workbook = xlsx.utils.book_new()

  const wsParametros = xlsx.utils.aoa_to_sheet(aoaParametros)
  wsParametros['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 45 }]
  xlsx.utils.book_append_sheet(workbook, wsParametros, 'Resumo & Hipóteses')

  const wsComposicao = xlsx.utils.aoa_to_sheet(aoaComposicao)
  wsComposicao['!cols'] = [
    { wch: 42 },
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 25 },
  ]
  xlsx.utils.book_append_sheet(workbook, wsComposicao, 'Composição')

  const wsSerie = xlsx.utils.aoa_to_sheet(aoaSérie)
  wsSerie['!cols'] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
  ]
  xlsx.utils.book_append_sheet(workbook, wsSerie, 'Série Histórica')

  const wsDcf = xlsx.utils.aoa_to_sheet(aoaDcf)
  wsDcf['!cols'] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 14 },
    { wch: 20 },
  ]
  xlsx.utils.book_append_sheet(workbook, wsDcf, 'FCD (DCF)')

  const wsSensibilidade = xlsx.utils.aoa_to_sheet(aoaSensibilidade)
  wsSensibilidade['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
  xlsx.utils.book_append_sheet(workbook, wsSensibilidade, 'Sensibilidade')

  const wsConcentracao = xlsx.utils.aoa_to_sheet(aoaConcentracao)
  wsConcentracao['!cols'] = [{ wch: 38 }, { wch: 24 }, { wch: 16 }, { wch: 22 }]
  xlsx.utils.book_append_sheet(workbook, wsConcentracao, 'Concentração')

  const wsDespesas = xlsx.utils.aoa_to_sheet(aoaDespesas)
  wsDespesas['!cols'] = [{ wch: 48 }, { wch: 20 }, { wch: 24 }, { wch: 24 }]
  xlsx.utils.book_append_sheet(workbook, wsDespesas, 'Despesas')

  const wsCapitalGiro = xlsx.utils.aoa_to_sheet(aoaCapitalGiro)
  wsCapitalGiro['!cols'] = [{ wch: 45 }, { wch: 22 }, { wch: 30 }]
  xlsx.utils.book_append_sheet(workbook, wsCapitalGiro, 'Capital de Giro')

  const filename = `valuation_aerocad_avancado_${valuation.anoExercicio}_${new Date()
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
