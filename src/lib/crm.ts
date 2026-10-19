import type { Role, Trail, UserRecord } from '@/types/crm'

export const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  comercial: 'Comercial',
  tecnico: 'Técnico',
  financeiro: 'Financeiro',
  terceiro: 'Prestador Terceiro',
}

/**
 * Retorna uma string formatada com os rótulos de todos os perfis do usuário (ex.: "Comercial · Financeiro").
 */
export function formatUserRoles(
  userOrRole?: UserRecord | Role | Role[] | string | null,
  separator = ' · ',
): string {
  const roles = getUserRoles(userOrRole)
  if (roles.length === 0) return 'Sem perfil'
  return roles.map((r) => roleLabels[r] || r).join(separator)
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
    'mensagens',
    'configuracoes',
  ],
  comercial: [
    'painel',
    'funil',
    'clientes',
    'projetos',
    'processos',
    'financeiro',
    'documentos',
    'mensagens',
  ],
  tecnico: ['painel', 'projetos', 'processos', 'documentos', 'mensagens'],
  financeiro: ['financeiro', 'pessoal', 'fornecedores', 'relatorios', 'mensagens'],
  terceiro: ['terceiro-portal', 'mensagens'],
}

/**
 * Normaliza perfil único ou lista de perfis para uma lista de roles válidos.
 */
export function getUserRoles(userOrRole?: UserRecord | Role | Role[] | string | null): Role[] {
  if (!userOrRole) return []
  if (Array.isArray(userOrRole)) {
    return userOrRole.filter(Boolean) as Role[]
  }
  if (typeof userOrRole === 'object') {
    const list =
      Array.isArray(userOrRole.roles) && userOrRole.roles.length > 0
        ? userOrRole.roles
        : userOrRole.role
          ? [userOrRole.role]
          : []
    return list.filter(Boolean) as Role[]
  }
  return [userOrRole as Role]
}

/**
 * Verifica se o usuário possui determinado perfil (ou se é admin).
 */
export function userHasRole(
  userOrRole: UserRecord | Role | Role[] | string | null | undefined,
  roleToCheck: Role,
): boolean {
  const roles = getUserRoles(userOrRole)
  return roles.includes(roleToCheck)
}

/**
 * Verifica se o usuário possui QUALQUER um dos perfis fornecidos (união).
 */
export function userHasAnyRole(
  userOrRole: UserRecord | Role | Role[] | string | null | undefined,
  rolesToCheck: Role[],
): boolean {
  const roles = getUserRoles(userOrRole)
  return rolesToCheck.some((r) => roles.includes(r))
}
/**
 * Verifica se o usuário é administrador (possui admin entre seus perfis).
 */
export function isUserAdmin(userOrRole?: UserRecord | Role | Role[] | string | null): boolean {
  return userHasRole(userOrRole, 'admin')
}

/**
 * Verifica se o usuário (ou conjunto de perfis) tem acesso à área indicada.
 * Acesso é a UNIÃO de todas as permissões dos perfis atribuídos.
 */
export function canAccess(
  userOrRole: UserRecord | Role | Role[] | string | null | undefined,
  area: string,
): boolean {
  const roles = getUserRoles(userOrRole)
  if (roles.length === 0) return false

  // Se for objeto UserRecord e possuir personalização de menus_visiveis definida pelo admin:
  // A personalização NUNCA dá acesso além dos perfis (só restringe).
  if (typeof userOrRole === 'object' && userOrRole !== null && 'menus_visiveis' in userOrRole) {
    const custom = userOrRole.menus_visiveis
    if (Array.isArray(custom)) {
      if (!custom.includes(area)) {
        return false
      }
    }
  }

  return roles.some((r) => permissions[r]?.includes(area) ?? false)
}

/**
 * Define se o perfil tem permissão de visualizar valores financeiros em R$.
 * Regra AEROCAD:
 * - admin, comercial e financeiro: PODEM exibir valores em R$ (true).
 * - tecnico e terceiro (prestador): valores SEMPRE mascarados como "R$ •••••" (false).
 */
export function canViewFinancials(
  userOrRole?: UserRecord | Role | Role[] | string | null,
): boolean {
  const roles = getUserRoles(userOrRole)
  if (roles.length === 0) return false
  return roles.some((r) => r === 'admin' || r === 'comercial' || r === 'financeiro')
}

/**
 * Define se o perfil tem permissão de visualizar e manipular Notas Fiscais de Serviços (NFS-e).
 * Regra AEROCAD solicitada pelo administrador:
 * - admin, comercial e financeiro: PODEM visualizar e gerenciar NFS-e (true).
 * - tecnico e terceiro (prestador de serviço): NÃO têm acesso a NFS-e em nenhum lugar (false).
 */
export function canViewNfse(userOrRole?: UserRecord | Role | Role[] | string | null): boolean {
  const roles = getUserRoles(userOrRole)
  if (roles.length === 0) return false
  return roles.some((r) => r === 'admin' || r === 'comercial' || r === 'financeiro')
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
 * Áreas de atuação corporativas da AEROCAD.
 */
export const AREAS_ATUACAO_COLABORADOR = [
  'Administrativo',
  'Comercial',
  'Financeiro',
  'Técnico',
] as const

export type AreaAtuacaoColaborador = (typeof AREAS_ATUACAO_COLABORADOR)[number]

/**
 * Níveis hierárquicos da AEROCAD em ordem decrescente de senioridade/comando:
 * 1. Diretor
 * 2. Gerente
 * 3. Coordenador
 * 4. Analista Sênior
 * 5. Analista Pleno
 * 6. Analista Júnior
 * 7. Técnico
 * 8. Auxiliar
 * 9. Estagiário
 */
export const HIERARQUIA_NIVEIS_ORDENADOS = [
  'Diretor',
  'Gerente',
  'Coordenador',
  'Analista Sênior',
  'Analista Pleno',
  'Analista Júnior',
  'Técnico',
  'Auxiliar',
  'Estagiário',
] as const

export type NivelHierarquico = (typeof HIERARQUIA_NIVEIS_ORDENADOS)[number]

export interface CargoItem {
  cargo: string
  area: AreaAtuacaoColaborador
  nivel: NivelHierarquico
  descricao?: string
}

export interface FuncaoItem {
  funcao: string
  label: string
  area: AreaAtuacaoColaborador
  nivel?: NivelHierarquico
  descricao?: string
}

/**
 * Cargos padronizados sugeridos na AEROCAD, agrupados pelas 4 áreas solicitadas
 * (Administrativo, Comercial, Financeiro, Técnico) e ordenados segundo a hierarquia decrescente.
 * O SDR (Sales Development Representative) é listado como cargo de qualificação/prospecção na área Comercial.
 * Topógrafo na área Técnica; Contador na área Financeira.
 */
export const CARGOS_SUGERIDOS: readonly CargoItem[] = [
  // ==========================================
  // ÁREA ADMINISTRATIVO
  // ==========================================
  { cargo: 'Diretor(a) Administrativo(a)', area: 'Administrativo', nivel: 'Diretor' },
  { cargo: 'Gerente Administrativo(a)', area: 'Administrativo', nivel: 'Gerente' },
  { cargo: 'Coordenador(a) Administrativo(a)', area: 'Administrativo', nivel: 'Coordenador' },
  { cargo: 'Analista Administrativo(a) Sênior', area: 'Administrativo', nivel: 'Analista Sênior' },
  { cargo: 'Analista Administrativo(a) Pleno', area: 'Administrativo', nivel: 'Analista Pleno' },
  { cargo: 'Analista Administrativo(a) Júnior', area: 'Administrativo', nivel: 'Analista Júnior' },
  { cargo: 'Assistente Administrativo(a)', area: 'Administrativo', nivel: 'Técnico' },
  { cargo: 'Auxiliar Administrativo(a)', area: 'Administrativo', nivel: 'Auxiliar' },
  { cargo: 'Estagiário(a) de Administração', area: 'Administrativo', nivel: 'Estagiário' },

  // ==========================================
  // ÁREA COMERCIAL
  // ==========================================
  { cargo: 'Diretor(a) Comercial', area: 'Comercial', nivel: 'Diretor' },
  { cargo: 'Gerente Comercial', area: 'Comercial', nivel: 'Gerente' },
  { cargo: 'Coordenador(a) Comercial / Vendas', area: 'Comercial', nivel: 'Coordenador' },
  { cargo: 'Executivo(a) de Contas Sênior', area: 'Comercial', nivel: 'Analista Sênior' },
  { cargo: 'Consultor(a) de Negócios Sênior', area: 'Comercial', nivel: 'Analista Sênior' },
  { cargo: 'Executivo(a) de Contas Pleno', area: 'Comercial', nivel: 'Analista Pleno' },
  { cargo: 'Consultor(a) de Negócios Pleno', area: 'Comercial', nivel: 'Analista Pleno' },
  {
    cargo: 'SDR',
    area: 'Comercial',
    nivel: 'Analista Júnior',
    descricao: 'Sales Development Representative / Pré-Vendas',
  },
  { cargo: 'SDR (Pré-Vendas)', area: 'Comercial', nivel: 'Analista Júnior' },
  { cargo: 'Executivo(a) de Contas Júnior', area: 'Comercial', nivel: 'Analista Júnior' },
  { cargo: 'Assistente Comercial', area: 'Comercial', nivel: 'Técnico' },
  { cargo: 'Auxiliar de Vendas / Prospecção', area: 'Comercial', nivel: 'Auxiliar' },
  { cargo: 'Estagiário(a) Comercial / SDR', area: 'Comercial', nivel: 'Estagiário' },

  // ==========================================
  // ÁREA FINANCEIRO
  // ==========================================
  { cargo: 'Diretor(a) Financeiro(a) / CFO', area: 'Financeiro', nivel: 'Diretor' },
  { cargo: 'Gerente Financeiro(a)', area: 'Financeiro', nivel: 'Gerente' },
  {
    cargo: 'Coordenador(a) Financeiro(a) / Controladoria',
    area: 'Financeiro',
    nivel: 'Coordenador',
  },
  { cargo: 'Contador(a) Responsável', area: 'Financeiro', nivel: 'Analista Sênior' },
  { cargo: 'Analista Financeiro(a) Sênior', area: 'Financeiro', nivel: 'Analista Sênior' },
  { cargo: 'Contador(a)', area: 'Financeiro', nivel: 'Analista Pleno' },
  { cargo: 'Analista Financeiro(a) Pleno', area: 'Financeiro', nivel: 'Analista Pleno' },
  { cargo: 'Analista Financeiro(a) Júnior', area: 'Financeiro', nivel: 'Analista Júnior' },
  { cargo: 'Assistente Financeiro(a) / Fiscal', area: 'Financeiro', nivel: 'Técnico' },
  { cargo: 'Auxiliar Financeiro(a) / Cobrança', area: 'Financeiro', nivel: 'Auxiliar' },
  { cargo: 'Estagiário(a) de Finanças / Contabilidade', area: 'Financeiro', nivel: 'Estagiário' },

  // ==========================================
  // ÁREA TÉCNICO
  // ==========================================
  { cargo: 'Diretor(a) Técnico(a)', area: 'Técnico', nivel: 'Diretor' },
  { cargo: 'Gerente de Engenharia e Projetos', area: 'Técnico', nivel: 'Gerente' },
  { cargo: 'Coordenador(a) de Projetos', area: 'Técnico', nivel: 'Coordenador' },
  { cargo: 'Engenheiro(a) Civil Sênior', area: 'Técnico', nivel: 'Analista Sênior' },
  { cargo: 'Engenheiro(a) Cartógrafo(a) Sênior', area: 'Técnico', nivel: 'Analista Sênior' },
  { cargo: 'Engenheiro(a) Agrimensor(a) Sênior', area: 'Técnico', nivel: 'Analista Sênior' },
  { cargo: 'Analista Sênior OPEA / DECEA', area: 'Técnico', nivel: 'Analista Sênior' },
  { cargo: 'Arquiteto(a) e Urbanista Sênior', area: 'Técnico', nivel: 'Analista Sênior' },
  { cargo: 'Engenheiro(a) Civil', area: 'Técnico', nivel: 'Analista Pleno' },
  { cargo: 'Engenheiro(a) Cartógrafo(a)', area: 'Técnico', nivel: 'Analista Pleno' },
  { cargo: 'Engenheiro(a) Agrimensor(a)', area: 'Técnico', nivel: 'Analista Pleno' },
  { cargo: 'Arquiteto(a) e Urbanista', area: 'Técnico', nivel: 'Analista Pleno' },
  { cargo: 'Analista Técnico(a) de Projetos Pleno', area: 'Técnico', nivel: 'Analista Pleno' },
  { cargo: 'Engenheiro(a) Júnior', area: 'Técnico', nivel: 'Analista Júnior' },
  { cargo: 'Analista Técnico(a) Júnior', area: 'Técnico', nivel: 'Analista Júnior' },
  {
    cargo: 'Topógrafo(a)',
    area: 'Técnico',
    nivel: 'Técnico',
    descricao: 'Levantamentos topográficos e georreferenciamento',
  },
  { cargo: 'Projetista CAD / SIG', area: 'Técnico', nivel: 'Técnico' },
  { cargo: 'Técnico(a) em Agrimensura / Edificações', area: 'Técnico', nivel: 'Técnico' },
  { cargo: 'Auxiliar Técnico(a) de Campo / Projetos', area: 'Técnico', nivel: 'Auxiliar' },
  { cargo: 'Estagiário(a) de Engenharia / Cartografia', area: 'Técnico', nivel: 'Estagiário' },
] as const

/**
 * Funções / Especialidades padronizadas na AEROCAD, agrupadas pelas 4 áreas
 * (Administrativo, Comercial, Financeiro, Técnico) com ordenação hierárquica por nível.
 */
export const FUNCOES_SUGERIDAS: readonly FuncaoItem[] = [
  // ==========================================
  // ÁREA ADMINISTRATIVO
  // ==========================================
  {
    funcao: 'Representante Legal',
    label: 'Representante Legal / Quadro Societário',
    area: 'Administrativo',
    nivel: 'Diretor',
  },
  {
    funcao: 'Gestão de Contratos & Pessoal',
    label: 'Gestão de Contratos & Pessoal',
    area: 'Administrativo',
    nivel: 'Gerente',
  },
  {
    funcao: 'Apoio Administrativo & RH',
    label: 'Apoio Administrativo & RH',
    area: 'Administrativo',
    nivel: 'Técnico',
  },
  {
    funcao: 'Rotinas de Escritório & Atendimento',
    label: 'Rotinas de Escritório & Atendimento',
    area: 'Administrativo',
    nivel: 'Auxiliar',
  },

  // ==========================================
  // ÁREA COMERCIAL
  // ==========================================
  {
    funcao: 'Gestão Comercial & Parcerias Estratégicas',
    label: 'Gestão Comercial & Parcerias Estratégicas',
    area: 'Comercial',
    nivel: 'Gerente',
  },
  {
    funcao: 'Negociação & Fechamento de Contratos',
    label: 'Negociação & Fechamento de Contratos',
    area: 'Comercial',
    nivel: 'Coordenador',
  },
  {
    funcao: 'Prospecção & Novos Negócios',
    label: 'Prospecção & Novos Negócios',
    area: 'Comercial',
    nivel: 'Analista Sênior',
  },
  {
    funcao: 'SDR',
    label: 'SDR (Pré-vendas / Qualificação de Leads)',
    area: 'Comercial',
    nivel: 'Analista Júnior',
  },
  {
    funcao: 'Pré-Vendas & Qualificação',
    label: 'Pré-Vendas & Qualificação',
    area: 'Comercial',
    nivel: 'Analista Júnior',
  },
  {
    funcao: 'Atendimento & Follow-up de Propostas',
    label: 'Atendimento & Follow-up de Propostas',
    area: 'Comercial',
    nivel: 'Técnico',
  },

  // ==========================================
  // ÁREA FINANCEIRO
  // ==========================================
  {
    funcao: 'Gestão Financeira & Balancetes',
    label: 'Gestão Financeira & Balancetes',
    area: 'Financeiro',
    nivel: 'Gerente',
  },
  {
    funcao: 'Controladoria & Fechamento Contábil',
    label: 'Controladoria & Fechamento Contábil',
    area: 'Financeiro',
    nivel: 'Coordenador',
  },
  {
    funcao: 'Contabilidade & Escrituração',
    label: 'Contabilidade & Escrituração',
    area: 'Financeiro',
    nivel: 'Analista Sênior',
  },
  {
    funcao: 'Faturamento & Emissão de NFS-e',
    label: 'Faturamento & Emissão de NFS-e',
    area: 'Financeiro',
    nivel: 'Analista Pleno',
  },
  {
    funcao: 'Contas a Pagar & Receber',
    label: 'Contas a Pagar & Receber',
    area: 'Financeiro',
    nivel: 'Analista Júnior',
  },
  {
    funcao: 'Conciliação Bancária & Cobrança',
    label: 'Conciliação Bancária & Cobrança',
    area: 'Financeiro',
    nivel: 'Técnico',
  },

  // ==========================================
  // ÁREA TÉCNICO
  // ==========================================
  {
    funcao: 'Coordenação de Projetos e Contratos',
    label: 'Coordenação de Projetos e Contratos',
    area: 'Técnico',
    nivel: 'Coordenador',
  },
  {
    funcao: 'Responsável Técnico (RT)',
    label: 'Responsável Técnico (RT) — ART / RRT',
    area: 'Técnico',
    nivel: 'Analista Sênior',
  },
  {
    funcao: 'Processos OPEA / DECEA',
    label: 'Processos OPEA / DECEA',
    area: 'Técnico',
    nivel: 'Analista Sênior',
  },
  { funcao: 'PBZPA / PZPANA', label: 'PBZPA / PZPANA', area: 'Técnico', nivel: 'Analista Sênior' },
  {
    funcao: 'Registro e Homologação de Aeródromos (ANAC)',
    label: 'Registro e Homologação de Aeródromos (ANAC)',
    area: 'Técnico',
    nivel: 'Analista Sênior',
  },
  {
    funcao: 'Helipontos e Helipontos Hospitalares',
    label: 'Helipontos e Helipontos Hospitalares',
    area: 'Técnico',
    nivel: 'Analista Sênior',
  },
  {
    funcao: 'Estudos de Viabilidade & Espaço Aéreo',
    label: 'Estudos de Viabilidade & Espaço Aéreo',
    area: 'Técnico',
    nivel: 'Analista Pleno',
  },
  {
    funcao: 'Levantamentos Topográficos & Georreferenciamento',
    label: 'Levantamentos Topográficos & Georreferenciamento',
    area: 'Técnico',
    nivel: 'Técnico',
  },
  {
    funcao: 'Desenho Técnico CAD & GIS',
    label: 'Desenho Técnico CAD & GIS',
    area: 'Técnico',
    nivel: 'Técnico',
  },
  {
    funcao: 'Suporte Técnico de Campo',
    label: 'Suporte Técnico de Campo',
    area: 'Técnico',
    nivel: 'Auxiliar',
  },
] as const

/**
 * Retorna o peso hierárquico (menor valor = maior na hierarquia)
 */
export function getNivelHierarquicoWeight(nivel?: string): number {
  if (!nivel) return 999
  const idx = (HIERARQUIA_NIVEIS_ORDENADOS as readonly string[]).indexOf(nivel)
  return idx === -1 ? 999 : idx
}

/**
 * Agrupa cargos por área e os ordena pela hierarquia da AEROCAD.
 */
export function getCargosAgrupadosPorArea(): Record<AreaAtuacaoColaborador, CargoItem[]> {
  const grupos: Record<AreaAtuacaoColaborador, CargoItem[]> = {
    Administrativo: [],
    Comercial: [],
    Financeiro: [],
    Técnico: [],
  }

  CARGOS_SUGERIDOS.forEach((c) => {
    if (grupos[c.area]) {
      grupos[c.area].push(c)
    }
  })

  // Ordena cada grupo pela hierarquia decrescente
  for (const area of AREAS_ATUACAO_COLABORADOR) {
    grupos[area].sort((a, b) => {
      const diff = getNivelHierarquicoWeight(a.nivel) - getNivelHierarquicoWeight(b.nivel)
      if (diff !== 0) return diff
      return a.cargo.localeCompare(b.cargo, 'pt-BR')
    })
  }

  return grupos
}

/**
 * Agrupa funções por área e as ordena pela hierarquia.
 */
export function getFuncoesAgrupadasPorArea(): Record<AreaAtuacaoColaborador, FuncaoItem[]> {
  const grupos: Record<AreaAtuacaoColaborador, FuncaoItem[]> = {
    Administrativo: [],
    Comercial: [],
    Financeiro: [],
    Técnico: [],
  }

  FUNCOES_SUGERIDAS.forEach((f) => {
    if (grupos[f.area]) {
      grupos[f.area].push(f)
    }
  })

  for (const area of AREAS_ATUACAO_COLABORADOR) {
    grupos[area].sort((a, b) => {
      const diff = getNivelHierarquicoWeight(a.nivel) - getNivelHierarquicoWeight(b.nivel)
      if (diff !== 0) return diff
      return a.label.localeCompare(b.label, 'pt-BR')
    })
  }

  return grupos
}
