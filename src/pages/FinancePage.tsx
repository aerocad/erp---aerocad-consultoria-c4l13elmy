import { useMemo, useState, type FormEvent } from 'react'
import {
  Banknote,
  CalendarClock,
  Check,
  CheckCircle2,
  CheckSquare,
  CircleDollarSign,
  CopyX,
  FileSpreadsheet,
  Layers,
  Link as LinkIcon,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { SectionHeader } from '@/components/common/SectionHeader'
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States'
import { ConfirmarExcluirNotaModal } from '@/components/financeiro/ConfirmarExcluirNotaModal'
import { ImportacaoNfseModal } from '@/components/financeiro/ImportacaoNfseModal'
import { ExcluirDuplicadasModal } from '@/components/financeiro/ExcluirDuplicadasModal'
import { ExtrairProjetosModal } from '@/components/financeiro/ExtrairProjetosModal'
import { NotaExclusaoAlvo } from '@/services/exclusaoService'
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
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { useCrmData } from '@/hooks/use-crm-data'
import { formatCurrency, formatDate } from '@/lib/format'
import { createOne, updateOne } from '@/services/api'
import { vincularNotaOrfaAParcela } from '@/services/nfseExecutor'
import type { NfseDadoExtraido } from '@/services/nfseParser'
import type { ClienteRecord, ParcelaRecord, ProjetoRecord } from '@/types/crm'

export default FinancePage

export function FinancePage() {
  const { ocultarValores } = useFinanceiroVisibilidade()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const installments = useCrmData<ParcelaRecord>('parcelas', {
    sort: '-vencimento',
    expand: 'projeto,cliente',
  })
  const projects = useCrmData<ProjetoRecord>('projetos', {
    sort: '-created',
  })
  const clients = useCrmData<ClienteRecord>('clientes', {
    sort: 'razao_social',
  })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(params.get('status') || 'todos')
  const [month, setMonth] = useState('todos')
  const [projectFilter, setProjectFilter] = useState(params.get('projeto') || 'todos')
  const [activeTab, setActiveTab] = useState<'parcelas' | 'orfas'>('parcelas')
  const [importNfseOpen, setImportNfseOpen] = useState(false)
  const [duplicadasModalOpen, setDuplicadasModalOpen] = useState(false)
  const [extrairProjetosModalOpen, setExtrairProjetosModalOpen] = useState(false)
  const [excluirNotaOpen, setExcluirNotaOpen] = useState(false)
  const [notasParaExcluir, setNotasParaExcluir] = useState<NotaExclusaoAlvo[]>([])
  const [payment, setPayment] = useState<ParcelaRecord | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payValue, setPayValue] = useState('')

  // Estados de seleção múltipla e ações manuais de recebimento/exclusão em lote
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedOrfasIds, setSelectedOrfasIds] = useState<string[]>([])
  const [bulkMarkModalOpen, setBulkMarkModalOpen] = useState(false)
  const [bulkPayDate, setBulkPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [reabrirModalParcela, setReabrirModalParcela] = useState<ParcelaRecord | null>(null)
  const [isReabrindo, setIsReabrindo] = useState(false)

  // Estado de Notas Órfãs em memória (persistido na sessão do navegador para vinculação manual)
  const [notasOrfas, setNotasOrfas] = useState<NfseDadoExtraido[]>(() => {
    try {
      const saved = sessionStorage.getItem('aerocad_nfse_orfas')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [vinculandoNota, setVinculandoNota] = useState<NfseDadoExtraido | null>(null)
  const [parcelaDestinoId, setParcelaDestinoId] = useState('')
  const [isVinculando, setIsVinculando] = useState(false)

  // Estado para opções de criação ou vínculo de cliente ao vincular nota órfã
  const [modoClienteOrfa, setModoClienteOrfa] = useState<'manter_atual' | 'existente' | 'novo'>(
    'manter_atual',
  )
  const [clienteSelecionadoOrfaId, setClienteSelecionadoOrfaId] = useState('')
  const [novoClienteOrfaRazao, setNovoClienteOrfaRazao] = useState('')
  const [novoClienteOrfaCnpj, setNovoClienteOrfaCnpj] = useState('')
  const [novoClienteOrfaEndereco, setNovoClienteOrfaEndereco] = useState('')
  const [novoClienteOrfaMunicipio, setNovoClienteOrfaMunicipio] = useState('')
  const [novoClienteOrfaUf, setNovoClienteOrfaUf] = useState('')
  const [descricaoVinculoOrfa, setDescricaoVinculoOrfa] = useState('')

  const [form, setForm] = useState({
    projeto: '',
    cliente: '',
    descricao: '',
    valor: '',
    vencimento: '',
    gatilho: 'manual',
    status: 'pendente',
    origem: 'manual',
    observacoes: '',
  })
  const canWrite = user?.role === 'admin' || user?.role === 'financeiro'

  // Contagem de duplicatas na lista de órfãs
  const totalDuplicatasOrfas = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const nota of notasOrfas) {
      const num = (nota.numero || '').trim().toLowerCase()
      const prestador = (nota.prestadorCnpjCpf || '').trim().toLowerCase() || 'aerocad'
      const chave = `${num}_${prestador}`
      contagem.set(chave, (contagem.get(chave) || 0) + 1)
    }
    let dupes = 0
    for (const count of contagem.values()) {
      if (count > 1) {
        dupes += count - 1
      }
    }
    return dupes
  }, [notasOrfas])

  const handleExcluirDuplicadas = (idsParaExcluir: string[]) => {
    if (!idsParaExcluir || idsParaExcluir.length === 0) return
    const idsSet = new Set(idsParaExcluir)
    setNotasOrfas((prev) => {
      const filtradas = prev.filter((n) => !idsSet.has(n.idTemp))
      try {
        sessionStorage.setItem('aerocad_nfse_orfas', JSON.stringify(filtradas))
      } catch {
        /* intentionally ignored */
      }
      return filtradas
    })
    toast.success(
      `${idsParaExcluir.length} ${
        idsParaExcluir.length === 1 ? 'nota duplicada excluída' : 'notas duplicadas excluídas'
      } com sucesso!`,
    )
  }

  const months = useMemo(() => {
    const set = new Set<string>()
    installments.data.forEach((item) => {
      if (item.vencimento) set.add(item.vencimento.slice(0, 7))
    })
    return Array.from(set).sort().reverse()
  }, [installments.data])

  const rows = useMemo(() => {
    return installments.data.filter((item) => {
      const matchQuery =
        item.descricao.toLowerCase().includes(query.toLowerCase()) ||
        item.expand?.projeto?.numero?.toLowerCase().includes(query.toLowerCase()) ||
        item.expand?.cliente?.razao_social?.toLowerCase().includes(query.toLowerCase()) ||
        (item.nf_numero && item.nf_numero.toLowerCase().includes(query.toLowerCase()))
      const matchStatus = status === 'todos' || item.status === status
      const matchMonth = month === 'todos' || item.vencimento?.slice(0, 7) === month
      const matchProject = projectFilter === 'todos' || item.projeto === projectFilter
      return matchQuery && matchStatus && matchMonth && matchProject
    })
  }, [installments.data, query, status, month, projectFilter])

  const { total, paid, open, overdue } = useMemo(() => {
    const now = new Date()
    return installments.data.reduce(
      (acc, item) => {
        acc.total += item.valor
        if (item.status === 'paga') {
          acc.paid += item.valor_recebido || item.valor
        } else if (item.status === 'vencida' || new Date(item.vencimento) < now) {
          acc.overdue += item.valor
        } else {
          acc.open += item.valor
        }
        return acc
      },
      { total: 0, paid: 0, open: 0, overdue: 0 },
    )
  }, [installments.data, ocultarValores])

  async function registerPayment() {
    if (!payment) return
    try {
      const valorRec = Number(payValue) || payment.valor
      await updateOne('parcelas', payment.id, {
        status: 'paga',
        data_pagamento: `${payDate} 12:00:00.000Z`,
        valor_recebido: valorRec,
        status_pagamento: payment.nf_numero ? 'Recebido (NFS-e)' : 'Recebido',
      })
      toast.success(
        `Pagamento da parcela registrado com sucesso (recebido em ${formatDate(payDate)})!`,
      )
      setPayment(null)
      void installments.reload()
    } catch {
      toast.error('Não foi possível registrar o pagamento')
    }
  }

  // Quitação rápida individual direta da linha
  async function handleMarcarRecebidaRapido(item: ParcelaRecord) {
    if (!canWrite) return
    // Se tiver data de faturamento/emissão da NFS-e, pode sugerir, caso contrário hoje
    let dataSugerida = new Date().toISOString().slice(0, 10)
    if (item.data_faturamento) {
      dataSugerida = item.data_faturamento.slice(0, 10)
    } else if (item.vencimento) {
      dataSugerida = item.vencimento.slice(0, 10)
    }
    setPayDate(dataSugerida)
    setPayValue(String(item.valor_recebido || item.valor))
    setPayment(item)
  }

  // Ação reversa: reabrir / desmarcar recebimento para correção de erro
  async function handleConfirmarReabertura() {
    if (!reabrirModalParcela || !canWrite) return
    setIsReabrindo(true)
    try {
      const now = new Date()
      const venc = new Date(reabrirModalParcela.vencimento)
      const novoStatus = venc < now ? 'vencida' : 'pendente'

      await updateOne('parcelas', reabrirModalParcela.id, {
        status: novoStatus,
        data_pagamento: null,
        valor_recebido: 0,
        status_pagamento: reabrirModalParcela.nf_numero ? 'Faturado com NFS-e' : 'Pendente',
      })

      toast.success(`Parcela reaberta como "${novoStatus}". Recebimento cancelado para correção.`)
      setReabrirModalParcela(null)
      void installments.reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao reabrir parcela: ' + msg)
    } finally {
      setIsReabrindo(false)
    }
  }

  // Ações de seleção múltipla
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const handleSelectAllVisible = () => {
    const visibleIds = rows.map((r) => r.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  // Ação em massa: marcar selecionadas como recebidas
  async function handleConfirmarQuitarEmMassa(alvoIds: string[]) {
    if (!alvoIds.length || !canWrite) return
    setIsBulkProcessing(true)
    let sucesso = 0
    let falhas = 0

    const parcelasAlvo = installments.data.filter((p) => alvoIds.includes(p.id))

    for (const p of parcelasAlvo) {
      try {
        let valorRec = p.valor_recebido
        if (!valorRec || valorRec <= 0) {
          const rawDados = (p as any).nfse_dados
          if (rawDados) {
            try {
              const parsed = typeof rawDados === 'string' ? JSON.parse(rawDados) : rawDados
              if (parsed && parsed.valorLiquido && Number(parsed.valorLiquido) > 0) {
                valorRec = Number(parsed.valorLiquido)
              }
            } catch {
              /* intentionally ignored */
            }
          }
        }
        if (!valorRec || valorRec <= 0) {
          valorRec = p.valor
        }

        await updateOne('parcelas', p.id, {
          status: 'paga',
          data_pagamento: `${bulkPayDate} 12:00:00.000Z`,
          valor_recebido: valorRec,
          status_pagamento: p.nf_numero ? 'Recebido (NFS-e)' : 'Recebido',
        })
        sucesso++
      } catch (err) {
        falhas++
      }
    }

    setIsBulkProcessing(false)
    setBulkMarkModalOpen(false)
    setSelectedIds([])

    if (falhas === 0) {
      toast.success(
        `${sucesso} ${sucesso === 1 ? 'parcela marcada' : 'parcelas marcadas'} como recebida(s) em ${formatDate(bulkPayDate)}!`,
      )
    } else {
      toast.warning(`${sucesso} parcelas atualizadas com sucesso, ${falhas} falharam.`)
    }
    void installments.reload()
  }

  async function createInstallment(event: FormEvent) {
    event.preventDefault()
    if (!form.projeto || !form.cliente || !form.descricao || !form.vencimento)
      return toast.error('Preencha os campos obrigatórios')
    try {
      await createOne('parcelas', {
        ...form,
        valor: Number(form.valor),
        vencimento: `${form.vencimento} 12:00:00.000Z`,
      })
      toast.success('Parcela criada')
      setNewOpen(false)
      void installments.reload()
    } catch {
      toast.error('Não foi possível criar a parcela')
    }
  }

  async function handleConfirmarVinculoManual() {
    if (!vinculandoNota || !parcelaDestinoId) {
      toast.error('Selecione a parcela de destino')
      return
    }
    setIsVinculando(true)
    try {
      const clienteOpcao =
        modoClienteOrfa === 'novo'
          ? {
              modo: 'novo' as const,
              novoClienteDados: {
                razaoSocial: novoClienteOrfaRazao || vinculandoNota.tomadorRazao,
                cnpjCpf: novoClienteOrfaCnpj || vinculandoNota.tomadorCnpjCpf,
                endereco: novoClienteOrfaEndereco || vinculandoNota.tomadorEndereco,
                municipio: novoClienteOrfaMunicipio || vinculandoNota.tomadorMunicipio,
                uf: novoClienteOrfaUf || vinculandoNota.tomadorUf,
                email: vinculandoNota.tomadorEmail,
                telefone: vinculandoNota.tomadorTelefone,
              },
            }
          : modoClienteOrfa === 'existente'
            ? {
                modo: 'existente' as const,
                clienteId: clienteSelecionadoOrfaId,
              }
            : {
                modo: 'manter_atual' as const,
              }

      await vincularNotaOrfaAParcela(
        vinculandoNota,
        parcelaDestinoId,
        clienteOpcao,
        descricaoVinculoOrfa,
      )
      toast.success(`NFS-e nº ${vinculandoNota.numero} vinculada com sucesso!`)

      // Remove da lista de órfãs
      setNotasOrfas((prev) => {
        const atualizadas = prev.filter((n) => n.idTemp !== vinculandoNota.idTemp)
        try {
          sessionStorage.setItem('aerocad_nfse_orfas', JSON.stringify(atualizadas))
        } catch {
          /* intentionally ignored */
        }
        return atualizadas
      })
      setVinculandoNota(null)
      setDescricaoVinculoOrfa('')
      setParcelaDestinoId('')
      setModoClienteOrfa('manter_atual')
      setClienteSelecionadoOrfaId('')
      void installments.reload()
      void clients.reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao vincular nota: ' + msg)
    } finally {
      setIsVinculando(false)
    }
  }

  if (installments.loading && !installments.data.length) return <PageLoading />
  if (installments.error) return <ErrorState onRetry={installments.reload} />

  const kpis = [
    {
      label: 'TOTAL PREVISTO',
      value: total,
      icon: CircleDollarSign,
      color: 'text-neutral-700 bg-neutral-100',
    },
    {
      label: 'RECEBIDO',
      value: paid,
      icon: CheckCircle2,
      color: 'text-emerald-700 bg-emerald-100',
    },
    { label: 'A RECEBER', value: open, icon: CalendarClock, color: 'text-sky-700 bg-sky-100' },
    { label: 'EM ATRASO', value: overdue, icon: TriangleAlert, color: 'text-rose-700 bg-rose-100' },
  ]

  return (
    <div>
      <SectionHeader
        eyebrow="GESTÃO FINANCEIRA"
        title="Financeiro"
        description="Parcelas, gatilhos e recebimentos da operação."
        actions={
          <div className="flex items-center gap-2">
            {canWrite && (
              <Button
                variant="outline"
                onClick={() => setImportNfseOpen(true)}
                className="border-[#FFD2B3] text-[#D65100] hover:bg-[#FFF6EC]"
                title="Importar NFS-e em lotes .ZIP, múltiplos XMLs ou planilhas"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4 text-[#FF6A13]" />
                Importar NFS-e (Lotes / ZIP)
              </Button>
            )}
            <Button
              disabled={!canWrite}
              onClick={() => setNewOpen(true)}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova parcela
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="crm-card p-5">
            <div className="flex items-start justify-between">
              <p className="technical-label">{label}</p>
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mono-value mt-4 text-2xl font-bold">{formatCurrency(value)}</p>
            <div className="mt-4 h-1 rounded bg-[#F2F2F2]">
              <div
                className="h-full rounded bg-current"
                style={{ width: `${total ? Math.min(100, (value / total) * 100) : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-[#FFD2B3] bg-[#FFF6EC] p-4 text-sm text-[#6A4A34] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <strong>Gatilhos automáticos & NFS-e:</strong> entradas são criadas ao iniciar a trilha e
          saldos em protocolo/entrega/conclusão. Notas fiscais importadas via lotes compactados{' '}
          <strong>.ZIP</strong>, XMLs avulsos ou planilhas correlacionam automaticamente com as
          parcelas e registram faturamento/baixa.
        </div>
        {canWrite && (
          <Button
            size="sm"
            onClick={() => setImportNfseOpen(true)}
            className="bg-[#FF6A13] hover:bg-[#E85B06] text-white shrink-0"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Importar NFS-e (Lote / ZIP)
          </Button>
        )}
      </div>

      {/* Navegação entre Parcelas e Notas Órfãs */}
      <div className="mt-5 flex items-center gap-2 border-b">
        <button
          onClick={() => setActiveTab('parcelas')}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'parcelas'
              ? 'border-[#FF6A13] text-[#FF6A13]'
              : 'border-transparent text-[#737373] hover:text-[#333]'
          }`}
        >
          Parcelas Cadastradas ({installments.data.length})
        </button>
        {canWrite && (
          <button
            onClick={() => setActiveTab('orfas')}
            className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'orfas'
                ? 'border-[#FF6A13] text-[#FF6A13]'
                : 'border-transparent text-[#737373] hover:text-[#333]'
            }`}
          >
            <Layers className="h-4 w-4" />
            Notas Órfãs
            {notasOrfas.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5">
                {notasOrfas.length}
              </span>
            )}
          </button>
        )}
      </div>

      {activeTab === 'orfas' ? (
        <div className="mt-5 space-y-4">
          <div className="crm-card p-4 bg-sky-50/50 border-sky-200 text-xs text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Layers className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-sm">Central de Notas Órfãs:</strong> Notas fiscais
                importadas que não encontraram correspondência automática podem ser vinculadas
                manualmente a qualquer parcela da operação. Ao vincular, o status da parcela é
                atualizado e registrado no histórico do projeto.
              </div>
            </div>
            {canWrite && notasOrfas.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {selectedOrfasIds.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const alvos: NotaExclusaoAlvo[] = notasOrfas
                        .filter((o) => selectedOrfasIds.includes(o.idTemp))
                        .map((o) => ({
                          tipo: 'orfa',
                          id: o.idTemp,
                          numero: o.numero,
                          valor: o.valorLiquido || o.valorBruto,
                          dataEmissao: o.dataEmissao,
                          descricao: o.descricaoServico,
                          clienteNome: o.tomadorRazao,
                        }))
                      setNotasParaExcluir(alvos)
                      setExcluirNotaOpen(true)
                    }}
                    className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                    title="Excluir notas órfãs selecionadas com auditoria"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Excluir selecionadas ({selectedOrfasIds.length})
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => setExtrairProjetosModalOpen(true)}
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white shadow-sm"
                  title="Analisar notas órfãs e extrair/sugerir projetos com numeração AAAA-NNN"
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Extrair projetos das notas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDuplicadasModalOpen(true)}
                  className={`border-orange-300 text-[#D65100] hover:bg-[#FFF6EC] ${
                    totalDuplicatasOrfas > 0 ? 'bg-orange-50 font-semibold' : ''
                  }`}
                  title="Detectar e excluir notas duplicadas (mesmo número e prestador)"
                >
                  <CopyX className="mr-1.5 h-4 w-4 text-[#FF6A13]" />
                  Excluir duplicadas
                  {totalDuplicatasOrfas > 0 && (
                    <span className="ml-1.5 rounded-full bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0.2 font-bold">
                      {totalDuplicatasOrfas}
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>

          {!notasOrfas.length ? (
            <EmptyState
              title="Nenhuma nota órfã pendente"
              description="Todas as notas fiscais importadas foram correlacionadas com sucesso ou nenhuma importação com órfãs foi realizada nesta sessão."
            />
          ) : (
            <div className="crm-card divide-y overflow-hidden">
              {/* Barra de seleção de órfãs */}
              {canWrite && notasOrfas.length > 0 && (
                <div className="p-3 bg-neutral-50 flex items-center justify-between text-xs border-b">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedOrfasIds.length === notasOrfas.length) {
                        setSelectedOrfasIds([])
                      } else {
                        setSelectedOrfasIds(notasOrfas.map((o) => o.idTemp))
                      }
                    }}
                    className="flex items-center gap-1.5 font-semibold text-neutral-700 hover:text-neutral-900"
                  >
                    {selectedOrfasIds.length === notasOrfas.length ? (
                      <CheckSquare className="h-4 w-4 text-[#FF6A13]" />
                    ) : (
                      <Square className="h-4 w-4 text-neutral-400" />
                    )}
                    <span>
                      {selectedOrfasIds.length > 0
                        ? `${selectedOrfasIds.length} selecionada(s)`
                        : 'Selecionar todas as notas órfãs'}
                    </span>
                  </button>
                  {selectedOrfasIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedOrfasIds([])}
                      className="text-[11px] text-neutral-500 hover:underline"
                    >
                      (Limpar seleção)
                    </button>
                  )}
                </div>
              )}

              {notasOrfas.map((nota) => {
                const isOrfaSelected = selectedOrfasIds.includes(nota.idTemp)
                return (
                  <div
                    key={nota.idTemp}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      isOrfaSelected ? 'bg-orange-50/50' : 'hover:bg-[#FFF6EC]/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrfasIds((prev) =>
                              prev.includes(nota.idTemp)
                                ? prev.filter((id) => id !== nota.idTemp)
                                : [...prev, nota.idTemp],
                            )
                          }}
                          className="mt-1 text-neutral-500"
                        >
                          {isOrfaSelected ? (
                            <CheckSquare className="h-4 w-4 text-[#FF6A13]" />
                          ) : (
                            <Square className="h-4 w-4 text-neutral-300" />
                          )}
                        </button>
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="mono-value font-bold text-sm text-[#FF6A13]">
                            NFS-e nº {nota.numero}
                          </span>
                          <CrmBadge tone="gray">{nota.situacao.toUpperCase()}</CrmBadge>
                          <span className="text-xs text-[#737373]">
                            Emissão: {formatDate(nota.dataEmissao)}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-[#333]">
                          Tomador: {nota.tomadorRazao}{' '}
                          {nota.tomadorCnpjCpf && `(${nota.tomadorCnpjCpf})`}
                        </p>
                        {nota.descricaoServico && (
                          <p className="text-xs text-[#777] line-clamp-1 italic">
                            {nota.descricaoServico}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="mono-value font-bold text-base text-[#1F1F1F]">
                          {formatCurrency(nota.valorBruto)}
                        </p>
                        {nota.retencoesTexto && (
                          <p className="text-[10px] text-amber-700">{nota.retencoesTexto}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setVinculandoNota(nota)
                          setDescricaoVinculoOrfa('')
                          setParcelaDestinoId('')
                          // Verifica se o tomador já existe na base de clientes
                          const limpo = nota.tomadorCnpjCpf
                            ? nota.tomadorCnpjCpf.replace(/\D/g, '')
                            : ''
                          const cliExistente = clients.data.find(
                            (c) =>
                              (limpo && c.cnpj_cpf && c.cnpj_cpf.replace(/\D/g, '') === limpo) ||
                              c.razao_social.toLowerCase() === nota.tomadorRazao.toLowerCase(),
                          )
                          if (cliExistente) {
                            setModoClienteOrfa('existente')
                            setClienteSelecionadoOrfaId(cliExistente.id)
                          } else if (
                            nota.tomadorRazao &&
                            nota.tomadorRazao !== 'Tomador não informado'
                          ) {
                            setModoClienteOrfa('novo')
                            setNovoClienteOrfaRazao(nota.tomadorRazao)
                            setNovoClienteOrfaCnpj(nota.tomadorCnpjCpf || '')
                            setNovoClienteOrfaEndereco(nota.tomadorEndereco || '')
                            setNovoClienteOrfaMunicipio(nota.tomadorMunicipio || '')
                            setNovoClienteOrfaUf(nota.tomadorUf || '')
                          } else {
                            setModoClienteOrfa('manter_atual')
                          }
                        }}
                        className="bg-[#FF6A13] hover:bg-[#E85B06] text-white shrink-0"
                      >
                        <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                        Vincular a Parcela
                      </Button>
                      {canWrite && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNotasParaExcluir([
                              {
                                tipo: 'orfa',
                                id: nota.idTemp,
                                numero: nota.numero,
                                valor: nota.valorLiquido || nota.valorBruto,
                                dataEmissao: nota.dataEmissao,
                                descricao: nota.descricaoServico,
                                clienteNome: nota.tomadorRazao,
                              },
                            ])
                            setExcluirNotaOpen(true)
                          }}
                          className="h-8 w-8 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                          title={`Excluir NFS-e nº ${nota.numero} da lista de órfãs`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-3 rounded-xl border bg-white p-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[#9A9A9A]" />
              <Input
                className="pl-9"
                placeholder="Buscar projeto, cliente, descrição ou número da NFS-e"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="lg:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {months.map((item) => (
                  <SelectItem key={item} value={item}>
                    {new Date(`${item}-02`).toLocaleDateString('pt-BR', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="lg:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os projetos</SelectItem>
                {projects.data.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.numero} · {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="lg:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Barra de Ações em Massa (visível para Admin e Financeiro) */}
          {canWrite && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50/60 p-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className="flex items-center gap-1.5 font-semibold text-neutral-700 hover:text-neutral-900"
                >
                  {rows.length > 0 && rows.every((r) => selectedIds.includes(r.id)) ? (
                    <CheckSquare className="h-4 w-4 text-[#FF6A13]" />
                  ) : (
                    <Square className="h-4 w-4 text-neutral-400" />
                  )}
                  <span>
                    {selectedIds.length > 0
                      ? `${selectedIds.length} selecionada(s)`
                      : 'Selecionar visíveis'}
                  </span>
                </button>
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="text-[11px] text-neutral-500 hover:underline"
                  >
                    (Limpar seleção)
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.length > 0 && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setBulkPayDate(new Date().toISOString().slice(0, 10))
                        setBulkMarkModalOpen(true)
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Marcar selecionadas como recebidas ({selectedIds.length})
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const selecionadas = installments.data.filter((p) =>
                          selectedIds.includes(p.id),
                        )
                        const alvos: NotaExclusaoAlvo[] = selecionadas.map((p) => ({
                          tipo: 'parcela',
                          id: p.id,
                          numero: p.nf_numero || p.id,
                          valor: p.valor_recebido || p.valor,
                          dataEmissao: p.data_faturamento || p.vencimento,
                          descricao: p.descricao,
                          projetoId: p.projeto,
                          projetoNumero: p.expand?.projeto?.numero,
                          clienteId: p.cliente,
                          clienteNome: p.expand?.cliente?.razao_social,
                          statusParcela: p.status,
                          isGatilho: p.origem === 'gatilho',
                        }))
                        setNotasParaExcluir(alvos)
                        setExcluirNotaOpen(true)
                      }}
                      className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                      title="Excluir notas/parcelas selecionadas com auditoria"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Excluir selecionadas ({selectedIds.length})
                    </Button>
                  </>
                )}

                {/* Botão de conveniência para marcar pendentes da visualização */}
                {rows.some((r) => r.status !== 'paga') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const pendentesVisiveis = rows
                        .filter((r) => r.status !== 'paga')
                        .map((r) => r.id)
                      setSelectedIds(pendentesVisiveis)
                      setBulkPayDate(new Date().toISOString().slice(0, 10))
                      setBulkMarkModalOpen(true)
                    }}
                    className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 bg-white"
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Marcar todas pendentes visíveis como recebidas (
                    {rows.filter((r) => r.status !== 'paga').length})
                  </Button>
                )}
              </div>
            </div>
          )}

          {!rows.length ? (
            <div className="mt-5">
              <EmptyState
                title="Nenhuma parcela registrada"
                description="Cadastre uma parcela manual ou avance uma fase com gatilho automático."
              />
            </div>
          ) : (
            <div className="crm-card mt-5 overflow-hidden">
              <div className="hidden lg:block">
                <table className="w-full">
                  <thead className="border-b bg-[#FAFAFA] text-left text-[11px] uppercase tracking-wider text-[#737373]">
                    <tr>
                      {canWrite && (
                        <th className="w-10 px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={handleSelectAllVisible}
                            title="Selecionar todas"
                            className="text-neutral-500 hover:text-neutral-900"
                          >
                            {rows.length > 0 && rows.every((r) => selectedIds.includes(r.id)) ? (
                              <CheckSquare className="h-4 w-4 text-[#FF6A13]" />
                            ) : (
                              <Square className="h-4 w-4 text-neutral-400" />
                            )}
                          </button>
                        </th>
                      )}
                      <th className="px-5 py-3">Projeto / Cliente</th>
                      <th className="px-5 py-3">Descrição</th>
                      <th className="px-5 py-3">NFS-e / Faturamento</th>
                      <th className="px-5 py-3">Valor</th>
                      <th className="px-5 py-3">Vencimento / Recebimento</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((item) => {
                      const isSelected = selectedIds.includes(item.id)
                      return (
                        <tr key={item.id} className={isSelected ? 'bg-orange-50/40' : undefined}>
                          {canWrite && (
                            <td className="px-3 py-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleSelect(item.id)}
                                className="text-neutral-500 hover:text-neutral-900"
                              >
                                {isSelected ? (
                                  <CheckSquare className="h-4 w-4 text-[#FF6A13]" />
                                ) : (
                                  <Square className="h-4 w-4 text-neutral-300" />
                                )}
                              </button>
                            </td>
                          )}
                          <td className="px-5 py-4">
                            <Link
                              to={`/projetos/${item.projeto}`}
                              className="mono-value font-bold text-[#D65100] hover:underline"
                            >
                              {item.expand?.projeto?.numero || 'Sem projeto'}
                            </Link>
                            <p className="text-xs text-[#737373]">
                              {item.expand?.cliente?.razao_social}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold">
                            {item.descricao}
                            {item.origem === 'gatilho' && (
                              <CrmBadge tone="orange" className="ml-2">
                                automático
                              </CrmBadge>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs">
                            {item.nf_numero ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 font-mono font-bold text-[#FF6A13] bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                                  NFS-e nº {item.nf_numero}
                                </span>
                                {item.data_faturamento && (
                                  <p className="text-[11px] text-[#737373]">
                                    Fat: {formatDate(item.data_faturamento)}
                                  </p>
                                )}
                                {item.retencoes && (
                                  <p
                                    className="text-[10px] text-amber-700 line-clamp-1"
                                    title={item.retencoes}
                                  >
                                    Ret: {item.retencoes}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#999] italic">Não faturada</span>
                            )}
                          </td>
                          <td className="mono-value px-5 py-4 font-bold">
                            {formatCurrency(item.valor)}
                          </td>
                          <td className="mono-value px-5 py-4 text-xs">
                            <p>Venc: {formatDate(item.vencimento)}</p>
                            {item.data_pagamento && (
                              <p className="text-emerald-700 font-semibold mt-0.5">
                                Rec: {formatDate(item.data_pagamento)}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <CrmBadge
                              tone={
                                item.status === 'paga'
                                  ? 'green'
                                  : item.status === 'vencida'
                                    ? 'red'
                                    : 'amber'
                              }
                            >
                              {item.status}
                            </CrmBadge>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {canWrite && (
                              <div className="flex items-center justify-end gap-1.5">
                                {item.status !== 'paga' ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarcarRecebidaRapido(item)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-semibold shadow-sm"
                                    title="Marcar nota/parcela como recebida/paga"
                                  >
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                    Marcar como recebida
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setReabrirModalParcela(item)}
                                    className="border-neutral-300 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 h-8 text-xs"
                                    title="Desmarcar recebimento e reabrir parcela em caso de erro"
                                  >
                                    <RotateCcw className="mr-1 h-3 w-3 text-neutral-500" />
                                    Reabrir / Desmarcar
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setNotasParaExcluir([
                                      {
                                        tipo: 'parcela',
                                        id: item.id,
                                        numero: item.nf_numero || item.descricao,
                                        valor: item.valor_recebido || item.valor,
                                        dataEmissao: item.data_faturamento || item.vencimento,
                                        descricao: item.descricao,
                                        projetoId: item.projeto,
                                        projetoNumero: item.expand?.projeto?.numero,
                                        clienteId: item.cliente,
                                        clienteNome: item.expand?.cliente?.razao_social,
                                        statusParcela: item.status,
                                        isGatilho: item.origem === 'gatilho',
                                      },
                                    ])
                                    setExcluirNotaOpen(true)
                                  }}
                                  className="h-8 w-8 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                                  title={`Excluir ${item.nf_numero ? `NFS-e nº ${item.nf_numero}` : 'esta parcela'}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="divide-y lg:hidden">
                {rows.map((item) => (
                  <div key={item.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(item.id)}
                            className="mt-0.5 text-neutral-500"
                          >
                            {selectedIds.includes(item.id) ? (
                              <CheckSquare className="h-4 w-4 text-[#FF6A13]" />
                            ) : (
                              <Square className="h-4 w-4 text-neutral-300" />
                            )}
                          </button>
                        )}
                        <div>
                          <Link
                            to={`/projetos/${item.projeto}`}
                            className="mono-value font-bold text-[#D65100]"
                          >
                            {item.expand?.projeto?.numero}
                          </Link>
                          <p className="mt-0.5 text-sm font-semibold">{item.descricao}</p>
                          {item.nf_numero && (
                            <span className="mt-1 inline-flex items-center gap-1 font-mono text-xs font-bold text-[#FF6A13] bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                              NFS-e nº {item.nf_numero}
                            </span>
                          )}
                        </div>
                      </div>
                      <CrmBadge
                        tone={
                          item.status === 'paga'
                            ? 'green'
                            : item.status === 'vencida'
                              ? 'red'
                              : 'amber'
                        }
                      >
                        {item.status}
                      </CrmBadge>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="mono-value font-bold text-sm">
                        {formatCurrency(item.valor)}
                      </span>
                      <div className="text-right text-[#737373]">
                        <p>Venc: {formatDate(item.vencimento)}</p>
                        {item.data_pagamento && (
                          <p className="text-emerald-700 font-semibold">
                            Rec: {formatDate(item.data_pagamento)}
                          </p>
                        )}
                      </div>
                    </div>
                    {canWrite && (
                      <div className="pt-1">
                        {item.status !== 'paga' ? (
                          <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                            size="sm"
                            onClick={() => handleMarcarRecebidaRapido(item)}
                          >
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                            Marcar como recebida
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            variant="outline"
                            size="sm"
                            onClick={() => setReabrirModalParcela(item)}
                          >
                            <RotateCcw className="mr-1.5 h-3 w-3 text-neutral-500" />
                            Reabrir / Desmarcar recebimento
                          </Button>
                        )}
                        <Button
                          className="w-full text-rose-600 hover:bg-rose-50 border-rose-200"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setNotasParaExcluir([
                              {
                                tipo: 'parcela',
                                id: item.id,
                                numero: item.nf_numero || item.descricao,
                                valor: item.valor_recebido || item.valor,
                                dataEmissao: item.data_faturamento || item.vencimento,
                                descricao: item.descricao,
                                projetoId: item.projeto,
                                projetoNumero: item.expand?.projeto?.numero,
                                clienteId: item.cliente,
                                clienteNome: item.expand?.cliente?.razao_social,
                                statusParcela: item.status,
                                isGatilho: item.origem === 'gatilho',
                              },
                            ])
                            setExcluirNotaOpen(true)
                          }}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Excluir nota / parcela
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={Boolean(payment)} onOpenChange={(v) => !v && setPayment(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Marcar como recebida / Registrar pagamento
            </DialogTitle>
          </DialogHeader>
          {payment && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-neutral-50 p-3 text-xs space-y-1">
                <p className="font-semibold text-neutral-800">{payment.descricao}</p>
                {payment.nf_numero && (
                  <p className="font-mono text-[#FF6A13] font-bold">NFS-e nº {payment.nf_numero}</p>
                )}
                <div className="flex justify-between text-neutral-600 pt-1">
                  <span>Valor total: {formatCurrency(payment.valor)}</span>
                  <span>Vencimento: {formatDate(payment.vencimento)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Data do recebimento / quitação *</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                <p className="text-[11px] text-neutral-500">
                  Preenchimento padrão com a data informada ou data atual.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Valor efetivamente recebido (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payValue}
                  onChange={(e) => setPayValue(e.target.value)}
                />
                <p className="text-[11px] text-neutral-500">
                  Ao confirmar, a parcela é marcada como <strong>quitada/paga</strong> e sai dos
                  alertas de vencimento do Painel.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayment(null)}>
              Cancelar
            </Button>
            <Button
              onClick={registerPayment}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Confirmar recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Quitação em Massa */}
      <Dialog open={bulkMarkModalOpen} onOpenChange={setBulkMarkModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Marcar parcelas em massa como recebidas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-950 space-y-1">
              <p className="font-bold text-sm">
                {selectedIds.length} parcela(s) selecionada(s) para quitação imediata.
              </p>
              <p className="text-neutral-600">
                Todas as notas e faturamentos selecionados serão marcados como{' '}
                <strong>pagos/quitados</strong>, preenchendo a data de recebimento e zerando
                pendências da Central de Alertas.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Data de recebimento aplicada a todas *
              </Label>
              <Input
                type="date"
                value={bulkPayDate}
                onChange={(e) => setBulkPayDate(e.target.value)}
              />
              <p className="text-[11px] text-neutral-500">
                Padrão: data de hoje ({formatDate(new Date())}).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isBulkProcessing}
              onClick={() => setBulkMarkModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleConfirmarQuitarEmMassa(selectedIds)}
              disabled={isBulkProcessing || !selectedIds.length}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isBulkProcessing
                ? 'Processando quitação...'
                : `Confirmar quitação (${selectedIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Reabertura / Correção de Erro */}
      <Dialog
        open={Boolean(reabrirModalParcela)}
        onOpenChange={(v) => !v && setReabrirModalParcela(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <RotateCcw className="h-5 w-5" />
              Reabrir parcela / Desmarcar recebimento
            </DialogTitle>
          </DialogHeader>
          {reabrirModalParcela && (
            <div className="space-y-3 text-xs">
              <p className="text-neutral-700">
                Deseja realmente desmarcar o recebimento desta parcela para correção?
              </p>
              <div className="rounded-lg border bg-neutral-50 p-3 space-y-1">
                <p className="font-bold text-neutral-800">{reabrirModalParcela.descricao}</p>
                {reabrirModalParcela.nf_numero && (
                  <p className="font-mono text-[#FF6A13] font-semibold">
                    NFS-e nº {reabrirModalParcela.nf_numero}
                  </p>
                )}
                <p className="text-neutral-500">
                  Valor: {formatCurrency(reabrirModalParcela.valor)} · Recebido anteriormente em:{' '}
                  {reabrirModalParcela.data_pagamento
                    ? formatDate(reabrirModalParcela.data_pagamento)
                    : 'N/A'}
                </p>
              </div>
              <p className="text-neutral-500 italic">
                O status retornará para pendente (ou vencida, conforme o vencimento original) e a
                data de pagamento será limpa.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isReabrindo}
              onClick={() => setReabrirModalParcela(null)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleConfirmarReabertura()}
              disabled={isReabrindo}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isReabrindo ? 'Reabrindo...' : 'Confirmar e Reabrir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova parcela manual</DialogTitle>
          </DialogHeader>
          <form onSubmit={createInstallment} className="space-y-4">
            <div className="space-y-2">
              <Label>Projeto *</Label>
              <Select
                value={form.projeto}
                onValueChange={(projeto) => {
                  const p = projects.data.find((i) => i.id === projeto)
                  setForm((v) => ({ ...v, projeto, cliente: p?.cliente || '' }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {projects.data.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.numero} · {item.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor}
                  onChange={(e) => setForm((v) => ({ ...v, valor: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={form.vencimento}
                  onChange={(e) => setForm((v) => ({ ...v, vencimento: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm((v) => ({ ...v, observacoes: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                Cancelar
              </Button>
              <Button className="bg-[#FF6A13] hover:bg-[#E85B06]">Criar parcela</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Vinculação Manual de Nota Órfã */}
      <Dialog open={Boolean(vinculandoNota)} onOpenChange={(v) => !v && setVinculandoNota(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Vincular Nota Órfã & Dados do Cliente</DialogTitle>
          </DialogHeader>
          {vinculandoNota && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-[#FAFAFA] p-3 text-xs space-y-1">
                <p className="flex justify-between">
                  <span>
                    <strong>NFS-e:</strong> {vinculandoNota.numero}
                  </span>
                  <span className="mono-value font-bold text-[#FF6A13]">
                    {formatCurrency(vinculandoNota.valorBruto)}
                  </span>
                </p>
                <p>
                  <strong>Tomador:</strong> {vinculandoNota.tomadorRazao}{' '}
                  {vinculandoNota.tomadorCnpjCpf && `(${vinculandoNota.tomadorCnpjCpf})`}
                </p>
                {(vinculandoNota.tomadorEndereco || vinculandoNota.tomadorMunicipio) && (
                  <p className="text-neutral-500">
                    <strong>Endereço:</strong>{' '}
                    {[
                      vinculandoNota.tomadorEndereco,
                      vinculandoNota.tomadorMunicipio,
                      vinculandoNota.tomadorUf,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                <p>
                  <strong>Data de Emissão:</strong> {formatDate(vinculandoNota.dataEmissao)}
                </p>
              </div>

              {/* Seção da Parcela */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">1. Selecione a parcela de destino *</Label>
                <Select
                  value={parcelaDestinoId}
                  onValueChange={(val) => {
                    setParcelaDestinoId(val)
                    if (!descricaoVinculoOrfa) {
                      const p = installments.data.find((i) => i.id === val)
                      if (p?.descricao) setDescricaoVinculoOrfa(p.descricao)
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione a parcela..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {installments.data.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.expand?.projeto?.numero || 'Sem proj'} · {item.descricao} —{' '}
                        {formatCurrency(item.valor)} ({item.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Descrição personalizada da medição / vínculo */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Descrição da medição / nota (opcional)</Label>
                <Input
                  placeholder="Ex: 1ª medição, Medição final, Entrada 50%"
                  value={descricaoVinculoOrfa}
                  onChange={(e) => setDescricaoVinculoOrfa(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Seção de Cliente: Manter atual, Vincular existente ou Criar a partir da nota */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-bold">2. Cliente a partir dos dados da nota</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModoClienteOrfa('manter_atual')}
                    className={`p-2 text-xs font-semibold rounded-lg border text-center transition ${
                      modoClienteOrfa === 'manter_atual'
                        ? 'border-[#FF6A13] bg-[#FFF2E8] text-[#D65100]'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    Manter cliente da parcela
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoClienteOrfa('existente')}
                    className={`p-2 text-xs font-semibold rounded-lg border text-center transition ${
                      modoClienteOrfa === 'existente'
                        ? 'border-[#FF6A13] bg-[#FFF2E8] text-[#D65100]'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    Vincular existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoClienteOrfa('novo')}
                    className={`p-2 text-xs font-semibold rounded-lg border text-center transition ${
                      modoClienteOrfa === 'novo'
                        ? 'border-[#FF6A13] bg-[#FFF2E8] text-[#D65100]'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    Criar novo cliente
                  </button>
                </div>

                {modoClienteOrfa === 'existente' && (
                  <div className="pt-1.5 space-y-1">
                    <Label className="text-[11px] text-neutral-600">
                      Selecione o cliente cadastrado:
                    </Label>
                    <Select
                      value={clienteSelecionadoOrfaId}
                      onValueChange={setClienteSelecionadoOrfaId}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione o cliente..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {clients.data.map((cli) => (
                          <SelectItem key={cli.id} value={cli.id}>
                            {cli.razao_social} {cli.cnpj_cpf ? `(${cli.cnpj_cpf})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {modoClienteOrfa === 'novo' && (
                  <div className="pt-2 p-2.5 rounded-lg border bg-neutral-50/60 space-y-2 text-xs">
                    <p className="text-[11px] text-[#737373]">
                      Os dados extraídos da NFS-e serão usados para cadastrar o novo cliente:
                    </p>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-neutral-500">
                        Razão Social
                      </Label>
                      <Input
                        value={novoClienteOrfaRazao}
                        onChange={(e) => setNovoClienteOrfaRazao(e.target.value)}
                        className="h-7 text-xs bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-neutral-500">
                          CNPJ / CPF
                        </Label>
                        <Input
                          value={novoClienteOrfaCnpj}
                          onChange={(e) => setNovoClienteOrfaCnpj(e.target.value)}
                          className="h-7 text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-neutral-500">
                          Município/UF
                        </Label>
                        <Input
                          value={
                            novoClienteOrfaMunicipio && novoClienteOrfaUf
                              ? `${novoClienteOrfaMunicipio}/${novoClienteOrfaUf}`
                              : novoClienteOrfaMunicipio || novoClienteOrfaUf
                          }
                          onChange={(e) => {
                            const val = e.target.value
                            if (val.includes('/')) {
                              const [m, u] = val.split('/')
                              setNovoClienteOrfaMunicipio(m.trim())
                              setNovoClienteOrfaUf(u.trim().toUpperCase())
                            } else {
                              setNovoClienteOrfaMunicipio(val)
                            }
                          }}
                          placeholder="Ex: Brasília/DF"
                          className="h-7 text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isVinculando}
              onClick={() => setVinculandoNota(null)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleConfirmarVinculoManual()}
              disabled={
                isVinculando ||
                !parcelaDestinoId ||
                (modoClienteOrfa === 'existente' && !clienteSelecionadoOrfaId) ||
                (modoClienteOrfa === 'novo' && !novoClienteOrfaRazao.trim())
              }
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              {isVinculando ? 'Vinculando...' : 'Confirmar Vínculo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão de NFS-e / Parcelas com Auditoria */}
      <ConfirmarExcluirNotaModal
        open={excluirNotaOpen}
        onOpenChange={setExcluirNotaOpen}
        notas={notasParaExcluir}
        onSuccess={() => {
          setSelectedIds([])
          setSelectedOrfasIds([])
          // Se for exclusão de órfã, sincroniza estado local
          const orfasExcluidas = notasParaExcluir.filter((n) => n.tipo === 'orfa').map((n) => n.id)
          if (orfasExcluidas.length > 0) {
            setNotasOrfas((prev) => prev.filter((o) => !orfasExcluidas.includes(o.idTemp)))
          }
          void installments.reload()
          void projects.reload()
        }}
      />

      {/* Modal de Deduplicação de Notas Órfãs */}
      <ExcluirDuplicadasModal
        open={duplicadasModalOpen}
        onOpenChange={setDuplicadasModalOpen}
        notasOrfas={notasOrfas}
        onExcluirDuplicadas={handleExcluirDuplicadas}
      />

      {/* Modal de Extração de Projetos a partir das Notas Órfãs */}
      <ExtrairProjetosModal
        open={extrairProjetosModalOpen}
        onOpenChange={setExtrairProjetosModalOpen}
        notasOrfas={notasOrfas}
        clientesExistentes={clients.data}
        projetosExistentes={projects.data}
        onConcluido={(resultado) => {
          // Remove as notas processadas da lista de órfãs
          if (resultado.idsNotasProcessadas.length > 0) {
            const processadasSet = new Set(resultado.idsNotasProcessadas)
            setNotasOrfas((prev) => {
              const restantes = prev.filter((n) => !processadasSet.has(n.idTemp))
              try {
                sessionStorage.setItem('aerocad_nfse_orfas', JSON.stringify(restantes))
              } catch {
                /* intentionally ignored */
              }
              return restantes
            })
          }
          void projects.reload()
          void clients.reload()
          void installments.reload()
        }}
      />

      {/* Modal de Importação de NFS-e */}
      <ImportacaoNfseModal
        open={importNfseOpen}
        onOpenChange={setImportNfseOpen}
        onImportComplete={(res) => {
          void installments.reload()
          if (res.orfas.length > 0) {
            setNotasOrfas((prev) => {
              const combinadas = [...prev, ...res.orfas.map((o) => o.nota)]
              try {
                sessionStorage.setItem('aerocad_nfse_orfas', JSON.stringify(combinadas))
              } catch {
                /* intentionally ignored */
              }
              return combinadas
            })
            setActiveTab('orfas')
          }
        }}
      />
    </div>
  )
}
