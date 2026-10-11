import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BriefcaseBusiness,
  Copy,
  ExternalLink,
  FileText,
  FileUp,
  Mail,
  MapPin,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { AnexosList } from '@/components/common/AnexosList'
import { AssistenteIAPanel } from '@/components/common/AssistenteIAPanel'
import { CrmBadge } from '@/components/common/CrmBadge'
import { ErrorState, PageLoading } from '@/components/common/States'
import { AnexoDialog } from '@/components/forms/AnexoDialog'
import { ClienteDialog } from '@/components/forms/ClienteDialog'
import { OportunidadeDialog } from '@/components/forms/OportunidadeDialog'
import { ProjetoDialog } from '@/components/forms/ProjetoDialog'
import { ExcluirClienteModal } from '@/components/clientes/ExcluirClienteModal'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { formatCurrency, formatDate, initials, relativeTime } from '@/lib/format'
import { getOne, listAll } from '@/services/api'
import type {
  AnexoRecord,
  AtividadeRecord,
  ClienteRecord,
  ContratoRecord,
  DocumentoRecord,
  OportunidadeRecord,
  ParcelaRecord,
  ProcessoRecord,
  ProjetoRecord,
  PropostaRecord,
} from '@/types/crm'

export default function ClientDetailPage() {
  const { ocultarValores } = useFinanceiroVisibilidade()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [client, setClient] = useState<ClienteRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [projects, setProjects] = useState<ProjetoRecord[]>([])
  const [opportunities, setOpportunities] = useState<OportunidadeRecord[]>([])
  const [processes, setProcesses] = useState<ProcessoRecord[]>([])
  const [installments, setInstallments] = useState<ParcelaRecord[]>([])
  const [documents, setDocuments] = useState<DocumentoRecord[]>([])
  const [anexos, setAnexos] = useState<AnexoRecord[]>([])
  const [activities, setActivities] = useState<AtividadeRecord[]>([])
  const [proposals, setProposals] = useState<PropostaRecord[]>([])
  const [contracts, setContracts] = useState<ContratoRecord[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [opportunityOpen, setOpportunityOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [anexoOpen, setAnexoOpen] = useState(false)
  const [excluirModalOpen, setExcluirModalOpen] = useState(false)
  const canWrite = user?.role === 'admin' || user?.role === 'comercial'
  const isAdmin = user?.role === 'admin'
  const load = async () => {
    setLoading(true)
    try {
      const record = await getOne<ClienteRecord>('clientes', id)
      setClient(record)
      const [p, o, pr, pa, d, an, a, prop, c] = await Promise.all([
        listAll<ProjetoRecord>('projetos', {
          filter: `cliente = '${id}'`,
          expand: 'responsavel_tecnico',
          sort: '-created',
        }),
        listAll<OportunidadeRecord>('oportunidades', {
          filter: `cliente = '${id}'`,
          sort: '-created',
        }),
        listAll<ProcessoRecord>('processos', {
          filter: `projeto.cliente = '${id}'`,
          expand: 'projeto',
          sort: '-created',
        }),
        listAll<ParcelaRecord>('parcelas', {
          filter: `cliente = '${id}'`,
          expand: 'projeto',
          sort: 'vencimento',
        }).catch(() => []),
        listAll<DocumentoRecord>('documentos', { filter: `cliente = '${id}'`, sort: '-created' }),
        listAll<AnexoRecord>('anexos', {
          filter: `cliente = '${id}'`,
          expand: 'projeto,usuario',
          sort: '-created',
        }).catch(() => []),
        listAll<AtividadeRecord>('atividades', {
          filter: `cliente = '${id}'`,
          expand: 'usuario',
          sort: '-created',
        }),
        listAll<PropostaRecord>('propostas', {
          filter: `oportunidade.cliente = '${id}'`,
          sort: '-created',
        }),
        listAll<ContratoRecord>('contratos', { filter: `cliente = '${id}'`, sort: '-created' }),
      ])
      setProjects(p)
      setOpportunities(o)
      setProcesses(pr)
      setInstallments(pa)
      setDocuments(d)
      setAnexos(an)
      setActivities(a)
      setProposals(prop)
      setContracts(c)
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
  const financial = useMemo(
    () => ({
      total: installments.reduce((s, i) => s + i.valor, 0),
      paid: installments
        .filter((i) => i.status === 'paga')
        .reduce((s, i) => s + (i.valor_recebido || i.valor), 0),
    }),
    [installments, ocultarValores],
  )
  if (loading) return <PageLoading />
  if (failed || !client) return <ErrorState onRetry={() => void load()} />

  return (
    <div>
      <Button
        variant="ghost"
        onClick={() => navigate('/clientes')}
        className="mb-4 -ml-3 text-[#737373]"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar aos clientes
      </Button>
      <header className="crm-card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row">
          <div className="flex gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-[#FFF0E5] font-bold text-[#D65100]">
                {initials(client.razao_social)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-[#424242]">{client.razao_social}</h1>
                <CrmBadge tone={client.status === 'cliente' ? 'green' : 'orange'}>
                  {client.status}
                </CrmBadge>
                {client.recorrente && <CrmBadge tone="blue">Recorrente</CrmBadge>}
              </div>
              <p className="mono-value mt-1 text-sm text-[#737373]">
                {client.cnpj_cpf || 'Documento não informado'}
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">{client.segmento}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)} disabled={!canWrite}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button variant="outline" onClick={() => setOpportunityOpen(true)} disabled={!canWrite}>
              <Plus className="mr-2 h-4 w-4" />
              Oportunidade
            </Button>
            <Button
              variant="outline"
              onClick={() => setAnexoOpen(true)}
              className="border-[#FF6A13] text-[#FF6A13] hover:bg-orange-50"
            >
              <FileUp className="mr-2 h-4 w-4" />
              Anexar Arquivo
            </Button>
            <Button
              onClick={() => setProjectOpen(true)}
              disabled={!canWrite && user?.role !== 'tecnico'}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Projeto
            </Button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 border-t pt-5 sm:grid-cols-3">
          <p className="flex items-start gap-2 text-sm">
            <Mail className="mt-0.5 h-4 w-4 text-[#FF6A13]" />
            {client.email || 'E-mail não informado'}
          </p>
          <p className="flex items-start gap-2 text-sm">
            <Phone className="mt-0.5 h-4 w-4 text-[#FF6A13]" />
            {client.telefone || 'Telefone não informado'}
          </p>
          <p className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 text-[#FF6A13]" />
            {client.endereco || `${client.municipio} / ${client.uf}`}
          </p>
        </div>
      </header>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="crm-card p-4">
          <p className="technical-label">OPORTUNIDADES</p>
          <p className="mono-value mt-2 text-2xl font-bold">{opportunities.length}</p>
          <p className="text-xs text-[#8A8A8A]">
            {opportunities.filter((i) => i.etapa === 'ganho').length} ganhas ·{' '}
            {opportunities.filter((i) => i.etapa === 'perdido').length} perdidas
          </p>
        </div>
        <div className="crm-card p-4">
          <p className="technical-label">PROJETOS</p>
          <p className="mono-value mt-2 text-2xl font-bold">{projects.length}</p>
          <p className="text-xs text-[#8A8A8A]">
            {projects.filter((i) => i.status === 'ativo').length} em execução
          </p>
        </div>
        <div className="crm-card p-4">
          <p className="technical-label">CARTEIRA FINANCEIRA</p>
          <p className="mono-value mt-2 text-2xl font-bold">{formatCurrency(financial.total)}</p>
          <p className="text-xs text-[#8A8A8A]">{formatCurrency(financial.paid)} recebido</p>
        </div>
      </div>
      <Tabs defaultValue="projetos" className="mt-6">
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-white p-1">
          <TabsTrigger value="projetos">Projetos ({projects.length})</TabsTrigger>
          <TabsTrigger value="oportunidades">Oportunidades ({opportunities.length})</TabsTrigger>
          <TabsTrigger value="propostas">Propostas ({proposals.length})</TabsTrigger>
          <TabsTrigger value="contratos">Contratos ({contracts.length})</TabsTrigger>
          <TabsTrigger value="processos">Processos ({processes.length})</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger
            value="anexos"
            className="flex items-center gap-1.5 font-semibold text-[#FF6A13]"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Anexos ({anexos.length})
          </TabsTrigger>
          <TabsTrigger value="documentos">Documentos ({documents.length})</TabsTrigger>
          <TabsTrigger value="assistente" className="flex items-center gap-1 text-[#D65100]">
            <Sparkles className="h-3.5 w-3.5 text-[#FF6A13]" />
            Assistente IA
          </TabsTrigger>
          <TabsTrigger value="links">Links externos</TabsTrigger>
        </TabsList>
        <TabsContent value="projetos">
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((item) => (
              <Link key={item.id} to={`/projetos/${item.id}`} className="crm-card p-4">
                <div className="flex items-center justify-between">
                  <span className="mono-value font-bold text-[#D65100]">{item.numero}</span>
                  <CrmBadge tone="gray">{item.trilha.toUpperCase()}</CrmBadge>
                </div>
                <p className="mt-2 font-semibold">{item.nome}</p>
                <p className="mt-1 text-xs text-[#737373]">{item.fase}</p>
              </Link>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="oportunidades">
          <List
            items={opportunities.map((i) => ({
              id: i.id,
              title: i.titulo,
              meta: formatCurrency(i.valor_estimado),
              badge: i.etapa,
            }))}
          />
        </TabsContent>
        <TabsContent value="propostas">
          <List
            items={proposals.map((i) => ({
              id: i.id,
              title: i.numero || 'Proposta em rascunho',
              meta: `${i.revisao} · ${formatCurrency(i.valor_total)}`,
              badge: i.status,
            }))}
          />
        </TabsContent>
        <TabsContent value="contratos">
          <List
            items={contracts.map((i) => ({
              id: i.id,
              title: i.numero,
              meta: formatCurrency(i.valor_global),
              badge: formatDate(i.data_assinatura),
            }))}
          />
        </TabsContent>
        <TabsContent value="processos">
          <List
            items={processes.map((i) => ({
              id: i.id,
              title: i.numero_protocolo || 'Sem protocolo',
              meta: i.orgao,
              badge: i.status,
              path: `/processos/${i.id}`,
            }))}
          />
        </TabsContent>
        <TabsContent value="financeiro">
          <div className="crm-card p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Total" value={financial.total} />
              <Metric label="Recebido" value={financial.paid} />
              <Metric label="Em aberto" value={financial.total - financial.paid} />
            </div>
            <Progress
              className="mt-5"
              value={financial.total ? (financial.paid / financial.total) * 100 : 0}
            />

            <div className="pt-4 border-t">
              <h4 className="text-xs font-bold technical-label text-[#737373] mb-3">
                PARCELAS & NOTAS FISCAIS (NFS-E)
              </h4>
              <List
                items={installments.map((i) => ({
                  id: i.id,
                  title: `${i.descricao}${i.nf_numero ? ` · NFS-e nº ${i.nf_numero}` : ''}`,
                  meta: `${formatCurrency(i.valor)} · Venc: ${formatDate(i.vencimento)}${i.data_pagamento ? ` · Rec: ${formatDate(i.data_pagamento)}` : ''}`,
                  badge: i.status,
                }))}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="anexos">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#333]">
                  Arquivos e Anexos Vinculados ({anexos.length})
                </h3>
                <p className="text-xs text-[#777]">
                  Documentos, orçamentos, projetos DWG/DXF e planilhas vinculados a este cliente.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setAnexoOpen(true)}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
              >
                <FileUp className="mr-2 h-4 w-4" />
                Novo Anexo
              </Button>
            </div>
            <AnexosList
              anexos={anexos}
              onReload={() => void load()}
              onOpenUpload={() => setAnexoOpen(true)}
              emptyMessage="Nenhum arquivo ou documento anexado a este cliente."
            />
          </div>
        </TabsContent>
        <TabsContent value="documentos">
          <List
            items={documents.map((i) => ({
              id: i.id,
              title: i.nome,
              meta: i.versao,
              badge: i.status,
            }))}
          />
        </TabsContent>
        <TabsContent value="assistente" className="space-y-4">
          <div className="crm-card p-4 bg-orange-50/30 border-l-4 border-l-[#FF6A13]">
            <p className="technical-label flex items-center gap-1.5 text-[#D65100]">
              <Sparkles className="h-3.5 w-3.5 text-[#FF6A13]" />
              ASSISTENTE IA — {client.razao_social}
            </p>
            <p className="text-xs text-[#666] mt-1">
              Redija propostas comerciais, técnicas ou cartas de apresentação para{' '}
              {client.razao_social} com o perfil e dados cadastrais.
            </p>
          </div>
          <AssistenteIAPanel
            contextRecord={{
              tipo: 'cliente',
              id: client.id,
              titulo: client.razao_social,
              subtitulo: `${client.municipio || ''}/${client.uf || ''} · ${client.cnpj_cpf}`,
              dados: {
                id: client.id,
                razao_social: client.razao_social,
                cnpj_cpf: client.cnpj_cpf,
                segmento: client.segmento,
                municipio: client.municipio,
                uf: client.uf,
                projetos_count: projects.length,
                oportunidades_count: opportunities.length,
              },
            }}
            quickPrompts={[
              `Gere um E-mail formal de Apresentação de Proposta (EML) para ${client.razao_social}.`,
              `Elabore a Proposta Comercial (PC) inicial considerando o segmento ${client.segmento || 'aeronáutico'}.`,
              `Redija uma minuta de Procuração (PR) outorgando poderes à Dra. Jaqueline Mota para representar ${client.razao_social}.`,
              `Gere um Relatório de Status e Alinhamento Técnico dos projetos em andamento deste cliente.`,
            ]}
            onDocumentCreated={() => void load()}
          />
        </TabsContent>
        <TabsContent value="links">
          <div className="crm-card p-5">
            <h3 className="font-bold">Links manuais</h3>
            <p className="mt-1 text-sm text-[#737373]">
              Drive, e-mails e assinatura são registrados nos projetos, processos e documentos.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(client.email || '')
                  toast.success('Copiado!')
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar e-mail
              </Button>
              {client.email && (
                <Button asChild variant="outline">
                  <a href={`mailto:${client.email}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir e-mail
                  </a>
                </Button>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <section className="crm-card mt-6 overflow-hidden">
        <div className="border-b p-5">
          <h2 className="font-bold">Timeline do cliente</h2>
        </div>
        <div className="divide-y">
          {activities.map((item) => (
            <div key={item.id} className="flex gap-3 p-4">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-[10px]">
                  {initials(item.expand?.usuario?.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm">{item.texto}</p>
                <p className="mt-1 text-[11px] text-[#8A8A8A]">{relativeTime(item.created)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <ClienteDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        cliente={client}
        onSaved={(record) => setClient(record)}
      />
      <OportunidadeDialog
        open={opportunityOpen}
        onOpenChange={setOpportunityOpen}
        presetClient={id}
        onSaved={() => void load()}
      />
      <ProjetoDialog
        open={projectOpen}
        onOpenChange={setProjectOpen}
        presetClient={id}
        onSaved={(record) => navigate(`/projetos/${record.id}`)}
      />
      <AnexoDialog
        open={anexoOpen}
        onOpenChange={setAnexoOpen}
        presetCliente={id}
        onSuccess={() => void load()}
      />

      {/* Rodapé administrativo discreto para exclusão do cliente */}
      {isAdmin && (
        <div className="mt-12 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <div>
            <span className="font-semibold text-neutral-700">Zona Administrativa:</span> Exclusão
            permanente da ficha cadastral de {client.razao_social}. Ação restrita a administradores.
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExcluirModalOpen(true)}
            className="text-neutral-500 hover:text-rose-700 hover:bg-rose-50"
          >
            Excluir cliente...
          </Button>
        </div>
      )}

      {/* Modal de Exclusão do Cliente */}
      <ExcluirClienteModal
        open={excluirModalOpen}
        onOpenChange={setExcluirModalOpen}
        cliente={client}
      />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="technical-label">{label}</p>
      <p className="mono-value mt-1 text-xl font-bold">{formatCurrency(value)}</p>
    </div>
  )
}
function List({
  items,
}: {
  items: Array<{ id: string; title: string; meta?: string; badge?: string; path?: string }>
}) {
  if (!items.length)
    return (
      <div className="crm-card p-8 text-center text-sm text-[#8A8A8A]">
        Nenhum registro nesta seção.
      </div>
    )
  return (
    <div className="crm-card divide-y overflow-hidden">
      {items.map((item) => {
        const content = (
          <>
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="mono-value mt-1 text-xs text-[#737373]">{item.meta || '—'}</p>
            </div>
            <CrmBadge tone="gray">{item.badge || '—'}</CrmBadge>
          </>
        )
        return item.path ? (
          <Link
            key={item.id}
            to={item.path}
            className="flex items-center justify-between p-4 hover:bg-[#FFF6EC]"
          >
            {content}
          </Link>
        ) : (
          <div key={item.id} className="flex items-center justify-between p-4">
            {content}
          </div>
        )
      })}
    </div>
  )
}
