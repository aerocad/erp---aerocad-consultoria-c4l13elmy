import { describe, it, expect } from 'vitest'
import {
  consolidarBalanceteMensal,
  derivarDetalhamentoContasBalancete,
} from './balanceteMensalDetalhamentoService'
import type {
  BalanceteMensalRecord,
  ContaPagarRecord,
  ContaReceberRecord,
  ExtratoTransacaoRecord,
  ParcelaRecord,
} from '@/types/crm'

describe('balanceteMensalDetalhamentoService', () => {
  it('deve consolidar receitas e despesas agrupando por contas do Plano de Contas AEROCAD sem dupla contagem', () => {
    const parcelas = [
      {
        id: 'p1',
        projeto_id: 'proj1',
        numero: 1,
        total_parcelas: 1,
        valor: 15000,
        valor_recebido: 15000,
        vencimento: '2026-10-15',
        data_pagamento: '2026-10-15',
        status: 'paga',
        descricao: 'Elaboração Plano Diretor Aeroportuário',
        nf_numero: '2026001',
        expand: {
          cliente: { id: 'c1', razao_social: 'Aeroporto Internacional ABC' } as unknown,
          projeto: { id: 'proj1', numero: '2026-001' } as unknown,
        },
      } as unknown as ParcelaRecord,
    ]

    const contasReceber = [
      {
        id: 'cr1',
        descricao: 'Parecer Técnico de Zona de Proteção',
        valor: 5000,
        valor_recebido: 5000,
        data_vencimento: '2026-10-20',
        data_recebimento: '2026-10-20',
        status: 'recebido',
        cliente_nome: 'Heliporto Delta',
      } as unknown as ContaReceberRecord,
    ]

    const contasPagar = [
      {
        id: 'cp1',
        descricao: 'Honorários Engenheiro Consultor Sênior',
        fornecedor: 'Engenharia Aeronáutica Terceirizada',
        categoria: 'prestadores_pj',
        valor: 7500,
        data_vencimento: '2026-10-10',
        data_pagamento: '2026-10-10',
        status: 'pago',
        numero_documento: 'NF 442',
      } as unknown as ContaPagarRecord,
    ]

    // Transação de extrato já vinculada a cp1 (NÃO deve ser duplicada)
    const extratosTransacoes = [
      {
        id: 'tx1',
        data: '2026-10-10',
        tipo: 'saida',
        valor: 7500,
        descricao: 'PIX ENGENHARIA AERONAUTICA',
        vinculo_tipo: 'conta_pagar',
        vinculo_id: 'cp1',
      } as unknown as ExtratoTransacaoRecord,
      // Transação de débito bancário avulsa (deve ser contabilizada)
      {
        id: 'tx2',
        data: '2026-10-28',
        tipo: 'saida',
        valor: 120,
        descricao: 'TARIFA BANCARIA PACOTE PJ',
        vinculo_tipo: undefined,
      } as unknown as ExtratoTransacaoRecord,
    ]

    const resultado = consolidarBalanceteMensal(2026, 10, {
      parcelas,
      contasReceber,
      contasPagar,
      extratosTransacoes,
    })

    // Totais
    expect(resultado.receitas.total).toBe(20000)
    expect(resultado.despesas.total).toBe(7620) // 7500 + 120 (sem duplicar tx1!)

    // Detalhamento de contas de receita
    expect(resultado.receitas.porConta).toBeDefined()
    expect(resultado.receitas.porConta!.length).toBeGreaterThan(0)
    const totalContasReceita = resultado.receitas.porConta!.reduce((acc, c) => acc + c.total, 0)
    expect(totalContasReceita).toBe(20000)

    // Detalhamento de contas de despesa
    expect(resultado.despesas.porConta).toBeDefined()
    expect(resultado.despesas.porConta!.length).toBeGreaterThan(0)
    const totalContasDespesa = resultado.despesas.porConta!.reduce((acc, c) => acc + c.total, 0)
    expect(totalContasDespesa).toBe(7620)

    // Lançamentos analíticos em cada conta
    const contaTerceiros = resultado.despesas.porConta!.find(
      (c) => c.nomeConta.toLowerCase().includes('terceirizados') || c.codigoConta.startsWith('3.1'),
    )
    expect(contaTerceiros).toBeDefined()
    expect(contaTerceiros?.lancamentos).toBeDefined()
    expect(contaTerceiros?.lancamentos!.length).toBeGreaterThan(0)
  })

  it('deve derivar detalhamento defensivamente para balancetes antigos sem quebrar', () => {
    // Balancete legado sem o campo porConta gravado no JSON
    const balanceteLegado = {
      id: 'bal-legado-1',
      referencia: '2026-05',
      ano: 2026,
      mes: 5,
      titulo: 'BALANCETE MENSAL — MAIO/2026',
      receita_total: 10000,
      despesa_total: 4000,
      saldo_mes: 6000,
      saldo_acumulado_ano: 18000,
      total_receitas_ano: 10000,
      total_despesas_ano: 4000,
      dados_consolidados: {
        ano: 2026,
        mes: 5,
        referencia: '2026-05',
        receitas: {
          total: 10000,
          porCategoria: { Projetos: 10000 },
          porCliente: [{ clienteNome: 'Cliente Alpha', total: 10000, qtdLancamentos: 1 }],
          itens: [
            {
              id: 'item1',
              data: '2026-05-10',
              descricao: 'Consultoria ICAO',
              clienteNome: 'Cliente Alpha',
              valor: 10000,
              origem: 'parcela',
            },
          ],
        },
        despesas: {
          total: 4000,
          porCategoria: { Software: 4000 },
          porFornecedor: [{ fornecedorNome: 'Autodesk', total: 4000, qtdLancamentos: 1 }],
          itens: [
            {
              id: 'item2',
              data: '2026-05-15',
              descricao: 'Licença AutoCAD',
              fornecedor: 'Autodesk',
              categoria: 'software',
              valor: 4000,
            },
          ],
        },
        acumuladoAno: {
          receitasTotal: 10000,
          despesasTotal: 4000,
          saldoAcumulado: 6000,
          meses: [],
        },
      },
      data_emissao: '2026-05-31',
      responsavel_emissao: 'Admin',
      created: '2026-05-31T00:00:00.000Z',
      updated: '2026-05-31T00:00:00.000Z',
    } as unknown as BalanceteMensalRecord
    const detalhe = derivarDetalhamentoContasBalancete(balanceteLegado)
    expect(detalhe.contasReceitas.length).toBeGreaterThan(0)
    expect(detalhe.contasDespesas.length).toBeGreaterThan(0)
    expect(detalhe.contasReceitas[0].total).toBe(10000)
    expect(detalhe.contasDespesas[0].total).toBe(4000)
    expect(detalhe.contasReceitas[0].lancamentos![0].descricao).toBe('Consultoria ICAO')
  })

  it('deve lidar de forma segura com balancete totalmente vazio ou corrompido', () => {
    const balanceteVazio = {
      id: 'bal-null',
    } as unknown as BalanceteMensalRecord

    const detalhe = derivarDetalhamentoContasBalancete(balanceteVazio)
    expect(detalhe.contasReceitas).toEqual([])
    expect(detalhe.contasDespesas).toEqual([])
  })
})
