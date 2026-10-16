import { describe, it, expect } from 'vitest'
import {
  normalizarDataChave,
  normalizarDescricaoComparacao,
  normalizarIdentificador,
  calcularFingerprintTransacao,
  analisarDeduplicacao,
  calcularHashArquivo,
} from './extratoDeduplicador'
import type { ExtratoTransacaoRecord, ExtratoRecord } from '@/types/crm'

describe('extratoDeduplicador', () => {
  it('normaliza datas em múltiplos formatos para YYYY-MM-DD', () => {
    expect(normalizarDataChave('2026-04-15 12:00:00.000Z')).toBe('2026-04-15')
    expect(normalizarDataChave('2026-04-15T00:00:00.000Z')).toBe('2026-04-15')
    expect(normalizarDataChave('15/04/2026')).toBe('2026-04-15')
    expect(normalizarDataChave('2026-04-15')).toBe('2026-04-15')
  })

  it('normaliza descrições removendo pontuação e acentos', () => {
    expect(normalizarDescricaoComparacao('Pix Enviado: "Cleyton Borges"')).toBe(
      'pix enviado cleyton borges',
    )
    expect(normalizarDescricaoComparacao('PAGTO BOLETO BANCÁRIO / 123.456')).toBe(
      'pagto boleto bancario 123 456',
    )
  })

  it('normaliza identificadores de boleto e documentos', () => {
    expect(normalizarIdentificador('00012345')).toBe('12345')
    expect(normalizarIdentificador('ABC-1234')).toBe('abc1234')
  })

  it('gera fingerprints determinísticos e consistentes', () => {
    const fp1 = calcularFingerprintTransacao(
      {
        data: '2026-04-15',
        valor: 1500.5,
        tipo: 'entrada',
        descricao: 'TED RECEBIDA CLIENTE ALFA',
        nossoNumero: '000987654',
      },
      'conta_itau_1',
    )

    const fp2 = calcularFingerprintTransacao(
      {
        data: '2026-04-15 12:00:00.000Z',
        valor: 1500.5,
        tipo: 'entrada',
        descricao: 'TED Recebida Cliente Alfa',
        nossoNumero: '987654', // mesmo número sem zero
      },
      'conta_itau_1',
    )

    expect(fp1).toBe(fp2)
  })

  it('calcula hash de arquivo de forma consistente', async () => {
    const conteudo = '001000000000020retorno...'
    const h1 = await calcularHashArquivo(conteudo)
    const h2 = await calcularHashArquivo(conteudo)
    expect(h1).toBe(h2)
    expect(h1.length).toBeGreaterThan(10)
  })

  it('detecta arquivo 100% duplicado (reimportação acidental)', () => {
    const transacoesCandidatas = [
      {
        data: '2026-04-10',
        valor: 500,
        tipo: 'entrada' as const,
        descricao: 'TED 1',
        fitid: 'fit_1',
      },
      {
        data: '2026-04-11',
        valor: 120,
        tipo: 'saida' as const,
        descricao: 'PAGTO LUZ',
        fitid: 'fit_2',
      },
    ]

    const transacoesExistentes: ExtratoTransacaoRecord[] = [
      {
        id: 'tx_exist_1',
        collectionId: 'col_tx',
        collectionName: 'extratos_transacoes',
        created: '2026-04-10',
        updated: '2026-04-10',
        extrato: 'ext_1',
        data: '2026-04-10',
        valor: 500,
        tipo: 'entrada',
        descricao: 'TED 1',
        status_conciliacao: 'pendente',
      },
      {
        id: 'tx_exist_2',
        collectionId: 'col_tx',
        collectionName: 'extratos_transacoes',
        created: '2026-04-11',
        updated: '2026-04-11',
        extrato: 'ext_1',
        data: '2026-04-11',
        valor: 120,
        tipo: 'saida',
        descricao: 'PAGTO LUZ',
        status_conciliacao: 'pendente',
      },
    ]

    const extratosExistentes: ExtratoRecord[] = [
      {
        id: 'ext_1',
        collectionId: 'col_ext',
        collectionName: 'extratos',
        created: '2026-04-11',
        updated: '2026-04-11',
        nome_arquivo: 'extrato_abril.ofx',
        formato: 'ofx',
        conta_bancaria: 'conta_1',
        total_transacoes: 2,
        total_entradas: 500,
        total_saidas: 120,
      },
    ]

    const resultado = analisarDeduplicacao({
      arquivoNome: 'extrato_abril.ofx',
      contaBancariaId: 'conta_1',
      transacoesCandidatas,
      transacoesExistentes,
      extratosExistentes,
    })

    expect(resultado.arquivoJaImportado).toBe(true)
    expect(resultado.totalNovas).toBe(0)
    expect(resultado.totalDuplicadas).toBe(2)
    expect(resultado.itensNovos.length).toBe(0)
    expect(resultado.itensDuplicados.length).toBe(2)
  })

  it('preserva apenas lançamentos novos em caso de sobreposição parcial (ex.: .RET e OFX do mesmo mês)', () => {
    // Banco já tem transação de 500 e 120
    const transacoesExistentes: ExtratoTransacaoRecord[] = [
      {
        id: 'tx_exist_1',
        collectionId: 'col_tx',
        collectionName: 'extratos_transacoes',
        created: '2026-04-10',
        updated: '2026-04-10',
        extrato: 'ext_1',
        data: '2026-04-10',
        valor: 500,
        tipo: 'entrada',
        descricao: 'Boleto Liquidado [Nº 12345]',
        documento_ref: '12345',
        status_conciliacao: 'pendente',
      },
    ]

    // Novo arquivo traz a mesma de 500 (já existente) + 2 novas
    const transacoesCandidatas = [
      {
        data: '2026-04-10',
        valor: 500,
        tipo: 'entrada' as const,
        descricao: 'Boleto Liquidado [Nº 12345]',
        nossoNumero: '12345',
      },
      {
        data: '2026-04-12',
        valor: 2450.0,
        tipo: 'entrada' as const,
        descricao: 'Crédito Cobrança [Nº 99999]',
        nossoNumero: '99999',
      },
      {
        data: '2026-04-13',
        valor: 15.0,
        tipo: 'saida' as const,
        descricao: 'Tarifa bancária de cobrança',
      },
    ]

    const resultado = analisarDeduplicacao({
      arquivoNome: 'retorno_novo.ret',
      contaBancariaId: 'conta_1',
      transacoesCandidatas,
      transacoesExistentes,
    })

    expect(resultado.arquivoJaImportado).toBe(false)
    expect(resultado.totalCandidatas).toBe(3)
    expect(resultado.totalNovas).toBe(2)
    expect(resultado.totalDuplicadas).toBe(1)
    expect(resultado.itensNovos.map((i) => i.item.valor)).toEqual([2450.0, 15.0])
    expect(resultado.itensDuplicados[0].transacaoExistenteId).toBe('tx_exist_1')
  })

  it('deduplica transações idênticas que aparecem mais de uma vez no mesmo arquivo', () => {
    const transacoesCandidatas = [
      {
        data: '2026-04-15',
        valor: 100,
        tipo: 'saida' as const,
        descricao: 'Combustível Posto',
      },
      {
        data: '2026-04-15',
        valor: 100,
        tipo: 'saida' as const,
        descricao: 'Combustível Posto',
      },
    ]

    const resultado = analisarDeduplicacao({
      arquivoNome: 'extrato.csv',
      contaBancariaId: 'conta_1',
      transacoesCandidatas,
      transacoesExistentes: [],
    })

    expect(resultado.totalNovas).toBe(1)
    expect(resultado.totalDuplicadas).toBe(1)
    expect(resultado.itensDuplicados[0].motivoDuplicidade).toContain(
      'duplicada dentro do próprio arquivo',
    )
  })
})
