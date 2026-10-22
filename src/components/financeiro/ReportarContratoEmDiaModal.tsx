import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { reportarContratoEmDia } from '@/services/emprestimosFinanciamentosService'
import type {
  EmprestimoFinanciamentoRecord,
  EmprestimoParcelaRecord,
  ContaBancariaRecord,
} from '@/types/crm'
import { formatCurrency, formatDate } from '@/lib/format'
import { CheckCircle2, AlertTriangle, RefreshCw, Landmark, ShieldAlert } from 'lucide-react'
import { isUserAdmin } from '@/lib/crm'
import { useAuth } from '@/contexts/AuthContext'

interface ReportarContratoEmDiaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contrato: EmprestimoFinanciamentoRecord | null
  parcelasContrato: EmprestimoParcelaRecord[]
  contasBancarias: ContaBancariaRecord[]
  onSuccess: () => void
}

export function ReportarContratoEmDiaModal({
  open,
  onOpenChange,
  contrato,
  parcelasContrato,
  contasBancarias,
  onSuccess,
}: ReportarContratoEmDiaModalProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const ehAdmin = isUserAdmin(user)

  const [executando, setExecutando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().slice(0, 10))
  const [contaBancariaId, setContaBancariaId] = useState<string>(() => {
    return contrato?.conta_bancaria_debito || 'padrao'
  })
  const [formaPagamento, setFormaPagamento] = useState('debito_automatico')

  // Identifica parcelas vencidas e em atraso
  const hojeStr = new Date().toISOString().slice(0, 10)
  const parcelasEmAtraso = useMemo(() => {
    return parcelasContrato.filter((p) => {
      if (p.status === 'paga') return false
      const venc = p.data_vencimento ? p.data_vencimento.slice(0, 10) : ''
      return p.status === 'atrasada' || (venc && venc < hojeStr)
    })
  }, [parcelasContrato, hojeStr])

  const totalValor = useMemo(() => {
    return parcelasEmAtraso.reduce((acc, p) => acc + (p.valor_parcela || 0), 0)
  }, [parcelasEmAtraso])

  const totalPrincipal = useMemo(() => {
    return parcelasEmAtraso.reduce((acc, p) => acc + (p.valor_principal || 0), 0)
  }, [parcelasEmAtraso])

  const totalJuros = useMemo(() => {
    return parcelasEmAtraso.reduce((acc, p) => acc + (p.valor_juros || 0), 0)
  }, [parcelasEmAtraso])

  const handleConfirmar = async () => {
    if (!contrato) return
    setErro(null)

    if (!ehAdmin) {
      setErro('Ação restrita: apenas administradores podem reportar contratos em dia.')
      return
    }

    if (parcelasEmAtraso.length === 0) {
      toast({
        title: 'Nenhuma parcela em atraso',
        description: 'Todas as parcelas vencidas deste contrato já estão quitadas.',
      })
      onOpenChange(false)
      return
    }

    try {
      setExecutando(true)
      const res = await reportarContratoEmDia({
        contratoId: contrato.id,
        dataPagamentoIso: dataPagamento,
        contaBancariaId: contaBancariaId === 'padrao' ? undefined : contaBancariaId,
        formaPagamento,
        usuarioId: user?.id,
      })

      toast({
        title: 'Contrato regularizado com sucesso',
        description: res.mensagem,
      })

      onOpenChange(false)
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar quitação das parcelas.'
      setErro(msg)
    } finally {
      setExecutando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-neutral-900">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <span>Reportar Contrato em Dia</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-500">
            Todas as parcelas vencidas e em atraso serão regularizadas e marcadas como pagas,
            gerando a baixa contábil correspondente no passivo e na conta bancária informada.
          </DialogDescription>
        </DialogHeader>

        {!ehAdmin && (
          <Alert variant="destructive" className="py-2.5">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Apenas administradores possuem permissão para liquidar parcelas em atraso em lote.
            </AlertDescription>
          </Alert>
        )}

        {erro && (
          <Alert variant="destructive" className="py-2.5">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{erro}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3.5 py-1">
          {/* Card Resumo do Contrato e Parcelas Afetadas */}
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200/90 text-xs space-y-1.5">
            <div className="flex justify-between font-semibold text-neutral-800">
              <span>Contrato:</span>
              <span className="font-mono">
                {contrato?.numero_contrato} ({contrato?.banco_nome})
              </span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Parcelas em atraso:</span>
              <span className="font-bold text-red-600 font-mono">
                {parcelasEmAtraso.length} parcela(s)
              </span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Amortização do Principal (Passivo):</span>
              <span className="font-mono">{formatCurrency(totalPrincipal)}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Juros Período:</span>
              <span className="font-mono">{formatCurrency(totalJuros)}</span>
            </div>
            <div className="border-t border-neutral-200 pt-1.5 flex justify-between font-bold text-neutral-900 text-sm">
              <span>Total a Liquidar:</span>
              <span className="font-mono text-emerald-700">{formatCurrency(totalValor)}</span>
            </div>
          </div>

          {parcelasEmAtraso.length > 0 && (
            <div className="max-h-28 overflow-y-auto border border-neutral-200 rounded p-2 text-[11px] font-mono space-y-1 bg-white">
              {parcelasEmAtraso.map((p) => (
                <div key={p.id} className="flex justify-between text-neutral-700">
                  <span>
                    Parc. #{p.numero_parcela} (Venc:{' '}
                    {p.data_vencimento ? formatDate(p.data_vencimento.slice(0, 10)) : '—'})
                  </span>
                  <span className="font-semibold text-neutral-900">
                    {formatCurrency(p.valor_parcela)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Campos de Baixa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-neutral-700">Data do Pagamento</Label>
              <Input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="h-8 text-xs font-mono"
                disabled={executando || !ehAdmin}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-neutral-700">Forma de Pagamento</Label>
              <Select
                value={formaPagamento}
                onValueChange={setFormaPagamento}
                disabled={executando || !ehAdmin}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debito_automatico">Débito Automático</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="ted_doc">TED / Transferência</SelectItem>
                  <SelectItem value="boleto">Boleto Bancário</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-neutral-500" />
              Conta Bancária da Baixa (Crédito/Saída do Caixa)
            </Label>
            <Select
              value={contaBancariaId}
              onValueChange={setContaBancariaId}
              disabled={executando || !ehAdmin}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Conta débito padrão do contrato..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="padrao">Conta Débito Padrão do Contrato</SelectItem>
                {contasBancarias.map((cb) => (
                  <SelectItem key={cb.id} value={cb.id}>
                    {cb.banco_nome} (Ag: {cb.agencia} / CC: {cb.conta_numero})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={executando}
            className="text-xs h-8"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirmar}
            disabled={executando || !ehAdmin || parcelasEmAtraso.length === 0}
            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {executando ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Baixando parcelas...
              </>
            ) : (
              `Confirmar Baixa (${parcelasEmAtraso.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
