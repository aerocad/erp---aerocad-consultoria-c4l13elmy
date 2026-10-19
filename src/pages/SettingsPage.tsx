import { useState, type FormEvent } from 'react'
import {
  Eye,
  FileSpreadsheet,
  FileText,
  Info,
  Pencil,
  Plus,
  Save,
  Shield,
  UserCheck,
  UserRound,
  XCircle,
  MessageSquare,
  Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { ImportacaoWizard } from '@/components/importacao/ImportacaoWizard'
import { WhatsAppSettingsSection } from '@/components/settings/WhatsAppSettingsSection'
import { ExportarDadosSection } from '@/components/settings/ExportarDadosSection'
import { DadosEmpresaSection } from '@/components/settings/DadosEmpresaSection'
import { ContasBancariasTab } from '@/components/financeiro/ContasBancariasTab'
import { GestaoUsuariosAdminSection } from '@/components/settings/GestaoUsuariosAdminSection'

import { CrmBadge } from '@/components/common/CrmBadge'
import { ErrorState, PageLoading } from '@/components/common/States'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useCrmData } from '@/hooks/use-crm-data'
import { roleLabels } from '@/lib/crm'
import { formatCurrency, initials } from '@/lib/format'
import pb from '@/lib/pocketbase/client'
import { createOne, updateOne } from '@/services/api'
import type {
  ContaBancariaRecord,
  ModeloRecord,
  Role,
  SequenciaRecord,
  ServiceRecord,
  UserRecord,
} from '@/types/crm'

export default function SettingsPage() {
  const {
    user,
    rawUser,
    isSimulating,
    simulatedRole,
    startSimulation,
    stopSimulation,
    refreshUser,
  } = useAuth()
  const users = useCrmData<UserRecord>('users', { sort: 'name' })
  const templates = useCrmData<ModeloRecord>('modelos_documentos', { sort: 'nome' })
  const services = useCrmData<ServiceRecord>('servicos_catalogo', { sort: 'codigo' })
  const sequences = useCrmData<SequenciaRecord>('sequencias', { sort: 'chave' })
  const contasBancarias = useCrmData<ContaBancariaRecord>('contas_bancarias', { sort: 'apelido' })
  const isRealAdmin = rawUser?.role === 'admin'
  const isAdmin = user?.role === 'admin'
  const [templateOpen, setTemplateOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ModeloRecord | null>(null)
  const [tpl, setTpl] = useState({ nome: '', categoria: 'outro', corpo: '' })
  const [service, setService] = useState<ServiceRecord | null>(null)
  const [accountName, setAccountName] = useState(user?.name || '')
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  if (users.loading || templates.loading || services.loading || sequences.loading)
    return <PageLoading />
  if (users.error) return <ErrorState onRetry={() => void users.reload()} />
  function openTemplate(item?: ModeloRecord) {
    setEditingTemplate(item || null)
    setTpl(
      item
        ? { nome: item.nome, categoria: item.categoria, corpo: item.corpo }
        : { nome: '', categoria: 'outro', corpo: '' },
    )
    setTemplateOpen(true)
  }
  async function saveTemplate(e: FormEvent) {
    e.preventDefault()
    try {
      if (editingTemplate) {
        await updateOne('modelos_documentos', editingTemplate.id, tpl)
      } else {
        await createOne('modelos_documentos', tpl)
      }
      toast.success('Modelo salvo')
      setTemplateOpen(false)
      void templates.reload()
    } catch {
      toast.error('Não foi possível salvar o modelo')
    }
  }
  async function saveService() {
    if (!service) return
    try {
      await updateOne('servicos_catalogo', service.id, {
        nome: service.nome,
        faixa_min: Number(service.faixa_min),
        faixa_max: Number(service.faixa_max),
        preco_padrao: Number(service.preco_padrao),
        prazo_tipico: service.prazo_tipico,
        base_normativa: service.base_normativa,
        desconto_pacote_percentual: Number(service.desconto_pacote_percentual),
      })
      toast.success('Serviço atualizado')
      setService(null)
      void services.reload()
    } catch {
      toast.error('Não foi possível atualizar o serviço')
    }
  }
  async function updateRole(record: UserRecord, role: string) {
    if (rawUser?.id === record.id) {
      toast.error('Você não pode alterar seu próprio perfil. Utilize a opção "Simular perfil".')
      return
    }
    try {
      await updateOne('users', record.id, { role })
      toast.success('Perfil atualizado com sucesso')
      void users.reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível alterar o perfil'
      toast.error(msg)
    }
  }
  async function saveAccount() {
    try {
      await updateOne('users', user!.id, { name: accountName })
      await refreshUser()
      toast.success('Perfil atualizado')
    } catch {
      toast.error('Não foi possível atualizar o perfil')
    }
  }
  async function requestEmail() {
    if (!newEmail) return
    try {
      await pb.collection('users').requestEmailChange(newEmail, { requestKey: null })
      toast.success('Link de confirmação enviado ao novo e-mail')
    } catch {
      toast.error('Não foi possível solicitar a troca de e-mail')
    }
  }
  async function changePassword() {
    if (password.length < 8 || password !== confirm)
      return toast.error('As senhas devem coincidir e ter ao menos 8 caracteres')
    try {
      await updateOne('users', user!.id, {
        oldPassword: 'Skip@Pass',
        password,
        passwordConfirm: confirm,
      })
      setPassword('')
      setConfirm('')
      toast.success('Senha alterada')
    } catch {
      toast.error('Informe a senha atual correta pelo fluxo de recuperação, se necessário')
    }
  }
  return (
    <div>
      <SectionHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Configurações"
        description="Usuários, catálogo, documentos e numeração segura."
      />
      <Tabs defaultValue="usuarios">
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-white p-1">
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="conta">Minha conta</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
          <TabsTrigger value="servicos">Serviços e preços</TabsTrigger>
          <TabsTrigger value="numeracao">Numeração</TabsTrigger>
          <TabsTrigger
            value="contas_bancarias"
            className="flex items-center gap-1.5 font-semibold text-[#D65100]"
          >
            <Shield className="h-3.5 w-3.5" />
            Contas Bancárias PJ
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger
                value="empresa"
                className="flex items-center gap-1.5 font-semibold text-[#D65100]"
              >
                <Building2 className="h-3.5 w-3.5" />
                Dados da Empresa (AEROCAD)
              </TabsTrigger>
              <TabsTrigger
                value="whatsapp"
                className="flex items-center gap-1.5 font-semibold text-[#D65100]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                WhatsApp (Artesanal)
              </TabsTrigger>
              <TabsTrigger
                value="importacao"
                className="flex items-center gap-1.5 font-semibold text-[#D65100]"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Importação
              </TabsTrigger>
              <TabsTrigger
                value="exportacao"
                className="flex items-center gap-1.5 font-semibold text-[#D65100]"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Exportar Dados
              </TabsTrigger>
            </>
          )}
        </TabsList>
        <TabsContent value="usuarios">
          <GestaoUsuariosAdminSection
            users={users.data}
            rawUser={rawUser}
            isRealAdmin={isRealAdmin}
            isSimulating={isSimulating}
            simulatedRole={simulatedRole}
            startSimulation={startSimulation}
            stopSimulation={stopSimulation}
            onReload={async () => {
              void users.reload()
            }}
          />
        </TabsContent>
        <TabsContent value="conta">
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="crm-card p-5">
              <div className="flex items-center gap-3">
                <UserRound className="h-5 w-5 text-[#FF6A13]" />
                <h2 className="font-bold">Perfil</h2>
              </div>
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                </div>
                <Button onClick={saveAccount}>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar perfil
                </Button>
              </div>
            </section>
            <section className="crm-card p-5">
              <h2 className="font-bold">Trocar e-mail</h2>
              <p className="mt-1 text-sm text-[#737373]">
                A confirmação será enviada ao novo endereço.
              </p>
              <div className="mt-4 flex gap-2">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="novo@aerocad.com.br"
                />
                <Button onClick={requestEmail}>Solicitar</Button>
              </div>
              <h2 className="mt-8 font-bold">Alterar senha</h2>
              <div className="mt-4 space-y-3">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nova senha"
                />
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirmar nova senha"
                />
                <Button variant="outline" onClick={changePassword}>
                  Alterar senha
                </Button>
              </div>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="modelos">
          <section className="crm-card overflow-hidden">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="font-bold">Modelos de documentos</h2>
                <p className="text-sm text-[#737373]">
                  Use placeholders no formato <code>{'{{campo}}'}</code>.
                </p>
              </div>
              <Button onClick={() => openTemplate()}>
                <Plus className="mr-2 h-4 w-4" />
                Novo modelo
              </Button>
            </div>
            <div className="divide-y">
              {templates.data.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-[#FF6A13]" />
                    <div>
                      <p className="font-semibold">{item.nome}</p>
                      <p className="text-xs uppercase text-[#8A8A8A]">{item.categoria}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openTemplate(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
        <TabsContent value="servicos">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {services.data.map((item) => (
              <article key={item.id} className="crm-card p-5">
                <div className="flex items-start justify-between">
                  <span className="mono-value font-black text-[#D65100]">{item.codigo}</span>
                  <Button variant="ghost" size="icon" onClick={() => setService(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <h2 className="mt-2 font-bold">{item.nome}</h2>
                <p className="mono-value mt-4 text-xl font-bold">
                  {formatCurrency(item.preco_padrao)}
                </p>
                <p className="mt-1 text-xs text-[#737373]">
                  Faixa: {formatCurrency(item.faixa_min)} a {formatCurrency(item.faixa_max)}
                </p>
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs text-[#737373]">
                    {item.base_normativa} · {item.prazo_tipico}
                  </p>
                  <CrmBadge tone="orange" className="mt-2">
                    Pacote 3+: {item.desconto_pacote_percentual}%
                  </CrmBadge>
                </div>
              </article>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="numeracao">
          <section className="crm-card overflow-hidden">
            <div className="border-b p-5">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-[#FF6A13]" />
                <div>
                  <h2 className="font-bold">Sequências transacionais</h2>
                  <p className="text-sm text-[#737373]">
                    Contadores globais por chave e ano; mutação exclusiva pelos hooks do servidor.
                  </p>
                </div>
              </div>
            </div>
            <div className="divide-y">
              {sequences.data.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-5">
                  <div>
                    <p className="font-semibold">{item.chave.replaceAll('_', ' ')}</p>
                    <p className="text-xs text-[#8A8A8A]">Ano {item.ano}</p>
                  </div>
                  <div className="text-right">
                    <p className="technical-label">PRÓXIMO</p>
                    <p className="mono-value text-xl font-bold text-[#D65100]">
                      {String(item.atual + 1).padStart(3, '0')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
        <TabsContent value="contas_bancarias">
          <ContasBancariasTab
            contas={contasBancarias.data}
            canWrite={isRealAdmin || rawUser?.role === 'financeiro'}
            canDelete={isRealAdmin}
            onReload={async () => {
              void contasBancarias.reload()
            }}
          />
        </TabsContent>
        {isAdmin && (
          <>
            <TabsContent value="empresa">
              <DadosEmpresaSection />
            </TabsContent>
            <TabsContent value="whatsapp">
              <WhatsAppSettingsSection />
            </TabsContent>
            <TabsContent value="importacao">
              <div className="crm-card p-6">
                <ImportacaoWizard />
              </div>
            </TabsContent>
            <TabsContent value="exportacao">
              <ExportarDadosSection />
            </TabsContent>
          </>
        )}
      </Tabs>
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Editar modelo' : 'Novo modelo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveTemplate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={tpl.nome}
                onChange={(e) => setTpl((v) => ({ ...v, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={tpl.categoria}
                onValueChange={(categoria) => setTpl((v) => ({ ...v, categoria }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    'contrato',
                    'proposta',
                    'ordem_servico',
                    'oficio',
                    'procuracao',
                    'requerimento',
                    'recibo',
                    'outro',
                  ].map((i) => (
                    <SelectItem key={i} value={i}>
                      {i.replaceAll('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Corpo HTML com placeholders</Label>
              <Textarea
                className="min-h-64 font-mono text-xs"
                value={tpl.corpo}
                onChange={(e) => setTpl((v) => ({ ...v, corpo: e.target.value }))}
              />
              <p className="text-xs text-[#8A8A8A]">
                Ex.: {'{{cliente.razao_social}} · {{projeto.numero}} · {{data_hoje}}'}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTemplateOpen(false)}>
                Cancelar
              </Button>
              <Button>Salvar modelo</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(service)} onOpenChange={(v) => !v && setService(null)}>
        <DialogContent>
          {service && (
            <>
              <DialogHeader>
                <DialogTitle>Editar {service.codigo}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={service.nome}
                    onChange={(e) => setService({ ...service, nome: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Faixa mínima</Label>
                    <Input
                      type="number"
                      value={service.faixa_min}
                      onChange={(e) =>
                        setService({ ...service, faixa_min: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Faixa máxima</Label>
                    <Input
                      type="number"
                      value={service.faixa_max}
                      onChange={(e) =>
                        setService({ ...service, faixa_max: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Preço padrão</Label>
                    <Input
                      type="number"
                      value={service.preco_padrao}
                      onChange={(e) =>
                        setService({ ...service, preco_padrao: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Base normativa</Label>
                  <Input
                    value={service.base_normativa}
                    onChange={(e) => setService({ ...service, base_normativa: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Desconto para pacote (%)</Label>
                  <Input
                    type="number"
                    value={service.desconto_pacote_percentual}
                    onChange={(e) =>
                      setService({ ...service, desconto_pacote_percentual: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setService(null)}>
                  Cancelar
                </Button>
                <Button onClick={saveService}>Salvar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
