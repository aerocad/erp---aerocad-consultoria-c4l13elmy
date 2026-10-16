import { useState, useMemo } from 'react'
import {
  Search,
  Plus,
  Filter,
  Building2,
  User,
  Users,
  CreditCard,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Paperclip,
  FileText,
  CheckCircle2,
  AlertTriangle,
  History,
  Ban,
  ArrowRight,
  Landmark,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CrmBadge } from '@/components/common/CrmBadge'
import { formatCurrency, formatDate } from '@/lib/format'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import type { CredorRecord, ContaPagarRecord, TipoPessoaCredor, CategoriaCredor } from '@/types/crm'
import {
  CATEGORIA_CREDOR_LABELS,
  TIPO_PESSOA_LABELS,
  CredorFormData,
  salvarCredor,
  verificarImpactoExclusaoCredor,
  excluirCredor,
  desativarCredor,
  ImpactoExclusaoCredor,
} from '@/services/credores'
import { SalvarCredorComprovanteModal } from '@/components/financeiro/SalvarCredorComprovanteModal'
import { VincularCredoresLoteModal } from '@/components/financeiro/VincularCredoresLoteModal'
import { ExtracaoContratoSocialModal } from '@/components/financeiro/ExtracaoContratoSocialModal'

interface CredoresTabProps {
  credores: CredorRecord[]
  contasPagar: ContaPagarRecord[]
  canWrite: boolean
  canDelete: boolean
  onReload: () => Promise<void> | void
}

const emptyForm: CredorFormData = {
  nome_razao_social: '',
  nome_fantasia: '',
  cnpj_cpf: '',
  tipo_pessoa: 'pj',
  categoria: 'fornecedor_servicos',
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
}

export function CredoresTab({
  credores,
  contasPagar,
  canWrite,
  canDelete,
  onReload,
}: CredoresTabProps) {
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')
  const [statusFiltro, setStatusFiltro] = useState<string>('todos')
  const [tipoPessoaFiltro, setTipoPessoaFiltro] = useState<string>('todos')

  // Modais
  const [modalFormOpen, setModalFormOpen] = useState(false)
  const [editingCredor, setEditingCredor] = useState<CredorRecord | null>(null)
  const [formData, setFormData] = useState<CredorFormData>(emptyForm)
  const [arquivosAnexos, setArquivosAnexos] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  // Modal de Histórico de Contas a Pagar
  const [modalHistoricoOpen, setModalHistoricoOpen] = useState(false)
  const [credorHistorico, setCredorHistorico] = useState<CredorRecord | null>(null)

  // Modais de Criação a partir de Comprovantes e Lote
  const [modalLoteOpen, setModalLoteOpen] = useState(false)
  const [modalIndividualComprovanteOpen, setModalIndividualComprovanteOpen] = useState(false)
  const [contaSelecionadaComprovante, setContaSelecionadaComprovante] =
    useState<ContaPagarRecord | null>(null)

  // Modal de Extração de Contrato Social por IA
  const [modalContratoSocialOpen, setModalContratoSocialOpen] = useState(false)
  const [credorParaContratoSocial, setCredorParaContratoSocial] = useState<CredorRecord | null>(
    null,
  )

  // Modal de Exclusão com verificação de impacto
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false)
  const [credorParaExcluir, setCredorParaExcluir] = useState<CredorRecord | null>(null)
  const [impactoExclusao, setImpactoExclusao] = useState<ImpactoExclusaoCredor | null>(null)
  const [verificandoImpacto, setVerificandoImpacto] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Mapeamento de contas por credor para performance
  const contasPorCredor = useMemo(() => {
    const mapa = new Map<string, ContaPagarRecord[]>()
    for (const conta of contasPagar) {
      if (conta.credor) {
        const arr = mapa.get(conta.credor) || []
        arr.push(conta)
        mapa.set(conta.credor, arr)
      }
    }
    return mapa
  }, [contasPagar])

  // Contas com comprovante sem credor vinculado
  const contasSemCredorComComprovante = useMemo(() => {
    return contasPagar.filter((c) => {
      const semCredor = !c.credor && !c.expand?.credor
      const temComprovante = Boolean(
        (Array.isArray(c.comprovante) && c.comprovante.length > 0) ||
        (typeof c.comprovante === 'string' && c.comprovante.trim().length > 0) ||
        (Array.isArray(c.comprovantes_metadados) && c.comprovantes_metadados.length > 0),
      )
      return semCredor && temComprovante
    })
  }, [contasPagar])

  // Filtros
  const credoresFiltrados = useMemo(() => {
    return credores.filter((c) => {
      const matchBusca =
        (c.nome_razao_social || '').toLowerCase().includes(busca.toLowerCase()) ||
        (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(busca.toLowerCase())) ||
        (c.cnpj_cpf || '').toLowerCase().includes(busca.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(busca.toLowerCase())) ||
        (c.chave_pix && c.chave_pix.toLowerCase().includes(busca.toLowerCase()))

      const matchCat = categoriaFiltro === 'todas' || c.categoria === categoriaFiltro
      const matchStatus = statusFiltro === 'todos' || c.status === statusFiltro
      const matchTipo = tipoPessoaFiltro === 'todos' || c.tipo_pessoa === tipoPessoaFiltro

      return matchBusca && matchCat && matchStatus && matchTipo
    })
  }, [credores, busca, categoriaFiltro, statusFiltro, tipoPessoaFiltro])

  // Contagens gerais
  const totalAtivos = credores.filter((c) => c.status === 'ativo').length
  const totalInativos = credores.filter((c) => c.status === 'inativo').length
  const totalPJ = credores.filter((c) => c.tipo_pessoa === 'pj').length
  const totalPF = credores.filter((c) => c.tipo_pessoa === 'pf').length

  function handleOpenCreate() {
    setEditingCredor(null)
    setFormData(emptyForm)
    setArquivosAnexos([])
    setModalFormOpen(true)
  }

  function handleOpenEdit(credor: CredorRecord) {
    setEditingCredor(credor)
    setFormData({
      nome_razao_social: credor.nome_razao_social || '',
      nome_fantasia: credor.nome_fantasia || '',
      cnpj_cpf: credor.cnpj_cpf || '',
      tipo_pessoa: credor.tipo_pessoa || 'pj',
      categoria: credor.categoria || 'fornecedor_servicos',
      email: credor.email || '',
      telefone: credor.telefone || '',
      endereco: credor.endereco || '',
      cidade_uf: credor.cidade_uf || '',
      banco_nome: credor.banco_nome || '',
      banco_agencia: credor.banco_agencia || '',
      banco_conta: credor.banco_conta || '',
      chave_pix: credor.chave_pix || '',
      status: credor.status || 'ativo',
      observacoes: credor.observacoes || '',
    })
    setArquivosAnexos([])
    setModalFormOpen(true)
  }

  async function handleOpenExcluir(credor: CredorRecord) {
    setCredorParaExcluir(credor)
    setVerificandoImpacto(true)
    setModalExcluirOpen(true)
    try {
      const impacto = await verificarImpactoExclusaoCredor(credor.id)
      setImpactoExclusao(impacto)
    } finally {
      setVerificandoImpacto(false)
    }
  }

  function handleOpenHistorico(credor: CredorRecord) {
    setCredorHistorico(credor)
    setModalHistoricoOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.nome_razao_social.trim() || !formData.cnpj_cpf.trim()) {
      toast.error('Informe a Razão Social / Nome e o CNPJ / CPF do credor.')
      return
    }

    setSaving(true)
    try {
      await salvarCredor(formData, editingCredor?.id, arquivosAnexos)
      toast.success(
        editingCredor
          ? 'Credor atualizado com sucesso!'
          : 'Novo credor cadastrado no CRM Financeiro!',
      )
      setModalFormOpen(false)
      await onReload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao salvar credor: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmarExclusao() {
    if (!credorParaExcluir) return
    setActionLoading(true)
    try {
      await excluirCredor(credorParaExcluir.id)
      toast.success('Credor excluído com sucesso!')
      setModalExcluirOpen(false)
      setCredorParaExcluir(null)
      await onReload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Não foi possível excluir: ${msg}`)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDesativarEmVezDeExcluir() {
    if (!credorParaExcluir) return
    setActionLoading(true)
    try {
      await desativarCredor(credorParaExcluir.id)
      toast.success(`Credor "${credorParaExcluir.nome_razao_social}" inativado com segurança!`)
      setModalExcluirOpen(false)
      setCredorParaExcluir(null)
      await onReload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao inativar credor: ${msg}`)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Card de Alerta / Limpeza de Histórico: Contas com comprovante sem credor */}
      {canWrite && contasSemCredorComComprovante.length > 0 && (
        <div className="p-3.5 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50/90 to-orange-50/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-100 text-[#FF6A13] shrink-0 mt-0.5">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <span>Comprovantes com empresas a cadastrar como credor</span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-amber-200 text-amber-900 font-bold">
                  {contasSemCredorComComprovante.length} pendentes
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 mt-0.5">
                Existem contas a pagar salvas com comprovante/boleto que ainda não possuem credor
                oficial vinculado. Regularize o histórico de uma vez.
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => setModalLoteOpen(true)}
            className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs font-semibold h-8 shrink-0 shadow-sm"
          >
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            Regularizar Credores em Lote
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="crm-card p-3 sm:p-4 border-l-4 border-l-[#FF6A13]">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            <span>Ativos</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-neutral-900">{totalAtivos}</p>
          <span className="text-[11px] text-neutral-400">Credores habilitados para pagamentos</span>
        </div>

        <div className="crm-card p-3 sm:p-4 border-l-4 border-l-neutral-400">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            <span>Inativos</span>
            <Ban className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-neutral-700">{totalInativos}</p>
          <span className="text-[11px] text-neutral-400">Histórico mantido no CRM</span>
        </div>

        <div className="crm-card p-3 sm:p-4 border-l-4 border-l-sky-500">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            <span>Pessoas Jurídicas</span>
            <Building2 className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-sky-700">{totalPJ}</p>
          <span className="text-[11px] text-neutral-400">Empresas com CNPJ</span>
        </div>

        <div className="crm-card p-3 sm:p-4 border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            <span>Pessoas Físicas</span>
            <User className="h-4 w-4 text-teal-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-teal-700">{totalPF}</p>
          <span className="text-[11px] text-neutral-400">Autônomos / CPF</span>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="crm-card p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por razão social, nome fantasia, CNPJ/CPF, e-mail ou PIX..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <Filter className="mr-1.5 h-3.5 w-3.5 text-neutral-400" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {Object.entries(CATEGORIA_CREDOR_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tipoPessoaFiltro} onValueChange={setTipoPessoaFiltro}>
            <SelectTrigger className="w-[120px] h-9 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos tipos</SelectItem>
              <SelectItem value="pj">PJ (CNPJ)</SelectItem>
              <SelectItem value="pf">PF (CPF)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger className="w-[110px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>

          {canWrite && contasSemCredorComComprovante.length > 0 && (
            <Button
              type="button"
              onClick={() => setModalLoteOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white h-9 text-xs font-semibold shrink-0"
              title="Criar e vincular credores a partir dos comprovantes salvos em contas a pagar"
            >
              <Building2 className="mr-1.5 h-4 w-4" />
              Importar de Comprovantes ({contasSemCredorComComprovante.length})
            </Button>
          )}

          {canWrite && (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                onClick={() => {
                  setCredorParaContratoSocial(null)
                  setModalContratoSocialOpen(true)
                }}
                variant="outline"
                className="border-orange-300 text-[#FF6A13] hover:bg-orange-50 h-9 text-xs font-semibold shrink-0"
                title="Carregar Contrato Social / Alteração Contratual de um credor para extrair dados e sócios via IA"
              >
                <FileText className="mr-1.5 h-4 w-4" />
                Extrair Contrato Credor (IA)
              </Button>
              <a
                href="/configuracoes"
                className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-[#FF6A13] px-2 py-1.5 rounded hover:bg-orange-50 transition border border-transparent hover:border-orange-200"
                title="Ir para o cadastro societário oficial da própria AEROCAD em Configurações"
              >
                <Building2 className="h-3.5 w-3.5 text-[#FF6A13]" />
                <span className="hidden lg:inline">Contrato AEROCAD</span>
              </a>
            </div>
          )}

          {canWrite && (
            <Button
              onClick={handleOpenCreate}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white h-9 text-xs font-semibold shrink-0"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Credor
            </Button>
          )}
        </div>
      </div>

      {/* Listagem em Tabela */}
      {credoresFiltrados.length === 0 ? (
        <div className="crm-card p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-neutral-300 mb-2" />
          <p className="text-sm font-semibold text-neutral-700">Nenhum credor encontrado</p>
          <p className="text-xs text-neutral-400 mt-1">
            {busca || categoriaFiltro !== 'todas' || statusFiltro !== 'todos'
              ? 'Tente ajustar os filtros ou a busca digitada.'
              : 'Cadastre o primeiro credor financeiro ou extraia a partir de um boleto em Contas a Pagar.'}
          </p>
        </div>
      ) : (
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Credor / Razão Social</th>
                  <th className="px-4 py-3">CNPJ / CPF</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3">Dados Bancários / PIX</th>
                  <th className="px-4 py-3 text-center">Contas a Pagar</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {credoresFiltrados.map((credor) => {
                  const contasDoCredor = contasPorCredor.get(credor.id) || []
                  const totalPagar = contasDoCredor
                    .filter((c) => c.status !== 'pago' && c.status !== 'cancelado')
                    .reduce((acc, c) => acc + (c.valor || 0), 0)

                  return (
                    <tr key={credor.id} className="hover:bg-[#FFF6EC]/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`p-1.5 rounded text-[10px] font-bold ${
                              credor.tipo_pessoa === 'pj'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-teal-50 text-teal-700 border border-teal-200'
                            }`}
                          >
                            {credor.tipo_pessoa === 'pj' ? 'PJ' : 'PF'}
                          </span>
                          <div>
                            <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                              <span>{credor.nome_razao_social}</span>
                              {credor.contrato_social && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-orange-100 text-[#FF6A13]"
                                  title="Contrato Social arquivado e auditado"
                                >
                                  <FileText className="h-2.5 w-2.5" />
                                  Contrato
                                </span>
                              )}
                              {Array.isArray(credor.socios) && credor.socios.length > 0 && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-neutral-100 text-neutral-700"
                                  title={`${credor.socios.length} sócio(s) cadastrado(s)`}
                                >
                                  <Users className="h-2.5 w-2.5 text-neutral-500" />
                                  {credor.socios.length}
                                </span>
                              )}
                            </div>
                            {credor.nome_fantasia && (
                              <span className="text-[11px] text-neutral-500 font-normal block">
                                {credor.nome_fantasia}
                              </span>
                            )}
                            {credor.cidade_uf && (
                              <div className="flex items-center gap-1 text-[10px] text-neutral-400 mt-0.5">
                                <MapPin className="h-3 w-3" />
                                {credor.cidade_uf}
                              </div>
                            )}
                            {credor.cnae_principal && (
                              <div
                                className="text-[10px] text-neutral-500 truncate max-w-xs mt-0.5"
                                title={credor.cnae_principal}
                              >
                                CNAE: {credor.cnae_principal}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-neutral-700 whitespace-nowrap">
                        {credor.cnpj_cpf}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex rounded-full bg-neutral-100 text-neutral-800 text-[10px] font-semibold px-2 py-0.5 border border-neutral-200">
                          {CATEGORIA_CREDOR_LABELS[credor.categoria] || credor.categoria}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {credor.telefone && (
                            <div className="flex items-center gap-1 text-[11px] text-neutral-600">
                              <Phone className="h-3 w-3 text-neutral-400" />
                              {credor.telefone}
                            </div>
                          )}
                          {credor.email && (
                            <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                              <Mail className="h-3 w-3 text-neutral-400" />
                              <span className="truncate max-w-[150px]">{credor.email}</span>
                            </div>
                          )}
                          {!credor.telefone && !credor.email && (
                            <span className="text-neutral-300 italic text-[11px]">Sem contato</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-0.5 max-w-[200px]">
                          {credor.chave_pix && (
                            <div className="font-mono text-[11px] text-[#D65100] font-semibold truncate">
                              PIX: {credor.chave_pix}
                            </div>
                          )}
                          {credor.banco_nome && (
                            <div className="text-[11px] text-neutral-600 truncate flex items-center gap-1">
                              <Landmark className="h-3 w-3 text-neutral-400 shrink-0" />
                              <span>
                                {credor.banco_nome}
                                {credor.banco_agencia ? ` · Ag ${credor.banco_agencia}` : ''}
                                {credor.banco_conta ? ` · CC ${credor.banco_conta}` : ''}
                              </span>
                            </div>
                          )}
                          {!credor.chave_pix && !credor.banco_nome && (
                            <span className="text-neutral-400 italic text-[11px]">
                              Não informado
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenHistorico(credor)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-medium transition"
                          title="Ver histórico de contas a pagar vinculadas"
                        >
                          <History className="h-3.5 w-3.5 text-[#FF6A13]" />
                          <span>{contasDoCredor.length} contas</span>
                          {totalPagar > 0 && (
                            <span className="text-[10px] text-amber-700 font-bold">
                              (R$ {formatCurrency(totalPagar)})
                            </span>
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <CrmBadge tone={credor.status === 'ativo' ? 'green' : 'gray'}>
                          {credor.status === 'ativo' ? 'ATIVO' : 'INATIVO'}
                        </CrmBadge>
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {canWrite && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setCredorParaContratoSocial(credor)
                                setModalContratoSocialOpen(true)
                              }}
                              className="h-8 w-8 text-neutral-500 hover:text-[#FF6A13]"
                              title="Extrair / Vincular Contrato Social por IA"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {canWrite && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(credor)}
                              className="h-8 w-8 text-neutral-500 hover:text-[#FF6A13]"
                              title="Editar dados do credor"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenExcluir(credor)}
                              className="h-8 w-8 text-neutral-400 hover:text-rose-600"
                              title="Excluir ou inativar credor"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Formulário (Criar / Editar) */}
      <Dialog open={modalFormOpen} onOpenChange={setModalFormOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded bg-orange-100 text-[#FF6A13]">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <DialogTitle className="text-base font-bold text-neutral-900">
                    {editingCredor ? 'Editar Cadastro de Credor' : 'Novo Cadastro de Credor'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-neutral-500">
                    Cadastro financeiro oficial para integração com Contas a Pagar e extração de
                    boletos.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {/* Bloco 1: Dados Fiscais e Básicos */}
              <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-3">
                <span className="text-xs font-bold text-neutral-800 block">
                  Identificação do Credor
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Tipo de Pessoa *</Label>
                    <Select
                      value={formData.tipo_pessoa}
                      onValueChange={(val: TipoPessoaCredor) =>
                        setFormData({ ...formData, tipo_pessoa: val })
                      }
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
                    <Label className="text-xs font-semibold">Razão Social / Nome Completo *</Label>
                    <Input
                      required
                      value={formData.nome_razao_social}
                      onChange={(e) =>
                        setFormData({ ...formData, nome_razao_social: e.target.value })
                      }
                      placeholder="Ex: Companhia Energética de Minas Gerais S.A."
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      {formData.tipo_pessoa === 'pj' ? 'CNPJ *' : 'CPF *'}
                    </Label>
                    <Input
                      required
                      value={formData.cnpj_cpf}
                      onChange={(e) => setFormData({ ...formData, cnpj_cpf: e.target.value })}
                      placeholder={
                        formData.tipo_pessoa === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'
                      }
                      className="h-8 text-xs bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Nome Fantasia / Apelido</Label>
                    <Input
                      value={formData.nome_fantasia}
                      onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                      placeholder="Ex: CEMIG, CREA, Escritório X"
                      className="h-8 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Categoria Financeira *</Label>
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
              </div>

              {/* Bloco 2: Contato e Endereço */}
              <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-3">
                <span className="text-xs font-bold text-neutral-800 block">Contato & Endereço</span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">E-mail para Cobrança / Notificação</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="financeiro@credor.com.br"
                      className="h-8 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Telefone / WhatsApp</Label>
                    <Input
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="h-8 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Cidade / UF</Label>
                    <Input
                      value={formData.cidade_uf}
                      onChange={(e) => setFormData({ ...formData, cidade_uf: e.target.value })}
                      placeholder="Belo Horizonte / MG"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Endereço Completo</Label>
                  <Input
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    placeholder="Av. Principal, nº 1000, Sala 501, Bairro, CEP"
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>

              {/* Bloco 3: Dados Bancários para Pagamento */}
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-[#FF6A13]" />
                    Dados Bancários para Liquidação / Pagamento
                  </span>
                  <span className="text-[10px] text-amber-800">
                    Utilizado para conferência e quitação em Contas a Pagar
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Chave PIX</Label>
                    <Input
                      value={formData.chave_pix}
                      onChange={(e) => setFormData({ ...formData, chave_pix: e.target.value })}
                      placeholder="CNPJ, CPF, e-mail, telefone ou chave aleatória"
                      className="h-8 text-xs bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Banco Favorecido</Label>
                    <Input
                      value={formData.banco_nome}
                      onChange={(e) => setFormData({ ...formData, banco_nome: e.target.value })}
                      placeholder="Ex: Banco do Brasil, Itaú, Santander, Bradesco"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Agência (com dígito se houver)</Label>
                    <Input
                      value={formData.banco_agencia}
                      onChange={(e) => setFormData({ ...formData, banco_agencia: e.target.value })}
                      placeholder="Ex: 1234-5"
                      className="h-8 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Conta Corrente / Poupança</Label>
                    <Input
                      value={formData.banco_conta}
                      onChange={(e) => setFormData({ ...formData, banco_conta: e.target.value })}
                      placeholder="Ex: 98765-4"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Bloco 4: Status, Anexos e Observações */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Status do Cadastro</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: 'ativo' | 'inativo') =>
                      setFormData({ ...formData, status: val })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo (Permite lançamentos)</SelectItem>
                      <SelectItem value="inativo">Inativo (Bloqueado para novas contas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">
                    Anexar Contratos / Comprovantes de Cadastro (Opcional)
                  </Label>
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,image/png,image/jpeg,image/jpg"
                    onChange={(e) => {
                      if (e.target.files) {
                        setArquivosAnexos(Array.from(e.target.files))
                      }
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Observações Internas</Label>
                <Textarea
                  rows={2}
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Informações contratuais adicionais, prazos acordados, contato do financeiro..."
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-neutral-200 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalFormOpen(false)}
                className="text-xs"
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs font-semibold"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                {saving ? 'Gravando...' : editingCredor ? 'Salvar Alterações' : 'Cadastrar Credor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Histórico de Contas a Pagar Vinculadas */}
      <Dialog open={modalHistoricoOpen} onOpenChange={setModalHistoricoOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded bg-orange-100 text-[#FF6A13]">
                <History className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-neutral-900">
                  Histórico de Contas: {credorHistorico?.nome_razao_social}
                </DialogTitle>
                <DialogDescription className="text-xs text-neutral-500">
                  Documento: {credorHistorico?.cnpj_cpf} · Categoria:{' '}
                  {credorHistorico ? CATEGORIA_CREDOR_LABELS[credorHistorico.categoria] : ''}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {credorHistorico && (
            <div className="space-y-4 py-2">
              {(() => {
                const contas = contasPorCredor.get(credorHistorico.id) || []
                const abertas = contas.filter(
                  (c) => c.status !== 'pago' && c.status !== 'cancelado',
                )
                const pagas = contas.filter((c) => c.status === 'pago')
                const totalAberto = abertas.reduce((acc, c) => acc + (c.valor || 0), 0)
                const totalPago = pagas.reduce((acc, c) => acc + (c.valor || 0), 0)

                return (
                  <>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50">
                        <span className="text-[11px] text-neutral-500 font-semibold block">
                          Total Lançado
                        </span>
                        <span className="text-base font-bold text-neutral-900 font-mono">
                          {contas.length} contas
                        </span>
                      </div>
                      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/40">
                        <span className="text-[11px] text-amber-800 font-semibold block">
                          Em Aberto
                        </span>
                        <span className="text-base font-bold text-amber-900 font-mono">
                          R$ {formatCurrency(totalAberto)} ({abertas.length})
                        </span>
                      </div>
                      <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40">
                        <span className="text-[11px] text-emerald-800 font-semibold block">
                          Total Pago
                        </span>
                        <span className="text-base font-bold text-emerald-900 font-mono">
                          R$ {formatCurrency(totalPago)} ({pagas.length})
                        </span>
                      </div>
                    </div>

                    {contas.length === 0 ? (
                      <div className="py-8 text-center text-xs text-neutral-500">
                        Nenhuma conta a pagar vinculada a este credor ainda.
                      </div>
                    ) : (
                      <div className="rounded-lg border border-neutral-200 overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200">
                            <tr>
                              <th className="px-3 py-2">Vencimento</th>
                              <th className="px-3 py-2">Descrição</th>
                              <th className="px-3 py-2">Valor</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Pagamento</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 bg-white">
                            {contas.map((c) => (
                              <tr key={c.id} className="hover:bg-neutral-50">
                                <td className="px-3 py-2 font-mono whitespace-nowrap">
                                  {formatDate(c.data_vencimento)}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="font-semibold text-neutral-900 line-clamp-1">
                                    {c.descricao}
                                  </div>
                                  {c.numero_documento && (
                                    <span className="text-[10px] text-neutral-400">
                                      Doc: {c.numero_documento}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">
                                  R$ {formatCurrency(c.valor)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <CrmBadge
                                    tone={
                                      c.status === 'pago'
                                        ? 'green'
                                        : c.status === 'cancelado'
                                          ? 'gray'
                                          : 'amber'
                                    }
                                  >
                                    {c.status.toUpperCase()}
                                  </CrmBadge>
                                </td>
                                <td className="px-3 py-2 text-[11px] text-neutral-500 whitespace-nowrap">
                                  {c.data_pagamento ? formatDate(c.data_pagamento) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          <DialogFooter className="border-t border-neutral-200 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalHistoricoOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão com Verificação de Impacto */}
      <Dialog open={modalExcluirOpen} onOpenChange={setModalExcluirOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded bg-rose-100 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-neutral-900">
                  Excluir Credor
                </DialogTitle>
                <DialogDescription className="text-xs text-neutral-500">
                  Verificando integridade de contas a pagar vinculadas.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-3 text-xs space-y-3">
            {verificandoImpacto ? (
              <div className="py-6 text-center text-neutral-500">
                Verificando vínculos com contas a pagar...
              </div>
            ) : impactoExclusao ? (
              <>
                <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 space-y-1">
                  <p className="font-bold text-neutral-800">
                    {credorParaExcluir?.nome_razao_social}
                  </p>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    CNPJ/CPF: {credorParaExcluir?.cnpj_cpf}
                  </p>
                </div>

                {!impactoExclusao.podeExcluir ? (
                  <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Atenção: Vínculos Encontrados</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{impactoExclusao.mensagem}</p>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200 text-[11px]">
                      <div>
                        <strong>Em Aberto:</strong> {impactoExclusao.contasAbertas} (R${' '}
                        {formatCurrency(impactoExclusao.valorTotalAberto)})
                      </div>
                      <div>
                        <strong>Pagas:</strong> {impactoExclusao.contasPagas} (R${' '}
                        {formatCurrency(impactoExclusao.valorTotalPago)})
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-neutral-600 leading-relaxed">
                    Este credor não possui nenhuma conta a pagar vinculada. Tem certeza de que
                    deseja excluí-lo permanentemente?
                  </p>
                )}
              </>
            ) : null}
          </div>

          <DialogFooter className="border-t border-neutral-200 pt-3 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalExcluirOpen(false)}
              className="text-xs"
              disabled={actionLoading}
            >
              Cancelar
            </Button>

            <div className="flex items-center gap-2">
              {impactoExclusao && !impactoExclusao.podeExcluir ? (
                <Button
                  type="button"
                  onClick={handleDesativarEmVezDeExcluir}
                  disabled={actionLoading}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                >
                  <Ban className="h-3.5 w-3.5 mr-1.5" />
                  Inativar Credor (Recomendado)
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleConfirmarExclusao}
                  disabled={actionLoading || verificandoImpacto}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Confirmar Exclusão
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Regularizar Credores em Lote a partir dos Comprovantes */}
      <VincularCredoresLoteModal
        open={modalLoteOpen}
        onOpenChange={setModalLoteOpen}
        contas={contasPagar}
        credores={credores}
        usuarioId={pb.authStore.record?.id}
        onSuccess={async () => {
          await onReload()
        }}
        onAbrirIndividual={(contaAlvo) => {
          setContaSelecionadaComprovante(contaAlvo)
          setModalIndividualComprovanteOpen(true)
        }}
      />

      {/* Modal Individual para Salvar Credor a partir de Comprovante */}
      <SalvarCredorComprovanteModal
        open={modalIndividualComprovanteOpen}
        onOpenChange={(aberto) => {
          setModalIndividualComprovanteOpen(aberto)
          if (!aberto) setContaSelecionadaComprovante(null)
        }}
        conta={contaSelecionadaComprovante}
        credores={credores}
        usuarioId={pb.authStore.record?.id}
        onSuccess={async () => {
          await onReload()
        }}
      />

      {/* Modal Extração de Contrato Social por IA */}
      <ExtracaoContratoSocialModal
        open={modalContratoSocialOpen}
        onOpenChange={(aberto) => {
          setModalContratoSocialOpen(aberto)
          if (!aberto) setCredorParaContratoSocial(null)
        }}
        credorExistente={credorParaContratoSocial}
        credores={credores}
        onSalvo={async () => {
          await onReload()
        }}
      />
    </div>
  )
}
