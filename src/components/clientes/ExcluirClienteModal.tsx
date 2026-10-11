import { useState, useEffect } from 'react'
import {
  AlertCircle,
  Coins,
  FileText,
  FolderGit2,
  Info,
  Loader2,
  Paperclip,
  Trash2,
  Users,
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
import type { ClienteRecord } from '@/types/crm'
import {
  obterImpactoExclusaoCliente,
  excluirCliente,
  type DetalhesImpactoCliente,
} from '@/services/exclusaoService'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface ExcluirClienteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: ClienteRecord
}

export function ExcluirClienteModal({ open, onOpenChange, cliente }: ExcluirClienteModalProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [impacto, setImpacto] = useState<DetalhesImpactoCliente | null>(null)
  const [loadingImpacto, setLoadingImpacto] = useState(false)
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('')
  const [isExcluindo, setIsExcluindo] = useState(false)

  const razaoEsperada = (cliente.razao_social || '').trim()

  useEffect(() => {
    if (open && cliente?.id) {
      setConfirmacaoTexto('')
      setLoadingImpacto(true)
      obterImpactoExclusaoCliente(cliente.id)
        .then((dados) => {
          setImpacto(dados)
        })
        .catch((err) => {
          console.error('Erro ao verificar dependências do cliente:', err)
          toast.error('Erro ao verificar dependências do cliente')
        })
        .finally(() => {
          setLoadingImpacto(false)
        })
    }
  }, [open, cliente?.id])

  const temProjetos = (impacto?.projetos.length || 0) > 0
  const razaoConfere =
    confirmacaoTexto.trim().toLowerCase() === razaoEsperada.toLowerCase() &&
    razaoEsperada.length > 0

  async function handleConfirmarExclusao() {
    if (temProjetos) {
      toast.error('Bloqueado: Exclua ou desvincule os projetos do cliente primeiro.')
      return
    }
    if (!razaoConfere || isExcluindo) return

    setIsExcluindo(true)
    try {
      const { notasOrfasDevolvidas } = await excluirCliente(
        cliente,
        user?.name || 'Administrador',
        user?.id || '',
      )

      let msg = `Cliente "${cliente.razao_social}" excluído com sucesso.`
      if (notasOrfasDevolvidas > 0) {
        msg += ` ${notasOrfasDevolvidas} nota(s) fiscal(is) NFS-e foi(ram) devolvida(s) para a aba "Notas Órfãs" no Financeiro.`
      }

      toast.success(msg, { duration: 5000 })
      onOpenChange(false)
      navigate('/clientes')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Não foi possível excluir o cliente: ' + msg)
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
            <DialogTitle className="text-lg font-bold text-rose-950">Excluir Cliente</DialogTitle>
          </div>
          <DialogDescription className="text-neutral-600 pt-2 text-sm">
            Exclusão permanente do cliente <strong>"{cliente.razao_social}"</strong>.
          </DialogDescription>
        </DialogHeader>

        {loadingImpacto ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-neutral-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#FF6A13]" />
            <p className="text-xs">Verificando projetos e dependências vinculadas...</p>
          </div>
        ) : temProjetos ? (
          /* Bloqueio de segurança se houver projetos */
          <div className="space-y-4 py-2">
            <div className="rounded-lg border-2 border-rose-300 bg-rose-50 p-4 text-xs text-rose-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-700 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                Exclusão Bloqueada: Projetos Vinculados ({impacto?.projetos.length})
              </div>
              <p>
                Este cliente possui <strong>{impacto?.projetos.length} projeto(s)</strong>{' '}
                cadastrado(s) no sistema. Para garantir a rastreabilidade e integridade operacional
                da AEROCAD, não é permitido excluir um cliente com projetos associados.
              </p>
              <div className="mt-2 rounded bg-white p-2.5 border border-rose-200 divide-y max-h-36 overflow-y-auto">
                {impacto?.projetos.map((proj) => (
                  <div key={proj.id} className="py-1.5 flex items-center justify-between">
                    <span className="font-mono font-bold text-[#D65100]">{proj.numero}</span>
                    <span className="truncate max-w-[280px] text-neutral-700">{proj.nome}</span>
                    <span className="text-[10px] uppercase font-semibold text-neutral-500">
                      {proj.status}
                    </span>
                  </div>
                ))}
              </div>
              <p className="pt-1 text-neutral-600">
                <strong>Instrução:</strong> Acesse cada projeto acima e faça a exclusão individual
                consciente (ou reatribuição a outro cliente) antes de tentar excluir esta ficha.
              </p>
            </div>
          </div>
        ) : (
          /* Fluxo de confirmação para cliente sem projetos */
          <div className="space-y-4 py-2">
            {/* Aviso sobre notas fiscais órfãs se existirem */}
            {impacto && impacto.notasFiscais.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold">NFS-e Mantidas no Financeiro:</strong> Foram
                  encontradas <strong>{impacto.notasFiscais.length} nota(s) fiscal(is)</strong>{' '}
                  vinculada(s) diretamente a este cliente. Elas não serão apagadas — serão mantidas
                  e transferidas para a aba{' '}
                  <span className="font-semibold underline">Notas Órfãs</span> no módulo Financeiro.
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-neutral-50 p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Itens deste cliente que serão removidos:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <Coins className="h-4 w-4 text-amber-600" />
                  <span>
                    <strong>{impacto?.parcelas.length || 0}</strong> parcelas diretas
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <FolderGit2 className="h-4 w-4 text-sky-600" />
                  <span>
                    <strong>{impacto?.oportunidades.length || 0}</strong> oportunidades
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <FileText className="h-4 w-4 text-neutral-600" />
                  <span>
                    <strong>{impacto?.propostas.length || 0}</strong> propostas
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <Users className="h-4 w-4 text-emerald-600" />
                  <span>
                    <strong>{impacto?.contatos.length || 0}</strong> contatos
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <Paperclip className="h-4 w-4 text-purple-600" />
                  <span>
                    <strong>{impacto?.anexos.length || 0}</strong> anexos
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded border">
                  <FileText className="h-4 w-4 text-neutral-600" />
                  <span>
                    <strong>{impacto?.documentos.length || 0}</strong> documentos
                  </span>
                </div>
              </div>
            </div>

            {/* Confirmação por digitação da Razão Social */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-semibold text-neutral-700">
                Para confirmar a exclusão, digite a razão social do cliente:{' '}
                <span className="font-bold text-rose-600 select-all">{cliente.razao_social}</span>
              </Label>
              <Input
                placeholder={`Exemplo: ${cliente.razao_social}`}
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
            {temProjetos ? 'Entendido / Fechar' : 'Cancelar'}
          </Button>

          {!temProjetos && (
            <Button
              type="button"
              onClick={handleConfirmarExclusao}
              disabled={!razaoConfere || isExcluindo || loadingImpacto}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isExcluindo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo cliente...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Confirmar Exclusão do Cliente
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
