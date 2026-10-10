import pb from '@/lib/pocketbase/client'
import { loadSheetJS, type XLSXWorkbook } from './sheetjsLoader'

export interface AbaDetectada {
  nome: string
  tipoDetectado:
    | 'clientes'
    | 'projetos'
    | 'financeiro'
    | 'comunicacoes'
    | 'instrucoes'
    | 'status_geral'
    | 'desconhecido'
  totalLinhasBrutas: number
  totalLinhasValidas: number
  colunas: string[]
  amostraLinhas: Record<string, unknown>[]
}

export interface ItemValidado<T = Record<string, unknown>> {
  linhaOriginal: number
  dadosBrutos: Record<string, unknown>
  dadosMapeados: T
  avisos: string[]
  erros: string[]
  camposAValidar: string[]
  acao: 'criar' | 'atualizar' | 'ignorar'
  idExistente?: string
  conflitoDescricao?: string
}

export interface ValidacaoResultado<T = Record<string, unknown>> {
  aba: string
  itens: ItemValidado<T>[]
  totalLinhas: number
  totalCriar: number
  totalAtualizar: number
  totalIgnorar: number
  totalErros: number
  totalComAvisos: number
}

// Normaliza cabeçalhos para matching inteligente
export function normalizarChave(texto: string): string {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

// Verifica se valor é "a validar"
export function isAValidar(val: unknown): boolean {
  if (val === null || val === undefined) return false
  const str = String(val).trim().toLowerCase()
  return str === 'a validar' || str === 'a confirmar' || str === 'pendente' || str === 'validar'
}

// Limpa valor: se for "a validar", retorna string vazia
export function tratarValor(val: unknown): { valor: string; pendente: boolean } {
  if (val === null || val === undefined) return { valor: '', pendente: false }
  const str = String(val).trim()
  if (isAValidar(str)) {
    return { valor: '', pendente: true }
  }
  return { valor: str, pendente: false }
}

// Converte valores numéricos seguros
export function parseNumero(val: unknown): number {
  if (val === null || val === undefined) return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const str = String(val)
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim()
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

// Converte datas com suporte a DD/MM/AAAA, AAAA-MM-DD, e serial Excel
export function parseDataISO(val: unknown): string {
  if (!val) return ''
  if (isAValidar(val)) return ''
  if (typeof val === 'number') {
    // Número serial do Excel (1 = 01/01/1900)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const date = new Date(excelEpoch.getTime() + val * 86400000)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  }
  const str = String(val).trim()
  if (!str) return ''
  // DD/MM/AAAA ou DD/MM/AA
  const matchBr = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (matchBr) {
    const dia = matchBr[1].padStart(2, '0')
    const mes = matchBr[2].padStart(2, '0')
    let ano = matchBr[3]
    if (ano.length === 2) ano = '20' + ano
    return `${ano}-${mes}-${dia}`
  }
  // AAAA-MM-DD
  const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (matchIso) {
    return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`
  }
  // Tentar Date.parse padrão
  const d = new Date(str)
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]
  }
  return ''
}

// Limpa CNPJ/CPF deixando apenas números
export function limparDocumento(doc: string): string {
  return (doc || '').replace(/\D/g, '')
}

// Formata CNPJ ou CPF para exibição
export function formatarDocumento(doc: string): string {
  const clean = limparDocumento(doc)
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return doc || ''
}

// Mapeamento de status da planilha para a legenda e campos do CRM
export function mapearStatusProjeto(statusStr: string): {
  statusCrm: 'ativo' | 'suspenso' | 'concluido' | 'cancelado'
  faseCrm: string
} {
  const norm = normalizarChave(statusStr)
  if (norm.includes('concluid') || norm.includes('finalizad')) {
    return { statusCrm: 'concluido', faseCrm: 'Concluído' }
  }
  if (norm.includes('cancelad') || norm.includes('distrat') || norm.includes('rescind')) {
    return { statusCrm: 'cancelado', faseCrm: 'Cancelado' }
  }
  if (norm.includes('suspens') || norm.includes('pausad')) {
    return { statusCrm: 'suspenso', faseCrm: 'Suspenso' }
  }
  if (norm.includes('orgao') || norm.includes('decea') || norm.includes('anac')) {
    return { statusCrm: 'ativo', faseCrm: 'Em órgão (DECEA/ANAC)' }
  }
  if (norm.includes('execuc') || norm.includes('andamento')) {
    return { statusCrm: 'ativo', faseCrm: 'Em execução' }
  }
  if (norm.includes('contrat')) {
    return { statusCrm: 'ativo', faseCrm: 'Contratado' }
  }
  if (norm.includes('negocia')) {
    return { statusCrm: 'ativo', faseCrm: 'Em negociação' }
  }
  if (norm.includes('enviada')) {
    return { statusCrm: 'ativo', faseCrm: 'Proposta enviada' }
  }
  if (norm.includes('prospec')) {
    return { statusCrm: 'ativo', faseCrm: 'Prospecção' }
  }
  return { statusCrm: 'ativo', faseCrm: statusStr || 'Prospecção' }
}

// Mapeia trilha com base no tipo de serviço ou escopo
export function deduzirTrilha(tipoServico: string, escopo: string): 'opea' | 'registro' | 'demais' {
  const combinado = (tipoServico + ' ' + escopo).toLowerCase()
  if (combinado.includes('opea') || combinado.includes('pbzpa') || combinado.includes('pzpana')) {
    return 'opea'
  }
  if (
    combinado.includes('registro') ||
    combinado.includes('sdia') ||
    combinado.includes('inscricao')
  ) {
    return 'registro'
  }
  return 'demais'
}

// Detecta tipo da aba com base no nome
export function detectarTipoAba(nomeAba: string): AbaDetectada['tipoDetectado'] {
  const norm = normalizarChave(nomeAba)
  if (norm.includes('cliente')) return 'clientes'
  if (norm.includes('projeto')) return 'projetos'
  if (norm.includes('financeir') || norm.includes('parcela') || norm.includes('fatura'))
    return 'financeiro'
  if (norm.includes('comunica') || norm.includes('contato') || norm.includes('historico'))
    return 'comunicacoes'
  if (norm.includes('instruc') || norm.includes('ajuda')) return 'instrucoes'
  if (norm.includes('status') || norm.includes('resumo') || norm.includes('painel'))
    return 'status_geral'
  return 'desconhecido'
}

// Lê arquivo XLSX ou CSV via SheetJS
export async function processarArquivoPlanilha(file: File): Promise<{
  workbook: XLSXWorkbook
  abas: AbaDetectada[]
}> {
  const XLSX = await loadSheetJS()
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  const abas: AbaDetectada[] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: '',
      blankrows: false,
    })

    const tipoDetectado = detectarTipoAba(sheetName)
    const colunas = rows.length > 0 ? Object.keys(rows[0]) : []

    // Filtrar linhas que não sejam completamente vazias
    const linhasValidas = rows.filter((r) => {
      const vals = Object.values(r).map((v) => String(v || '').trim())
      return vals.some((v) => v.length > 0 && !isAValidar(v))
    })

    abas.push({
      nome: sheetName,
      tipoDetectado,
      totalLinhasBrutas: rows.length,
      totalLinhasValidas: linhasValidas.length,
      colunas,
      amostraLinhas: rows.slice(0, 5),
    })
  }

  return { workbook: wb, abas }
}

// Mapeamentos automáticos padrão por aba
export const MAPEAMENTOS_PADRAO = {
  clientes: {
    id_planilha: ['ID Cliente', 'ID', 'Código', 'Cod'],
    razao_social: ['Razão Social / Nome', 'Razao Social', 'Nome', 'Cliente', 'Razão Social'],
    cnpj_cpf: ['CNPJ / CPF', 'CNPJ/CPF', 'CNPJ', 'CPF', 'Documento'],
    tipo: ['Tipo', 'Tipo (PJ/PF)', 'PJ/PF'],
    segmento: ['Segmento', 'Ramo', 'Setor'],
    municipio_uf: ['Município/UF', 'Municipio/UF', 'Cidade/UF', 'Local'],
    contato_principal: ['Contato principal', 'Contato', 'Responsável'],
    cargo: ['Cargo', 'Função'],
    email: ['E-mail', 'Email', 'Correio eletrônico'],
    telefone: ['Telefone', 'Telefone / WhatsApp', 'Celular', 'WhatsApp'],
    contato_secundario: ['Contato secundário', 'Contato 2', 'Segundo contato'],
    primeira_contratacao: ['Primeira contratação', 'Primeiro contato', 'Data início'],
    observacoes: ['Observações', 'Observacao', 'Notas', 'Obs'],
  },
  projetos: {
    id_planilha: ['ID Projeto', 'ID', 'Código Projeto', 'Cod Projeto'],
    id_cliente: ['ID Cliente', 'Cliente ID', 'Cod Cliente'],
    cliente_ref: ['Cliente (ref.)', 'Cliente', 'Razão Social / Nome'],
    numero_pc_pt: ['Nº PC/PT', 'PC/PT', 'Nº Proposta', 'Proposta'],
    tipo_servico: ['Tipo de serviço', 'Serviço', 'Tipo serviço'],
    escopo_resumido: ['Escopo resumido', 'Escopo', 'Descrição'],
    municipio_uf: ['Município/UF do empreendimento', 'Município/UF', 'Local', 'Cidade/UF'],
    aerodromo: ['Aeródromo (ICAO/IATA)', 'Aeródromo', 'ICAO', 'Aerodromo'],
    data_proposta: ['Data da proposta', 'Data proposta', 'Emissão'],
    data_aceite: ['Data de aceite', 'Data aceite', 'Aceite'],
    prazo_dias: ['Prazo (dias)', 'Prazo', 'Dias'],
    valor_global: ['Valor global (R$)', 'Valor global', 'Valor', 'Total (R$)'],
    status: ['Status', 'Situação', 'Etapa'],
    marco_fase_atual: ['Marco/fase atual', 'Fase atual', 'Marco atual'],
    proxima_entrega: ['Próxima entrega', 'Próximo passo', 'Próxima ação'],
    pendente_orgao: ['Pendente de órgão (DECEA/ANAC)?', 'Pendente de órgão', 'Órgão pendente'],
    observacoes: ['Observações', 'Observacao', 'Notas', 'Obs'],
  },
  financeiro: {
    id_lancamento: ['ID Lançamento', 'ID', 'Código', 'Lançamento'],
    id_projeto: ['ID Projeto', 'Projeto ID', 'Cod Projeto'],
    projeto_ref: ['Projeto (ref.)', 'Projeto', 'Referência'],
    numero_parcela_marco: ['Nº da parcela / marco', 'Nº da parcela/marco', 'Parcela', 'Marco'],
    percentual_contrato: ['% do contrato', 'Percentual', '% Contrato'],
    valor: ['Valor (R$)', 'Valor', 'Total'],
    evento_comprobatorio: ['Evento comprobatório', 'Gatilho', 'Evento'],
    data_prevista: ['Data prevista', 'Previsão'],
    data_faturamento: ['Data de faturamento', 'Faturamento'],
    nf_numero: ['Nº NFS-e', 'Nº NF', 'Nota Fiscal', 'NF'],
    vencimento: ['Data de vencimento', 'Vencimento'],
    data_pagamento: ['Data de recebimento', 'Data de pagamento', 'Recebimento'],
    status_pagamento: ['Status pagamento', 'Status', 'Situação'],
    observacoes: ['Observações', 'Observacao', 'Notas', 'Obs'],
  },
  comunicacoes: {
    id_planilha: ['ID Comunicação', 'ID', 'Código'],
    id_cliente: ['ID Cliente', 'Cliente ID'],
    cliente_ref: ['Cliente (ref.)', 'Cliente', 'Nome'],
    data_hora: ['Data', 'Data / Hora', 'Data/Hora'],
    tipo: ['Tipo', 'Canal', 'Meio'], // e-mail / WhatsApp / reunião
    texto: ['Texto', 'Descrição', 'Assunto', 'Registro', 'Mensagem', 'Histórico'],
    usuario: ['Usuário', 'Responsável', 'Atendente'],
    observacoes: ['Observações', 'Notas'],
  },
}

// Localiza coluna correspondente na planilha
export function encontrarColuna(colunas: string[], possiveisNomes: string[]): string {
  for (const possivel of possiveisNomes) {
    const normPossivel = normalizarChave(possivel)
    const matchExato = colunas.find((c) => normalizarChave(c) === normPossivel)
    if (matchExato) return matchExato
  }
  for (const possivel of possiveisNomes) {
    const normPossivel = normalizarChave(possivel)
    const matchParcial = colunas.find((c) => normalizarChave(c).includes(normPossivel))
    if (matchParcial) return matchParcial
  }
  return ''
}

// Geração de mapa de colunas padrão para uma aba
export function autoMapearColunas(
  colunas: string[],
  tipo: 'clientes' | 'projetos' | 'financeiro' | 'comunicacoes',
): Record<string, string> {
  const mapaCampos = MAPEAMENTOS_PADRAO[tipo]
  const resultado: Record<string, string> = {}
  for (const [campo, possiveis] of Object.entries(mapaCampos)) {
    resultado[campo] = encontrarColuna(colunas, possiveis)
  }
  return resultado
}
