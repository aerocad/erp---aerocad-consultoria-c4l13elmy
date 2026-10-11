import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/format'
import { NotaExclusaoAlvo, excluirNotasNfseEmLote } from '@/services/exclusaoService'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Trash2, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react'

export interface ConfirmarExcluirNotaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notas: NotaExclusaoAlvo[]
  onSuccess: () => void
}

export function ConfirmarExcluirNotaModal({
  open,
  onOpenChange,
  notas,
  onSuccess,
}: ConfirmarExcluirNotaModalProps) {
  const { user } = useAuth()
  const [excluindo, setExcluindo] = useState(false)

  const isLote = notas.length > 1
  const valorTotal = notas.reduce((acc, n) => acc + (n.valor || 0), 0)

  const handleConfirmar = async () => {
    if (!notas.length) return
    setExcluindo(true)
    try {
      const usuarioNome = user?.name || 'Administrador'
      const usuarioId = user?.id || ''

      const res = await excluirNotasNfseEmLote(notas, usuarioNome, usuarioId)

      if (res.excluidas > 0) {
        toast.success(
          `${res.excluidas} ${
            res.excluidas === 1 ? 'nota fiscal excluída' : 'notas fiscais excluídas'
          } com sucesso. Registro de auditoria gravado!`,
        )
        onOpenChange(false)
        onSuccess()
      }

      if (res.falhas.length > 0) {
        toast.error(`Falha em algumas notas: ${res.falhas.join('; ')}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao excluir nota(s): ' + msg)
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <Trash2 className="h-5 w-5" />
            {isLote ? `Excluir ${notas.length} Notas Fiscais NFS-e` : `Excluir Nota Fiscal NFS-e`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Alerta de Ação Irreversível e Impacto */}
          <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3.5 space-y-2 text-rose-950">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              Confirmação de Exclusão Fiscal
            </div>
            <p className="leading-relaxed">
              Deseja realmente apagar{' '}
              {isLote ? `as ${notas.length} notas selecionadas` : 'esta nota fiscal'} do sistema?
            </p>
            <div className="rounded bg-white/80 p-2.5 border border-rose-200 space-y-1 text-neutral-800">
              <p className="font-semibold text-rose-900">O que acontece ao excluir:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-neutral-700">
                <li>
                  <strong>Parcelas vinculadas:</strong> Se a parcela for contratual com gatilho, ela
                  será <em>reaberta como pendente</em> e o faturamento será limpo. Se for avulsa, a
                  parcela é removida.
                </li>
                <li>
                  <strong>Rastreabilidade fiscal & Auditoria:</strong> O CRM grava automaticamente
                  quem excluiu ({user?.name || 'Administrador'}), a data/hora e os dados fiscais da
                  nota (número, valor e tomador) no log de auditoria permanente.
                </li>
                <li>
                  <strong>Notas órfãs:</strong> Notas não vinculadas serão removidas da central.
                </li>
              </ul>
            </div>
          </div>

          {/* Lista das Notas Alvo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-neutral-700 font-semibold">
              <span>{isLote ? 'Notas selecionadas para exclusão:' : 'Detalhes da NFS-e:'}</span>
              <span className="mono-value font-bold text-neutral-900">
                Total: {formatCurrency(valorTotal)}
              </span>
            </div>

            <div className="divide-y rounded-lg border max-h-48 overflow-y-auto bg-neutral-50/50">
              {notas.map((n) => (
                <div key={`${n.tipo}-${n.id}`} className="p-2.5 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#D65100]">
                        NFS-e nº {n.numero}
                      </span>
                      {n.dataEmissao && (
                        <span className="text-[10px] text-neutral-400">
                          {formatDate(n.dataEmissao)}
                        </span>
                      )}
                      {n.projetoNumero && (
                        <span className="rounded bg-neutral-200 text-neutral-700 px-1 text-[10px]">
                          Proj: {n.projetoNumero}
                        </span>
                      )}
                    </div>
                    {n.descricao && (
                      <p className="text-neutral-600 text-[11px] truncate">{n.descricao}</p>
                    )}
                    {n.clienteNome && (
                      <p className="text-neutral-500 text-[10px] truncate">
                        Tomador: {n.clienteNome}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="mono-value font-bold text-neutral-800">
                      {formatCurrency(n.valor)}
                    </span>
                    {n.statusParcela && (
                      <p className="text-[10px] text-neutral-500 capitalize">{n.statusParcela}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={excluindo}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={excluindo}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {excluindo
              ? 'Excluindo nota(s)...'
              : isLote
                ? `Confirmar Exclusão (${notas.length})`
                : 'Confirmar Exclusão da NFS-e'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
