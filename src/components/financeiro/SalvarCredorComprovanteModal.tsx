import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { toast } from 'sonner'
import {
  Building2,
  CheckCircle2,
  Link2,
  AlertTriangle,
  Loader2,
  Sparkles,
  CreditCard,
  FileText,
  User,
  ArrowRight,
} from 'lucide-react'
import type { ContaPagarRecord, CredorRecord, CategoriaCredor, TipoPessoaCredor } from '@/types/crm'
import {
  CATEGORIA_CREDOR_LABELS,
  TIPO_PESSOA_LABELS,
  salvarCredor,
  CredorFormData,
} from '@/services/credores'
import {
  extrairDadosEstabelecimentoConta,
  vincularCredorAContaPagar,
  encontrarCredorCorrespondente,
} from '@/services/credorComprovanteMatcher'
import { formatCurrency, formatDate } from '@/lib/format'
import { formatarDocumento, limparDocumento } from '@/services/importacaoParser'

export interface SalvarCredorComprovanteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conta: ContaPagarRecord | null
  credores: CredorRecord[]
  usuarioId?: string | null
  onSuccess: (credorSalvoOuVinculado: CredorRecord) => Promise<void> | void
  /** Opcional: abre a revisão de leitura da conta caso dados estejam incompletos */
  onAbrirRevisaoLeitura?: (conta: ContaPagarRecord) => void
}

export function SalvarCredorComprovanteModal({
  open,
  onOpenChange,
  conta,
  credores,
  usuarioId,
  onSuccess,
  onAbrirRevisaoLeitura,
}: SalvarCredorComprovanteModalProps) {
  const [salvando, setSalvando] = useState(false)
  const [vinculandoExistente, setVinculandoExistente] = useState(false)

  // Formulário do novo credor
  const [formData, setFormData] = useState<CredorFormData>({
    nome_razao_social: '',
    nome_fantasia: '',
    cnpj_cpf: '',
    tipo_pessoa: 'pj',
    categoria: 'outros',
    email: '',
    telefone: '',
    endereco: '',
    cidade_uf: '',
    banco_nome: '',
    banco_agencia: '',
    banco_conta: '',
    chave_pix: '',
    status: 'ativo',
    observacoes: '',
  })

  // Credor correspondente detectado na base
  const [credorSugerido, setCredorSugerido] = useState<CredorRecord | null>(null)
  const [motivoSugerido, setMotivoSugerido] = useState<
    'documento_exato' | 'nome_semelhante' | null
  >(null)
  const [ignorarSugestao, setIgnorarSugestao] = useState(false)

  // Quando a conta selecionada mudar, inicializa formulário e executa matching
  useEffect(() => {
    if (!open || !conta) {
      setCredorSugerido(null)
      setMotivoSugerido(null)
      setIgnorarSugestao(false)
      return
    }

    const info = extrairDadosEstabelecimentoConta(conta, credores)

    setFormData({
      nome_razao_social: info.nome || conta.fornecedor || '',
      nome_fantasia: '',
      cnpj_cpf: info.cnpjCpf || '',
      tipo_pessoa: info.tipoPessoa,
      categoria: info.categoriaSugerida,
      email: '',
      telefone: '',
      endereco: '',
      cidade_uf: '',
      banco_nome: '',
      banco_agencia: '',
      banco_conta: '',
      chave_pix: info.documentoLimpo ? info.cnpjCpf : '',
      status: 'ativo',
      observacoes: `Credor cadastrado a partir do comprovante da conta "${conta.descricao || 'Despesa'}" (vencimento ${formatDate(conta.data_vencimento)}, R$ ${formatCurrency(conta.valor)})`,
    })

    setCredorSugerido(info.credorExistenteSugerido)
    setMotivoSugerido(info.motivoCorrespondencia || null)
    setIgnorarSugestao(false)
  }, [open, conta, credores])

  // Recalcula duplicidade caso o usuário edite o CNPJ/CPF ou Razão Social no form
  const checarCorrespondenciaDinamica = (novoNome: string, novoDoc: string) => {
    const match = encontrarCredorCorrespondente(novoNome, novoDoc, credores)
    if (match) {
      setCredorSugerido(match.credor)
      setMotivoSugerido(match.motivo)
    } else {
      setCredorSugerido(null)
      setMotivoSugerido(null)
    }
  }

  // Ação 1: Vincular ao credor já existente em vez de criar duplicado
  async function handleVincularExistente(credorAlvo: CredorRecord) {
    if (!conta) return
    setVinculandoExistente(true)
    try {
      await vincularCredorAContaPagar(conta.id, credorAlvo, usuarioId)
      toast.success(`Conta vinculada com sucesso ao credor "${credorAlvo.nome_razao_social}"!`)
      onOpenChange(false)
      await onSuccess(credorAlvo)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao vincular credor: ${msg}`)
    } finally {
      setVinculandoExistente(false)
    }
  }

  // Ação 2: Criar novo credor e vincular automaticamente à conta
  async function handleCriarEVincular(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!conta) return

    const razao = formData.nome_razao_social.trim()
    if (!razao) {
      toast.error('Informe a Razão Social ou Nome Completo do credor.')
      return
    }

    const docLimpo = limparDocumento(formData.cnpj_cpf)
    if (!docLimpo) {
      toast.error('Informe o CNPJ ou CPF do credor.')
      return
    }

    if (formData.tipo_pessoa === 'pj' && docLimpo.length !== 14) {
      toast.warning('CNPJ com tamanho diferente do padrão de 14 dígitos. Verifique o número.')
    } else if (formData.tipo_pessoa === 'pf' && docLimpo.length !== 11) {
      toast.warning('CPF com tamanho diferente do padrão de 11 dígitos. Verifique o número.')
    }

    setSalvando(true)
    try {
      // 1. Grava novo registro na coleção 'credores'
      const novoCredor = await salvarCredor({
        ...formData,
        nome_razao_social: razao,
        cnpj_cpf: formatarDocumento(docLimpo),
        status: 'ativo',
      })

      // 2. Vincula imediatamente à conta a pagar em questão
      await vincularCredorAContaPagar(conta.id, novoCredor, usuarioId)

      toast.success(
        `Credor "${novoCredor.nome_razao_social}" cadastrado com sucesso e vinculado à conta!`,
      )

      onOpenChange(false)
      await onSuccess(novoCredor)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao cadastrar credor: ${msg}`)
    } finally {
      setSalvando(false)
    }
  }

  if (!conta) return null

  const infoExtracao = extrairDadosEstabelecimentoConta(conta, credores)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-[#FF6A13] shrink-0">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2">
                <span>Salvar Estabelecimento como Credor</span>
                <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-full bg-orange-100 text-[#D65100] border border-orange-200">
                  Integração Financeira
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500">
                Cadastre o credor oficial na base do CRM AEROCAD a partir dos dados do comprovante e
                vincule o lançamento imediatamente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo da Conta de Origem */}
        <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/70 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-700 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-[#FF6A13]" />
              Dados da Conta a Pagar Selecionada
            </span>
            <span className="font-mono font-bold text-neutral-900">
              R$ {formatCurrency(conta.valor)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-neutral-600">
            <div>
              <span className="text-neutral-400 block">Descrição:</span>
              <span className="font-medium text-neutral-800 line-clamp-1">{conta.descricao}</span>
            </div>
            <div>
              <span className="text-neutral-400 block">Estabelecimento na Conta:</span>
              <span className="font-medium text-neutral-800 line-clamp-1">
                {conta.fornecedor || '—'}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block">Vencimento:</span>
              <span className="font-medium text-neutral-800 font-mono">
                {formatDate(conta.data_vencimento)}
              </span>
            </div>
          </div>

          {/* Aviso se a leitura foi fraca/sem dados claros */}
          {!infoExtracao.temDadosValidos && (
            <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between gap-2 mt-1">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>
                  O nome do estabelecimento ou CNPJ não foi identificado automaticamente no registro
                  da conta.
                </span>
              </div>
              {onAbrirRevisaoLeitura && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false)
                    onAbrirRevisaoLeitura(conta)
                  }}
                  className="h-6 text-[10px] px-2 text-[#FF6A13] border-orange-300 bg-white hover:bg-orange-50 shrink-0 font-semibold"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  Revisar leitura
                </Button>
              )}
            </div>
          )}
        </div>

        {/* SUGESTÃO DE CREDOR EXISTENTE (DUPLICIDADE) */}
        {credorSugerido && !ignorarSugestao && (
          <div className="p-3.5 rounded-xl border-2 border-amber-300 bg-amber-50/80 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <div className="p-1 rounded-full bg-amber-200 text-amber-900 shrink-0 mt-0.5">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-950">
                    Credor já existente identificado na base AEROCAD
                  </h4>
                  <p className="text-[11px] text-amber-900/90 mt-0.5">
                    {motivoSugerido === 'documento_exato'
                      ? 'Localizamos um credor cadastrado com o MESMO CNPJ/CPF informado no comprovante.'
                      : 'Localizamos um credor com Razão Social / Nome Fantasia muito semelhante na base.'}{' '}
                    Para evitar duplicidade no cadastro, recomendamos vincular a esta conta
                    diretamente.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-[#FF6A13]" />
                  {credorSugerido.nome_razao_social}
                  {credorSugerido.nome_fantasia && (
                    <span className="text-[11px] text-neutral-500 font-normal">
                      ({credorSugerido.nome_fantasia})
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-neutral-600 font-mono flex items-center gap-3">
                  <span>Doc: {credorSugerido.cnpj_cpf}</span>
                  <span>
                    Categoria:{' '}
                    {CATEGORIA_CREDOR_LABELS[credorSugerido.categoria] || credorSugerido.categoria}
                  </span>
                  {credorSugerido.chave_pix && <span>PIX: {credorSugerido.chave_pix}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleVincularExistente(credorSugerido)}
                  disabled={vinculandoExistente}
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs font-semibold h-8 shadow-sm"
                >
                  {vinculandoExistente ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Vincular ao Credor Existente
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIgnorarSugestao(true)}
                  className="text-[11px] text-neutral-500 hover:text-neutral-800 h-8"
                  title="Criar mesmo assim um novo registro"
                >
                  Criar novo mesmo assim
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Formulário pré-preenchido de criação de credor */}
        <form onSubmit={handleCriarEVincular} className="space-y-4 text-xs">
          <div className="p-3.5 rounded-lg border border-neutral-200 bg-white space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold text-neutral-900 flex items-center gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-[#FF6A13]" />
                Dados do Novo Credor (Pré-preenchidos pelo comprovante)
              </span>
              <span className="text-[10px] text-neutral-400 font-normal">
                Todos os campos são 100% editáveis
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-neutral-800">Tipo de Pessoa *</Label>
                <Select
                  value={formData.tipo_pessoa}
                  onValueChange={(val: TipoPessoaCredor) => {
                    setFormData({ ...formData, tipo_pessoa: val })
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_PESSOA_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-semibold text-neutral-800">
                  Razão Social / Nome do Estabelecimento *
                </Label>
                <Input
                  required
                  value={formData.nome_razao_social}
                  onChange={(e) => {
                    const novoNome = e.target.value
                    setFormData({ ...formData, nome_razao_social: novoNome })
                    checarCorrespondenciaDinamica(novoNome, formData.cnpj_cpf)
                  }}
                  placeholder="Ex: Auto Posto Petrobras Ltda"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-neutral-800">
                  {formData.tipo_pessoa === 'pj' ? 'CNPJ *' : 'CPF *'}
                </Label>
                <Input
                  required
                  value={formData.cnpj_cpf}
                  onChange={(e) => {
                    const novoDoc = e.target.value
                    setFormData({ ...formData, cnpj_cpf: novoDoc })
                    checarCorrespondenciaDinamica(formData.nome_razao_social, novoDoc)
                  }}
                  placeholder={
                    formData.tipo_pessoa === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'
                  }
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-neutral-700">Nome Fantasia (Opcional)</Label>
                <Input
                  value={formData.nome_fantasia}
                  onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                  placeholder="Nome comercial resumido"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-neutral-800">
                  Categoria do Credor *
                </Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(val: CategoriaCredor) =>
                    setFormData({ ...formData, categoria: val })
                  }
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

            {/* Contato & Dados para Liquidação */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-neutral-100">
              <div className="space-y-1">
                <Label className="text-xs text-neutral-700">Chave PIX (Opcional)</Label>
                <Input
                  value={formData.chave_pix}
                  onChange={(e) => setFormData({ ...formData, chave_pix: e.target.value })}
                  placeholder="CNPJ, CPF, e-mail ou aleatória"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-neutral-700">Telefone / WhatsApp</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-neutral-700">E-mail Financeiro</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="financeiro@empresa.com.br"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-neutral-700">Observações Cadastrais</Label>
              <Textarea
                rows={2}
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={salvando || vinculandoExistente}
              className="w-full sm:w-auto h-8 text-xs"
            >
              Cancelar
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={salvando || vinculandoExistente || !formData.nome_razao_social.trim()}
                className="w-full sm:w-auto bg-[#FF6A13] hover:bg-[#E85B06] text-white h-8 text-xs font-semibold shadow-sm"
              >
                {salvando ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Salvando e Vinculando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Salvar como Credor & Vincular
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
