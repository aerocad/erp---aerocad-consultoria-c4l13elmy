import { describe, it, expect } from 'vitest'
import {
  parseCnabRetorno,
  parseCnabValor,
  parseCnabData,
  descreverOcorrencia,
} from './cnabRetornoParser'

describe('cnabRetornoParser', () => {
  it('converte valores em centavos corretamente', () => {
    expect(parseCnabValor('00000000125050')).toBe(1250.5)
    expect(parseCnabValor('00000000005000')).toBe(50)
    expect(parseCnabValor('')).toBe(0)
    expect(parseCnabValor('00000000000000')).toBe(0)
  })

  it('converte datas DDMMAAAA e DDMMAA corretamente', () => {
    expect(parseCnabData('15042026')).toBe('2026-04-15')
    expect(parseCnabData('150426')).toBe('2026-04-15')
    expect(parseCnabData('00000000')).toBeUndefined()
    expect(parseCnabData('')).toBeUndefined()
  })

  it('descreve códigos de ocorrência mais comuns em pt-BR', () => {
    expect(descreverOcorrencia('06')).toContain('Liquidação normal')
    expect(descreverOcorrencia('09')).toContain('Baixa de título')
    expect(descreverOcorrencia('02')).toContain('Entrada confirmada')
    expect(descreverOcorrencia('17')).toContain('Liquidação')
    expect(descreverOcorrencia('28')).toContain('tarifas')
  })

  it('decodifica CNAB 240 com segmentos T e U', () => {
    // Monta linha 0 (Header de arquivo 240 posições)
    const h0 =
      '00100000' + // 0-7: banco 001, lote 0000, reg 0
      ' '.repeat(24) +
      '12345678901234567890' + // conv 32-52
      '01234' + // agencia 52-57
      ' ' +
      '000012345678' + // conta 58-70
      '9' + // dig 71-72
      'AEROCAD ENGENHARIA LTDA       ' + // 72-102
      'BANCO DO BRASIL S.A.          ' + // 102-132
      ' '.repeat(11) +
      '15042026' + // 143-151 data geracao
      ' '.repeat(89)

    expect(h0.length).toBe(240)

    // Segmento T (lote 0001, seq 00001, reg 3, seg T)
    const segT =
      '0010001300001' + // 0-13
      'T' + // 13-14
      ' ' + // 14-15
      '06' + // 15-17 ocorrencia 06
      ' '.repeat(20) + // 17-37
      '00000000001234567890' + // 37-57 nosso numero
      'DOC-2026-001   ' + // 58-73 seu numero
      '15042026' + // 73-81 vencimento
      '000000000150000' + // 81-96 valor R$ 1.500,00
      ' '.repeat(37) + // 96-133
      '12345678000199 ' + // 133-148 cpf/cnpj
      'CLIENTE AEROPORTO BRASIL SA             ' + // 148-188 pagador
      ' '.repeat(10) + // 188-198
      '00000000000350 ' + // 198-213 tarifa R$ 3,50
      ' '.repeat(27)

    expect(segT.length).toBe(240)

    // Segmento U (lote 0001, seq 00002, reg 3, seg U)
    const segU =
      '0010001300002' + // 0-13
      'U' + // 13-14
      ' ' + // 14-15
      '06' + // 15-17
      '000000000000000' + // 17-32 juros
      '000000000000000' + // 32-47 desconto
      '000000000000000' + // 47-62 abatimento
      ' '.repeat(15) + // 62-77
      '000000000150000' + // 77-92 valor pago 1.500,00
      '000000000150000' + // 92-107 valor liquido 1.500,00
      ' '.repeat(30) + // 107-137
      '15042026' + // 137-145 data ocorrencia
      '16042026' + // 145-153 data credito
      ' '.repeat(87)

    expect(segU.length).toBe(240)

    const retContent = `${h0}\n${segT}\n${segU}`
    const result = parseCnabRetorno(retContent)

    expect(result.layout).toBe('CNAB240')
    expect(result.bancoCodigo).toBe('001')
    expect(result.bancoNome).toBe('Banco do Brasil')
    expect(result.totalTransacoes).toBe(1)
    expect(result.totalEntradas).toBe(1500)
    expect(result.transacoes[0].valor).toBe(1500)
    expect(result.transacoes[0].data).toBe('2026-04-16')
    expect(result.transacoes[0].nossoNumero).toBe('00000000001234567890')
    expect(result.transacoes[0].pagadorNome).toBe('CLIENTE AEROPORTO BRASIL SA')
    expect(result.transacoes[0].codigoOcorrencia).toBe('06')
  })

  it('decodifica CNAB 400 com registro 0 e registro 1', () => {
    // Header CNAB 400 (400 posições)
    const h0 =
      '0' + // 0-1
      '2' + // 1-2
      'RETORNO' + // 2-9
      '01' + // 9-11
      'COBRANCA       ' + // 11-26
      '1234' + // 26-30 agencia
      '12345678' + // 30-38 conta
      '9' + // 38-39 dac
      ' '.repeat(7) + // 39-46
      'AEROCAD ENGENHARIA LTDA       ' + // 46-76
      '341' + // 76-79 banco Itau
      'BANCO ITAU SA  ' + // 79-94
      '150426' + // 94-100 data geracao
      ' '.repeat(300)

    expect(h0.length).toBe(400)

    // Detalhe CNAB 400 tipo 1
    const d1 =
      '1' + // 0-1
      ' '.repeat(69) + // 1-70
      '000000001234' + // 70-82 nosso numero
      ' '.repeat(26) + // 82-108
      '06' + // 108-110 ocorrencia 06 liquidacao
      '150426' + // 110-116 data liquidacao
      'SEU-NUM-456   ' + // 116-130 seu numero
      ' '.repeat(16) + // 130-146
      '150426' + // 146-152 vencimento
      '0000000250000' + // 152-165 valor titulo R$ 2.500,00
      ' '.repeat(87) + // 165-252
      '0000000250000' + // 253-266 valor pago R$ 2.500,00
      ' '.repeat(28) + // 266-294
      ' ' + // 294-295
      '160426' + // 295-301 data credito
      ' '.repeat(23) + // 301-324
      'CONSTRUTORA HORIZONTE S/A     ' + // 324-354 pagador
      ' '.repeat(46)

    expect(d1.length).toBe(400)

    const retContent = `${h0}\r\n${d1}`
    const result = parseCnabRetorno(retContent)

    expect(result.layout).toBe('CNAB400')
    expect(result.bancoCodigo).toBe('341')
    expect(result.bancoNome).toBe('Itaú Unibanco')
    expect(result.totalTransacoes).toBe(1)
    expect(result.totalEntradas).toBe(2500)
    expect(result.transacoes[0].valor).toBe(2500)
    expect(result.transacoes[0].data).toBe('2026-04-16')
    expect(result.transacoes[0].codigoOcorrencia).toBe('06')
    expect(result.transacoes[0].pagadorNome).toBe('CONSTRUTORA HORIZONTE S/A')
  })
})
