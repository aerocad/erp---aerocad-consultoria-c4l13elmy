import { useState, useEffect, useMemo } from 'react'
import {
  Calendar,
  Check,
  Plus,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Layers,
  ArrowRight,
  Info,
  DollarSign,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { canViewFinancials, canViewNfse } from '@/lib/crm'
import { formatCurrency, formatDate } from '@/lib/format'
import { createOne, deleteOne, updateOne } from '@/services/api'
import type { ParcelaRecord, ProjetoRecord } from '@/types/crm'

export type PeriodicidadeParcela =
  | 'mensal'
  | 'bimestral'
  | 'trimestral'
  | 'semestral'
  | 'personalizado'

export interface ItemParcelaGerador {
  idTemp: string
  numero: number
  descricao: string
  valor: number
  vencimento: string // YYYY-MM-DD
  status: 'pendente' | 'paga' | 'vencida'
  gatilho: 'assinatura' | 'protocolo' | 'entrega' | 'medicao' | 'manual'
}

export interface GerenciarParcelamentoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projeto: ProjetoRecord | null
  parcelas: ParcelaRecord[]
  onSuccess?: () => void
}

/**
 * Adiciona meses a uma data sem desvio de fuso
 */
function adicionarMeses(dataBaseIso: string, meses: number): string {
  try {
    const [anoStr, mesStr, diaStr] = dataBaseIso.split('-')
    const ano = parseInt(anoStr, 10)
    const mes = parseInt(mesStr, 10) - 1
    const dia = parseInt(diaStr, 10)

    const novaData = new Date(ano, mes + meses, dia)
    // Se o dia ultrapassar o final do mês (ex.: 31 de janeiro + 1 mês = 3 de março), ajusta para o último dia do mês
    if (novaData.getDate() !== dia) {
      novaData.setDate(0)
    }

    const y = novaData.getFullYear()
    const m = String(novaData.getMonth() + 1).padStart(2, '0')
    const d = String(novaData.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  } catch {
    return dataBaseIso
  }
}

/**
 * Distribui o valor total em N parcelas ajustando centavos na primeira ou última parcela
 */
function distribuirCentavos(total: number, qtd: number): number[] {
  if (qtd <= 0) return []
  if (qtd === 1) return [Math.round(total * 100) / 100]

  const centavosTotal = Math.round(total * 100)
  const centavosBase = Math.floor(centavosTotal / qtd)
  const sobraCentavos = centavosTotal - centavosBase * qtd

  const resultado: number[] = []
  for (let i = 0; i < qtd; i++) {
    // Adiciona 1 centavo nas primeiras 'sobraCentavos' parcelas para total bater 100% exato
    const cents = centavosBase + (i < sobraCentavos ? 1 : 0)
    resultado.push(cents / 100)
  }
  return resultado
}

export function GerenciarParcelamentoModal({
  open,
  onOpenChange,
  projeto,
  parcelas,
  onSuccess,
}: GerenciarParcelamentoModalProps) {
  const { user } = useAuth()
  const { ocultarValores } = useFinanceiroVisibilidade()

  // Permissões
  const userCanViewFinancials = canViewFinancials(user?.role)
  const userCanViewNfseRole = canViewNfse(user?.role)
  const canManage = ['admin', 'financeiro'].includes(user?.role || '')

  // Identificar parcelas protegidas (com NFSe vinculada ou quitadas)
  const { parcelasProtegidas, parcelasDescartaveis } = useMemo(() => {
    const protegidas: ParcelaRecord[] = []
    const descartaveis: ParcelaRecord[] = []

    for (const p of parcelas) {
      const temNfse =
        Boolean(p.nf_numero?.trim()) || Boolean(p.nfse_chave?.trim()) || Boolean(p.nfse_dados)
      const quitada = p.status === 'paga'
      if (temNfse || quitada) {
        protegidas.push(p)
      } else {
        descartaveis.push(p)
      }
    }
    return { parcelasProtegidas: protegidas, parcelasDescartaveis: descartaveis }
  }, [parcelas])

  const totalProtegidas = useMemo(
    () => parcelasProtegidas.reduce((s, p) => s + (p.valor_recebido || p.valor), 0),
    [parcelasProtegidas],
  )

  // Abas do Modal: 'gerador' (para recriar/gerar em massa) ou 'individual' (edição fina e avulsa)
  const [activeTab, setActiveTab] = useState<'gerador' | 'individual'>('gerador')

  // Estado do Gerador em Massa
  const [qtdParcelas, setQtdParcelas] = useState(3)
  const [primeiroVencimento, setPrimeiroVencimento] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 15)
    return d.toISOString().slice(0, 10)
  })
  const [periodicidade, setPeriodicidade] = useState<PeriodicidadeParcela>('mensal')
  const [baseCalculo, setBaseCalculo] = useState<'saldo_remanescente' | 'valor_global'>(
    'saldo_remanescente',
  )
  const [valorManualBase, setValorManualBase] = useState<string>('')

  // Prévia da tabela de parcelas geradas
  const [previaParcelas, setPreviaParcelas] = useState<ItemParcelaGerador[]>([])

  // Estado para adicionar parcela individual avulsa
  const [novaDescricao, setNovaDescricao] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [novoVencimento, setNovoVencimento] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })
  const [novoGatilho, setNovoGatilho] = useState<
    'assinatura' | 'protocolo' | 'entrega' | 'medicao' | 'manual'
  >('manual')

  // Confirmação de divergência se o usuário quiser gravar valor diferente do valor global
  const [permitirDivergencia, setPermitirDivergencia] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Valor global de referência
  const valorGlobalProjeto = Number(projeto?.valor_global) || 0
  const saldoParaNovas = Math.max(0, valorGlobalProjeto - totalProtegidas)

  // Inicialização quando o modal abre
  useEffect(() => {
    if (open && projeto) {
      setErro(null)
      setPermitirDivergencia(false)
      // Se já existem apenas parcelas protegidas ou existem parcelas e o usuário quer editar finamente,
      // decide a aba padrão
      if (parcelas.length > 0 && parcelasProtegidas.length === parcelas.length) {
        setActiveTab('individual')
      } else {
        setActiveTab('gerador')
      }

      // Sugere valor base
      const valorBaseSugerido =
        parcelasProtegidas.length > 0 && saldoParaNovas > 0
          ? saldoParaNovas
          : valorGlobalProjeto > 0
            ? valorGlobalProjeto
            : 0

      setValorManualBase(valorBaseSugerido > 0 ? String(valorBaseSugerido) : '')
      gerarPreviaInicial(valorBaseSugerido, qtdParcelas, primeiroVencimento, periodicidade)
    }
  }, [open, projeto, parcelas.length, parcelasProtegidas.length])

  // Função auxiliar para recalcular a prévia das parcelas
  function gerarPreviaInicial(
    totalAId: number,
    qtd: number,
    data1: string,
    period: PeriodicidadeParcela,
  ) {
    if (qtd <= 0 || !data1) {
      setPreviaParcelas([])
      return
    }

    const valoresDistribuidos = distribuirCentavos(totalAId, qtd)
    const intervaloMeses =
      period === 'mensal'
        ? 1
        : period === 'bimestral'
          ? 2
          : period === 'trimestral'
            ? 3
            : period === 'semestral'
              ? 6
              : 1 // personalizado inicial com 1 mês

    const items: ItemParcelaGerador[] = []
    const offsetNumero = parcelasProtegidas.length

    for (let i = 0; i < qtd; i++) {
      const numParcela = offsetNumero + i + 1
      const totalParcelasDisplay = offsetNumero + qtd
      const dataVenc = adicionarMeses(data1, i * intervaloMeses)

      items.push({
        idTemp: `temp_${Date.now()}_${i}`,
        numero: numParcela,
        descricao: `Parcela ${numParcela}/${totalParcelasDisplay} — ${projeto?.nome || 'Serviços'}`,
        valor: valoresDistribuidos[i] || 0,
        vencimento: dataVenc,
        status: 'pendente',
        gatilho: i === 0 ? 'assinatura' : 'entrega',
      })
    }
    setPreviaParcelas(items)
  }

  // Recalcular quando o usuário clica em "Recalcular Distribuição"
  function handleRecalcularPrevia() {
    const valorAlvo =
      parseFloat(valorManualBase.replace(/\./g, '').replace(',', '.')) ||
      (baseCalculo === 'saldo_remanescente' && parcelasProtegidas.length > 0
        ? saldoParaNovas
        : valorGlobalProjeto)

    gerarPreviaInicial(Math.max(0, valorAlvo), qtdParcelas, primeiroVencimento, periodicidade)
    toast.info('Distribuição de parcelas recalculada com centavos ajustados.')
  }

  // Atualizar valor individual de uma parcela da prévia
  function handleAtualizarPreviaItem(idTemp: string, campo: keyof ItemParcelaGerador, valor: any) {
    setPreviaParcelas((prev) =>
      prev.map((item) => {
        if (item.idTemp !== idTemp) return item
        return { ...item, [campo]: valor }
      }),
    )
  }

  // Soma da prévia
  const somaPrevia = useMemo(
    () => previaParcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0),
    [previaParcelas],
  )

  // Total final simulado = parcelas protegidas intactas + novas parcelas da prévia
  const totalSimuladoFinal = useMemo(
    () => totalProtegidas + somaPrevia,
    [totalProtegidas, somaPrevia],
  )

  // Diferença em relação ao valor global
  const diferencaValorGlobal = useMemo(() => {
    return Math.round((totalSimuladoFinal - valorGlobalProjeto) * 100) / 100
  }, [totalSimuladoFinal, valorGlobalProjeto])

  const temDivergencia = Math.abs(diferencaValorGlobal) > 0.05 && valorGlobalProjeto > 0

  // Salvar parcelamento gerado em massa
  async function handleSalvarGerador() {
    if (!projeto || !canManage) return

    if (previaParcelas.length === 0) {
      setErro('Nenhuma parcela configurada na prévia.')
      return
    }

    if (temDivergencia && !permitirDivergencia) {
      setErro(
        `O total simulado (${formatCurrency(totalSimuladoFinal)}) diverge do Valor Global Contratado do projeto (${formatCurrency(valorGlobalProjeto)}). Marque a opção de confirmação ou ajuste os valores.`,
      )
      return
    }

    setProcessando(true)
    setErro(null)

    try {
      // 1. Remover APENAS as parcelas descartáveis (sem NFSe e não quitadas)
      // As protegidas NUNCA são apagadas (garantia de dado fiscal)
      let removidasCount = 0
      for (const p of parcelasDescartaveis) {
        try {
          await deleteOne('parcelas', p.id)
          removidasCount++
        } catch (delErr) {
          console.warn(`Não foi possível remover parcela pendente ${p.id}:`, delErr)
        }
      }

      // 2. Gravar as novas parcelas da prévia
      let criadasCount = 0
      for (const item of previaParcelas) {
        const payload = {
          projeto: projeto.id,
          cliente: projeto.cliente,
          descricao: item.descricao,
          valor: Math.max(0, Number(item.valor) || 0),
          vencimento: `${item.vencimento} 12:00:00.000Z`,
          status: item.status,
          gatilho: item.gatilho,
          origem: 'manual',
          numero_parcela_marco: String(item.numero),
          percentual_contrato:
            valorGlobalProjeto > 0
              ? Math.round(((Number(item.valor) || 0) / valorGlobalProjeto) * 100)
              : 0,
        }
        await createOne('parcelas', payload)
        criadasCount++
      }

      // 3. Auditoria na timeline
      const usuarioNome = user?.name || user?.email || 'Usuário'
      const textoAuditoria =
        `Parcelamento reestruturado por ${usuarioNome}: geradas ${criadasCount} nova(s) parcela(s) no total de ${formatCurrency(somaPrevia)}` +
        (removidasCount > 0
          ? ` (${removidasCount} parcela(s) pendente(s) anterior(es) substituída(s); ${parcelasProtegidas.length} parcela(s) com NFSe/quitada(s) preservada(s))`
          : ` (${parcelasProtegidas.length} parcela(s) com NFSe/quitada(s) mantida(s))`)

      if (user?.id) {
        try {
          await createOne('atividades', {
            usuario: user.id,
            texto: textoAuditoria,
            projeto: projeto.id,
            cliente: projeto.cliente,
            tipo: 'financeiro',
          })
        } catch (actErr) {
          console.warn('Erro ao registrar auditoria de parcelamento:', actErr)
        }
      }

      toast.success(`Parcelamento gravado com sucesso! ${criadasCount} parcela(s) gerada(s).`)
      onSuccess?.()
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Erro ao salvar parcelamento:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao salvar parcelamento.'
      setErro(msg)
      toast.error('Erro ao gravar parcelamento.')
    } finally {
      setProcessando(false)
    }
  }

  // Adicionar parcela individual avulsa
  async function handleAdicionarParcelaIndividual(e: React.FormEvent) {
    e.preventDefault()
    if (!projeto || !canManage) return

    const valNum = parseFloat(novoValor.replace(/\./g, '').replace(',', '.'))
    if (isNaN(valNum) || valNum <= 0) {
      setErro('Informe um valor válido maior que zero.')
      return
    }

    if (!novaDescricao.trim()) {
      setErro('Informe uma descrição para a parcela.')
      return
    }

    if (!novoVencimento) {
      setErro('Informe a data de vencimento.')
      return
    }

    setProcessando(true)
    setErro(null)

    try {
      const numProxima = parcelas.length + 1
      const payload = {
        projeto: projeto.id,
        cliente: projeto.cliente,
        descricao: novaDescricao.trim(),
        valor: valNum,
        vencimento: `${novoVencimento} 12:00:00.000Z`,
        status: 'pendente',
        gatilho: novoGatilho,
        origem: 'manual',
        numero_parcela_marco: String(numProxima),
        percentual_contrato:
          valorGlobalProjeto > 0 ? Math.round((valNum / valorGlobalProjeto) * 100) : 0,
      }

      await createOne('parcelas', payload)

      // Auditoria
      const usuarioNome = user?.name || user?.email || 'Usuário'
      if (user?.id) {
        try {
          await createOne('atividades', {
            usuario: user.id,
            texto: `Parcela avulsa "${novaDescricao.trim()}" (${formatCurrency(valNum)}, venc. ${formatDate(novoVencimento)}) adicionada por ${usuarioNome}`,
            projeto: projeto.id,
            cliente: projeto.cliente,
            tipo: 'financeiro',
          })
        } catch {
          /* ignore */
        }
      }

      toast.success('Parcela adicionada com sucesso!')
      setNovaDescricao('')
      setNovoValor('')
      onSuccess?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao adicionar parcela.'
      setErro(msg)
      toast.error('Erro ao adicionar parcela.')
    } finally {
      setProcessando(false)
    }
  }

  // Excluir parcela individual pendente (NUNCA com nota fiscal ou quitada)
  async function handleExcluirParcelaIndividual(p: ParcelaRecord) {
    if (!projeto || !canManage) return

    const temNfse =
      Boolean(p.nf_numero?.trim()) || Boolean(p.nfse_chave?.trim()) || Boolean(p.nfse_dados)
    if (temNfse || p.status === 'paga') {
      toast.error(
        'Esta parcela possui vínculo fiscal ou quitação e NÃO pode ser excluída por aqui. Utilize o fluxo de cancelamento fiscal.',
      )
      return
    }

    if (!confirm(`Deseja remover a parcela "${p.descricao}" de ${formatCurrency(p.valor)}?`)) {
      return
    }

    setProcessando(true)
    try {
      await deleteOne('parcelas', p.id)

      // Auditoria
      const usuarioNome = user?.name || user?.email || 'Usuário'
      if (user?.id) {
        try {
          await createOne('atividades', {
            usuario: user.id,
            texto: `Parcela "${p.descricao}" (${formatCurrency(p.valor)}) removida do parcelamento por ${usuarioNome}`,
            projeto: projeto.id,
            cliente: projeto.cliente,
            tipo: 'financeiro',
          })
        } catch {
          /* ignore */
        }
      }

      toast.success('Parcela removida com sucesso.')
      onSuccess?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover parcela.'
      toast.error(msg)
    } finally {
      setProcessando(false)
    }
  }

  // Alternar quitação de parcela individual (Marcar como Paga / Pendente)
  async function handleToggleStatusParcela(p: ParcelaRecord) {
    if (!projeto || !canManage) return
    const novoStatus = p.status === 'paga' ? 'pendente' : 'paga'
    const hojeIso = new Date().toISOString().slice(0, 10)

    setProcessando(true)
    try {
      const payload: Record<string, unknown> = {
        status: novoStatus,
      }

      if (novoStatus === 'paga') {
        payload.data_pagamento = `${hojeIso} 12:00:00.000Z`
        payload.valor_recebido = p.valor_recebido || p.valor
        payload.status_pagamento = p.nf_numero ? 'Recebido (NFS-e)' : 'Recebido'
      } else {
        payload.data_pagamento = null
        payload.valor_recebido = 0
        payload.status_pagamento = p.nf_numero ? 'Faturado com NFS-e' : 'Pendente'
      }

      await updateOne('parcelas', p.id, payload)

      // Auditoria
      const usuarioNome = user?.name || user?.email || 'Usuário'
      if (user?.id) {
        try {
          await createOne('atividades', {
            usuario: user.id,
            texto: `Parcela "${p.descricao}" marcada como ${novoStatus === 'paga' ? 'PAGA (Quitada)' : 'PENDENTE (Reaberta)'} por ${usuarioNome}`,
            projeto: projeto.id,
            cliente: projeto.cliente,
            tipo: 'financeiro',
          })
        } catch {
          /* ignore */
        }
      }

      toast.success(
        novoStatus === 'paga' ? 'Parcela marcada como quitada!' : 'Parcela reaberta como pendente!',
      )
      onSuccess?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao alterar status.'
      toast.error(msg)
    } finally {
      setProcessando(false)
    }
  }

  // Se o usuário não tem permissão para visualizar finanças, bloqueia abertura
  if (!userCanViewFinancials) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-neutral-800">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Acesso Restrito
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600 pt-2">
              Seu perfil não tem permissão para acessar os dados financeiros ou parcelamentos deste
              projeto.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#FF6A13] border border-orange-200">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-[#333]">
                  Criar e Alterar Parcelamento
                </DialogTitle>
                <DialogDescription className="text-xs text-[#737373]">
                  Projeto <strong className="font-mono text-[#D65100]">{projeto?.numero}</strong> —{' '}
                  {projeto?.nome}
                </DialogDescription>
              </div>
            </div>
            {valorGlobalProjeto > 0 && (
              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                  Valor Global Contratado
                </span>
                <span className="mono-value font-bold text-sm text-[#FF6A13]">
                  {formatCurrency(valorGlobalProjeto)}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Quadro informativo de proteção fiscal se houver parcelas com nota ou quitadas */}
        {parcelasProtegidas.length > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex items-start gap-3 mt-1">
            <ShieldAlert className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-blue-950">
                Regra de Proteção Fiscal Ativa: {parcelasProtegidas.length} parcela(s) protegida(s)
              </p>
              <p className="text-blue-800 leading-relaxed text-[11px]">
                Existem <strong>{parcelasProtegidas.length}</strong> parcela(s) com NFS-e vinculada
                ou já quitadas ({formatCurrency(totalProtegidas)}).{' '}
                <span className="underline font-semibold">
                  Estas parcelas nunca são apagadas automaticamente
                </span>
                . Qualquer regeração de parcelas incidirá apenas sobre o saldo remanescente e
                substituirá somente as parcelas pendentes sem vínculo fiscal.
              </p>
            </div>
          </div>
        )}

        {/* Abas Superiores: Gerador em Lote × Gerenciamento Individual */}
        <div className="flex border-b border-neutral-200 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('gerador')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
              activeTab === 'gerador'
                ? 'border-[#FF6A13] text-[#FF6A13]'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Gerador / Distribuição Automática
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('individual')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
              activeTab === 'individual'
                ? 'border-[#FF6A13] text-[#FF6A13]'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" />
            Editar Parcelas Existentes ({parcelas.length}) & Avulsas
          </button>
        </div>

        {erro && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200 flex items-start gap-2 mt-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA 1: GERADOR EM LOTE / DISTRIBUIÇÃO AUTOMÁTICA               */}
        {/* ============================================================== */}
        {activeTab === 'gerador' && (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-neutral-200 bg-[#FAFAFA] p-4 space-y-3.5">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Parâmetros de Geração
                </span>
                <span className="text-[11px] text-neutral-500">
                  Ajuste centavos automaticamente na 1ª parcela
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Qtd Parcelas */}
                <div className="space-y-1.5">
                  <Label htmlFor="input-qtd" className="text-xs font-semibold text-neutral-700">
                    Número de Parcelas *
                  </Label>
                  <Select
                    value={String(qtdParcelas)}
                    onValueChange={(val) => setQtdParcelas(parseInt(val, 10) || 1)}
                  >
                    <SelectTrigger id="input-qtd" className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18, 24].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 1 ? 'parcela (À vista)' : 'parcelas'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Periodicidade */}
                <div className="space-y-1.5">
                  <Label htmlFor="input-periodo" className="text-xs font-semibold text-neutral-700">
                    Periodicidade *
                  </Label>
                  <Select
                    value={periodicidade}
                    onValueChange={(val: PeriodicidadeParcela) => setPeriodicidade(val)}
                  >
                    <SelectTrigger id="input-periodo" className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal (a cada 30 dias)</SelectItem>
                      <SelectItem value="bimestral">Bimestral (a cada 60 dias)</SelectItem>
                      <SelectItem value="trimestral">Trimestral (a cada 90 dias)</SelectItem>
                      <SelectItem value="semestral">Semestral (a cada 180 dias)</SelectItem>
                      <SelectItem value="personalizado">Avulso / Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 1º Vencimento */}
                <div className="space-y-1.5">
                  <Label htmlFor="input-1venc" className="text-xs font-semibold text-neutral-700">
                    1º Vencimento *
                  </Label>
                  <Input
                    id="input-1venc"
                    type="date"
                    value={primeiroVencimento}
                    onChange={(e) => setPrimeiroVencimento(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                {/* Base de Cálculo */}
                <div className="space-y-1.5">
                  <Label htmlFor="input-base" className="text-xs font-semibold text-neutral-700">
                    Valor a Parcelar (R$) *
                  </Label>
                  <Input
                    id="input-base"
                    type={ocultarValores ? 'password' : 'number'}
                    step="0.01"
                    min="0"
                    value={ocultarValores ? '••••••' : valorManualBase}
                    onChange={(e) => !ocultarValores && setValorManualBase(e.target.value)}
                    readOnly={ocultarValores}
                    placeholder="0.00"
                    className="h-9 text-xs font-mono font-bold text-[#D65100]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-200/70 text-xs">
                <div className="text-[11px] text-neutral-500">
                  {parcelasProtegidas.length > 0 && (
                    <span>
                      Saldo remanescente a parcelar:{' '}
                      <strong className="text-neutral-800">{formatCurrency(saldoParaNovas)}</strong>{' '}
                      (Global {formatCurrency(valorGlobalProjeto)} − Protegidas{' '}
                      {formatCurrency(totalProtegidas)})
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRecalcularPrevia}
                  className="h-7 text-xs border-orange-200 text-[#D65100] hover:bg-orange-50 font-semibold"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Recalcular Distribuição
                </Button>
              </div>
            </div>

            {/* TABELA DE PRÉVIA DE PARCELAS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                    Prévia do Cronograma de Parcelas
                  </h3>
                  <span className="text-[11px] bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full font-medium">
                    {previaParcelas.length} parcela(s)
                  </span>
                </div>
                <span className="text-[11px] text-neutral-500">
                  Você pode editar valores, datas e descrições diretamente na tabela antes de gravar
                </span>
              </div>

              {/* Tabela Interativa de Prévia */}
              <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3 w-12 text-center">#</th>
                        <th className="py-2 px-3 min-w-[200px]">Descrição da Parcela</th>
                        <th className="py-2 px-3 w-36">Vencimento</th>
                        <th className="py-2 px-3 w-36 text-right">Valor (R$)</th>
                        <th className="py-2 px-3 w-36">Gatilho / Marco</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {/* Linhas das parcelas protegidas para contexto visual */}
                      {parcelasProtegidas.map((prot, idx) => (
                        <tr key={prot.id} className="bg-blue-50/40 text-neutral-600 text-[11px]">
                          <td className="py-2 px-3 text-center font-bold text-blue-700">
                            P{idx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-neutral-800">{prot.descricao}</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-blue-700">
                              <span>Protegida</span>
                              {prot.nf_numero && <span>· NFS-e nº {prot.nf_numero}</span>}
                              {prot.status === 'paga' && <span>· Quitada</span>}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono text-neutral-600">
                            {formatDate(prot.vencimento)}
                          </td>
                          <td className="py-2 px-3 text-right mono-value font-bold text-blue-900">
                            {formatCurrency(prot.valor)}
                          </td>
                          <td className="py-2 px-3 text-[10px] text-neutral-500 capitalize">
                            {prot.gatilho || 'manual'}
                          </td>
                        </tr>
                      ))}

                      {/* Linhas editáveis da prévia */}
                      {previaParcelas.map((item, index) => (
                        <tr key={item.idTemp} className="hover:bg-orange-50/30 transition">
                          <td className="py-2 px-3 text-center font-mono font-bold text-neutral-500">
                            {item.numero}
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              value={item.descricao}
                              onChange={(e) =>
                                handleAtualizarPreviaItem(item.idTemp, 'descricao', e.target.value)
                              }
                              className="h-7 text-xs"
                              placeholder="Descrição da parcela"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="date"
                              value={item.vencimento}
                              onChange={(e) =>
                                handleAtualizarPreviaItem(item.idTemp, 'vencimento', e.target.value)
                              }
                              className="h-7 text-xs font-mono"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Input
                              type={ocultarValores ? 'password' : 'number'}
                              step="0.01"
                              min="0"
                              value={ocultarValores ? '••••••' : item.valor}
                              onChange={(e) =>
                                !ocultarValores &&
                                handleAtualizarPreviaItem(
                                  item.idTemp,
                                  'valor',
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              readOnly={ocultarValores}
                              className="h-7 text-xs font-mono font-bold text-right text-[#D65100]"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Select
                              value={item.gatilho}
                              onValueChange={(val: any) =>
                                handleAtualizarPreviaItem(item.idTemp, 'gatilho', val)
                              }
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="assinatura">Assinatura</SelectItem>
                                <SelectItem value="protocolo">Protocolo</SelectItem>
                                <SelectItem value="entrega">Entrega Técnica</SelectItem>
                                <SelectItem value="medicao">Medição</SelectItem>
                                <SelectItem value="manual">Manual</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}

                      {previaParcelas.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-xs text-neutral-400">
                            Nenhuma parcela para exibir na prévia. Configure os parâmetros acima.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Rodapé da tabela com verificação de totais */}
                <div className="bg-neutral-50 p-3 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                        Novas Parcelas:
                      </span>
                      <strong className="mono-value text-sm text-[#FF6A13]">
                        {formatCurrency(somaPrevia)}
                      </strong>
                    </div>

                    {parcelasProtegidas.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                          + Parcelas Protegidas:
                        </span>
                        <strong className="mono-value text-sm text-blue-900">
                          {formatCurrency(totalProtegidas)}
                        </strong>
                      </div>
                    )}

                    <div className="border-l pl-4">
                      <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                        Total Final Simulado:
                      </span>
                      <strong className="mono-value text-sm text-neutral-900">
                        {formatCurrency(totalSimuladoFinal)}
                      </strong>
                    </div>
                  </div>

                  <div className="text-right">
                    {temDivergencia ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium text-[11px]">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span>
                          Divergência de {formatCurrency(Math.abs(diferencaValorGlobal))}{' '}
                          {diferencaValorGlobal > 0 ? '(adicional)' : '(a menor)'}
                        </span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium text-[11px]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Total confere 100% com o Valor Global Contratado</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Aviso e Confirmação de Divergência se existir */}
            {temDivergencia && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Atenção: Total das parcelas não coincide exatamente com o Valor Global do projeto!
                </div>
                <p className="text-[11px] text-amber-800">
                  O valor global cadastrado no projeto é{' '}
                  <strong>{formatCurrency(valorGlobalProjeto)}</strong> e o cronograma totalizará{' '}
                  <strong>{formatCurrency(totalSimuladoFinal)}</strong> (diferença de{' '}
                  {formatCurrency(diferencaValorGlobal)}). Deseja gravar com valores divergentes
                  (ex.: aditivo de contrato ou desconto acordado)?
                </p>
                <label className="flex items-center gap-2 font-medium cursor-pointer pt-1 text-amber-950">
                  <input
                    type="checkbox"
                    checked={permitirDivergencia}
                    onChange={(e) => setPermitirDivergencia(e.target.checked)}
                    className="rounded border-amber-400 text-[#FF6A13] focus:ring-[#FF6A13]"
                  />
                  <span>Confirmar e permitir gravação com valores divergentes</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA 2: EDITAR PARCELAS EXISTENTES & ADICIONAR AVULSA           */}
        {/* ============================================================== */}
        {activeTab === 'individual' && (
          <div className="space-y-4 pt-2">
            {/* Lista das Parcelas Atuais do Projeto */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Parcelas Cadastradas no Projeto ({parcelas.length})
                </h3>
                <span className="text-[11px] text-neutral-500">
                  Marque como recebida/pendente ou remova parcelas sem vínculo fiscal
                </span>
              </div>

              <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-sm divide-y max-h-80 overflow-y-auto">
                {parcelas.map((p, idx) => {
                  const temNfse =
                    Boolean(p.nf_numero?.trim()) ||
                    Boolean(p.nfse_chave?.trim()) ||
                    Boolean(p.nfse_dados)
                  const isQuitada = p.status === 'paga'

                  return (
                    <div
                      key={p.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/80 transition"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-neutral-500">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-bold text-neutral-900">{p.descricao}</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isQuitada
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : p.status === 'vencida'
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isQuitada && <CheckCircle2 className="h-3 w-3" />}
                            {p.status === 'vencida' && <Clock className="h-3 w-3" />}
                            {isQuitada
                              ? 'Quitada'
                              : p.status === 'vencida'
                                ? 'Vencida'
                                : 'Pendente'}
                          </span>
                          {temNfse && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-orange-50 text-[#D65100] border border-orange-200">
                              NFS-e nº {p.nf_numero || 'vinculada'}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                          <span>
                            Vencimento:{' '}
                            <strong className="text-neutral-700">{formatDate(p.vencimento)}</strong>
                          </span>
                          <span>·</span>
                          <span>
                            Gatilho:{' '}
                            <strong className="text-neutral-700 capitalize">
                              {p.gatilho || 'manual'}
                            </strong>
                          </span>
                          {p.data_pagamento && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-700">
                                Pago em: {formatDate(p.data_pagamento)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="mono-value font-bold text-sm text-[#1F1F1F] block">
                            {formatCurrency(p.valor)}
                          </span>
                          {isQuitada && (
                            <span className="text-[10px] text-emerald-600 font-semibold block">
                              Rec: {formatCurrency(p.valor_recebido || p.valor)}
                            </span>
                          )}
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleStatusParcela(p)}
                              disabled={processando}
                              className={`h-7 text-xs px-2.5 font-semibold ${
                                isQuitada
                                  ? 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                                  : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                              title={
                                isQuitada
                                  ? 'Reabrir parcela como pendente'
                                  : 'Marcar parcela como quitada / recebida'
                              }
                            >
                              {isQuitada ? 'Reabrir' : 'Quitar'}
                            </Button>

                            {!temNfse && !isQuitada ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleExcluirParcelaIndividual(p)}
                                disabled={processando}
                                className="h-7 w-7 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Excluir parcela pendente"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <div
                                title="Parcela com NFS-e ou quitada protegida contra exclusão acidental"
                                className="h-7 w-7 flex items-center justify-center text-neutral-300 cursor-not-allowed"
                              >
                                <HelpCircle className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {parcelas.length === 0 && (
                  <p className="py-6 text-center text-xs text-neutral-500">
                    Nenhuma parcela cadastrada para este projeto.
                  </p>
                )}
              </div>
            </div>

            {/* Formulário para Adicionar Parcela Avulsa */}
            {canManage && (
              <form
                onSubmit={handleAdicionarParcelaIndividual}
                className="rounded-xl border border-orange-200 bg-orange-50/30 p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-orange-200 pb-2">
                  <span className="text-xs font-bold text-[#D65100] flex items-center gap-1.5">
                    <Plus className="h-4 w-4" />
                    Adicionar Parcela Individual Avulsa
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Útil para acréscimos, consultorias extras ou taxas
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="nova-desc" className="text-xs font-semibold text-neutral-700">
                      Descrição da Parcela *
                    </Label>
                    <Input
                      id="nova-desc"
                      value={novaDescricao}
                      onChange={(e) => setNovaDescricao(e.target.value)}
                      placeholder="Ex.: Parcela Extra — Revisão Complementar"
                      className="h-9 text-xs"
                      disabled={processando}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="novo-val" className="text-xs font-semibold text-neutral-700">
                      Valor (R$) *
                    </Label>
                    <Input
                      id="novo-val"
                      type={ocultarValores ? 'password' : 'number'}
                      step="0.01"
                      min="0"
                      value={ocultarValores ? '••••••' : novoValor}
                      onChange={(e) => !ocultarValores && setNovoValor(e.target.value)}
                      readOnly={ocultarValores}
                      placeholder="0.00"
                      className="h-9 text-xs font-mono font-bold text-[#D65100]"
                      disabled={processando || ocultarValores}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="novo-venc" className="text-xs font-semibold text-neutral-700">
                      Vencimento *
                    </Label>
                    <Input
                      id="novo-venc"
                      type="date"
                      value={novoVencimento}
                      onChange={(e) => setNovoVencimento(e.target.value)}
                      className="h-9 text-xs font-mono"
                      disabled={processando}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={processando || !novaDescricao.trim() || !novoValor}
                    className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs h-8"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Adicionar Parcela
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Rodapé de Ações do Modal */}
        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={processando}
          >
            {activeTab === 'individual' ? 'Fechar' : 'Cancelar'}
          </Button>

          {activeTab === 'gerador' && canManage && (
            <Button
              type="button"
              onClick={handleSalvarGerador}
              disabled={processando || previaParcelas.length === 0}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gravando Parcelamento...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Gravar Parcelamento ({previaParcelas.length} parcelas)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
