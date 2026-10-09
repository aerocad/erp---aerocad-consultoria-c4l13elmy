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
import { createOne, updateOne } from '@/services/api'
import type { ClienteRecord } from '@/types/crm'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente?: ClienteRecord | null
  onSaved: (record: ClienteRecord) => void
}

const empty = {
  tipo: 'pj',
  razao_social: '',
  cnpj_cpf: '',
  segmento: '',
  municipio: '',
  uf: '',
  telefone: '',
  email: '',
  endereco: '',
  origem: '',
  status: 'prospect',
  recorrente: false,
  observacoes: '',
}

export function ClienteDialog({ open, onOpenChange, cliente, onSaved }: Props) {
  const { user } = useAuth()
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const editable = user?.role === 'admin' || user?.role === 'comercial'

  useEffect(() => {
    if (cliente) setForm({ ...empty, ...cliente })
    else setForm(empty)
  }, [cliente, open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.razao_social.trim()) return setError('Informe a razão social ou nome.')
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, uf: form.uf.toUpperCase().slice(0, 2) }
      const record = cliente
        ? await updateOne<ClienteRecord>('clientes', cliente.id, payload)
        : await createOne<ClienteRecord>('clientes', payload)
      toast.success(cliente ? 'Cliente atualizado' : 'Cliente criado')
      onSaved(record)
      onOpenChange(false)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Não foi possível salvar o cliente.',
      )
      toast.error('Revise os campos e tente novamente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{cliente ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
          <DialogDescription>Dados cadastrais e comerciais para a ficha 360º.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(tipo) => setForm((value) => ({ ...value, tipo }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pj">Pessoa jurídica</SelectItem>
                <SelectItem value="pf">Pessoa física</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(status) => setForm((value) => ({ ...value, status }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Razão social / nome *</Label>
            <Input
              value={form.razao_social}
              onChange={(e) => setForm((v) => ({ ...v, razao_social: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>CNPJ / CPF</Label>
            <Input
              value={form.cnpj_cpf}
              onChange={(e) => setForm((v) => ({ ...v, cnpj_cpf: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Segmento</Label>
            <Input
              value={form.segmento}
              onChange={(e) => setForm((v) => ({ ...v, segmento: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={form.telefone}
              onChange={(e) => setForm((v) => ({ ...v, telefone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Município</Label>
            <Input
              value={form.municipio}
              onChange={(e) => setForm((v) => ({ ...v, municipio: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>UF</Label>
            <Input
              maxLength={2}
              value={form.uf}
              onChange={(e) => setForm((v) => ({ ...v, uf: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Endereço</Label>
            <Input
              value={form.endereco}
              onChange={(e) => setForm((v) => ({ ...v, endereco: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Origem</Label>
            <Input
              value={form.origem}
              onChange={(e) => setForm((v) => ({ ...v, origem: e.target.value }))}
            />
          </div>
          <label className="flex min-h-10 items-center gap-2 pt-7 text-sm">
            <input
              type="checkbox"
              checked={form.recorrente}
              onChange={(e) => setForm((v) => ({ ...v, recorrente: e.target.checked }))}
            />
            Cliente recorrente
          </label>
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
            <Button
              type="submit"
              disabled={saving || !editable}
              className="bg-[#FF6A13] hover:bg-[#E85B06]"
            >
              {saving ? 'Salvando...' : 'Salvar cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
