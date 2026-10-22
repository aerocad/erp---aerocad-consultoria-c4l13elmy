import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/format'
import { apropriarJurosCompetencia } from '@/services/emprestimosFinanciamentosService'
import type { EmprestimoParcelaRecord, EmprestimoFinanciamentoRecord } from '@/types/crm'
import { CalendarClock, CheckCircle2, TrendingDown } from 'lucide-react'

interface ApropriarJurosModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcelasPendentesApropriacao: EmprestimoParcelaRecord[]
  contratos: EmprestimoFinanciamentoRecord[]
  onSuccess: () => void
}

export function ApropriarJurosModal({
  open,
  onOpenChange,
  parcelasPendentesApropriacao,
  contratos,
  onSuccess,
}: ApropriarJurosModalProps) {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState<string>('todas')
  const [contratoSelecionado, setContratoSelecionado] = useState<string>('todos')

  // Extrai competências únicas presentes nas parcelas pendentes
  const competenciasDisponiveis = React.useMemo(() => {
    const set = new Set<string>()
    parcelasPendentesApropriacao.forEach((p) => {
      if (p.competencia) set.add(p.competencia)
    })
    return Array.from(set).sort()
  }, [parcelasPendentesApropriacao])

  // Filtra as parcelas que serão apropriadas
  const parcelasAlvo = React.useMemo(() => {
    return parcelasPendentesApropriacao.filter((p) => {
      if (competenciaSelecionada !== 'todas' && p.competencia !== competenciaSelecionada) {
        return false
      }
      if (contratoSelecionado !== 'todos' && p.contrato !== contratoSelecionado) {
        return false
      }
      return true
    })
  }, [parcelasPendentesApropriacao, competenciaSelecionada, contratoSelecionado])

  const totalJurosAlvo = React.useMemo(() => {
    return parcelasAlvo.reduce((acc, p) => acc + (p.valor_juros || 0), 0)
  }, [parcelasAlvo])

  const handleConfirmarApropriacao = async () => {
    if (parcelasAlvo.length === 0) {
      toast({
        title: 'Nenhuma parcela selecionada',
        description: 'Não há juros pendentes para os filtros selecionados.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvando(true)

      let totalGeral = 0
      let qtdGeral = 0

      // Executa apropriação parcela a parcela para garantir idempotência e detalhamento perfeito
      for (const p of parcelasAlvo) {
        const res = await apropriarJurosCompetencia({ parcelaId: p.id })
        totalGeral += res.totalApropriado
        qtdGeral += res.parcelasAfetadas
      }

      toast({
        title: 'Apropriação Contábil Concluída!',
        description: `${qtdGeral} parcela(s) apropriada(s). Total de ${formatCurrency(totalGeral)} reconhecido como despesa de juros (DRE 3.5.2) e reduzido de Encargos a Apropriar (2.1.8).`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro na apropriação de juros:', err)
      toast({
        title: 'Erro ao apropriar juros',
        description: err.message || 'Falha ao processar os lançamentos contábeis.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-5 bg-white">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-neutral-900">
                Apropriação Mensal de Juros (Etapa 2 - Regime de Competência)
              </DialogTitle>
              <p className="text-xs text-neutral-500">
                Reconhece o juro incorrido no período contábil conforme as normas vigentes
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 text-xs pt-1">
          {/* Explicação contábil */}
          <div className="p-3 bg-neutral-900 text-neutral-200 rounded-lg text-[11px] space-y-1.5 border border-neutral-800">
            <div className="font-bold text-[#FF6A13] flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" />
              Partida Dobrada de Competência (Norma Contábil Brasileira):
            </div>
            <div className="font-mono text-white">
              D — Despesas com Juros (Resultado / DRE — Conta 3.5.2)
            </div>
            <div className="font-mono text-white">
              C — Encargos Financeiros a Apropriar (Redutora do Passivo — Conta 2.1.8 / 2.2.3)
            </div>
            <p className="text-[10px] text-neutral-400 pt-1">
              * Operação 100% idempotente: parcelas cujos juros já foram apropriados não serão
              duplicadas.
            </p>
          </div>

          {/* Filtros de seleção */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-neutral-700">Competência Contábil</Label>
              <Select value={competenciaSelecionada} onValueChange={setCompetenciaSelecionada}>
                <SelectTrigger className="mt-1 h-8 text-xs bg-white">
                  <SelectValue placeholder="Selecione competência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as pendentes até o momento</SelectItem>
                  {competenciasDisponiveis.map((comp) => (
                    <SelectItem key={comp} value={comp}>
                      Competência {comp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-neutral-700">Contrato / Operação</Label>
              <Select value={contratoSelecionado} onValueChange={setContratoSelecionado}>
                <SelectTrigger className="mt-1 h-8 text-xs bg-white">
                  <SelectValue placeholder="Selecione o contrato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os contratos ativos</SelectItem>
                  {contratos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numero_contrato} - {c.banco_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabela de parcelas alvo */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-neutral-700">
                Parcelas a Apropriar ({parcelasAlvo.length})
              </span>
              <span className="font-mono font-bold text-amber-700 text-sm">
                Total: {formatCurrency(totalJurosAlvo)}
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto rounded border border-neutral-200 bg-neutral-50/50 p-2 space-y-1">
              {parcelasAlvo.length === 0 ? (
                <div className="text-center py-4 text-neutral-500 text-xs">
                  Nenhuma parcela pendente de apropriação encontrada para este filtro.
                </div>
              ) : (
                parcelasAlvo.map((p) => {
                  const cNome = p.expand?.contrato?.numero_contrato || 'Contrato'
                  const bNome = p.expand?.contrato?.banco_nome || 'Banco'
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between text-[11px] bg-white p-2 rounded border border-neutral-200/80"
                    >
                      <div>
                        <span className="font-medium text-neutral-900">
                          {cNome} ({bNome})
                        </span>
                        <span className="text-neutral-500 ml-2">
                          Parc. {p.numero_parcela} · Venc:{' '}
                          {p.data_vencimento ? p.data_vencimento.slice(0, 10) : '-'} · Comp:{' '}
                          {p.competencia}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-amber-600">
                        {formatCurrency(p.valor_juros)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirmarApropriacao}
            disabled={salvando || parcelasAlvo.length === 0}
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
          >
            {salvando ? 'Apropriando Juros...' : 'Confirmar Apropriação Contábil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
