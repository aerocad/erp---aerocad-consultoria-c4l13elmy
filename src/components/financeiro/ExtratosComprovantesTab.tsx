import { useMemo, useState, useEffect, type ChangeEvent } from 'react'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Eye,
  FileSpreadsheet,
  FileText,
  FileUp,
  Filter,
  Link as LinkIcon,
  Loader2,
  Paperclip,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import { CapturaComprovanteModal } from './CapturaComprovanteModal'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState } from '@/components/common/States'
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
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, formatDate, formatDateBrasilia } from '@/lib/format'
import pb from '@/lib/pocketbase/client'
import { createOne, deleteOne, updateOne } from '@/services/api'
import {
  encontrarSugestoesConciliacao,
  verificarDuplicidadeLancamento,
  type SugestaoConciliacao,
  type AlertaDuplicidade,
} from '@/services/conciliacaoMotor'
import { parseOfxString } from '@/services/extratoOfxParser'
import { parsePlanilhaExtrato } from '@/services/extratoPlanilhaParser'
import {
  parseCnabRetorno,
  type CnabRetornoParsed,
  type CnabTransacaoParsed,
} from '@/services/cnabRetornoParser'
import {
  analisarDeduplicacao,
  calcularHashArquivo,
  calcularFingerprintTransacao,
  normalizarDataChave,
  type AnaliseDeduplicacaoArquivo,
  type TransacaoCandidataImportacao,
} from '@/services/extratoDeduplicador'
import { PreviaImportacaoExtratoModal } from './PreviaImportacaoExtratoModal'
import type {
  ContaPagarRecord,
  ContaReceberRecord,
  ExtratoRecord,
  ExtratoTransacaoRecord,
  ParcelaRecord,
  ContaBancariaRecord,
} from '@/types/crm'

interface ExtratosComprovantesTabProps {
  extratos: ExtratoRecord[]
  transacoes: ExtratoTransacaoRecord[]
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  contasBancarias?: ContaBancariaRecord[]
  projetos?: import('@/types/crm').ProjetoRecord[]
  credores?: import('@/types/crm').CredorRecord[]
  canWrite: boolean
  onReloadExtratos: () => Promise<void> | void
  onReloadTransacoes: () => Promise<void> | void
  onReloadParcelas: () => Promise<void> | void
  onReloadContasPagar: () => Promise<void> | void
  onReloadContasReceber: () => Promise<void> | void
}

export function ExtratosComprovantesTab({
  extratos,
  transacoes,
  parcelas,
  contasPagar,
  contasReceber,
  contasBancarias: contasBancariasProp = [],
  projetos = [],
  credores = [],
  canWrite,
  onReloadExtratos,
  onReloadTransacoes,
  onReloadParcelas,
  onReloadContasPagar,
  onReloadContasReceber,
}: ExtratosComprovantesTabProps) {
  const { user } = useAuth()
  const isMobile = useIsMobile()

  // Garantia defensiva para listas recebidas via props
  const listaExtratos = Array.isArray(extratos) ? extratos : []
  const listaTransacoes = Array.isArray(transacoes) ? transacoes : []
  const listaParcelas = Array.isArray(parcelas) ? parcelas : []
  const listaContasPagar = Array.isArray(contasPagar) ? contasPagar : []
  const listaContasReceber = Array.isArray(contasReceber) ? contasReceber : []
  const listaProjetos = Array.isArray(projetos) ? projetos : []
  const listaCredores = Array.isArray(credores) ? credores : []

  // Permissão de exclusão de extratos: restrita exclusivamente ao Administrador (admin)
  const podeExcluirExtratos = Boolean(canWrite && user?.role === 'admin')

  // Modal de Captura Fotográfica & Visão IA
  const [modalCapturaIaAberto, setModalCapturaIaAberto] = useState(false)

  // Estados de navegação
  const [extratoSelecionadoId, setExtratoSelecionadoId] = useState<string>('todos')
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([])
  const [isConciliandoLote, setIsConciliandoLote] = useState(false)
  const [nomeConfirmacaoExclusao, setNomeConfirmacaoExclusao] = useState('')
  const [isExcluindoExtrato, setIsExcluindoExtrato] = useState(false)
  const [transacaoParaExcluir, setTransacaoParaExcluir] = useState<ExtratoTransacaoRecord | null>(
    null,
  )
  const [isExcluindoTransacao, setIsExcluindoTransacao] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  // Contas Bancárias PJ e Seleção no Upload do Extrato
  const [contasBancarias, setContasBancarias] = useState<ContaBancariaRecord[]>(contasBancariasProp)
  const [contaBancariaSelecionadaUpload, setContaBancariaSelecionadaUpload] = useState<string>(
    contasBancariasProp.length > 0 ? contasBancariasProp[0].id : '',
  )
  const [filtroContaBancaria, setFiltroContaBancaria] = useState<string>('todos')

  useEffect(() => {
    if (contasBancariasProp.length > 0) {
      setContasBancarias(contasBancariasProp)
      if (!contaBancariaSelecionadaUpload) {
        setContaBancariaSelecionadaUpload(contasBancariasProp[0].id)
      }
      return
    }

    pb.collection('contas_bancarias')
      .getFullList<ContaBancariaRecord>({ sort: 'apelido' })
      .then((res) => {
        setContasBancarias(res)
        if (res.length > 0 && !contaBancariaSelecionadaUpload) {
          setContaBancariaSelecionadaUpload(res[0].id)
        }
      })
      .catch((err) => console.log('Erro ao carregar contas bancárias PJ:', err))
  }, [contasBancariasProp, contaBancariaSelecionadaUpload])

  // Modais
  const [modalUploadAberto, setModalUploadAberto] = useState(false)
  const [isProcessandoUpload, setIsProcessandoUpload] = useState(false)
  const [modalPreviaExtrato, setModalPreviaExtrato] = useState<{
    file: File
    formato: 'ofx' | 'csv' | 'xlsx'
    contaBancariaId: string
    analise: AnaliseDeduplicacaoArquivo<TransacaoCandidataImportacao>
    saldoFinal?: number
    dataInicio?: string
    dataFim?: string
    banco?: string
    conta?: string
  } | null>(null)
  const [isGravandoExtrato, setIsGravandoExtrato] = useState(false)
  const [resumoRetornoModal, setResumoRetornoModal] = useState<{
    file: File
    parsed: CnabRetornoParsed
    analise: AnaliseDeduplicacaoArquivo<CnabTransacaoParsed>
    contaBancariaId: string
  } | null>(null)
  const [isGravandoRetorno, setIsGravandoRetorno] = useState(false)
  const [transacaoParaConciliar, setTransacaoParaConciliar] =
    useState<ExtratoTransacaoRecord | null>(null)
  const [isConciliando, setIsConciliando] = useState(false)
  const [modalExcluirExtrato, setModalExcluirExtrato] = useState<ExtratoRecord | null>(null)
  const [alertaDuplicidadeDetectado, setAlertaDuplicidadeDetectado] =
    useState<AlertaDuplicidade | null>(null)

  // Upload avulso de comprovante
  const [modalComprovanteAvulso, setModalComprovanteAvulso] = useState(false)
  const [destinoComprovanteTipo, setDestinoComprovanteTipo] = useState<
    'conta_pagar' | 'conta_receber'
  >('conta_pagar')
  const [destinoComprovanteId, setDestinoComprovanteId] = useState('')
  const [arquivoComprovanteAvulso, setArquivoComprovanteAvulso] = useState<File | null>(null)
  const [isUploadingComprovante, setIsUploadingComprovante] = useState(false)

  // Contadores de status (Confirmadas / Pendentes / Ignoradas) lendo t.status_conciliacao
  const contadoresStatus = useMemo(() => {
    // Escopo respeita o extrato selecionado caso não seja "todos"
    const txBase =
      extratoSelecionadoId === 'todos'
        ? listaTransacoes.filter(Boolean)
        : listaTransacoes.filter((t) => Boolean(t && t.extrato === extratoSelecionadoId))

    let confirmadas = 0
    let pendentes = 0
    let ignoradas = 0

    for (const t of txBase) {
      if (!t) continue
      if (t?.status_conciliacao === 'conciliado') {
        confirmadas++
      } else if (t?.status_conciliacao === 'ignorado') {
        ignoradas++
      } else {
        pendentes++
      }
    }

    return {
      total: txBase.length,
      confirmadas,
      pendentes,
      ignoradas,
    }
  }, [listaTransacoes, extratoSelecionadoId])

  // Transações filtradas com tolerância a transações órfãs (extrato nulo) e campos incompletos
  const transacoesFiltradas = useMemo(() => {
    const termoBusca = (busca || '').toLowerCase().trim()
    return listaTransacoes.filter((tx) => {
      if (!tx) return false
      const extratoPai = tx.extrato
        ? listaExtratos.find((e) => e && e.id === tx.extrato)
        : undefined
      const matchExtrato =
        extratoSelecionadoId === 'todos' ||
        (extratoSelecionadoId === 'sem_extrato' ? !tx.extrato : tx.extrato === extratoSelecionadoId)
      const descLower = String(tx.descricao || '').toLowerCase()
      const docRefLower = String(tx.documento_ref || '').toLowerCase()
      const matchBusca =
        !termoBusca || descLower.includes(termoBusca) || docRefLower.includes(termoBusca)
      const matchStatus = filtroStatus === 'todos' || tx.status_conciliacao === filtroStatus
      const matchTipo = filtroTipo === 'todos' || tx.tipo === filtroTipo

      const matchConta =
        filtroContaBancaria === 'todos' ||
        (filtroContaBancaria === 'sem_conta'
          ? !extratoPai?.conta_bancaria
          : extratoPai?.conta_bancaria === filtroContaBancaria)

      return matchExtrato && matchBusca && matchStatus && matchTipo && matchConta
    })
  }, [
    listaTransacoes,
    listaExtratos,
    extratoSelecionadoId,
    busca,
    filtroStatus,
    filtroTipo,
    filtroContaBancaria,
  ])

  // Sugestões para o item em conciliação
  const sugestoesAtuais = useMemo<SugestaoConciliacao[]>(() => {
    if (!transacaoParaConciliar) return []
    try {
      return encontrarSugestoesConciliacao(
        transacaoParaConciliar,
        {
          parcelas: listaParcelas,
          contasPagar: listaContasPagar,
          contasReceber: listaContasReceber,
        },
        7, // tolerância de até 7 dias
      )
    } catch (err) {
      console.warn('Erro ao calcular sugestões de conciliação:', err)
      return []
    }
  }, [transacaoParaConciliar, listaParcelas, listaContasPagar, listaContasReceber])

  // Seleção de sugestões no modal individual de conciliação
  const [sugestaoSelecionadaModal, setSugestaoSelecionadaModal] =
    useState<SugestaoConciliacao | null>(null)

  useEffect(() => {
    if (sugestoesAtuais.length > 0) {
      setSugestaoSelecionadaModal(sugestoesAtuais[0])
    } else {
      setSugestaoSelecionadaModal(null)
    }
  }, [sugestoesAtuais])

  // Utilitário para ler arquivo de texto com suporte automático a ISO-8859-1 (Latin1) e UTF-8
  async function lerArquivoTextoComFallback(file: File): Promise<string> {
    try {
      const buffer = await file.arrayBuffer()
      // Tenta UTF-8 com 'fatal: true' para detectar se há bytes Latin1 / ANSI inválidos em UTF-8
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
        return utf8Decoder.decode(buffer)
      } catch {
        // Fallback robusto para ISO-8859-1 (padrão de arquivos bancários brasileiros legados / mainframe)
        const latin1Decoder = new TextDecoder('iso-8859-1')
        return latin1Decoder.decode(buffer)
      }
    } catch {
      return await file.text()
    }
  }

  // Utilitário para inserir transações com pausas para evitar Rate Limiting (HTTP 429)
  async function inserirTransacoesComThrottle(
    transacoesPayloads: Array<Record<string, unknown>>,
  ): Promise<number> {
    let inseridas = 0
    const TAMANHO_LOTE = 10
    const PAUSA_MS = 120

    for (let i = 0; i < transacoesPayloads.length; i += TAMANHO_LOTE) {
      const chunk = transacoesPayloads.slice(i, i + TAMANHO_LOTE)
      const promessas = chunk.map(async (item) => {
        try {
          await createOne('extratos_transacoes', item)
          return 1
        } catch {
          return 0
        }
      })
      const resultados = await Promise.all(promessas)
      inseridas += resultados.reduce((a, b) => a + b, 0)

      if (i + TAMANHO_LOTE < transacoesPayloads.length) {
        await new Promise((resolve) => setTimeout(resolve, PAUSA_MS))
      }
    }
    return inseridas
  }

  // Confirma e grava retorno .RET previamente analisado (com deduplicação ativa)
  async function handleConfirmarGravacaoRetorno() {
    if (!resumoRetornoModal) return
    setIsGravandoRetorno(true)

    const { file, parsed, analise, contaBancariaId } = resumoRetornoModal
    const contaBancariaAlvo = contasBancarias.find((c) => c.id === contaBancariaId)

    // Se todos os lançamentos são duplicados, avisa e encerra sem duplicar
    if (analise.arquivoJaImportado || analise.totalNovas === 0) {
      toast.info('Arquivo já importado anteriormente — nenhum lançamento novo adicionado.')
      setResumoRetornoModal(null)
      setIsGravandoRetorno(false)
      return
    }

    try {
      // 1. Cria extrato com anexo do arquivo .ret e hash_arquivo calculado
      const formData = new FormData()
      formData.append('nome_arquivo', file.name)
      formData.append('formato', 'ret')
      if (analise.hashArquivo) {
        formData.append('hash_arquivo', analise.hashArquivo)
      }
      formData.append(
        'banco',
        contaBancariaAlvo
          ? `${contaBancariaAlvo.banco_nome} (${contaBancariaAlvo.apelido})`
          : parsed.bancoNome || 'Banco Comercial',
      )
      formData.append('conta', contaBancariaAlvo?.numero_conta || parsed.conta || '')
      if (contaBancariaId) {
        formData.append('conta_bancaria', contaBancariaId)
      }
      if (parsed.dataInicio) {
        formData.append('data_inicio', `${parsed.dataInicio} 12:00:00.000Z`)
      }
      if (parsed.dataFim) {
        formData.append('data_fim', `${parsed.dataFim} 12:00:00.000Z`)
      }
      formData.append('total_transacoes', String(analise.totalNovas))
      formData.append('total_entradas', String(analise.totalEntradasNovas))
      formData.append('total_saidas', String(analise.totalSaidasNovas))
      formData.append('saldo_final', String(analise.totalEntradasNovas - analise.totalSaidasNovas))
      if (user?.id) {
        formData.append('usuario', user.id)
      }
      formData.append('arquivo', file)

      const extratoRecord = await pb.collection('extratos').create<ExtratoRecord>(formData)

      // 2. Grava APENAS as transações genuinamente novas, com fingerprint persistido
      const payloads = analise.itensNovos.map((itemNovo) => {
        const t = itemNovo.item
        return {
          extrato: extratoRecord.id,
          data: `${t.data} 12:00:00.000Z`,
          descricao: t.descricao,
          valor: t.valor,
          tipo: t.tipo,
          documento_ref: t.documentoRef || t.nossoNumero || '',
          fitid: t.fitid,
          fingerprint: itemNovo.fingerprint,
          status_conciliacao: 'pendente',
          observacoes: `[${t.layout}] Ocorrência ${t.codigoOcorrencia} - ${t.ocorrenciaDescricao}`,
        }
      })

      const salvas = await inserirTransacoesComThrottle(payloads)

      const duplicadasTexto =
        analise.totalDuplicadas > 0
          ? ` (${analise.totalDuplicadas} duplicadas ignoradas com sucesso)`
          : ''

      toast.success(
        `Retorno bancário ${parsed.layout} importado! ${salvas} lançamentos novos registrados${duplicadasTexto}.`,
      )
      setResumoRetornoModal(null)
      setExtratoSelecionadoId(extratoRecord.id)
      await onReloadExtratos()
      await onReloadTransacoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Falha ao gravar arquivo .ret: ${msg}`)
    } finally {
      setIsGravandoRetorno(false)
    }
  }

  // Confirma e grava extrato (OFX, CSV, XLSX) previamente analisado no modal de prévia
  async function handleConfirmarGravacaoPreviaExtrato() {
    if (!modalPreviaExtrato) return
    setIsGravandoExtrato(true)

    const {
      file,
      formato,
      contaBancariaId,
      analise,
      saldoFinal,
      dataInicio,
      dataFim,
      banco,
      conta,
    } = modalPreviaExtrato
    const contaBancariaAlvo = contasBancarias.find((c) => c.id === contaBancariaId)

    if (analise.arquivoJaImportado || analise.totalNovas === 0) {
      toast.info('Arquivo já importado anteriormente — nenhum lançamento novo.')
      setModalPreviaExtrato(null)
      setIsGravandoExtrato(false)
      return
    }

    try {
      // 1. Cria o extrato com hash do arquivo e totais reais dos lançamentos novos
      const extratoRecord = await createOne<ExtratoRecord>('extratos', {
        nome_arquivo: file.name,
        formato,
        hash_arquivo: analise.hashArquivo || null,
        banco: contaBancariaAlvo
          ? `${contaBancariaAlvo.banco_nome} (${contaBancariaAlvo.apelido})`
          : banco || 'Banco Comercial',
        conta: contaBancariaAlvo?.numero_conta || conta || '',
        conta_bancaria: contaBancariaId || null,
        data_inicio: dataInicio ? `${dataInicio} 12:00:00.000Z` : null,
        data_fim: dataFim ? `${dataFim} 12:00:00.000Z` : null,
        total_transacoes: analise.totalNovas,
        total_entradas: analise.totalEntradasNovas,
        total_saidas: analise.totalSaidasNovas,
        saldo_final: saldoFinal || 0,
        usuario: user?.id || null,
      })

      // 2. Cria apenas as transações novas com fingerprint persistido
      const payloads = analise.itensNovos.map((itemNovo) => {
        const t = itemNovo.item
        return {
          extrato: extratoRecord.id,
          data: `${normalizarDataChave(t.data)} 12:00:00.000Z`,
          descricao: t.descricao,
          valor: t.valor,
          tipo: t.tipo,
          documento_ref: t.documentoRef || '',
          fitid: t.fitid,
          fingerprint: itemNovo.fingerprint,
          status_conciliacao: 'pendente',
        }
      })

      const salvas = await inserirTransacoesComThrottle(payloads)

      const duplicadasTexto =
        analise.totalDuplicadas > 0
          ? ` (${analise.totalDuplicadas} existentes no banco foram ignoradas)`
          : ''

      toast.success(
        `Extrato "${file.name}" importado! ${salvas} lançamentos novos registrados${duplicadasTexto}.`,
      )

      setModalPreviaExtrato(null)
      setExtratoSelecionadoId(extratoRecord.id)
      await onReloadExtratos()
      await onReloadTransacoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Falha ao salvar extrato: ${msg}`)
    } finally {
      setIsGravandoExtrato(false)
    }
  }

  // Handler de importação de arquivos de extrato com detecção e prévia
  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList)
    setIsProcessandoUpload(true)

    const contaBancariaAlvo = contasBancarias.find((c) => c.id === contaBancariaSelecionadaUpload)

    try {
      // Processa o primeiro arquivo abrindo a prévia interativa de deduplicação
      const file = files[0]
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const hashArquivo = await calcularHashArquivo(file)

      // Intercepta arquivos .RET (CNAB 240 / 400)
      if (ext === 'ret') {
        try {
          const text = await lerArquivoTextoComFallback(file)
          const parsedCnab = parseCnabRetorno(text)

          if (!parsedCnab.transacoes.length) {
            toast.warning(`Arquivo .ret "${file.name}" não continha lançamentos válidos.`)
            return
          }

          // Executa análise de deduplicação antes de abrir o modal
          const analiseCnab = analisarDeduplicacao<CnabTransacaoParsed>({
            arquivoNome: file.name,
            arquivoHash: hashArquivo,
            contaBancariaId: contaBancariaSelecionadaUpload,
            contaNumero: contaBancariaAlvo?.numero_conta || parsedCnab.conta,
            transacoesCandidatas: parsedCnab.transacoes,
            transacoesExistentes: transacoes,
            extratosExistentes: extratos,
          })

          setResumoRetornoModal({
            file,
            parsed: parsedCnab,
            analise: analiseCnab,
            contaBancariaId: contaBancariaSelecionadaUpload,
          })
          setModalUploadAberto(false)
          return
        } catch (retErr: unknown) {
          const errMsg = retErr instanceof Error ? retErr.message : String(retErr)
          toast.error(`Erro ao interpretar retorno .ret "${file.name}": ${errMsg}`)
          return
        }
      }

      let parsed = null
      let formato: 'ofx' | 'csv' | 'xlsx' = 'ofx'

      if (ext === 'ofx') {
        formato = 'ofx'
        const text = await lerArquivoTextoComFallback(file)
        parsed = parseOfxString(text)
      } else if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
        formato = ext === 'csv' ? 'csv' : 'xlsx'
        parsed = await parsePlanilhaExtrato(file)
      } else {
        toast.error(
          `Arquivo "${file.name}" ignorado: formato não suportado (use OFX, RET, CSV ou XLSX).`,
        )
        return
      }

      if (!parsed.transacoes.length) {
        toast.warning(`Extrato "${file.name}" não continha transações válidas.`)
        return
      }

      // Executa análise de deduplicação contra transações existentes
      const analiseExtrato = analisarDeduplicacao({
        arquivoNome: file.name,
        arquivoHash: hashArquivo,
        contaBancariaId: contaBancariaSelecionadaUpload,
        contaNumero: contaBancariaAlvo?.numero_conta || parsed.conta,
        transacoesCandidatas: parsed.transacoes,
        transacoesExistentes: transacoes,
        extratosExistentes: extratos,
      })

      setModalPreviaExtrato({
        file,
        formato,
        contaBancariaId: contaBancariaSelecionadaUpload,
        analise: analiseExtrato,
        saldoFinal: parsed.saldoFinal,
        dataInicio: parsed.dataInicio,
        dataFim: parsed.dataFim,
        banco: parsed.banco,
        conta: parsed.conta,
      })
      setModalUploadAberto(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Falha ao ler extrato: ${msg}`)
    } finally {
      setIsProcessandoUpload(false)
      e.target.value = ''
    }
  }

  // Executa a conciliação automática com um clique
  async function handleConfirmarConciliacao(sugestao: SugestaoConciliacao) {
    if (!transacaoParaConciliar) return
    setIsConciliando(true)

    try {
      const dataExtrato = transacaoParaConciliar.data.slice(0, 10)

      if (sugestao.tipo === 'parcela') {
        const parcela = parcelas.find((p) => p.id === sugestao.id)
        if (parcela) {
          await updateOne('parcelas', parcela.id, {
            status: 'paga',
            data_pagamento: `${dataExtrato} 12:00:00.000Z`,
            valor_recebido: transacaoParaConciliar.valor,
            status_pagamento: 'Conciliado Extrato',
          })
          await onReloadParcelas()
        }
      } else if (sugestao.tipo === 'conta_pagar') {
        const cp = contasPagar.find((c) => c.id === sugestao.id)
        if (cp) {
          await updateOne('contas_pagar', cp.id, {
            status: 'pago',
            data_pagamento: `${dataExtrato} 12:00:00.000Z`,
          })
          await onReloadContasPagar()
        }
      } else if (sugestao.tipo === 'conta_receber') {
        const cr = contasReceber.find((c) => c.id === sugestao.id)
        if (cr) {
          await updateOne('contas_receber', cr.id, {
            status: 'recebido',
            data_recebimento: `${dataExtrato} 12:00:00.000Z`,
            valor_recebido: transacaoParaConciliar.valor,
          })
          await onReloadContasReceber()
        }
      }

      // Atualiza a transação do extrato
      await updateOne('extratos_transacoes', transacaoParaConciliar.id, {
        status_conciliacao: 'conciliado',
        vinculo_tipo: sugestao.tipo,
        vinculo_id: sugestao.id,
        data_conciliacao: new Date().toISOString(),
        observacoes: `Conciliado com ${sugestao.titulo} (${sugestao.tipo})`,
      })

      toast.success(
        `Transação conciliada com sucesso! ${sugestao.tipo === 'conta_pagar' ? 'Conta a pagar baixada' : 'Recebível quitado'}.`,
      )
      setTransacaoParaConciliar(null)
      await onReloadTransacoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao conciliar: ${msg}`)
    } finally {
      setIsConciliando(false)
    }
  }

  // Ignorar / Desconciliar
  async function handleIgnorarTransacao(tx: ExtratoTransacaoRecord) {
    try {
      await updateOne('extratos_transacoes', tx.id, {
        status_conciliacao: 'ignorado',
      })
      toast.info('Transação marcada como ignorada.')
      await onReloadTransacoes()
    } catch {
      toast.error('Erro ao ignorar transação')
    }
  }

  async function handleDesconciliar(tx: ExtratoTransacaoRecord) {
    try {
      await updateOne('extratos_transacoes', tx.id, {
        status_conciliacao: 'pendente',
        vinculo_tipo: null,
        vinculo_id: null,
        data_conciliacao: null,
      })
      toast.success('Transação reaberta como pendente de conciliação.')
      await onReloadTransacoes()
    } catch {
      toast.error('Erro ao reabrir conciliação')
    }
  }

  // Upload de Comprovante Avulso
  async function handleUploadComprovanteAvulso() {
    if (!arquivoComprovanteAvulso || !destinoComprovanteId) {
      toast.error('Selecione o arquivo e a conta de destino.')
      return
    }

    setIsUploadingComprovante(true)
    try {
      const data = new FormData()
      data.append('comprovante', arquivoComprovanteAvulso)

      if (destinoComprovanteTipo === 'conta_pagar') {
        // Encontra conta para preservar metadados anteriores e adicionar o novo segregado
        const contaAlvo = contasPagar.find((c) => c.id === destinoComprovanteId)
        const metaExistente = Array.isArray(contaAlvo?.comprovantes_metadados)
          ? contaAlvo.comprovantes_metadados
          : []
        const tipoDet = arquivoComprovanteAvulso.name.toLowerCase().includes('boleto')
          ? 'boleto'
          : arquivoComprovanteAvulso.name.toLowerCase().includes('recibo')
            ? 'recibo'
            : 'comprovante_pix'

        const novosMetas = [
          ...metaExistente,
          {
            file: arquivoComprovanteAvulso.name,
            tipo: tipoDet,
            nome_original: arquivoComprovanteAvulso.name,
            tamanho: arquivoComprovanteAvulso.size,
          },
        ]
        data.append('comprovantes_metadados', JSON.stringify(novosMetas))

        await pb.collection('contas_pagar').update(destinoComprovanteId, data)
        toast.success('Comprovante anexado à conta a pagar com sucesso!')
        await onReloadContasPagar()
      } else {
        await pb.collection('contas_receber').update(destinoComprovanteId, data)
        toast.success('Comprovante anexado à receita avulsa com sucesso!')
        await onReloadContasReceber()
      }

      setModalComprovanteAvulso(false)
      setArquivoComprovanteAvulso(null)
      setDestinoComprovanteId('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Falha no upload do comprovante: ${msg}`)
    } finally {
      setIsUploadingComprovante(false)
    }
  }

  // Excluir extrato completo e todas as suas transações vinculadas
  async function handleExcluirExtrato() {
    if (!modalExcluirExtrato) return
    if (nomeConfirmacaoExclusao.trim() !== modalExcluirExtrato.nome_arquivo) {
      toast.error('O nome digitado não confere exatamente com o nome do arquivo.')
      return
    }

    setIsExcluindoExtrato(true)
    try {
      const extratoId = modalExcluirExtrato.id
      // 1. Busca e deleta todas as extratos_transacoes vinculadas
      const txsVinculadas = transacoes.filter((t) => t.extrato === extratoId)
      for (const t of txsVinculadas) {
        try {
          await deleteOne('extratos_transacoes', t.id)
        } catch {
          // prossegue
        }
      }

      // 2. Deleta o extrato pai
      await deleteOne('extratos', extratoId)

      toast.success(
        `Extrato "${modalExcluirExtrato.nome_arquivo}" e suas ${txsVinculadas.length} movimentações foram excluídos.`,
      )
      setModalExcluirExtrato(null)
      setNomeConfirmacaoExclusao('')
      setExtratoSelecionadoId('todos')
      setSelectedTxIds([])
      await onReloadExtratos()
      await onReloadTransacoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao excluir extrato: ${msg}`)
    } finally {
      setIsExcluindoExtrato(false)
    }
  }

  // Exclusão individual de transação com confirmação simples
  async function handleExcluirTransacaoIndividual() {
    if (!transacaoParaExcluir) return
    setIsExcluindoTransacao(true)
    try {
      await deleteOne('extratos_transacoes', transacaoParaExcluir.id)
      toast.success('Lançamento do extrato removido com sucesso.')
      setSelectedTxIds((prev) => prev.filter((id) => id !== transacaoParaExcluir.id))
      setTransacaoParaExcluir(null)
      await onReloadTransacoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Falha ao remover lançamento: ${msg}`)
    } finally {
      setIsExcluindoTransacao(false)
    }
  }

  // Modal de confirmação da baixa em lote
  const [modalConfirmacaoLoteAberto, setModalConfirmacaoLoteAberto] = useState(false)

  // Ações de seleção de transações para lote
  const transacoesPendentesVisiveis = useMemo(() => {
    return transacoesFiltradas.filter((t) =>
      Boolean(t && t?.id && t?.status_conciliacao === 'pendente'),
    )
  }, [transacoesFiltradas])

  const todasPendentesVisiveisSelecionadas = useMemo(() => {
    if (transacoesPendentesVisiveis.length === 0) return false
    return transacoesPendentesVisiveis.every((t) => Boolean(t?.id && selectedTxIds.includes(t.id)))
  }, [transacoesPendentesVisiveis, selectedTxIds])

  function alternarSelecaoTodasPendentesVisiveis() {
    if (todasPendentesVisiveisSelecionadas) {
      const idsPendentesVisiveis = new Set(
        transacoesPendentesVisiveis.map((t) => t.id).filter(Boolean),
      )
      setSelectedTxIds((prev) => prev.filter((id) => !idsPendentesVisiveis.has(id)))
    } else {
      const idsToAdd = transacoesPendentesVisiveis.filter((t) => Boolean(t?.id)).map((t) => t.id)
      setSelectedTxIds((prev) => Array.from(new Set([...prev, ...idsToAdd])))
    }
  }

  function alternarSelecaoTx(txId: string) {
    if (!txId) return
    setSelectedTxIds((prev) =>
      prev.includes(txId) ? prev.filter((id) => id !== txId) : [...prev, txId],
    )
  }

  // Conciliação em lote das transações selecionadas
  async function handleConfirmarEmLote() {
    if (selectedTxIds.length === 0) return
    setIsConciliandoLote(true)

    const itensParaConciliar = listaTransacoes.filter((t) =>
      Boolean(t?.id && selectedTxIds.includes(t.id) && t?.status_conciliacao === 'pendente'),
    )

    let totalConciliadas = 0
    let totalContasPagarBaixadas = 0
    let totalParcelasQuitadas = 0
    let totalReceitasQuitadas = 0

    try {
      for (const tx of itensParaConciliar) {
        const sugestoes = encontrarSugestoesConciliacao(
          tx,
          {
            parcelas,
            contasPagar,
            contasReceber,
          },
          10,
        )

        const melhorSugestao = sugestoes[0]
        const dataExtrato = tx.data.slice(0, 10)

        if (melhorSugestao) {
          if (melhorSugestao.tipo === 'parcela') {
            const p = parcelas.find((item) => item.id === melhorSugestao.id)
            if (p) {
              await updateOne('parcelas', p.id, {
                status: 'paga',
                data_pagamento: `${dataExtrato} 12:00:00.000Z`,
                valor_recebido: tx.valor,
                status_pagamento: 'Conciliado Extrato Lote',
              })
              totalParcelasQuitadas++
            }
          } else if (melhorSugestao.tipo === 'conta_pagar') {
            const cp = contasPagar.find((item) => item.id === melhorSugestao.id)
            if (cp) {
              await updateOne('contas_pagar', cp.id, {
                status: 'pago',
                data_pagamento: `${dataExtrato} 12:00:00.000Z`,
              })
              totalContasPagarBaixadas++
            }
          } else if (melhorSugestao.tipo === 'conta_receber') {
            const cr = contasReceber.find((item) => item.id === melhorSugestao.id)
            if (cr) {
              await updateOne('contas_receber', cr.id, {
                status: 'recebido',
                data_recebimento: `${dataExtrato} 12:00:00.000Z`,
                valor_recebido: tx.valor,
              })
              totalReceitasQuitadas++
            }
          }

          await updateOne('extratos_transacoes', tx.id, {
            status_conciliacao: 'conciliado',
            vinculo_tipo: melhorSugestao.tipo,
            vinculo_id: melhorSugestao.id,
            data_conciliacao: new Date().toISOString(),
            observacoes: `Conciliado em lote com ${melhorSugestao.titulo} (${melhorSugestao.tipo})`,
          })
        } else {
          // Sem sugestão direta: marca como conciliada diretamente no extrato
          await updateOne('extratos_transacoes', tx.id, {
            status_conciliacao: 'conciliado',
            data_conciliacao: new Date().toISOString(),
            observacoes: 'Conciliado em lote pelo operador',
          })
        }

        totalConciliadas++
      }

      toast.success(
        `Lote concluído: ${totalConciliadas} movimentações conciliadas! ` +
          `(${totalContasPagarBaixadas} despesas pagas, ${totalParcelasQuitadas} parcelas e ${totalReceitasQuitadas} recebíveis quitados).`,
      )

      setSelectedTxIds([])
      await Promise.all([
        onReloadTransacoes(),
        onReloadParcelas(),
        onReloadContasPagar(),
        onReloadContasReceber(),
      ])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao conciliar lote: ${msg}`)
    } finally {
      setIsConciliandoLote(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Topo com ações de Extrato e Comprovante */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 crm-card p-4">
        <div>
          <h3 className="font-bold text-neutral-900 text-sm">
            Extratos Bancários & Conciliação (.RET / OFX)
          </h3>
          <p className="text-xs text-neutral-500">
            Importe arquivos de retorno CNAB (.ret) e extratos (OFX/CSV/XLSX) com conciliação
            automática de parcelas e despesas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <>
              {/* Botão de Fotografia Mobile-first com Visão IA */}
              <Button
                size="sm"
                onClick={() => setModalCapturaIaAberto(true)}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white h-8 text-xs font-semibold shadow-sm"
              >
                {isMobile ? (
                  <>
                    <Camera className="mr-1.5 h-3.5 w-3.5" />
                    Fotografar Comprovante
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Analisar Comprovante com IA
                  </>
                )}
              </Button>

              {/* Upload de Comprovante Avulso existente mantido */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalComprovanteAvulso(true)}
                className="border-neutral-300 text-neutral-700 h-8 text-xs"
              >
                <Paperclip className="mr-1.5 h-3.5 w-3.5 text-neutral-600" />
                Vincular Comprovante Manual
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalUploadAberto(true)}
                className="border-neutral-300 text-neutral-700 h-8 text-xs hover:border-[#FF6A13]"
              >
                <FileUp className="mr-1.5 h-3.5 w-3.5 text-[#FF6A13]" />
                Importar Extrato / Retorno (.RET / OFX / Planilhas)
              </Button>
            </>
          )}
        </div>
      </div>
      {/* Cards de Contadores no Topo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="crm-card p-3 border-emerald-200 bg-emerald-50/40">
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
            <span>Confirmadas</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-2xl font-bold font-mono text-emerald-700">
            {contadoresStatus.confirmadas}
          </p>
          <span className="text-[10px] text-emerald-600">Conciliadas com sucesso</span>
        </div>

        <div className="crm-card p-3 border-orange-200 bg-orange-50/40">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#FF6A13] uppercase tracking-wide">
            <span>Pendentes</span>
            <Clock className="h-4 w-4 text-[#FF6A13]" />
          </div>
          <p className="mt-1 text-2xl font-bold font-mono text-[#FF6A13]">
            {contadoresStatus.pendentes}
          </p>
          <span className="text-[10px] text-neutral-500">Aguardando conciliação</span>
        </div>

        <div className="crm-card p-3 border-neutral-200 bg-neutral-50">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">
            <span>Ignoradas</span>
            <Filter className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="mt-1 text-2xl font-bold font-mono text-neutral-600">
            {contadoresStatus.ignoradas}
          </p>
          <span className="text-[10px] text-neutral-400">Fora do escopo</span>
        </div>

        <div className="crm-card p-3 bg-white">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
            <span>Total Transações</span>
            <FileSpreadsheet className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="mt-1 text-2xl font-bold font-mono text-neutral-900">
            {contadoresStatus.total}
          </p>
          <span className="text-[10px] text-neutral-400">
            {extratoSelecionadoId === 'todos' ? 'Todos os extratos' : 'Extrato selecionado'}
          </span>
        </div>
      </div>
      {/* Seção de Extratos Importados */}
      {listaExtratos.length > 0 && (
        <div className="crm-card p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
            <span>Extratos no Sistema ({listaExtratos.length})</span>
            {extratoSelecionadoId !== 'todos' && (
              <button
                onClick={() => setExtratoSelecionadoId('todos')}
                className="text-[11px] text-[#FF6A13] hover:underline"
              >
                (Ver transações de todos os extratos)
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setExtratoSelecionadoId('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                extratoSelecionadoId === 'todos'
                  ? 'bg-orange-50 border-[#FF6A13] text-[#FF6A13]'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              Todos os Extratos
            </button>

            {listaExtratos.map((ex) => {
              if (!ex) return null
              const isSelected = extratoSelecionadoId === ex.id
              const hashEncurtado =
                typeof ex.hash_arquivo === 'string' && ex.hash_arquivo.length > 14
                  ? `${ex.hash_arquivo.slice(0, 8)}...${ex.hash_arquivo.slice(-6)}`
                  : null
              const dataImportacao = ex.created ? formatDateBrasilia(ex.created) : null
              const fileUrl =
                ex.arquivo && typeof pb?.files?.getURL === 'function'
                  ? pb.files.getURL(ex, ex.arquivo)
                  : null

              return (
                <div
                  key={ex.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition ${
                    isSelected
                      ? 'bg-orange-50 border-[#FF6A13] text-[#FF6A13]'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <button
                    onClick={() => setExtratoSelecionadoId(ex.id)}
                    className="font-medium text-left truncate max-w-[240px]"
                    title={ex.nome_arquivo || 'Extrato'}
                  >
                    <span className="block truncate">{ex.nome_arquivo || 'Extrato sem nome'}</span>
                    <span className="flex items-center gap-1 text-[10px] text-neutral-400 font-normal">
                      <span>({ex.total_transacoes || 0} tx)</span>
                      {dataImportacao && <span>· {dataImportacao}</span>}
                    </span>
                    {hashEncurtado && (
                      <span
                        className="block font-mono text-[9px] text-neutral-400"
                        title={`SHA-256 completo: ${ex.hash_arquivo}`}
                      >
                        SHA: {hashEncurtado}
                      </span>
                    )}
                  </button>

                  {ex.formato === 'ret' && (
                    <span className="px-1 py-0.2 bg-blue-100 text-blue-800 text-[9px] font-semibold rounded uppercase">
                      CNAB
                    </span>
                  )}

                  {fileUrl && (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-400 hover:text-[#FF6A13] ml-1"
                      title="Baixar arquivo original importado"
                    >
                      <FileUp className="h-3 w-3 rotate-180" />
                    </a>
                  )}

                  {podeExcluirExtratos && (
                    <button
                      onClick={() => {
                        setModalExcluirExtrato(ex)
                        setNomeConfirmacaoExclusao('')
                      }}
                      className="text-neutral-400 hover:text-rose-600 ml-1"
                      title="Excluir este extrato (Restrito a Admin/Financeiro)"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Barra de Ações em Lote e Filtros de Transações */}
      <div className="crm-card p-3 space-y-3">
        {/* Barra superior de conciliação em lote quando houver pendentes */}
        {canWrite && transacoesPendentesVisiveis.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={alternarSelecaoTodasPendentesVisiveis}
                className="h-8 text-xs font-medium border-neutral-300"
              >
                {todasPendentesVisiveisSelecionadas ? (
                  <>
                    <CheckSquare className="mr-1.5 h-3.5 w-3.5 text-[#FF6A13]" />
                    Desmarcar visíveis
                  </>
                ) : (
                  <>
                    <Square className="mr-1.5 h-3.5 w-3.5 text-neutral-500" />
                    Selecionar todas as pendentes visíveis ({transacoesPendentesVisiveis.length})
                  </>
                )}
              </Button>
              {selectedTxIds.length > 0 && (
                <span className="text-xs text-neutral-600">
                  <strong className="text-[#FF6A13] font-bold">{selectedTxIds.length}</strong>{' '}
                  selecionada(s)
                </span>
              )}
            </div>

            {selectedTxIds.length > 0 && (
              <Button
                size="sm"
                onClick={() => setModalConfirmacaoLoteAberto(true)}
                disabled={isConciliandoLote}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white h-8 text-xs font-semibold shadow-sm"
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Confirmar em lote ({selectedTxIds.length})
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por descrição da transação ou número do documento..."
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={filtroContaBancaria} onValueChange={setFiltroContaBancaria}>
              <SelectTrigger className="w-[170px] h-9 text-xs">
                <SelectValue placeholder="Conta Bancária PJ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas contas PJ</SelectItem>
                {contasBancarias.map((cb) => (
                  <SelectItem key={cb.id} value={cb.id}>
                    {cb.apelido}
                  </SelectItem>
                ))}
                <SelectItem value="sem_conta">Não classificada</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="entrada">Entradas (+)</SelectItem>
                <SelectItem value="saida">Saídas (-)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <Filter className="mr-1.5 h-3.5 w-3.5 text-neutral-400" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="pendente">Pendente de Conciliação</SelectItem>
                <SelectItem value="conciliado">Conciliado</SelectItem>
                <SelectItem value="ignorado">Ignorado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      {/* Tabela de Transações */}
      {transacoesFiltradas.length === 0 ? (
        <EmptyState
          title="Nenhuma transação de extrato encontrada"
          description={
            extratos.length === 0
              ? 'Suba o extrato bancário ou arquivo de retorno da sua conta (.RET, .OFX, .CSV ou .XLSX) para iniciar a conciliação.'
              : 'Nenhuma transação corresponde aos filtros selecionados.'
          }
        />
      ) : (
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b">
                <tr>
                  {canWrite && <th className="px-3 py-3 w-8 text-center">Sel.</th>}
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Descrição da Movimentação</th>
                  <th className="px-4 py-3">Documento Ref.</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ação / Vínculo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {transacoesFiltradas.map((tx) => {
                  const isChecked = selectedTxIds.includes(tx.id)
                  const isPendente = tx.status_conciliacao === 'pendente'

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-neutral-50/80 transition ${
                        isChecked
                          ? 'bg-orange-50/50'
                          : tx.status_conciliacao === 'conciliado'
                            ? 'bg-emerald-50/20'
                            : ''
                      }`}
                    >
                      {canWrite && (
                        <td className="px-3 py-3 text-center">
                          {isPendente ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => alternarSelecaoTx(tx.id)}
                              className="rounded border-neutral-300 text-[#FF6A13] focus:ring-[#FF6A13] h-4 w-4 cursor-pointer"
                              title="Selecionar para conciliação em lote"
                            />
                          ) : (
                            <span className="text-neutral-300">—</span>
                          )}
                        </td>
                      )}

                      <td className="px-4 py-3 whitespace-nowrap font-mono text-neutral-800">
                        {formatDate(tx.data)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-0.5 max-w-[340px]">
                          <p className="font-semibold text-neutral-900 line-clamp-1">
                            {tx.descricao}
                          </p>
                          {tx.observacoes && (
                            <p className="text-[11px] text-emerald-700 italic">{tx.observacoes}</p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-neutral-500 font-mono text-[11px]">
                        {tx.documento_ref || '—'}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`mono-value font-bold text-sm ${
                            tx.tipo === 'entrada' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {tx.tipo === 'entrada' ? '+' : '-'} {formatCurrency(tx.valor)}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.status_conciliacao === 'conciliado' ? (
                          <CrmBadge tone="green">Conciliado</CrmBadge>
                        ) : tx.status_conciliacao === 'ignorado' ? (
                          <CrmBadge tone="gray">Ignorado</CrmBadge>
                        ) : (
                          <CrmBadge tone="amber">Pendente</CrmBadge>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {tx.status_conciliacao === 'pendente' && canWrite && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => {
                                  // Verifica duplicidades antes de abrir
                                  if (tx.tipo === 'saida') {
                                    const alerta = verificarDuplicidadeLancamento(
                                      'conta_pagar',
                                      {
                                        valor: tx.valor,
                                        data: tx.data,
                                        numeroDocumento: tx.documento_ref,
                                        fornecedorOuCliente: tx.descricao,
                                      },
                                      listaContasPagar.map((c) => ({
                                        id: c.id,
                                        valor: c.valor || 0,
                                        data: c.data_pagamento || c.data_vencimento || '',
                                        numero_documento: c.numero_documento,
                                        fornecedorOuCliente: c.fornecedor,
                                        descricao: c.descricao,
                                      })),
                                    )
                                    setAlertaDuplicidadeDetectado(alerta)
                                  } else {
                                    const alerta = verificarDuplicidadeLancamento(
                                      'conta_receber',
                                      {
                                        valor: tx.valor,
                                        data: tx.data,
                                        numeroDocumento: tx.documento_ref,
                                        fornecedorOuCliente: tx.descricao,
                                      },
                                      listaContasReceber.map((c) => ({
                                        id: c.id,
                                        valor: c.valor || 0,
                                        data: c.data_recebimento || c.data_vencimento || '',
                                        numero_documento: c.numero_documento,
                                        fornecedorOuCliente: c.cliente_nome || '',
                                        descricao: c.descricao,
                                      })),
                                    )
                                    setAlertaDuplicidadeDetectado(alerta)
                                  }
                                  setTransacaoParaConciliar(tx)
                                }}
                                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white h-7 text-xs font-semibold"
                                title="Encontrar correspondência no CRM"
                              >
                                <Sparkles className="mr-1 h-3 w-3" />
                                Conciliar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleIgnorarTransacao(tx)}
                                className="h-7 text-xs text-neutral-400 hover:text-neutral-700"
                                title="Ignorar esta transação"
                              >
                                Ignorar
                              </Button>
                            </>
                          )}

                          {tx.status_conciliacao === 'conciliado' && canWrite && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDesconciliar(tx)}
                              className="h-7 text-xs border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                            >
                              <RefreshCw className="mr-1 h-3 w-3" />
                              Desfazer
                            </Button>
                          )}

                          {tx.status_conciliacao === 'ignorado' && canWrite && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDesconciliar(tx)}
                              className="h-7 text-xs text-neutral-600 hover:underline"
                            >
                              Reativar
                            </Button>
                          )}

                          {canWrite && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setTransacaoParaExcluir(tx)}
                              className="h-7 w-7 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Excluir este lançamento"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Modal de Importação de Extrato */}
      <Dialog open={modalUploadAberto} onOpenChange={setModalUploadAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Extrato / Retorno Bancário</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Conta Bancária PJ AEROCAD *</Label>
              <Select
                value={contaBancariaSelecionadaUpload}
                onValueChange={setContaBancariaSelecionadaUpload}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a conta PJ..." />
                </SelectTrigger>
                <SelectContent>
                  {contasBancarias.map((cb) => (
                    <SelectItem key={cb.id} value={cb.id}>
                      {cb.apelido} ({cb.banco_nome})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 space-y-1">
              <p className="font-semibold">Formatos Suportados:</p>
              <p>
                • <strong>.RET (CNAB 240 / 400)</strong>: Retorno bancário de cobrança e conciliação
                (BB, Itaú, Caixa, Santander, Bradesco, Sicoob etc.).
              </p>
              <p>
                • <strong>OFX</strong>: Extrato bancário de Internet Banking dos bancos brasileiros.
              </p>
              <p>
                • <strong>CSV / XLSX</strong>: Planilhas de extrato bancário com colunas de data,
                histórico e valor.
              </p>
            </div>

            <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:border-[#FF6A13] transition cursor-pointer relative bg-neutral-50/50">
              <FileUp className="mx-auto h-8 w-8 text-[#FF6A13] mb-2" />
              <p className="font-semibold text-neutral-800">
                Clique para selecionar ou arraste arquivos de extrato / retorno
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                .RET (CNAB 240/400), OFX, CSV ou XLSX
              </p>
              <input
                type="file"
                multiple
                accept=".ret,.ofx,.csv,.xlsx,.xls"
                onChange={handleFileSelected}
                disabled={isProcessandoUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>

            {isProcessandoUpload && (
              <div className="text-center text-xs text-[#FF6A13] font-semibold animate-pulse">
                Processando e analisando transações do extrato...
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalUploadAberto(false)}
              disabled={isProcessandoUpload}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal de Conciliação com Sugestões */}
      <Dialog open={!!transacaoParaConciliar} onOpenChange={() => setTransacaoParaConciliar(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#FF6A13]" />
              Conciliar Transação Bancária
            </DialogTitle>
          </DialogHeader>

          {transacaoParaConciliar && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-neutral-50 rounded-lg border space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400">
                  Transação do Extrato
                </span>
                <p className="text-sm font-bold text-neutral-900">
                  {transacaoParaConciliar.descricao}
                </p>
                <div className="flex items-center gap-4 text-neutral-600">
                  <span>Data: {formatDate(transacaoParaConciliar.data)}</span>
                  <span>
                    Valor:{' '}
                    <strong
                      className={
                        transacaoParaConciliar.tipo === 'entrada'
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }
                    >
                      {transacaoParaConciliar.tipo === 'entrada' ? '+' : '-'}{' '}
                      {formatCurrency(transacaoParaConciliar.valor)}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Alerta de Duplicidade se detectado */}
              {alertaDuplicidadeDetectado?.detectada && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Atenção: Possível Duplicidade Detectada</span>
                  </div>
                  <p className="text-[11px]">{alertaDuplicidadeDetectado.motivo}</p>
                </div>
              )}

              <div>
                <p className="font-semibold text-neutral-800 mb-2">
                  Sugestões de Correspondência no CRM (por valor e proximidade de data):
                </p>

                {sugestoesAtuais.length === 0 ? (
                  <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg text-amber-900 text-center space-y-2">
                    <p>Nenhuma correspondência exata encontrada com data próxima.</p>
                    <p className="text-[11px] text-neutral-500">
                      Você pode cadastrar uma conta a pagar/receber com este valor ou ignorar esta
                      movimentação.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y border rounded-lg overflow-hidden bg-white">
                    {sugestoesAtuais.map((sug) => {
                      const isSugChecked =
                        sugestaoSelecionadaModal?.id === sug.id &&
                        sugestaoSelecionadaModal?.tipo === sug.tipo

                      return (
                        <div
                          key={`${sug.tipo}_${sug.id}`}
                          className={`p-3 flex items-center justify-between gap-3 transition cursor-pointer ${
                            isSugChecked
                              ? 'bg-orange-50/70 border-l-4 border-l-[#FF6A13]'
                              : 'hover:bg-neutral-50'
                          }`}
                          onClick={() => setSugestaoSelecionadaModal(sug)}
                        >
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSugChecked}
                              onChange={() => setSugestaoSelecionadaModal(sug)}
                              className="mt-1 rounded border-neutral-300 text-[#FF6A13] focus:ring-[#FF6A13] h-4 w-4 cursor-pointer"
                            />
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-neutral-900">{sug.titulo}</span>
                                <CrmBadge
                                  tone={
                                    sug.confianca === 'alta'
                                      ? 'green'
                                      : sug.confianca === 'media'
                                        ? 'amber'
                                        : 'gray'
                                  }
                                >
                                  {sug.confianca === 'alta'
                                    ? 'Alta Confiança'
                                    : sug.confianca === 'media'
                                      ? 'Média Confiança'
                                      : 'Data Distante'}
                                </CrmBadge>
                              </div>
                              <p className="text-[11px] text-neutral-500">{sug.detalhe}</p>
                              <p className="text-[10px] text-neutral-400">
                                Diferença de datas: {sug.diferencaDias} dia(s) · Valor:{' '}
                                {formatCurrency(sug.valor)}
                              </p>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            disabled={isConciliando}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleConfirmarConciliacao(sug)
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 h-8 text-xs font-semibold"
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Confirmar Vínculo
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransacaoParaConciliar(null)}
              disabled={isConciliando}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal de Comprovante Avulso */}
      <Dialog open={modalComprovanteAvulso} onOpenChange={setModalComprovanteAvulso}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subir Comprovante de Pagamento / Recibo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Vincular a:</Label>
              <Select
                value={destinoComprovanteTipo}
                onValueChange={(val) => {
                  setDestinoComprovanteTipo(val as 'conta_pagar' | 'conta_receber')
                  setDestinoComprovanteId('')
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conta_pagar">Conta a Pagar (Despesa)</SelectItem>
                  <SelectItem value="conta_receber">Receita Avulsa (Recebível)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Selecione o Lançamento *</Label>
              <Select value={destinoComprovanteId} onValueChange={setDestinoComprovanteId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {destinoComprovanteTipo === 'conta_pagar'
                    ? listaContasPagar.map((cp) => (
                        <SelectItem key={cp.id} value={cp.id}>
                          {cp.fornecedor || 'Fornecedor'} — {cp.descricao || ''} (
                          {formatCurrency(cp.valor || 0)})
                        </SelectItem>
                      ))
                    : listaContasReceber.map((cr) => (
                        <SelectItem key={cr.id} value={cr.id}>
                          {cr.cliente_nome || 'Cliente'} — {cr.descricao || ''} (
                          {formatCurrency(cr.valor || 0)})
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Arquivo do Comprovante (PDF ou Imagem) *</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setArquivoComprovanteAvulso(e.target.files?.[0] || null)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalComprovanteAvulso(false)}
              disabled={isUploadingComprovante}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUploadComprovanteAvulso}
              disabled={
                isUploadingComprovante || !arquivoComprovanteAvulso || !destinoComprovanteId
              }
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              {isUploadingComprovante ? 'Enviando...' : 'Salvar Comprovante'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal de Análise e Resumo Pré-Gravação do Retorno CNAB (.RET) */}
      <Dialog
        open={!!resumoRetornoModal}
        onOpenChange={(open) => {
          if (!open && !isGravandoRetorno) setResumoRetornoModal(null)
        }}
      >
        {resumoRetornoModal && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                <FileUp className="h-4 w-4 text-[#FF6A13]" />
                Resumo da Conciliação de Retorno Bancário (.RET)
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              {/* Cabeçalho do arquivo decodificado */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-neutral-50 rounded-lg border">
                <div>
                  <span className="text-[10px] text-neutral-400 block uppercase font-semibold">
                    Arquivo
                  </span>
                  <span className="font-semibold text-neutral-800 truncate block">
                    {resumoRetornoModal?.file?.name || 'Arquivo .RET'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block uppercase font-semibold">
                    Layout Detectado
                  </span>
                  <span className="font-bold text-[#FF6A13]">
                    {resumoRetornoModal?.parsed?.layout || 'CNAB'} (
                    {resumoRetornoModal?.parsed?.bancoNome || 'Banco'})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block uppercase font-semibold">
                    Conta PJ Destino
                  </span>
                  <span className="font-semibold text-neutral-800 truncate block">
                    {contasBancarias.find((c) => c.id === resumoRetornoModal?.contaBancariaId)
                      ?.apelido || 'Não associada'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block uppercase font-semibold">
                    Período Coberto
                  </span>
                  <span className="font-mono text-neutral-700">
                    {resumoRetornoModal?.parsed?.dataInicio
                      ? formatDate(resumoRetornoModal.parsed.dataInicio)
                      : '—'}{' '}
                    a{' '}
                    {resumoRetornoModal?.parsed?.dataFim
                      ? formatDate(resumoRetornoModal.parsed.dataFim)
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Banner de Deduplicação do Retorno */}
              {resumoRetornoModal?.analise?.arquivoJaImportado ||
              (resumoRetornoModal?.analise?.totalNovas ?? 0) === 0 ? (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Arquivo já importado anteriormente — nenhum lançamento novo</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Todos os{' '}
                    <strong>{resumoRetornoModal?.analise?.totalCandidatas ?? 0} lançamentos</strong>{' '}
                    deste retorno bancário já constam no banco de dados. Nenhuma movimentação será
                    duplicada na conciliação ou no fluxo.
                    {resumoRetornoModal?.analise?.extratoExistenteCorrespondente && (
                      <span className="block mt-1 text-amber-900 font-medium">
                        Importação anterior registrada em:{' '}
                        {formatDate(
                          resumoRetornoModal.analise.extratoExistenteCorrespondente.created,
                        )}{' '}
                        (Extrato ref:{' '}
                        {resumoRetornoModal.analise.extratoExistenteCorrespondente.nome_arquivo})
                      </span>
                    )}
                  </p>
                </div>
              ) : (resumoRetornoModal?.analise?.totalDuplicadas ?? 0) > 0 ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-950 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Filtro de Deduplicação Ativo</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    <strong>
                      {resumoRetornoModal?.analise?.totalNovas ?? 0} lançamentos novos
                    </strong>{' '}
                    serão gravados e{' '}
                    <strong>
                      {resumoRetornoModal?.analise?.totalDuplicadas ?? 0} já existentes no banco
                    </strong>{' '}
                    serão ignorados para preservar integridade.
                  </p>
                </div>
              ) : null}

              {/* Totais de lançamentos e resumo de deduplicação */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg">
                  <span className="text-[10px] font-semibold text-emerald-800 uppercase block">
                    Novos Lançamentos
                  </span>
                  <p className="text-base font-bold text-emerald-700 mt-1">
                    {resumoRetornoModal?.analise?.totalNovas ?? 0}
                  </p>
                  <span className="text-[10px] text-emerald-600">
                    +{formatCurrency(resumoRetornoModal?.analise?.totalEntradasNovas ?? 0)}
                  </span>
                </div>

                <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
                  <span className="text-[10px] font-semibold text-amber-800 uppercase block">
                    Já Existentes (Ignorados)
                  </span>
                  <p className="text-base font-bold text-amber-700 mt-1">
                    {resumoRetornoModal?.analise?.totalDuplicadas ?? 0}
                  </p>
                  <span className="text-[10px] text-amber-600">Evitando duplicidade</span>
                </div>

                <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-lg">
                  <span className="text-[10px] font-semibold text-rose-800 uppercase block">
                    Débitos / Tarifas
                  </span>
                  <p className="text-base font-bold text-rose-700 mt-1">
                    {formatCurrency(resumoRetornoModal?.parsed?.totalSaidas ?? 0)}
                  </p>
                  <span className="text-[10px] text-rose-600">
                    {resumoRetornoModal?.parsed?.qtdSaidas ?? 0} débito(s)
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 border rounded-lg">
                  <span className="text-[10px] font-semibold text-neutral-600 uppercase block">
                    Total no Arquivo
                  </span>
                  <p className="text-base font-bold text-neutral-800 mt-1">
                    {resumoRetornoModal?.parsed?.totalTransacoes ?? 0}
                  </p>
                  <span className="text-[10px] text-neutral-500">
                    {resumoRetornoModal?.parsed?.totalRegistros ?? 0} linhas
                  </span>
                </div>
              </div>

              {/* Resumo dos códigos de ocorrência encontrados */}
              <div>
                <p className="font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Códigos de Ocorrência Encontrados no Arquivo:
                </p>
                <div className="border rounded-lg overflow-hidden divide-y bg-white">
                  {(resumoRetornoModal?.parsed?.ocorrenciasResumo || []).map((oc) => (
                    <div
                      key={oc.codigo}
                      className="px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded text-[11px]">
                          Cód. {oc.codigo}
                        </span>
                        <span className="font-medium text-neutral-800">{oc.descricao}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-neutral-500 font-medium mr-2">
                          {oc.quantidade} reg.
                        </span>
                        <span className="font-mono font-semibold text-neutral-900">
                          {formatCurrency(oc.valorTotal)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Avisos se houver linhas não interpretadas */}
              {(resumoRetornoModal?.parsed?.avisos?.length ?? 0) > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-xs text-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    Avisos de Processamento ({resumoRetornoModal?.parsed?.avisos?.length ?? 0}):
                  </p>
                  <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] text-amber-800 pr-1">
                    {resumoRetornoModal?.parsed?.avisos?.map((av, idx) => (
                      <div key={idx}>
                        • Linha {av.linha}: {av.mensagem}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prévia das primeiras transações */}
              <div>
                <p className="font-semibold text-neutral-800 mb-1.5">
                  Prévia dos Lançamentos (primeiros{' '}
                  {Math.min(5, resumoRetornoModal?.parsed?.transacoes?.length ?? 0)} de{' '}
                  {resumoRetornoModal?.parsed?.transacoes?.length ?? 0}):
                </p>
                <div className="border rounded-lg overflow-hidden divide-y bg-white text-[11px]">
                  {(resumoRetornoModal?.parsed?.transacoes || []).slice(0, 5).map((t, i) => (
                    <div key={i} className="p-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-neutral-900">{t.descricao}</p>
                        <p className="text-neutral-400">
                          Data: {formatDate(t.data)} · Ref: {t.documentoRef || t.nossoNumero || '—'}
                        </p>
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          t.tipo === 'entrada' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {t.tipo === 'entrada' ? '+' : '-'} {formatCurrency(t.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="outline"
                disabled={isGravandoRetorno}
                onClick={() => setResumoRetornoModal(null)}
              >
                Cancelar
              </Button>
              {resumoRetornoModal?.analise?.arquivoJaImportado ||
              (resumoRetornoModal?.analise?.totalNovas ?? 0) === 0 ? (
                <Button
                  variant="default"
                  onClick={() => setResumoRetornoModal(null)}
                  className="bg-neutral-800 hover:bg-neutral-900 text-white"
                >
                  Concluir
                </Button>
              ) : (
                <Button
                  onClick={handleConfirmarGravacaoRetorno}
                  disabled={
                    isGravandoRetorno || (resumoRetornoModal?.analise?.totalNovas ?? 0) === 0
                  }
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-semibold"
                >
                  {isGravandoRetorno
                    ? 'Gravando e Alimentando Fluxo...'
                    : `Confirmar e Gravar no CRM (${resumoRetornoModal?.analise?.totalNovas ?? 0} novos)`}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      {/* Modal Destrutivo de Excluir Extrato (Exige digitar o nome exato) */}
      <Dialog
        open={!!modalExcluirExtrato}
        onOpenChange={(open) => {
          if (!open && !isExcluindoExtrato) {
            setModalExcluirExtrato(null)
            setNomeConfirmacaoExclusao('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-600" />
              Exclusão Definitiva de Extrato Bancário
            </DialogTitle>
          </DialogHeader>
          {modalExcluirExtrato && (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
                <p className="font-bold">
                  Ação irreversível restrita ao Financeiro e Administração:
                </p>
                <p>
                  A exclusão do extrato <strong>{modalExcluirExtrato.nome_arquivo}</strong> apagará{' '}
                  <strong>todas as suas transações vinculadas</strong> do banco de dados e
                  atualizará o Fluxo de Caixa automaticamente.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-neutral-700">
                  Para confirmar, digite exatamente o nome do arquivo:
                </Label>
                <p className="font-mono bg-neutral-100 p-1.5 rounded select-all font-semibold text-neutral-900">
                  {modalExcluirExtrato.nome_arquivo}
                </p>
                <Input
                  value={nomeConfirmacaoExclusao}
                  onChange={(e) => setNomeConfirmacaoExclusao(e.target.value)}
                  placeholder="Cole ou digite o nome exato aqui..."
                  className="font-mono text-xs"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isExcluindoExtrato}
              onClick={() => {
                setModalExcluirExtrato(null)
                setNomeConfirmacaoExclusao('')
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExcluirExtrato}
              disabled={
                isExcluindoExtrato ||
                !modalExcluirExtrato ||
                nomeConfirmacaoExclusao.trim() !== modalExcluirExtrato.nome_arquivo
              }
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isExcluindoExtrato ? 'Excluindo...' : 'Confirmar Exclusão Destrutiva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal de Confirmação da Baixa em Lote */}
      <Dialog
        open={modalConfirmacaoLoteAberto}
        onOpenChange={(aberto) => {
          if (!isConciliandoLote) setModalConfirmacaoLoteAberto(aberto)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-neutral-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Confirmar Baixa em Lote ({selectedTxIds.length} selecionadas)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <p className="text-neutral-700">
              Você está prestes a executar a <strong>baixa em cascata</strong> para as seguintes
              movimentações bancárias selecionadas:
            </p>
            <div className="p-3 bg-neutral-50 rounded-lg border text-[11px] space-y-1.5 max-h-48 overflow-y-auto">
              {listaTransacoes
                .filter((t) => t && selectedTxIds.includes(t.id))
                .map((t) => (
                  <div
                    key={t.id}
                    className="flex justify-between items-center py-1 border-b last:border-0 border-neutral-200"
                  >
                    <span className="truncate max-w-[240px] font-medium text-neutral-800">
                      {t.descricao || 'Movimentação sem descrição'}
                    </span>
                    <span className="font-mono font-bold text-neutral-900 shrink-0">
                      {formatCurrency(t.valor || 0)}
                    </span>
                  </div>
                ))}
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 space-y-1">
              <span className="font-bold block">Efeito da baixa em cascata:</span>
              <p>
                • Despesas correspondentes: <strong>contas_pagar</strong> alteradas para{' '}
                <strong>pago</strong>
              </p>
              <p>
                • Parcelas e recebíveis: marcados como <strong>paga / recebido</strong>
              </p>
              <p>
                • Lançamento do extrato: status alterado para <strong>conciliado</strong> com
                recálculo automático do fluxo
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isConciliandoLote}
              onClick={() => setModalConfirmacaoLoteAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isConciliandoLote}
              onClick={async () => {
                await handleConfirmarEmLote()
                setModalConfirmacaoLoteAberto(false)
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isConciliandoLote ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Processando Baixas...
                </>
              ) : (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Confirmar Baixas
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal de Excluir Transação Individual */}
      <Dialog
        open={!!transacaoParaExcluir}
        onOpenChange={(open) => {
          if (!open && !isExcluindoTransacao) setTransacaoParaExcluir(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-600 text-sm">
              Excluir Lançamento do Extrato
            </DialogTitle>
          </DialogHeader>
          {transacaoParaExcluir && (
            <p className="text-xs text-neutral-600">
              Deseja remover o lançamento <strong>"{transacaoParaExcluir.descricao}"</strong> no
              valor de <strong>{formatCurrency(transacaoParaExcluir.valor)}</strong>?
            </p>
          )}
          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isExcluindoTransacao}
              onClick={() => setTransacaoParaExcluir(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isExcluindoTransacao}
              onClick={handleExcluirTransacaoIndividual}
            >
              {isExcluindoTransacao ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal de Prévia e Deduplicação de Extratos (OFX, CSV, XLSX) */}
      {modalPreviaExtrato && (
        <PreviaImportacaoExtratoModal
          open={!!modalPreviaExtrato}
          onOpenChange={(open) => {
            if (!open && !isGravandoExtrato) setModalPreviaExtrato(null)
          }}
          analise={modalPreviaExtrato?.analise || null}
          formato={modalPreviaExtrato?.formato || 'ofx'}
          contaBancaria={contasBancarias.find((c) => c.id === modalPreviaExtrato?.contaBancariaId)}
          isGravando={isGravandoExtrato}
          onConfirmarGravacao={handleConfirmarGravacaoPreviaExtrato}
        />
      )}
      {/* Modal de Captura Mobile / Extração IA de Comprovantes */}
      <CapturaComprovanteModal
        open={modalCapturaIaAberto}
        onOpenChange={setModalCapturaIaAberto}
        projetos={listaProjetos}
        contasBancarias={contasBancarias || []}
        credores={listaCredores}
        isMobile={isMobile}
        onSuccess={async () => {
          await onReloadContasPagar()
        }}
      />{' '}
    </div>
  )
}
