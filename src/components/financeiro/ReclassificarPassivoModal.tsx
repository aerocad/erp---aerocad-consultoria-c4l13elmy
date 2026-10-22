import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/format'
import { reclassificarPassivoPeriodico } from '@/services/emprestimosFinanciamentosService'
import type { EmprestimoParcelaRecord } from '@/types/crm'
import { ArrowLeftRight, CheckCircle2, Info } from 'lucide-react'

interface ReclassificarPassivoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcelasCandidatasReclassificacao: EmprestimoParcelaRecord[]
  onSuccess: () => void
}

export function ReclassificarPassivoModal({
  open,
  onOpenChange,
  parcelasCandidatasReclassificacao,
  onSuccess,
}: ReclassificarPassivoModalProps) {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)

  const totalPrincipalCandidato = React.useMemo(() => {
    return parcelasCandidatasReclassificacao.reduce((acc, p) => acc + (p.valor_principal || 0), 0)
  }, [parcelasCandidatasReclassificacao])

  const handleConfirmarReclassificacao = async () => {
    try {
      setSalvando(true)
      const res = await reclassificarPassivoPeriodico()

      toast({
        title: 'Reclassificação Contábil Concluída!',
        description: `${res.parcelasReclassificadas} parcelas reclassificadas do Passivo Não Circulante para o Circulante. Total: ${formatCurrency(res.totalReclassificado)}.`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao reclassificar passivo:', err)
      toast({
        title: 'Erro na reclassificação',
        description: err.message || 'Falha ao processar reclassificação contábil.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-5 bg-white">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-neutral-900">
                Reclassificação Periódica do Passivo (Curto Prazo)
              </DialogTitle>
              <p className="text-xs text-neutral-500">
                Passivo Não Circulante (Longo Prazo) → Passivo Circulante (Próximos 12 meses)
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 text-xs pt-1">
          <div className="p-3 bg-neutral-900 text-neutral-200 rounded-lg text-[11px] space-y-1 border border-neutral-800">
            <div className="font-semibold text-blue-400 flex items-center gap-1.5">
              <Info className="w-4 h-4" />
              Regra Contábil de Reclassificação Periódica:
            </div>
            <p className="text-neutral-300">
              Conforme o tempo decorre, as parcelas de empréstimos e financiamentos antes exigíveis
              a longo prazo (superior a 12 meses) passam a ter vencimento no exercício corrente e
              devem ser transferidas para o Passivo Circulante.
            </p>
            <div className="font-mono text-white text-[10px] pt-1 border-t border-neutral-800">
              D — Passivo Não Circulante (2.2.1 / 2.2.2) / C — Passivo Circulante (2.1.6 / 2.1.7)
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200 rounded-lg">
            <div>
              <span className="text-blue-900 font-semibold block">
                Parcelas Elegíveis nos Próximos 12 Meses:
              </span>
              <span className="text-neutral-600 text-xs">
                {parcelasCandidatasReclassificacao.length} parcela(s) identificada(s)
              </span>
            </div>
            <span className="font-mono font-bold text-blue-700 text-base">
              {formatCurrency(totalPrincipalCandidato)}
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto rounded border border-neutral-200 bg-neutral-50/50 p-2 space-y-1">
            {parcelasCandidatasReclassificacao.length === 0 ? (
              <div className="text-center py-4 text-neutral-500 text-xs">
                Todas as parcelas dos próximos 12 meses já estão perfeitamente classificadas no
                Passivo Circulante.
              </div>
            ) : (
              parcelasCandidatasReclassificacao.map((p) => {
                const cNome = p.expand?.contrato?.numero_contrato || 'Contrato'
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-[11px] bg-white p-2 rounded border border-neutral-200/80"
                  >
                    <div>
                      <span className="font-medium text-neutral-900">{cNome}</span>
                      <span className="text-neutral-500 ml-2">
                        Parc. {p.numero_parcela} · Venc:{' '}
                        {p.data_vencimento ? p.data_vencimento.slice(0, 10) : '-'}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-neutral-800">
                      {formatCurrency(p.valor_principal)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
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
            onClick={handleConfirmarReclassificacao}
            disabled={salvando || parcelasCandidatasReclassificacao.length === 0}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            {salvando ? 'Processando...' : 'Confirmar Reclassificação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
