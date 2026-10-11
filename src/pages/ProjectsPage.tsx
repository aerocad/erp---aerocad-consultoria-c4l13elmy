import { useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, CalendarDays, Edit3, MoreVertical, Plus, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States'
import { SectionHeader } from '@/components/common/SectionHeader'
import { EditarNomeProjetoModal } from '@/components/projetos/EditarNomeProjetoModal'
import { ProjetoDialog } from '@/components/forms/ProjetoDialog'
import { Button } from '@/components/ui/button'
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
  const [financialFilter, setFinancialFilter] = useState('todos')
  const [editingProject, setEditingProject] = useState<ProjetoRecord | null>(null)
  const [sortOrder, setSortOrder] = useState<
    'recentes' | 'cronologica' | 'numero_desc' | 'numero_asc'
  >(() => {
    const saved = localStorage.getItem('crm_projetos_ordem')
    if (
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

  const handleSortChange = (val: 'recentes' | 'cronologica' | 'numero_desc' | 'numero_asc') => {
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
      const matchTrail = trail === 'todos' || item.trilha === trail
      const matchStatus = status === 'todos' || item.status === status
      const resumo = resumosFinanceiros.get(item.id)
      const matchFinancial =
        financialFilter === 'todos' || resumo?.statusFinanceiro === financialFilter
      const matchQuery =
        !query ||
        `${item.numero} ${item.nome} ${item.expand?.cliente?.razao_social}`
          .toLowerCase()
          .includes(query.toLowerCase())

      return matchTrail && matchStatus && matchFinancial && matchQuery
    })

    return filtered.sort((a, b) => {
      const orderA = parseProjectOrder(a)
      const orderB = parseProjectOrder(b)

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
  }, [projects.data, query, trail, status, financialFilter, sortOrder, resumosFinanceiros])
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
      <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-white p-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-[#9A9A9A]" />
          <Input
            className="pl-9"
            placeholder="Buscar número, nome ou cliente"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={trail} onValueChange={setTrail}>
          <SelectTrigger className="md:w-44">
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
          <SelectTrigger className="md:w-44">
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
            handleSortChange(val as 'recentes' | 'cronologica' | 'numero_desc' | 'numero_asc')
          }
        >
          <SelectTrigger className="md:w-56">
            <div className="flex items-center gap-1.5 truncate text-left">
              <ArrowUpDown className="h-3.5 w-3.5 text-[#9A9A9A] shrink-0" />
              <SelectValue placeholder="Ordenação" />
            </div>
          </SelectTrigger>
          <SelectContent align="end">
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

            return (
              <div
                key={item.id}
                onClick={() => navigate(`/projetos/${item.id}`)}
                className="crm-card p-5 text-left cursor-pointer transition-shadow hover:shadow-md flex flex-col justify-between relative group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="mono-value text-base font-black text-[#D65100]">
                      {item.numero}
                    </span>
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
                      {canEditName && (
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
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingProject(item)
                              }}
                              className="text-xs flex items-center gap-2 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-[#FF6A13]" />
                              Editar nome do projeto
                            </DropdownMenuItem>
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
    </div>
  )
}
