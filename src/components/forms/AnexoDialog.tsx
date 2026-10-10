import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { AlertCircle, FileUp, Loader2, UploadCloud, X } from 'lucide-react'
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

  const [file, setFile] = useState<File | null>(null)
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
      setFile(null)
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

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    setValidationError(null)
    const selected = e.target.files?.[0]
    if (!selected) return

    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setValidationError(
        `O arquivo excede o limite máximo permitido de ${formatBytes(MAX_FILE_SIZE_BYTES)} (o arquivo tem ${formatBytes(selected.size)}).`,
      )
      e.target.value = ''
      return
    }

    const ext = getFileExtension(selected.name)
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setValidationError(
        `Extensão .${ext || 'desconhecida'} não recomendada. Formatos suportados: PDF, TXT, DOCX, XLSX, DWG, DXF, KML, KMZ, imagens e ZIP.`,
      )
      // Permite ainda assim caso queira forçar, mas avisa
    }

    setFile(selected)
    if (!nome) {
      // Remover a extensão do nome inicial
      const cleanName = selected.name.replace(/\.[^/.]+$/, '')
      setNome(cleanName)
    }

    // Auto-detectar categoria provável pela extensão
    if (ext === 'dwg' || ext === 'dxf') {
      setCategoria('projeto_tecnico')
    } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      setCategoria('planilha')
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setValidationError(null)
    const dropped = e.dataTransfer.files?.[0]
    if (!dropped) return

    if (dropped.size > MAX_FILE_SIZE_BYTES) {
      setValidationError(`O arquivo excede o limite máximo de ${formatBytes(MAX_FILE_SIZE_BYTES)}.`)
      return
    }

    setFile(dropped)
    if (!nome) {
      setNome(dropped.name.replace(/\.[^/.]+$/, ''))
    }
    const ext = getFileExtension(dropped.name)
    if (ext === 'dwg' || ext === 'dxf') {
      setCategoria('projeto_tecnico')
    } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      setCategoria('planilha')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      setValidationError('Selecione um arquivo para envio.')
      return
    }
    if (!nome.trim()) {
      setValidationError('Informe uma identificação/nome para o anexo.')
      return
    }
    if (!user?.id) {
      toast.error('Usuário não autenticado.')
      return
    }

    setSubmitting(true)
    setValidationError(null)

    try {
      const anexo = await uploadAnexo(file, {
        nome: nome.trim(),
        descricao: descricao.trim(),
        categoria,
        usuarioId: user.id,
        clienteId: clienteId || undefined,
        projetoId: projetoId || undefined,
        processoId: processoId || undefined,
        oportunidadeId: oportunidadeId || undefined,
      })

      toast.success('Arquivo anexado com sucesso!')
      onOpenChange(false)
      onSuccess?.(anexo)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar anexo.'
      toast.error(`Erro no upload: ${msg}`)
      setValidationError(`Não foi possível enviar o arquivo: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  const fileExt = file ? getFileExtension(file.name) : ''
  const fileMeta = getFileTypeMeta(fileExt)

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
          {/* Dropzone de upload */}
          <div>
            <Label className="text-xs font-semibold text-[#555]">
              Arquivo * <span className="font-normal text-muted-foreground">(limite de 25 MB)</span>
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.txt,.docx,.doc,.xlsx,.xls,.csv,.dwg,.dxf,.kml,.kmz,.png,.jpg,.jpeg,.webp,.zip"
            />

            {!file ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="mt-1.5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#DEDEDE] bg-[#FAFAFA] p-6 text-center transition hover:border-[#FF6A13] hover:bg-[#FFF8F3] cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-[#FF6A13]">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-[#333]">
                  Clique para selecionar ou arraste o arquivo aqui
                </p>
                <p className="mt-1 text-xs text-[#888]">
                  Formatos aceitos: PDF, TXT, DOCX, XLSX, DWG, DXF, KML, KMZ, Imagens, ZIP
                </p>
              </div>
            ) : (
              <div className="mt-1.5 flex items-center justify-between rounded-xl border border-[#E5E5E5] bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold ${fileMeta.bg} ${fileMeta.color} ${fileMeta.border}`}
                  >
                    {fileMeta.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#333] truncate">{file.name}</p>
                    <p className="text-xs text-[#888]">
                      {formatBytes(file.size)} · Tipo {fileMeta.label}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="text-neutral-500 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {validationError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Nome e Categoria */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-[#555]">Nome / Identificação *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Orçamento Inicial - Zurich Airport"
                required
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
              disabled={!file || !nome.trim() || submitting}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  Salvar Anexo
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
