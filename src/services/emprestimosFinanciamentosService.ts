/**
 * Módulo de Empréstimos e Financiamentos da AEROCAD Consultoria
 * Implementação das 3 etapas contábeis com partidas dobradas:
 * 1. Reconhecimento Inicial (Contratação)
 * 2. Apropriação Mensal dos Juros (Regime de Competência)
 * 3. Pagamento da Parcela Mensal (Amortização do Principal e Baixa Bancária)
 * Reclassificação Periódica Passivo Não Circulante -> Circulante
 */

import pb from '@/lib/pocketbase/client'
import type {
  EmprestimoFinanciamentoRecord,
  EmprestimoParcelaRecord,
  TipoEmprestimoFinanciamento,
  MetodoAmortizacao,
} from '@/types/crm'

export interface DadosContratacaoEmprestimo {
  numero_contrato: string
  descricao: string
  tipo: TipoEmprestimoFinanciamento
  metodo_amortizacao: MetodoAmortizacao
  credor_id?: string
  banco_nome: string
  data_contratacao: string // YYYY-MM-DD
  valor_total_divida: number // Principal financiado + total de juros
  valor_liquido_liberado: number // Valor que entra na conta bancária (ou valor financiado do bem)
  total_juros_prefixados: number // Encargos a apropriar
  taxa_juros_mensal: number // % a.m.
  taxa_juros_anual?: number
  quantidade_parcelas: number
  valor_parcela: number
  data_primeira_parcela: string // YYYY-MM-DD
  conta_bancaria_debito?: string
  // Financiamento de veículo / aquisição de bem
  bem_adquirido_descricao?: string
  valor_total_bem?: number
  valor_entrada?: number
  ativo_patrimonio_vinculado?: string
  observacoes?: string
}

export interface SimulacaoParcela {
  numero_parcela: number
  competencia: string // YYYY-MM
  data_vencimento: string // YYYY-MM-DD
  valor_parcela: number
  valor_principal: number
  valor_juros: number
  saldo_devedor_restante: number
  classificacao_passivo: 'circulante' | 'nao_circulante'
}

/**
 * Utilitário para adicionar meses a uma data YYYY-MM-DD mantendo o mesmo dia ou último do mês
 */
export function adicionarMesesAData(dataIso: string, meses: number): string {
  const parts = dataIso.slice(0, 10).split('-')
  const ano = parseInt(parts[0], 10)
  const mes = parseInt(parts[1], 10) - 1
  const dia = parseInt(parts[2], 10)

  const targetDate = new Date(ano, mes + meses, dia)
  // Ajuste se o dia estourou o mês (ex: 31 de janeiro -> 28/29 de fevereiro)
  if (targetDate.getDate() !== dia) {
    targetDate.setDate(0)
  }

  const y = targetDate.getFullYear()
  const m = String(targetDate.getMonth() + 1).padStart(2, '0')
  const d = String(targetDate.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function obterCompetenciaMes(dataIso: string): string {
  return dataIso.slice(0, 7)
}

/**
 * Calcula a diferença em meses entre a data de referência (hoje ou contratação) e o vencimento
 */
export function calcularMesesAteVencimento(dataBaseIso: string, dataVencIso: string): number {
  const pBase = dataBaseIso.slice(0, 10).split('-').map(Number)
  const pVenc = dataVencIso.slice(0, 10).split('-').map(Number)
  return (pVenc[0] - pBase[0]) * 12 + (pVenc[1] - pBase[1])
}

/**
 * Gera o cronograma de parcelas (Simulação SAC, PRICE ou PREFIXADO_MANUAL)
 */
export function gerarCronogramaParcelas({
  valorPrincipal,
  totalJurosPrefixados,
  quantidadeParcelas,
  taxaJurosMensal,
  dataPrimeiraParcela,
  metodoAmortizacao,
  dataBaseContratacao,
}: {
  valorPrincipal: number
  totalJurosPrefixados: number
  quantidadeParcelas: number
  taxaJurosMensal: number
  dataPrimeiraParcela: string
  metodoAmortizacao: MetodoAmortizacao
  dataBaseContratacao?: string
}): SimulacaoParcela[] {
  const parcelas: SimulacaoParcela[] = []
  const n = Math.max(1, quantidadeParcelas)
  const baseData = dataBaseContratacao || new Date().toISOString().slice(0, 10)

  let saldoDevedor = valorPrincipal

  if (metodoAmortizacao === 'SAC') {
    // Sistema de Amortização Constante
    const amortizacaoConstante = Math.round((valorPrincipal / n) * 100) / 100
    const i = (taxaJurosMensal || 0) / 100

    for (let k = 1; k <= n; k++) {
      const venc = adicionarMesesAData(dataPrimeiraParcela, k - 1)
      const competencia = obterCompetenciaMes(venc)
      const mesesAteVenc = calcularMesesAteVencimento(baseData, venc)
      const classificacao: 'circulante' | 'nao_circulante' =
        mesesAteVenc <= 12 ? 'circulante' : 'nao_circulante'

      const jurosParcela = Math.round(saldoDevedor * i * 100) / 100
      let amort = amortizacaoConstante
      if (k === n) {
        amort = Math.round(saldoDevedor * 100) / 100
      }
      const valorTotal = Math.round((amort + jurosParcela) * 100) / 100
      saldoDevedor = Math.max(0, Math.round((saldoDevedor - amort) * 100) / 100)

      parcelas.push({
        numero_parcela: k,
        competencia,
        data_vencimento: venc,
        valor_parcela: valorTotal,
        valor_principal: amort,
        valor_juros: jurosParcela,
        saldo_devedor_restante: saldoDevedor,
        classificacao_passivo: classificacao,
      })
    }
  } else if (metodoAmortizacao === 'PRICE') {
    // Tabela Price (Parcelas Iguais)
    const i = (taxaJurosMensal || 0) / 100
    let pmt: number
    if (i > 0) {
      pmt =
        Math.round(((valorPrincipal * (i * Math.pow(1 + i, n))) / (Math.pow(1 + i, n) - 1)) * 100) /
        100
    } else {
      pmt = Math.round((valorPrincipal / n) * 100) / 100
    }

    for (let k = 1; k <= n; k++) {
      const venc = adicionarMesesAData(dataPrimeiraParcela, k - 1)
      const competencia = obterCompetenciaMes(venc)
      const mesesAteVenc = calcularMesesAteVencimento(baseData, venc)
      const classificacao: 'circulante' | 'nao_circulante' =
        mesesAteVenc <= 12 ? 'circulante' : 'nao_circulante'

      const jurosParcela = Math.round(saldoDevedor * i * 100) / 100
      let amort = Math.round((pmt - jurosParcela) * 100) / 100
      if (k === n || amort > saldoDevedor) {
        amort = Math.round(saldoDevedor * 100) / 100
      }
      const valorTotal = Math.round((amort + jurosParcela) * 100) / 100
      saldoDevedor = Math.max(0, Math.round((saldoDevedor - amort) * 100) / 100)

      parcelas.push({
        numero_parcela: k,
        competencia,
        data_vencimento: venc,
        valor_parcela: valorTotal,
        valor_principal: amort,
        valor_juros: jurosParcela,
        saldo_devedor_restante: saldoDevedor,
        classificacao_passivo: classificacao,
      })
    }
  } else {
    // PREFIXADO_MANUAL: Decomposição proporcional uniforme a partir dos juros totais declarados
    const totalDivida = valorPrincipal + totalJurosPrefixados
    const valorParcelaUniforme = Math.round((totalDivida / n) * 100) / 100
    const principalPorParcela = Math.round((valorPrincipal / n) * 100) / 100
    const jurosPorParcela = Math.round((totalJurosPrefixados / n) * 100) / 100

    let acumPrincipal = 0
    let acumJuros = 0

    for (let k = 1; k <= n; k++) {
      const venc = adicionarMesesAData(dataPrimeiraParcela, k - 1)
      const competencia = obterCompetenciaMes(venc)
      const mesesAteVenc = calcularMesesAteVencimento(baseData, venc)
      const classificacao: 'circulante' | 'nao_circulante' =
        mesesAteVenc <= 12 ? 'circulante' : 'nao_circulante'

      let parcPrincipal = principalPorParcela
      let parcJuros = jurosPorParcela

      if (k === n) {
        parcPrincipal = Math.round((valorPrincipal - acumPrincipal) * 100) / 100
        parcJuros = Math.round((totalJurosPrefixados - acumJuros) * 100) / 100
      }

      acumPrincipal += parcPrincipal
      acumJuros += parcJuros

      const valorTotal = Math.round((parcPrincipal + parcJuros) * 100) / 100
      saldoDevedor = Math.max(0, Math.round((saldoDevedor - parcPrincipal) * 100) / 100)

      parcelas.push({
        numero_parcela: k,
        competencia,
        data_vencimento: venc,
        valor_parcela: valorTotal,
        valor_principal: parcPrincipal,
        valor_juros: parcJuros,
        saldo_devedor_restante: saldoDevedor,
        classificacao_passivo: classificacao,
      })
    }
  }

  return parcelas
}

/**
 * Registra atividade de auditoria do CRM
 */
export async function registrarAuditoriaFinanceira({
  tipoOperacao,
  descricao,
  detalhes,
  usuarioId,
}: {
  tipoOperacao: string
  descricao: string
  detalhes: Record<string, unknown>
  usuarioId?: string
}) {
  try {
    const currentUserId = usuarioId || pb.authStore.record?.id
    if (!currentUserId) return

    await pb.collection('auditoria_operacoes_bloco').create({
      usuario: currentUserId,
      tipo_operacao: tipoOperacao,
      colecao_alvo: 'emprestimos_financiamentos',
      descricao,
      criterio_filtro: { modulo: 'emprestimos_financiamentos' },
      alteracoes_solicitadas: detalhes,
      total_registros_afetados: 1,
      total_falhas: 0,
    })
  } catch (err) {
    console.warn('Aviso ao registrar auditoria em emprestimos_financiamentos:', err)
  }
}

/**
 * ETAPA 1: Reconhecimento Inicial (Contratação)
 * Salva o contrato, gera as parcelas e os lançamentos contábeis conforme partidas dobradas verbatim.
 */
export async function contratarOperacao(dados: DadosContratacaoEmprestimo): Promise<{
  contrato: EmprestimoFinanciamentoRecord
  parcelas: EmprestimoParcelaRecord[]
  lancamentosGerados: string[]
}> {
  const currentUserId = pb.authStore.record?.id
  const lancamentosGerados: string[] = []

  // 1. Gera cronograma de parcelas
  const cronograma = gerarCronogramaParcelas({
    valorPrincipal: dados.valor_liquido_liberado,
    totalJurosPrefixados: dados.total_juros_prefixados,
    quantidadeParcelas: dados.quantidade_parcelas,
    taxaJurosMensal: dados.taxa_juros_mensal,
    dataPrimeiraParcela: dados.data_primeira_parcela,
    metodoAmortizacao: dados.metodo_amortizacao,
    dataBaseContratacao: dados.data_contratacao,
  })

  // Segrega curto e longo prazo iniciais
  const parcelasCirculantes = cronograma.filter((p) => p.classificacao_passivo === 'circulante')
  const parcelasNaoCirculantes = cronograma.filter(
    (p) => p.classificacao_passivo === 'nao_circulante',
  )

  const saldoCirculanteInicial = parcelasCirculantes.reduce((acc, p) => acc + p.valor_principal, 0)
  const saldoNaoCirculanteInicial = parcelasNaoCirculantes.reduce(
    (acc, p) => acc + p.valor_principal,
    0,
  )

  // 2. Salva o registro principal do contrato
  const contratoData = {
    numero_contrato: dados.numero_contrato,
    descricao: dados.descricao,
    tipo: dados.tipo,
    metodo_amortizacao: dados.metodo_amortizacao,
    credor: dados.credor_id || null,
    banco_nome: dados.banco_nome,
    data_contratacao: `${dados.data_contratacao} 12:00:00.000Z`,
    valor_total_divida: dados.valor_total_divida,
    valor_liquido_liberado: dados.valor_liquido_liberado,
    total_juros_prefixados: dados.total_juros_prefixados,
    taxa_juros_mensal: dados.taxa_juros_mensal,
    taxa_juros_anual: dados.taxa_juros_anual || dados.taxa_juros_mensal * 12,
    quantidade_parcelas: dados.quantidade_parcelas,
    valor_parcela: dados.valor_parcela,
    data_primeira_parcela: `${dados.data_primeira_parcela} 12:00:00.000Z`,
    conta_bancaria_debito: dados.conta_bancaria_debito || null,
    bem_adquirido_descricao: dados.bem_adquirido_descricao || null,
    valor_total_bem: dados.valor_total_bem || 0,
    valor_entrada: dados.valor_entrada || 0,
    ativo_patrimonio_vinculado: dados.ativo_patrimonio_vinculado || null,
    saldo_devedor_atual: dados.valor_liquido_liberado,
    saldo_juros_a_apropriar: dados.total_juros_prefixados,
    saldo_circulante: saldoCirculanteInicial,
    saldo_nao_circulante: saldoNaoCirculanteInicial,
    total_amortizado: 0,
    total_juros_pagos: 0,
    total_juros_apropriados: 0,
    status: 'ativo' as const,
    observacoes: dados.observacoes || '',
    criado_por: currentUserId || null,
  }

  const contratoCriado = await pb
    .collection('emprestimos_financiamentos')
    .create<EmprestimoFinanciamentoRecord>(contratoData)

  // 3. Salva cada parcela na collection emprestimos_parcelas
  const parcelasCriadas: EmprestimoParcelaRecord[] = []
  for (const item of cronograma) {
    const pRecord = await pb.collection('emprestimos_parcelas').create<EmprestimoParcelaRecord>({
      contrato: contratoCriado.id,
      numero_parcela: item.numero_parcela,
      competencia: item.competencia,
      data_vencimento: `${item.data_vencimento} 12:00:00.000Z`,
      valor_parcela: item.valor_parcela,
      valor_principal: item.valor_principal,
      valor_juros: item.valor_juros,
      saldo_devedor_restante: item.saldo_devedor_restante,
      classificacao_passivo: item.classificacao_passivo,
      status: 'pendente' as const,
      juros_apropriados: false,
      conta_bancaria: dados.conta_bancaria_debito || null,
      observacoes: `Parcela ${item.numero_parcela}/${dados.quantidade_parcelas} - Contrato ${dados.numero_contrato}`,
    })
    parcelasCriadas.push(pRecord)
  }

  // 4. Gera os lançamentos contábeis da ETAPA 1
  const fornecedorNome = dados.banco_nome || 'Instituição Financeira Credora'
  const dataContratacaoIso = `${dados.data_contratacao} 12:00:00.000Z`

  if (dados.tipo === 'emprestimo_bancario') {
    // Empréstimo bancário (dinheiro em conta):
    // D - Bancos Conta Movimento (1.1.1) - Valor líquido recebido (Cria entrada em contas_receber ou extratos_transacoes para refletir o saldo)
    // D - Encargos Financeiros a Apropriar (2.1.8 redutora do passivo)
    // C - Empréstimos a Pagar (2.1.6 e 2.2.1)
    if (dados.conta_bancaria_debito && dados.valor_liquido_liberado > 0) {
      await pb.collection('contas_receber').create({
        descricao: `Liberação de Recurso - Empréstimo Bancário Contrato ${dados.numero_contrato} (${dados.banco_nome})`,
        cliente_nome: fornecedorNome,
        categoria: 'outros',
        valor: dados.valor_liquido_liberado,
        valor_recebido: dados.valor_liquido_liberado,
        data_vencimento: dataContratacaoIso,
        data_recebimento: dataContratacaoIso,
        status: 'recebido',
        forma_recebimento: 'ted',
        numero_documento: `EMP-LIB-${dados.numero_contrato}`,
        conta_bancaria: dados.conta_bancaria_debito,
        plano_contas_codigo: '1.1.1',
        plano_contas_nome: 'Disponibilidades (Bancos Conta Movimento PJ)',
        classificacao_manual: true,
        observacoes: `[ETAPA 1 - RECONHECIMENTO INICIAL] D — Bancos Conta Movimento (Ativo Circulante): R$ ${dados.valor_liquido_liberado.toFixed(2)}. Contrato de Empréstimo nº ${dados.numero_contrato}.`,
        criado_por: currentUserId,
      })
      lancamentosGerados.push(
        `D — Bancos Conta Movimento (1.1.1): R$ ${dados.valor_liquido_liberado.toFixed(2)}`,
      )
    }

    lancamentosGerados.push(
      `D — Encargos Financeiros a Apropriar (2.1.8/2.2.3): R$ ${dados.total_juros_prefixados.toFixed(2)}`,
    )
    lancamentosGerados.push(
      `C — Empréstimos a Pagar Circulante (2.1.6): R$ ${saldoCirculanteInicial.toFixed(2)}`,
    )
    if (saldoNaoCirculanteInicial > 0) {
      lancamentosGerados.push(
        `C — Empréstimos a Pagar Não Circulante (2.2.1): R$ ${saldoNaoCirculanteInicial.toFixed(2)}`,
      )
    }
  } else if (dados.tipo === 'financiamento_veiculo') {
    // Financiamento de veículo (aquisição de bem):
    // D - Veículos (Ativo Imobilizado - 1.2.4) - Valor total de aquisição do bem
    // D - Encargos Financeiros a Apropriar (2.1.8/2.2.3) - Total de juros do contrato
    // C - Bancos Conta Movimento (1.1.1) - Valor da entrada (se houver)
    // C - Financiamentos a Pagar (2.1.7 / 2.2.2) - Valor financiado + juros

    // Se houver valor de entrada e conta bancária, lança saída correspondente no banco
    if (dados.valor_entrada && dados.valor_entrada > 0 && dados.conta_bancaria_debito) {
      await pb.collection('contas_pagar').create({
        descricao: `Pagamento de Entrada - Financiamento ${dados.bem_adquirido_descricao || 'Veículo Operacional'} - Contrato ${dados.numero_contrato}`,
        fornecedor: fornecedorNome,
        categoria: 'equipamentos',
        valor: dados.valor_entrada,
        data_vencimento: dataContratacaoIso,
        data_pagamento: dataContratacaoIso,
        status: 'pago',
        forma_pagamento: 'pix',
        numero_documento: `FIN-ENTRADA-${dados.numero_contrato}`,
        conta_bancaria: dados.conta_bancaria_debito,
        plano_contas_codigo: '1.2.4',
        plano_contas_nome: 'Veículos e Frotas Operacionais de Campo',
        classificacao_manual: true,
        observacoes: `[ETAPA 1 - FINANCIAMENTO] C — Bancos Conta Movimento / D — Veículos (Entrada paga): R$ ${dados.valor_entrada.toFixed(2)}.`,
        criado_por: currentUserId,
      })
      lancamentosGerados.push(
        `C — Bancos Conta Movimento (1.1.1 - Entrada): R$ ${dados.valor_entrada.toFixed(2)}`,
      )
    }

    const valorBem =
      dados.valor_total_bem || dados.valor_liquido_liberado + (dados.valor_entrada || 0)
    lancamentosGerados.push(`D — Veículos (Ativo Imobilizado - 1.2.4): R$ ${valorBem.toFixed(2)}`)
    lancamentosGerados.push(
      `D — Encargos Financeiros a Apropriar (2.1.8/2.2.3): R$ ${dados.total_juros_prefixados.toFixed(2)}`,
    )
    lancamentosGerados.push(
      `C — Financiamentos a Pagar Circulante (2.1.7): R$ ${saldoCirculanteInicial.toFixed(2)}`,
    )
    if (saldoNaoCirculanteInicial > 0) {
      lancamentosGerados.push(
        `C — Financiamentos a Pagar Não Circulante (2.2.2): R$ ${saldoNaoCirculanteInicial.toFixed(2)}`,
      )
    }
  }

  // 5. Registra auditoria
  await registrarAuditoriaFinanceira({
    tipoOperacao: 'contratacao_emprestimo_financiamento',
    descricao: `Contratação de ${dados.tipo === 'emprestimo_bancario' ? 'Empréstimo Bancário' : 'Financiamento'} Contrato nº ${dados.numero_contrato} - ${dados.banco_nome}. Dívida total: R$ ${dados.valor_total_divida.toFixed(2)}.`,
    detalhes: {
      contratoId: contratoCriado.id,
      numero_contrato: dados.numero_contrato,
      valor_total_divida: dados.valor_total_divida,
      valor_liquido_liberado: dados.valor_liquido_liberado,
      total_juros_prefixados: dados.total_juros_prefixados,
      quantidade_parcelas: dados.quantidade_parcelas,
      lancamentosGerados,
    },
    usuarioId: currentUserId,
  })

  return {
    contrato: contratoCriado,
    parcelas: parcelasCriadas,
    lancamentosGerados,
  }
}

/**
 * ETAPA 2: Apropriação Mensal dos Juros (Regime de Competência)
 * D - Despesas com Juros (3.5.2 - Resultado/DRE)
 * C - Encargos Financeiros a Apropriar (2.1.8/2.2.3 - Passivo)
 * Idempotente: não apropria mais de uma vez a mesma competência/parcela.
 */
export async function apropriarJurosCompetencia({
  contratoId,
  competencia,
  parcelaId,
}: {
  contratoId?: string
  competencia?: string // YYYY-MM
  parcelaId?: string
}): Promise<{
  totalApropriado: number
  parcelasAfetadas: number
  detalhes: string[]
}> {
  const currentUserId = pb.authStore.record?.id
  const detalhes: string[] = []

  // Busca parcelas que atendem ao critério e ainda NÃO foram apropriadas
  let filter = 'juros_apropriados = false && valor_juros > 0'
  if (contratoId) filter += ` && contrato = '${contratoId}'`
  if (competencia) filter += ` && competencia = '${competencia}'`
  if (parcelaId) filter += ` && id = '${parcelaId}'`

  const parcelasPendentes = await pb
    .collection('emprestimos_parcelas')
    .getFullList<EmprestimoParcelaRecord>({
      filter,
      expand: 'contrato',
    })

  if (parcelasPendentes.length === 0) {
    return {
      totalApropriado: 0,
      parcelasAfetadas: 0,
      detalhes: ['Nenhum juro pendente de apropriação encontrado para o critério informado.'],
    }
  }

  let totalApropriado = 0
  const contratosAfetados = new Set<string>()

  for (const p of parcelasPendentes) {
    const contrato = p.expand?.contrato
    const contratoNome = contrato?.numero_contrato || 'S/N'
    const bancoNome = contrato?.banco_nome || 'Banco'
    const valorJuros = p.valor_juros || 0

    // Marca parcela como juros apropriados
    await pb.collection('emprestimos_parcelas').update(p.id, {
      juros_apropriados: true,
      data_apropriacao_juros: new Date().toISOString(),
    })

    // Gera o lançamento contábil em contas_pagar (categoria despesas financeiras / juros)
    // D - Despesas com Juros (3.5.2) / C - Encargos Financeiros a Apropriar (2.1.8)
    const dataRef = `${p.competencia}-28 12:00:00.000Z`
    await pb.collection('contas_pagar').create({
      descricao: `Apropriação de Juros Competência ${p.competencia} - Parcela ${p.numero_parcela} Contrato ${contratoNome} (${bancoNome})`,
      fornecedor: bancoNome,
      categoria: 'despesas_operacionais',
      valor: valorJuros,
      data_vencimento: dataRef,
      data_pagamento: dataRef,
      status: 'pago',
      forma_pagamento: 'outros',
      numero_documento: `APROP-JUROS-${contratoNome}-${p.numero_parcela}`,
      plano_contas_codigo: '3.5.2',
      plano_contas_nome: 'Despesas com Juros de Empréstimos e Financiamentos (Resultado / DRE)',
      classificacao_manual: true,
      observacoes: `[ETAPA 2 - REGIME DE COMPETÊNCIA] D — Despesas com Juros (Resultado/DRE 3.5.2): R$ ${valorJuros.toFixed(2)} / C — Encargos Financeiros a Apropriar (Passivo 2.1.8). Parcela ${p.numero_parcela} ref. ${p.competencia}.`,
      criado_por: currentUserId,
    })

    totalApropriado += valorJuros
    contratosAfetados.add(p.contrato)
    detalhes.push(
      `Contrato ${contratoNome} (Parc. ${p.numero_parcela} - Comp. ${p.competencia}): R$ ${valorJuros.toFixed(2)} apropriados`,
    )
  }

  // Atualiza saldo de juros a apropriar no contrato
  for (const cId of contratosAfetados) {
    try {
      const cRecord = await pb
        .collection('emprestimos_financiamentos')
        .getOne<EmprestimoFinanciamentoRecord>(cId)
      const todasParc = await pb
        .collection('emprestimos_parcelas')
        .getFullList<EmprestimoParcelaRecord>({
          filter: `contrato = '${cId}'`,
        })
      const apropriados = todasParc
        .filter((item) => item.juros_apropriados)
        .reduce((acc, item) => acc + (item.valor_juros || 0), 0)
      const saldoJurosRestante = Math.max(0, (cRecord.total_juros_prefixados || 0) - apropriados)

      await pb.collection('emprestimos_financiamentos').update(cId, {
        total_juros_apropriados: apropriados,
        saldo_juros_a_apropriar: saldoJurosRestante,
      })
    } catch (errC) {
      console.warn(`Erro ao atualizar saldo de juros no contrato ${cId}:`, errC)
    }
  }

  // Registra auditoria
  await registrarAuditoriaFinanceira({
    tipoOperacao: 'apropriacao_mensal_juros',
    descricao: `Apropriação mensal de juros por competência contábil: R$ ${totalApropriado.toFixed(2)} em ${parcelasPendentes.length} parcela(s).`,
    detalhes: {
      totalApropriado,
      quantidadeParcelas: parcelasPendentes.length,
      competencia: competencia || 'multiplas',
      detalhes,
    },
    usuarioId: currentUserId,
  })

  return {
    totalApropriado,
    parcelasAfetadas: parcelasPendentes.length,
    detalhes,
  }
}

/**
 * ETAPA 3: Pagamento da Parcela Mensal
 * D - Empréstimos/Financiamentos a Pagar (Passivo Circulante - 2.1.6 ou 2.1.7) - Valor do principal amortizado
 * C - Bancos Conta Movimento (Ativo Circulante - 1.1.1) - Valor total pago da parcela
 * Se os juros da parcela ainda não foram apropriados, apropria automaticamente conforme norma contábil
 * Gera/baixa lançamento no contas a pagar para conciliação com extrato bancário
 */
export async function pagarParcelaOperacao({
  parcelaId,
  dataPagamentoIso,
  valorPago,
  contaBancariaId,
  formaPagamento = 'debito_automatico',
}: {
  parcelaId: string
  dataPagamentoIso: string // YYYY-MM-DD
  valorPago?: number
  contaBancariaId?: string
  formaPagamento?: string
}): Promise<{
  parcelaAtualizada: EmprestimoParcelaRecord
  contaPagarGeradaId: string
  lancamentosGerados: string[]
}> {
  const currentUserId = pb.authStore.record?.id
  const lancamentosGerados: string[] = []

  const parcela = await pb
    .collection('emprestimos_parcelas')
    .getOne<EmprestimoParcelaRecord>(parcelaId, {
      expand: 'contrato',
    })
  const contrato = parcela.expand?.contrato
  if (!contrato) {
    throw new Error('Contrato de empréstimo não encontrado para esta parcela.')
  }

  const vPago = valorPago || parcela.valor_parcela
  const cBancaria = contaBancariaId || parcela.conta_bancaria || contrato.conta_bancaria_debito

  // 1. Se juros da parcela ainda não foram apropriados, apropria antes do pagamento
  if (!parcela.juros_apropriados && parcela.valor_juros > 0) {
    await apropriarJurosCompetencia({ parcelaId: parcela.id })
    lancamentosGerados.push(
      `Apropriação prévia de juros executada: D Despesas com Juros / C Encargos a Apropriar (R$ ${parcela.valor_juros.toFixed(2)})`,
    )
  }

  // 2. Determina conta do passivo conforme tipo de operação
  const contaPassivoCodigo = contrato.tipo === 'financiamento_veiculo' ? '2.1.7' : '2.1.6'
  const contaPassivoNome =
    contrato.tipo === 'financiamento_veiculo'
      ? 'Financiamentos de Veículos e Frotas a Pagar (Passivo Circulante)'
      : 'Empréstimos Bancários a Pagar (Passivo Circulante)'

  // 3. Cria e quita lançamento em contas_pagar (para conciliar no extrato e debitar banco)
  // D - Passivo (Amortização) / C - Bancos (Total pago)
  const dtPagtoFull = `${dataPagamentoIso} 12:00:00.000Z`
  const cpRecord = await pb.collection('contas_pagar').create({
    descricao: `Pagamento Parcela ${parcela.numero_parcela}/${contrato.quantidade_parcelas} - Contrato ${contrato.numero_contrato} (${contrato.banco_nome})`,
    fornecedor: contrato.banco_nome || 'Credor',
    categoria: 'despesas_operacionais',
    valor: vPago,
    data_vencimento: parcela.data_vencimento,
    data_pagamento: dtPagtoFull,
    status: 'pago',
    forma_pagamento: formaPagamento,
    numero_documento: `PAG-PARC-${contrato.numero_contrato}-${parcela.numero_parcela}`,
    conta_bancaria: cBancaria || null,
    plano_contas_codigo: contaPassivoCodigo,
    plano_contas_nome: contaPassivoNome,
    classificacao_manual: true,
    emprestimo_contrato_id: contrato.id,
    emprestimo_parcela_id: parcela.id,
    observacoes: `[ETAPA 3 - PAGAMENTO DE PARCELA] D — ${contaPassivoNome} (Amortização: R$ ${parcela.valor_principal.toFixed(2)}) / C — Bancos Conta Movimento (Total: R$ ${vPago.toFixed(2)}).`,
    criado_por: currentUserId,
  })

  // 4. Atualiza a parcela
  const parcelaAtualizada = await pb
    .collection('emprestimos_parcelas')
    .update<EmprestimoParcelaRecord>(parcela.id, {
      status: 'paga',
      data_pagamento: dtPagtoFull,
      valor_pago: vPago,
      conta_bancaria: cBancaria || null,
      conta_pagar_id: cpRecord.id,
    })

  // 5. Atualiza saldos consolidados do contrato
  const todasParc = await pb
    .collection('emprestimos_parcelas')
    .getFullList<EmprestimoParcelaRecord>({
      filter: `contrato = '${contrato.id}'`,
    })

  const totalAmortizado = todasParc
    .filter((p) => p.status === 'paga')
    .reduce((acc, p) => acc + (p.valor_principal || 0), 0)
  const totalJurosPagos = todasParc
    .filter((p) => p.status === 'paga')
    .reduce((acc, p) => acc + (p.valor_juros || 0), 0)
  const saldoDevedorAtual = Math.max(0, (contrato.valor_liquido_liberado || 0) - totalAmortizado)

  // Recalcula saldos circulante e não circulante restantes
  const parcelasPendentes = todasParc.filter((p) => p.status !== 'paga')
  const saldoCirculante = parcelasPendentes
    .filter((p) => p.classificacao_passivo === 'circulante')
    .reduce((acc, p) => acc + (p.valor_principal || 0), 0)
  const saldoNaoCirculante = parcelasPendentes
    .filter((p) => p.classificacao_passivo === 'nao_circulante')
    .reduce((acc, p) => acc + (p.valor_principal || 0), 0)

  const todosQuitados = parcelasPendentes.length === 0
  const novoStatusContrato = todosQuitados ? 'quitado' : 'ativo'

  await pb.collection('emprestimos_financiamentos').update(contrato.id, {
    total_amortizado: totalAmortizado,
    total_juros_pagos: totalJurosPagos,
    saldo_devedor_atual: saldoDevedorAtual,
    saldo_circulante: saldoCirculante,
    saldo_nao_circulante: saldoNaoCirculante,
    status: novoStatusContrato,
  })

  lancamentosGerados.push(
    `D — ${contaPassivoNome} (Amortização): R$ ${parcela.valor_principal.toFixed(2)}`,
  )
  lancamentosGerados.push(`C — Bancos Conta Movimento (1.1.1): R$ ${vPago.toFixed(2)}`)

  // 6. Auditoria
  await registrarAuditoriaFinanceira({
    tipoOperacao: 'pagamento_parcela_emprestimo',
    descricao: `Pagamento da parcela ${parcela.numero_parcela}/${contrato.quantidade_parcelas} do contrato ${contrato.numero_contrato}. Amortização de principal: R$ ${parcela.valor_principal.toFixed(2)}, total pago: R$ ${vPago.toFixed(2)}.`,
    detalhes: {
      contratoId: contrato.id,
      parcelaId: parcela.id,
      numero_parcela: parcela.numero_parcela,
      valor_pago: vPago,
      valor_principal: parcela.valor_principal,
      valor_juros: parcela.valor_juros,
      contaPagarId: cpRecord.id,
      lancamentosGerados,
    },
    usuarioId: currentUserId,
  })

  return {
    parcelaAtualizada,
    contaPagarGeradaId: cpRecord.id,
    lancamentosGerados,
  }
}

/**
 * RECLASSIFICAÇÃO PERIÓDICA: Passivo Não Circulante -> Passivo Circulante
 * Rotina que identifica parcelas a vencer nos próximos 12 meses classificadas como 'nao_circulante',
 * atualiza sua classificação para 'circulante' e recalcula os saldos contábeis do contrato.
 */
export async function reclassificarPassivoPeriodico(dataBaseIso?: string): Promise<{
  totalReclassificado: number
  parcelasReclassificadas: number
  detalhes: string[]
}> {
  const currentUserId = pb.authStore.record?.id
  const baseIso = dataBaseIso || new Date().toISOString().slice(0, 10)
  const detalhes: string[] = []

  // Busca todas as parcelas pendentes com classificação 'nao_circulante'
  const parcelasNaoCirculantes = await pb
    .collection('emprestimos_parcelas')
    .getFullList<EmprestimoParcelaRecord>({
      filter: "status != 'paga' && classificacao_passivo = 'nao_circulante'",
      expand: 'contrato',
    })

  let totalReclassificado = 0
  let qtd = 0
  const contratosAfetados = new Set<string>()

  for (const p of parcelasNaoCirculantes) {
    const venc = p.data_vencimento ? p.data_vencimento.slice(0, 10) : ''
    if (!venc) continue

    const meses = calcularMesesAteVencimento(baseIso, venc)
    if (meses <= 12) {
      // Reclassifica para circulante
      await pb.collection('emprestimos_parcelas').update(p.id, {
        classificacao_passivo: 'circulante',
      })

      const contratoNome = p.expand?.contrato?.numero_contrato || 'Contrato'
      totalReclassificado += p.valor_principal
      qtd++
      contratosAfetados.add(p.contrato)
      detalhes.push(
        `Contrato ${contratoNome} - Parcela ${p.numero_parcela} (Venc: ${venc}): R$ ${p.valor_principal.toFixed(2)} transferido para Passivo Circulante`,
      )
    }
  }

  // Recalcula saldos circulante e não circulante de cada contrato
  for (const cId of contratosAfetados) {
    try {
      const todasParc = await pb
        .collection('emprestimos_parcelas')
        .getFullList<EmprestimoParcelaRecord>({
          filter: `contrato = '${cId}' && status != 'paga'`,
        })
      const saldoCirculante = todasParc
        .filter((p) => p.classificacao_passivo === 'circulante')
        .reduce((acc, p) => acc + (p.valor_principal || 0), 0)
      const saldoNaoCirculante = todasParc
        .filter((p) => p.classificacao_passivo === 'nao_circulante')
        .reduce((acc, p) => acc + (p.valor_principal || 0), 0)

      await pb.collection('emprestimos_financiamentos').update(cId, {
        saldo_circulante: saldoCirculante,
        saldo_nao_circulante: saldoNaoCirculante,
      })
    } catch (errC) {
      console.warn(`Erro ao recalcular saldos no contrato ${cId}:`, errC)
    }
  }

  // Auditoria
  if (qtd > 0) {
    await registrarAuditoriaFinanceira({
      tipoOperacao: 'reclassificacao_passivo_circulante',
      descricao: `Reclassificação contábil periódica Passivo Não Circulante -> Circulante: R$ ${totalReclassificado.toFixed(2)} em ${qtd} parcela(s).`,
      detalhes: {
        totalReclassificado,
        quantidadeParcelas: qtd,
        detalhes,
      },
      usuarioId: currentUserId,
    })
  }

  return {
    totalReclassificado,
    parcelasReclassificadas: qtd,
    detalhes,
  }
}

/**
 * EXCLUSÃO DE CONTRATO (RESTRITA A ADMIN):
 * Exclui contrato, suas parcelas e reverte/estorna lançamentos gerados no contas a pagar/receber.
 */
export async function excluirContratoOperacao({
  contratoId,
  usuarioId,
}: {
  contratoId: string
  usuarioId?: string
}): Promise<{
  sucesso: boolean
  itensEstornados: number
  mensagem: string
}> {
  const currentUserId = usuarioId || pb.authStore.record?.id
  const contrato = await pb
    .collection('emprestimos_financiamentos')
    .getOne<EmprestimoFinanciamentoRecord>(contratoId)

  // 1. Busca parcelas do contrato
  const parcelas = await pb
    .collection('emprestimos_parcelas')
    .getFullList<EmprestimoParcelaRecord>({
      filter: `contrato = '${contratoId}'`,
    })

  let estornados = 0

  // 2. Estorna contas_pagar vinculadas às parcelas pagas ou apropriações
  for (const p of parcelas) {
    if (p.conta_pagar_id) {
      try {
        await pb.collection('contas_pagar').delete(p.conta_pagar_id)
        estornados++
      } catch (err) {
        console.warn(`Erro ao excluir conta a pagar ${p.conta_pagar_id}:`, err)
      }
    }
  }

  // 3. Estorna lançamentos gerados no contas a pagar/receber com o número do contrato
  try {
    const cpsContrato = await pb.collection('contas_pagar').getFullList({
      filter: `numero_documento ~ '${contrato.numero_contrato}'`,
    })
    for (const cp of cpsContrato) {
      try {
        await pb.collection('contas_pagar').delete(cp.id)
        estornados++
      } catch {
        /* intentionally ignored */
      }
    }

    const crsContrato = await pb.collection('contas_receber').getFullList({
      filter: `numero_documento ~ '${contrato.numero_contrato}'`,
    })
    for (const cr of crsContrato) {
      try {
        await pb.collection('contas_receber').delete(cr.id)
        estornados++
      } catch {
        /* intentionally ignored */
      }
    }
  } catch (errLote) {
    console.warn('Erro ao limpar lançamentos correlatos do contrato:', errLote)
  }

  // 4. Exclui as parcelas filhas
  for (const p of parcelas) {
    try {
      await pb.collection('emprestimos_parcelas').delete(p.id)
    } catch {
      /* intentionally ignored */
    }
  }

  // 5. Exclui o contrato
  await pb.collection('emprestimos_financiamentos').delete(contratoId)

  // 6. Auditoria de estorno/exclusão
  await registrarAuditoriaFinanceira({
    tipoOperacao: 'exclusao_estorno_contrato',
    descricao: `[ESTORNO TOTAL] Contrato de ${contrato.tipo} nº ${contrato.numero_contrato} foi excluído pelo administrador. ${estornados} lançamentos estornados.`,
    detalhes: {
      contratoId,
      numero_contrato: contrato.numero_contrato,
      valor_total_divida: contrato.valor_total_divida,
      itensEstornados: estornados,
    },
    usuarioId: currentUserId,
  })

  return {
    sucesso: true,
    itensEstornados: estornados,
    mensagem: `Contrato nº ${contrato.numero_contrato} e seus lançamentos foram excluídos e estornados com sucesso.`,
  }
}
