import { useState, type FormEvent } from 'react'
import { useEffect } from 'react'
import {
  Users,
  UserPlus,
  Shield,
  UserCheck,
  UserX,
  Eye,
  Info,
  CheckCircle2,
  XCircle,
  Pencil,
  Lock,
  Trash2,
  AlertTriangle,
  UserCheck2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CrmBadge } from '@/components/common/CrmBadge'
import { initials } from '@/lib/format'
import { roleLabels, getUserRoles } from '@/lib/crm'
import pb from '@/lib/pocketbase/client'
import { updateOne } from '@/services/api'
import type { UserRecord, Role } from '@/types/crm'
import {
  analisarImpactoExclusaoUsuario,
  executarExclusaoUsuario,
  type ImpactoExclusaoUsuario,
} from '@/services/exclusaoService'
import { toast } from 'sonner'

export const LIMITE_MAXIMO_USUARIOS_ATIVOS = 10

interface GestaoUsuariosAdminSectionProps {
  users: UserRecord[]
  rawUser: UserRecord | null
  isRealAdmin: boolean
  isSimulating: boolean
  simulatedRole: Role | null
  startSimulation: (role: Role) => void
  stopSimulation: () => void
  onReload: () => Promise<void>
}

export function GestaoUsuariosAdminSection({
  users,
  rawUser,
  isRealAdmin,
  isSimulating,
  simulatedRole,
  startSimulation,
  stopSimulation,
  onReload,
}: GestaoUsuariosAdminSectionProps) {
  // Filtro ou contagens
  const ativos = users.filter((u) => u.ativo !== false)
  const inativos = users.filter((u) => u.ativo === false)
  const totalAtivos = ativos.length
  const limiteAtingido = totalAtivos >= LIMITE_MAXIMO_USUARIOS_ATIVOS

  const perfisDisponiveis: Array<{ role: Role; label: string; desc: string }> = [
    {
      role: 'admin',
      label: 'Administrador',
      desc: 'Acesso total a todas as áreas e configurações',
    },
    { role: 'comercial', label: 'Comercial', desc: 'Painel, Funil de Vendas, Clientes, Propostas' },
    { role: 'tecnico', label: 'Técnico', desc: 'Projetos, Processos regulatórios, Documentos' },
    { role: 'financeiro', label: 'Financeiro', desc: 'Contas, Extratos, Conciliação, Balancetes' },
    {
      role: 'terceiro',
      label: 'Prestador Terceiro',
      desc: 'Portal exclusivo de Ordens de Serviço',
    },
  ]

  // Modal Novo Usuário
  const [createOpen, setCreateOpen] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novosPerfis, setNovosPerfis] = useState<Role[]>(['comercial'])
  const [novoColaboradorId, setNovoColaboradorId] = useState<string>('manual')
  const [colaboradoresDisponiveis, setColaboradoresDisponiveis] = useState<
    Array<{ id: string; nome_completo: string; email?: string; cargo?: string }>
  >([])
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false)

  // Mapa de colaboradores vinculados a cada usuário (userId -> { id, nome_completo, cargo })
  const [colaboradoresPorUsuario, setColaboradoresPorUsuario] = useState<
    Record<string, { id: string; nome_completo: string; cargo?: string }>
  >({})

  const carregarColaboradoresVinculados = async () => {
    try {
      const colabs = await pb.collection('colaboradores').getFullList({
        filter: "usuario_sistema != ''",
        fields: 'id,nome_completo,cargo,usuario_sistema',
      })
      const mapa: Record<string, { id: string; nome_completo: string; cargo?: string }> = {}
      for (const c of colabs) {
        if (c.usuario_sistema) {
          mapa[c.usuario_sistema] = {
            id: c.id,
            nome_completo: c.nome_completo || 'Colaborador',
            cargo: c.cargo,
          }
        }
      }
      setColaboradoresPorUsuario(mapa)
    } catch (e) {
      console.warn('Erro ao carregar colaboradores vinculados:', e)
    }
  }

  useEffect(() => {
    void carregarColaboradoresVinculados()
  }, [users])

  // Modal Editar Perfil / Status / Senha
  const [editTarget, setEditTarget] = useState<UserRecord | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editPerfis, setEditPerfis] = useState<Role[]>(['comercial'])
  const [editAtivo, setEditAtivo] = useState(true)
  const [editNovaSenha, setEditNovaSenha] = useState('')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  // Modal Exclusão Permanente de Usuário
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null)
  const [impactoExclusao, setImpactoExclusao] = useState<ImpactoExclusaoUsuario | null>(null)
  const [carregandoImpacto, setCarregandoImpacto] = useState(false)
  const [confirmacaoDigitada, setConfirmacaoDigitada] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleOpenDelete = async (target: UserRecord) => {
    if (rawUser?.id === target.id) {
      toast.error('Você não pode excluir sua própria conta de usuário logada.')
      return
    }

    setDeleteTarget(target)
    setConfirmacaoDigitada('')
    setCarregandoImpacto(true)
    setImpactoExclusao(null)

    try {
      const impacto = await analisarImpactoExclusaoUsuario(target.id, rawUser?.id)
      setImpactoExclusao(impacto)
    } catch (e: any) {
      toast.error(`Erro ao verificar impacto de exclusão: ${e?.message || e}`)
    } finally {
      setCarregandoImpacto(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    if (confirmacaoDigitada.trim().toUpperCase() !== 'EXCLUIR') {
      toast.error('Digite a palavra EXCLUIR para confirmar a exclusão permanente.')
      return
    }

    setIsDeleting(true)
    try {
      await executarExclusaoUsuario(deleteTarget.id, {
        id: rawUser?.id || '',
        nome: rawUser?.name || 'Administrador',
        email: rawUser?.email,
      })

      toast.success(
        `Usuário "${deleteTarget.name}" foi excluído definitivamente. 1 vaga foi liberada na equipe!`,
      )
      setDeleteTarget(null)
      await carregarColaboradoresVinculados()
      await onReload()
    } catch (e: any) {
      const msg = e?.message || String(e) || 'Erro desconhecido ao excluir o usuário.'
      toast.error(`Não foi possível excluir o usuário: ${msg}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenCreate = () => {
    if (limiteAtingido) {
      toast.error(
        `Limite rígido de ${LIMITE_MAXIMO_USUARIOS_ATIVOS} usuários ativos atingido. Desative um usuário antes de criar um novo.`,
      )
      return
    }
    setNovoNome('')
    setNovoEmail('')
    setNovaSenha('')
    setNovoColaboradorId('manual')
    setNovosPerfis(['comercial'])

    // Carregar colaboradores que ainda não têm usuário_sistema vinculado
    void pb
      .collection('colaboradores')
      .getFullList({
        filter: "usuario_sistema = '' || usuario_sistema = null",
        fields: 'id,nome_completo,email,cargo',
        sort: 'nome_completo',
      })
      .then((records) => {
        setColaboradoresDisponiveis(
          records.map((r) => ({
            id: r.id,
            nome_completo: r.nome_completo || 'Colaborador',
            email: r.email || '',
            cargo: r.cargo || '',
          })),
        )
      })
      .catch((e) => {
        console.warn('Erro ao listar colaboradores disponíveis:', e)
      })

    setCreateOpen(true)
  }

  const toggleNovoPerfil = (role: Role) => {
    setNovosPerfis((prev) => {
      if (prev.includes(role)) {
        if (prev.length <= 1) {
          toast.error('O usuário deve possuir ao menos um perfil de acesso.')
          return prev
        }
        return prev.filter((r) => r !== role)
      }
      return [...prev, role]
    })
  }

  const toggleEditPerfil = (role: Role) => {
    setEditPerfis((prev) => {
      if (prev.includes(role)) {
        if (prev.length <= 1) {
          toast.error('O usuário deve possuir ao menos um perfil de acesso.')
          return prev
        }
        return prev.filter((r) => r !== role)
      }
      return [...prev, role]
    })
  }

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault()
    if (!novoNome.trim()) {
      toast.error('Informe o nome do novo usuário.')
      return
    }
    if (!novoEmail.trim() || !novoEmail.includes('@')) {
      toast.error('Informe um e-mail válido.')
      return
    }
    if (novaSenha.length < 8) {
      toast.error('A senha inicial deve conter pelo menos 8 caracteres.')
      return
    }
    if (novosPerfis.length === 0) {
      toast.error('Selecione ao menos um perfil de acesso.')
      return
    }

    if (totalAtivos >= LIMITE_MAXIMO_USUARIOS_ATIVOS) {
      toast.error(
        `Limite de ${LIMITE_MAXIMO_USUARIOS_ATIVOS} usuários ativos atingido. Operação bloqueada.`,
      )
      return
    }

    setIsSubmittingCreate(true)
    try {
      const emailLimpo = novoEmail.trim().toLowerCase()
      const primaryRole = novosPerfis[0]

      const createdUser = await pb.collection('users').create({
        name: novoNome.trim(),
        email: emailLimpo,
        password: novaSenha,
        passwordConfirm: novaSenha,
        role: primaryRole,
        roles: novosPerfis,
        ativo: true,
        primeiro_acesso: true,
        emailVisibility: false,
      })

      // Se um colaborador foi escolhido, vinculá-lo imediatamente à nova conta
      if (novoColaboradorId && novoColaboradorId !== 'manual') {
        try {
          await pb.collection('colaboradores').update(novoColaboradorId, {
            usuario_sistema: createdUser.id,
          })
        } catch (vincErr) {
          console.warn('Erro ao vincular colaborador ao novo usuário:', vincErr)
          toast.warning('Usuário criado, mas houve aviso ao vincular colaborador.')
        }
      }

      toast.success(`Usuário "${novoNome.trim()}" criado com sucesso!`)
      setCreateOpen(false)
      await carregarColaboradoresVinculados()
      await onReload()
    } catch (err: any) {
      let msg = 'Não foi possível criar o usuário.'
      const dataErrors = err?.data?.data || {}
      if (dataErrors.email) {
        msg = 'O e-mail informado já está em uso por outro usuário.'
      } else if (dataErrors.password) {
        msg = `Erro na senha: ${dataErrors.password.message || 'Mínimo de 8 caracteres.'}`
      } else if (err?.data?.message) {
        msg = err.data.message
      } else if (err?.message) {
        msg = err.message
      }
      toast.error(`Erro ao criar usuário: ${msg}`)
    } finally {
      setIsSubmittingCreate(false)
    }
  }

  const handleOpenEdit = (target: UserRecord) => {
    setEditTarget(target)
    setEditNome(target.name || '')
    const roles = getUserRoles(target)
    setEditPerfis(roles.length > 0 ? roles : ['comercial'])
    setEditAtivo(target.ativo !== false)
    setEditNovaSenha('')
  }

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editTarget) return

    if (editPerfis.length === 0) {
      toast.error('O usuário deve possuir ao menos um perfil de acesso.')
      return
    }

    // Se estiver reativando e já tiver 10 ativos
    if (editTarget.ativo === false && editAtivo && totalAtivos >= LIMITE_MAXIMO_USUARIOS_ATIVOS) {
      toast.error(
        `Não é possível reativar: o limite de ${LIMITE_MAXIMO_USUARIOS_ATIVOS} usuários ativos está atingido.`,
      )
      return
    }

    setIsSubmittingEdit(true)
    try {
      const payload: Record<string, any> = {
        name: editNome.trim() || editTarget.name,
        role: editPerfis[0],
        roles: editPerfis,
        ativo: editAtivo,
      }

      if (editNovaSenha.trim()) {
        if (editNovaSenha.trim().length < 8) {
          toast.error('A nova senha deve ter ao menos 8 caracteres.')
          setIsSubmittingEdit(false)
          return
        }
        payload.password = editNovaSenha.trim()
        payload.passwordConfirm = editNovaSenha.trim()
      }

      await updateOne('users', editTarget.id, payload)
      toast.success(`Usuário "${editTarget.name}" atualizado com sucesso!`)
      setEditTarget(null)
      await onReload()
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Falha ao atualizar usuário.'
      toast.error(`Erro: ${msg}`)
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  const handleToggleAtivoRapido = async (target: UserRecord) => {
    if (rawUser?.id === target.id) {
      toast.error('Você não pode desativar seu próprio usuário.')
      return
    }

    const novoEstado = target.ativo === false ? true : false

    if (novoEstado && totalAtivos >= LIMITE_MAXIMO_USUARIOS_ATIVOS) {
      toast.error(
        `Limite de ${LIMITE_MAXIMO_USUARIOS_ATIVOS} usuários ativos atingido. Desative outro usuário antes de reativar este.`,
      )
      return
    }

    try {
      await updateOne('users', target.id, { ativo: novoEstado })
      toast.success(
        novoEstado
          ? `Usuário "${target.name}" reativado.`
          : `Usuário "${target.name}" desativado com sucesso (histórico preservado).`,
      )
      await onReload()
    } catch {
      toast.error('Não foi possível alterar o status do usuário.')
    }
  }

  return (
    <div className="crm-card overflow-hidden">
      {/* Cabeçalho da Gestão de Usuários */}
      <div className="border-b p-5 bg-gradient-to-r from-white via-orange-50/20 to-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-900">Gestão de Usuários e Acessos</h2>
              {/* Badge de Contagem e Limite Rígido de 10 Ativos */}
              <div
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  limiteAtingido
                    ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
                    : totalAtivos >= 8
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
                title="Limite estipulado para a equipe da AEROCAD"
              >
                <Users className="h-3 w-3" />
                <span>
                  {totalAtivos} de {LIMITE_MAXIMO_USUARIOS_ATIVOS} usuários ativos
                </span>
                {limiteAtingido && (
                  <span className="ml-1 text-[10px] font-black uppercase text-rose-700">
                    (Limite atingido)
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-neutral-600 mt-0.5">
              Administre as contas com diferentes perfis (admin, comercial, técnico, financeiro,
              terceiro). Desative sem excluir para preservar o histórico de auditoria e lançamentos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSimulating && (
              <Button
                variant="outline"
                size="sm"
                onClick={stopSimulation}
                className="border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs"
              >
                <XCircle className="mr-1.5 h-4 w-4 text-amber-600" />
                Encerrar simulação de {roleLabels[simulatedRole!]}
              </Button>
            )}

            {isRealAdmin && (
              <Button
                size="sm"
                onClick={handleOpenCreate}
                disabled={limiteAtingido}
                className={`h-9 text-xs font-bold gap-1.5 shadow-2xs ${
                  limiteAtingido
                    ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed hover:bg-neutral-300'
                    : 'bg-[#FF6A13] hover:bg-[#E85B06] text-white'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                Novo Usuário
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Usuários */}
      <div className="divide-y divide-neutral-100">
        {users.map((item) => {
          const isSelf = rawUser?.id === item.id
          const isAtivo = item.ativo !== false

          return (
            <div
              key={item.id}
              className={`flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center transition-colors ${
                !isAtivo ? 'bg-neutral-50/70 opacity-75' : 'hover:bg-[#FFFDFB]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 border border-neutral-200">
                  <AvatarFallback
                    className={
                      isAtivo
                        ? 'bg-[#FFF0E5] text-[#D65100] font-bold text-xs'
                        : 'bg-neutral-200 text-neutral-500 font-bold text-xs'
                    }
                  >
                    {initials(item.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className={`font-semibold text-sm truncate ${isAtivo ? 'text-neutral-900' : 'text-neutral-500 line-through'}`}
                    >
                      {item.name}
                    </p>
                    {isSelf && (
                      <CrmBadge tone="orange" className="text-[10px] py-0 px-1.5">
                        Você
                      </CrmBadge>
                    )}
                    {isAtivo ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.2 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.2 text-[10px] font-bold text-neutral-600 border border-neutral-300">
                        <UserX className="h-2.5 w-2.5" />
                        Inativo
                      </span>
                    )}
                    {colaboradoresPorUsuario[item.id] && (
                      <span
                        className="inline-flex items-center gap-1 rounded-md bg-[#FFF0E6] px-2 py-0.5 text-[10px] font-semibold text-[#D65100] border border-[#FF6A13]/30"
                        title={`Colaborador vinculado da equipe: ${colaboradoresPorUsuario[item.id].nome_completo}${colaboradoresPorUsuario[item.id].cargo ? ` (${colaboradoresPorUsuario[item.id].cargo})` : ''}`}
                      >
                        <UserCheck2 className="h-3 w-3 text-[#FF6A13]" />
                        <span>Equipe: {colaboradoresPorUsuario[item.id].nome_completo}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 truncate">{item.email}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {/* Perfis Exibidos (Múltiplos Badges) */}
                <div className="flex flex-wrap items-center gap-1.5 max-w-xs justify-end">
                  {getUserRoles(item).map((r) => (
                    <span
                      key={r}
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                        r === 'admin'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                          : r === 'financeiro'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : r === 'comercial'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : r === 'tecnico'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-neutral-100 text-neutral-700 border-neutral-200'
                      }`}
                    >
                      {roleLabels[r] || r}
                    </span>
                  ))}
                  {getUserRoles(item).length === 0 && (
                    <span className="text-xs font-semibold px-2 py-1 rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200">
                      {roleLabels[item.role] || item.role}
                    </span>
                  )}
                </div>

                {isSelf ? (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 rounded-md border border-[#E0E0E0] bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600 cursor-not-allowed">
                          <UserCheck className="h-3.5 w-3.5 text-[#FF6A13]" />
                          <Info className="h-3 w-3 text-zinc-400" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="font-medium text-xs">
                          Para navegar como outro perfil, use a simulação ao lado.
                        </p>
                      </TooltipContent>
                    </Tooltip>

                    {isRealAdmin && (
                      <Select
                        value={isSimulating ? (simulatedRole ?? 'admin') : 'admin'}
                        onValueChange={(val) => {
                          if (val === 'admin') {
                            stopSimulation()
                            toast.info(
                              'Simulação encerrada. Você voltou à visualização de Administrador.',
                            )
                          } else {
                            startSimulation(val as Role)
                            toast.success(`Visualizando como ${roleLabels[val as Role]}.`)
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 w-44 border-[#FF6A13]/40 bg-[#FFF9F5] text-xs font-semibold text-[#D65100]">
                          <div className="flex items-center gap-1.5 truncate">
                            <Eye className="h-3.5 w-3.5 shrink-0 text-[#FF6A13]" />
                            <span className="truncate">
                              {isSimulating
                                ? `Simulando: ${roleLabels[simulatedRole!]}`
                                : 'Simular perfil...'}
                            </span>
                          </div>
                        </SelectTrigger>
                        <SelectContent align="end">
                          <SelectItem value="admin">Administrador (Real)</SelectItem>
                          <SelectItem value="comercial">Comercial (funil, propostas)</SelectItem>
                          <SelectItem value="tecnico">Técnico (projetos, processos)</SelectItem>
                          <SelectItem value="financeiro">Financeiro (contas, extratos)</SelectItem>
                          <SelectItem value="terceiro">Prestador Terceiro (OS)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </>
                ) : (
                  isRealAdmin && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(item)}
                        className="h-8 px-2.5 text-xs text-neutral-700 hover:text-[#D65100] hover:border-[#FF6A13] gap-1"
                        title="Editar perfil, status ou redefinir senha"
                      >
                        <Pencil className="h-3.5 w-3.5 text-[#FF6A13]" />
                        <span>Editar</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleAtivoRapido(item)}
                        className={`h-8 px-2 text-xs font-semibold ${
                          isAtivo
                            ? 'text-neutral-500 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                        title={
                          isAtivo ? 'Desativar usuário (preserva histórico)' : 'Reativar usuário'
                        }
                      >
                        {isAtivo ? (
                          <>
                            <UserX className="h-3.5 w-3.5 mr-1" />
                            <span>Desativar</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5 mr-1" />
                            <span>Reativar</span>
                          </>
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDelete(item)}
                        className="h-8 px-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        title="Excluir usuário permanentemente"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        <span>Excluir</span>
                      </Button>
                    </div>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal: Criar Novo Usuário (Limite 10) */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF0E6] text-[#FF6A13]">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-neutral-900">
                  Criar Novo Usuário
                </DialogTitle>
                <DialogDescription className="text-xs text-neutral-500">
                  Preencha as credenciais de acesso para operação no desktop ou mobile.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-3.5 py-1">
            {/* Seletor de Colaborador da Equipe Técnica */}
            <div className="space-y-1.5 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
              <Label className="text-xs font-semibold text-neutral-800 flex items-center justify-between">
                <span>Vincular Colaborador da Equipe (Opcional)</span>
                {novoColaboradorId !== 'manual' && (
                  <span className="text-[10px] text-emerald-700 font-bold">
                    Colaborador selecionado
                  </span>
                )}
              </Label>
              <Select
                value={novoColaboradorId}
                onValueChange={(val) => {
                  setNovoColaboradorId(val)
                  if (val === 'manual') return
                  const colab = colaboradoresDisponiveis.find((c) => c.id === val)
                  if (colab) {
                    if (colab.nome_completo) setNovoNome(colab.nome_completo)
                    if (colab.email) setNovoEmail(colab.email)
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Preenchimento manual (ou selecione da lista)" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="manual">-- Preenchimento manual livre --</SelectItem>
                  {colaboradoresDisponiveis.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_completo} {c.cargo ? `(${c.cargo})` : ''}{' '}
                      {c.email ? `— ${c.email}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-neutral-500">
                Selecione para preencher nome e e-mail automaticamente e vincular o colaborador à
                nova conta.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome completo</Label>
              <Input
                required
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Lucas Mendes"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">E-mail corporativo</Label>
              <Input
                required
                type="email"
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                placeholder="usuario@aerocad.com.br"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Perfis de Acesso (selecione uma ou mais atribuições)
              </Label>
              <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/50 p-2.5">
                {perfisDisponiveis.map((p) => {
                  const checked = novosPerfis.includes(p.role)
                  return (
                    <label
                      key={p.role}
                      className="flex items-start gap-2.5 cursor-pointer hover:bg-white/80 p-1.5 rounded transition-colors"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleNovoPerfil(p.role)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 text-xs">
                        <span className="font-semibold text-neutral-900">{p.label}</span>
                        <p className="text-[11px] text-neutral-500">{p.desc}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
              <p className="text-[10px] text-neutral-400">
                O operador terá acesso unificado a todas as áreas dos perfis marcados.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Senha inicial (mínimo 8 caracteres)</Label>
              <Input
                required
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                className="h-9 text-xs"
              />
            </div>

            <div className="rounded-lg bg-orange-50 border border-orange-200/60 p-2.5 text-[11px] text-neutral-600 flex items-start gap-2">
              <Shield className="h-3.5 w-3.5 text-[#FF6A13] shrink-0 mt-0.5" />
              <span>
                Este novo usuário contará no total de ativos ({totalAtivos + 1} de{' '}
                {LIMITE_MAXIMO_USUARIOS_ATIVOS}). O e-mail será ativado para login imediato.
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
                disabled={isSubmittingCreate}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingCreate || limiteAtingido}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold"
              >
                {isSubmittingCreate ? 'Criando...' : 'Criar usuário'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Usuário / Redefinir Senha */}
      <Dialog open={Boolean(editTarget)} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF0E6] text-[#FF6A13]">
                <Pencil className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-neutral-900">
                  Editar Usuário
                </DialogTitle>
                <DialogDescription className="text-xs text-neutral-500">
                  {editTarget?.email}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome</Label>
              <Input
                required
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Perfis de Acesso (selecione uma ou mais atribuições)
              </Label>
              <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/50 p-2.5">
                {perfisDisponiveis.map((p) => {
                  const checked = editPerfis.includes(p.role)
                  return (
                    <label
                      key={p.role}
                      className="flex items-start gap-2.5 cursor-pointer hover:bg-white/80 p-1.5 rounded transition-colors"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleEditPerfil(p.role)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 text-xs">
                        <span className="font-semibold text-neutral-900">{p.label}</span>
                        <p className="text-[11px] text-neutral-500">{p.desc}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Status da Conta</Label>
              <Select
                value={editAtivo ? 'ativo' : 'inativo'}
                onValueChange={(val) => setEditAtivo(val === 'ativo')}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo (Pode fazer login)</SelectItem>
                  <SelectItem value="inativo">Inativo (Acesso bloqueado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 border-t pt-3">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-neutral-800">
                <Lock className="h-3 w-3 text-neutral-500" />
                Redefinir Senha (opcional)
              </Label>
              <Input
                type="password"
                value={editNovaSenha}
                onChange={(e) => setEditNovaSenha(e.target.value)}
                placeholder="Deixe em branco para não alterar"
                className="h-9 text-xs"
              />
              <p className="text-[10px] text-neutral-400">
                Se preenchido, define nova senha imediatamente para o operador.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditTarget(null)}
                disabled={isSubmittingEdit}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingEdit}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold"
              >
                {isSubmittingEdit ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Exclusão Permanente de Usuário */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && !isDeleting && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-neutral-900">
                  Excluir Usuário Definitivamente
                </DialogTitle>
                <DialogDescription className="text-xs text-neutral-500">
                  Esta ação é irreversível e remove permanentemente a conta de acesso ao CRM.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {carregandoImpacto ? (
            <div className="py-8 text-center space-y-2">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-[#FF6A13] border-r-transparent align-[-0.125em]" />
              <p className="text-xs text-neutral-500">
                Analisando vínculos, registros e integridade de auditoria...
              </p>
            </div>
          ) : impactoExclusao ? (
            <div className="space-y-4 py-2 text-xs">
              {/* Alerta de bloqueio caso seja usuário logado ou último admin */}
              {impactoExclusao.isUsuarioLogado ? (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    Exclusão não permitida
                  </p>
                  <p>Você não pode excluir a sua própria conta atualmente logada.</p>
                </div>
              ) : impactoExclusao.isUltimoAdmin ? (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    Último administrador do sistema
                  </p>
                  <p>
                    Este é o único usuário com perfil de Administrador no CRM. Promova outro usuário
                    a administrador antes de poder excluir esta conta.
                  </p>
                </div>
              ) : (
                <>
                  {/* Dados do usuário a excluir */}
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    <div className="font-bold text-neutral-900 text-sm">
                      {impactoExclusao.usuario.name}
                    </div>
                    <div className="text-neutral-500">{impactoExclusao.usuario.email}</div>
                  </div>

                  {/* Informações sobre o que acontece com os registros */}
                  <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3">
                    <h4 className="font-bold text-neutral-800 text-xs">
                      O que acontece com os registros vinculados:
                    </h4>
                    <ul className="space-y-1.5 text-neutral-600 list-disc pl-4 text-[11px]">
                      <li>
                        <strong>Histórico preservado:</strong> Contas a pagar, contas a receber,
                        ordens de serviço, mensagens e relatórios de auditoria criados por este
                        usuário permanecem intactos no CRM para fins fiscais e contábeis.
                      </li>
                      {impactoExclusao.colaboradorVinculado ? (
                        <li className="text-amber-700">
                          <strong>Colaborador da equipe:</strong> O colaborador{' '}
                          <span className="font-bold">
                            {impactoExclusao.colaboradorVinculado.nome_completo}
                          </span>{' '}
                          será desvinculado desta conta de login (o cadastro do colaborador em
                          Pessoal não será apagado).
                        </li>
                      ) : (
                        <li>Nenhum colaborador da equipe está vinculado a esta conta.</li>
                      )}
                      <li>
                        <strong>Liberação de vaga:</strong> A exclusão libera 1 vaga no limite
                        máximo de {LIMITE_MAXIMO_USUARIOS_ATIVOS} usuários ativos da AEROCAD.
                      </li>
                      <li>
                        <strong>Auditoria:</strong> Um registro permanente da exclusão é gravado na
                        trilha administrativa do sistema com data, hora e operador responsável.
                      </li>
                    </ul>
                  </div>

                  {/* Dica sobre desativar vs excluir */}
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-800 flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Se deseja apenas bloquear o acesso mantendo a conta no cadastro, use a opção{' '}
                      <strong>Desativar</strong> em vez de excluir.
                    </span>
                  </div>

                  {/* Campo de confirmação por texto */}
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-semibold text-neutral-800">
                      Para confirmar, digite{' '}
                      <span className="font-mono font-bold text-rose-600">EXCLUIR</span> abaixo:
                    </Label>
                    <Input
                      value={confirmacaoDigitada}
                      onChange={(e) => setConfirmacaoDigitada(e.target.value)}
                      placeholder="EXCLUIR"
                      className="h-9 text-xs uppercase"
                    />
                  </div>
                </>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                >
                  Cancelar
                </Button>
                {!impactoExclusao.isUsuarioLogado && !impactoExclusao.isUltimoAdmin && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting || confirmacaoDigitada.trim().toUpperCase() !== 'EXCLUIR'}
                    className="font-bold"
                  >
                    {isDeleting ? 'Excluindo...' : 'Excluir definitivamente'}
                  </Button>
                )}
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
