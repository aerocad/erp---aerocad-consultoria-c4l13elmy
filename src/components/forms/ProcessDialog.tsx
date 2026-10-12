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
import {
  EquipeTecnicaSelector,
  type EquipeTecnicaValue,
} from '@/components/projetos/EquipeTecnicaSection'
import { createOne, listAll } from '@/services/api'
import type {
  ColaboradorRecord,
  ProcessoOrgao,
  ProcessoRecord,
  ProcessoStatus,
  ProjetoRecord,
} from '@/types/crm'
import { processOrgaoList, processStatusLabels } from '@/lib/crm'

type Props = {
  open: boolean
  onOpenChange: (value: boolean) => void
  presetProject?: string
  onSaved: (record: ProcessoRecord) => void
}
export function ProcessDialog({ open, onOpenChange, presetProject, onSaved }: Props) {
  const [projects, setProjects] = useState<ProjetoRecord[]>([])
  const [colaboradores, setColaboradores] = useState<ColaboradorRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [equipe, setEquipe] = useState<EquipeTecnicaValue>({
    coordenadorId: undefined,
    analistaId: undefined,
    rtsIds: [],
  })
  const [form, setForm] = useState<{
    projeto: string
    orgao: ProcessoOrgao
    numero_protocolo: string
    data_protocolo: string
    status: ProcessoStatus
    prazo_orgao: string
    parecer: 'favoravel' | 'favoravel_com_restricoes' | 'desfavoravel' | 'pendente'
    link_ambiente: string
    link_drive: string
    link_emails: string
    observacoes: string
  }>({
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
    if (open) {
      void Promise.all([
        listAll<ProjetoRecord>('projetos', { sort: '-created' }),
        listAll<ColaboradorRecord>('colaboradores', { sort: 'nome_completo' }),
      ]).then(([prList, colabs]) => {
        setProjects(prList)
        setColaboradores(colabs)

        if (presetProject) {
          const foundPr = prList.find((p) => p.id === presetProject)
          if (foundPr) {
            setEquipe({
              coordenadorId: foundPr.coordenador_colaborador || undefined,
              analistaId: foundPr.analista_colaborador || undefined,
              rtsIds: Array.isArray(foundPr.rts_colaboradores)
                ? [...foundPr.rts_colaboradores]
                : [],
            })
          }
        }
      })
    }
  }, [open, presetProject])

  useEffect(
    () => setForm((value) => ({ ...value, projeto: presetProject || '' })),
    [open, presetProject],
  )

  function handleSelectProjeto(projId: string) {
    setForm((v) => ({ ...v, projeto: projId }))
    const p = projects.find((item) => item.id === projId)
    if (p) {
      setEquipe({
        coordenadorId: p.coordenador_colaborador || undefined,
        analistaId: p.analista_colaborador || undefined,
        rtsIds: Array.isArray(p.rts_colaboradores) ? [...p.rts_colaboradores] : [],
      })
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.projeto || !form.orgao) return setError('Projeto e órgão são obrigatórios.')
    setSaving(true)
    setError('')
    try {
      const rtsColabsRecords = colaboradores.filter((c) => (equipe.rtsIds || []).includes(c.id))
      const rtsUserIds = Array.from(
        new Set(
          rtsColabsRecords.map((c) => c.usuario_sistema).filter((u): u is string => Boolean(u)),
        ),
      )

      const record = await createOne<ProcessoRecord>('processos', {
        ...form,
        coordenador_colaborador: equipe.coordenadorId || null,
        analista_colaborador: equipe.analistaId || null,
        rts_colaboradores: equipe.rtsIds || [],
        rts_usuarios: rtsUserIds,
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
              disabled={Boolean(presetProject)}
              onValueChange={handleSelectProjeto}
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
            <Select
              value={form.orgao}
              onValueChange={(orgao) => setForm((v) => ({ ...v, orgao: orgao as ProcessoOrgao }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {processOrgaoList.map((org) => (
                  <SelectItem key={org} value={org}>
                    {org}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(status) =>
                setForm((v) => ({ ...v, status: status as ProcessoStatus }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(processStatusLabels) as ProcessoStatus[]).map((stKey) => (
                  <SelectItem key={stKey} value={stKey}>
                    {processStatusLabels[stKey]}
                  </SelectItem>
                ))}
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
          {/* Seção Equipe Técnica do Processo Regulatório */}
          <div className="sm:col-span-2">
            <EquipeTecnicaSelector
              colaboradores={colaboradores}
              value={equipe}
              onChange={setEquipe}
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
