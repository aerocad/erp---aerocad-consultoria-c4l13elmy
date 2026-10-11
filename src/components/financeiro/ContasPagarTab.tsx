import { useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { Link } from 'react-router-dom'
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
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/format'
import { createOne, deleteOne, updateOne } from '@/services/api'
import pb from '@/lib/pocketbase/client'
import type {
  CategoriaContaPagar,
  ClienteRecord,
  ContaPagarRecord,
  FormaPagamentoFinanceiro,
  ProjetoRecord,
  StatusContaPagar,
} from '@/types/crm'

export const CATEGORIA_PAGAR_LABELS: Record<CategoriaContaPagar, string> = {
  impostos: 'Impostos & Taxas',
  folha: 'Folha de Pagamento',
  terceirizados: 'Prestadores / Terceirizados',
  despesas_operacionais: 'Despesas Operacionais',
  equipamentos: 'Equipamentos & Softwares',
  outros: 'Outros Custos',
}

export const FORMA_PAGTO_LABELS: Record<FormaPagamentoFinanceiro, string> = {
  pix: 'PIX',
  ted_doc: 'TED / DOC',
  boleto: 'Boleto Bancário',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro',
  outro: 'Outro',
}

interface ContasPagarTabProps {
  contas: ContaPagarRecord[]
  projetos: ProjetoRecord[]
  clientes: ClienteRecord[]
  canWrite: boolean
  onReload: () => Promise<void> | void
}

export function ContasPagarTab({
  contas,
  projetos,
  clientes,
  canWrite,
  onReload,
}: ContasPagarTabProps) {
  const { user } = useAuth()
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroProjeto, setFiltroProjeto] = useState<string>('todos')

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [editando, setEditando] = useState<ContaPagarRecord | null>(null)
  const [excluindo, setExcluindo] = useState<ContaPagarRecord | null>(null)
  const [marcandoPago, setMarcandoPago] = useState<ContaPagarRecord | null>(null)
  const [dataPagamentoModal, setDataPagamentoModal] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState<{
    descricao: string
    fornecedor: string
    cliente_fornecedor: string
    categoria: CategoriaContaPagar
    valor: string
    data_vencimento: string
    data_pagamento: string
    status: StatusContaPagar
    forma_pagamento: FormaPagamentoFinanceiro
    numero_documento: string
    projeto: string
    observacoes: string
    arquivoComprovante: File | null
  }>({
    descricao: '',
    fornecedor: '',
    cliente_fornecedor: '',
    categoria: 'despesas_operacionais',
    valor: '',
    data_vencimento: new Date().toISOString().slice(0, 10),
    data_pagamento: '',
    status: 'pendente',
    forma_pagamento: 'pix',
    numero_documento: '',
    projeto: '',
    observacoes: '',
    arquivoComprovante: null,
  })

  // Cálculos de atraso e status virtual
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const contasProcessadas = useMemo(() => {
    return contas.map((c) => {
      const venc = new Date(c.data_vencimento.slice(0, 10))
      venc.setHours(0, 0, 0, 0)
      const isAtrasado = c.status === 'pendente' && venc < hoje
      const isVencendoHoje = c.status === 'pendente' && venc.getTime() === hoje.getTime()
      return {
        ...c,
        isAtrasado,
        isVencendoHoje,
      }
    })
  }, [contas, hoje])

  // Filtros
  const contasFiltradas = useMemo(() => {
    return contasProcessadas.filter((c) => {
      const matchBusca =
        c.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        c.fornecedor.toLowerCase().includes(busca.toLowerCase()) ||
        (c.numero_documento && c.numero_documento.toLowerCase().includes(busca.toLowerCase())) ||
        (c.expand?.projeto?.numero &&
          c.expand.projeto.numero.toLowerCase().includes(busca.toLowerCase()))

      const matchCat = filtroCategoria === 'todos' || c.categoria === filtroCategoria
      const matchProj = filtroProjeto === 'todos' || c.projeto === filtroProjeto

      let matchStat = true
      if (filtroStatus === 'pago') matchStat = c.status === 'pago'
      else if (filtroStatus === 'pendente') matchStat = c.status === 'pendente' && !c.isAtrasado
      else if (filtroStatus === 'atrasado') matchStat = c.isAtrasado
      else if (filtroStatus === 'cancelado') matchStat = c.status === 'cancelado'

      return matchBusca && matchCat && matchProj && matchStat
    })
  }, [contasProcessadas, busca, filtroCategoria, filtroProjeto, filtroStatus])

  // Totalizadores
  const totalGeral = contasFiltradas.reduce((acc, c) => acc + c.valor, 0)
  const totalPago = contasFiltradas
    .filter((c) => c.status === 'pago')
    .reduce((acc, c) => acc + c.valor, 0)
  const totalPendente = contasFiltradas
    .filter((c) => c.status === 'pendente' && !c.isAtrasado)
    .reduce((acc, c) => acc + c.valor, 0)
  const totalAtrasado = contasFiltradas
    .filter((c) => c.isAtrasado)
    .reduce((acc, c) => acc + c.valor, 0)

  function abrirModalCriacao() {
    setEditando(null)
    setFormData({
      descricao: '',
      fornecedor: '',
      cliente_fornecedor: '',
      categoria: 'despesas_operacionais',
      valor: '',
      data_vencimento: new Date().toISOString().slice(0, 10),
      data_pagamento: '',
      status: 'pendente',
      forma_pagamento: 'pix',
      numero_documento: '',
      projeto: '',
      observacoes: '',
      arquivoComprovante: null,
    })
    setModalNovoAberto(true)
  }

  function abrirModalEdicao(conta: ContaPagarRecord) {
    setEditando(conta)
    setFormData({
      descricao: conta.descricao,
      fornecedor: conta.fornecedor,
      cliente_fornecedor: conta.cliente_fornecedor || '',
      categoria: conta.categoria,
      valor: String(conta.valor),
      data_vencimento: conta.data_vencimento ? conta.data_vencimento.slice(0, 10) : '',
      data_pagamento: conta.data_pagamento ? conta.data_pagamento.slice(0, 10) : '',
      status: conta.status,
      forma_pagamento: conta.forma_pagamento || 'pix',
      numero_documento: conta.numero_documento || '',
      projeto: conta.projeto || '',
      observacoes: conta.observacoes || '',
      arquivoComprovante: null,
    })
    setModalNovoAberto(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (
      !formData.descricao ||
      !formData.fornecedor ||
      !formData.valor ||
      !formData.data_vencimento
    ) {
      toast.error('Preencha os campos obrigatórios (descrição, fornecedor, valor e vencimento).')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        descricao: formData.descricao,
        fornecedor: formData.fornecedor,
        categoria: formData.categoria,
        valor: Number(formData.valor),
        data_vencimento: `${formData.data_vencimento} 12:00:00.000Z`,
        status: formData.status,
        forma_pagamento: formData.forma_pagamento,
        numero_documento: formData.numero_documento,
        observacoes: formData.observacoes,
      }

      if (formData.cliente_fornecedor) payload.cliente_fornecedor = formData.cliente_fornecedor
      else payload.cliente_fornecedor = null

      if (formData.projeto) payload.projeto = formData.projeto
      else payload.projeto = null

      if (formData.status === 'pago' && formData.data_pagamento) {
        payload.data_pagamento = `${formData.data_pagamento} 12:00:00.000Z`
      } else if (formData.status !== 'pago') {
        payload.data_pagamento = null
      }

      let contaId = editando?.id

      if (editando) {
        await updateOne('contas_pagar', editando.id, payload)
        toast.success('Conta a pagar atualizada!')
      } else {
        payload.criado_por = user?.id || null
        const created = await createOne<ContaPagarRecord>('contas_pagar', payload)
        contaId = created.id
        toast.success('Conta a pagar cadastrada com sucesso!')
      }

      // Se enviou comprovante, faz upload
      if (formData.arquivoComprovante && contaId) {
        const fileData = new FormData()
        fileData.append('comprovante', formData.arquivoComprovante)
        await pb.collection('contas_pagar').update(contaId, fileData)
      }

      setModalNovoAberto(false)
      await onReload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao salvar conta a pagar: ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleConfirmarPagamento() {
    if (!marcandoPago) return
    setIsSubmitting(true)
    try {
      await updateOne('contas_pagar', marcandoPago.id, {
        status: 'pago',
        data_pagamento: `${dataPagamentoModal} 12:00:00.000Z`,
      })
      toast.success(`Conta "${marcandoPago.descricao}" marcada como paga!`)
      setMarcandoPago(null)
      await onReload()
    } catch {
      toast.error('Erro ao marcar conta como paga')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReabrirConta(conta: ContaPagarRecord) {
    try {
      await updateOne('contas_pagar', conta.id, {
        status: 'pendente',
        data_pagamento: null,
      })
      toast.success(`Conta "${conta.descricao}" reaberta como pendente.`)
      await onReload()
    } catch {
      toast.error('Erro ao reabrir conta')
    }
  }

  async function handleExcluir() {
    if (!excluindo) return
    setIsSubmitting(true)
    try {
      await deleteOne('contas_pagar', excluindo.id)
      toast.success('Conta a pagar excluída.')
      setExcluindo(null)
      await onReload()
    } catch {
      toast.error('Erro ao excluir conta')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="crm-card p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            <span>Total Filtrado</span>
            <Clock className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-neutral-900">
            {formatCurrency(totalGeral)}
          </p>
          <span className="text-[11px] text-neutral-400">{contasFiltradas.length} lançamentos</span>
        </div>

        <div className="crm-card p-4 border-emerald-200 bg-emerald-50/30">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            <span>Pago / Baixado</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-emerald-700">
            {formatCurrency(totalPago)}
          </p>
          <span className="text-[11px] text-emerald-600">
            {contasFiltradas.filter((c) => c.status === 'pago').length} quitadas
          </span>
        </div>

        <div className="crm-card p-4 border-amber-200 bg-amber-50/30">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800 uppercase tracking-wider">
            <span>A Vencer (Em dia)</span>
            <Calendar className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-amber-700">
            {formatCurrency(totalPendente)}
          </p>
          <span className="text-[11px] text-amber-600">
            {contasFiltradas.filter((c) => c.status === 'pendente' && !c.isAtrasado).length} em
            aberto
          </span>
        </div>

        <div className="crm-card p-4 border-rose-200 bg-rose-50/40">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-800 uppercase tracking-wider">
            <span>Atrasadas</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-rose-700">
            {formatCurrency(totalAtrasado)}
          </p>
          <span className="text-[11px] text-rose-600">
            {contasFiltradas.filter((c) => c.isAtrasado).length} com vencimento expirado
          </span>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 crm-card p-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por descrição, fornecedor, documento ou projeto..."
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <Filter className="mr-1.5 h-3.5 w-3.5 text-neutral-400" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas categorias</SelectItem>
              {Object.entries(CATEGORIA_PAGAR_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="pendente">A Vencer</SelectItem>
              <SelectItem value="atrasado">Atrasadas</SelectItem>
              <SelectItem value="pago">Pagas</SelectItem>
              <SelectItem value="cancelado">Canceladas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroProjeto} onValueChange={setFiltroProjeto}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos projetos</SelectItem>
              {projetos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.numero} · {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canWrite && (
            <Button
              onClick={abrirModalCriacao}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white h-9 text-xs shrink-0"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Conta a Pagar
            </Button>
          )}
        </div>
      </div>

      {/* Lista de Contas */}
      {contasFiltradas.length === 0 ? (
        <EmptyState
          title="Nenhuma conta a pagar encontrada"
          description={
            contas.length === 0
              ? 'Cadastre contas a pagar operacionais, impostos, folha e custos de terceiros.'
              : 'Tente ajustar os filtros ou a busca digitada.'
          }
        />
      ) : (
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Descrição / Fornecedor</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Projeto Vinculado</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Comprovante</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {contasFiltradas.map((conta) => {
                  return (
                    <tr
                      key={conta.id}
                      className={`hover:bg-neutral-50/80 transition ${
                        conta.isAtrasado ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span
                            className={`font-mono font-medium ${
                              conta.isAtrasado
                                ? 'text-rose-700 font-bold'
                                : conta.isVencendoHoje
                                  ? 'text-amber-700 font-bold'
                                  : 'text-neutral-800'
                            }`}
                          >
                            {formatDate(conta.data_vencimento)}
                          </span>
                          {conta.data_pagamento && (
                            <span className="text-[10px] text-emerald-700">
                              Pago: {formatDate(conta.data_pagamento)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-0.5 max-w-[280px]">
                          <p className="font-semibold text-neutral-900 line-clamp-1">
                            {conta.descricao}
                          </p>
                          <p className="text-neutral-500 text-[11px] flex items-center gap-1.5">
                            <span className="font-medium text-neutral-700">{conta.fornecedor}</span>
                            {conta.numero_documento && (
                              <span className="text-neutral-400">
                                Doc: {conta.numero_documento}
                              </span>
                            )}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <CrmBadge tone="gray">
                          {CATEGORIA_PAGAR_LABELS[conta.categoria] || conta.categoria}
                        </CrmBadge>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {conta.expand?.projeto ? (
                          <Link
                            to={`/projetos/${conta.projeto}`}
                            className="font-mono text-[#D65100] font-semibold hover:underline"
                          >
                            {conta.expand.projeto.numero}
                          </Link>
                        ) : (
                          <span className="text-neutral-400 italic">Despesa Geral</span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="mono-value font-bold text-sm text-neutral-900">
                          {formatCurrency(conta.valor)}
                        </span>
                        {conta.forma_pagamento && (
                          <p className="text-[10px] text-neutral-400">
                            {FORMA_PAGTO_LABELS[conta.forma_pagamento]}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {conta.status === 'pago' ? (
                          <CrmBadge tone="green">Pago</CrmBadge>
                        ) : conta.isAtrasado ? (
                          <CrmBadge tone="red">Atrasado</CrmBadge>
                        ) : conta.isVencendoHoje ? (
                          <CrmBadge tone="amber">Vence Hoje</CrmBadge>
                        ) : conta.status === 'cancelado' ? (
                          <CrmBadge tone="gray">Cancelado</CrmBadge>
                        ) : (
                          <CrmBadge tone="amber">Pendente</CrmBadge>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {conta.comprovante ? (
                          <a
                            href={pb.files.getURL(conta, conta.comprovante)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#FF6A13] hover:underline font-medium text-[11px]"
                            title="Ver Comprovante Anexo"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            Ver
                          </a>
                        ) : (
                          <span className="text-neutral-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {canWrite && (
                            <>
                              {conta.status !== 'pago' ? (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setMarcandoPago(conta)
                                    setDataPagamentoModal(new Date().toISOString().slice(0, 10))
                                  }}
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  title="Registrar pagamento"
                                >
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                  Pagar
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReabrirConta(conta)}
                                  className="h-7 text-xs border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                                  title="Reabrir conta para correção"
                                >
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                  Reabrir
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => abrirModalEdicao(conta)}
                                className="h-7 px-2 text-xs text-neutral-600 hover:text-neutral-900"
                              >
                                Editar
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setExcluindo(conta)}
                                className="h-7 w-7 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Excluir conta a pagar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
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

      {/* Modal de Criação / Edição de Conta a Pagar */}
      <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Descrição do Custo / Despesa *</Label>
              <Input
                required
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex: Análise topográfica complementar, DARF simples, licença AutoCAD..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fornecedor / Favorecido *</Label>
                <Input
                  required
                  value={formData.fornecedor}
                  onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                  placeholder="Nome da empresa ou prestador"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Vincular a Cadastro (Opcional)</Label>
                <Select
                  value={formData.cliente_fornecedor || 'nenhum'}
                  onValueChange={(val) =>
                    setFormData({
                      ...formData,
                      cliente_fornecedor: val === 'nenhum' ? '' : val,
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione um cliente/parceiro..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum vínculo</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Categoria *</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(val) =>
                    setFormData({ ...formData, categoria: val as CategoriaContaPagar })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_PAGAR_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Valor (R$) *</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Data de Vencimento *</Label>
                <Input
                  required
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) =>
                    setFormData({ ...formData, status: val as StatusContaPagar })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Forma de Pagamento</Label>
                <Select
                  value={formData.forma_pagamento}
                  onValueChange={(val) =>
                    setFormData({ ...formData, forma_pagamento: val as FormaPagamentoFinanceiro })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORMA_PAGTO_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.status === 'pago' && (
                <div className="space-y-1">
                  <Label className="text-xs">Data do Pagamento</Label>
                  <Input
                    type="date"
                    value={formData.data_pagamento}
                    onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nº do Documento / Nota Fiscal / Boleto</Label>
                <Input
                  value={formData.numero_documento}
                  onChange={(e) => setFormData({ ...formData, numero_documento: e.target.value })}
                  placeholder="Ex: NF 12345, Código de Barras..."
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Projeto para Custeio (Opcional)</Label>
                <Select
                  value={formData.projeto || 'nenhum'}
                  onValueChange={(val) =>
                    setFormData({ ...formData, projeto: val === 'nenhum' ? '' : val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Sem projeto (Despesa geral)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem projeto (Despesa geral)</SelectItem>
                    {projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.numero} · {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Anexar Comprovante / Fatura (PDF ou Imagem)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      arquivoComprovante: e.target.files?.[0] || null,
                    })
                  }
                  className="text-xs file:bg-[#FF6A13] file:text-white file:border-0 file:rounded file:px-2 file:py-1 file:mr-2"
                />
              </div>
              {editando?.comprovante && !formData.arquivoComprovante && (
                <p className="text-[11px] text-emerald-700">
                  Já possui anexo salvo ({editando.comprovante}). Selecione outro arquivo para
                  substituir.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observações Internas</Label>
              <Textarea
                rows={2}
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Detalhes adicionais sobre o custo ou aprovação..."
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalNovoAberto(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
              >
                {isSubmitting ? 'Salvando...' : editando ? 'Atualizar Conta' : 'Cadastrar Conta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Quitação Rápida */}
      <Dialog open={!!marcandoPago} onOpenChange={() => setMarcandoPago(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
          </DialogHeader>
          {marcandoPago && (
            <div className="space-y-3 text-xs">
              <p>
                Confirmar a baixa da conta <strong>{marcandoPago.descricao}</strong> de{' '}
                <strong>{formatCurrency(marcandoPago.valor)}</strong> para o favorecido{' '}
                <strong>{marcandoPago.fornecedor}</strong>?
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Data do Pagamento Realizado</Label>
                <Input
                  type="date"
                  value={dataPagamentoModal}
                  onChange={(e) => setDataPagamentoModal(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarcandoPago(null)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarPagamento}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? 'Confirmando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={!!excluindo} onOpenChange={() => setExcluindo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600">Excluir Conta a Pagar</DialogTitle>
          </DialogHeader>
          {excluindo && (
            <p className="text-xs text-neutral-600">
              Tem certeza que deseja excluir permanentemente o lançamento de{' '}
              <strong>{excluindo.descricao}</strong> no valor de{' '}
              <strong>{formatCurrency(excluindo.valor)}</strong>? Esta ação não pode ser desfeita.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleExcluir}
              disabled={isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isSubmitting ? 'Excluindo...' : 'Sim, Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
