import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Layers,
  Link as LinkIcon,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { formatCurrency, formatDate } from '@/lib/format'
import {
  executarGravacaoProjetosExtraidos,
  type ProgressoExtracaoProjetos,
  type ResultadoExecucaoExtracaoProjetos,
} from '@/services/projetoExtratorExecutor'
import {
  analisarNotasOrfasParaExtracaoProjetos,
  type AcaoProjetoSugerido,
  type SugestaoProjetoExtraido,
} from '@/services/projetoExtratorNfse'
import type { NfseDadoExtraido } from '@/services/nfseParser'
import type { ClienteRecord, ProjetoRecord } from '@/types/crm'

export interface ExtrairProjetosModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notasOrfas: NfseDadoExtraido[]
  clientesExistentes: ClienteRecord[]
  projetosExistentes: ProjetoRecord[]
  onConcluido: (resultado: ResultadoExecucaoExtracaoProjetos) => void
}

export function ExtrairProjetosModal({
  open,
  onOpenChange,
  notasOrfas,
  clientesExistentes,
  projetosExistentes,
  onConcluido,
}: ExtrairProjetosModalProps) {
  const [sugestoes, setSugestoes] = useState<SugestaoProjetoExtraido[]>([])
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const [isProcessando, setIsProcessando] = useState(false)
  const [progresso, setProgresso] = useState<ProgressoExtracaoProjetos | null>(null)
  const [filtroAcao, setFiltroAcao] = useState<'todas' | 'criar_projeto' | 'vincular_existente'>(
    'todas',
  )

  // Gerar sugestões ao abrir o modal
  useEffect(() => {
    if (open && notasOrfas.length > 0) {
      const res = analisarNotasOrfasParaExtracaoProjetos(
        notasOrfas,
        clientesExistentes,
        projetosExistentes,
      )
      setSugestoes(res)
      // Iniciar todos expandidos por padrão
      const exp: Record<string, boolean> = {}
      res.forEach((s) => {
        exp[s.idSugestao] = true
      })
      setExpandidos(exp)
    }
  }, [open, notasOrfas, clientesExistentes, projetosExistentes])

  const toggleExpandir = (id: string) => {
    setExpandidos((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleToggleSelecionado = (idSugestao: string) => {
    setSugestoes((prev) =>
      prev.map((s) => (s.idSugestao === idSugestao ? { ...s, selecionado: !s.selecionado } : s)),
    )
  }

  const handleMudarAcao = (idSugestao: string, acao: AcaoProjetoSugerido) => {
    setSugestoes((prev) =>
      prev.map((s) => {
        if (s.idSugestao !== idSugestao) return s
        return {
          ...s,
          acao,
          // Se mudou para vincular existente e não tinha projeto destino, atribui o primeiro projeto do cliente ou o sugerido
          projetoExistenteIdDestino:
            acao === 'vincular_existente'
              ? s.projetoExistenteIdDestino ||
                s.projetoExistenteSugerido?.id ||
                projetosExistentes.find((p) => p.cliente === s.clienteIdSugerido)?.id ||
                projetosExistentes[0]?.id
              : undefined,
        }
      }),
    )
  }

  const handleMudarProjetoDestino = (idSugestao: string, projetoId: string) => {
    setSugestoes((prev) =>
      prev.map((s) =>
        s.idSugestao === idSugestao ? { ...s, projetoExistenteIdDestino: projetoId } : s,
      ),
    )
  }

  const handleMudarNome = (idSugestao: string, nome: string) => {
    setSugestoes((prev) =>
      prev.map((s) => (s.idSugestao === idSugestao ? { ...s, nomeSugerido: nome } : s)),
    )
  }

  const handleMudarTrilha = (idSugestao: string, trilha: 'opea' | 'registro' | 'demais') => {
    setSugestoes((prev) =>
      prev.map((s) => (s.idSugestao === idSugestao ? { ...s, trilhaSugerida: trilha } : s)),
    )
  }

  // Contagens
  const totais = useMemo(() => {
    const selecionadas = sugestoes.filter((s) => s.selecionado && s.acao !== 'ignorar')
    const criar = selecionadas.filter((s) => s.acao === 'criar_projeto').length
    const vincular = selecionadas.filter((s) => s.acao === 'vincular_existente').length
    const notasQtd = selecionadas.reduce((acc, s) => acc + s.notas.length, 0)
    const valorTotal = selecionadas.reduce((acc, s) => acc + s.valorTotalNotas, 0)
    return { selecionadas: selecionadas.length, criar, vincular, notasQtd, valorTotal }
  }, [sugestoes])

  const sugestoesFiltradas = useMemo(() => {
    if (filtroAcao === 'todas') return sugestoes
    return sugestoes.filter((s) => s.acao === filtroAcao)
  }, [sugestoes, filtroAcao])

  const handleExecutar = async () => {
    const aProcessar = sugestoes.filter((s) => s.selecionado && s.acao !== 'ignorar')
    if (aProcessar.length === 0) {
      toast.error('Nenhuma sugestão selecionada para processar')
      return
    }

    setIsProcessando(true)
    setProgresso({
      fase: 'preparando',
      mensagem: 'Iniciando extração e vinculação de projetos...',
      totalEtapas: aProcessar.length,
      etapaAtual: 0,
    })

    try {
      const resultado = await executarGravacaoProjetosExtraidos(sugestoes, (prog) => {
        setProgresso(prog)
      })

      if (resultado.erros.length > 0) {
        toast.warning(
          `Processo concluído com avisos: ${resultado.projetosCriados} projeto(s) criado(s), ${resultado.projetosVinculados} vinculado(s), ${resultado.erros.length} erro(s).`,
        )
      } else {
        toast.success(
          `Extração concluída: ${resultado.projetosCriados} projeto(s) criado(s), ${resultado.projetosVinculados} vinculado(s) e ${resultado.notasProcessadas} nota(s) associada(s)!`,
        )
      }

      onConcluido(resultado)
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Falha ao executar extração de projetos: ' + msg)
    } finally {
      setIsProcessando(false)
      setProgresso(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={isProcessando ? undefined : onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF2E8] text-[#FF6A13]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-bold text-[#1F1F1F]">
                Extrair Projetos a partir das Notas Fiscais
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500">
                Análise inteligente das notas órfãs agrupadas por tomador. Identifica menções de
                projetos (AAAA-NNN), propostas (PC/PT) ou discriminação de serviços.
              </DialogDescription>
            </div>
          </div>

          {/* Barra de resumo */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
            <div className="rounded-lg bg-white p-2 border">
              <span className="text-[10px] text-neutral-500 uppercase font-bold block">
                Grupos / Projetos
              </span>
              <span className="font-bold text-sm text-[#333]">{sugestoes.length} sugerido(s)</span>
            </div>
            <div className="rounded-lg bg-white p-2 border">
              <span className="text-[10px] text-neutral-500 uppercase font-bold block">
                A Criar / Vincular
              </span>
              <span className="font-bold text-sm text-[#FF6A13]">
                {totais.criar} novos / {totais.vincular} vinc.
              </span>
            </div>
            <div className="rounded-lg bg-white p-2 border">
              <span className="text-[10px] text-neutral-500 uppercase font-bold block">
                NFS-e Vinculadas
              </span>
              <span className="font-bold text-sm text-neutral-700">{totais.notasQtd} nota(s)</span>
            </div>
            <div className="rounded-lg bg-white p-2 border">
              <span className="text-[10px] text-neutral-500 uppercase font-bold block">
                Faturamento Total
              </span>
              <span className="mono-value font-bold text-sm text-emerald-700">
                {formatCurrency(totais.valorTotal)}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Filtros e lista */}
        <div className="p-4 border-b bg-white flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 font-semibold">Filtrar por ação:</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={filtroAcao === 'todas' ? 'default' : 'outline'}
                onClick={() => setFiltroAcao('todas')}
                className={`h-7 text-xs ${filtroAcao === 'todas' ? 'bg-[#FF6A13] hover:bg-[#E85B06]' : ''}`}
              >
                Todas ({sugestoes.length})
              </Button>
              <Button
                size="sm"
                variant={filtroAcao === 'criar_projeto' ? 'default' : 'outline'}
                onClick={() => setFiltroAcao('criar_projeto')}
                className={`h-7 text-xs ${filtroAcao === 'criar_projeto' ? 'bg-[#FF6A13] hover:bg-[#E85B06]' : ''}`}
              >
                Criar Projeto ({sugestoes.filter((s) => s.acao === 'criar_projeto').length})
              </Button>
              <Button
                size="sm"
                variant={filtroAcao === 'vincular_existente' ? 'default' : 'outline'}
                onClick={() => setFiltroAcao('vincular_existente')}
                className={`h-7 text-xs ${filtroAcao === 'vincular_existente' ? 'bg-[#FF6A13] hover:bg-[#E85B06]' : ''}`}
              >
                Vincular a Existente (
                {sugestoes.filter((s) => s.acao === 'vincular_existente').length})
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-neutral-600"
              onClick={() => {
                const todas = sugestoes.every((s) => s.selecionado)
                setSugestoes((prev) => prev.map((s) => ({ ...s, selecionado: !todas })))
              }}
            >
              {sugestoes.every((s) => s.selecionado) ? 'Desmarcar todas' : 'Marcar todas'}
            </Button>
          </div>
        </div>

        {/* Progresso de Execução */}
        {progresso && (
          <div className="p-4 bg-orange-50 border-b border-orange-200 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-[#D65100] flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {progresso.mensagem}
              </span>
              <span className="font-mono text-[#D65100]">
                {progresso.etapaAtual} de {progresso.totalEtapas}
              </span>
            </div>
            <div className="h-2 rounded bg-orange-200 overflow-hidden">
              <div
                className="h-full bg-[#FF6A13] transition-all duration-300"
                style={{
                  width: `${
                    progresso.totalEtapas > 0
                      ? (progresso.etapaAtual / progresso.totalEtapas) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Lista de Sugestões com Checkboxes e Configurações */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sugestoesFiltradas.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-500">
              Nenhuma sugestão encontrada para o filtro selecionado.
            </div>
          ) : (
            sugestoesFiltradas.map((sugestao) => {
              const expandido = Boolean(expandidos[sugestao.idSugestao])
              return (
                <div
                  key={sugestao.idSugestao}
                  className={`rounded-xl border transition ${
                    sugestao.selecionado
                      ? 'border-neutral-300 bg-white shadow-sm'
                      : 'border-neutral-200 bg-neutral-50/70 opacity-60'
                  }`}
                >
                  <div className="p-3.5 flex items-start gap-3">
                    <Checkbox
                      checked={sugestao.selecionado}
                      onCheckedChange={() => handleToggleSelecionado(sugestao.idSugestao)}
                      className="mt-1"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {sugestao.numeroProjetoSugerido ? (
                            <span className="mono-value font-bold text-sm text-[#FF6A13] bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                              {sugestao.numeroProjetoSugerido}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                              Novo AAAA-NNN
                            </span>
                          )}
                          <span className="font-bold text-sm text-[#333] truncate">
                            {sugestao.tomadorRazao}
                          </span>
                          <CrmBadge
                            tone={
                              sugestao.trilhaSugerida === 'registro'
                                ? 'green'
                                : sugestao.trilhaSugerida === 'opea'
                                  ? 'orange'
                                  : 'gray'
                            }
                          >
                            {sugestao.trilhaSugerida.toUpperCase()}
                          </CrmBadge>
                          {sugestao.clienteStatus === 'existente' ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                              Cliente já cadastrado
                            </span>
                          ) : (
                            <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
                              Novo cliente
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="mono-value font-bold text-sm text-[#1F1F1F]">
                            {formatCurrency(sugestao.valorTotalNotas)}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleExpandir(sugestao.idSugestao)}
                            className="text-neutral-400 hover:text-neutral-700 p-1"
                          >
                            {expandido ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="mt-1 text-xs text-neutral-600 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-[#FF6A13] shrink-0" />
                        <span>{sugestao.motivoSugestao}</span>
                      </p>

                      {/* Configuração da Ação: Criar Projeto vs Vincular Existente vs Ignorar */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t">
                        <div className="flex rounded-lg border p-0.5 bg-neutral-100 text-xs">
                          <button
                            type="button"
                            onClick={() => handleMudarAcao(sugestao.idSugestao, 'criar_projeto')}
                            className={`px-2.5 py-1 rounded font-semibold transition ${
                              sugestao.acao === 'criar_projeto'
                                ? 'bg-white text-[#D65100] shadow-sm'
                                : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                          >
                            <FolderPlus className="inline-block mr-1 h-3.5 w-3.5" />
                            Criar Projeto
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleMudarAcao(sugestao.idSugestao, 'vincular_existente')
                            }
                            className={`px-2.5 py-1 rounded font-semibold transition ${
                              sugestao.acao === 'vincular_existente'
                                ? 'bg-white text-[#D65100] shadow-sm'
                                : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                          >
                            <LinkIcon className="inline-block mr-1 h-3.5 w-3.5" />
                            Vincular a Existente
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMudarAcao(sugestao.idSugestao, 'ignorar')}
                            className={`px-2.5 py-1 rounded font-semibold transition ${
                              sugestao.acao === 'ignorar'
                                ? 'bg-white text-rose-700 shadow-sm'
                                : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                          >
                            Ignorar
                          </button>
                        </div>

                        {sugestao.acao === 'vincular_existente' && (
                          <div className="flex-1 min-w-[240px]">
                            <Select
                              value={sugestao.projetoExistenteIdDestino || ''}
                              onValueChange={(val) =>
                                handleMudarProjetoDestino(sugestao.idSugestao, val)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs bg-white">
                                <SelectValue placeholder="Selecione o projeto destino..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {projetosExistentes.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.numero} · {p.nome} ({p.expand?.cliente?.razao_social})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      {/* Campos editáveis quando expandido e for criar projeto */}
                      {expandido && (
                        <div className="mt-3 p-3 rounded-lg bg-neutral-50 border border-neutral-200/80 space-y-2.5 text-xs">
                          {sugestao.acao === 'criar_projeto' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2 space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-neutral-500">
                                  Nome do Projeto Sugerido
                                </Label>
                                <Input
                                  value={sugestao.nomeSugerido}
                                  onChange={(e) =>
                                    handleMudarNome(sugestao.idSugestao, e.target.value)
                                  }
                                  className="h-7 text-xs bg-white"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-neutral-500">
                                  Trilha
                                </Label>
                                <Select
                                  value={sugestao.trilhaSugerida}
                                  onValueChange={(v: 'opea' | 'registro' | 'demais') =>
                                    handleMudarTrilha(sugestao.idSugestao, v)
                                  }
                                >
                                  <SelectTrigger className="h-7 text-xs bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="opea">OPEA</SelectItem>
                                    <SelectItem value="registro">Registro</SelectItem>
                                    <SelectItem value="demais">Demais</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t text-[11px] text-neutral-600">
                            <div>
                              <span className="font-semibold block text-neutral-500">Tomador:</span>
                              <span className="truncate block font-medium">
                                {sugestao.tomadorRazao}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold block text-neutral-500">
                                CNPJ/CPF:
                              </span>
                              <span className="font-mono block">
                                {sugestao.tomadorCnpjCpf || 'Não informado'}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold block text-neutral-500">
                                Valor Global:
                              </span>
                              <span className="mono-value font-bold block text-neutral-800">
                                {formatCurrency(sugestao.valorGlobalEstimado)} (est.)
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold block text-neutral-500">
                                Tipo de Serviço:
                              </span>
                              <span className="block truncate">{sugestao.tipoServicoInferido}</span>
                            </div>
                          </div>

                          {/* Notas detalhadas vinculadas ao projeto */}
                          <div className="pt-2 border-t">
                            <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                              Notas Fiscais do Grupo ({sugestao.notas.length}):
                            </span>
                            <div className="space-y-1 max-h-36 overflow-y-auto">
                              {sugestao.notas.map((n) => (
                                <div
                                  key={n.idTemp}
                                  className="flex items-center justify-between p-1.5 rounded bg-white border text-[11px]"
                                >
                                  <div className="flex items-center gap-2 min-w-0 pr-2">
                                    <span className="font-mono font-bold text-[#FF6A13]">
                                      NFS-e nº {n.numero}
                                    </span>
                                    <span className="text-neutral-400">·</span>
                                    <span className="text-neutral-500">
                                      {formatDate(n.dataEmissao)}
                                    </span>
                                    {n.descricaoServico && (
                                      <>
                                        <span className="text-neutral-400">·</span>
                                        <span className="text-neutral-700 italic truncate max-w-[280px]">
                                          {n.descricaoServico}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <span className="mono-value font-bold text-neutral-800 shrink-0">
                                    {formatCurrency(n.valorBruto)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-neutral-500 text-left">
            Ao confirmar, os projetos serão gerados com sequência global AAAA-NNN e as notas órfãs
            serão convertidas em parcelas faturadas.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={isProcessando}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleExecutar()}
              disabled={isProcessando || totais.selecionadas === 0}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              {isProcessando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gravar {totais.selecionadas} Projeto(s)
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
