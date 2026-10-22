import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/format'
import { excluirContratoOperacao } from '@/services/emprestimosFinanciamentosService'
import type { EmprestimoFinanciamentoRecord } from '@/types/crm'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface ExcluirContratoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contrato: EmprestimoFinanciamentoRecord | null
  userRole?: string
  onSuccess: () => void
}

export function ExcluirContratoModal({
  open,
  onOpenChange,
  contrato,
  userRole,
  onSuccess,
}: ExcluirContratoModalProps) {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('')

  if (!contrato) return null

  const ehAdmin = userRole === 'admin'

  const handleExcluir = async () => {
    if (!ehAdmin) {
      toast({
        title: 'Acesso Negado',
        description:
          'Apenas administradores do CRM podem excluir e estornar contratos de empréstimo.',
        variant: 'destructive',
      })
      return
    }

    if (confirmacaoTexto.trim().toUpperCase() !== 'ESTORNAR') {
      toast({
        title: 'Confirmação Incorreta',
        description: 'Digite ESTORNAR no campo para confirmar a exclusão e estorno contábil.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvando(true)
      const res = await excluirContratoOperacao({ contratoId: contrato.id })

      toast({
        title: 'Contrato Estornado com Sucesso',
        description: res.mensagem,
      })

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao excluir contrato:', err)
      toast({
        title: 'Erro ao excluir contrato',
        description: err.message || 'Falha ao processar estorno contábil.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 bg-white">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-neutral-900">
                Excluir e Estornar Contrato
              </DialogTitle>
              <p className="text-xs text-neutral-500">
                Operação irreversível restrita a administradores do ERP
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 text-xs pt-1">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 space-y-1.5">
            <p className="font-semibold">
              Você está prestes a excluir o contrato nº {contrato.numero_contrato} (
              {contrato.banco_nome}).
            </p>
            <p className="text-[11px] text-red-800">
              Valor da dívida:{' '}
              <strong className="font-mono">{formatCurrency(contrato.valor_total_divida)}</strong>.
              Todas as parcelas associadas e lançamentos contábeis gerados nas Etapas 1, 2 e 3 serão
              automaticamente cancelados e estornados.
            </p>
          </div>

          <div>
            <Label className="text-xs font-semibold text-neutral-700">
              Digite <span className="text-red-600 font-mono">ESTORNAR</span> para confirmar:
            </Label>
            <Input
              value={confirmacaoTexto}
              onChange={(e) => setConfirmacaoTexto(e.target.value)}
              placeholder="ESTORNAR"
              className="mt-1 h-8 text-xs font-mono font-bold bg-white"
            />
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
            onClick={handleExcluir}
            disabled={salvando || confirmacaoTexto.trim().toUpperCase() !== 'ESTORNAR' || !ehAdmin}
            className="text-xs bg-red-600 hover:bg-red-700 text-white font-medium"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            {salvando ? 'Estornando...' : 'Confirmar Estorno e Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
