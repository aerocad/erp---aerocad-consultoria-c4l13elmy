import { useState, useMemo, useEffect, type FormEvent } from 'react'
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Paperclip,
  RotateCcw,
  Building,
  Car,
  Compass,
  Laptop,
  Plane,
  Calculator,
  Download,
  Calendar,
  Layers,
  FileCheck,
  FileText,
} from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState } from '@/components/common/States'
import { formatCurrency, formatDate } from '@/lib/format'
import { createOne, updateOne, deleteOne } from '@/services/api'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import type {
  AtivoPatrimonioRecord,
  CategoriaAtivoPatrimonial,
  StatusAtivoPatrimonial,
  FornecedorRecord,
} from '@/types/crm'

export const CATEGORIA_ATIVO_LABELS: Record<CategoriaAtivoPatrimonial, string> = {
  equipamento_topografico: 'Equipamento Topográfico / Geodésico',
  drone_aeronave: 'Drone / Aeronave Remotamente Pilotada',
  computador_hardware: 'Hardware & Workstation CAD',
  software_licenca: 'Software / Licença Perpétua BIM/CAD',
  veiculo: 'Veículo / Frota Operacional',
  terreno: 'Terreno / Imóvel (Patrimônio Fixo)',
  imovel: 'Bem Imóvel / Sede / Instalação',
  mobiliario: 'Mobiliário & Escritório',
  outro_ativo: 'Outro Ativo Permanente',
}

export const STATUS_ATIVO_LABELS: Record<StatusAtivoPatrimonial, string> = {
  ativo: 'Ativo em Operação',
  em_manutencao: 'Em Manutenção / Calibração',
  baixado_alienado: 'Baixado / Alienado',
  totalmente_depreciado: 'Totalmente Depreciado',
}

// Taxas anuais típicas da Receita Federal / Normas Contábeis brasileiras
export const DEPRECIACAO_PADRAO: Record<
  CategoriaAtivoPatrimonial,
  { vidaUtilMeses: number; taxaAnual: number }
> = {
  computador_hardware: { vidaUtilMeses: 60, taxaAnual: 20 }, // 5 anos = 20% ao ano
  software_licenca: { vidaUtilMeses: 60, taxaAnual: 20 },
  drone_aeronave: { vidaUtilMeses: 60, taxaAnual: 20 },
  equipamento_topografico: { vidaUtilMeses: 120, taxaAnual: 10 }, // 10 anos = 10% ao ano
  veiculo: { vidaUtilMeses: 60, taxaAnual: 20 }, // 5 anos = 20% ao ano
  terreno: { vidaUtilMeses: 0, taxaAnual: 0 }, // Terrenos não sofrem depreciação: taxa 0% (NBC TG 27)
  imovel: { vidaUtilMeses: 300, taxaAnual: 4 }, // 25 anos = 4% ao ano
  mobiliario: { vidaUtilMeses: 120, taxaAnual: 10 },
  outro_ativo: { vidaUtilMeses: 120, taxaAnual: 10 },
}
/**
 * Calcula o valor contábil líquido atual com depreciação linear mensal.
 * Se categoria for 'terreno' ou vidaUtilMeses for 0, retorna depreciacaoAcumulada 0
 * e valorContabilAtual igual ao valor de aquisição (NBC TG 27 / CPC 27).
 */
export function calcularDepreciacaoLinear(
  valorAquisicao: number,
  dataAquisicaoStr: string,
  vidaUtilMeses: number,
  valorResidual: number = 0,
  categoria?: CategoriaAtivoPatrimonial,
): { mesesDecorridos: number; depreciacaoAcumulada: number; valorContabilAtual: number } {
  if (!valorAquisicao || valorAquisicao <= 0) {
    return { mesesDecorridos: 0, depreciacaoAcumulada: 0, valorContabilAtual: 0 }
  }

  // Regra NBC TG 27: Terrenos têm vida útil ilimitada e não sofrem depreciação
  if (categoria === 'terreno' || vidaUtilMeses === 0) {
    return { mesesDecorridos: 0, depreciacaoAcumulada: 0, valorContabilAtual: valorAquisicao }
  }

  const dataAq = new Date(dataAquisicaoStr.slice(0, 10))
  if (isNaN(dataAq.getTime())) {
    return { mesesDecorridos: 0, depreciacaoAcumulada: 0, valorContabilAtual: valorAquisicao }
  }

  const hoje = new Date()
  const anosDiff = hoje.getFullYear() - dataAq.getFullYear()
  const mesesDiff = anosDiff * 12 + (hoje.getMonth() - dataAq.getMonth())
  const mesesDecorridos = Math.max(0, mesesDiff)

  const valorDepreciavel = Math.max(0, valorAquisicao - valorResidual)
  const vidaUtilTotal = Math.max(1, vidaUtilMeses)

  const fracaoDepreciada = Math.min(1, mesesDecorridos / vidaUtilTotal)
  const depreciacaoAcumulada = valorDepreciavel * fracaoDepreciada
  const valorContabilAtual = Math.max(valorResidual, valorAquisicao - depreciacaoAcumulada)

  return { mesesDecorridos, depreciacaoAcumulada, valorContabilAtual }
}

export interface AtivosPatrimonioTabProps {
  canWrite: boolean
  fornecedores?: FornecedorRecord[]
  credores?: import('@/types/crm').CredorRecord[]
}

export function AtivosPatrimonioTab({
  canWrite,
  fornecedores = [],
  credores: credoresProp = [],
}: AtivosPatrimonioTabProps) {
  const [ativos, setAtivos] = useState<AtivoPatrimonioRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Credores disponíveis para seleção de fornecedor/vendedor
  const [listaCredores, setListaCredores] =
    useState<import('@/types/crm').CredorRecord[]>(credoresProp)
  const [buscaCredor, setBuscaCredor] = useState('')

  // Modais
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<AtivoPatrimonioRecord | null>(null)
  const [excluindo, setExcluindo] = useState<AtivoPatrimonioRecord | null>(null)
  const [fichaAtivo, setFichaAtivo] = useState<AtivoPatrimonioRecord | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Anexos múltiplos pendentes no modal
  interface AnexoPendenteAtivo {
    id: string
    file: File
    tipo: import('@/types/crm').TipoDocumentoAtivo
    observacao: string
  }
  const [anexosPendentes, setAnexosPendentes] = useState<AnexoPendenteAtivo[]>([])
  const [tipoAnexoAtual, setTipoAnexoAtual] =
    useState<import('@/types/crm').TipoDocumentoAtivo>('comprovante')

  // Form State
  const [formData, setFormData] = useState<{
    identificador_codigo: string
    descricao: string
    categoria: CategoriaAtivoPatrimonial
    data_aquisicao: string
    valor_aquisicao: string
    vida_util_meses: string
    taxa_depreciacao_anual: string
    valor_residual: string
    status: StatusAtivoPatrimonial
    numero_nf_registro: string
    fornecedor: string
    fornecedor_nome: string
    credor: string
    localizacao_responsavel: string
    observacoes: string
    arquivoEvidencia: File | null
  }>({
    identificador_codigo: '',
    descricao: '',
    categoria: 'equipamento_topografico',
    data_aquisicao: new Date().toISOString().slice(0, 10),
    valor_aquisicao: '',
    vida_util_meses: '120',
    taxa_depreciacao_anual: '10',
    valor_residual: '0',
    status: 'ativo',
    numero_nf_registro: '',
    fornecedor: '',
    fornecedor_nome: '',
    credor: '',
    localizacao_responsavel: '',
    observacoes: '',
    arquivoEvidencia: null,
  })

  async function carregarAtivos() {
    try {
      setLoading(true)
      const res = await pb.collection('ativos_patrimonio').getFullList<AtivoPatrimonioRecord>({
        sort: '-created',
        expand: 'fornecedor,credor,criado_por',
      })
      setAtivos(res)
    } catch (err) {
      console.log('Erro ao carregar ativos patrimoniais:', err)
      toast.error('Erro ao carregar lista de ativos patrimoniais')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarAtivos()
  }, [])

  useEffect(() => {
    if (credoresProp.length > 0) {
      setListaCredores(credoresProp)
    } else {
      pb.collection('credores')
        .getFullList<import('@/types/crm').CredorRecord>({ sort: 'nome_razao_social' })
        .then((res) => setListaCredores(res))
        .catch(() => {})
    }
  }, [credoresProp])

  // Lista com cálculo dinâmico de depreciação contábil
  const ativosCalculados = useMemo(() => {
    return ativos.map((at) => {
      const vidaUtilConfig =
        at.categoria === 'terreno'
          ? 0
          : at.vida_util_meses !== undefined
            ? at.vida_util_meses
            : (DEPRECIACAO_PADRAO[at.categoria]?.vidaUtilMeses ?? 120)

      const calc = calcularDepreciacaoLinear(
        at.valor_aquisicao,
        at.data_aquisicao,
        vidaUtilConfig,
        at.valor_residual || 0,
        at.categoria,
      )
      return {
        ...at,
        mesesDecorridos: calc.mesesDecorridos,
        depreciacaoAcumulada: calc.depreciacaoAcumulada,
        valorContabilAtualCalculado: calc.valorContabilAtual,
      }
    })
  }, [ativos])

  const ativosFiltrados = useMemo(() => {
    return ativosCalculados.filter((a) => {
      const matchBusca =
        a.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        (a.identificador_codigo &&
          a.identificador_codigo.toLowerCase().includes(busca.toLowerCase())) ||
        (a.numero_nf_registro &&
          a.numero_nf_registro.toLowerCase().includes(busca.toLowerCase())) ||
        (a.fornecedor_nome && a.fornecedor_nome.toLowerCase().includes(busca.toLowerCase()))

      const matchCat = filtroCategoria === 'todos' || a.categoria === filtroCategoria
      const matchStat = filtroStatus === 'todos' || a.status === filtroStatus

      return matchBusca && matchCat && matchStat
    })
  }, [ativosCalculados, busca, filtroCategoria, filtroStatus])

  // Totalizadores Contábeis
  const totalCustoHistorico = ativosFiltrados.reduce((acc, a) => acc + a.valor_aquisicao, 0)
  const totalDepreciacaoAcumulada = ativosFiltrados.reduce(
    (acc, a) => acc + a.depreciacaoAcumulada,
    0,
  )
  const totalValorContabilAtual = ativosFiltrados.reduce(
    (acc, a) => acc + a.valorContabilAtualCalculado,
    0,
  )

  function abrirModalCriacao() {
    setEditando(null)
    setAnexosPendentes([])
    setBuscaCredor('')
    const padrao = DEPRECIACAO_PADRAO.equipamento_topografico
    setFormData({
      identificador_codigo: `ATV-${new Date().getFullYear()}-${String(ativos.length + 1).padStart(3, '0')}`,
      descricao: '',
      categoria: 'equipamento_topografico',
      data_aquisicao: new Date().toISOString().slice(0, 10),
      valor_aquisicao: '',
      vida_util_meses: String(padrao.vidaUtilMeses),
      taxa_depreciacao_anual: String(padrao.taxaAnual),
      valor_residual: '0',
      status: 'ativo',
      numero_nf_registro: '',
      fornecedor: '',
      fornecedor_nome: '',
      credor: '',
      localizacao_responsavel: '',
      observacoes: '',
      arquivoEvidencia: null,
    })
    setModalAberto(true)
  }

  function abrirModalEdicao(ativo: AtivoPatrimonioRecord) {
    setEditando(ativo)
    setAnexosPendentes([])
    setBuscaCredor(ativo.fornecedor_nome || '')
    const ehTerreno = ativo.categoria === 'terreno'
    setFormData({
      identificador_codigo: ativo.identificador_codigo || '',
      descricao: ativo.descricao,
      categoria: ativo.categoria,
      data_aquisicao: ativo.data_aquisicao ? ativo.data_aquisicao.slice(0, 10) : '',
      valor_aquisicao: String(ativo.valor_aquisicao),
      vida_util_meses: ehTerreno
        ? '0'
        : String(
            ativo.vida_util_meses !== undefined
              ? ativo.vida_util_meses
              : (DEPRECIACAO_PADRAO[ativo.categoria]?.vidaUtilMeses ?? 120),
          ),
      taxa_depreciacao_anual: ehTerreno
        ? '0'
        : String(
            ativo.taxa_depreciacao_anual !== undefined
              ? ativo.taxa_depreciacao_anual
              : (DEPRECIACAO_PADRAO[ativo.categoria]?.taxaAnual ?? 10),
          ),
      valor_residual: String(ativo.valor_residual || 0),
      status: ativo.status,
      numero_nf_registro: ativo.numero_nf_registro || '',
      fornecedor: ativo.fornecedor || '',
      fornecedor_nome: ativo.fornecedor_nome || '',
      credor: ativo.credor || '',
      localizacao_responsavel: ativo.localizacao_responsavel || '',
      observacoes: ativo.observacoes || '',
      arquivoEvidencia: null,
    })
    setModalAberto(true)
  }

  function handleCategoriaChange(cat: CategoriaAtivoPatrimonial) {
    const padrao = DEPRECIACAO_PADRAO[cat] || { vidaUtilMeses: 120, taxaAnual: 10 }
    setFormData((prev) => ({
      ...prev,
      categoria: cat,
      vida_util_meses: String(padrao.vidaUtilMeses),
      taxa_depreciacao_anual: String(padrao.taxaAnual),
    }))
  }

  // Filtragem de credores no seletor com busca
  const credoresFiltradosBusca = useMemo(() => {
    if (!buscaCredor.trim()) return listaCredores.slice(0, 8)
    const termo = buscaCredor.toLowerCase()
    return listaCredores
      .filter(
        (c) =>
          c.nome_razao_social.toLowerCase().includes(termo) ||
          (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(termo)) ||
          c.cnpj_cpf.includes(termo),
      )
      .slice(0, 8)
  }, [listaCredores, buscaCredor])

  function handleSelecionarCredor(credorItem: import('@/types/crm').CredorRecord) {
    setFormData((prev) => ({
      ...prev,
      credor: credorItem.id,
      fornecedor_nome: credorItem.nome_fantasia || credorItem.nome_razao_social,
    }))
    setBuscaCredor(credorItem.nome_fantasia || credorItem.nome_razao_social)
  }

  function handleAdicionarArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const novos: AnexoPendenteAtivo[] = []
    const MAX_MB = 30 * 1024 * 1024

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (f.size > MAX_MB) {
        toast.error(`O arquivo "${f.name}" excede o limite máximo de 30MB.`)
        continue
      }
      novos.push({
        id: `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
        file: f,
        tipo: tipoAnexoAtual,
        observacao: '',
      })
    }

    setAnexosPendentes((prev) => [...prev, ...novos])
    e.target.value = ''
  }

  function removerAnexoPendente(id: string) {
    setAnexosPendentes((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formData.descricao || !formData.valor_aquisicao || !formData.data_aquisicao) {
      toast.error('Preencha os campos obrigatórios (descrição, valor e data de aquisição).')
      return
    }

    setIsSubmitting(true)

    try {
      const valAquisicao = Number(formData.valor_aquisicao)
      const ehTerreno = formData.categoria === 'terreno'
      const vidaUtil = ehTerreno ? 0 : Number(formData.vida_util_meses) || 120
      const taxaAnual = ehTerreno ? 0 : Number(formData.taxa_depreciacao_anual) || 0
      const residual = Number(formData.valor_residual) || 0

      const calc = calcularDepreciacaoLinear(
        valAquisicao,
        formData.data_aquisicao,
        vidaUtil,
        residual,
        formData.categoria,
      )

      // Metadados existentes + novos anexos
      const metadadosExistentes = Array.isArray(editando?.anexos_metadados)
        ? [...editando.anexos_metadados]
        : []

      const novosMetadados = anexosPendentes.map((ap) => ({
        file: ap.file.name,
        tipo: ap.tipo,
        nome_original: ap.file.name,
        tamanho: ap.file.size,
        observacao: ap.observacao || '',
      }))

      const metadadosTotais = [...metadadosExistentes, ...novosMetadados]

      // Se há anexos pendentes para enviar, usamos FormData para suportar multipart/form-data
      const formDataUpload = new FormData()
      formDataUpload.append('identificador_codigo', formData.identificador_codigo)
      formDataUpload.append('descricao', formData.descricao)
      formDataUpload.append('categoria', formData.categoria)
      formDataUpload.append('data_aquisicao', `${formData.data_aquisicao} 12:00:00.000Z`)
      formDataUpload.append('valor_aquisicao', String(valAquisicao))
      formDataUpload.append('vida_util_meses', String(vidaUtil))
      formDataUpload.append('taxa_depreciacao_anual', String(taxaAnual))
      formDataUpload.append('valor_residual', String(residual))
      formDataUpload.append('valor_contabil_atual', String(calc.valorContabilAtual))
      formDataUpload.append('status', formData.status)
      formDataUpload.append('numero_nf_registro', formData.numero_nf_registro || '')
      formDataUpload.append('fornecedor_nome', formData.fornecedor_nome || '')
      formDataUpload.append('localizacao_responsavel', formData.localizacao_responsavel || '')
      formDataUpload.append('observacoes', formData.observacoes || '')
      formDataUpload.append('credor', formData.credor || '')
      formDataUpload.append('anexos_metadados', JSON.stringify(metadadosTotais))

      if (formData.fornecedor && formData.fornecedor !== 'nenhum') {
        formDataUpload.append('fornecedor', formData.fornecedor)
      }

      if (formData.arquivoEvidencia) {
        formDataUpload.append('documento_evidencia', formData.arquivoEvidencia)
      }

      for (const ap of anexosPendentes) {
        formDataUpload.append('anexos', ap.file)
      }

      if (editando) {
        await pb.collection('ativos_patrimonio').update(editando.id, formDataUpload)
        toast.success('Ativo patrimonial atualizado!')
      } else {
        if (pb.authStore.record?.id) {
          formDataUpload.append('criado_por', pb.authStore.record.id)
        }
        await pb.collection('ativos_patrimonio').create(formDataUpload)
        toast.success('Ativo patrimonial registrado no balanço da empresa!')
      }

      setModalAberto(false)
      setAnexosPendentes([])
      await carregarAtivos()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao salvar ativo patrimonial: ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleExcluir() {
    if (!excluindo) return
    setIsSubmitting(true)
    try {
      await deleteOne('ativos_patrimonio', excluindo.id)
      toast.success('Ativo patrimonial excluído.')
      setExcluindo(null)
      await carregarAtivos()
    } catch {
      toast.error('Erro ao excluir ativo')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Cards de Resumo Contábil do Ativo Permanente */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="crm-card p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            <span>Custo Histórico Total</span>
            <Building className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-neutral-900">
            {formatCurrency(totalCustoHistorico)}
          </p>
          <span className="text-[11px] text-neutral-400">
            {ativosFiltrados.length} bens inventariados
          </span>
        </div>

        <div className="crm-card p-4 border-amber-200 bg-amber-50/30">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800 uppercase tracking-wider">
            <span>Depreciação Acumulada</span>
            <Calculator className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-amber-700">
            - {formatCurrency(totalDepreciacaoAcumulada)}
          </p>
          <span className="text-[11px] text-amber-600">Cálculo linear contábil conforme uso</span>
        </div>

        <div className="crm-card p-4 border-emerald-200 bg-emerald-50/40">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            <span>Valor Contábil Líquido</span>
            <FileCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-emerald-700">
            {formatCurrency(totalValorContabilAtual)}
          </p>
          <span className="text-[11px] text-emerald-600">
            Alimenta o Ativo Não Circulante do Balanço
          </span>
        </div>

        <div className="crm-card p-4 border-blue-200 bg-blue-50/30">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-800 uppercase tracking-wider">
            <span>Bens em Operação</span>
            <Compass className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-blue-700">
            {ativosFiltrados.filter((a) => a.status === 'ativo').length} de {ativosFiltrados.length}
          </p>
          <span className="text-[11px] text-blue-600">
            Equipamentos, drones, softwares e frotas
          </span>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 crm-card p-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por descrição, identificador, NF ou fornecedor..."
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <Filter className="mr-1.5 h-3.5 w-3.5 text-neutral-400" />
              <SelectValue placeholder="Categoria de Ativo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {Object.entries(CATEGORIA_ATIVO_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(STATUS_ATIVO_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canWrite && (
            <Button
              onClick={abrirModalCriacao}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white h-9 text-xs shrink-0"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Declarar Bem / Ativo
            </Button>
          )}
        </div>
      </div>

      {/* Tabela de Ativos e Patrimônio */}
      {loading ? (
        <div className="p-12 text-center text-xs text-neutral-500">
          Carregando ativos e patrimônio...
        </div>
      ) : ativosFiltrados.length === 0 ? (
        <EmptyState
          title="Nenhum ativo ou bem cadastrado"
          description={
            ativos.length === 0
              ? 'Declare os bens móveis (estações totais, drones, computadores, licenças), imóveis e veículos da AEROCAD para integrá-los à contabilidade e ao Balanço Patrimonial.'
              : 'Tente ajustar os filtros ou termo de busca.'
          }
        />
      ) : (
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Código / Identificador</th>
                  <th className="px-4 py-3">Descrição do Bem / Ativo</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Aquisição</th>
                  <th className="px-4 py-3">Custo Histórico</th>
                  <th className="px-4 py-3">Depreciação Acum.</th>
                  <th className="px-4 py-3">Valor Contábil Atual</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Evidência / NF</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {ativosFiltrados.map((ativo) => (
                  <tr key={ativo.id} className="hover:bg-neutral-50/80 transition">
                    <td className="px-4 py-3 whitespace-nowrap font-mono font-medium text-neutral-800">
                      {ativo.identificador_codigo || '—'}
                    </td>

                    <td className="px-4 py-3">
                      <div className="space-y-0.5 max-w-[240px]">
                        <p className="font-semibold text-neutral-900 line-clamp-1">
                          {ativo.descricao}
                        </p>
                        {ativo.localizacao_responsavel && (
                          <p className="text-[11px] text-neutral-500 truncate">
                            Local: {ativo.localizacao_responsavel}
                          </p>
                        )}
                        {ativo.numero_nf_registro && (
                          <p className="text-[10px] text-neutral-400">
                            NF/Registro: {ativo.numero_nf_registro}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <CrmBadge tone="gray">
                        {CATEGORIA_ATIVO_LABELS[ativo.categoria] || ativo.categoria}
                      </CrmBadge>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-neutral-700">
                      {formatDate(ativo.data_aquisicao)}
                      <p className="text-[10px] text-neutral-400">
                        {ativo.mesesDecorridos} meses em uso
                      </p>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap font-mono font-medium text-neutral-900">
                      {formatCurrency(ativo.valor_aquisicao)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap font-mono text-amber-700">
                      - {formatCurrency(ativo.depreciacaoAcumulada)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-emerald-700">
                      {formatCurrency(ativo.valorContabilAtualCalculado)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {ativo.status === 'ativo' ? (
                        <CrmBadge tone="green">Ativo</CrmBadge>
                      ) : ativo.status === 'em_manutencao' ? (
                        <CrmBadge tone="amber">Manutenção</CrmBadge>
                      ) : (
                        <CrmBadge tone="gray">{STATUS_ATIVO_LABELS[ativo.status]}</CrmBadge>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1">
                        {ativo.documento_evidencia && (
                          <a
                            href={pb.files.getURL(ativo, ativo.documento_evidencia)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#FF6A13] hover:underline font-medium text-[11px]"
                            title="Ver Evidência / NF Anexa"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            Evidência
                          </a>
                        )}

                        {/* Chips dos múltiplos anexos clicáveis com tipo */}
                        {Array.isArray(ativo.anexos) && ativo.anexos.length > 0 && (
                          <div className="flex flex-wrap justify-center gap-1 max-w-[200px]">
                            {ativo.anexos.map((anexoNome, idx) => {
                              const meta = ativo.anexos_metadados?.find(
                                (m) => m.file === anexoNome || m.nome_original === anexoNome,
                              )
                              const labelTipo = meta?.tipo ? meta.tipo.toUpperCase() : 'DOC'
                              const url = pb.files.getURL(ativo, anexoNome)

                              return (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 text-[#FF6A13] border border-orange-200 hover:bg-orange-100 text-[10px] font-medium transition"
                                  title={`Abrir anexo: ${meta?.nome_original || anexoNome}`}
                                >
                                  <Paperclip className="h-2.5 w-2.5" />
                                  <span>{labelTipo}</span>
                                </a>
                              )
                            })}
                          </div>
                        )}

                        {!ativo.documento_evidencia &&
                          (!ativo.anexos || ativo.anexos.length === 0) && (
                            <span className="text-neutral-300 text-xs">—</span>
                          )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setFichaAtivo(ativo)}
                          className="h-7 px-2 text-xs text-neutral-600 hover:text-[#FF6A13]"
                          title="Abrir ficha cadastral completa e documentos agrupados por tipo"
                        >
                          <FileText className="mr-1 h-3.5 w-3.5 text-[#FF6A13]" />
                          Ficha
                        </Button>
                        {canWrite && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirModalEdicao(ativo)}
                              className="h-7 px-2 text-xs text-neutral-600 hover:text-neutral-900"
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExcluindo(ativo)}
                              className="h-7 w-7 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Excluir ativo"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Declaração / Edição de Ativo */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editando
                ? 'Editar Bem / Ativo Patrimonial'
                : 'Declarar Novo Bem / Ativo Patrimonial'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1 sm:col-span-1">
                <Label className="text-xs">Identificador / Plaqueta *</Label>
                <Input
                  required
                  value={formData.identificador_codigo}
                  onChange={(e) =>
                    setFormData({ ...formData, identificador_codigo: e.target.value })
                  }
                  placeholder="ATV-2026-001"
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Descrição do Bem / Ativo *</Label>
                <Input
                  required
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Ex: Estação Total Topcon OS-105, Drone DJI Matrice 300..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Categoria Contábil *</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(val: CategoriaAtivoPatrimonial) => handleCategoriaChange(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_ATIVO_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Status do Bem</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val: StatusAtivoPatrimonial) =>
                    setFormData({ ...formData, status: val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_ATIVO_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Data de Aquisição *</Label>
                <Input
                  required
                  type="date"
                  value={formData.data_aquisicao}
                  onChange={(e) => setFormData({ ...formData, data_aquisicao: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Custo Histórico / Aquisição (R$) *</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.valor_aquisicao}
                  onChange={(e) => setFormData({ ...formData, valor_aquisicao: e.target.value })}
                  placeholder="0,00"
                  className="font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Valor Residual (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor_residual}
                  onChange={(e) => setFormData({ ...formData, valor_residual: e.target.value })}
                  placeholder="0,00"
                  className="font-mono text-neutral-600"
                />
              </div>
            </div>

            {/* Parâmetros de Depreciação Linear */}
            <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/70 space-y-2">
              <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5 text-[#FF6A13]" />
                Parâmetros Contábeis de Depreciação Linear (Receita Federal / NBC TG 27)
              </span>

              {formData.categoria === 'terreno' ? (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-blue-900 text-xs space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <FileCheck className="h-4 w-4 text-blue-600" />
                    Terrenos não se depreciam (NBC TG 27)
                  </p>
                  <p className="text-[11px] text-blue-800">
                    Conforme o item 58 do Pronunciamento Técnico NBC TG 27 (CPC 27), terrenos têm
                    vida útil ilimitada e não sofrem quotas de depreciação contábil, mantendo seu
                    valor contábil integral no Ativo Imobilizado.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-neutral-600">
                      Vida Útil Estimada (Meses)
                    </Label>
                    <Input
                      type="number"
                      value={formData.vida_util_meses}
                      onChange={(e) =>
                        setFormData({ ...formData, vida_util_meses: e.target.value })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-neutral-600">
                      Taxa de Depreciação Anual (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.taxa_depreciacao_anual}
                      onChange={(e) =>
                        setFormData({ ...formData, taxa_depreciacao_anual: e.target.value })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Seletor de Fornecedor / Vendedor com busca sobre a coleção credores */}
            <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-2">
              <Label className="text-xs font-semibold text-neutral-800">
                Fornecedor / Vendedor do Bem (Credor Cadastrado)
              </Label>
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                  <Input
                    value={buscaCredor}
                    onChange={(e) => {
                      setBuscaCredor(e.target.value)
                      setFormData((prev) => ({
                        ...prev,
                        fornecedor_nome: e.target.value,
                        credor: '',
                      }))
                    }}
                    placeholder="Buscar credor por Razão Social, Fantasia ou CNPJ..."
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                {buscaCredor.trim() && credoresFiltradosBusca.length > 0 && !formData.credor && (
                  <div className="border rounded bg-white shadow-sm max-h-36 overflow-y-auto divide-y text-xs">
                    {credoresFiltradosBusca.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelecionarCredor(c)}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-orange-50 transition flex items-center justify-between"
                      >
                        <span className="font-semibold text-neutral-900 truncate">
                          {c.nome_fantasia || c.nome_razao_social}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono ml-2 shrink-0">
                          {c.cnpj_cpf}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {formData.credor && (
                  <div className="flex items-center justify-between p-1.5 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-900 font-medium">
                    <span>
                      Credor vinculado: <strong>{formData.fornecedor_nome}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, credor: '', fornecedor_nome: '' }))
                        setBuscaCredor('')
                      }}
                      className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 underline text-[10px]"
                    >
                      Alterar
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Nº Nota Fiscal / Documento de Origem</Label>
                <Input
                  value={formData.numero_nf_registro}
                  onChange={(e) => setFormData({ ...formData, numero_nf_registro: e.target.value })}
                  placeholder="Ex: NF-e 45209"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Localização / Responsável pelo Bem</Label>
                <Input
                  value={formData.localizacao_responsavel}
                  onChange={(e) =>
                    setFormData({ ...formData, localizacao_responsavel: e.target.value })
                  }
                  placeholder="Ex: Sede AEROCAD / Eng. Responsável"
                />
              </div>
            </div>

            {/* Upload Múltiplo de Anexos com Tipo de Documento */}
            <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-neutral-800">
                  Anexos e Documentos do Ativo (até 30MB)
                </Label>
                <span className="text-[10px] text-neutral-500">
                  Comprovante, Contrato, Laudo, Matrícula
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1 sm:col-span-1">
                  <Label className="text-[11px] text-neutral-600">Tipo do Documento</Label>
                  <Select
                    value={tipoAnexoAtual}
                    onValueChange={(val: import('@/types/crm').TipoDocumentoAtivo) =>
                      setTipoAnexoAtual(val)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comprovante">Comprovante de Pagamento</SelectItem>
                      <SelectItem value="contrato">Contrato de Aquisição / Compra</SelectItem>
                      <SelectItem value="laudo">Laudo de Avaliação / Calibração</SelectItem>
                      <SelectItem value="matricula">Matrícula Imobiliária / CRLV</SelectItem>
                      <SelectItem value="outro">Outro Documento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] text-neutral-600">Selecionar Arquivos</Label>
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx"
                    onChange={handleAdicionarArquivos}
                    className="h-8 text-xs file:bg-[#FF6A13] file:text-white file:border-0 file:rounded file:px-2 file:py-0.5 file:mr-2"
                  />
                </div>
              </div>

              {/* Lista de Anexos Pendentes de Upload */}
              {anexosPendentes.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-semibold text-neutral-700">
                    Documentos a anexar ({anexosPendentes.length}):
                  </p>
                  <div className="max-h-28 overflow-y-auto divide-y border rounded bg-white text-xs">
                    {anexosPendentes.map((ap) => (
                      <div
                        key={ap.id}
                        className="px-2.5 py-1.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="uppercase text-[9px] font-bold px-1 py-0.2 rounded bg-orange-100 text-[#FF6A13] shrink-0">
                            {ap.tipo}
                          </span>
                          <span className="truncate text-neutral-800 font-medium">
                            {ap.file.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removerAnexoPendente(ap.id)}
                          className="text-neutral-400 hover:text-rose-600 shrink-0"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Anexos já gravados no registro em edição */}
              {editando?.anexos && editando.anexos.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[10px] text-neutral-500 font-semibold uppercase">
                    Anexos já salvos neste ativo:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {editando.anexos.map((anexo, idx) => {
                      const meta = editando.anexos_metadados?.find(
                        (m) => m.file === anexo || m.nome_original === anexo,
                      )
                      return (
                        <a
                          key={idx}
                          href={pb.files.getURL(editando, anexo)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-neutral-100 text-neutral-800 hover:text-[#FF6A13] border border-neutral-200"
                        >
                          <Paperclip className="h-3 w-3" />
                          <span className="font-semibold uppercase text-[9px] text-[#FF6A13]">
                            {meta?.tipo || 'DOC'}
                          </span>
                          <span className="truncate max-w-[120px]">
                            {meta?.nome_original || anexo}
                          </span>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observações / Número de Série</Label>
              <Textarea
                rows={2}
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Número de série do fabricante, termo de garantia, especificações técnicas..."
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalAberto(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs"
              >
                {isSubmitting
                  ? 'Salvando...'
                  : editando
                    ? 'Atualizar Ativo'
                    : 'Gravar Ativo Contábil'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal / Ficha Cadastral do Bem com Anexos Agrupados por Tipo */}
      <Dialog open={!!fichaAtivo} onOpenChange={(v) => !v && setFichaAtivo(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-neutral-900">
              <Building className="h-5 w-5 text-[#FF6A13]" />
              Ficha Patrimonial: {fichaAtivo?.identificador_codigo || 'Ativo'}
            </DialogTitle>
          </DialogHeader>

          {fichaAtivo && (
            <div className="space-y-4 text-xs py-2">
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                    Descrição do Bem
                  </span>
                  <p className="text-sm font-bold text-neutral-900">{fichaAtivo.descricao}</p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                    Categoria Contábil
                  </span>
                  <p className="font-semibold text-neutral-800">
                    {CATEGORIA_ATIVO_LABELS[fichaAtivo.categoria] || fichaAtivo.categoria}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                    Data de Aquisição
                  </span>
                  <p className="font-semibold text-neutral-800">
                    {formatDate(fichaAtivo.data_aquisicao)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                    Custo Histórico / Aquisição
                  </span>
                  <p className="font-mono font-bold text-neutral-900">
                    {formatCurrency(fichaAtivo.valor_aquisicao)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                    Fornecedor / Credor Vendedor
                  </span>
                  <p className="font-semibold text-neutral-800">
                    {fichaAtivo.fornecedor_nome ||
                      fichaAtivo.expand?.credor?.nome_razao_social ||
                      'Não informado'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                    Localização / Responsável
                  </span>
                  <p className="font-semibold text-neutral-800">
                    {fichaAtivo.localizacao_responsavel || 'Não especificada'}
                  </p>
                </div>
              </div>

              {/* Informação Contábil / NBC TG 27 */}
              {fichaAtivo.categoria === 'terreno' ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs">
                  <p className="font-bold flex items-center gap-1.5">
                    <FileCheck className="h-4 w-4 text-blue-600" />
                    Regra NBC TG 27 — Terreno não sujeito a quotas de depreciação
                  </p>
                  <p className="text-[11px] text-blue-800 mt-1">
                    Conforme normas do Conselho Federal de Contabilidade (NBC TG 27 / CPC 27), bens
                    da categoria Terreno possuem vida útil econômica indeterminada e permanecem com
                    valor contábil integral no Ativo Imobilizado.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="text-neutral-500 block">Depreciação Acumulada:</span>
                    <strong className="text-amber-700">
                      -{' '}
                      {formatCurrency(
                        calcularDepreciacaoLinear(
                          fichaAtivo.valor_aquisicao,
                          fichaAtivo.data_aquisicao,
                          fichaAtivo.vida_util_meses ||
                            DEPRECIACAO_PADRAO[fichaAtivo.categoria]?.vidaUtilMeses ||
                            120,
                          fichaAtivo.valor_residual || 0,
                          fichaAtivo.categoria,
                        ).depreciacaoAcumulada,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Valor Contábil Atual:</span>
                    <strong className="text-emerald-700">
                      {formatCurrency(
                        calcularDepreciacaoLinear(
                          fichaAtivo.valor_aquisicao,
                          fichaAtivo.data_aquisicao,
                          fichaAtivo.vida_util_meses ||
                            DEPRECIACAO_PADRAO[fichaAtivo.categoria]?.vidaUtilMeses ||
                            120,
                          fichaAtivo.valor_residual || 0,
                          fichaAtivo.categoria,
                        ).valorContabilAtual,
                      )}
                    </strong>
                  </div>
                </div>
              )}

              {/* Anexos agrupados por tipo (comprovante, contrato, laudo, matrícula, outro) */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-[#FF6A13]" />
                  Documentos & Evidências Vinculados (Agrupados por Tipo)
                </h4>

                {(!fichaAtivo.anexos || fichaAtivo.anexos.length === 0) &&
                !fichaAtivo.documento_evidencia ? (
                  <p className="text-neutral-400 italic py-2">
                    Nenhum documento ou anexo vinculado a este bem.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(['comprovante', 'contrato', 'laudo', 'matricula', 'outro'] as const).map(
                      (tipoChave) => {
                        const anexosDoTipo = (fichaAtivo.anexos || []).filter((nomeArq) => {
                          const meta = fichaAtivo.anexos_metadados?.find(
                            (m) => m.file === nomeArq || m.nome_original === nomeArq,
                          )
                          return meta?.tipo === tipoChave || (!meta?.tipo && tipoChave === 'outro')
                        })

                        if (anexosDoTipo.length === 0) return null

                        const labelsSecao: Record<string, string> = {
                          comprovante: 'Comprovantes de Pagamento & Quitação',
                          contrato: 'Contratos de Aquisição & Termos de Compra',
                          laudo: 'Laudos Técnicos, Calibração & Vistorias',
                          matricula: 'Matrículas Imobiliárias / Registros CRLV',
                          outro: 'Outros Documentos Técnicos',
                        }

                        return (
                          <div key={tipoChave} className="space-y-1.5">
                            <span className="text-[11px] font-bold text-neutral-700 block">
                              • {labelsSecao[tipoChave] || tipoChave} ({anexosDoTipo.length})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {anexosDoTipo.map((anexoNome, idx) => {
                                const meta = fichaAtivo.anexos_metadados?.find(
                                  (m) => m.file === anexoNome || m.nome_original === anexoNome,
                                )
                                const url = pb.files.getURL(fichaAtivo, anexoNome)
                                const nomeExibicao = meta?.nome_original || anexoNome

                                return (
                                  <div
                                    key={idx}
                                    className="p-2 rounded border bg-neutral-50/70 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-neutral-900 truncate">
                                        {nomeExibicao}
                                      </p>
                                      {meta?.tamanho && (
                                        <span className="text-[10px] text-neutral-400 font-mono">
                                          {(meta.tamanho / 1024).toFixed(1)} KB
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 rounded text-neutral-600 hover:text-[#FF6A13] hover:bg-white"
                                        title="Visualizar anexo"
                                      >
                                        <FileText className="h-3.5 w-3.5" />
                                      </a>
                                      <a
                                        href={url}
                                        download={nomeExibicao}
                                        className="p-1 rounded text-neutral-600 hover:text-[#FF6A13] hover:bg-white"
                                        title="Baixar arquivo"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </a>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      },
                    )}

                    {fichaAtivo.documento_evidencia && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-bold text-neutral-700 block">
                          • Documento de Evidência / NF Principal (Legado)
                        </span>
                        <div className="p-2 rounded border bg-orange-50/40 border-orange-200 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-neutral-900 truncate">
                            {fichaAtivo.documento_evidencia}
                          </span>
                          <a
                            href={pb.files.getURL(fichaAtivo, fichaAtivo.documento_evidencia)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#FF6A13] text-xs font-bold hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Abrir / Baixar
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFichaAtivo(null)}>
              Fechar Ficha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão */}
      <Dialog open={!!excluindo} onOpenChange={(v) => !v && setExcluindo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-600">Excluir Ativo Contábil</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-neutral-600">
            Tem certeza de que deseja excluir o bem <strong>{excluindo?.descricao}</strong>? Esse
            registro deixará de constar no balanço patrimonial da empresa.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setExcluindo(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" disabled={isSubmitting} onClick={handleExcluir}>
              {isSubmitting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
