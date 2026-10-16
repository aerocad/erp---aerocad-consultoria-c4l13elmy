/**
 * Parser nativo para arquivos de retorno bancário (.RET / CNAB 240 e CNAB 400).
 * Padrão FEBRABAN e bancos brasileiros: Banco do Brasil (001), Santander (033),
 * Caixa (104), Bradesco (237), Itaú (341), Sicoob (756), Sicredi (748), Safra (422) etc.
 */

export interface CnabTransacaoParsed {
  fitid: string
  tipo: 'entrada' | 'saida'
  data: string // YYYY-MM-DD (data do crédito ou da liquidação/ocorrência)
  dataVencimento?: string // YYYY-MM-DD
  dataOcorrencia?: string // YYYY-MM-DD
  dataCredito?: string // YYYY-MM-DD
  valor: number // Valor nominal / valor pago líquido
  valorOriginal: number
  valorTitulo?: number
  valorPago?: number
  valorTarifa?: number
  valorJurosMulta?: number
  valorDesconto?: number
  descricao: string
  documentoRef?: string // Seu número / Documento
  nossoNumero?: string // Identificador do boleto no banco
  linhaDigitavel?: string
  codigoOcorrencia: string // Ex: '06', '02', '09', '17'
  ocorrenciaDescricao: string
  pagadorNome?: string
  pagadorCpfCnpj?: string
  segmento?: 'T' | 'U' | '1'
  linhaNumero: number
  layout: 'CNAB240' | 'CNAB400'
  bancoCodigo?: string
}

export interface CnabAvisoRegistro {
  linha: number
  mensagem: string
  conteudoLinha?: string
}

export interface CnabOcorrenciaResumo {
  codigo: string
  descricao: string
  quantidade: number
  valorTotal: number
}

export interface CnabRetornoParsed {
  layout: 'CNAB240' | 'CNAB400'
  bancoCodigo: string
  bancoNome: string
  agencia?: string
  conta?: string
  contaDigito?: string
  convenio?: string
  empresaNome?: string
  dataGeracao?: string // YYYY-MM-DD
  dataInicio?: string // Menor data de movimentação
  dataFim?: string // Maior data de movimentação
  totalRegistros: number
  totalTransacoes: number
  totalEntradas: number
  totalSaidas: number
  qtdEntradas: number
  qtdSaidas: number
  ocorrenciasResumo: CnabOcorrenciaResumo[]
  transacoes: CnabTransacaoParsed[]
  avisos: CnabAvisoRegistro[]
}

/**
 * Tabela de bancos conhecidos
 */
export const BANCOS_BRASIL: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '104': 'Caixa Econômica Federal',
  '237': 'Bradesco',
  '341': 'Itaú Unibanco',
  '756': 'Sicoob',
  '748': 'Sicredi',
  '422': 'Banco Safra',
  '077': 'Banco Inter',
  '260': 'Nubank',
  '212': 'Banco Original',
  '041': 'Banrisul',
  '070': 'BRB',
}

/**
 * Mapeamento das principais ocorrências de cobrança bancária
 * Febraban padrão + Bancos comerciais (Itaú, Bradesco, BB, Caixa, Santander, Sicoob)
 */
export const OCORRENCIAS_CNAB_MAP: Record<string, string> = {
  '02': 'Entrada confirmada (título registrado)',
  '03': 'Entrada rejeitada',
  '04': 'Transferência de carteira (entrada)',
  '05': 'Transferência de carteira (baixa)',
  '06': 'Liquidação normal (boleto pago)',
  '07': 'Liquidação por conta (parcial)',
  '08': 'Liquidação em cartório',
  '09': 'Baixa de título (solicitada/automática)',
  '10': 'Baixa por ter sido protestado',
  '11': 'Em ser (em cobrança)',
  '12': 'Abatimento concedido',
  '13': 'Abatimento cancelado',
  '14': 'Vencimento alterado',
  '15': 'Liquidação em cartório s/ compensação',
  '16': 'Título pago em cheque',
  '17': 'Liquidação após baixa / Baixa rejeitada',
  '19': 'Confirmação de recebimento de instrução de protesto',
  '20': 'Confirmação de recebimento de instrução de sustação',
  '23': 'Título enviado a cartório',
  '24': 'Instrução de protesto rejeitada/sustada',
  '25': 'Alegações do sacado / Instrução não acatada',
  '26': 'Instrução de protesto cancelada',
  '27': 'Confirmação de alteração de dados',
  '28': 'Débito de tarifas / custas',
  '30': 'Alteração de outros dados rejeitada',
  '35': 'Confirmação de cancelamento de despesas de cartório',
  '43': 'Liquidação de título protestado',
  '44': 'Cheque pré-datado compensado',
}

/**
 * Converte valor em centavos fixos (ex: "0000000125050" -> 1250.50)
 */
export function parseCnabValor(raw: string): number {
  if (!raw) return 0
  const digits = raw.replace(/\D/g, '').trim()
  if (!digits) return 0
  const num = parseInt(digits, 10)
  if (isNaN(num)) return 0
  return num / 100
}

/**
 * Converte data DDMMAAAA ou DDMMAA para YYYY-MM-DD
 */
export function parseCnabData(raw: string): string | undefined {
  if (!raw) return undefined
  const digits = raw.replace(/\D/g, '').trim()
  if (!digits || digits === '000000' || digits === '00000000') return undefined

  if (digits.length === 8) {
    const d = digits.slice(0, 2)
    const m = digits.slice(2, 4)
    const y = digits.slice(4, 8)
    const day = parseInt(d, 10)
    const month = parseInt(m, 10)
    const year = parseInt(y, 10)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1990 && year <= 2100) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  } else if (digits.length === 6) {
    const d = digits.slice(0, 2)
    const m = digits.slice(2, 4)
    const yRaw = digits.slice(4, 6)
    const day = parseInt(d, 10)
    const month = parseInt(m, 10)
    const yNum = parseInt(yRaw, 10)
    const fullYear = yNum >= 70 ? 1900 + yNum : 2000 + yNum
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }
  return undefined
}

/**
 * Mapeia descrição amigável para o código de ocorrência
 */
export function descreverOcorrencia(codigo: string): string {
  const limpo = codigo.padStart(2, '0')
  return OCORRENCIAS_CNAB_MAP[limpo] || `Ocorrência bancária cód. ${codigo}`
}

/**
 * Identifica se a ocorrência representa entrada financeira (liquidação/pagamento do título)
 */
export function isOcorrenciaLiquidacao(codigo: string): boolean {
  const cod = codigo.padStart(2, '0')
  // 06 (Liquidação normal), 07 (Liquidação parcial), 08 (Cartório), 15, 16, 17, 43
  return ['06', '07', '08', '15', '16', '17', '43'].includes(cod)
}

/**
 * Identifica se a ocorrência representa débito / tarifa bancária
 */
export function isOcorrenciaTarifa(codigo: string): boolean {
  const cod = codigo.padStart(2, '0')
  return ['28'].includes(cod)
}

/**
 * Parser de retorno CNAB 240 (Padrão FEBRABAN)
 * Registros de 240 caracteres:
 * - Tipo 0: Header de Arquivo
 * - Tipo 1: Header de Lote
 * - Tipo 3: Detalhe (Segmento T e Segmento U de cobrança)
 * - Tipo 5: Trailer de Lote
 * - Tipo 9: Trailer de Arquivo
 */
function parseCnab240(lines: string[]): CnabRetornoParsed {
  let bancoCodigo = '001'
  let bancoNome = 'Banco Comercial'
  let empresaNome = ''
  let agencia = ''
  let conta = ''
  let contaDigito = ''
  let convenio = ''
  let dataGeracao: string | undefined

  const avisos: CnabAvisoRegistro[] = []
  const transacoes: CnabTransacaoParsed[] = []

  // Mapa para casar Segmento T com Segmento U subsequente (mesmo lote e sequência)
  interface SegmentoTPendente {
    linhaNum: number
    lote: string
    sequencial: string
    banco: string
    codigoOcorrencia: string
    vencimento?: string
    valorTitulo: number
    tarifa: number
    nossoNumero: string
    seuNumero: string
    pagadorNome?: string
    pagadorCpfCnpj?: string
  }

  const segmentosTPendentes = new Map<string, SegmentoTPendente>()

  for (let idx = 0; idx < lines.length; idx++) {
    const linha = lines[idx]
    const linhaNum = idx + 1
    if (linha.length < 200) {
      if (linha.trim().length > 0) {
        avisos.push({
          linha: linhaNum,
          mensagem: `Linha menor que 240 posições (${linha.length} caracteres). Ignorada.`,
          conteudoLinha: linha.slice(0, 40),
        })
      }
      continue
    }

    const bancoReg = linha.slice(0, 3)
    const lote = linha.slice(3, 7)
    const tipoRegistro = linha.charAt(7)

    // Tipo 0: Header de Arquivo
    if (tipoRegistro === '0') {
      bancoCodigo = bancoReg
      bancoNome = BANCOS_BRASIL[bancoCodigo] || linha.slice(102, 132).trim() || 'Banco Comercial'
      empresaNome = linha.slice(72, 102).trim()
      agencia = linha.slice(52, 57).trim()
      conta = linha.slice(58, 70).trim()
      contaDigito = linha.slice(71, 72).trim()
      convenio = linha.slice(32, 52).trim()
      dataGeracao = parseCnabData(linha.slice(143, 151))
      continue
    }

    // Tipo 1: Header de Lote
    if (tipoRegistro === '1') {
      if (!empresaNome) empresaNome = linha.slice(73, 103).trim()
      if (!agencia) agencia = linha.slice(53, 58).trim()
      if (!conta) conta = linha.slice(59, 71).trim()
      continue
    }

    // Tipo 3: Segmento de Detalhe
    if (tipoRegistro === '3') {
      const segmento = linha.charAt(13).toUpperCase()
      const sequencial = linha.slice(8, 13).trim()

      if (segmento === 'T') {
        // Segmento T: Dados do Título (Cobrança)
        // Pos 14-15: Código de Movimento / Ocorrência
        const codigoOcorrencia = linha.slice(15, 17).trim()
        const nossoNumero = linha.slice(37, 57).trim()
        const vencimento = parseCnabData(linha.slice(73, 81))
        const valorTitulo = parseCnabValor(linha.slice(81, 96))
        const tarifa = parseCnabValor(linha.slice(198, 213))
        const seuNumero = linha.slice(58, 73).trim()
        const pagadorNome = linha.slice(148, 188).trim()
        const pagadorCpfCnpj = linha.slice(133, 148).trim()

        const chaveT = `${lote}_${sequencial}`
        segmentosTPendentes.set(chaveT, {
          linhaNum,
          lote,
          sequencial,
          banco: bancoReg,
          codigoOcorrencia,
          vencimento,
          valorTitulo,
          tarifa,
          nossoNumero,
          seuNumero,
          pagadorNome,
          pagadorCpfCnpj,
        })
      } else if (segmento === 'U') {
        // Segmento U: Dados da Liquidação / Pagamento
        // Pos 16-17: Código de Movimento / Ocorrência
        const codigoOcorrenciaU = linha.slice(15, 17).trim()
        const valorJurosMulta = parseCnabValor(linha.slice(17, 32))
        const valorDesconto = parseCnabValor(linha.slice(32, 47))
        const valorAbatimento = parseCnabValor(linha.slice(47, 62))
        const valorPago = parseCnabValor(linha.slice(77, 92))
        const valorLiquido = parseCnabValor(linha.slice(92, 107))
        const dataOcorrencia = parseCnabData(linha.slice(137, 145))
        const dataCredito = parseCnabData(linha.slice(145, 153))

        // Busca o segmento T associado (normalmente sequencial anterior: -1)
        const seqNum = parseInt(sequencial, 10)
        let segT: SegmentoTPendente | undefined
        for (let s = seqNum - 1; s >= 0 && s >= seqNum - 3; s--) {
          const testKey = `${lote}_${String(s).padStart(5, '0')}`
          if (segmentosTPendentes.has(testKey)) {
            segT = segmentosTPendentes.get(testKey)
            segmentosTPendentes.delete(testKey)
            break
          }
        }
        if (!segT && segmentosTPendentes.size > 0) {
          // Pega o primeiro pendente do mesmo lote
          for (const [k, v] of segmentosTPendentes.entries()) {
            if (v.lote === lote) {
              segT = v
              segmentosTPendentes.delete(k)
              break
            }
          }
        }

        const codigoOcorrenciaFinal = segT?.codigoOcorrencia || codigoOcorrenciaU || '06'
        const ocorrenciaDescricao = descreverOcorrencia(codigoOcorrenciaFinal)

        const valorEfetivo =
          valorLiquido > 0 ? valorLiquido : valorPago > 0 ? valorPago : segT?.valorTitulo || 0

        const isLiquidacao = isOcorrenciaLiquidacao(codigoOcorrenciaFinal)
        const isTarifa = isOcorrenciaTarifa(codigoOcorrenciaFinal)
        const tipo: 'entrada' | 'saida' = isTarifa ? 'saida' : 'entrada'

        const dataEfetiva =
          dataCredito ||
          dataOcorrencia ||
          segT?.vencimento ||
          dataGeracao ||
          new Date().toISOString().slice(0, 10)

        const nossoNumero = segT?.nossoNumero || ''
        const docRef = segT?.seuNumero || nossoNumero || ''
        const pagador = segT?.pagadorNome || ''

        const fitid = `ret240_${bancoReg}_L${lote}_S${sequencial}_${dataEfetiva.replace(/-/g, '')}_${Math.round(valorEfetivo * 100)}`

        let desc = isLiquidacao
          ? `Boleto Liquidado (${ocorrenciaDescricao})`
          : `Retorno Cobrança: ${ocorrenciaDescricao}`

        if (pagador) {
          desc += ` — ${pagador}`
        }
        if (nossoNumero) {
          desc += ` [Nº ${nossoNumero}]`
        }

        transacoes.push({
          fitid,
          tipo,
          data: dataEfetiva,
          dataVencimento: segT?.vencimento,
          dataOcorrencia,
          dataCredito,
          valor: Math.abs(valorEfetivo),
          valorOriginal: isTarifa ? -Math.abs(valorEfetivo) : valorEfetivo,
          valorTitulo: segT?.valorTitulo,
          valorPago: valorPago || valorEfetivo,
          valorTarifa: segT?.tarifa,
          valorJurosMulta,
          valorDesconto: valorDesconto + valorAbatimento,
          descricao: desc,
          documentoRef: docRef,
          nossoNumero,
          codigoOcorrencia: codigoOcorrenciaFinal,
          ocorrenciaDescricao,
          pagadorNome: pagador,
          pagadorCpfCnpj: segT?.pagadorCpfCnpj,
          segmento: 'U',
          linhaNumero: linhaNum,
          layout: 'CNAB240',
          bancoCodigo: bancoReg,
        })
      }
    }
  }

  // Se restaram segmentos T que não tiveram segmento U (ex: títulos registrados ou baixados sem liquidação)
  for (const [, pendente] of segmentosTPendentes) {
    const isLiquidacao = isOcorrenciaLiquidacao(pendente.codigoOcorrencia)
    const isTarifa = isOcorrenciaTarifa(pendente.codigoOcorrencia)
    const descOcorr = descreverOcorrencia(pendente.codigoOcorrencia)
    const dataEfetiva = pendente.vencimento || dataGeracao || new Date().toISOString().slice(0, 10)
    const valorEfetivo = pendente.valorTitulo || pendente.tarifa || 0

    const fitid = `ret240_${pendente.banco}_L${pendente.lote}_S${pendente.sequencial}_T`

    let desc = `Retorno Cobrança: ${descOcorr}`
    if (pendente.pagadorNome) desc += ` — ${pendente.pagadorNome}`
    if (pendente.nossoNumero) desc += ` [Nº ${pendente.nossoNumero}]`

    transacoes.push({
      fitid,
      tipo: isTarifa ? 'saida' : 'entrada',
      data: dataEfetiva,
      dataVencimento: pendente.vencimento,
      valor: Math.abs(valorEfetivo),
      valorOriginal: isTarifa ? -Math.abs(valorEfetivo) : valorEfetivo,
      valorTitulo: pendente.valorTitulo,
      valorTarifa: pendente.tarifa,
      descricao: desc,
      documentoRef: pendente.seuNumero || pendente.nossoNumero,
      nossoNumero: pendente.nossoNumero,
      codigoOcorrencia: pendente.codigoOcorrencia,
      ocorrenciaDescricao: descOcorr,
      pagadorNome: pendente.pagadorNome,
      pagadorCpfCnpj: pendente.pagadorCpfCnpj,
      segmento: 'T',
      linhaNumero: pendente.linhaNum,
      layout: 'CNAB240',
      bancoCodigo: pendente.banco,
    })
  }

  // Ordena por data
  transacoes.sort((a, b) => a.data.localeCompare(b.data))

  return compilarResultado(
    'CNAB240',
    bancoCodigo,
    bancoNome,
    agencia,
    conta,
    contaDigito,
    convenio,
    empresaNome,
    dataGeracao,
    lines.length,
    transacoes,
    avisos,
  )
}

/**
 * Parser de retorno CNAB 400 (Padrão 400 posições tradicional)
 * - Registro 0: Header de Arquivo
 * - Registro 1: Detalhe (Cobrança)
 * - Registro 9: Trailer de Arquivo
 */
function parseCnab400(lines: string[]): CnabRetornoParsed {
  let bancoCodigo = '001'
  let bancoNome = 'Banco Comercial'
  let empresaNome = ''
  let agencia = ''
  let conta = ''
  let contaDigito = ''
  let dataGeracao: string | undefined

  const avisos: CnabAvisoRegistro[] = []
  const transacoes: CnabTransacaoParsed[] = []

  for (let idx = 0; idx < lines.length; idx++) {
    const linha = lines[idx]
    const linhaNum = idx + 1
    if (linha.length < 350) {
      if (linha.trim().length > 0) {
        avisos.push({
          linha: linhaNum,
          mensagem: `Linha com ${linha.length} caracteres (esperado ~400). Ignorada.`,
          conteudoLinha: linha.slice(0, 40),
        })
      }
      continue
    }

    const tipoRegistro = linha.charAt(0)

    // Tipo 0: Header CNAB 400
    if (tipoRegistro === '0') {
      bancoCodigo = linha.slice(76, 79).trim() || linha.slice(0, 3).trim()
      bancoNome = BANCOS_BRASIL[bancoCodigo] || linha.slice(79, 94).trim() || 'Banco Comercial'
      empresaNome = linha.slice(46, 76).trim()
      agencia = linha.slice(26, 30).trim()
      conta = linha.slice(30, 38).trim()
      contaDigito = linha.slice(38, 39).trim()
      dataGeracao = parseCnabData(linha.slice(94, 100))
      continue
    }

    // Tipo 1: Detalhe CNAB 400
    if (tipoRegistro === '1') {
      // Posição de ocorrência típica: 108-110 (109-110 em 1-based = pos 108-110 em 0-based)
      const codigoOcorrencia = linha.slice(108, 110).trim()
      const ocorrenciaDescricao = descreverOcorrencia(codigoOcorrencia)

      // Nosso Número: posições variam um pouco por banco (Bradesco 70-82, Itaú 62-70/85-93, BB 63-80)
      // Extraímos heurística das posições 62-85
      const nossoNumero =
        linha.slice(70, 82).trim() || linha.slice(62, 79).trim() || linha.slice(85, 95).trim()

      // Seu número / documento de cobrança: pos 116-126
      const seuNumero = linha.slice(116, 126).trim()

      // Data de ocorrência / liquidação: pos 110-116
      const dataOcorrencia = parseCnabData(linha.slice(110, 116))

      // Data de vencimento: pos 146-152
      const dataVencimento = parseCnabData(linha.slice(146, 152))

      // Valor do título: pos 152-165
      const valorTitulo = parseCnabValor(linha.slice(152, 165))

      // Tarifa de cobrança: pos 175-188
      const valorTarifa = parseCnabValor(linha.slice(175, 188))

      // Valor pago / líquido recebido: pos 253-266
      const valorPago = parseCnabValor(linha.slice(253, 266))

      // Juros de mora / multa: pos 266-279
      const valorJurosMulta = parseCnabValor(linha.slice(266, 279))

      // Data do crédito em conta: pos 175-181 (Itaú/BB) ou 295-301
      const dataCredito =
        parseCnabData(linha.slice(295, 301)) ||
        parseCnabData(linha.slice(175, 181)) ||
        dataOcorrencia

      // Nome do sacado/pagador (quando presente nas posições finais do registro 1)
      const pagadorNome = linha.slice(324, 354).trim() || linha.slice(301, 340).trim()

      const isLiquidacao = isOcorrenciaLiquidacao(codigoOcorrencia)
      const isTarifa = isOcorrenciaTarifa(codigoOcorrencia)
      const tipo: 'entrada' | 'saida' = isTarifa ? 'saida' : 'entrada'

      const valorEfetivo =
        valorPago > 0
          ? valorPago
          : valorTitulo > 0
            ? valorTitulo
            : valorTarifa > 0
              ? valorTarifa
              : 0

      const dataEfetiva =
        dataCredito ||
        dataOcorrencia ||
        dataVencimento ||
        dataGeracao ||
        new Date().toISOString().slice(0, 10)

      const docRef = seuNumero || nossoNumero || ''

      const fitid = `ret400_${bancoCodigo}_L${linhaNum}_${dataEfetiva.replace(/-/g, '')}_${Math.round(valorEfetivo * 100)}`

      let desc = isLiquidacao
        ? `Boleto Liquidado (${ocorrenciaDescricao})`
        : `Retorno Cobrança: ${ocorrenciaDescricao}`

      if (pagadorNome && pagadorNome.length > 2 && !/^\d+$/.test(pagadorNome)) {
        desc += ` — ${pagadorNome}`
      }
      if (nossoNumero) {
        desc += ` [Nº ${nossoNumero}]`
      }

      transacoes.push({
        fitid,
        tipo,
        data: dataEfetiva,
        dataVencimento,
        dataOcorrencia,
        dataCredito,
        valor: Math.abs(valorEfetivo),
        valorOriginal: isTarifa ? -Math.abs(valorEfetivo) : valorEfetivo,
        valorTitulo,
        valorPago: valorPago || valorEfetivo,
        valorTarifa,
        valorJurosMulta,
        descricao: desc,
        documentoRef: docRef,
        nossoNumero,
        codigoOcorrencia: codigoOcorrencia.padStart(2, '0'),
        ocorrenciaDescricao,
        pagadorNome: pagadorNome && !/^\d+$/.test(pagadorNome) ? pagadorNome : undefined,
        segmento: '1',
        linhaNumero: linhaNum,
        layout: 'CNAB400',
        bancoCodigo,
      })
    }
  }

  transacoes.sort((a, b) => a.data.localeCompare(b.data))

  return compilarResultado(
    'CNAB400',
    bancoCodigo,
    bancoNome,
    agencia,
    conta,
    contaDigito,
    '',
    empresaNome,
    dataGeracao,
    lines.length,
    transacoes,
    avisos,
  )
}

/**
 * Agrega e calcula totais e resumo por código de ocorrência
 */
function compilarResultado(
  layout: 'CNAB240' | 'CNAB400',
  bancoCodigo: string,
  bancoNome: string,
  agencia: string,
  conta: string,
  contaDigito: string,
  convenio: string,
  empresaNome: string,
  dataGeracao: string | undefined,
  totalRegistros: number,
  transacoes: CnabTransacaoParsed[],
  avisos: CnabAvisoRegistro[],
): CnabRetornoParsed {
  let totalEntradas = 0
  let totalSaidas = 0
  let qtdEntradas = 0
  let qtdSaidas = 0

  let menorData = ''
  let maiorData = ''

  const mapaOcorrencias = new Map<string, { desc: string; qtd: number; valor: number }>()

  for (const t of transacoes) {
    if (t.tipo === 'entrada') {
      totalEntradas += t.valor
      qtdEntradas++
    } else {
      totalSaidas += t.valor
      qtdSaidas++
    }

    if (!menorData || t.data < menorData) menorData = t.data
    if (!maiorData || t.data > maiorData) maiorData = t.data

    const cod = t.codigoOcorrencia || '00'
    const cur = mapaOcorrencias.get(cod) || {
      desc: t.ocorrenciaDescricao,
      qtd: 0,
      valor: 0,
    }
    cur.qtd++
    cur.valor += t.valor
    mapaOcorrencias.set(cod, cur)
  }

  const ocorrenciasResumo: CnabOcorrenciaResumo[] = Array.from(mapaOcorrencias.entries())
    .map(([codigo, d]) => ({
      codigo,
      descricao: d.desc,
      quantidade: d.qtd,
      valorTotal: d.valor,
    }))
    .sort((a, b) => b.quantidade - a.quantidade)

  return {
    layout,
    bancoCodigo,
    bancoNome,
    agencia,
    conta,
    contaDigito,
    convenio,
    empresaNome,
    dataGeracao,
    dataInicio: menorData || dataGeracao,
    dataFim: maiorData || dataGeracao,
    totalRegistros,
    totalTransacoes: transacoes.length,
    totalEntradas,
    totalSaidas,
    qtdEntradas,
    qtdSaidas,
    ocorrenciasResumo,
    transacoes,
    avisos,
  }
}

/**
 * Função principal: detecta automaticamente o layout pelo tamanho do header (240 ou 400)
 * e decodifica o arquivo .ret com tolerância a quebras CRLF / LF.
 */
export function parseCnabRetorno(retContent: string): CnabRetornoParsed {
  if (!retContent || typeof retContent !== 'string') {
    throw new Error('Conteúdo do arquivo .ret vazio ou inválido.')
  }

  // Divide em linhas removendo linhas totalmente vazias do final
  const rawLines = retContent.split(/\r?\n/)
  const lines = rawLines.map((l) => l.replace(/[\r\n]/g, '')).filter((l) => l.length > 0)

  if (lines.length === 0) {
    throw new Error('O arquivo .ret não contém linhas válidas.')
  }

  // Detecta pelo primeiro registro header
  const primeiraLinha = lines[0]
  const tamPrimeira = primeiraLinha.length

  // CNAB 240 tem 240 caracteres no header
  if (tamPrimeira === 240 || (tamPrimeira >= 235 && tamPrimeira <= 245)) {
    return parseCnab240(lines)
  }

  // CNAB 400 tem 400 caracteres no header
  if (tamPrimeira === 400 || (tamPrimeira >= 380 && tamPrimeira <= 410)) {
    return parseCnab400(lines)
  }

  // Se a primeira linha tiver tamanho diferente, busca o tamanho mediano das linhas
  const comprimentos = lines.slice(0, 10).map((l) => l.length)
  const media = comprimentos.reduce((a, b) => a + b, 0) / comprimentos.length

  if (media < 300) {
    return parseCnab240(lines)
  } else {
    return parseCnab400(lines)
  }
}
