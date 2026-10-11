import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  Camera,
  Check,
  FileText,
  HelpCircle,
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
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
import { formatCurrency } from '@/lib/format'
import {
  extrairDadosComprovante,
  salvarContaPagarComComprovante,
  TIPO_DOC_LABELS,
  type ComprovanteExtraido,
  type TipoDocumentoFiscal,
} from '@/services/comprovantesVision'
import type { ProjetoRecord } from '@/types/crm'

interface CapturaComprovanteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projetos: ProjetoRecord[]
  isMobile: boolean
  onSuccess: () => Promise<void> | void
}

export function CapturaComprovanteModal({
  open,
  onOpenChange,
  projetos,
  isMobile,
  onSuccess,
}: CapturaComprovanteModalProps) {
  const { user } = useAuth()

  // Referências para os inputs de arquivo
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estados do fluxo
  const [etapa, setEtapa] = useState<'selecao' | 'analise' | 'conferencia'>('selecao')
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPdf, setIsPdf] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mensagemAnalise, setMensagemAnalise] = useState('Analisando o comprovante com IA...')

  // Campos do formulário de conferência
  const [tipoDoc, setTipoDoc] = useState<TipoDocumentoFiscal>('cupom_fiscal')
  const [fornecedor, setFornecedor] = useState('')
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [numeroDoc, setNumeroDoc] = useState('')
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().slice(0, 10))
  const [valorTotal, setValorTotal] = useState<number | ''>('')
  const [valorImpostos, setValorImpostos] = useState<number | ''>('')
  const [categoria, setCategoria] = useState<
    'despesas_operacionais' | 'terceirizados' | 'impostos' | 'equipamentos' | 'folha' | 'outros'
  >('despesas_operacionais')
  const [formaPagamento, setFormaPagamento] = useState<
    'pix' | 'ted_doc' | 'boleto' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'outro'
  >('pix')
  const [descricaoItens, setDescricaoItens] = useState('')
  const [projetoId, setProjetoId] = useState<string>('nenhum')
  const [observacoes, setObservacoes] = useState('')
  const [confianca, setConfianca] = useState<'alta' | 'media' | 'baixa'>('alta')
  const [avisoExtracao, setAvisoExtracao] = useState<string | null>(null)

  // Limpa estados ao fechar
  useEffect(() => {
    if (!open) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setEtapa('selecao')
      setArquivoSelecionado(null)
      setPreviewUrl(null)
      setIsPdf(false)
      setIsSubmitting(false)
      setAvisoExtracao(null)
    }
  }, [open])

  // Trata a seleção do arquivo (câmera, galeria ou desktop)
  async function handleFileChosen(file: File) {
    if (!file) return

    setArquivoSelecionado(file)
    const isFilePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    setIsPdf(isFilePdf)

    if (!isFilePdf) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
    }

    setEtapa('analise')
    setMensagemAnalise('Analisando o comprovante com o agente nativo AEROCAD...')

    try {
      const extraido = await extrairDadosComprovante(file)
      preencherFormularioComExtraido(extraido, file.name)
      setEtapa('conferencia')
      if (extraido.sucesso === false) {
        setAvisoExtracao(
          extraido.erro ||
            'Não foi possível extrair todos os dados automaticamente. Você pode preencher ou corrigir os campos ao lado.',
        )
      } else {
        setAvisoExtracao(null)
        toast.success('Informações do comprovante extraídas com sucesso!')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('Falha na extração automática, permitindo preenchimento manual:', msg)
      setAvisoExtracao(
        `A extração automática não foi conclusiva (${msg}). Prossiga com a conferência e preenchimento manual; a foto continuará anexada à conta.`,
      )
      // Popula defaults para permitir cadastro manual
      preencherFormularioComExtraido(
        {
          sucesso: false,
          tipo_documento: 'outro',
          fornecedor: '',
          cnpj_cpf: '',
          data_emissao: new Date().toISOString().slice(0, 10),
          numero_documento: '',
          valor_total: 0,
          valor_impostos: null,
          forma_pagamento_sugerida: 'pix',
          categoria_sugerida: 'despesas_operacionais',
          descricao_itens: file.name.replace(/\.[^/.]+$/, ''),
          confianca: 'baixa',
        },
        file.name,
      )
      setEtapa('conferencia')
    }
  }

  function preencherFormularioComExtraido(extraido: ComprovanteExtraido, nomeArquivo: string) {
    setTipoDoc(extraido.tipo_documento || 'outro')
    setFornecedor(extraido.fornecedor || '')
    setCnpjCpf(extraido.cnpj_cpf || '')
    setNumeroDoc(extraido.numero_documento || '')
    setDataEmissao(extraido.data_emissao || new Date().toISOString().slice(0, 10))
    setValorTotal(extraido.valor_total || '')
    setValorImpostos(extraido.valor_impostos || '')
    setCategoria(extraido.categoria_sugerida || 'despesas_operacionais')
    setFormaPagamento(extraido.forma_pagamento_sugerida || 'pix')
    setDescricaoItens(
      extraido.descricao_itens || `Despesa comprovante ${nomeArquivo.replace(/\.[^/.]+$/, '')}`,
    )
    setObservacoes(extraido.observacoes || '')
    setConfianca(extraido.confianca || 'media')
  }

  // Tenta reanalisar o mesmo arquivo
  async function handleTentarNovamente() {
    if (!arquivoSelecionado) return
    setEtapa('analise')
    setMensagemAnalise('Reanalisando o documento...')
    try {
      const extraido = await extrairDadosComprovante(arquivoSelecionado)
      preencherFormularioComExtraido(extraido, arquivoSelecionado.name)
      setEtapa('conferencia')
      toast.success('Documento reanalisado com sucesso!')
    } catch {
      toast.error('Erro ao reanalisar. Você pode preencher os campos manualmente.')
      setEtapa('conferencia')
    }
  }

  // Confirmar e salvar como Conta a Pagar
  async function handleSalvarContaPagar() {
    if (!arquivoSelecionado) {
      toast.error('Nenhum comprovante anexado.')
      return
    }

    if (!fornecedor.trim()) {
      toast.error('Informe a Razão Social ou Fornecedor.')
      return
    }

    const valorNum = typeof valorTotal === 'number' ? valorTotal : parseFloat(String(valorTotal))
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error('Informe um valor total válido para a despesa.')
      return
    }

    if (!dataEmissao) {
      toast.error('Informe a data de vencimento / emissão.')
      return
    }

    setIsSubmitting(true)
    try {
      const descFinal = descricaoItens.trim()
        ? descricaoItens.trim()
        : `${TIPO_DOC_LABELS[tipoDoc]} - ${fornecedor}`

      await salvarContaPagarComComprovante({
        descricao: descFinal,
        fornecedor: fornecedor.trim(),
        categoria,
        valor: valorNum,
        data_vencimento: dataEmissao,
        forma_pagamento: formaPagamento,
        numero_documento: numeroDoc.trim() || undefined,
        projetoId: projetoId === 'nenhum' ? null : projetoId,
        observacoes: [
          observacoes.trim(),
          cnpjCpf ? `CNPJ/CPF: ${cnpjCpf}` : '',
          valorImpostos ? `Impostos destacados: R$ ${valorImpostos}` : '',
          `Extraído via IA / Visão computacional (${TIPO_DOC_LABELS[tipoDoc]})`,
        ]
          .filter(Boolean)
          .join('\n'),
        arquivoComprovante: arquivoSelecionado,
        userId: user?.id || null,
      })

      toast.success(
        `Conta a pagar de R$ ${valorNum.toFixed(2)} cadastrada com sucesso com o comprovante anexado!`,
      )
      onOpenChange(false)
      await onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao criar conta a pagar: ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-[#FF6A13]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-neutral-900">
                {isMobile ? 'Fotografar Comprovante com IA' : 'Capturar & Extrair Comprovante'}
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500">
                Extraia automaticamente fornecedor, CNPJ, valor e tributos de notas fiscais, cupons
                e recibos via agente nativo AEROCAD.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* INPUTS INVISÍVEIS */}
        {/* 1. Câmera traseira do celular (capture="environment") */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0]
            if (f) handleFileChosen(f)
            e.target.value = ''
          }}
        />

        {/* 2. Galeria de fotos mobile / desktop */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0]
            if (f) handleFileChosen(f)
            e.target.value = ''
          }}
        />

        {/* 3. Arquivo genérico (PDF ou Imagem) */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0]
            if (f) handleFileChosen(f)
            e.target.value = ''
          }}
        />

        {/* ETAPA 1: SELEÇÃO DA FORMA DE CAPTURA */}
        {etapa === 'selecao' && (
          <div className="py-6 space-y-6">
            {isMobile ? (
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-5 rounded-2xl border-2 border-dashed border-[#FF6A13] bg-orange-50/50 hover:bg-orange-100/50 transition flex flex-col items-center justify-center text-center space-y-2 group shadow-sm active:scale-95"
                >
                  <div className="h-14 w-14 rounded-full bg-[#FF6A13] text-white flex items-center justify-center shadow-md">
                    <Camera className="h-7 w-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900 text-base">Fotografar Agora</h4>
                    <p className="text-xs text-neutral-600">
                      Abre a câmera traseira para escanear a nota fiscal ou cupom
                    </p>
                  </div>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="p-3.5 rounded-xl border border-neutral-200 hover:border-[#FF6A13] bg-white transition flex flex-col items-center justify-center text-center space-y-1.5"
                  >
                    <ImageIcon className="h-6 w-6 text-neutral-600" />
                    <span className="text-xs font-semibold text-neutral-800">
                      Escolher da Galeria
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3.5 rounded-xl border border-neutral-200 hover:border-[#FF6A13] bg-white transition flex flex-col items-center justify-center text-center space-y-1.5"
                  >
                    <FileText className="h-6 w-6 text-neutral-600" />
                    <span className="text-xs font-semibold text-neutral-800">Anexar PDF</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-300 hover:border-[#FF6A13] rounded-2xl p-8 text-center cursor-pointer transition bg-neutral-50/50 hover:bg-orange-50/20"
                >
                  <Upload className="mx-auto h-10 w-10 text-[#FF6A13] mb-3" />
                  <h4 className="text-sm font-bold text-neutral-900">
                    Selecione o Comprovante ou arraste aqui
                  </h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    Formatos aceitos: Imagens (JPG, PNG, WEBP) ou documentos PDF
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6A13] text-white rounded-lg text-xs font-semibold shadow-sm">
                    <FileText className="h-3.5 w-3.5" />
                    Selecionar Arquivo
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-orange-50/80 border border-orange-200 text-xs text-neutral-700 flex items-start gap-2.5">
                  <Sparkles className="h-4 w-4 text-[#FF6A13] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-neutral-900">Agente de Visão Nativo Skip Cloud:</strong>{' '}
                    Lê cupons de postos, despesas de campo, notas de serviços e faturas para
                    pré-preencher fornecedor, data, valor e criar a conta a pagar pendente
                    imediatamente.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ETAPA 2: ANALISANDO DOCUMENTO */}
        {etapa === 'analise' && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center animate-pulse">
                <Sparkles className="h-8 w-8 text-[#FF6A13]" />
              </div>
              <Loader2 className="h-20 w-20 text-[#FF6A13] animate-spin absolute -top-2 -left-2 opacity-50" />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-neutral-900">{mensagemAnalise}</h4>
              <p className="text-xs text-neutral-500 max-w-sm">
                Identificando razão social, CNPJ, itens e valores fiscais. Isso leva apenas alguns
                segundos.
              </p>
            </div>
          </div>
        )}

        {/* ETAPA 3: MODAL DE CONFERÊNCIA COM PRÉVIA AO LADO */}
        {etapa === 'conferencia' && (
          <div className="py-2 space-y-4">
            {avisoExtracao && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{avisoExtracao}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleTentarNovamente}
                  className="h-6 text-[11px] text-amber-900 hover:bg-amber-100 shrink-0"
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Tentar novamente
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* COLUNA ESQUERDA: PRÉVIA DA FOTO / DOCUMENTO */}
              <div className="md:col-span-5 flex flex-col space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
                  <span>Prévia do Comprovante</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (isMobile) cameraInputRef.current?.click()
                      else fileInputRef.current?.click()
                    }}
                    className="text-[11px] text-[#FF6A13] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Substituir foto
                  </button>
                </div>

                <div className="relative border rounded-xl overflow-hidden bg-neutral-950 flex items-center justify-center min-h-[260px] max-h-[380px]">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Comprovante"
                      className="max-h-[360px] w-auto object-contain rounded"
                    />
                  ) : isPdf ? (
                    <div className="p-6 text-center text-white space-y-2">
                      <FileText className="mx-auto h-12 w-12 text-[#FF6A13]" />
                      <p className="text-xs font-semibold">{arquivoSelecionado?.name}</p>
                      <span className="text-[10px] text-neutral-400">
                        Documento PDF pronto para anexo
                      </span>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-neutral-400 text-xs">
                      Sem prévia disponível
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-neutral-50 border text-[11px] text-neutral-600 flex items-center justify-between">
                  <span className="truncate max-w-[200px] font-mono">
                    {arquivoSelecionado?.name}
                  </span>
                  <CrmBadge
                    tone={confianca === 'alta' ? 'green' : confianca === 'media' ? 'amber' : 'gray'}
                  >
                    Confiança: {confianca.toUpperCase()}
                  </CrmBadge>
                </div>
              </div>

              {/* COLUNA DIREITA: FORMULÁRIO EDITÁVEL PRÉ-PREENCHIDO */}
              <div className="md:col-span-7 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo de Documento</Label>
                    <Select
                      value={tipoDoc}
                      onValueChange={(val) => setTipoDoc(val as TipoDocumentoFiscal)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_DOC_LABELS).map(([k, label]) => (
                          <SelectItem key={k} value={k}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Número / Série</Label>
                    <Input
                      value={numeroDoc}
                      onChange={(e) => setNumeroDoc(e.target.value)}
                      placeholder="Ex: 004821"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-neutral-900">
                      Fornecedor / Razão Social *
                    </Label>
                    <Input
                      value={fornecedor}
                      onChange={(e) => setFornecedor(e.target.value)}
                      placeholder="Nome fantasia ou razão social"
                      className="h-8 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">CNPJ / CPF</Label>
                    <Input
                      value={cnpjCpf}
                      onChange={(e) => setCnpjCpf(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-neutral-900">
                      Valor Total (R$) *
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={valorTotal}
                      onChange={(e) =>
                        setValorTotal(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      placeholder="0,00"
                      className="h-8 text-xs font-bold text-neutral-900 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Impostos Destacados (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={valorImpostos}
                      onChange={(e) =>
                        setValorImpostos(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      placeholder="0,00"
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-neutral-900">
                      Data de Emissão / Vencimento *
                    </Label>
                    <Input
                      type="date"
                      value={dataEmissao}
                      onChange={(e) => setDataEmissao(e.target.value)}
                      className="h-8 text-xs font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Categoria de Conta a Pagar</Label>
                    <Select
                      value={categoria}
                      onValueChange={(val) =>
                        setCategoria(
                          val as
                            | 'despesas_operacionais'
                            | 'terceirizados'
                            | 'impostos'
                            | 'equipamentos'
                            | 'folha'
                            | 'outros',
                        )
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="despesas_operacionais">Despesas Operacionais</SelectItem>
                        <SelectItem value="terceirizados">Terceirizados & Serviços</SelectItem>
                        <SelectItem value="impostos">Impostos & Tributos</SelectItem>
                        <SelectItem value="equipamentos">Equipamentos & Hardware</SelectItem>
                        <SelectItem value="folha">Folha de Pagamento</SelectItem>
                        <SelectItem value="outros">Outros Custos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <Select
                      value={formaPagamento}
                      onValueChange={(val) =>
                        setFormaPagamento(
                          val as
                            | 'pix'
                            | 'ted_doc'
                            | 'boleto'
                            | 'cartao_credito'
                            | 'cartao_debito'
                            | 'dinheiro'
                            | 'outro',
                        )
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="ted_doc">TED / DOC</SelectItem>
                        <SelectItem value="boleto">Boleto Bancário</SelectItem>
                        <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                        <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro em Espécie</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Projeto AEROCAD Vinculado (Opcional)</Label>
                  <Select value={projetoId} onValueChange={setProjetoId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione se for custo de projeto específico..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum (Despesa Operacional Geral)</SelectItem>
                      {projetos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.numero} · {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Descrição dos Itens / Serviço</Label>
                  <Input
                    value={descricaoItens}
                    onChange={(e) => setDescricaoItens(e.target.value)}
                    placeholder="Ex: Abastecimento de combustível caminhonete em campo"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Observações Fiscais</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Chave de acesso, observações ou detalhes adicionais..."
                    rows={2}
                    className="text-xs resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
          {etapa === 'conferencia' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEtapa('selecao')}
                disabled={isSubmitting}
                className="w-full sm:w-auto h-8 text-xs"
              >
                Voltar / Nova Foto
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  onClick={handleSalvarContaPagar}
                  disabled={isSubmitting || !fornecedor || !valorTotal}
                  className="w-full sm:w-auto bg-[#FF6A13] hover:bg-[#E85B06] text-white h-8 text-xs font-semibold shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Criando Conta a Pagar...
                    </>
                  ) : (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Confirmar e Criar Conta a Pagar
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto h-8 text-xs"
            >
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
