import { useEffect, useState, type FormEvent } from 'react'
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
import { toInputDate } from '@/lib/format'
import { createOne, listAll, updateOne } from '@/services/api'
import type { ClienteRecord, OportunidadeRecord, ServiceRecord, UserRecord } from '@/types/crm'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  oportunidade?: OportunidadeRecord | null
  presetClient?: string
  onSaved: (record: OportunidadeRecord) => void
}

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
  const [users, setUsers] = useState<UserRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    cliente: '',
    titulo: '',
    tipo_servico: '',
    etapa: 'lead',
    valor_estimado: '',
    probabilidade: '30',
    data_prevista_fechamento: '',
    responsavel: '',
    trilha_prevista: 'opea',
    observacoes: '',
    origem_canal: 'outro' as 'whatsapp' | 'site' | 'indicacao' | 'email' | 'outro',
  })

  useEffect(() => {
    if (open)
      void Promise.all([
        listAll<ClienteRecord>('clientes', { sort: 'razao_social' }),
        listAll<ServiceRecord>('servicos_catalogo', { filter: 'ativo = true', sort: 'nome' }),
        listAll<UserRecord>('users', { sort: 'name' }),
      ])
        .then(([c, s, u]) => {
          setClients(c)
          setServices(s)
          setUsers(u)
        })
        .catch(() => {})
  }, [open])
  useEffect(() => {
    if (oportunidade)
      setForm({
        cliente: oportunidade.cliente,
        titulo: oportunidade.titulo,
        tipo_servico: oportunidade.tipo_servico,
        etapa: oportunidade.etapa,
        valor_estimado: String(oportunidade.valor_estimado || ''),
        probabilidade: String(oportunidade.probabilidade || 0),
        data_prevista_fechamento: toInputDate(oportunidade.data_prevista_fechamento),
        responsavel: oportunidade.responsavel,
        trilha_prevista: oportunidade.trilha_prevista || 'opea',
        observacoes: oportunidade.observacoes || '',
        origem_canal: oportunidade.origem_canal || 'outro',
      })
    else
      setForm({
        cliente: presetClient || '',
        titulo: '',
        tipo_servico: '',
        etapa: 'lead',
        valor_estimado: '',
        probabilidade: '30',
        data_prevista_fechamento: '',
        responsavel: user?.id || '',
        trilha_prevista: 'opea',
        observacoes: '',
        origem_canal: 'outro',
      })
  }, [oportunidade, open, presetClient, user?.id])

  function chooseService(id: string) {
    const service = services.find((item) => item.id === id)
    setForm((value) => ({
      ...value,
      tipo_servico: id,
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

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.cliente || !form.titulo.trim()) return setError('Cliente e título são obrigatórios.')
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        valor_estimado: Number(form.valor_estimado || 0),
        probabilidade: Number(form.probabilidade || 0),
        data_prevista_fechamento: form.data_prevista_fechamento
          ? `${form.data_prevista_fechamento} 12:00:00.000Z`
          : '',
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
          <div className="space-y-2">
            <Label>Serviço sugerido</Label>
            <Select value={form.tipo_servico} onValueChange={chooseService}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {services.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.codigo} · {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Trilha prevista</Label>
            <Select
              value={form.trilha_prevista}
              onValueChange={(trilha_prevista) => setForm((v) => ({ ...v, trilha_prevista }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="opea">OPEA</SelectItem>
                <SelectItem value="registro">Registro</SelectItem>
                <SelectItem value="demais">Demais</SelectItem>
              </SelectContent>
            </Select>
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
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select
              value={form.responsavel}
              onValueChange={(responsavel) => setForm((v) => ({ ...v, responsavel }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {users.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
