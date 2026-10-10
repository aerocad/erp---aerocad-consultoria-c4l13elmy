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
import { Checkbox } from '@/components/ui/checkbox'
import { CrmBadge } from '@/components/common/CrmBadge'
import { formatCurrency, formatDate } from '@/lib/format'
import { NfseDadoExtraido } from '@/services/nfseParser'
import { CopyX, CheckCircle2, AlertTriangle, Layers, Sparkles, Info } from 'lucide-react'

export interface GrupoDuplicatasNfse {
  chave: string
  numero: string
  prestador: string
  notas: NfseDadoExtraido[]
  notaMantidaId: string
}

export interface ExcluirDuplicadasModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notasOrfas: NfseDadoExtraido[]
  onExcluirDuplicadas: (idsParaExcluir: string[]) => void
}

/**
 * Calcula um score de completude para eleger a nota mais rica/completa para manter
 */
function calcularScoreNota(nota: NfseDadoExtraido): number {
  let score = 0
  if (nota.situacao === 'paga' || nota.dataRecebimento) score += 10
  if (nota.projetoIdMencionado) score += 8
  if (nota.propostaMencionada) score += 6
  if (nota.tomadorCnpjCpf && nota.tomadorCnpjCpf.trim()) score += 5
  if (nota.tomadorRazao && !nota.tomadorRazao.toLowerCase().includes('não informado')) score += 4
  if (nota.descricaoServico && nota.descricaoServico.length > 10) score += 3
  if (nota.retencoesTexto) score += 2
  if (nota.valorLiquido && nota.valorLiquido > 0) score += 1
  return score
}

export function ExcluirDuplicadasModal({
  open,
  onOpenChange,
  notasOrfas,
  onExcluirDuplicadas,
}: ExcluirDuplicadasModalProps) {
  // Identifica grupos com mais de 1 nota
  const gruposDuplicados = useMemo(() => {
    const mapa = new Map<string, NfseDadoExtraido[]>()

    for (const nota of notasOrfas) {
      const num = (nota.numero || '').trim().toLowerCase()
      const prestador = (nota.prestadorCnpjCpf || '').trim().toLowerCase() || 'aerocad'
      const chave = `${num}_${prestador}`

      if (!mapa.has(chave)) {
        mapa.set(chave, [])
      }
      mapa.get(chave)!.push(nota)
    }

    const resultado: GrupoDuplicatasNfse[] = []

    for (const [chave, lista] of mapa.entries()) {
      if (lista.length > 1) {
        // Ordena por score de completude decrescente; em caso de empate, pelo idTemp
        const ordenadas = [...lista].sort((a, b) => {
          const scoreB = calcularScoreNota(b)
          const scoreA = calcularScoreNota(a)
          if (scoreB !== scoreA) return scoreB - scoreA
          return a.idTemp.localeCompare(b.idTemp)
        })

        resultado.push({
          chave,
          numero: ordenadas[0].numero,
          prestador: ordenadas[0].prestadorCnpjCpf || 'Não informado',
          notas: ordenadas,
          notaMantidaId: ordenadas[0].idTemp, // Mais completa pré-selecionada para MANTER
        })
      }
    }

    return resultado
  }, [notasOrfas])

  // Estado das notas selecionadas para EXCLUSÃO
  // Por padrão, todas exceto a mantida de cada grupo são marcadas para exclusão
  const [idsParaExcluir, setIdsParaExcluir] = useState<Set<string>>(() => {
    const set = new Set<string>()
    for (const g of gruposDuplicados) {
      for (const n of g.notas) {
        if (n.idTemp !== g.notaMantidaId) {
          set.add(n.idTemp)
        }
      }
    }
    return set
  })

  // Permite ao usuário trocar qual nota é a mantida em um grupo
  const [mantidasPorGrupo, setMantidasPorGrupo] = useState<Record<string, string>>({})

  // Sincroniza estado inicial sempre que gruposDuplicados mudar
  const gruposComMantida = useMemo(() => {
    return gruposDuplicados.map((g) => {
      const mantidaId = mantidasPorGrupo[g.chave] || g.notaMantidaId
      return {
        ...g,
        notaMantidaId: mantidaId,
      }
    })
  }, [gruposDuplicados, mantidasPorGrupo])

  const totalDuplicatasDetectadas = useMemo(() => {
    return gruposDuplicados.reduce((acc, g) => acc + (g.notas.length - 1), 0)
  }, [gruposDuplicados])

  // Alterna checkbox de exclusão de uma nota
  const toggleExcluir = (id: string, grupoChave: string) => {
    setIdsParaExcluir((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        // Não permite marcar a mantida se ela for a única não selecionada
        next.add(id)
      }
      return next
    })
  }

  // Define uma nota como mantida no grupo
  const definirComoMantida = (notaId: string, grupoChave: string) => {
    setMantidasPorGrupo((prev) => ({
      ...prev,
      [grupoChave]: notaId,
    }))
    // Remove a mantida dos excluídos e adiciona as demais do grupo aos excluídos
    setIdsParaExcluir((prev) => {
      const next = new Set(prev)
      next.delete(notaId)
      const grupo = gruposDuplicados.find((g) => g.chave === grupoChave)
      if (grupo) {
        for (const n of grupo.notas) {
          if (n.idTemp !== notaId) {
            next.add(n.idTemp)
          }
        }
      }
      return next
    })
  }

  // Marcar todas as duplicatas recomendadas
  const selecionarRecomendadas = () => {
    const next = new Set<string>()
    for (const g of gruposComMantida) {
      for (const n of g.notas) {
        if (n.idTemp !== g.notaMantidaId) {
          next.add(n.idTemp)
        }
      }
    }
    setIdsParaExcluir(next)
  }

  // Desmarcar todas
  const desmarcarTodas = () => {
    setIdsParaExcluir(new Set())
  }

  const handleConfirmarExclusao = () => {
    const listaIds = Array.from(idsParaExcluir)
    onExcluirDuplicadas(listaIds)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-[#FF6A13]">
              <CopyX className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-[#1F1F1F]">
                Deduplicação de Notas Órfãs
              </DialogTitle>
              <DialogDescription className="text-sm text-[#737373]">
                Identifica e remove registros repetidos (mesmo nº NFS-e + CNPJ do prestador)
                mantendo as notas mais completas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {gruposDuplicados.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-[#1F1F1F]">Nenhuma duplicata encontrada</h3>
            <p className="text-sm text-[#737373] max-w-md mx-auto">
              Todas as notas fiscais órfãs na lista possuem identificadores únicos. Não há notas
              repetidas para o mesmo número e prestador.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-950">
                  {totalDuplicatasDetectadas}{' '}
                  {totalDuplicatasDetectadas === 1
                    ? 'duplicata detectada'
                    : 'duplicatas detectadas'}{' '}
                  em {gruposDuplicados.length} {gruposDuplicados.length === 1 ? 'grupo' : 'grupos'}.
                </p>
                <p>
                  Por padrão, o sistema pré-seleciona para <strong>manter</strong> a cópia mais
                  completa (com tomador, valores detalhados ou referências a projetos/propostas) e
                  marca as cópias excedentes para <strong>exclusão</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[#737373] font-medium">
                {idsParaExcluir.size} de {totalDuplicatasDetectadas} duplicatas marcadas para
                exclusão
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selecionarRecomendadas}
                  className="text-xs text-[#FF6A13] hover:underline font-semibold"
                >
                  Selecionar recomendadas
                </button>
                <span className="text-neutral-300">|</span>
                <button
                  type="button"
                  onClick={desmarcarTodas}
                  className="text-xs text-[#737373] hover:underline"
                >
                  Desmarcar todas
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {gruposComMantida.map((grupo) => (
                <div
                  key={grupo.chave}
                  className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm"
                >
                  <div className="bg-neutral-50 px-4 py-2.5 border-b border-neutral-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-[#FF6A13]" />
                      <span className="font-mono font-bold text-sm text-[#FF6A13]">
                        NFS-e nº {grupo.numero}
                      </span>
                      <span className="text-xs text-[#737373]">
                        ({grupo.notas.length} ocorrências)
                      </span>
                    </div>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      Chave: {grupo.chave}
                    </span>
                  </div>

                  <div className="divide-y divide-neutral-100">
                    {grupo.notas.map((nota) => {
                      const isMantida = nota.idTemp === grupo.notaMantidaId
                      const isExcluir = idsParaExcluir.has(nota.idTemp)
                      const score = calcularScoreNota(nota)

                      return (
                        <div
                          key={nota.idTemp}
                          className={`p-3.5 flex items-start gap-3 transition-colors ${
                            isMantida
                              ? 'bg-emerald-50/40 border-l-4 border-l-emerald-500'
                              : isExcluir
                                ? 'bg-rose-50/30 border-l-4 border-l-rose-400'
                                : 'hover:bg-neutral-50 border-l-4 border-l-transparent'
                          }`}
                        >
                          <div className="pt-0.5">
                            <Checkbox
                              id={`check-${nota.idTemp}`}
                              checked={isExcluir}
                              disabled={isMantida}
                              onCheckedChange={() => toggleExcluir(nota.idTemp, grupo.chave)}
                              aria-label={`Excluir nota ${nota.numero}`}
                            />
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {isMantida ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  <Sparkles className="h-3 w-3" />
                                  Registro Mantido (Mais Completo)
                                </span>
                              ) : isExcluir ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                  Marcado para exclusão
                                </span>
                              ) : (
                                <span className="text-[11px] text-[#737373]">Cópia mantida</span>
                              )}

                              <CrmBadge tone="gray">{nota.situacao.toUpperCase()}</CrmBadge>

                              <span className="text-xs text-[#737373]">
                                Emissão: {formatDate(nota.dataEmissao)}
                              </span>

                              {nota.origemArquivo && (
                                <span className="text-[10px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                                  {nota.origemArquivo.toUpperCase()}
                                </span>
                              )}
                            </div>

                            <p className="text-sm font-semibold text-[#1F1F1F]">
                              Tomador: {nota.tomadorRazao}{' '}
                              {nota.tomadorCnpjCpf && (
                                <span className="text-xs font-normal text-neutral-500">
                                  ({nota.tomadorCnpjCpf})
                                </span>
                              )}
                            </p>

                            {nota.descricaoServico && (
                              <p className="text-xs text-neutral-600 line-clamp-1 italic">
                                {nota.descricaoServico}
                              </p>
                            )}

                            {(nota.projetoIdMencionado || nota.propostaMencionada) && (
                              <div className="flex items-center gap-2 text-[11px] text-[#D65100]">
                                {nota.projetoIdMencionado && (
                                  <span>Projeto: {nota.projetoIdMencionado}</span>
                                )}
                                {nota.propostaMencionada && (
                                  <span>Proposta: {nota.propostaMencionada}</span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                            <span className="mono-value font-bold text-sm text-[#1F1F1F]">
                              {formatCurrency(nota.valorBruto)}
                            </span>
                            <span className="text-[10px] text-neutral-400">Score: {score} pts</span>

                            {!isMantida && (
                              <button
                                type="button"
                                onClick={() => definirComoMantida(nota.idTemp, grupo.chave)}
                                className="text-[11px] text-[#FF6A13] hover:underline font-medium"
                              >
                                Manter esta em vez
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 pt-3 border-t border-neutral-200 flex sm:justify-between items-center gap-2">
          <div className="text-xs text-[#737373] hidden sm:block">
            {gruposDuplicados.length > 0 && (
              <span className="flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-neutral-400" />
                Os valores e dados originais das notas mantidas são preservados intactos.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {gruposDuplicados.length > 0 && (
              <Button
                type="button"
                disabled={idsParaExcluir.size === 0}
                onClick={handleConfirmarExclusao}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
              >
                <CopyX className="mr-1.5 h-4 w-4" />
                Excluir {idsParaExcluir.size}{' '}
                {idsParaExcluir.size === 1 ? 'duplicada' : 'duplicadas'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
