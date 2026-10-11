import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, FileUp, Loader2, UploadCloud, X } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { getFileTypeMeta } from '@/lib/fileIcons'
import {
  ALLOWED_EXTENSIONS,
  ANEXO_CATEGORIAS,
  formatBytes,
  getFileExtension,
  MAX_FILE_SIZE_BYTES,
  uploadAnexo,
} from '@/services/anexos'
import { listAll } from '@/services/api'
import type {
  AnexoCategoria,
  AnexoRecord,
  ClienteRecord,
  OportunidadeRecord,
  ProcessoRecord,
  ProjetoRecord,
} from '@/types/crm'

export interface AnexoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (anexo: AnexoRecord) => void
  presetCliente?: string
  presetProjeto?: string
  presetProcesso?: string
  presetOportunidade?: string
}

export function AnexoDialog({
  open,
  onOpenChange,
  onSuccess,
  presetCliente,
  presetProjeto,
  presetProcesso,
  presetOportunidade,
}: AnexoDialogProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState<
    Array<{
      nome: string
      status: 'pending' | 'uploading' | 'success' | 'error'
      errorMsg?: string
    }>
  >([])
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<AnexoCategoria>('outro')
  const [clienteId, setClienteId] = useState(presetCliente || '')
  const [projetoId, setProjetoId] = useState(presetProjeto || '')
  const [processoId, setProcessoId] = useState(presetProcesso || '')
  const [oportunidadeId, setOportunidadeId] = useState(presetOportunidade || '')
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Opções para vincular
  const [clientes, setClientes] = useState<ClienteRecord[]>([])
  const [projetos, setProjects] = useState<ProjetoRecord[]>([])
  const [processos, setProcessos] = useState<ProcessoRecord[]>([])
  const [oportunidades, setOportunidades] = useState<OportunidadeRecord[]>([])

  useEffect(() => {
    if (open) {
      setClienteId(presetCliente || '')
      setProjetoId(presetProjeto || '')
      setProcessoId(presetProcesso || '')
      setOportunidadeId(presetOportunidade || '')
      setFiles([])
      setUploadStatus([])
      setNome('')
      setDescricao('')
      setValidationError(null)

      // Carregar opções de vínculos se ainda vazias
      void Promise.all([
        listAll<ClienteRecord>('clientes', { sort: 'razao_social' }).catch(() => []),
        listAll<ProjetoRecord>('projetos', { sort: '-numero' }).catch(() => []),
        listAll<ProcessoRecord>('processos', { sort: '-created' }).catch(() => []),
        listAll<OportunidadeRecord>('oportunidades', { sort: '-created' }).catch(() => []),
      ]).then(([clis, projs, procs, ops]) => {
        setClientes(clis)
        setProjects(projs)
        setProcessos(procs)
        setOportunidades(ops)
      })
    }
  }, [open, presetCliente, presetProjeto, presetProcesso, presetOportunidade])

  // Se o usuário selecionar um projeto e o cliente não estiver definido, auto-preencher
  useEffect(() => {
    if (projetoId && !clienteId) {
      const p = projetos.find((item) => item.id === projetoId)
      if (p?.cliente) setClienteId(p.cliente)
    }
  }, [projetoId, clienteId, projetos])

  // Se o usuário selecionar um processo e o projeto não estiver definido, auto-preencher
  useEffect(() => {
    if (processoId && !projetoId) {
      const proc = processos.find((item) => item.id === processoId)
      if (proc?.projeto) {
        setProjetoId(proc.projeto)
      }
    }
  }, [processoId, projetoId, processos])

  function processSelectedFiles(fileList: FileList | File[]) {
    setValidationError(null)
    const arr = Array.from(fileList)
    if (!arr.length) return

    const validFiles: File[] = []
    const rejectedErrors: string[] = []

    for (const f of arr) {
      if (f.size > MAX_FILE_SIZE_BYTES) {
        rejectedErrors.push(
          `"${f.name}" excede o limite de ${formatBytes(MAX_FILE_SIZE_BYTES)} (${formatBytes(f.size)}).`,
        )
      } else {
        validFiles.push(f)
      }
    }

    if (rejectedErrors.length > 0) {
      setValidationError(rejectedErrors.join(' | '))
    }

    if (!validFiles.length) return

    // Se houver apenas 1 arquivo adicionado e ainda sem nome, preencher nome
    if (validFiles.length === 1 && (!nome || files.length === 0)) {
      setNome(validFiles[0].name.replace(/\.[^/.]+$/, ''))
      const ext = getFileExtension(validFiles[0].name)
      if (ext === 'dwg' || ext === 'dxf') {
        setCategoria('projeto_tecnico')
      } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        setCategoria('planilha')
      }
    }

    // Mesclar com os já selecionados sem duplicatas por nome/tamanho
    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`))
      const novos = validFiles.filter((f) => !existingKeys.has(`${f.name}-${f.size}`))
      return [...prev, ...novos]
    })
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      processSelectedFiles(e.target.files)
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (e.dataTransfer.files) {
      processSelectedFiles(e.dataTransfer.files)
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      if (updated.length === 1 && !nome) {
        setNome(updated[0].name.replace(/\.[^/.]+$/, ''))
      } else if (updated.length === 0) {
        setNome('')
      }
      return updated
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!files.length) {
      setValidationError('Selecione pelo menos um arquivo para envio.')
      return
    }
    if (files.length === 1 && !nome.trim()) {
      setValidationError('Informe uma identificação/nome para o anexo.')
      return
    }
    if (!user?.id) {
      toast.error('Usuário não autenticado.')
      return
    }

    setSubmitting(true)
    setValidationError(null)

    // Inicializa status por arquivo
    const statusTracker = files.map((f) => ({
      nome: f.name,
      status: 'pending' as const,
    }))
    setUploadStatus(statusTracker)

    let totalSucesso = 0
    let ultimoAnexoCriado: AnexoRecord | null = null
    const errosOcorridos: string[] = []

    for (let i = 0; i < files.length; i++) {
      const currentFile = files[i]

      // Atualiza status para uploading
      setUploadStatus((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'uploading' } : item)),
      )

      try {
        const nomeFinal =
          files.length === 1 && nome.trim()
            ? nome.trim()
            : currentFile.name.replace(/\.[^/.]+$/, '')

        const ext = getFileExtension(currentFile.name)
        let catFinal = categoria
        if (files.length > 1) {
          if (ext === 'dwg' || ext === 'dxf') catFinal = 'projeto_tecnico'
          else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') catFinal = 'planilha'
        }

        const anexo = await uploadAnexo(currentFile, {
          nome: nomeFinal,
          descricao: descricao.trim(),
          categoria: catFinal,
          usuarioId: user.id,
          clienteId: clienteId || undefined,
          projetoId: projetoId || undefined,
          processoId: processoId || undefined,
          oportunidadeId: oportunidadeId || undefined,
        })

        ultimoAnexoCriado = anexo
        totalSucesso++

        setUploadStatus((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'success' } : item)),
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha no upload'
        errosOcorridos.push(`"${currentFile.name}": ${msg}`)
        setUploadStatus((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'error', errorMsg: msg } : item)),
        )
      }
    }

    setSubmitting(false)

    if (totalSucesso > 0) {
      toast.success(
        totalSucesso === 1
          ? 'Arquivo anexado com sucesso!'
          : `${totalSucesso} arquivos anexados com sucesso!`,
      )
      if (ultimoAnexoCriado) onSuccess?.(ultimoAnexoCriado)
    }

    if (errosOcorridos.length > 0) {
      toast.error(
        `${errosOcorridos.length} arquivo(s) falharam: ${errosOcorridos.slice(0, 2).join(', ')}`,
      )
      setValidationError(`Erros no upload:\n${errosOcorridos.join('\n')}`)
    } else {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#333]">
            <FileUp className="h-5 w-5 text-[#FF6A13]" />
            Anexar Arquivo ao CRM
          </DialogTitle>
          <DialogDescription className="text-xs text-[#737373]">
            Envio de documentos, orçamentos, planilhas, editais e projetos técnicos (PDF, TXT, DOCX,
            XLSX, DWG, DXF, etc.) vinculados aos processos do CRM.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Dropzone de upload de arquivos (suporte a múltiplos arquivos) */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-[#555]">
                Arquivos *{' '}
                <span className="font-normal text-muted-foreground">
                  (selecione vários ou arraste em lote, até 25 MB cada)
                </span>
              </Label>
              {files.length > 0 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-semibold text-[#FF6A13] hover:underline"
                >
                  + Adicionar mais arquivos
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.txt,.docx,.doc,.xlsx,.xls,.csv,.dwg,.dxf,.kml,.kmz,.png,.jpg,.jpeg,.webp,.zip"
            />

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="mt-1.5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#DEDEDE] bg-[#FAFAFA] p-5 text-center transition hover:border-[#FF6A13] hover:bg-[#FFF8F3] cursor-pointer"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-[#FF6A13]">
                <UploadCloud className="h-5 w-5" />
              </div>
              <p className="mt-2 text-sm font-semibold text-[#333]">
                Clique para selecionar ou arraste arquivos aqui (seleção múltipla permitida)
              </p>
              <p className="mt-1 text-xs text-[#888]">
                Formatos aceitos: PDF, TXT, DOCX, XLSX, DWG, DXF, KML, KMZ, Imagens, ZIP
              </p>
            </div>

            {/* Lista de arquivos selecionados */}
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#444]">
                  <span>Arquivos selecionados ({files.length}):</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFiles([])
                      setNome('')
                    }}
                    className="text-[11px] text-neutral-500 hover:text-neutral-700"
                  >
                    Limpar todos
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto divide-y rounded-xl border border-[#E5E5E5] bg-white">
                  {files.map((f, idx) => {
                    const fExt = getFileExtension(f.name)
                    const fMeta = getFileTypeMeta(fExt)
                    const statusItem = uploadStatus[idx]

                    return (
                      <div
                        key={`${f.name}-${idx}`}
                        className="flex items-center justify-between p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border font-mono text-[10px] font-bold ${fMeta.bg} ${fMeta.color} ${fMeta.border}`}
                          >
                            {fMeta.label}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#333] truncate">{f.name}</p>
                            <p className="text-[11px] text-[#888]">
                              {formatBytes(f.size)} · {fMeta.label}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {statusItem?.status === 'uploading' && (
                            <span className="flex items-center gap-1 text-[11px] text-[#FF6A13]">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Enviando...
                            </span>
                          )}
                          {statusItem?.status === 'success' && (
                            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Salvo
                            </span>
                          )}
                          {statusItem?.status === 'error' && (
                            <span
                              className="flex items-center gap-1 text-[11px] text-red-600 font-semibold"
                              title={statusItem.errorMsg}
                            >
                              <AlertCircle className="h-3.5 w-3.5" />
                              Erro
                            </span>
                          )}

                          {!submitting && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                removeFile(idx)
                              }}
                              className="h-7 w-7 text-neutral-400 hover:text-red-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {validationError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Nome e Categoria (quando múltiplos arquivos, o nome original de cada um é preservado por padrão) */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-[#555]">
                {files.length > 1
                  ? 'Prefixo / Identificação geral (opcional)'
                  : 'Nome / Identificação *'}
              </Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={
                  files.length > 1
                    ? 'Deixe vazio para manter os nomes originais dos arquivos'
                    : 'Ex: Planta Baixa Cabeceira 32'
                }
                required={files.length === 1}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#555]">Categoria *</Label>
              <Select
                value={categoria}
                onValueChange={(val) => setCategoria(val as AnexoCategoria)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANEXO_CATEGORIAS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição opcional */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#555]">Descrição / Observações</Label>
            <Textarea
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Versão preliminar com levantamento das cotas da cabeceira 32..."
            />
          </div>

          {/* Seção de Vínculos CRM */}
          <div className="rounded-xl border bg-[#FAFAFA] p-3.5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#FF6A13]">
              Vínculos no CRM (Processos e Fluxos)
            </p>
            <p className="text-[11px] text-[#777] -mt-2">
              Vincule este arquivo para que apareça automaticamente na ficha 360º do cliente,
              projeto e processo regulatório.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Cliente */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-[#666]">Cliente</Label>
                <Select
                  value={clienteId || 'none'}
                  onValueChange={(val) => setClienteId(val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="Nenhum cliente vinculado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum cliente vinculado</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Projeto */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-[#666]">Projeto Técnico</Label>
                <Select
                  value={projetoId || 'none'}
                  onValueChange={(val) => setProjetoId(val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="Nenhum projeto vinculado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum projeto vinculado</SelectItem>
                    {projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.numero} · {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Processo Regulatório */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-[#666]">Processo Regulatório</Label>
                <Select
                  value={processoId || 'none'}
                  onValueChange={(val) => setProcessoId(val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="Nenhum processo vinculado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum processo vinculado</SelectItem>
                    {processos.map((pr) => (
                      <SelectItem key={pr.id} value={pr.id}>
                        {pr.numero_protocolo || 'A protocolar'} ({pr.orgao})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Oportunidade */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-[#666]">
                  Oportunidade Comercial
                </Label>
                <Select
                  value={oportunidadeId || 'none'}
                  onValueChange={(val) => setOportunidadeId(val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="Nenhuma oportunidade vinculada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma oportunidade vinculada</SelectItem>
                    {oportunidades.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!files.length || (files.length === 1 && !nome.trim()) || submitting}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando {files.length} arquivo(s)...
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  {files.length > 1 ? `Salvar ${files.length} Anexos` : 'Salvar Anexo'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
