import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Award,
  Calendar,
  CalendarDays,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  FileUp,
  FolderOpen,
  Paperclip,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  WalletCards,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { AnexosList } from '@/components/common/AnexosList'
import { AssistenteIAPanel } from '@/components/common/AssistenteIAPanel'
import { CrmBadge } from '@/components/common/CrmBadge'
import { ErrorState, PageLoading } from '@/components/common/States'
import { AnexoDialog } from '@/components/forms/AnexoDialog'
import { OrdemServicoDialog } from '@/components/forms/OrdemServicoDialog'
import { ProcessDialog } from '@/components/forms/ProcessDialog'
import { ArquivarProjetoModal } from '@/components/projetos/ArquivarProjetoModal'
import { EditarNomeProjetoModal } from '@/components/projetos/EditarNomeProjetoModal'
import { EditarProjetoModal } from '@/components/projetos/EditarProjetoModal'
import { ExcluirProjetoModal } from '@/components/projetos/ExcluirProjetoModal'
import { VincularNfseProjetoModal } from '@/components/financeiro/VincularNfseProjetoModal'
import { ConfirmarExcluirNotaModal } from '@/components/financeiro/ConfirmarExcluirNotaModal'
import { EditarVencimentoParcelaModal } from '@/components/financeiro/EditarVencimentoParcelaModal'
import { NotaExclusaoAlvo } from '@/services/exclusaoService'
import { Button } from '@/components/ui/button'
import { Archive, ArchiveRestore } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkles, Bot } from 'lucide-react'
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
import {
  canAccess,
  canViewFinancials,
  canViewNfse,
  osStatusColors,
  osStatusLabels,
  trailLabels,
  trailPhases,
} from '@/lib/crm'
import { formatCurrency, formatDate } from '@/lib/format'
import { createOne, getOne, listAll, updateOne } from '@/services/api'
import {
  calcularResumoFinanceiroProjeto,
  getStatusFinanceiroBadgeConfig,
} from '@/services/projetoFinanceiroInferidor'
import type {
  AnexoRecord,
  AtividadeRecord,
  DocumentoRecord,
  OrdemServicoRecord,
  ParcelaRecord,
  ProcessoRecord,
  ProjetoRecord,
} from '@/types/crm'

export default function ProjectDetailPage() {
  const { ocultarValores } = useFinanceiroVisibilidade()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [project, setProject] = useState<ProjetoRecord | null>(null)
  const [processes, setProcesses] = useState<ProcessoRecord[]>([])
  const [installments, setInstallments] = useState<ParcelaRecord[]>([])
  const [documents, setDocuments] = useState<DocumentoRecord[]>([])
  const [anexos, setAnexos] = useState<AnexoRecord[]>([])
  const [ordens, setOrdens] = useState<OrdemServicoRecord[]>([])
  const [activities, setActivities] = useState<AtividadeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [processOpen, setProcessOpen] = useState(false)
  const [anexoOpen, setAnexoOpen] = useState(false)
  const [osOpen, setOsOpen] = useState(false)
  const [editingOs, setEditingOs] = useState<OrdemServicoRecord | null>(null)
  const [vincularNfseOpen, setVincularNfseOpen] = useState(false)
  const [excluirNotaOpen, setExcluirNotaOpen] = useState(false)
  const [notasParaExcluir, setNotasParaExcluir] = useState<NotaExclusaoAlvo[]>([])
  const [parcelaParaEditarVencimento, setParcelaParaEditarVencimento] =
    useState<ParcelaRecord | null>(null)
  const [editarVencimentoOpen, setEditarVencimentoOpen] = useState(false)
  const [note, setNote] = useState('')
  const [excluirModalOpen, setExcluirModalOpen] = useState(false)
  const [editNomeOpen, setEditNomeOpen] = useState(false)
  const [editProjetoModalOpen, setEditProjetoModalOpen] = useState(false)
  const [editProjetoInitialTab, setEditProjetoInitialTab] = useState<
    'geral' | 'equipe' | 'financeiro' | 'tecnico' | 'prazos'
  >('geral')
  const [arquivarModalOpen, setArquivarModalOpen] = useState(false)
  const canWrite = ['admin', 'comercial', 'tecnico'].includes(user?.role || '')
  const isAdmin = user?.role === 'admin'
  const canManageOS = ['admin', 'tecnico'].includes(user?.role || '')
  const canEditName = ['admin', 'tecnico'].includes(user?.role || '')
  const canEditProject = ['admin', 'tecnico', 'financeiro'].includes(user?.role || '')
  const canArchive = ['admin', 'tecnico'].includes(user?.role || '')
  const canManageFinanceiro = ['admin', 'financeiro'].includes(user?.role || '')
  const userCanViewFinancials = canViewFinancials(user?.role)
  const userCanViewNfse = canViewNfse(user?.role)
  const canAnexarNfse = userCanViewNfse && ['admin', 'financeiro'].includes(user?.role || '')
  const canExcluirNfse = userCanViewNfse && ['admin', 'financeiro'].includes(user?.role || '')
  const canEditVencimento = userCanViewNfse && ['admin', 'financeiro'].includes(user?.role || '')
  const canAccessClients = canAccess(user?.role, 'clientes')

  const load = async () => {
    setLoading(true)
    try {
      const record = await getOne<ProjetoRecord>('projetos', id, {
        expand:
          'cliente,responsavel_tecnico,oportunidade,coordenador_colaborador,analista_colaborador,rts_colaboradores',
      })
      setProject(record)
      const [pr, pa, d, an, a, osList] = await Promise.all([
        listAll<ProcessoRecord>('processos', { filter: `projeto = '${id}'`, sort: '-created' }),
        listAll<ParcelaRecord>('parcelas', {
          filter: `projeto = '${id}'`,
          sort: 'vencimento',
        }).catch(() => []),
        listAll<DocumentoRecord>('documentos', { filter: `projeto = '${id}'`, sort: '-created' }),
        listAll<AnexoRecord>('anexos', {
          filter: `projeto = '${id}'`,
          expand: 'usuario',
          sort: '-created',
        }).catch(() => []),
        listAll<AtividadeRecord>('atividades', {
          filter: `projeto = '${id}'`,
          expand: 'usuario',
          sort: '-created',
        }),
        listAll<OrdemServicoRecord>('ordens_servico', {
          filter: `projeto = '${id}'`,
          expand: 'prestador_usuario',
          sort: '-created',
        }).catch(() => []),
      ])
      setProcesses(pr)
      setInstallments(pa)
      setDocuments(d)
      setAnexos(an)
      setActivities(a)
      setOrdens(osList)
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
  async function setPhase(fase: string) {
    if (!project || !canWrite) return
    try {
      const updated = await updateOne<ProjetoRecord>('projetos', project.id, {
        fase,
        percentual_concluido: Math.round(
          ((trailPhases[project.trilha].indexOf(fase) + 1) / trailPhases[project.trilha].length) *
            100,
        ),
      })
      setProject({ ...project, ...updated })
      toast.success(`Fase atualizada para ${fase}`)
      void load()
    } catch {
      toast.error('Não foi possível atualizar a fase')
    }
  }
  async function setStatus(status: string) {
    if (!project) return
    try {
      setProject(await updateOne<ProjetoRecord>('projetos', project.id, { status }))
      toast.success('Status atualizado')
    } catch {
      toast.error('Não foi possível atualizar o status')
    }
  }
  async function addNote() {
    if (!note.trim() || !user || !project) return
    try {
      await createOne('atividades', {
        usuario: user.id,
        texto: note.trim(),
        cliente: project.cliente,
        projeto: project.id,
      })
      setNote('')
      toast.success('Nota adicionada')
      void load()
    } catch {
      toast.error('Não foi possível adicionar a nota')
    }
  }
  if (loading) return <PageLoading />
  if (failed || !project) return <ErrorState onRetry={() => void load()} />
  const phases = trailPhases[project.trilha]
  const currentIndex = phases.indexOf(project.fase)
  const financialTotal = installments.reduce((s, i) => s + i.valor, 0)
  const paid = installments
    .filter((i) => i.status === 'paga')
    .reduce((s, i) => s + (i.valor_recebido || i.valor), 0)
  const resumoFinanceiro = calcularResumoFinanceiroProjeto(project, installments)
  const badgeFinanceiro = getStatusFinanceiroBadgeConfig(resumoFinanceiro)
  const days = project.prazo
    ? Math.ceil((new Date(project.prazo).getTime() - Date.now()) / 86400000)
    : null
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => navigate('/projetos')} className="-ml-3">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar aos projetos
        </Button>
        {canArchive && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setArquivarModalOpen(true)}
            className={
              project.arquivado
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900'
                : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
            }
          >
            {project.arquivado ? (
              <>
                <ArchiveRestore className="mr-1.5 h-4 w-4 text-emerald-600" />
                Desarquivar projeto
              </>
            ) : (
              <>
                <Archive className="mr-1.5 h-4 w-4 text-neutral-500" />
                Arquivar projeto
              </>
            )}
          </Button>
        )}
      </div>

      {project.arquivado && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <strong className="font-semibold">Projeto arquivado:</strong> Oculto da listagem
              padrão de projetos, relatórios e KPIs do painel. Dados financeiros e histórico
              permanecem preservados.
              {project.data_arquivamento && (
                <span className="ml-1 text-amber-700">
                  (Arquivado em {formatDate(project.data_arquivamento)})
                </span>
              )}
            </div>
          </div>
          {canArchive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setArquivarModalOpen(true)}
              className="h-7 text-xs bg-white border-amber-300 hover:bg-amber-100 text-amber-900 shrink-0"
            >
              Desarquivar
            </Button>
          )}
        </div>
      )}

      <header
        className={`crm-card p-5 sm:p-6 ${project.arquivado ? 'bg-neutral-50/70 border-neutral-300' : ''}`}
      >
        <div className="flex flex-col justify-between gap-5 lg:flex-row">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono-value text-xl font-black text-[#D65100]">{project.numero}</span>
              {project.arquivado && (
                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">
                  <Archive className="h-3 w-3" />
                  Arquivado
                </span>
              )}
              <CrmBadge tone={project.trilha === 'registro' ? 'green' : 'orange'}>
                {trailLabels[project.trilha]}
              </CrmBadge>
              {project.expand?.coordenador_colaborador && (
                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700">
                  <span className="text-[10px] text-neutral-400 uppercase font-semibold">
                    Coord:
                  </span>
                  <strong>{project.expand.coordenador_colaborador.nome_completo}</strong>
                </span>
              )}
              {project.expand?.analista_colaborador && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs text-blue-900">
                  <span className="text-[10px] text-blue-500 uppercase font-semibold">
                    Analista:
                  </span>
                  <strong>{project.expand.analista_colaborador.nome_completo}</strong>
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeFinanceiro.badgeClass}`}
                title={badgeFinanceiro.descricao}
              >
                {badgeFinanceiro.label}
              </span>
              {project.prioridade && (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                    project.prioridade === 'alta'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : project.prioridade === 'baixa'
                        ? 'bg-neutral-100 text-neutral-600 border-neutral-200'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-300'
                  }`}
                  title={`Prioridade ${project.prioridade}`}
                >
                  Prioridade: {project.prioridade}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 group">
              <h1 className="text-2xl font-bold text-[#424242]">{project.nome}</h1>
              {canEditProject && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditProjetoInitialTab('geral')
                    setEditProjetoModalOpen(true)
                  }}
                  className="h-8 px-2.5 border-orange-200 bg-orange-50/60 text-[#D65100] hover:bg-orange-100 hover:text-[#B23B00] shrink-0 font-medium"
                  title="Editar projeto completo (valores, prazos, dados)"
                  aria-label="Editar projeto completo"
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1.5 text-[#FF6A13]" />
                  <span className="text-xs font-semibold">Editar projeto</span>
                </Button>
              )}
              {canEditProject && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditProjetoInitialTab('equipe')
                    setEditProjetoModalOpen(true)
                  }}
                  className="h-8 px-2.5 border-orange-300 bg-white text-[#D65100] hover:bg-orange-50 shrink-0 font-medium text-xs"
                  title="Atribuir Coordenador, Analista e RTs"
                >
                  <Users className="h-3.5 w-3.5 mr-1 text-[#FF6A13]" />
                  <span>Equipe Técnica</span>
                </Button>
              )}
            </div>
            {canAccessClients ? (
              <Link
                to={`/clientes/${project.cliente}`}
                className="mt-1 inline-block text-sm text-[#737373] hover:text-[#E85B06]"
              >
                {project.expand?.cliente?.razao_social}
              </Link>
            ) : (
              <span className="mt-1 inline-block text-sm text-[#737373]">
                {project.expand?.cliente?.razao_social}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="technical-label">STATUS</Label>
              <Select value={project.status} onValueChange={setStatus} disabled={!canWrite}>
                <SelectTrigger className="mt-1 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div
              className={`rounded-lg border px-4 py-2 ${days !== null && days < 0 ? 'border-red-200 bg-red-50 text-red-700' : days !== null && days <= 15 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'bg-white'}`}
            >
              <p className="technical-label">PRAZO INTERNO</p>
              <p className="mono-value mt-1 text-sm font-bold">
                {formatDate(project.prazo)}{' '}
                {days !== null && (
                  <span className="font-normal">
                    · {days < 0 ? `${Math.abs(days)}d atrasado` : `${days}d`}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Seção Destaque de Equipe Técnica e Responsabilidade Técnica */}
        <div className="mt-4 pt-4 border-t border-neutral-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-[#FF6A13]">
              <ShieldCheck className="h-4 w-4" />
              Equipe Técnica:
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-neutral-600">
                Coordenador:{' '}
                <strong className="text-neutral-900">
                  {project.expand?.coordenador_colaborador?.nome_completo || 'Não definido'}
                </strong>
              </span>
              <span className="text-neutral-300">•</span>
              <span className="text-neutral-600">
                Analista:{' '}
                <strong className="text-neutral-900">
                  {project.expand?.analista_colaborador?.nome_completo || 'Não definido'}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase">RT(s):</span>
            {project.expand?.rts_colaboradores && project.expand.rts_colaboradores.length > 0 ? (
              project.expand.rts_colaboradores.map((rt) => {
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
            ) : project.expand?.responsavel_tecnico?.name ? (
              <span className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 text-[#D65100] px-2 py-0.5 rounded text-[11px] font-medium">
                <Award className="h-3 w-3 text-[#FF6A13]" />
                <strong>{project.expand.responsavel_tecnico.name}</strong>
                <span className="text-[10px] text-neutral-500">(Legado)</span>
              </span>
            ) : (
              <span className="text-neutral-400 italic">Nenhum RT atribuído</span>
            )}

            {canEditProject && (
              <button
                type="button"
                onClick={() => {
                  setEditProjetoInitialTab('equipe')
                  setEditProjetoModalOpen(true)
                }}
                className="text-[11px] text-[#FF6A13] hover:underline font-semibold ml-1"
              >
                Alterar
              </button>
            )}
          </div>
        </div>
      </header>
      <section className="crm-card mt-5 overflow-hidden">
        <div className="border-b p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="technical-label">TRILHA DE EXECUÇÃO</p>
              <h2 className="font-bold">{trailLabels[project.trilha]}</h2>
            </div>
            {canEditProject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditProjetoInitialTab('tecnico')
                  setEditProjetoModalOpen(true)
                }}
                className="h-7 text-xs text-neutral-500 hover:text-[#FF6A13]"
              >
                <Edit3 className="mr-1 h-3.5 w-3.5" />
                Editar escopo / trilha
              </Button>
            )}
          </div>
        </div>{' '}
        <div className="overflow-x-auto p-6">
          <div className="flex min-w-[780px] items-start">
            {phases.map((phase, index) => (
              <div
                key={phase}
                className="relative flex flex-1 flex-col items-center px-2 text-center"
              >
                {index < phases.length - 1 && (
                  <div
                    className={`absolute left-1/2 top-4 h-0.5 w-full ${index < currentIndex ? 'bg-[#FF6A13]' : 'bg-[#DEDEDE]'}`}
                  />
                )}
                <button
                  onClick={() => setPhase(phase)}
                  disabled={!canWrite}
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition ${index < currentIndex ? 'border-[#FF6A13] bg-[#FF6A13] text-white' : index === currentIndex ? 'animate-soft-pulse border-[#FF6A13] bg-white text-[#D65100]' : 'border-[#CFCFCF] bg-white text-[#9A9A9A]'}`}
                >
                  {index + 1}
                </button>
                <p
                  className={`mt-2 text-[11px] leading-tight ${index <= currentIndex ? 'font-semibold text-[#4B4B4B]' : 'text-[#8A8A8A]'}`}
                >
                  {phase}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <section className="crm-card overflow-hidden">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <p className="technical-label">REGULATÓRIO</p>
                <h2 className="font-bold">Processos regulatórios</h2>
              </div>
              <Button variant="outline" onClick={() => setProcessOpen(true)} disabled={!canWrite}>
                <Plus className="mr-2 h-4 w-4" />
                Novo processo
              </Button>
            </div>
            <div className="divide-y">
              {processes.map((item) => (
                <Link
                  key={item.id}
                  to={`/processos/${item.id}`}
                  className="flex items-center justify-between p-4 hover:bg-[#FFF6EC]"
                >
                  <div>
                    <p className="mono-value font-bold">
                      {item.numero_protocolo || 'A protocolar'}
                    </p>
                    <p className="mt-1 text-xs text-[#737373]">
                      {item.orgao} · prazo do órgão {formatDate(item.prazo_orgao)}
                    </p>
                  </div>
                  <CrmBadge
                    tone={
                      item.status === 'deferido'
                        ? 'green'
                        : item.status === 'em_exigencia'
                          ? 'amber'
                          : 'gray'
                    }
                  >
                    {item.status.replaceAll('_', ' ')}
                  </CrmBadge>
                </Link>
              ))}
              {!processes.length && (
                <p className="p-8 text-center text-sm text-[#8A8A8A]">Nenhum processo vinculado.</p>
              )}
            </div>
          </section>
          <section className="crm-card overflow-hidden">
            <div className="border-b p-5">
              <p className="technical-label">DOCUMENTAÇÃO</p>
              <h2 className="font-bold">Documentos Gerados</h2>
            </div>
            <div className="divide-y">
              {documents.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-[#FF6A13]" />
                    <div>
                      <p className="text-sm font-semibold">{item.nome}</p>
                      <p className="text-xs text-[#8A8A8A]">{item.versao || 'Sem versão'}</p>
                    </div>
                  </div>
                  <CrmBadge tone="gray">{item.status}</CrmBadge>
                </div>
              ))}
              {!documents.length && (
                <p className="p-8 text-center text-sm text-[#8A8A8A]">Nenhum documento gerado.</p>
              )}
            </div>
          </section>

          {/* Assistente IA Integrado ao Projeto */}
          <section className="crm-card overflow-hidden">
            <div className="border-b p-5 bg-gradient-to-r from-orange-50/50 via-white to-transparent flex items-center justify-between">
              <div>
                <p className="technical-label flex items-center gap-1.5 text-[#D65100]">
                  <Sparkles className="h-3.5 w-3.5 text-[#FF6A13]" />
                  ASSISTENTE GENERATIVO AEROCAD
                </p>
                <h2 className="font-bold text-[#333]">Redação & Adaptação Técnica sob Demanda</h2>
              </div>
              <span className="text-xs font-mono bg-white px-2.5 py-1 rounded-md border border-orange-200 text-[#D65100]">
                {project.numero}
              </span>
            </div>
            <div className="p-4 bg-orange-50/20">
              <AssistenteIAPanel
                contextRecord={{
                  tipo: 'projeto',
                  id: project.id,
                  titulo: `${project.numero} — ${project.nome}`,
                  subtitulo: project.expand?.cliente?.razao_social,
                  dados: {
                    id: project.id,
                    numero: project.numero,
                    nome: project.nome,
                    trilha: project.trilha,
                    fase: project.fase,
                    status: project.status,
                    art: project.art,
                    prazo: project.prazo,
                    cliente: project.cliente,
                    razao_social: project.expand?.cliente?.razao_social,
                  },
                }}
                quickPrompts={[
                  `Gere a minuta completa do Memorial Descritivo para o projeto ${project.numero} (${project.nome}).`,
                  `Redija a Proposta Comercial (PC) vinculada a este projeto com as 2 opções de contratação.`,
                  `Reescreva a seção de prazos destacando o prazo AEROCAD segregado do prazo discricionário dos órgãos.`,
                  `Elabore a Ordem de Serviço (OS) interna para este projeto com entregáveis e responsável técnico.`,
                ]}
                onDocumentCreated={() => void load()}
              />
            </div>
          </section>

          {/* Seção de Ordens de Serviço / Prestadores Terceirizados */}
          <section className="crm-card overflow-hidden">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <p className="technical-label">EXECUÇÃO EXTERNA / TERCEIRIZADA</p>
                <h2 className="font-bold flex items-center gap-2">
                  Ordens de Serviço de Terceiros ({ordens.length})
                </h2>
              </div>
              {canManageOS && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingOs(null)
                    setOsOpen(true)
                  }}
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Designar Terceiro
                </Button>
              )}
            </div>
            <div className="divide-y">
              {ordens.map((item) => {
                const statusCfg = osStatusColors[item.status] || {
                  bg: 'bg-neutral-100',
                  text: 'text-neutral-700',
                  border: 'border-neutral-200',
                }
                const prestadorDisplay =
                  item.expand?.prestador_usuario?.name || item.prestador || 'Sem prestador'

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center hover:bg-[#FFF6EC]/50 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#333]">
                          {item.titulo || item.descricao.slice(0, 50)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          {osStatusLabels[item.status] || item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#666]">
                        Prestador: <strong className="text-[#333]">{prestadorDisplay}</strong>
                        {item.prazo && ` · Prazo: ${formatDate(item.prazo)}`}
                        {item.data_conclusao && ` · Conclusão: ${formatDate(item.data_conclusao)}`}
                      </p>
                      {item.descricao && (
                        <p className="mt-1 line-clamp-2 text-xs text-[#777] italic">
                          {item.descricao}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {isAdmin &&
                        item.valor_interno !== undefined &&
                        item.valor_interno !== null && (
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                              Custo Interno
                            </p>
                            <p className="font-mono text-xs font-bold text-amber-900">
                              {formatCurrency(item.valor_interno)}
                            </p>
                          </div>
                        )}

                      {canManageOS && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingOs(item)
                            setOsOpen(true)
                          }}
                        >
                          Editar
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
              {!ordens.length && (
                <p className="p-8 text-center text-sm text-[#8A8A8A]">
                  Nenhuma ordem de serviço designada para prestadores terceirizados neste projeto.
                </p>
              )}
            </div>
          </section>

          {/* Seção de Arquivos e Anexos Vinculados ao Projeto */}
          <section className="crm-card overflow-hidden">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <p className="technical-label">ARQUIVOS E ANEXOS</p>
                <h2 className="font-bold flex items-center gap-2">
                  Anexos do Projeto ({anexos.length})
                </h2>
              </div>
              <Button
                size="sm"
                onClick={() => setAnexoOpen(true)}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
              >
                <FileUp className="mr-2 h-4 w-4" />
                Anexar Arquivo
              </Button>
            </div>
            <div className="p-5">
              <AnexosList
                anexos={anexos}
                compact={true}
                onReload={() => void load()}
                onOpenUpload={() => setAnexoOpen(true)}
                emptyMessage="Nenhum arquivo ou projeto (DWG/DXF/PDF/XLSX) anexado a este projeto."
              />
            </div>
          </section>
          <section className="crm-card p-5">
            <p className="technical-label">LINKS EXTERNOS</p>
            <h2 className="font-bold">Acessos manuais</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {project.pasta_drive_url ? (
                <>
                  <Button asChild variant="outline">
                    <a href={project.pasta_drive_url} target="_blank" rel="noreferrer">
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Abrir Drive
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(project.pasta_drive_url)
                      toast.success('Copiado!')
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar link
                  </Button>
                </>
              ) : (
                <p className="text-sm text-[#8A8A8A]">Nenhuma pasta do Drive cadastrada.</p>
              )}
            </div>
          </section>
        </div>
        <aside className="space-y-5">
          {userCanViewFinancials && userCanViewNfse && (
            <section className="crm-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="technical-label">FINANCEIRO & FATURAMENTO</p>
                  <h2 className="font-bold">Resumo do projeto</h2>
                </div>
                <div className="flex items-center gap-1.5">
                  {canEditProject && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditProjetoInitialTab('financeiro')
                        setEditProjetoModalOpen(true)
                      }}
                      className="h-7 px-2 text-xs text-[#FF6A13] hover:bg-orange-50"
                      title="Editar valor global e faturamento"
                    >
                      <Edit3 className="mr-1 h-3.5 w-3.5" />
                      Editar valor
                    </Button>
                  )}
                  <WalletCards className="h-5 w-5 text-[#FF6A13]" />
                </div>
              </div>

              {/* Bloco de Confronto: Contratado × Faturado em Notas × Saldo */}
              <div className="mt-4 rounded-xl border border-neutral-200 bg-[#FAFAFA] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#666]">Status do faturamento</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${badgeFinanceiro.badgeClass}`}
                  >
                    {badgeFinanceiro.label}
                  </span>
                </div>

                {/* Barra de progresso de faturamento */}
                <div>
                  <div className="flex justify-between text-xs text-[#737373] mb-1">
                    <span>Progresso do faturamento</span>
                    <span className="mono-value font-bold text-[#FF6A13]">
                      {resumoFinanceiro.percentualFaturado}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-[#E5E5E5]">
                    <div
                      className={`h-full transition-all duration-300 ${
                        resumoFinanceiro.statusFinanceiro === 'faturamento_integral'
                          ? 'bg-emerald-600'
                          : resumoFinanceiro.totalFaturadoNfse > 0
                            ? 'bg-[#FF6A13]'
                            : 'bg-neutral-300'
                      }`}
                      style={{ width: `${Math.min(100, resumoFinanceiro.percentualFaturado)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-500">
                      Valor Contratado
                    </p>
                    <p className="mono-value font-bold text-sm text-[#333]">
                      {formatCurrency(resumoFinanceiro.valorGlobalContratado)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-500">
                      Faturado em NFS-e
                    </p>
                    <p className="mono-value font-bold text-sm text-[#FF6A13]">
                      {formatCurrency(resumoFinanceiro.totalFaturadoNfse)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-500">
                      Saldo a Faturar
                    </p>
                    <p
                      className={`mono-value font-bold text-xs ${
                        resumoFinanceiro.saldoAFaturar > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatCurrency(resumoFinanceiro.saldoAFaturar)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-500">
                      Total Recebido
                    </p>
                    <p className="mono-value font-bold text-xs text-emerald-700">
                      {formatCurrency(paid)}
                    </p>
                  </div>
                </div>

                {resumoFinanceiro.numerosNotas.length > 0 && (
                  <div className="pt-2 border-t text-[11px] text-[#666]">
                    <span className="font-medium">
                      NFS-e emitidas ({resumoFinanceiro.numerosNotas.length}):
                    </span>{' '}
                    <span className="font-mono text-neutral-800">
                      {resumoFinanceiro.numerosNotas.map((n) => `nº ${n}`).join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Lista de Faturamentos / NFS-e vinculadas com Descrição */}
              <div className="mt-4 pt-3 border-t text-xs">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Notas NFS-e & Parcelas ({installments.length})
                  </p>
                  {canAnexarNfse && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVincularNfseOpen(true)}
                      className="h-6 text-[11px] border-orange-300 text-[#D65100] hover:bg-orange-50 px-2 font-medium"
                      title="Anexar XML de NFS-e ou vincular nota existente"
                    >
                      <Plus className="mr-1 h-3 w-3 text-[#FF6A13]" />
                      Anexar NFS-e
                    </Button>
                  )}
                </div>

                {installments.length > 0 ? (
                  <div className="divide-y max-h-64 overflow-y-auto">
                    {installments.map((inst) => (
                      <div
                        key={inst.id}
                        className="py-2 flex items-center justify-between group hover:bg-neutral-50/70 px-1 rounded transition"
                      >
                        <div className="min-w-0 pr-2 space-y-0.5">
                          <p className="font-semibold text-[#333] truncate">{inst.descricao}</p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            {inst.nf_numero ? (
                              <span className="font-mono text-[10px] text-[#FF6A13] font-bold bg-orange-50 px-1.5 py-0.2 rounded border border-orange-200">
                                NFS-e nº {inst.nf_numero}
                              </span>
                            ) : (
                              <span className="text-[#8A8A8A]">Sem NFS-e vinculada</span>
                            )}
                            <span className="text-neutral-500">· {inst.status}</span>
                            {inst.data_faturamento && (
                              <span className="text-neutral-400">
                                · Fat: {formatDate(inst.data_faturamento)}
                              </span>
                            )}
                            <span className="text-neutral-400">
                              · Venc: {formatDate(inst.vencimento)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className="mono-value font-bold text-[11px] text-[#1F1F1F]">
                              {formatCurrency(inst.valor)}
                            </span>
                            <div className="flex items-center justify-end gap-1">
                              {canEditVencimento ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setParcelaParaEditarVencimento(inst)
                                    setEditarVencimentoOpen(true)
                                  }}
                                  className="inline-flex items-center gap-1 font-mono text-[10px] text-neutral-600 hover:text-[#D65100] hover:underline transition"
                                  title="Editar data de vencimento da parcela"
                                >
                                  <Calendar className="h-2.5 w-2.5 text-neutral-400 group-hover:text-[#FF6A13]" />
                                  <span>{formatDate(inst.vencimento)}</span>
                                  <Edit3 className="h-2.5 w-2.5 text-neutral-400 opacity-60 group-hover:opacity-100" />
                                </button>
                              ) : (
                                <span className="font-mono text-[10px] text-neutral-500">
                                  Venc: {formatDate(inst.vencimento)}
                                </span>
                              )}
                            </div>
                            {inst.status === 'paga' && (
                              <p className="text-[10px] text-emerald-600 font-semibold">Quitada</p>
                            )}
                          </div>
                          {canEditVencimento && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setParcelaParaEditarVencimento(inst)
                                setEditarVencimentoOpen(true)
                              }}
                              className="h-7 w-7 p-0 text-neutral-400 hover:text-[#D65100] hover:bg-orange-50 opacity-80 group-hover:opacity-100 transition"
                              title="Editar data de vencimento da fatura/parcela"
                              aria-label={`Editar vencimento da parcela ${inst.descricao}`}
                            >
                              <Calendar className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canExcluirNfse && inst.nf_numero && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setNotasParaExcluir([
                                  {
                                    tipo: 'parcela',
                                    id: inst.id,
                                    numero: inst.nf_numero || '',
                                    valor: inst.valor_recebido || inst.valor,
                                    dataEmissao: inst.data_faturamento || inst.vencimento,
                                    descricao: inst.descricao,
                                    projetoId: project.id,
                                    projetoNumero: project.numero,
                                    clienteId: project.cliente,
                                    clienteNome: project.expand?.cliente?.razao_social,
                                    statusParcela: inst.status,
                                    isGatilho: inst.origem === 'gatilho',
                                  },
                                ])
                                setExcluirNotaOpen(true)
                              }}
                              className="h-7 w-7 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 opacity-70 group-hover:opacity-100 transition"
                              title={`Excluir NFS-e nº ${inst.nf_numero}`}
                              aria-label={`Excluir NFS-e nº ${inst.nf_numero}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-3 text-center text-[11px] text-[#8A8A8A]">
                    Nenhum faturamento ou parcela vinculada ao projeto.
                  </p>
                )}
              </div>

              <Button asChild variant="outline" className="mt-4 w-full">
                <Link to={`/financeiro?projeto=${project.id}`}>Ver parcelas no Financeiro</Link>
              </Button>
            </section>
          )}
          <section className="crm-card p-5">
            <p className="technical-label">ATIVIDADES</p>
            <h2 className="font-bold">Timeline</h2>
            <div className="mt-4 max-h-72 space-y-4 overflow-y-auto">
              {activities.map((item) => (
                <div key={item.id} className="border-l-2 border-[#FFD2B3] pl-3">
                  <p className="text-xs leading-relaxed">{item.texto}</p>
                  <p className="mt-1 text-[10px] text-[#9A9A9A]">{formatDate(item.created)}</p>
                </div>
              ))}
            </div>
            <Textarea
              className="mt-4"
              placeholder="Adicionar nota à timeline"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button onClick={addNote} disabled={!note.trim()} className="mt-2 w-full">
              <Send className="mr-2 h-4 w-4" />
              Adicionar nota
            </Button>
          </section>
        </aside>
      </div>
      <ProcessDialog
        open={processOpen}
        onOpenChange={setProcessOpen}
        presetProject={project.id}
        onSaved={(record) => navigate(`/processos/${record.id}`)}
      />
      <AnexoDialog
        open={anexoOpen}
        onOpenChange={setAnexoOpen}
        presetProjeto={project.id}
        presetCliente={project.cliente}
        onSuccess={() => void load()}
      />
      <OrdemServicoDialog
        open={osOpen}
        onOpenChange={setOsOpen}
        presetProjetoId={project.id}
        presetProjetoNumero={project.numero}
        presetProjetoNome={project.nome}
        editingOS={editingOs}
        onSuccess={() => void load()}
      />

      {/* Rodapé administrativo discreto para exclusão do projeto */}
      {isAdmin && (
        <div className="mt-12 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <div>
            <span className="font-semibold text-neutral-700">Zona Administrativa:</span> Exclusão
            permanente e em cascata do projeto {project.numero}. Ação restrita a administradores.
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExcluirModalOpen(true)}
            className="text-neutral-500 hover:text-rose-700 hover:bg-rose-50"
          >
            Excluir projeto...
          </Button>
        </div>
      )}

      {/* Modal de Edição Completa do Projeto (Valores, Prazos, Status, Prioridade, Auditoria) */}
      <EditarProjetoModal
        open={editProjetoModalOpen}
        onOpenChange={setEditProjetoModalOpen}
        projeto={project}
        initialTab={editProjetoInitialTab}
        onSuccess={(atualizado) => {
          setProject((prev) => (prev ? { ...prev, ...atualizado } : atualizado))
          // Recarregar dados completos do projeto e a timeline de atividades
          void load()
        }}
      />

      {/* Modal de Edição Rápida de Nome do Projeto */}
      <EditarNomeProjetoModal
        open={editNomeOpen}
        onOpenChange={setEditNomeOpen}
        projeto={project}
        onSuccess={(atualizado) => {
          setProject((prev) => (prev ? { ...prev, nome: atualizado.nome } : atualizado))
          void load()
        }}
      />

      {/* Modal de Exclusão do Projeto */}
      <ExcluirProjetoModal
        open={excluirModalOpen}
        onOpenChange={setExcluirModalOpen}
        projeto={project}
      />

      {/* Modal de Arquivar / Desarquivar Projeto */}
      <ArquivarProjetoModal
        open={arquivarModalOpen}
        onOpenChange={setArquivarModalOpen}
        projeto={project}
        onSuccess={(atualizado) => {
          setProject((prev) => (prev ? { ...prev, ...atualizado } : atualizado))
          void load()
        }}
      />

      {/* Modal de Anexar / Vincular Notas NFS-e com Descrição */}
      <VincularNfseProjetoModal
        open={vincularNfseOpen}
        onOpenChange={setVincularNfseOpen}
        projeto={project}
        parcelasExistentes={installments}
        onSuccess={() => void load()}
      />

      {/* Modal de Excluir NFS-e com Auditoria Fiscal */}
      <ConfirmarExcluirNotaModal
        open={excluirNotaOpen}
        onOpenChange={setExcluirNotaOpen}
        notas={notasParaExcluir}
        onSuccess={() => void load()}
      />

      {/* Modal de Edição da Data de Vencimento da Parcela / Fatura */}
      <EditarVencimentoParcelaModal
        open={editarVencimentoOpen}
        onOpenChange={setEditarVencimentoOpen}
        parcela={parcelaParaEditarVencimento}
        projetoId={project.id}
        projetoNumero={project.numero}
        clienteId={project.cliente}
        onSuccess={() => void load()}
      />
    </div>
  )
}
