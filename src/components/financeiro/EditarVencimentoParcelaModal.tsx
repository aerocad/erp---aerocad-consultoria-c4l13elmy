import React, { useState, useEffect } from 'react'
import { Calendar, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, formatCurrency, toInputDate } from '@/lib/format'
import { updateOne, createOne } from '@/services/api'
import type { ParcelaRecord } from '@/types/crm'

export interface EditarVencimentoParcelaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcela: ParcelaRecord | null
  projetoId?: string
  projetoNumero?: string
  clienteId?: string
  onSuccess?: (atualizado: ParcelaRecord) => void
}

export function EditarVencimentoParcelaModal({
  open,
  onOpenChange,
  parcela,
  projetoId,
  projetoNumero,
  clienteId,
  onSuccess,
}: EditarVencimentoParcelaModalProps) {
  const { user } = useAuth()
  const [novoVencimento, setNovoVencimento] = useState('')
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Inicializa o campo quando a parcela for aberta
  useEffect(() => {
    if (parcela?.vencimento) {
      setNovoVencimento(toInputDate(parcela.vencimento))
      setMotivo('')
      setErro(null)
    }
  }, [parcela])

  if (!parcela) return null

  const dataAtualFormatada = formatDate(parcela.vencimento)
  const valorFormatado = formatCurrency(parcela.valor)
  const isQuitada = parcela.status === 'paga'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoVencimento) {
      setErro('Selecione uma data de vencimento válida.')
      return
    }

    // Normaliza para comparação (YYYY-MM-DD)
    const vencimentoAnteriorISO = toInputDate(parcela.vencimento)
    if (vencimentoAnteriorISO === novoVencimento) {
      toast.info('A nova data é idêntica à data de vencimento atual.')
      onOpenChange(false)
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      // 1. Prepara data no formato ISO com horário seguro UTC (12:00:00)
      const dataIsoFormatada = `${novoVencimento} 12:00:00.000Z`

      // 2. Monta payload para a coleção 'parcelas'.
      // Regra de negócio: se parcela estiver 'vencida' ou 'pendente', atualiza status se não for 'paga'.
      // Se estiver quitada ('paga'), mantém intacta conforme requisito.
      const payload: Record<string, unknown> = {
        vencimento: dataIsoFormatada,
      }

      if (!isQuitada) {
        const hojeIso = new Date().toISOString().slice(0, 10)
        if (novoVencimento < hojeIso) {
          payload.status = 'vencida'
        } else {
          payload.status = 'pendente'
        }
      }

      const atualizado = await updateOne<ParcelaRecord>('parcelas', parcela.id, payload)

      // 3. Auditoria na linha do tempo / atividades
      const usuarioNome = user?.name || 'Usuário do CRM'
      const dataNovaFormatada = formatDate(dataIsoFormatada)
      const projId = projetoId || parcela.projeto
      const cliId = clienteId || parcela.cliente

      const textoAuditoria =
        `Vencimento da parcela "${parcela.descricao}" alterado de ${dataAtualFormatada} para ${dataNovaFormatada} por ${usuarioNome}` +
        (motivo.trim() ? ` · Motivo: ${motivo.trim()}` : '')

      if (user?.id) {
        try {
          await createOne('atividades', {
            usuario: user.id,
            texto: textoAuditoria,
            ...(projId ? { projeto: projId } : {}),
            ...(cliId ? { cliente: cliId } : {}),
            tipo: 'financeiro',
          })
        } catch (actErr) {
          console.warn('Não foi possível gravar atividade de auditoria:', actErr)
        }
      }

      toast.success(`Vencimento atualizado para ${dataNovaFormatada} com sucesso!`)
      onSuccess?.(atualizado)
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Erro ao atualizar vencimento da parcela:', err)
      const msg =
        err instanceof Error ? err.message : 'Não foi possível salvar o novo vencimento da parcela.'
      setErro(msg)
      toast.error('Erro ao salvar novo vencimento.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-neutral-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-[#FF6A13]">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Editar Data de Vencimento</DialogTitle>
              <DialogDescription className="text-xs text-neutral-500">
                {projetoNumero ? `Projeto ${projetoNumero} · ` : ''}
                {parcela.descricao}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1 text-xs">
          {erro && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          {/* Resumo da Parcela */}
          <div className="rounded-lg border bg-neutral-50/70 p-3 space-y-2 text-neutral-700">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Valor da parcela:</span>
              <strong className="mono-value font-bold text-neutral-900 text-sm">
                {valorFormatado}
              </strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Vencimento atual:</span>
              <span className="font-mono font-semibold text-neutral-800">{dataAtualFormatada}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Status atual:</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                  parcela.status === 'paga'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : parcela.status === 'vencida'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {parcela.status === 'paga' && <CheckCircle2 className="h-3 w-3" />}
                {parcela.status === 'vencida' && <Clock className="h-3 w-3" />}
                {parcela.status === 'paga'
                  ? 'Quitada'
                  : parcela.status === 'vencida'
                    ? 'Vencida'
                    : 'Pendente'}
              </span>
            </div>

            {parcela.nf_numero && (
              <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60 text-[11px]">
                <span className="text-neutral-500">NFS-e vinculada:</span>
                <span className="font-mono font-bold text-[#FF6A13]">nº {parcela.nf_numero}</span>
              </div>
            )}
          </div>

          {isQuitada && (
            <div className="rounded-md bg-amber-50/80 p-2.5 text-[11px] text-amber-900 border border-amber-200">
              <span className="font-semibold">Nota:</span> Esta parcela já consta como quitada. A
              alteração da data de vencimento é permitida para fins de ajuste de histórico
              administrativo, mantendo o status de quitação inalterado.
            </div>
          )}

          {/* Campo Nova Data de Vencimento */}
          <div className="space-y-1.5">
            <Label
              htmlFor="input-novo-vencimento"
              className="text-xs font-semibold text-neutral-800"
            >
              Nova Data de Vencimento *
            </Label>
            <Input
              id="input-novo-vencimento"
              type="date"
              required
              value={novoVencimento}
              onChange={(e) => setNovoVencimento(e.target.value)}
              className="text-sm font-mono h-10"
              disabled={salvando}
              autoFocus
            />
            <p className="text-[11px] text-neutral-500">
              A data será exibida no formato DD/MM/AAAA e registrada na linha do tempo do projeto.
            </p>
          </div>

          {/* Campo Motivo Opcional */}
          <div className="space-y-1.5">
            <Label
              htmlFor="input-motivo-vencimento"
              className="text-xs font-semibold text-neutral-700"
            >
              Motivo do Ajuste (Opcional)
            </Label>
            <Textarea
              id="input-motivo-vencimento"
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Prorrogação acordada com o cliente, renegociação de prazo..."
              className="text-xs"
              disabled={salvando}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando || !novoVencimento}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              {salvando ? 'Salvando...' : 'Salvar Novo Vencimento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
