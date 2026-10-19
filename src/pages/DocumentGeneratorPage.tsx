import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileCheck,
  FileText,
  Link2,
  Mail,
  Maximize2,
  Minimize2,
  Printer,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
} from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { AerocadLogo } from '@/components/common/AerocadLogo'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  DOCUMENT_FAMILIES,
  formatDocumentFileName,
  dataHojeExtenso,
  INSTITUTIONAL_DATA,
} from '@/lib/documentCatalogo'
import { buildCommercialProposalHTML } from '@/lib/commercialProposalBuilder'
import { buildTechnicalProposalHTML } from '@/lib/technicalProposalBuilder'
import {
  buildContractHTML,
  buildInternalServiceOrderHTML,
  buildInvoiceHTML,
  buildPowerOfAttorneyHTML,
  buildReceiptHTML,
} from '@/lib/additionalDocumentBuilders'
import {
  buildEVAHTML,
  buildPurchaseOrderHTML,
  buildProposalEmailText,
} from '@/lib/newDocumentBuilders'
import {
  buildPTMultiEtapaHorasHTML,
  buildPCVinculadaRFSHTML,
  buildPCMultiBlocosGanttHTML,
  buildPC2OpcoesContratacaoHTML,
  buildPCMedicaoItemAItemHTML,
} from '@/lib/aerocadNewProposalsBuilder'
import {
  buildOficioHTML,
  buildMemorialDescritivoHTML,
  buildMemorialCalculoHTML,
  buildLaudoParecerHTML,
  buildRelatorioGerencialHTML,
  buildAtaReuniaoHTML,
  buildPlanoAcaoCorretivaHTML,
  buildFichaNaoConformidadeHTML,
  buildRequerimentoAnacDeceaHTML,
} from '@/lib/aerocadSupportDocumentBuilders'
import { useAuth } from '@/contexts/AuthContext'
import { canAccess, canViewFinancials } from '@/lib/crm'
import { formatCurrencyRaw as formatCurrency, formatDate } from '@/lib/format'
import { createOne, listAll, updateOne } from '@/services/api'
import type {
  ClienteRecord,
  DocumentoRecord,
  ModeloRecord,
  OportunidadeRecord,
  ParcelaRecord,
  ProcessoRecord,
  ProjetoRecord,
} from '@/types/crm'

const placeholderRegex = /{{\s*([^}]+)\s*}}/g

export default function DocumentGeneratorPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialProjectId = searchParams.get('projeto') || ''

  const canSeeClients = canAccess(user, 'clientes')
  const canSeeFinance = canViewFinancials(user)

  const [templates, setTemplates] = useState<ModeloRecord[]>([])
  const [clients, setClients] = useState<ClienteRecord[]>([])
  const [projects, setProjects] = useState<ProjetoRecord[]>([])
  const [processes, setProcesses] = useState<ProcessoRecord[]>([])
  const [opportunities, setOpportunities] = useState<OportunidadeRecord[]>([])
  const [parcelas, setParcelas] = useState<ParcelaRecord[]>([])

  const [familyFilter, setFamilyFilter] = useState<string>('todas')
  const [groupFilter, setGroupFilter] = useState<
    'todos' | 'comercial' | 'tecnico' | 'contratual' | 'regulatorio_gestao' | 'financeiro'
  >('todos')
  const [templateId, setTemplateId] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState(searchParams.get('projeto') || '')
  const [processId, setProcessId] = useState(searchParams.get('processo') || '')

  const [values, setValues] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [activeTab, setActiveTab] = useState<'dados' | 'editor' | 'opcoes'>('dados')

  // Variante específica para Proposta Comercial
  const [pcVariant, setPcVariant] = useState<'multi_modulo' | 'simples' | 'duas_opcoes'>(
    'multi_modulo',
  )

  // Configuração específica para EVA (mencionar ART)
  const [evaMencionarArt, setEvaMencionarArt] = useState(false)

  // Configuração específica de vencimento da NFS-e (regra padrão 30 dias x 60 dias ex: Alcoa)
  const [vencimentoDiasNfe, setVencimentoDiasNfe] = useState<'30' | '60'>('30')

  const [saved, setSaved] = useState<DocumentoRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [signatureLink, setSignatureLink] = useState('')

  useEffect(() => {
    void Promise.all([
      listAll<ModeloRecord>('modelos_documentos', { sort: 'nome' }),
      canSeeClients
        ? listAll<ClienteRecord>('clientes', { sort: 'razao_social' })
        : Promise.resolve([] as ClienteRecord[]),
      listAll<ProjetoRecord>('projetos', {
        expand: 'cliente,oportunidade,responsavel_tecnico',
        sort: '-numero',
        filter:
          user?.role === 'tecnico' && user?.id ? `responsavel_tecnico = '${user.id}'` : undefined,
      }),
      listAll<ProcessoRecord>('processos', {
        expand: 'projeto',
        sort: '-created',
        filter:
          user?.role === 'tecnico' && user?.id
            ? `projeto.responsavel_tecnico = '${user.id}'`
            : undefined,
      }),
      listAll<OportunidadeRecord>('oportunidades', {
        expand: 'cliente,tipo_servico',
        sort: '-created',
      }),
      canSeeFinance
        ? listAll<ParcelaRecord>('parcelas', { expand: 'projeto', sort: 'vencimento' }).catch(
            () => [] as ParcelaRecord[],
          )
        : Promise.resolve([] as ParcelaRecord[]),
    ]).then(([t, c, p, pr, op, parc]) => {
      setTemplates(t)
      setClients(c)
      setProjects(p)
      setProcesses(pr)
      setOpportunities(op)
      setParcelas(parc)

      // Se não tiver template selecionado, seleciona por padrão a Proposta Comercial Multi-Módulo ou o primeiro
      const defaultTpl =
        t.find((i) => i.nome.includes('Multi-Módulo') || i.nome.includes('Proposta Comercial')) ||
        t[0]
      if (defaultTpl && !templateId) {
        setTemplateId(defaultTpl.id)
      }
    })
  }, [])

  const template = useMemo(
    () => templates.find((i) => i.id === templateId),
    [templates, templateId],
  )
  const client = useMemo(() => clients.find((i) => i.id === clientId), [clients, clientId])
  const project = useMemo(() => projects.find((i) => i.id === projectId), [projects, projectId])
  const process = useMemo(() => processes.find((i) => i.id === processId), [processes, processId])
  const opportunity = useMemo(
    () => opportunities.find((i) => i.id === project?.oportunidade),
    [opportunities, project?.oportunidade],
  )
  const projectParcelas = useMemo(
    () => parcelas.filter((p) => p.projeto === projectId),
    [parcelas, projectId],
  )

  // Atualiza contexto ao mudar o projeto
  useEffect(() => {
    if (projectId) {
      const p = projects.find((i) => i.id === projectId)
      if (p && p.cliente) {
        setClientId((curr) => (curr !== p.cliente ? p.cliente : curr))
      }
    }
  }, [projectId, projects])

  // Ajusta orientação padrão com base no template
  useEffect(() => {
    if (template) {
      const isLandscape =
        template.categoria === 'cronograma' ||
        template.nome.toLowerCase().includes('gantt') ||
        template.nome.toLowerCase().includes('paisagem')
      setOrientation((curr) =>
        curr !== (isLandscape ? 'landscape' : 'portrait')
          ? isLandscape
            ? 'landscape'
            : 'portrait'
          : curr,
      )
    }
  }, [template])

  // Identifica placeholders de forma memoizada e estável
  const placeholders = useMemo(() => {
    if (!template?.corpo) return []
    const found = new Set<string>()
    for (const match of template.corpo.matchAll(placeholderRegex)) {
      found.add(match[1].trim())
    }
    return Array.from(found).sort()
  }, [template?.corpo])

  // Preenchimento inteligente com dados institucionais e do CRM
  useEffect(() => {
    if (!template) return

    const estimatedValue =
      projectParcelas.reduce((acc, cur) => acc + (cur.valor || 0), 0) ||
      opportunity?.valor_estimado ||
      (template.nome.includes('Multi-Módulo') ? 182700 : 8320)

    const numDoc = project?.numero?.split('-')[1] || project?.numero || '241'

    const currentYear = new Date().getFullYear()

    const defaults: Record<string, string> = {
      'cliente.razao_social': client?.razao_social || 'ZURICH AIRPORT BRASIL',
      'cliente.cnpj_cpf': client?.cnpj_cpf || '28.036.597/0001-43',
      'cliente.endereco':
        client?.endereco || 'Aeroporto Internacional de Florianópolis — Hercílio Luz (SBFL/FLN)',
      'projeto.numero': project?.numero || `${currentYear}-241`,
      'projeto.nome':
        project?.nome ||
        'Ampliação da PPD 14/32 com deslocamento da CAB 32 — Aeroporto Internacional de Florianópolis (SBFL/FLN)',
      'processo.numero_protocolo': process?.numero_protocolo || 'OPEA-CINDACTA-II-2026',
      orgao: process?.orgao || 'DECEA / ANAC',
      data_hoje: formatDate(new Date()),
      cidade_data: dataHojeExtenso('Brasília – DF'),
      valor_contrato: formatCurrency(estimatedValue),
      prazo_execucao: '140 dias corridos AEROCAD + prazo de órgão',
      'proposta.numero': `${numDoc}/${currentYear}`,
      'contrato.numero': `CTR-${numDoc}/${currentYear}`,
      'ordem_servico.numero': `OS-${numDoc}/${currentYear}`,
      'fatura.numero': `FT-${numDoc}-01/${currentYear}`,
      'recibo.numero': `RB-${numDoc}-01/${currentYear}`,
      'documento.numero': `NT-${numDoc}/${currentYear}`,
      validade_dias: '90',
      escopo:
        'Estudo de Viabilidade Aeronáutica (AGA/ATM) e Implementação Regulatória da ampliação da PPD 14/32 com deslocamento da cabeceira 32, atualização do PDIR e cadastros regulatórios.',
      condicoes_pagamento:
        'Pagamento parcelado vinculado a marcos técnicos e entregáveis (M1 a M10) com emissão de NFS-e em 5 dias úteis e vencimento em 30 dias corridos.',
      referencia_rfq:
        'RFQ Set/2026 · Rev. nº 0 — Estudo de Viabilidade Aeronáutica e Implementação Regulatória',
      'contato.nome': 'Daniela Bellini',
      'contato.email': 'daniela.bellini@zurichairportbrasil.com',
      'contato.telefone': '+55 48 3331-4000',
      proposta_tecnica_correlata: `240/${currentYear}`,
      proposta_comercial_correlata: `241/${currentYear}`,
      responsavel_tecnico_cliente: 'Engº Marcelo Costa Silva',
      prazo_envio_proposta: `${formatDate(new Date())} — 18h`,
      preco_modulo_a: formatCurrency(78500),
      preco_modulo_b: formatCurrency(47700),
      preco_modulo_c: formatCurrency(56500),
      responsavel:
        project?.expand?.responsavel_tecnico?.name ||
        INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome,
      'parcela.identificador': 'M1 / Parcela 1',
      'parcela.descricao': 'Assinatura do Contrato / OS + recebimento dos dados-base pela AEROCAD.',
      'parcela.vencimento': formatDate(new Date(Date.now() + 30 * 86400000)),
      'parcela.valor': formatCurrency(estimatedValue * 0.2 || 15700),
      referencia_contrato_pc: `PC nº ${numDoc}/${currentYear}`,
    }

    setValues((curr) => {
      let changed = false
      const next = { ...curr }
      placeholders.forEach((key) => {
        const fallback = defaults[key] || ''
        if (!next[key] && fallback) {
          next[key] = fallback
          changed = true
        } else if (key.includes('.')) {
          // Mantém sincronizado com as propriedades vinculadas do CRM caso difiram
          const newVal = defaults[key] || next[key] || ''
          if (next[key] !== newVal) {
            next[key] = newVal
            changed = true
          }
        }
      })
      return changed ? next : curr
    })

    // Gera o nome padronizado do documento pelo catálogo AEROCAD
    const cat = template.categoria
    const prefix =
      cat === 'proposta'
        ? 'PC'
        : cat === 'proposta_tecnica'
          ? 'PT'
          : cat === 'contrato'
            ? 'CTR'
            : cat === 'ordem_servico'
              ? 'OS'
              : cat === 'procuracao'
                ? 'PR'
                : cat === 'fatura'
                  ? 'FT'
                  : cat === 'recibo'
                    ? 'RB'
                    : cat === 'estudo_viabilidade'
                      ? 'EVA'
                      : cat === 'pedido_compras'
                        ? 'PO'
                        : cat === 'email_apresentacao'
                          ? 'EML'
                          : cat === 'oficio'
                            ? 'OF'
                            : cat === 'memorial'
                              ? 'MD'
                              : cat === 'laudo'
                                ? 'LT'
                                : cat === 'relatorio_gerencial'
                                  ? 'RG'
                                  : cat === 'ata_reuniao'
                                    ? 'AT'
                                    : cat === 'pac'
                                      ? 'PAC'
                                      : cat === 'fnc'
                                        ? 'FNC'
                                        : cat === 'requerimento'
                                          ? 'RQ'
                                          : 'DOC'

    const stdFileName = formatDocumentFileName({
      prefixo: prefix,
      numero: numDoc,
      ano: currentYear,
      cliente: client?.razao_social || 'ZURICH',
      escopo: project?.nome || 'SBFL_AMPLIACAO',
    })

    setName((curr) => curr || stdFileName)
  }, [template, client, project, process, opportunity, projectParcelas, placeholders])

  // Geração do corpo renderizado (aplica os builders dedicados ou a substituição por placeholders)
  const renderedContent = useMemo(() => {
    if (!template) return ''

    const tplNome = template.nome.toLowerCase()
    const currentYear = new Date().getFullYear()
    const numDoc = project?.numero?.split('-')[1] || project?.numero || '241'

    // A.1 PT Multi-Etapa por Horas (Alcoa Juruti)
    if (
      tplNome.includes('multi-etapa por horas') ||
      tplNome.includes('alcoa juruti') ||
      (template.categoria === 'proposta_tecnica' && tplNome.includes('horas'))
    ) {
      return buildPTMultiEtapaHorasHTML({
        numero: numDoc,
        ano: currentYear,
        contratante:
          client?.razao_social ||
          values['cliente.razao_social'] ||
          'ALCOA ALUMÍNIO S/A — Site Juruti/PA',
        cnpjCpf: client?.cnpj_cpf || values['cliente.cnpj_cpf'] || '28.036.597/0001-43',
        aerodromoOuSite:
          project?.nome ||
          values['projeto.nome'] ||
          'Aeródromo de Juruti/PA (Linhas de Transmissão e Torres)',
        objetoResumo:
          'Estudo Técnico de Interferências de LTs e Torres sobre a Segurança Operacional',
        taxaTecnicaHora: 217.8,
        prazoDias: 60,
      })
    }

    // A.2 PC Vinculada à PT + RFS (Alcoa Juruti)
    if (
      tplNome.includes('vinculada à pt') ||
      tplNome.includes('rfs') ||
      tplNome.includes('pc 231')
    ) {
      return buildPCVinculadaRFSHTML({
        numero: numDoc,
        ano: currentYear,
        contratante:
          client?.razao_social ||
          values['cliente.razao_social'] ||
          'ALCOA ALUMÍNIO S/A — Site Juruti/PA',
        cnpjCpf: client?.cnpj_cpf || values['cliente.cnpj_cpf'] || '28.036.597/0001-43',
        referenciaPt: `230/${currentYear}`,
        referenciaRfs: 'JURUTI136/2026',
        valorGlobal: 87300,
        prazoVencimentoNfeDias: vencimentoDiasNfe === '60' ? 60 : 30,
      })
    }

    // A.3 PC Multi-Blocos com Gantt (OCC Maragogi)
    if (
      tplNome.includes('multi-blocos') ||
      tplNome.includes('maragogi') ||
      tplNome.includes('occ')
    ) {
      return buildPCMultiBlocosGanttHTML({
        numero: numDoc,
        ano: currentYear,
        contratante:
          client?.razao_social ||
          values['cliente.razao_social'] ||
          'OCC CONSTRUÇÕES E PARTICIPAÇÕES',
        cnpjCpf: client?.cnpj_cpf || values['cliente.cnpj_cpf'] || '33.123.456/0001-90',
        aerodromoNome:
          project?.nome || values['projeto.nome'] || 'Aeroporto Costa dos Corais — Maragogi/AL',
        valorGlobal: 185000,
      })
    }

    // A.4 PC com 2 Opções de Contratação (Bruna Rodrigues / Cantá)
    if (
      tplNome.includes('2 opções') ||
      tplNome.includes('duas opções') ||
      tplNome.includes('bruna rodrigues')
    ) {
      return buildPC2OpcoesContratacaoHTML({
        numero: numDoc,
        ano: currentYear,
        clienteNome: client?.razao_social || values['cliente.razao_social'] || 'Bruna Rodrigues',
        clienteCpfCnpj: client?.cnpj_cpf || values['cliente.cnpj_cpf'] || '026.721.743-93',
        aerodromoNome:
          project?.nome ||
          values['projeto.nome'] ||
          'Aeródromo Pouso da Águia (SWPD · CIAD RR0111)',
        aeronaveCritica: 'CESSNA C408 Sky Courier (PMD 8.618 kg)',
        valorOpcao1: 115500,
        valorOpcao2: 108000,
      })
    }

    // A.5 PC de Medição / Item a Item (Zurich SBVT)
    if (
      tplNome.includes('medição') ||
      tplNome.includes('item a item') ||
      tplNome.includes('sbvt') ||
      tplNome.includes('45.092') ||
      tplNome.includes('45.093')
    ) {
      return buildPCMedicaoItemAItemHTML({
        numero: numDoc,
        ano: currentYear,
        contratante:
          client?.razao_social || values['cliente.razao_social'] || 'ZURICH AIRPORT BRASIL',
        aerodromoNome:
          project?.nome || values['projeto.nome'] || 'Aeroporto Internacional de Vitória (SBVT)',
        objetoResumo:
          'Alteração Cadastral e Processo OPEA para Operação Regular do AIRBUS A330-300',
        prazoDias: 45,
        pcCorrelataOuNota:
          'Proposta complementar à PC nº 45.092/2026 e aderente aos critérios DECEA/SYSAGA',
      })
    }

    // B.1 Ofício (OF)
    if (
      template.categoria === 'oficio' ||
      tplNome.includes('ofício') ||
      tplNome.includes('oficio')
    ) {
      return buildOficioHTML({
        numero: numDoc,
        ano: currentYear,
        destinatarioNome:
          values['contato.nome'] || 'Superintendente de Infraestrutura Aeroportuária',
        destinatarioCargo: 'Superintendência de Infraestrutura Aeroportuária (SIA)',
        destinatarioOrgao: values['orgao'] || 'Agência Nacional de Aviação Civil — ANAC',
        destinatarioCidadeUf: 'Brasília – DF',
        assunto:
          values['escopo'] ||
          `Anuência técnica e regularidade de superfícies de proteção — ${project?.nome || 'Empreendimento Sítio Aeroportuário'}`,
        formaTratamento: 'Senhor(a) Superintendente,',
      })
    }

    // B.2 Memorial Descritivo (MD)
    if (template.categoria === 'memorial' || tplNome.includes('memorial descritivo')) {
      return buildMemorialDescritivoHTML({
        numero: `${numDoc}/${currentYear}`,
        revisao: '00',
        empreendimentoNome:
          project?.nome || values['projeto.nome'] || 'Aeródromo Privado / Sítio Aeroportuário',
        clienteRazaoSocial:
          client?.razao_social ||
          values['cliente.razao_social'] ||
          'Empreendimentos Aeroportuários S.A.',
        localizacaoIcao:
          client?.municipio && client?.uf
            ? `${client.municipio} / ${client.uf}`
            : 'Florianópolis / SC',
        disciplina: 'Engenharia de Infraestrutura Aeroportuária & Superfícies OLS',
        responsavelTecnico:
          values['responsavel'] || INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome,
        creaNumero: INSTITUTIONAL_DATA.representantes.responsavelTecnico.crea,
      })
    }

    // B.3 Memorial de Cálculo (MC)
    if (tplNome.includes('memorial de cálculo') || tplNome.includes('memorial de calculo')) {
      return buildMemorialCalculoHTML({
        numero: `${numDoc}/${currentYear}`,
        empreendimentoNome:
          project?.nome || values['projeto.nome'] || 'Pista de Pouso e Pátios de Aeronaves',
        disciplina: 'Dimensionamento de Pavimento Aeroportuário (PCR) e Cargas',
        softwareUtilizado: 'FAARFIELD 2.0 / Mathcad / Planilha Homologada AEROCAD',
        responsavelTecnico:
          values['responsavel'] || INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome,
        creaNumero: INSTITUTIONAL_DATA.representantes.responsavelTecnico.crea,
      })
    }

    // B.4 Laudo / Parecer Técnico (LT)
    if (
      template.categoria === 'laudo' ||
      tplNome.includes('laudo') ||
      tplNome.includes('parecer')
    ) {
      return buildLaudoParecerHTML({
        numero: `${numDoc}/${currentYear}`,
        tipo: tplNome.includes('vistoria')
          ? 'Vistoria Técnica'
          : tplNome.includes('parecer')
            ? 'Parecer Técnico'
            : 'Laudo Técnico',
        solicitante:
          client?.razao_social ||
          values['cliente.razao_social'] ||
          'Construtora e Incorporadora S.A.',
        objetoExaminado:
          project?.nome ||
          values['projeto.nome'] ||
          'Edificação Comercial em Zona de Proteção Aeroportuária',
        localizacao:
          client?.endereco || values['cliente.endereco'] || 'Setor Hoteleiro Norte, Brasília-DF',
        dataVistoria: formatDate(new Date()),
        responsavelTecnico:
          values['responsavel'] || INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome,
        creaNumero: INSTITUTIONAL_DATA.representantes.responsavelTecnico.crea,
      })
    }

    // B.5 Relatório Gerencial (RG)
    if (
      template.categoria === 'relatorio_gerencial' ||
      tplNome.includes('relatório gerencial') ||
      tplNome.includes('relatorio gerencial')
    ) {
      const isSnaw =
        tplNome.includes('cni') || tplNome.includes('snaw') || tplNome.includes('ceamn')
      return buildRelatorioGerencialHTML({
        numero: String(new Date().getMonth() + 1).padStart(2, '0'),
        ano: currentYear,
        mesReferencia: 'AGOSTO/2026',
        tipoInstalacao: 'heliponto',
        nomeEmpreendimento: isSnaw
          ? 'Edifício Armando Monteiro Neto (CEAMN)'
          : project?.nome || 'Heliponto Corporativo',
        designacaoIcao: isSnaw ? 'SNAW' : 'SNAW',
        contratante:
          client?.razao_social ||
          values['cliente.razao_social'] ||
          'Condomínio do Edifício Armando Monteiro Neto (CEAMN)',
        cnpjContratante: client?.cnpj_cpf || values['cliente.cnpj_cpf'] || '00.000.000/0001-00',
        coordenadas: '15°47\'26" S / 047°52\'46" W',
        elevacao: '1.152 m MSL (3.779 ft)',
        dimensoesMaterial: '19,50 m × 19,50 m — Concreto (CONC) — 4 t',
        dadosSnawDefault: isSnaw,
      })
    }

    // B.6 Ata de Reunião (AT)
    if (
      template.categoria === 'ata_reuniao' ||
      tplNome.includes('ata de reunião') ||
      tplNome.includes('ata de reuniao')
    ) {
      return buildAtaReuniaoHTML({
        numero: numDoc,
        ano: currentYear,
        projetoNome:
          project?.nome ||
          values['projeto.nome'] ||
          'Reunião Técnica de Kick-off e Alinhamento de Premissas',
        clienteNome:
          client?.razao_social || values['cliente.razao_social'] || 'ZURICH AIRPORT BRASIL',
        dataHora: `${formatDate(new Date())} — 14:30 às 16:00`,
        local: 'Videoconferência (Microsoft Teams) / Sede AEROCAD Brasília-DF',
        pauta: [
          'Apresentação da equipe técnica e canais oficiais de comunicação;',
          'Alinhamento dos dados de entrada (coordenadas SIRGAS 2000, plantas e histórico cadastral);',
          'Definição da data de envio do relatório preliminar de viabilidade (v0);',
          'Cronograma de vistorias e checkpoints quinzenais.',
        ],
      })
    }

    // B.7 Plano de Ação Corretiva (PAC)
    if (
      template.categoria === 'pac' ||
      tplNome.includes('plano de ação corretiva') ||
      tplNome.includes('plano de acao corretiva')
    ) {
      return buildPlanoAcaoCorretivaHTML({
        numero: numDoc,
        ano: currentYear,
        documentoOrigem: 'Auto de Notificação ANAC nº 045/2026 — Vistoria de Fiscalização',
        aerodromoNome: project?.nome || values['projeto.nome'] || 'Aeródromo Privado Regional',
        operadorNome:
          client?.razao_social ||
          values['cliente.razao_social'] ||
          'Aerotrat Administração Aeroportuária',
        causaRaiz5Porques: [
          'Por que houve penetração no cone de aproximação? Porque árvores nativas ultrapassaram a cota da superfície horizontal interna.',
          'Por que ultrapassaram a cota sem intervenção prévia? Porque não havia plano periódico de manejo de vegetação implementado no sítio.',
          'Por que não havia plano de manejo? Porque a gestão não dispunha de levantamento altimétrico georreferenciado das copas.',
          'Por que o levantamento não havia sido realizado? Porque as inspeções eram exclusivamente visuais e sem apoio topográfico de precisão.',
          'Causa Raiz: Ausência de protocolo técnico permanente de monitoramento com drones/topografia integrado ao SGSO.',
        ],
        acoes: [
          {
            acao: 'Poda e rebaixamento imediato das copas críticas identificadas na superfície de aproximação',
            responsavel: 'Equipe de Manutenção do Aeródromo',
            prazo: '15 dias corridos',
            status: 'EM ANDAMENTO',
          },
          {
            acao: 'Instalação de balizamento de obstáculo no topo das árvores limítrofes até a supressão final',
            responsavel: 'Coordenação de Operações',
            prazo: '5 dias úteis',
            status: 'CONCLUÍDO',
          },
          {
            acao: 'Instituição de rotina semestral de monitoramento com RPA/Topografia com emissão de ART',
            responsavel: 'AEROCAD CONSULTORIA',
            prazo: '30 dias',
            status: 'PROGRAMADO',
          },
        ],
      })
    }

    // B.8 Ficha de Não Conformidade (FNC)
    if (
      template.categoria === 'fnc' ||
      tplNome.includes('ficha de não conformidade') ||
      tplNome.includes('ficha de nao conformidade')
    ) {
      return buildFichaNaoConformidadeHTML({
        numero: numDoc,
        ano: currentYear,
        aerodromoNome:
          project?.nome || values['projeto.nome'] || 'Aeródromo / Heliponto Corporativo',
        setorInspecionado: 'Pista de Pouso e Decolagem (PPD) — Cabeceira 14 e Faixa Preparada',
        requisitoViolado: 'RBAC 154, Tabela 3-1 e Seção 154.205 (Desobstrução da Faixa de Pista)',
        severidade: 'ALTA',
        descricaoNaoConformidade:
          'Identificada presença de mourões de cerca de concreto e vegetação densa com altura de 1,80 m instalados dentro da faixa nivelada da pista, a 28 metros do eixo da PPD, violando o gabarito livre de obstáculos frangíveis.',
        acaoRecomendada:
          'Remoção imediata dos mourões rígidos da faixa nivelada e substituição por mourões frangíveis com fusível mecânico de rompimento, em conformidade com o Apêndice C do RBAC 154.',
        prazoRecomendado: '10 dias corridos',
      })
    }

    // B.9 Requerimento ANAC / DECEA (RQ)
    if (template.categoria === 'requerimento' || tplNome.includes('requerimento')) {
      return buildRequerimentoAnacDeceaHTML({
        numero: numDoc,
        ano: currentYear,
        orgaoDestinatario: values['orgao'] || 'CINDACTA I — Serviço Regional de Proteção ao Voo',
        requerenteRazaoSocial:
          client?.razao_social ||
          values['cliente.razao_social'] ||
          'LOG CP Empreendimentos Imobiliários S.A.',
        requerenteCnpj: client?.cnpj_cpf || values['cliente.cnpj_cpf'] || '',
        requerenteEndereco:
          client?.endereco ||
          values['cliente.endereco'] ||
          'Avenida das Nações, nº 1000, Brasília-DF',
        fundamentacaoNormativa: 'Instrução do Comando da Aeronáutica (ICA 11-408/2021) e RBAC 154',
        dosFatos:
          'O Requerente pretende implantar empreendimento logístico com gabarito vertical de 14,80 m, cuja área de projeção situa-se no entorno do aeródromo de referência. Realizados os estudos preliminares, verificou-se que a estrutura pretendida não gera penetração nas superfícies limitadoras de aproximação e decolagem.',
        doPedido:
          'Requer a instauração do competente processo de análise de OPEA, culminando com a emissão do Parecer Técnico Favorável para a implantação e operação do empreendimento, conforme memorial e pranchas instrutórias em anexo.',
        documentosAnexos: [
          'Procuração Ad Negotia outorgando poderes à AEROCAD;',
          'Memorial Descritivo e Memorial de Cálculo de superfícies OLS;',
          'Planta de Localização e Implantação em coordenadas SIRGAS 2000 (DWG e PDF);',
          'Anotação de Responsabilidade Técnica (ART) registrada no CREA.',
        ],
      })
    }

    const isPcMultiModulo =
      tplNome.includes('multi-módulo') ||
      tplNome.includes('multi-modulo') ||
      (template.categoria === 'proposta' && pcVariant === 'multi_modulo')
    const isPcSimples =
      tplNome.includes('simples') || (template.categoria === 'proposta' && pcVariant === 'simples')
    const isPcDuasOpcoes = template.categoria === 'proposta' && pcVariant === 'duas_opcoes'
    const isPtFiel =
      template.categoria === 'proposta_tecnica' ||
      tplNome.includes('proposta técnica') ||
      tplNome.includes('proposta tecnica')
    const isContrato = template.categoria === 'contrato'
    const isOS = template.categoria === 'ordem_servico'
    const isProcuracao = template.categoria === 'procuracao'
    const isFatura = template.categoria === 'fatura'
    const isRecibo = template.categoria === 'recibo'
    const isEVA =
      template.categoria === 'estudo_viabilidade' ||
      tplNome.includes('viabilidade') ||
      tplNome.includes('eva')
    const isPedidoCompras =
      template.categoria === 'pedido_compras' || tplNome.includes('pedido de compras')
    const isEmailApresentacao =
      template.categoria === 'email_apresentacao' ||
      tplNome.includes('e-mail de apresentação') ||
      tplNome.includes('email de apresentacao')

    // 1. Proposta Comercial Fiel (Multi-Módulo RFQ ou Simples)
    if (template.categoria === 'proposta') {
      return buildCommercialProposalHTML({
        tipoVariante: isPcMultiModulo ? 'multi_modulo' : isPcDuasOpcoes ? 'duas_opcoes' : 'simples',
        numero: numDoc,
        ano: currentYear,
        contratante:
          client?.razao_social || values['cliente.razao_social'] || 'ZURICH AIRPORT BRASIL',
        cnpjCpf: client?.cnpj_cpf || values['cliente.cnpj_cpf'] || '28.036.597/0001-43',
        endereco:
          client?.endereco ||
          values['cliente.endereco'] ||
          'Aeroporto Internacional de Florianópolis (SBFL)',
        objetoAerodromo:
          project?.nome ||
          values['projeto.nome'] ||
          'Aeroporto Internacional de Florianópolis (SBFL/FLN)',
        referenciaRfq:
          values['referencia_rfq'] || 'RFQ Set/2026 · Rev. nº 0 — Estudo de Viabilidade AGA/ATM',
        contatoEnvio: values['contato.email'] || 'daniela.bellini@zurichairportbrasil.com',
        docTecnicoCorrelato: `Proposta Técnica AEROCAD PT nº ${values['proposta_tecnica_correlata'] || '240/2026'}`,
        valorGlobal: isPcMultiModulo ? 182700 : 8320,
        validadeDias: Number(values['validade_dias']) || 90,
        reajusteIndice: 'IPCA/IBGE',
        limiteRevisoes: 2,
      })
    }

    // 2. Proposta Técnica Fiel (com Aderência, Normas e Gantt)
    if (isPtFiel) {
      return buildTechnicalProposalHTML({
        numero: values['proposta_tecnica_correlata']?.split('/')[0] || '240',
        ano: currentYear,
        objetoAerodromo:
          project?.nome ||
          values['projeto.nome'] ||
          'Aeroporto Internacional de Florianópolis — Hercílio Luz (SBFL/FLN)',
        contratante:
          client?.razao_social || values['cliente.razao_social'] || 'ZURICH AIRPORT BRASIL',
        referenciaRfq:
          values['referencia_rfq'] ||
          'RFQ Set/2026 · Rev. nº 0 — Estudo de Viabilidade Aeronáutica',
        contatoEnvio: values['contato.email'] || 'daniela.bellini@zurichairportbrasil.com',
        responsavelTecnicoCliente:
          values['responsavel_tecnico_cliente'] || 'Engº Marcelo Costa Silva',
        prazoEnvioProposta: values['prazo_envio_proposta'] || `${formatDate(new Date())} — 18h`,
        propostaComercialCorrelata: `${numDoc}/${currentYear}`,
      })
    }

    // 3. Contrato 11 Cláusulas
    if (isContrato) {
      return buildContractHTML({
        numeroContrato: values['contrato.numero'] || `CTR-${numDoc}/${currentYear}`,
        clienteRazaoSocial:
          client?.razao_social || values['cliente.razao_social'] || 'Zurich Airport Brasil',
        clienteCnpj: client?.cnpj_cpf || values['cliente.cnpj_cpf'] || '',
        clienteEndereco: client?.endereco || values['cliente.endereco'] || '',
        objetoNome: project?.nome || values['projeto.nome'] || 'Projeto Técnico Aeroportuário',
        projetoNumero: project?.numero || values['projeto.numero'] || `${currentYear}-001`,
        escopo:
          values['escopo'] ||
          'Processo técnico instrucional de Objeto Projetado no Espaço Aéreo perante o DECEA.',
        valorGlobal: 16640,
        prazoExecucao: values['prazo_execucao'] || '60 dias corridos',
        condicoesPagamento:
          values['condicoes_pagamento'] ||
          '50% de entrada na assinatura do contrato + 50% após o protocolo oficial perante o DECEA/CINDACTA.',
      })
    }

    // 4. Ordem de Serviço
    if (isOS) {
      return buildInternalServiceOrderHTML({
        numeroOS: values['ordem_servico.numero'] || `OS-${numDoc}/${currentYear}`,
        projetoNumero: project?.numero || values['projeto.numero'] || `${currentYear}-001`,
        projetoNome: project?.nome || values['projeto.nome'] || 'Projeto Técnico Aeroportuário',
        clienteRazaoSocial:
          client?.razao_social || values['cliente.razao_social'] || 'Zurich Airport Brasil',
        clienteCnpj: client?.cnpj_cpf || values['cliente.cnpj_cpf'] || '',
        escopo:
          values['escopo'] || 'Elaboração das superfícies OLS e assessoria técnica regulatória.',
        responsavelTecnico:
          values['responsavel'] || INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome,
        prazo: values['prazo_execucao'] || '45 dias úteis',
      })
    }

    // 5. Procuração
    if (isProcuracao) {
      return buildPowerOfAttorneyHTML({
        clienteRazaoSocial:
          client?.razao_social || values['cliente.razao_social'] || 'Zurich Airport Brasil',
        clienteCnpj: client?.cnpj_cpf || values['cliente.cnpj_cpf'] || '',
        clienteEndereco: client?.endereco || values['cliente.endereco'] || '',
        objetoNome: project?.nome || values['projeto.nome'] || 'Projeto Técnico Aeroportuário',
        projetoNumero: project?.numero || values['projeto.numero'] || `${currentYear}-001`,
      })
    }

    // 6. Fatura
    if (isFatura) {
      return buildInvoiceHTML({
        numeroFatura: values['fatura.numero'] || `FT-${numDoc}-01/${currentYear}`,
        clienteRazaoSocial:
          client?.razao_social || values['cliente.razao_social'] || 'Zurich Airport Brasil',
        clienteCnpj: client?.cnpj_cpf || values['cliente.cnpj_cpf'] || '',
        clienteEndereco: client?.endereco || values['cliente.endereco'] || '',
        projetoNumero: project?.numero || values['projeto.numero'] || `${currentYear}-001`,
        projetoNome: project?.nome || values['projeto.nome'] || 'Projeto Técnico Aeroportuário',
        descricaoMarco:
          values['parcela.descricao'] ||
          'Comprovação de Protocolo SYSAGA junto ao DECEA/CINDACTA I.',
        vencimento:
          values['parcela.vencimento'] || formatDate(new Date(Date.now() + 30 * 86400000)),
        valor: 8320,
      })
    }

    // 7. Recibo
    if (isRecibo) {
      return buildReceiptHTML({
        numeroRecibo: values['recibo.numero'] || `RB-${numDoc}-01/${currentYear}`,
        clienteRazaoSocial:
          client?.razao_social || values['cliente.razao_social'] || 'Zurich Airport Brasil',
        clienteCnpj: client?.cnpj_cpf || values['cliente.cnpj_cpf'] || '',
        projetoNumero: project?.numero || values['projeto.numero'] || `${currentYear}-001`,
        projetoNome: project?.nome || values['projeto.nome'] || 'Projeto Técnico Aeroportuário',
        descricaoEntrega:
          values['parcela.descricao'] ||
          'Parcela referente à entrada e início dos estudos de viabilidade.',
        valor: 8320,
      })
    }

    // 8. Estudo de Viabilidade Aeronáutica (EVA)
    if (isEVA) {
      return buildEVAHTML({
        numeroEstudo: `EVA-${numDoc}/${currentYear}`,
        empreendimentoNome:
          project?.nome || values['projeto.nome'] || 'Galpão Logístico — Áreas Candidatas 1 e 2',
        clienteRazaoSocial:
          client?.razao_social || values['cliente.razao_social'] || 'LOG CP Empreendimentos',
        clienteCnpj: client?.cnpj_cpf || values['cliente.cnpj_cpf'] || '',
        municipioUf:
          client?.municipio && client?.uf
            ? `${client.municipio} / ${client.uf}`
            : 'Florianópolis / SC',
        aerodromoReferencia: 'SBFL / FLN — Aeroporto Internacional Hercílio Luz',
        coordenadasOuPoligono:
          'Polígono Galpão 1 (2,65 ha) · Polígono Galpão 2 (Hospital - 3,10 ha)',
        responsavelTecnicoNome:
          values['responsavel'] || INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome,
        responsavelTecnicoCrea: INSTITUTIONAL_DATA.representantes.responsavelTecnico.crea,
        responsavelTecnicoTitulo: 'Engenheiro Civil — Responsável Técnico',
        mencionarArt: evaMencionarArt,
        numeroArt: evaMencionarArt ? project?.art || 'ART CREA-SC 2026/099823' : undefined,
        candidatos: [
          {
            nome: 'Galpão Candidato 1',
            areaHa: '2,65 ha',
            superficieGovernante: 'radar_rampa (PZPANA)',
            alturaPretendidaM: 14.8,
            alturaConstruivelM: 9.44,
            recomendacao: 'NÃO RECOMENDADO',
            observacao: 'Penetra rampa radar por 5,36 m com a altura pretendida de 14,80 m',
          },
          {
            nome: 'Galpão Candidato 2 (Hospital)',
            areaHa: '3,10 ha',
            superficieGovernante: 'dme_fln_rampa (PZPANA)',
            alturaPretendidaM: 14.8,
            alturaConstruivelM: 20.31,
            recomendacao: 'RECOMENDADO',
            observacao: '100% da área comporta o gabarito pretendido com folga técnica de 5,51 m',
          },
        ],
        discussaoTecnica:
          'A análise comparativa entre as áreas candidatas indica que o Galpão 1 possui forte restrição decorrente da rampa de proteção do Radar secundário, tornando-o inviável para a cota pretendida de 14,80 m sem gerar penetração. Em contrapartida, o Galpão 2 (Hospital) possui cota construível de 20,31 m governada pela rampa do DME FLN, comportando integralmente a implantação logística com folga segura para aprovação.',
        conclusaoRecomendacaoFinal: 'RECOMENDADO',
        parecerResumo:
          'RECOMENDA-SE a implantação do empreendimento na Área Candidata 2 (Hospital), plenamente viável técnica e operacionalmente perante os critérios do DECEA/COMAER. A Área 1 NÃO É RECOMENDADA para a altura pretendida.',
      })
    }

    // 9. Pedido de Compras
    if (isPedidoCompras) {
      return buildPurchaseOrderHTML({
        numeroPedido: `008/${currentYear}`,
        fornecedorRazaoSocial: client?.razao_social || 'TWR Consultoria Aeronáutica Ltda.',
        fornecedorCnpjCpf: client?.cnpj_cpf || '49.421.197/0001-21',
        fornecedorContatoNome: values['contato.nome'] || 'Eugênio Edison Silva',
        fornecedorEmail: values['contato.email'] || 'eugenio@twrconsultoria.com.br',
        fornecedorTelefone: values['contato.telefone'] || '+55 11 98765-4321',
        fornecedorAtribuicao: 'Assessoria Especializada AGA / PDIR / OPEA',
        itens: [
          {
            item: 1,
            descricao: 'FLN — PBZPA / PZPANA atualizados para configuração 14/32',
            quantidade: 1,
            precoUnitario: 10000,
            valorTotal: 10000,
            previsaoEntrega: '30 dias',
          },
          {
            item: 2,
            descricao: 'FLN — Atualização das pranchas e memorial do PDIR',
            quantidade: 1,
            precoUnitario: 10000,
            valorTotal: 10000,
            previsaoEntrega: '45 dias',
          },
          {
            item: 3,
            descricao: 'Central Garden (SE) — Processo OPEA COMAER',
            quantidade: 1,
            precoUnitario: 1500,
            valorTotal: 1500,
            previsaoEntrega: '15 dias',
          },
          {
            item: 4,
            descricao: 'MEA — Atualização cadastral SDIA',
            quantidade: 1,
            precoUnitario: 1500,
            valorTotal: 1500,
            previsaoEntrega: '15 dias',
          },
        ],
        valorTotal: 23000,
        formaPagamento: 'Transferência Bancária / Chave PIX',
        chavePixOuBanco: 'Chave PIX CNPJ 49.421.197/0001-21',
        prazosCondicoes:
          'Pagamento parcelado efetuado em até 5 dias úteis após o aceite e validação técnica de cada produto pela AEROCAD.',
      })
    }

    // 10. E-mail de Apresentação de Proposta (formato texto / visualização estruturada)
    if (isEmailApresentacao) {
      const emailObj = buildProposalEmailText({
        numeroProposta: `${numDoc}/${currentYear}`,
        objeto:
          project?.nome ||
          values['projeto.nome'] ||
          'Estudo de Viabilidade AGA/ATM e Implementação Regulatória',
        destinatarioNome: values['contato.nome'] || 'Daniela Bellini',
        destinatarioTratamento: 'Prezada',
        contexto:
          'Em cumprimento às diretrizes alinhadas para a contratação dos serviços técnicos especializados de consultoria aeroportuária, temos a satisfação de submeter à sua apreciação nossa proposta técnica e comercial.',
        bulletsEscopo: [
          'Estudo de Viabilidade Aeronáutica (AGA/ATM) com análise de obstáculos e impactos em procedimentos IFR;',
          'Modelagem e atualização dos Planos de Zona de Proteção (PBZPA e PZPANA);',
          'Instrução e acompanhamento dos processos regulatórios junto ao DECEA/COMAER e à ANAC;',
          'Assessoria contínua com até 8 reuniões técnicas e 2 revisões completas dos produtos sem custo adicional.',
        ],
        valorGlobal: isPcMultiModulo ? 182700 : 8320,
        prazoExecucao:
          '140 dias corridos sob controle AEROCAD + prazo discricionário de órgãos públicos',
        condicoesPagamento: `Parcelamento vinculado a entregas técnicas comprobatórias (M1 a M10), com NFS-e emitida em 5 dias úteis e vencimento em ${vencimentoDiasNfe} dias`,
        validadeDias: Number(values['validade_dias']) || 90,
        propostaCorrelata: values['proposta_tecnica_correlata'] || `240/${currentYear}`,
        contatoSecundario: 'o Sr. Leonardo Arins e equipe de infraestrutura',
        disposicaoVideoconferencia: true,
      })

      return `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 680px; margin: 0 auto; color: #222;">
  <div style="background: #FFF7F0; border: 1.5px solid #FF6A13; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
    <p style="font-size: 11px; font-weight: bold; color: #FF6A13; margin: 0 0 4px 0; text-transform: uppercase;">
      📧 MODELO DE E-MAIL DE ENCAMINHAMENTO (SEM ASSINATURA — REMETENTE ASSINA NO CLIENTE DE E-MAIL)
    </p>
    <p style="font-size: 13px; font-weight: bold; color: #333; margin: 0;">
      ${emailObj.subject}
    </p>
  </div>

  <div style="background: #FAFAFA; border: 1px solid #E5E5E5; border-radius: 8px; padding: 22px; font-size: 13px; line-height: 1.8; white-space: pre-line; color: #2D2D2D;">
${emailObj.bodyText}
  </div>

  <div style="margin-top: 16px; padding: 12px; background: #F1F3F5; border-radius: 6px; font-size: 11px; color: #666;">
    <strong>Regra da Seção H:</strong> O texto do e-mail encerra com "Cordialmente," e NÃO possui bloco de assinatura com cargo/endereço, pois a assinatura é aplicada pelo cliente de e-mail do remetente. Utilize o botão <strong>"Copiar Texto do E-mail"</strong> no topo para colar diretamente no seu cliente de correio.
  </div>
</div>
`
    }

    // Fallback: Substituição direta de tags
    let body = template.corpo || ''
    placeholders.forEach((key) => {
      body = body.replaceAll(`{{${key}}}`, values[key] || `[${key}]`)
      body = body.replaceAll(`{{ ${key} }}`, values[key] || `[${key}]`)
    })
    return body
  }, [template, pcVariant, project, client, values, placeholders])

  // Mapeamento de grupos de famílias (Comercial / Técnico / Contratual / Regulatório-Gestão / Financeiro)
  const templateGroups: Record<string, string[]> = {
    comercial: ['proposta', 'email_apresentacao'],
    tecnico: ['proposta_tecnica', 'estudo_viabilidade', 'memorial', 'laudo', 'nota_tecnica'],
    contratual: ['contrato', 'ordem_servico', 'pedido_compras'],
    regulatorio_gestao: [
      'oficio',
      'procuracao',
      'requerimento',
      'ata_reuniao',
      'pac',
      'fnc',
      'relatorio_gerencial',
      'checklist',
      'cronograma',
    ],
    financeiro: ['fatura', 'recibo'],
  }

  // Filtragem de templates pela família ou macro-família
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchFamily = familyFilter === 'todas' || t.categoria === familyFilter
      const matchGroup =
        groupFilter === 'todos' ||
        (templateGroups[groupFilter] && templateGroups[groupFilter].includes(t.categoria))
      return matchFamily && matchGroup
    })
  }, [templates, familyFilter, groupFilter])

  async function generate() {
    if (!template) return toast.error('Escolha um modelo')
    setSaving(true)
    try {
      const record = await createOne<DocumentoRecord>('documentos', {
        nome: name || template.nome,
        tipo: template.categoria,
        modelo: template.id,
        cliente: clientId || undefined,
        projeto: projectId || undefined,
        processo: processId || undefined,
        versao: 'REV001',
        status: 'gerado',
        gerado_de_template: true,
        conteudo: renderedContent,
      })
      setSaved(record)
      toast.success('Documento gerado e salvo com sucesso!')
    } catch {
      toast.error('Não foi possível gerar o documento')
    } finally {
      setSaving(false)
    }
  }

  async function sendSignature() {
    if (!saved || !signatureLink) return
    try {
      new URL(signatureLink)
      const updated = await updateOne<DocumentoRecord>('documentos', saved.id, {
        status: 'enviado_assinatura',
        link_assinatura: signatureLink,
      })
      setSaved(updated)
      setSignatureOpen(false)
      toast.success('Documento marcado como enviado para assinatura')
    } catch {
      toast.error('Informe um link válido')
    }
  }

  async function markSigned() {
    if (!saved) return
    try {
      setSaved(await updateOne<DocumentoRecord>('documentos', saved.id, { status: 'assinado' }))
      toast.success('Documento marcado como assinado')
    } catch {
      toast.error('Não foi possível atualizar o documento')
    }
  }

  return (
    <div className="pb-12">
      <Button variant="ghost" asChild className="mb-4 -ml-3">
        <Link to="/documentos">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao catálogo de documentos
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="technical-label">MÓDULO DE DOCUMENTOS AEROCAD®</p>
          <h1 className="text-2xl font-bold text-[#333]">Gerador Oficial de Documentos</h1>
          <p className="mt-1 text-sm text-[#666]">
            Modelos fiéis para Propostas Comerciais, Propostas Técnicas, Contratos e Peças
            Regulatórias A4.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOrientation((o) => (o === 'portrait' ? 'landscape' : 'portrait'))}
            className="border-[#D0D0D0]"
          >
            {orientation === 'landscape' ? (
              <>
                <Minimize2 className="mr-2 h-4 w-4 text-[#FF6A13]" />
                Modo Retrato (A4)
              </>
            ) : (
              <>
                <Maximize2 className="mr-2 h-4 w-4 text-[#FF6A13]" />
                Modo Paisagem (Gantt)
              </>
            )}
          </Button>

          {template?.categoria === 'email_apresentacao' ||
          template?.nome.toLowerCase().includes('e-mail') ? (
            <Button
              onClick={() => {
                // Remove tags HTML e copia texto limpo
                const tempDiv = document.createElement('div')
                tempDiv.innerHTML = renderedContent
                const plainText = tempDiv.innerText || tempDiv.textContent || ''
                void navigator.clipboard.writeText(plainText).then(() => {
                  toast.success('Texto do e-mail copiado para a área de transferência!')
                })
              }}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar E-mail
            </Button>
          ) : null}

          <Button
            onClick={() => window.print()}
            disabled={!template}
            className="bg-[#2D2D2D] hover:bg-[#1A1A1A] text-white"
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
        {/* Painel lateral de configuração */}
        <aside className="space-y-5">
          <section className="crm-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF6A13] text-xs font-bold text-white">
                  1
                </span>
                <h2 className="font-bold text-sm">Família e Modelo</h2>
              </div>
              <span className="text-[11px] font-mono text-[#888]">
                {filteredTemplates.length} disponíveis
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-[#666]">Organização por Família</Label>
                <div className="grid grid-cols-3 gap-1 mt-1 text-[11px]">
                  <Button
                    type="button"
                    variant={groupFilter === 'todos' ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 px-2 text-[10px] ${groupFilter === 'todos' ? 'bg-[#FF6A13] text-white' : ''}`}
                    onClick={() => {
                      setGroupFilter('todos')
                      setFamilyFilter('todas')
                    }}
                  >
                    Todos
                  </Button>
                  <Button
                    type="button"
                    variant={groupFilter === 'comercial' ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 px-2 text-[10px] ${groupFilter === 'comercial' ? 'bg-[#FF6A13] text-white' : ''}`}
                    onClick={() => {
                      setGroupFilter('comercial')
                      setFamilyFilter('todas')
                    }}
                  >
                    Comercial
                  </Button>
                  <Button
                    type="button"
                    variant={groupFilter === 'tecnico' ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 px-2 text-[10px] ${groupFilter === 'tecnico' ? 'bg-[#FF6A13] text-white' : ''}`}
                    onClick={() => {
                      setGroupFilter('tecnico')
                      setFamilyFilter('todas')
                    }}
                  >
                    Técnico
                  </Button>
                  <Button
                    type="button"
                    variant={groupFilter === 'contratual' ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 px-2 text-[10px] ${groupFilter === 'contratual' ? 'bg-[#FF6A13] text-white' : ''}`}
                    onClick={() => {
                      setGroupFilter('contratual')
                      setFamilyFilter('todas')
                    }}
                  >
                    Contratual
                  </Button>
                  <Button
                    type="button"
                    variant={groupFilter === 'regulatorio_gestao' ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 px-2 text-[10px] ${groupFilter === 'regulatorio_gestao' ? 'bg-[#FF6A13] text-white' : ''}`}
                    onClick={() => {
                      setGroupFilter('regulatorio_gestao')
                      setFamilyFilter('todas')
                    }}
                  >
                    Regulatório
                  </Button>
                  {canSeeFinance && (
                    <Button
                      type="button"
                      variant={groupFilter === 'financeiro' ? 'default' : 'outline'}
                      size="sm"
                      className={`h-7 px-2 text-[10px] ${groupFilter === 'financeiro' ? 'bg-[#FF6A13] text-white' : ''}`}
                      onClick={() => {
                        setGroupFilter('financeiro')
                        setFamilyFilter('todas')
                      }}
                    >
                      Financeiro
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs text-[#666]">Filtrar por Categoria Específica</Label>
                <Select value={familyFilter} onValueChange={setFamilyFilter}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as categorias</SelectItem>
                    <SelectItem value="proposta">PC — Proposta Comercial</SelectItem>
                    <SelectItem value="proposta_tecnica">PT — Proposta Técnica</SelectItem>
                    <SelectItem value="contrato">CT — Contratos</SelectItem>
                    <SelectItem value="ordem_servico">OS — Ordens de Serviço</SelectItem>
                    <SelectItem value="oficio">OF — Ofícios</SelectItem>
                    <SelectItem value="memorial">MD / MC — Memoriais</SelectItem>
                    <SelectItem value="laudo">LT — Laudos / Pareceres</SelectItem>
                    <SelectItem value="relatorio_gerencial">RG — Relatório Gerencial</SelectItem>
                    <SelectItem value="ata_reuniao">AT — Atas de Reunião</SelectItem>
                    <SelectItem value="pac">PAC — Plano de Ação Corretiva</SelectItem>
                    <SelectItem value="fnc">FNC — Ficha Não Conformidade</SelectItem>
                    <SelectItem value="requerimento">RQ — Requerimentos</SelectItem>
                    <SelectItem value="procuracao">PR — Procurações</SelectItem>
                    {canSeeFinance && (
                      <>
                        <SelectItem value="fatura">FT — Faturas</SelectItem>
                        <SelectItem value="recibo">RB — Recibos</SelectItem>
                      </>
                    )}
                    <SelectItem value="estudo_viabilidade">EVA — Estudo de Viabilidade</SelectItem>
                    <SelectItem value="pedido_compras">PO — Pedido de Compras</SelectItem>
                    <SelectItem value="email_apresentacao">EML — E-mail de Apresentação</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-[#666]">Modelo Selecionado</Label>
                <Select
                  value={templateId || undefined}
                  onValueChange={(id) => {
                    setTemplateId(id)
                    setSaved(null)
                    setName('')
                  }}
                >
                  <SelectTrigger className="mt-1 font-medium">
                    <SelectValue placeholder="Escolha o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTemplates.length > 0 ? (
                      filteredTemplates.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="py-2 px-3 text-xs text-muted-foreground">
                        Nenhum modelo nesta categoria
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Seletor de variante quando for Proposta Comercial */}
              {template?.categoria === 'proposta' && (
                <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3 mt-2">
                  <Label className="text-xs font-bold text-[#E85B06] flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5" />
                    Variante de Proposta Comercial
                  </Label>
                  <Select value={pcVariant} onValueChange={(v: any) => setPcVariant(v)}>
                    <SelectTrigger className="mt-1.5 h-8 bg-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multi_modulo">
                        Multi-Módulo RFQ (SBFL — Módulos A, B, C, D e Marcos M1-M10)
                      </SelectItem>
                      <SelectItem value="simples">
                        Simples (OPEA / Cadastro / Medição única ou 2-3 parcelas)
                      </SelectItem>
                      <SelectItem value="duas_opcoes">
                        Duas Opções (Módulo a módulo × Turnkey completo)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Opções específicas para EVA */}
              {(template?.categoria === 'estudo_viabilidade' ||
                template?.nome.toLowerCase().includes('viabilidade') ||
                template?.nome.includes('EVA')) && (
                <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3 mt-2">
                  <Label className="text-xs font-bold text-[#E85B06] block mb-1">
                    Regra Seção J — Responsável Técnico & ART
                  </Label>
                  <label className="flex items-center gap-2 text-xs text-[#333] cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={evaMencionarArt}
                      onChange={(e) => setEvaMencionarArt(e.target.checked)}
                      className="rounded border-gray-300 text-[#FF6A13] focus:ring-[#FF6A13]"
                    />
                    Mencionar ART no bloco de assinatura (desmarque quando não aplicável)
                  </label>
                  <p className="text-[10px] text-[#666] mt-1">
                    Regra J: Quando não aplicável ao pedido, o bloco do RT omite menção à ART.
                  </p>
                </div>
              )}

              {/* Opções de prazo de vencimento de NFS-e */}
              <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 mt-2">
                <Label className="text-xs font-bold text-[#444] flex items-center justify-between">
                  <span>Regra de Vencimento da NFS-e</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    Seção J.1 item 8
                  </span>
                </Label>
                <Select
                  value={vencimentoDiasNfe}
                  onValueChange={(val: '30' | '60') => setVencimentoDiasNfe(val)}
                >
                  <SelectTrigger className="mt-1.5 h-8 bg-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 dias corridos (Padrão AEROCAD)</SelectItem>
                    <SelectItem value="60">
                      60 dias corridos (Regra do Cliente — ex.: Alcoa)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="crm-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF6A13] text-xs font-bold text-white">
                2
              </span>
              <h2 className="font-bold text-sm">Vínculo de Contexto CRM</h2>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-[#666]">Projeto Referência</Label>
                <Select
                  value={projectId || undefined}
                  onValueChange={(val) => setProjectId(val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione um projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum projeto (usar dados de exemplo)</SelectItem>
                    {projects.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.numero} · {i.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {canSeeClients ? (
                <div>
                  <Label className="text-xs text-[#666]">Cliente / Contratante</Label>
                  <Select
                    value={clientId || undefined}
                    onValueChange={(val) => setClientId(val === 'none' ? '' : val)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum cliente (usar dados de exemplo)</SelectItem>
                      {clients.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label className="text-xs text-[#666]">Cliente / Contratante</Label>
                  <Input
                    value={project?.expand?.cliente?.razao_social || 'Definido pelo projeto'}
                    disabled
                    className="mt-1 bg-neutral-100 text-xs"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs text-[#666]">Processo Regulatório (Opcional)</Label>
                <Select
                  value={processId || undefined}
                  onValueChange={(val) => setProcessId(val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o processo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum processo vinculado</SelectItem>
                    {processes.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.numero_protocolo || i.orgao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="crm-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF6A13] text-xs font-bold text-white">
                3
              </span>
              <h2 className="font-bold text-sm">Identificação do Arquivo</h2>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-[#666]">Nome do Documento / Nomenclatura Padrão</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-[#888]">
                Padrão AEROCAD:{' '}
                <code>
                  AEROCAD_&lt;PREFIXO&gt;_&lt;NUM&gt;_&lt;ANO&gt;_&lt;CLIENTE&gt;_v&lt;HHMMSS&gt;
                </code>
              </p>
            </div>
          </section>

          {/* Ações de salvamento */}
          <div className="space-y-3 pt-1">
            <Button
              onClick={generate}
              disabled={!template || saving}
              className="w-full bg-[#FF6A13] hover:bg-[#E85B06] text-white shadow"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Gravando no CRM...' : 'Salvar no CRM e Gerar Documento'}
            </Button>

            {saved && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 animate-in fade-in">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Documento gravado no repositório
                </div>
                <p className="mt-1 text-xs text-emerald-700">
                  ID: {saved.id} · Status: {saved.status}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white"
                    onClick={() => setSignatureOpen(true)}
                  >
                    <Link2 className="mr-2 h-3.5 w-3.5" />
                    Link de Assinatura
                  </Button>
                  {saved.status === 'enviado_assinatura' && (
                    <Button size="sm" onClick={markSigned}>
                      Marcar Assinado
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Pré-visualização A4 */}
        <section className="overflow-auto rounded-xl border bg-[#EFEFEF] p-4 sm:p-8">
          <div className="mb-3 flex items-center justify-between text-xs text-[#666]">
            <span className="flex items-center gap-2 font-mono">
              <span className="h-2 w-2 rounded-full bg-[#FF6A13]" />
              Formato:{' '}
              {orientation === 'landscape'
                ? 'A4 Paisagem (297 × 210 mm)'
                : 'A4 Retrato (210 × 297 mm)'}
            </span>
            <span>Identidade Visual AEROCAD® · Safety Orange #FF6A13</span>
          </div>

          <article
            id="print-document"
            className={`relative mx-auto bg-white shadow-2xl transition-all ${
              orientation === 'landscape'
                ? 'min-h-[794px] w-full max-w-[1123px] p-[40px] sm:p-[50px] landscape-mode'
                : 'min-h-[1123px] w-full max-w-[794px] p-[50px] sm:p-[64px]'
            }`}
            style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
          >
            {/* Cabeçalho Institucional AEROCAD */}
            <header className="flex items-end justify-between border-b-2 border-[#FF6A13] pb-4">
              <div className="aerocad-logo-header-wrapper shrink-0">
                <AerocadLogo
                  className="h-9 w-auto max-w-[200px] object-contain block"
                  style={{ maxHeight: '38px', maxWidth: '200px', width: 'auto', height: '38px' }}
                />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#FF6A13]">
                  {INSTITUTIONAL_DATA.nomeComercial}
                </p>
                <p className="mt-1 font-mono text-[11px] font-semibold text-[#444]">
                  {project?.numero || INSTITUTIONAL_DATA.nomeComercial}
                </p>
              </div>
            </header>

            {/* Conteúdo Renderizado */}
            <div
              className="document-body mt-8 text-[#222]"
              dangerouslySetInnerHTML={{
                __html:
                  renderedContent ||
                  '<div style="text-align:center;padding:120px 20px;color:#999"><h2>Pré-visualização do Documento</h2><p>Escolha um modelo para carregar.</p></div>',
              }}
            />

            {/* Rodapé Institucional com dados bancários e endereço */}
            <footer className="mt-14 border-t border-[#D9D9D9] pt-3 text-[9px] text-[#777]">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[#555]">
                  {INSTITUTIONAL_DATA.nomeComercial} · {INSTITUTIONAL_DATA.razaoSocial} · CNPJ{' '}
                  {INSTITUTIONAL_DATA.cnpj}
                </span>
                <span className="font-mono text-[#888]">
                  Brasília – DF · Emissão: {formatDate(new Date())}
                </span>
              </div>
              <p className="mt-1">{INSTITUTIONAL_DATA.endereco}</p>
              <p className="mt-0.5">
                Tel: {INSTITUTIONAL_DATA.telefone} · {INSTITUTIONAL_DATA.email} · CHAVE PIX (CNPJ):{' '}
                {INSTITUTIONAL_DATA.chavePix}
              </p>
            </footer>
          </article>
        </section>
      </div>

      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link para Assinatura Eletrônica</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Link do documento na plataforma (Clicksign, DocuSign ou similar)</Label>
            <Input
              type="url"
              value={signatureLink}
              onChange={(e) => setSignatureLink(e.target.value)}
              placeholder="https://"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignatureOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={sendSignature} className="bg-[#FF6A13] hover:bg-[#E85B06]">
              Salvar Link e Marcar Enviado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
