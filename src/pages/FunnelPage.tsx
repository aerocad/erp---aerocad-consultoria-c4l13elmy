import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { CalendarDays, Filter, GripVertical, Plus, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States'
import { SectionHeader } from '@/components/common/SectionHeader'
import { OportunidadeDialog } from '@/components/forms/OportunidadeDialog'
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

export default function FunnelPage() {
  const { ocultarValores } = useFinanceiroVisibilidade()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data, loading, error, reload, setData } = useCrmData<OportunidadeRecord>(
    'oportunidades',
    { expand: 'cliente,responsavel,tipo_servico', sort: '-updated', realtime: true },
  )
  const [newOpen, setNewOpen] = useState(params.get('novo') === '1')
  const [selected, setSelected] = useState<OportunidadeRecord | null>(null)
  const [projectOpen, setProjectOpen] = useState(false)
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
  const filtered = useMemo(
    () =>
      data.filter(
        (item) =>
          (!query ||
            `${item.titulo} ${item.expand?.cliente?.razao_social}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (trail === 'todos' || item.trilha_prevista === trail),
      ),
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
    if (selected) setProjectOpen(true)
  }
  function onProjectCreated(project: ProjetoRecord) {
    if (selected)
      void updateOne('oportunidades', selected.id, {
        etapa: 'ganho',
        data_fechamento: new Date().toISOString(),
      })
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
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as trilhas</SelectItem>
              <SelectItem value="opea">OPEA</SelectItem>
              <SelectItem value="registro">Registro</SelectItem>
              <SelectItem value="demais">Demais</SelectItem>
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
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold uppercase tracking-wide text-[#8A8A8A]">
                            {item.expand?.cliente?.razao_social || 'Cliente'}
                          </p>
                          <h3 className="mt-1 text-sm font-semibold leading-snug text-[#4B4B4B]">
                            {item.titulo}
                          </h3>
                        </div>
                      </div>
                      <p className="mono-value mt-4 text-lg font-bold text-[#D65100]">
                        {formatCurrency(item.valor_estimado)}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <CrmBadge tone="gray">
                          {trailLabels[item.trilha_prevista] || 'Sem trilha'}
                        </CrmBadge>
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-[#FFF0E5] text-[9px] font-bold text-[#D65100]">
                            {initials(item.expand?.responsavel?.name)}
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
                  <p className="mono-value mt-1 font-bold">
                    {formatCurrency(selected.valor_estimado)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="technical-label">PROBABILIDADE</p>
                  <p className="mono-value mt-1 font-bold">{selected.probabilidade}%</p>
                </div>
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
              <div>
                <p className="technical-label">OBSERVAÇÕES</p>
                <p className="mt-2 whitespace-pre-line text-sm text-[#595959]">
                  {selected.observacoes || 'Nenhuma observação registrada.'}
                </p>
              </div>
              <Button
                onClick={convertToProject}
                disabled={!canWrite}
                className="w-full bg-[#FF6A13] hover:bg-[#E85B06]"
              >
                Converter em projeto
              </Button>
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
    </div>
  )
}
