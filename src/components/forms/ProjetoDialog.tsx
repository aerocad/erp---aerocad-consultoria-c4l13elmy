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
import { trailPhases } from '@/lib/crm'
import { createOne, listAll } from '@/services/api'
import type {
  ClienteRecord,
  OportunidadeRecord,
  ProjetoRecord,
  Trail,
  UserRecord,
} from '@/types/crm'

type Props = {
  open: boolean
  onOpenChange: (value: boolean) => void
  presetClient?: string
  oportunidade?: OportunidadeRecord | null
  onSaved: (record: ProjetoRecord) => void
}

export function ProjetoDialog({ open, onOpenChange, presetClient, oportunidade, onSaved }: Props) {
  const { user } = useAuth()
  const [clients, setClients] = useState<ClienteRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nome: '',
    cliente: '',
    oportunidade: '',
    trilha: 'opea' as Trail,
    fase: trailPhases.opea[0],
    status: 'ativo',
    responsavel_tecnico: '',
    data_inicio: '',
    prazo: '',
    percentual_concluido: '0',
    observacoes: '',
  })

  useEffect(() => {
    if (open)
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
  }, [open])
  useEffect(() => {
    const trail = oportunidade?.trilha_prevista || 'opea'
    setForm({
      nome: oportunidade?.titulo || '',
      cliente: oportunidade?.cliente || presetClient || '',
      oportunidade: oportunidade?.id || '',
      trilha: trail,
      fase: trailPhases[trail][0],
      status: 'ativo',
      responsavel_tecnico: user?.role === 'tecnico' ? user.id : '',
      data_inicio: new Date().toISOString().slice(0, 10),
      prazo: '',
      percentual_concluido: '0',
      observacoes: oportunidade?.observacoes || '',
    })
  }, [open, oportunidade, presetClient, user])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.nome.trim() || !form.cliente) return setError('Nome e cliente são obrigatórios.')
    setSaving(true)
    setError('')
    try {
      const record = await createOne<ProjetoRecord>('projetos', {
        ...form,
        data_inicio: form.data_inicio ? `${form.data_inicio} 12:00:00.000Z` : '',
        prazo: form.prazo ? `${form.prazo} 12:00:00.000Z` : '',
        percentual_concluido: Number(form.percentual_concluido),
      })
      toast.success(`Projeto ${record.numero} criado`)
      onSaved(record)
      onOpenChange(false)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Não foi possível criar o projeto.',
      )
      toast.error('Não foi possível criar o projeto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
          <DialogDescription>
            O número global será atribuído automaticamente pelo servidor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome do projeto *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((v) => ({ ...v, nome: e.target.value }))}
            />
          </div>
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
          <div className="space-y-2">
            <Label>Trilha</Label>
            <Select
              value={form.trilha}
              onValueChange={(value: Trail) =>
                setForm((v) => ({ ...v, trilha: value, fase: trailPhases[value][0] }))
              }
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
            <Label>Fase inicial</Label>
            <Select value={form.fase} onValueChange={(fase) => setForm((v) => ({ ...v, fase }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {trailPhases[form.trilha].map((phase) => (
                  <SelectItem key={phase} value={phase}>
                    {phase}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Responsável técnico</Label>
            <Select
              value={form.responsavel_tecnico}
              onValueChange={(responsavel_tecnico) =>
                setForm((v) => ({ ...v, responsavel_tecnico }))
              }
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
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(status) => setForm((v) => ({ ...v, status }))}
            >
              <SelectTrigger>
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
          <div className="space-y-2">
            <Label>Data de início</Label>
            <Input
              type="date"
              value={form.data_inicio}
              onChange={(e) => setForm((v) => ({ ...v, data_inicio: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Prazo interno AEROCAD</Label>
            <Input
              type="date"
              value={form.prazo}
              onChange={(e) => setForm((v) => ({ ...v, prazo: e.target.value }))}
            />
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
            <Button className="bg-[#FF6A13] hover:bg-[#E85B06]" disabled={saving}>
              {saving ? 'Criando...' : 'Criar projeto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
