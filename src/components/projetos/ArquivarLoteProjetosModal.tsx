import { useState } from 'react'
import { Archive, ArchiveRestore, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
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
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/contexts/AuthContext'
import { createOne, updateOne } from '@/services/api'
import type { ProjetoRecord } from '@/types/crm'

export interface ArquivarLoteProjetosModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projetos: Pick<ProjetoRecord, 'id' | 'numero' | 'nome' | 'arquivado' | 'cliente'>[]
  acao: 'arquivar' | 'desarquivar'
  onSuccess?: () => void
}

export function ArquivarLoteProjetosModal({
  open,
  onOpenChange,
  projetos,
  acao,
  onSuccess,
}: ArquivarLoteProjetosModalProps) {
  const { user } = useAuth()
  const [salvando, setSalvando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [erro, setErro] = useState<string | null>(null)

  // Permissão: restrito aos perfis admin e técnico
  const canArchive = user?.role === 'admin' || user?.role === 'tecnico'
  const isDesarquivar = acao === 'desarquivar'
  const total = projetos.length

  async function handleConfirm() {
    if (!canArchive) {
      setErro(
        'Você não tem permissão para arquivar ou desarquivar projetos em lote (restrito a Admin e Técnico).',
      )
      return
    }

    if (total === 0 || !user) return

    setSalvando(true)
    setErro(null)
    setProgresso(0)

    const novoStatusArquivado = !isDesarquivar
    const dataArquivamento = novoStatusArquivado ? new Date().toISOString() : ''
    const usuarioNome = user.name || user.email || 'Usuário'
    const textoAtividade = novoStatusArquivado
      ? `Projeto arquivado por ${usuarioNome}`
      : `Projeto desarquivado por ${usuarioNome}`

    let sucessos = 0
    let falhas = 0

    try {
      for (let i = 0; i < total; i++) {
        const proj = projetos[i]
        try {
          // Atualiza status do projeto
          await updateOne<ProjetoRecord>('projetos', proj.id, {
            arquivado: novoStatusArquivado,
            data_arquivamento: dataArquivamento,
          })

          // Auditoria individual na timeline
          try {
            await createOne('atividades', {
              usuario: user.id,
              texto: textoAtividade,
              cliente: proj.cliente,
              projeto: proj.id,
            })
          } catch (errAtividade) {
            // Se falhar a criação direta, pb_hooks atua como fallback
            console.warn('Nota de atividade gerada pelo hook de retaguarda:', errAtividade)
          }

          sucessos++
        } catch (itemError) {
          console.error(`Erro ao processar projeto ${proj.numero || proj.id}:`, itemError)
          falhas++
        }

        setProgresso(Math.round(((i + 1) / total) * 100))
      }

      if (falhas === 0) {
        toast.success(
          novoStatusArquivado
            ? `${sucessos} ${sucessos === 1 ? 'projeto arquivado' : 'projetos arquivados'} com sucesso!`
            : `${sucessos} ${sucessos === 1 ? 'projeto desarquivado' : 'projetos desarquivados'} com sucesso!`,
        )
      } else if (sucessos > 0) {
        toast.warning(`${sucessos} projetos processados com sucesso e ${falhas} falhas.`)
      } else {
        toast.error('Falha ao processar os projetos selecionados.')
      }

      onSuccess?.()
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Erro na operação em lote:', err)
      const msg = err instanceof Error ? err.message : 'Falha inesperada no processamento em lote.'
      setErro(msg)
      toast.error('Erro no processamento em lote.')
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
          setProgresso(0)
          onOpenChange(isOpen)
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                isDesarquivar ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-[#FF6A13]'
              }`}
            >
              {isDesarquivar ? (
                <ArchiveRestore className="h-6 w-6" />
              ) : (
                <Archive className="h-6 w-6" />
              )}
            </div>
            <div>
              <DialogTitle className="text-lg">
                {isDesarquivar
                  ? `Desarquivar ${total} ${total === 1 ? 'projeto' : 'projetos'}`
                  : `Arquivar ${total} ${total === 1 ? 'projeto' : 'projetos'}`}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#737373]">
                Operação simultânea em lote para os projetos selecionados
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm text-[#424242]">
          {isDesarquivar ? (
            <p>
              Ao <strong>desarquivar</strong> os <strong>{total} projetos selecionados</strong>,
              eles voltarão a aparecer imediatamente na listagem padrão de projetos ativos, bem como
              nos relatórios, indicadores operacionais e no Painel.
            </p>
          ) : (
            <>
              <p>
                Tem certeza que deseja{' '}
                <strong>arquivar simultaneamente os {total} projetos selecionados</strong>?
              </p>
              <ul className="space-y-1.5 text-xs text-[#666] bg-neutral-50 p-3 rounded-lg border border-neutral-200 list-disc list-inside">
                <li>
                  Os projetos <strong>não aparecerão na listagem padrão</strong> (somente ao filtrar
                  por &quot;Arquivados&quot; ou &quot;Todos&quot;).
                </li>
                <li>
                  Ficarão <strong>fora dos KPIs do Painel</strong>, relatórios operacionais e
                  alertas automáticos por prazo.
                </li>
                <li>
                  <strong>Preservação total de dados:</strong> fichas técnicas continuam acessíveis,
                  histórico e vínculos de NFS-e no módulo Financeiro permanecem intactos.
                </li>
                <li>
                  As numerações <strong>AAAA-NNN</strong> permanecem{' '}
                  <strong>intocáveis e reservadas</strong> (a numeração global nunca é liberada nem
                  reutilizada).
                </li>
                <li>
                  Será registrada uma auditoria individual na linha do tempo de cada projeto
                  arquivado.
                </li>
              </ul>
            </>
          )}

          {/* Lista com scroll dos projetos selecionados */}
          <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50/70 p-2.5 max-h-40 overflow-y-auto">
            <p className="text-[11px] font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">
              Projetos selecionados ({total}):
            </p>
            <div className="space-y-1">
              {projetos.map((proj) => (
                <div
                  key={proj.id}
                  className="flex items-center justify-between text-xs py-0.5 border-b border-neutral-200/60 last:border-0"
                >
                  <span className="font-mono font-bold text-[#D65100]">
                    {proj.numero || 'Sem número'}
                  </span>
                  <span className="truncate ml-2 text-neutral-600 max-w-[260px] text-right">
                    {proj.nome}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {salvando && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs text-neutral-600 font-medium">
                <span>Processando projetos...</span>
                <span>{progresso}%</span>
              </div>
              <Progress value={progresso} className="h-2 bg-neutral-200" />
            </div>
          )}

          {erro && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{erro}</span>
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
            disabled={salvando || !canArchive || total === 0}
            className={
              isDesarquivar
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold'
                : 'bg-[#FF6A13] hover:bg-[#E85B06] text-white font-semibold'
            }
          >
            {salvando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando ({progresso}%)...
              </>
            ) : isDesarquivar ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirmar Desarquivamento ({total})
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" />
                Confirmar Arquivamento ({total})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
