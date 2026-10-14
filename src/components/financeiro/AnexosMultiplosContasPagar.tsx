import React, { useRef, useState } from 'react'
import {
  UploadCloud,
  FileText,
  Barcode,
  ArrowLeftRight,
  Receipt,
  FileSpreadsheet,
  Paperclip,
  Trash2,
  Eye,
  Plus,
  AlertCircle,
  HelpCircle,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatBytes } from '@/services/anexos'
import {
  detectarTipoDocumentoHeuristica,
  TIPO_DOCUMENTO_SEGREGADO_CONFIG,
} from '@/services/documentosContasPagar'
import type { TipoDocumentoSegregado } from '@/types/crm'

export interface ArquivoPendenteSegregado {
  id: string
  file: File
  tipo: TipoDocumentoSegregado
  nomeOriginal: string
  tamanho: number
  previewUrl?: string
}

export interface ArquivoExistenteSegregado {
  fileName: string
  url: string
  tipo: TipoDocumentoSegregado
  nomeOriginal: string
  tamanho?: number
  isImage: boolean
  isPdf: boolean
}

export interface AnexosMultiplosContasPagarProps {
  arquivosPendentes: ArquivoPendenteSegregado[]
  onChangeArquivosPendentes: (arquivos: ArquivoPendenteSegregado[]) => void
  arquivosExistentes?: ArquivoExistenteSegregado[]
  onRemoverExistente?: (fileName: string) => void
  onAtualizarTipoExistente?: (fileName: string, novoTipo: TipoDocumentoSegregado) => void
  disabled?: boolean
  maxArquivos?: number
}

export function AnexosMultiplosContasPagar({
  arquivosPendentes,
  onChangeArquivosPendentes,
  arquivosExistentes = [],
  onRemoverExistente,
  onAtualizarTipoExistente,
  disabled = false,
  maxArquivos = 15,
}: AnexosMultiplosContasPagarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [visualizandoModal, setVisualizandoModal] = useState<{
    url: string
    nome: string
    isPdf: boolean
  } | null>(null)

  const totalArquivos = arquivosExistentes.length + arquivosPendentes.length
  const limiteAtingido = totalArquivos >= maxArquivos

  function processarNovosArquivos(fileList: FileList | File[]) {
    const novos: ArquivoPendenteSegregado[] = []
    const filesArray = Array.from(fileList)

    for (const f of filesArray) {
      if (totalArquivos + novos.length >= maxArquivos) break

      const tipoSugerido = detectarTipoDocumentoHeuristica(f.name)
      const previewUrl = f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined

      novos.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${f.name}`,
        file: f,
        tipo: tipoSugerido,
        nomeOriginal: f.name,
        tamanho: f.size,
        previewUrl,
      })
    }

    if (novos.length > 0) {
      onChangeArquivosPendentes([...arquivosPendentes, ...novos])
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled || limiteAtingido) return
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processarNovosArquivos(e.dataTransfer.files)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processarNovosArquivos(e.target.files)
    }
    // Limpa para permitir selecionar o mesmo arquivo novamente se quiser
    if (inputRef.current) inputRef.current.value = ''
  }

  function removerPendente(id: string) {
    const item = arquivosPendentes.find((a) => a.id === id)
    if (item?.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
    }
    onChangeArquivosPendentes(arquivosPendentes.filter((a) => a.id !== id))
  }

  function atualizarTipoPendente(id: string, novoTipo: TipoDocumentoSegregado) {
    onChangeArquivosPendentes(
      arquivosPendentes.map((a) => (a.id === id ? { ...a, tipo: novoTipo } : a)),
    )
  }

  function renderIconeTipo(tipo: TipoDocumentoSegregado, className = 'h-4 w-4') {
    switch (tipo) {
      case 'boleto':
        return <Barcode className={className} />
      case 'comprovante_pix':
        return <ArrowLeftRight className={className} />
      case 'recibo':
        return <Receipt className={className} />
      case 'nota_fiscal':
        return <FileText className={className} />
      case 'contrato':
        return <FileSpreadsheet className={className} />
      case 'outro':
        return <HelpCircle className={className} />
      default:
        return <Paperclip className={className} />
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 text-[#FF6A13]" />
          Documentos & Anexos Segregados
          <span className="text-[11px] font-normal text-neutral-500">
            ({totalArquivos}/{maxArquivos})
          </span>
        </Label>
        <span className="text-[10px] text-neutral-500">
          Aceita vários arquivos simultâneos (PDF, JPG, PNG, WEBP)
        </span>
      </div>

      {/* Zona de Drop e Seleção Múltipla */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled && !limiteAtingido) setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled && !limiteAtingido) inputRef.current?.click()
        }}
        className={`relative rounded-lg border-2 border-dashed p-4 transition text-center cursor-pointer ${
          isDragOver
            ? 'border-[#FF6A13] bg-orange-50/70 scale-[0.99]'
            : 'border-neutral-300 hover:border-[#FF6A13] bg-neutral-50/50 hover:bg-orange-50/20'
        } ${disabled || limiteAtingido ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
          disabled={disabled || limiteAtingido}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-1.5 py-1">
          <div className="p-2 rounded-full bg-orange-100 text-[#FF6A13]">
            <UploadCloud className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-neutral-800">
            Clique para selecionar ou arraste vários arquivos de uma vez
          </p>
          <p className="text-[11px] text-neutral-500">
            Boletos bancários, Notas Fiscais (NFS-e/NF-e), Comprovantes PIX, Recibos ou Contratos
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-[10px] bg-white px-2 py-0.5 rounded border border-neutral-200 text-neutral-600">
              <Plus className="h-3 w-3 text-[#FF6A13]" /> Múltiplos arquivos suportados
            </span>
            <span className="text-[10px] text-neutral-400">Até 30MB por documento</span>
          </div>
        </div>
      </div>

      {/* Faixa explicativa de distinção Boleto vs Comprovante */}
      <div className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50/70 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-[#FF6A13] shrink-0" />
          <div className="text-[11px] text-neutral-700">
            <span className="font-semibold text-neutral-900">Distinção de Documentos:</span>{' '}
            <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
              <Barcode className="h-2.5 w-2.5" /> Boleto
            </span>{' '}
            é documento de <em>cobrança a pagar</em>;{' '}
            <span className="inline-flex items-center gap-1 font-bold text-emerald-900 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
              <ArrowLeftRight className="h-2.5 w-2.5" /> Comprovante
            </span>{' '}
            é documento de <em>pagamento já liquidado</em>.
          </div>
        </div>
        <span className="text-[10px] text-neutral-500 italic shrink-0">
          Você pode ajustar o tipo de cada anexo a qualquer momento.
        </span>
      </div>

      {/* Lista de Documentos Segregados (Existentes + Novos a Enviar) */}
      {(arquivosExistentes.length > 0 || arquivosPendentes.length > 0) && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-neutral-600 flex items-center justify-between">
            <span>Documentos anexados a esta conta:</span>
            <span className="text-[10px] text-neutral-400">
              Cada documento é segregado com sua classificação
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {/* 1. Documentos já gravados no PocketBase */}
            {arquivosExistentes.map((item) => {
              const cfg =
                TIPO_DOCUMENTO_SEGREGADO_CONFIG[item.tipo] || TIPO_DOCUMENTO_SEGREGADO_CONFIG.outro
              const isBoleto = item.tipo === 'boleto'
              const isComprovante = item.tipo === 'comprovante_pix' || item.tipo === 'recibo'
              const isNaoClassificado = item.tipo === 'outro'

              return (
                <div
                  key={item.fileName}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border transition text-xs ${
                    isBoleto
                      ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50/70'
                      : isComprovante
                        ? 'border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/70'
                        : isNaoClassificado
                          ? 'border-amber-200 bg-amber-50/20 hover:bg-amber-50/40 border-dashed'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Miniatura ou Ícone com destaque forte */}
                    <div
                      className={`w-11 h-11 rounded border shrink-0 overflow-hidden flex items-center justify-center ${
                        isBoleto
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : isComprovante
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                            : 'bg-neutral-100 border-neutral-200 text-neutral-600'
                      }`}
                    >
                      {item.isImage ? (
                        <img
                          src={item.url}
                          alt={item.nomeOriginal}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() =>
                            setVisualizandoModal({
                              url: item.url,
                              nome: item.nomeOriginal,
                              isPdf: false,
                            })
                          }
                        />
                      ) : (
                        <span>{renderIconeTipo(item.tipo, 'h-5 w-5')}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="font-bold text-neutral-900 truncate max-w-[220px]"
                          title={item.nomeOriginal}
                        >
                          {item.nomeOriginal}
                        </span>
                        <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                          Salvo
                        </span>
                        {isNaoClassificado && (
                          <span className="text-[10px] text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                            <AlertCircle className="h-2.5 w-2.5 text-amber-700" />
                            Classificar manualmente
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5">
                        <span className="font-medium text-neutral-700">{cfg.naturezaLabel}</span>
                        <span className="text-neutral-300">•</span>
                        {item.tamanho && <span>{formatBytes(item.tamanho)}</span>}
                        <span className="text-neutral-300">•</span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#FF6A13] hover:underline inline-flex items-center gap-0.5"
                        >
                          <Eye className="h-3 w-3" /> Abrir documento
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Seletor de Tipo Segregado */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <Select
                      value={item.tipo}
                      disabled={disabled || !onAtualizarTipoExistente}
                      onValueChange={(val: TipoDocumentoSegregado) => {
                        if (onAtualizarTipoExistente) {
                          onAtualizarTipoExistente(item.fileName, val)
                        }
                      }}
                    >
                      <SelectTrigger
                        className={`h-7.5 text-[11px] font-bold border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder} min-w-[170px]`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_DOCUMENTO_SEGREGADO_CONFIG).map(([chave, conf]) => (
                          <SelectItem key={chave} value={chave} className="text-xs">
                            <span className="flex items-center gap-1.5">
                              {renderIconeTipo(chave as TipoDocumentoSegregado, 'h-3.5 w-3.5')}
                              <span>
                                <strong className="font-semibold">{conf.shortLabel}</strong>
                                <span className="text-[10px] text-neutral-400 ml-1">
                                  ({conf.naturezaLabel})
                                </span>
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {onRemoverExistente && !disabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoverExistente(item.fileName)}
                        className="h-7 w-7 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Remover documento da conta"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}

            {/* 2. Novos arquivos selecionados para salvar */}
            {arquivosPendentes.map((item) => {
              const cfg =
                TIPO_DOCUMENTO_SEGREGADO_CONFIG[item.tipo] || TIPO_DOCUMENTO_SEGREGADO_CONFIG.outro
              const isImage = item.file.type.startsWith('image/')
              const isPdf = item.file.type === 'application/pdf' || item.file.name.endsWith('.pdf')
              const isBoleto = item.tipo === 'boleto'
              const isComprovante = item.tipo === 'comprovante_pix' || item.tipo === 'recibo'
              const isNaoClassificado = item.tipo === 'outro'

              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border transition text-xs ${
                    isBoleto
                      ? 'border-amber-300 bg-amber-50/50 hover:bg-amber-50/80'
                      : isComprovante
                        ? 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50/80'
                        : isNaoClassificado
                          ? 'border-amber-300 bg-amber-50/30 hover:bg-amber-50/50 border-dashed'
                          : 'border-orange-200 bg-orange-50/25 hover:bg-orange-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Miniatura ou Ícone com destaque */}
                    <div
                      className={`w-11 h-11 rounded border shrink-0 overflow-hidden flex items-center justify-center ${
                        isBoleto
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : isComprovante
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                            : 'bg-white border-neutral-200 text-neutral-600'
                      }`}
                    >
                      {isImage && item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.nomeOriginal}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() =>
                            setVisualizandoModal({
                              url: item.previewUrl!,
                              nome: item.nomeOriginal,
                              isPdf: false,
                            })
                          }
                        />
                      ) : (
                        <span>{renderIconeTipo(item.tipo, 'h-5 w-5')}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="font-bold text-neutral-900 truncate max-w-[220px]"
                          title={item.nomeOriginal}
                        >
                          {item.nomeOriginal}
                        </span>
                        <span className="text-[10px] text-orange-800 bg-orange-100 border border-orange-200 px-1.5 py-0.2 rounded font-mono">
                          Novo
                        </span>
                        {isNaoClassificado && (
                          <span className="text-[10px] text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                            <AlertCircle className="h-2.5 w-2.5 text-amber-700" />
                            Classifique: Boleto, Comprovante ou NF?
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5">
                        <span className="font-medium text-neutral-700">{cfg.naturezaLabel}</span>
                        <span className="text-neutral-300">•</span>
                        <span>{formatBytes(item.tamanho)}</span>
                        {item.previewUrl && (
                          <>
                            <span className="text-neutral-300">•</span>
                            <button
                              type="button"
                              onClick={() =>
                                setVisualizandoModal({
                                  url: item.previewUrl!,
                                  nome: item.nomeOriginal,
                                  isPdf,
                                })
                              }
                              className="text-[#FF6A13] hover:underline inline-flex items-center gap-0.5"
                            >
                              <Eye className="h-3 w-3" /> Ver miniatura
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Seletor do Tipo Segregado */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <Select
                      value={item.tipo}
                      disabled={disabled}
                      onValueChange={(val: TipoDocumentoSegregado) =>
                        atualizarTipoPendente(item.id, val)
                      }
                    >
                      <SelectTrigger
                        className={`h-7.5 text-[11px] font-bold border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder} min-w-[170px]`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_DOCUMENTO_SEGREGADO_CONFIG).map(([chave, conf]) => (
                          <SelectItem key={chave} value={chave} className="text-xs">
                            <span className="flex items-center gap-1.5">
                              {renderIconeTipo(chave as TipoDocumentoSegregado, 'h-3.5 w-3.5')}
                              <span>
                                <strong className="font-semibold">{conf.shortLabel}</strong>
                                <span className="text-[10px] text-neutral-400 ml-1">
                                  ({conf.naturezaLabel})
                                </span>
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => removerPendente(item.id)}
                      className="h-7 w-7 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Remover arquivo da seleção"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal de Prévia Rápida de Miniatura / Imagem */}
      {visualizandoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setVisualizandoModal(null)}
        >
          <div
            className="bg-white rounded-lg overflow-hidden max-w-2xl w-full max-h-[85vh] flex flex-col p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
              <span className="font-bold text-xs text-neutral-800 truncate">
                {visualizandoModal.nome}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisualizandoModal(null)}
                className="h-7 text-xs"
              >
                Fechar
              </Button>
            </div>
            <div className="py-3 flex-1 flex items-center justify-center overflow-auto max-h-[70vh]">
              {visualizandoModal.isPdf ? (
                <iframe
                  src={visualizandoModal.url}
                  title="Prévia do PDF"
                  className="w-full h-[60vh] border-0"
                />
              ) : (
                <img
                  src={visualizandoModal.url}
                  alt={visualizandoModal.nome}
                  className="max-w-full max-h-[60vh] object-contain rounded"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
