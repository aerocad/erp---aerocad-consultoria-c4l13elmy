import { describe, expect, it } from 'vitest'
import {
  obterHoraBrasilia,
  saudacaoPorHora,
  montarSaudacao,
  FUSO_HORARIO_BRASILIA,
} from './saudacao'
import { formatDateLong, formatDateBrasilia } from './format'

describe('Helper de Saudação por Hora (Brasília / America/Sao_Paulo)', () => {
  it('identifica corretamente o fuso de Brasília como America/Sao_Paulo', () => {
    expect(FUSO_HORARIO_BRASILIA).toBe('America/Sao_Paulo')
  })

  it('classifica "Bom dia" das 05:00 às 11:59 no horário de Brasília', () => {
    // 05:00 BRT corresponde a 08:00 UTC (fora de horário de verão, UTC-3)
    const data0500BRT = new Date('2026-06-15T08:00:00Z')
    expect(obterHoraBrasilia(data0500BRT)).toBe(5)
    expect(saudacaoPorHora(data0500BRT)).toBe('Bom dia')

    // 08:30 BRT = 11:30 UTC
    const data0830BRT = new Date('2026-06-15T11:30:00Z')
    expect(obterHoraBrasilia(data0830BRT)).toBe(8)
    expect(saudacaoPorHora(data0830BRT)).toBe('Bom dia')

    // 11:59 BRT = 14:59 UTC
    const data1159BRT = new Date('2026-06-15T14:59:00Z')
    expect(obterHoraBrasilia(data1159BRT)).toBe(11)
    expect(saudacaoPorHora(data1159BRT)).toBe('Bom dia')
  })

  it('classifica "Boa tarde" das 12:00 às 17:59 no horário de Brasília', () => {
    // 12:00 BRT = 15:00 UTC
    const data1200BRT = new Date('2026-06-15T15:00:00Z')
    expect(obterHoraBrasilia(data1200BRT)).toBe(12)
    expect(saudacaoPorHora(data1200BRT)).toBe('Boa tarde')

    // 15:45 BRT = 18:45 UTC
    const data1545BRT = new Date('2026-06-15T18:45:00Z')
    expect(obterHoraBrasilia(data1545BRT)).toBe(15)
    expect(saudacaoPorHora(data1545BRT)).toBe('Boa tarde')

    // 17:59 BRT = 20:59 UTC
    const data1759BRT = new Date('2026-06-15T20:59:00Z')
    expect(obterHoraBrasilia(data1759BRT)).toBe(17)
    expect(saudacaoPorHora(data1759BRT)).toBe('Boa tarde')
  })

  it('classifica "Boa noite" das 18:00 às 04:59 no horário de Brasília', () => {
    // 18:00 BRT = 21:00 UTC
    const data1800BRT = new Date('2026-06-15T21:00:00Z')
    expect(obterHoraBrasilia(data1800BRT)).toBe(18)
    expect(saudacaoPorHora(data1800BRT)).toBe('Boa noite')

    // 23:30 BRT = 02:30 UTC do dia seguinte
    const data2330BRT = new Date('2026-06-16T02:30:00Z')
    expect(obterHoraBrasilia(data2330BRT)).toBe(23)
    expect(saudacaoPorHora(data2330BRT)).toBe('Boa noite')

    // 00:05 BRT = 03:05 UTC
    const data0005BRT = new Date('2026-06-16T03:05:00Z')
    expect(obterHoraBrasilia(data0005BRT)).toBe(0)
    expect(saudacaoPorHora(data0005BRT)).toBe('Boa noite')

    // 04:59 BRT = 07:59 UTC
    const data0459BRT = new Date('2026-06-16T07:59:00Z')
    expect(obterHoraBrasilia(data0459BRT)).toBe(4)
    expect(saudacaoPorHora(data0459BRT)).toBe('Boa noite')
  })

  it('monta a frase completa corretamente com primeiro nome e opções', () => {
    const dataManha = new Date('2026-06-15T12:00:00Z') // 09:00 BRT
    const dataTarde = new Date('2026-06-15T17:00:00Z') // 14:00 BRT
    const dataNoite = new Date('2026-06-15T23:00:00Z') // 20:00 BRT

    expect(montarSaudacao('Cleyton Saraiva', { referencia: dataManha })).toBe('Bom dia, Cleyton')
    expect(montarSaudacao('Cleyton Saraiva', { referencia: dataTarde })).toBe('Boa tarde, Cleyton')
    expect(montarSaudacao('Cleyton Saraiva', { referencia: dataNoite })).toBe('Boa noite, Cleyton')

    // Sem nome
    expect(montarSaudacao(null, { referencia: dataManha })).toBe('Bom dia')
    expect(montarSaudacao('', { referencia: dataManha, incluirEquipeFallback: true })).toBe(
      'Bom dia, equipe',
    )
  })

  it('formata a data por extenso usando o fuso de Brasília (America/Sao_Paulo)', () => {
    // 2026-02-24 01:00:00 UTC ainda é 2026-02-23 22:00:00 em Brasília (-3h)
    const dataViradaUTC = new Date('2026-02-24T01:00:00Z')
    const textoExtenso = formatDateLong(dataViradaUTC)
    // Em Brasília era segunda-feira, 23 de fevereiro
    expect(textoExtenso.toLowerCase()).toContain('23 de fevereiro')
    expect(formatDateBrasilia(dataViradaUTC)).toBe('23/02/2026')
  })
})
