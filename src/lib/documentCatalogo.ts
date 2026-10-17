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
    name: 'Estudo de Viabilidade Aeronáutica (EVA)',
    category: 'estudo_viabilidade',
    description:
      'Relatório conclusivo de viabilidade técnica/operacional, análise de superfícies governantes e altura máxima construível.',
    defaultOrientation: 'portrait',
  },
  PO: {
    prefix: 'PO',
    name: 'Pedido de Compras',
    category: 'pedido_compras',
    description:
      'Contratação formal de fornecedor de serviços técnicos pela AEROCAD com itens, PIX e assinatura do comprador.',
    defaultOrientation: 'portrait',
  },
  EML: {
    prefix: 'EML',
    name: 'E-mail de Apresentação de Proposta',
    category: 'email_apresentacao',
    description:
      'Texto padronizado de encaminhamento de propostas com escopo em bullets, condições comerciais e botão copiar.',
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

export const PALETA_AEROCAD_2026 = {
  laranja: '#FF6A13', // Safety Orange (marca principal)
  cinzaTexto: '#595959',
  fundoLabel: '#F2F2F2',
  borda: '#BFBFBF',
  linhaAlt1: '#FFEDD9',
  linhaAlt2: '#FFF6EC',
  preto: '#0B0B0C',
  brancoOff: '#F4F1EC', // Manual de Marca 2026
}

export const INSTITUTIONAL_DATA = {
  nomeComercial: 'AEROCAD CONSULTORIA & AEROPORTOS',
  nomeFantasia: 'AEROCAD CONSULTORIA & AEROPORTOS',
  razaoSocial: 'AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA',
  cnpj: '28.036.597/0001-43',
  cnpjFormatado: '28.036.597/0001-43',
  inscricaoEstadual: '07.815.970/001-59',
  endereco:
    'SBS QUADRA 2 SALA 206 SOBRELOJA, ED. PRIME BUSINESS, ASA SUL, CEP.: 70.070-120, BRASÍLIA/DF.',
  cidadeUf: 'Brasília/DF',
  cep: '70.070-120',
  telefone: '+55 61 9 8462-8800',
  email: 'contato@aerocad.com.br',
  website: 'www.aerocad.com.br',
  banco: 'INTER (077)',
  agencia: '0001',
  contaCorrente: '7637194-8',
  favorecida: 'AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA',
  chavePix: '28036597000143',
  chavePixFormatada: '28.036.597/0001-43',
  representantes: {
    signataria: {
      nome: 'Jaqueline Mota de Freitas Saraiva',
      cargo: 'Signatária Administrativa / Procuradora',
      cpf: '005.417.801-07',
    },
    coordenador: {
      nome: 'Cleyton Borges Saraiva',
      cargo: 'Coordenador de Projetos',
      email: 'cleytonsaraiva@gmail.com',
    },
    responsavelTecnico: {
      nome: 'João Valmir Bigattão',
      cargo: 'RT Engenheiro Civil',
      crea: 'CREA 124906/D-SP',
    },
  },
}

/**
 * Tabela Oficial de 17 Tipos de Projeto AEROCAD com Normativa Principal (do Catálogo)
 */
export interface TipoProjetoNormativa {
  codigo: string
  tipo: string
  normativaPrincipal: string
  descricao: string
}

export const TIPOS_PROJETO_CATALOGO: TipoProjetoNormativa[] = [
  {
    codigo: 'OPEA',
    tipo: 'Objeto Projetado no Espaço Aéreo',
    normativaPrincipal: 'ICA 11-408/2021',
    descricao:
      'Análise de impacto no espaço aéreo, superfícies OLS e elaboração de pareceres técnicos.',
  },
  {
    codigo: 'PBZPA',
    tipo: 'Plano Básico de Zona de Proteção de Aeródromo',
    normativaPrincipal: 'ICA 11-408/2021 · RBAC 154',
    descricao:
      'Superfícies limitadoras de aproximação, decolagem, transição, horizontal interna e cônica.',
  },
  {
    codigo: 'PZPANA',
    tipo: 'Plano de Zoneamento de Proteção contra Auxílios à Navegação Aérea',
    normativaPrincipal: 'ICA 63-19/2021',
    descricao:
      'Proteção eletromagnética e operacional a VOR, DME, ILS, RADAR e auxílios à navegação.',
  },
  {
    codigo: 'PBZH',
    tipo: 'Plano Básico de Zona de Proteção de Heliponto',
    normativaPrincipal: 'ICA 11-408/2021 · RBAC 155',
    descricao:
      'Zonas de aproximação, decolagem e transição de helipontos elevados e ao nível do solo.',
  },
  {
    codigo: 'PBZR / PEZR',
    tipo: 'Plano Básico / Específico de Zoneamento de Ruído',
    normativaPrincipal: 'RBAC 161',
    descricao:
      'Curvas de ruído DNL 65/75 dBA e compatibilização com o uso do solo urbano municipal.',
  },
  {
    codigo: 'EVA / EVTEA',
    tipo: 'Estudo de Viabilidade (Técnica / Econômica / Ambiental)',
    normativaPrincipal: 'ICA 11-408 / RBAC 154',
    descricao:
      'Relatório comparativo de sítios, restrições aeronáuticas e altura máxima construível.',
  },
  {
    codigo: 'Registro de Aeródromo',
    tipo: 'Registro Privado ou Público de Aeródromo',
    normativaPrincipal: 'RBAC 153 · ICA 11-3 · ICA 12-24',
    descricao:
      'Abertura ao tráfego aéreo público ou inscrição de aeródromo privado no cadastro ANAC.',
  },
  {
    codigo: 'Registro de Heliponto',
    tipo: 'Registro Privativo de Heliponto',
    normativaPrincipal: 'RBAC 155 · ICA 11-408',
    descricao: 'Homologação e cadastramento de helipontos prediais, hospitalares e industriais.',
  },
  {
    codigo: 'Alteração Cadastral',
    tipo: 'Mudança de Aeronave-Crítica, Geometria ou Auxílios',
    normativaPrincipal: 'ICA 11-3 · SYSAGA / DECEA',
    descricao: 'Atualização cadastral para operação de novas aeronaves ou adequação de cabeceiras.',
  },
  {
    codigo: 'Homologação',
    tipo: 'Aeroporto Comercial / Concessionado',
    normativaPrincipal: 'RBAC 139 (ANAC)',
    descricao:
      'Certificação operacional de aeroporto e cumprimento das especificações operativas (EO).',
  },
  {
    codigo: 'SDIA',
    tipo: 'Sistema de Dados e Informações Aeronáuticas',
    normativaPrincipal: 'Portaria ANAC 1.214/SIA',
    descricao:
      'Inscrição e atualização de características físicas e operacionais de pistas e helipontos.',
  },
  {
    codigo: 'PDIR',
    tipo: 'Plano Diretor Aeroportuário (PDIR)',
    normativaPrincipal: 'RBAC 153 · PGI (Plano de Gestão da Infraestrutura)',
    descricao:
      'Planejamento de longo prazo (horizontes 5, 10 e 20 anos), pranchas A0 paper space e zoneamento operacional.',
  },
  {
    codigo: 'PGI',
    tipo: 'Plano de Gestão da Infraestrutura',
    normativaPrincipal: 'RBAC 153',
    descricao:
      'Gestão da integridade estrutural, pavimentos aeroportuários e plano de manutenção preventiva.',
  },
  {
    codigo: 'PANS-OPS',
    tipo: 'Procedimentos de Voo por Instrumento',
    normativaPrincipal: 'Doc 8168 OACI',
    descricao:
      'Desenho e avaliação de procedimentos IFR: IAC, SID, STAR, RNP APCH e áreas de proteção.',
  },
  {
    codigo: 'MOPS',
    tipo: 'Manual de Operações Aeroportuárias',
    normativaPrincipal: 'RBAC 139 / 153',
    descricao:
      'Manual de procedimentos operacionais e de emergência do aeródromo em conformidade ANAC.',
  },
  {
    codigo: 'Cartas Aeronáuticas',
    tipo: 'Cartas Oficiais AIS-Brasil (ADC, PDC, AOC)',
    normativaPrincipal: 'Anexo 4 OACI · AIS-Brasil',
    descricao:
      'Cartas de aeródromo, estacionamento, perfil de obstáculos e publicação em AIP-BRASIL.',
  },
  {
    codigo: 'Projeto Básico/Executivo',
    tipo: 'Geometria, Pavimento, Drenagem, Sinalização, Balizamento',
    normativaPrincipal: 'RBAC 154',
    descricao:
      'Projetos de engenharia de pistas de pouso, pátios de aeronaves, balizamento e sinalização.',
  },
  {
    codigo: 'Laudos / Pareceres',
    tipo: 'Laudos Periciais e Pareceres Técnicos com ART/RRT',
    normativaPrincipal: 'CREA / CAU · Resoluções CONFEA',
    descricao: 'Documento pericial conclusivo com responsabilidade técnica e valor probatório.',
  },
]

/**
 * 17 Prefixos de Nomenclatura Oficiais da AEROCAD
 */
export interface PrefixoNomenclatura {
  prefixo: string
  significado: string
  descricao: string
}

export const PREFIXOS_NOMENCLATURA: PrefixoNomenclatura[] = [
  {
    prefixo: 'PC',
    significado: 'Proposta Comercial',
    descricao: 'Documento comercial com itens, preços e parcelas vinculadas a marcos técnicos.',
  },
  {
    prefixo: 'PT',
    significado: 'Proposta Técnica',
    descricao: 'Detalhamento técnico com Quadro de Aderência, normas, premissas e Gantt.',
  },
  {
    prefixo: 'CT / CTR',
    significado: 'Contrato / Minuta de Contrato',
    descricao:
      'Instrumento contratual de prestação de serviços com cláusulas padrão e foro Brasília/DF.',
  },
  {
    prefixo: 'OS',
    significado: 'Ordem de Serviço Interna',
    descricao: 'Abertura técnica interna dirigida ao RT com entregáveis e equipe designada.',
  },
  {
    prefixo: 'AT',
    significado: 'Atestado Técnico / Ata de Reunião',
    descricao: 'Registro formal de reuniões técnicas, deliberações e pendências com responsáveis.',
  },
  {
    prefixo: 'IGR',
    significado: 'Ingresso de Registro (Dossiê)',
    descricao: 'Dossiê instrutório para protocolo e registro perante órgãos reguladores.',
  },
  {
    prefixo: 'PR',
    significado: 'Procuração',
    descricao: 'Outorga para representação junto ao DECEA, COMAER e ANAC.',
  },
  {
    prefixo: 'FT / NF',
    significado: 'Fatura / Nota de Cobrança',
    descricao: 'Cobrança por marco técnico com vencimento em 30 ou 60 dias e dados bancários.',
  },
  {
    prefixo: 'RB',
    significado: 'Recibo',
    descricao: 'Comprovante irrevogável de quitação de honorários de etapa concluída.',
  },
  {
    prefixo: 'RG',
    significado: 'Relatório Gerencial Mensal',
    descricao: 'Acompanhamento periódico mensal (ex.: RG CNI Heliponto SNAW/CEAMN).',
  },
  {
    prefixo: 'MD / MC',
    significado: 'Memorial Descritivo / Memorial de Cálculo',
    descricao: 'Peça técnica descritiva ou quantitativa de superfícies limitadoras e geometria.',
  },
  {
    prefixo: 'LT / PT',
    significado: 'Laudo Técnico / Parecer Técnico',
    descricao: 'Documento com peso probatório pericial emitido pelo Responsável Técnico.',
  },
  {
    prefixo: 'FNC',
    significado: 'Ficha de Não Conformidade',
    descricao: 'Registro formal de desvio identificado com causa raiz e plano imediato.',
  },
  {
    prefixo: 'PAC',
    significado: 'Plano de Ação Corretiva',
    descricao: 'Resposta formal a FNC ou exigência de órgão com prazos e evidências.',
  },
  {
    prefixo: 'NT',
    significado: 'Nota Técnica',
    descricao: 'Parecer técnico rápido (2-6 páginas) sobre consulta específica.',
  },
  {
    prefixo: 'RQ',
    significado: 'Requerimento ANAC / DECEA',
    descricao: 'Formulário oficial formal com fundamentação normativa e rol de peças instrutórias.',
  },
  {
    prefixo: 'CHK',
    significado: 'Checklist de Inspeção',
    descricao: 'Formulário de vistoria em campo com verificação Conforme/Não Conforme.',
  },
  {
    prefixo: 'EVT',
    significado: 'Estudo de Viabilidade Técnica',
    descricao: 'Estudo técnico preliminar com 11 seções, análise SWOT e viabilidade.',
  },
  {
    prefixo: 'CL',
    significado: 'Checklist de Inspeção (Planilha)',
    descricao: 'Planilha técnica de vistoria com categorias documentais e físicas.',
  },
  {
    prefixo: 'CFF',
    significado: 'Cronograma Físico-Financeiro (Planilha)',
    descricao: 'Planejamento de obras e desembolsos com Curva S integrada.',
  },
]

/**
 * 10 Regras e Convenções Globais da AEROCAD (Seção J)
 */
export const REGRAS_GLOBAIS_AEROCAD = [
  'Data dos documentos dinâmica via data_hoje_extenso() — nunca hardcoded.',
  'Títulos de seções com keep-with-next (nunca quebrar página logo após o título).',
  'Tabelas estruturadas com cabeçalho repetindo no topo (evitar orfãs de cabeçalho).',
  'Numeração sequencial contínua de figuras, quadros e tabelas.',
  'Bloco de assinatura do RT sem menção a ART/RRT quando não aplicável ao pedido.',
  'Marcos de pagamento vinculados a ENTREGAS TÉCNICAS comprováveis (nunca datas puras).',
  'NFS-e emitida em até 5 dias úteis após o cumprimento do marco comprobatório.',
  'Vencimento padrão de 30 dias (ou 60 dias quando exigência do cliente, ex.: Alcoa).',
  'ART/RRT emitida no CREA/CAU por disciplina/documento pelo RT na UF do empreendimento.',
  'Cronograma Gantt em página paisagem (landscape), com segregação explícita entre prazo sob controle AEROCAD e prazo discricionário de órgãos públicos.',
]

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
