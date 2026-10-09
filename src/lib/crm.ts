import type { Role, Trail } from '@/types/crm'

export const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  comercial: 'Comercial',
  tecnico: 'Técnico',
  financeiro: 'Financeiro',
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
  nao_protocolado: 'Não protocolado',
  protocolado: 'Protocolado',
  em_exigencia: 'Em exigência',
  deferido: 'Deferido',
  indeferido: 'Indeferido',
  arquivado: 'Arquivado',
} as const

export const permissions: Record<Role, string[]> = {
  admin: [
    'painel',
    'funil',
    'clientes',
    'projetos',
    'processos',
    'financeiro',
    'documentos',
    'configuracoes',
  ],
  comercial: ['painel', 'funil', 'clientes', 'projetos', 'processos', 'financeiro', 'documentos'],
  tecnico: ['painel', 'clientes', 'projetos', 'processos', 'documentos'],
  financeiro: ['painel', 'clientes', 'projetos', 'financeiro'],
}

export function canAccess(role: Role, area: string) {
  return permissions[role]?.includes(area) ?? false
}

export function firstName(name?: string) {
  return (name || '').trim().split(' ')[0] || 'equipe'
}
