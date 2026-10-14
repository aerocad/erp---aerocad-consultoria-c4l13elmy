import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Compass, Briefcase, PlusCircle, Users } from 'lucide-react'
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { toInputDate } from '@/lib/format'
import { createOne, listAll, updateOne } from '@/services/api'
import type {
  ClienteRecord,
  ColaboradorRecord,
  OportunidadeRecord,
  ServiceRecord,
  UserRecord,
} from '@/types/crm'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  oportunidade?: OportunidadeRecord | null
  presetClient?: string
  onSaved: (record: OportunidadeRecord) => void
}

const TRILHAS_PADRAO: Array<{ id: string; label: string; base: 'opea' | 'registro' | 'demais' }> = [
  { id: 'opea', label: 'OPEA (Processo Aeroportuário / Obstáculos)', base: 'opea' },
  { id: 'registro', label: 'Registro de aeródromo / heliponto', base: 'registro' },
  { id: 'demais', label: 'Demais projetos aeronáuticos', base: 'demais' },
]

export function OportunidadeDialog({
  open,
  onOpenChange,
  oportunidade,
  presetClient,
  onSaved,
}: Props) {
  const { user } = useAuth()
  const [clients, setClients] = useState<ClienteRecord[]>([])
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [colaboradores, setColaboradores] = useState<ColaboradorRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Modos customizados "Outro / Criar..."
  const [modoServicoCustomizado, setModoServicoCustomizado] = useState(false)
  const [novoServicoNome, setNovoServicoNome] = useState('')

  const [modoTrilhaCustomizada, setModoTrilhaCustomizada] = useState(false)
  const [novaTrilhaNome, setNovaTrilhaNome] = useState('')

  const [form, setForm] = useState({
    cliente: '',
    titulo: '',
    tipo_servico: '',
    servico_nome: '',
    etapa: 'lead',
    valor_estimado: '',
    probabilidade: '30',
    data_prevista_fechamento: '',
    responsavel: '',
    responsavel_colaborador: '',
    trilha_prevista: 'opea',
    trilha_prevista_nome: '',
    observacoes: '',
    origem_canal: 'outro' as 'whatsapp' | 'site' | 'indicacao' | 'email' | 'outro',
  })

  useEffect(() => {
    if (open)
      void Promise.all([
        listAll<ClienteRecord>('clientes', { sort: 'razao_social' }),
        listAll<ServiceRecord>('servicos_catalogo', { filter: 'ativo = true', sort: 'nome' }),
        listAll<ColaboradorRecord>('colaboradores', { sort: 'nome_completo' }),
        listAll<UserRecord>('users', { sort: 'name' }),
      ])
        .then(([c, s, colabs, u]) => {
          setClients(c)
          setServices(s)
          setColaboradores(colabs)
          setUsers(u)
        })
        .catch(() => {})
  }, [open])

  useEffect(() => {
    if (oportunidade) {
      const isKnownService = services.some((s) => s.id === oportunidade.tipo_servico)
      const hasCustomServiceName = Boolean(oportunidade.servico_nome)
      const shouldOpenCustomService =
        !isKnownService && (hasCustomServiceName || !oportunidade.tipo_servico)

      const isStandardTrail = TRILHAS_PADRAO.some((t) => t.id === oportunidade.trilha_prevista)
      const hasCustomTrailName = Boolean(oportunidade.trilha_prevista_nome)

      setModoServicoCustomizado(shouldOpenCustomService && Boolean(oportunidade.servico_nome))
      setNovoServicoNome(oportunidade.servico_nome || '')

      setModoTrilhaCustomizada(!isStandardTrail || hasCustomTrailName)
      setNovaTrilhaNome(
        oportunidade.trilha_prevista_nome ||
          (isStandardTrail ? '' : oportunidade.trilha_prevista || ''),
      )

      setForm({
        cliente: oportunidade.cliente,
        titulo: oportunidade.titulo,
        tipo_servico: oportunidade.tipo_servico || '',
        servico_nome: oportunidade.servico_nome || '',
        etapa: oportunidade.etapa,
        valor_estimado: String(oportunidade.valor_estimado || ''),
        probabilidade: String(oportunidade.probabilidade || 0),
        data_prevista_fechamento: toInputDate(oportunidade.data_prevista_fechamento),
        responsavel: oportunidade.responsavel || '',
        responsavel_colaborador: oportunidade.responsavel_colaborador || '',
        trilha_prevista: oportunidade.trilha_prevista || 'opea',
        trilha_prevista_nome: oportunidade.trilha_prevista_nome || '',
        observacoes: oportunidade.observacoes || '',
        origem_canal: oportunidade.origem_canal || 'outro',
      })
    } else {
      // Pré-selecionar colaborador logado ou primeiro disponível
      const colabUsuario = colaboradores.find((c) => c.usuario_sistema === user?.id)
      const primeiroColab = colabUsuario?.id || (colaboradores[0]?.id ?? '')

      setModoServicoCustomizado(false)
      setNovoServicoNome('')
      setModoTrilhaCustomizada(false)
      setNovaTrilhaNome('')

      setForm({
        cliente: presetClient || '',
        titulo: '',
        tipo_servico: '',
        servico_nome: '',
        etapa: 'lead',
        valor_estimado: '',
        probabilidade: '30',
        data_prevista_fechamento: '',
        responsavel: user?.id || '',
        responsavel_colaborador: primeiroColab,
        trilha_prevista: 'opea',
        trilha_prevista_nome: '',
        observacoes: '',
        origem_canal: 'outro',
      })
    }
  }, [oportunidade, open, presetClient, user?.id, services, colaboradores])

  // Colaboradores de /pessoal disponíveis como responsáveis
  const colaboradoresResponsaveis = useMemo(() => {
    return [...colaboradores].sort((a, b) => {
      if (a.situacao === 'ativo' && b.situacao !== 'ativo') return -1
      if (a.situacao !== 'ativo' && b.situacao === 'ativo') return 1
      return a.nome_completo.localeCompare(b.nome_completo, 'pt-BR')
    })
  }, [colaboradores])

  function chooseService(id: string) {
    if (id === '__custom__') {
      setModoServicoCustomizado(true)
      return
    }
    const service = services.find((item) => item.id === id)
    setForm((value) => ({
      ...value,
      tipo_servico: id,
      servico_nome: service?.nome || '',
      valor_estimado: service
        ? String(service.preco_padrao || service.faixa_min)
        : value.valor_estimado,
      titulo: value.titulo || service?.nome || '',
      trilha_prevista:
        service?.codigo === 'OPEA'
          ? 'opea'
          : service?.codigo.startsWith('REG') ||
              service?.codigo.startsWith('HEL') ||
              service?.codigo.startsWith('AER')
            ? 'registro'
            : value.trilha_prevista,
    }))
  }

  function handleSelectResponsavelColaborador(colabId: string) {
    const colab = colaboradores.find((c) => c.id === colabId)
    // Se o colaborador tiver um usuario_sistema associado, usa-o para preencher o responsavel legado
    // Caso contrário, mantém o usuario do sistema ou o usuário atual para compatibilidade
    let userId = colab?.usuario_sistema || form.responsavel
    if (!userId && user?.id) {
      userId = user.id
    }
    setForm((v) => ({
      ...v,
      responsavel_colaborador: colabId,
      responsavel: userId,
    }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.cliente || !form.titulo.trim()) return setError('Cliente e título são obrigatórios.')
    setSaving(true)
    setError('')
    try {
      let finalTipoServicoId = form.tipo_servico
      let finalServicoNome = form.servico_nome

      // Se o usuário estiver criando/digitando um serviço novo que não existe no catálogo
      if (modoServicoCustomizado && novoServicoNome.trim()) {
        finalServicoNome = novoServicoNome.trim()
        // Verificar se já existe um serviço no catálogo com exatamente esse nome
        const existing = services.find(
          (s) => s.nome.toLowerCase().trim() === finalServicoNome.toLowerCase(),
        )
        if (existing) {
          finalTipoServicoId = existing.id
        } else {
          // Cadastrar o novo serviço no catálogo (servicos_catalogo) para ficar imediatamente disponível
          try {
            // Gerar código mnemônico seguro e único (ex: CORREL-...)
            const prefix =
              finalServicoNome
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^A-Za-z0-9]/g, '')
                .toUpperCase()
                .slice(0, 8) || 'SERV'
            const uniqueCode = `${prefix}-${Date.now().toString().slice(-4)}`

            const createdService = await createOne<ServiceRecord>('servicos_catalogo', {
              codigo: uniqueCode,
              nome: finalServicoNome,
              descricao: `<p>Serviço correlato cadastrado comercialmente: ${finalServicoNome}</p>`,
              prazo_tipico: 'Conforme demanda',
              preco_padrao: Number(form.valor_estimado || 0),
              faixa_min: Number(form.valor_estimado || 0),
              faixa_max: Number(form.valor_estimado || 0),
              ativo: true,
            })
            finalTipoServicoId = createdService.id
            setServices((prev) => [...prev, createdService])
            toast.success(`Novo serviço "${finalServicoNome}" incluído no catálogo!`)
          } catch (svcErr) {
            console.warn('Não foi possível salvar novo serviço no catálogo:', svcErr)
            // Se falhar o catálogo, prossegue salvando pelo menos o nome livre
          }
        }
      }

      // Trilha prevista customizada vs padrão
      let finalTrilhaPrevista: 'opea' | 'registro' | 'demais' = 'opea'
      let finalTrilhaNome = ''

      if (modoTrilhaCustomizada && novaTrilhaNome.trim()) {
        finalTrilhaNome = novaTrilhaNome.trim()
        const lower = finalTrilhaNome.toLowerCase()
        if (lower.includes('opea')) finalTrilhaPrevista = 'opea'
        else if (
          lower.includes('registro') ||
          lower.includes('heliponto') ||
          lower.includes('aerodromo')
        )
          finalTrilhaPrevista = 'registro'
        else finalTrilhaPrevista = 'demais'
      } else {
        const standard = TRILHAS_PADRAO.find((t) => t.id === form.trilha_prevista)
        finalTrilhaPrevista = (standard?.base || 'opea') as 'opea' | 'registro' | 'demais'
        finalTrilhaNome = standard?.label || ''
      }

      // Garantir responsável de /pessoal
      let finalColabId = form.responsavel_colaborador
      let finalUserId = form.responsavel

      if (!finalColabId && colaboradores.length > 0) {
        // Tenta achar pelo user
        const matchColab = colaboradores.find((c) => c.usuario_sistema === finalUserId)
        finalColabId = matchColab?.id || colaboradores[0].id
      }
      if (!finalUserId) {
        const selectedColab = colaboradores.find((c) => c.id === finalColabId)
        finalUserId = selectedColab?.usuario_sistema || user?.id || users[0]?.id || ''
      }

      const payload = {
        cliente: form.cliente,
        titulo: form.titulo.trim(),
        tipo_servico: finalTipoServicoId || null,
        servico_nome: finalServicoNome || '',
        etapa: form.etapa,
        valor_estimado: Number(form.valor_estimado || 0),
        probabilidade: Number(form.probabilidade || 0),
        data_prevista_fechamento: form.data_prevista_fechamento
          ? `${form.data_prevista_fechamento} 12:00:00.000Z`
          : '',
        responsavel: finalUserId,
        responsavel_colaborador: finalColabId || null,
        trilha_prevista: finalTrilhaPrevista,
        trilha_prevista_nome: finalTrilhaNome,
        observacoes: form.observacoes || '',
        origem_canal: form.origem_canal || 'outro',
      }

      const record = oportunidade
        ? await updateOne<OportunidadeRecord>('oportunidades', oportunidade.id, payload)
        : await createOne<OportunidadeRecord>('oportunidades', payload)
      toast.success(oportunidade ? 'Oportunidade atualizada' : 'Oportunidade criada')
      onSaved(record)
      onOpenChange(false)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar.')
      toast.error('Não foi possível salvar a oportunidade')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{oportunidade ? 'Editar oportunidade' : 'Nova oportunidade'}</DialogTitle>
          <DialogDescription>Cadastre a demanda comercial e a trilha prevista.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Cliente *</Label>
            <Select
              value={form.cliente}
              onValueChange={(cliente) => setForm((v) => ({ ...v, cliente }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Título *</Label>
            <Input
              value={form.titulo}
              onChange={(e) => setForm((v) => ({ ...v, titulo: e.target.value }))}
            />
          </div>
          {/* Campo Combinado de Tipo de Serviço (Lista existente OU Criar serviço livre) */}
          <div className="space-y-1.5 sm:col-span-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-[#FF6A13]" />
                <span>Tipo de Serviço *</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-[#D65100] hover:text-[#FF6A13] hover:bg-orange-50"
                onClick={() => {
                  const novoModo = !modoServicoCustomizado
                  setModoServicoCustomizado(novoModo)
                  if (!novoModo && !form.tipo_servico && services.length > 0) {
                    chooseService(services[0].id)
                  }
                }}
              >
                {modoServicoCustomizado ? 'Escolher da Lista' : '+ Outro / Criar serviço...'}
              </Button>
            </div>

            {!modoServicoCustomizado ? (
              <Select
                value={form.tipo_servico || '__empty__'}
                onValueChange={(val) => {
                  if (val === '__custom__') {
                    setModoServicoCustomizado(true)
                    return
                  }
                  if (val === '__empty__') {
                    setForm((v) => ({ ...v, tipo_servico: '', servico_nome: '' }))
                    return
                  }
                  chooseService(val)
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Selecione um serviço aeronáutico..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__empty__" className="text-neutral-400 italic">
                    -- Selecione o serviço do catálogo --
                  </SelectItem>
                  <SelectGroup>
                    <SelectLabel className="text-[11px] font-bold text-neutral-800 py-1 px-2 bg-neutral-50 border-b border-neutral-100">
                      Serviços Aeronáuticos & Consultoria
                    </SelectLabel>
                    {services.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="text-xs">
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="font-medium text-neutral-900">{item.nome}</span>
                          <span className="text-[10px] text-neutral-400 font-mono shrink-0">
                            [{item.codigo}]
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectItem
                      value="__custom__"
                      className="text-xs font-semibold text-[#D65100] bg-orange-50/70 hover:bg-orange-100 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <PlusCircle className="h-3.5 w-3.5 text-[#FF6A13]" />+ Outro / Criar serviço
                        livre...
                      </span>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2 p-2.5 rounded border border-orange-200 bg-orange-50/30">
                <Input
                  required
                  value={novoServicoNome}
                  onChange={(e) => {
                    const val = e.target.value
                    setNovoServicoNome(val)
                    setForm((v) => ({
                      ...v,
                      servico_nome: val,
                      titulo: v.titulo ? v.titulo : val,
                    }))
                  }}
                  placeholder="Digite o novo serviço correlato (ex: Plano Diretor PDIR, Levantamento LiDAR)"
                  className="h-8 text-xs bg-white"
                  autoFocus
                />
                <p className="text-[10px] text-neutral-500">
                  O novo serviço será registrado no catálogo e ficará disponível para futuras
                  seleções.
                </p>
              </div>
            )}
          </div>

          {/* Campo Combinado de Trilha (Lista existente OU Criar/definir trilha livre) */}
          <div className="space-y-1.5 sm:col-span-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-[#FF6A13]" />
                <span>Trilha da Oportunidade</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-[#D65100] hover:text-[#FF6A13] hover:bg-orange-50"
                onClick={() => setModoTrilhaCustomizada(!modoTrilhaCustomizada)}
              >
                {modoTrilhaCustomizada ? 'Escolher da Lista' : '+ Outra / Definir trilha...'}
              </Button>
            </div>

            {!modoTrilhaCustomizada ? (
              <Select
                value={form.trilha_prevista || 'opea'}
                onValueChange={(val) => {
                  if (val === '__custom__') {
                    setModoTrilhaCustomizada(true)
                    return
                  }
                  const standard = TRILHAS_PADRAO.find((t) => t.id === val)
                  setForm((v) => ({
                    ...v,
                    trilha_prevista: (standard?.base || 'opea') as 'opea' | 'registro' | 'demais',
                    trilha_prevista_nome: standard?.label || '',
                  }))
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-[11px] font-bold text-neutral-800 py-1 px-2 bg-neutral-50 border-b border-neutral-100">
                      Trilhas Padrão AEROCAD
                    </SelectLabel>
                    {TRILHAS_PADRAO.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectItem
                      value="__custom__"
                      className="text-xs font-semibold text-[#D65100] bg-orange-50/70 hover:bg-orange-100 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <PlusCircle className="h-3.5 w-3.5 text-[#FF6A13]" />+ Outra / Definir
                        trilha livre...
                      </span>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2 p-2.5 rounded border border-orange-200 bg-orange-50/30">
                <Input
                  required
                  value={novaTrilhaNome}
                  onChange={(e) => {
                    const val = e.target.value
                    setNovaTrilhaNome(val)
                    setForm((v) => ({ ...v, trilha_prevista_nome: val }))
                  }}
                  placeholder="Digite o nome da trilha (ex: Licenciamento Ambiental / IPHAN)"
                  className="h-8 text-xs bg-white"
                  autoFocus
                />
                <p className="text-[10px] text-neutral-500">
                  Trilha livre aplicada diretamente à oportunidade sem ficar presa à lista fixa.
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Valor estimado (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.valor_estimado}
              onChange={(e) => setForm((v) => ({ ...v, valor_estimado: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Probabilidade (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={form.probabilidade}
              onChange={(e) => setForm((v) => ({ ...v, probabilidade: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Etapa</Label>
            <Select value={form.etapa} onValueChange={(etapa) => setForm((v) => ({ ...v, etapa }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="qualificacao">Qualificação</SelectItem>
                <SelectItem value="proposta_enviada">Proposta enviada</SelectItem>
                <SelectItem value="negociacao">Negociação</SelectItem>
                <SelectItem value="ganho">Fechado (ganho)</SelectItem>
                <SelectItem value="perdido">Fechado (perdido)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Canal de Origem</Label>
            <Select
              value={form.origem_canal}
              onValueChange={(val) =>
                setForm((v) => ({
                  ...v,
                  origem_canal: val as 'whatsapp' | 'site' | 'indicacao' | 'email' | 'outro',
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="site">Site Institucional</SelectItem>
                <SelectItem value="indicacao">Indicação</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Previsão de fechamento</Label>
            <Input
              type="date"
              value={form.data_prevista_fechamento}
              onChange={(e) => setForm((v) => ({ ...v, data_prevista_fechamento: e.target.value }))}
            />
          </div>
          {/* Seletor de Responsável da Oportunidade: lista qualquer colaborador de /pessoal */}
          <div className="space-y-1.5 sm:col-span-1">
            <Label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#FF6A13]" />
              <span>Responsável da Oportunidade *</span>
            </Label>
            <Select
              value={
                form.responsavel_colaborador ||
                colaboradores.find((c) => c.usuario_sistema === form.responsavel)?.id ||
                '__empty__'
              }
              onValueChange={(colabId) => {
                if (colabId !== '__empty__') {
                  handleSelectResponsavelColaborador(colabId)
                }
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-white">
                <SelectValue placeholder="Selecione o colaborador responsável..." />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__empty__" className="text-neutral-400 italic">
                  -- Selecione um colaborador cadastrado em /pessoal --
                </SelectItem>
                <SelectGroup>
                  <SelectLabel className="text-[11px] font-bold text-neutral-800 py-1 px-2 bg-neutral-50 border-b border-neutral-100">
                    Colaboradores Cadastrados (/pessoal)
                  </SelectLabel>
                  {colaboradoresResponsaveis.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="font-medium text-neutral-900">{c.nome_completo}</span>
                        <span className="text-[10px] text-neutral-500 font-mono shrink-0">
                          {c.cargo ? `(${c.cargo})` : ''}{' '}
                          {c.situacao !== 'ativo' ? '• Inativo' : ''}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-neutral-500">
              Listando todos os colaboradores reais cadastrados no módulo de Pessoal.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm((v) => ({ ...v, observacoes: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#FF6A13] hover:bg-[#E85B06]">
              {saving ? 'Salvando...' : 'Salvar oportunidade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
