import { useEffect, useRef, useState, useMemo, type ChangeEvent } from 'react'
import {
  Camera,
  Check,
  Calendar,
  Sparkles,
  Loader2,
  Plus,
  SlidersHorizontal,
  X,
  FileText,
  Search,
  CheckCircle2,
  Building2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
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
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import {
  extrairDadosComprovante,
  consultarQrCodeFiscalBackend,
  salvarContaPagarComComprovante,
  type ComprovanteExtraido,
} from '@/services/comprovantesVision'
import { escanearQrCodeDocumento } from '@/services/qrFiscalScanner'
import { salvarCredor } from '@/services/credores'
import { encontrarCredorCorrespondente } from '@/services/credorComprovanteMatcher'
import { inferirCategoriaPorEstabelecimento } from '@/services/categoriaInferenciaEngine'
import { PLANO_CONTAS_AEROCAD, sugerirPlanoContasPorCategoria } from '@/lib/planoContas'
import { CATEGORIA_PAGAR_LABELS } from '@/components/financeiro/ContasPagarTab'
import type {
  ProjetoRecord,
  CredorRecord,
  ContaBancariaRecord,
  CategoriaContaPagar,
} from '@/types/crm'

export interface CapturaRapidaMobileModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projetos?: ProjetoRecord[]
  contasBancarias?: ContaBancariaRecord[]
  credores?: CredorRecord[]
  onSuccess: () => Promise<void> | void
  onAbrirConferenciaCompleta?: (arquivo: File | null) => void
}

export function CapturaRapidaMobileModal({
  open,
  onOpenChange,
  projetos = [],
  contasBancarias = [],
  credores = [],
  onSuccess,
  onAbrirConferenciaCompleta,
}: CapturaRapidaMobileModalProps) {
  const { user } = useAuth()
  const { podeVerValores } = useFinanceiroVisibilidade()

  // Referência do input de câmera nativa
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galeriaInputRef = useRef<HTMLInputElement>(null)

  // Arquivo e prévia
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPdf, setIsPdf] = useState(false)

  // Estado da leitura de IA em paralelo
  const [iaCarregando, setIaCarregando] = useState(false)
  const [iaStatus, setIaStatus] = useState<string>('')
  const [iaConcluida, setIaConcluida] = useState(false)

  // Campos do formulário enxuto mobile
  const [valor, setValor] = useState<string>('')
  const [dataDocumento, setDataDocumento] = useState<string>(new Date().toISOString().slice(0, 10))
  const [credorId, setCredorId] = useState<string>('sem_credor')
  const [categoria, setCategoria] = useState<CategoriaContaPagar>('despesas_operacionais')
  const [planoContasCodigo, setPlanoContasCodigo] = useState('3.1.5')
  const [planoContasNome, setPlanoContasNome] = useState(
    'Combustível, Pedágios e Locação de Veículos',
  )

  // Estabelecimento livre / inferido
  const [estabelecimentoNome, setEstabelecimentoNome] = useState<string>('')
  const [estabelecimentoCnpj, setEstabelecimentoCnpj] = useState<string>('')

  // Busca e cadastro rápido de credor inline
  const [buscaCredor, setBuscaCredor] = useState('')
  const [mostrarCadastroNovoCredor, setMostrarCadastroNovoCredor] = useState(false)
  const [novoCredorNome, setNovoCredorNome] = useState('')
  const [novoCredorCnpj, setNovoCredorCnpj] = useState('')
  const [salvandoNovoCredor, setSalvandoNovoCredor] = useState(false)

  // Submissão
  const [isSalvando, setIsSalvando] = useState(false)

  // Reset e inicialização ao abrir
  useEffect(() => {
    if (!open) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setArquivo(null)
      setPreviewUrl(null)
      setIsPdf(false)
      setIaCarregando(false)
      setIaConcluida(false)
      setIaStatus('')
      setValor('')
      setDataDocumento(new Date().toISOString().slice(0, 10))
      setCredorId('sem_credor')
      setCategoria('despesas_operacionais')
      const pc = sugerirPlanoContasPorCategoria('despesas_operacionais')
      setPlanoContasCodigo(pc.codigo)
      setPlanoContasNome(pc.nome)
      setEstabelecimentoNome('')
      setEstabelecimentoCnpj('')
      setBuscaCredor('')
      setMostrarCadastroNovoCredor(false)
      setNovoCredorNome('')
      setNovoCredorCnpj('')
      setIsSalvando(false)
    } else {
      // Ao abrir o modal sem arquivo, dispara o gatilho da câmera
      // após pequeno timeout para renderizar o DOM do input
      const timer = setTimeout(() => {
        if (!arquivo && cameraInputRef.current) {
          cameraInputRef.current.click()
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Tratar arquivo fotografado ou escolhido
  function handleFotoCapturada(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setArquivo(file)
    const isFilePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    setIsPdf(isFilePdf)

    if (!isFilePdf) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
    }

    // Salvar data da foto (data da última modificação do arquivo ou hoje)
    try {
      const dataModificacao = file.lastModified ? new Date(file.lastModified) : new Date()
      if (!isNaN(dataModificacao.getTime())) {
        const ano = dataModificacao.getFullYear()
        const mes = String(dataModificacao.getMonth() + 1).padStart(2, '0')
        const dia = String(dataModificacao.getDate()).padStart(2, '0')
        setDataDocumento(`${ano}-${mes}-${dia}`)
      }
    } catch {
      setDataDocumento(new Date().toISOString().slice(0, 10))
    }

    // Disparar leitura por IA em paralelo SEM bloquear o usuário
    void dispararLeituraIaEmParalelo(file)

    // Limpa valor do input para permitir recapturar
    e.target.value = ''
  }

  // Leitura assíncrona da IA em segundo plano
  async function dispararLeituraIaEmParalelo(file: File) {
    setIaCarregando(true)
    setIaStatus('IA analisando documento em segundo plano...')
    setIaConcluida(false)

    try {
      let extraido: ComprovanteExtraido | null = null

      // 1. Tentar QR Code fiscal primeiro (mais rápido e exato para cupons fiscais)
      try {
        const resultadoQr = await escanearQrCodeDocumento(file)
        if (resultadoQr.sucesso && resultadoQr.qrEncontrado && resultadoQr.conteudoBruto) {
          setIaStatus('QR Code fiscal detectado! Decodificando dados...')
          const consultaBackend = await consultarQrCodeFiscalBackend(resultadoQr.conteudoBruto)
          if (consultaBackend?.dados) {
            extraido = consultaBackend.dados
          }
        }
      } catch {
        // Silencioso se não houver QR code
      }

      // 2. Se o QR não trouxe dados completos, chamar agente de visão
      if (!extraido || (!extraido.valor_total && !extraido.fornecedor)) {
        setIaStatus('Lendo imagem com agente de visão AEROCAD...')
        extraido = await extrairDadosComprovante(file)
      }

      if (extraido) {
        aplicarDadosExtraidosIa(extraido)
        setIaConcluida(true)
        setIaStatus('Dados identificados pela IA!')
      }
    } catch (err) {
      console.warn('Leitura de IA em segundo plano não completou:', err)
      setIaStatus('Não foi possível ler automaticamente — digite os dados acima.')
    } finally {
      setIaCarregando(false)
    }
  }

  // Aplica dados da IA preenchendo o que estiver em branco ou aprimorando
  function aplicarDadosExtraidosIa(extraido: ComprovanteExtraido) {
    const nomeEst = (extraido.fornecedor || '').trim()
    const cnpjEst = (extraido.cnpj_cpf || '').trim()

    if (nomeEst) {
      setEstabelecimentoNome((prev) => prev || nomeEst)
      setNovoCredorNome((prev) => prev || nomeEst)
    }
    if (cnpjEst) {
      setEstabelecimentoCnpj((prev) => prev || cnpjEst)
      setNovoCredorCnpj((prev) => prev || cnpjEst)
    }

    // Se o usuário ainda não digitou valor e a IA achou um valor válido
    if (extraido.valor_total && extraido.valor_total > 0) {
      setValor((prev) => (prev ? prev : String(extraido.valor_total)))
    }

    // Data de emissão se identificada
    if (extraido.data_emissao) {
      setDataDocumento(extraido.data_emissao)
    }

    // Match de credor cadastrado por CNPJ ou nome
    if (credores.length > 0 && (cnpjEst || nomeEst)) {
      const match = encontrarCredorCorrespondente(nomeEst, cnpjEst, credores)
      if (match?.credor) {
        setCredorId(match.credor.id)
        toast.success(`Credor "${match.credor.nome_razao_social}" identificado automaticamente!`)
      }
    }

    // Inferência de categoria
    if (extraido.categoria_sugerida) {
      setCategoria(extraido.categoria_sugerida)
      if (extraido.plano_contas_codigo) {
        setPlanoContasCodigo(extraido.plano_contas_codigo)
        setPlanoContasNome(extraido.plano_contas_nome || 'Despesas Gerais')
      } else {
        const pc = sugerirPlanoContasPorCategoria(extraido.categoria_sugerida)
        setPlanoContasCodigo(pc.codigo)
        setPlanoContasNome(pc.nome)
      }
    } else if (nomeEst) {
      const inf = inferirCategoriaPorEstabelecimento(nomeEst, cnpjEst)
      if (inf && inf.categoria) {
        setCategoria(inf.categoria)
        setPlanoContasCodigo(inf.planoContasCodigo)
        setPlanoContasNome(inf.planoContasNome)
      }
    }
  }

  // Filtro de credores na busca
  const credoresFiltrados = useMemo(() => {
    if (!buscaCredor.trim()) return credores
    const termo = buscaCredor.toLowerCase().trim()
    return credores.filter((c) => {
      const nome = (c.nome_razao_social || c.nome || '').toLowerCase()
      const fantasia = (c.nome_fantasia || '').toLowerCase()
      const doc = (c.cnpj_cpf || '').replace(/\D/g, '')
      return nome.includes(termo) || fantasia.includes(termo) || doc.includes(termo)
    })
  }, [credores, buscaCredor])

  // Obter nome legível do credor selecionado
  const credorSelecionado = useMemo(() => {
    if (!credorId || credorId === 'sem_credor') return null
    return credores.find((c) => c.id === credorId) || null
  }, [credorId, credores])

  // Cadastro rápido inline de novo credor
  async function handleSalvarNovoCredorInline() {
    if (!novoCredorNome.trim()) {
      toast.error('Informe o nome ou razão social do novo credor.')
      return
    }

    setSalvandoNovoCredor(true)
    try {
      const docLimpo = novoCredorCnpj.replace(/\D/g, '')
      const tipoPessoa = docLimpo.length === 11 ? 'pf' : 'pj'
      const novo = await salvarCredor({
        nome_razao_social: novoCredorNome.trim(),
        cnpj_cpf: novoCredorCnpj.trim() || '00.000.000/0000-00',
        tipo_pessoa: tipoPessoa,
        categoria: 'outros',
        status: 'ativo',
        observacoes: 'Cadastrado rapidamente via captura mobile de comprovante',
      })

      toast.success(`Credor "${novo.nome_razao_social}" cadastrado com sucesso!`)
      setCredorId(novo.id)
      setMostrarCadastroNovoCredor(false)
      setBuscaCredor('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao cadastrar credor: ${msg}`)
    } finally {
      setSalvandoNovoCredor(false)
    }
  }

  // Ação de Salvar Rápido (Item 3 do pedido)
  async function handleSalvarRapido() {
    if (!arquivo) {
      toast.error('Tire uma foto ou selecione o comprovante primeiro.')
      return
    }

    const valorNumerico = parseFloat(valor.replace(',', '.'))
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      toast.error('Informe o valor da despesa.')
      return
    }

    const dataFinal = dataDocumento || new Date().toISOString().slice(0, 10)

    // Fornecedor / Estabelecimento
    let fornecedorFinal = 'Despesa / Estabelecimento a identificar'
    if (credorSelecionado) {
      fornecedorFinal = credorSelecionado.nome_razao_social || credorSelecionado.nome
    } else if (estabelecimentoNome.trim()) {
      fornecedorFinal = estabelecimentoNome.trim()
    }

    const docFinal = credorSelecionado?.cnpj_cpf || estabelecimentoCnpj.trim() || undefined

    const descricaoFinal = `Despesa rápida - ${fornecedorFinal}`

    setIsSalvando(true)
    try {
      await salvarContaPagarComComprovante({
        descricao: descricaoFinal,
        fornecedor: fornecedorFinal,
        categoria,
        valor: valorNumerico,
        data_vencimento: dataFinal,
        forma_pagamento: 'outro',
        arquivoComprovante: arquivo,
        credorId: credorSelecionado ? credorSelecionado.id : null,
        cnpj_cpf_beneficiario: docFinal,
        plano_contas_codigo: planoContasCodigo,
        plano_contas_nome: planoContasNome,
        userId: user?.id || null,
        observacoes: [
          'Criado via fluxo rápido mobile',
          docFinal ? `CNPJ/CPF: ${docFinal}` : '',
          `Data da compra: ${dataFinal.split('-').reverse().join('/')}`,
        ]
          .filter(Boolean)
          .join('\n'),
      })

      toast.success(
        `Conta a pagar de ${fornecedorFinal} (R$ ${valorNumerico.toFixed(2)}) criada com comprovante!`,
      )
      onOpenChange(false)
      await onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao salvar conta: ${msg}`)
    } finally {
      setIsSalvando(false)
    }
  }

  // Alternar para conferência completa
  function handleIrParaConferenciaCompleta() {
    onOpenChange(false)
    if (onAbrirConferenciaCompleta) {
      onAbrirConferenciaCompleta(arquivo)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-md p-4 max-h-[94vh] flex flex-col overflow-hidden sm:rounded-2xl border-neutral-200">
        {/* INPUTS DE ARQUIVO INVISÍVEIS */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFotoCapturada}
        />
        <input
          ref={galeriaInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFotoCapturada}
        />

        {/* CABEÇALHO COMPACTO */}
        <DialogHeader className="p-0 pb-2 border-b border-neutral-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6A13] text-white shadow-sm">
                <Camera className="h-4 w-4" />
              </span>
              <div className="text-left">
                <DialogTitle className="text-sm font-bold text-neutral-900 leading-tight">
                  Captura Rápida de Comprovante
                </DialogTitle>
                <DialogDescription className="text-[11px] text-neutral-500">
                  Foto, valor, credor e data na mesma tela
                </DialogDescription>
              </div>
            </div>
            {iaCarregando && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-[#FF6A13] border border-orange-200 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                Lendo IA
              </span>
            )}
            {iaConcluida && !iaCarregando && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                IA OK
              </span>
            )}
          </div>
        </DialogHeader>

        {/* CORPO: CONTEÚDO ROLÁVEL COMPACTO */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 text-xs">
          {/* 1. PREVIEW DA FOTO + BOTÕES DE RECAPTURA */}
          <div className="relative rounded-xl border border-neutral-200 bg-neutral-900 overflow-hidden flex items-center justify-center min-h-[140px] max-h-[180px]">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Comprovante"
                className="max-h-[180px] w-auto object-contain"
              />
            ) : isPdf ? (
              <div className="p-4 text-center text-white space-y-1">
                <FileText className="mx-auto h-8 w-8 text-[#FF6A13]" />
                <p className="text-xs font-semibold truncate max-w-[220px]">{arquivo?.name}</p>
                <span className="text-[10px] text-neutral-400">PDF anexado</span>
              </div>
            ) : (
              <div className="p-4 text-center text-neutral-400 space-y-2">
                <Camera className="mx-auto h-8 w-8 text-neutral-500" />
                <p className="text-xs">Nenhuma foto capturada ainda</p>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6A13] text-white text-xs font-bold shadow-sm"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Abrir Câmera
                </button>
              </div>
            )}

            {/* Ações sobre a foto capturada */}
            {arquivo && (
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-2 py-1 text-[11px] font-semibold text-white hover:text-orange-200 flex items-center gap-1"
                  title="Tirar outra foto"
                >
                  <Camera className="h-3 w-3" />
                  Recapturar
                </button>
                <span className="text-white/30">|</span>
                <button
                  type="button"
                  onClick={() => galeriaInputRef.current?.click()}
                  className="px-2 py-1 text-[11px] font-semibold text-white hover:text-orange-200"
                  title="Escolher arquivo"
                >
                  Galeria
                </button>
              </div>
            )}
          </div>

          {/* Banner discreto de status da IA em paralelo */}
          {iaCarregando && (
            <div className="p-2 rounded-lg bg-orange-50/70 border border-orange-200 text-[11px] text-orange-950 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#FF6A13] shrink-0 animate-spin" />
              <span className="flex-1 truncate">{iaStatus}</span>
              <span className="text-[10px] text-orange-700 font-medium">Pode preencher</span>
            </div>
          )}

          {/* 2. CAMPOS ESSENCIAIS EM UMA TELA ÚNICA: VALOR, DATA, CREDOR, CATEGORIA */}

          {/* LINHA 1: VALOR (DESTAQUE) E DATA */}
          <div className="grid grid-cols-2 gap-2">
            {/* Campo VALOR */}
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-neutral-800 flex items-center justify-between">
                <span>VALOR (R$) *</span>
                {valor && !podeVerValores && (
                  <span className="text-[10px] text-neutral-400">oculto</span>
                )}
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#FF6A13]">
                  R$
                </span>
                <Input
                  type={podeVerValores ? 'number' : 'password'}
                  step="0.01"
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  className="h-10 pl-8 text-sm font-bold text-neutral-900 border-neutral-300 focus-visible:ring-[#FF6A13]"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Campo DATA (padrão: data da foto, editável) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-neutral-800 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-[#FF6A13]" />
                <span>DATA *</span>
              </Label>
              <Input
                type="date"
                value={dataDocumento}
                onChange={(e) => setDataDocumento(e.target.value)}
                className="h-10 text-xs font-semibold text-neutral-900 border-neutral-300 focus-visible:ring-[#FF6A13]"
                required
              />
            </div>
          </div>

          {/* LINHA 2: SELETOR DE CREDOR COM BUSCA, OPÇÃO "SEM CREDOR" E ATALHO NOVO */}
          <div className="p-2.5 rounded-xl border border-neutral-200 bg-neutral-50/70 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-bold text-neutral-800 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-[#FF6A13]" />
                <span>CREDOR / BENEFICIÁRIO</span>
              </Label>
              {credorSelecionado && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Vinculado
                </span>
              )}
            </div>

            {/* Se o modo de cadastro novo estiver aberto */}
            {mostrarCadastroNovoCredor ? (
              <div className="p-2 rounded-lg bg-white border border-orange-200 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-[11px] font-bold text-neutral-900">
                  <span>Cadastrar Novo Credor</span>
                  <button
                    type="button"
                    onClick={() => setMostrarCadastroNovoCredor(false)}
                    className="text-neutral-400 hover:text-neutral-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <Input
                    value={novoCredorNome}
                    onChange={(e) => setNovoCredorNome(e.target.value)}
                    placeholder="Razão Social ou Nome Fantasia *"
                    className="h-8 text-xs font-medium"
                  />
                  <Input
                    value={novoCredorCnpj}
                    onChange={(e) => setNovoCredorCnpj(e.target.value)}
                    placeholder="CNPJ ou CPF (opcional)"
                    className="h-8 text-xs font-mono"
                  />
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMostrarCadastroNovoCredor(false)}
                      className="h-7 text-xs"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSalvarNovoCredorInline}
                      disabled={salvandoNovoCredor || !novoCredorNome.trim()}
                      className="h-7 text-xs bg-[#FF6A13] hover:bg-[#E85B06] text-white font-semibold"
                    >
                      {salvandoNovoCredor ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Check className="h-3 w-3 mr-1" />
                      )}
                      Salvar Credor
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Seletor dropdown */}
                <Select
                  value={credorId}
                  onValueChange={(val) => {
                    if (val === 'novo_credor_action') {
                      setMostrarCadastroNovoCredor(true)
                      if (estabelecimentoNome && !novoCredorNome) {
                        setNovoCredorNome(estabelecimentoNome)
                      }
                      if (estabelecimentoCnpj && !novoCredorCnpj) {
                        setNovoCredorCnpj(estabelecimentoCnpj)
                      }
                    } else {
                      setCredorId(val)
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-white border-neutral-300">
                    <SelectValue placeholder="Selecione ou busque o credor..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {/* Campo de busca interno */}
                    <div className="p-1 border-b sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search className="absolute left-2 top-2 h-3 w-3 text-neutral-400" />
                        <Input
                          value={buscaCredor}
                          onChange={(e) => setBuscaCredor(e.target.value)}
                          placeholder="Filtrar por nome/CNPJ..."
                          className="h-7 pl-6 text-[11px]"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>

                    <SelectItem
                      value="sem_credor"
                      className="text-xs font-semibold text-neutral-600"
                    >
                      Sem credor (usar apenas nome do cupom/recibo)
                    </SelectItem>

                    <SelectItem
                      value="novo_credor_action"
                      className="text-xs font-bold text-[#FF6A13] border-b border-orange-100"
                    >
                      + Cadastrar novo credor...
                    </SelectItem>

                    {credoresFiltrados.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        <span className="font-semibold text-neutral-900">
                          {c.nome_razao_social || c.nome}
                        </span>{' '}
                        {c.cnpj_cpf && (
                          <span className="text-[10px] text-neutral-400 font-mono">
                            ({c.cnpj_cpf})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Se não escolheu credor, permite digitar o nome do estabelecimento */}
                {credorId === 'sem_credor' && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <Input
                      value={estabelecimentoNome}
                      onChange={(e) => setEstabelecimentoNome(e.target.value)}
                      placeholder="Nome do estabelecimento (ex: Posto Ipiranga)"
                      className="h-7 text-xs bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMostrarCadastroNovoCredor(true)
                        setNovoCredorNome(estabelecimentoNome)
                        setNovoCredorCnpj(estabelecimentoCnpj)
                      }}
                      className="h-7 text-[11px] text-[#FF6A13] border-orange-200 hover:bg-orange-50 shrink-0 font-medium px-2"
                      title="Salvar como credor no cadastro"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Novo
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* LINHA 3: CATEGORIA CONTÁBIL INFERIDA (EDITÁVEL) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-bold text-neutral-800 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-[#FF6A13]" />
                <span>CATEGORIA CONTÁBIL</span>
              </Label>
              <span className="text-[10px] text-neutral-400">{planoContasCodigo}</span>
            </div>

            <Select
              value={categoria}
              onValueChange={(val) => {
                const novaCat = val as CategoriaContaPagar
                setCategoria(novaCat)
                const pc = sugerirPlanoContasPorCategoria(novaCat)
                setPlanoContasCodigo(pc.codigo)
                setPlanoContasNome(pc.nome)
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-white border-neutral-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORIA_PAGAR_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* RODAPÉ: BOTÃO SALVAR (PRINCIPAL) E CONFERÊNCIA COMPLETA (SECUNDÁRIO) */}
        <DialogFooter className="p-0 pt-2 border-t border-neutral-100 shrink-0 flex flex-col gap-2">
          {/* Botão Principal: Salvar */}
          <Button
            type="button"
            onClick={handleSalvarRapido}
            disabled={isSalvando || !arquivo || !valor}
            className="w-full h-11 bg-[#FF6A13] hover:bg-[#E85B06] active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-orange-500/20"
          >
            {isSalvando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando Conta a Pagar...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Salvar Conta a Pagar
              </>
            )}
          </Button>

          {/* Botão Secundário: Conferência Completa */}
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs text-neutral-500 h-8 px-2"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleIrParaConferenciaCompleta}
              className="text-xs text-[#D65100] border-orange-200 hover:bg-[#FFF6EC] h-8 font-semibold flex items-center gap-1"
              title="Abrir o fluxo detalhado com itens, conta bancária e rateio"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#FF6A13]" />
              Conferência completa
              <ArrowRight className="h-3 w-3 text-[#FF6A13]" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
