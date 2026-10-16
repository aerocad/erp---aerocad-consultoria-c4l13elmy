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
  Plus,
} from 'lucide-react'
import {
  extrairDadosBoleto,
  salvarContaPagarComComprovante,
  consultarQrCodeFiscalBackend,
  type BoletoExtraido,
  type ComprovanteExtraido,
} from '@/services/comprovantesVision'
import { escanearQrCodeDocumento } from '@/services/qrFiscalScanner'
import {
  formatarResumoDanfeParaAreaTransferencia,
  imprimirDanfeSimplificado,
} from '@/services/danfeSimplificadoBuilder'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { PLANO_CONTAS_AEROCAD, sugerirPlanoContasPorCategoria } from '@/lib/planoContas'
import { formatCurrencyRaw } from '@/lib/format'
import { toast } from 'sonner'
import type { ProjetoRecord, ContaBancariaRecord, CredorRecord } from '@/types/crm'
import { salvarCredor, CATEGORIA_CREDOR_LABELS } from '@/services/credores'
import { Copy, Printer } from 'lucide-react'

export interface CapturaBoletoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projetos: ProjetoRecord[]
  contasBancarias: ContaBancariaRecord[]
  credores?: CredorRecord[]
  openModalNovoCredor?: () => void
  onContaCriada: () => void
}

type EtapaCaptura = 'upload' | 'analisando' | 'conferencia' | 'salvando'

export function CapturaBoletoModal({
  open,
  onOpenChange,
  projetos,
  contasBancarias,
  credores = [],
  onContaCriada,
}: CapturaBoletoModalProps) {
  const { podeVerValores } = useFinanceiroVisibilidade()
  const [etapa, setEtapa] = useState<EtapaCaptura>('upload')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPdf, setIsPdf] = useState(false)
  const [dadosExtraidos, setDadosExtraidos] = useState<BoletoExtraido | null>(null)
  const [erroAnalise, setErroAnalise] = useState<string | null>(null)
  const [modoEssencialAtivo, setModoEssencialAtivo] = useState<boolean>(false)
  const [infoInferencia, setInfoInferencia] = useState<{
    segmento?: string
    descricao_produto_inferido?: string
    termo_detectado?: string
  } | null>(null)

  // Integração com Credores
  const [credorId, setCredorId] = useState<string>('')
  const [mostrarCadastroCredor, setMostrarCadastroCredor] = useState(false)
  const [salvandoCredorRapido, setSalvandoCredorRapido] = useState(false)

  // Chave de acesso / série fiscal quando documento possuir QR fiscal / DANFE
  const [chaveAcesso, setChaveAcesso] = useState('')
  const [serieDoc, setSerieDoc] = useState('')

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
    setChaveAcesso('')
    setSerieDoc('')
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
    setCredorId('')
    setMostrarCadastroCredor(false)
    setModoEssencialAtivo(false)
    setInfoInferencia(null)
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

    await executarExtracaoBoleto(file)
  }

  async function executarExtracaoBoleto(file: File) {
    setEtapa('analisando')
    setErroAnalise(null)

    try {
      // 1. Tentar varredura prévia de QR fiscal (DANFE / NFC-e / SAT)
      let qrFiscalLido = false
      let dadosQrBackend: ComprovanteExtraido | null = null
      let avisoQrPortal: string | null = null

      try {
        const resultadoQr = await escanearQrCodeDocumento(file)
        if (resultadoQr.sucesso && resultadoQr.qrEncontrado && resultadoQr.conteudoBruto) {
          qrFiscalLido = true
          const consultaBackend = await consultarQrCodeFiscalBackend(resultadoQr.conteudoBruto)
          if (consultaBackend && consultaBackend.dados) {
            dadosQrBackend = consultaBackend.dados
            if (consultaBackend.chave_acesso) setChaveAcesso(consultaBackend.chave_acesso)
            if (consultaBackend.aviso_portal) avisoQrPortal = consultaBackend.aviso_portal
          }
        }
      } catch (qrErr) {
        console.warn('Varredura de QR Code em boleto não encontrou QR fiscal:', qrErr)
      }

      const extraido = await extrairDadosBoleto(file)
      setDadosExtraidos(extraido)

      // Ativa Modo Essencial se marcado ou se tiver campos essenciais com leitura parcial
      const temDadoVitalBoleto =
        Boolean(extraido.beneficiario_fornecedor || extraido.cnpj_cpf_beneficiario) ||
        extraido.valor_documento > 0 ||
        extraido.valor_cobrado > 0 ||
        Boolean(extraido.data_vencimento)
      const leituraParcialBoleto =
        Boolean(extraido.modo_essencial) ||
        (temDadoVitalBoleto && (!extraido.linha_digitavel || extraido.linha_digitavel.length < 20))

      setModoEssencialAtivo(leituraParcialBoleto)
      if (extraido.inferencia_categoria) {
        setInfoInferencia(extraido.inferencia_categoria)
      } else {
        setInfoInferencia(null)
      }

      // Pré-preenche os campos conferíveis, mesclando dados do QR Code se houver
      const fornFinal = dadosQrBackend?.fornecedor || extraido.beneficiario_fornecedor || ''
      const cnpjFinal = dadosQrBackend?.cnpj_cpf || extraido.cnpj_cpf_beneficiario || ''
      const numFinal = dadosQrBackend?.numero_documento || extraido.numero_documento || ''
      if (dadosQrBackend?.serie) setSerieDoc(dadosQrBackend.serie)
      if (dadosQrBackend?.chave_acesso) setChaveAcesso(dadosQrBackend.chave_acesso)

      setBeneficiario(fornFinal)
      setCnpjCpf(cnpjFinal)
      setLinhaDigitavel(extraido.linha_digitavel || extraido.codigo_barras || '')
      setNumeroDoc(numFinal)

      const docVal =
        extraido.valor_documento || extraido.valor_cobrado || dadosQrBackend?.valor_total || 0
      setValorDoc(docVal ? String(docVal) : '')
      setValorDesconto(extraido.valor_desconto ? String(extraido.valor_desconto) : '0')
      setValorJurosMulta(extraido.valor_juros_multa ? String(extraido.valor_juros_multa) : '0')

      if (extraido.data_vencimento) {
        setVencimento(extraido.data_vencimento.slice(0, 10))
      } else if (dadosQrBackend?.data_emissao) {
        setVencimento(dadosQrBackend.data_emissao.slice(0, 10))
      } else {
        setVencimento(new Date().toISOString().slice(0, 10))
      }

      setDescricao(fornFinal ? `Boleto - ${fornFinal}` : `Boleto a pagar (${file.name})`)

      const catSugerida =
        dadosQrBackend?.categoria_sugerida || extraido.categoria_sugerida || 'despesas_operacionais'
      setCategoria(catSugerida)

      if (extraido.plano_contas_codigo) {
        setPlanoContasCodigo(extraido.plano_contas_codigo)
        setPlanoContasNome(extraido.plano_contas_nome || 'Despesas Gerais')
      } else if (dadosQrBackend?.plano_contas_codigo) {
        setPlanoContasCodigo(dadosQrBackend.plano_contas_codigo)
        setPlanoContasNome(dadosQrBackend.plano_contas_nome || 'Despesas Gerais')
      } else {
        const itemPlano = sugerirPlanoContasPorCategoria(catSugerida)
        setPlanoContasCodigo(itemPlano.codigo)
        setPlanoContasNome(itemPlano.nome)
      }

      if (extraido.instrucoes_resumo) {
        setObservacoes(extraido.instrucoes_resumo)
      }

      // Verificação automática se já existe credor cadastrado com este CNPJ/CPF ou nome
      const docLimpo = cnpjFinal.replace(/\D/g, '')
      const nomeLimpo = fornFinal.trim().toLowerCase()

      const credorEncontrado = credores.find((c) => {
        const cDoc = (c.cpf_cnpj || c.cnpj_cpf || '').replace(/\D/g, '')
        if (docLimpo && cDoc && docLimpo === cDoc) return true
        const cNome = (c.nome || c.nome_razao_social || '').toLowerCase()
        const cFantasia = (c.nome_fantasia || '').toLowerCase()
        if (nomeLimpo && (cNome.includes(nomeLimpo) || nomeLimpo.includes(cNome))) return true
        if (
          nomeLimpo &&
          cFantasia &&
          (cFantasia.includes(nomeLimpo) || nomeLimpo.includes(cFantasia))
        )
          return true
        return false
      })

      if (credorEncontrado) {
        setCredorId(credorEncontrado.id)
        setMostrarCadastroCredor(false)
      } else {
        setCredorId('')
        setMostrarCadastroCredor(true) // Oferece o cadastro facilitado
      }

      setEtapa('conferencia')
      if (avisoQrPortal) {
        setErroAnalise(
          `QR Code fiscal detectado no boleto. Portal SEFAZ requer conferência manual: ${avisoQrPortal}. Confira os dados pré-preenchidos.`,
        )
      } else if (extraido.sucesso === false && !qrFiscalLido) {
        setErroAnalise(
          extraido.erro ||
            'Não foi possível ler o boleto — aproxime a câmera, garanta boa iluminação ou anexe o PDF com código de barras nítido.',
        )
      } else {
        toast.success(
          qrFiscalLido
            ? 'Boleto/DANFE analisado com auxílio do QR Code fiscal!'
            : 'Boleto analisado com sucesso pela IA do CRM AEROCAD!',
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErroAnalise(
        'Não foi possível ler o documento — aproxime a câmera, garanta boa iluminação ou anexe o PDF.',
      )
      setEtapa('conferencia')
      // Fallback manual
      setBeneficiario(file.name.replace(/\.[^/.]+$/, ''))
      setDescricao(`Boleto (${file.name})`)
      setVencimento(new Date().toISOString().slice(0, 10))
      toast.warning(
        'A extração automática teve limitações. Preencha os campos manualmente ou tente reprocessar.',
      )
    }
  }

  // Copiar resumo estruturado do DANFE/boleto para área de transferência
  async function handleCopiarResumoDanfe() {
    try {
      const dadosParaResumo: ComprovanteExtraido = {
        sucesso: true,
        tipo_documento: 'boleto',
        fornecedor: beneficiario,
        cnpj_cpf: cnpjCpf,
        numero_documento: numeroDoc,
        serie: serieDoc,
        chave_acesso: chaveAcesso,
        data_emissao: vencimento,
        valor_total: valorLiquidoFinal,
        valor_impostos: null,
        forma_pagamento_sugerida: 'boleto',
        categoria_sugerida: categoria,
        plano_contas_codigo: planoContasCodigo,
        plano_contas_nome: planoContasNome,
        descricao_itens: descricao,
        observacoes: [observacoes, linhaDigitavel ? `Linha Digitável: ${linhaDigitavel}` : '']
          .filter(Boolean)
          .join(' | '),
        confianca: 'alta',
      }
      const texto = formatarResumoDanfeParaAreaTransferencia(dadosParaResumo, podeVerValores)
      await navigator.clipboard.writeText(texto)
      toast.success('Resumo do documento copiado para a área de transferência!')
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível copiar para a área de transferência.')
    }
  }

  // Imprimir DANFE simplificado A4
  function handleImprimirDanfeSimplificado() {
    try {
      const dadosParaImpressao: ComprovanteExtraido = {
        sucesso: true,
        tipo_documento: 'boleto',
        fornecedor: beneficiario,
        cnpj_cpf: cnpjCpf,
        numero_documento: numeroDoc,
        serie: serieDoc,
        chave_acesso: chaveAcesso,
        data_emissao: vencimento,
        valor_total: valorLiquidoFinal,
        valor_impostos: null,
        forma_pagamento_sugerida: 'boleto',
        categoria_sugerida: categoria,
        plano_contas_codigo: planoContasCodigo,
        plano_contas_nome: planoContasNome,
        descricao_itens: descricao,
        observacoes: [observacoes, linhaDigitavel ? `Linha Digitável: ${linhaDigitavel}` : '']
          .filter(Boolean)
          .join(' | '),
        confianca: 'alta',
      }
      imprimirDanfeSimplificado(dadosParaImpressao, podeVerValores)
      toast.info('Abrindo visualização de impressão do DANFE Simplificado...')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao gerar visualização do DANFE Simplificado.')
    }
  }

  async function handleReprocessarMesmoBoleto() {
    if (!arquivo) {
      toast.error('Nenhum boleto carregado.')
      return
    }
    toast.info('Reprocessando o mesmo boleto com realce visual...')
    await executarExtracaoBoleto(arquivo)
  }

  function handlePlanoContasChange(codigo: string) {
    const item = PLANO_CONTAS_AEROCAD.find((p) => p.codigo === codigo)
    if (item) {
      setPlanoContasCodigo(item.codigo)
      setPlanoContasNome(item.nome)
    }
  }

  async function handleCadastrarCredorRapido() {
    if (!beneficiario.trim()) {
      toast.error('Informe a razão social ou nome do credor.')
      return
    }
    if (!cnpjCpf.trim()) {
      toast.error('Informe o CNPJ ou CPF do credor.')
      return
    }

    setSalvandoCredorRapido(true)
    try {
      const docLimpo = cnpjCpf.replace(/\D/g, '')
      const tipo_pessoa = docLimpo.length > 11 ? 'pj' : 'pf'

      const novo = await salvarCredor({
        nome_razao_social: beneficiario.trim(),
        cnpj_cpf: cnpjCpf.trim(),
        tipo_pessoa,
        categoria:
          categoria === 'impostos'
            ? 'impostos_orgaos_publicos'
            : categoria === 'folha'
              ? 'folha_encargos'
              : categoria === 'terceirizados'
                ? 'fornecedor_servicos'
                : 'outros',
        banco_nome: '',
        chave_pix: '',
        status: 'ativo',
        observacoes: `Cadastrado a partir do boleto: ${arquivo?.name || ''}`,
      })

      setCredorId(novo.id)
      setMostrarCadastroCredor(false)
      toast.success(`Credor "${novo.nome_razao_social}" cadastrado com sucesso e vinculado!`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao cadastrar credor: ${msg}`)
    } finally {
      setSalvandoCredorRapido(false)
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
        credorId: credorId || null,
        observacoes: [
          observacoes,
          linhaDigitavel ? `Linha Digitável: ${linhaDigitavel}` : null,
          chaveAcesso ? `Chave de Acesso Fiscal: ${chaveAcesso}` : null,
          serieDoc ? `Série Fiscal: ${serieDoc}` : null,
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
            <span className="p-2 rounded bg-amber-500/10 text-amber-700">
              <Barcode className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <span>Extrair Dados de Boleto Bancário</span>
                <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Boleto (Documento de Cobrança)
                </span>
              </DialogTitle>
              <p className="text-xs text-neutral-500">
                Leitura de linha digitável, código de barras e valores para emissão da conta a pagar
                pendente
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
            {/* Banner Discreto de Leitura Essencial */}
            {modoEssencialAtivo && (
              <div className="p-3 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-blue-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-blue-900">
                      Leitura parcial — dados essenciais extraídos
                    </span>
                    <span className="text-[11px] text-blue-800">
                      Os 5 campos essenciais (data, valor, forma de pagamento,
                      estabelecimento/beneficiário e CNPJ) foram extraídos e a categoria inferida.
                      Confira e complete os demais campos.
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleReprocessarMesmoBoleto}
                  className="h-7 text-xs bg-white text-blue-950 border-blue-300 hover:bg-blue-100 shrink-0 font-semibold"
                >
                  <RotateCcw className="h-3 w-3 mr-1 text-[#FF6A13]" />
                  Reprocessar mesma foto
                </Button>
              </div>
            )}

            {erroAnalise && !modoEssencialAtivo && (
              <Alert
                variant="destructive"
                className="py-2.5 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <AlertTitle className="text-xs font-semibold">
                      Aviso de Leitura do Boleto
                    </AlertTitle>
                    <AlertDescription className="text-xs">{erroAnalise}</AlertDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleReprocessarMesmoBoleto}
                  className="h-7 text-xs bg-white text-rose-900 border-rose-300 hover:bg-rose-50 shrink-0 font-semibold"
                >
                  <RotateCcw className="h-3 w-3 mr-1 text-[#FF6A13]" />
                  Reprocessar mesma foto
                </Button>
              </Alert>
            )}

            {/* DESTAQUE DOS 5 CAMPOS ESSENCIAIS NO TOPO DO PAINEL DE CONFERÊNCIA */}
            <div className="p-3 rounded-xl border border-orange-200 bg-orange-50/50 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[#FF6A13]" />
                  Campos Essenciais Extraídos (Prioridade Contábil)
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-orange-800 border border-orange-200">
                  {modoEssencialAtivo ? 'Modo Essencial' : 'Conferência Rápida'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {/* 1. Data */}
                <div className="p-2 rounded-lg bg-white border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <span className="text-[10px] text-neutral-500 font-medium block">
                    1. Vencimento / Data
                  </span>
                  <span
                    className="font-bold text-neutral-900 font-mono text-xs truncate block"
                    title={vencimento}
                  >
                    {vencimento ? vencimento.split('-').reverse().join('/') : '—'}
                  </span>
                </div>
                {/* 2. Valor */}
                <div className="p-2 rounded-lg bg-white border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <span className="text-[10px] text-neutral-500 font-medium block">
                    2. Valor Previsto
                  </span>
                  <span
                    className="font-bold text-[#FF6A13] font-mono text-xs truncate block"
                    title={String(valorLiquidoFinal)}
                  >
                    {podeVerValores ? `R$ ${valorLiquidoFinal.toFixed(2)}` : '••••'}
                  </span>
                </div>
                {/* 3. Forma de Pagamento */}
                <div className="p-2 rounded-lg bg-white border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <span className="text-[10px] text-neutral-500 font-medium block">
                    3. Forma Pagto
                  </span>
                  <span
                    className="font-semibold text-neutral-800 uppercase text-[11px] truncate block"
                    title="BOLETO BANCÁRIO"
                  >
                    BOLETO
                  </span>
                </div>
                {/* 4. Estabelecimento / Beneficiário */}
                <div className="p-2 rounded-lg bg-white border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] col-span-1 sm:col-span-1">
                  <span className="text-[10px] text-neutral-500 font-medium block">
                    4. Favorecido / Beneficiário
                  </span>
                  <span
                    className="font-semibold text-neutral-900 text-[11px] truncate block"
                    title={beneficiario}
                  >
                    {beneficiario || '—'}
                  </span>
                </div>
                {/* 5. CNPJ */}
                <div className="p-2 rounded-lg bg-white border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-neutral-500 font-medium block">
                    5. CNPJ Beneficiário
                  </span>
                  <span
                    className="font-semibold text-neutral-700 font-mono text-[11px] truncate block"
                    title={cnpjCpf}
                  >
                    {cnpjCpf || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Faixa explícita de distinção de natureza: Boleto de cobrança vs Comprovante de quitação */}
            <div className="p-2.5 rounded-lg border border-amber-300 bg-amber-50/70 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <Barcode className="h-4 w-4 text-amber-700" />
                  <span>Boleto Bancário (Documento de Cobrança / A Pagar)</span>
                </div>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-200/80 text-amber-900">
                  Status: Pendente
                </span>
              </div>
              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                💡 <strong>Diferença essencial:</strong> Este boleto é um{' '}
                <em>título de cobrança</em> com linha digitável e vencimento futuro. O{' '}
                <strong>comprovante de quitação</strong> (PIX/TED/recibo) deve ser anexado após a
                liquidação do pagamento bancário.
              </p>
            </div>

            {dadosExtraidos && dadosExtraidos.confianca === 'alta' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Linha digitável e dados do boleto lidos com <strong>alta precisão</strong> pela IA
                  AEROCAD. Confira os campos antes de gravar.
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
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-[#FF6A13] hover:text-orange-300 font-semibold"
                      onClick={handleReprocessarMesmoBoleto}
                      title="Reprocessar este mesmo boleto ou DANFE com IA e QR Code"
                    >
                      <RotateCcw className="h-3 w-3 mr-1 text-[#FF6A13]" />
                      Reprocessar
                    </Button>
                    <span className="text-neutral-500">|</span>
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
                      Trocar
                    </Button>
                  </div>
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
                {/* Bloco de Integração com Credores */}
                <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-[#FF6A13]" />
                      Vínculo com Cadastro de Credores
                    </span>
                    {credorId ? (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Credor Vinculado
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Credor não vinculado
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-8">
                      <Select
                        value={credorId || 'nenhum'}
                        onValueChange={(val) => {
                          if (val === 'nenhum') {
                            setCredorId('')
                            setMostrarCadastroCredor(true)
                          } else {
                            setCredorId(val)
                            setMostrarCadastroCredor(false)
                            const selecionado = credores.find((c) => c.id === val)
                            if (selecionado) {
                              setBeneficiario(selecionado.nome_razao_social)
                              setCnpjCpf(selecionado.cnpj_cpf)
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue placeholder="Selecione um credor cadastrado..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          <SelectItem value="nenhum">
                            Nenhum vínculo (Criar novo ou avulso)
                          </SelectItem>
                          {credores.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome_razao_social} ({c.cnpj_cpf})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-4">
                      {!credorId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={salvandoCredorRapido}
                          onClick={handleCadastrarCredorRapido}
                          className="w-full h-8 text-[11px] font-semibold text-[#D65100] border-orange-300 hover:bg-orange-100"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          {salvandoCredorRapido ? 'Salvando...' : 'Cadastrar Credor'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {mostrarCadastroCredor && !credorId && beneficiario && (
                    <p className="text-[11px] text-neutral-600 bg-white/70 p-1.5 rounded border border-orange-100">
                      💡 <strong>Sugestão:</strong> O beneficiário <em>"{beneficiario}"</em> ainda
                      não está na base de credores. Clique em <strong>Cadastrar Credor</strong> para
                      salvar seus dados e vincular a esta conta automaticamente.
                    </p>
                  )}
                </div>

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

                {chaveAcesso && (
                  <div className="space-y-1 p-2 rounded border border-orange-200 bg-orange-50/50">
                    <Label className="text-xs font-semibold text-neutral-800 flex items-center justify-between">
                      <span>Chave de Acesso Fiscal (44 dígitos)</span>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {chaveAcesso.length} dígitos
                      </span>
                    </Label>
                    <Input
                      value={chaveAcesso}
                      onChange={(e) => setChaveAcesso(e.target.value)}
                      placeholder="Chave de 44 dígitos"
                      className="h-8 text-xs font-mono bg-white"
                    />
                  </div>
                )}

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
                      {infoInferencia
                        ? 'sugerido pelo estabelecimento'
                        : 'Sugerido pela IA (Sempre Editável)'}
                    </span>
                  </div>

                  {infoInferencia && (
                    <div className="px-2 py-1 rounded bg-orange-100/60 border border-orange-200 text-[11px] text-orange-950 flex items-center justify-between">
                      <span>
                        Inferência: <strong>{infoInferencia.segmento}</strong> (
                        {infoInferencia.descricao_produto_inferido})
                      </span>
                      <span className="text-[10px] text-orange-800 font-medium">
                        sugerido pelo estabelecimento
                      </span>
                    </div>
                  )}

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
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopiarResumoDanfe}
                className="h-8 text-xs"
                title="Copiar resumo estruturado para a área de transferência"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5 text-neutral-600" />
                Copiar dados
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleImprimirDanfeSimplificado}
                className="h-8 text-xs text-[#FF6A13] border-orange-200 hover:bg-orange-50"
                title="Gerar DANFE Simplificado A4 com carimbo informativo"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Gerar DANFE simplificado
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEtapa('upload')
                  setArquivo(null)
                }}
                className="text-xs h-8"
              >
                Voltar
              </Button>

              <Button
                type="button"
                onClick={handleSalvarContaPagar}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs font-semibold h-8"
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
