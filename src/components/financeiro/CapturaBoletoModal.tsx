import { useState, useRef, useId, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Upload,
  Camera,
  FileText,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Building2,
  Barcode,
  Calendar,
  CreditCard,
} from 'lucide-react'
import {
  extrairDadosBoleto,
  salvarContaPagarComComprovante,
  type BoletoExtraido,
} from '@/services/comprovantesVision'
import { PLANO_CONTAS_AEROCAD, sugerirPlanoContasPorCategoria } from '@/lib/planoContas'
import { formatCurrencyRaw } from '@/lib/format'
import { toast } from '@/hooks/use-toast'
import type { ProjetoRecord, ContaBancariaRecord } from '@/types/crm'

export interface CapturaBoletoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projetos: ProjetoRecord[]
  contasBancarias: ContaBancariaRecord[]
  onContaCriada: () => void
}

type EtapaCaptura = 'upload' | 'analisando' | 'conferencia' | 'salvando'

export function CapturaBoletoModal({
  open,
  onOpenChange,
  projetos,
  contasBancarias,
  onContaCriada,
}: CapturaBoletoModalProps) {
  const [etapa, setEtapa] = useState<EtapaCaptura>('upload')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPdf, setIsPdf] = useState(false)
  const [dadosExtraidos, setDadosExtraidos] = useState<BoletoExtraido | null>(null)
  const [erroAnalise, setErroAnalise] = useState<string | null>(null)

  // Formulário editável de conferência lado a lado
  const [beneficiario, setBeneficiario] = useState('')
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [linhaDigitavel, setLinhaDigitavel] = useState('')
  const [numeroDoc, setNumeroDoc] = useState('')
  const [valorDoc, setValorDoc] = useState('')
  const [valorDesconto, setValorDesconto] = useState('0')
  const [valorJurosMulta, setValorJurosMulta] = useState('0')
  const [vencimento, setVencimento] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<
    'despesas_operacionais' | 'terceirizados' | 'impostos' | 'equipamentos' | 'folha' | 'outros'
  >('despesas_operacionais')
  const [planoContasCodigo, setPlanoContasCodigo] = useState('3.1.1')
  const [planoContasNome, setPlanoContasNome] = useState(
    'Despesas Administrativas Gerais & Escritório',
  )
  const [contaBancariaId, setContaBancariaId] = useState<string>(contasBancarias[0]?.id || '')

  useEffect(() => {
    if (!contaBancariaId && contasBancarias.length > 0) {
      setContaBancariaId(contasBancarias[0].id)
    }
  }, [contasBancarias, contaBancariaId])
  const [projetoId, setProjetoId] = useState<string>('')
  const [observacoes, setObservacoes] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputId = useId()

  const valorLiquidoFinal = useMemo(() => {
    const doc = parseFloat(valorDoc) || 0
    const desc = parseFloat(valorDesconto) || 0
    const jur = parseFloat(valorJurosMulta) || 0
    return Math.max(0, doc - desc + jur)
  }, [valorDoc, valorDesconto, valorJurosMulta])

  function resetarModal() {
    setEtapa('upload')
    setArquivo(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setIsPdf(false)
    setDadosExtraidos(null)
    setErroAnalise(null)
    setBeneficiario('')
    setCnpjCpf('')
    setLinhaDigitavel('')
    setNumeroDoc('')
    setValorDoc('')
    setValorDesconto('0')
    setValorJurosMulta('0')
    setVencimento('')
    setDescricao('')
    setCategoria('despesas_operacionais')
    setPlanoContasCodigo('3.1.1')
    setPlanoContasNome('Despesas Administrativas Gerais & Escritório')
    setContaBancariaId(contasBancarias[0]?.id || '')
    setProjetoId('')
    setObservacoes('')
  }

  async function processarArquivoSelecionado(file: File) {
    const isImage = file.type.startsWith('image/')
    const isFilePdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')

    if (!isImage && !isFilePdf) {
      toast.error('Selecione um arquivo de imagem (JPG, PNG) ou PDF do boleto bancário.')
      return
    }

    setArquivo(file)
    setIsPdf(isFilePdf)

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    setEtapa('analisando')
    setErroAnalise(null)

    try {
      const extraido = await extrairDadosBoleto(file)
      setDadosExtraidos(extraido)

      // Pré-preenche os campos conferíveis
      setBeneficiario(extraido.beneficiario_fornecedor || '')
      setCnpjCpf(extraido.cnpj_cpf_beneficiario || '')
      setLinhaDigitavel(extraido.linha_digitavel || extraido.codigo_barras || '')
      setNumeroDoc(extraido.numero_documento || '')

      const docVal = extraido.valor_documento || extraido.valor_cobrado || 0
      setValorDoc(docVal ? String(docVal) : '')
      setValorDesconto(extraido.valor_desconto ? String(extraido.valor_desconto) : '0')
      setValorJurosMulta(extraido.valor_juros_multa ? String(extraido.valor_juros_multa) : '0')

      if (extraido.data_vencimento) {
        setVencimento(extraido.data_vencimento.slice(0, 10))
      } else {
        setVencimento(new Date().toISOString().slice(0, 10))
      }

      setDescricao(
        extraido.beneficiario_fornecedor
          ? `Boleto - ${extraido.beneficiario_fornecedor}`
          : `Boleto a pagar (${file.name})`,
      )

      const catSugerida = extraido.categoria_sugerida || 'despesas_operacionais'
      setCategoria(catSugerida)

      if (extraido.plano_contas_codigo) {
        setPlanoContasCodigo(extraido.plano_contas_codigo)
        setPlanoContasNome(extraido.plano_contas_nome || 'Despesas Gerais')
      } else {
        const itemPlano = sugerirPlanoContasPorCategoria(catSugerida)
        setPlanoContasCodigo(itemPlano.codigo)
        setPlanoContasNome(itemPlano.nome)
      }

      if (extraido.instrucoes_resumo) {
        setObservacoes(extraido.instrucoes_resumo)
      }

      setEtapa('conferencia')
      toast.success('Boleto analisado com sucesso pela IA do CRM AEROCAD!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErroAnalise(msg)
      setEtapa('conferencia')
      // Fallback manual
      setBeneficiario(file.name.replace(/\.[^/.]+$/, ''))
      setDescricao(`Boleto (${file.name})`)
      setVencimento(new Date().toISOString().slice(0, 10))
      toast.warning('A extração automática teve limitações. Preencha os campos manualmente.')
    }
  }

  function handlePlanoContasChange(codigo: string) {
    const item = PLANO_CONTAS_AEROCAD.find((p) => p.codigo === codigo)
    if (item) {
      setPlanoContasCodigo(item.codigo)
      setPlanoContasNome(item.nome)
    }
  }

  async function handleSalvarContaPagar() {
    if (!beneficiario.trim()) {
      toast.error('Informe o fornecedor / beneficiário do boleto.')
      return
    }

    if (!valorDoc || parseFloat(valorDoc) <= 0) {
      toast.error('Informe um valor de documento válido.')
      return
    }

    if (!vencimento) {
      toast.error('Informe a data de vencimento do boleto.')
      return
    }

    if (!arquivo) {
      toast.error('Arquivo do boleto não encontrado.')
      return
    }

    setEtapa('salvando')

    try {
      await salvarContaPagarComComprovante({
        descricao: descricao.trim() || `Boleto - ${beneficiario}`,
        fornecedor: beneficiario.trim(),
        categoria,
        valor: valorLiquidoFinal,
        data_vencimento: vencimento,
        forma_pagamento: 'boleto',
        numero_documento: numeroDoc || undefined,
        projetoId: projetoId || null,
        observacoes: [
          observacoes,
          linhaDigitavel ? `Linha Digitável: ${linhaDigitavel}` : null,
          `Conta Bancária PJ: ${contasBancarias.find((c) => c.id === contaBancariaId)?.apelido || 'Não associada'}`,
        ]
          .filter(Boolean)
          .join('\n'),
        arquivoComprovante: arquivo,
        codigo_barras_linha_digitavel: linhaDigitavel,
        cnpj_cpf_beneficiario: cnpjCpf,
        valor_desconto: parseFloat(valorDesconto) || 0,
        valor_juros_multa: parseFloat(valorJurosMulta) || 0,
        plano_contas_codigo: planoContasCodigo,
        plano_contas_nome: planoContasNome,
        conta_bancaria: contaBancariaId || undefined,
      })

      toast.success('Conta a pagar cadastrada com boleto anexado e classificação contábil!')
      onContaCriada()
      onOpenChange(false)
      resetarModal()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao salvar conta a pagar: ${msg}`)
      setEtapa('conferencia')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetarModal()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded bg-amber-500/10 text-[#FF6A13]">
              <Barcode className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-neutral-900">
                Extrair Dados de Boleto Bancário (PDF ou Foto)
              </DialogTitle>
              <p className="text-xs text-neutral-500">
                Leitura inteligente de linha digitável, código de barras, valores e classificação
                contábil via IA Skip Cloud
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ETAPA 1: UPLOAD OU CAPTURA */}
        {etapa === 'upload' && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border-2 border-dashed border-neutral-300 hover:border-[#FF6A13] transition p-8 text-center bg-neutral-50/50">
              <input
                id={uploadInputId}
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) processarArquivoSelecionado(file)
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) processarArquivoSelecionado(file)
                }}
              />

              <div className="flex justify-center mb-3">
                <span className="p-3 rounded-full bg-neutral-100 text-[#FF6A13]">
                  <Barcode className="h-8 w-8" />
                </span>
              </div>

              <h4 className="font-semibold text-neutral-800 text-sm mb-1">
                Selecione o Boleto em PDF ou tire uma foto do documento impresso
              </h4>
              <p className="text-xs text-neutral-500 max-w-md mx-auto mb-5">
                O agente nativo identifica a linha digitável (47/48 dígitos), o beneficiário/CNPJ, a
                data de vencimento, valores de desconto e classifica contabilmente a despesa.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs"
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  Carregar Arquivo (PDF ou Imagem)
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => cameraInputRef.current?.click()}
                  className="text-xs border-neutral-300"
                >
                  <Camera className="h-4 w-4 mr-1.5" />
                  Fotografar Boleto
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-neutral-500">
              <div className="p-2.5 rounded bg-neutral-100/70 border border-neutral-200">
                <strong className="block text-neutral-700 mb-0.5">Formatos Aceitos</strong>
                PDF nativo ou escaneado, fotos em JPG, PNG ou WEBP.
              </div>
              <div className="p-2.5 rounded bg-neutral-100/70 border border-neutral-200">
                <strong className="block text-neutral-700 mb-0.5">Leitura de Código</strong>
                Identificação do código de barras e preenchimento automático.
              </div>
              <div className="p-2.5 rounded bg-neutral-100/70 border border-neutral-200">
                <strong className="block text-neutral-700 mb-0.5">Conferência Lado a Lado</strong>
                Você sempre revisa e edita todos os dados antes de gravar.
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 2: PROCESSANDO IA */}
        {etapa === 'analisando' && (
          <div className="py-12 text-center space-y-4">
            <div className="inline-flex items-center justify-center p-4 rounded-full bg-amber-50 text-[#FF6A13] animate-pulse">
              <Sparkles className="h-10 w-10 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-800">
                Agente Contábil analisando boleto...
              </h4>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Extraindo beneficiário, CNPJ, linha digitável, vencimento e sugerindo a
                classificação contábil apropriada.
              </p>
            </div>
          </div>
        )}

        {/* ETAPA 3: CONFERÊNCIA LADO A LADO */}
        {etapa === 'conferencia' && (
          <div className="space-y-4 py-2">
            {erroAnalise && (
              <Alert variant="destructive" className="py-2 text-xs">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-xs font-semibold">Aviso de Leitura</AlertTitle>
                <AlertDescription className="text-xs">
                  {erroAnalise}. Os campos abaixo estão abertos para conferência e preenchimento
                  manual.
                </AlertDescription>
              </Alert>
            )}

            {dadosExtraidos && dadosExtraidos.confianca === 'alta' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Boleto identificado com <strong>alta precisão</strong>. Confira os dados ao lado
                  antes de criar a conta a pagar.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Painel Esquerdo: Visualização do Documento Anexo */}
              <div className="lg:col-span-5 flex flex-col rounded-lg border border-neutral-200 bg-neutral-900 overflow-hidden min-h-[380px] max-h-[560px]">
                <div className="p-2 bg-neutral-800 text-neutral-300 text-xs flex items-center justify-between border-b border-neutral-700">
                  <span className="flex items-center gap-1.5 truncate">
                    <FileText className="h-3.5 w-3.5 text-neutral-400" />
                    <span className="truncate">{arquivo?.name}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-neutral-300 hover:text-white"
                    onClick={() => {
                      setEtapa('upload')
                      setArquivo(null)
                    }}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Trocar
                  </Button>
                </div>

                <div className="flex-1 flex items-center justify-center p-2 bg-neutral-950 overflow-auto">
                  {previewUrl && !isPdf && (
                    <img
                      src={previewUrl}
                      alt="Boleto enviado"
                      className="max-w-full max-h-[500px] object-contain rounded"
                    />
                  )}
                  {previewUrl && isPdf && (
                    <iframe
                      src={previewUrl}
                      title="Pré-visualização do Boleto PDF"
                      className="w-full h-full min-h-[460px] border-0 rounded bg-white"
                    />
                  )}
                </div>
              </div>

              {/* Painel Direito: Campos Editáveis */}
              <div className="lg:col-span-7 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Beneficiário / Favorecido *</Label>
                    <Input
                      value={beneficiario}
                      onChange={(e) => setBeneficiario(e.target.value)}
                      placeholder="Ex: Concessionária Aeroportuária, CREA, Fornecedor"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">CNPJ / CPF do Beneficiário</Label>
                    <Input
                      value={cnpjCpf}
                      onChange={(e) => setCnpjCpf(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>Linha Digitável / Código de Barras (47 ou 48 dígitos)</span>
                    <Barcode className="h-3.5 w-3.5 text-neutral-400" />
                  </Label>
                  <Input
                    value={linhaDigitavel}
                    onChange={(e) => setLinhaDigitavel(e.target.value)}
                    placeholder="34191.79001 01043.510047 91020.150008 5 890000000000"
                    className="h-8 text-xs font-mono text-neutral-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-xs font-semibold">Nº Doc / Nosso Nº</Label>
                    <Input
                      value={numeroDoc}
                      onChange={(e) => setNumeroDoc(e.target.value)}
                      placeholder="Doc / Título"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-xs font-semibold">Valor Nominal *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={valorDoc}
                      onChange={(e) => setValorDoc(e.target.value)}
                      placeholder="0,00"
                      className="h-8 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-xs">Desconto (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={valorDesconto}
                      onChange={(e) => setValorDesconto(e.target.value)}
                      className="h-8 text-xs font-mono text-emerald-700"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-xs">Juros/Multa (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={valorJurosMulta}
                      onChange={(e) => setValorJurosMulta(e.target.value)}
                      className="h-8 text-xs font-mono text-rose-700"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded bg-neutral-100 border border-neutral-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-700">Valor Líquido Previsto:</span>
                  <span className="text-base font-bold text-neutral-900 font-mono">
                    R$ {formatCurrencyRaw(valorLiquidoFinal)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                      Data de Vencimento *
                    </Label>
                    <Input
                      type="date"
                      value={vencimento}
                      onChange={(e) => setVencimento(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5 text-neutral-400" />
                      Conta Bancária PJ AEROCAD *
                    </Label>
                    <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione a conta..." />
                      </SelectTrigger>
                      <SelectContent>
                        {contasBancarias.map((cb) => (
                          <SelectItem key={cb.id} value={cb.id}>
                            {cb.apelido} ({cb.banco_nome})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* CLASSIFICAÇÃO CONTÁBIL (SEMPRE EDITÁVEL) */}
                <div className="p-3 rounded-lg border border-amber-300/80 bg-amber-50/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-[#FF6A13]" />
                      Classificação Contábil & Categoria
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 font-medium">
                      Sugerido pela IA (Sempre Editável)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-neutral-600">Categoria Operacional</Label>
                      <Select
                        value={categoria}
                        onValueChange={(val: any) => {
                          setCategoria(val)
                          const item = sugerirPlanoContasPorCategoria(val)
                          setPlanoContasCodigo(item.codigo)
                          setPlanoContasNome(item.nome)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="despesas_operacionais">
                            Despesas Operacionais
                          </SelectItem>
                          <SelectItem value="terceirizados">Terceirizados & Honorários</SelectItem>
                          <SelectItem value="impostos">Impostos & Tributos</SelectItem>
                          <SelectItem value="equipamentos">Equipamentos & Softwares</SelectItem>
                          <SelectItem value="folha">Pessoal & Folha</SelectItem>
                          <SelectItem value="outros">Outros Custos / Tarifas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-neutral-600">
                        Plano de Contas (Engenharia Consultiva)
                      </Label>
                      <Select value={planoContasCodigo} onValueChange={handlePlanoContasChange}>
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {PLANO_CONTAS_AEROCAD.map((item) => (
                            <SelectItem key={item.codigo} value={item.codigo}>
                              {item.codigo} - {item.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs">Projeto para Custeio (Opcional)</Label>
                    <Select
                      value={projetoId || 'nenhum'}
                      onValueChange={(val) => setProjetoId(val === 'nenhum' ? '' : val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Despesa Geral (Sem projeto)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Sem projeto (Despesa geral)</SelectItem>
                        {projetos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.numero} · {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Descrição Resumida</Label>
                    <Input
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Descrição da conta a pagar"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Instruções / Observações do Boleto</Label>
                  <Textarea
                    rows={2}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Observações adicionais ou instruções de recebimento..."
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancelar
          </Button>

          {etapa === 'conferencia' && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEtapa('upload')
                  setArquivo(null)
                }}
                className="text-xs"
              >
                Voltar
              </Button>
              <Button
                type="button"
                onClick={handleSalvarContaPagar}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs font-semibold"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Gravar Conta a Pagar com Boleto
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
