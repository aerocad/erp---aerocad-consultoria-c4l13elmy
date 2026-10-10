import { useState, useTransition, type ChangeEvent, type DragEvent } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileArchive,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FileUp,
  FileWarning,
  Layers,
  Link as LinkIcon,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  Sparkles,
  UploadCloud,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  COLUNAS_NFSE_MAPEAMENTO,
  parsePlanilhaNfse,
  type NfseDadoExtraido,
} from '@/services/nfseParser'
import {
  processarArquivosEmLote,
  type ArquivoLoteEstatistica,
  type ArquivoNaoReconhecido,
} from '@/services/nfseBatchParser'
import {
  carregarContextoCorrelacao,
  correlacionarNotas,
  type ContextoCorrelacaoDb,
  type NotaCorrelacionada,
} from '@/services/nfseCorrelacionador'
import {
  agruparECorrelacionarTomadores,
  type TomadorExtraidoNfse,
} from '@/services/nfseClienteCorrelacionador'
import {
  executarGravacaoNfse,
  type NfseExecucaoResultado,
  type ProgressoNfse,
} from '@/services/nfseExecutor'

export interface ImportacaoNfseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete?: (resultado: NfseExecucaoResultado) => void
}

type EtapaWizard = 'upload' | 'conferencia' | 'mapeamento' | 'correlacao' | 'execucao' | 'resultado'

export function ImportacaoNfseModal({
  open,
  onOpenChange,
  onImportComplete,
}: ImportacaoNfseModalProps) {
  const [, startTransition] = useTransition()
  const [etapa, setEtapa] = useState<EtapaWizard>('upload')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Metadados do lote
  const [arquivosProcessados, setArquivosProcessados] = useState<ArquivoLoteEstatistica[]>([])
  const [arquivosNaoReconhecidos, setArquivosNaoReconhecidos] = useState<ArquivoNaoReconhecido[]>(
    [],
  )
  const [temPlanilhasNoLote, setTemPlanilhasNoLote] = useState(false)
  const [resumoArquivosTexto, setResumoArquivosTexto] = useState('')

  // Mapeamento de colunas (caso planilha esteja presente no lote)
  const [colunasDetectadas, setColunasDetectadas] = useState<string[]>([])
  const [mapaColunas, setMapaColunas] = useState<Record<string, string>>({})
  const [linhasBrutasPlanilha, setLinhasBrutasPlanilha] = useState<Record<string, unknown>[]>([])

  // Dados extraídos e correlação de notas
  const [contextoDb, setContextoDb] = useState<ContextoCorrelacaoDb | null>(null)
  const [todasNotasExtraidas, setTodasNotasExtraidas] = useState<NfseDadoExtraido[]>([])
  const [notasCorrelacionadas, setNotasCorrelacionadas] = useState<NotaCorrelacionada[]>([])
  const [filtroAbaCorrelacao, setFiltroAbaCorrelacao] = useState<
    'todas' | 'correlacionadas' | 'ambiguas' | 'orfas'
  >('todas')
  const [atualizarExistentes, setAtualizarExistentes] = useState(false)

  // Clientes extraídos dos tomadores das notas
  const [tomadoresExtraidos, setTomadoresExtraidos] = useState<TomadorExtraidoNfse[]>([])
  const [abaExibicaoCorrelacao, setAbaExibicaoCorrelacao] = useState<'clientes' | 'notas'>(
    'clientes',
  )
  const [filtroTomadorStatus, setFiltroTomadorStatus] = useState<
    'todos' | 'novo' | 'existente' | 'conflito'
  >('todos')
  const [buscaTomador, setBuscaTomador] = useState('')

  // Execução
  const [progresso, setProgresso] = useState<ProgressoNfse | null>(null)
  const [resultadoFinal, setResultadoFinal] = useState<NfseExecucaoResultado | null>(null)
  const [isGravando, setIsGravando] = useState(false)

  function resetarEstado() {
    setEtapa('upload')
    setArquivos([])
    setIsProcessingFile(false)
    setIsDragging(false)
    setArquivosProcessados([])
    setArquivosNaoReconhecidos([])
    setTemPlanilhasNoLote(false)
    setResumoArquivosTexto('')
    setColunasDetectadas([])
    setMapaColunas({})
    setLinhasBrutasPlanilha([])
    setContextoDb(null)
    setTodasNotasExtraidas([])
    setNotasCorrelacionadas([])
    setTomadoresExtraidos([])
    setAbaExibicaoCorrelacao('clientes')
    setFiltroTomadorStatus('todos')
    setBuscaTomador('')
    setProgresso(null)
    setResultadoFinal(null)
    setIsGravando(false)
  }

  async function processarListaArquivos(lista: File[]) {
    if (!lista || lista.length === 0) return

    setArquivos(lista)
    setIsProcessingFile(true)

    const nomesTexto =
      lista.length === 1
        ? lista[0].name
        : `${lista.length} arquivos (${lista
            .map((f) => f.name)
            .slice(0, 3)
            .join(', ')}${lista.length > 3 ? '...' : ''})`
    setResumoArquivosTexto(nomesTexto)

    try {
      const [resLote, contexto] = await Promise.all([
        processarArquivosEmLote(lista),
        carregarContextoCorrelacao(),
      ])

      setContextoDb(contexto)
      setArquivosProcessados(resLote.arquivosProcessados)
      setArquivosNaoReconhecidos(resLote.arquivosNaoReconhecidos)
      setTemPlanilhasNoLote(resLote.temPlanilhas)
      setTodasNotasExtraidas(resLote.notas)

      if (resLote.temPlanilhas) {
        setColunasDetectadas(resLote.colunasDetectadasPlanilha || [])
        setMapaColunas(resLote.mapaColunasPlanilha || {})
        setLinhasBrutasPlanilha(resLote.linhasPlanilhaBrutas || [])
      }

      if (resLote.notas.length === 0) {
        if (resLote.arquivosNaoReconhecidos.length > 0) {
          toast.warning(
            'Nenhuma nota fiscal foi extraída dos arquivos enviados. Verifique a lista de avisos.',
          )
          setEtapa('conferencia')
          return
        }
        throw new Error('Nenhuma NFS-e válida foi localizada no arquivo ou lote selecionado.')
      }

      // 1. Correlaciona as notas extraídas com as parcelas/projetos do CRM
      const correlacao = correlacionarNotas(resLote.notas, contexto)
      setNotasCorrelacionadas(correlacao)

      // 2. Extrai e correlaciona tomadores com os clientes existentes no CRM
      const tomadores = agruparECorrelacionarTomadores(resLote.notas, contexto.clientes)
      setTomadoresExtraidos(tomadores)

      if (resLote.arquivosNaoReconhecidos.length > 0) {
        setEtapa('conferencia')
        toast.info(
          `${resLote.notas.length} notas extraídas com sucesso (${tomadores.length} clientes distintos identificados). ${resLote.arquivosNaoReconhecidos.length} itens não reconhecidos foram ignorados.`,
        )
      } else if (
        resLote.temPlanilhas &&
        (!resLote.mapaColunasPlanilha?.numero || !resLote.mapaColunasPlanilha?.valorBruto)
      ) {
        setEtapa('mapeamento')
      } else {
        setEtapa('correlacao')
        toast.success(
          `Lote processado com sucesso: ${resLote.notas.length} notas fiscais carregadas (${tomadores.length} tomadores/clientes extraídos).`,
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao ler arquivos de NFS-e: ' + msg)
    } finally {
      setIsProcessingFile(false)
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const arrayFiles = Array.from(fileList)
    void processarListaArquivos(arrayFiles)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const dt = e.dataTransfer
    if (!dt || !dt.files || dt.files.length === 0) return
    const arrayFiles = Array.from(dt.files)
    void processarListaArquivos(arrayFiles)
  }

  function handleReaplicarMapeamento() {
    if (!linhasBrutasPlanilha.length || !contextoDb) return
    const notasDaPlanilha = parsePlanilhaNfse(linhasBrutasPlanilha, mapaColunas)
    const notasXml = todasNotasExtraidas.filter((n) => n.origemArquivo === 'xml')
    const combinadas = [...notasXml, ...notasDaPlanilha]
    setTodasNotasExtraidas(combinadas)

    const correlacao = correlacionarNotas(combinadas, contextoDb)
    setNotasCorrelacionadas(correlacao)

    const tomadores = agruparECorrelacionarTomadores(combinadas, contextoDb.clientes)
    setTomadoresExtraidos(tomadores)

    setEtapa('correlacao')
  }

  function selecionarParcelaManualmente(notaIndex: number, parcelaId: string) {
    setNotasCorrelacionadas((prev) => {
      const copy = [...prev]
      const item = { ...copy[notaIndex] }
      item.parcelaSelecionadaId = parcelaId
      item.status = 'CORRELACIONADA'
      item.acao = 'vincular'
      copy[notaIndex] = item
      return copy
    })
  }

  function toggleIgnorarNota(notaIndex: number) {
    setNotasCorrelacionadas((prev) => {
      const copy = [...prev]
      const item = { ...copy[notaIndex] }
      item.acao = item.acao === 'ignorar' ? 'vincular' : 'ignorar'
      copy[notaIndex] = item
      return copy
    })
  }

  // Ações em massa para tomadores/clientes
  function handleCriarTodosClientesNovos() {
    setTomadoresExtraidos((prev) =>
      prev.map((t) => (t.status === 'novo' ? { ...t, acao: 'criar' } : t)),
    )
    toast.success('Todos os clientes novos foram marcados para criação.')
  }

  function handleVincularTodosAutomaticosCnpj() {
    let count = 0
    setTomadoresExtraidos((prev) =>
      prev.map((t) => {
        if (t.clienteExistente) {
          count++
          return {
            ...t,
            acao: 'vincular',
            clienteIdDestino: t.clienteExistente.id,
          }
        }
        return t
      }),
    )
    toast.success(
      `${count} clientes correspondentes vinculados automaticamente por CNPJ/Razão Social.`,
    )
  }

  // Ações individuais por tomador
  function setAcaoTomador(chaveGrupo: string, acao: 'criar' | 'vincular' | 'ignorar') {
    setTomadoresExtraidos((prev) =>
      prev.map((t) => {
        if (t.chaveGrupo !== chaveGrupo) return t
        const novoDestino =
          acao === 'vincular' ? t.clienteIdDestino || t.clienteExistente?.id : t.clienteIdDestino
        return { ...t, acao, clienteIdDestino: novoDestino }
      }),
    )
  }

  function setClienteDestinoTomador(chaveGrupo: string, clienteId: string) {
    setTomadoresExtraidos((prev) =>
      prev.map((t) => {
        if (t.chaveGrupo !== chaveGrupo) return t
        return { ...t, acao: 'vincular', clienteIdDestino: clienteId }
      }),
    )
  }

  function toggleAtualizarFaltantesTomador(chaveGrupo: string) {
    setTomadoresExtraidos((prev) =>
      prev.map((t) => {
        if (t.chaveGrupo !== chaveGrupo) return t
        return { ...t, atualizarDadosFaltantes: !t.atualizarDadosFaltantes }
      }),
    )
  }

  async function dispararImportacao() {
    if (!arquivos.length || !notasCorrelacionadas.length) return
    setIsGravando(true)
    setEtapa('execucao')

    const nomeLotePrincipal =
      arquivos.length === 1
        ? arquivos[0].name
        : `Lote_${arquivos.length}_arquivos_${new Date().toISOString().slice(0, 10)}.zip`
    const tamanhoTotal = arquivos.reduce((acc, f) => acc + f.size, 0)

    try {
      const res = await executarGravacaoNfse(
        notasCorrelacionadas,
        {
          arquivoNome: nomeLotePrincipal,
          tamanhoBytes: tamanhoTotal,
          atualizarExistentes,
          tomadoresConfigurados: tomadoresExtraidos,
        },
        (prog) => setProgresso(prog),
      )
      setResultadoFinal(res)
      setEtapa('resultado')
      onImportComplete?.(res)

      const detalhesMsg = [
        `${res.vinculadas} notas vinculadas`,
        res.atualizadas > 0 ? `${res.atualizadas} atualizadas` : null,
        res.clientesCriados > 0 ? `${res.clientesCriados} novo(s) cliente(s) criado(s)` : null,
        res.clientesAtualizados > 0 ? `${res.clientesAtualizados} cliente(s) atualizado(s)` : null,
      ]
        .filter(Boolean)
        .join(', ')

      toast.success(`Importação do lote concluída com sucesso: ${detalhesMsg}.`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro na gravação do lote de notas: ' + msg)
    } finally {
      setIsGravando(false)
    }
  }

  // Contadores de correlação das notas
  const totalCorrelacionadas = notasCorrelacionadas.filter(
    (n) => n.status === 'CORRELACIONADA' && n.acao === 'vincular',
  ).length
  const totalAmbiguas = notasCorrelacionadas.filter(
    (n) => n.status === 'AMBÍGUA' && n.acao === 'vincular',
  ).length
  const totalOrfas = notasCorrelacionadas.filter(
    (n) => n.status === 'NÃO ENCONTRADA' || n.acao === 'ignorar',
  ).length

  // Contadores dos tomadores/clientes
  const totalTomadores = tomadoresExtraidos.length
  const tomadoresNovos = tomadoresExtraidos.filter((t) => t.status === 'novo').length
  const tomadoresExistentes = tomadoresExtraidos.filter((t) => t.status === 'existente').length
  const tomadoresConflito = tomadoresExtraidos.filter((t) => t.status === 'conflito').length
  const tomadoresParaCriar = tomadoresExtraidos.filter((t) => t.acao === 'criar').length

  const notasFiltradas = notasCorrelacionadas.filter((item) => {
    if (filtroAbaCorrelacao === 'correlacionadas') {
      return item.status === 'CORRELACIONADA' && item.acao === 'vincular'
    }
    if (filtroAbaCorrelacao === 'ambiguas') {
      return item.status === 'AMBÍGUA' && item.acao === 'vincular'
    }
    if (filtroAbaCorrelacao === 'orfas') {
      return item.status === 'NÃO ENCONTRADA' || item.acao === 'ignorar'
    }
    return true
  })

  const tomadoresFiltrados = tomadoresExtraidos.filter((t) => {
    if (filtroTomadorStatus !== 'todos' && t.status !== filtroTomadorStatus) {
      return false
    }
    if (buscaTomador.trim()) {
      const q = buscaTomador.toLowerCase()
      const haystack = `${t.razaoSocial} ${t.cnpjCpf} ${t.municipio} ${t.uf}`.toLowerCase()
      return haystack.includes(q)
    }
    return true
  })

  const loteTemZip = arquivos.some((f) => f.name.toLowerCase().endsWith('.zip'))

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetarEstado()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Cabeçalho */}
        <DialogHeader className="p-5 border-b bg-[#FAFAFA]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="technical-label flex items-center gap-1.5 text-[#FF6A13]">
                <FileSpreadsheet className="h-4 w-4" />
                MÓDULO FINANCEIRO · IMPORTADOR DE NFS-E EM LOTE
              </p>
              <DialogTitle className="text-xl font-bold text-[#1F1F1F]">
                Importação de NFS-e & Extração de Clientes
              </DialogTitle>
              <DialogDescription className="text-xs text-[#737373] mt-0.5">
                Envie arquivos <strong>.ZIP</strong> com múltiplos XMLs, XMLs avulsos ou planilhas.
                Extrai automaticamente os dados cadastrais dos clientes e correlaciona com as
                parcelas.
              </DialogDescription>
            </div>
            {resumoArquivosTexto && (
              <CrmBadge tone="orange" className="font-mono text-xs max-w-[240px] truncate">
                {resumoArquivosTexto}
              </CrmBadge>
            )}
          </div>
        </DialogHeader>

        {/* Conteúdo dinâmico por etapa */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ==================================================== */}
          {/* ETAPA 1: UPLOAD */}
          {/* ==================================================== */}
          {etapa === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
                  isDragging
                    ? 'border-[#FF6A13] bg-[#FFF2E8]'
                    : 'border-[#FFD2B3] bg-[#FFFBF8] hover:bg-[#FFF6EC]'
                }`}
              >
                <input
                  type="file"
                  id="nfse-upload-input"
                  className="hidden"
                  multiple
                  accept=".zip,.xml,.xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                  disabled={isProcessingFile}
                />
                <label
                  htmlFor="nfse-upload-input"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <div className="h-14 w-14 rounded-full bg-orange-100 flex items-center justify-center text-[#FF6A13] mb-3">
                    {isProcessingFile ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : (
                      <UploadCloud className="h-7 w-7" />
                    )}
                  </div>
                  <h3 className="text-base font-bold text-[#1F1F1F]">
                    {isProcessingFile
                      ? 'Descompactando lote e analisando notas fiscais e clientes...'
                      : 'Clique ou arraste um arquivo ZIP ou XMLs de NFS-e aqui'}
                  </h3>
                  <p className="mt-1 text-xs text-[#737373] max-w-lg">
                    Formatos suportados: pacote <strong>.ZIP</strong> com múltiplos XMLs/planilhas,{' '}
                    <strong>XMLs individuais</strong> (ABRASF ou GDF) ou{' '}
                    <strong>planilhas XLSX / CSV</strong> exportadas dos portais. Limite de até 50
                    MB por pacote.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <Button
                      type="button"
                      disabled={isProcessingFile}
                      className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
                    >
                      <FileUp className="mr-2 h-4 w-4" />
                      Selecionar Arquivos (ZIP / XML / Planilhas)
                    </Button>
                  </div>
                  <span className="mt-2 text-[11px] text-[#888]">
                    Dica: o importador extrai automaticamente os dados do tomador (CNPJ, Razão
                    Social, Endereço e Contato) para criar ou enriquecer clientes.
                  </span>
                </label>
              </div>

              {/* Informações dos pilares */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="crm-card p-4 bg-orange-50/40 border-orange-200">
                  <div className="flex items-center gap-2 text-[#FF6A13] font-bold text-xs uppercase tracking-wide">
                    <FileArchive className="h-4 w-4" />
                    1. Descompactação no Navegador
                  </div>
                  <p className="mt-2 text-xs text-[#555] leading-relaxed">
                    Extrai dezenas de XMLs diretamente no browser, filtrando pastas e arquivos
                    desnecessários.
                  </p>
                </div>
                <div className="crm-card p-4 bg-emerald-50/40 border-emerald-200">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wide">
                    <Users className="h-4 w-4" />
                    2. Extração de Clientes
                  </div>
                  <p className="mt-2 text-xs text-[#555] leading-relaxed">
                    Agrupa tomadores por CNPJ/CPF, detecta se já existem no CRM e cria clientes
                    novos com 1 clique.
                  </p>
                </div>
                <div className="crm-card p-4 bg-sky-50/40 border-sky-200">
                  <div className="flex items-center gap-2 text-sky-700 font-bold text-xs uppercase tracking-wide">
                    <Sparkles className="h-4 w-4" />
                    3. Correlação de Parcelas
                  </div>
                  <p className="mt-2 text-xs text-[#555] leading-relaxed">
                    Cruza por AAAA-NNN, PC/PT, cliente e valor com tolerância fiscal para baixa e
                    faturamento.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* ETAPA 2: CONFERÊNCIA DO LOTE */}
          {/* ==================================================== */}
          {etapa === 'conferencia' && (
            <div className="space-y-5">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-[#1F1F1F] flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-[#FF6A13]" />
                      Conferência do Lote de Arquivos
                    </h4>
                    <p className="text-xs text-[#666] mt-0.5">
                      {todasNotasExtraidas.length} notas fiscais válidas extraídas (
                      {tomadoresExtraidos.length} tomadores/clientes distintos).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CrmBadge tone="green">{todasNotasExtraidas.length} NOTAS</CrmBadge>
                    <CrmBadge tone="orange">{tomadoresExtraidos.length} CLIENTES</CrmBadge>
                    {arquivosNaoReconhecidos.length > 0 && (
                      <CrmBadge tone="amber">{arquivosNaoReconhecidos.length} IGNORADOS</CrmBadge>
                    )}
                  </div>
                </div>
              </div>

              {arquivosProcessados.length > 0 && (
                <div className="space-y-2">
                  <h5 className="technical-label text-[#1F1F1F]">
                    ARQUIVOS PROCESSADOS COM SUCESSO ({arquivosProcessados.length})
                  </h5>
                  <div className="crm-card divide-y max-h-44 overflow-y-auto">
                    {arquivosProcessados.map((item, idx) => (
                      <div
                        key={idx}
                        className="px-4 py-2.5 flex items-center justify-between text-xs"
                      >
                        <span className="font-mono text-[#333] flex items-center gap-2 truncate">
                          {item.tipo === 'xml' ? (
                            <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          ) : (
                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          )}
                          {item.nome}
                        </span>
                        <CrmBadge tone="green">{item.qtdNotas} notas</CrmBadge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {arquivosNaoReconhecidos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="technical-label text-amber-800 flex items-center gap-1.5">
                      <FileWarning className="h-4 w-4 text-amber-600" />
                      ARQUIVOS NÃO RECONHECIDOS OU IGNORADOS ({arquivosNaoReconhecidos.length})
                    </h5>
                    <span className="text-[11px] text-amber-700">
                      O processamento do restante do lote continuou normalmente
                    </span>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/40 divide-y divide-amber-200 max-h-52 overflow-y-auto">
                    {arquivosNaoReconhecidos.map((arq, idx) => (
                      <div
                        key={idx}
                        className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <p className="font-mono font-semibold text-neutral-800 flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            {arq.caminho || arq.nome}
                          </p>
                          <p className="text-[11px] text-neutral-600">{arq.motivo}</p>
                        </div>
                        {arq.tamanho && (
                          <span className="text-[10px] text-neutral-400 font-mono shrink-0">
                            {(arq.tamanho / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t">
                <Button variant="outline" onClick={() => setEtapa('upload')}>
                  Voltar / Enviar Outro Lote
                </Button>
                <Button
                  disabled={todasNotasExtraidas.length === 0}
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
                  onClick={() => {
                    if (temPlanilhasNoLote && (!mapaColunas.numero || !mapaColunas.valorBruto)) {
                      setEtapa('mapeamento')
                    } else {
                      setEtapa('correlacao')
                    }
                  }}
                >
                  Continuar para Prévia ({todasNotasExtraidas.length} notas /{' '}
                  {tomadoresExtraidos.length} clientes)
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* ETAPA 3: MAPEAMENTO DE COLUNAS */}
          {/* ==================================================== */}
          {etapa === 'mapeamento' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-700" />
                <div>
                  <strong>Mapeamento de Planilha do Lote:</strong> O lote inclui planilha(s) de
                  notas fiscais. Verifique o mapeamento das colunas da nota e dos dados do tomador
                  (razão social, CNPJ, endereço e contato).
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(COLUNAS_NFSE_MAPEAMENTO).map(([campoKey, possiveis]) => {
                  const labelCampo = possiveis[0]
                  const valorAtual = mapaColunas[campoKey] || ''

                  return (
                    <div key={campoKey} className="crm-card p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#333]">
                          {labelCampo}
                          {['numero', 'valorBruto'].includes(campoKey) && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                        {valorAtual ? (
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Mapeado
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400">Não mapeado</span>
                        )}
                      </div>
                      <Select
                        value={valorAtual || '__vazio__'}
                        onValueChange={(val) => {
                          setMapaColunas((prev) => ({
                            ...prev,
                            [campoKey]: val === '__vazio__' ? '' : val,
                          }))
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione a coluna..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__vazio__">-- Não utilizar --</SelectItem>
                          {colunasDetectadas.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() =>
                    setEtapa(arquivosNaoReconhecidos.length > 0 ? 'conferencia' : 'upload')
                  }
                >
                  Voltar
                </Button>
                <Button
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
                  onClick={handleReaplicarMapeamento}
                >
                  Confirmar Mapeamento e Correlacionar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* ETAPA 4: PRÉVIA DA CORRELAÇÃO & CLIENTES EXTRAÍDOS */}
          {/* ==================================================== */}
          {etapa === 'correlacao' && (
            <div className="space-y-4">
              {/* Abas Superiores de Alternância: Dados dos Clientes vs Notas e Parcelas */}
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAbaExibicaoCorrelacao('clientes')}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition ${
                      abaExibicaoCorrelacao === 'clientes'
                        ? 'bg-[#FF6A13] text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    Dados dos Clientes Extraídos ({tomadoresExtraidos.length})
                    {tomadoresNovos > 0 && (
                      <span className="rounded-full bg-white/30 text-white text-[10px] px-1.5 py-0.2">
                        +{tomadoresNovos} novos
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setAbaExibicaoCorrelacao('notas')}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition ${
                      abaExibicaoCorrelacao === 'notas'
                        ? 'bg-[#FF6A13] text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Notas Fiscais & Parcelas ({notasCorrelacionadas.length})
                  </button>
                </div>

                <span className="text-[11px] text-neutral-500 font-mono hidden sm:inline">
                  {notasCorrelacionadas.length} NFS-e lidas · {tomadoresExtraidos.length} tomadores
                  distintos
                </span>
              </div>

              {/* CONTEÚDO DA ABA DE CLIENTES */}
              {abaExibicaoCorrelacao === 'clientes' && (
                <div className="space-y-4">
                  {/* KPIs dos Clientes Extraídos */}
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div
                      onClick={() => setFiltroTomadorStatus('todos')}
                      className={`crm-card p-3 cursor-pointer transition border-2 ${
                        filtroTomadorStatus === 'todos' ? 'border-[#FF6A13] bg-orange-50/20' : ''
                      }`}
                    >
                      <p className="technical-label">TOMADORES NO LOTE</p>
                      <p className="mono-value text-2xl font-bold mt-1 text-[#333]">
                        {totalTomadores}
                      </p>
                      <p className="text-[11px] text-[#777]">Distintos por CNPJ/CPF</p>
                    </div>

                    <div
                      onClick={() => setFiltroTomadorStatus('novo')}
                      className={`crm-card p-3 cursor-pointer transition border-2 ${
                        filtroTomadorStatus === 'novo' ? 'border-blue-500 bg-blue-50/20' : ''
                      }`}
                    >
                      <p className="technical-label text-blue-700">CLIENTES NOVOS</p>
                      <p className="mono-value text-2xl font-bold mt-1 text-blue-600">
                        {tomadoresNovos}
                      </p>
                      <p className="text-[11px] text-[#777]">Não constam na base CRM</p>
                    </div>

                    <div
                      onClick={() => setFiltroTomadorStatus('existente')}
                      className={`crm-card p-3 cursor-pointer transition border-2 ${
                        filtroTomadorStatus === 'existente'
                          ? 'border-emerald-500 bg-emerald-50/20'
                          : ''
                      }`}
                    >
                      <p className="technical-label text-emerald-700">CLIENTES EXISTENTES</p>
                      <p className="mono-value text-2xl font-bold mt-1 text-emerald-600">
                        {tomadoresExistentes}
                      </p>
                      <p className="text-[11px] text-[#777]">Identificados por CNPJ/Razão</p>
                    </div>

                    <div
                      onClick={() => setFiltroTomadorStatus('conflito')}
                      className={`crm-card p-3 cursor-pointer transition border-2 ${
                        filtroTomadorStatus === 'conflito' ? 'border-amber-500 bg-amber-50/20' : ''
                      }`}
                    >
                      <p className="technical-label text-amber-700">CONFLITOS / ATENÇÃO</p>
                      <p className="mono-value text-2xl font-bold mt-1 text-amber-600">
                        {tomadoresConflito}
                      </p>
                      <p className="text-[11px] text-[#777]">Mesmo CNPJ, razão diferente</p>
                    </div>
                  </div>

                  {/* Barra de Ações em Massa e Filtro de Clientes */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-neutral-50 rounded-xl border">
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <div className="relative w-full">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                        <Input
                          placeholder="Buscar tomador por nome ou CNPJ..."
                          value={buscaTomador}
                          onChange={(e) => setBuscaTomador(e.target.value)}
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleVincularTodosAutomaticosCnpj}
                        className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                        title="Vincula todos os tomadores que já existem por CNPJ ou nome coincidente"
                      >
                        <UserCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                        Vincular todos automáticos por CNPJ
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCriarTodosClientesNovos}
                        className="text-xs bg-[#FF6A13] hover:bg-[#E85B06] text-white"
                        title="Define a ação 'Criar novo cliente' para todos os tomadores novos"
                      >
                        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                        Criar todos novos de uma vez ({tomadoresNovos})
                      </Button>
                    </div>
                  </div>

                  {/* Lista de Tomadores */}
                  <div className="crm-card divide-y overflow-hidden max-h-[420px] overflow-y-auto">
                    {tomadoresFiltrados.length === 0 ? (
                      <div className="p-8 text-center text-xs text-neutral-500">
                        Nenhum tomador encontrado para o filtro selecionado.
                      </div>
                    ) : (
                      tomadoresFiltrados.map((tomador) => {
                        const isNovo = tomador.status === 'novo'
                        const isConflito = tomador.status === 'conflito'
                        const isExistente = tomador.status === 'existente'

                        return (
                          <div
                            key={tomador.chaveGrupo}
                            className={`p-4 transition ${
                              tomador.acao === 'ignorar'
                                ? 'bg-neutral-50/70 opacity-60'
                                : isConflito
                                  ? 'bg-amber-50/30'
                                  : isNovo
                                    ? 'bg-blue-50/20'
                                    : 'hover:bg-neutral-50/40'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              {/* Dados do Tomador */}
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-sm text-[#1F1F1F]">
                                    {tomador.razaoSocial}
                                  </span>
                                  {isNovo && <CrmBadge tone="blue">Cliente novo</CrmBadge>}
                                  {isExistente && (
                                    <CrmBadge tone="green">Cliente existente</CrmBadge>
                                  )}
                                  {isConflito && (
                                    <CrmBadge tone="amber">Conflito cadastral</CrmBadge>
                                  )}
                                  {tomador.acao === 'criar' && (
                                    <CrmBadge tone="orange">Ação: Criar novo</CrmBadge>
                                  )}
                                  {tomador.acao === 'vincular' && (
                                    <CrmBadge tone="green">Ação: Vincular</CrmBadge>
                                  )}
                                  {tomador.acao === 'ignorar' && (
                                    <CrmBadge tone="gray">Ação: Ignorar</CrmBadge>
                                  )}
                                </div>

                                <div className="text-xs text-[#555] space-y-1">
                                  <p className="flex flex-wrap gap-x-4">
                                    <span className="mono-value font-semibold">
                                      CNPJ/CPF:{' '}
                                      {tomador.cnpjCpfFormatado ||
                                        tomador.cnpjCpf ||
                                        'Não informado'}
                                    </span>
                                    <span>
                                      Tipo: <strong>{tomador.tipo.toUpperCase()}</strong>
                                    </span>
                                    <span>
                                      Notas no lote: <strong>{tomador.qtdNotas}</strong> (
                                      {tomador.numerosNotas.slice(0, 4).join(', ')}
                                      {tomador.numerosNotas.length > 4 ? '...' : ''})
                                    </span>
                                  </p>

                                  {(tomador.endereco || tomador.municipio || tomador.uf) && (
                                    <p className="text-neutral-600">
                                      <strong>Endereço:</strong>{' '}
                                      {[tomador.endereco, tomador.municipio, tomador.uf]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                  )}

                                  {(tomador.email || tomador.telefone) && (
                                    <p className="text-neutral-600 flex flex-wrap gap-x-3">
                                      {tomador.email && <span>Email: {tomador.email}</span>}
                                      {tomador.telefone && <span>Tel: {tomador.telefone}</span>}
                                    </p>
                                  )}

                                  <p className="text-[11px] text-neutral-500 italic">
                                    {tomador.motivoStatus}
                                  </p>
                                </div>
                              </div>

                              {/* Valor Total & Configuração de Ação */}
                              <div className="text-right sm:min-w-[240px] space-y-2">
                                <p className="mono-value font-bold text-base text-[#1F1F1F]">
                                  {formatCurrency(tomador.valorTotal)}
                                </p>
                                <p className="text-[11px] text-neutral-500">
                                  Volume total faturado no lote
                                </p>

                                <div className="space-y-1.5 text-left">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                                    Ação para este cliente:
                                  </label>
                                  <Select
                                    value={tomador.acao}
                                    onValueChange={(val: 'criar' | 'vincular' | 'ignorar') =>
                                      setAcaoTomador(tomador.chaveGrupo, val)
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="criar">Criar novo cliente</SelectItem>
                                      <SelectItem value="vincular">
                                        Vincular a cliente existente
                                      </SelectItem>
                                      <SelectItem value="ignorar">Ignorar este cliente</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  {/* Dropdown com busca quando for 'vincular' */}
                                  {tomador.acao === 'vincular' && (
                                    <div className="pt-1">
                                      <Select
                                        value={tomador.clienteIdDestino || ''}
                                        onValueChange={(val) =>
                                          setClienteDestinoTomador(tomador.chaveGrupo, val)
                                        }
                                      >
                                        <SelectTrigger className="h-8 text-xs bg-white">
                                          <SelectValue placeholder="Selecione o cliente..." />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-56">
                                          {contextoDb?.clientes.map((cli) => (
                                            <SelectItem key={cli.id} value={cli.id}>
                                              {cli.razao_social}{' '}
                                              {cli.cnpj_cpf ? `(${cli.cnpj_cpf})` : ''}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>

                                      <div className="flex items-center space-x-2 mt-1.5">
                                        <Checkbox
                                          id={`chk-faltantes-${tomador.chaveGrupo}`}
                                          checked={tomador.atualizarDadosFaltantes}
                                          onCheckedChange={() =>
                                            toggleAtualizarFaltantesTomador(tomador.chaveGrupo)
                                          }
                                        />
                                        <label
                                          htmlFor={`chk-faltantes-${tomador.chaveGrupo}`}
                                          className="text-[11px] text-[#444] cursor-pointer"
                                        >
                                          Preencher dados faltantes no cadastro
                                        </label>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* CONTEÚDO DA ABA DE NOTAS & PARCELAS */}
              {abaExibicaoCorrelacao === 'notas' && (
                <div className="space-y-4">
                  {/* Painel de Contadores Agregados das Notas */}
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div
                      onClick={() => setFiltroAbaCorrelacao('todas')}
                      className={`crm-card p-3.5 cursor-pointer transition border-2 ${
                        filtroAbaCorrelacao === 'todas' ? 'border-[#FF6A13] bg-orange-50/20' : ''
                      }`}
                    >
                      <p className="technical-label">TOTAL DO LOTE</p>
                      <p className="mono-value text-2xl font-bold mt-1 text-[#333]">
                        {notasCorrelacionadas.length}
                      </p>
                      <p className="text-[11px] text-[#777]">
                        Notas válidas extraídas{loteTemZip ? ' (ZIP)' : ''}
                      </p>
                    </div>
                    <div
                      onClick={() => setFiltroAbaCorrelacao('correlacionadas')}
                      className={`crm-card p-3.5 cursor-pointer transition border-2 ${
                        filtroAbaCorrelacao === 'correlacionadas'
                          ? 'border-emerald-500 bg-emerald-50/20'
                          : ''
                      }`}
                    >
                      <p className="technical-label text-emerald-700">CORRELACIONADAS</p>
                      <p className="mono-value text-2xl font-bold mt-1 text-emerald-600">
                        {totalCorrelacionadas}
                      </p>
                      <p className="text-[11px] text-[#777]">Parcela única identificada</p>
                    </div>
                    <div
                      onClick={() => setFiltroAbaCorrelacao('ambiguas')}
                      className={`crm-card p-3.5 cursor-pointer transition border-2 ${
                        filtroAbaCorrelacao === 'ambiguas' ? 'border-amber-500 bg-amber-50/20' : ''
                      }`}
                    >
                      <p className="technical-label text-amber-700">AMBÍGUAS</p>
                      <p className="mono-value text-2xl font-bold mt-1 text-amber-600">
                        {totalAmbiguas}
                      </p>
                      <p className="text-[11px] text-[#777]">2+ candidatas (escolha manual)</p>
                    </div>
                    <div
                      onClick={() => setFiltroAbaCorrelacao('orfas')}
                      className={`crm-card p-3.5 cursor-pointer transition border-2 ${
                        filtroAbaCorrelacao === 'orfas' ? 'border-sky-500 bg-sky-50/20' : ''
                      }`}
                    >
                      <p className="technical-label text-sky-700">NÃO ENCONTRADAS / ÓRFÃS</p>
                      <p className="mono-value text-2xl font-bold mt-1 text-sky-600">
                        {totalOrfas}
                      </p>
                      <p className="text-[11px] text-[#777]">Sem parcela correspondente</p>
                    </div>
                  </div>

                  {/* Opções e controles */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 rounded-xl border">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="chk-atualizar-existentes"
                        checked={atualizarExistentes}
                        onCheckedChange={(c) => setAtualizarExistentes(Boolean(c))}
                      />
                      <label
                        htmlFor="chk-atualizar-existentes"
                        className="text-xs font-semibold text-[#444] cursor-pointer"
                      >
                        Sobrescrever/Atualizar notas já importadas anteriormente
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      {arquivosNaoReconhecidos.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEtapa('conferencia')}
                          className="text-xs text-amber-700 hover:text-amber-800"
                        >
                          <FileWarning className="mr-1.5 h-3.5 w-3.5" />
                          Ver {arquivosNaoReconhecidos.length} arquivos ignorados
                        </Button>
                      )}
                      {temPlanilhasNoLote && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEtapa('mapeamento')}
                          className="text-xs"
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          Ajustar Colunas da Planilha
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Lista detalhada das notas */}
                  <div className="crm-card divide-y overflow-hidden max-h-[420px] overflow-y-auto">
                    {notasFiltradas.length === 0 ? (
                      <div className="p-8 text-center text-xs text-neutral-500">
                        Nenhuma nota fiscal encontrada para o filtro selecionado (
                        {filtroAbaCorrelacao.toUpperCase()}).
                      </div>
                    ) : (
                      notasFiltradas.map((item) => {
                        const globalIdx = notasCorrelacionadas.findIndex(
                          (n) => n.nota.idTemp === item.nota.idTemp,
                        )
                        const nota = item.nota
                        const isIgnorado = item.acao === 'ignorar'

                        return (
                          <div
                            key={nota.idTemp}
                            className={`p-4 transition ${
                              isIgnorado
                                ? 'bg-neutral-50/80 opacity-70'
                                : item.status === 'CORRELACIONADA'
                                  ? 'hover:bg-emerald-50/20'
                                  : item.status === 'AMBÍGUA'
                                    ? 'bg-amber-50/30'
                                    : 'bg-neutral-50/40'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="space-y-1 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="mono-value font-bold text-sm text-[#FF6A13]">
                                    NFS-e nº {nota.numero}
                                  </span>
                                  {item.status === 'CORRELACIONADA' && (
                                    <CrmBadge tone="green">CORRELACIONADA</CrmBadge>
                                  )}
                                  {item.status === 'AMBÍGUA' && (
                                    <CrmBadge tone="amber">
                                      AMBÍGUA ({item.candidatas.length} OPÇÕES)
                                    </CrmBadge>
                                  )}
                                  {item.status === 'NÃO ENCONTRADA' && (
                                    <CrmBadge tone="gray">NÃO ENCONTRADA</CrmBadge>
                                  )}
                                  {item.jaImportada && (
                                    <CrmBadge tone="orange">JÁ VINCULADA</CrmBadge>
                                  )}
                                  {isIgnorado && <CrmBadge tone="red">IGNORADA</CrmBadge>}
                                  <span className="text-[10px] font-mono text-neutral-400">
                                    ({nota.origemArquivo.toUpperCase()})
                                  </span>
                                </div>

                                <div className="text-xs text-[#555] space-y-0.5">
                                  <p>
                                    <strong>Tomador:</strong> {nota.tomadorRazao}{' '}
                                    {nota.tomadorCnpjCpf && `(${nota.tomadorCnpjCpf})`}
                                  </p>
                                  <p className="flex flex-wrap gap-x-4">
                                    <span>
                                      <strong>Emissão:</strong> {formatDate(nota.dataEmissao)}
                                    </span>
                                    {nota.dataRecebimento && (
                                      <span>
                                        <strong>Recebimento:</strong>{' '}
                                        {formatDate(nota.dataRecebimento)}
                                      </span>
                                    )}
                                    <span>
                                      <strong>Situação:</strong> {nota.situacao}
                                    </span>
                                  </p>
                                  {nota.retencoesTexto && (
                                    <p className="text-[11px] text-amber-800">
                                      <strong>Retenções:</strong> {nota.retencoesTexto}
                                    </p>
                                  )}
                                  {nota.descricaoServico && (
                                    <p className="text-[11px] text-[#777] line-clamp-1 italic">
                                      {nota.descricaoServico}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="text-right sm:min-w-[180px]">
                                <p className="mono-value font-bold text-base text-[#1F1F1F]">
                                  {formatCurrency(nota.valorBruto)}
                                </p>
                                {nota.valorLiquido && nota.valorLiquido !== nota.valorBruto && (
                                  <p className="text-[11px] text-[#777]">
                                    Líq.: {formatCurrency(nota.valorLiquido)}
                                  </p>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs mt-2 text-[#666] hover:text-red-600"
                                  onClick={() => toggleIgnorarNota(globalIdx)}
                                >
                                  {isIgnorado ? 'Reativar nota' : 'Ignorar esta nota'}
                                </Button>
                              </div>
                            </div>

                            {!isIgnorado && (
                              <div className="mt-3 pt-3 border-t border-neutral-100">
                                {item.candidatas.length > 0 ? (
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-[#4B4B4B] flex items-center gap-1.5">
                                      <LinkIcon className="h-3 w-3 text-[#FF6A13]" />
                                      Parcela Vinculada:{' '}
                                      {item.status === 'AMBÍGUA' && (
                                        <span className="text-amber-700 font-normal">
                                          (selecione a parcela desejada na lista abaixo)
                                        </span>
                                      )}
                                    </label>
                                    <Select
                                      value={item.parcelaSelecionadaId || ''}
                                      onValueChange={(val) =>
                                        selecionarParcelaManualmente(globalIdx, val)
                                      }
                                    >
                                      <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Selecione a parcela correspondente..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {item.candidatas.map((c) => (
                                          <SelectItem key={c.parcela.id} value={c.parcela.id}>
                                            {c.projeto?.numero || 'Sem nº'} · {c.parcela.descricao}{' '}
                                            — {formatCurrency(c.parcela.valor)} (Score {c.score}pts:{' '}
                                            {c.motivosMatch[0] || 'Similaridade'})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ) : (
                                  <div className="text-xs text-[#8A8A8A] flex items-center justify-between">
                                    <span>Nenhuma parcela encontrada automaticamente.</span>
                                    <span className="text-[11px] text-[#FF6A13]">
                                      Esta nota entrará como Órfã e poderá ser vinculada na tela
                                      Financeiro.
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Botões de Ação do Rodapé da Prévia */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t">
                <Button
                  variant="outline"
                  onClick={() =>
                    setEtapa(arquivosNaoReconhecidos.length > 0 ? 'conferencia' : 'upload')
                  }
                >
                  Voltar / Outros Arquivos
                </Button>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-[#555] hidden sm:block">
                    <p className="font-semibold text-neutral-800">
                      {totalCorrelacionadas + totalAmbiguas} parcelas a vincular
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {tomadoresParaCriar > 0 ? `${tomadoresParaCriar} clientes a criar · ` : ''}
                      {totalOrfas > 0 ? `${totalOrfas} notas órfãs` : 'todas vinculadas'}
                    </p>
                  </div>
                  <Button
                    onClick={() => void dispararImportacao()}
                    className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
                    disabled={totalCorrelacionadas + totalAmbiguas === 0 && totalOrfas === 0}
                  >
                    Confirmar e Gravar Lote ({notasCorrelacionadas.length} notas)
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* ETAPA 5: EXECUÇÃO */}
          {/* ==================================================== */}
          {etapa === 'execucao' && (
            <div className="py-12 space-y-6 text-center max-w-md mx-auto">
              <div className="h-16 w-16 mx-auto rounded-full bg-orange-100 flex items-center justify-center text-[#FF6A13]">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1F1F1F]">
                  Gravando e Correlacionando Lote de NFS-e...
                </h3>
                <p className="mt-1 text-xs text-[#737373]">
                  {progresso?.etapaAtual ||
                    'Criando clientes, atualizando parcelas e gerando histórico nos projetos...'}
                </p>
              </div>
              <Progress value={progresso?.percentual || 10} className="h-3" />
              <div className="flex justify-between text-xs text-[#737373] font-mono">
                <span>{progresso?.percentual || 0}%</span>
                <span>
                  {progresso?.processadas || 0} de {progresso?.total || 0} notas processadas
                </span>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* ETAPA 6: RESULTADO FINAL */}
          {/* ==================================================== */}
          {etapa === 'resultado' && resultadoFinal && (
            <div className="space-y-6 py-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 text-center">
                <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-emerald-950">
                  Processamento do Lote de NFS-e Concluído!
                </h3>
                <p className="text-xs text-emerald-800 mt-1 max-w-md mx-auto">
                  As notas fiscais e dados dos tomadores foram registrados com sucesso no CRM
                  AEROCAD.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="crm-card p-4 text-center">
                  <p className="technical-label">NOTAS NO LOTE</p>
                  <p className="mono-value text-2xl font-bold mt-1 text-[#333]">
                    {resultadoFinal.totalNotas}
                  </p>
                </div>
                <div className="crm-card p-4 text-center">
                  <p className="technical-label text-emerald-700">PARCELAS VINCULADAS</p>
                  <p className="mono-value text-2xl font-bold mt-1 text-emerald-600">
                    {resultadoFinal.vinculadas}
                  </p>
                </div>
                <div className="crm-card p-4 text-center">
                  <p className="technical-label text-blue-700">CLIENTES CRIADOS</p>
                  <p className="mono-value text-2xl font-bold mt-1 text-blue-600">
                    {resultadoFinal.clientesCriados}
                  </p>
                </div>
                <div className="crm-card p-4 text-center">
                  <p className="technical-label text-amber-700">CLIENTES ATUALIZADOS</p>
                  <p className="mono-value text-2xl font-bold mt-1 text-amber-600">
                    {resultadoFinal.clientesAtualizados}
                  </p>
                </div>
              </div>

              {resultadoFinal.orfas.length > 0 && (
                <div className="crm-card p-4 bg-sky-50/40 border-sky-200">
                  <div className="flex items-center gap-2 text-sky-900 font-bold text-xs">
                    <Layers className="h-4 w-4 text-sky-700" />
                    {resultadoFinal.orfas.length} Notas sem parcela correspondente direta (Órfãs)
                  </div>
                  <p className="text-xs text-[#555] mt-1">
                    Essas notas estão disponíveis na aba "Notas Órfãs" no módulo Financeiro para
                    vinculação manual a qualquer momento.
                  </p>
                </div>
              )}

              {resultadoFinal.erros.length > 0 && (
                <div className="crm-card p-4 bg-red-50/50 border-red-200 space-y-2">
                  <p className="text-xs font-bold text-red-700">Avisos e erros reportados:</p>
                  <ul className="text-xs text-red-600 list-disc pl-4 space-y-1">
                    {resultadoFinal.erros.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <DialogFooter className="pt-4 border-t">
                <Button
                  onClick={() => {
                    onOpenChange(false)
                    resetarEstado()
                  }}
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
                >
                  Concluir e Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
