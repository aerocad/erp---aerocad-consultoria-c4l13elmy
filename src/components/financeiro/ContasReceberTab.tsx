import { useMemo, useState, type FormEvent } from 'react'
import {
  Banknote,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState } from '@/components/common/States'
import { EditarVencimentoParcelaModal } from '@/components/financeiro/EditarVencimentoParcelaModal'
import { GeradorMinutaEmailModal } from '@/components/common/GeradorMinutaEmailModal'
import type { MinutaEmailContexto, ModeloMinutaTipo } from '@/lib/minutasEmail'
import { Mail } from 'lucide-react'
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
  CategoriaContaReceber,
  ClienteRecord,
  ContaReceberRecord,
  FormaPagamentoFinanceiro,
  ParcelaRecord,
  ProjetoRecord,
  StatusContaReceber,
} from '@/types/crm'

export const CATEGORIA_RECEBER_LABELS: Record<CategoriaContaReceber, string> = {
  consultoria_avulsa: 'Consultoria Avulsa',
  servico_tecnico: 'Serviço Técnico Especial',
  honorarios: 'Honorários Técnicos',
  reembolso: 'Reembolso / Repasse',
  rendimento_aplicacao: 'Rendimento de Aplicação',
  outros: 'Outras Receitas',
}

export interface RecebivelConsolidado {
  id: string
  origemTipo: 'parcela' | 'avulsa'
  descricao: string
  clienteNome: string
  clienteId?: string
  projetoNumero?: string
  projetoId?: string
  nfNumero?: string
  valor: number
  valorRecebido: number
  dataVencimento: string
  dataRecebimento?: string
  status: 'pendente' | 'recebido' | 'vencido' | 'cancelado'
  categoriaLabel: string
  comprovante?: string
  rawItem: ParcelaRecord | ContaReceberRecord
}

interface ContasReceberTabProps {
  parcelas: ParcelaRecord[]
  contasReceber: ContaReceberRecord[]
  projetos: ProjetoRecord[]
  clientes: ClienteRecord[]
  canWrite: boolean
  onReloadParcelas: () => Promise<void> | void
  onReloadContasReceber: () => Promise<void> | void
  filtroBuscaInicial?: string
}

export function ContasReceberTab({
  parcelas,
  contasReceber,
  projetos,
  clientes,
  canWrite,
  onReloadParcelas,
  onReloadContasReceber,
  filtroBuscaInicial,
}: ContasReceberTabProps) {
  const { user } = useAuth()
  const [busca, setBusca] = useState(filtroBuscaInicial || '')
  const [filtroOrigem, setFiltroOrigem] = useState<'todos' | 'parcelas' | 'avulsas'>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroCliente, setFiltroCliente] = useState<string>('todos')

  // Modais
  const [modalNovoAvulsoAberto, setModalNovoAvulsoAberto] = useState(false)
  const [editandoAvulso, setEditandoAvulso] = useState<ContaReceberRecord | null>(null)
  const [excluindoAvulso, setExcluindoAvulso] = useState<ContaReceberRecord | null>(null)
  const [marcandoRecebida, setMarcandoRecebida] = useState<RecebivelConsolidado | null>(null)
  const [dataRecebimentoModal, setDataRecebimentoModal] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [valorRecebidoModal, setValorRecebidoModal] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [parcelaParaEditarVencimento, setParcelaParaEditarVencimento] =
    useState<ParcelaRecord | null>(null)
  const [editarVencimentoOpen, setEditarVencimentoOpen] = useState(false)
  const [minutaEmailOpen, setMinutaEmailOpen] = useState(false)
  const [minutaContexto, setMinutaContexto] = useState<MinutaEmailContexto>({
    tipo: 'cobranca_medicao',
  })
  const [minutaLockModel, setMinutaLockModel] = useState(false)
  const [minutaModelosPermitidos, setMinutaModelosPermitidos] = useState<
    ModeloMinutaTipo[] | undefined
  >(undefined)

  // Form avulso
  const [formAvulso, setFormAvulso] = useState<{
    descricao: string
    cliente_nome: string
    cliente: string
    categoria: CategoriaContaReceber
    valor: string
    valor_recebido: string
    data_vencimento: string
    data_recebimento: string
    status: StatusContaReceber
    forma_recebimento: FormaPagamentoFinanceiro
    numero_documento: string
    projeto: string
    observacoes: string
    arquivoComprovante: File | null
  }>({
    descricao: '',
    cliente_nome: '',
    cliente: '',
    categoria: 'consultoria_avulsa',
    valor: '',
    valor_recebido: '',
    data_vencimento: new Date().toISOString().slice(0, 10),
    data_recebimento: '',
    status: 'pendente',
    forma_recebimento: 'pix',
    numero_documento: '',
    projeto: '',
    observacoes: '',
    arquivoComprovante: null,
  })

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  // Unifica parcelas de projetos + receitas avulsas
  const listaConsolidada = useMemo<RecebivelConsolidado[]>(() => {
    const res: RecebivelConsolidado[] = []

    // 1. Parcelas de Projetos
    for (const p of parcelas) {
      const venc = new Date(p.vencimento.slice(0, 10))
      venc.setHours(0, 0, 0, 0)

      let stat: RecebivelConsolidado['status'] = 'pendente'
      if (p.status === 'paga') stat = 'recebido'
      else if (p.status === 'vencida' || venc < hoje) stat = 'vencido'

      res.push({
        id: `p_${p.id}`,
        origemTipo: 'parcela',
        descricao: p.descricao,
        clienteNome: p.expand?.cliente?.razao_social || 'Cliente não informado',
        clienteId: p.cliente,
        projetoNumero: p.expand?.projeto?.numero,
        projetoId: p.projeto,
        nfNumero: p.nf_numero,
        valor: p.valor,
        valorRecebido: p.valor_recebido || (p.status === 'paga' ? p.valor : 0),
        dataVencimento: p.vencimento,
        dataRecebimento: p.data_pagamento,
        status: stat,
        categoriaLabel: p.origem === 'gatilho' ? 'Gatilho de Contrato' : 'Parcela de Projeto',
        comprovante: undefined,
        rawItem: p,
      })
    }

    // 2. Receitas avulsas
    for (const cr of contasReceber) {
      const venc = new Date(cr.data_vencimento.slice(0, 10))
      venc.setHours(0, 0, 0, 0)

      let stat: RecebivelConsolidado['status'] = 'pendente'
      if (cr.status === 'recebido') stat = 'recebido'
      else if (cr.status === 'cancelado') stat = 'cancelado'
      else if (venc < hoje) stat = 'vencido'

      res.push({
        id: `cr_${cr.id}`,
        origemTipo: 'avulsa',
        descricao: cr.descricao,
        clienteNome: cr.cliente_nome,
        clienteId: cr.cliente,
        projetoNumero: cr.expand?.projeto?.numero,
        projetoId: cr.projeto,
        nfNumero: cr.numero_documento,
        valor: cr.valor,
        valorRecebido: cr.valor_recebido || (cr.status === 'recebido' ? cr.valor : 0),
        dataVencimento: cr.data_vencimento,
        dataRecebimento: cr.data_recebimento,
        status: stat,
        categoriaLabel: CATEGORIA_RECEBER_LABELS[cr.categoria] || cr.categoria,
        comprovante: cr.comprovante,
        rawItem: cr,
      })
    }

    // Ordena decrescente por vencimento
    return res.sort((a, b) => b.dataVencimento.localeCompare(a.dataVencimento))
  }, [parcelas, contasReceber, hoje])

  // Filtragem
  const recebiveisFiltrados = useMemo(() => {
    return listaConsolidada.filter((item) => {
      const matchBusca =
        item.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        item.clienteNome.toLowerCase().includes(busca.toLowerCase()) ||
        (item.projetoNumero && item.projetoNumero.toLowerCase().includes(busca.toLowerCase())) ||
        (item.nfNumero && item.nfNumero.toLowerCase().includes(busca.toLowerCase()))

      const matchOrigem =
        filtroOrigem === 'todos' ||
        (filtroOrigem === 'parcelas' && item.origemTipo === 'parcela') ||
        (filtroOrigem === 'avulsas' && item.origemTipo === 'avulsa')

      const matchStatus = filtroStatus === 'todos' || item.status === filtroStatus

      const matchCliente = filtroCliente === 'todos' || item.clienteId === filtroCliente

      return matchBusca && matchOrigem && matchStatus && matchCliente
    })
  }, [listaConsolidada, busca, filtroOrigem, filtroStatus, filtroCliente])

  // Totais
  const totalGeral = recebiveisFiltrados.reduce((acc, r) => acc + r.valor, 0)
  const totalRecebido = recebiveisFiltrados
    .filter((r) => r.status === 'recebido')
    .reduce((acc, r) => acc + (r.valorRecebido || r.valor), 0)
  const totalEmAberto = recebiveisFiltrados
    .filter((r) => r.status === 'pendente')
    .reduce((acc, r) => acc + r.valor, 0)
  const totalAtrasado = recebiveisFiltrados
    .filter((r) => r.status === 'vencido')
    .reduce((acc, r) => acc + r.valor, 0)

  function abrirModalCriarAvulso() {
    setEditandoAvulso(null)
    setFormAvulso({
      descricao: '',
      cliente_nome: '',
      cliente: '',
      categoria: 'consultoria_avulsa',
      valor: '',
      valor_recebido: '',
      data_vencimento: new Date().toISOString().slice(0, 10),
      data_recebimento: '',
      status: 'pendente',
      forma_recebimento: 'pix',
      numero_documento: '',
      projeto: '',
      observacoes: '',
      arquivoComprovante: null,
    })
    setModalNovoAvulsoAberto(true)
  }

  function abrirModalEditarAvulso(cr: ContaReceberRecord) {
    setEditandoAvulso(cr)
    setFormAvulso({
      descricao: cr.descricao,
      cliente_nome: cr.cliente_nome,
      cliente: cr.cliente || '',
      categoria: cr.categoria,
      valor: String(cr.valor),
      valor_recebido: cr.valor_recebido ? String(cr.valor_recebido) : '',
      data_vencimento: cr.data_vencimento ? cr.data_vencimento.slice(0, 10) : '',
      data_recebimento: cr.data_recebimento ? cr.data_recebimento.slice(0, 10) : '',
      status: cr.status,
      forma_recebimento: cr.forma_recebimento || 'pix',
      numero_documento: cr.numero_documento || '',
      projeto: cr.projeto || '',
      observacoes: cr.observacoes || '',
      arquivoComprovante: null,
    })
    setModalNovoAvulsoAberto(true)
  }

  async function handleSubmitAvulso(e: FormEvent) {
    e.preventDefault()
    if (
      !formAvulso.descricao ||
      !formAvulso.cliente_nome ||
      !formAvulso.valor ||
      !formAvulso.data_vencimento
    ) {
      toast.error('Preencha os campos obrigatórios')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        descricao: formAvulso.descricao,
        cliente_nome: formAvulso.cliente_nome,
        categoria: formAvulso.categoria,
        valor: Number(formAvulso.valor),
        valor_recebido: formAvulso.valor_recebido ? Number(formAvulso.valor_recebido) : 0,
        data_vencimento: `${formAvulso.data_vencimento} 12:00:00.000Z`,
        status: formAvulso.status,
        forma_recebimento: formAvulso.forma_recebimento,
        numero_documento: formAvulso.numero_documento,
        observacoes: formAvulso.observacoes,
      }

      if (formAvulso.cliente) payload.cliente = formAvulso.cliente
      else payload.cliente = null

      if (formAvulso.projeto) payload.projeto = formAvulso.projeto
      else payload.projeto = null

      if (formAvulso.status === 'recebido' && formAvulso.data_recebimento) {
        payload.data_recebimento = `${formAvulso.data_recebimento} 12:00:00.000Z`
        if (!payload.valor_recebido || Number(payload.valor_recebido) <= 0) {
          payload.valor_recebido = Number(formAvulso.valor)
        }
      } else if (formAvulso.status !== 'recebido') {
        payload.data_recebimento = null
      }

      let avulsoId = editandoAvulso?.id

      if (editandoAvulso) {
        await updateOne('contas_receber', editandoAvulso.id, payload)
        toast.success('Receita avulsa atualizada!')
      } else {
        payload.criado_por = user?.id || null
        const created = await createOne<ContaReceberRecord>('contas_receber', payload)
        avulsoId = created.id
        toast.success('Receita avulsa registrada com sucesso!')
      }

      if (formAvulso.arquivoComprovante && avulsoId) {
        const fileData = new FormData()
        fileData.append('comprovante', formAvulso.arquivoComprovante)
        await pb.collection('contas_receber').update(avulsoId, fileData)
      }

      setModalNovoAvulsoAberto(false)
      await onReloadContasReceber()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao salvar receita avulsa: ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleConfirmarRecebimento() {
    if (!marcandoRecebida) return
    setIsSubmitting(true)
    try {
      const valRec = Number(valorRecebidoModal) || marcandoRecebida.valor

      if (marcandoRecebida.origemTipo === 'parcela') {
        const rawParcela = marcandoRecebida.rawItem as ParcelaRecord
        await updateOne('parcelas', rawParcela.id, {
          status: 'paga',
          data_pagamento: `${dataRecebimentoModal} 12:00:00.000Z`,
          valor_recebido: valRec,
          status_pagamento: rawParcela.nf_numero ? 'Recebido (NFS-e)' : 'Recebido',
        })
        toast.success(`Parcela marcada como recebida em ${formatDate(dataRecebimentoModal)}!`)
        await onReloadParcelas()
      } else {
        const rawAvulso = marcandoRecebida.rawItem as ContaReceberRecord
        await updateOne('contas_receber', rawAvulso.id, {
          status: 'recebido',
          data_recebimento: `${dataRecebimentoModal} 12:00:00.000Z`,
          valor_recebido: valRec,
        })
        toast.success(`Receita avulsa marcada como recebida!`)
        await onReloadContasReceber()
      }

      setMarcandoRecebida(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao confirmar recebimento: ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReabrirItem(item: RecebivelConsolidado) {
    try {
      if (item.origemTipo === 'parcela') {
        const p = item.rawItem as ParcelaRecord
        const venc = new Date(p.vencimento)
        const novoStatus = venc < hoje ? 'vencida' : 'pendente'
        await updateOne('parcelas', p.id, {
          status: novoStatus,
          data_pagamento: null,
          valor_recebido: 0,
        })
        toast.success('Parcela reaberta como pendente.')
        await onReloadParcelas()
      } else {
        const cr = item.rawItem as ContaReceberRecord
        await updateOne('contas_receber', cr.id, {
          status: 'pendente',
          data_recebimento: null,
          valor_recebido: 0,
        })
        toast.success('Receita avulsa reaberta.')
        await onReloadContasReceber()
      }
    } catch {
      toast.error('Erro ao reabrir lançamento')
    }
  }

  async function handleExcluirAvulso() {
    if (!excluindoAvulso) return
    setIsSubmitting(true)
    try {
      await deleteOne('contas_receber', excluindoAvulso.id)
      toast.success('Receita avulsa excluída.')
      setExcluindoAvulso(null)
      await onReloadContasReceber()
    } catch {
      toast.error('Erro ao excluir')
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
            <span>Total a Receber Previsto</span>
            <Clock className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-neutral-900">
            {formatCurrency(totalGeral)}
          </p>
          <span className="text-[11px] text-neutral-400">
            {recebiveisFiltrados.length} lançamentos
          </span>
        </div>

        <div className="crm-card p-4 border-emerald-200 bg-emerald-50/30">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            <span>Total Já Recebido</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-emerald-700">
            {formatCurrency(totalRecebido)}
          </p>
          <span className="text-[11px] text-emerald-600">
            {recebiveisFiltrados.filter((r) => r.status === 'recebido').length} quitados
          </span>
        </div>

        <div className="crm-card p-4 border-sky-200 bg-sky-50/30">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-800 uppercase tracking-wider">
            <span>Em Aberto (A Vencer)</span>
            <Calendar className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-sky-700">
            {formatCurrency(totalEmAberto)}
          </p>
          <span className="text-[11px] text-sky-600">
            {recebiveisFiltrados.filter((r) => r.status === 'pendente').length} no prazo
          </span>
        </div>

        <div className="crm-card p-4 border-rose-200 bg-rose-50/40">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-800 uppercase tracking-wider">
            <span>Em Atraso</span>
            <Clock className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-rose-700">
            {formatCurrency(totalAtrasado)}
          </p>
          <span className="text-[11px] text-rose-600">
            {recebiveisFiltrados.filter((r) => r.status === 'vencido').length} vencidos
          </span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 crm-card p-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por descrição, cliente, projeto ou nº NFS-e..."
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filtroOrigem}
            onValueChange={(val) => setFiltroOrigem(val as 'todos' | 'parcelas' | 'avulsas')}
          >
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <Layers className="mr-1.5 h-3.5 w-3.5 text-neutral-400" />
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas origens</SelectItem>
              <SelectItem value="parcelas">Parcelas de Projetos</SelectItem>
              <SelectItem value="avulsas">Receitas Avulsas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <Filter className="mr-1.5 h-3.5 w-3.5 text-neutral-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="pendente">A Vencer</SelectItem>
              <SelectItem value="vencido">Em Atraso</SelectItem>
              <SelectItem value="recebido">Recebidos</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroCliente} onValueChange={setFiltroCliente}>
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canWrite && (
            <Button
              onClick={abrirModalCriarAvulso}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white h-9 text-xs shrink-0"
              title="Cadastrar receita não ligada diretamente a proposta de projeto"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Receita Avulsa
            </Button>
          )}
        </div>
      </div>

      {/* Tabela de Recebíveis */}
      {recebiveisFiltrados.length === 0 ? (
        <EmptyState
          title="Nenhum recebível encontrado"
          description="Ajuste os filtros ou cadastre novas parcelas/receitas avulsas."
        />
      ) : (
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2.5 whitespace-nowrap min-w-[105px]">Vencimento</th>
                  <th className="px-3 py-2.5 min-w-[230px]">Descrição / Cliente</th>
                  <th className="px-3 py-2.5 whitespace-nowrap min-w-[130px]">
                    Origem / Categoria
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap min-w-[110px]">NFS-e / Doc</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap min-w-[110px]">Valor</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap min-w-[90px]">Status</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap min-w-[210px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {recebiveisFiltrados.map((item) => {
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-neutral-50/80 transition-colors ${
                        item.status === 'vencido' ? 'bg-rose-50/25' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {canWrite && item.origemTipo === 'parcela' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setParcelaParaEditarVencimento(item.rawItem as ParcelaRecord)
                                setEditarVencimentoOpen(true)
                              }}
                              className={`inline-flex items-center gap-1 font-mono font-medium hover:text-[#D65100] hover:underline transition ${
                                item.status === 'vencido'
                                  ? 'text-rose-700 font-bold'
                                  : 'text-neutral-800'
                              }`}
                              title="Editar data de vencimento da parcela"
                            >
                              <span>{formatDate(item.dataVencimento)}</span>
                              <Calendar className="h-3 w-3 text-neutral-400 hover:text-[#FF6A13]" />
                            </button>
                          ) : (
                            <span
                              className={`font-mono font-medium ${
                                item.status === 'vencido'
                                  ? 'text-rose-700 font-bold'
                                  : 'text-neutral-800'
                              }`}
                            >
                              {formatDate(item.dataVencimento)}
                            </span>
                          )}
                        </div>
                        {item.dataRecebimento && (
                          <p className="text-[10px] text-emerald-700 font-semibold">
                            Rec: {formatDate(item.dataRecebimento)}
                          </p>
                        )}
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="space-y-0.5 max-w-[320px]">
                          <p className="font-semibold text-neutral-900 line-clamp-1">
                            {item.descricao}
                          </p>
                          <p className="text-neutral-500 text-[11px] flex items-center gap-1.5">
                            <span className="font-medium text-neutral-700">{item.clienteNome}</span>
                            {item.projetoNumero && (
                              <Link
                                to={`/projetos/${item.projetoId}`}
                                className="font-mono text-[#D65100] hover:underline"
                              >
                                · {item.projetoNumero}
                              </Link>
                            )}
                          </p>
                        </div>
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <CrmBadge tone={item.origemTipo === 'parcela' ? 'orange' : 'gray'}>
                          {item.categoriaLabel}
                        </CrmBadge>
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {item.nfNumero ? (
                          <span className="font-mono font-bold text-[#FF6A13] bg-orange-50 px-2 py-0.5 rounded border border-orange-200 text-[11px]">
                            NFS-e nº {item.nfNumero}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic text-[11px]">Sem nota</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className="mono-value font-bold text-sm text-neutral-900">
                          {formatCurrency(item.valor)}
                        </span>
                        {item.valorRecebido > 0 && item.valorRecebido !== item.valor && (
                          <p className="text-[10px] text-emerald-700 font-mono">
                            Rec: {formatCurrency(item.valorRecebido)}
                          </p>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {item.status === 'recebido' ? (
                          <CrmBadge tone="green">Recebido</CrmBadge>
                        ) : item.status === 'vencido' ? (
                          <CrmBadge tone="red">Em Atraso</CrmBadge>
                        ) : item.status === 'cancelado' ? (
                          <CrmBadge tone="gray">Cancelado</CrmBadge>
                        ) : (
                          <CrmBadge tone="amber">A Vencer</CrmBadge>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {canWrite && (
                            <>
                              {item.status !== 'recebido' ? (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setMarcandoRecebida(item)
                                    setDataRecebimentoModal(new Date().toISOString().slice(0, 10))
                                    setValorRecebidoModal(String(item.valor))
                                  }}
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                  title="Marcar como recebido"
                                >
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                  Receber
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReabrirItem(item)}
                                  className="h-7 text-xs border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                                  title="Reabrir recebimento em caso de erro"
                                >
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                  Reabrir
                                </Button>
                              )}

                              {item.origemTipo === 'parcela' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const pRecord = item.rawItem as ParcelaRecord
                                      const proj = projetos.find((p) => p.id === pRecord.projeto)
                                      const cl = clientes.find(
                                        (c) => c.id === (item.clienteId || pRecord.cliente),
                                      )
                                      setMinutaContexto({
                                        tipo: item.nfNumero ? 'cobranca_nfse' : 'cobranca_medicao',
                                        projeto: proj || pRecord.expand?.projeto || null,
                                        cliente: cl || pRecord.expand?.cliente || null,
                                        contatoNome: item.clienteNome,
                                        contatoEmail: cl?.email,
                                        parcela: pRecord,
                                      })
                                      setMinutaLockModel(false)
                                      setMinutaModelosPermitidos([
                                        'cobranca_medicao',
                                        'cobranca_nfse',
                                      ])
                                      setMinutaEmailOpen(true)
                                    }}
                                    className="h-7 px-2 text-xs text-[#D65100] hover:bg-orange-50 font-medium"
                                    title="Gerar e-mail de cobrança de medição ou NFS-e"
                                  >
                                    <Mail className="mr-1 h-3.5 w-3.5 text-[#FF6A13]" />
                                    Cobrar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setParcelaParaEditarVencimento(item.rawItem as ParcelaRecord)
                                      setEditarVencimentoOpen(true)
                                    }}
                                    className="h-7 w-7 p-0 text-neutral-400 hover:text-[#D65100] hover:bg-orange-50"
                                    title="Editar data de vencimento da parcela"
                                    aria-label={`Editar vencimento de ${item.descricao}`}
                                  >
                                    <Calendar className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}

                              {item.origemTipo === 'avulsa' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      abrirModalEditarAvulso(item.rawItem as ContaReceberRecord)
                                    }
                                    className="h-7 px-2 text-xs text-neutral-600 hover:text-neutral-900"
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setExcluindoAvulso(item.rawItem as ContaReceberRecord)
                                    }
                                    className="h-7 w-7 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                                    title="Excluir receita avulsa"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
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

      {/* Modal Nova / Editar Receita Avulsa */}
      <Dialog open={modalNovoAvulsoAberto} onOpenChange={setModalNovoAvulsoAberto}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editandoAvulso ? 'Editar Receita Avulsa' : 'Nova Receita Avulsa'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitAvulso} className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Descrição do Recebível *</Label>
              <Input
                required
                value={formAvulso.descricao}
                onChange={(e) => setFormAvulso({ ...formAvulso, descricao: e.target.value })}
                placeholder="Ex: Parecer avulso aeroportuário, consultoria extraordinária..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Cliente / Pagador *</Label>
                <Input
                  required
                  value={formAvulso.cliente_nome}
                  onChange={(e) => setFormAvulso({ ...formAvulso, cliente_nome: e.target.value })}
                  placeholder="Nome ou Razão Social"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Vincular a Cliente do CRM (Opcional)</Label>
                <Select
                  value={formAvulso.cliente || 'nenhum'}
                  onValueChange={(val) => {
                    const found = clientes.find((c) => c.id === val)
                    setFormAvulso({
                      ...formAvulso,
                      cliente: val === 'nenhum' ? '' : val,
                      cliente_nome: found ? found.razao_social : formAvulso.cliente_nome,
                    })
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione um cliente..." />
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
                  value={formAvulso.categoria}
                  onValueChange={(val) =>
                    setFormAvulso({ ...formAvulso, categoria: val as CategoriaContaReceber })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_RECEBER_LABELS).map(([k, label]) => (
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
                  value={formAvulso.valor}
                  onChange={(e) => setFormAvulso({ ...formAvulso, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Data de Vencimento *</Label>
                <Input
                  required
                  type="date"
                  value={formAvulso.data_vencimento}
                  onChange={(e) =>
                    setFormAvulso({ ...formAvulso, data_vencimento: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={formAvulso.status}
                  onValueChange={(val) =>
                    setFormAvulso({ ...formAvulso, status: val as StatusContaReceber })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Forma de Recebimento</Label>
                <Select
                  value={formAvulso.forma_recebimento}
                  onValueChange={(val) =>
                    setFormAvulso({
                      ...formAvulso,
                      forma_recebimento: val as FormaPagamentoFinanceiro,
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="ted_doc">TED / DOC</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formAvulso.status === 'recebido' && (
                <div className="space-y-1">
                  <Label className="text-xs">Data do Recebimento</Label>
                  <Input
                    type="date"
                    value={formAvulso.data_recebimento}
                    onChange={(e) =>
                      setFormAvulso({ ...formAvulso, data_recebimento: e.target.value })
                    }
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nº do Documento / NFS-e / Recibo</Label>
                <Input
                  value={formAvulso.numero_documento}
                  onChange={(e) =>
                    setFormAvulso({ ...formAvulso, numero_documento: e.target.value })
                  }
                  placeholder="Ex: NFS-e 105, Recibo 01..."
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Vincular a Projeto (Opcional)</Label>
                <Select
                  value={formAvulso.projeto || 'nenhum'}
                  onValueChange={(val) =>
                    setFormAvulso({ ...formAvulso, projeto: val === 'nenhum' ? '' : val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Sem projeto (Receita avulsa)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem projeto</SelectItem>
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
              <Label className="text-xs">Anexar Comprovante / Recibo (PDF ou Imagem)</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) =>
                  setFormAvulso({
                    ...formAvulso,
                    arquivoComprovante: e.target.files?.[0] || null,
                  })
                }
                className="text-xs file:bg-[#FF6A13] file:text-white file:border-0 file:rounded file:px-2 file:py-1 file:mr-2"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea
                rows={2}
                value={formAvulso.observacoes}
                onChange={(e) => setFormAvulso({ ...formAvulso, observacoes: e.target.value })}
                placeholder="Observações complementares..."
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalNovoAvulsoAberto(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
              >
                {isSubmitting
                  ? 'Salvando...'
                  : editandoAvulso
                    ? 'Atualizar Receita'
                    : 'Registrar Receita'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Recebimento */}
      <Dialog open={!!marcandoRecebida} onOpenChange={() => setMarcandoRecebida(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
          </DialogHeader>
          {marcandoRecebida && (
            <div className="space-y-3 text-xs">
              <p>
                Confirmar recebimento de <strong>{marcandoRecebida.descricao}</strong> do cliente{' '}
                <strong>{marcandoRecebida.clienteNome}</strong>?
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Data de Recebimento Efetivo</Label>
                <Input
                  type="date"
                  value={dataRecebimentoModal}
                  onChange={(e) => setDataRecebimentoModal(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor Recebido (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorRecebidoModal}
                  onChange={(e) => setValorRecebidoModal(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMarcandoRecebida(null)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarRecebimento}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? 'Confirmando...' : 'Confirmar Recebimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Vencimento da Parcela */}
      <EditarVencimentoParcelaModal
        open={editarVencimentoOpen}
        onOpenChange={setEditarVencimentoOpen}
        parcela={parcelaParaEditarVencimento}
        projetoId={parcelaParaEditarVencimento?.projeto}
        projetoNumero={parcelaParaEditarVencimento?.expand?.projeto?.numero}
        clienteId={parcelaParaEditarVencimento?.cliente}
        onSuccess={async () => {
          await onReloadParcelas()
        }}
      />

      {/* Modal do Gerador de Minutas de E-mail AEROCAD */}
      <GeradorMinutaEmailModal
        open={minutaEmailOpen}
        onOpenChange={setMinutaEmailOpen}
        initialContexto={minutaContexto}
        lockModel={minutaLockModel}
        modelosPermitidos={minutaModelosPermitidos}
      />

      {/* Modal Excluir Avulso */}
      <Dialog open={!!excluindoAvulso} onOpenChange={() => setExcluindoAvulso(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600">Excluir Receita Avulsa</DialogTitle>
          </DialogHeader>
          {excluindoAvulso && (
            <p className="text-xs text-neutral-600">
              Tem certeza que deseja excluir o recebível avulso{' '}
              <strong>{excluindoAvulso.descricao}</strong> no valor de{' '}
              <strong>{formatCurrency(excluindoAvulso.valor)}</strong>?
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExcluindoAvulso(null)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExcluirAvulso}
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
