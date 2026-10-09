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
import { createOne, listAll } from '@/services/api'
import type { ProcessoRecord, ProjetoRecord } from '@/types/crm'

type Props = {
  open: boolean
  onOpenChange: (value: boolean) => void
  presetProject?: string
  onSaved: (record: ProcessoRecord) => void
}
export function ProcessDialog({ open, onOpenChange, presetProject, onSaved }: Props) {
  const [projects, setProjects] = useState<ProjetoRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    projeto: '',
    orgao: 'DECEA-CINDACTA',
    numero_protocolo: '',
    data_protocolo: '',
    status: 'nao_protocolado',
    prazo_orgao: '',
    parecer: 'pendente',
    link_ambiente: '',
    link_drive: '',
    link_emails: '',
    observacoes: '',
  })
  useEffect(() => {
    if (open) void listAll<ProjetoRecord>('projetos', { sort: '-created' }).then(setProjects)
  }, [open])
  useEffect(
    () => setForm((value) => ({ ...value, projeto: presetProject || '' })),
    [open, presetProject],
  )
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.projeto || !form.orgao) return setError('Projeto e órgão são obrigatórios.')
    setSaving(true)
    setError('')
    try {
      const record = await createOne<ProcessoRecord>('processos', {
        ...form,
        data_protocolo: form.data_protocolo ? `${form.data_protocolo} 12:00:00.000Z` : '',
        prazo_orgao: form.prazo_orgao ? `${form.prazo_orgao} 12:00:00.000Z` : '',
      })
      toast.success('Processo regulatório criado')
      onSaved(record)
      onOpenChange(false)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Não foi possível criar o processo.',
      )
      toast.error('Não foi possível criar o processo')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo processo regulatório</DialogTitle>
          <DialogDescription>
            O prazo do órgão é separado do prazo interno do projeto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Projeto *</Label>
            <Select
              value={form.projeto}
              onValueChange={(projeto) => setForm((v) => ({ ...v, projeto }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.numero} · {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Órgão *</Label>
            <Select value={form.orgao} onValueChange={(orgao) => setForm((v) => ({ ...v, orgao }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DECEA-CINDACTA">DECEA-CINDACTA</SelectItem>
                <SelectItem value="COMAER">COMAER</SelectItem>
                <SelectItem value="ANAC">ANAC</SelectItem>
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
                <SelectItem value="nao_protocolado">Não protocolado</SelectItem>
                <SelectItem value="protocolado">Protocolado</SelectItem>
                <SelectItem value="em_exigencia">Em exigência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Número do protocolo</Label>
            <Input
              value={form.numero_protocolo}
              onChange={(e) => setForm((v) => ({ ...v, numero_protocolo: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Data do protocolo</Label>
            <Input
              type="date"
              value={form.data_protocolo}
              onChange={(e) => setForm((v) => ({ ...v, data_protocolo: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Prazo do órgão</Label>
            <Input
              type="date"
              value={form.prazo_orgao}
              onChange={(e) => setForm((v) => ({ ...v, prazo_orgao: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Parecer</Label>
            <Select
              value={form.parecer}
              onValueChange={(parecer) => setForm((v) => ({ ...v, parecer }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="favoravel">Favorável</SelectItem>
                <SelectItem value="favoravel_com_restricoes">Favorável com restrições</SelectItem>
                <SelectItem value="desfavoravel">Desfavorável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Link do ambiente do órgão</Label>
            <Input
              type="url"
              value={form.link_ambiente}
              onChange={(e) => setForm((v) => ({ ...v, link_ambiente: e.target.value }))}
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
            <Button disabled={saving} className="bg-[#FF6A13] hover:bg-[#E85B06]">
              {saving ? 'Criando...' : 'Criar processo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
