import { useState } from 'react'
import {
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  CreditCard,
  FileCheck,
  FileSignature,
  FileSpreadsheet,
  FileText,
  FileUp,
  Filter,
  Info,
  Link2,
  Mail,
  Paperclip,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { AnexosList } from '@/components/common/AnexosList'
import { AssistenteIAPanel } from '@/components/common/AssistenteIAPanel'
import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States'
import { SectionHeader } from '@/components/common/SectionHeader'
import { AnexoDialog } from '@/components/forms/AnexoDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCrmData } from '@/hooks/use-crm-data'
import { formatDate } from '@/lib/format'
import {
  DOCUMENT_FAMILIES,
  INSTITUTIONAL_DATA,
  PREFIXOS_NOMENCLATURA,
  REGRAS_GLOBAIS_AEROCAD,
  TIPOS_PROJETO_CATALOGO,
  PALETA_AEROCAD_2026,
} from '@/lib/documentCatalogo'
import {
  SERVICOS_SKILL_AEROCAD,
  CLAUSULAS_PADRAO_AEROCAD,
  REGRAS_PDIR_AEROCAD,
  TEXTO_APRESENTACAO_AEROCAD,
} from '@/lib/aerocadKnowledge'
import { ANEXO_CATEGORIAS } from '@/services/anexos'
import type { AnexoRecord, DocumentoRecord } from '@/types/crm'

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<'gerados' | 'assistente' | 'anexos' | 'catalogo'>(
    'gerados',
  )
  const [anexoDialogOpen, setAnexoDialogOpen] = useState(false)

  const records = useCrmData<DocumentoRecord>('documentos', {
    expand: 'projeto,processo,cliente,modelo',
    sort: '-created',
  })

  const anexosData = useCrmData<AnexoRecord>('anexos', {
    expand: 'cliente,projeto,processo,oportunidade,usuario',
    sort: '-created',
  })

  // Filtros documentos gerados
  const [query, setQuery] = useState('')
  const [familyFilter, setFamilyFilter] = useState('todas')
  const [statusFilter, setStatusFilter] = useState('todos')

  // Filtros anexos
  const [anexoQuery, setAnexoQuery] = useState('')
  const [anexoCatFilter, setAnexoCatFilter] = useState('todas')
  const [anexoVinculoFilter, setAnexoVinculoFilter] = useState('todos')

  const rows = records.data.filter((item) => {
    const matchesQuery =
      !query ||
      `${item.nome} ${item.tipo} ${item.expand?.projeto?.numero || ''} ${item.expand?.cliente?.razao_social || ''}`
        .toLowerCase()
        .includes(query.toLowerCase())

    const matchesFamily = familyFilter === 'todas' || item.tipo === familyFilter
    const matchesStatus = statusFilter === 'todos' || item.status === statusFilter

    return matchesQuery && matchesFamily && matchesStatus
  })

  const filteredAnexos = anexosData.data.filter((item) => {
    const q = anexoQuery.toLowerCase()
    const matchesQuery =
      !q ||
      `${item.nome} ${item.descricao || ''} ${item.extensao || ''} ${item.expand?.cliente?.razao_social || ''} ${item.expand?.projeto?.numero || ''} ${item.expand?.processo?.numero_protocolo || ''}`
        .toLowerCase()
        .includes(q)

    const matchesCat = anexoCatFilter === 'todas' || item.categoria === anexoCatFilter

    let matchesVinculo = true
    if (anexoVinculoFilter === 'cliente') matchesVinculo = !!item.cliente
    else if (anexoVinculoFilter === 'projeto') matchesVinculo = !!item.projeto
    else if (anexoVinculoFilter === 'processo') matchesVinculo = !!item.processo
    else if (anexoVinculoFilter === 'oportunidade') matchesVinculo = !!item.oportunidade
    else if (anexoVinculoFilter === 'sem_vinculo')
      matchesVinculo = !item.cliente && !item.projeto && !item.processo && !item.oportunidade

    return matchesQuery && matchesCat && matchesVinculo
  })

  if (records.loading && anexosData.loading) return <PageLoading />
  if (records.error) return <ErrorState onRetry={() => void records.reload()} />

  return (
    <div>
      <SectionHeader
        eyebrow="REPOSITÓRIO TÉCNICO E CONTRATUAL"
        title="Documentos e Anexos AEROCAD"
        description="Geração automatizada de Propostas, Contratos e Peças Técnicas, e gestão de arquivos anexos (orçamentos, planilhas, editais, DWG/DXF)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setAnexoDialogOpen(true)}
              className="border-[#FF6A13] text-[#FF6A13] hover:bg-orange-50"
            >
              <FileUp className="mr-2 h-4 w-4" />
              Anexar Arquivo
            </Button>
            <Button asChild className="bg-[#FF6A13] hover:bg-[#E85B06] text-white">
              <Link to="/documentos/novo">
                <Plus className="mr-2 h-4 w-4" />
                Gerar Novo Documento
              </Link>
            </Button>
          </div>
        }
      />

      {/* Abas: Documentos Gerados vs. Anexos de Arquivos */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'gerados' | 'anexos' | 'catalogo')}
        className="mt-6"
      >
        <TabsList className="bg-white border p-1 rounded-xl mb-6">
          <TabsTrigger value="gerados" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentos Gerados ({records.data.length})
          </TabsTrigger>
          <TabsTrigger value="assistente" className="flex items-center gap-2 text-[#D65100]">
            <Sparkles className="h-4 w-4 text-[#FF6A13]" />
            Assistente IA Generativo
          </TabsTrigger>
          <TabsTrigger value="anexos" className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-[#FF6A13]" />
            Anexos e Arquivos ({anexosData.data.length})
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="flex items-center gap-2 text-[#FF6A13]">
            <BookOpen className="h-4 w-4" />
            Catálogo & Regras Oficiais
          </TabsTrigger>
        </TabsList>

        {/* ABA: ASSISTENTE IA GENERATIVO */}
        <TabsContent value="assistente" className="space-y-4">
          <div className="crm-card p-4 bg-gradient-to-r from-orange-50/50 via-white to-orange-50/30 border-l-4 border-l-[#FF6A13] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p className="technical-label flex items-center gap-1.5 text-[#D65100]">
                <Sparkles className="h-3.5 w-3.5 text-[#FF6A13]" />
                REDAÇÃO & ADAPTAÇÃO INTELIGENTE DE DOCUMENTOS
              </p>
              <h2 className="text-base font-bold text-[#333]">
                Assistente Técnico-Comercial AEROCAD®
              </h2>
              <p className="text-xs text-[#666] mt-0.5">
                Gere memoriais, propostas com 2 opções de contratação, pareceres e notas técnicas a
                partir das normas (ICA 11-408, RBAC 153/154/155/161).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-orange-200 text-[#FF6A13]"
              >
                <Link to="/documentos/novo">Abrir Modelos Prontos</Link>
              </Button>
            </div>
          </div>

          <AssistenteIAPanel
            quickPrompts={[
              'Gere uma minuta completa de Memorial Descritivo para um aeródromo considerando a ICA 11-408.',
              'Adapte a Proposta Comercial (PC) segundo o modelo Bruna Rodrigues com 2 opções de contratação.',
              'Reescreva a cláusula de cronograma e marcos destacando a segregação estrita entre prazos AEROCAD e dos órgãos reguladores.',
              'Elabore uma Nota Técnica fundamentada sobre impacto OPEA em heliponto elevado conforme RBAC 155.',
            ]}
            onDocumentCreated={() => {
              void records.reload()
              void anexosData.reload()
            }}
          />
        </TabsContent>

        {/* ABA 1: DOCUMENTOS GERADOS */}
        <TabsContent value="gerados">
          {/* Barra de estatísticas */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <div className="crm-card p-3 text-center">
              <p className="text-[10px] font-bold text-[#888]">TOTAL GERADOS</p>
              <p className="text-xl font-bold text-[#333]">{records.data.length}</p>
            </div>
            <div className="crm-card p-3 text-center border-l-4 border-l-[#FF6A13]">
              <p className="text-[10px] font-bold text-[#888]">PROPOSTAS (PC/PT)</p>
              <p className="text-xl font-bold text-[#FF6A13]">
                {
                  records.data.filter((d) => d.tipo === 'proposta' || d.tipo === 'proposta_tecnica')
                    .length
                }
              </p>
            </div>
            <div className="crm-card p-3 text-center">
              <p className="text-[10px] font-bold text-[#888]">CONTRATOS</p>
              <p className="text-xl font-bold text-[#333]">
                {records.data.filter((d) => d.tipo === 'contrato').length}
              </p>
            </div>
            <div className="crm-card p-3 text-center">
              <p className="text-[10px] font-bold text-[#888]">ORDENS DE SERVIÇO</p>
              <p className="text-xl font-bold text-[#333]">
                {records.data.filter((d) => d.tipo === 'ordem_servico').length}
              </p>
            </div>
            <div className="crm-card p-3 text-center">
              <p className="text-[10px] font-bold text-[#888]">EM ASSINATURA</p>
              <p className="text-xl font-bold text-amber-600">
                {records.data.filter((d) => d.status === 'enviado_assinatura').length}
              </p>
            </div>
            <div className="crm-card p-3 text-center">
              <p className="text-[10px] font-bold text-[#888]">ASSINADOS</p>
              <p className="text-xl font-bold text-emerald-600">
                {records.data.filter((d) => d.status === 'assinado').length}
              </p>
            </div>
          </div>

          {/* Filtros de busca */}
          <div className="mb-5 flex flex-wrap gap-3 rounded-xl border bg-white p-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[#9A9A9A]" />
              <Input
                className="pl-9 h-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, cliente, código ou projeto..."
              />
            </div>

            <div className="w-[200px]">
              <Select value={familyFilter} onValueChange={setFamilyFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas as famílias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as famílias</SelectItem>
                  <SelectItem value="proposta">PC — Proposta Comercial</SelectItem>
                  <SelectItem value="proposta_tecnica">PT — Proposta Técnica</SelectItem>
                  <SelectItem value="contrato">CT — Contratos</SelectItem>
                  <SelectItem value="ordem_servico">OS — Ordens de Serviço</SelectItem>
                  <SelectItem value="procuracao">PR — Procurações</SelectItem>
                  <SelectItem value="fatura">FT — Faturas</SelectItem>
                  <SelectItem value="recibo">RB — Recibos</SelectItem>
                  <SelectItem value="ata_reuniao">AT — Atas de Reunião</SelectItem>
                  <SelectItem value="requerimento">RQ — Requerimentos</SelectItem>
                  <SelectItem value="nota_tecnica">NT — Notas Técnicas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-[170px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="gerado">Gerado</SelectItem>
                  <SelectItem value="enviado_assinatura">Em Assinatura</SelectItem>
                  <SelectItem value="assinado">Assinado</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!rows.length ? (
            <EmptyState
              title="Nenhum documento encontrado"
              description="Nenhum documento gerado corresponde aos filtros selecionados. Abra o gerador para criar um novo documento fiel à identidade AEROCAD."
              action={
                <Button asChild className="bg-[#FF6A13] hover:bg-[#E85B06]">
                  <Link to="/documentos/novo">Abrir Gerador de Documentos</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((item) => (
                <article key={item.id} className="crm-card p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[#FF6A13]">
                        {item.status === 'assinado' ? (
                          <FileSignature className="h-5 w-5 text-emerald-600" />
                        ) : item.tipo === 'proposta_tecnica' ? (
                          <FileSpreadsheet className="h-5 w-5" />
                        ) : (
                          <FileText className="h-5 w-5" />
                        )}
                      </span>
                      <CrmBadge
                        tone={
                          item.status === 'assinado'
                            ? 'green'
                            : item.status === 'enviado_assinatura'
                              ? 'amber'
                              : 'gray'
                        }
                      >
                        {item.status.replaceAll('_', ' ')}
                      </CrmBadge>
                    </div>

                    <h2 className="mt-4 font-bold text-[#333] text-sm leading-snug line-clamp-2">
                      {item.nome}
                    </h2>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#666]">
                        {item.tipo.toUpperCase()}
                      </span>
                      <span className="text-[11px] font-mono text-[#888]">
                        {item.versao || 'REV001'}
                      </span>
                    </div>

                    <div className="mt-4 border-t pt-3 text-xs text-[#666] space-y-1">
                      <p className="font-semibold text-[#444] truncate">
                        {item.expand?.cliente?.razao_social || 'Cliente não vinculado'}
                      </p>
                      <p className="font-mono text-[11px] text-[#777]">
                        Projeto: {item.expand?.projeto?.numero || '—'}
                      </p>
                      <p className="text-[11px] text-[#888]">
                        Gerado em {formatDate(item.created)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t flex items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1 text-xs">
                      <Link
                        to={`/documentos/novo?projeto=${item.projeto || ''}&processo=${item.processo || ''}`}
                      >
                        Abrir no Gerador
                      </Link>
                    </Button>

                    {item.link_assinatura && (
                      <Button asChild size="sm" variant="ghost" className="text-xs text-[#FF6A13]">
                        <a
                          href={item.link_assinatura}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir link de assinatura"
                        >
                          <Link2 className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ABA 2: ANEXOS E ARQUIVOS (PDF, DWG, DXF, XLSX, DOCX) */}
        <TabsContent value="anexos">
          {/* Estatísticas de anexos */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <div className="crm-card p-3 text-center">
              <p className="text-[10px] font-bold text-[#888]">TOTAL ANEXOS</p>
              <p className="text-xl font-bold text-[#333]">{anexosData.data.length}</p>
            </div>
            <div className="crm-card p-3 text-center border-l-4 border-l-amber-500">
              <p className="text-[10px] font-bold text-[#888]">PROJETOS DWG/DXF</p>
              <p className="text-xl font-bold text-amber-700">
                {
                  anexosData.data.filter(
                    (d) =>
                      d.categoria === 'projeto_tecnico' ||
                      ['dwg', 'dxf'].includes((d.extensao || '').toLowerCase()),
                  ).length
                }
              </p>
            </div>
            <div className="crm-card p-3 text-center border-l-4 border-l-emerald-500">
              <p className="text-[10px] font-bold text-[#888]">PLANILHAS / XLSX</p>
              <p className="text-xl font-bold text-emerald-700">
                {
                  anexosData.data.filter(
                    (d) =>
                      d.categoria === 'planilha' ||
                      ['xlsx', 'xls', 'csv'].includes((d.extensao || '').toLowerCase()),
                  ).length
                }
              </p>
            </div>
            <div className="crm-card p-3 text-center border-l-4 border-l-rose-500">
              <p className="text-[10px] font-bold text-[#888]">ORÇAMENTOS / EDITAIS</p>
              <p className="text-xl font-bold text-rose-700">
                {
                  anexosData.data.filter(
                    (d) => d.categoria === 'orcamento' || d.categoria === 'edital',
                  ).length
                }
              </p>
            </div>
            <div className="crm-card p-3 text-center">
              <p className="text-[10px] font-bold text-[#888]">VINCULADOS A PROJETOS</p>
              <p className="text-xl font-bold text-[#333]">
                {anexosData.data.filter((d) => !!d.projeto).length}
              </p>
            </div>
            <div className="crm-card p-3 text-center">
              <p className="text-[10px] font-bold text-[#888]">VINCULADOS A PROCESSOS</p>
              <p className="text-xl font-bold text-[#333]">
                {anexosData.data.filter((d) => !!d.processo).length}
              </p>
            </div>
          </div>

          {/* Filtros de Anexos */}
          <div className="mb-5 flex flex-wrap gap-3 rounded-xl border bg-white p-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[#9A9A9A]" />
              <Input
                className="pl-9 h-9"
                value={anexoQuery}
                onChange={(e) => setAnexoQuery(e.target.value)}
                placeholder="Buscar anexo por nome, descrição, extensão ou cliente..."
              />
            </div>

            <div className="w-[210px]">
              <Select value={anexoCatFilter} onValueChange={setAnexoCatFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {ANEXO_CATEGORIAS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[190px]">
              <Select value={anexoVinculoFilter} onValueChange={setAnexoVinculoFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os vínculos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os vínculos</SelectItem>
                  <SelectItem value="projeto">Vinculados a Projeto</SelectItem>
                  <SelectItem value="processo">Vinculados a Processo</SelectItem>
                  <SelectItem value="cliente">Vinculados a Cliente</SelectItem>
                  <SelectItem value="oportunidade">Vinculados a Oportunidade</SelectItem>
                  <SelectItem value="sem_vinculo">Gerais (Sem vínculo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => setAnexoDialogOpen(true)}
              className="h-9 bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              <FileUp className="mr-2 h-4 w-4" />
              Novo Anexo
            </Button>
          </div>

          {/* Lista de anexos */}
          <AnexosList
            anexos={filteredAnexos}
            loading={anexosData.loading}
            onReload={() => void anexosData.reload()}
            onOpenUpload={() => setAnexoDialogOpen(true)}
            emptyMessage={
              anexoQuery || anexoCatFilter !== 'todas' || anexoVinculoFilter !== 'todos'
                ? 'Nenhum anexo corresponde aos filtros pesquisados.'
                : 'Nenhum arquivo anexado ainda.'
            }
          />
        </TabsContent>

        {/* ABA 3: CATÁLOGO DE MODELOS & REGRAS OFICIAIS */}
        <TabsContent value="catalogo" className="space-y-6">
          {/* Cartões superiores: Representantes Institucionais e Dados Bancários */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="crm-card p-5 border-l-4 border-l-[#FF6A13]">
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="h-5 w-5 text-[#FF6A13]" />
                <h3 className="font-bold text-sm text-[#333]">Representantes Padrão da AEROCAD</h3>
              </div>
              <p className="text-xs text-[#666] mb-4">
                Profissionais cadastrados para outorga de procurações, coordenação técnica e
                responsabilidade técnica no CREA/CAU:
              </p>
              <div className="space-y-3 text-xs">
                <div className="p-2.5 bg-orange-50/50 rounded-lg border border-orange-100">
                  <p className="font-bold text-[#333]">
                    {INSTITUTIONAL_DATA.representantes.signataria.nome}
                  </p>
                  <p className="text-[#666]">
                    {INSTITUTIONAL_DATA.representantes.signataria.cargo} · CPF{' '}
                    <span className="font-mono">
                      {INSTITUTIONAL_DATA.representantes.signataria.cpf}
                    </span>
                  </p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="font-bold text-[#333]">
                    {INSTITUTIONAL_DATA.representantes.coordenador.nome}
                  </p>
                  <p className="text-[#666]">
                    {INSTITUTIONAL_DATA.representantes.coordenador.cargo} ·{' '}
                    <span className="font-mono">
                      {INSTITUTIONAL_DATA.representantes.coordenador.email}
                    </span>
                  </p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="font-bold text-[#333]">
                    {INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome}
                  </p>
                  <p className="text-[#666]">
                    {INSTITUTIONAL_DATA.representantes.responsavelTecnico.cargo} ·{' '}
                    <span className="font-mono font-bold text-[#FF6A13]">
                      {INSTITUTIONAL_DATA.representantes.responsavelTecnico.crea}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="crm-card p-5 border-l-4 border-l-emerald-600">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-[#333]">
                  Dados Bancários Institucionais & Faturamento
                </h3>
              </div>
              <p className="text-xs text-[#666] mb-4">
                Conta corporativa para recebimento de honorários, faturas e transferências PIX:
              </p>
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-[120px_1fr] py-1 border-b">
                  <span className="text-[#777]">Instituição</span>
                  <span className="font-semibold">{INSTITUTIONAL_DATA.banco}</span>
                </div>
                <div className="grid grid-cols-[120px_1fr] py-1 border-b">
                  <span className="text-[#777]">Agência</span>
                  <span className="font-mono">{INSTITUTIONAL_DATA.agencia}</span>
                </div>
                <div className="grid grid-cols-[120px_1fr] py-1 border-b">
                  <span className="text-[#777]">Conta Corrente</span>
                  <span className="font-mono">{INSTITUTIONAL_DATA.contaCorrente}</span>
                </div>
                <div className="grid grid-cols-[120px_1fr] py-1 border-b">
                  <span className="text-[#777]">Favorecida</span>
                  <span className="font-semibold">{INSTITUTIONAL_DATA.favorecida}</span>
                </div>
                <div className="grid grid-cols-[120px_1fr] py-1">
                  <span className="text-[#777]">CNPJ / PIX</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {INSTITUTIONAL_DATA.chavePix}
                  </span>
                </div>
              </div>
              <div className="mt-4 p-2 bg-emerald-50 text-[11px] text-emerald-800 rounded border border-emerald-200">
                <strong>Regra de Faturamento:</strong> NFS-e emitida em até 5 dias úteis após evento
                comprobatório, com prazo padrão de 30 dias (ou 60 dias para clientes como Alcoa).
              </div>
            </div>
          </div>

          {/* Identidade Visual & Paleta AEROCAD 2026 */}
          <div className="crm-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#FF6A13]" />
                <h3 className="font-bold text-sm text-[#333]">
                  Identidade Visual & Paleta Oficial AEROCAD 2026
                </h3>
              </div>
              <span className="text-xs font-mono text-[#888]">Manual de Marca 2026 · DPI 1200</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-8 text-center text-xs">
              <div
                className="p-3 rounded-lg border"
                style={{ backgroundColor: PALETA_AEROCAD_2026.laranja, color: '#FFFFFF' }}
              >
                <p className="font-bold">Laranja</p>
                <p className="font-mono text-[11px] mt-1">#FF6A13</p>
              </div>
              <div
                className="p-3 rounded-lg border text-white"
                style={{ backgroundColor: PALETA_AEROCAD_2026.preto }}
              >
                <p className="font-bold">Preto</p>
                <p className="font-mono text-[11px] mt-1">#0B0B0C</p>
              </div>
              <div
                className="p-3 rounded-lg border text-white"
                style={{ backgroundColor: PALETA_AEROCAD_2026.cinzaTexto }}
              >
                <p className="font-bold">Cinza Texto</p>
                <p className="font-mono text-[11px] mt-1">#595959</p>
              </div>
              <div
                className="p-3 rounded-lg border text-[#333]"
                style={{ backgroundColor: PALETA_AEROCAD_2026.borda }}
              >
                <p className="font-bold">Borda</p>
                <p className="font-mono text-[11px] mt-1">#BFBFBF</p>
              </div>
              <div
                className="p-3 rounded-lg border text-[#333]"
                style={{ backgroundColor: PALETA_AEROCAD_2026.fundoLabel }}
              >
                <p className="font-bold">Fundo Label</p>
                <p className="font-mono text-[11px] mt-1">#F2F2F2</p>
              </div>
              <div
                className="p-3 rounded-lg border text-[#333]"
                style={{ backgroundColor: PALETA_AEROCAD_2026.linhaAlt1 }}
              >
                <p className="font-bold">Linha Alt 1</p>
                <p className="font-mono text-[11px] mt-1">#FFEDD9</p>
              </div>
              <div
                className="p-3 rounded-lg border text-[#333]"
                style={{ backgroundColor: PALETA_AEROCAD_2026.linhaAlt2 }}
              >
                <p className="font-bold">Linha Alt 2</p>
                <p className="font-mono text-[11px] mt-1">#FFF6EC</p>
              </div>
              <div
                className="p-3 rounded-lg border text-[#333]"
                style={{ backgroundColor: PALETA_AEROCAD_2026.brancoOff }}
              >
                <p className="font-bold">Branco Off</p>
                <p className="font-mono text-[11px] mt-1">#F4F1EC</p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-gray-50 border rounded-lg text-xs text-[#555] leading-relaxed">
              <strong>Texto Oficial de Apresentação AEROCAD (Propostas):</strong> "
              {TEXTO_APRESENTACAO_AEROCAD}"
            </div>
          </div>

          {/* Regras Globais da Seção J */}
          <div className="crm-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-5 w-5 text-[#FF6A13]" />
              <h3 className="font-bold text-sm text-[#333]">
                10 Regras Globais e Boas Práticas (Seção J do Catálogo)
              </h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {REGRAS_GLOBAIS_AEROCAD.map((regra, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50 border text-xs"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF6A13] text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                  <span className="text-[#333] leading-relaxed">{regra}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Catálogo de Serviços do SKILL aerocad-projetos */}
          <div className="crm-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#FF6A13]" />
                <h3 className="font-bold text-sm text-[#333]">
                  Catálogo de Serviços Técnicos (SKILL aerocad-projetos)
                </h3>
              </div>
              <span className="text-xs font-mono text-[#888]">
                {SERVICOS_SKILL_AEROCAD.length} serviços padronizados
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b text-[#555]">
                    <th className="py-2.5 px-3 font-bold w-[110px]">Código</th>
                    <th className="py-2.5 px-3 font-bold w-[220px]">Serviço</th>
                    <th className="py-2.5 px-3 font-bold w-[90px]">Prazo</th>
                    <th className="py-2.5 px-3 font-bold w-[140px]">Faixa R$</th>
                    <th className="py-2.5 px-3 font-bold w-[110px]">Norma</th>
                    <th className="py-2.5 px-3 font-bold">Abrangência e Escopo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {SERVICOS_SKILL_AEROCAD.map((item) => (
                    <tr key={item.codigo} className="hover:bg-orange-50/30">
                      <td className="py-2 px-3 font-bold text-[#FF6A13] font-mono">
                        {item.codigo}
                      </td>
                      <td className="py-2 px-3 font-semibold text-[#333]">{item.servico}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-[#666]">{item.prazo}</td>
                      <td className="py-2 px-3 font-semibold text-emerald-800">
                        {item.faixaPreco}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-[#555]">{item.norma}</td>
                      <td className="py-2 px-3 text-[#666]">{item.descricao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabela de 17 Tipos de Projeto e Normativa */}
          <div className="crm-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#FF6A13]" />
                <h3 className="font-bold text-sm text-[#333]">
                  17 Tipos de Projeto & Normativas Oficiais (DECEA / ANAC / OACI)
                </h3>
              </div>
              <span className="text-xs font-mono text-[#888]">
                {TIPOS_PROJETO_CATALOGO.length} categorias
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b text-[#555]">
                    <th className="py-2.5 px-3 font-bold w-[130px]">Código</th>
                    <th className="py-2.5 px-3 font-bold w-[220px]">Tipo de Projeto</th>
                    <th className="py-2.5 px-3 font-bold w-[200px]">Normativa Principal</th>
                    <th className="py-2.5 px-3 font-bold">Descrição / Abrangência</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {TIPOS_PROJETO_CATALOGO.map((item) => (
                    <tr key={item.codigo} className="hover:bg-orange-50/30">
                      <td className="py-2.5 px-3 font-bold text-[#FF6A13] font-mono">
                        {item.codigo}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#333]">{item.tipo}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#555]">
                        {item.normativaPrincipal}
                      </td>
                      <td className="py-2.5 px-3 text-[#666]">{item.descricao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Nomenclatura Padrão de Arquivos e 17 Prefixos */}
          <div className="crm-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-[#FF6A13]" />
                <h3 className="font-bold text-sm text-[#333]">
                  Prefixos de Nomenclatura e Padrão de Arquivo 2026
                </h3>
              </div>
              <span className="text-xs font-mono text-[#888]">
                {PREFIXOS_NOMENCLATURA.length} prefixos
              </span>
            </div>
            <div className="p-3 bg-gray-900 text-white rounded-lg font-mono text-xs mb-4">
              <span className="text-orange-400">Padrão de arquivo:</span>{' '}
              AEROCAD_&lt;PREFIXO&gt;_&lt;NÚMERO&gt;_&lt;ANO&gt;_&lt;CLIENTE&gt;_&lt;ESCOPO&gt;_v&lt;HHMMSS&gt;.docx
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PREFIXOS_NOMENCLATURA.map((pref) => (
                <div key={pref.prefixo} className="p-2.5 bg-gray-50 rounded-lg border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-[#FF6A13]">{pref.prefixo}</span>
                    <span className="text-[#333] font-semibold truncate">{pref.significado}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#666] line-clamp-2">{pref.descricao}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Seção PDIR: Nomenclatura e Regras Específicas */}
          <div className="crm-card p-5 border-l-4 border-l-sky-600">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-sky-600" />
                <h3 className="font-bold text-sm text-[#333]">
                  SKILL aerocad-pdir — Nomenclatura e Regras Oficiais PDIR
                </h3>
              </div>
              <span className="text-xs font-mono text-sky-700 font-bold">
                RBAC 153 · PGI · A0 DXF/DWG
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-3 text-xs mb-4">
              <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-100 font-mono">
                <span className="text-sky-800 font-bold block mb-1">Relatório PDIR:</span>
                <code>{REGRAS_PDIR_AEROCAD.nomenclaturaRelatorio}</code>
              </div>
              <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-100 font-mono">
                <span className="text-sky-800 font-bold block mb-1">
                  Planta Caracterização Atual:
                </span>
                <code>{REGRAS_PDIR_AEROCAD.nomenclaturaPlantaAtual}</code>
              </div>
              <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-100 font-mono">
                <span className="text-sky-800 font-bold block mb-1">Planta Horizonte Futuro:</span>
                <code>{REGRAS_PDIR_AEROCAD.nomenclaturaPlantaFutura}</code>
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-[#444]">
              {REGRAS_PDIR_AEROCAD.regrasFontes.map((rf, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  <span>{rf}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cláusulas Gerais Contratuais */}
          <div className="crm-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#FF6A13]" />
                <h3 className="font-bold text-sm text-[#333]">
                  Cláusulas Gerais Padrão dos Contratos e Ordens de Serviço AEROCAD
                </h3>
              </div>
              <span className="text-xs font-mono text-[#888]">
                {CLAUSULAS_PADRAO_AEROCAD.length} cláusulas
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CLAUSULAS_PADRAO_AEROCAD.map((cl, idx) => (
                <div key={idx} className="p-3 bg-gray-50 border rounded-lg text-xs">
                  <p className="font-bold text-[#FF6A13] mb-1">{cl.titulo}</p>
                  <p className="text-[#555] leading-relaxed">{cl.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de upload de anexo */}
      <AnexoDialog
        open={anexoDialogOpen}
        onOpenChange={setAnexoDialogOpen}
        onSuccess={() => void anexosData.reload()}
      />
    </div>
  )
}
