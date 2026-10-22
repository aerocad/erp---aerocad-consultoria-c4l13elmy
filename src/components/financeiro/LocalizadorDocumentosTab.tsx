import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  FileText,
  Barcode,
  ArrowLeftRight,
  Receipt,
  Trash2,
  Undo2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  DollarSign,
  Layers,
  History,
  RotateCcw,
  Sparkles,
  Info,
  ChevronRight,
  X,
  FileDown,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/lib/format'
import { useAuth } from '@/contexts/AuthContext'
import type {
  ContaPagarRecord,
  ContaReceberRecord,
  ParcelaRecord,
  ProjetoRecord,
  ClienteRecord,
  CredorRecord,
  ContaBancariaRecord,
} from '@/types/crm'
import {
  unificarDocumentosFinanceiros,
  excluirDocumentoFinanceiro,
  desfazerExclusaoDocumento,
  buscarHistoricoExclusoesDocumentos,
  type DocumentoFinanceiroItem,
  type TipoDocumentoFinanceiro,
  type HistoricoExclusaoItem,
} from '@/services/localizadorDocumentosService'

export interface LocalizadorDocumentosTabProps {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  projetos: ProjetoRecord[]
  clientes: ClienteRecord[]
  credores: CredorRecord[]
  contasBancarias: ContaBancariaRecord[]
  notasOrfas?: any[]
  userRole?: string
  canWrite: boolean
  onReloadAll: () => Promise<void>
}

export function LocalizadorDocumentosTab({
  parcelas,
  contasPagar,
  contasReceber,
  projetos,
  clientes,
  credores,
  contasBancarias,
  notasOrfas = [],
  userRole,
  canWrite,
  onReloadAll,
}: LocalizadorDocumentosTabProps) {
  const { user } = useAuth()
  const isAdmin =
    user?.role === 'admin' || (Array.isArray(user?.roles) && user?.roles.includes('admin'))

  // Filtros de busca
  const [termoBusca, setTermoBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<TipoDocumentoFinanceiro>('todos')
  const [contaPjFiltro, setContaPjFiltro] = useState('todas')
  const [periodoFiltro, setPeriodoFiltro] = useState('todos')
  const [ordemValor, setOrdemValor] = useState<'recente' | 'maior_valor' | 'menor_valor'>('recente')

  // Documento selecionado para detalhamento
  const [docSelecionado, setDocSelecionado] = useState<DocumentoFinanceiroItem | null>(null)

  // Modal de Exclusão (Admin-only)
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false)
  const [docParaExcluir, setDocParaExcluir] = useState<DocumentoFinanceiroItem | null>(null)
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [isExcluindo, setIsExcluindo] = useState(false)

  // Histórico de exclusões & Desfazer
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [historicoLista, setHistoricoLista] = useState<HistoricoExclusaoItem[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [desfazendoId, setDesfazendoId] = useState<string | null>(null)

  // Mapas rápidos de consulta
  const projetosMap = useMemo(() => new Map(projetos.map((p) => [p.id, p])), [projetos])
  const clientesMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes])
  const credoresMap = useMemo(() => new Map(credores.map((c) => [c.id, c])), [credores])
  const contasBancariasMap = useMemo(
    () => new Map(contasBancarias.map((cb) => [cb.id, cb])),
    [contasBancarias],
  )

  // Todos os documentos unificados
  const todosDocumentos = useMemo(() => {
    return unificarDocumentosFinanceiros({
      parcelas,
      contasPagar,
      contasReceber,
      notasOrfas,
      projetosMap,
      clientesMap,
      credoresMap,
      contasBancariasMap,
    })
  }, [
    parcelas,
    contasPagar,
    contasReceber,
    notasOrfas,
    projetosMap,
    clientesMap,
    credoresMap,
    contasBancariasMap,
  ])

  // Lista filtrada
  const documentosFiltrados = useMemo(() => {
    const termo = termoBusca.trim().toLowerCase()

    return todosDocumentos
      .filter((doc) => {
        // 1. Tipo
        if (tipoFiltro !== 'todos' && doc.tipo !== tipoFiltro) {
          return false
        }

        // 2. Conta PJ
        if (contaPjFiltro !== 'todas' && doc.contaBancariaId !== contaPjFiltro) {
          return false
        }

        // 3. Período
        if (periodoFiltro !== 'todos' && doc.dataReferencia) {
          const anoRef = doc.dataReferencia.slice(0, 4)
          if (anoRef !== periodoFiltro) {
            return false
          }
        }

        // 4. Busca por texto livre (número da nota, código de barras, favorecido, tomador, descrição, projeto)
        if (termo) {
          const matchIdentificador = doc.identificador.toLowerCase().includes(termo)
          const matchDescricao = doc.descricao.toLowerCase().includes(termo)
          const matchNumero = (doc.numeroDoc || '').toLowerCase().includes(termo)
          const matchBarras = (doc.codigoBarras || '').toLowerCase().includes(termo)
          const matchEntidade = doc.entidadeNome.toLowerCase().includes(termo)
          const matchCnpj = (doc.entidadeCnpjCpf || '').toLowerCase().includes(termo)
          const matchProjeto = (doc.projetoNumero || '').toLowerCase().includes(termo)
          const matchPlano = (doc.planoContasNome || '').toLowerCase().includes(termo)

          if (
            !matchIdentificador &&
            !matchDescricao &&
            !matchNumero &&
            !matchBarras &&
            !matchEntidade &&
            !matchCnpj &&
            !matchProjeto &&
            !matchPlano
          ) {
            return false
          }
        }

        return true
      })
      .sort((a, b) => {
        if (ordemValor === 'maior_valor') {
          return b.valor - a.valor
        }
        if (ordemValor === 'menor_valor') {
          return a.valor - b.valor
        }
        // Mais recente
        const dtA = a.dataReferencia || ''
        const dtB = b.dataReferencia || ''
        return dtB.localeCompare(dtA)
      })
  }, [todosDocumentos, tipoFiltro, contaPjFiltro, periodoFiltro, termoBusca, ordemValor])

  // Anos disponíveis para filtro
  const anosDisponiveis = useMemo(() => {
    const setAnos = new Set<string>()
    todosDocumentos.forEach((d) => {
      if (d.dataReferencia && d.dataReferencia.length >= 4) {
        const ano = d.dataReferencia.slice(0, 4)
        if (/^\d{4}$/.test(ano)) setAnos.add(ano)
      }
    })
    return Array.from(setAnos).sort().reverse()
  }, [todosDocumentos])

  // Contagens por tipo
  const contagens = useMemo(() => {
    return {
      total: todosDocumentos.length,
      notas: todosDocumentos.filter((d) => d.tipo === 'nota_fiscal').length,
      boletos: todosDocumentos.filter((d) => d.tipo === 'boleto').length,
      comprovantes: todosDocumentos.filter((d) => d.tipo === 'comprovante').length,
    }
  }, [todosDocumentos])

  // Carregar histórico recente de exclusões
  const recarregarHistorico = useCallback(async () => {
    setCarregandoHistorico(true)
    try {
      const res = await buscarHistoricoExclusoesDocumentos()
      setHistoricoLista(res)
    } finally {
      setCarregandoHistorico(false)
    }
  }, [])

  useEffect(() => {
    if (historicoAberto) {
      void recarregarHistorico()
    }
  }, [historicoAberto, recarregarHistorico])

  // Abertura do modal de exclusão
  const handleSolicitarExclusao = (doc: DocumentoFinanceiroItem) => {
    if (!isAdmin) {
      toast.error('Apenas administradores (Cleyton) possuem permissão para excluir documentos.')
      return
    }
    setDocParaExcluir(doc)
    setConfirmacaoTexto('')
    setJustificativa('')
    setModalExcluirAberto(true)
  }

  // Confirmação de exclusão
  const handleConfirmarExclusao = async () => {
    if (!docParaExcluir) return

    if (confirmacaoTexto.trim().toUpperCase() !== 'EXCLUIR') {
      toast.error('Digite a palavra exata "EXCLUIR" em maiúsculas para confirmar.')
      return
    }

    setIsExcluindo(true)
    try {
      const res = await excluirDocumentoFinanceiro({
        doc: docParaExcluir,
        palavraChave: confirmacaoTexto,
        justificativa,
      })

      toast.success(res.mensagem || 'Documento excluído com sucesso!', {
        description:
          'Um retrato completo foi gravado na auditoria e pode ser desfeito a qualquer momento.',
        action:
          res.auditId && res.auditId !== 'local_orfa'
            ? {
                label: 'Desfazer agora',
                onClick: () => void handleDesfazer(res.auditId),
              }
            : undefined,
        duration: 8000,
      })

      setModalExcluirAberto(false)
      setDocParaExcluir(null)
      if (docSelecionado?.id === docParaExcluir.id) {
        setDocSelecionado(null)
      }

      await onReloadAll()
      void recarregarHistorico()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Falha ao excluir documento: ' + msg)
    } finally {
      setIsExcluindo(false)
    }
  }

  // Ação de Desfazer
  const handleDesfazer = async (auditId: string) => {
    if (!isAdmin) {
      toast.error('Apenas administradores podem desfazer exclusões.')
      return
    }

    setDesfazendoId(auditId)
    try {
      const res = await desfazerExclusaoDocumento(auditId)
      toast.success(res.mensagem || 'Exclusão desfeita com sucesso! Documento restaurado.')
      await onReloadAll()
      void recarregarHistorico()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao desfazer exclusão: ' + msg)
    } finally {
      setDesfazendoId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho do Localizador com Identidade AEROCAD */}
      <div className="rounded-2xl border-2 border-[#FFD2B3] bg-gradient-to-r from-[#FFF9F5] via-white to-[#FFF4EC] p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF6A13] text-white shadow-xs">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-neutral-900">
                  Localizador de Documentos Financeiros
                </h2>
                <Badge
                  variant="outline"
                  className="border-[#FFB787] bg-[#FFF6EC] text-[#D65100] text-[10px] font-bold"
                >
                  NFS-e · Boletos · Comprovantes
                </Badge>
              </div>
              <p className="text-xs text-neutral-600 mt-0.5">
                Pesquise, consulte vínculos e exclua com segurança qualquer nota fiscal, boleto
                bancário ou comprovante de quitação com capacidade de desfazer imediato.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setHistoricoAberto(true)
                void recarregarHistorico()
              }}
              className="text-xs border-neutral-300 text-neutral-700 hover:bg-neutral-100 gap-1.5"
            >
              <History className="h-3.5 w-3.5 text-[#FF6A13]" />
              Histórico de Exclusões & Rollback
            </Button>
          </div>
        </div>

        {/* Barra de Filtros Rápidos */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-3 border-t border-[#FFE2CC]">
          {/* Campo de Busca Texto */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              type="text"
              placeholder="Buscar por nº da nota, código de barras, tomador, fornecedor..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="pl-9 h-9 text-xs bg-white"
            />
            {termoBusca && (
              <button
                type="button"
                onClick={() => setTermoBusca('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtro por Tipo */}
          <Select
            value={tipoFiltro}
            onValueChange={(val) => setTipoFiltro(val as TipoDocumentoFinanceiro)}
          >
            <SelectTrigger className="h-9 text-xs bg-white">
              <SelectValue placeholder="Tipo de Documento" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="todos">Todos os Tipos ({contagens.total})</SelectItem>
              <SelectItem value="nota_fiscal">Notas Fiscais NFS-e ({contagens.notas})</SelectItem>
              <SelectItem value="boleto">Boletos Bancários ({contagens.boletos})</SelectItem>
              <SelectItem value="comprovante">
                Comprovantes & Recibos ({contagens.comprovantes})
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro por Conta PJ */}
          <Select value={contaPjFiltro} onValueChange={setContaPjFiltro}>
            <SelectTrigger className="h-9 text-xs bg-white">
              <SelectValue placeholder="Conta Bancária PJ" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="todas">Todas as Contas PJ</SelectItem>
              {contasBancarias.map((cb) => (
                <SelectItem key={cb.id} value={cb.id}>
                  {cb.apelido} {cb.banco_nome ? `(${cb.banco_nome})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro por Período / Ano */}
          <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
            <SelectTrigger className="h-9 text-xs bg-white">
              <SelectValue placeholder="Ano de Referência" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="todos">Todos os Anos</SelectItem>
              {anosDisponiveis.map((ano) => (
                <SelectItem key={ano} value={ano}>
                  Ano {ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resumo da busca */}
        <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] text-neutral-500 gap-2">
          <div className="flex items-center gap-3">
            <span>
              Encontrados <strong className="text-neutral-900">{documentosFiltrados.length}</strong>{' '}
              documento(s)
            </span>
            <span className="text-neutral-300">•</span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-sky-600" />{' '}
              {documentosFiltrados.filter((d) => d.tipo === 'nota_fiscal').length} notas
            </span>
            <span className="flex items-center gap-1">
              <Barcode className="h-3 w-3 text-amber-600" />{' '}
              {documentosFiltrados.filter((d) => d.tipo === 'boleto').length} boletos
            </span>
            <span className="flex items-center gap-1">
              <ArrowLeftRight className="h-3 w-3 text-emerald-600" />{' '}
              {documentosFiltrados.filter((d) => d.tipo === 'comprovante').length} comprovantes
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>Ordenar por:</span>
            <button
              type="button"
              onClick={() => setOrdemValor('recente')}
              className={`px-2 py-0.5 rounded transition ${ordemValor === 'recente' ? 'bg-[#FF6A13] text-white font-bold' : 'hover:bg-neutral-200'}`}
            >
              Data Recente
            </button>
            <button
              type="button"
              onClick={() => setOrdemValor('maior_valor')}
              className={`px-2 py-0.5 rounded transition ${ordemValor === 'maior_valor' ? 'bg-[#FF6A13] text-white font-bold' : 'hover:bg-neutral-200'}`}
            >
              Maior Valor
            </button>
            <button
              type="button"
              onClick={() => setOrdemValor('menor_valor')}
              className={`px-2 py-0.5 rounded transition ${ordemValor === 'menor_valor' ? 'bg-[#FF6A13] text-white font-bold' : 'hover:bg-neutral-200'}`}
            >
              Menor Valor
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Listagem e Painel de Detalhes Lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Lista de Documentos (Colunas 7 ou 8) */}
        <div className={docSelecionado ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'}>
          {documentosFiltrados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center text-neutral-500">
              <Search className="mx-auto h-8 w-8 text-neutral-300 mb-2" />
              <p className="font-semibold text-neutral-700">
                Nenhum documento financeiro encontrado
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Tente alterar os termos de busca ou selecionar outro tipo no filtro.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white shadow-2xs divide-y divide-neutral-100 overflow-hidden">
              {documentosFiltrados.map((item) => {
                const isSelected = docSelecionado?.id === item.id
                const isNota = item.tipo === 'nota_fiscal'
                const isBoleto = item.tipo === 'boleto'
                const isComprovante = item.tipo === 'comprovante'

                return (
                  <div
                    key={item.id}
                    onClick={() => setDocSelecionado(item)}
                    className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition cursor-pointer hover:bg-neutral-50/80 ${
                      isSelected ? 'bg-orange-50/60 border-l-4 border-l-[#FF6A13]' : ''
                    }`}
                  >
                    {/* Lado Esquerdo: Ícone + Identificação + Vínculos */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                          isNota
                            ? 'bg-sky-50 border-sky-200 text-sky-700'
                            : isBoleto
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}
                      >
                        {isNota ? (
                          <FileText className="h-5 w-5" />
                        ) : isBoleto ? (
                          <Barcode className="h-5 w-5" />
                        ) : (
                          <ArrowLeftRight className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-neutral-900 truncate">
                            {item.identificador}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] font-semibold ${
                              isNota
                                ? 'bg-sky-100 text-sky-800'
                                : isBoleto
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.subtipo}
                          </Badge>
                          {item.status && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 capitalize">
                              {item.status}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-neutral-600 truncate max-w-md">
                          {item.descricao}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                          <span className="flex items-center gap-1 text-neutral-700 font-medium truncate max-w-[200px]">
                            <Building2 className="h-3 w-3 text-neutral-400 shrink-0" />
                            {item.entidadeNome}
                          </span>

                          {item.projetoNumero && (
                            <span className="rounded bg-neutral-100 text-neutral-700 px-1.5 py-0.2 text-[10px] font-semibold border border-neutral-200">
                              Proj: {item.projetoNumero}
                            </span>
                          )}

                          {item.contaBancariaNome && (
                            <span className="rounded bg-orange-50 text-[#D65100] px-1.5 py-0.2 text-[10px] font-medium border border-[#FFD2B3]">
                              {item.contaBancariaNome}
                            </span>
                          )}

                          {item.dataReferencia && (
                            <span className="flex items-center gap-0.5 text-neutral-400">
                              <Calendar className="h-3 w-3" />
                              {formatDate(item.dataReferencia)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito: Valor + Ação */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        <span className="block mono-value font-bold text-sm sm:text-base text-neutral-900">
                          {formatCurrency(item.valor)}
                        </span>
                        <span className="block text-[10px] text-neutral-400 truncate">
                          {item.origemModulo}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {item.arquivoUrl && (
                          <a
                            href={item.arquivoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition"
                            title="Visualizar arquivo do documento"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}

                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSolicitarExclusao(item)
                            }}
                            className="h-8 w-8 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Excluir documento (Admin)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        <ChevronRight
                          className={`h-4 w-4 text-neutral-400 transition ${isSelected ? 'rotate-90 text-[#FF6A13]' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Painel Lateral de Detalhes do Documento Clicado */}
        {docSelecionado && (
          <div className="lg:col-span-5 xl:col-span-4 space-y-3">
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      docSelecionado.tipo === 'nota_fiscal'
                        ? 'bg-sky-100 text-sky-700'
                        : docSelecionado.tipo === 'boleto'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {docSelecionado.tipo === 'nota_fiscal' ? (
                      <FileText className="h-4 w-4" />
                    ) : docSelecionado.tipo === 'boleto' ? (
                      <Barcode className="h-4 w-4" />
                    ) : (
                      <ArrowLeftRight className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900 leading-tight">
                      {docSelecionado.identificador}
                    </h3>
                    <span className="text-[10px] text-neutral-500 font-medium">
                      {docSelecionado.subtipo}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDocSelecionado(null)}
                  className="h-7 w-7 p-0 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Informações Principais */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-neutral-50">
                  <span className="text-neutral-500 font-medium">Valor:</span>
                  <span className="mono-value font-bold text-neutral-900">
                    {formatCurrency(docSelecionado.valor)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-neutral-50">
                  <span className="text-neutral-500 font-medium">Data Referência:</span>
                  <span className="font-semibold text-neutral-800">
                    {formatDate(docSelecionado.dataReferencia)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-neutral-50">
                  <span className="text-neutral-500 font-medium">Favorecido / Tomador:</span>
                  <span className="font-semibold text-neutral-800 text-right truncate max-w-[180px]">
                    {docSelecionado.entidadeNome}
                  </span>
                </div>

                {docSelecionado.entidadeCnpjCpf && (
                  <div className="flex justify-between py-1 border-b border-neutral-50">
                    <span className="text-neutral-500 font-medium">CNPJ / CPF:</span>
                    <span className="font-mono text-neutral-700">
                      {docSelecionado.entidadeCnpjCpf}
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-1 border-b border-neutral-50">
                  <span className="text-neutral-500 font-medium">Origem dos Dados:</span>
                  <span className="font-medium text-neutral-700">
                    {docSelecionado.origemModulo}
                  </span>
                </div>

                {docSelecionado.projetoNumero && (
                  <div className="flex justify-between py-1 border-b border-neutral-50">
                    <span className="text-neutral-500 font-medium">Projeto Vinculado:</span>
                    <span className="font-bold text-[#FF6A13]">{docSelecionado.projetoNumero}</span>
                  </div>
                )}

                {docSelecionado.contaBancariaNome && (
                  <div className="flex justify-between py-1 border-b border-neutral-50">
                    <span className="text-neutral-500 font-medium">Conta Bancária PJ:</span>
                    <span className="font-semibold text-neutral-800">
                      {docSelecionado.contaBancariaNome}
                    </span>
                  </div>
                )}

                {docSelecionado.codigoBarras && (
                  <div className="py-1 border-b border-neutral-50 space-y-0.5">
                    <span className="text-neutral-500 font-medium block">
                      Linha Digitável / Código:
                    </span>
                    <span className="font-mono text-[11px] text-neutral-700 break-all block bg-neutral-50 p-1.5 rounded">
                      {docSelecionado.codigoBarras}
                    </span>
                  </div>
                )}

                {docSelecionado.planoContasNome && (
                  <div className="flex justify-between py-1 border-b border-neutral-50">
                    <span className="text-neutral-500 font-medium">Classificação Contábil:</span>
                    <span className="font-medium text-neutral-700 text-right">
                      {docSelecionado.planoContasCodigo
                        ? `${docSelecionado.planoContasCodigo} - `
                        : ''}
                      {docSelecionado.planoContasNome}
                    </span>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="pt-2 flex flex-col gap-2">
                {docSelecionado.arquivoUrl && (
                  <a
                    href={docSelecionado.arquivoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-[#FF6A13]" />
                    Visualizar Anexo Completo
                  </a>
                )}

                {isAdmin ? (
                  <Button
                    variant="outline"
                    onClick={() => handleSolicitarExclusao(docSelecionado)}
                    className="w-full text-xs font-bold text-rose-700 border-rose-200 hover:bg-rose-50 hover:text-rose-800 gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir Este Documento (Admin)
                  </Button>
                ) : (
                  <p className="text-[10px] text-neutral-400 text-center italic">
                    Exclusão restrita a administradores do sistema.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Exclusão (Admin-Only com Palavra-chave EXCLUIR) */}
      <Dialog open={modalExcluirAberto} onOpenChange={setModalExcluirAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <Trash2 className="h-5 w-5" />
              Excluir Documento Financeiro
            </DialogTitle>
          </DialogHeader>

          {docParaExcluir && (
            <div className="space-y-4 py-2 text-xs">
              {/* Alerta de Ação e Integridade */}
              <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3.5 space-y-2 text-rose-950">
                <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  Verificação de Vínculos e Preservação
                </div>
                <p className="leading-relaxed">
                  Você está prestes a excluir o documento{' '}
                  <strong className="text-neutral-900">{docParaExcluir.identificador}</strong> (
                  {docParaExcluir.subtipo}), no valor de{' '}
                  <strong className="mono-value text-rose-800">
                    {formatCurrency(docParaExcluir.valor)}
                  </strong>
                  .
                </p>

                <div className="rounded bg-white/90 p-2.5 border border-rose-200 space-y-1.5 text-neutral-800 text-[11px]">
                  <p className="font-semibold text-rose-900">Como o CRM tratará os vínculos:</p>
                  <ul className="list-disc pl-4 space-y-1 text-neutral-700">
                    {docParaExcluir.colecaoOrigem === 'parcelas' ? (
                      <>
                        <li>
                          <strong>Parcela contratual:</strong> Os vínculos fiscais da nota são
                          removidos e a parcela é <em>reaberta como pendente</em>, garantindo que o
                          saldo faturável permaneça rastreável sem deixar órfãos.
                        </li>
                        <li>
                          <strong>Contabilidade:</strong> O histórico de auditoria grava um snapshot
                          completo para permitir desfazer e religar a qualquer momento.
                        </li>
                      </>
                    ) : docParaExcluir.colecaoOrigem === 'contas_pagar' ? (
                      <>
                        <li>
                          <strong>Lançamento de despesa:</strong> O registro é excluído com snapshot
                          integral (fornecedor, valores, rateio, conta PJ). A transação de extrato
                          bancário correspondente <em>não é apagada</em> — apenas desvinculada.
                        </li>
                      </>
                    ) : (
                      <>
                        <li>
                          <strong>Receita avulsa:</strong> O documento e anexos são removidos com
                          preservação integral do histórico no log de auditoria reversível.
                        </li>
                      </>
                    )}
                    <li>
                      <strong>Auditoria permanente:</strong> Registrado usuário (
                      {user?.name || 'Admin'}), data/hora e retrato dos dados para reconstituição.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Justificativa Opcional */}
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">
                  Justificativa da exclusão (opcional):
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Emissão cancelada na prefeitura, boleto substituído..."
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              {/* Digitação Obrigatória da Palavra EXCLUIR */}
              <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-3 space-y-2">
                <label className="font-bold text-neutral-800 block text-xs">
                  Para autorizar, digite a palavra{' '}
                  <span className="font-mono text-rose-600 font-black">EXCLUIR</span> abaixo:
                </label>
                <Input
                  type="text"
                  placeholder="EXCLUIR"
                  value={confirmacaoTexto}
                  onChange={(e) => setConfirmacaoTexto(e.target.value)}
                  className="font-mono uppercase font-bold tracking-wider text-rose-600 bg-white"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setModalExcluirAberto(false)}
              disabled={isExcluindo}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleConfirmarExclusao()}
              disabled={isExcluindo || confirmacaoTexto.trim().toUpperCase() !== 'EXCLUIR'}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isExcluindo ? 'Excluindo...' : 'Confirmar Exclusão Definitiva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drawer / Modal de Histórico de Exclusões e Desfazer (Rollback) */}
      <Dialog open={historicoAberto} onOpenChange={setHistoricoAberto}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-neutral-900">
              <History className="h-5 w-5 text-[#FF6A13]" />
              Histórico de Exclusões & Rollback (Desfazer)
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 text-xs">
            <p className="text-neutral-500">
              Consulte exclusões recentes de documentos financeiros e restaure qualquer item para o
              estado anterior com reconstituição dos vínculos fiscais e contratuais.
            </p>

            {carregandoHistorico ? (
              <div className="p-8 text-center text-neutral-400">Carregando auditoria...</div>
            ) : historicoLista.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-200 p-8 text-center text-neutral-400">
                Nenhum registro de exclusão recente encontrado na auditoria.
              </div>
            ) : (
              <div className="space-y-2.5">
                {historicoLista.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      item.desfeito
                        ? 'border-neutral-200 bg-neutral-50/50 opacity-70'
                        : 'border-orange-200 bg-orange-50/20'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-neutral-900 text-xs">{item.descricao}</span>
                        {item.desfeito ? (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-100 text-emerald-800 text-[10px]"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Restaurado / Desfeito
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-rose-300 text-rose-700 bg-rose-50 text-[10px]"
                          >
                            Excluído
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                        <span>
                          Por: <strong className="text-neutral-700">{item.usuarioNome}</strong>
                        </span>
                        <span>•</span>
                        <span>{formatDate(item.created)}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-neutral-400">
                          Audit: {item.id}
                        </span>
                      </div>
                    </div>

                    {!item.desfeito && isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDesfazer(item.id)}
                        disabled={desfazendoId === item.id}
                        className="shrink-0 text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1.5"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        {desfazendoId === item.id ? 'Restaurando...' : 'Desfazer Exclusão'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-neutral-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoricoAberto(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
