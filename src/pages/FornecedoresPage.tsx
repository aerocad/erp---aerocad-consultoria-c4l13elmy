import { useMemo, useState } from 'react'
import {
  Building2,
  CheckCircle2,
  Edit2,
  ExternalLink,
  Filter,
  Mail,
  MapPin,
  Phone,
  Plus,
  Receipt,
  Search,
  Trash2,
  UserCheck,
  XCircle,
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
import { useCrmData } from '@/hooks/use-crm-data'
import { formatDate } from '@/lib/format'
import pb from '@/lib/pocketbase/client'
import type { CategoriaFornecedor, FornecedorRecord } from '@/types/crm'

export const CATEGORIA_FORNECEDOR_LABELS: Record<CategoriaFornecedor, string> = {
  terceirizados: 'Prestador Terceirizado',
  equipamentos: 'Equipamentos & Calibração',
  despesas_operacionais: 'Despesas Operacionais',
  folha: 'Folha & Pessoal',
  impostos: 'Tributos & Guias',
  software_ti: 'Software & TI',
  juridico_contabil: 'Jurídico & Contábil',
  outros: 'Outros Fornecedores',
}

interface FornecedorFormData {
  tipo_pessoa: 'pj' | 'pf'
  razao_social: string
  nome_fantasia: string
  nome_completo: string
  cpf: string
  cnpj_cpf: string
  categoria: CategoriaFornecedor
  contato_nome: string
  email: string
  telefone: string
  chave_pix: string
  dados_bancarios: string
  endereco: string
  municipio_uf: string
  status: 'ativo' | 'inativo'
  observacoes: string
}

const emptyForm: FornecedorFormData = {
  tipo_pessoa: 'pj',
  razao_social: '',
  nome_fantasia: '',
  nome_completo: '',
  cpf: '',
  cnpj_cpf: '',
  categoria: 'terceirizados',
  contato_nome: '',
  email: '',
  telefone: '',
  chave_pix: '',
  dados_bancarios: '',
  endereco: '',
  municipio_uf: '',
  status: 'ativo',
  observacoes: '',
}

export default function FornecedoresPage() {
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'financeiro'
  const canDelete = user?.role === 'admin'

  const {
    data: fornecedores,
    loading,
    reload,
  } = useCrmData<FornecedorRecord>('fornecedores', {
    sort: 'razao_social',
    expand: 'criado_por',
  })

  const [busca, setBusca] = useState('')
  const [tipoPessoaFiltro, setTipoPessoaFiltro] = useState<string>('todos')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')
  const [statusFiltro, setStatusFiltro] = useState<string>('todos')

  // Modal de criação / edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<FornecedorRecord | null>(null)
  const [formData, setFormData] = useState<FornecedorFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Modal de exclusão
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<FornecedorRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fornecedoresFiltrados = useMemo(() => {
    return fornecedores.filter((f) => {
      const matchBusca =
        (f.razao_social || '').toLowerCase().includes(busca.toLowerCase()) ||
        (f.nome_completo || '').toLowerCase().includes(busca.toLowerCase()) ||
        (f.nome_fantasia && f.nome_fantasia.toLowerCase().includes(busca.toLowerCase())) ||
        (f.cnpj_cpf || '').toLowerCase().includes(busca.toLowerCase()) ||
        (f.cpf && f.cpf.toLowerCase().includes(busca.toLowerCase())) ||
        (f.contato_nome && f.contato_nome.toLowerCase().includes(busca.toLowerCase())) ||
        (f.email && f.email.toLowerCase().includes(busca.toLowerCase()))

      const fTipo =
        f.tipo_pessoa || (f.cnpj_cpf && f.cnpj_cpf.replace(/\D/g, '').length === 11 ? 'pf' : 'pj')
      const matchTipo = tipoPessoaFiltro === 'todos' || fTipo === tipoPessoaFiltro
      const matchCat = categoriaFiltro === 'todas' || f.categoria === categoriaFiltro
      const matchStatus = statusFiltro === 'todos' || f.status === statusFiltro

      return matchBusca && matchTipo && matchCat && matchStatus
    })
  }, [fornecedores, busca, tipoPessoaFiltro, categoriaFiltro, statusFiltro])

  function handleOpenCreate() {
    setEditingItem(null)
    setFormData(emptyForm)
    setModalOpen(true)
  }

  function handleOpenEdit(item: FornecedorRecord) {
    setEditingItem(item)
    const docLimpo = (item.cnpj_cpf || item.cpf || '').replace(/\D/g, '')
    const tipo = item.tipo_pessoa || (docLimpo.length === 11 ? 'pf' : 'pj')

    setFormData({
      tipo_pessoa: tipo,
      razao_social: item.razao_social || item.nome_completo || '',
      nome_fantasia: item.nome_fantasia || '',
      nome_completo: item.nome_completo || (tipo === 'pf' ? item.razao_social : '') || '',
      cpf: item.cpf || (tipo === 'pf' ? item.cnpj_cpf : '') || '',
      cnpj_cpf: item.cnpj_cpf || item.cpf || '',
      categoria: item.categoria || 'terceirizados',
      contato_nome: item.contato_nome || '',
      email: item.email || '',
      telefone: item.telefone || '',
      chave_pix: item.chave_pix || '',
      dados_bancarios: item.dados_bancarios || '',
      endereco: item.endereco || '',
      municipio_uf: item.municipio_uf || '',
      status: item.status || 'ativo',
      observacoes: item.observacoes || '',
    })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const isPF = formData.tipo_pessoa === 'pf'
    const nomePrincipal = isPF
      ? (formData.nome_completo || formData.razao_social).trim()
      : formData.razao_social.trim()
    const docPrincipal = isPF
      ? (formData.cpf || formData.cnpj_cpf).trim()
      : formData.cnpj_cpf.trim()

    if (!nomePrincipal) {
      toast.error(
        isPF ? 'Informe o Nome Completo da pessoa física.' : 'Informe a Razão Social da empresa.',
      )
      return
    }

    if (!docPrincipal) {
      toast.error(isPF ? 'Informe o CPF do fornecedor PF.' : 'Informe o CNPJ do fornecedor PJ.')
      return
    }

    const docLimpo = docPrincipal.replace(/\D/g, '')
    if (isPF && docLimpo.length !== 11) {
      toast.warning('O CPF informado possui quantidade de dígitos diferente de 11. Verifique.')
    } else if (!isPF && docLimpo.length !== 14) {
      toast.warning('O CNPJ informado possui quantidade de dígitos diferente de 14. Verifique.')
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        tipo_pessoa: formData.tipo_pessoa,
        razao_social: nomePrincipal,
        nome_completo: isPF ? nomePrincipal : formData.nome_completo.trim() || undefined,
        nome_fantasia: isPF ? '' : formData.nome_fantasia.trim(),
        cnpj_cpf: docPrincipal,
        cpf: isPF ? docPrincipal : formData.cpf.trim() || undefined,
        categoria: formData.categoria,
        contato_nome: isPF ? nomePrincipal : formData.contato_nome.trim(),
        email: formData.email.trim(),
        telefone: formData.telefone.trim(),
        chave_pix: formData.chave_pix.trim(),
        dados_bancarios: formData.dados_bancarios.trim(),
        endereco: formData.endereco.trim(),
        municipio_uf: formData.municipio_uf.trim(),
        status: formData.status,
        observacoes: formData.observacoes.trim(),
      }

      if (editingItem) {
        await pb.collection('fornecedores').update(editingItem.id, payload)
        // Auditoria
        try {
          await pb.collection('atividades').create({
            usuario: user?.id,
            tipo: 'alteracao_fornecedor',
            texto: `Atualizou os dados do fornecedor ${formData.razao_social} (${formData.cnpj_cpf})`,
            data_hora: new Date().toISOString(),
          })
        } catch {
          /* ignore */
        }
        toast.success('Fornecedor atualizado com sucesso!')
      } else {
        payload.criado_por = user?.id
        await pb.collection('fornecedores').create(payload)
        // Auditoria
        try {
          await pb.collection('atividades').create({
            usuario: user?.id,
            tipo: 'criacao_fornecedor',
            texto: `Cadastrou o novo fornecedor ${formData.razao_social} (${formData.cnpj_cpf})`,
            data_hora: new Date().toISOString(),
          })
        } catch {
          /* ignore */
        }
        toast.success('Fornecedor cadastrado com sucesso!')
      }

      setModalOpen(false)
      void reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao salvar fornecedor: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!itemToDelete) return
    setDeleting(true)
    try {
      await pb.collection('fornecedores').delete(itemToDelete.id)
      // Auditoria
      try {
        await pb.collection('atividades').create({
          usuario: user?.id,
          tipo: 'exclusao_fornecedor',
          texto: `Excluiu o fornecedor ${itemToDelete.razao_social} (${itemToDelete.cnpj_cpf})`,
          data_hora: new Date().toISOString(),
        })
      } catch {
        /* ignore */
      }
      toast.success('Fornecedor excluído com sucesso!')
      setDeleteModalOpen(false)
      setItemToDelete(null)
      void reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao excluir fornecedor: ' + msg)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="crm-card border-[#FF6A13]/25 bg-gradient-to-br from-white via-[#FFFBF8] to-[#FFF5ED] p-5 shadow-xs">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF6A13] text-white shadow-xs shrink-0">
              <Building2 className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF6A13]">
                  SUPRIMENTOS & PRESTADORES
                </span>
                <span className="rounded-full bg-orange-100 text-[#D65100] text-[10px] font-bold px-2 py-0.5">
                  Restrito Admin / Financeiro
                </span>
              </div>
              <h1 className="text-xl font-bold text-[#333]">Cadastro de Fornecedores</h1>
              <p className="text-xs text-[#737373] mt-0.5">
                Gestão de prestadores terceirizados, fornecedores de tecnologia, despesas
                operacionais e dados bancários para quitação.
              </p>
            </div>
          </div>

          {canEdit && (
            <Button
              onClick={handleOpenCreate}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold text-xs shrink-0"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Fornecedor
            </Button>
          )}
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="crm-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por razão social, nome fantasia, CNPJ/CPF, contato ou e-mail..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={tipoPessoaFiltro} onValueChange={setTipoPessoaFiltro}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Tipo (PF/PJ)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos (PF/PJ)</SelectItem>
              <SelectItem value="pj">Pessoa Jurídica (PJ)</SelectItem>
              <SelectItem value="pf">Pessoa Física (PF)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
            <SelectTrigger className="w-[190px] h-9 text-xs">
              <Filter className="mr-1.5 h-3.5 w-3.5 text-neutral-400" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {Object.entries(CATEGORIA_FORNECEDOR_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Listagem em Tabela */}
      <div className="crm-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-500">Carregando fornecedores...</div>
        ) : fornecedoresFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="mx-auto h-10 w-10 text-neutral-300 mb-2" />
            <p className="text-sm font-semibold text-neutral-700">Nenhum fornecedor encontrado</p>
            <p className="text-xs text-neutral-400 mt-1">
              {busca || categoriaFiltro !== 'todas' || statusFiltro !== 'todos'
                ? 'Tente ajustar os filtros acima.'
                : 'Cadastre o primeiro fornecedor ou parceiro técnico da AEROCAD.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2.5 whitespace-nowrap min-w-[60px]">Tipo</th>
                  <th className="px-3 py-2.5 min-w-[220px]">Fornecedor / Nome</th>
                  <th className="px-3 py-2.5 whitespace-nowrap min-w-[130px]">
                    Documento (CNPJ/CPF)
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap min-w-[130px]">Categoria</th>
                  <th className="px-3 py-2.5 min-w-[160px]">Contato & Telefone</th>
                  <th className="px-3 py-2.5 min-w-[180px]">PIX / Dados Bancários</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap min-w-[85px]">
                    Situação
                  </th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap min-w-[100px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {fornecedoresFiltrados.map((item) => {
                  const isPF =
                    item.tipo_pessoa === 'pf' ||
                    (item.cnpj_cpf && item.cnpj_cpf.replace(/\D/g, '').length === 11)
                  return (
                    <tr key={item.id} className="hover:bg-[#FFF6EC]/30 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                            isPF
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-orange-50 text-[#D65100] border border-orange-200'
                          }`}
                        >
                          {isPF ? 'PF' : 'PJ'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-neutral-900">
                          {item.nome_completo || item.razao_social}
                        </div>
                        {!isPF && item.nome_fantasia && (
                          <span className="text-[11px] text-neutral-500 font-normal">
                            {item.nome_fantasia}
                          </span>
                        )}
                        {item.municipio_uf && (
                          <div className="flex items-center gap-1 text-[11px] text-neutral-400 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {item.municipio_uf}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-neutral-700 whitespace-nowrap">
                        {item.cnpj_cpf || item.cpf}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex rounded-full bg-neutral-100 text-neutral-800 text-[10px] font-semibold px-2 py-0.5 border border-neutral-200">
                          {CATEGORIA_FORNECEDOR_LABELS[item.categoria] || item.categoria}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {item.contato_nome && (
                          <div className="font-medium text-neutral-800">{item.contato_nome}</div>
                        )}
                        {item.telefone && (
                          <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                            <Phone className="h-3 w-3 text-neutral-400" />
                            {item.telefone}
                          </div>
                        )}
                        {item.email && (
                          <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                            <Mail className="h-3 w-3 text-neutral-400" />
                            {item.email}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {item.chave_pix ? (
                          <div className="font-mono text-[11px] text-[#D65100] font-semibold">
                            PIX: {item.chave_pix}
                          </div>
                        ) : (
                          <span className="text-neutral-400 italic">Não informado</span>
                        )}
                        {item.dados_bancarios && (
                          <div className="text-[11px] text-neutral-500 truncate max-w-[200px]">
                            {item.dados_bancarios}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <CrmBadge tone={item.status === 'ativo' ? 'green' : 'gray'}>
                          {item.status.toUpperCase()}
                        </CrmBadge>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(item)}
                              className="h-8 w-8 text-neutral-500 hover:text-[#FF6A13]"
                              title="Editar fornecedor"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setItemToDelete(item)
                                setDeleteModalOpen(true)
                              }}
                              className="h-8 w-8 text-neutral-400 hover:text-rose-600"
                              title="Excluir fornecedor (Apenas Admin)"
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
        )}
      </div>

      {/* Modal de Criação / Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Editar Fornecedor' : 'Novo Fornecedor / Parceiro'}
              </DialogTitle>
              <DialogDescription>
                Informe os dados cadastrais, fiscais e bancários para gestão de contas a pagar.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 text-xs">
              {/* Seleção do Tipo de Pessoa: PJ ou PF */}
              <div className="sm:col-span-2 space-y-1.5 p-3 rounded-lg border border-orange-200 bg-orange-50/40">
                <Label className="text-xs font-bold text-neutral-800">Tipo de Fornecedor *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, tipo_pessoa: 'pj' })}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition ${
                      formData.tipo_pessoa === 'pj'
                        ? 'border-[#FF6A13] bg-[#FF6A13] text-white shadow-xs'
                        : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    Pessoa Jurídica (PJ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, tipo_pessoa: 'pf' })}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition ${
                      formData.tipo_pessoa === 'pf'
                        ? 'border-[#FF6A13] bg-[#FF6A13] text-white shadow-xs'
                        : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <UserCheck className="h-4 w-4" />
                    Pessoa Física (PF)
                  </button>
                </div>
              </div>

              {formData.tipo_pessoa === 'pj' ? (
                <>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs font-semibold">
                      Razão Social / Nome Oficial (PJ) *
                    </Label>
                    <Input
                      required
                      value={formData.razao_social}
                      onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                      placeholder="Ex: Topografia & Geodésia Engenharia Ltda"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Nome Fantasia (Opcional)</Label>
                    <Input
                      value={formData.nome_fantasia}
                      onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                      placeholder="Ex: TopoGeo"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">CNPJ *</Label>
                    <Input
                      required
                      value={formData.cnpj_cpf}
                      onChange={(e) => setFormData({ ...formData, cnpj_cpf: e.target.value })}
                      placeholder="00.000.000/0000-00"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs font-semibold">Nome Completo (Pessoa Física) *</Label>
                    <Input
                      required
                      value={formData.nome_completo || formData.razao_social}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          nome_completo: e.target.value,
                          razao_social: e.target.value,
                        })
                      }
                      placeholder="Ex: João Valmir Bigattão"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">CPF *</Label>
                    <Input
                      required
                      value={formData.cpf || formData.cnpj_cpf}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cpf: e.target.value,
                          cnpj_cpf: e.target.value,
                        })
                      }
                      placeholder="000.000.000-00"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Contato / Apelido</Label>
                    <Input
                      value={formData.contato_nome}
                      onChange={(e) => setFormData({ ...formData, contato_nome: e.target.value })}
                      placeholder="Ex: Bigattão"
                      className="h-9 text-xs"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Categoria de Despesa *</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(val) =>
                    setFormData({ ...formData, categoria: val as CategoriaFornecedor })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_FORNECEDOR_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Situação / Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val: 'ativo' | 'inativo') =>
                    setFormData({ ...formData, status: val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Nome do Contato Principal</Label>
                <Input
                  value={formData.contato_nome}
                  onChange={(e) => setFormData({ ...formData, contato_nome: e.target.value })}
                  placeholder="Ex: Eng. Roberto Santos"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Telefone / WhatsApp</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="h-9 text-xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">E-mail de Contato / Financeiro</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="financeiro@fornecedor.com.br"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#D65100]">Chave PIX</Label>
                <Input
                  value={formData.chave_pix}
                  onChange={(e) => setFormData({ ...formData, chave_pix: e.target.value })}
                  placeholder="CNPJ, e-mail, celular ou chave aleatória"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Dados Bancários / Agência e Conta</Label>
                <Input
                  value={formData.dados_bancarios}
                  onChange={(e) => setFormData({ ...formData, dados_bancarios: e.target.value })}
                  placeholder="Ex: Banco Itaú 341 - Ag 0123 CC 45678-9"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Município / UF</Label>
                <Input
                  value={formData.municipio_uf}
                  onChange={(e) => setFormData({ ...formData, municipio_uf: e.target.value })}
                  placeholder="Ex: São Paulo / SP"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Endereço Comercial</Label>
                <Input
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Rua, número, complemento e bairro"
                  className="h-9 text-xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Observações Internas</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Detalhes de contratação, acordos de pagamento, ARTs etc."
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold"
              >
                {saving
                  ? 'Gravando...'
                  : editingItem
                    ? 'Salvar Alterações'
                    : 'Cadastrar Fornecedor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão (Admin) */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-rose-600">Excluir Fornecedor</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja remover o fornecedor{' '}
              <strong>{itemToDelete?.razao_social}</strong> ({itemToDelete?.cnpj_cpf})? Esta ação
              será registrada na auditoria do sistema.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
