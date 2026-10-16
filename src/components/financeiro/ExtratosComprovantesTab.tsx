import { useMemo, useState, useEffect, type ChangeEvent } from 'react'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileSpreadsheet,
  FileText,
  FileUp,
  Filter,
  Link as LinkIcon,
  Paperclip,
  RefreshCw,
  Search,
  Sparkles,
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
import { formatCurrency, formatDate } from '@/lib/format'
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
  projetos?: import('@/types/crm').ProjetoRecord[]
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
  projetos = [],
  canWrite,
  onReloadExtratos,
  onReloadTransacoes,
  onReloadParcelas,
  onReloadContasPagar,
  onReloadContasReceber,
}: ExtratosComprovantesTabProps) {
  const { user } = useAuth()
  const isMobile = useIsMobile()

  // Modal de Captura Fotográfica & Visão IA
  const [modalCapturaIaAberto, setModalCapturaIaAberto] = useState(false)

  // Estados de navegação
  const [extratoSelecionadoId, setExtratoSelecionadoId] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  // Contas Bancárias PJ e Seleção no Upload do Extrato
  const [contasBancarias, setContasBancarias] = useState<ContaBancariaRecord[]>([])
  const [contaBancariaSelecionadaUpload, setContaBancariaSelecionadaUpload] = useState<string>('')
  const [filtroContaBancaria, setFiltroContaBancaria] = useState<string>('todos')

  useEffect(() => {
    pb.collection('contas_bancarias')
      .getFullList<ContaBancariaRecord>({ sort: 'apelido' })
      .then((res) => {
        setContasBancarias(res)
        if (res.length > 0) setContaBancariaSelecionadaUpload(res[0].id)
      })
      .catch((err) => console.log('Erro ao carregar contas bancárias PJ:', err))
  }, [])

  // Modais
  const [modalUploadAberto, setModalUploadAberto] = useState(false)
  const [isProcessandoUpload, setIsProcessandoUpload] = useState(false)
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

  // Transações filtradas
  const transacoesFiltradas = useMemo(() => {
    return transacoes.filter((tx) => {
      const extratoPai = extratos.find((e) => e.id === tx.extrato)
      const matchExtrato = extratoSelecionadoId === 'todos' || tx.extrato === extratoSelecionadoId
      const matchBusca =
        tx.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        (tx.documento_ref && tx.documento_ref.toLowerCase().includes(busca.toLowerCase()))
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
    transacoes,
    extratos,
    extratoSelecionadoId,
    busca,
    filtroStatus,
    filtroTipo,
    filtroContaBancaria,
  ])

  // Sugestões para o item em conciliação
  const sugestoesAtuais = useMemo<SugestaoConciliacao[]>(() => {
    if (!transacaoParaConciliar) return []
    return encontrarSugestoesConciliacao(
      transacaoParaConciliar,
      {
        parcelas,
        contasPagar,
        contasReceber,
      },
      7, // tolerância de até 7 dias
    )
  }, [transacaoParaConciliar, parcelas, contasPagar, contasReceber])

  // Handler de importação de arquivo de extrato
  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessandoUpload(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      let parsed = null
      let formato: 'ofx' | 'csv' | 'xlsx' = 'ofx'

      if (ext === 'ofx') {
        formato = 'ofx'
        const text = await file.text()
        parsed = parseOfxString(text)
      } else if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
        formato = ext === 'csv' ? 'csv' : 'xlsx'
        parsed = await parsePlanilhaExtrato(file)
      } else {
        throw new Error('Formato não suportado. Utilize arquivos .OFX, .CSV ou .XLSX.')
      }

      if (!parsed.transacoes.length) {
        throw new Error('Nenhuma transação válida identificada no arquivo.')
      }

      // Calcula totais
      const totalEntradas = parsed.transacoes
        .filter((t) => t.tipo === 'entrada')
        .reduce((acc, t) => acc + t.valor, 0)
      const totalSaidas = parsed.transacoes
        .filter((t) => t.tipo === 'saida')
        .reduce((acc, t) => acc + t.valor, 0)

      // 1. Cria o registro de Extrato no PB vinculado à conta bancária PJ escolhida
      const extratoRecord = await createOne<ExtratoRecord>('extratos', {
        nome_arquivo: file.name,
        formato,
        banco: parsed.banco || 'Banco Comercial',
        conta: parsed.conta || '',
        conta_bancaria: contaBancariaSelecionadaUpload || null,
        data_inicio: parsed.dataInicio ? `${parsed.dataInicio} 12:00:00.000Z` : null,
        data_fim: parsed.dataFim ? `${parsed.dataFim} 12:00:00.000Z` : null,
        total_transacoes: parsed.transacoes.length,
        total_entradas: totalEntradas,
        total_saidas: totalSaidas,
        saldo_final: parsed.saldoFinal || 0,
        usuario: user?.id || null,
      })

      // 2. Cria as linhas de transação
      let salvas = 0
      for (const t of parsed.transacoes) {
        try {
          await createOne('extratos_transacoes', {
            extrato: extratoRecord.id,
            data: `${t.data} 12:00:00.000Z`,
            descricao: t.descricao,
            valor: t.valor,
            tipo: t.tipo,
            documento_ref: t.documentoRef || '',
            fitid: t.fitid,
            status_conciliacao: 'pendente',
          })
          salvas++
        } catch {
          /* continua importando as demais */
        }
      }

      toast.success(
        `Extrato "${file.name}" importado com sucesso! ${salvas} transações registradas para conciliação.`,
      )
      setModalUploadAberto(false)
      setExtratoSelecionadoId(extratoRecord.id)
      await onReloadExtratos()
      await onReloadTransacoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Falha ao importar extrato: ${msg}`)
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

  // Excluir extrato completo
  async function handleExcluirExtrato() {
    if (!modalExcluirExtrato) return
    try {
      await deleteOne('extratos', modalExcluirExtrato.id)
      toast.success('Extrato bancário e transações excluídos com sucesso.')
      setModalExcluirExtrato(null)
      setExtratoSelecionadoId('todos')
      await onReloadExtratos()
      await onReloadTransacoes()
    } catch {
      toast.error('Erro ao excluir extrato')
    }
  }

  return (
    <div className="space-y-4">
      {/* Topo com ações de Extrato e Comprovante */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 crm-card p-4">
        <div>
          <h3 className="font-bold text-neutral-900 text-sm">Extratos Bancários & Conciliação</h3>
          <p className="text-xs text-neutral-500">
            Importe extratos OFX/CSV/XLSX e faça a conciliação automática com contas e parcelas do
            CRM.
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
                Subir Extrato (OFX / CSV / XLSX)
              </Button>
            </>
          )}
        </div>
      </div>
      {/* Seção de Extratos Importados */}
      {extratos.length > 0 && (
        <div className="crm-card p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
            <span>Extratos no Sistema ({extratos.length})</span>
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

            {extratos.map((ex) => {
              const isSelected = extratoSelecionadoId === ex.id
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
                    className="font-medium text-left truncate max-w-[200px]"
                    title={ex.nome_arquivo}
                  >
                    {ex.nome_arquivo}
                    <span className="ml-1 text-[10px] text-neutral-400">
                      ({ex.total_transacoes || 0})
                    </span>
                  </button>

                  {canWrite && (
                    <button
                      onClick={() => setModalExcluirExtrato(ex)}
                      className="text-neutral-400 hover:text-rose-600 ml-1"
                      title="Excluir este extrato"
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
      {/* Filtros e Busca de Transações */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 crm-card p-3">
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
      {/* Tabela de Transações */}
      {transacoesFiltradas.length === 0 ? (
        <EmptyState
          title="Nenhuma transação de extrato encontrada"
          description={
            extratos.length === 0
              ? 'Suba o extrato bancário da sua conta (.OFX, .CSV ou .XLSX) para iniciar a conciliação.'
              : 'Nenhuma transação corresponde aos filtros selecionados.'
          }
        />
      ) : (
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b">
                <tr>
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
                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-neutral-50/80 transition ${
                        tx.status_conciliacao === 'conciliado' ? 'bg-emerald-50/20' : ''
                      }`}
                    >
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
                                      contasPagar.map((c) => ({
                                        id: c.id,
                                        valor: c.valor,
                                        data: c.data_pagamento || c.data_vencimento,
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
                                      contasReceber.map((c) => ({
                                        id: c.id,
                                        valor: c.valor,
                                        data: c.data_recebimento || c.data_vencimento,
                                        numero_documento: c.numero_documento,
                                        fornecedorOuCliente: c.cliente_nome,
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
            <DialogTitle>Importar Extrato Bancário</DialogTitle>
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
                • <strong>OFX</strong>: Arquivo padrão de Internet Banking de todos os bancos
                brasileiros.
              </p>
              <p>
                • <strong>CSV / XLSX</strong>: Planilhas de extrato bancário com colunas de data,
                histórico e valor.
              </p>
            </div>

            <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:border-[#FF6A13] transition cursor-pointer relative bg-neutral-50/50">
              <FileUp className="mx-auto h-8 w-8 text-[#FF6A13] mb-2" />
              <p className="font-semibold text-neutral-800">
                Clique para selecionar ou arraste o extrato
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5">OFX, CSV ou XLSX de até 25 MB</p>
              <input
                type="file"
                accept=".ofx,.csv,.xlsx,.xls"
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
                      return (
                        <div
                          key={`${sug.tipo}_${sug.id}`}
                          className="p-3 flex items-center justify-between gap-3 hover:bg-orange-50/30 transition"
                        >
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

                          <Button
                            size="sm"
                            disabled={isConciliando}
                            onClick={() => handleConfirmarConciliacao(sug)}
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
                    ? contasPagar.map((cp) => (
                        <SelectItem key={cp.id} value={cp.id}>
                          {cp.fornecedor} — {cp.descricao} ({formatCurrency(cp.valor)})
                        </SelectItem>
                      ))
                    : contasReceber.map((cr) => (
                        <SelectItem key={cr.id} value={cr.id}>
                          {cr.cliente_nome} — {cr.descricao} ({formatCurrency(cr.valor)})
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
      {/* Modal Excluir Extrato */}
      <Dialog open={!!modalExcluirExtrato} onOpenChange={() => setModalExcluirExtrato(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600">Excluir Extrato Bancário</DialogTitle>
          </DialogHeader>
          {modalExcluirExtrato && (
            <p className="text-xs text-neutral-600">
              Deseja realmente excluir o extrato <strong>{modalExcluirExtrato.nome_arquivo}</strong>{' '}
              e todas as suas transações vinculadas?
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalExcluirExtrato(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleExcluirExtrato}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Excluir Extrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal de Captura Mobile / Extração IA de Comprovantes */}
      <CapturaComprovanteModal
        open={modalCapturaIaAberto}
        onOpenChange={setModalCapturaIaAberto}
        projetos={projetos}
        isMobile={isMobile}
        onSuccess={async () => {
          await onReloadContasPagar()
        }}
      />{' '}
    </div>
  )
}
