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
  consultarQrCodeFiscalBackend,
  TIPO_DOC_LABELS,
  type ComprovanteExtraido,
  type TipoDocumentoFiscal,
} from '@/services/comprovantesVision'
import { escanearQrCodeDocumento } from '@/services/qrFiscalScanner'
import {
  formatarResumoDanfeParaAreaTransferencia,
  imprimirDanfeSimplificado,
} from '@/services/danfeSimplificadoBuilder'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { salvarCredor } from '@/services/credores'
import { PLANO_CONTAS_AEROCAD, sugerirPlanoContasPorCategoria } from '@/lib/planoContas'
import type { ProjetoRecord, CredorRecord, ContaBancariaRecord } from '@/types/crm'
import { Building2, Copy, Printer, Plus, CheckCircle2 } from 'lucide-react'

import type { ContaPagarRecord } from '@/types/crm'
import { atualizarContaPagarComComprovante } from '@/services/comprovantesVision'
import { obterDocumentosSegregados } from '@/services/documentosContasPagar'

interface CapturaComprovanteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projetos: ProjetoRecord[]
  contasBancarias?: ContaBancariaRecord[]
  credores?: CredorRecord[]
  isMobile: boolean
  contaEdicao?: ContaPagarRecord | null
  onSuccess: () => Promise<void> | void
}

export function CapturaComprovanteModal({
  open,
  onOpenChange,
  projetos,
  contasBancarias = [],
  credores = [],
  isMobile,
  contaEdicao = null,
  onSuccess,
}: CapturaComprovanteModalProps) {
  const { user } = useAuth()
  const { podeVerValores } = useFinanceiroVisibilidade()

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

  // Integração com Credores
  const [credorId, setCredorId] = useState<string>('')
  const [mostrarCadastroCredor, setMostrarCadastroCredor] = useState(false)
  const [salvandoCredorRapido, setSalvandoCredorRapido] = useState(false)

  // Dados fiscais adicionais (chave 44, série, etc.)
  const [chaveAcesso, setChaveAcesso] = useState<string>('')

  // Campos essenciais enxutos (1: Estabelecimento, 2: CNPJ, 3: Data, 4: Valor Total, 5: Forma de Pagamento)
  const [tipoDoc, setTipoDoc] = useState<TipoDocumentoFiscal>('cupom_fiscal')
  const [fornecedor, setFornecedor] = useState('')
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().slice(0, 10))
  const [valorTotal, setValorTotal] = useState<number | ''>('')
  const [formaPagamento, setFormaPagamento] = useState<
    'pix' | 'ted_doc' | 'boleto' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'outro'
  >('cartao_debito')
  const [creditoTipo, setCreditoTipo] = useState<'a_vista' | 'parcelado'>('a_vista')
  const [numParcelas, setNumParcelas] = useState<number>(1)

  // Classificação contábil e detalhamento manual
  const [categoria, setCategoria] = useState<
    'despesas_operacionais' | 'terceirizados' | 'impostos' | 'equipamentos' | 'folha' | 'outros'
  >('despesas_operacionais')
  const [planoContasCodigo, setPlanoContasCodigo] = useState('3.1.5')
  const [planoContasNome, setPlanoContasNome] = useState(
    'Combustível, Pedágios e Locação de Veículos',
  )
  const [contaBancariaId, setContaBancariaId] = useState<string>('')
  const [descricaoItens, setDescricaoItens] = useState('')
  const [projetoId, setProjetoId] = useState<string>('nenhum')
  const [observacoes, setObservacoes] = useState('')
  const [detalhamentoManualAberto, setDetalhamentoManualAberto] = useState(true)
  const [confianca, setConfianca] = useState<'alta' | 'media' | 'baixa'>('alta')
  const [avisoExtracao, setAvisoExtracao] = useState<string | null>(null)
  const [modoEssencialAtivo, setModoEssencialAtivo] = useState<boolean>(false)
  const [infoInferencia, setInfoInferencia] = useState<{
    segmento?: string
    descricao_produto_inferido?: string
    termo_detectado?: string
  } | null>(null)

  // Quando abre em modo de reedição (contaEdicao) ou fecha o modal
  useEffect(() => {
    if (!open) {
      if (previewUrl && !contaEdicao) {
        URL.revokeObjectURL(previewUrl)
      }
      setEtapa('selecao')
      setArquivoSelecionado(null)
      setPreviewUrl(null)
      setIsPdf(false)
      setIsSubmitting(false)
      setAvisoExtracao(null)
      setChaveAcesso('')
      setCredorId('')
      setMostrarCadastroCredor(false)
      setModoEssencialAtivo(false)
      setInfoInferencia(null)
      setCreditoTipo('a_vista')
      setNumParcelas(1)
      setContaBancariaId('')
      return
    }

    // Se estiver abrindo com uma conta já existente para reedição / correção de valores
    if (contaEdicao) {
      setFornecedor(contaEdicao.fornecedor || '')
      setCnpjCpf(contaEdicao.cnpj_cpf_beneficiario || '')
      setDataEmissao(
        contaEdicao.data_vencimento
          ? contaEdicao.data_vencimento.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      )
      setValorTotal(contaEdicao.valor || '')
      setCategoria(contaEdicao.categoria || 'despesas_operacionais')
      setFormaPagamento(contaEdicao.forma_pagamento || 'cartao_debito')
      setPlanoContasCodigo(contaEdicao.plano_contas_codigo || '3.1.5')
      setPlanoContasNome(
        contaEdicao.plano_contas_nome || 'Combustível, Pedágios e Locação de Veículos',
      )
      setContaBancariaId(contaEdicao.conta_bancaria || '')
      setProjetoId(contaEdicao.projeto || 'nenhum')
      setDescricaoItens(contaEdicao.descricao || '')
      setObservacoes(contaEdicao.observacoes || '')
      setCredorId(contaEdicao.credor || '')

      // Localizar o comprovante gravado no banco
      const docs = obterDocumentosSegregados(contaEdicao)
      if (docs.length > 0) {
        const docPrincipal = docs[0]
        setPreviewUrl(docPrincipal.url)
        setIsPdf(docPrincipal.isPdf)
      } else {
        setPreviewUrl(null)
        setIsPdf(false)
      }

      setEtapa('conferencia')
      setModoEssencialAtivo(false)
      setAvisoExtracao(null)
    }
  }, [open, contaEdicao])

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

    await executarExtracao(file)
  }

  // Executa o pipeline de extração com tratamento de erro claro e resiliente
  async function executarExtracao(file: File) {
    setEtapa('analise')
    setMensagemAnalise('Varrendo QR Code fiscal (NFC-e / SAT / DANFE) e analisando com IA...')

    try {
      // 1. Tentar leitura de QR Code Fiscal (jsQR / pdfJsLoader)
      let qrFiscalLido = false
      let dadosQrBackend: ComprovanteExtraido | null = null
      let avisoQrPortal: string | null = null

      try {
        const resultadoQr = await escanearQrCodeDocumento(file)
        if (resultadoQr.sucesso && resultadoQr.qrEncontrado && resultadoQr.conteudoBruto) {
          qrFiscalLido = true
          setMensagemAnalise('QR Code fiscal detectado! Consultando SEFAZ e dados estruturais...')

          const consultaBackend = await consultarQrCodeFiscalBackend(resultadoQr.conteudoBruto)
          if (consultaBackend && consultaBackend.dados) {
            dadosQrBackend = consultaBackend.dados
            if (consultaBackend.chave_acesso) {
              setChaveAcesso(consultaBackend.chave_acesso)
            }
            if (consultaBackend.aviso_portal) {
              avisoQrPortal = consultaBackend.aviso_portal
            }
          }
        }
      } catch (qrErr) {
        console.warn(
          'Tentativa de varredura de QR Code não encontrou código fiscal, prosseguindo com visão:',
          qrErr,
        )
      }

      // 2. Se obteve dados via QR Code Fiscal com fornecedor e valor preenchidos
      if (dadosQrBackend && (dadosQrBackend.valor_total > 0 || dadosQrBackend.fornecedor)) {
        preencherFormularioComExtraido(dadosQrBackend, file.name)
        setEtapa('conferencia')
        if (avisoQrPortal) {
          setAvisoExtracao(
            `QR Code fiscal lido! O portal SEFAZ requer conferência manual de alguns campos (${avisoQrPortal}). Os dados da chave foram decompostos abaixo.`,
          )
        } else {
          setAvisoExtracao(null)
          toast.success('Documento fiscal lido via QR Code com sucesso!')
        }
        return
      }

      // 3. Se o QR Code leu uma chave mas a SEFAZ bloqueou/não retornou valor, rodar visão e mesclar
      const extraidoVisao = await extrairDadosComprovante(file)
      let consolidado = extraidoVisao

      if (dadosQrBackend) {
        // Mesclar dados do QR Code com os dados da visão (QR tem chave, modelo e série mais exatos)
        consolidado = {
          ...extraidoVisao,
          tipo_documento: dadosQrBackend.tipo_documento || extraidoVisao.tipo_documento,
          fornecedor: extraidoVisao.fornecedor || dadosQrBackend.fornecedor,
          cnpj_cpf: dadosQrBackend.cnpj_cpf || extraidoVisao.cnpj_cpf,
          numero_documento: dadosQrBackend.numero_documento || extraidoVisao.numero_documento,
          serie: dadosQrBackend.serie || extraidoVisao.serie,
          chave_acesso: dadosQrBackend.chave_acesso || extraidoVisao.chave_acesso,
          valor_total: extraidoVisao.valor_total || dadosQrBackend.valor_total,
          valor_impostos: extraidoVisao.valor_impostos ?? dadosQrBackend.valor_impostos,
          observacoes: [extraidoVisao.observacoes, dadosQrBackend.observacoes]
            .filter(Boolean)
            .join(' | '),
        }
      }

      preencherFormularioComExtraido(consolidado, file.name)
      setEtapa('conferencia')

      if (avisoQrPortal) {
        setAvisoExtracao(
          `QR Code fiscal identificado (${consolidado.chave_acesso ? consolidado.chave_acesso.slice(0, 4) + '...' + consolidado.chave_acesso.slice(-4) : 'chave 44'}). O portal SEFAZ solicitou conferência (${avisoQrPortal}). Confira os dados preenchidos ao lado.`,
        )
      } else if (consolidado.sucesso === false) {
        setAvisoExtracao(
          consolidado.erro ||
            'Não foi possível ler o documento — aproxime a câmera, garanta boa iluminação ou anexe o PDF.',
        )
      } else {
        setAvisoExtracao(null)
        toast.success(
          qrFiscalLido
            ? 'Informações fiscais extraídas com auxílio do QR Code!'
            : 'Informações do comprovante extraídas com sucesso!',
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('Falha na extração automática, permitindo preenchimento manual:', msg)
      setAvisoExtracao(
        'Não foi possível ler o documento — aproxime a câmera, garanta boa iluminação ou anexe o PDF. Você também pode clicar em "Reprocessar mesma foto" ou preencher manualmente.',
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
          erro: 'Não foi possível ler o documento — aproxime a câmera, garanta boa iluminação ou anexe o PDF.',
        },
        file.name,
      )
      setEtapa('conferencia')
    }
  }

  function preencherFormularioComExtraido(extraido: ComprovanteExtraido, nomeArquivo: string) {
    setTipoDoc(extraido.tipo_documento || 'cupom_fiscal')
    const forn = extraido.fornecedor || ''
    setFornecedor(forn)
    const docLimpo = extraido.cnpj_cpf || ''
    setCnpjCpf(docLimpo)
    setDataEmissao(extraido.data_emissao || new Date().toISOString().slice(0, 10))
    setValorTotal(extraido.valor_total || '')
    const cat = extraido.categoria_sugerida || 'despesas_operacionais'
    setCategoria(cat)
    if (extraido.plano_contas_codigo) {
      setPlanoContasCodigo(extraido.plano_contas_codigo)
      setPlanoContasNome(extraido.plano_contas_nome || 'Despesas Gerais')
    } else {
      const pc = sugerirPlanoContasPorCategoria(cat)
      setPlanoContasCodigo(pc.codigo)
      setPlanoContasNome(pc.nome)
    }

    const forma = extraido.forma_pagamento_sugerida || 'cartao_debito'
    setFormaPagamento(forma)
    if (extraido.credito_tipo) {
      setCreditoTipo(extraido.credito_tipo)
    } else if (forma === 'cartao_credito') {
      setCreditoTipo('a_vista')
    }
    if (extraido.num_parcelas && extraido.num_parcelas > 1) {
      setNumParcelas(extraido.num_parcelas)
      setCreditoTipo('parcelado')
    } else {
      setNumParcelas(1)
    }

    setDescricaoItens(
      extraido.descricao_itens ||
        (forn ? `Despesa - ${forn}` : `Comprovante ${nomeArquivo.replace(/\.[^/.]+$/, '')}`),
    )
    setObservacoes(extraido.observacoes || '')
    setConfianca(extraido.confianca || 'alta')

    // Modo essencial ativado se algum dos 5 campos essenciais veio vazio ou sinalizado pelo extrator
    const vitalVazio =
      !forn || !docLimpo || !extraido.valor_total || !extraido.data_emissao || !forma
    setModoEssencialAtivo(Boolean(extraido.modo_essencial || vitalVazio))

    if (extraido.inferencia_categoria) {
      setInfoInferencia(extraido.inferencia_categoria)
    } else {
      setInfoInferencia(null)
    }

    // Tentar vincular automaticamente a um credor existente por CNPJ/CPF ou Razão Social
    if (credores.length > 0) {
      const matchDoc = docLimpo
        ? credores.find(
            (c) => c.cpf_cnpj && c.cpf_cnpj.replace(/\D/g, '') === docLimpo.replace(/\D/g, ''),
          )
        : null

      if (matchDoc) {
        setCredorId(matchDoc.id)
      } else if (forn) {
        const matchNome = credores.find(
          (c) => c.nome.toLowerCase().trim() === forn.toLowerCase().trim(),
        )
        if (matchNome) {
          setCredorId(matchNome.id)
        } else {
          setCredorId('')
        }
      } else {
        setCredorId('')
      }
    }
  }

  // Cadastro rápido de credor caso não exista
  async function handleCadastrarCredorRapido() {
    if (!fornecedor.trim()) {
      toast.error('Informe a Razão Social ou Nome do fornecedor.')
      return
    }
    setSalvandoCredorRapido(true)
    try {
      const novo = await salvarCredor({
        nome_razao_social: fornecedor.trim(),
        tipo_pessoa: cnpjCpf.replace(/\D/g, '').length === 11 ? 'pf' : 'pj',
        cnpj_cpf: cnpjCpf.trim() || '00.000.000/0000-00',
        categoria: 'outros',
        status: 'ativo',
        observacoes: 'Cadastrado automaticamente via leitura de comprovante fiscal',
      })
      toast.success(`Credor "${novo.nome_razao_social}" cadastrado com sucesso!`)
      setCredorId(novo.id)
      setMostrarCadastroCredor(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao cadastrar credor: ${msg}`)
    } finally {
      setSalvandoCredorRapido(false)
    }
  }

  // Reprocessa a MESMA foto/arquivo já carregado sem exigir recaptura
  async function handleReprocessarMesmaFoto() {
    if (!arquivoSelecionado) {
      toast.error('Nenhum arquivo carregado para reprocessar.')
      return
    }
    toast.info('Reprocessando a mesma foto com foco nos 5 campos essenciais...')
    await executarExtracao(arquivoSelecionado)
  }

  // Confirmar e salvar como Conta a Pagar (Criação ou Atualização)
  async function handleSalvarContaPagar() {
    // Em criação exige arquivo selecionado; em edição/revisão já existe comprovante persistido
    if (!arquivoSelecionado && !contaEdicao && !previewUrl) {
      toast.error('Nenhum comprovante anexado. Selecione ou fotografe o documento.')
      return
    }

    // Permite digitação manual do estabelecimento mesmo se a leitura automática não extraiu
    const fornecedorFinal = fornecedor.trim() || 'Despesa / Estabelecimento a identificar'

    const valorNum = typeof valorTotal === 'number' ? valorTotal : parseFloat(String(valorTotal))
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error('Informe o valor total da despesa nos campos editáveis abaixo.')
      return
    }

    const dataFinal = dataEmissao || new Date().toISOString().slice(0, 10)

    setIsSubmitting(true)
    try {
      const descFinal = descricaoItens.trim()
        ? descricaoItens.trim()
        : `${fornecedorFinal} - ${infoInferencia?.descricao_produto_inferido || 'Despesa Operacional'}`

      const infoPagtoTexto =
        formaPagamento === 'cartao_credito'
          ? `Cartão de Crédito (${creditoTipo === 'parcelado' ? `${numParcelas}x parcelado` : 'à vista'})`
          : formaPagamento === 'cartao_debito'
            ? 'Cartão de Débito'
            : formaPagamento.toUpperCase()

      const payloadBase = {
        descricao: descFinal,
        fornecedor: fornecedorFinal,
        categoria,
        valor: valorNum,
        data_vencimento: dataFinal,
        forma_pagamento: formaPagamento,
        projetoId: projetoId === 'nenhum' ? null : projetoId,
        conta_bancaria: contaBancariaId || undefined,
        cnpj_cpf_beneficiario: cnpjCpf.trim() || undefined,
        observacoes: [
          observacoes.trim(),
          cnpjCpf ? `CNPJ: ${cnpjCpf}` : '',
          `Forma de Pagamento: ${infoPagtoTexto}`,
          infoInferencia?.descricao_produto_inferido
            ? `Produto/Despesa inferido: ${infoInferencia.descricao_produto_inferido}`
            : '',
          contaEdicao
            ? 'Revisão e correção de valores de comprovante fiscal'
            : 'Captura enxuta de comprovante / cupom fiscal',
        ]
          .filter(Boolean)
          .join('\n'),
        arquivoComprovante: arquivoSelecionado,
        userId: user?.id || null,
        credorId: credorId || null,
        plano_contas_codigo: planoContasCodigo,
        plano_contas_nome: planoContasNome,
      }

      if (contaEdicao) {
        // MODO ATUALIZAÇÃO: Atualiza a conta existente (NUNCA duplica)
        await atualizarContaPagarComComprovante({
          ...payloadBase,
          contaId: contaEdicao.id,
        })
        toast.success(
          `Conta a pagar de ${fornecedorFinal} atualizada com sucesso para R$ ${valorNum.toFixed(2)}!`,
        )
      } else {
        // MODO CRIAÇÃO: Grava nova conta
        await salvarContaPagarComComprovante(payloadBase)
        toast.success(
          `Conta a pagar de R$ ${valorNum.toFixed(2)} cadastrada com sucesso com o comprovante anexado!`,
        )
      }

      onOpenChange(false)
      await onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao salvar conta a pagar: ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2">
                <span>
                  {contaEdicao
                    ? 'Revisar Comprovante & Corrigir Valores'
                    : isMobile
                      ? 'Fotografar Comprovante com IA'
                      : 'Capturar & Extrair Comprovante'}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {contaEdicao
                    ? 'Modo de Edição / Atualização'
                    : 'Comprovante (Documento de Pagamento Efetivado)'}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500">
                {contaEdicao
                  ? 'Confira o comprovante anexado ao lado e ajuste manualmente qualquer valor ou dado cadastral. A conta será atualizada diretamente.'
                  : 'Extraia automaticamente dados de comprovantes de pagamento liquidados (PIX, TED, cupons fiscais e recibos).'}
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
            {/* Faixa explicativa de distinção: Comprovante de quitação liquidado vs Boleto de cobrança */}
            <div className="p-2.5 rounded-lg border border-emerald-300 bg-emerald-50/70 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                  <Check className="h-4 w-4 text-emerald-700" />
                  <span>Comprovante (Documento de Pagamento Efetivado / Liquidado)</span>
                </div>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900">
                  Liquidação Bancária
                </span>
              </div>
              <p className="text-[11px] text-emerald-900/90 leading-relaxed">
                💡 <strong>Diferença essencial:</strong> Este comprovante atesta a{' '}
                <em>saída de caixa ou quitação definitiva</em> (transferência PIX/TED ou recibo). Se
                você estiver apenas cadastrando um boleto futuro com código de barras, utilize a
                captura de <strong>Boleto Bancário</strong>.
              </p>
            </div>

            {/* Banner Discreto de Leitura Essencial / Parcial */}
            {modoEssencialAtivo && (
              <div className="p-3 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-blue-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-blue-900">
                      Padrão de leitura enxuto aplicado
                    </span>
                    <span className="text-[11px] text-blue-800">
                      Extração focada estritamente nos 5 dados vitais (estabelecimento, CNPJ, data,
                      valor e forma de pagamento). A categoria e o produto foram inferidos pelo nome
                      do estabelecimento.
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReprocessarMesmaFoto}
                  className="h-7 text-xs text-blue-950 border-blue-300 bg-white hover:bg-blue-100 shrink-0 shadow-sm font-semibold"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-[#FF6A13]" />
                  Reprocessar mesma foto
                </Button>
              </div>
            )}

            {avisoExtracao && !modoEssencialAtivo && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-amber-950">Atenção na leitura:</span>
                    <span>{avisoExtracao}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReprocessarMesmaFoto}
                  className="h-7 text-xs text-amber-950 border-amber-300 bg-white hover:bg-amber-100 shrink-0 shadow-sm font-semibold"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-[#FF6A13]" />
                  Reprocessar mesma foto
                </Button>
              </div>
            )}

            {/* DESTAQUE DOS 5 CAMPOS ESSENCIAIS NO TOPO DO PAINEL DE CONFERÊNCIA */}
            <div className="p-3 rounded-xl border border-orange-200 bg-orange-50/50 shadow-sm space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-[#FF6A13]" />
                    {contaEdicao
                      ? 'Revisão dos Valores e Dados da Conta'
                      : 'Resumo da Leitura (Confira e corrija nos campos editáveis abaixo)'}
                  </span>
                  <p className="text-[11px] text-neutral-600 mt-0.5">
                    {contaEdicao
                      ? 'Estes cartões refletem os valores em tempo real. Você pode alterar qualquer dado no formulário abaixo.'
                      : 'Estas etiquetas são um resumo da extração. TODOS os dados são totalmente editáveis no formulário abaixo.'}
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-orange-800 border border-orange-200 self-start sm:self-auto shrink-0">
                  {contaEdicao ? 'Modo de Correção' : '100% Editável'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {/* 1. Estabelecimento */}
                <div className="p-2 rounded-lg bg-white border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-neutral-500 font-medium block">
                    1. Estabelecimento
                  </span>
                  <span
                    className="font-bold text-neutral-900 text-xs truncate block"
                    title={fornecedor}
                  >
                    {fornecedor || '—'}
                  </span>
                </div>
                {/* 2. CNPJ */}
                <div className="p-2 rounded-lg bg-white border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <span className="text-[10px] text-neutral-500 font-medium block">2. CNPJ</span>
                  <span
                    className="font-semibold text-neutral-700 font-mono text-[11px] truncate block"
                    title={cnpjCpf}
                  >
                    {cnpjCpf || '—'}
                  </span>
                </div>
                {/* 3. Data */}
                <div className="p-2 rounded-lg bg-white border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <span className="text-[10px] text-neutral-500 font-medium block">
                    3. Data Compra
                  </span>
                  <span
                    className="font-bold text-neutral-900 font-mono text-xs truncate block"
                    title={dataEmissao}
                  >
                    {dataEmissao ? dataEmissao.split('-').reverse().join('/') : '—'}
                  </span>
                </div>
                {/* 4. Valor */}
                <div className="p-2 rounded-lg bg-white border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <span className="text-[10px] text-neutral-500 font-medium block">
                    4. Valor Total
                  </span>
                  <span
                    className="font-bold text-[#FF6A13] font-mono text-xs truncate block"
                    title={String(valorTotal)}
                  >
                    {valorTotal !== '' && valorTotal !== undefined
                      ? podeVerValores
                        ? `R$ ${Number(valorTotal).toFixed(2)}`
                        : '••••'
                      : '—'}
                  </span>
                </div>
                {/* 5. Forma de Pagamento */}
                <div className="p-2 rounded-lg bg-white border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <span className="text-[10px] text-neutral-500 font-medium block">
                    5. Forma Pagto
                  </span>
                  <span
                    className="font-semibold text-neutral-800 text-[11px] truncate block"
                    title={
                      formaPagamento === 'cartao_credito'
                        ? `Crédito (${creditoTipo === 'parcelado' ? `${numParcelas}x` : 'À vista'})`
                        : formaPagamento === 'cartao_debito'
                          ? 'Débito'
                          : formaPagamento.toUpperCase()
                    }
                  >
                    {formaPagamento === 'cartao_credito'
                      ? `Crédito (${creditoTipo === 'parcelado' ? `${numParcelas}x` : 'À vista'})`
                      : formaPagamento === 'cartao_debito'
                        ? 'Débito'
                        : formaPagamento.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* COLUNA ESQUERDA: PRÉVIA DA FOTO / DOCUMENTO */}
              <div className="md:col-span-5 flex flex-col space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
                  <span>Prévia do Comprovante</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleReprocessarMesmaFoto}
                      className="text-[11px] text-neutral-700 hover:text-[#FF6A13] hover:underline flex items-center gap-1 font-medium"
                      title="Reprocessar este mesmo documento com a IA"
                    >
                      <RefreshCw className="h-3 w-3 text-[#FF6A13]" />
                      Reprocessar
                    </button>
                    <span className="text-neutral-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (isMobile) cameraInputRef.current?.click()
                        else fileInputRef.current?.click()
                      }}
                      className="text-[11px] text-[#FF6A13] hover:underline flex items-center gap-1"
                    >
                      <Camera className="h-3 w-3" />
                      Trocar foto
                    </button>
                  </div>
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

              {/* COLUNA DIREITA: FORMULÁRIO ENXUTO E DETALHAMENTO MANUAL */}
              <div className="md:col-span-7 space-y-3 text-xs">
                {/* 1. Nome do Estabelecimento e CNPJ */}
                <div className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
                      <Building2 className="h-3.5 w-3.5 text-[#FF6A13]" />
                      <span>1. Estabelecimento & 2. CNPJ</span>
                    </div>
                    {credorId && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Vinculado ao Credor
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-neutral-700">
                        Nome do Estabelecimento *
                      </Label>
                      <Input
                        value={fornecedor}
                        onChange={(e) => setFornecedor(e.target.value)}
                        placeholder="Ex: Auto Posto Bandeirantes"
                        className="h-8 text-xs font-medium"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-neutral-700">
                        CNPJ do Estabelecimento
                      </Label>
                      <Input
                        value={cnpjCpf}
                        onChange={(e) => setCnpjCpf(e.target.value)}
                        placeholder="00.000.000/0000-00"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Vínculo de Credor */}
                  {credores.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 text-[11px]">
                      <div className="flex-1 w-full sm:w-auto">
                        <Select
                          value={credorId || 'nenhum'}
                          onValueChange={(val) => setCredorId(val === 'nenhum' ? '' : val)}
                        >
                          <SelectTrigger className="h-7 text-xs bg-white">
                            <SelectValue placeholder="Selecione credor cadastrado..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nenhum">
                              Nenhum (usar apenas nome do estabelecimento)
                            </SelectItem>
                            {credores.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nome} {c.cpf_cnpj ? `(${c.cpf_cnpj})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {!credorId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={salvandoCredorRapido || !fornecedor}
                          onClick={handleCadastrarCredorRapido}
                          className="h-7 text-xs text-[#FF6A13] border-orange-200 hover:bg-orange-50 shrink-0 font-medium"
                        >
                          {salvandoCredorRapido ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Plus className="mr-1 h-3 w-3" />
                          )}
                          Cadastrar Credor
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Data e 4. Valor Total */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-neutral-900">
                      3. Data da Compra / Emissão *
                    </Label>
                    <Input
                      type="date"
                      value={dataEmissao}
                      onChange={(e) => setDataEmissao(e.target.value)}
                      className="h-8 text-xs font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-neutral-900">
                      4. Valor Total da Compra (R$) *
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
                </div>

                {/* 5. Forma de Pagamento (Débito, Crédito à vista/parcelado, etc.) */}
                <div className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50/70 space-y-2">
                  <Label className="text-xs font-semibold text-neutral-900 block">
                    5. Forma de Pagamento
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1 sm:col-span-1">
                      <Select
                        value={formaPagamento}
                        onValueChange={(val) => {
                          const f = val as typeof formaPagamento
                          setFormaPagamento(f)
                          if (f === 'cartao_credito' && !creditoTipo) {
                            setCreditoTipo('a_vista')
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                          <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="boleto">Boleto Bancário</SelectItem>
                          <SelectItem value="ted_doc">TED / DOC</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formaPagamento === 'cartao_credito' && (
                      <>
                        <div className="space-y-1">
                          <Select
                            value={creditoTipo}
                            onValueChange={(val) => {
                              const t = val as 'a_vista' | 'parcelado'
                              setCreditoTipo(t)
                              if (t === 'a_vista') setNumParcelas(1)
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="a_vista">À Vista</SelectItem>
                              <SelectItem value="parcelado">Parcelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {creditoTipo === 'parcelado' && (
                          <div className="space-y-1">
                            <Input
                              type="number"
                              min={2}
                              max={48}
                              value={numParcelas}
                              onChange={(e) => setNumParcelas(parseInt(e.target.value) || 2)}
                              placeholder="Nº parcelas"
                              className="h-8 text-xs font-mono bg-white"
                              title="Quantidade de parcelas no crédito"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* INFERÊNCIA DO PRODUTO / CATEGORIA AUTOMÁTICA PELO ESTABELECIMENTO */}
                <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#FF6A13]" />
                      Produto & Categoria Inferidos pelo Estabelecimento
                    </span>
                    {infoInferencia?.segmento && (
                      <span className="text-[10px] font-bold text-orange-800 bg-orange-100 px-2 py-0.5 rounded border border-orange-200">
                        {infoInferencia.segmento}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-neutral-600">Categoria Contábil</Label>
                      <Select
                        value={categoria}
                        onValueChange={(val) => {
                          const novaCat = val as
                            | 'despesas_operacionais'
                            | 'terceirizados'
                            | 'impostos'
                            | 'equipamentos'
                            | 'folha'
                            | 'outros'
                          setCategoria(novaCat)
                          const pc = sugerirPlanoContasPorCategoria(novaCat)
                          setPlanoContasCodigo(pc.codigo)
                          setPlanoContasNome(pc.nome)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="despesas_operacionais">
                            Despesas Operacionais
                          </SelectItem>
                          <SelectItem value="terceirizados">Terceirizados & Serviços</SelectItem>
                          <SelectItem value="impostos">Impostos & Tributos</SelectItem>
                          <SelectItem value="equipamentos">Equipamentos & Hardware</SelectItem>
                          <SelectItem value="folha">Folha de Pagamento</SelectItem>
                          <SelectItem value="outros">Outros Custos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-neutral-600">Plano de Contas</Label>
                      <Select
                        value={planoContasCodigo}
                        onValueChange={(val) => {
                          setPlanoContasCodigo(val)
                          const item = PLANO_CONTAS_AEROCAD.find((p) => p.codigo === val)
                          if (item) setPlanoContasNome(item.nome)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs font-mono bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-52">
                          {PLANO_CONTAS_AEROCAD.filter((p) => p.natureza === 'despesa').map((p) => (
                            <SelectItem key={p.codigo} value={p.codigo}>
                              {p.codigo} - {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {infoInferencia?.descricao_produto_inferido && (
                    <p className="text-[11px] text-neutral-600 italic">
                      💡 {infoInferencia.descricao_produto_inferido}
                    </p>
                  )}
                </div>

                {/* DETALHAMENTO MANUAL DA DESPESA (ITEM 2 DO PEDIDO) */}
                <div className="border rounded-lg overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setDetalhamentoManualAberto(!detalhamentoManualAberto)}
                    className="w-full px-3 py-2 bg-neutral-100 hover:bg-neutral-200/80 text-left font-semibold text-neutral-800 text-xs flex items-center justify-between"
                  >
                    <span>Detalhamento Manual da Despesa</span>
                    <span className="text-[11px] font-normal text-neutral-500">
                      {detalhamentoManualAberto ? '▲ Recolher' : '▼ Expandir campos manuais'}
                    </span>
                  </button>

                  {detalhamentoManualAberto && (
                    <div className="p-3 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-neutral-700">
                          Descrição Detalhada / Histórico do Lançamento
                        </Label>
                        <Input
                          value={descricaoItens}
                          onChange={(e) => setDescricaoItens(e.target.value)}
                          placeholder="Ex: Abastecimento caminhonete em campo no projeto 2026-042"
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-neutral-600">
                            Projeto Vinculado (Custeio)
                          </Label>
                          <Select value={projetoId} onValueChange={setProjetoId}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Sem projeto (Despesa geral)" />
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
                          <Label className="text-xs text-neutral-600">
                            Conta Bancária de Pagamento
                          </Label>
                          {contasBancarias.length > 0 ? (
                            <Select
                              value={contaBancariaId || 'nenhuma'}
                              onValueChange={(val) =>
                                setContaBancariaId(val === 'nenhuma' ? '' : val)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecione a conta bancária..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nenhuma">Não associada / Outro</SelectItem>
                                {contasBancarias
                                  .filter((c) => c.ativo !== false)
                                  .map((cb) => (
                                    <SelectItem key={cb.id} value={cb.id}>
                                      {cb.apelido} ({cb.banco_nome})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={contaBancariaId}
                              onChange={(e) => setContaBancariaId(e.target.value)}
                              placeholder="Apelido da conta / banco..."
                              className="h-8 text-xs"
                            />
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-neutral-600">
                          Observações Manuais Internas
                        </Label>
                        <Textarea
                          value={observacoes}
                          onChange={(e) => setObservacoes(e.target.value)}
                          placeholder="Anotações para a conferência financeira..."
                          rows={2}
                          className="text-xs resize-none"
                        />
                      </div>
                    </div>
                  )}
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

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  size="sm"
                  onClick={handleSalvarContaPagar}
                  disabled={isSubmitting || !valorTotal}
                  className="w-full sm:w-auto bg-[#FF6A13] hover:bg-[#E85B06] text-white h-8 text-xs font-semibold shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      {contaEdicao ? 'Atualizando Conta a Pagar...' : 'Criando Conta a Pagar...'}
                    </>
                  ) : (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      {contaEdicao
                        ? 'Salvar Correção de Valores'
                        : 'Confirmar e Criar Conta a Pagar'}
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
