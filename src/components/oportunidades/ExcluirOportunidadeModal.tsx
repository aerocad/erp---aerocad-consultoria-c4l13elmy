import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  CheckSquare,
  FileText,
  FolderKanban,
  Info,
  Layers,
  Loader2,
  Paperclip,
  Trash2,
} from 'lucide-react'
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
import type { OportunidadeRecord } from '@/types/crm'
import {
  obterImpactoExclusaoOportunidade,
  excluirOportunidadeEmCascata,
  type DetalhesImpactoOportunidade,
} from '@/services/exclusaoService'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/format'

export interface ExcluirOportunidadeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  oportunidade: OportunidadeRecord | null
  onDeleted?: (oportunidadeId: string) => void
}

export function ExcluirOportunidadeModal({
  open,
  onOpenChange,
  oportunidade,
  onDeleted,
}: ExcluirOportunidadeModalProps) {
  const { user } = useAuth()
  const [impacto, setImpacto] = useState<DetalhesImpactoOportunidade | null>(null)
  const [loadingImpacto, setLoadingImpacto] = useState(false)
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('')
  const [isExcluindo, setIsExcluindo] = useState(false)

  const tituloEsperado = (oportunidade?.titulo || '').trim()

  useEffect(() => {
    if (open && oportunidade?.id) {
      setConfirmacaoTexto('')
      setLoadingImpacto(true)
      obterImpactoExclusaoOportunidade(oportunidade.id)
        .then((dados) => {
          setImpacto(dados)
        })
        .catch((err) => {
          console.error('Erro ao verificar dependências da oportunidade:', err)
          toast.error('Erro ao verificar dependências da oportunidade')
        })
        .finally(() => {
          setLoadingImpacto(false)
        })
    }
  }, [open, oportunidade?.id])

  if (!oportunidade) return null

  const tituloConfere =
    confirmacaoTexto.trim().toLowerCase() === tituloEsperado.toLowerCase() &&
    tituloEsperado.length > 0

  const projetoVinculado = impacto?.projetoVinculado || oportunidade.expand?.projeto
  const isGanha = oportunidade.etapa === 'ganho'

  async function handleConfirmarExclusao() {
    if (!oportunidade || !tituloConfere || isExcluindo) return
    setIsExcluindo(true)

    try {
      const { projetoDesvinculado } = await excluirOportunidadeEmCascata(
        oportunidade,
        user?.name || 'Comercial',
        user?.id || '',
      )

      let mensagemToast = `Oportunidade "${oportunidade.titulo}" excluída com sucesso.`
      if (projetoDesvinculado) {
        mensagemToast += ` O vínculo com o Projeto ${projetoDesvinculado.numero} foi removido (o projeto foi mantido intacto).`
      }

      toast.success(mensagemToast, { duration: 5000 })
      onOpenChange(false)
      onDeleted?.(oportunidade.id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Não foi possível excluir a oportunidade: ' + msg)
    } finally {
      setIsExcluindo(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600">
            <div className="rounded-full bg-rose-100 p-2 text-rose-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-rose-950">
              Excluir Oportunidade Comercial
            </DialogTitle>
          </div>
          <DialogDescription className="text-neutral-600 pt-2 text-sm">
            Esta é uma ação{' '}
            <strong className="text-rose-600 font-bold">destrutiva e irreversível</strong>. Ao
            prosseguir, a oportunidade <strong>"{oportunidade.titulo}"</strong> será removida do
            funil comercial.
          </DialogDescription>
        </DialogHeader>

        {loadingImpacto ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-neutral-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#FF6A13]" />
            <p className="text-xs">Mapeando vínculos, projetos e registros da oportunidade...</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Box informativo dos dados básicos da oportunidade */}
            <div className="rounded-lg border bg-neutral-50/80 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Cliente:</span>
                <span className="font-semibold text-neutral-800">
                  {oportunidade.expand?.cliente?.razao_social || 'Cliente não identificado'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Valor estimado:</span>
                <span className="font-bold text-[#D65100]">
                  {formatCurrency(oportunidade.valor_estimado || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Etapa atual:</span>
                <span className="font-semibold uppercase text-neutral-700">
                  {oportunidade.etapa}
                </span>
              </div>
            </div>

            {/* AVISO ESPECIAL SE ESTIVER VINCULADA A UM PROJETO */}
            {projetoVinculado && (
              <div className="rounded-lg border-2 border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                  <FolderKanban className="h-5 w-5 text-[#FF6A13] shrink-0" />
                  <span>Oportunidade Vinculada ao Projeto {projetoVinculado.numero}</span>
                </div>
                <p className="leading-relaxed">
                  Esta oportunidade está associada ao projeto técnico{' '}
                  <strong>
                    {projetoVinculado.numero} — {projetoVinculado.nome}
                  </strong>
                  .
                </p>
                <div className="rounded bg-white p-2.5 border border-amber-200 text-amber-950 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5 text-emerald-800">
                    <Info className="h-4 w-4 text-emerald-600 shrink-0" />
                    O Projeto NÃO será excluído!
                  </p>
                  <p className="text-[11px] text-neutral-600">
                    Apenas o vínculo cadastral no projeto será desfeito e o chip de vínculo com a
                    oportunidade sumirá. Todos os dados operacionais do projeto (processos,
                    parcelas, documentos, ARTs) <strong>permanecem 100% preservados</strong>.
                  </p>
                  {isGanha && (
                    <p className="text-[11px] text-neutral-700 pt-1 border-t border-amber-100 font-medium">
                      ⚠️ Esta oportunidade originou um projeto após ser dada como "ganha". O projeto
                      continua em execução normal no módulo de Projetos.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Resumo de itens dependentes que serão removidos */}
            <div className="rounded-lg border bg-neutral-50 p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Registros dependentes que serão excluídos:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <FileText className="h-4 w-4 text-sky-600" />
                  <span>
                    <strong>{impacto?.propostas.length || 0}</strong> propostas comerciais
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <CheckSquare className="h-4 w-4 text-indigo-600" />
                  <span>
                    <strong>{impacto?.tarefas.length || 0}</strong> tarefas/lembretes
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <Paperclip className="h-4 w-4 text-purple-600" />
                  <span>
                    <strong>{impacto?.anexos.length || 0}</strong> arquivos/anexos
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <Layers className="h-4 w-4 text-neutral-500" />
                  <span>
                    <strong>{impacto?.atividades.length || 0}</strong> registros de timeline
                  </span>
                </div>
              </div>
            </div>

            {/* Confirmação obrigatória por digitação do título */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-semibold text-neutral-700">
                Para confirmar a exclusão, digite o título da oportunidade:{' '}
                <span className="font-bold text-rose-600 select-all">{oportunidade.titulo}</span>
              </Label>
              <Input
                placeholder={`Exemplo: ${oportunidade.titulo}`}
                value={confirmacaoTexto}
                onChange={(e) => setConfirmacaoTexto(e.target.value)}
                className="text-sm border-neutral-300 focus-visible:ring-rose-500"
                disabled={isExcluindo}
                autoFocus
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExcluindo}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmarExclusao}
            disabled={!tituloConfere || isExcluindo || loadingImpacto}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
          >
            {isExcluindo ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo oportunidade...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Confirmar Exclusão da Oportunidade
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
