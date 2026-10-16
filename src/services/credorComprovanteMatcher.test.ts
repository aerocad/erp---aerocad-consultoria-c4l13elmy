import { describe, it, expect } from 'vitest'
import {
  extrairDocumentoDeTexto,
  inferirCategoriaCredorPorConta,
  encontrarCredorCorrespondente,
  extrairDadosEstabelecimentoConta,
} from './credorComprovanteMatcher'
import type { ContaPagarRecord, CredorRecord } from '@/types/crm'

describe('credorComprovanteMatcher', () => {
  it('deve extrair CNPJ de texto com máscara e sem máscara', () => {
    expect(
      extrairDocumentoDeTexto('Pagamento referente NF 123 CNPJ: 12.345.678/0001-90 banco'),
    ).toBe('12.345.678/0001-90')
    expect(extrairDocumentoDeTexto('Posto Combustível 12345678000190')).toBe('12.345.678/0001-90')
  })

  it('deve inferir categoria de credor corretamente a partir do nome ou categoria da conta', () => {
    expect(inferirCategoriaCredorPorConta('impostos', 'Receita Federal')).toBe(
      'impostos_orgaos_publicos',
    )
    expect(inferirCategoriaCredorPorConta('utilidades', 'CEMIG Distribuição')).toBe('utilidades')
    expect(inferirCategoriaCredorPorConta('terceirizados', 'Consultoria e Engenharia Aero')).toBe(
      'fornecedor_servicos',
    )
  })

  it('deve encontrar credor correspondente por documento exato', () => {
    const credores = [
      {
        id: 'c1',
        collectionId: 'credores',
        collectionName: 'credores',
        nome_razao_social: 'Auto Posto Confiança Ltda',
        cnpj_cpf: '12.345.678/0001-90',
        tipo_pessoa: 'pj',
        categoria: 'outros',
        status: 'ativo',
        created: '',
        updated: '',
      },
    ] as CredorRecord[]

    const match = encontrarCredorCorrespondente('Posto Qualquer', '12.345.678/0001-90', credores)
    expect(match).not.toBeNull()
    expect(match?.credor.id).toBe('c1')
    expect(match?.motivo).toBe('documento_exato')
  })

  it('deve encontrar credor correspondente por nome semelhante quando documento não coincide', () => {
    const credores = [
      {
        id: 'c2',
        collectionId: 'credores',
        collectionName: 'credores',
        nome_razao_social: 'CEMIG DISTRIBUICAO S.A.',
        cnpj_cpf: '06.981.180/0001-16',
        tipo_pessoa: 'pj',
        categoria: 'utilidades',
        status: 'ativo',
        created: '',
        updated: '',
      },
    ] as CredorRecord[]

    const match = encontrarCredorCorrespondente('CEMIG Distribuição', '', credores)
    expect(match).not.toBeNull()
    expect(match?.credor.id).toBe('c2')
    expect(match?.motivo).toBe('nome_semelhante')
  })

  it('deve extrair dados da conta a pagar com comprovante', () => {
    const conta = {
      id: 'cp1',
      collectionId: 'contas_pagar',
      collectionName: 'contas_pagar',
      descricao: 'Abastecimento Frota',
      fornecedor: 'Posto Ipiranga Shell',
      cnpj_cpf_beneficiario: '22.333.444/0001-55',
      valor: 250,
      data_vencimento: '2026-04-10',
      status: 'pendente',
      categoria: 'outros',
      forma_pagamento: 'pix',
      comprovante: ['arquivo.pdf'],
      created: '',
      updated: '',
    } as ContaPagarRecord

    const resultado = extrairDadosEstabelecimentoConta(conta, [])
    expect(resultado.temComprovante).toBe(true)
    expect(resultado.temDadosValidos).toBe(true)
    expect(resultado.nome).toBe('Posto Ipiranga Shell')
    expect(resultado.cnpjCpf).toBe('22.333.444/0001-55')
    expect(resultado.tipoPessoa).toBe('pj')
  })
})
