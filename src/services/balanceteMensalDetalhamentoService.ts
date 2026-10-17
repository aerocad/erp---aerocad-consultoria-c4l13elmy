/**
 * Serviço de consolidação contábil e detalhamento por contas do Balancete Mensal AEROCAD.
 * Realiza a classificação oficial de acordo com o Plano de Contas AEROCAD:
 *  - Deduplicação de extratos bancários contra contas a pagar e parcelas já contabilizadas
 *  - Agrupamento em contas contábeis (código, nome, quantidade de lançamentos e volume R$)
 *  - Construção sob demanda dos lançamentos analíticos por conta (data, doc, favorecido, valor)
 *  - Suporte resiliente a registros legados do balancete (com fallback seguro para não derrubar telas)
 */

import {
  PLANO_CONTAS_AEROCAD,
  classificarParcela,
  classificarContaReceber,
  classificarContaPagar,
  classificarTransacaoExtrato,
  obterItemPlanoContasPorCodigo,
} from '@/lib/planoContas'
import type {
  BalanceteConsolidadoDados,
  BalanceteContaResumo,
  BalanceteLancamentoAnalitico,
  BalanceteMensalRecord,
  ContaPagarRecord,
  ContaReceberRecord,
  ExtratoTransacaoRecord,
  ParcelaRecord,
  ProjetoRecord,
} from '@/types/crm'

export const MESES_NOMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

export interface ContextoConsolidacaoBalancete {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  projetos?: ProjetoRecord[]
  extratosTransacoes?: ExtratoTransacaoRecord[]
}

/**
 * Consolida as receitas e despesas de um mês específico, calculando totais agregados
 * e o detalhamento estruturado por contas contábeis com lançamentos individuais.
 */
export function consolidarBalanceteMensal(
  ano: number,
  mes: number,
  contexto: ContextoConsolidacaoBalancete,
): BalanceteConsolidadoDados {
  const { parcelas = [], contasPagar = [], contasReceber = [], extratosTransacoes = [] } = contexto

  const mesStr = String(mes).padStart(2, '0')
  const ref = `${ano}-${mesStr}`

  // 1. Receitas do Mês: Parcelas quitadas no mês/ano + Contas a receber recebidas
  const parcelasDoMes = parcelas.filter((p) => {
    if (p.status !== 'paga') return false
    const dataPagto = p.data_pagamento || p.data_faturamento || p.vencimento
    if (!dataPagto) return false
    return dataPagto.startsWith(ref)
  })

  const avulsasDoMes = contasReceber.filter((c) => {
    if (c.status !== 'recebido') return false
    const dataRec = c.data_recebimento || c.data_vencimento
    if (!dataRec) return false
    return dataRec.startsWith(ref)
  })

  // 2. Despesas do Mês: Contas a pagar pagas no mês/ano
  const despesasDoMes = contasPagar.filter((c) => {
    if (c.status !== 'pago') return false
    const dataPag = c.data_pagamento || c.data_vencimento
    if (!dataPag) return false
    return dataPag.startsWith(ref)
  })

  // 3. Extratos bancários avulsos do mês (deduplicados contra contas a pagar ou parcelas conciliadas)
  const extratosDoMes = extratosTransacoes.filter((tx) => {
    if (!tx.data || !tx.data.startsWith(ref)) return false
    // Se já vinculado a registro existente de contas a pagar ou parcela, não duplicar
    if (tx.vinculo_tipo === 'conta_pagar' && contasPagar.some((c) => c.id === tx.vinculo_id)) {
      return false
    }
    if (tx.vinculo_tipo === 'parcela' && parcelas.some((p) => p.id === tx.vinculo_id)) {
      return false
    }
    return true
  })

  // =========================================================================
  // PROCESSAMENTO DE RECEITAS
  // =========================================================================
  let receitaTotalMes = 0
  const recPorCategoria: Record<string, number> = {}
  const recPorClienteMap = new Map<string, { total: number; qtd: number }>()
  const itensReceita: BalanceteConsolidadoDados['receitas']['itens'] = []
  const contasReceitaMap = new Map<
    string,
    {
      nomeConta: string
      grupoContabil: string
      total: number
      lancamentos: BalanceteLancamentoAnalitico[]
    }
  >()

  function registrarLancamentoReceita(
    contaCodigo: string,
    contaNome: string,
    grupo: string,
    lanc: BalanceteLancamentoAnalitico,
  ) {
    const atual = contasReceitaMap.get(contaCodigo) || {
      nomeConta: contaNome,
      grupoContabil: grupo,
      total: 0,
      lancamentos: [],
    }
    atual.total += lanc.valor
    atual.lancamentos.push(lanc)
    contasReceitaMap.set(contaCodigo, atual)
  }

  // 1.1 Parcelas
  for (const p of parcelasDoMes) {
    const val = Number(p.valor_recebido || p.valor || 0)
    receitaTotalMes += val

    const cat = p.nf_numero ? 'Projetos (Faturado NFS-e)' : 'Projetos (Parcelas Contratuais)'
    recPorCategoria[cat] = (recPorCategoria[cat] || 0) + val

    const cliNome = p.expand?.cliente?.razao_social || 'Cliente Avulso'
    const cliAtual = recPorClienteMap.get(cliNome) || { total: 0, qtd: 0 }
    cliAtual.total += val
    cliAtual.qtd += 1
    recPorClienteMap.set(cliNome, cliAtual)

    const conta = classificarParcela(p)
    const dataLanc = (p.data_pagamento || p.vencimento || '').slice(0, 10)
    const docRef = p.nf_numero ? `NFS-e ${p.nf_numero}` : undefined

    const lancamentoAnalitico: BalanceteLancamentoAnalitico = {
      id: `parc-${p.id}`,
      data: dataLanc,
      origem: 'parcela',
      origemLabel: 'Parcela de Projeto',
      codigoConta: conta.codigo,
      nomeConta: conta.nome,
      descricao: p.descricao || `Parcela Contratual ${p.expand?.projeto?.numero || ''}`,
      entidade: cliNome,
      documentoRef: docRef,
      valor: val,
      tipoMovimento: 'credito',
      status: p.status,
    }

    registrarLancamentoReceita(conta.codigo, conta.nome, conta.grupo, lancamentoAnalitico)

    itensReceita.push({
      id: p.id,
      data: dataLanc,
      descricao: p.descricao,
      clienteNome: cliNome,
      projetoNumero: p.expand?.projeto?.numero,
      valor: val,
      origem: 'parcela',
      nfNumero: p.nf_numero,
      codigoConta: conta.codigo,
      nomeConta: conta.nome,
    })
  }

  // 1.2 Receitas Avulsas
  for (const c of avulsasDoMes) {
    const val = Number(c.valor_recebido || c.valor || 0)
    receitaTotalMes += val

    const cat = 'Receitas Avulsas / Outros'
    recPorCategoria[cat] = (recPorCategoria[cat] || 0) + val

    const cliNome = c.cliente_nome || c.expand?.cliente?.razao_social || 'Cliente Avulso'
    const cliAtual = recPorClienteMap.get(cliNome) || { total: 0, qtd: 0 }
    cliAtual.total += val
    cliAtual.qtd += 1
    recPorClienteMap.set(cliNome, cliAtual)

    const conta = classificarContaReceber(c)
    const dataLanc = (c.data_recebimento || c.data_vencimento || '').slice(0, 10)

    const lancamentoAnalitico: BalanceteLancamentoAnalitico = {
      id: `cr-${c.id}`,
      data: dataLanc,
      origem: 'receita_avulsa',
      origemLabel: 'Receita Avulsa',
      codigoConta: conta.codigo,
      nomeConta: conta.nome,
      descricao: c.descricao || 'Receita Técnica Operacional',
      entidade: cliNome,
      documentoRef: c.numero_documento,
      valor: val,
      tipoMovimento: 'credito',
      status: c.status,
    }

    registrarLancamentoReceita(conta.codigo, conta.nome, conta.grupo, lancamentoAnalitico)

    itensReceita.push({
      id: c.id,
      data: dataLanc,
      descricao: c.descricao,
      clienteNome: cliNome,
      valor: val,
      origem: 'receita_avulsa',
      nfNumero: c.numero_documento,
      codigoConta: conta.codigo,
      nomeConta: conta.nome,
    })
  }

  // 1.3 Extratos com entrada de crédito avulsa
  for (const tx of extratosDoMes) {
    if (tx.tipo === 'entrada') {
      const val = Math.abs(Number(tx.valor || 0))
      receitaTotalMes += val

      const cat = 'Movimentação Bancária (Entrada Extrato)'
      recPorCategoria[cat] = (recPorCategoria[cat] || 0) + val

      const contraparte = 'Entrada Bancária PJ'
      const cliAtual = recPorClienteMap.get(contraparte) || { total: 0, qtd: 0 }
      cliAtual.total += val
      cliAtual.qtd += 1
      recPorClienteMap.set(contraparte, cliAtual)

      const conta = classificarTransacaoExtrato(tx)
      const dataLanc = (tx.data || '').slice(0, 10)

      const lancamentoAnalitico: BalanceteLancamentoAnalitico = {
        id: `tx-${tx.id}`,
        data: dataLanc,
        origem: 'extrato',
        origemLabel: 'Extrato Bancário',
        codigoConta: conta.codigo,
        nomeConta: conta.nome,
        descricao: tx.descricao || 'Entrada em conta corrente PJ',
        entidade: contraparte,
        documentoRef: tx.documento_ref,
        valor: val,
        tipoMovimento: 'credito',
        status: tx.status_conciliacao || 'conciliado',
      }

      registrarLancamentoReceita(conta.codigo, conta.nome, conta.grupo, lancamentoAnalitico)

      itensReceita.push({
        id: `tx-${tx.id}`,
        data: dataLanc,
        descricao: tx.descricao || 'Entrada em conta corrente PJ',
        clienteNome: contraparte,
        valor: val,
        origem: 'receita_avulsa',
        nfNumero: tx.documento_ref,
        codigoConta: conta.codigo,
        nomeConta: conta.nome,
      })
    }
  }

  const porContaReceita: BalanceteContaResumo[] = Array.from(contasReceitaMap.entries())
    .map(([codigoConta, info]) => ({
      codigoConta,
      nomeConta: info.nomeConta,
      grupoContabil: info.grupoContabil,
      qtdLancamentos: info.lancamentos.length,
      total: info.total,
      natureza: 'receita' as const,
      lancamentos: info.lancamentos.sort((a, b) => b.valor - a.valor),
    }))
    .sort((a, b) => a.codigoConta.localeCompare(b.codigoConta))

  // =========================================================================
  // PROCESSAMENTO DE DESPESAS
  // =========================================================================
  let despesaTotalMes = 0
  const despPorCategoria: Record<string, number> = {}
  const despPorFornecedorMap = new Map<string, { total: number; qtd: number }>()
  const itensDespesa: BalanceteConsolidadoDados['despesas']['itens'] = []
  const contasDespesaMap = new Map<
    string,
    {
      nomeConta: string
      grupoContabil: string
      total: number
      lancamentos: BalanceteLancamentoAnalitico[]
    }
  >()

  function registrarLancamentoDespesa(
    contaCodigo: string,
    contaNome: string,
    grupo: string,
    lanc: BalanceteLancamentoAnalitico,
  ) {
    const atual = contasDespesaMap.get(contaCodigo) || {
      nomeConta: contaNome,
      grupoContabil: grupo,
      total: 0,
      lancamentos: [],
    }
    atual.total += lanc.valor
    atual.lancamentos.push(lanc)
    contasDespesaMap.set(contaCodigo, atual)
  }

  // 2.1 Contas a Pagar Pagas
  for (const c of despesasDoMes) {
    const val = Number(c.valor || 0)
    despesaTotalMes += val

    const catNome = c.categoria || 'outros'
    despPorCategoria[catNome] = (despPorCategoria[catNome] || 0) + val

    const fornNome = c.fornecedor || 'Fornecedor Operacional'
    const fornAtual = despPorFornecedorMap.get(fornNome) || { total: 0, qtd: 0 }
    fornAtual.total += val
    fornAtual.qtd += 1
    despPorFornecedorMap.set(fornNome, fornAtual)

    const conta = classificarContaPagar(c)
    const dataLanc = (c.data_pagamento || c.data_vencimento || '').slice(0, 10)

    const lancamentoAnalitico: BalanceteLancamentoAnalitico = {
      id: `cp-${c.id}`,
      data: dataLanc,
      origem: 'conta_pagar',
      origemLabel: 'Conta a Pagar',
      codigoConta: conta.codigo,
      nomeConta: conta.nome,
      descricao: c.descricao || 'Despesa Operacional AEROCAD',
      entidade: fornNome,
      documentoRef: c.numero_documento,
      valor: val,
      tipoMovimento: 'debito',
      status: c.status,
    }

    registrarLancamentoDespesa(conta.codigo, conta.nome, conta.grupo, lancamentoAnalitico)

    itensDespesa.push({
      id: c.id,
      data: dataLanc,
      descricao: c.descricao,
      fornecedor: fornNome,
      categoria: catNome,
      valor: val,
      numeroDocumento: c.numero_documento,
      codigoConta: conta.codigo,
      nomeConta: conta.nome,
    })
  }

  // 2.2 Extratos com saída avulsa
  for (const tx of extratosDoMes) {
    if (tx.tipo === 'saida') {
      const val = Math.abs(Number(tx.valor || 0))
      despesaTotalMes += val

      const catNome = 'despesas_operacionais'
      despPorCategoria[catNome] = (despPorCategoria[catNome] || 0) + val

      const fornNome = tx.descricao ? tx.descricao.slice(0, 45) : 'Débito Bancário PJ'
      const fornAtual = despPorFornecedorMap.get(fornNome) || { total: 0, qtd: 0 }
      fornAtual.total += val
      fornAtual.qtd += 1
      despPorFornecedorMap.set(fornNome, fornAtual)

      const conta = classificarTransacaoExtrato(tx)
      const dataLanc = (tx.data || '').slice(0, 10)

      const lancamentoAnalitico: BalanceteLancamentoAnalitico = {
        id: `tx-${tx.id}`,
        data: dataLanc,
        origem: 'extrato',
        origemLabel: 'Extrato Bancário',
        codigoConta: conta.codigo,
        nomeConta: conta.nome,
        descricao: tx.descricao || 'Débito em conta PJ',
        entidade: fornNome,
        documentoRef: tx.documento_ref,
        valor: val,
        tipoMovimento: 'debito',
        status: tx.status_conciliacao || 'conciliado',
      }

      registrarLancamentoDespesa(conta.codigo, conta.nome, conta.grupo, lancamentoAnalitico)

      itensDespesa.push({
        id: `tx-${tx.id}`,
        data: dataLanc,
        descricao: tx.descricao || 'Débito em conta PJ',
        fornecedor: fornNome,
        categoria: catNome,
        valor: val,
        numeroDocumento: tx.documento_ref,
        codigoConta: conta.codigo,
        nomeConta: conta.nome,
      })
    }
  }

  const porContaDespesa: BalanceteContaResumo[] = Array.from(contasDespesaMap.entries())
    .map(([codigoConta, info]) => ({
      codigoConta,
      nomeConta: info.nomeConta,
      grupoContabil: info.grupoContabil,
      qtdLancamentos: info.lancamentos.length,
      total: info.total,
      natureza: 'despesa' as const,
      lancamentos: info.lancamentos.sort((a, b) => b.valor - a.valor),
    }))
    .sort((a, b) => a.codigoConta.localeCompare(b.codigoConta))

  // =========================================================================
  // 4. ACUMULADO DO ANO (Janeiro ao mês selecionado)
  // =========================================================================
  let totalRecAno = 0
  let totalDespAno = 0
  const mesesAcumulado: BalanceteConsolidadoDados['acumuladoAno']['meses'] = []

  for (let m = 1; m <= mes; m++) {
    const mStr = String(m).padStart(2, '0')
    const refM = `${ano}-${mStr}`

    let recM = 0
    parcelas.forEach((p) => {
      if (p.status !== 'paga') return
      const d = p.data_pagamento || p.data_faturamento || p.vencimento
      if (d && d.startsWith(refM)) recM += Number(p.valor_recebido || p.valor || 0)
    })
    contasReceber.forEach((c) => {
      if (c.status !== 'recebido') return
      const d = c.data_recebimento || c.data_vencimento
      if (d && d.startsWith(refM)) recM += Number(c.valor_recebido || c.valor || 0)
    })

    let despM = 0
    contasPagar.forEach((c) => {
      if (c.status !== 'pago') return
      const d = c.data_pagamento || c.data_vencimento
      if (d && d.startsWith(refM)) despM += Number(c.valor || 0)
    })

    extratosTransacoes.forEach((tx) => {
      if (!tx.data || !tx.data.startsWith(refM)) return
      if (tx.vinculo_tipo === 'conta_pagar' && contasPagar.some((c) => c.id === tx.vinculo_id)) {
        return
      }
      if (tx.vinculo_tipo === 'parcela' && parcelas.some((p) => p.id === tx.vinculo_id)) return

      if (tx.tipo === 'entrada') recM += Math.abs(Number(tx.valor || 0))
      else if (tx.tipo === 'saida') despM += Math.abs(Number(tx.valor || 0))
    })

    totalRecAno += recM
    totalDespAno += despM

    mesesAcumulado.push({
      mes: m,
      nomeMes: MESES_NOMES[m - 1],
      receita: recM,
      despesa: despM,
      saldo: recM - despM,
    })
  }

  return {
    ano,
    mes,
    referencia: ref,
    receitas: {
      total: receitaTotalMes,
      porCategoria: recPorCategoria,
      porCliente: Array.from(recPorClienteMap.entries())
        .map(([clienteNome, v]) => ({ clienteNome, total: v.total, qtdLancamentos: v.qtd }))
        .sort((a, b) => b.total - a.total),
      porConta: porContaReceita,
      itens: itensReceita.sort((a, b) => b.valor - a.valor),
    },
    despesas: {
      total: despesaTotalMes,
      porCategoria: despPorCategoria,
      porFornecedor: Array.from(despPorFornecedorMap.entries())
        .map(([fornecedorNome, v]) => ({
          fornecedorNome,
          total: v.total,
          qtdLancamentos: v.qtd,
        }))
        .sort((a, b) => b.total - a.total),
      porConta: porContaDespesa,
      itens: itensDespesa.sort((a, b) => b.valor - a.valor),
    },
    acumuladoAno: {
      receitasTotal: totalRecAno,
      despesasTotal: totalDespAno,
      saldoAcumulado: totalRecAno - totalDespAno,
      meses: mesesAcumulado,
    },
  }
}

/**
 * Normaliza e enriquece sob demanda os dados consolidados de qualquer balancete existente
 * (inclusive balancetes antigos gravados sem o campo porConta), garantindo que
 * o detalhamento contábil esteja sempre disponível e nunca cause quebra.
 */
export function derivarDetalhamentoContasBalancete(
  balancete: BalanceteMensalRecord,
  contexto?: ContextoConsolidacaoBalancete,
): {
  contasReceitas: BalanceteContaResumo[]
  contasDespesas: BalanceteContaResumo[]
} {
  const dados = balancete.dados_consolidados
  if (!dados) {
    return { contasReceitas: [], contasDespesas: [] }
  }

  // 1. Se temos o contexto de dados vivos da tela, recomputa com fidelidade total
  // Isso garante que reclassificações contábeis manuais reflitam IMEDIATAMENTE no detalhamento expansível
  if (contexto && balancete.ano && balancete.mes) {
    const recres = consolidarBalanceteMensal(balancete.ano, balancete.mes, contexto)
    return {
      contasReceitas: recres.receitas.porConta || [],
      contasDespesas: recres.despesas.porConta || [],
    }
  }

  // 2. Se já possui o campo `porConta` preenchido com dados gravados, usa o gravado
  const temPorContaRec =
    Array.isArray(dados.receitas?.porConta) && dados.receitas.porConta.length > 0
  const temPorContaDesp =
    Array.isArray(dados.despesas?.porConta) && dados.despesas.porConta.length > 0

  if (temPorContaRec && temPorContaDesp) {
    return {
      contasReceitas: dados.receitas.porConta!,
      contasDespesas: dados.despesas.porConta!,
    }
  }

  // 3. Fallback defensivo com base nos `itens` que já foram salvos no JSON do balancete
  const contasRecMap = new Map<string, BalanceteContaResumo>()
  const itensRec = Array.isArray(dados.receitas?.itens) ? dados.receitas.itens : []

  for (const item of itensRec) {
    const val = Number(item.valor || 0)
    const conta =
      (item.codigoConta && obterItemPlanoContasPorCodigo(item.codigoConta)) ||
      (item.origem === 'parcela'
        ? classificarParcela({ descricao: item.descricao })
        : classificarContaReceber({ descricao: item.descricao, cliente_nome: item.clienteNome }))

    const cod = conta?.codigo || item.codigoConta || '4.1.3'
    const nome = conta?.nome || item.nomeConta || 'Consultorias Técnicas e Pareceres Avulsos'
    const grupo = conta?.grupo || 'Receita Operacional Bruta'

    const atual = contasRecMap.get(cod) || {
      codigoConta: cod,
      nomeConta: nome,
      grupoContabil: grupo,
      qtdLancamentos: 0,
      total: 0,
      natureza: 'receita',
      lancamentos: [],
    }

    atual.qtdLancamentos += 1
    atual.total += val
    atual.lancamentos!.push({
      id: item.id || `rec-${Math.random()}`,
      data: item.data || balancete.data_emissao || '',
      origem: item.origem || 'receita_avulsa',
      origemLabel: item.origem === 'parcela' ? 'Parcela de Projeto' : 'Receita Avulsa',
      codigoConta: cod,
      nomeConta: nome,
      descricao: item.descricao || 'Receita realizada',
      entidade: item.clienteNome || 'Cliente AEROCAD',
      documentoRef: item.nfNumero,
      valor: val,
      tipoMovimento: 'credito',
    })
    contasRecMap.set(cod, atual)
  }

  const contasDespMap = new Map<string, BalanceteContaResumo>()
  const itensDesp = Array.isArray(dados.despesas?.itens) ? dados.despesas.itens : []

  for (const item of itensDesp) {
    const val = Number(item.valor || 0)
    const conta =
      (item.codigoConta && obterItemPlanoContasPorCodigo(item.codigoConta)) ||
      classificarContaPagar({
        descricao: item.descricao,
        fornecedor: item.fornecedor,
        categoria: item.categoria,
      })

    const cod = conta?.codigo || item.codigoConta || '3.1.1'
    const nome = conta?.nome || item.nomeConta || 'Despesas Administrativas Gerais & Escritório'
    const grupo = conta?.grupo || 'Despesas Operacionais Fixas'

    const atual = contasDespMap.get(cod) || {
      codigoConta: cod,
      nomeConta: nome,
      grupoContabil: grupo,
      qtdLancamentos: 0,
      total: 0,
      natureza: 'despesa',
      lancamentos: [],
    }

    atual.qtdLancamentos += 1
    atual.total += val
    atual.lancamentos!.push({
      id: item.id || `desp-${Math.random()}`,
      data: item.data || balancete.data_emissao || '',
      origem: item.id?.startsWith('tx-') ? 'extrato' : 'conta_pagar',
      origemLabel: item.id?.startsWith('tx-') ? 'Extrato Bancário' : 'Conta a Pagar',
      codigoConta: cod,
      nomeConta: nome,
      descricao: item.descricao || 'Despesa realizada',
      entidade: item.fornecedor || 'Fornecedor/Credor',
      documentoRef: item.numeroDocumento,
      valor: val,
      tipoMovimento: 'debito',
    })
    contasDespMap.set(cod, atual)
  }

  return {
    contasReceitas: Array.from(contasRecMap.values()).sort((a, b) =>
      a.codigoConta.localeCompare(b.codigoConta),
    ),
    contasDespesas: Array.from(contasDespMap.values()).sort((a, b) =>
      a.codigoConta.localeCompare(b.codigoConta),
    ),
  }
}
