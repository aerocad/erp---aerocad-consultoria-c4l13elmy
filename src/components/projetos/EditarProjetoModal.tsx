import { useEffect, useState, type FormEvent } from 'react'
import { Check, Edit3, Loader2, AlertCircle, DollarSign } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { trailPhases } from '@/lib/crm'
import { formatCurrency, toInputDate } from '@/lib/format'
import { createOne, listAll, updateOne } from '@/services/api'
import type { ClienteRecord, ProjetoRecord, Trail, UserRecord } from '@/types/crm'

export interface EditarProjetoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projeto: ProjetoRecord | null
  initialTab?: 'geral' | 'financeiro' | 'tecnico' | 'prazos'
  onSuccess?: (projetoAtualizado: ProjetoRecord) => void
}

export function EditarProjetoModal({
  open,
  onOpenChange,
  projeto,
  initialTab = 'geral',
  onSuccess,
}: EditarProjetoModalProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'geral' | 'financeiro' | 'tecnico' | 'prazos'>(
    initialTab,
  )
  const [clients, setClients] = useState<ClienteRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Permissões
  // Admin: pode alterar tudo (incluindo valores, cliente, etc.)
  // Tecnico: pode alterar dados técnicos, status, fases, prazos, prioridade e nome
  // Financeiro: pode visualizar e editar dados de faturamento/valores (ou admin)
  const isAdmin = user?.role === 'admin'
  const isTecnico = user?.role === 'tecnico'
  const isFinanceiro = user?.role === 'financeiro'
  const canEditGeneral = isAdmin || isTecnico
  const canEditValues = isAdmin || isFinanceiro

  // Formulário
  const [formData, setFormData] = useState({
    nome: '',
    cliente: '',
    trilha: 'opea' as Trail,
    fase: '',
    status: 'ativo' as 'ativo' | 'suspenso' | 'concluido' | 'cancelado',
    prioridade: 'normal' as 'alta' | 'normal' | 'baixa',
    responsavel_tecnico: '',
    art: '',
    pasta_drive_url: '',
    data_inicio: '',
    prazo: '',
    data_proposta: '',
    data_aceite: '',
    prazo_dias: '0',
    percentual_concluido: '0',
    valor_global: '0',
    tipo_servico: '',
    escopo_resumido: '',
    municipio_uf: '',
    aerodromo: '',
    numero_pc_pt: '',
    marco_fase_atual: '',
    proxima_entrega: '',
    pendente_orgao: '',
    observacoes: '',
  })

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab)
      void Promise.all([
        listAll<ClienteRecord>('clientes', { sort: 'razao_social' }),
        listAll<UserRecord>('users', {
          filter: "role = 'tecnico' || role = 'admin'",
          sort: 'name',
        }),
      ])
        .then(([c, u]) => {
          setClients(c)
          setUsers(u)
        })
        .catch(() => {})
    }
  }, [open, initialTab])

  useEffect(() => {
    if (open && projeto) {
      setFormData({
        nome: projeto.nome || '',
        cliente: projeto.cliente || '',
        trilha: (projeto.trilha as Trail) || 'opea',
        fase: projeto.fase || (trailPhases[(projeto.trilha as Trail) || 'opea']?.[0] ?? ''),
        status: projeto.status || 'ativo',
        prioridade: (projeto.prioridade as 'alta' | 'normal' | 'baixa') || 'normal',
        responsavel_tecnico: projeto.responsavel_tecnico || '',
        art: projeto.art || '',
        pasta_drive_url: projeto.pasta_drive_url || '',
        data_inicio: toInputDate(projeto.data_inicio),
        prazo: toInputDate(projeto.prazo),
        data_proposta: toInputDate(projeto.data_proposta),
        data_aceite: toInputDate(projeto.data_aceite),
        prazo_dias: String(projeto.prazo_dias ?? 0),
        percentual_concluido: String(projeto.percentual_concluido ?? 0),
        valor_global: String(projeto.valor_global ?? 0),
        tipo_servico: projeto.tipo_servico || '',
        escopo_resumido: projeto.escopo_resumido || '',
        municipio_uf: projeto.municipio_uf || '',
        aerodromo: projeto.aerodromo || '',
        numero_pc_pt: projeto.numero_pc_pt || '',
        marco_fase_atual: projeto.marco_fase_atual || '',
        proxima_entrega: projeto.proxima_entrega || '',
        pendente_orgao: projeto.pendente_orgao || '',
        observacoes: projeto.observacoes || '',
      })
      setErro(null)
    }
  }, [open, projeto])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!projeto) return

    if (!canEditGeneral && !canEditValues) {
      setErro('Você não tem permissão para editar este projeto.')
      return
    }

    const nomeTrim = formData.nome.trim()
    if (!nomeTrim) {
      setErro('O nome do projeto é obrigatório.')
      return
    }
    if (!formData.cliente) {
      setErro('O cliente vinculado é obrigatório.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      const valorGlobalNum = parseFloat(formData.valor_global.replace(/\./g, '').replace(',', '.'))
      const sanitizedValor = isNaN(valorGlobalNum) ? 0 : Math.max(0, valorGlobalNum)

      // Monta payload respeitando regras de perfil
      const payload: Partial<ProjetoRecord> = {
        nome: nomeTrim,
        cliente: formData.cliente,
        trilha: formData.trilha,
        fase: formData.fase,
        status: formData.status,
        prioridade: formData.prioridade,
        responsavel_tecnico: formData.responsavel_tecnico || '',
        art: formData.art.trim(),
        pasta_drive_url: formData.pasta_drive_url.trim(),
        data_inicio: formData.data_inicio ? `${formData.data_inicio} 12:00:00.000Z` : '',
        prazo: formData.prazo ? `${formData.prazo} 12:00:00.000Z` : '',
        data_proposta: formData.data_proposta ? `${formData.data_proposta} 12:00:00.000Z` : '',
        data_aceite: formData.data_aceite ? `${formData.data_aceite} 12:00:00.000Z` : '',
        prazo_dias: parseInt(formData.prazo_dias, 10) || 0,
        percentual_concluido: parseInt(formData.percentual_concluido, 10) || 0,
        tipo_servico: formData.tipo_servico.trim(),
        escopo_resumido: formData.escopo_resumido.trim(),
        municipio_uf: formData.municipio_uf.trim(),
        aerodromo: formData.aerodromo.trim(),
        numero_pc_pt: formData.numero_pc_pt.trim(),
        marco_fase_atual: formData.marco_fase_atual.trim(),
        proxima_entrega: formData.proxima_entrega.trim(),
        pendente_orgao: formData.pendente_orgao.trim(),
        observacoes: formData.observacoes,
      }

      // Campo valor_global sensível: apenas admin ou financeiro
      if (canEditValues) {
        payload.valor_global = sanitizedValor
      }

      // Detectar explicitamente mudanças para log de auditoria no cliente (caso hook falhe ou para confirmação)
      const mudancasAudit: string[] = []
      const usuarioLogadoNome = user?.name || user?.email || 'Usuário'

      if (projeto.nome !== nomeTrim) {
        mudancasAudit.push(`Nome alterado de "${projeto.nome}" para "${nomeTrim}"`)
      }
      if (canEditValues && (projeto.valor_global ?? 0) !== sanitizedValor) {
        mudancasAudit.push(
          `Valor global alterado de ${formatCurrency(projeto.valor_global ?? 0)} para ${formatCurrency(sanitizedValor)}`,
        )
      }
      if (projeto.prioridade !== formData.prioridade) {
        mudancasAudit.push(
          `Prioridade alterada de "${projeto.prioridade || 'normal'}" para "${formData.prioridade}"`,
        )
      }
      if (projeto.status !== formData.status) {
        mudancasAudit.push(`Status alterado de "${projeto.status}" para "${formData.status}"`)
      }
      if (projeto.trilha !== formData.trilha) {
        mudancasAudit.push(`Trilha alterada de "${projeto.trilha}" para "${formData.trilha}"`)
      }
      if (projeto.fase !== formData.fase) {
        mudancasAudit.push(`Fase alterada de "${projeto.fase}" para "${formData.fase}"`)
      }

      const atualizado = await updateOne<ProjetoRecord>('projetos', projeto.id, payload)

      // Registrar atividade de auditoria explícita no histórico caso o hook não tenha pegado algum detalhe
      if (mudancasAudit.length > 0 && user?.id) {
        try {
          await createOne('atividades', {
            usuario: user.id,
            texto: `${mudancasAudit.join(' · ')} por ${usuarioLogadoNome}`,
            projeto: projeto.id,
            cliente: projeto.cliente,
          })
        } catch (actErr) {
          console.warn('Registro adicional de atividade:', actErr)
        }
      }

      toast.success('Projeto atualizado com sucesso!')
      onSuccess?.(atualizado)
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Erro ao atualizar projeto:', err)
      const msg =
        err instanceof Error ? err.message : 'Não foi possível salvar as alterações do projeto.'
      setErro(msg)
      toast.error('Erro ao atualizar projeto.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-[#FF6A13]">
                <Edit3 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Edição Completa do Projeto</DialogTitle>
                <DialogDescription className="text-xs text-[#737373]">
                  Projeto <strong className="font-mono text-[#D65100]">{projeto?.numero}</strong>{' '}
                  (numeração fixa imutável)
                </DialogDescription>
              </div>
            </div>
            {projeto?.prioridade && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  projeto.prioridade === 'alta'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : projeto.prioridade === 'baixa'
                      ? 'bg-neutral-100 text-neutral-600 border-neutral-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                Prioridade: {projeto.prioridade}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Abas de navegação interna para organização */}
        <div className="flex border-b border-neutral-200 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('geral')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === 'geral'
                ? 'border-[#FF6A13] text-[#FF6A13]'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Dados Principais & Prioridade
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('financeiro')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1 ${
              activeTab === 'financeiro'
                ? 'border-[#FF6A13] text-[#FF6A13]'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" />
            Valores & Contrato
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tecnico')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === 'tecnico'
                ? 'border-[#FF6A13] text-[#FF6A13]'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Trilha, Escopo & Fase
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('prazos')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === 'prazos'
                ? 'border-[#FF6A13] text-[#FF6A13]'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Prazos & Datas
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {erro && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          {/* TAB 1: GERAL & PRIORIDADE */}
          {activeTab === 'geral' && (
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="edit-nome" className="text-xs font-semibold text-[#424242]">
                  Nome do Projeto *
                </Label>
                <Input
                  id="edit-nome"
                  value={formData.nome}
                  onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome descritivo do projeto"
                  className="text-sm"
                  disabled={salvando || !canEditGeneral}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-cliente" className="text-xs font-semibold text-[#424242]">
                    Cliente Contratante *
                  </Label>
                  <Select
                    value={formData.cliente}
                    onValueChange={(cliente) => setFormData((prev) => ({ ...prev, cliente }))}
                    disabled={salvando || !isAdmin}
                  >
                    <SelectTrigger id="edit-cliente" className="text-sm">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isAdmin && (
                    <p className="text-[11px] text-neutral-500">
                      Alteração de cliente restrita a Administrador.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-prioridade" className="text-xs font-semibold text-[#424242]">
                    Prioridade Operacional
                  </Label>
                  <Select
                    value={formData.prioridade}
                    onValueChange={(val: 'alta' | 'normal' | 'baixa') =>
                      setFormData((prev) => ({ ...prev, prioridade: val }))
                    }
                    disabled={salvando || !canEditGeneral}
                  >
                    <SelectTrigger id="edit-prioridade" className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alta">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
                          <strong className="text-red-700">Alta</strong> (Urgência operacional)
                        </span>
                      </SelectItem>
                      <SelectItem value="normal">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-neutral-400 inline-block" />
                          <span>Normal</span> (Fluxo padrão)
                        </span>
                      </SelectItem>
                      <SelectItem value="baixa">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-neutral-300 inline-block" />
                          <span className="text-neutral-500">Baixa</span> (Secundário)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-status" className="text-xs font-semibold text-[#424242]">
                    Status do Projeto
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: 'ativo' | 'suspenso' | 'concluido' | 'cancelado') =>
                      setFormData((prev) => ({ ...prev, status: val }))
                    }
                    disabled={salvando || !canEditGeneral}
                  >
                    <SelectTrigger id="edit-status" className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="suspenso">Suspenso</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-resp" className="text-xs font-semibold text-[#424242]">
                    Responsável Técnico
                  </Label>
                  <Select
                    value={formData.responsavel_tecnico || 'nenhum'}
                    onValueChange={(val) =>
                      setFormData((prev) => ({
                        ...prev,
                        responsavel_tecnico: val === 'nenhum' ? '' : val,
                      }))
                    }
                    disabled={salvando || !canEditGeneral}
                  >
                    <SelectTrigger id="edit-resp" className="text-sm">
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum responsável</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-drive" className="text-xs font-semibold text-[#424242]">
                  Link da Pasta do Google Drive
                </Label>
                <Input
                  id="edit-drive"
                  type="url"
                  value={formData.pasta_drive_url}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, pasta_drive_url: e.target.value }))
                  }
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="text-sm font-mono"
                  disabled={salvando || !canEditGeneral}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-obs" className="text-xs font-semibold text-[#424242]">
                  Observações Gerais
                </Label>
                <Textarea
                  id="edit-obs"
                  rows={3}
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, observacoes: e.target.value }))
                  }
                  placeholder="Anotações internas sobre o projeto..."
                  className="text-sm"
                  disabled={salvando || !canEditGeneral}
                />
              </div>
            </div>
          )}

          {/* TAB 2: VALORES & CONTRATO */}
          {activeTab === 'financeiro' && (
            <div className="space-y-3.5">
              <div className="rounded-lg bg-orange-50/70 border border-orange-200 p-3 text-xs text-neutral-700">
                <p className="font-semibold text-[#D65100]">
                  Ajuste Manual do Valor Global Contratado
                </p>
                <p className="mt-0.5 text-neutral-600">
                  Ideal para projetos importados da planilha com valor zerado (ex.: Edifício Armando
                  Monteiro Neto com notas vinculadas). Toda alteração de valor fica auditada na
                  linha do tempo do projeto.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-valor"
                    className="text-xs font-bold text-[#424242] flex items-center gap-1.5"
                  >
                    <DollarSign className="h-4 w-4 text-[#FF6A13]" />
                    Valor Global / Contratado (R$)
                  </Label>
                  <Input
                    id="edit-valor"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.valor_global}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, valor_global: e.target.value }))
                    }
                    placeholder="0.00"
                    className="font-mono text-base font-bold text-[#D65100]"
                    disabled={salvando || !canEditValues}
                  />
                  <p className="text-[11px] text-neutral-500">
                    Formato numérico (ex.: 1500000 para R$ 1.500.000,00).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-pc-pt" className="text-xs font-semibold text-[#424242]">
                    Nº Proposta / Contrato (PC / PT)
                  </Label>
                  <Input
                    id="edit-pc-pt"
                    value={formData.numero_pc_pt}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, numero_pc_pt: e.target.value }))
                    }
                    placeholder="Ex.: PC 233/2026 rev2"
                    className="text-sm font-mono"
                    disabled={salvando || !canEditGeneral}
                  />
                </div>
              </div>

              {!canEditValues && (
                <div className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
                  Edição de valores restrita a administradores e ao departamento financeiro.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TRILHA, ESCOPO & FASE */}
          {activeTab === 'tecnico' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-trilha" className="text-xs font-semibold text-[#424242]">
                    Trilha de Execução
                  </Label>
                  <Select
                    value={formData.trilha}
                    onValueChange={(val: Trail) => {
                      const newFase = trailPhases[val]?.[0] ?? ''
                      setFormData((prev) => ({
                        ...prev,
                        trilha: val,
                        fase: newFase,
                      }))
                    }}
                    disabled={salvando || !canEditGeneral}
                  >
                    <SelectTrigger id="edit-trilha" className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="opea">OPEA (Objeto Projetado no Espaço Aéreo)</SelectItem>
                      <SelectItem value="registro">Registro e Homologação de Aeródromos</SelectItem>
                      <SelectItem value="demais">Demais Projetos e Consultorias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-fase" className="text-xs font-semibold text-[#424242]">
                    Fase Atual da Trilha
                  </Label>
                  <Select
                    value={formData.fase}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, fase: val }))}
                    disabled={salvando || !canEditGeneral}
                  >
                    <SelectTrigger id="edit-fase" className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {trailPhases[formData.trilha]?.map((ph) => (
                        <SelectItem key={ph} value={ph}>
                          {ph}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-progresso" className="text-xs font-semibold text-[#424242]">
                    Progresso Concluído (%)
                  </Label>
                  <Input
                    id="edit-progresso"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.percentual_concluido}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, percentual_concluido: e.target.value }))
                    }
                    className="text-sm font-mono"
                    disabled={salvando || !canEditGeneral}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-art" className="text-xs font-semibold text-[#424242]">
                    Nº da ART / RRT
                  </Label>
                  <Input
                    id="edit-art"
                    value={formData.art}
                    onChange={(e) => setFormData((prev) => ({ ...prev, art: e.target.value }))}
                    placeholder="Ex.: 2026/01293"
                    className="text-sm font-mono"
                    disabled={salvando || !canEditGeneral}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-aerodromo" className="text-xs font-semibold text-[#424242]">
                    Aeródromo / Código ICAO
                  </Label>
                  <Input
                    id="edit-aerodromo"
                    value={formData.aerodromo}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, aerodromo: e.target.value.toUpperCase() }))
                    }
                    placeholder="Ex.: SBFL, SNAW, SBJE"
                    className="text-sm font-mono uppercase"
                    disabled={salvando || !canEditGeneral}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-tipo-servico" className="text-xs font-semibold text-[#424242]">
                  Tipo de Serviço / Especialidade
                </Label>
                <Input
                  id="edit-tipo-servico"
                  value={formData.tipo_servico}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, tipo_servico: e.target.value }))
                  }
                  placeholder="Ex.: PBZPA, Pré-análise OPEA, Plano de Zona de Proteção"
                  className="text-sm"
                  disabled={salvando || !canEditGeneral}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-escopo" className="text-xs font-semibold text-[#424242]">
                  Escopo Resumido das Atividades
                </Label>
                <Textarea
                  id="edit-escopo"
                  rows={2}
                  value={formData.escopo_resumido}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, escopo_resumido: e.target.value }))
                  }
                  placeholder="Detalhamento do objeto contratado e entregas..."
                  className="text-sm"
                  disabled={salvando || !canEditGeneral}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-municipio" className="text-xs font-semibold text-[#424242]">
                    Município / UF
                  </Label>
                  <Input
                    id="edit-municipio"
                    value={formData.municipio_uf}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, municipio_uf: e.target.value }))
                    }
                    placeholder="Ex.: Florianópolis/SC"
                    className="text-sm"
                    disabled={salvando || !canEditGeneral}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-orgao" className="text-xs font-semibold text-[#424242]">
                    Pendente no Órgão Regulador?
                  </Label>
                  <Input
                    id="edit-orgao"
                    value={formData.pendente_orgao}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, pendente_orgao: e.target.value }))
                    }
                    placeholder="Ex.: Sim, Não, DECEA, ANAC"
                    className="text-sm"
                    disabled={salvando || !canEditGeneral}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PRAZOS & DATAS */}
          {activeTab === 'prazos' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-prazo" className="text-xs font-semibold text-[#424242]">
                    Prazo Interno AEROCAD
                  </Label>
                  <Input
                    id="edit-prazo"
                    type="date"
                    value={formData.prazo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, prazo: e.target.value }))}
                    className="text-sm"
                    disabled={salvando || !canEditGeneral}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-data-inicio"
                    className="text-xs font-semibold text-[#424242]"
                  >
                    Data de Início das Atividades
                  </Label>
                  <Input
                    id="edit-data-inicio"
                    type="date"
                    value={formData.data_inicio}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, data_inicio: e.target.value }))
                    }
                    className="text-sm"
                    disabled={salvando || !canEditGeneral}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-data-proposta"
                    className="text-xs font-semibold text-[#424242]"
                  >
                    Data de Envio da Proposta
                  </Label>
                  <Input
                    id="edit-data-proposta"
                    type="date"
                    value={formData.data_proposta}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, data_proposta: e.target.value }))
                    }
                    className="text-sm"
                    disabled={salvando || !canEditGeneral}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-data-aceite"
                    className="text-xs font-semibold text-[#424242]"
                  >
                    Data de Aceite / Contratação
                  </Label>
                  <Input
                    id="edit-data-aceite"
                    type="date"
                    value={formData.data_aceite}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, data_aceite: e.target.value }))
                    }
                    className="text-sm"
                    disabled={salvando || !canEditGeneral}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-marco-fase" className="text-xs font-semibold text-[#424242]">
                    Marco da Fase Atual
                  </Label>
                  <Input
                    id="edit-marco-fase"
                    value={formData.marco_fase_atual}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, marco_fase_atual: e.target.value }))
                    }
                    placeholder="Ex.: Protocolo realizado, aguardando parecer"
                    className="text-sm"
                    disabled={salvando || !canEditGeneral}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-proxima-entrega"
                    className="text-xs font-semibold text-[#424242]"
                  >
                    Próxima Entrega Prevista
                  </Label>
                  <Input
                    id="edit-proxima-entrega"
                    value={formData.proxima_entrega}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, proxima_entrega: e.target.value }))
                    }
                    placeholder="Ex.: Relatório preliminar em 15 dias"
                    className="text-sm"
                    disabled={salvando || !canEditGeneral}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando || (!canEditGeneral && !canEditValues)}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              {salvando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando Alterações...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Salvar Projeto
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
