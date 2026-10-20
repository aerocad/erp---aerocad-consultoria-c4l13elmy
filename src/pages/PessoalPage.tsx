import { Fragment, useMemo, useState } from 'react'
import {
  Award,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  Download,
  Edit2,
  Filter,
  GraduationCap,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
  UserCheck2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { exportarTabelaParaXlsx, ColunaXlsx } from '@/services/aerocadXlsxExporter'

import { CrmBadge } from '@/components/common/CrmBadge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { useCrmData } from '@/hooks/use-crm-data'
import {
  AREAS_ATUACAO_COLABORADOR,
  AreaAtuacaoColaborador,
  getCargosAgrupadosPorArea,
  getFuncoesAgrupadasPorArea,
} from '@/lib/crm'
import { formatCurrency, formatDate, initials } from '@/lib/format'
import pb from '@/lib/pocketbase/client'
import type {
  ColaboradorRecord,
  FornecedorRecord,
  RegimeContratacao,
  RegistroProfissionalTipo,
  UserRecord,
} from '@/types/crm'

export const REGIME_CONTRATACAO_LABELS: Record<RegimeContratacao, string> = {
  pf_clt: 'CLT (Pessoa Física)',
  pf_autonomo: 'Autônomo / RPA (Pessoa Física)',
  pj: 'PJ (Pessoa Jurídica)',
  socio: 'Sócio(a)',
}

interface ColaboradorFormData {
  nome_completo: string
  cpf_cnpj: string
  cargo: string
  funcao: string
  regime_contratacao: RegimeContratacao
  empresa_pj: string
  fornecedor_vinculado: string
  usuario_sistema: string
  email: string
  telefone: string
  data_admissao: string
  data_desligamento: string
  situacao: 'ativo' | 'inativo'
  remuneracao_base: string
  chave_pix: string
  observacoes: string
  eh_tecnico: boolean
  eh_rt: boolean
  registro_profissional_tipo: RegistroProfissionalTipo | 'OUTRO' | ''
  registro_profissional_numero: string
  registro_profissional_uf: string
  formacao_academica: string
  area_atuacao: string
  rrt_art_padrao: string
}

const emptyForm: ColaboradorFormData = {
  nome_completo: '',
  cpf_cnpj: '',
  cargo: '',
  funcao: '',
  regime_contratacao: 'pj',
  empresa_pj: '',
  fornecedor_vinculado: '',
  usuario_sistema: '',
  email: '',
  telefone: '',
  data_admissao: new Date().toISOString().slice(0, 10),
  data_desligamento: '',
  situacao: 'ativo',
  remuneracao_base: '',
  chave_pix: '',
  observacoes: '',
  eh_tecnico: false,
  eh_rt: false,
  registro_profissional_tipo: 'CREA',
  registro_profissional_numero: '',
  registro_profissional_uf: 'DF',
  formacao_academica: '',
  area_atuacao: '',
  rrt_art_padrao: '',
}

export default function PessoalPage() {
  const { user } = useAuth()
  const { ocultarValores } = useFinanceiroVisibilidade()
  const canEdit = user?.role === 'admin' || user?.role === 'financeiro'
  const canDelete = user?.role === 'admin'

  const {
    data: colaboradores,
    loading,
    reload,
  } = useCrmData<ColaboradorRecord>('colaboradores', {
    sort: 'nome_completo',
    expand: 'fornecedor_vinculado,usuario_sistema,criado_por',
  })

  const { data: fornecedores } = useCrmData<FornecedorRecord>('fornecedores', {
    sort: 'razao_social',
  })

  const { data: usuarios } = useCrmData<UserRecord>('users', {
    sort: 'name',
  })

  const [busca, setBusca] = useState('')
  const [regimeFiltro, setRegimeFiltro] = useState<string>('todos')
  const [situacaoFiltro, setSituacaoFiltro] = useState<string>('todos')
  const [cargoFiltro, setCargoFiltro] = useState<string>('todos')
  const [perfilTecnicoFiltro, setPerfilTecnicoFiltro] = useState<string>('todos')

  // Modais
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ColaboradorRecord | null>(null)
  const [formData, setFormData] = useState<ColaboradorFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Controle de modo customizado para Cargo e Função
  const [modoCargoCustomizado, setModoCargoCustomizado] = useState(false)
  const [cargoAreaCustomizada, setCargoAreaCustomizada] =
    useState<AreaAtuacaoColaborador>('Técnico')
  const [modoFuncaoCustomizada, setModoFuncaoCustomizada] = useState(false)
  const [funcaoAreaCustomizada, setFuncaoAreaCustomizada] =
    useState<AreaAtuacaoColaborador>('Técnico')

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<ColaboradorRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Lista de cargos únicos para o filtro
  const cargosDisponiveis = useMemo(() => {
    const setCargos = new Set<string>()
    colaboradores.forEach((c) => {
      if (c.cargo) setCargos.add(c.cargo.trim())
    })
    return Array.from(setCargos).sort()
  }, [colaboradores])

  const colaboradoresFiltrados = useMemo(() => {
    return colaboradores.filter((c) => {
      const matchBusca =
        c.nome_completo.toLowerCase().includes(busca.toLowerCase()) ||
        c.cpf_cnpj.toLowerCase().includes(busca.toLowerCase()) ||
        c.cargo.toLowerCase().includes(busca.toLowerCase()) ||
        c.funcao.toLowerCase().includes(busca.toLowerCase()) ||
        (c.empresa_pj && c.empresa_pj.toLowerCase().includes(busca.toLowerCase())) ||
        (c.email && c.email.toLowerCase().includes(busca.toLowerCase()))

      const matchRegime = regimeFiltro === 'todos' || c.regime_contratacao === regimeFiltro
      const matchSituacao = situacaoFiltro === 'todos' || c.situacao === situacaoFiltro
      const matchCargo = cargoFiltro === 'todos' || c.cargo === cargoFiltro
      const matchPerfilTecnico =
        perfilTecnicoFiltro === 'todos'
          ? true
          : perfilTecnicoFiltro === 'rt'
            ? !!c.eh_rt
            : perfilTecnicoFiltro === 'tecnico'
              ? !!c.eh_tecnico
              : perfilTecnicoFiltro === 'administrativo'
                ? !c.eh_tecnico && !c.eh_rt
                : true

      return matchBusca && matchRegime && matchSituacao && matchCargo && matchPerfilTecnico
    })
  }, [colaboradores, busca, regimeFiltro, situacaoFiltro, cargoFiltro, perfilTecnicoFiltro])

  // Agrupamento hierárquico com ordenação alfabética em cada grupo:
  // Grupo 1: Sócios (regime_contratacao = 'socio')
  // Grupo 2: Responsáveis Técnicos (eh_rt = true, não sócio)
  // Grupo 3: Corpo Técnico (eh_tecnico = true, não socio e não rt)
  // Grupo 4: Demais Colaboradores (administrativo, financeiro, operacional geral)
  const gruposHierarquicos = useMemo(() => {
    const sortByName = (a: ColaboradorRecord, b: ColaboradorRecord) =>
      (a.nome_completo || '').localeCompare(b.nome_completo || '', 'pt-BR', {
        sensitivity: 'base',
      })

    const socios: ColaboradorRecord[] = []
    const rts: ColaboradorRecord[] = []
    const tecnicos: ColaboradorRecord[] = []
    const demais: ColaboradorRecord[] = []

    for (const c of colaboradoresFiltrados) {
      if (c.regime_contratacao === 'socio') {
        socios.push(c)
      } else if (c.eh_rt) {
        rts.push(c)
      } else if (c.eh_tecnico) {
        tecnicos.push(c)
      } else {
        demais.push(c)
      }
    }

    socios.sort(sortByName)
    rts.sort(sortByName)
    tecnicos.sort(sortByName)
    demais.sort(sortByName)

    return [
      {
        id: 'socios',
        titulo: 'Sócios',
        descricao: 'Quadro societário e representação executiva',
        icone: Users,
        badge: 'Diretoria / Sócios',
        corBadge: 'bg-purple-100 text-purple-800 border-purple-200',
        itens: socios,
      },
      {
        id: 'rts',
        titulo: 'Responsáveis Técnicos',
        descricao: 'Profissionais legalmente habilitados para assunção de ART/RRT',
        icone: ShieldCheck,
        badge: 'RT Habilitado',
        corBadge: 'bg-orange-100 text-[#D65100] border-orange-200',
        itens: rts,
      },
      {
        id: 'tecnicos',
        titulo: 'Corpo Técnico',
        descricao: 'Engenheiros, arquitetos, analistas técnicos e projetistas',
        icone: Award,
        badge: 'Técnicos',
        corBadge: 'bg-blue-100 text-blue-800 border-blue-200',
        itens: tecnicos,
      },
      {
        id: 'demais',
        titulo: 'Demais Colaboradores',
        descricao: 'Áreas administrativa, financeira, operacional e apoio',
        icone: Briefcase,
        badge: 'Geral / Administrativo',
        corBadge: 'bg-neutral-100 text-neutral-700 border-neutral-200',
        itens: demais,
      },
    ]
  }, [colaboradoresFiltrados])

  // Lista linear de colaboradores seguindo a mesma ordem hierárquica (para XLSX e contagem)
  const colaboradoresOrdenadosHierarquico = useMemo(() => {
    return gruposHierarquicos.flatMap((g) => g.itens)
  }, [gruposHierarquicos])

  // Catálogo agrupado por área e ordenado pela hierarquia decrescente da AEROCAD
  const cargosAgrupados = useMemo(() => getCargosAgrupadosPorArea(), [])
  const funcoesAgrupadas = useMemo(() => getFuncoesAgrupadasPorArea(), [])

  // Conjuntos para detecção rápida se o valor já está na lista sugerida
  const cargosPadraoSet = useMemo(() => {
    const s = new Set<string>()
    Object.values(cargosAgrupados).forEach((lista) => lista.forEach((c) => s.add(c.cargo)))
    return s
  }, [cargosAgrupados])

  const funcoesPadraoSet = useMemo(() => {
    const s = new Set<string>()
    Object.values(funcoesAgrupadas).forEach((lista) => lista.forEach((f) => s.add(f.funcao)))
    return s
  }, [funcoesAgrupadas])

  function handleOpenCreate() {
    setEditingItem(null)
    setFormData(emptyForm)
    setModoCargoCustomizado(false)
    setCargoAreaCustomizada('Técnico')
    setModoFuncaoCustomizada(false)
    setFuncaoAreaCustomizada('Técnico')
    setModalOpen(true)
  }

  function handleOpenEdit(item: ColaboradorRecord) {
    setEditingItem(item)
    const cargoAtual = item.cargo || ''
    const funcaoAtual = item.funcao || ''

    // Se o cargo atual não está na lista padrão e tem valor, podemos deixar acessível no select
    // ou manter visível sem forçar customizado a não ser que o usuário queira
    setModoCargoCustomizado(false)
    setModoFuncaoCustomizada(false)

    // Tentar inferir a área do colaborador se ele já tiver
    const areaInferida = (AREAS_ATUACAO_COLABORADOR as readonly string[]).includes(
      item.area_atuacao || '',
    )
      ? (item.area_atuacao as AreaAtuacaoColaborador)
      : 'Técnico'
    setCargoAreaCustomizada(areaInferida)
    setFuncaoAreaCustomizada(areaInferida)

    setFormData({
      nome_completo: item.nome_completo || '',
      cpf_cnpj: item.cpf_cnpj || '',
      cargo: cargoAtual,
      funcao: funcaoAtual,
      regime_contratacao: item.regime_contratacao || 'pj',
      empresa_pj: item.empresa_pj || '',
      fornecedor_vinculado: item.fornecedor_vinculado || '',
      usuario_sistema: item.usuario_sistema || '',
      email: item.email || '',
      telefone: item.telefone || '',
      data_admissao: item.data_admissao ? item.data_admissao.slice(0, 10) : '',
      data_desligamento: item.data_desligamento ? item.data_desligamento.slice(0, 10) : '',
      situacao: item.situacao || 'ativo',
      remuneracao_base: item.remuneracao_base ? String(item.remuneracao_base) : '',
      chave_pix: item.chave_pix || '',
      observacoes: item.observacoes || '',
      eh_tecnico: !!item.eh_tecnico,
      eh_rt: !!item.eh_rt,
      registro_profissional_tipo: item.registro_profissional_tipo || 'CREA',
      registro_profissional_numero: item.registro_profissional_numero || '',
      registro_profissional_uf: item.registro_profissional_uf || 'DF',
      formacao_academica: item.formacao_academica || '',
      area_atuacao: item.area_atuacao || '',
      rrt_art_padrao: item.rrt_art_padrao || '',
    })
    setModalOpen(true)
  }

  // Mapa de colaboradores que já têm cada usuário_sistema (para validação de unicidade 1:1)
  const mapaUsuarioJaVinculado = useMemo(() => {
    const mapa: Record<string, ColaboradorRecord> = {}
    colaboradores.forEach((c) => {
      if (c.usuario_sistema) {
        mapa[c.usuario_sistema] = c
      }
    })
    return mapa
  }, [colaboradores])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.nome_completo.trim() || !formData.cpf_cnpj.trim() || !formData.cargo.trim()) {
      toast.error('Preencha os campos obrigatórios: Nome Completo, CPF/CNPJ e Cargo.')
      return
    }

    // Validação 1:1: Verificar se o usuário escolhido já está vinculado a outro colaborador
    if (formData.usuario_sistema) {
      const colabExistente = mapaUsuarioJaVinculado[formData.usuario_sistema]
      if (colabExistente && (!editingItem || colabExistente.id !== editingItem.id)) {
        toast.error(
          `Esta conta de usuário já está vinculada ao colaborador "${colabExistente.nome_completo}". A relação entre colaborador e usuário deve ser 1:1.`,
        )
        return
      }
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        nome_completo: formData.nome_completo.trim(),
        cpf_cnpj: formData.cpf_cnpj.trim(),
        cargo: formData.cargo.trim(),
        funcao: formData.funcao.trim(),
        regime_contratacao: formData.regime_contratacao,
        empresa_pj: formData.empresa_pj.trim(),
        fornecedor_vinculado: formData.fornecedor_vinculado || null,
        usuario_sistema: formData.usuario_sistema || null,
        email: formData.email.trim(),
        telefone: formData.telefone.trim(),
        data_admissao: formData.data_admissao
          ? `${formData.data_admissao} 12:00:00.000Z`
          : new Date().toISOString(),
        data_desligamento: formData.data_desligamento
          ? `${formData.data_desligamento} 12:00:00.000Z`
          : null,
        situacao: formData.situacao,
        remuneracao_base: Number(formData.remuneracao_base) || 0,
        chave_pix: formData.chave_pix.trim(),
        observacoes: formData.observacoes.trim(),
        eh_tecnico: formData.eh_tecnico || formData.eh_rt,
        eh_rt: formData.eh_rt,
        registro_profissional_tipo:
          formData.eh_rt || formData.eh_tecnico
            ? formData.registro_profissional_tipo || 'CREA'
            : '',
        registro_profissional_numero: formData.registro_profissional_numero.trim(),
        registro_profissional_uf: formData.registro_profissional_uf.trim().toUpperCase(),
        formacao_academica: formData.formacao_academica.trim(),
        area_atuacao: formData.area_atuacao.trim(),
        rrt_art_padrao: formData.rrt_art_padrao.trim(),
      }

      if (editingItem) {
        await pb.collection('colaboradores').update(editingItem.id, payload)
        try {
          await pb.collection('atividades').create({
            usuario: user?.id,
            tipo: 'alteracao_colaborador',
            texto: `Atualizou os dados do colaborador ${formData.nome_completo} (${formData.cargo})`,
            data_hora: new Date().toISOString(),
          })
        } catch {
          /* ignore */
        }
        toast.success('Colaborador atualizado com sucesso!')
      } else {
        payload.criado_por = user?.id
        await pb.collection('colaboradores').create(payload)
        try {
          await pb.collection('atividades').create({
            usuario: user?.id,
            tipo: 'criacao_colaborador',
            texto: `Cadastrou o colaborador ${formData.nome_completo} (${formData.cargo} - ${formData.regime_contratacao})`,
            data_hora: new Date().toISOString(),
          })
        } catch {
          /* ignore */
        }
        toast.success('Colaborador cadastrado com sucesso!')
      }

      setModalOpen(false)
      void reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao salvar colaborador: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!itemToDelete) return
    setDeleting(true)
    try {
      await pb.collection('colaboradores').delete(itemToDelete.id)
      try {
        await pb.collection('atividades').create({
          usuario: user?.id,
          tipo: 'exclusao_colaborador',
          texto: `Excluiu o colaborador ${itemToDelete.nome_completo} (${itemToDelete.cpf_cnpj})`,
          data_hora: new Date().toISOString(),
        })
      } catch {
        /* ignore */
      }
      toast.success('Colaborador excluído com sucesso!')
      setDeleteModalOpen(false)
      setItemToDelete(null)
      void reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao excluir colaborador: ' + msg)
    } finally {
      setDeleting(false)
    }
  }

  async function handleExportarXlsx() {
    try {
      const colunas: ColunaXlsx[] = [
        { header: 'Nome Completo', key: 'nome_completo', width: 32 },
        { header: 'CPF / CNPJ', key: 'cpf_cnpj', width: 18 },
        { header: 'Cargo', key: 'cargo', width: 26 },
        { header: 'Função', key: 'funcao', width: 26 },
        { header: 'Regime de Contratação', key: 'regime_formatado', width: 24 },
        { header: 'Empresa PJ / Vínculo', key: 'empresa_pj', width: 26 },
        { header: 'E-mail', key: 'email', width: 28 },
        { header: 'Telefone', key: 'telefone', width: 18 },
        { header: 'Data Admissão', key: 'data_admissao_formatada', width: 16 },
        { header: 'Situação', key: 'situacao_formatada', width: 14 },
        { header: 'Perfil Técnico', key: 'perfil_tecnico', width: 20 },
        { header: 'Conselho / Registro', key: 'registro_profissional', width: 20 },
        { header: 'Remuneração Base (R$)', key: 'remuneracao_base', width: 20, tipo: 'moeda' },
      ]

      const linhas = colaboradoresOrdenadosHierarquico.map((c) => {
        const regimeFormatado =
          REGIME_CONTRATACAO_LABELS[c.regime_contratacao] || c.regime_contratacao
        const perfil =
          c.regime_contratacao === 'socio'
            ? 'Sócio(a)'
            : c.eh_rt
              ? 'Responsável Técnico (RT)'
              : c.eh_tecnico
                ? 'Corpo Técnico'
                : 'Administrativo / Geral'
        const registro = c.registro_profissional_numero
          ? `${c.registro_profissional_tipo || 'CREA'} ${c.registro_profissional_numero}${
              c.registro_profissional_uf ? `/${c.registro_profissional_uf}` : ''
            }`
          : ''
        return {
          nome_completo: c.nome_completo || '',
          cpf_cnpj: c.cpf_cnpj || '',
          cargo: c.cargo || '',
          funcao: c.funcao || '',
          regime_formatado: regimeFormatado,
          empresa_pj:
            c.empresa_pj ||
            c.expand?.fornecedor_vinculado?.razao_social ||
            (c.regime_contratacao === 'socio' ? 'Sócio(a) Cotista AEROCAD' : ''),
          email: c.email || '',
          telefone: c.telefone || '',
          data_admissao_formatada: c.data_admissao ? formatDate(c.data_admissao) : '',
          situacao_formatada: c.situacao === 'ativo' ? 'Ativo' : 'Inativo',
          perfil_tecnico: perfil,
          registro_profissional: registro,
          remuneracao_base: c.remuneracao_base || 0,
        }
      })

      await exportarTabelaParaXlsx({
        nomeArquivo: 'colaboradores_aerocad',
        tituloRelatorio: 'Quadro Geral de Pessoal e Colaboradores',
        subtitulo: `Total de ${linhas.length} colaboradores filtrados`,
        usuarioNome: user?.name,
        userRole: user?.role,
        permitirValoresReais: !ocultarValores,
        colunas,
        linhas,
      })

      toast.success('Listagem de colaboradores exportada em XLSX!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao exportar planilha: ' + msg)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="crm-card border-[#FF6A13]/25 bg-gradient-to-br from-white via-[#FFFBF8] to-[#FFF5ED] p-5 shadow-xs">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF6A13] text-white shadow-xs shrink-0">
              <Users className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF6A13]">
                  RECURSOS HUMANOS & EQUIPE TÉCNICA
                </span>
                <span className="rounded-full bg-orange-100 text-[#D65100] text-[10px] font-bold px-2 py-0.5">
                  Restrito Admin / Financeiro
                </span>
              </div>
              <h1 className="text-xl font-bold text-[#333]">Pessoal & Colaboradores</h1>
              <p className="text-xs text-[#737373] mt-0.5">
                Gestão da equipe interna AEROCAD, cargos, funções técnicas, regime de contratação
                (CLT, Autônomo, PJ e Sócio(a)) e vínculos fornecedor.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportarXlsx}
              disabled={loading || colaboradoresFiltrados.length === 0}
              className="text-xs h-9 border-[#FF6A13]/40 text-[#D65100] hover:bg-orange-50 font-semibold"
              title="Exportar listagem de colaboradores para Excel (.XLSX)"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Exportar XLSX
            </Button>
            {canEdit && (
              <Button
                onClick={handleOpenCreate}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold text-xs h-9"
              >
                <UserPlus className="mr-1.5 h-4 w-4" />
                Novo Colaborador
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="crm-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar colaborador por nome, CPF/CNPJ, cargo, função, empresa PJ ou e-mail..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={perfilTecnicoFiltro} onValueChange={setPerfilTecnicoFiltro}>
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-[#FF6A13]" />
              <SelectValue placeholder="Perfil Técnico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os perfis</SelectItem>
              <SelectItem value="rt">Apenas RT (Resp. Técnico)</SelectItem>
              <SelectItem value="tecnico">Corpo Técnico (RT + Técnicos)</SelectItem>
              <SelectItem value="administrativo">Administrativo / Financeiro</SelectItem>
            </SelectContent>
          </Select>

          <Select value={regimeFiltro} onValueChange={setRegimeFiltro}>
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <Filter className="mr-1.5 h-3.5 w-3.5 text-neutral-400" />
              <SelectValue placeholder="Regime" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os regimes</SelectItem>
              <SelectItem value="pf_clt">PF — CLT</SelectItem>
              <SelectItem value="pf_autonomo">PF — Autônomo</SelectItem>
              <SelectItem value="pj">PJ — Pessoa Jurídica</SelectItem>
              <SelectItem value="socio">Sócio(a)</SelectItem>
            </SelectContent>
          </Select>

          {cargosDisponiveis.length > 0 && (
            <Select value={cargoFiltro} onValueChange={setCargoFiltro}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os cargos</SelectItem>
                {cargosDisponiveis.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={situacaoFiltro} onValueChange={setSituacaoFiltro}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Listagem em Tabela */}
      <div className="crm-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            Carregando colaboradores...
          </div>
        ) : colaboradoresFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto h-10 w-10 text-neutral-300 mb-2" />
            <p className="text-sm font-semibold text-neutral-700">Nenhum colaborador encontrado</p>
            <p className="text-xs text-neutral-400 mt-1">
              {busca || regimeFiltro !== 'todos' || situacaoFiltro !== 'todos'
                ? 'Tente ajustar os filtros acima.'
                : 'Cadastre o primeiro colaborador da equipe técnica ou operacional.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-50/95 text-neutral-600 font-bold border-b border-neutral-200">
                <tr>
                  <th className="px-2.5 py-2 min-w-[200px]">Colaborador</th>
                  <th className="px-2.5 py-2 min-w-[170px]">Cargo & Função</th>
                  <th className="px-2.5 py-2 whitespace-nowrap min-w-[125px]">
                    Regime de Contratação
                  </th>
                  <th className="px-2.5 py-2 min-w-[150px]">Contato & Telefone</th>
                  <th className="px-2.5 py-2 whitespace-nowrap min-w-[105px]">Data Admissão</th>
                  <th className="px-2.5 py-2 text-right whitespace-nowrap min-w-[110px]">
                    Remuneração Base
                  </th>
                  <th className="px-2.5 py-2 text-center whitespace-nowrap min-w-[75px]">
                    Situação
                  </th>
                  <th className="px-2.5 py-2 text-right whitespace-nowrap min-w-[85px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {gruposHierarquicos
                  .filter((grupo) => grupo.itens.length > 0)
                  .map((grupo) => {
                    const IconeGrupo = grupo.icone
                    return (
                      <Fragment key={grupo.id}>
                        {/* Linha separadora de cabeçalho da seção hierárquica */}
                        <tr className="bg-gradient-to-r from-[#FFF5ED] via-[#FFFBF8] to-neutral-50 border-y border-[#FF6A13]/25">
                          <td colSpan={8} className="px-2.5 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-5 w-5 items-center justify-center rounded bg-[#FF6A13] text-white shadow-xs shrink-0">
                                  <IconeGrupo className="h-3 w-3 stroke-[2.5]" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-neutral-900 tracking-tight font-[Arial]">
                                      {grupo.titulo}
                                    </span>
                                    <span
                                      className={`rounded-full px-2 py-0.2 text-[10px] font-semibold border ${grupo.corBadge}`}
                                    >
                                      {grupo.itens.length}{' '}
                                      {grupo.itens.length === 1 ? 'colaborador' : 'colaboradores'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-neutral-500 leading-none mt-0.5">
                                    {grupo.descricao}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono tabular-nums font-medium text-neutral-400 uppercase tracking-wider hidden sm:inline">
                                Ordem Alfabética
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Linhas de colaboradores deste grupo */}
                        {grupo.itens.map((item) => (
                          <tr key={item.id} className="hover:bg-[#FFF6EC]/35 transition-colors">
                            <td className="px-2.5 py-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7 border border-neutral-200 shrink-0">
                                  <AvatarFallback className="bg-[#FF6A13] text-white text-[10px] font-bold">
                                    {initials(item.nome_completo)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className="font-bold text-neutral-900 text-xs truncate max-w-[200px]"
                                      title={item.nome_completo}
                                    >
                                      {item.nome_completo}
                                    </span>
                                    {item.regime_contratacao === 'socio' && (
                                      <Badge
                                        variant="outline"
                                        className="border-purple-300 text-purple-700 bg-purple-50 text-[9px] px-1.5 py-0 h-4 font-bold uppercase tracking-wider"
                                      >
                                        Sócio(a)
                                      </Badge>
                                    )}
                                    {item.eh_rt && item.regime_contratacao !== 'socio' && (
                                      <Badge className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-[9px] px-1.5 py-0 h-4 font-bold uppercase tracking-wider">
                                        RT Habilitado
                                      </Badge>
                                    )}
                                    {item.eh_tecnico &&
                                      !item.eh_rt &&
                                      item.regime_contratacao !== 'socio' && (
                                        <Badge
                                          variant="outline"
                                          className="border-blue-400 text-blue-700 bg-blue-50 text-[9px] px-1.5 py-0 h-4 font-medium"
                                        >
                                          Técnico
                                        </Badge>
                                      )}
                                  </div>
                                  <div className="font-mono tabular-nums text-[10px] text-neutral-500">
                                    {item.cpf_cnpj}
                                  </div>
                                  {item.registro_profissional_numero && (
                                    <div className="text-[10px] text-neutral-600 font-medium flex items-center gap-1 mt-0.5">
                                      <Award className="h-3 w-3 text-[#FF6A13] shrink-0" />
                                      <span className="font-mono tabular-nums">
                                        {item.registro_profissional_tipo || 'CREA'}:{' '}
                                        {item.registro_profissional_numero}
                                        {item.registro_profissional_uf
                                          ? `/${item.registro_profissional_uf}`
                                          : ''}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-2.5 py-2">
                              <div className="font-semibold text-neutral-800 text-xs">
                                {item.cargo}
                              </div>
                              <div className="text-[11px] text-neutral-500">
                                {item.funcao || '—'}
                              </div>
                              {item.area_atuacao && (
                                <div
                                  className="text-[10px] text-neutral-500 italic truncate max-w-[190px]"
                                  title={item.area_atuacao}
                                >
                                  {item.area_atuacao}
                                </div>
                              )}
                            </td>
                            <td className="px-2.5 py-2">
                              <span
                                className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 border ${
                                  item.regime_contratacao === 'socio'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : item.regime_contratacao === 'pj'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : item.regime_contratacao === 'pf_clt'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-neutral-100 text-neutral-800 border-neutral-200'
                                }`}
                              >
                                {REGIME_CONTRATACAO_LABELS[item.regime_contratacao] ||
                                  item.regime_contratacao}
                              </span>
                              {item.regime_contratacao === 'pj' && (
                                <div className="text-[11px] text-neutral-500 mt-0.5">
                                  {item.empresa_pj ||
                                  item.expand?.fornecedor_vinculado?.razao_social ? (
                                    <span className="flex items-center gap-1 text-[#D65100]">
                                      <Building2 className="h-3 w-3 shrink-0" />
                                      <span className="truncate max-w-[140px]">
                                        {item.empresa_pj ||
                                          item.expand?.fornecedor_vinculado?.razao_social}
                                      </span>
                                    </span>
                                  ) : null}
                                </div>
                              )}
                              {item.regime_contratacao === 'socio' && (
                                <div className="text-[10px] text-purple-600 font-medium mt-0.5 flex items-center gap-1">
                                  <span>Quadro Societário AEROCAD</span>
                                </div>
                              )}
                            </td>
                            <td className="px-2.5 py-2">
                              {item.email && (
                                <div className="flex items-center gap-1 text-[11px] text-neutral-600">
                                  <Mail className="h-3 w-3 text-neutral-400 shrink-0" />
                                  <span className="truncate max-w-[140px]" title={item.email}>
                                    {item.email}
                                  </span>
                                </div>
                              )}
                              {item.telefone && (
                                <div className="flex items-center gap-1 text-[11px] text-neutral-500 font-mono tabular-nums">
                                  <Phone className="h-3 w-3 text-neutral-400 shrink-0" />
                                  <span>{item.telefone}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-2.5 py-2 font-mono tabular-nums text-neutral-600 text-xs">
                              <div>{item.data_admissao ? formatDate(item.data_admissao) : '—'}</div>
                              {item.usuario_sistema && item.expand?.usuario_sistema && (
                                <div
                                  className="mt-1 inline-flex items-center gap-1 rounded bg-[#FFF0E6] px-1.5 py-0.5 text-[10px] font-semibold text-[#D65100] border border-[#FF6A13]/30"
                                  title={`Conta de acesso vinculada: ${item.expand.usuario_sistema.name || item.expand.usuario_sistema.email}`}
                                >
                                  <UserCheck2 className="h-2.5 w-2.5 text-[#FF6A13] shrink-0" />
                                  <span className="truncate max-w-[100px]">
                                    {item.expand.usuario_sistema.name ||
                                      item.expand.usuario_sistema.email}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-2.5 py-2 text-right font-mono tabular-nums font-semibold text-neutral-800 text-xs">
                              {item.remuneracao_base && item.remuneracao_base > 0
                                ? formatCurrency(item.remuneracao_base)
                                : '—'}
                            </td>
                            <td className="px-2.5 py-2 text-center whitespace-nowrap">
                              <CrmBadge tone={item.situacao === 'ativo' ? 'green' : 'gray'}>
                                {item.situacao.toUpperCase()}
                              </CrmBadge>
                            </td>
                            <td className="px-2.5 py-2 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenEdit(item)}
                                    className="h-7 w-7 text-neutral-500 hover:text-[#FF6A13]"
                                    title="Editar colaborador"
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
                                    className="h-7 w-7 text-neutral-400 hover:text-rose-600"
                                    title="Excluir colaborador (Apenas Admin)"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
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
                {editingItem ? 'Editar Colaborador' : 'Novo Colaborador AEROCAD'}
              </DialogTitle>
              <DialogDescription>
                Informe os dados cadastrais, cargo, função e modalidade de contratação da equipe.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 text-xs">
              {/* Seção Destaque de Perfil Técnico e RT */}
              <div className="sm:col-span-2 p-3.5 rounded-lg border border-[#FF6A13]/30 bg-gradient-to-r from-[#FFFBF8] to-[#FFF5ED] space-y-3">
                <div className="flex items-center gap-2 text-neutral-800 font-bold text-xs">
                  <ShieldCheck className="h-4 w-4 text-[#FF6A13]" />
                  <span>Enquadramento Técnico & Responsabilidade Técnica (RT)</span>
                </div>
                <p className="text-[11px] text-neutral-600">
                  Marque se este colaborador compõe a equipe técnica dos projetos/processos ou se é
                  legalmente habilitado como <strong>Responsável Técnico (RT)</strong> perante
                  CREA/CAU/CFT para emissão de ART/RRT e assunção técnica.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-start gap-2.5 p-2 rounded border border-neutral-200 bg-white cursor-pointer hover:bg-neutral-50">
                    <Checkbox
                      checked={formData.eh_tecnico}
                      onCheckedChange={(c) =>
                        setFormData({
                          ...formData,
                          eh_tecnico: !!c,
                          eh_rt: !c ? false : formData.eh_rt,
                        })
                      }
                      className="mt-0.5 data-[state=checked]:bg-[#FF6A13] data-[state=checked]:border-[#FF6A13]"
                    />
                    <div>
                      <div className="text-xs font-semibold text-neutral-900">Pessoal Técnico</div>
                      <div className="text-[10px] text-neutral-500">
                        Atua como Analista, Coordenador Técnico ou Projetista
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded border border-orange-200 bg-orange-50/50 cursor-pointer hover:bg-orange-50">
                    <Checkbox
                      checked={formData.eh_rt}
                      onCheckedChange={(c) =>
                        setFormData({
                          ...formData,
                          eh_rt: Boolean(c),
                          eh_tecnico: c ? true : formData.eh_tecnico,
                        })
                      }
                      className="mt-0.5 data-[state=checked]:bg-[#FF6A13] data-[state=checked]:border-[#FF6A13]"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#D65100]">
                        Responsável Técnico (RT)
                      </div>
                      <div className="text-[10px] text-neutral-600">
                        Habilitado a ser atribuído como RT em projetos e processos regulatórios
                      </div>
                    </div>
                  </label>
                </div>

                {(formData.eh_tecnico || formData.eh_rt) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#FF6A13]/20">
                    <div>
                      <Label className="text-[11px] font-semibold">Conselho Profissional</Label>
                      <Select
                        value={formData.registro_profissional_tipo || 'CREA'}
                        onValueChange={(val) =>
                          setFormData({
                            ...formData,
                            registro_profissional_tipo: val as RegistroProfissionalTipo,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CREA">CREA (Engenharia / Agronomia)</SelectItem>
                          <SelectItem value="CAU">CAU (Arquitetura e Urbanismo)</SelectItem>
                          <SelectItem value="CFT">CFT (Conselho Federal Técnicos)</SelectItem>
                          <SelectItem value="CRQ">CRQ (Química)</SelectItem>
                          <SelectItem value="OUTRO">Outro Conselho</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold">Nº Registro Profissional</Label>
                      <Input
                        value={formData.registro_profissional_numero}
                        onChange={(e) =>
                          setFormData({ ...formData, registro_profissional_numero: e.target.value })
                        }
                        placeholder="Ex: 12345/D ou 54321"
                        className="h-8 text-xs bg-white font-mono"
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold">UF Registro</Label>
                      <Input
                        maxLength={2}
                        value={formData.registro_profissional_uf}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            registro_profissional_uf: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="DF, SP, RJ..."
                        className="h-8 text-xs bg-white font-mono uppercase"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label className="text-[11px] font-semibold flex items-center gap-1">
                        <GraduationCap className="h-3 w-3 text-neutral-500" />
                        Formação Acadêmica / Titulação
                      </Label>
                      <Input
                        value={formData.formacao_academica}
                        onChange={(e) =>
                          setFormData({ ...formData, formacao_academica: e.target.value })
                        }
                        placeholder="Ex: Engenharia Cartográfica, Civil, Arquitetura..."
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold">ART / RRT Padrão</Label>
                      <Input
                        value={formData.rrt_art_padrao}
                        onChange={(e) =>
                          setFormData({ ...formData, rrt_art_padrao: e.target.value })
                        }
                        placeholder="Ex: ART Múltipla Mensal"
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <Label className="text-[11px] font-semibold">
                        Área de Atuação / Competência Técnica
                      </Label>
                      <Input
                        value={formData.area_atuacao}
                        onChange={(e) => setFormData({ ...formData, area_atuacao: e.target.value })}
                        placeholder="Ex: Espaço Aéreo DECEA, OPEA, Levantamentos Topográficos, PBZPA..."
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-semibold">Nome Completo *</Label>
                <Input
                  required
                  value={formData.nome_completo}
                  onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">CPF ou CNPJ (PJ) *</Label>
                <Input
                  required
                  value={formData.cpf_cnpj}
                  onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                  placeholder="000.000.000-00 ou CNPJ"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Regime de Contratação *</Label>
                <Select
                  value={formData.regime_contratacao}
                  onValueChange={(val) =>
                    setFormData({ ...formData, regime_contratacao: val as RegimeContratacao })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pf_clt">PF — CLT</SelectItem>
                    <SelectItem value="pf_autonomo">PF — Autônomo / RPA</SelectItem>
                    <SelectItem value="pj">PJ — Pessoa Jurídica</SelectItem>
                    <SelectItem value="socio">Sócio(a)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Seletor Hierárquico de Cargo Agrupado por Área */}
              <div className="space-y-1 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-[#FF6A13]" />
                    <span>Cargo *</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-[#D65100] hover:text-[#FF6A13] hover:bg-orange-50"
                    onClick={() => setModoCargoCustomizado(!modoCargoCustomizado)}
                  >
                    {modoCargoCustomizado ? 'Escolher da Lista' : '+ Outro / Criar cargo'}
                  </Button>
                </div>

                {!modoCargoCustomizado ? (
                  <Select
                    value={formData.cargo || '__empty__'}
                    onValueChange={(val) => {
                      if (val === '__custom__') {
                        setModoCargoCustomizado(true)
                        return
                      }
                      const novoCargo = val === '__empty__' ? '' : val
                      // Encontrar área do cargo para pré-preencher a área de atuação caso esteja vazia
                      let areaEncontrada: AreaAtuacaoColaborador | null = null
                      for (const area of AREAS_ATUACAO_COLABORADOR) {
                        if (cargosAgrupados[area].some((c) => c.cargo === novoCargo)) {
                          areaEncontrada = area
                          break
                        }
                      }
                      setFormData({
                        ...formData,
                        cargo: novoCargo,
                        area_atuacao:
                          !formData.area_atuacao && areaEncontrada
                            ? areaEncontrada
                            : formData.area_atuacao,
                      })
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white">
                      <SelectValue placeholder="Selecione o cargo por área..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <SelectItem value="__empty__" className="text-neutral-400 italic">
                        -- Selecione um cargo --
                      </SelectItem>

                      {/* Se o cargo atual for legado e não estiver no catálogo, exibir para manter selecionado */}
                      {formData.cargo && !cargosPadraoSet.has(formData.cargo) && (
                        <SelectGroup>
                          <SelectLabel className="text-[11px] font-bold text-amber-700 bg-amber-50/70 py-1 px-2">
                            Cargo Atual / Personalizado
                          </SelectLabel>
                          <SelectItem value={formData.cargo}>
                            {formData.cargo} (Atual do colaborador)
                          </SelectItem>
                          <SelectSeparator />
                        </SelectGroup>
                      )}

                      {/* Grupos por Área ordenados pela hierarquia */}
                      {AREAS_ATUACAO_COLABORADOR.map((area) => {
                        const lista = cargosAgrupados[area]
                        const badgeColor =
                          area === 'Comercial'
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : area === 'Técnico'
                              ? 'text-blue-700 bg-blue-50 border-blue-200'
                              : area === 'Financeiro'
                                ? 'text-amber-700 bg-amber-50 border-amber-200'
                                : 'text-purple-700 bg-purple-50 border-purple-200'

                        return (
                          <SelectGroup key={area}>
                            <SelectLabel className="text-[11px] font-bold text-neutral-800 flex items-center justify-between py-1.5 px-2 bg-neutral-50/90 border-y border-neutral-100">
                              <span>Área {area}</span>
                              <span
                                className={`text-[9px] font-mono font-medium px-1.5 py-0.2 rounded border ${badgeColor}`}
                              >
                                Hierarquia AEROCAD
                              </span>
                            </SelectLabel>
                            {lista.map((c) => (
                              <SelectItem key={c.cargo} value={c.cargo} className="text-xs pl-4">
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <span className="font-medium text-neutral-900">{c.cargo}</span>
                                  <span className="text-[10px] text-neutral-400 font-normal shrink-0">
                                    [{c.nivel}]
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                            <SelectSeparator />
                          </SelectGroup>
                        )
                      })}

                      <SelectGroup>
                        <SelectItem
                          value="__custom__"
                          className="text-xs font-semibold text-[#D65100] bg-orange-50/60 hover:bg-orange-100 cursor-pointer"
                        >
                          + Outro / Digitar novo cargo livre...
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2 p-2.5 rounded border border-orange-200 bg-orange-50/30">
                    <div className="flex items-center gap-2">
                      <Input
                        required
                        value={formData.cargo}
                        onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                        placeholder="Digite o novo cargo (ex: Consultor Sênior de Tráfego)"
                        className="h-8 text-xs bg-white flex-1"
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] text-neutral-600 shrink-0">
                        Área do novo cargo:
                      </Label>
                      <Select
                        value={cargoAreaCustomizada}
                        onValueChange={(val: AreaAtuacaoColaborador) => {
                          setCargoAreaCustomizada(val)
                          if (!formData.area_atuacao) {
                            setFormData({ ...formData, area_atuacao: val })
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-[11px] bg-white flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AREAS_ATUACAO_COLABORADOR.map((a) => (
                            <SelectItem key={a} value={a} className="text-xs">
                              {a}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-[10px] text-neutral-500">
                      O cargo customizado será salvo livremente no cadastro do colaborador.
                    </p>
                  </div>
                )}
              </div>

              {/* Seletor Hierárquico de Função Agrupado por Área */}
              <div className="space-y-1 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-blue-600" />
                    <span>Função / Especialidade *</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-[#D65100] hover:text-[#FF6A13] hover:bg-orange-50"
                    onClick={() => setModoFuncaoCustomizada(!modoFuncaoCustomizada)}
                  >
                    {modoFuncaoCustomizada ? 'Escolher da Lista' : '+ Outra / Criar função'}
                  </Button>
                </div>

                {!modoFuncaoCustomizada ? (
                  <Select
                    value={formData.funcao || '__empty__'}
                    onValueChange={(val) => {
                      if (val === '__custom__') {
                        setModoFuncaoCustomizada(true)
                        return
                      }
                      const novaFuncao = val === '__empty__' ? '' : val
                      setFormData({ ...formData, funcao: novaFuncao })
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white">
                      <SelectValue placeholder="Selecione a função por área..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <SelectItem value="__empty__" className="text-neutral-400 italic">
                        -- Selecione uma função --
                      </SelectItem>

                      {/* Se a função atual for legada e não estiver no catálogo, exibir para manter selecionada */}
                      {formData.funcao && !funcoesPadraoSet.has(formData.funcao) && (
                        <SelectGroup>
                          <SelectLabel className="text-[11px] font-bold text-amber-700 bg-amber-50/70 py-1 px-2">
                            Função Atual / Personalizada
                          </SelectLabel>
                          <SelectItem value={formData.funcao}>
                            {formData.funcao} (Atual do colaborador)
                          </SelectItem>
                          <SelectSeparator />
                        </SelectGroup>
                      )}

                      {/* Grupos por Área */}
                      {AREAS_ATUACAO_COLABORADOR.map((area) => {
                        const lista = funcoesAgrupadas[area]
                        const badgeColor =
                          area === 'Comercial'
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : area === 'Técnico'
                              ? 'text-blue-700 bg-blue-50 border-blue-200'
                              : area === 'Financeiro'
                                ? 'text-amber-700 bg-amber-50 border-amber-200'
                                : 'text-purple-700 bg-purple-50 border-purple-200'

                        return (
                          <SelectGroup key={area}>
                            <SelectLabel className="text-[11px] font-bold text-neutral-800 flex items-center justify-between py-1.5 px-2 bg-neutral-50/90 border-y border-neutral-100">
                              <span>Área {area}</span>
                              <span
                                className={`text-[9px] font-mono font-medium px-1.5 py-0.2 rounded border ${badgeColor}`}
                              >
                                Hierarquia AEROCAD
                              </span>
                            </SelectLabel>
                            {lista.map((f) => (
                              <SelectItem key={f.funcao} value={f.funcao} className="text-xs pl-4">
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <span className="font-medium text-neutral-900">{f.label}</span>
                                  {f.nivel && (
                                    <span className="text-[10px] text-neutral-400 font-normal shrink-0">
                                      [{f.nivel}]
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                            <SelectSeparator />
                          </SelectGroup>
                        )
                      })}

                      <SelectGroup>
                        <SelectItem
                          value="__custom__"
                          className="text-xs font-semibold text-[#D65100] bg-orange-50/60 hover:bg-orange-100 cursor-pointer"
                        >
                          + Outra / Digitar nova função livre...
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2 p-2.5 rounded border border-orange-200 bg-orange-50/30">
                    <div className="flex items-center gap-2">
                      <Input
                        required
                        value={formData.funcao}
                        onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
                        placeholder="Digite a nova função / especialidade"
                        className="h-8 text-xs bg-white flex-1"
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] text-neutral-600 shrink-0">
                        Área da nova função:
                      </Label>
                      <Select
                        value={funcaoAreaCustomizada}
                        onValueChange={(val: AreaAtuacaoColaborador) => {
                          setFuncaoAreaCustomizada(val)
                          if (!formData.area_atuacao) {
                            setFormData({ ...formData, area_atuacao: val })
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-[11px] bg-white flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AREAS_ATUACAO_COLABORADOR.map((a) => (
                            <SelectItem key={a} value={a} className="text-xs">
                              {a}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-[10px] text-neutral-500">
                      A função customizada será salva no cadastro do colaborador.
                    </p>
                  </div>
                )}
              </div>

              {formData.regime_contratacao === 'pj' && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Razão Social PJ do Colaborador</Label>
                    <Input
                      value={formData.empresa_pj}
                      onChange={(e) => setFormData({ ...formData, empresa_pj: e.target.value })}
                      placeholder="Ex: C.E. Oliveira Consultoria ME"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Vincular a Fornecedor Cadastrado</Label>
                    <Select
                      value={formData.fornecedor_vinculado || 'none'}
                      onValueChange={(val) =>
                        setFormData({
                          ...formData,
                          fornecedor_vinculado: val === 'none' ? '' : val,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecione um fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum (usar nome acima)</SelectItem>
                        {fornecedores.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.nome_completo || f.razao_social} ({f.cnpj_cpf || f.cpf})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                    <UserCheck2 className="h-3.5 w-3.5 text-[#FF6A13]" />
                    <span>Conta de Usuário Vinculada (Login)</span>
                  </Label>
                  {formData.usuario_sistema && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-0.5"
                      onClick={() => setFormData({ ...formData, usuario_sistema: '' })}
                      title="Desvincular usuário deste colaborador"
                    >
                      <X className="h-3 w-3" />
                      Desvincular
                    </Button>
                  )}
                </div>
                <Select
                  value={formData.usuario_sistema || 'none'}
                  onValueChange={(val) =>
                    setFormData({ ...formData, usuario_sistema: val === 'none' ? '' : val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione um usuário para vincular..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none" className="text-neutral-400 italic">
                      -- Nenhum usuário vinculado --
                    </SelectItem>
                    {usuarios.map((u) => {
                      const outroColab = mapaUsuarioJaVinculado[u.id]
                      const vinculadoAEste = editingItem && outroColab?.id === editingItem.id
                      const vinculadoAOutro = outroColab && !vinculadoAEste

                      return (
                        <SelectItem
                          key={u.id}
                          value={u.id}
                          disabled={Boolean(vinculadoAOutro)}
                          className={vinculadoAOutro ? 'opacity-50 text-neutral-400' : ''}
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span>
                              {u.name} ({u.email})
                            </span>
                            {vinculadoAOutro && (
                              <span className="text-[10px] text-amber-700 italic shrink-0">
                                (Já em: {outroColab.nome_completo})
                              </span>
                            )}
                            {vinculadoAEste && (
                              <span className="text-[10px] text-emerald-700 font-bold shrink-0">
                                (Atual)
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-neutral-500">
                  Relação 1:1 estrita. Uma conta de usuário só pode pertencer a um colaborador da
                  equipe.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Situação / Status *</Label>
                <Select
                  value={formData.situacao}
                  onValueChange={(val: 'ativo' | 'inativo') =>
                    setFormData({ ...formData, situacao: val })
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
                <Label className="text-xs">E-mail Profissional</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="carlos@aerocad.com.br"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Telefone / WhatsApp</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(11) 98888-8888"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Data de Admissão / Início *</Label>
                <Input
                  type="date"
                  required
                  value={formData.data_admissao}
                  onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Data de Desligamento (se inativo)</Label>
                <Input
                  type="date"
                  value={formData.data_desligamento}
                  onChange={(e) => setFormData({ ...formData, data_desligamento: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Remuneração Base Mensal (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.remuneracao_base}
                  onChange={(e) => setFormData({ ...formData, remuneracao_base: e.target.value })}
                  placeholder="0,00"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#D65100]">
                  Chave PIX para Quitação
                </Label>
                <Input
                  value={formData.chave_pix}
                  onChange={(e) => setFormData({ ...formData, chave_pix: e.target.value })}
                  placeholder="CPF, e-mail ou chave aleatória"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Observações / Registro Interno</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Anotações de contrato, CREA/CFT, especialidades técnicas, banco etc."
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
                    : 'Cadastrar Colaborador'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão (Admin) */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-rose-600">Excluir Colaborador</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja remover o registro do colaborador{' '}
              <strong>{itemToDelete?.nome_completo}</strong> ({itemToDelete?.cargo})? Esta ação
              ficará gravada no log de auditoria.
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
