import { describe, expect, it } from 'vitest'
import {
  buildMailtoUrl,
  gerarAssinaturaPadraoAerocad,
  gerarMinutaCobrancaMedicao,
  gerarMinutaCobrancaNfse,
  gerarMinutaFollowupProcesso,
  gerarMinutaProposta,
} from './minutasEmail'
import type {
  ClienteRecord,
  ExigenciaRecord,
  ParcelaRecord,
  ProcessoRecord,
  ProjetoRecord,
  PropostaRecord,
} from '@/types/crm'

describe('Gerador de Minutas de E-mail AEROCAD', () => {
  const clienteMock = {
    id: 'cli_1',
    razao_social: 'AEROPORTO INTERNACIONAL DO CERRADO S/A',
    cnpj_cpf: '12.345.678/0001-90',
    email: 'financeiro@aeroportocerrado.com.br',
    telefone: '(61) 3333-4444',
    cidade: 'Brasília',
    estado: 'DF',
    status: 'cliente',
    segmento: 'aeroporto_comercial',
    origem: 'indicacao',
  } as unknown as ClienteRecord

  const projetoMock = {
    id: 'proj_1',
    numero: '2026-042',
    nome: 'Plano Básico de Zona de Proteção de Heliponto (PBZPH)',
    cliente: 'cli_1',
    trilha: 'opea',
    fase: 'levantamento',
    status: 'ativo',
    valor_global: 48000,
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
  } as unknown as ProjetoRecord

  const propostaMock = {
    id: 'prop_1',
    numero: 'PC nº 042/2026',
    revisao: 'REV001',
    oportunidade: 'opp_1',
    data_envio: '2026-03-10T12:00:00.000Z',
    valor_total: 48000,
    validade_dias: 30,
    condicoes_pagamento: '30% entrada + 40% protocolo DECEA + 30% homologação ANAC',
    link_drive: 'https://drive.google.com/proposta-pc-042',
    status: 'enviada',
    created: '2026-03-10T12:00:00.000Z',
    updated: '2026-03-10T12:00:00.000Z',
  } as unknown as PropostaRecord

  const parcelaMock = {
    id: 'parc_1',
    projeto: 'proj_1',
    cliente: 'cli_1',
    descricao: 'Medição 02 — Protocolo DECEA SYSAGA',
    numero_parcela_marco: '2ª Medição',
    valor: 19200,
    vencimento: '2026-04-15T12:00:00.000Z',
    data_faturamento: '2026-04-01T12:00:00.000Z',
    status: 'pendente',
    nf_numero: '00124',
    created: '2026-04-01T12:00:00.000Z',
    updated: '2026-04-01T12:00:00.000Z',
  } as unknown as ParcelaRecord

  const processoMock = {
    id: 'proc_1',
    projeto: 'proj_1',
    orgao: 'DECEA',
    numero_protocolo: 'SYSAGA-2026-09871',
    data_protocolo: '2026-02-15T12:00:00.000Z',
    prazo_orgao: '2026-04-30T12:00:00.000Z',
    status: 'em_exigencia',
    created: '2026-02-15T12:00:00.000Z',
    updated: '2026-02-15T12:00:00.000Z',
  } as unknown as ProcessoRecord

  const exigenciasMock = [
    {
      id: 'ex_1',
      processo: 'proc_1',
      descricao: 'Apresentar certidão de coordenadas geográficas no padrão WGS-84.',
      prazo: '2026-04-20T12:00:00.000Z',
      status: 'pendente',
      created: '2026-03-01T12:00:00.000Z',
      updated: '2026-03-01T12:00:00.000Z',
    },
  ] as unknown as ExigenciaRecord[]

  it('1. Modelo PROPOSTA ENVIADA contém dados reais, saudação e assinatura institucional', () => {
    const minuta = gerarMinutaProposta({
      tipo: 'proposta',
      cliente: clienteMock,
      proposta: propostaMock,
      projeto: projetoMock,
      contatoNome: 'Dr. Roberto Mendes',
      contatoEmail: 'roberto@aeroportocerrado.com.br',
    })

    expect(minuta.assunto).toContain('PC nº 042/2026 (REV001)')
    expect(minuta.assunto).toContain('AEROPORTO INTERNACIONAL DO CERRADO S/A')
    expect(minuta.destinatario).toBe('roberto@aeroportocerrado.com.br')
    expect(minuta.corpo).toContain('Dr. Roberto Mendes')
    expect(minuta.corpo).toContain('R$ 48.000,00')
    expect(minuta.corpo).toContain('https://drive.google.com/proposta-pc-042')
    expect(minuta.corpo).toContain('AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA')
    expect(minuta.corpo).toContain('CNPJ: 28.036.597/0001-43')
  })

  it('2. Modelo COBRANÇA DE MEDIÇÃO inclui dados bancários da AEROCAD e chave PIX CNPJ', () => {
    const minuta = gerarMinutaCobrancaMedicao({
      tipo: 'cobranca_medicao',
      cliente: clienteMock,
      projeto: projetoMock,
      parcela: parcelaMock,
      contatoNome: 'Diretoria Financeira',
      contatoEmail: clienteMock.email,
    })

    expect(minuta.assunto).toContain('Medição 2ª Medição')
    expect(minuta.assunto).toContain('2026-042')
    expect(minuta.corpo).toContain('R$ 19.200,00')
    expect(minuta.corpo).toContain('CHAVE PIX (CNPJ): 28036597000143')
    expect(minuta.corpo).toContain('Banco: Santander')
    expect(minuta.corpo).toContain('28.036.597/0001-43')
  })

  it('3. Modelo COBRANÇA DE NFS-E solicita nota e informa tomador AEROCAD', () => {
    const minuta = gerarMinutaCobrancaNfse({
      tipo: 'cobranca_nfse',
      cliente: clienteMock,
      projeto: projetoMock,
      parcela: parcelaMock,
      contatoNome: 'Setor Fiscal',
      contatoEmail: clienteMock.email,
    })

    expect(minuta.assunto).toContain('Solicitação de emissão de NFS-e')
    expect(minuta.assunto).toContain('Medição 2ª Medição')
    expect(minuta.corpo).toContain('AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA')
    expect(minuta.corpo).toContain('28.036.597/0001-43')
    expect(minuta.corpo).toContain('SBS Quadra 2 Sala 206 Sobrelota')
    expect(minuta.corpo).toContain('R$ 19.200,00')
    expect(minuta.corpo).toContain('CHAVE PIX (CNPJ): 28036597000143')
  })

  it('4. Modelo FOLLOW-UP DE PROCESSO cita protocolo, órgão e exigências em aberto', () => {
    const minuta = gerarMinutaFollowupProcesso({
      tipo: 'followup_processo',
      cliente: clienteMock,
      projeto: projetoMock,
      processo: processoMock,
      exigencias: exigenciasMock,
    })

    expect(minuta.assunto).toContain('SYSAGA-2026-09871')
    expect(minuta.assunto).toContain('DECEA')
    expect(minuta.corpo).toContain('SYSAGA-2026-09871')
    expect(minuta.corpo).toContain('Em Exigência Técnica')
    expect(minuta.corpo).toContain('certidão de coordenadas geográficas no padrão WGS-84')
    expect(minuta.corpo).toContain('2026-042')
  })

  it('5. buildMailtoUrl constrói URL mailto com subject e body encodados', () => {
    const url = buildMailtoUrl(
      'teste@cliente.com',
      'Assunto de Teste',
      'Corpo com acentuação e quebra\nde linha',
    )
    expect(url.startsWith('mailto:teste%40cliente.com?')).toBe(true)
    expect(url).toContain('subject=Assunto%20de%20Teste')
    expect(url).toContain('body=Corpo%20com')
  })

  it('6. Assinatura padrão centralizada preserva dados institucionais oficiais', () => {
    const assinatura = gerarAssinaturaPadraoAerocad()
    expect(assinatura).toContain('AEROCAD CONSULTORIA & AEROPORTOS')
    expect(assinatura).toContain('AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA')
    expect(assinatura).toContain('28.036.597/0001-43')
    expect(assinatura).toContain('Brasília/DF')
  })
})
