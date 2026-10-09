export interface DocumentFamily {
  prefix: string
  name: string
  category: string
  description: string
  defaultOrientation: 'portrait' | 'landscape'
}

export const DOCUMENT_FAMILIES: Record<string, DocumentFamily> = {
  PC: {
    prefix: 'PC',
    name: 'Proposta Comercial',
    category: 'proposta',
    description:
      'Documento comercial com itens, preços, parcelas vinculadas a marcos técnicos e dados bancários.',
    defaultOrientation: 'portrait',
  },
  PT: {
    prefix: 'PT',
    name: 'Proposta Técnica',
    category: 'proposta_tecnica',
    description:
      'Documento técnico com Quadro de Aderência à RFQ, Normas, Equipe, Premissas e Cronograma Gantt.',
    defaultOrientation: 'portrait',
  },
  CT: {
    prefix: 'CT',
    name: 'Contrato de Prestação de Serviços',
    category: 'contrato',
    description:
      'Minuta contratual com 11 cláusulas padrão, multa 20%, confidencialidade 5 anos e foro Brasília-DF.',
    defaultOrientation: 'portrait',
  },
  OS: {
    prefix: 'OS',
    name: 'Ordem de Serviço Interna',
    category: 'ordem_servico',
    description:
      'Abertura técnica interna dirigida ao Responsável Técnico com entregáveis e equipe designada.',
    defaultOrientation: 'portrait',
  },
  PR: {
    prefix: 'PR',
    name: 'Procuração',
    category: 'procuracao',
    description:
      'Outorga para representação junto a DECEA, COMAER e ANAC (Outorgada padrão: Jaqueline Mota).',
    defaultOrientation: 'portrait',
  },
  FT: {
    prefix: 'FT',
    name: 'Fatura de Serviços',
    category: 'fatura',
    description:
      'Cobrança por marco/parcela técnica com vencimento e dados bancários institucionais.',
    defaultOrientation: 'portrait',
  },
  RB: {
    prefix: 'RB',
    name: 'Recibo de Quitação',
    category: 'recibo',
    description: 'Comprovante irrevogável de quitação de honorários ou parcelas recebidas.',
    defaultOrientation: 'portrait',
  },
  AT: {
    prefix: 'AT',
    name: 'Ata de Reunião Técnica',
    category: 'ata_reuniao',
    description:
      'Registro de checkpoints, pautas, deliberações e matriz de pendências com responsáveis.',
    defaultOrientation: 'portrait',
  },
  RQ: {
    prefix: 'RQ',
    name: 'Requerimento ANAC / DECEA',
    category: 'requerimento',
    description:
      'Requerimento oficial formal com fundamentação normativa e rol de peças instrutórias.',
    defaultOrientation: 'portrait',
  },
  NT: {
    prefix: 'NT',
    name: 'Nota Técnica',
    category: 'nota_tecnica',
    description:
      'Parecer técnico rápido e objetivo sobre consulta específica de viabilidade ou OLS.',
    defaultOrientation: 'portrait',
  },
  EVA: {
    prefix: 'EVA',
    name: 'Estudo de Viabilidade (EVA / EVTEA)',
    category: 'estudo_viabilidade',
    description:
      'Relatório conclusivo de viabilidade técnica/operacional de aeródromo ou heliponto.',
    defaultOrientation: 'portrait',
  },
  MD: {
    prefix: 'MD',
    name: 'Memorial Descritivo / Memorial de Cálculo',
    category: 'memorial',
    description:
      'Peça técnica descritiva de geometria, aeronave-crítica e superfícies limitadoras.',
    defaultOrientation: 'portrait',
  },
  LT: {
    prefix: 'LT',
    name: 'Laudo / Parecer Técnico',
    category: 'laudo',
    description: 'Documento pericial com peso probatório emitido com ART pelo Responsável Técnico.',
    defaultOrientation: 'portrait',
  },
  GNT: {
    prefix: 'GNT',
    name: 'Cronograma Físico-Financeiro (Gantt)',
    category: 'cronograma',
    description:
      'Gantt landscape detalhado em semanas com segregação explícita de prazos de órgãos.',
    defaultOrientation: 'landscape',
  },
  CHK: {
    prefix: 'CHK',
    name: 'Checklist de Inspeção',
    category: 'checklist',
    description:
      'Formulário de vistoria em campo com verificação de conformidade visual e operacional.',
    defaultOrientation: 'portrait',
  },
  FNC: {
    prefix: 'FNC',
    name: 'Ficha de Não Conformidade',
    category: 'fnc',
    description: 'Registro formal de desvio identificado com causa raiz e plano de ação imediato.',
    defaultOrientation: 'portrait',
  },
  PAC: {
    prefix: 'PAC',
    name: 'Plano de Ação Corretiva',
    category: 'pac',
    description: 'Resposta formal a FNC ou exigência regulatória com prazos e evidências.',
    defaultOrientation: 'portrait',
  },
  RG: {
    prefix: 'RG',
    name: 'Relatório Gerencial Mensal',
    category: 'relatorio_gerencial',
    description: 'Acompanhamento mensal operacional e regulatório das atividades em curso.',
    defaultOrientation: 'portrait',
  },
}

export const INSTITUTIONAL_DATA = {
  razaoSocial: 'AEROCAD Terraplanagem e Construção Ltda.',
  nomeFantasia: 'AEROCAD® CONSULTORIA & AEROPORTOS',
  cnpj: '28.036.597/0001-43',
  inscricaoEstadual: '07.815.970/001-59',
  endereco: 'SBS Quadra 2, Sala 206, Ed. Prime Business, Asa Sul, CEP 70.070-120, Brasília-DF',
  telefone: '+55 61 9 8462-8800',
  email: 'contato@aerocad.com.br',
  website: 'www.aerocad.com.br',
  banco: 'INTER (077)',
  agencia: '0001',
  contaCorrente: '7637194-8',
  favorecida: 'AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA',
  chavePix: '28.036.597/0001-43',
  representantes: {
    signataria: {
      nome: 'Jaqueline Mota de Freitas Saraiva',
      cargo: 'Gerente de Negócios e Administração',
      cpf: '005.417.801-07',
    },
    coordenador: {
      nome: 'Cleyton Borges Saraiva',
      cargo: 'Coordenador de Projetos',
    },
    responsavelTecnico: {
      nome: 'João Valmir Bigattão',
      cargo: 'Responsável Técnico — Eng. Civil',
      crea: 'CREA 124906/D-SP',
    },
  },
}

/**
 * Data de hoje por extenso no padrão brasileiro dos documentos da AEROCAD:
 * "Brasília – DF, 25 de setembro de 2026."
 */
export function dataHojeExtenso(cidade = 'Brasília – DF', data = new Date()): string {
  const meses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ]
  const dia = data.getDate()
  const mes = meses[data.getMonth()]
  const ano = data.getFullYear()
  return `${cidade}, ${dia} de ${mes} de ${ano}.`
}

/**
 * Gera o nome de arquivo padronizado conforme o catálogo oficial da AEROCAD:
 * AEROCAD_<PREFIXO>_<NÚMERO>_<ANO>_<CLIENTE>_<ESCOPO>_v<HHMMSS>
 */
export function formatDocumentFileName(params: {
  prefixo: string
  numero?: string | number
  ano?: number
  cliente?: string
  escopo?: string
  dataHora?: Date
}): string {
  const now = params.dataHora || new Date()
  const prefix = (params.prefixo || 'DOC').toUpperCase().trim()
  const num = String(params.numero || '000').replace(/[^a-zA-Z0-9]/g, '')
  const year = params.ano || now.getFullYear()

  const cleanCliente = (params.cliente || 'CLIENTE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 24)

  const cleanEscopo = (params.escopo || 'GERAL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 32)

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const timestamp = `${hh}${mm}${ss}`

  return `AEROCAD_${prefix}_${num}_${year}_${cleanCliente}_${cleanEscopo}_v${timestamp}`
}
