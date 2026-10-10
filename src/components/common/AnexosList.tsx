import { useState } from 'react'
import {
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileUp,
  FolderOpen,
  Layers,
  MoreVertical,
  Paperclip,
  Trash2,
  User,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { getFileTypeMeta } from '@/lib/fileIcons'
import { formatDate } from '@/lib/format'
import { ANEXO_CATEGORIAS, deleteAnexo, formatBytes, getFileUrl } from '@/services/anexos'
import type { AnexoRecord } from '@/types/crm'

export interface AnexosListProps {
  anexos: AnexoRecord[]
  loading?: boolean
  onReload?: () => void
  onOpenUpload?: () => void
  showUploadButton?: boolean
  emptyMessage?: string
  compact?: boolean
}

export function AnexosList({
  anexos,
  loading,
  onReload,
  onOpenUpload,
  showUploadButton = true,
  emptyMessage = 'Nenhum arquivo anexado.',
  compact = false,
}: AnexosListProps) {
  const { user } = useAuth()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const canDelete = (item: AnexoRecord) => {
    if (!user) return false
    return user.role === 'admin' || item.usuario === user.id
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      await deleteAnexo(deletingId)
      toast.success('Anexo excluído com sucesso.')
      setDeletingId(null)
      onReload?.()
    } catch {
      toast.error('Não foi possível excluir o anexo.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!anexos.length && !loading) {
    return (
      <div className="crm-card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-[#FF6A13]">
          <Paperclip className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-semibold text-[#444]">{emptyMessage}</p>
        <p className="mt-1 text-xs text-[#888]">
          Anexe orçamentos, planilhas, editais, arquivos DWG/DXF, laudos e documentos em geral.
        </p>
        {showUploadButton && onOpenUpload && (
          <Button
            onClick={onOpenUpload}
            className="mt-4 bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            size="sm"
          >
            <FileUp className="mr-2 h-4 w-4" />
            Anexar Arquivo
          </Button>
        )}
      </div>
    )
  }

  const getCategoriaLabel = (cat: string) => {
    const found = ANEXO_CATEGORIAS.find((c) => c.value === cat)
    return found ? found.label : cat
  }

  return (
    <>
      <div className={compact ? 'divide-y' : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'}>
        {anexos.map((item) => {
          const fileMeta = getFileTypeMeta(item.extensao)
          const fileUrl = getFileUrl(item)
          const isCad = ['dwg', 'dxf'].includes((item.extensao || '').toLowerCase())

          if (compact) {
            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 hover:bg-[#FFF8F3]/50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold ${fileMeta.bg} ${fileMeta.color} ${fileMeta.border}`}
                  >
                    {fileMeta.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#333] truncate">{item.nome}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#777]">
                      <span className="font-medium text-[#FF6A13]">
                        {getCategoriaLabel(item.categoria)}
                      </span>
                      <span>·</span>
                      <span>{formatBytes(item.tamanho_bytes)}</span>
                      <span>·</span>
                      <span>{formatDate(item.created)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-3">
                  {fileUrl && (
                    <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-[#FF6A13]">
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        download={item.nome}
                        title="Baixar/Abrir arquivo"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {canDelete(item) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeletingId(item.id)}
                      className="h-8 w-8 text-neutral-400 hover:text-red-600"
                      title="Excluir anexo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          }

          return (
            <article
              key={item.id}
              className="crm-card p-4 flex flex-col justify-between hover:shadow-md transition border-l-4 border-l-transparent hover:border-l-[#FF6A13]"
            >
              <div>
                {/* Header do card com badge de extensão e ações */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border font-mono text-xs font-bold ${fileMeta.bg} ${fileMeta.color} ${fileMeta.border}`}
                    >
                      {fileMeta.label}
                    </span>
                    <div>
                      <span className="inline-block rounded bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FF6A13]">
                        {getCategoriaLabel(item.categoria)}
                      </span>
                      <p className="text-[11px] text-[#888] font-mono mt-0.5">
                        {formatBytes(item.tamanho_bytes)}
                      </p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-400">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {fileUrl && (
                        <DropdownMenuItem asChild>
                          <a href={fileUrl} target="_blank" rel="noreferrer" download={item.nome}>
                            <Download className="mr-2 h-4 w-4" />
                            Baixar / Abrir
                          </a>
                        </DropdownMenuItem>
                      )}
                      {canDelete(item) && (
                        <DropdownMenuItem
                          onClick={() => setDeletingId(item.id)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir anexo
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Nome e descrição */}
                <h3 className="mt-3 text-sm font-bold text-[#333] line-clamp-2" title={item.nome}>
                  {item.nome}
                </h3>
                {item.descricao && (
                  <p className="mt-1 text-xs text-[#666] line-clamp-2">{item.descricao}</p>
                )}

                {/* Vínculos CRM */}
                <div className="mt-3 border-t pt-2.5 space-y-1 text-xs">
                  {item.expand?.cliente && (
                    <p className="text-[#555] truncate">
                      <span className="font-semibold text-[#888]">Cliente: </span>
                      <Link
                        to={`/clientes/${item.cliente}`}
                        className="text-[#FF6A13] hover:underline"
                      >
                        {item.expand.cliente.razao_social}
                      </Link>
                    </p>
                  )}
                  {item.expand?.projeto && (
                    <p className="text-[#555] truncate">
                      <span className="font-semibold text-[#888]">Projeto: </span>
                      <Link
                        to={`/projetos/${item.projeto}`}
                        className="text-[#333] hover:underline font-mono"
                      >
                        {item.expand.projeto.numero}
                      </Link>
                    </p>
                  )}
                  {item.expand?.processo && (
                    <p className="text-[#555] truncate">
                      <span className="font-semibold text-[#888]">Processo: </span>
                      <Link
                        to={`/processos/${item.processo}`}
                        className="text-[#333] hover:underline font-mono"
                      >
                        {item.expand.processo.numero_protocolo || 'A protocolar'} (
                        {item.expand.processo.orgao})
                      </Link>
                    </p>
                  )}
                  {item.expand?.oportunidade && (
                    <p className="text-[#555] truncate">
                      <span className="font-semibold text-[#888]">Oportunidade: </span>
                      <span>{item.expand.oportunidade.titulo}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Rodapé do card: data e quem enviou */}
              <div className="mt-4 pt-3 border-t flex items-center justify-between text-[11px] text-[#888]">
                <div className="flex items-center gap-1.5 truncate">
                  <User className="h-3.5 w-3.5 shrink-0 text-[#AAA]" />
                  <span className="truncate">{item.expand?.usuario?.name || 'Usuário CRM'}</span>
                </div>
                <span className="shrink-0">{formatDate(item.created)}</span>
              </div>

              {/* Botão de ação rápida para download */}
              {fileUrl && (
                <div className="mt-3">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="w-full text-xs text-[#FF6A13] border-orange-200 hover:bg-orange-50 hover:text-[#E85B06]"
                  >
                    <a href={fileUrl} target="_blank" rel="noreferrer" download={item.nome}>
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Baixar {fileMeta.label}
                    </a>
                  </Button>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anexo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este anexo do CRM? Esta ação não pode ser desfeita e
              removerá o arquivo do servidor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
