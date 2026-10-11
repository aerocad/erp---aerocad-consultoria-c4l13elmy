import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  CalendarDays,
  CheckSquare,
  Edit3,
  MoreVertical,
  Plus,
  Search,
  Square,
  X,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States'
import { SectionHeader } from '@/components/common/SectionHeader'
import { ArquivarLoteProjetosModal } from '@/components/projetos/ArquivarLoteProjetosModal'
import { ArquivarProjetoModal } from '@/components/projetos/ArquivarProjetoModal'
import { EditarNomeProjetoModal } from '@/components/projetos/EditarNomeProjetoModal'
import { EditarProjetoModal } from '@/components/projetos/EditarProjetoModal'
import { ProjetoDialog } from '@/components/forms/ProjetoDialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useCrmData } from '@/hooks/use-crm-data'
import { formatCurrency, formatDate } from '@/lib/format'
import { updateOne } from '@/services/api'
import {
  calcularResumoFinanceiroTodosProjetos,
  getStatusFinanceiroBadgeConfig,
} from '@/services/projetoFinanceiroInferidor'
import type { ParcelaRecord, ProjetoRecord } from '@/types/crm'

export default function ProjectsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const projects = useCrmData<ProjetoRecord>('projetos', {
    expand: 'cliente,responsavel_tecnico',
    sort: '-numero',
    realtime: true,
  })
  const installments = useCrmData<ParcelaRecord>('parcelas', {
    realtime: true,
  })
  const [query, setQuery] = useState('')
  const [trail, setTrail] = useState('todos')
  const [status, setStatus] = useState('todos')
  const [priorityFilter, setPriorityFilter] = useState('todos')
  const [financialFilter, setFinancialFilter] = useState('todos')
  const [archiveFilter, setArchiveFilter] = useState<'ativos' | 'arquivados' | 'todos'>('ativos')
  const [editingProject, setEditingProject] = useState<ProjetoRecord | null>(null)
  const [editingFullProject, setEditingFullProject] = useState<ProjetoRecord | null>(null)
  const [archivingProject, setArchivingProject] = useState<ProjetoRecord | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchAction, setBatchAction] = useState<'arquivar' | 'desarquivar' | null>(null)

  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const [sortOrder, setSortOrder] = useState<
    'manual' | 'prioridade' | 'recentes' | 'cronologica' | 'numero_desc' | 'numero_asc'
  >(() => {
    const saved = localStorage.getItem('crm_projetos_ordem')
    if (
      saved === 'manual' ||
      saved === 'prioridade' ||
      saved === 'recentes' ||
      saved === 'cronologica' ||
      saved === 'numero_desc' ||
      saved === 'numero_asc'
    ) {
      return saved
    }
    return 'recentes'
  })
  const [dialog, setDialog] = useState(params.get('novo') === '1')

  const handleSortChange = (
    val: 'manual' | 'prioridade' | 'recentes' | 'cronologica' | 'numero_desc' | 'numero_asc',
  ) => {
    setSortOrder(val)
    try {
      localStorage.setItem('crm_projetos_ordem', val)
    } catch {
      // Ignora erro de storage se indisponível
    }
  }
  useEffect(() => {
    if (params.get('novo') === '1') setDialog(true)
  }, [params])
  const canWrite = ['admin', 'comercial', 'tecnico', 'financeiro'].includes(user?.role || '')
  const canEditName = ['admin', 'tecnico'].includes(user?.role || '')
  const canEditFull = ['admin', 'tecnico', 'financeiro'].includes(user?.role || '')
  const canArchive = ['admin', 'tecnico'].includes(user?.role || '')

  // Alterna seleção individual de projeto de forma confiável
  const handleToggleSelect = (id: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
  }

  const resumosFinanceiros = useMemo(() => {
    return calcularResumoFinanceiroTodosProjetos(projects.data, installments.data)
  }, [projects.data, installments.data])

  // Decomposição segura da numeração AAAA-NNN para ordenação cronológica precisa
  const parseProjectOrder = (proj: ProjetoRecord) => {
    const match = (proj.numero || '').match(/^(\d{4})-(\d+)$/)
    if (match) {
      return {
        ano: parseInt(match[1], 10),
        seq: parseInt(match[2], 10),
        hasNumber: true,
      }
    }
    const anoMatch = (proj.numero || '').match(/\b(20\d{2})\b/)
    const ano = anoMatch ? parseInt(anoMatch[1], 10) : 0
    return {
      ano,
      seq: 0,
      hasNumber: false,
    }
  }

  const rows = useMemo(() => {
    const filtered = projects.data.filter((item) => {
      // Filtro de arquivamento: padrão "ativos" (não arquivados)
      const isArquivado = Boolean(item.arquivado)
      if (archiveFilter === 'ativos' && isArquivado) return false
      if (archiveFilter === 'arquivados' && !isArquivado) return false

      const matchTrail = trail === 'todos' || item.trilha === trail
      const matchStatus = status === 'todos' || item.status === status
      const matchPriority =
        priorityFilter === 'todos' || (item.prioridade || 'normal') === priorityFilter
      const resumo = resumosFinanceiros.get(item.id)
      const matchFinancial =
        financialFilter === 'todos' || resumo?.statusFinanceiro === financialFilter
      const matchQuery =
        !query ||
        `${item.numero} ${item.nome} ${item.expand?.cliente?.razao_social} ${item.prioridade || ''}`
          .toLowerCase()
          .includes(query.toLowerCase())

      return matchTrail && matchStatus && matchPriority && matchFinancial && matchQuery
    })

    return [...filtered].sort((a, b) => {
      const orderA = parseProjectOrder(a)
      const orderB = parseProjectOrder(b)

      // 1. Ordem manual (persistida em sort_order)
      if (sortOrder === 'manual') {
        const sA = a.sort_order ?? 999999
        const sB = b.sort_order ?? 999999
        if (sA !== sB) return sA - sB
        // desempate por numero desc
        if (orderA.ano !== orderB.ano) return orderB.ano - orderA.ano
        if (orderA.seq !== orderB.seq) return orderB.seq - orderA.seq
        return (b.numero || '').localeCompare(a.numero || '', undefined, { numeric: true })
      }

      // 2. Por prioridade (Alta -> Normal -> Baixa), depois mais recentes
      if (sortOrder === 'prioridade') {
        const pesoPrioridade = (p?: string) => {
          if (p === 'alta') return 1
          if (p === 'normal' || !p) return 2
          if (p === 'baixa') return 3
          return 2
        }
        const pesoA = pesoPrioridade(a.prioridade)
        const pesoB = pesoPrioridade(b.prioridade)
        if (pesoA !== pesoB) return pesoA - pesoB
        // desempate por numero desc
        if (orderA.ano !== orderB.ano) return orderB.ano - orderA.ano
        if (orderA.seq !== orderB.seq) return orderB.seq - orderA.seq
        return (b.numero || '').localeCompare(a.numero || '', undefined, { numeric: true })
      }

      if (sortOrder === 'cronologica' || sortOrder === 'numero_asc') {
        // Mais antigos primeiro (Ordem cronológica crescente: ex.: 2024-06 -> 2026-01 -> 2026-286)
        if (orderA.ano !== orderB.ano) {
          return orderA.ano - orderB.ano
        }
        if (orderA.seq !== orderB.seq) {
          return orderA.seq - orderB.seq
        }
        // Fallback para data de criação ou número textual
        const dateA = a.created ? new Date(a.created).getTime() : 0
        const dateB = b.created ? new Date(b.created).getTime() : 0
        if (dateA !== dateB) return dateA - dateB
        return (a.numero || '').localeCompare(b.numero || '', undefined, { numeric: true })
      }

      // 'recentes' ou 'numero_desc': Mais recentes primeiro (Ordem decrescente: 2026-286 -> 2024-06)
      if (orderA.ano !== orderB.ano) {
        return orderB.ano - orderA.ano
      }
      if (orderA.seq !== orderB.seq) {
        return orderB.seq - orderA.seq
      }
      const dateA = a.created ? new Date(a.created).getTime() : 0
      const dateB = b.created ? new Date(b.created).getTime() : 0
      if (dateA !== dateB) return dateB - dateA
      return (b.numero || '').localeCompare(a.numero || '', undefined, { numeric: true })
    })
  }, [
    projects.data,
    query,
    trail,
    status,
    priorityFilter,
    financialFilter,
    archiveFilter,
    sortOrder,
    resumosFinanceiros,
  ])

  // Lógica de Drag-and-Drop para ordenação manual
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverId !== targetId) {
      setDragOverId(targetId)
    }
  }

  const handleDragLeave = () => {
    // mantem feedback visual suave
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault()
    const sourceId = draggedId || e.dataTransfer.getData('text/plain')
    setDraggedId(null)
    setDragOverId(null)

    if (!sourceId || sourceId === targetId) return

    // Se o usuário ainda não estiver no modo de ordenação manual, alternar automaticamente
    if (sortOrder !== 'manual') {
      handleSortChange('manual')
    }

    const currentRows = [...rows]
    const sourceIndex = currentRows.findIndex((r) => r.id === sourceId)
    const targetIndex = currentRows.findIndex((r) => r.id === targetId)

    if (sourceIndex === -1 || targetIndex === -1) return

    // Reordenar a lista localmente
    const reordered = [...currentRows]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    setSavingOrder(true)
    try {
      // Atualizar sort_order no banco para os itens afetados (atribuindo 1, 2, 3...)
      const updates = reordered
        .map((item, index) => {
          const newOrder = index + 1
          if (item.sort_order === newOrder) return null
          return updateOne<ProjetoRecord>('projetos', item.id, { sort_order: newOrder })
        })
        .filter(Boolean)

      if (updates.length > 0) {
        await Promise.all(updates)
        toast.success('Ordem manual atualizada com sucesso!')
      }
      void projects.reload()
    } catch (err) {
      console.error('Erro ao salvar nova ordem manual:', err)
      toast.error('Não foi possível salvar a nova ordem dos projetos.')
    } finally {
      setSavingOrder(false)
    }
  }

  // Projetos selecionados a partir do conjunto de IDs
  const selectedProjects = useMemo(() => {
    return projects.data.filter((p) => selectedIds.has(p.id))
  }, [projects.data, selectedIds])

  // Contadores de ativos e arquivados entre os selecionados
  const countSelectedAtivos = useMemo(() => {
    return selectedProjects.filter((p) => !p.arquivado).length
  }, [selectedProjects])

  const countSelectedArquivados = useMemo(() => {
    return selectedProjects.filter((p) => Boolean(p.arquivado)).length
  }, [selectedProjects])

  // Lógica de "Selecionar todos" da visão filtrada atual
  const allFilteredSelected = useMemo(() => {
    if (rows.length === 0) return false
    return rows.every((r) => selectedIds.has(r.id))
  }, [rows, selectedIds])

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      // Remove da seleção os projetos visíveis atualmente
      setSelectedIds((prev) => {
        const next = new Set(prev)
        rows.forEach((r) => next.delete(r.id))
        return next
      })
    } else {
      // Adiciona todos os visíveis
      setSelectedIds((prev) => {
        const next = new Set(prev)
        rows.forEach((r) => next.add(r.id))
        return next
      })
    }
  }
  if (projects.loading) return <PageLoading />
  if (projects.error) return <ErrorState onRetry={() => void projects.reload()} />
  return (
    <div>
      <SectionHeader
        eyebrow="ENTREGA TÉCNICA"
        title="Projetos"
        description="Trilhas, fases e prazos sob controle AEROCAD."
        actions={
          <Button
            disabled={!canWrite}
            onClick={() => setDialog(true)}
            className="bg-[#FF6A13] hover:bg-[#E85B06]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo projeto
          </Button>
        }
      />
      {/* Barra de Ações em Massa (quando há seleção de projetos) */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#FF6A13]/40 bg-gradient-to-r from-orange-50/90 to-amber-50/90 p-3 sm:p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FF6A13] text-white font-bold text-sm shadow-xs">
              {selectedIds.size}
            </div>
            <div>
              <p className="text-sm font-bold text-[#4B4B4B]">
                {selectedIds.size}{' '}
                {selectedIds.size === 1 ? 'projeto selecionado' : 'projetos selecionados'}
              </p>
              <p className="text-xs text-neutral-600">
                {countSelectedAtivos > 0 && `${countSelectedAtivos} ativo(s)`}
                {countSelectedAtivos > 0 && countSelectedArquivados > 0 && ' · '}
                {countSelectedArquivados > 0 && `${countSelectedArquivados} arquivado(s)`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canArchive && countSelectedAtivos > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setBatchAction('arquivar')}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white shadow-xs font-semibold gap-1.5"
              >
                <Archive className="h-4 w-4" />
                Arquivar selecionados ({countSelectedAtivos})
              </Button>
            )}

            {canArchive && countSelectedArquivados > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setBatchAction('desarquivar')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold gap-1.5"
              >
                <ArchiveRestore className="h-4 w-4" />
                Desarquivar selecionados ({countSelectedArquivados})
              </Button>
            )}

            {!canArchive && (
              <span className="text-xs text-amber-800 bg-amber-100/70 border border-amber-200 rounded-md px-2.5 py-1">
                Arquivamento restrito a Admin/Técnico
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearSelection}
              className="border-neutral-300 text-neutral-700 hover:bg-neutral-100 gap-1.5"
            >
              <X className="h-3.5 w-3.5 text-neutral-500" />
              Limpar seleção
            </Button>
          </div>
        </div>
      )}

      {/* Barra de Filtros, Ordenação e Ação "Selecionar Todos" */}
      <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-white p-3 md:flex-row md:items-center">
        {/* Botão de Selecionar Todos / Limpar da visão atual */}
        {rows.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleSelectAll}
            className={`h-10 px-3 text-xs font-semibold gap-1.5 shrink-0 border-neutral-300 ${
              allFilteredSelected
                ? 'bg-orange-50 text-[#FF6A13] border-[#FF6A13]'
                : selectedIds.size > 0
                  ? 'bg-neutral-50 text-neutral-800'
                  : 'text-neutral-600 hover:text-neutral-900'
            }`}
            title={
              allFilteredSelected
                ? 'Desmarcar todos os visíveis'
                : 'Marcar todos os projetos visíveis nesta listagem'
            }
          >
            {allFilteredSelected ? (
              <CheckSquare className="h-4 w-4 text-[#FF6A13]" />
            ) : (
              <Square className="h-4 w-4 text-neutral-400" />
            )}
            <span className="hidden sm:inline">
              {allFilteredSelected ? 'Desmarcar visíveis' : 'Selecionar todos'}
            </span>
            <span className="sm:hidden">Todos</span>
            <span className="text-[11px] text-neutral-500">({rows.length})</span>
          </Button>
        )}

        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-[#9A9A9A]" />
          <Input
            className="pl-9"
            placeholder="Buscar número, nome ou cliente"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          value={archiveFilter}
          onValueChange={(val) => setArchiveFilter(val as 'ativos' | 'arquivados' | 'todos')}
        >
          <SelectTrigger className="md:w-40 border-neutral-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Projetos Ativos</SelectItem>
            <SelectItem value="arquivados">Arquivados</SelectItem>
            <SelectItem value="todos">Todos (Ativos + Arq.)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={trail} onValueChange={setTrail}>
          <SelectTrigger className="md:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as trilhas</SelectItem>
            <SelectItem value="opea">OPEA</SelectItem>
            <SelectItem value="registro">Registro</SelectItem>
            <SelectItem value="demais">Demais</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="suspenso">Suspenso</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="md:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Prioridade: Todas</SelectItem>
            <SelectItem value="alta">Prioridade: Alta</SelectItem>
            <SelectItem value="normal">Prioridade: Normal</SelectItem>
            <SelectItem value="baixa">Prioridade: Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={financialFilter} onValueChange={setFinancialFilter}>
          <SelectTrigger className="md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Status financeiro (NFS-e)</SelectItem>
            <SelectItem value="faturamento_integral">Faturado 100%</SelectItem>
            <SelectItem value="pagamento_parcial">Pagamento parcial</SelectItem>
            <SelectItem value="sem_nfse">Sem NFS-e</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortOrder}
          onValueChange={(val) =>
            handleSortChange(
              val as
                | 'manual'
                | 'prioridade'
                | 'recentes'
                | 'cronologica'
                | 'numero_desc'
                | 'numero_asc',
            )
          }
        >
          <SelectTrigger className="md:w-56">
            <div className="flex items-center gap-1.5 truncate text-left">
              <ArrowUpDown className="h-3.5 w-3.5 text-[#FF6A13] shrink-0" />
              <SelectValue placeholder="Ordenação" />
            </div>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="manual">
              <div className="flex flex-col">
                <span className="font-medium text-[#D65100]">★ Ordem manual (Drag-and-Drop)</span>
                <span className="text-[11px] text-[#8A8A8A]">Arraste os cards para ordenar</span>
              </div>
            </SelectItem>
            <SelectItem value="prioridade">
              <div className="flex flex-col">
                <span className="font-medium">Por prioridade</span>
                <span className="text-[11px] text-[#8A8A8A]">Alta → Normal → Baixa</span>
              </div>
            </SelectItem>
            <SelectItem value="recentes">
              <div className="flex flex-col">
                <span className="font-medium">Mais recentes</span>
                <span className="text-[11px] text-[#8A8A8A]">Do mais novo ao mais antigo</span>
              </div>
            </SelectItem>
            <SelectItem value="cronologica">
              <div className="flex flex-col">
                <span className="font-medium">Ordem cronológica</span>
                <span className="text-[11px] text-[#8A8A8A]">
                  Histórico: mais antigos → recentes
                </span>
              </div>
            </SelectItem>
            <SelectItem value="numero_desc">
              <div className="flex flex-col">
                <span className="font-medium">Nº do projeto (maior → menor)</span>
                <span className="text-[11px] text-[#8A8A8A]">Sequencial AAAA-NNN desc</span>
              </div>
            </SelectItem>
            <SelectItem value="numero_asc">
              <div className="flex flex-col">
                <span className="font-medium">Nº do projeto (menor → maior)</span>
                <span className="text-[11px] text-[#8A8A8A]">Sequencial AAAA-NNN asc</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Dica amigável de Drag-and-Drop quando no modo manual */}
      {sortOrder === 'manual' && rows.length > 1 && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-orange-50/70 border border-orange-200/80 px-3.5 py-2 text-xs text-[#B23B00]">
          <span className="flex items-center gap-1.5 font-medium">
            <ArrowUpDown className="h-3.5 w-3.5" />
            Modo de ordenação manual ativo: clique e arraste um card para posicioná-lo na frente de
            outro.
          </span>
          {savingOrder && (
            <span className="font-semibold text-xs animate-pulse">Gravando ordem...</span>
          )}
        </div>
      )}
      {!rows.length ? (
        <EmptyState
          title="Nenhum projeto encontrado"
          description="Crie um projeto ou ajuste os filtros."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => {
            const resumo = resumosFinanceiros.get(item.id)
            const badgeFinanceiro = getStatusFinanceiroBadgeConfig(resumo)
            const isDragging = draggedId === item.id
            const isOver = dragOverId === item.id && draggedId !== item.id
            const prioridade = item.prioridade || 'normal'

            return (
              <div
                key={item.id}
                draggable={canWrite}
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDragLeave={handleDragLeave}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, item.id)}
                onClick={() => navigate(`/projetos/${item.id}`)}
                className={`crm-card p-5 text-left cursor-pointer transition-all hover:shadow-md flex flex-col justify-between relative group select-none ${
                  isDragging
                    ? 'opacity-40 scale-[0.98] ring-2 ring-dashed ring-[#FF6A13]'
                    : isOver
                      ? 'border-2 border-[#FF6A13] bg-orange-50/40 shadow-lg scale-[1.01]'
                      : selectedIds.has(item.id)
                        ? 'ring-2 ring-[#FF6A13] border-[#FF6A13] bg-orange-50/30'
                        : item.arquivado
                          ? 'opacity-70 bg-neutral-50/90 border-dashed border-neutral-300 hover:opacity-100'
                          : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {/* Checkbox para seleção individual do card */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleSelect(item.id, e)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.stopPropagation()
                            e.preventDefault()
                            handleToggleSelect(item.id, e)
                          }
                        }}
                        className="flex items-center justify-center p-1 -ml-1 rounded cursor-pointer hover:bg-neutral-100/90 transition-colors"
                        title={
                          selectedIds.has(item.id) ? 'Desmarcar projeto' : 'Selecionar projeto'
                        }
                      >
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => {
                            handleToggleSelect(item.id)
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                          aria-label={`Selecionar projeto ${item.numero}`}
                          className="data-[state=checked]:bg-[#FF6A13] data-[state=checked]:border-[#FF6A13]"
                        />
                      </div>

                      <span className="mono-value text-base font-black text-[#D65100]">
                        {item.numero}
                      </span>
                      {item.arquivado && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-neutral-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                          <Archive className="h-2.5 w-2.5" />
                          Arquivado
                        </span>
                      )}

                      {/* Badge de Prioridade Colorido no Card */}
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          prioridade === 'alta'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : prioridade === 'baixa'
                              ? 'bg-neutral-100 text-neutral-500 border-neutral-200'
                              : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                        }`}
                        title={`Prioridade ${prioridade}`}
                      >
                        {prioridade}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeFinanceiro.badgeClass}`}
                        title={badgeFinanceiro.descricao}
                      >
                        {badgeFinanceiro.label}
                      </span>
                      <CrmBadge
                        tone={
                          item.trilha === 'registro'
                            ? 'green'
                            : item.trilha === 'opea'
                              ? 'orange'
                              : 'gray'
                        }
                      >
                        {item.trilha.toUpperCase()}
                      </CrmBadge>

                      {/* Menu de ações por linha / card */}
                      {(canEditFull || canEditName || canArchive) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 -mr-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100"
                              aria-label="Opções do projeto"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            {canEditFull && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingFullProject(item)
                                }}
                                className="text-xs flex items-center gap-2 cursor-pointer font-medium"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-[#FF6A13]" />
                                Editar projeto completo
                              </DropdownMenuItem>
                            )}
                            {canEditName && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingProject(item)
                                }}
                                className="text-xs flex items-center gap-2 cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-neutral-500" />
                                Editar apenas nome
                              </DropdownMenuItem>
                            )}

                            {/* Acesso rápido para trocar prioridade diretamente no menu */}
                            {canWrite && (
                              <>
                                <div className="my-1 border-t border-neutral-100" />
                                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                  Definir prioridade
                                </div>
                                <DropdownMenuItem
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    try {
                                      await updateOne('projetos', item.id, { prioridade: 'alta' })
                                      toast.success('Prioridade definida como ALTA')
                                      void projects.reload()
                                    } catch {
                                      toast.error('Erro ao alterar prioridade')
                                    }
                                  }}
                                  className="text-xs flex items-center gap-2 cursor-pointer text-red-700"
                                >
                                  <span className="h-2 w-2 rounded-full bg-red-500" />
                                  Prioridade Alta
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    try {
                                      await updateOne('projetos', item.id, { prioridade: 'normal' })
                                      toast.success('Prioridade definida como NORMAL')
                                      void projects.reload()
                                    } catch {
                                      toast.error('Erro ao alterar prioridade')
                                    }
                                  }}
                                  className="text-xs flex items-center gap-2 cursor-pointer text-neutral-700"
                                >
                                  <span className="h-2 w-2 rounded-full bg-neutral-400" />
                                  Prioridade Normal
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    try {
                                      await updateOne('projetos', item.id, { prioridade: 'baixa' })
                                      toast.success('Prioridade definida como BAIXA')
                                      void projects.reload()
                                    } catch {
                                      toast.error('Erro ao alterar prioridade')
                                    }
                                  }}
                                  className="text-xs flex items-center gap-2 cursor-pointer text-neutral-500"
                                >
                                  <span className="h-2 w-2 rounded-full bg-neutral-300" />
                                  Prioridade Baixa
                                </DropdownMenuItem>
                                <div className="my-1 border-t border-neutral-100" />
                              </>
                            )}

                            {canArchive && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setArchivingProject(item)
                                }}
                                className={`text-xs flex items-center gap-2 cursor-pointer ${
                                  item.arquivado
                                    ? 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50'
                                    : 'text-neutral-700 hover:text-neutral-900'
                                }`}
                              >
                                {item.arquivado ? (
                                  <>
                                    <ArchiveRestore className="h-3.5 w-3.5 text-emerald-600" />
                                    Desarquivar projeto
                                  </>
                                ) : (
                                  <>
                                    <Archive className="h-3.5 w-3.5 text-neutral-500" />
                                    Arquivar projeto
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <h2 className="mt-3 font-bold text-[#4B4B4B] line-clamp-2">{item.nome}</h2>
                  <p className="mt-1 text-sm text-[#737373] truncate">
                    {item.expand?.cliente?.razao_social}
                  </p>
                </div>

                <div className="mt-4">
                  <div className="h-1.5 overflow-hidden rounded bg-[#F2F2F2]">
                    <div
                      className="h-full bg-[#FF6A13]"
                      style={{ width: `${item.percentual_concluido}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-[#8A8A8A]">
                    <span>{item.fase}</span>
                    <span className="mono-value">{item.percentual_concluido}%</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3">
                    <CrmBadge tone={item.status === 'ativo' ? 'green' : 'gray'}>
                      {item.status}
                    </CrmBadge>
                    <div className="flex items-center gap-3">
                      {resumo && resumo.valorGlobalContratado > 0 && (
                        <span
                          className="mono-value text-xs font-semibold text-[#4B4B4B]"
                          title={`Valor contratado: ${formatCurrency(resumo.valorGlobalContratado)} | Faturado: ${formatCurrency(resumo.totalFaturadoNfse)}`}
                        >
                          {formatCurrency(resumo.valorGlobalContratado)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-[#737373]">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(item.prazo)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <ProjetoDialog
        open={dialog}
        onOpenChange={(value) => {
          setDialog(value)
          if (!value && params.has('novo')) {
            params.delete('novo')
            setParams(params, { replace: true })
          }
        }}
        onSaved={(record) => navigate(`/projetos/${record.id}`)}
      />

      {/* Modal de Edição Completa do Projeto (Valores, Dados, Escopo, Prioridade, Auditoria) */}
      <EditarProjetoModal
        open={Boolean(editingFullProject)}
        onOpenChange={(open) => {
          if (!open) setEditingFullProject(null)
        }}
        projeto={editingFullProject}
        onSuccess={() => {
          void projects.reload()
        }}
      />

      {/* Modal para editar nome do projeto diretamente da listagem */}
      <EditarNomeProjetoModal
        open={Boolean(editingProject)}
        onOpenChange={(open) => {
          if (!open) setEditingProject(null)
        }}
        projeto={editingProject}
        onSuccess={() => {
          void projects.reload()
        }}
      />

      {/* Modal para arquivar/desarquivar projeto individual diretamente da listagem */}
      <ArquivarProjetoModal
        open={Boolean(archivingProject)}
        onOpenChange={(open) => {
          if (!open) setArchivingProject(null)
        }}
        projeto={archivingProject}
        onSuccess={() => {
          void projects.reload()
        }}
      />

      {/* Modal para arquivamento / desarquivamento simultâneo em lote */}
      <ArquivarLoteProjetosModal
        open={Boolean(batchAction)}
        onOpenChange={(open) => {
          if (!open) setBatchAction(null)
        }}
        acao={batchAction || 'arquivar'}
        projetos={
          batchAction === 'desarquivar'
            ? selectedProjects.filter((p) => Boolean(p.arquivado))
            : selectedProjects.filter((p) => !p.arquivado)
        }
        onSuccess={() => {
          setSelectedIds(new Set())
          void projects.reload()
        }}
      />
    </div>
  )
}
