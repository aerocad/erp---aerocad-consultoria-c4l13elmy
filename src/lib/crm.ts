import type { Role, Trail } from '@/types/crm'

export const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  comercial: 'Comercial',
  tecnico: 'Técnico',
  financeiro: 'Financeiro',
  terceiro: 'Prestador Terceiro',
}

export const osStatusLabels: Record<string, string> = {
  atribuida: 'Atribuída',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
  rascunho: 'Rascunho',
  emitida: 'Emitida',
}

export const osStatusColors: Record<string, { bg: string; text: string; border: string }> = {
  atribuida: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  em_execucao: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  concluida: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  recusada: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  cancelada: { bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-300' },
  rascunho: { bg: 'bg-zinc-50', text: 'text-zinc-600', border: 'border-zinc-200' },
  emitida: { bg: 'bg-orange-50', text: 'text-[#D65100]', border: 'border-orange-200' },
}

export const stageLabels = {
  lead: 'Lead',
  qualificacao: 'Qualificação',
  proposta_enviada: 'Proposta enviada',
  negociacao: 'Negociação',
  ganho: 'Fechado (ganho)',
  perdido: 'Fechado (perdido)',
} as const

export const stageColors: Record<keyof typeof stageLabels, string> = {
  lead: '#9A9A9A',
  qualificacao: '#737373',
  proposta_enviada: '#595959',
  negociacao: '#FF6A13',
  ganho: '#248A57',
  perdido: '#C83E36',
}

export const trailLabels: Record<Trail, string> = {
  opea: 'OPEA',
  registro: 'Registro',
  demais: 'Demais',
}

export const trailPhases: Record<Trail, string[]> = {
  opea: [
    'Kick-off/Documentação',
    'Pré-análise/Estudo de viabilidade',
    'Elaboração do processo',
    'Protocolo SYSAGA',
    'Exigências',
    'Parecer COMAER',
    'Entrega ao cliente',
  ],
  registro: [
    'Kick-off/Documentação',
    'Viabilidade/Levantamento',
    'Projeto/Plantas',
    'Processo COMAER',
    'Processo ANAC',
    'Registro concluído',
  ],
  demais: [
    'Levantamento de dados',
    'Diagnóstico',
    'Minuta',
    'Revisão do cliente',
    'Versão final',
    'Protocolo',
    'Aprovação',
  ],
}

export const processStatusLabels = {
  nao_protocolado: 'A protocolar',
  protocolado: 'Protocolado (aguardando análise)',
  em_analise: 'Em análise no órgão',
  em_exigencia: 'Exigência pendente',
  deferido: 'Deferido/Aprovado',
  indeferido: 'Indeferido',
  arquivado: 'Arquivado',
} as const

export const processOrgaoList = [
  'DECEA-CINDACTA',
  'COMAER',
  'ANAC',
  'DECEA',
  'CINDACTA',
  'SAC',
  'Prefeitura / Órgão Municipal',
  'Outro',
] as const

export const permissions: Record<Role, string[]> = {
  admin: [
    'painel',
    'funil',
    'clientes',
    'projetos',
    'processos',
    'financeiro',
    'pessoal',
    'fornecedores',
    'relatorios',
    'documentos',
    'configuracoes',
  ],
  comercial: ['painel', 'funil', 'clientes', 'projetos', 'processos', 'financeiro', 'documentos'],
  tecnico: ['painel', 'projetos', 'processos', 'documentos'],
  financeiro: [
    'painel',
    'clientes',
    'projetos',
    'financeiro',
    'pessoal',
    'fornecedores',
    'relatorios',
  ],
  terceiro: ['terceiro-portal'],
}

export function canAccess(role: Role, area: string) {
  return permissions[role]?.includes(area) ?? false
}

/**
 * Define se o perfil tem permissão de visualizar valores financeiros em R$.
 * Regra AEROCAD:
 * - admin, comercial e financeiro: PODEM exibir valores em R$ (true).
 * - tecnico e terceiro (prestador): valores SEMPRE mascarados como "R$ •••••" (false).
 */
export function canViewFinancials(role?: Role | string | null): boolean {
  if (!role) return false
  return role === 'admin' || role === 'comercial' || role === 'financeiro'
}

/**
 * Define se o perfil tem permissão de visualizar e manipular Notas Fiscais de Serviços (NFS-e).
 * Regra AEROCAD solicitada pelo administrador:
 * - admin, comercial e financeiro: PODEM visualizar e gerenciar NFS-e (true).
 * - tecnico e terceiro (prestador de serviço): NÃO têm acesso a NFS-e em nenhum lugar (false).
 */
export function canViewNfse(role?: Role | string | null): boolean {
  if (!role) return false
  return role === 'admin' || role === 'comercial' || role === 'financeiro'
}

/**
 * Extensões de arquivo consideradas técnicas, permitidas para o perfil técnico (.docx, .pdf, .dwg, .dxf).
 */
export const EXTENSOES_DOCS_TECNICOS: readonly string[] = ['docx', 'pdf', 'dwg', 'dxf'] as const

/**
 * Valida se uma extensão é permitida para perfil técnico.
 */
export function isTecnicoAllowedExtension(ext?: string | null): boolean {
  if (!ext) return false
  const clean = ext.replace(/^\./, '').toLowerCase().trim()
  return (EXTENSOES_DOCS_TECNICOS as readonly string[]).includes(clean)
}

export function firstName(name?: string) {
  return (name || '').trim().split(' ')[0] || 'equipe'
}

/**
 * Cargos padronizados sugeridos na AEROCAD, agrupados por área.
 * Inclui o cargo SDR na área comercial / pré-vendas.
 */
export const CARGOS_SUGERIDOS = [
  // Comercial / Pré-Vendas
  { cargo: 'SDR', area: 'Comercial' },
  { cargo: 'Executivo(a) de Contas', area: 'Comercial' },
  { cargo: 'Gerente Comercial', area: 'Comercial' },
  { cargo: 'Consultor(a) de Negócios', area: 'Comercial' },

  // Diretoria & Gestão
  { cargo: 'Diretor(a) Executivo(a)', area: 'Diretoria' },
  { cargo: 'Gerente de Negócios e Administração', area: 'Diretoria' },
  { cargo: 'Coordenador(a) de Projetos', area: 'Diretoria' },

  // Engenharia e Corpo Técnico
  { cargo: 'Engenheiro(a) Civil', area: 'Técnico' },
  { cargo: 'Engenheiro(a) Cartógrafo(a)', area: 'Técnico' },
  { cargo: 'Engenheiro(a) Agrimensor(a)', area: 'Técnico' },
  { cargo: 'Arquiteto(a) e Urbanista', area: 'Técnico' },
  { cargo: 'Analista Técnico(a) de Projetos', area: 'Técnico' },
  { cargo: 'Analista Sênior OPEA', area: 'Técnico' },
  { cargo: 'Projetista CAD / SIG', area: 'Técnico' },

  // Administrativo & Financeiro
  { cargo: 'Analista Financeiro(a)', area: 'Administrativo' },
  { cargo: 'Assistente Administrativo(a)', area: 'Administrativo' },
] as const

/**
 * Funções / Especialidades padronizadas na AEROCAD, agrupadas por área.
 * SDR (Sales Development Representative / Pré-Vendas) atua na qualificação de leads e primeiro contato.
 */
export const FUNCOES_SUGERIDAS = [
  // Comercial / Pré-Vendas
  { funcao: 'SDR', label: 'SDR (Pré-vendas / Qualificação de Leads)', area: 'Comercial' },
  { funcao: 'Pré-Vendas & Qualificação', label: 'Pré-Vendas & Qualificação', area: 'Comercial' },
  {
    funcao: 'Prospecção & Novos Negócios',
    label: 'Prospecção & Novos Negócios',
    area: 'Comercial',
  },
  { funcao: 'Negociação & Fechamento', label: 'Negociação & Fechamento', area: 'Comercial' },

  // Gestão & Representação
  { funcao: 'Representante Legal', label: 'Representante Legal', area: 'Gestão' },
  {
    funcao: 'Coordenação de Projetos e Contratos',
    label: 'Coordenação de Projetos e Contratos',
    area: 'Gestão',
  },

  // Técnica & Regulatória
  { funcao: 'Responsável Técnico (RT)', label: 'Responsável Técnico (RT)', area: 'Técnico' },
  { funcao: 'Processos OPEA / DECEA', label: 'Processos OPEA / DECEA', area: 'Técnico' },
  { funcao: 'PBZPA / PZPANA', label: 'PBZPA / PZPANA', area: 'Técnico' },
  {
    funcao: 'Registro e Homologação de Aeródromos (ANAC)',
    label: 'Registro e Homologação de Aeródromos (ANAC)',
    area: 'Técnico',
  },
  {
    funcao: 'Helipontos e Helipontos Hospitalares',
    label: 'Helipontos e Helipontos Hospitalares',
    area: 'Técnico',
  },
  {
    funcao: 'Estudos de Viabilidade & Espaço Aéreo',
    label: 'Estudos de Viabilidade & Espaço Aéreo',
    area: 'Técnico',
  },

  // Administrativo & Financeiro
  {
    funcao: 'Faturamento & Conciliação',
    label: 'Faturamento & Conciliação',
    area: 'Administrativo',
  },
  {
    funcao: 'Gestão Financeira & Balancetes',
    label: 'Gestão Financeira & Balancetes',
    area: 'Administrativo',
  },
] as const
