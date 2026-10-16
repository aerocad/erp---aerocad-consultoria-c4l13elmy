import { useEffect, useMemo, useState, type DragEvent } from 'react'
import {
  CalendarDays,
  Filter,
  GripVertical,
  MoreVertical,
  Plus,
  Search,
  MessageSquare,
  ExternalLink,
  Trash2,
  Edit2,
} from 'lucide-react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { buildWhatsAppChatUrl } from '@/services/whatsappService'
import { toast } from 'sonner'
import { FolderKanban, ArrowUpRight } from 'lucide-react'
import { ExcluirOportunidadeModal } from '@/components/oportunidades/ExcluirOportunidadeModal'

import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States'
import { SectionHeader } from '@/components/common/SectionHeader'
import { OportunidadeDialog } from '@/components/forms/OportunidadeDialog'
import { AssistenteSecaoDrawer } from '@/components/chat/AssistenteSecaoDrawer'
import { ProjetoDialog } from '@/components/forms/ProjetoDialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { useCrmData } from '@/hooks/use-crm-data'
import { stageColors, stageLabels, trailLabels } from '@/lib/crm'
import { formatCurrency, formatDate, initials } from '@/lib/format'
import { createOne, updateOne } from '@/services/api'
import type { OportunidadeRecord, ProjetoRecord } from '@/types/crm'

const stages = Object.keys(stageLabels) as Array<keyof typeof stageLabels>

const SUGESTOES_FUNIL = [
  'Quais oportunidades estão na etapa Proposta enviada?',
  'Qual o valor total de oportunidades em negociação?',
  'Quais oportunidades de alta probabilidade aguardam retorno?',
  'Quais os principais motivos de perda registrados recentemente?',
]

export default function FunnelPage() {
  const { ocultarValores } = useFinanceiroVisibilidade()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data, loading, error, reload, setData } = useCrmData<OportunidadeRecord>(
    'oportunidades',
    {
      expand: 'cliente,responsavel,responsavel_colaborador,tipo_servico,projeto',
      sort: '-updated',
      realtime: true,
    },
  )
  const [newOpen, setNewOpen] = useState(params.get('novo') === '1')
  const [selected, setSelected] = useState<OportunidadeRecord | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [excluirModalOpen, setExcluirModalOpen] = useState(false)
  const [oportunidadeParaExcluir, setOportunidadeParaExcluir] = useState<OportunidadeRecord | null>(
    null,
  )
  const [query, setQuery] = useState('')
  const [trail, setTrail] = useState('todos')
  const [dragged, setDragged] = useState<OportunidadeRecord | null>(null)
  const [closing, setClosing] = useState<{
    record: OportunidadeRecord
    stage: 'ganho' | 'perdido'
  } | null>(null)
  const [closeDate, setCloseDate] = useState(new Date().toISOString().slice(0, 10))
  const [lossReason, setLossReason] = useState('outro')

  useEffect(() => {
    if (params.get('novo') === '1') setNewOpen(true)
  }, [params])
  const canWrite = user?.role === 'admin' || user?.role === 'comercial'
  const canDelete = Boolean(user && (user.role === 'admin' || user.role === 'comercial'))
  // Trilhas dinâmicas para o filtro: padrão + qualquer trilha customizada encontrada nos dados
  const availableTrails = useMemo(() => {
    const list: Array<{ value: string; label: string }> = [
      { value: 'todos', label: 'Todas as trilhas' },
      { value: 'opea', label: 'OPEA' },
      { value: 'registro', label: 'Registro' },
      { value: 'demais', label: 'Demais' },
    ]
    const customTrails = new Set<string>()
    for (const item of data) {
      if (
        item.trilha_prevista_nome &&
        !['opea', 'registro', 'demais'].includes(item.trilha_prevista_nome.toLowerCase())
      ) {
        customTrails.add(item.trilha_prevista_nome)
      }
    }
    for (const custom of customTrails) {
      list.push({ value: custom, label: custom })
    }
    return list
  }, [data])

  const filtered = useMemo(
    () =>
      data.filter((item) => {
        const matchesQuery =
          !query ||
          `${item.titulo} ${item.expand?.cliente?.razao_social || ''} ${item.servico_nome || ''} ${item.expand?.tipo_servico?.nome || ''} ${item.expand?.responsavel_colaborador?.nome_completo || ''}`
            .toLowerCase()
            .includes(query.toLowerCase())

        if (!matchesQuery) return false
        if (trail === 'todos') return true
        if (item.trilha_prevista === trail) return true
        if (item.trilha_prevista_nome === trail) return true
        return false
      }),
    [data, query, trail, ocultarValores],
  )

  async function move(record: OportunidadeRecord, stage: keyof typeof stageLabels) {
    if (!canWrite || record.etapa === stage) return
    if (stage === 'ganho' || stage === 'perdido') {
      setClosing({ record, stage })
      return
    }
    const previous = data
    setData(data.map((item) => (item.id === record.id ? { ...item, etapa: stage } : item)))
    try {
      await updateOne('oportunidades', record.id, { etapa: stage })
      toast.success(`Oportunidade movida para ${stageLabels[stage]}`)
    } catch {
      setData(previous)
      toast.error('Não foi possível mover a oportunidade')
    }
  }

  async function confirmClose() {
    if (!closing) return
    try {
      await updateOne('oportunidades', closing.record.id, {
        etapa: closing.stage,
        data_fechamento: `${closeDate} 12:00:00.000Z`,
        motivo_perda: closing.stage === 'perdido' ? lossReason : '',
      })
      toast.success(
        closing.stage === 'ganho'
          ? 'Oportunidade fechada como ganha'
          : 'Oportunidade fechada como perdida',
      )
      setClosing(null)
      await reload()
    } catch {
      toast.error('Não foi possível concluir o fechamento')
    }
  }

  async function convertToProject() {
    if (!selected) return
    if (selected.projeto || selected.expand?.projeto) {
      const projId = selected.projeto || selected.expand?.projeto?.id
      toast.info('Esta oportunidade já possui um projeto vinculado. Redirecionando...')
      setSelected(null)
      navigate(`/projetos/${projId}`)
      return
    }
    setProjectOpen(true)
  }

  async function onProjectCreated(project: ProjetoRecord) {
    if (selected) {
      try {
        await updateOne('oportunidades', selected.id, {
          projeto: project.id,
          etapa: 'ganho',
          data_fechamento: new Date().toISOString(),
        })
        if (user) {
          await createOne('atividades', {
            usuario: user.id,
            texto: `Conversão: Oportunidade "${selected.titulo}" convertida no Projeto ${project.numero} (${project.nome}).`,
            cliente: selected.cliente,
            oportunidade: selected.id,
            projeto: project.id,
            tipo: 'conversao_oportunidade_projeto',
          })
        }
      } catch (err) {
        console.warn('Erro ao atualizar vínculo da oportunidade com projeto:', err)
      }
    }
    setSelected(null)
    navigate(`/projetos/${project.id}`)
  }

  if (loading) return <PageLoading />
  if (error) return <ErrorState onRetry={() => void reload()} />

  return (
    <div>
      <SectionHeader
        eyebrow="GESTÃO COMERCIAL"
        title="Funil de oportunidades"
        description="Arraste os cartões entre etapas; fechamentos pedem confirmação."
        actions={
          <Button
            onClick={() => setNewOpen(true)}
            disabled={!canWrite}
            className="bg-[#FF6A13] hover:bg-[#E85B06]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova oportunidade
          </Button>
        }
      />
      <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-white p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-[#9A9A9A]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente ou oportunidade"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#8A8A8A]" />
          <Select value={trail} onValueChange={setTrail}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableTrails.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {data.length === 0 ? (
        <EmptyState
          title="Nenhuma oportunidade ainda"
          description="Crie a primeira oportunidade para iniciar o funil comercial."
          action={<Button onClick={() => setNewOpen(true)}>Criar oportunidade</Button>}
        />
      ) : (
        <div className="flex snap-x gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const items = filtered.filter((item) => item.etapa === stage)
            const total = items.reduce((sum, item) => sum + item.valor_estimado, 0)
            return (
              <section
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragged) void move(dragged, stage)
                  setDragged(null)
                }}
                className={`blueprint-grid flex w-[285px] min-w-[285px] snap-start flex-col rounded-xl border ${dragged ? 'border-dashed border-[#FFB27B]' : 'border-[#DEDEDE]'}`}
              >
                <header
                  className="rounded-t-xl border-b bg-white p-4"
                  style={{ borderTop: `4px solid ${stageColors[stage]}` }}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[#4B4B4B]">{stageLabels[stage]}</h2>
                    <span className="mono-value flex h-6 min-w-6 items-center justify-center rounded-full bg-[#F2F2F2] px-1.5 text-xs font-bold">
                      {items.length}
                    </span>
                  </div>
                </header>
                <div className="min-h-[420px] flex-1 space-y-3 p-3">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      draggable={canWrite}
                      onDragStart={() => setDragged(item)}
                      onDragEnd={() => setDragged(null)}
                      onClick={() => setSelected(item)}
                      className="cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#FFB27B] hover:shadow-md active:scale-[1.01]"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-[#C2C2C2]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-bold uppercase tracking-wide text-[#8A8A8A]">
                              {item.expand?.cliente?.razao_social || 'Cliente'}
                            </p>
                            <div className="flex items-center gap-1 shrink-0">
                              {item.origem_canal === 'whatsapp' && (
                                <CrmBadge tone="green" className="px-1.5 py-0 text-[9px] font-bold">
                                  WhatsApp
                                </CrmBadge>
                              )}
                              {/* Menu de contexto (três pontos) */}
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  asChild
                                  onClick={(e) => {
                                    e.stopPropagation()
                                  }}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-[#9A9A9A] hover:text-[#4B4B4B] hover:bg-neutral-100 -mr-1"
                                    title="Opções da oportunidade"
                                    aria-label="Opções da oportunidade"
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-48 text-xs"
                                >
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelected(item)
                                      setEditOpen(true)
                                    }}
                                    disabled={!canWrite}
                                    className="cursor-pointer"
                                  >
                                    <Edit2 className="mr-2 h-3.5 w-3.5 text-neutral-600" />
                                    Editar oportunidade
                                  </DropdownMenuItem>

                                  {(item.projeto || item.expand?.projeto) && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                      <Link
                                        to={`/projetos/${item.projeto || item.expand?.projeto?.id}`}
                                      >
                                        <FolderKanban className="mr-2 h-3.5 w-3.5 text-[#FF6A13]" />
                                        Acessar projeto
                                      </Link>
                                    </DropdownMenuItem>
                                  )}

                                  {canDelete && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setOportunidadeParaExcluir(item)
                                          setExcluirModalOpen(true)
                                        }}
                                        className="cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                                      >
                                        <Trash2 className="mr-2 h-3.5 w-3.5 text-rose-600" />
                                        Excluir oportunidade
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <h3 className="mt-1 text-sm font-semibold leading-snug text-[#4B4B4B]">
                            {item.titulo}
                          </h3>
                        </div>
                      </div>
                      <p className="mono-value mt-4 text-lg font-bold text-[#D65100]">
                        {formatCurrency(item.valor_estimado)}
                      </p>
                      {/* Badge / Chip de Projeto Vinculado */}
                      {(item.projeto || item.expand?.projeto) && (
                        <div className="mt-2.5">
                          <Link
                            to={`/projetos/${item.projeto || item.expand?.projeto?.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50/90 px-2.5 py-0.5 text-[10px] font-bold text-[#D65100] hover:bg-orange-100 hover:text-[#B23B00] transition"
                            title="Ir para o projeto vinculado"
                          >
                            <FolderKanban className="h-3 w-3 text-[#FF6A13]" />
                            <span>
                              Vinculada ao projeto {item.expand?.projeto?.numero || 'existente'}
                            </span>
                            <ArrowUpRight className="h-2.5 w-2.5 opacity-60" />
                          </Link>
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between">
                        <CrmBadge tone="gray" className="max-w-[170px] truncate">
                          {item.trilha_prevista_nome ||
                            trailLabels[item.trilha_prevista] ||
                            'Sem trilha'}
                        </CrmBadge>
                        <Avatar
                          className="h-7 w-7"
                          title={
                            item.expand?.responsavel_colaborador?.nome_completo ||
                            item.expand?.responsavel?.name ||
                            'Sem responsável'
                          }
                        >
                          <AvatarFallback className="bg-[#FFF0E5] text-[9px] font-bold text-[#D65100]">
                            {initials(
                              item.expand?.responsavel_colaborador?.nome_completo ||
                                item.expand?.responsavel?.name,
                            )}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      {item.data_prevista_fechamento && (
                        <div
                          className={`mt-3 flex items-center gap-1.5 border-t pt-3 text-[11px] ${new Date(item.data_prevista_fechamento) < new Date() && !['ganho', 'perdido'].includes(item.etapa) ? 'text-amber-700' : 'text-[#8A8A8A]'}`}
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(item.data_prevista_fechamento)}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                <footer className="border-t bg-white/80 p-3 text-xs text-[#737373]">
                  <div className="flex justify-between">
                    <span>{items.length} negócio(s)</span>
                    <span className="mono-value font-bold">{formatCurrency(total)}</span>
                  </div>
                </footer>
              </section>
            )
          })}
        </div>
      )}

      <OportunidadeDialog
        open={newOpen}
        onOpenChange={(value) => {
          setNewOpen(value)
          if (!value && params.has('novo')) {
            params.delete('novo')
            setParams(params, { replace: true })
          }
        }}
        onSaved={() => void reload()}
      />
      <OportunidadeDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        oportunidade={selected}
        onSaved={(updated) => {
          setSelected(updated)
          void reload()
        }}
        onDeleted={(deletedId) => {
          if (selected?.id === deletedId) {
            setSelected(null)
          }
          void reload()
        }}
      />

      {/* Modal centralizado de confirmação e exclusão de oportunidade */}
      <ExcluirOportunidadeModal
        open={excluirModalOpen}
        onOpenChange={setExcluirModalOpen}
        oportunidade={oportunidadeParaExcluir}
        onDeleted={(deletedId) => {
          if (selected?.id === deletedId) {
            setSelected(null)
          }
          setOportunidadeParaExcluir(null)
          void reload()
        }}
      />
      <Sheet open={Boolean(selected)} onOpenChange={(value) => !value && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.titulo}</SheetTitle>
            <SheetDescription>{selected?.expand?.cliente?.razao_social}</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-[#FFF6EC] p-3">
                  <p className="technical-label">VALOR</p>
                  <p className="mono-value mt-1 font-bold text-[#D65100]">
                    {formatCurrency(selected.valor_estimado)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="technical-label">PROBABILIDADE</p>
                  <p className="mono-value mt-1 font-bold">{selected.probabilidade}%</p>
                </div>
              </div>
              {/* Detalhes de Serviço, Trilha e Responsável */}
              <div className="rounded-lg border bg-neutral-50/70 p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 font-medium">Serviço:</span>
                  <span className="font-semibold text-neutral-900 text-right">
                    {selected.servico_nome ||
                      selected.expand?.tipo_servico?.nome ||
                      'Não especificado'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 font-medium">Trilha:</span>
                  <CrmBadge tone="gray" className="font-semibold">
                    {selected.trilha_prevista_nome ||
                      trailLabels[selected.trilha_prevista] ||
                      'Sem trilha'}
                  </CrmBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 font-medium">Responsável:</span>
                  <span className="font-semibold text-neutral-900">
                    {selected.expand?.responsavel_colaborador?.nome_completo ||
                      selected.expand?.responsavel?.name ||
                      'Não atribuído'}
                  </span>
                </div>
                {(selected.projeto || selected.expand?.projeto) && (
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-200">
                    <span className="text-neutral-500 font-medium">Projeto Vinculado:</span>
                    <Link
                      to={`/projetos/${selected.projeto || selected.expand?.projeto?.id}`}
                      className="inline-flex items-center gap-1 font-bold text-[#D65100] hover:underline"
                    >
                      <FolderKanban className="h-3.5 w-3.5 text-[#FF6A13]" />
                      <span>
                        {selected.expand?.projeto?.numero
                          ? `Projeto ${selected.expand.projeto.numero}`
                          : 'Ver Projeto'}
                      </span>
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
              <div>
                <Label>Etapa</Label>
                <Select
                  value={selected.etapa}
                  onValueChange={(value: keyof typeof stageLabels) => void move(selected, value)}
                  disabled={!canWrite}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stageLabels[stage]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Box de Informações de WhatsApp se aplicável */}
              {(selected.origem_canal === 'whatsapp' ||
                selected.whatsapp_remetente ||
                selected.expand?.cliente?.telefone) && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <MessageSquare className="h-4 w-4 text-emerald-600" />
                      <span>Contato via WhatsApp</span>
                    </div>
                    {selected.origem_canal === 'whatsapp' && (
                      <CrmBadge tone="green" className="text-[10px]">
                        Origem WhatsApp
                      </CrmBadge>
                    )}
                  </div>
                  {selected.whatsapp_remetente && (
                    <p className="text-xs text-emerald-800">
                      <strong>Remetente:</strong> {selected.whatsapp_remetente}
                    </p>
                  )}
                  {selected.whatsapp_mensagem && (
                    <div className="rounded border border-emerald-200/80 bg-white p-2.5 text-xs text-zinc-700 italic">
                      "{selected.whatsapp_mensagem}"
                    </div>
                  )}
                  {/* Botão de retormada manual wa.me */}
                  {Boolean(selected.whatsapp_remetente || selected.expand?.cliente?.telefone) && (
                    <div className="pt-1">
                      <a
                        href={buildWhatsAppChatUrl(
                          selected.whatsapp_remetente || selected.expand?.cliente?.telefone,
                          `Olá! Sou da AEROCAD Consultoria Aeronáutica, referente à sua solicitação de orçamento (${selected.titulo}).`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Retomar conversa no WhatsApp (wa.me)
                      </a>
                    </div>
                  )}
                </div>
              )}
              <div>
                <p className="technical-label">OBSERVAÇÕES</p>
                <div
                  className="mt-2 text-sm text-[#595959] prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: selected.observacoes || '<p>Nenhuma observação registrada.</p>',
                  }}
                />
              </div>
              {/* Alerta de projeto já vinculado se existir */}
              {(selected.projeto || selected.expand?.projeto) && (
                <div className="rounded-lg border border-orange-200 bg-orange-50/70 p-3 text-xs text-[#8A3B00] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-[#FF6A13] shrink-0" />
                    <div>
                      <p className="font-bold">Oportunidade já convertida em projeto</p>
                      <p className="text-[11px] text-neutral-600">
                        {selected.expand?.projeto?.numero
                          ? `Vinculada ao projeto ${selected.expand.projeto.numero} (${selected.expand.projeto.nome || ''})`
                          : 'Projeto cadastrado e sincronizado.'}
                      </p>
                    </div>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className="h-7 text-xs bg-[#FF6A13] hover:bg-[#E85B06] text-white shrink-0"
                  >
                    <Link to={`/projetos/${selected.projeto || selected.expand?.projeto?.id}`}>
                      Acessar Projeto
                    </Link>
                  </Button>
                </div>
              )}
              <div className="flex flex-col gap-2 pt-2 border-t border-neutral-200">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditOpen(true)}
                    disabled={!canWrite}
                    className="flex-1 border-neutral-300"
                  >
                    <Edit2 className="mr-1.5 h-3.5 w-3.5 text-neutral-600" />
                    Editar oportunidade
                  </Button>
                  {canDelete && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setOportunidadeParaExcluir(selected)
                        setExcluirModalOpen(true)
                      }}
                      className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 px-3"
                      title="Excluir oportunidade"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {selected.projeto || selected.expand?.projeto ? (
                  <Button
                    asChild
                    variant="default"
                    className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold"
                  >
                    <Link to={`/projetos/${selected.projeto || selected.expand?.projeto?.id}`}>
                      <FolderKanban className="mr-2 h-4 w-4 text-[#FF6A13]" />
                      {selected.expand?.projeto?.numero
                        ? `Acessar Projeto ${selected.expand.projeto.numero}`
                        : 'Acessar Projeto Vinculado'}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    onClick={convertToProject}
                    disabled={!canWrite}
                    className="w-full bg-[#FF6A13] hover:bg-[#E85B06] font-semibold"
                  >
                    <FolderKanban className="mr-2 h-4 w-4" />
                    Converter em projeto
                  </Button>
                )}
              </div>{' '}
            </div>
          )}
        </SheetContent>
      </Sheet>
      <ProjetoDialog
        open={projectOpen}
        onOpenChange={setProjectOpen}
        oportunidade={selected}
        onSaved={onProjectCreated}
      />
      <Dialog open={Boolean(closing)} onOpenChange={(value) => !value && setClosing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {closing?.stage === 'ganho'
                ? 'Confirmar oportunidade ganha'
                : 'Confirmar oportunidade perdida'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data de fechamento</Label>
              <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
            </div>
            {closing?.stage === 'perdido' && (
              <div className="space-y-2">
                <Label>Motivo da perda</Label>
                <Select value={lossReason} onValueChange={setLossReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preco">Preço</SelectItem>
                    <SelectItem value="prazo">Prazo</SelectItem>
                    <SelectItem value="concorrente">Concorrente</SelectItem>
                    <SelectItem value="desistencia_obra">Desistência da obra</SelectItem>
                    <SelectItem value="sem_retorno">Sem retorno</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Textarea placeholder="Observação de fechamento (opcional)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosing(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmClose} className="bg-[#FF6A13] hover:bg-[#E85B06]">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assistente de IA Nativo da Seção Funil */}
      <AssistenteSecaoDrawer
        agentSlug="assistente-funil"
        titulo="Assistente do Funil"
        subtitulo="Pipeline comercial, kanban e propostas em tempo real"
        secaoNome="Funil Comercial"
        areaPermissao="funil"
        sugestoes={SUGESTOES_FUNIL}
        placeholder="Pergunte sobre etapas do funil, valores ou oportunidades..."
        descricaoModo="consulta o pipeline comercial e propostas em tempo real sem alterar status."
        floatingButtonLabel="Assistente do Funil"
      />
    </div>
  )
}
