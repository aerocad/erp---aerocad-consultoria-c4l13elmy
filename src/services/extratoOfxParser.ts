/**
 * Parser nativo no navegador para extratos bancários brasileiros em formato OFX (Open Financial Exchange).
 * Suporta OFX 1.x (SGML) e OFX 2.x (XML).
 */

export interface OfxTransacaoParsed {
  fitid: string
  tipo: 'entrada' | 'saida'
  data: string // YYYY-MM-DD
  valor: number // Sempre positivo no objeto, com tipo definindo sentido
  valorOriginal: number // com sinal original (+ ou -)
  descricao: string
  documentoRef?: string
}

export interface OfxExtratoParsed {
  banco?: string
  agencia?: string
  conta?: string
  dataInicio?: string
  dataFim?: string
  saldoFinal?: number
  transacoes: OfxTransacaoParsed[]
}

/**
 * Converte data OFX para formato ISO YYYY-MM-DD
 */
function parseOfxDate(rawDate?: string): string {
  if (!rawDate) return new Date().toISOString().slice(0, 10)
  const clean = rawDate.trim().replace(/\[.*\]/, '')
  if (clean.length >= 8) {
    const y = clean.slice(0, 4)
    const m = clean.slice(4, 6)
    const d = clean.slice(6, 8)
    return `${y}-${m}-${d}`
  }
  return new Date().toISOString().slice(0, 10)
}

/**
 * Limpa e extrai o valor de uma tag SGML/XML do OFX
 */
function extractTagValue(xmlBlock: string, tagName: string): string {
  // Procura padrão <TAG>VALOR ou <TAG>VALOR</TAG>
  const regex = new RegExp(`<${tagName}>([^<\\r\\n]+)(?:<\\/${tagName}>)?`, 'i')
  const match = xmlBlock.match(regex)
  return match && match[1] ? match[1].trim() : ''
}

export function parseOfxString(ofxContent: string): OfxExtratoParsed {
  // Remove eventuais cabeçalhos antes do primeiro bloco OFX
  const ofxIndex = ofxContent.indexOf('<OFX>')
  const content = ofxIndex >= 0 ? ofxContent.slice(ofxIndex) : ofxContent

  // Extrai informações da conta e banco
  const banco = extractTagValue(content, 'BANKID') || extractTagValue(content, 'ORG') || 'Banco'
  const agencia = extractTagValue(content, 'BRANCHID')
  const conta = extractTagValue(content, 'ACCTID')

  // Período
  const dtStartRaw = extractTagValue(content, 'DTSTART')
  const dtEndRaw = extractTagValue(content, 'DTEND')
  const dataInicio = dtStartRaw ? parseOfxDate(dtStartRaw) : undefined
  const dataFim = dtEndRaw ? parseOfxDate(dtEndRaw) : undefined

  // Saldo
  const balAmtRaw = extractTagValue(content, 'BALAMT')
  const saldoFinal = balAmtRaw ? parseFloat(balAmtRaw.replace(',', '.')) : undefined

  // Transações: blocos <STMTTRN>...</STMTTRN> ou <STMTTRN> até próximo <STMTTRN> / </BANKTRANLIST>
  const transacoes: OfxTransacaoParsed[] = []
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/gi

  let match: RegExpExecArray | null
  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const block = match[1]
    const trnType = extractTagValue(block, 'TRNTYPE').toUpperCase()
    const dtPosted = extractTagValue(block, 'DTPOSTED')
    const trnAmtRaw = extractTagValue(block, 'TRNAMT').replace(',', '.')
    const fitid =
      extractTagValue(block, 'FITID') || `fitid_${Math.random().toString(36).slice(2, 9)}`
    const memo = extractTagValue(block, 'MEMO')
    const name = extractTagValue(block, 'NAME')
    const checkNum = extractTagValue(block, 'CHECKNUM') || extractTagValue(block, 'REFNUM')

    const valorNum = parseFloat(trnAmtRaw) || 0
    const descricao = (memo || name || 'Transação sem descrição').replace(/\s+/g, ' ').trim()

    // No OFX, créditos costumam vir positivos e débitos negativos, ou conforme TRNTYPE
    const isCredit = trnType === 'CREDIT' || trnType === 'DEP' || valorNum > 0
    const tipo: 'entrada' | 'saida' = isCredit ? 'entrada' : 'saida'

    transacoes.push({
      fitid,
      tipo,
      data: parseOfxDate(dtPosted),
      valor: Math.abs(valorNum),
      valorOriginal: valorNum,
      descricao,
      documentoRef: checkNum || undefined,
    })
  }

  return {
    banco,
    agencia,
    conta,
    dataInicio,
    dataFim,
    saldoFinal,
    transacoes,
  }
}
