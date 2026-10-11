import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Coins,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderGit2,
  Layers,
  Paperclip,
  Trash2,
  Wrench,
  Loader2,
  Info,
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
import type { ProjetoRecord } from '@/types/crm'
import {
  obterImpactoExclusaoProjeto,
  excluirProjetoEmCascata,
  type DetalhesImpactoProjeto,
} from '@/services/exclusaoService'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface ExcluirProjetoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projeto: ProjetoRecord
}

export function ExcluirProjetoModal({ open, onOpenChange, projeto }: ExcluirProjetoModalProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [impacto, setImpacto] = useState<DetalhesImpactoProjeto | null>(null)
  const [loadingImpacto, setLoadingImpacto] = useState(false)
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('')
  const [isExcluindo, setIsExcluindo] = useState(false)

  const numeroEsperado = (projeto.numero || '').trim().toUpperCase()

  useEffect(() => {
    if (open && projeto?.id) {
      setConfirmacaoTexto('')
      setLoadingImpacto(true)
      obterImpactoExclusaoProjeto(projeto.id)
        .then((dados) => {
          setImpacto(dados)
        })
        .catch((err) => {
          console.error('Erro ao calcular impacto de exclusão:', err)
          toast.error('Erro ao verificar dependências do projeto')
        })
        .finally(() => {
          setLoadingImpacto(false)
        })
    }
  }, [open, projeto?.id])

  const numeroConfere =
    confirmacaoTexto.trim().toUpperCase() === numeroEsperado && numeroEsperado.length > 0

  async function handleConfirmarExclusao() {
    if (!numeroConfere || isExcluindo) return
    setIsExcluindo(true)

    try {
      const { notasOrfasDevolvidas } = await excluirProjetoEmCascata(
        projeto,
        user?.name || 'Administrador',
        user?.id || '',
      )

      let mensagemToast = `Projeto ${projeto.numero} excluído com sucesso.`
      if (notasOrfasDevolvidas > 0) {
        mensagemToast += ` ${notasOrfasDevolvidas} NFS-e vinculada(s) retornou(aram) para a aba "Notas Órfãs" no módulo Financeiro.`
      }

      toast.success(mensagemToast, {
        duration: 5000,
      })

      onOpenChange(false)
      navigate('/projetos')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Não foi possível excluir o projeto: ' + msg)
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
              Excluir Projeto {projeto.numero}
            </DialogTitle>
          </div>
          <DialogDescription className="text-neutral-600 pt-2 text-sm">
            Esta é uma ação{' '}
            <strong className="text-rose-600 font-bold">destrutiva e irreversível</strong>. Ao
            prosseguir, o projeto <strong>"{projeto.nome}"</strong> e seus vínculos operacionais
            serão removidos.
          </DialogDescription>
        </DialogHeader>

        {loadingImpacto ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-neutral-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#FF6A13]" />
            <p className="text-xs">Mapeando dependências e registros vinculados em cascata...</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Aviso sobre preservação de notas fiscais reais */}
            {impacto && impacto.notasFiscais.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold">Preservação de Documentos Fiscais:</strong> Há{' '}
                  <strong>{impacto.notasFiscais.length} nota(s) fiscal(is) NFS-e</strong>{' '}
                  correlacionada(s) a este projeto. O vínculo com o projeto será desfeito, mas a
                  nota em si <strong>NÃO será apagada</strong> por se tratar de documento fiscal
                  real; ela voltará a ficar disponível na aba{' '}
                  <span className="font-semibold underline">Notas Órfãs</span> do módulo Financeiro
                  para nova vinculação.
                </div>
              </div>
            )}

            {/* Resumo de itens em cascata */}
            <div className="rounded-lg border bg-neutral-50 p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Itens vinculados que serão removidos em cascata:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <Coins className="h-4 w-4 text-amber-600" />
                  <span>
                    <strong>{impacto?.parcelas.length || 0}</strong> parcelas financeiras
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <FolderGit2 className="h-4 w-4 text-sky-600" />
                  <span>
                    <strong>{impacto?.processos.length || 0}</strong> processos regulatórios
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span>
                    <strong>{impacto?.exigencias.length || 0}</strong> exigências de órgãos
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <Wrench className="h-4 w-4 text-indigo-600" />
                  <span>
                    <strong>{impacto?.ordensServico.length || 0}</strong> ordens de serviço (OS)
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <FileText className="h-4 w-4 text-neutral-600" />
                  <span>
                    <strong>{impacto?.documentos.length || 0}</strong> minutas/documentos
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <Paperclip className="h-4 w-4 text-purple-600" />
                  <span>
                    <strong>{impacto?.anexos.length || 0}</strong> anexos e plantas
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border col-span-2">
                  <Layers className="h-4 w-4 text-neutral-500" />
                  <span>
                    <strong>{impacto?.atividades.length || 0}</strong> registros de timeline e
                    auditoria
                  </span>
                </div>
              </div>
            </div>

            {/* Campo de confirmação obrigatória digitando o número */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-semibold text-neutral-700">
                Para confirmar, digite exatamente o número do projeto:{' '}
                <span className="font-mono font-bold text-rose-600 select-all">
                  {projeto.numero}
                </span>
              </Label>
              <Input
                placeholder={`Exemplo: ${projeto.numero}`}
                value={confirmacaoTexto}
                onChange={(e) => setConfirmacaoTexto(e.target.value)}
                className="font-mono text-sm border-neutral-300 focus-visible:ring-rose-500"
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
            disabled={!numeroConfere || isExcluindo || loadingImpacto}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
          >
            {isExcluindo ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo em cascata...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Confirmar Exclusão Definitiva
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
