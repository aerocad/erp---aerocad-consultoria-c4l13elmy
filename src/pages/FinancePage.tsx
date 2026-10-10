import { useMemo, useState, type FormEvent } from 'react'
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FileSpreadsheet,
  Layers,
  Link as LinkIcon,
  Plus,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { SectionHeader } from '@/components/common/SectionHeader'
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States'
import { ImportacaoNfseModal } from '@/components/financeiro/ImportacaoNfseModal'
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
import { useCrmData } from '@/hooks/use-crm-data'
import { formatCurrency, formatDate } from '@/lib/format'
import { createOne, updateOne } from '@/services/api'
import { vincularNotaOrfaAParcela } from '@/services/nfseExecutor'
import type { NfseDadoExtraido } from '@/services/nfseParser'
import type { ClienteRecord, ParcelaRecord, ProjetoRecord } from '@/types/crm'

export default FinancePage

export function FinancePage() {
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
  const [payment, setPayment] = useState<ParcelaRecord | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payValue, setPayValue] = useState('')

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
  }, [installments.data])

  async function registerPayment() {
    if (!payment) return
    try {
      await updateOne('parcelas', payment.id, {
        status: 'paga',
        data_pagamento: `${payDate} 12:00:00.000Z`,
        valor_recebido: Number(payValue) || payment.valor,
      })
      toast.success('Pagamento registrado')
      setPayment(null)
      void installments.reload()
    } catch {
      toast.error('Não foi possível registrar o pagamento')
    }
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

      await vincularNotaOrfaAParcela(vinculandoNota, parcelaDestinoId, clienteOpcao)
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
          <div className="crm-card p-4 bg-sky-50/50 border-sky-200 text-xs text-sky-950 flex items-start gap-2.5">
            <Layers className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-sm">Central de Notas Órfãs:</strong> Notas fiscais importadas
              que não encontraram correspondência automática podem ser vinculadas manualmente a
              qualquer parcela da operação. Ao vincular, o status da parcela é atualizado e
              registrado no histórico do projeto.
            </div>
          </div>

          {!notasOrfas.length ? (
            <EmptyState
              title="Nenhuma nota órfã pendente"
              description="Todas as notas fiscais importadas foram correlacionadas com sucesso ou nenhuma importação com órfãs foi realizada nesta sessão."
            />
          ) : (
            <div className="crm-card divide-y overflow-hidden">
              {notasOrfas.map((nota) => (
                <div
                  key={nota.idTemp}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FFF6EC]/30"
                >
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

                  <div className="flex items-center gap-4">
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
                  </div>
                </div>
              ))}
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
                      <th className="px-5 py-3">Projeto / Cliente</th>
                      <th className="px-5 py-3">Descrição</th>
                      <th className="px-5 py-3">NFS-e / Faturamento</th>
                      <th className="px-5 py-3">Valor</th>
                      <th className="px-5 py-3">Vencimento / Recebimento</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((item) => (
                      <tr key={item.id}>
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
                        <td className="px-5 py-4">
                          {item.status !== 'paga' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canWrite}
                              onClick={() => {
                                setPayment(item)
                                setPayValue(String(item.valor))
                              }}
                            >
                              Registrar pagamento
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y lg:hidden">
                {rows.map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <Link
                          to={`/projetos/${item.projeto}`}
                          className="mono-value font-bold text-[#D65100]"
                        >
                          {item.expand?.projeto?.numero}
                        </Link>
                        <p className="mt-1 text-sm font-semibold">{item.descricao}</p>
                        {item.nf_numero && (
                          <span className="mt-1 inline-flex items-center gap-1 font-mono text-xs font-bold text-[#FF6A13] bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                            NFS-e nº {item.nf_numero}
                          </span>
                        )}
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
                    <div className="mt-3 flex justify-between">
                      <span className="mono-value font-bold">{formatCurrency(item.valor)}</span>
                      <span className="mono-value text-xs">{formatDate(item.vencimento)}</span>
                    </div>
                    {item.status !== 'paga' && (
                      <Button
                        className="mt-3 w-full"
                        variant="outline"
                        disabled={!canWrite}
                        onClick={() => {
                          setPayment(item)
                          setPayValue(String(item.valor))
                        }}
                      >
                        Registrar pagamento
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={Boolean(payment)} onOpenChange={(v) => !v && setPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data do pagamento</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valor recebido</Label>
              <Input
                type="number"
                step="0.01"
                value={payValue}
                onChange={(e) => setPayValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayment(null)}>
              Cancelar
            </Button>
            <Button onClick={registerPayment} className="bg-[#FF6A13] hover:bg-[#E85B06]">
              Confirmar recebimento
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
                <Select value={parcelaDestinoId} onValueChange={setParcelaDestinoId}>
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
