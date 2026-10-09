import { useMemo, useState, type FormEvent } from 'react'
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Plus,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States'
import { SectionHeader } from '@/components/common/SectionHeader'
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
import type { ClienteRecord, ParcelaRecord, ProjetoRecord } from '@/types/crm'

export default function FinancePage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const installments = useCrmData<ParcelaRecord>('parcelas', {
    expand: 'projeto,cliente',
    sort: 'vencimento',
    realtime: true,
  })
  const projects = useCrmData<ProjetoRecord>('projetos', { expand: 'cliente', sort: '-numero' })
  const clients = useCrmData<ClienteRecord>('clientes', { sort: 'razao_social' })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('todos')
  const [month, setMonth] = useState('todos')
  const [projectFilter, setProjectFilter] = useState(params.get('projeto') || 'todos')
  const [payment, setPayment] = useState<ParcelaRecord | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payValue, setPayValue] = useState('')
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
  const rows = useMemo(
    () =>
      installments.data.filter(
        (item) =>
          (status === 'todos' || item.status === status) &&
          (projectFilter === 'todos' || item.projeto === projectFilter) &&
          (month === 'todos' || item.vencimento.slice(0, 7) === month) &&
          (!query ||
            `${item.descricao} ${item.expand?.projeto?.numero} ${item.expand?.cliente?.razao_social}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [installments.data, status, projectFilter, month, query],
  )
  const total = installments.data.reduce((s, i) => s + i.valor, 0)
  const received = installments.data
    .filter((i) => i.status === 'paga')
    .reduce((s, i) => s + (i.valor_recebido || i.valor), 0)
  const overdue = installments.data
    .filter((i) => i.status === 'vencida')
    .reduce((s, i) => s + i.valor, 0)
  const open = total - received
  const months = Array.from(
    new Set(installments.data.map((i) => i.vencimento.slice(0, 7)).filter(Boolean)),
  )
    .sort()
    .reverse()
  async function registerPayment() {
    if (!payment) return
    try {
      await updateOne('parcelas', payment.id, {
        status: 'paga',
        data_pagamento: `${payDate} 12:00:00.000Z`,
        valor_recebido: Number(payValue || payment.valor),
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
  if (installments.loading || projects.loading || clients.loading) return <PageLoading />
  if (installments.error) return <ErrorState onRetry={() => void installments.reload()} />
  const kpis = [
    {
      label: 'Total contratado',
      value: total,
      icon: CircleDollarSign,
      color: 'text-[#FF6A13] bg-orange-50',
    },
    {
      label: 'Recebido',
      value: received,
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50',
    },
    { label: 'Em aberto', value: open, icon: CalendarClock, color: 'text-sky-600 bg-sky-50' },
    { label: 'Vencido', value: overdue, icon: TriangleAlert, color: 'text-red-600 bg-red-50' },
  ]
  return (
    <div>
      <SectionHeader
        eyebrow="GESTÃO FINANCEIRA"
        title="Financeiro"
        description="Parcelas, gatilhos e recebimentos da operação."
        actions={
          <Button
            disabled={!canWrite}
            onClick={() => setNewOpen(true)}
            className="bg-[#FF6A13] hover:bg-[#E85B06]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova parcela
          </Button>
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
      <div className="mt-5 rounded-xl border border-[#FFD2B3] bg-[#FFF6EC] p-4 text-sm text-[#6A4A34]">
        <strong>Gatilhos automáticos:</strong> entradas são criadas ao iniciar a trilha e saldos em
        protocolo/entrega/conclusão, conforme a trilha. Registros automáticos são idempotentes e
        identificados abaixo.
      </div>
      <div className="mt-5 flex flex-col gap-3 rounded-xl border bg-white p-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-[#9A9A9A]" />
          <Input
            className="pl-9"
            placeholder="Buscar projeto, cliente ou descrição"
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
                  <th className="px-5 py-3">Valor</th>
                  <th className="px-5 py-3">Vencimento</th>
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
                        {item.expand?.projeto?.numero}
                      </Link>
                      <p className="text-xs text-[#737373]">{item.expand?.cliente?.razao_social}</p>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold">
                      {item.descricao}
                      {item.origem === 'gatilho' && (
                        <CrmBadge tone="orange" className="ml-2">
                          automático
                        </CrmBadge>
                      )}
                    </td>
                    <td className="mono-value px-5 py-4 font-bold">{formatCurrency(item.valor)}</td>
                    <td className="mono-value px-5 py-4 text-sm">{formatDate(item.vencimento)}</td>
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
                  </div>
                  <CrmBadge
                    tone={
                      item.status === 'paga' ? 'green' : item.status === 'vencida' ? 'red' : 'amber'
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
    </div>
  )
}
