import { limparDocumento, normalizarChave, parseDataISO, parseNumero } from './importacaoParser'
import { loadSheetJS } from './sheetjsLoader'

export interface NfseDadoExtraido {
  idTemp: string
  numero: string
  serie?: string
  codigoVerificacao?: string
  dataEmissao: string
  dataRecebimento?: string
  valorBruto: number
  valorLiquido?: number
  retencoesTexto?: string
  retencoesTotal?: number
  issRetido?: number
  inssRetido?: number
  irpjRetido?: number
  pisRetido?: number
  cofinsRetido?: number
  csllRetido?: number
  tomadorRazao: string
  tomadorCnpjCpf: string
  tomadorEndereco?: string
  tomadorNumero?: string
  tomadorBairro?: string
  tomadorMunicipio?: string
  tomadorUf?: string
  tomadorCep?: string
  tomadorEmail?: string
  tomadorTelefone?: string
  prestadorRazao?: string
  prestadorCnpjCpf?: string
  descricaoServico?: string
  situacao: string // 'emitida' | 'paga' | 'cancelada' | 'liquidada' | string
  projetoIdMencionado?: string // AAAA-NNN extraído do texto da nota
  propostaMencionada?: string // PC/PT NNN/AAAA
  origemArquivo: 'xml' | 'planilha'
  raw: Record<string, unknown>
}

// Extrai número de projeto (ex.: 2026-232 ou 2025-014) de um texto qualquer
export function extrairNumeroProjeto(texto: string): string {
  if (!texto) return ''
  const match = texto.match(/\b(202[0-9]-[0-9]{1,4})\b/i)
  return match ? match[1].toUpperCase() : ''
}

// Extrai número de proposta (PC nº 012/2026, PT 005/2025, etc.) de um texto
export function extrairNumeroProposta(texto: string): string {
  if (!texto) return ''
  const match = texto.match(/\b((?:PC|PT)\s*(?:nº|n[oº]|n\.?)?\s*\d{1,4}\s*[/-]\s*202[0-9])/i)
  if (match) return match[1].toUpperCase().replace(/\s+/g, ' ')
  return ''
}

// Mapeamentos comuns de colunas exportadas do GDF / SisGoV / NFS-e Nacional / Portais Municipais
export const COLUNAS_NFSE_MAPEAMENTO = {
  numero: [
    'Número da Nota',
    'Numero da Nota',
    'Nº da Nota',
    'Nº Nota',
    'Numero NFSe',
    'Nº NFS-e',
    'Numero',
    'Nota',
    'NFS-e',
    'NF',
  ],
  dataEmissao: [
    'Data de Emissão',
    'Data Emissão',
    'Data Emissao',
    'Dt Emissão',
    'Emissão',
    'Data Emissao/Hora',
    'Data da Nota',
  ],
  dataRecebimento: [
    'Data de Recebimento',
    'Data Recebimento',
    'Data Pagamento',
    'Dt Pagamento',
    'Data Quitação',
    'Data Liquidação',
    'Pagamento',
  ],
  valorBruto: [
    'Valor Bruto',
    'Valor dos Serviços',
    'Valor do Serviço',
    'Valor Total',
    'Valor Serviços (R$)',
    'Valor (R$)',
    'Valor',
    'Total',
  ],
  valorLiquido: [
    'Valor Líquido',
    'Valor Liquido',
    'Valor Líquido (R$)',
    'Líquido',
    'Valor a Receber',
  ],
  tomadorRazao: [
    'Tomador',
    'Razão Social Tomador',
    'Razao Social Tomador',
    'Nome Tomador',
    'Nome / Razão Social do Tomador',
    'Cliente',
    'Destinatário',
  ],
  tomadorCnpjCpf: [
    'CNPJ / CPF Tomador',
    'CNPJ/CPF Tomador',
    'CNPJ Tomador',
    'CPF Tomador',
    'Documento Tomador',
    'CNPJ/CPF',
    'CNPJ',
  ],
  tomadorEndereco: [
    'Endereço Tomador',
    'Endereco Tomador',
    'Endereço',
    'Endereco',
    'Logradouro',
    'Logradouro Tomador',
  ],
  tomadorMunicipio: [
    'Município Tomador',
    'Municipio Tomador',
    'Município',
    'Municipio',
    'Cidade',
    'Cidade Tomador',
  ],
  tomadorUf: ['UF Tomador', 'UF', 'Estado', 'Estado Tomador'],
  tomadorEmail: ['E-mail Tomador', 'Email Tomador', 'E-mail', 'Email', 'Correio Eletrônico'],
  tomadorTelefone: ['Telefone Tomador', 'Telefone', 'WhatsApp', 'Celular', 'Tel'],
  situacao: ['Situação', 'Situacao', 'Status', 'Situação da Nota', 'Status da Nota', 'Estado'],
  descricaoServico: [
    'Discriminação dos Serviços',
    'Discriminacao',
    'Descrição dos Serviços',
    'Descricao',
    'Serviço',
    'Observações',
    'Detalhes',
  ],
  retencoes: [
    'Retenções',
    'Retenções Federais',
    'Retenções (R$)',
    'Valor Retido',
    'ISS Retido',
    'Impostos Retidos',
  ],
  iss: ['ISS', 'ISS Retido', 'Valor ISS', 'ISS (R$)'],
  inss: ['INSS', 'INSS Retido', 'Valor INSS', 'INSS (R$)'],
  irpj: ['IRPJ', 'IR', 'IR Retido', 'Valor IR'],
}

// Localiza coluna na planilha com busca exata e parcial normalizada
function acharColuna(colunas: string[], possiveis: string[]): string {
  for (const p of possiveis) {
    const normP = normalizarChave(p)
    const exato = colunas.find((c) => normalizarChave(c) === normP)
    if (exato) return exato
  }
  for (const p of possiveis) {
    const normP = normalizarChave(p)
    const parcial = colunas.find((c) => normalizarChave(c).includes(normP))
    if (parcial) return parcial
  }
  return ''
}

export function autoMapearColunasNfse(colunas: string[]): Record<string, string> {
  const mapa: Record<string, string> = {}
  for (const [campo, possiveis] of Object.entries(COLUNAS_NFSE_MAPEAMENTO)) {
    mapa[campo] = acharColuna(colunas, possiveis)
  }
  return mapa
}

// Parser de XML individual de NFS-e (padrão ABRASF ou layout GDF/Prefeituras)
export function parseXmlNfse(xmlString: string, nomeArquivo?: string): NfseDadoExtraido[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')

  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    throw new Error('Arquivo XML inválido ou malformado: ' + parserError.textContent)
  }

  const notasExtraidas: NfseDadoExtraido[] = []

  // Tenta encontrar elementos de nota fiscal repetidos (ex.: CompNfse, Nfse, RPS, tcCompNfse)
  let nfseNodes = Array.from(doc.querySelectorAll('CompNfse, Nfse, tcCompNfse, NFS-e'))
  if (nfseNodes.length === 0) {
    // Tenta nó raiz se contiver InfNfse
    const inf = doc.querySelector('InfNfse, infNfse')
    if (inf) {
      nfseNodes = [inf.parentElement || inf]
    }
  }

  // Se ainda estiver vazio, tenta extrair da raiz do documento
  if (nfseNodes.length === 0) {
    nfseNodes = [doc.documentElement]
  }

  const getNodeText = (node: Element, selectors: string[]): string => {
    for (const sel of selectors) {
      const el = node.querySelector(sel)
      if (el && el.textContent) return el.textContent.trim()
    }
    return ''
  }

  nfseNodes.forEach((node, idx) => {
    const numero = getNodeText(node, [
      'Numero',
      'numero',
      'nNfse',
      'NfseNumero',
      'IdentificacaoNfse Numero',
      'NumeroNfse',
    ])
    const serie = getNodeText(node, ['Serie', 'serie'])
    const codigoVerificacao = getNodeText(node, [
      'CodigoVerificacao',
      'codigoVerificacao',
      'CodVerificacao',
    ])
    const dataEmissaoRaw = getNodeText(node, [
      'DataEmissao',
      'dataEmissao',
      'DataHoraEmissao',
      'dhEmi',
      'DtEmissao',
    ])
    const valorBrutoRaw = getNodeText(node, [
      'ValorServicos',
      'valorServicos',
      'vServ',
      'ValorTotal',
      'ValorBruto',
    ])
    const valorLiquidoRaw = getNodeText(node, [
      'ValorLiquidoNfse',
      'valorLiquidoNfse',
      'vLiq',
      'ValorLiquido',
    ])
    const issRetidoRaw = getNodeText(node, ['ValorIssRetido', 'vIssRet', 'ValorIss'])
    const inssRetidoRaw = getNodeText(node, ['ValorInss', 'vInss'])
    const irpjRetidoRaw = getNodeText(node, ['ValorIr', 'vIr'])
    const pisRetidoRaw = getNodeText(node, ['ValorPis', 'vPis'])
    const cofinsRetidoRaw = getNodeText(node, ['ValorCofins', 'vCofins'])
    const csllRetidoRaw = getNodeText(node, ['ValorCsll', 'vCsll'])

    // Tomador
    const tomadorRazao = getNodeText(node, [
      'TomadorServico RazaoSocial',
      'Tomador RazaoSocial',
      'TomadorServico xNome',
      'Tomador xNome',
      'Tomador Nome',
      'DadosTomador RazaoSocial',
      'IdentificacaoTomador RazaoSocial',
    ])
    const tomadorCnpj = getNodeText(node, [
      'TomadorServico IdentificacaoTomador CpfCnpj Cnpj',
      'Tomador Cnpj',
      'TomadorServico Cnpj',
      'TomadorServico CpfCnpj Cnpj',
      'TomadorServico CNPJ',
      'Tomador CNPJ',
      'IdentificacaoTomador CpfCnpj Cnpj',
      'IdentificacaoTomador Cnpj',
    ])
    const tomadorCpf = getNodeText(node, [
      'TomadorServico IdentificacaoTomador CpfCnpj Cpf',
      'Tomador Cpf',
      'TomadorServico Cpf',
      'TomadorServico CpfCnpj Cpf',
      'IdentificacaoTomador CpfCnpj Cpf',
      'IdentificacaoTomador Cpf',
    ])

    // Endereço e Contato do Tomador (ABRASF e layouts municipais)
    const tomadorLogradouro = getNodeText(node, [
      'TomadorServico Endereco Endereco',
      'TomadorServico Endereco xLgr',
      'Tomador Endereco Endereco',
      'Tomador Endereco xLgr',
      'Tomador xLgr',
      'Endereco Tomador Endereco',
      'Endereco Tomador Logradouro',
      'DadosTomador Endereco',
    ])
    const tomadorNumero = getNodeText(node, [
      'TomadorServico Endereco Numero',
      'TomadorServico Endereco nro',
      'Tomador Endereco Numero',
      'Tomador Endereco nro',
      'Tomador nro',
    ])
    const tomadorComplemento = getNodeText(node, [
      'TomadorServico Endereco Complemento',
      'TomadorServico Endereco xCpl',
      'Tomador Endereco Complemento',
      'Tomador Endereco xCpl',
    ])
    const tomadorBairro = getNodeText(node, [
      'TomadorServico Endereco Bairro',
      'TomadorServico Endereco xBairro',
      'Tomador Endereco Bairro',
      'Tomador Endereco xBairro',
      'Tomador xBairro',
    ])
    const tomadorMunicipio = getNodeText(node, [
      'TomadorServico Endereco Municipio',
      'TomadorServico Endereco xMun',
      'Tomador Endereco Municipio',
      'Tomador Endereco xMun',
      'Tomador xMun',
      'TomadorServico Endereco Cidade',
    ])
    const tomadorUf = getNodeText(node, [
      'TomadorServico Endereco Uf',
      'TomadorServico Endereco UF',
      'Tomador Endereco Uf',
      'Tomador Endereco UF',
      'Tomador UF',
    ])
    const tomadorCep = getNodeText(node, [
      'TomadorServico Endereco Cep',
      'TomadorServico Endereco CEP',
      'Tomador Endereco Cep',
      'Tomador Endereco CEP',
      'Tomador CEP',
    ])
    const tomadorEmail = getNodeText(node, [
      'TomadorServico Contato Email',
      'TomadorServico Email',
      'Tomador Contato Email',
      'Tomador Email',
      'Tomador email',
    ])
    const tomadorTelefone = getNodeText(node, [
      'TomadorServico Contato Telefone',
      'TomadorServico Telefone',
      'Tomador Contato Telefone',
      'Tomador Telefone',
      'Tomador fone',
    ])

    // Monta endereço formatado
    const partesEndereco: string[] = []
    if (tomadorLogradouro) {
      let linhaLgr = tomadorLogradouro
      if (tomadorNumero) linhaLgr += `, nº ${tomadorNumero}`
      if (tomadorComplemento) linhaLgr += ` - ${tomadorComplemento}`
      partesEndereco.push(linhaLgr)
    }
    if (tomadorBairro) partesEndereco.push(tomadorBairro)
    if (tomadorCep) partesEndereco.push(`CEP ${tomadorCep}`)
    const enderecoFormatado = partesEndereco.join(', ')

    // Prestador
    const prestadorRazao = getNodeText(node, [
      'PrestadorServico RazaoSocial',
      'Prestador RazaoSocial',
      'PrestadorServico xNome',
      'Prestador xNome',
    ])
    const prestadorCnpj = getNodeText(node, [
      'PrestadorServico IdentificacaoPrestador Cnpj',
      'Prestador Cnpj',
      'PrestadorServico Cnpj',
      'PrestadorServico CNPJ',
    ])

    // Discriminação dos serviços
    const descricaoServico = getNodeText(node, [
      'Discriminacao',
      'discriminacao',
      'Descricao',
      'xServ',
      'OutrasInformacoes',
    ])

    // Situação / Status
    const statusRaw = getNodeText(node, ['Status', 'status', 'Situacao', 'situacao'])
    let situacao = 'emitida'
    if (statusRaw === '2' || statusRaw.toLowerCase().includes('canc')) {
      situacao = 'cancelada'
    } else if (statusRaw === '1' || !statusRaw) {
      situacao = 'emitida'
    }

    const valorBruto = parseNumero(valorBrutoRaw)
    const valorLiquido = valorLiquidoRaw ? parseNumero(valorLiquidoRaw) : valorBruto
    const dataEmissao = parseDataISO(dataEmissaoRaw) || new Date().toISOString().slice(0, 10)

    const retTot =
      parseNumero(issRetidoRaw) +
      parseNumero(inssRetidoRaw) +
      parseNumero(irpjRetidoRaw) +
      parseNumero(pisRetidoRaw) +
      parseNumero(cofinsRetidoRaw) +
      parseNumero(csllRetidoRaw)

    const issNum = parseNumero(issRetidoRaw)
    const inssNum = parseNumero(inssRetidoRaw)
    const irpjNum = parseNumero(irpjRetidoRaw)
    const pisNum = parseNumero(pisRetidoRaw)
    const cofinsNum = parseNumero(cofinsRetidoRaw)
    const csllNum = parseNumero(csllRetidoRaw)

    const formatRetencaoBr = (n: number) =>
      n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const retencoesPartes: string[] = []
    if (issNum > 0) retencoesPartes.push(`ISS: R$ ${formatRetencaoBr(issNum)}`)
    if (inssNum > 0) retencoesPartes.push(`INSS: R$ ${formatRetencaoBr(inssNum)}`)
    if (irpjNum > 0) retencoesPartes.push(`IR: R$ ${formatRetencaoBr(irpjNum)}`)
    if (pisNum > 0) retencoesPartes.push(`PIS: R$ ${formatRetencaoBr(pisNum)}`)
    if (cofinsNum > 0) retencoesPartes.push(`COFINS: R$ ${formatRetencaoBr(cofinsNum)}`)
    if (csllNum > 0) retencoesPartes.push(`CSLL: R$ ${formatRetencaoBr(csllNum)}`)

    const combinadoTexto = `${descricaoServico} ${tomadorRazao} ${node.textContent || ''}`
    const projetoIdMencionado = extrairNumeroProjeto(combinadoTexto)
    const propostaMencionada = extrairNumeroProposta(combinadoTexto)

    // Se não encontrou número da nota, tenta derivar do nome do arquivo ou usar fallback
    let numFinal = numero
    if (!numFinal && nomeArquivo) {
      const numMatch = nomeArquivo.match(/(\d{3,8})/i)
      if (numMatch) numFinal = numMatch[1]
    }
    if (!numFinal) {
      numFinal = `NF-${idx + 1}`
    }

    notasExtraidas.push({
      idTemp: `xml_${idx}_${numFinal}_${Date.now()}`,
      numero: numFinal,
      serie,
      codigoVerificacao,
      dataEmissao,
      dataRecebimento: '',
      valorBruto,
      valorLiquido,
      retencoesTexto: retencoesPartes.join(' | '),
      retencoesTotal: retTot,
      issRetido: issNum,
      inssRetido: inssNum,
      irpjRetido: irpjNum,
      pisRetido: pisNum,
      cofinsRetido: cofinsNum,
      csllRetido: csllNum,
      tomadorRazao: tomadorRazao || 'Tomador não informado',
      tomadorCnpjCpf: limparDocumento(tomadorCnpj || tomadorCpf),
      tomadorEndereco: enderecoFormatado || tomadorLogradouro,
      tomadorNumero,
      tomadorBairro,
      tomadorMunicipio,
      tomadorUf: (tomadorUf || '').toUpperCase().slice(0, 2),
      tomadorCep,
      tomadorEmail,
      tomadorTelefone,
      prestadorRazao,
      prestadorCnpjCpf: limparDocumento(prestadorCnpj),
      descricaoServico,
      situacao,
      projetoIdMencionado,
      propostaMencionada,
      origemArquivo: 'xml',
      raw: {
        numero,
        serie,
        dataEmissaoRaw,
        valorBrutoRaw,
        descricaoServico,
      },
    })
  })

  return notasExtraidas
}

// Parser de linhas de planilha (XLSX / CSV) com mapa de colunas
export function parsePlanilhaNfse(
  linhas: Record<string, unknown>[],
  mapaColunas: Record<string, string>,
): NfseDadoExtraido[] {
  const notas: NfseDadoExtraido[] = []

  linhas.forEach((row, idx) => {
    const getVal = (campo: string) => {
      const colName = mapaColunas[campo]
      return colName ? row[colName] : ''
    }

    const numeroRaw = String(getVal('numero') || '').trim()
    const dtEmissaoRaw = getVal('dataEmissao')
    const dtRecebimentoRaw = getVal('dataRecebimento')
    const valorBrutoRaw = getVal('valorBruto')
    const valorLiquidoRaw = getVal('valorLiquido')
    const tomadorRazaoRaw = String(getVal('tomadorRazao') || '').trim()
    const tomadorDocRaw = String(getVal('tomadorCnpjCpf') || '').trim()
    const tomadorEnderecoRaw = String(getVal('tomadorEndereco') || '').trim()
    const tomadorMunicipioRaw = String(getVal('tomadorMunicipio') || '').trim()
    const tomadorUfRaw = String(getVal('tomadorUf') || '')
      .trim()
      .toUpperCase()
      .slice(0, 2)
    const tomadorEmailRaw = String(getVal('tomadorEmail') || '').trim()
    const tomadorTelefoneRaw = String(getVal('tomadorTelefone') || '').trim()
    const situacaoRaw = String(getVal('situacao') || '')
      .trim()
      .toLowerCase()
    const descServicoRaw = String(getVal('descricaoServico') || '').trim()
    const retencoesRaw = String(getVal('retencoes') || '').trim()

    // Ignora linha sem número de nota e sem valor
    if (!numeroRaw && !valorBrutoRaw && !tomadorRazaoRaw) {
      return
    }

    const valorBruto = parseNumero(valorBrutoRaw)
    const valorLiquido = valorLiquidoRaw ? parseNumero(valorLiquidoRaw) : valorBruto
    const dataEmissao = parseDataISO(dtEmissaoRaw) || new Date().toISOString().slice(0, 10)
    const dataRecebimento = parseDataISO(dtRecebimentoRaw)

    // Situação padronizada
    let situacao = 'emitida'
    if (situacaoRaw.includes('canc')) {
      situacao = 'cancelada'
    } else if (
      situacaoRaw.includes('pag') ||
      situacaoRaw.includes('liquid') ||
      situacaoRaw.includes('recebid') ||
      dataRecebimento
    ) {
      situacao = 'paga'
    }

    // Texto combinado para extrair referências a AAAA-NNN e PC/PT
    const combined = `${numeroRaw} ${descServicoRaw} ${tomadorRazaoRaw} ${Object.values(row).join(' ')}`
    const projetoIdMencionado = extrairNumeroProjeto(combined)
    const propostaMencionada = extrairNumeroProposta(combined)

    notas.push({
      idTemp: `row_${idx}_${numeroRaw || idx}`,
      numero: numeroRaw || `NF-${idx + 1}`,
      dataEmissao,
      dataRecebimento,
      valorBruto,
      valorLiquido,
      retencoesTexto: retencoesRaw,
      tomadorRazao: tomadorRazaoRaw || 'Tomador não informado',
      tomadorCnpjCpf: limparDocumento(tomadorDocRaw),
      tomadorEndereco: tomadorEnderecoRaw,
      tomadorMunicipio: tomadorMunicipioRaw,
      tomadorUf: tomadorUfRaw,
      tomadorEmail: tomadorEmailRaw,
      tomadorTelefone: tomadorTelefoneRaw,
      descricaoServico: descServicoRaw,
      situacao,
      projetoIdMencionado,
      propostaMencionada,
      origemArquivo: 'planilha',
      raw: row,
    })
  })

  return notas
}

// Processa arquivo recebido (File: XML, XLSX ou CSV) e retorna as notas extraídas
export async function processarArquivoNfse(file: File): Promise<{
  notas: NfseDadoExtraido[]
  colunasDetectadas: string[]
  mapaColunas: Record<string, string>
  tipoArquivo: 'xml' | 'planilha'
  linhasPlanilhaBrutas?: Record<string, unknown>[]
}> {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.xml')) {
    const text = await file.text()
    const notas = parseXmlNfse(text, file.name)
    return {
      notas,
      colunasDetectadas: [],
      mapaColunas: {},
      tipoArquivo: 'xml',
    }
  }

  // Planilha XLSX ou CSV via SheetJS
  const XLSX = await loadSheetJS()
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  // Seleciona a primeira aba com dados válidos
  let chosenSheet = wb.SheetNames[0]
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
    if (rows.length > 0) {
      chosenSheet = sheetName
      break
    }
  }

  const ws = wb.Sheets[chosenSheet]
  if (!ws) {
    throw new Error('Planilha sem abas válidas')
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  const colunas = rows.length > 0 ? Object.keys(rows[0]) : []
  const mapa = autoMapearColunasNfse(colunas)
  const notas = parsePlanilhaNfse(rows, mapa)

  return {
    notas,
    colunasDetectadas: colunas,
    mapaColunas: mapa,
    tipoArquivo: 'planilha',
    linhasPlanilhaBrutas: rows,
  }
}
