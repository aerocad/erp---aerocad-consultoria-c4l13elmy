import { useState } from 'react'
import { Archive, ArchiveRestore, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { createOne, updateOne } from '@/services/api'
import type { ProjetoRecord } from '@/types/crm'

interface ArquivarProjetoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projeto: Pick<ProjetoRecord, 'id' | 'numero' | 'nome' | 'arquivado' | 'cliente'> | null
  onSuccess?: (projetoAtualizado: ProjetoRecord) => void
}

export function ArquivarProjetoModal({
  open,
  onOpenChange,
  projeto,
  onSuccess,
}: ArquivarProjetoModalProps) {
  const { user } = useAuth()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Permissão: restrito aos perfis admin e técnico
  const canArchive = user?.role === 'admin' || user?.role === 'tecnico'
  const isArquivado = Boolean(projeto?.arquivado)

  async function handleConfirm() {
    if (!canArchive) {
      setErro(
        'Você não tem permissão para arquivar ou desarquivar projetos (restrito a Admin e Técnico).',
      )
      return
    }

    if (!projeto || !user) return

    setSalvando(true)
    setErro(null)

    try {
      const novoStatusArquivado = !isArquivado
      const dataArquivamento = novoStatusArquivado ? new Date().toISOString() : ''

      const atualizado = await updateOne<ProjetoRecord>('projetos', projeto.id, {
        arquivado: novoStatusArquivado,
        data_arquivamento: dataArquivamento,
      })

      // Registrar atividade na timeline explícita garantindo formato exato
      // "Projeto arquivado por [Nome]" / "Projeto desarquivado por [Nome]"
      const usuarioNome = user.name || user.email || 'Usuário'
      const textoAtividade = novoStatusArquivado
        ? `Projeto arquivado por ${usuarioNome}`
        : `Projeto desarquivado por ${usuarioNome}`

      try {
        await createOne('atividades', {
          usuario: user.id,
          texto: textoAtividade,
          cliente: projeto.cliente,
          projeto: projeto.id,
        })
      } catch (errAtividade) {
        // O hook pb_hooks já registra caso a chamada direta falhe
        console.warn('Nota de atividade registrada pelo hook de retaguarda:', errAtividade)
      }

      toast.success(
        novoStatusArquivado
          ? `Projeto ${projeto.numero} arquivado com sucesso.`
          : `Projeto ${projeto.numero} desarquivado com sucesso.`,
      )

      onSuccess?.(atualizado)
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Erro ao alternar arquivamento do projeto:', err)
      const msg =
        err instanceof Error ? err.message : 'Não foi possível alterar o estado de arquivamento.'
      setErro(msg)
      toast.error('Erro ao arquivar/desarquivar projeto.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!salvando) {
          setErro(null)
          onOpenChange(isOpen)
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isArquivado ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-[#FF6A13]'
              }`}
            >
              {isArquivado ? (
                <ArchiveRestore className="h-5 w-5" />
              ) : (
                <Archive className="h-5 w-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-lg">
                {isArquivado ? 'Desarquivar Projeto' : 'Arquivar Projeto'}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#737373]">
                Projeto{' '}
                <strong className="font-mono text-[#D65100]">
                  {projeto?.numero || 'Sem número'}
                </strong>{' '}
                — {projeto?.nome}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm text-[#424242]">
          {isArquivado ? (
            <p>
              Ao <strong>desarquivar</strong>, o projeto voltará a ser exibido normalmente na lista
              padrão de projetos ativos, bem como nos relatórios e painéis operacionais.
            </p>
          ) : (
            <>
              <p>
                Tem certeza que deseja <strong>arquivar</strong> este projeto?
              </p>
              <ul className="space-y-1.5 text-xs text-[#666] bg-neutral-50 p-3 rounded-lg border border-neutral-200 list-disc list-inside">
                <li>
                  O projeto <strong>não aparecerá na listagem padrão</strong> (somente ao filtrar
                  por &quot;Arquivados&quot; ou &quot;Todos&quot;).
                </li>
                <li>
                  Ficará <strong>fora dos KPIs do Painel</strong>, relatórios operacionais e alertas
                  automáticos por prazo.
                </li>
                <li>
                  A ficha técnica continuará acessível, assim como a busca global e os dados
                  financeiros/NFS-e no módulo Financeiro.
                </li>
                <li>
                  O número <strong className="font-mono text-[#D65100]">{projeto?.numero}</strong>{' '}
                  permanece <strong>intocável</strong> (a numeração nunca é liberada nem
                  reutilizada).
                </li>
              </ul>
            </>
          )}

          {erro && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {erro}
            </div>
          )}

          {!canArchive && (
            <div className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
              Apenas os perfis <strong>Administrador</strong> e <strong>Técnico</strong> possuem
              permissão para arquivar ou desarquivar projetos.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={salvando || !canArchive}
            className={
              isArquivado
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-[#FF6A13] hover:bg-[#E85B06] text-white'
            }
          >
            {salvando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : isArquivado ? (
              <>
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Confirmar Desarquivamento
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" />
                Confirmar Arquivamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
