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
