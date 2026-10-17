import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  Building2,
  Check,
  FileCheck2,
  FileText,
  Loader2,
  Plus,
  Printer,
  UserCheck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { AerocadLogo } from '@/components/common/AerocadLogo'
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
import {
  CLAUSULAS_OBRIGATORIAS_ORDEM_SERVICO,
  TIPOS_SERVICO_ORDEM_SERVICO_PADRAO,
} from '@/lib/aerocadKnowledge'
import { INSTITUTIONAL_DATA } from '@/lib/documentCatalogo'
import { formatCurrency } from '@/lib/format'
import pb from '@/lib/pocketbase/client'
import { imprimirElementoA4 } from '@/services/relatorioImpressaoService'
import type {
  ColaboradorRecord,
  FornecedorRecord,
  OrdemServicoRecord,
  OrdemServicoStatus,
  PrestadorTipoOS,
  UserRecord,
} from '@/types/crm'

const STORAGE_KEY_CUSTOM_SERVICOS = 'aerocad_custom_os_servicos'

export interface OrdemServicoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  presetProjetoId: string
  presetProjetoNumero?: string
  presetProjetoNome?: string
  presetClienteRazaoSocial?: string
  presetClienteCnpj?: string
  editingOS?: OrdemServicoRecord | null
  onSuccess: () => void
}

export function OrdemServicoDialog({
  open,
  onOpenChange,
  presetProjetoId,
  presetProjetoNumero,
  presetProjetoNome,
  presetClienteRazaoSocial,
  presetClienteCnpj,
  editingOS,
  onSuccess,
}: OrdemServicoDialogProps) {
  const { user } = useAuth()

  // Prestadores disponíveis
  const [colaboradores, setColaboradores] = useState<ColaboradorRecord[]>([])
  const [fornecedores, setFornecedores] = useState<FornecedorRecord[]>([])
  const [usuariosTerceiros, setUsuariosTerceiros] = useState<UserRecord[]>([])
  const [loadingPrestadores, setLoadingPrestadores] = useState(false)

  // Tipos de serviço customizados (salvos no localStorage para persistência e reaproveitamento)
  const [customServicos, setCustomServicos] = useState<string[]>([])

  // Estado do formulário
  const [prestadorTipo, setPrestadorTipo] = useState<PrestadorTipoOS>('fornecedor')
  const [colaboradorId, setColaboradorId] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [prestadorUsuarioId, setPrestadorUsuarioId] = useState('')
  const [prestadorNomeManual, setPrestadorNomeManual] = useState('')

  // Tipo de serviço selecionável + opção outro
  const [tipoServicoSelecionado, setTipoServicoSelecionado] = useState(
    TIPOS_SERVICO_ORDEM_SERVICO_PADRAO[0],
  )
  const [tipoServicoOutro, setTipoServicoOutro] = useState('')

  // Campos específicos solicitados
  const [valor, setValor] = useState<number | string>('')
  const [formaPagamento, setFormaPagamento] = useState(
    'Transferência bancária / PIX mediante apresentação de Nota Fiscal',
  )
  const [prazoExecucao, setPrazoExecucao] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [status, setStatus] = useState<OrdemServicoStatus>('atribuida')

  // Visualização A4 / Impressão
  const [previewA4Open, setPreviewA4Open] = useState(false)
  const [saving, setSaving] = useState(false)

  // Carregar tipos de serviço customizados já salvos
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CUSTOM_SERVICOS)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        if (Array.isArray(parsed)) {
          setCustomServicos(parsed)
        }
      }
    } catch {
      /* ignore */
    }
  }, [])

  // Carregar lista de colaboradores, fornecedores e usuários com perfil terceiro
  useEffect(() => {
    if (open) {
      setLoadingPrestadores(true)
      Promise.all([
        pb.collection<ColaboradorRecord>('colaboradores').getFullList({
          sort: 'nome_completo',
          requestKey: null,
        }),
        pb.collection<FornecedorRecord>('fornecedores').getFullList({
          sort: 'razao_social',
          requestKey: null,
        }),
        pb.collection<UserRecord>('users').getFullList({
          filter: "role = 'terceiro'",
          sort: 'name',
          requestKey: null,
        }),
      ])
        .then(([cols, forns, tercs]) => {
          setColaboradores(cols)
          setFornecedores(forns)
          setUsuariosTerceiros(tercs)
        })
        .catch((err) => {
          console.error('Erro ao carregar colaboradores/fornecedores para OS:', err)
        })
        .finally(() => {
          setLoadingPrestadores(false)
        })

      // Preenchimento no modo de edição ou reset para nova OS
      if (editingOS) {
        setPrestadorTipo(
          editingOS.prestador_tipo ||
            (editingOS.fornecedor
              ? 'fornecedor'
              : editingOS.colaborador
                ? 'colaborador'
                : editingOS.prestador_usuario
                  ? 'terceiro_usuario'
                  : 'outro'),
        )
        setColaboradorId(editingOS.colaborador || '')
        setFornecedorId(editingOS.fornecedor || '')
        setPrestadorUsuarioId(editingOS.prestador_usuario || '')
        setPrestadorNomeManual(editingOS.prestador || '')

        // Tipo de serviço
        const ts = editingOS.tipo_servico || TIPOS_SERVICO_ORDEM_SERVICO_PADRAO[0]
        const isPadraoOuCustom = [
          ...TIPOS_SERVICO_ORDEM_SERVICO_PADRAO,
          ...customServicos,
        ].includes(ts)
        if (isPadraoOuCustom) {
          setTipoServicoSelecionado(ts)
          setTipoServicoOutro('')
        } else {
          setTipoServicoSelecionado('__outro__')
          setTipoServicoOutro(ts)
        }

        setValor(
          editingOS.valor !== undefined
            ? editingOS.valor
            : editingOS.valor_interno !== undefined
              ? editingOS.valor_interno
              : '',
        )
        setFormaPagamento(
          editingOS.forma_pagamento ||
            'Transferência bancária / PIX mediante apresentação de Nota Fiscal',
        )
        setPrazoExecucao(
          editingOS.prazo_execucao || (editingOS.prazo ? editingOS.prazo.split('T')[0] : ''),
        )
        setObservacoes(editingOS.observacoes || editingOS.descricao || '')
        setStatus(editingOS.status || 'atribuida')
      } else {
        setPrestadorTipo('fornecedor')
        setColaboradorId('')
        setFornecedorId('')
        setPrestadorUsuarioId('')
        setPrestadorNomeManual('')
        setTipoServicoSelecionado(TIPOS_SERVICO_ORDEM_SERVICO_PADRAO[0])
        setTipoServicoOutro('')
        setValor('')
        setFormaPagamento('Transferência bancária / PIX mediante apresentação de Nota Fiscal')
        setPrazoExecucao('')
        setObservacoes('')
        setStatus('atribuida')
      }
    }
  }, [open, editingOS, customServicos])

  // Lista unificada de tipos de serviço disponíveis
  const todosTiposServico = useMemo(() => {
    const set = new Set([...TIPOS_SERVICO_ORDEM_SERVICO_PADRAO, ...customServicos])
    return Array.from(set)
  }, [customServicos])

  // Detalhes calculados do prestador selecionado
  const dadosPrestador = useMemo(() => {
    if (prestadorTipo === 'colaborador') {
      const col = colaboradores.find((c) => c.id === colaboradorId)
      return {
        nome: col?.nome_completo || prestadorNomeManual || 'Colaborador não selecionado',
        documento: col?.cpf ? `CPF ${col.cpf}` : col?.cargo ? `Cargo: ${col.cargo}` : '',
        tipoRotulo: 'Colaborador Interno',
        emailOuContato: col?.email_corporativo || col?.email_pessoal || col?.telefone || '',
      }
    }
    if (prestadorTipo === 'fornecedor') {
      const forn = fornecedores.find((f) => f.id === fornecedorId)
      const isPF =
        forn?.tipo_pessoa === 'pf' ||
        (forn?.cnpj_cpf && forn.cnpj_cpf.replace(/\D/g, '').length === 11)
      const nome =
        forn?.nome_completo ||
        forn?.razao_social ||
        prestadorNomeManual ||
        'Fornecedor não selecionado'
      const doc =
        forn?.cnpj_cpf || forn?.cpf ? `${isPF ? 'CPF' : 'CNPJ'} ${forn?.cnpj_cpf || forn?.cpf}` : ''
      return {
        nome,
        documento: doc,
        tipoRotulo: isPF ? 'Fornecedor Pessoa Física (PF)' : 'Fornecedor Pessoa Jurídica (PJ)',
        emailOuContato:
          forn?.email || forn?.telefone || (forn?.chave_pix ? `PIX: ${forn.chave_pix}` : ''),
      }
    }
    if (prestadorTipo === 'terceiro_usuario') {
      const terc = usuariosTerceiros.find((u) => u.id === prestadorUsuarioId)
      return {
        nome: terc?.name || prestadorNomeManual || 'Prestador Terceiro não selecionado',
        documento: terc?.email || '',
        tipoRotulo: 'Prestador Terceiro (Acesso Portal)',
        emailOuContato: terc?.email || '',
      }
    }
    return {
      nome: prestadorNomeManual || 'Prestador Externo',
      documento: '',
      tipoRotulo: 'Prestador / Outro',
      emailOuContato: '',
    }
  }, [
    prestadorTipo,
    colaboradorId,
    fornecedorId,
    prestadorUsuarioId,
    prestadorNomeManual,
    colaboradores,
    fornecedores,
    usuariosTerceiros,
  ])

  // Tipo de serviço final resolvido
  const tipoServicoFinal = useMemo(() => {
    if (tipoServicoSelecionado === '__outro__') {
      return tipoServicoOutro.trim()
    }
    return tipoServicoSelecionado.trim()
  }, [tipoServicoSelecionado, tipoServicoOutro])

  const numeroOSPreview = useMemo(() => {
    if (editingOS) {
      return editingOS.titulo || `OS-${editingOS.id.slice(0, 6).toUpperCase()}`
    }
    const ano = new Date().getFullYear()
    return `OS-${presetProjetoNumero || `${ano}-001`}`
  }, [editingOS, presetProjetoNumero])

  // Salvar tipo customizado para persistência e reaproveitamento futuro
  function salvarTipoServicoCustom(novoTipo: string) {
    const normalizado = novoTipo.trim()
    if (!normalizado || TIPOS_SERVICO_ORDEM_SERVICO_PADRAO.includes(normalizado)) return
    if (!customServicos.includes(normalizado)) {
      const atualizados = [...customServicos, normalizado]
      setCustomServicos(atualizados)
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM_SERVICOS, JSON.stringify(atualizados))
      } catch {
        /* ignore */
      }
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!tipoServicoFinal) {
      toast.error('Informe ou selecione o Tipo de Serviço da Ordem de Serviço.')
      return
    }

    if (prestadorTipo === 'colaborador' && !colaboradorId && !prestadorNomeManual) {
      toast.error('Selecione o Colaborador para atribuir a OS.')
      return
    }
    if (prestadorTipo === 'fornecedor' && !fornecedorId && !prestadorNomeManual) {
      toast.error('Selecione o Fornecedor (PF/PJ) para atribuir a OS.')
      return
    }

    setSaving(true)
    try {
      const valorNum = valor !== '' ? Number(valor) : 0

      // Se utilizou tipo novo, persistir no localStorage
      if (tipoServicoSelecionado === '__outro__' && tipoServicoOutro.trim()) {
        salvarTipoServicoCustom(tipoServicoOutro.trim())
      }

      const payload: Partial<OrdemServicoRecord> = {
        projeto: presetProjetoId,
        titulo: numeroOSPreview,
        descricao: observacoes.trim() || tipoServicoFinal,
        tipo_servico: tipoServicoFinal,
        tipo_servico_outro:
          tipoServicoSelecionado === '__outro__' ? tipoServicoOutro.trim() : undefined,
        prestador_tipo: prestadorTipo,
        colaborador: prestadorTipo === 'colaborador' ? colaboradorId || undefined : undefined,
        fornecedor: prestadorTipo === 'fornecedor' ? fornecedorId || undefined : undefined,
        prestador_usuario:
          prestadorTipo === 'terceiro_usuario' ? prestadorUsuarioId || undefined : undefined,
        prestador: dadosPrestador.nome,
        valor: valorNum,
        valor_interno: valorNum,
        forma_pagamento: formaPagamento.trim(),
        prazo_execucao: prazoExecucao.trim(),
        prazo: prazoExecucao ? prazoExecucao : undefined,
        observacoes: observacoes.trim(),
        status,
      }

      if (editingOS) {
        await pb.collection('ordens_servico').update(editingOS.id, payload)
        // Auditoria
        try {
          await pb.collection('atividades').create({
            usuario: user?.id,
            tipo: 'alteracao_os',
            texto: `Atualizou a Ordem de Serviço ${numeroOSPreview} para ${dadosPrestador.nome}`,
            data_hora: new Date().toISOString(),
          })
        } catch {
          /* ignore */
        }
        toast.success('Ordem de Serviço atualizada com sucesso!')
      } else {
        await pb.collection('ordens_servico').create(payload)
        // Auditoria
        try {
          await pb.collection('atividades').create({
            usuario: user?.id,
            tipo: 'criacao_os',
            texto: `Criou a Ordem de Serviço ${numeroOSPreview} para ${dadosPrestador.nome} no projeto ${presetProjetoNumero || ''}`,
            data_hora: new Date().toISOString(),
          })
        } catch {
          /* ignore */
        }
        toast.success('Ordem de Serviço criada e designada com sucesso!')
      }

      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao salvar Ordem de Serviço: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  function handleImprimirA4() {
    imprimirElementoA4({
      elementId: 'print-ordem-servico-a4',
      titulo: `Ordem de Serviço ${numeroOSPreview} - AEROCAD`,
      orientacao: 'portrait',
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6A13] text-white">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-neutral-900">
                    {editingOS
                      ? 'Editar Ordem de Serviço Interna'
                      : 'Nova Ordem de Serviço Interna'}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {presetProjetoNumero
                      ? `Projeto nº ${presetProjetoNumero} · ${presetProjetoNome || ''}`
                      : 'Atribua o serviço técnico a um colaborador ou fornecedor (PF/PJ).'}
                  </DialogDescription>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewA4Open(true)}
                className="text-xs border-[#FF6A13] text-[#FF6A13] hover:bg-[#FFF6EC]"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Pré-visualizar A4
              </Button>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
            {/* Bloco 1: Atribuição do Prestador */}
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-[#FF6A13]" />
                  1. Atribuição do Prestador do Serviço
                </Label>
                <span className="text-[11px] text-neutral-500 font-medium">
                  Colaborador Interno ou Fornecedor (PF / PJ)
                </span>
              </div>

              {/* Seletor de Tipo de Prestador */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPrestadorTipo('fornecedor')}
                  className={`flex items-center justify-center gap-1.5 rounded-md border p-2 text-xs font-semibold transition ${
                    prestadorTipo === 'fornecedor'
                      ? 'border-[#FF6A13] bg-[#FF6A13] text-white shadow-xs'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Fornecedor (PF/PJ)
                </button>
                <button
                  type="button"
                  onClick={() => setPrestadorTipo('colaborador')}
                  className={`flex items-center justify-center gap-1.5 rounded-md border p-2 text-xs font-semibold transition ${
                    prestadorTipo === 'colaborador'
                      ? 'border-[#FF6A13] bg-[#FF6A13] text-white shadow-xs'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Colaborador
                </button>
                <button
                  type="button"
                  onClick={() => setPrestadorTipo('terceiro_usuario')}
                  className={`flex items-center justify-center gap-1.5 rounded-md border p-2 text-xs font-semibold transition ${
                    prestadorTipo === 'terceiro_usuario'
                      ? 'border-[#FF6A13] bg-[#FF6A13] text-white shadow-xs'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Portal Terceiro
                </button>
                <button
                  type="button"
                  onClick={() => setPrestadorTipo('outro')}
                  className={`flex items-center justify-center gap-1.5 rounded-md border p-2 text-xs font-semibold transition ${
                    prestadorTipo === 'outro'
                      ? 'border-[#FF6A13] bg-[#FF6A13] text-white shadow-xs'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Avulso / Manual
                </button>
              </div>

              {/* Campo específico dependendo da seleção */}
              {prestadorTipo === 'fornecedor' && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-neutral-800">
                    Selecionar Fornecedor Cadastrado (Pessoa Física ou Jurídica) *
                  </Label>
                  <Select
                    value={fornecedorId}
                    onValueChange={(val) => {
                      setFornecedorId(val)
                      const f = fornecedores.find((item) => item.id === val)
                      if (f) setPrestadorNomeManual(f.nome_completo || f.razao_social)
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white">
                      <SelectValue
                        placeholder={
                          loadingPrestadores
                            ? 'Carregando fornecedores...'
                            : fornecedores.length === 0
                              ? 'Nenhum fornecedor cadastrado'
                              : 'Selecione um fornecedor PF ou PJ...'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores.map((f) => {
                        const isPF =
                          f.tipo_pessoa === 'pf' ||
                          (f.cnpj_cpf && f.cnpj_cpf.replace(/\D/g, '').length === 11)
                        const nome = f.nome_completo || f.razao_social
                        return (
                          <SelectItem key={f.id} value={f.id}>
                            <span className="font-semibold">{nome}</span>{' '}
                            <span className="text-[10px] text-neutral-500 font-mono">
                              ({isPF ? 'PF' : 'PJ'} · {f.cnpj_cpf || f.cpf})
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {prestadorTipo === 'colaborador' && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-neutral-800">
                    Selecionar Colaborador da Equipe AEROCAD *
                  </Label>
                  <Select
                    value={colaboradorId}
                    onValueChange={(val) => {
                      setColaboradorId(val)
                      const c = colaboradores.find((item) => item.id === val)
                      if (c) setPrestadorNomeManual(c.nome_completo)
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white">
                      <SelectValue
                        placeholder={
                          loadingPrestadores
                            ? 'Carregando equipe...'
                            : colaboradores.length === 0
                              ? 'Nenhum colaborador cadastrado'
                              : 'Selecione um colaborador...'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {colaboradores.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-semibold">{c.nome_completo}</span>
                          {c.cargo && (
                            <span className="text-[10px] text-neutral-500 ml-1.5">— {c.cargo}</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {prestadorTipo === 'terceiro_usuario' && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-neutral-800">
                    Usuário com Acesso ao Portal de Terceiros *
                  </Label>
                  <Select
                    value={prestadorUsuarioId}
                    onValueChange={(val) => {
                      setPrestadorUsuarioId(val)
                      const u = usuariosTerceiros.find((item) => item.id === val)
                      if (u) setPrestadorNomeManual(u.name)
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white">
                      <SelectValue
                        placeholder={
                          loadingPrestadores
                            ? 'Carregando usuários...'
                            : usuariosTerceiros.length === 0
                              ? 'Nenhum usuário com perfil de terceiro'
                              : 'Selecione o usuário...'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {usuariosTerceiros.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {prestadorTipo === 'outro' && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-neutral-800">
                    Nome Completo / Razão Social do Prestador *
                  </Label>
                  <Input
                    required
                    value={prestadorNomeManual}
                    onChange={(e) => setPrestadorNomeManual(e.target.value)}
                    placeholder="Nome do prestador ou empresa"
                    className="h-9 text-xs bg-white"
                  />
                </div>
              )}

              {/* Resumo do prestador selecionado */}
              {dadosPrestador.nome &&
                dadosPrestador.nome !== 'Colaborador não selecionado' &&
                dadosPrestador.nome !== 'Fornecedor não selecionado' && (
                  <div className="text-[11px] bg-white rounded border border-neutral-200 p-2 text-neutral-700 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-neutral-900">{dadosPrestador.nome}</span>
                      {dadosPrestador.documento && (
                        <span className="text-neutral-500 ml-2 font-mono">
                          ({dadosPrestador.documento})
                        </span>
                      )}
                    </div>
                    <span className="rounded bg-orange-100 text-[#D65100] px-2 py-0.5 text-[10px] font-bold">
                      {dadosPrestador.tipoRotulo}
                    </span>
                  </div>
                )}
            </div>

            {/* Bloco 2: Tipo de Serviço */}
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-3.5 space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                <FileCheck2 className="h-4 w-4 text-[#FF6A13]" />
                2. Tipo de Serviço Prestado pela AEROCAD
              </Label>

              <div className="space-y-2">
                <Select
                  value={tipoServicoSelecionado}
                  onValueChange={(val) => setTipoServicoSelecionado(val)}
                >
                  <SelectTrigger className="h-9 text-xs bg-white text-left font-medium">
                    <SelectValue placeholder="Selecione um tipo de serviço da AEROCAD..." />
                  </SelectTrigger>
                  <SelectContent className="max-w-2xl">
                    <div className="px-2 py-1 text-[10px] font-bold text-neutral-400 uppercase">
                      Serviços Padrão AEROCAD
                    </div>
                    {TIPOS_SERVICO_ORDEM_SERVICO_PADRAO.map((item, idx) => (
                      <SelectItem key={`padrao-${idx}`} value={item} className="text-xs py-2">
                        <span className="font-semibold text-neutral-900">{idx + 1}.</span> {item}
                      </SelectItem>
                    ))}

                    {customServicos.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-bold text-[#D65100] uppercase border-t mt-1">
                          Outros Tipos Salvos Anteriormente
                        </div>
                        {customServicos.map((item, idx) => (
                          <SelectItem key={`custom-${idx}`} value={item} className="text-xs py-1.5">
                            {item}
                          </SelectItem>
                        ))}
                      </>
                    )}

                    <SelectItem
                      value="__outro__"
                      className="text-xs py-2 text-[#FF6A13] font-bold border-t mt-1"
                    >
                      + Outro tipo de serviço não elencado (digitar novo...)
                    </SelectItem>
                  </SelectContent>
                </Select>

                {tipoServicoSelecionado === '__outro__' && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs font-semibold text-[#D65100]">
                      Especifique o novo Tipo de Serviço (será salvo para futuras OS):
                    </Label>
                    <Input
                      required
                      value={tipoServicoOutro}
                      onChange={(e) => setTipoServicoOutro(e.target.value)}
                      placeholder="Digite o tipo de serviço técnico a ser prestado..."
                      className="h-9 text-xs bg-white border-orange-300"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bloco 3: Condições Comerciais, Financeiras e Prazos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Valor do Serviço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Prazo de Execução (Interno)</Label>
                <Input
                  value={prazoExecucao}
                  onChange={(e) => setPrazoExecucao(e.target.value)}
                  placeholder="Ex: 15 dias corridos ou 20/04/2026"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Status da OS</Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val as OrdemServicoStatus)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atribuida">Aberta / Atribuída</SelectItem>
                    <SelectItem value="em_execucao">Em Execução</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="recusada">Recusada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-3 space-y-1">
                <Label className="text-xs font-semibold">Forma de Pagamento</Label>
                <Input
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  placeholder="Ex: PIX / TED em até 5 dias úteis após validação técnica e NFS-e"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Bloco 4: Observações Livres */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Observações e Informações Adicionais</Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes técnicos, orientações de entrega, links de arquivos, requisitos da norma etc."
                className="text-xs"
              />
            </div>

            {/* Bloco 5: Cláusulas Obrigatórias Verbatim */}
            <div className="rounded-lg border border-orange-200 bg-[#FFF8F2] p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#D65100]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                CLÁUSULAS CONTRATUAIS OBRIGATÓRIAS (CONSTAM NA OS E NA VERSÃO A4)
              </div>
              <ul className="space-y-1.5 text-[11px] text-neutral-800 pl-4 list-disc">
                {CLAUSULAS_OBRIGATORIAS_ORDEM_SERVICO.map((clausula, idx) => (
                  <li key={idx} className="leading-relaxed">
                    "{clausula}"
                  </li>
                ))}
              </ul>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Salvar Ordem de Serviço
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Pré-visualização e Impressão A4 Oficial da OS */}
      <Dialog open={previewA4Open} onOpenChange={setPreviewA4Open}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-20 bg-neutral-900 text-white px-5 py-3 flex items-center justify-between shadow-md print:hidden">
            <div>
              <p className="text-[10px] uppercase font-bold text-[#FF6A13] tracking-widest">
                PREVIEW A4 · ORDEM DE SERVIÇO INTERNA
              </p>
              <h3 className="text-sm font-bold text-white truncate">
                {numeroOSPreview} — {presetProjetoNumero || 'AEROCAD'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleImprimirA4}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold text-xs h-8"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Imprimir / Salvar PDF (A4)
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-6 bg-neutral-100 flex justify-center">
            <div className="bg-white shadow-lg border border-neutral-300 w-full max-w-[210mm]">
              {/* Documento Imprimível A4 */}
              <div
                id="print-ordem-servico-a4"
                className="bg-white text-[#2D2D2D] p-8 print:p-0 min-h-[297mm] flex flex-col justify-between text-xs"
                style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
              >
                <div>
                  {/* Cabeçalho Oficial AEROCAD com Logo */}
                  <header className="border-b-2 border-[#FF6A13] pb-4 mb-6 aerocad-doc-header">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="aerocad-logo-header-wrapper shrink-0">
                          <AerocadLogo
                            className="h-9 w-auto max-w-[190px] object-contain block"
                            style={{
                              maxHeight: '38px',
                              maxWidth: '190px',
                              width: 'auto',
                              height: '38px',
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold tracking-[0.2em] text-[#FF6A13] uppercase">
                            Engenharia & Consultoria Aeroportuária
                          </p>
                          <h1 className="text-base sm:text-lg font-black text-[#2D2D2D] tracking-tight uppercase leading-tight">
                            ORDEM DE SERVIÇO INTERNA
                          </h1>
                        </div>
                      </div>

                      <div className="text-right font-mono text-[10px] text-neutral-500 space-y-0.5">
                        <div>
                          OS Nº: <strong className="text-neutral-800">{numeroOSPreview}</strong>
                        </div>
                        <div>Emissão: {new Date().toLocaleDateString('pt-BR')}</div>
                        <div>Status: {status.toUpperCase()}</div>
                      </div>
                    </div>
                  </header>

                  {/* 1. DADOS DE CONTROLE DO PROJETO */}
                  <div className="space-y-2 mb-5">
                    <div className="border-l-4 border-[#FF6A13] pl-2.5 py-0.5">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                        1. DADOS DE CONTROLE DO PROJETO & TOMADOR
                      </h2>
                    </div>

                    <table className="w-full text-left text-[11px] border border-neutral-300 border-collapse">
                      <tbody>
                        <tr className="border-b border-neutral-200">
                          <th className="bg-neutral-50 px-3 py-2 w-1/4 font-bold text-neutral-700">
                            Projeto AEROCAD
                          </th>
                          <td className="px-3 py-2 font-bold text-[#FF6A13]">
                            {presetProjetoNumero || 'AAAA-NNN'} —{' '}
                            {presetProjetoNome || 'Projeto Técnico'}
                          </td>
                        </tr>
                        <tr className="border-b border-neutral-200">
                          <th className="bg-neutral-50 px-3 py-2 font-bold text-neutral-700">
                            Tomador / Contratante
                          </th>
                          <td className="px-3 py-2">
                            {INSTITUTIONAL_DATA.razaoSocial} (CNPJ {INSTITUTIONAL_DATA.cnpj})
                          </td>
                        </tr>
                        {presetClienteRazaoSocial && (
                          <tr className="border-b border-neutral-200">
                            <th className="bg-neutral-50 px-3 py-2 font-bold text-neutral-700">
                              Cliente do Projeto
                            </th>
                            <td className="px-3 py-2">
                              {presetClienteRazaoSocial}{' '}
                              {presetClienteCnpj ? `(${presetClienteCnpj})` : ''}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <th className="bg-neutral-50 px-3 py-2 font-bold text-neutral-700">
                            Data de Atribuição
                          </th>
                          <td className="px-3 py-2">{new Date().toLocaleDateString('pt-BR')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 2. DADOS DO PRESTADOR DESIGNADO */}
                  <div className="space-y-2 mb-5">
                    <div className="border-l-4 border-[#FF6A13] pl-2.5 py-0.5">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                        2. PRESTADOR DESIGNADO & CONDIÇÕES CONTRATUAIS
                      </h2>
                    </div>

                    <table className="w-full text-left text-[11px] border border-neutral-300 border-collapse">
                      <tbody>
                        <tr className="border-b border-neutral-200">
                          <th className="bg-neutral-50 px-3 py-2 w-1/4 font-bold text-neutral-700">
                            Prestador do Serviço
                          </th>
                          <td className="px-3 py-2 font-bold text-neutral-900">
                            {dadosPrestador.nome}
                          </td>
                        </tr>
                        {dadosPrestador.documento && (
                          <tr className="border-b border-neutral-200">
                            <th className="bg-neutral-50 px-3 py-2 font-bold text-neutral-700">
                              Documento Fiscal / Cadastro
                            </th>
                            <td className="px-3 py-2 font-mono">{dadosPrestador.documento}</td>
                          </tr>
                        )}
                        <tr className="border-b border-neutral-200">
                          <th className="bg-neutral-50 px-3 py-2 font-bold text-neutral-700">
                            Vínculo / Categoria
                          </th>
                          <td className="px-3 py-2">{dadosPrestador.tipoRotulo}</td>
                        </tr>
                        <tr className="border-b border-neutral-200">
                          <th className="bg-neutral-50 px-3 py-2 font-bold text-neutral-700">
                            Valor do Serviço (R$)
                          </th>
                          <td className="px-3 py-2 font-bold font-mono text-[#FF6A13]">
                            {valor !== '' && Number(valor) > 0
                              ? formatCurrency(Number(valor))
                              : 'Conforme proposta / Não informado'}
                          </td>
                        </tr>
                        <tr className="border-b border-neutral-200">
                          <th className="bg-neutral-50 px-3 py-2 font-bold text-neutral-700">
                            Forma de Pagamento
                          </th>
                          <td className="px-3 py-2">{formaPagamento || 'A combinar'}</td>
                        </tr>
                        <tr>
                          <th className="bg-neutral-50 px-3 py-2 font-bold text-neutral-700">
                            Prazo de Execução (Interno)
                          </th>
                          <td className="px-3 py-2 font-semibold">
                            {prazoExecucao || 'Imediato / Conforme cronograma'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 3. TIPO DE SERVIÇO & ESCOPO */}
                  <div className="space-y-2 mb-5">
                    <div className="border-l-4 border-[#FF6A13] pl-2.5 py-0.5">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                        3. ESCOPO DO SERVIÇO TÉCNICO
                      </h2>
                    </div>

                    <div className="border border-neutral-300 rounded p-3 bg-neutral-50/50 text-[11px] leading-relaxed">
                      <p className="font-bold text-neutral-900 mb-1">{tipoServicoFinal}</p>
                      {observacoes && (
                        <div className="mt-2 text-neutral-700 whitespace-pre-wrap border-t border-neutral-200 pt-2 text-[10.5px]">
                          <strong>Detalhamento / Observações:</strong> {observacoes}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. CLÁUSULAS CONTRATUAIS OBRIGATÓRIAS */}
                  <div className="space-y-2 mb-6">
                    <div className="border-l-4 border-[#FF6A13] pl-2.5 py-0.5">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                        4. CLÁUSULAS OBRIGATÓRIAS E CONDIÇÕES DE PRESTAÇÃO
                      </h2>
                    </div>

                    <div className="border border-amber-300 bg-[#FFF9F4] rounded p-3 text-[10.5px] leading-relaxed space-y-2">
                      <p className="text-neutral-800">
                        <strong>Cláusula 1ª (Comprovação Fiscal):</strong> "O prestador será pago
                        mediante a apresentação da nota fiscal emitida em favor do tomador (
                        {INSTITUTIONAL_DATA.razaoSocial})."
                      </p>
                      <p className="text-neutral-800">
                        <strong>Cláusula 2ª (Inexistência de Vínculo):</strong> "Os serviços serão
                        ou são prestados de maneira eventual, mediante demanda, e a execução deles
                        por tempo determinado não caracteriza, sob nenhuma hipótese, vínculo
                        empregatício com a AEROCAD."
                      </p>
                    </div>
                  </div>

                  {/* Bloco de Assinaturas */}
                  <div className="pt-8 page-break-inside-avoid">
                    <p className="text-center text-[10px] text-neutral-500 mb-6">
                      Brasília – DF, {new Date().toLocaleDateString('pt-BR')}
                    </p>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="border-t border-neutral-400 pt-2 text-center text-[10px]">
                        <strong className="block text-neutral-900">
                          {INSTITUTIONAL_DATA.razaoSocial}
                        </strong>
                        <span className="text-neutral-500">Tomador dos Serviços</span>
                        <div className="text-[9px] text-neutral-400 font-mono">
                          CNPJ: {INSTITUTIONAL_DATA.cnpj}
                        </div>
                      </div>
                      <div className="border-t border-neutral-400 pt-2 text-center text-[10px]">
                        <strong className="block text-neutral-900">{dadosPrestador.nome}</strong>
                        <span className="text-neutral-500">
                          Prestador Designado ({dadosPrestador.tipoRotulo})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rodapé Oficial da Prancheta AEROCAD */}
                <footer className="border-t border-neutral-300 pt-3 mt-8">
                  <div className="flex items-center justify-between text-[9px] text-neutral-500 font-mono">
                    <div>
                      {INSTITUTIONAL_DATA.nomeComercial} · {INSTITUTIONAL_DATA.razaoSocial} · CNPJ{' '}
                      {INSTITUTIONAL_DATA.cnpj}
                    </div>
                    <div>Ordem de Serviço Emitida via CRM AEROCAD</div>
                  </div>
                  <div className="text-[8px] text-neutral-400 font-mono mt-0.5">
                    {INSTITUTIONAL_DATA.endereco} · CHAVE PIX (CNPJ): {INSTITUTIONAL_DATA.chavePix}
                  </div>
                </footer>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
