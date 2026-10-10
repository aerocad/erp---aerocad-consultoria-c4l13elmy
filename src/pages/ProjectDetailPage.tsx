import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  ExternalLink,
  FileText,
  FileUp,
  FolderOpen,
  Paperclip,
  Plus,
  Send,
  WalletCards,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { AnexosList } from '@/components/common/AnexosList'
import { AssistenteIAPanel } from '@/components/common/AssistenteIAPanel'
import { CrmBadge } from '@/components/common/CrmBadge'
import { ErrorState, PageLoading } from '@/components/common/States'
import { AnexoDialog } from '@/components/forms/AnexoDialog'
import { ProcessDialog } from '@/components/forms/ProcessDialog'
import { Button } from '@/components/ui/button'
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
import { trailLabels, trailPhases } from '@/lib/crm'
import { formatCurrency, formatDate } from '@/lib/format'
import { createOne, getOne, listAll, updateOne } from '@/services/api'
import type {
  AnexoRecord,
  AtividadeRecord,
  DocumentoRecord,
  ParcelaRecord,
  ProcessoRecord,
  ProjetoRecord,
} from '@/types/crm'

export default function ProjectDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [project, setProject] = useState<ProjetoRecord | null>(null)
  const [processes, setProcesses] = useState<ProcessoRecord[]>([])
  const [installments, setInstallments] = useState<ParcelaRecord[]>([])
  const [documents, setDocuments] = useState<DocumentoRecord[]>([])
  const [anexos, setAnexos] = useState<AnexoRecord[]>([])
  const [activities, setActivities] = useState<AtividadeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [processOpen, setProcessOpen] = useState(false)
  const [anexoOpen, setAnexoOpen] = useState(false)
  const [note, setNote] = useState('')
  const canWrite = ['admin', 'comercial', 'tecnico'].includes(user?.role || '')
  const load = async () => {
    setLoading(true)
    try {
      const record = await getOne<ProjetoRecord>('projetos', id, {
        expand: 'cliente,responsavel_tecnico,oportunidade',
      })
      setProject(record)
      const [pr, pa, d, an, a] = await Promise.all([
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
      ])
      setProcesses(pr)
      setInstallments(pa)
      setDocuments(d)
      setAnexos(an)
      setActivities(a)
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
  const days = project.prazo
    ? Math.ceil((new Date(project.prazo).getTime() - Date.now()) / 86400000)
    : null
  return (
    <div>
      <Button variant="ghost" onClick={() => navigate('/projetos')} className="mb-4 -ml-3">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar aos projetos
      </Button>
      <header className="crm-card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono-value text-xl font-black text-[#D65100]">{project.numero}</span>
              <CrmBadge tone={project.trilha === 'registro' ? 'green' : 'orange'}>
                {trailLabels[project.trilha]}
              </CrmBadge>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-[#424242]">{project.nome}</h1>
            <Link
              to={`/clientes/${project.cliente}`}
              className="mt-1 inline-block text-sm text-[#737373] hover:text-[#E85B06]"
            >
              {project.expand?.cliente?.razao_social}
            </Link>
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
      </header>
      <section className="crm-card mt-5 overflow-hidden">
        <div className="border-b p-5">
          <p className="technical-label">TRILHA DE EXECUÇÃO</p>
          <h2 className="font-bold">{trailLabels[project.trilha]}</h2>
        </div>
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
          <section className="crm-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="technical-label">FINANCEIRO</p>
                <h2 className="font-bold">Resumo do projeto</h2>
              </div>
              <WalletCards className="h-5 w-5 text-[#FF6A13]" />
            </div>
            <p className="mono-value mt-5 text-2xl font-bold">{formatCurrency(financialTotal)}</p>
            <p className="text-xs text-[#8A8A8A]">{formatCurrency(paid)} recebido</p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to={`/financeiro?projeto=${project.id}`}>Ver parcelas</Link>
            </Button>
          </section>
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
    </div>
  )
}
