import { useState, useRef, useId, useEffect } from 'react'
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
  FileText,
  Upload,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Paperclip,
  Users,
  Plus,
  Trash2,
  Building2,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react'
import {
  extrairDadosContratoSocial,
  type ContratoSocialExtraido,
  type SocioContratoSocialExtraido,
} from '@/services/comprovantesVision'
import {
  salvarCredorComContratoSocial,
  CATEGORIA_CREDOR_LABELS,
  TIPO_PESSOA_LABELS,
} from '@/services/credores'
import { toast } from 'sonner'
import type { CredorRecord, CategoriaCredor, TipoPessoaCredor } from '@/types/crm'
import pb from '@/lib/pocketbase/client'

export interface ExtracaoContratoSocialModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credorExistente?: CredorRecord | null
  credores: CredorRecord[]
  onSalvo: (credor: CredorRecord) => void
}

export function ExtracaoContratoSocialModal({
  open,
  onOpenChange,
  credorExistente = null,
  credores,
  onSalvo,
}: ExtracaoContratoSocialModalProps) {
  const [etapa, setEtapa] = useState<'upload' | 'analisando' | 'conferencia'>('upload')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPdf, setIsPdf] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modo: vincular a credor existente ou novo cadastro
  const [modoDestino, setModoDestino] = useState<'novo' | 'atualizar'>(
    credorExistente ? 'atualizar' : 'novo',
  )
  const [credorSelecionadoId, setCredorSelecionadoId] = useState<string>(credorExistente?.id || '')

  // Campos do formulário (sempre editáveis pelo usuário)
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoaCredor>('pj')
  const [categoria, setCategoria] = useState<CategoriaCredor>('fornecedor_servicos')
  const [capitalSocial, setCapitalSocial] = useState<string>('')
  const [dataConstituicao, setDataConstituicao] = useState('')
  const [enderecoCompleto, setEnderecoCompleto] = useState('')
  const [cidadeUf, setCidadeUf] = useState('')
  const [cnaePrincipal, setCnaePrincipal] = useState('')
  const [objetoSocial, setObjetoSocial] = useState('')
  const [chavePix, setChavePix] = useState('')
  const [bancoNome, setBancoNome] = useState('')
  const [bancoAgencia, setBancoAgencia] = useState('')
  const [bancoConta, setBancoConta] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Lista de sócios extraídos / editáveis
  const [socios, setSocios] = useState<SocioContratoSocialExtraido[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadInputId = useId()

  useEffect(() => {
    if (open) {
      if (credorExistente) {
        setModoDestino('atualizar')
        setCredorSelecionadoId(credorExistente.id)
        preencherComCredorExistente(credorExistente)
      } else {
        setModoDestino('novo')
        setCredorSelecionadoId('')
      }
    } else {
      resetar()
    }
  }, [open, credorExistente])

  function preencherComCredorExistente(c: CredorRecord) {
    setRazaoSocial(c.nome_razao_social || '')
    setNomeFantasia(c.nome_fantasia || '')
    setCnpj(c.cnpj_cpf || '')
    setTipoPessoa(c.tipo_pessoa || 'pj')
    setCategoria(c.categoria || 'fornecedor_servicos')
    setCapitalSocial(c.capital_social ? String(c.capital_social) : '')
    setDataConstituicao(c.data_constituicao || '')
    setEnderecoCompleto(c.endereco || '')
    setCidadeUf(c.cidade_uf || '')
    setCnaePrincipal(c.cnae_principal || '')
    setObjetoSocial(c.objeto_social || '')
    setChavePix(c.chave_pix || '')
    setBancoNome(c.banco_nome || '')
    setBancoAgencia(c.banco_agencia || '')
    setBancoConta(c.banco_conta || '')
    setEmail(c.email || '')
    setTelefone(c.telefone || '')
    setObservacoes(c.observacoes || '')
    if (Array.isArray(c.socios) && c.socios.length > 0) {
      setSocios(c.socios)
    }
  }

  function resetar() {
    setEtapa('upload')
    setArquivo(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setAviso(null)
    setIsSubmitting(false)
    setSocios([])
  }

  async function handleFileSelected(file: File) {
    const isDocPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isDocImg =
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      /\.(jpe?g|png|webp)$/i.test(file.name)

    if (!isDocPdf && !isDocImg) {
      toast.error('O contrato social deve ser um arquivo em PDF ou foto/imagem (JPG/PNG).')
      return
    }

    setArquivo(file)
    setIsPdf(isDocPdf)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    setEtapa('analisando')
    setAviso(null)

    try {
      const extraido: ContratoSocialExtraido = await extrairDadosContratoSocial(file)
      if (extraido) {
        if (extraido.razao_social) setRazaoSocial(extraido.razao_social)
        if (extraido.nome_fantasia) setNomeFantasia(extraido.nome_fantasia)
        if (extraido.cnpj) setCnpj(extraido.cnpj)
        if (extraido.capital_social > 0) setCapitalSocial(String(extraido.capital_social))
        if (extraido.data_constituicao) setDataConstituicao(extraido.data_constituicao)
        if (extraido.endereco_completo) setEnderecoCompleto(extraido.endereco_completo)
        if (extraido.cidade_uf) setCidadeUf(extraido.cidade_uf)
        if (extraido.cnae_principal) setCnaePrincipal(extraido.cnae_principal)
        if (extraido.objeto_social) setObjetoSocial(extraido.objeto_social)

        if (Array.isArray(extraido.socios) && extraido.socios.length > 0) {
          setSocios(extraido.socios)
        }

        // Tentar correlacionar com credor existente se ainda em modo novo
        if (!credorExistente && extraido.cnpj) {
          const limpoCnpj = extraido.cnpj.replace(/\D/g, '')
          const matchCredor = credores.find((c) => c.cnpj_cpf.replace(/\D/g, '') === limpoCnpj)
          if (matchCredor) {
            setModoDestino('atualizar')
            setCredorSelecionadoId(matchCredor.id)
            toast.info(`Credor "${matchCredor.nome_razao_social}" identificado pelo CNPJ extraído!`)
          }
        }
      }

      if (extraido.aviso) {
        setAviso(extraido.aviso)
      }

      setEtapa('conferencia')
      toast.success('Contrato Social analisado pela IA com sucesso!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setAviso(
        `A leitura automática retornou erro (${msg}). Não se preocupe: você pode conferir o documento ao lado e preencher os campos manualmente.`,
      )
      setEtapa('conferencia')
      if (!razaoSocial) setRazaoSocial(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  function handleAdicionarSocio() {
    setSocios([
      ...socios,
      {
        nome: '',
        cpf_cnpj: '',
        qualificacao: 'Sócio',
        percentual_participacao: 0,
      },
    ])
  }

  function handleAtualizarSocio(
    index: number,
    campo: keyof SocioContratoSocialExtraido,
    valor: any,
  ) {
    const novos = [...socios]
    novos[index] = {
      ...novos[index],
      [campo]: valor,
    }
    setSocios(novos)
  }

  function handleRemoverSocio(index: number) {
    setSocios(socios.filter((_, i) => i !== index))
  }

  async function handleSalvar() {
    if (!razaoSocial.trim() || !cnpj.trim()) {
      toast.error('Informe a Razão Social e o CNPJ do credor.')
      return
    }

    setIsSubmitting(true)

    try {
      const targetId =
        modoDestino === 'atualizar' && credorSelecionadoId ? credorSelecionadoId : undefined

      const capSocNum = parseFloat(capitalSocial.replace(/[^\d.,]/g, '').replace(',', '.')) || 0

      const credorSalvo = await salvarCredorComContratoSocial(
        {
          nome_razao_social: razaoSocial.trim(),
          nome_fantasia: nomeFantasia.trim(),
          cnpj_cpf: cnpj.trim(),
          tipo_pessoa: tipoPessoa,
          categoria,
          capital_social: capSocNum,
          socios,
          cnae_principal: cnaePrincipal.trim(),
          objeto_social: objetoSocial.trim(),
          data_constituicao: dataConstituicao.trim(),
          endereco: enderecoCompleto.trim(),
          cidade_uf: cidadeUf.trim(),
          chave_pix: chavePix.trim(),
          banco_nome: bancoNome.trim(),
          banco_agencia: bancoAgencia.trim(),
          banco_conta: bancoConta.trim(),
          email: email.trim(),
          telefone: telefone.trim(),
          observacoes: observacoes.trim(),
          status: 'ativo',
        },
        targetId,
        arquivo,
      )

      // Registrar auditoria se possível
      try {
        await pb.collection('atividades').create({
          usuario: pb.authStore.record?.id || null,
          texto: `Contrato Social processado por IA e vinculado ao credor "${credorSalvo.nome_razao_social}" com ${socios.length} sócio(s).`,
          tipo: 'financeiro',
        })
      } catch {
        /* intentionally ignored */
      }

      toast.success(
        targetId
          ? `Credor "${credorSalvo.nome_razao_social}" atualizado com os dados do Contrato Social!`
          : `Novo credor "${credorSalvo.nome_razao_social}" cadastrado com sucesso!`,
      )

      onSalvo(credorSalvo)
      onOpenChange(false)
      resetar()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao salvar credor: ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetar()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded bg-orange-100 text-[#FF6A13]">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-neutral-900">
                Extração de Contrato Social por IA · AEROCAD
              </DialogTitle>
              <p className="text-xs text-neutral-500">
                Leitura societária inteligente de Contratos Sociais, Estatutos e Alterações
                Contratuais (PDF ou foto) com conferência lado a lado.
              </p>
            </div>
          </div>
        </DialogHeader>

        {etapa === 'upload' && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border-2 border-dashed border-neutral-300 hover:border-[#FF6A13] transition p-8 text-center bg-neutral-50/50">
              <input
                id={uploadInputId}
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFileSelected(f)
                }}
              />

              <div className="flex justify-center mb-3">
                <span className="p-3 rounded-full bg-orange-100 text-[#FF6A13]">
                  <Upload className="h-8 w-8" />
                </span>
              </div>

              <h4 className="font-semibold text-neutral-800 text-sm mb-1">
                Selecione o Contrato Social ou Alteração Contratual
              </h4>
              <p className="text-xs text-neutral-500 max-w-lg mx-auto mb-4">
                Envie o documento societário (PDF ou foto de boa qualidade). A IA Skip Cloud extrai
                razão social, CNPJ, quadro de sócios com percentuais, capital social, endereço, CNAE
                e objeto social. Todos os dados permanecem 100% editáveis para conferência.
              </p>

              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs"
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  Carregar Documento (PDF / Foto)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEtapa('conferencia')}
                  className="text-xs border-neutral-300"
                >
                  Preencher Manualmente
                </Button>
              </div>
            </div>
          </div>
        )}

        {etapa === 'analisando' && (
          <div className="py-16 text-center space-y-4">
            <div className="inline-flex items-center justify-center p-4 rounded-full bg-orange-50 text-[#FF6A13] animate-pulse">
              <Sparkles className="h-10 w-10 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-800">
                Auditor Societário Skip Cloud analisando Contrato Social...
              </h4>
              <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                Lendo cláusulas contratuais, qualificação de sócios, participações no capital,
                endereço, CNAE e objeto social para montagem da ficha.
              </p>
            </div>
          </div>
        )}

        {etapa === 'conferencia' && (
          <div className="space-y-4 py-2">
            {aviso && (
              <Alert className="py-2 text-xs border-amber-300 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-xs font-semibold text-amber-900">
                  Aviso de Extração
                </AlertTitle>
                <AlertDescription className="text-xs text-amber-800">{aviso}</AlertDescription>
              </Alert>
            )}

            {/* Seletor de Modo: Atualizar Credor Existente OU Criar Novo */}
            <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#FF6A13]" />
                <span className="font-semibold text-neutral-800">Destino dos Dados Extraídos:</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="modoDestino"
                    checked={modoDestino === 'novo'}
                    onChange={() => {
                      setModoDestino('novo')
                      setCredorSelecionadoId('')
                    }}
                    className="text-[#FF6A13] focus:ring-[#FF6A13]"
                  />
                  <span>Cadastrar Novo Credor</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="modoDestino"
                    checked={modoDestino === 'atualizar'}
                    onChange={() => setModoDestino('atualizar')}
                    className="text-[#FF6A13] focus:ring-[#FF6A13]"
                  />
                  <span>Atualizar Credor Já Existente</span>
                </label>
              </div>

              {modoDestino === 'atualizar' && (
                <div className="w-full sm:w-64">
                  <Select
                    value={credorSelecionadoId}
                    onValueChange={(val) => {
                      setCredorSelecionadoId(val)
                      const selecionado = credores.find((c) => c.id === val)
                      if (selecionado) {
                        preencherComCredorExistente(selecionado)
                        toast.info(`Dados do credor "${selecionado.nome_razao_social}" carregados.`)
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="Selecione o credor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {credores.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome_razao_social} ({c.cnpj_cpf})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Layout LADO A LADO: Documento à esquerda, Ficha editável à direita */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Lado Esquerdo: Prévia do documento */}
              <div className="lg:col-span-5 flex flex-col rounded-lg border border-neutral-300 bg-neutral-900 overflow-hidden min-h-[420px] max-h-[700px]">
                <div className="p-2 bg-neutral-800 text-neutral-300 text-xs flex items-center justify-between border-b border-neutral-700">
                  <span className="flex items-center gap-1.5 truncate">
                    <Paperclip className="h-3.5 w-3.5 text-neutral-400" />
                    <span className="truncate">{arquivo?.name || 'Documento do Contrato'}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {previewUrl && (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-neutral-300 hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-700"
                        title="Abrir em tela cheia"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Abrir
                      </a>
                    )}
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
                </div>

                {previewUrl ? (
                  isPdf ? (
                    <iframe
                      src={previewUrl}
                      title="Prévia do Contrato Social PDF"
                      className="w-full h-full min-h-[460px] border-0 rounded bg-white"
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center p-2 bg-neutral-950 overflow-auto">
                      <img
                        src={previewUrl}
                        alt="Prévia do Contrato Social"
                        className="max-h-[580px] w-auto object-contain rounded"
                      />
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 p-8 text-center">
                    <FileText className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-xs">Nenhum arquivo em prévia.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 text-xs border-neutral-600 text-neutral-300 hover:text-white"
                    >
                      Carregar Arquivo
                    </Button>
                  </div>
                )}
              </div>

              {/* Lado Direito: Formulário com campos editáveis */}
              <div className="lg:col-span-7 space-y-4 max-h-[700px] overflow-y-auto pr-1">
                {/* 1. Dados Básicos da Empresa */}
                <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/60 space-y-3">
                  <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#FF6A13]" />
                    Dados Cadastrais da Empresa
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-semibold">Razão Social *</Label>
                      <Input
                        value={razaoSocial}
                        onChange={(e) => setRazaoSocial(e.target.value)}
                        placeholder="Nome empresarial oficial"
                        className="h-8 text-xs font-semibold bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Nome Fantasia</Label>
                      <Input
                        value={nomeFantasia}
                        onChange={(e) => setNomeFantasia(e.target.value)}
                        placeholder="Nome fantasia se houver"
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">CNPJ *</Label>
                      <Input
                        value={cnpj}
                        onChange={(e) => setCnpj(e.target.value)}
                        placeholder="00.000.000/0000-00"
                        className="h-8 text-xs font-mono font-bold bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Capital Social (R$)</Label>
                      <Input
                        value={capitalSocial}
                        onChange={(e) => setCapitalSocial(e.target.value)}
                        placeholder="0,00"
                        className="h-8 text-xs font-mono bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Data de Constituição</Label>
                      <Input
                        value={dataConstituicao}
                        onChange={(e) => setDataConstituicao(e.target.value)}
                        placeholder="AAAA-MM-DD ou DD/MM/AAAA"
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Categoria</Label>
                      <Select
                        value={categoria}
                        onValueChange={(val: CategoriaCredor) => setCategoria(val)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORIA_CREDOR_LABELS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* 2. Quadro Societário (Sócios e Participações) */}
                <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-[#FF6A13]" />
                      Quadro de Sócios & Administradores ({socios.length})
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAdicionarSocio}
                      className="h-6 text-[11px] border-orange-300 text-[#FF6A13] hover:bg-orange-100"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar Sócio
                    </Button>
                  </div>

                  {socios.length === 0 ? (
                    <div className="p-3 rounded bg-white border border-neutral-200 text-center text-xs text-neutral-500">
                      Nenhum sócio identificado automaticamente. Clique em "Adicionar Sócio" para
                      incluir manualmente se aplicável.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {socios.map((socio, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg border border-neutral-200 bg-white grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                        >
                          <div className="sm:col-span-5 space-y-0.5">
                            <Label className="text-[10px] text-neutral-500">
                              Nome do Sócio / Titular
                            </Label>
                            <Input
                              value={socio.nome}
                              onChange={(e) => handleAtualizarSocio(idx, 'nome', e.target.value)}
                              placeholder="Nome completo"
                              className="h-7 text-xs"
                            />
                          </div>

                          <div className="sm:col-span-3 space-y-0.5">
                            <Label className="text-[10px] text-neutral-500">CPF / CNPJ</Label>
                            <Input
                              value={socio.cpf_cnpj || ''}
                              onChange={(e) =>
                                handleAtualizarSocio(idx, 'cpf_cnpj', e.target.value)
                              }
                              placeholder="000.000.000-00"
                              className="h-7 text-xs font-mono"
                            />
                          </div>

                          <div className="sm:col-span-2 space-y-0.5">
                            <Label className="text-[10px] text-neutral-500">Qualificação</Label>
                            <Input
                              value={socio.qualificacao || ''}
                              onChange={(e) =>
                                handleAtualizarSocio(idx, 'qualificacao', e.target.value)
                              }
                              placeholder="Administrador"
                              className="h-7 text-xs"
                            />
                          </div>

                          <div className="sm:col-span-1 space-y-0.5">
                            <Label className="text-[10px] text-neutral-500">% Part.</Label>
                            <Input
                              type="number"
                              value={socio.percentual_participacao ?? ''}
                              onChange={(e) =>
                                handleAtualizarSocio(
                                  idx,
                                  'percentual_participacao',
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              placeholder="%"
                              className="h-7 text-xs font-mono text-center px-1"
                            />
                          </div>

                          <div className="sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoverSocio(idx)}
                              className="h-7 w-7 text-neutral-400 hover:text-rose-600"
                              title="Remover sócio"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Atividades Econômicas, CNAE e Endereço */}
                <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/60 space-y-3">
                  <span className="text-xs font-bold text-neutral-800 block">
                    Localização & Atividades Econômicas
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs">Endereço Completo</Label>
                      <Input
                        value={enderecoCompleto}
                        onChange={(e) => setEnderecoCompleto(e.target.value)}
                        placeholder="Logradouro, nº, bairro, CEP"
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Cidade / UF</Label>
                      <Input
                        value={cidadeUf}
                        onChange={(e) => setCidadeUf(e.target.value)}
                        placeholder="Ex: Belo Horizonte / MG"
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">CNAE Principal</Label>
                    <Input
                      value={cnaePrincipal}
                      onChange={(e) => setCnaePrincipal(e.target.value)}
                      placeholder="Ex: 71.12-0-00 - Serviços de engenharia"
                      className="h-8 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Objeto Social</Label>
                    <Textarea
                      rows={2}
                      value={objetoSocial}
                      onChange={(e) => setObjetoSocial(e.target.value)}
                      placeholder="Descrição sucinta das atividades econômicas da empresa..."
                      className="text-xs bg-white"
                    />
                  </div>
                </div>

                {/* 4. Dados Bancários & Contato Adicional */}
                <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/60 space-y-3">
                  <span className="text-xs font-bold text-neutral-800 block">
                    Dados Bancários & Contato (Opcional)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs">Chave PIX</Label>
                      <Input
                        value={chavePix}
                        onChange={(e) => setChavePix(e.target.value)}
                        placeholder="Chave PIX para pagamento"
                        className="h-8 text-xs font-mono bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Banco</Label>
                      <Input
                        value={bancoNome}
                        onChange={(e) => setBancoNome(e.target.value)}
                        placeholder="Banco Favorecido"
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs">E-mail</Label>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="financeiro@empresa.com.br"
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Telefone</Label>
                      <Input
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-neutral-200 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
            disabled={isSubmitting}
          >
            Cancelar
          </Button>

          {etapa === 'conferencia' && (
            <Button
              type="button"
              onClick={handleSalvar}
              disabled={isSubmitting}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs font-semibold"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {isSubmitting
                ? 'Salvando...'
                : modoDestino === 'atualizar'
                  ? 'Atualizar Credor com Contrato Social'
                  : 'Cadastrar Novo Credor'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
