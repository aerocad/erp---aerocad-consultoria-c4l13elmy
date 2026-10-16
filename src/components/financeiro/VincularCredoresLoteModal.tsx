import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Building2,
  CheckCircle2,
  Link2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Search,
  CheckSquare,
  Square,
  ArrowRight,
} from 'lucide-react'
import type { ContaPagarRecord, CredorRecord } from '@/types/crm'
import {
  extrairDadosEstabelecimentoConta,
  vincularCredorAContaPagar,
  encontrarCredorCorrespondente,
} from '@/services/credorComprovanteMatcher'
import { salvarCredor } from '@/services/credores'
import { formatCurrency, formatDate } from '@/lib/format'
import { formatarDocumento, limparDocumento } from '@/services/importacaoParser'

export interface VincularCredoresLoteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contas: ContaPagarRecord[]
  credores: CredorRecord[]
  usuarioId?: string | null
  onSuccess: () => Promise<void> | void
  onAbrirIndividual: (conta: ContaPagarRecord) => void
}

interface ItemProcessamentoLote {
  conta: ContaPagarRecord
  nomeSugerido: string
  docSugerido: string
  temDadosValidos: boolean
  credorExistenteSugerido: CredorRecord | null
  motivoCorrespondencia?: 'documento_exato' | 'nome_semelhante'
  selecionado: boolean
}

export function VincularCredoresLoteModal({
  open,
  onOpenChange,
  contas,
  credores,
  usuarioId,
  onSuccess,
  onAbrirIndividual,
}: VincularCredoresLoteModalProps) {
  const [busca, setBusca] = useState('')
  const [processando, setProcessando] = useState(false)
  const [itensSelecionadosIds, setItensSelecionadosIds] = useState<string[]>([])

  // Filtra as contas que têm comprovante mas NÃO têm credor vinculado
  const contasSemCredorComComprovante = useMemo(() => {
    return contas.filter((c) => {
      const semCredor = !c.credor && !c.expand?.credor
      const temComprovante = Boolean(
        (Array.isArray(c.comprovante) && c.comprovante.length > 0) ||
        (typeof c.comprovante === 'string' && c.comprovante.trim().length > 0) ||
        (Array.isArray(c.comprovantes_metadados) && c.comprovantes_metadados.length > 0),
      )
      return semCredor && temComprovante
    })
  }, [contas])

  // Mapeia cada conta para status de match com a base de credores
  const itensProcessados: ItemProcessamentoLote[] = useMemo(() => {
    return contasSemCredorComComprovante.map((conta) => {
      const info = extrairDadosEstabelecimentoConta(conta, credores)
      return {
        conta,
        nomeSugerido: info.nome || conta.fornecedor || 'Despesa a identificar',
        docSugerido: info.cnpjCpf,
        temDadosValidos: info.temDadosValidos,
        credorExistenteSugerido: info.credorExistenteSugerido,
        motivoCorrespondencia: info.motivoCorrespondencia,
        selecionado: itensSelecionadosIds.includes(conta.id),
      }
    })
  }, [contasSemCredorComComprovante, credores, itensSelecionadosIds])

  // Itens filtrados pela busca
  const itensFiltrados = useMemo(() => {
    if (!busca.trim()) return itensProcessados
    const q = busca.toLowerCase()
    return itensProcessados.filter(
      (item) =>
        item.conta.descricao.toLowerCase().includes(q) ||
        item.nomeSugerido.toLowerCase().includes(q) ||
        item.docSugerido.toLowerCase().includes(q) ||
        (item.credorExistenteSugerido?.nome_razao_social || '').toLowerCase().includes(q),
    )
  }, [itensProcessados, busca])

  // Contagem de categorias
  const totalComMatchExistente = itensProcessados.filter(
    (i) => i.credorExistenteSugerido !== null,
  ).length
  const totalParaCriarNovo = itensProcessados.filter(
    (i) => !i.credorExistenteSugerido && i.temDadosValidos,
  ).length
  const totalSemDados = itensProcessados.filter((i) => !i.temDadosValidos).length

  // Selecionar/deselecionar tudo
  const toggleSelecionarTodos = () => {
    if (itensSelecionadosIds.length === itensFiltrados.length && itensFiltrados.length > 0) {
      setItensSelecionadosIds([])
    } else {
      // Seleciona todos os filtrados que tenham dados válidos ou match existente
      const validos = itensFiltrados
        .filter((i) => i.credorExistenteSugerido || i.temDadosValidos)
        .map((i) => i.conta.id)
      setItensSelecionadosIds(validos)
    }
  }

  const toggleItem = (id: string) => {
    setItensSelecionadosIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  // Executa o processamento em lote dos itens selecionados
  async function handleProcessarLote() {
    const alvos = itensProcessados.filter((i) => itensSelecionadosIds.includes(i.conta.id))
    if (!alvos.length) {
      toast.warning('Selecione ao menos uma conta para processar em lote.')
      return
    }

    setProcessando(true)
    let sucessoCount = 0
    let falhaCount = 0

    try {
      for (const item of alvos) {
        try {
          if (item.credorExistenteSugerido) {
            // Caso 1: Já existe credor correspondente -> Vincula diretamente
            await vincularCredorAContaPagar(item.conta.id, item.credorExistenteSugerido, usuarioId)
            sucessoCount++
          } else if (item.temDadosValidos) {
            // Caso 2: Não existe -> Cria novo credor com os dados do comprovante e vincula
            const docLimpo = limparDocumento(item.docSugerido)
            const tipoPessoa = docLimpo.length === 11 ? 'pf' : 'pj'
            const novo = await salvarCredor({
              nome_razao_social: item.nomeSugerido.trim(),
              cnpj_cpf: formatarDocumento(docLimpo) || '00.000.000/0000-00',
              tipo_pessoa: tipoPessoa,
              categoria: 'outros',
              status: 'ativo',
              observacoes: `Cadastrado em lote a partir do comprovante da conta "${item.conta.descricao}"`,
            })
            await vincularCredorAContaPagar(item.conta.id, novo, usuarioId)
            sucessoCount++
          }
        } catch (itemErr) {
          console.error(`Erro ao processar conta ${item.conta.id}:`, itemErr)
          falhaCount++
        }
      }

      if (sucessoCount > 0) {
        toast.success(
          `${sucessoCount} conta(s) a pagar regularizada(s) e vinculadas com sucesso aos credores!`,
        )
        setItensSelecionadosIds([])
        await onSuccess()
      }
      if (falhaCount > 0) {
        toast.error(`${falhaCount} conta(s) apresentaram falha ao processar.`)
      }
    } finally {
      setProcessando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-[#FF6A13] shrink-0">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2">
                <span>Vincular e Cadastrar Credores em Lote</span>
                <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-full bg-orange-100 text-[#D65100] border border-orange-200">
                  Limpeza de Histórico
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500">
                Lista de contas a pagar com comprovante/boleto já salvo que ainda não possuem credor
                vinculado oficial.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo em cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs py-1">
          <div className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50">
            <span className="text-[10px] text-neutral-500 font-semibold block">
              Total sem Credor
            </span>
            <span className="text-base font-bold text-neutral-900 font-mono">
              {contasSemCredorComComprovante.length} contas
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
            <span className="text-[10px] text-emerald-800 font-semibold block">
              Match Existente na Base
            </span>
            <span className="text-base font-bold text-emerald-900 font-mono">
              {totalComMatchExistente} contas
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-orange-200 bg-orange-50/50">
            <span className="text-[10px] text-orange-800 font-semibold block">
              Prontos p/ Criar Credor
            </span>
            <span className="text-base font-bold text-orange-900 font-mono">
              {totalParaCriarNovo} contas
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
            <span className="text-[10px] text-amber-800 font-semibold block">
              Dados Incompletos
            </span>
            <span className="text-base font-bold text-amber-900 font-mono">
              {totalSemDados} contas
            </span>
          </div>
        </div>

        {/* Barra de busca e seleção */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por descrição, estabelecimento, CNPJ ou credor..."
              className="pl-8 h-8 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleSelecionarTodos}
              className="h-8 text-xs shrink-0"
            >
              {itensSelecionadosIds.length > 0 &&
              itensSelecionadosIds.length === itensFiltrados.length ? (
                <CheckSquare className="mr-1.5 h-3.5 w-3.5 text-[#FF6A13]" />
              ) : (
                <Square className="mr-1.5 h-3.5 w-3.5 text-neutral-400" />
              )}
              {itensSelecionadosIds.length > 0
                ? `Selecionadas (${itensSelecionadosIds.length})`
                : 'Selecionar Válidas'}
            </Button>
          </div>
        </div>

        {/* Tabela de itens */}
        {contasSemCredorComComprovante.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500 border rounded-lg bg-neutral-50/50">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 mb-2" />
            <p className="font-semibold text-neutral-800">Tudo em dia!</p>
            <p className="text-neutral-500 mt-0.5">
              Todas as contas a pagar com comprovante salvo já possuem credor vinculado.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden max-h-[46vh] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <span className="sr-only">Seleção</span>
                  </th>
                  <th className="px-3 py-2">Conta / Vencimento</th>
                  <th className="px-3 py-2">Estabelecimento Extraído</th>
                  <th className="px-3 py-2">Ação Sugerida</th>
                  <th className="px-3 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {itensFiltrados.map((item) => {
                  const isChecked = itensSelecionadosIds.includes(item.conta.id)
                  const podeProcessarLote = item.credorExistenteSugerido || item.temDadosValidos

                  return (
                    <tr
                      key={item.conta.id}
                      className={`hover:bg-[#FFF6EC]/30 transition ${
                        isChecked ? 'bg-orange-50/40' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={!podeProcessarLote}
                          onClick={() => toggleItem(item.conta.id)}
                          className="text-neutral-500 disabled:opacity-30"
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-[#FF6A13]" />
                          ) : (
                            <Square className="h-4 w-4 text-neutral-300" />
                          )}
                        </button>
                      </td>

                      <td className="px-3 py-2">
                        <div className="space-y-0.5 max-w-[220px]">
                          <span className="font-semibold text-neutral-900 block truncate">
                            {item.conta.descricao}
                          </span>
                          <span className="text-[11px] text-neutral-500 font-mono">
                            {formatDate(item.conta.data_vencimento)} · R${' '}
                            {formatCurrency(item.conta.valor)}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2">
                        <div className="space-y-0.5 max-w-[240px]">
                          <span
                            className="font-medium text-neutral-800 block truncate"
                            title={item.nomeSugerido}
                          >
                            {item.nomeSugerido}
                          </span>
                          {item.docSugerido ? (
                            <span className="text-[10px] text-neutral-500 font-mono block">
                              {item.docSugerido}
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 italic block">
                              CNPJ não lido
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2">
                        {item.credorExistenteSugerido ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Link2 className="h-3 w-3 text-emerald-600" />
                            <span>
                              Vincular a: {item.credorExistenteSugerido.nome_razao_social}
                            </span>
                          </div>
                        ) : item.temDadosValidos ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-50 text-[#D65100] border border-orange-200">
                            <Sparkles className="h-3 w-3 text-[#FF6A13]" />
                            <span>Criar novo credor</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-amber-800 bg-amber-50 border border-amber-200">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                            <span>Revisar leitura individual</span>
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onOpenChange(false)
                            onAbrirIndividual(item.conta)
                          }}
                          className="h-7 text-xs text-[#FF6A13] hover:bg-orange-50 font-semibold"
                        >
                          Abrir ficha
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={processando}
            className="w-full sm:w-auto h-8 text-xs"
          >
            Fechar
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handleProcessarLote}
              disabled={processando || itensSelecionadosIds.length === 0}
              className="w-full sm:w-auto bg-[#FF6A13] hover:bg-[#E85B06] text-white h-8 text-xs font-semibold shadow-sm"
            >
              {processando ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Processando Lote...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Processar Selecionadas ({itensSelecionadosIds.length})
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
