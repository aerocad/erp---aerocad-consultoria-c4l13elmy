import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Sparkles, TrendingUp, AlertTriangle } from 'lucide-react'
import { converterProjetoEmOportunidade } from '@/services/conversaoService'
import { formatCurrency } from '@/lib/format'
import type { ProjetoRecord, UserRecord } from '@/types/crm'

export interface ConverterProjetoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projeto: ProjetoRecord | null
  usuarioAtual: UserRecord | null
  onConverted?: (oportunidadeId: string) => void
}

export function ConverterProjetoModal({
  open,
  onOpenChange,
  projeto,
  usuarioAtual,
  onConverted,
}: ConverterProjetoModalProps) {
  const navigate = useNavigate()
  const [salvando, setSalvando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [valor, setValor] = useState<string>('')
  const [observacoes, setObservacoes] = useState('')

  // Inicializa os campos quando abrir
  const handleOpenChange = (proximoOpen: boolean) => {
    if (proximoOpen && projeto) {
      setTitulo(projeto.nome || `${projeto.numero} — Projeto`)
      setValor(projeto.valor_global ? String(projeto.valor_global) : '')
      setObservacoes('')
    }
    onOpenChange(proximoOpen)
  }

  const jaPossuiVinculo = Boolean(projeto?.oportunidade || projeto?.expand?.oportunidade)
  const oppVinculadaId = projeto?.oportunidade || projeto?.expand?.oportunidade?.id

  async function handleConfirmar() {
    if (!projeto || !usuarioAtual) return

    // Se já tiver vínculo, navega diretamente
    if (jaPossuiVinculo && oppVinculadaId) {
      toast.info('Este projeto já possui oportunidade vinculada. Redirecionando...')
      onOpenChange(false)
      navigate(`/funil?destaque=${oppVinculadaId}`)
      return
    }

    setSalvando(true)
    try {
      const res = await converterProjetoEmOportunidade({
        projetoId: projeto.id,
        usuarioAtual,
        tituloCustomizado: titulo.trim() || undefined,
        valorEstimado: valor ? parseFloat(valor.replace(/\./g, '').replace(',', '.')) : undefined,
        observacoesAdicionais: observacoes.trim() || undefined,
      })

      if (res.recemCriada) {
        toast.success(`Oportunidade "${res.oportunidade.titulo}" criada no funil com sucesso!`)
      } else {
        toast.info(`Oportunidade existente "${res.oportunidade.titulo}" já vinculada ao projeto.`)
      }

      onOpenChange(false)
      if (onConverted) {
        onConverted(res.oportunidade.id)
      } else {
        navigate(`/funil?destaque=${res.oportunidade.id}`)
      }
    } catch (err) {
      console.error('Erro ao converter projeto em oportunidade:', err)
      toast.error('Não foi possível transformar o projeto em oportunidade.')
    } finally {
      setSalvando(false)
    }
  }

  if (!projeto) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-[#FF6A13]">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Transformar em Oportunidade</DialogTitle>
              <DialogDescription>
                Criar uma oportunidade comercial no funil herdando dados deste projeto.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {jaPossuiVinculo ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Projeto já vinculado a uma oportunidade</span>
              </div>
              <p>
                Este projeto ({projeto.numero}) já possui uma oportunidade associada no funil
                comercial. Não é permitida a duplicação do registro.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-neutral-50/80 p-3 text-xs space-y-1.5 text-neutral-700">
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">Projeto origem:</span>
                <span className="font-mono font-bold text-[#D65100]">{projeto.numero}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">Cliente:</span>
                <span className="font-semibold text-neutral-900">
                  {projeto.expand?.cliente?.razao_social || 'Cliente vinculado'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">Trilha / Escopo:</span>
                <span className="capitalize">{projeto.trilha}</span>
              </div>
              {projeto.valor_global ? (
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-medium">Valor global do projeto:</span>
                  <span className="font-mono font-bold text-neutral-900">
                    {formatCurrency(projeto.valor_global)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Título da Oportunidade *</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: 2026-001 — OPEA Aeródromo"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Valor Estimado (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-[11px] text-neutral-500">
                Herdado do valor global do projeto. Pode ser ajustado para a proposta.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Observações adicionais (opcional)</Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes ou justificativa da oportunidade comercial..."
              />
            </div>

            <p className="text-[11px] text-neutral-500 italic">
              * O projeto original não será alterado ou apagado; será gravado vínculo mútuo entre
              ambos e registrado na auditoria.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          {jaPossuiVinculo ? (
            <Button
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
              onClick={() => {
                onOpenChange(false)
                if (oppVinculadaId) navigate(`/funil?destaque=${oppVinculadaId}`)
              }}
            >
              Acessar Oportunidade
            </Button>
          ) : (
            <Button
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
              onClick={handleConfirmar}
              disabled={salvando || !titulo.trim()}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {salvando ? 'Criando oportunidade...' : 'Confirmar e Criar Oportunidade'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
