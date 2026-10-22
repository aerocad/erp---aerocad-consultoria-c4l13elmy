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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/format'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { pagarParcelaOperacao } from '@/services/emprestimosFinanciamentosService'
import type { EmprestimoParcelaRecord, ContaBancariaRecord } from '@/types/crm'
import { CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react'

interface PagarParcelaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcela: EmprestimoParcelaRecord | null
  contasBancarias: ContaBancariaRecord[]
  onSuccess: () => void
}

export function PagarParcelaModal({
  open,
  onOpenChange,
  parcela,
  contasBancarias,
  onSuccess,
}: PagarParcelaModalProps) {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)

  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10))
  const [valorPago, setValorPago] = useState<number>(parcela?.valor_parcela || 0)
  const [contaBancariaId, setContaBancariaId] = useState<string>(parcela?.conta_bancaria || '')
  const [formaPagamento, setFormaPagamento] = useState<string>('debito_automatico')

  // Atualiza valores ao abrir
  React.useEffect(() => {
    if (parcela) {
      setValorPago(parcela.valor_parcela || 0)
      if (parcela.conta_bancaria) {
        setContaBancariaId(parcela.conta_bancaria)
      }
    }
  }, [parcela])

  if (!parcela) return null

  const contrato = parcela.expand?.contrato
  const tipoPassivo =
    contrato?.tipo === 'financiamento_veiculo'
      ? 'Financiamentos a Pagar (2.1.7)'
      : 'Empréstimos a Pagar (2.1.6)'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parcela) return

    const valorNumerico = Number(valorPago)
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor pago maior que zero.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvando(true)
      const res = await pagarParcelaOperacao({
        parcelaId: parcela.id,
        dataPagamentoIso: dataPagamento,
        valorPago: valorNumerico,
        contaBancariaId: contaBancariaId || undefined,
        formaPagamento,
      })

      toast({
        title: 'Pagamento da Parcela Efetuado!',
        description: `Parcela nº ${parcela.numero_parcela} quitada com sucesso. Amortização baixada no passivo e gerado débito bancário para conciliação.`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Erro ao pagar parcela:', err)
      const detalheErro = getErrorMessage(err)
      toast({
        title: 'Erro no pagamento',
        description: detalheErro || 'Não foi possível registrar o pagamento da parcela.',
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
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-neutral-900">
                Pagamento de Parcela (Etapa 3)
              </DialogTitle>
              <p className="text-xs text-neutral-500">
                Parcela nº {parcela.numero_parcela} · Contrato {contrato?.numero_contrato || 'S/N'}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Decomposição contábil */}
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1.5">
            <div className="flex justify-between text-neutral-600">
              <span>Amortização do Principal:</span>
              <span className="font-mono font-bold text-neutral-900">
                {formatCurrency(parcela.valor_principal)}
              </span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Juros do Período:</span>
              <span className="font-mono font-semibold text-amber-700">
                {formatCurrency(parcela.valor_juros)}
              </span>
            </div>
            <div className="border-t border-neutral-200 pt-1.5 flex justify-between font-bold text-neutral-900">
              <span>Total da Prestação:</span>
              <span className="font-mono text-[#FF6A13] text-sm">
                {formatCurrency(parcela.valor_parcela)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-neutral-700">Data do Pagamento</Label>
              <Input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="mt-1 h-8 text-xs bg-white font-mono"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-neutral-700">Valor Pago (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={valorPago}
                onChange={(e) => setValorPago(Number(e.target.value) || 0)}
                className="mt-1 h-8 text-xs bg-white font-mono font-bold"
                required
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-neutral-700">
              Conta Bancária de Débito PJ
            </Label>
            <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
              <SelectTrigger className="mt-1 h-8 text-xs bg-white">
                <SelectValue placeholder="Selecione a conta bancária" />
              </SelectTrigger>
              <SelectContent>
                {contasBancarias.map((cb) => (
                  <SelectItem key={cb.id} value={cb.id}>
                    {cb.apelido || cb.banco_nome} (Ag: {cb.agencia || '-'} / CC:{' '}
                    {cb.numero_conta || '-'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-neutral-700">Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger className="mt-1 h-8 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="debito_automatico">Débito Automático em Conta</SelectItem>
                <SelectItem value="boleto">Boleto Bancário</SelectItem>
                <SelectItem value="pix">PIX PJ</SelectItem>
                <SelectItem value="ted_doc">TED / Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Partida dobrada verbatim da Etapa 3 */}
          <div className="p-2.5 bg-neutral-900 text-neutral-200 rounded-md text-[10px] space-y-1">
            <div className="font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Partida Dobrada Executada (Etapa 3 Verbatim):
            </div>
            <div className="font-mono text-neutral-300">
              D — {tipoPassivo} (Amortização: {formatCurrency(parcela.valor_principal)})
            </div>
            <div className="font-mono text-neutral-300">
              C — Bancos Conta Movimento (1.1.1 - Total: {formatCurrency(valorPago)})
            </div>
            {!parcela.juros_apropriados && (
              <div className="text-amber-300 text-[10px] mt-1">
                * Os juros desta parcela ({formatCurrency(parcela.valor_juros)}) serão apropriados
                automaticamente (Etapa 2) antes da baixa bancária.
              </div>
            )}
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
              type="submit"
              size="sm"
              disabled={salvando}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {salvando ? 'Processando Baixa...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
