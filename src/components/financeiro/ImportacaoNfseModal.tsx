import { useState, useTransition, type ChangeEvent } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  FileUp,
  HelpCircle,
  Layers,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
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
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  COLUNAS_NFSE_MAPEAMENTO,
  parsePlanilhaNfse,
  processarArquivoNfse,
  type NfseDadoExtraido,
} from '@/services/nfseParser'
import {
  carregarContextoCorrelacao,
  correlacionarNotas,
  type ContextoCorrelacaoDb,
  type NotaCorrelacionada,
} from '@/services/nfseCorrelacionador'
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

type EtapaWizard = 'upload' | 'mapeamento' | 'correlacao' | 'execucao' | 'resultado'

export function ImportacaoNfseModal({
  open,
  onOpenChange,
  onImportComplete,
}: ImportacaoNfseModalProps) {
  const [, startTransition] = useTransition()
  const [etapa, setEtapa] = useState<EtapaWizard>('upload')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const [tipoArquivo, setTipoArquivo] = useState<'xml' | 'planilha'>('planilha')

  // Mapeamento de colunas (caso planilha)
  const [colunasDetectadas, setColunasDetectadas] = useState<string[]>([])
  const [mapaColunas, setMapaColunas] = useState<Record<string, string>>({})
  const [linhasBrutasPlanilha, setLinhasBrutasPlanilha] = useState<Record<string, unknown>[]>([])

  // Dados extraídos e correlação
  const [contextoDb, setContextoDb] = useState<ContextoCorrelacaoDb | null>(null)
  const [notasCorrelacionadas, setNotasCorrelacionadas] = useState<NotaCorrelacionada[]>([])
  const [filtroAbaCorrelacao, setFiltroAbaCorrelacao] = useState<
    'todas' | 'correlacionadas' | 'ambiguas' | 'orfas'
  >('todas')
  const [atualizarExistentes, setAtualizarExistentes] = useState(false)

  // Execução
  const [progresso, setProgresso] = useState<ProgressoNfse | null>(null)
  const [resultadoFinal, setResultadoFinal] = useState<NfseExecucaoResultado | null>(null)
  const [isGravando, setIsGravando] = useState(false)

  function resetarEstado() {
    setEtapa('upload')
    setArquivo(null)
    setIsProcessingFile(false)
    setColunasDetectadas([])
    setMapaColunas({})
    setLinhasBrutasPlanilha([])
    setContextoDb(null)
    setNotasCorrelacionadas([])
    setProgresso(null)
    setResultadoFinal(null)
    setIsGravando(false)
  }

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setArquivo(file)
    setIsProcessingFile(true)

    try {
      const [resArquivo, contexto] = await Promise.all([
        processarArquivoNfse(file),
        carregarContextoCorrelacao(),
      ])

      setContextoDb(contexto)
      setTipoArquivo(resArquivo.tipoArquivo)

      if (resArquivo.tipoArquivo === 'xml') {
        // XML já tem campos fixos -> correlacionar direto
        const correlacao = correlacionarNotas(resArquivo.notas, contexto)
        setNotasCorrelacionadas(correlacao)
        setEtapa('correlacao')
      } else {
        // Planilha: guardar colunas e linhas para permitir ajuste do mapeamento
        setColunasDetectadas(resArquivo.colunasDetectadas)
        setMapaColunas(resArquivo.mapaColunas)
        setLinhasBrutasPlanilha(resArquivo.linhasPlanilhaBrutas || [])
        // Já computa prévia da correlação com o mapeamento automático
        const correlacao = correlacionarNotas(resArquivo.notas, contexto)
        setNotasCorrelacionadas(correlacao)
        // Se todas as colunas essenciais foram detectadas, pode ir para correlação ou mapeamento
        const temNumero = Boolean(resArquivo.mapaColunas.numero)
        const temValor = Boolean(resArquivo.mapaColunas.valorBruto)
        if (temNumero && temValor) {
          setEtapa('correlacao')
        } else {
          setEtapa('mapeamento')
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao ler arquivo de NFS-e: ' + msg)
    } finally {
      setIsProcessingFile(false)
    }
  }

  function handleReaplicarMapeamento() {
    if (!linhasBrutasPlanilha.length || !contextoDb) return
    const notasExtraidas = parsePlanilhaNfse(linhasBrutasPlanilha, mapaColunas)
    const correlacao = correlacionarNotas(notasExtraidas, contextoDb)
    setNotasCorrelacionadas(correlacao)
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

  async function dispararImportacao() {
    if (!arquivo || !notasCorrelacionadas.length) return
    setIsGravando(true)
    setEtapa('execucao')

    try {
      const res = await executarGravacaoNfse(
        notasCorrelacionadas,
        {
          arquivoNome: arquivo.name,
          tamanhoBytes: arquivo.size,
          atualizarExistentes,
        },
        (prog) => setProgresso(prog),
      )
      setResultadoFinal(res)
      setEtapa('resultado')
      onImportComplete?.(res)
      toast.success(
        `Importação concluída: ${res.vinculadas} notas vinculadas, ${res.atualizadas} atualizadas.`,
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro na gravação das notas: ' + msg)
    } finally {
      setIsGravando(false)
    }
  }

  // Contadores de correlação
  const totalCorrelacionadas = notasCorrelacionadas.filter(
    (n) => n.status === 'CORRELACIONADA' && n.acao === 'vincular',
  ).length
  const totalAmbiguas = notasCorrelacionadas.filter(
    (n) => n.status === 'AMBÍGUA' && n.acao === 'vincular',
  ).length
  const totalOrfas = notasCorrelacionadas.filter(
    (n) => n.status === 'NÃO ENCONTRADA' || n.acao === 'ignorar',
  ).length

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

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetarEstado()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Cabeçalho */}
        <DialogHeader className="p-5 border-b bg-[#FAFAFA]">
          <div className="flex items-center justify-between">
            <div>
              <p className="technical-label flex items-center gap-1.5 text-[#FF6A13]">
                <FileSpreadsheet className="h-4 w-4" />
                MÓDULO FINANCEIRO · CORRELAÇÃO INTELIGENTE
              </p>
              <DialogTitle className="text-xl font-bold text-[#1F1F1F]">
                Importação de NFS-e (Notas Fiscais de Serviços)
              </DialogTitle>
              <DialogDescription className="text-xs text-[#737373] mt-0.5">
                Importe arquivos XML individuais ou planilhas exportadas (GDF / SisGoV /
                Prefeituras) com correlação automática em cascata com parcelas e projetos.
              </DialogDescription>
            </div>
            {arquivo && (
              <CrmBadge tone="orange" className="font-mono text-xs">
                {arquivo.name}
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
              <div className="rounded-xl border-2 border-dashed border-[#FFD2B3] bg-[#FFFBF8] p-8 text-center hover:bg-[#FFF6EC] transition">
                <input
                  type="file"
                  id="nfse-upload-input"
                  className="hidden"
                  accept=".xml,.xlsx,.xls,.csv"
                  onChange={(e) => void handleFileUpload(e)}
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
                      ? 'Processando arquivo e carregando dados...'
                      : 'Clique ou arraste o arquivo de NFS-e aqui'}
                  </h3>
                  <p className="mt-1 text-xs text-[#737373] max-w-md">
                    Formatos suportados: <strong>XML de NFS-e</strong> (individual ABRASF ou GDF) ou{' '}
                    <strong>Planilhas XLSX / CSV</strong> exportadas com histórico de notas fiscais.
                  </p>
                  <Button
                    type="button"
                    disabled={isProcessingFile}
                    className="mt-4 bg-[#FF6A13] hover:bg-[#E85B06] text-white"
                  >
                    <FileUp className="mr-2 h-4 w-4" />
                    Selecionar Arquivo
                  </Button>
                </label>
              </div>

              {/* Informações sobre o motor de correlação */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="crm-card p-4 bg-orange-50/40 border-orange-200">
                  <div className="flex items-center gap-2 text-[#FF6A13] font-bold text-xs uppercase tracking-wide">
                    <Sparkles className="h-4 w-4" />
                    1. Cascata de Match
                  </div>
                  <p className="mt-2 text-xs text-[#555] leading-relaxed">
                    Identifica por <strong>AAAA-NNN</strong> no corpo da nota,{' '}
                    <strong>nº de PC/PT</strong>, similaridade de Razão Social/CNPJ e tolerância de
                    valor (± R$ 1,00).
                  </p>
                </div>
                <div className="crm-card p-4 bg-emerald-50/40 border-emerald-200">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wide">
                    <CheckCircle2 className="h-4 w-4" />
                    2. Baixa Automática
                  </div>
                  <p className="mt-2 text-xs text-[#555] leading-relaxed">
                    Preenche data de faturamento, número da NFS-e, retenções (ISS/INSS) e marca como
                    paga quando liquidada.
                  </p>
                </div>
                <div className="crm-card p-4 bg-sky-50/40 border-sky-200">
                  <div className="flex items-center gap-2 text-sky-700 font-bold text-xs uppercase tracking-wide">
                    <Layers className="h-4 w-4" />
                    3. Notas Órfãs
                  </div>
                  <p className="mt-2 text-xs text-[#555] leading-relaxed">
                    Notas sem correspondência imediata ficam disponíveis em aba dedicada para
                    vinculação manual a qualquer parcela.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* ETAPA 2: MAPEAMENTO DE COLUNAS (SE PLANILHA) */}
          {/* ==================================================== */}
          {etapa === 'mapeamento' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-700" />
                <div>
                  <strong>Mapeamento de Colunas da Planilha:</strong> O sistema detectou
                  automaticamente os cabeçalhos exportados. Verifique se os campos principais
                  (Número da Nota, Valor Bruto, Tomador e Datas) estão atribuídos corretamente.
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
                <Button variant="outline" onClick={() => setEtapa('upload')}>
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
          {/* ETAPA 3: PRÉVIA DA CORRELAÇÃO */}
          {/* ==================================================== */}
          {etapa === 'correlacao' && (
            <div className="space-y-4">
              {/* Painel de Contadores */}
              <div className="grid gap-3 sm:grid-cols-4">
                <div
                  onClick={() => setFiltroAbaCorrelacao('todas')}
                  className={`crm-card p-3.5 cursor-pointer transition border-2 ${
                    filtroAbaCorrelacao === 'todas' ? 'border-[#FF6A13] bg-orange-50/20' : ''
                  }`}
                >
                  <p className="technical-label">TOTAL EXTRAÍDO</p>
                  <p className="mono-value text-2xl font-bold mt-1 text-[#333]">
                    {notasCorrelacionadas.length}
                  </p>
                  <p className="text-[11px] text-[#777]">Notas no arquivo</p>
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
                  <p className="mono-value text-2xl font-bold mt-1 text-sky-600">{totalOrfas}</p>
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

                {tipoArquivo === 'planilha' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEtapa('mapeamento')}
                    className="text-xs"
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Ajustar Mapeamento de Colunas
                  </Button>
                )}
              </div>

              {/* Lista detalhada das notas */}
              <div className="crm-card divide-y overflow-hidden max-h-[420px] overflow-y-auto">
                {notasFiltradas.map((item, idx) => {
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
                            {item.jaImportada && <CrmBadge tone="orange">JÁ VINCULADA</CrmBadge>}
                            {isIgnorado && <CrmBadge tone="red">IGNORADA</CrmBadge>}
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
                                  <strong>Recebimento:</strong> {formatDate(nota.dataRecebimento)}
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

                        {/* Valor e Ações */}
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

                      {/* Seletor de Parcela / Candidatas */}
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
                                      {c.projeto?.numero || 'Sem nº'} · {c.parcela.descricao} —{' '}
                                      {formatCurrency(c.parcela.valor)} (Score {c.score}pts:{' '}
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
                })}
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-between items-center pt-3 border-t">
                <Button variant="outline" onClick={() => setEtapa('upload')}>
                  Voltar / Outro Arquivo
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#737373] hidden sm:inline">
                    {totalCorrelacionadas + totalAmbiguas} parcelas serão atualizadas
                  </span>
                  <Button
                    onClick={() => void dispararImportacao()}
                    className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
                    disabled={totalCorrelacionadas + totalAmbiguas === 0 && totalOrfas === 0}
                  >
                    Confirmar e Gravar NFS-e
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* ETAPA 4: EXECUÇÃO COM PROGRESSO */}
          {/* ==================================================== */}
          {etapa === 'execucao' && (
            <div className="py-12 space-y-6 text-center max-w-md mx-auto">
              <div className="h-16 w-16 mx-auto rounded-full bg-orange-100 flex items-center justify-center text-[#FF6A13]">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1F1F1F]">
                  Gravando e Correlacionando NFS-e...
                </h3>
                <p className="mt-1 text-xs text-[#737373]">
                  {progresso?.etapaAtual ||
                    'Atualizando parcelas e gerando histórico nos projetos...'}
                </p>
              </div>
              <Progress value={progresso?.percentual || 10} className="h-3" />
              <div className="flex justify-between text-xs text-[#737373] font-mono">
                <span>{progresso?.percentual || 0}%</span>
                <span>
                  {progresso?.processadas || 0} de {progresso?.total || 0} processadas
                </span>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* ETAPA 5: RESULTADO FINAL */}
          {/* ==================================================== */}
          {etapa === 'resultado' && resultadoFinal && (
            <div className="space-y-6 py-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 text-center">
                <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-emerald-950">
                  Processamento de NFS-e Concluído!
                </h3>
                <p className="text-xs text-emerald-800 mt-1 max-w-md mx-auto">
                  As notas fiscais foram registradas com sucesso e as parcelas correlacionadas foram
                  atualizadas.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="crm-card p-4 text-center">
                  <p className="technical-label">TOTAL PROCESSADO</p>
                  <p className="mono-value text-2xl font-bold mt-1 text-[#333]">
                    {resultadoFinal.totalNotas}
                  </p>
                </div>
                <div className="crm-card p-4 text-center">
                  <p className="technical-label text-emerald-700">VINCULADAS</p>
                  <p className="mono-value text-2xl font-bold mt-1 text-emerald-600">
                    {resultadoFinal.vinculadas}
                  </p>
                </div>
                <div className="crm-card p-4 text-center">
                  <p className="technical-label text-amber-700">ATUALIZADAS</p>
                  <p className="mono-value text-2xl font-bold mt-1 text-amber-600">
                    {resultadoFinal.atualizadas}
                  </p>
                </div>
                <div className="crm-card p-4 text-center">
                  <p className="technical-label text-sky-700">NOTAS ÓRFÃS</p>
                  <p className="mono-value text-2xl font-bold mt-1 text-sky-600">
                    {resultadoFinal.orfas.length}
                  </p>
                </div>
              </div>

              {resultadoFinal.orfas.length > 0 && (
                <div className="crm-card p-4 bg-sky-50/40 border-sky-200">
                  <div className="flex items-center gap-2 text-sky-900 font-bold text-xs">
                    <Layers className="h-4 w-4 text-sky-700" />
                    {resultadoFinal.orfas.length} Notas sem vínculo direto
                  </div>
                  <p className="text-xs text-[#555] mt-1">
                    Essas notas estão disponíveis na aba "Notas Órfãs" na página de Financeiro para
                    que você possa vinculá-las manualmente a qualquer momento.
                  </p>
                </div>
              )}

              {resultadoFinal.erros.length > 0 && (
                <div className="crm-card p-4 bg-red-50/50 border-red-200 space-y-2">
                  <p className="text-xs font-bold text-red-700">Erros reportados na gravação:</p>
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
