import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, FileText, Link2, Printer, Save } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import logo from '@/assets/aerocad-logo.svg'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import { formatCurrency, formatDate } from '@/lib/format'
import { createOne, listAll, updateOne } from '@/services/api'
import type {
  ClienteRecord,
  DocumentoRecord,
  ModeloRecord,
  ProcessoRecord,
  ProjetoRecord,
} from '@/types/crm'

const placeholderRegex = /{{\s*([^}]+)\s*}}/g
export default function DocumentGeneratorPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<ModeloRecord[]>([])
  const [clients, setClients] = useState<ClienteRecord[]>([])
  const [projects, setProjects] = useState<ProjetoRecord[]>([])
  const [processes, setProcesses] = useState<ProcessoRecord[]>([])
  const [templateId, setTemplateId] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [processId, setProcessId] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [saved, setSaved] = useState<DocumentoRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [signatureLink, setSignatureLink] = useState('')
  useEffect(() => {
    void Promise.all([
      listAll<ModeloRecord>('modelos_documentos', { sort: 'nome' }),
      listAll<ClienteRecord>('clientes', { sort: 'razao_social' }),
      listAll<ProjetoRecord>('projetos', { expand: 'cliente,oportunidade', sort: '-numero' }),
      listAll<ProcessoRecord>('processos', { expand: 'projeto', sort: '-created' }),
    ]).then(([t, c, p, pr]) => {
      setTemplates(t)
      setClients(c)
      setProjects(p)
      setProcesses(pr)
    })
  }, [])
  const template = templates.find((i) => i.id === templateId)
  const client = clients.find((i) => i.id === clientId)
  const project = projects.find((i) => i.id === projectId)
  const process = processes.find((i) => i.id === processId)
  const placeholders = useMemo(() => {
    const found = new Set<string>()
    for (const match of template?.corpo?.matchAll(placeholderRegex) || [])
      found.add(match[1].trim())
    return Array.from(found)
  }, [template?.corpo])
  useEffect(() => {
    const p = projects.find((i) => i.id === projectId)
    if (p) {
      setClientId(p.cliente)
      setProcessId('')
    }
  }, [projectId, projects])
  useEffect(() => {
    const pr = processes.find((i) => i.id === processId)
    if (pr) {
      setProjectId(pr.projeto)
    }
  }, [processId, processes])
  useEffect(() => {
    if (!template) return
    const defaults: Record<string, string> = {
      'cliente.razao_social': client?.razao_social || '',
      'cliente.cnpj_cpf': client?.cnpj_cpf || '',
      'cliente.endereco': client?.endereco || '',
      'projeto.numero': project?.numero || '',
      'projeto.nome': project?.nome || '',
      'processo.numero_protocolo': process?.numero_protocolo || '',
      data_hoje: formatDate(new Date()),
      valor_contrato: formatCurrency(project?.expand?.oportunidade?.valor_estimado || 0),
      orgao: process?.orgao || '',
    }
    setValues((current) => {
      const next = { ...current }
      placeholders.forEach((key) => {
        if (!next[key] || key.includes('.')) next[key] = defaults[key] || next[key] || ''
      })
      return next
    })
    setName((current) => current || `${template.nome}${project ? ` — ${project.numero}` : ''}`)
  }, [template, client, project, process, placeholders])
  const html = useMemo(() => {
    let body = template?.corpo || ''
    placeholders.forEach((key) => {
      body = body.replaceAll(`{{${key}}}`, values[key] || `[${key}]`)
      body = body.replaceAll(`{{ ${key} }}`, values[key] || `[${key}]`)
    })
    return body
  }, [template?.corpo, placeholders, values])
  async function generate() {
    if (!template) return toast.error('Escolha um modelo')
    if (placeholders.some((key) => !values[key]?.trim()))
      return toast.error('Preencha todos os campos do documento')
    setSaving(true)
    try {
      const record = await createOne<DocumentoRecord>('documentos', {
        nome: name || template.nome,
        tipo: template.categoria,
        modelo: template.id,
        cliente: clientId,
        projeto: projectId,
        processo: processId,
        versao: 'REV001',
        status: 'gerado',
        gerado_de_template: true,
        conteudo: html,
      })
      setSaved(record)
      toast.success('Documento gerado e salvo')
    } catch {
      toast.error('Não foi possível gerar o documento')
    } finally {
      setSaving(false)
    }
  }
  async function sendSignature() {
    if (!saved || !signatureLink) return
    try {
      new URL(signatureLink)
      const updated = await updateOne<DocumentoRecord>('documentos', saved.id, {
        status: 'enviado_assinatura',
        link_assinatura: signatureLink,
      })
      setSaved(updated)
      setSignatureOpen(false)
      toast.success('Documento marcado como enviado para assinatura')
    } catch {
      toast.error('Informe um link válido')
    }
  }
  async function markSigned() {
    if (!saved) return
    try {
      setSaved(await updateOne<DocumentoRecord>('documentos', saved.id, { status: 'assinado' }))
      toast.success('Documento marcado como assinado')
    } catch {
      toast.error('Não foi possível atualizar o documento')
    }
  }
  return (
    <div>
      <Button variant="ghost" asChild className="mb-4 -ml-3">
        <Link to="/documentos">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar aos documentos
        </Link>
      </Button>
      <div className="mb-6">
        <p className="technical-label">GERADOR A4</p>
        <h1 className="text-2xl font-bold text-[#424242]">Novo documento</h1>
        <p className="mt-1 text-sm text-[#737373]">
          Modelo → contexto → campos → pré-visualização e impressão.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <aside className="space-y-5">
          <section className="crm-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF6A13] text-xs font-bold text-white">
                1
              </span>
              <h2 className="font-bold">Modelo</h2>
            </div>
            <Select
              value={templateId}
              onValueChange={(id) => {
                setTemplateId(id)
                setValues({})
                setSaved(null)
                setName('')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha o modelo" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
          <section className="crm-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF6A13] text-xs font-bold text-white">
                2
              </span>
              <h2 className="font-bold">Contexto</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Projeto</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.numero} · {i.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Processo</Label>
                <Select value={processId} onValueChange={setProcessId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {processes.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.numero_protocolo || i.orgao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
          {template && (
            <section className="crm-card p-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF6A13] text-xs font-bold text-white">
                  3
                </span>
                <h2 className="font-bold">Campos</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do documento</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                {placeholders.map((key) => (
                  <div key={key} className="space-y-2">
                    <Label className="font-mono text-xs">{`{{${key}}}`}</Label>
                    {['texto', 'escopo'].includes(key) ? (
                      <Textarea
                        value={values[key] || ''}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      />
                    ) : (
                      <Input
                        value={values[key] || ''}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={generate}
              disabled={!template || saving}
              className="flex-1 bg-[#FF6A13] hover:bg-[#E85B06]"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Gerando...' : 'Gerar documento'}
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!template}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir / PDF
            </Button>
          </div>
          {saved && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Documento salvo
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSignatureOpen(true)}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Enviar para assinatura
                </Button>
                {saved.status === 'enviado_assinatura' && (
                  <Button size="sm" onClick={markSigned}>
                    Marcar assinado
                  </Button>
                )}
              </div>
            </div>
          )}
        </aside>
        <section className="overflow-auto rounded-xl border bg-[#D9D9D9] p-3 sm:p-6">
          <article
            id="print-document"
            className="relative mx-auto min-h-[1123px] w-full max-w-[794px] bg-white p-[56px] shadow-2xl sm:p-[72px]"
          >
            <header className="flex items-end justify-between border-b-4 border-[#FF6A13] pb-4">
              <img src={logo} alt="AEROCAD" className="w-52" />
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#737373]">
                  CONSULTORIA & AEROPORTOS
                </p>
                <p className="mt-1 font-mono text-xs text-[#595959]">
                  {project?.numero || 'DOCUMENTO AEROCAD'}
                </p>
              </div>
            </header>
            <div
              className="document-body prose prose-sm mt-12 max-w-none text-[#424242]"
              dangerouslySetInnerHTML={{
                __html:
                  html ||
                  '<div style="text-align:center;padding:120px 20px;color:#999"><h2>Pré-visualização A4</h2><p>Escolha um modelo para começar.</p></div>',
              }}
            />
            <footer className="absolute bottom-10 left-[56px] right-[56px] border-t pt-3 text-[9px] text-[#8A8A8A] sm:left-[72px] sm:right-[72px]">
              <div className="flex justify-between">
                <span>AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA · CNPJ 28.036.597/0001-43</span>
                <span>AEROCAD · gerado em {formatDate(new Date())}</span>
              </div>
              <p className="mt-1">
                SBS Quadra 2, Sala 206, Ed. Prime Business Convenience, Brasília-DF · +55 61 9
                8462-8800 · contato@aerocad.com.br
              </p>
            </footer>
          </article>
        </section>
      </div>
      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link para assinatura</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Cole o link manual da plataforma de assinatura</Label>
            <Input
              type="url"
              value={signatureLink}
              onChange={(e) => setSignatureLink(e.target.value)}
              placeholder="https://"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignatureOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={sendSignature}>Salvar e marcar como enviado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
