import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileUp,
  Link2,
  Paperclip,
  Plus,
  Save,
  TriangleAlert,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { AnexosList } from '@/components/common/AnexosList'
import { AssistenteIAPanel } from '@/components/common/AssistenteIAPanel'
import { CrmBadge } from '@/components/common/CrmBadge'
import { ErrorState, PageLoading } from '@/components/common/States'
import { AnexoDialog } from '@/components/forms/AnexoDialog'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { processStatusLabels } from '@/lib/crm'
import { Award, Mail, ShieldCheck, Users } from 'lucide-react'
import {
  EquipeTecnicaSelector,
  type EquipeTecnicaValue,
} from '@/components/projetos/EquipeTecnicaSection'
import { GeradorMinutaEmailModal } from '@/components/common/GeradorMinutaEmailModal'
import type { MinutaEmailContexto } from '@/lib/minutasEmail'
import { formatDate, toInputDate } from '@/lib/format'
import { createOne, getOne, listAll, updateOne } from '@/services/api'
import type {
  AnexoRecord,
  AtividadeRecord,
  ColaboradorRecord,
  ExigenciaRecord,
  ProcessoRecord,
  UserRecord,
} from '@/types/crm'

export default function ProcessDetailPage() {
  useFinanceiroVisibilidade()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [process, setProcess] = useState<ProcessoRecord | null>(null)
  const [requirements, setRequirements] = useState<ExigenciaRecord[]>([])
  const [anexos, setAnexos] = useState<AnexoRecord[]>([])
  const [activities, setActivities] = useState<AtividadeRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [colaboradores, setColaboradores] = useState<ColaboradorRecord[]>([])
  const [editEquipeOpen, setEditEquipeOpen] = useState(false)
  const [equipe, setEquipe] = useState<EquipeTecnicaValue>({
    coordenadorId: undefined,
    analistaId: undefined,
    rtsIds: [],
  })
  const [salvandoEquipe, setSalvandoEquipe] = useState(false)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [minutaEmailOpen, setMinutaEmailOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [anexoOpen, setAnexoOpen] = useState(false)
  const [form, setForm] = useState({ descricao: '', prazo: '', responsavel: '', resposta: '' })
  const [links, setLinks] = useState({ link_drive: '', link_emails: '', link_ambiente: '' })
  const canWrite = user?.role === 'admin' || user?.role === 'tecnico'
  const load = async () => {
    setLoading(true)
    try {
      const record = await getOne<ProcessoRecord>('processos', id, {
        expand:
          'projeto,projeto.cliente,coordenador_colaborador,analista_colaborador,rts_colaboradores',
      })
      setProcess(record)
      setEquipe({
        coordenadorId: record.coordenador_colaborador || undefined,
        analistaId: record.analista_colaborador || undefined,
        rtsIds: Array.isArray(record.rts_colaboradores) ? [...record.rts_colaboradores] : [],
      })
      setLinks({
        link_drive: record.link_drive || '',
        link_emails: record.link_emails || '',
        link_ambiente: record.link_ambiente || record.link_sysaga || '',
      })
      const [r, an, a, u, colabs] = await Promise.all([
        listAll<ExigenciaRecord>('exigencias', {
          filter: `processo = '${id}'`,
          expand: 'responsavel',
          sort: 'prazo',
        }),
        listAll<AnexoRecord>('anexos', {
          filter: `processo = '${id}'`,
          expand: 'usuario',
          sort: '-created',
        }).catch(() => []),
        listAll<AtividadeRecord>('atividades', {
          filter: `processo = '${id}'`,
          expand: 'usuario',
          sort: '-created',
        }),
        listAll<UserRecord>('users', {
          filter: "role = 'tecnico' || role = 'admin'",
          sort: 'name',
        }),
        listAll<ColaboradorRecord>('colaboradores', {
          sort: 'nome_completo',
        }),
      ])
      setRequirements(r)
      setAnexos(an)
      setActivities(a)
      setUsers(u)
      setColaboradores(colabs)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [id])
  async function setRequirementStatus(item: ExigenciaRecord, status: string) {
    try {
      await updateOne('exigencias', item.id, {
        status,
        data_resposta: status === 'atendida' ? new Date().toISOString() : item.data_resposta,
        resposta:
          status === 'atendida' && !item.resposta
            ? 'Atendimento registrado pelo responsável.'
            : item.resposta,
      })
      toast.success('Exigência atualizada')
      void load()
    } catch {
      toast.error('Não foi possível atualizar a exigência')
    }
  }
  async function createRequirement(event: FormEvent) {
    event.preventDefault()
    if (!form.descricao.trim()) return
    try {
      await createOne('exigencias', {
        processo: id,
        descricao: form.descricao.trim(),
        prazo: form.prazo ? `${form.prazo} 12:00:00.000Z` : '',
        status: 'pendente',
        responsavel: form.responsavel,
        resposta: form.resposta,
        historico_respostas: [],
      })
      toast.success('Exigência criada')
      setNewOpen(false)
      setForm({ descricao: '', prazo: '', responsavel: '', resposta: '' })
      void load()
    } catch {
      toast.error('Não foi possível criar a exigência')
    }
  }
  async function saveLinks() {
    const values = Object.values(links).filter(Boolean)
    if (
      values.some((value) => {
        try {
          new URL(value)
          return false
        } catch {
          return true
        }
      })
    )
      return toast.error('Informe links completos começando com http:// ou https://')
    try {
      await updateOne('processos', id, links)
      toast.success('Links atualizados')
    } catch {
      toast.error('Não foi possível salvar os links')
    }
  }
  async function markInRequirement() {
    try {
      const updated = await updateOne<ProcessoRecord>('processos', id, { status: 'em_exigencia' })
      setProcess({ ...process!, ...updated })
      toast.success('Processo marcado como Em exigência')
    } catch {
      toast.error('Não foi possível atualizar o processo')
    }
  }

  async function handleSalvarEquipeProcesso() {
    if (!process) return
    setSalvandoEquipe(true)
    try {
      const rtsColabsRecords = colaboradores.filter((c) => (equipe.rtsIds || []).includes(c.id))
      const rtsUserIds = Array.from(
        new Set(
          rtsColabsRecords.map((c) => c.usuario_sistema).filter((u): u is string => Boolean(u)),
        ),
      )

      await updateOne<ProcessoRecord>('processos', process.id, {
        coordenador_colaborador: equipe.coordenadorId || null,
        analista_colaborador: equipe.analistaId || null,
        rts_colaboradores: equipe.rtsIds || [],
        rts_usuarios: rtsUserIds,
      })

      // Auditoria
      try {
        const nomesRts = rtsColabsRecords.map((c) => c.nome_completo).join(', ') || 'Nenhum'
        await createOne('atividades', {
          usuario: user?.id,
          texto: `Atualizou a Equipe Técnica do processo ${process.numero_protocolo || process.orgao}: RTs=[${nomesRts}]`,
          processo: process.id,
          projeto: process.projeto,
        })
      } catch {
        /* ignore */
      }

      toast.success('Equipe técnica do processo atualizada!')
      setEditEquipeOpen(false)
      void load()
    } catch (err: unknown) {
      toast.error(
        'Erro ao salvar equipe do processo: ' + (err instanceof Error ? err.message : String(err)),
      )
    } finally {
      setSalvandoEquipe(false)
    }
  }
  if (loading) return <PageLoading />
  if (failed || !process) return <ErrorState onRetry={() => void load()} />
  const pending = requirements.filter((i) => i.status === 'pendente')

  const minutaContexto: MinutaEmailContexto = {
    tipo: 'followup_processo',
    processo: process,
    projeto: process?.expand?.projeto,
    cliente: process?.expand?.projeto?.expand?.cliente,
    contatoNome: process?.expand?.projeto?.expand?.cliente?.razao_social,
    contatoEmail: process?.expand?.projeto?.expand?.cliente?.email,
    exigencias: requirements,
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => navigate('/processos')} className="-ml-3">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar aos processos
        </Button>
        <Button
          variant="outline"
          onClick={() => setMinutaEmailOpen(true)}
          className="border-orange-300 text-[#D65100] hover:bg-orange-50 font-medium text-xs h-9"
          title="Gerar e-mail formal de follow-up perante o órgão regulador com dados do processo"
        >
          <Mail className="mr-1.5 h-4 w-4 text-[#FF6A13]" />
          Gerar follow-up ao órgão
        </Button>
      </div>
      <header className="crm-card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CrmBadge tone="orange">{process.orgao}</CrmBadge>
              <CrmBadge
                tone={
                  process.status === 'deferido'
                    ? 'green'
                    : process.status === 'em_exigencia'
                      ? 'amber'
                      : 'gray'
                }
              >
                {processStatusLabels[process.status]}
              </CrmBadge>
            </div>
            <h1 className="mono-value mt-3 text-2xl font-bold text-[#424242]">
              {process.numero_protocolo || 'Processo a protocolar'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Link
                to={`/projetos/${process.projeto}`}
                className="inline-block text-sm text-[#737373] hover:text-[#E85B06]"
              >
                {process.expand?.projeto?.numero} · {process.expand?.projeto?.nome}
              </Link>
              {canWrite && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditEquipeOpen(true)}
                  className="h-7 text-xs border-orange-200 text-[#D65100] hover:bg-orange-50 ml-2"
                >
                  <Users className="h-3 w-3 mr-1 text-[#FF6A13]" />
                  Designar Equipe Técnica
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="technical-label">PROTOCOLO</p>
              <p className="mono-value mt-1 text-sm font-bold">
                {formatDate(process.data_protocolo)}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="technical-label">PRAZO DO ÓRGÃO</p>
              <p className="mono-value mt-1 text-sm font-bold text-amber-800">
                {formatDate(process.prazo_orgao)}
              </p>
            </div>
          </div>
        </div>

        {/* Bloco Equipe Técnica do Processo */}
        <div className="mt-4 pt-4 border-t border-neutral-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-[#FF6A13]">
              <ShieldCheck className="h-4 w-4" />
              Equipe do Processo:
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-neutral-600">
                Coordenador:{' '}
                <strong className="text-neutral-900">
                  {process.expand?.coordenador_colaborador?.nome_completo ||
                    process.expand?.projeto?.expand?.coordenador_colaborador?.nome_completo ||
                    'Não definido'}
                </strong>
              </span>
              <span className="text-neutral-300">•</span>
              <span className="text-neutral-600">
                Analista:{' '}
                <strong className="text-neutral-900">
                  {process.expand?.analista_colaborador?.nome_completo ||
                    process.expand?.projeto?.expand?.analista_colaborador?.nome_completo ||
                    'Não definido'}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase">RT(s):</span>
            {process.expand?.rts_colaboradores && process.expand.rts_colaboradores.length > 0 ? (
              process.expand.rts_colaboradores.map((rt) => {
                const reg = rt.registro_profissional_numero
                  ? `${rt.registro_profissional_tipo || 'CREA'} ${rt.registro_profissional_numero}${rt.registro_profissional_uf ? `/${rt.registro_profissional_uf}` : ''}`
                  : ''
                return (
                  <span
                    key={rt.id}
                    className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 text-[#D65100] px-2 py-0.5 rounded text-[11px] font-medium"
                  >
                    <Award className="h-3 w-3 text-[#FF6A13]" />
                    <strong>{rt.nome_completo}</strong>
                    {reg && <span className="font-mono text-[10px] text-neutral-600">({reg})</span>}
                  </span>
                )
              })
            ) : process.expand?.projeto?.expand?.rts_colaboradores &&
              process.expand.projeto.expand.rts_colaboradores.length > 0 ? (
              process.expand.projeto.expand.rts_colaboradores.map((rt) => (
                <span
                  key={rt.id}
                  className="inline-flex items-center gap-1 bg-orange-50/70 border border-orange-200 text-[#D65100] px-2 py-0.5 rounded text-[11px] font-medium"
                >
                  <Award className="h-3 w-3 text-[#FF6A13]" />
                  <strong>{rt.nome_completo}</strong>
                  <span className="text-[9px] text-neutral-500">(Projeto)</span>
                </span>
              ))
            ) : (
              <span className="text-neutral-400 italic">Nenhum RT atribuído</span>
            )}

            {canWrite && (
              <button
                type="button"
                onClick={() => setEditEquipeOpen(true)}
                className="text-[11px] text-[#FF6A13] hover:underline font-semibold ml-1"
              >
                Alterar
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="crm-card overflow-hidden xl:col-span-2">
          <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center">
            <div>
              <p className="technical-label">NÚCLEO DO PROCESSO</p>
              <h2 className="text-lg font-bold">
                Exigências{' '}
                <span className="mono-value ml-1 text-sm text-[#FF6A13]">
                  {pending.length} pendente(s)
                </span>
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {pending.length > 0 && process.status !== 'em_exigencia' && (
                <Button
                  variant="outline"
                  onClick={markInRequirement}
                  className="border-amber-300 bg-amber-50 text-amber-800"
                >
                  <TriangleAlert className="mr-2 h-4 w-4" />
                  Marcar Em exigência
                </Button>
              )}
              <Button
                onClick={() => setNewOpen(true)}
                disabled={!canWrite}
                className="bg-[#FF6A13] hover:bg-[#E85B06]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova exigência
              </Button>
            </div>
          </div>
          <div className="divide-y">
            {requirements.map((item) => {
              const overdue =
                item.status === 'pendente' && item.prazo && new Date(item.prazo) < new Date()
              return (
                <article
                  key={item.id}
                  className={`p-5 ${overdue ? 'border-l-4 border-l-red-500 bg-red-50/30' : 'border-l-4 border-l-transparent'}`}
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row">
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        {item.status === 'atendida' ? (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                        ) : (
                          <span
                            className={`mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 ${overdue ? 'border-red-500' : 'border-amber-500'}`}
                          />
                        )}
                        <p className="text-sm font-semibold leading-relaxed text-[#4B4B4B]">
                          {item.descricao}
                        </p>
                      </div>
                      <div className="ml-7 mt-2 flex flex-wrap gap-3 text-xs text-[#737373]">
                        <span className="mono-value">Prazo: {formatDate(item.prazo)}</span>
                        <span>Responsável: {item.expand?.responsavel?.name || 'Não definido'}</span>
                        {item.data_resposta && (
                          <span>Atendida em {formatDate(item.data_resposta)}</span>
                        )}
                      </div>
                      {item.resposta && (
                        <div className="ml-7 mt-3 rounded-lg bg-[#F7F7F7] p-3 text-xs text-[#595959]">
                          <strong>Resposta:</strong> {item.resposta}
                        </div>
                      )}
                    </div>
                    <Select
                      value={item.status}
                      onValueChange={(status) => setRequirementStatus(item, status)}
                      disabled={!canWrite}
                    >
                      <SelectTrigger className="w-[145px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="atendida">Atendida</SelectItem>
                        <SelectItem value="dispensada">Dispensada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </article>
              )
            })}
            {!requirements.length && (
              <p className="p-10 text-center text-sm text-[#8A8A8A]">
                Nenhuma exigência registrada.
              </p>
            )}
          </div>

          {/* Seção de Anexos do Processo Regulatório */}
          <div className="border-t">
            <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center bg-[#FAFAFA]">
              <div>
                <p className="technical-label">PEÇAS E PROTOCOLOS</p>
                <h3 className="font-bold text-[#333] flex items-center gap-2">
                  Anexos e Documentos Regulatórios ({anexos.length})
                </h3>
              </div>
              <Button
                size="sm"
                onClick={() => setAnexoOpen(true)}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
              >
                <FileUp className="mr-2 h-4 w-4" />
                Anexar ao Processo
              </Button>
            </div>
            <div className="p-5">
              <AnexosList
                anexos={anexos}
                compact={true}
                onReload={() => void load()}
                onOpenUpload={() => setAnexoOpen(true)}
                emptyMessage="Nenhum arquivo regulatório, planta ou comprovação anexada a este processo."
              />
            </div>
          </div>

          {/* Assistente IA Integrado ao Processo Regulatório */}
          <div className="border-t">
            <div className="p-5 bg-gradient-to-r from-orange-50/50 via-white to-transparent flex items-center justify-between">
              <div>
                <p className="technical-label flex items-center gap-1.5 text-[#D65100]">
                  <Sparkles className="h-3.5 w-3.5 text-[#FF6A13]" />
                  ASSISTENTE GENERATIVO AEROCAD
                </p>
                <h3 className="font-bold text-[#333]">
                  Redação de Respostas a Exigências & Requerimentos
                </h3>
              </div>
              <span className="text-xs font-mono bg-white px-2.5 py-1 rounded-md border border-orange-200 text-[#D65100]">
                {process.orgao}
              </span>
            </div>
            <div className="p-4 bg-orange-50/20">
              <AssistenteIAPanel
                contextRecord={{
                  tipo: 'processo',
                  id: process.id,
                  titulo: `${process.orgao} — ${process.numero_protocolo || 'A protocolar'}`,
                  subtitulo: process.expand?.projeto?.nome,
                  dados: {
                    id: process.id,
                    orgao: process.orgao,
                    numero_protocolo: process.numero_protocolo,
                    data_protocolo: process.data_protocolo,
                    status: process.status,
                    prazo_orgao: process.prazo_orgao,
                    projeto: process.projeto,
                    projeto_nome: process.expand?.projeto?.nome,
                    exigencias_pendentes: requirements.filter((r) => r.status === 'pendente')
                      .length,
                  },
                }}
                quickPrompts={[
                  `Redija a minuta de resposta formal à exigência pendente deste processo perante o ${process.orgao}.`,
                  `Elabore o Requerimento Oficial (RQ) com fundamentação na ICA 11-408 / RBAC 154 para este protocolo.`,
                  `Redija um Ofício Técnico justificando a conformidade das superfícies limitadoras OLS perante o ${process.orgao}.`,
                  `Elabore o Plano de Ação Corretiva (PAC) para sanar o apontamento regulatório deste processo.`,
                ]}
                onDocumentCreated={() => void load()}
              />
            </div>
          </div>
        </section>
        <aside className="space-y-5">
          <section className="crm-card p-5">
            <p className="technical-label">LINKS MANUAIS</p>
            <h2 className="font-bold">Acessos externos</h2>
            <div className="mt-4 space-y-4">
              <LinkInput
                label="Pasta de documentos"
                value={links.link_drive}
                onChange={(link_drive) => setLinks((v) => ({ ...v, link_drive }))}
              />
              <LinkInput
                label="Corrente de e-mails"
                value={links.link_emails}
                onChange={(link_emails) => setLinks((v) => ({ ...v, link_emails }))}
              />
              <LinkInput
                label="Ambiente do órgão"
                value={links.link_ambiente}
                onChange={(link_ambiente) => setLinks((v) => ({ ...v, link_ambiente }))}
              />
            </div>
            <Button onClick={saveLinks} disabled={!canWrite} className="mt-4 w-full">
              <Save className="mr-2 h-4 w-4" />
              Salvar links
            </Button>
          </section>
          <section className="crm-card p-5">
            <p className="technical-label">TIMELINE</p>
            <h2 className="font-bold">Atividades</h2>
            <div className="mt-4 space-y-4">
              {activities.slice(0, 8).map((item) => (
                <div key={item.id} className="border-l-2 border-[#FFD2B3] pl-3">
                  <p className="text-xs">{item.texto}</p>
                  <p className="mt-1 text-[10px] text-[#9A9A9A]">{formatDate(item.created)}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova exigência</DialogTitle>
          </DialogHeader>
          <form onSubmit={createRequirement} className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Prazo do órgão</Label>
              <Input
                type="date"
                value={form.prazo}
                onChange={(e) => setForm((v) => ({ ...v, prazo: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select
                value={form.responsavel}
                onValueChange={(responsavel) => setForm((v) => ({ ...v, responsavel }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                Cancelar
              </Button>
              <Button className="bg-[#FF6A13] hover:bg-[#E85B06]">Criar exigência</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AnexoDialog
        open={anexoOpen}
        onOpenChange={setAnexoOpen}
        presetProcesso={process.id}
        presetProjeto={process.projeto}
        presetCliente={process.expand?.projeto?.cliente}
        onSuccess={() => void load()}
      />

      {/* Modal de Designação de Equipe Técnica do Processo */}
      <Dialog open={editEquipeOpen} onOpenChange={setEditEquipeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Equipe Técnica do Processo Regulatório</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <EquipeTecnicaSelector
              colaboradores={colaboradores}
              value={equipe}
              onChange={setEquipe}
              disabled={salvandoEquipe}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={salvandoEquipe}
              onClick={() => setEditEquipeOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={salvandoEquipe}
              onClick={handleSalvarEquipeProcesso}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold"
            >
              {salvandoEquipe ? 'Salvando...' : 'Salvar Equipe Técnica'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal do Gerador de Minutas de E-mail AEROCAD */}
      <GeradorMinutaEmailModal
        open={minutaEmailOpen}
        onOpenChange={setMinutaEmailOpen}
        initialContexto={minutaContexto}
        lockModel={true}
        modelosPermitidos={['followup_processo']}
      />
    </div>
  )
}

function LinkInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://"
        />
        {value && (
          <>
            <Button type="button" size="icon" variant="outline" asChild>
              <a href={value} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(value)
                toast.success('Copiado!')
              }}
            >
              <Clipboard className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
