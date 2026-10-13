import { useState, useEffect } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  Info,
  KeyRound,
  MessageSquare,
  PlayCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { CrmBadge } from '@/components/common/CrmBadge'
import {
  getWhatsAppConfig,
  updateWhatsAppConfig,
  getWhatsAppWebhookUrl,
  sendWhatsAppTestMessage,
  simulateWebhookPayload,
  type WhatsAppTestSendResponse,
  type WebhookSimulationResponse,
} from '@/services/whatsappService'
import type { WhatsAppConfigRecord, WhatsAppProvider } from '@/types/crm'

export function WhatsAppSettingsSection() {
  const [config, setConfig] = useState<WhatsAppConfigRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)

  // Campos locais de formulário
  const [provider, setProvider] = useState<WhatsAppProvider>('meta')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [autoRespostaAtiva, setAutoRespostaAtiva] = useState(false)
  const [mensagemAutoResposta, setMensagemAutoResposta] = useState('')
  const [numeroEmpresa, setNumeroEmpresa] = useState('')

  // Teste de envio
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [testingSend, setTestingSend] = useState(false)
  const [lastTestResult, setLastTestResult] = useState<WhatsAppTestSendResponse | null>(null)

  // Simulação sintética de webhook
  const [simulating, setSimulating] = useState(false)
  const [simResult, setSimResult] = useState<WebhookSimulationResponse | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    setLoading(true)
    try {
      const rec = await getWhatsAppConfig()
      if (rec) {
        setConfig(rec)
        setProvider(rec.provider || 'meta')
        setWebhookSecret(rec.webhook_secret || '')
        setAutoRespostaAtiva(Boolean(rec.auto_resposta_ativa))
        setMensagemAutoResposta(rec.mensagem_auto_resposta || '')
        setNumeroEmpresa(rec.numero_empresa || '+55 61 9 8462-8800')
      }
    } catch {
      toast.error('Erro ao carregar configurações do WhatsApp')
    } finally {
      setLoading(false)
    }
  }

  const fullWebhookUrl = getWhatsAppWebhookUrl(webhookSecret)

  function copyToClipboard(text: string, type: 'url' | 'secret') {
    navigator.clipboard.writeText(text)
    if (type === 'url') {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } else {
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2000)
    }
    toast.success('Copiado para a área de transferência')
  }

  function regenerateSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setWebhookSecret(token)
    toast.info('Novo token gerado! Clique em "Salvar alterações" para aplicar.')
  }

  async function handleSave() {
    if (!config?.id) return
    setSaving(true)
    try {
      const updated = await updateWhatsAppConfig(config.id, {
        provider,
        webhook_secret: webhookSecret,
        auto_resposta_ativa: autoRespostaAtiva,
        mensagem_auto_resposta: mensagemAutoResposta,
        numero_empresa: numeroEmpresa,
      })
      setConfig(updated)
      toast.success('Configurações do WhatsApp salvas com sucesso')
    } catch {
      toast.error('Não foi possível salvar as configurações')
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSend() {
    if (!testPhone.trim()) {
      return toast.error('Informe um número de telefone com DDD para testar')
    }
    setTestingSend(true)
    setLastTestResult(null)
    try {
      const res = await sendWhatsAppTestMessage(testPhone, testMessage || undefined)
      setLastTestResult(res)
      if (res.resultado.sent) {
        toast.success(`Mensagem enviada com sucesso para ${res.destino}!`)
      } else {
        toast.warning(
          res.resultado.reason ||
            'Envio não concluído (verifique se os segredos estão configurados)',
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar mensagem de teste'
      toast.error(msg)
    } finally {
      setTestingSend(false)
    }
  }

  async function handleSimulateWebhook(tipo: 'meta' | 'zapi') {
    setSimulating(true)
    setSimResult(null)
    try {
      const samplePhone = '61984628800'
      const sampleName = 'Cliente Teste ' + (tipo === 'meta' ? 'Meta' : 'Z-API')
      const sampleMsg =
        'Olá AEROCAD! Gostaria de um orçamento para estudo de viabilidade OPEA em Brasília.'

      let payload: Record<string, unknown> = {}

      if (tipo === 'meta') {
        payload = {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '61984628800', phone_number_id: 'PHONE_ID' },
                    contacts: [{ profile: { name: sampleName }, wa_id: samplePhone }],
                    messages: [
                      {
                        from: samplePhone,
                        id: 'wamid.HBgL' + Date.now(),
                        timestamp: String(Math.floor(Date.now() / 1000)),
                        type: 'text',
                        text: { body: sampleMsg },
                      },
                    ],
                  },
                  field: 'messages',
                },
              ],
            },
          ],
        }
      } else {
        // Z-API
        payload = {
          type: 'ReceivedCallback',
          instanceId: 'AEROCAD_INSTANCE',
          phone: '55' + samplePhone,
          fromMe: false,
          senderName: sampleName,
          chatName: sampleName,
          momment: Date.now(),
          text: {
            message: sampleMsg,
          },
        }
      }

      const res = await simulateWebhookPayload(payload, webhookSecret)
      setSimResult(res)
      if (res.status === 'success') {
        toast.success(
          'Simulação concluída! Oportunidade e cliente criados/vinculados com sucesso no funil.',
        )
      } else {
        toast.info(`Retorno do webhook: ${res.status}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na simulação'
      toast.error(msg)
    } finally {
      setSimulating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-[#FF6A13]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Banner de contexto: Integração Artesanal */}
      <div className="rounded-xl border border-[#FF6A13]/20 bg-gradient-to-r from-[#FFF5ED] via-white to-[#FFF5ED] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#FF6A13] p-2 text-white">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-zinc-900">
                  WhatsApp / Integração Artesanal (SDR & Funil)
                </h3>
                <CrmBadge tone="orange">Ativo</CrmBadge>
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                Ponte agnóstica via API e Webhooks que conecta o WhatsApp institucional da AEROCAD
                diretamente ao funil de vendas, qualificando leads de cotação/orçamento e
                alimentando o CRM em tempo real com triagem de IA humanizada.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Painel Esquerdo: URL do Webhook e Configurações */}
        <div className="crm-card space-y-5 p-5">
          <div className="flex items-center gap-2 border-b pb-3">
            <KeyRound className="h-4 w-4 text-[#FF6A13]" />
            <h4 className="font-bold text-sm">Endpoint de Webhook de Entrada</h4>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-zinc-700">
              URL DO WEBHOOK (Cole no painel do seu provedor de WhatsApp)
            </Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={fullWebhookUrl}
                className="font-mono text-xs bg-zinc-50 select-all"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(fullWebhookUrl, 'url')}
                title="Copiar URL"
              >
                {copiedUrl ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Rota pública segura no backend Skip Cloud PocketBase que recebe eventos de novas
              mensagens.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-zinc-700">
                TOKEN / SEGREDO DE VALIDAÇÃO (Path & Header)
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-[#D65100]"
                onClick={regenerateSecret}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Regenerar token
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Token de segurança do webhook"
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookSecret, 'secret')}
                title="Copiar Token"
              >
                {copiedSecret ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Validado via <code>?token=...</code>, <code>?hub.verify_token=...</code> ou cabeçalho{' '}
              <code>X-Webhook-Secret</code>.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-zinc-700">PROVEDOR WHATSAPP</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as WhatsAppProvider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meta">Meta WhatsApp Cloud API (Oficial Graph API)</SelectItem>
                <SelectItem value="zapi">Z-API / UmbraWeb (API parceira)</SelectItem>
                <SelectItem value="outro">Outro / Gateway Genérico HTTP</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-zinc-500">
              O parser detecta automaticamente se o payload recebido é da Meta ou Z-API, tolerando
              qualquer formato.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-zinc-700">
              NÚMERO INSTITUCIONAL DA EMPRESA
            </Label>
            <Input
              value={numeroEmpresa}
              onChange={(e) => setNumeroEmpresa(e.target.value)}
              placeholder="+55 61 9 8462-8800"
            />
            <p className="text-[11px] text-zinc-500">
              O número oficial da AEROCAD permanece o mesmo da empresa por ora.
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-[#FF6A13] hover:bg-[#E85B06]"
            >
              {saving ? 'Salvando...' : 'Salvar configurações do WhatsApp'}
            </Button>
          </div>
        </div>

        {/* Painel Direito: Resposta Automática SDR e Testes */}
        <div className="space-y-6">
          {/* Caixa de Resposta Automática */}
          <div className="crm-card space-y-4 p-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#FF6A13]" />
                <h4 className="font-bold text-sm">Resposta Automática (SDR de IA)</h4>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="toggle-auto-reply" className="text-xs text-zinc-600">
                  {autoRespostaAtiva ? 'Ativa' : 'Desativada'}
                </Label>
                <Switch
                  id="toggle-auto-reply"
                  checked={autoRespostaAtiva}
                  onCheckedChange={setAutoRespostaAtiva}
                />
              </div>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Quando ativada, o SDR envia o primeiro contato humanizado apresentando a AEROCAD e
              perguntando o serviço (OPEA, registro de aeródromo/heliponto etc.), sempre assinado
              como <strong>"assistente da AEROCAD"</strong> (sem fingir ser humano nem prometer
              prazo/valor).
            </p>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-zinc-700">
                MENSAGEM BASE / TEMPLATE DE FALLBACK
              </Label>
              <Textarea
                rows={4}
                value={mensagemAutoResposta}
                onChange={(e) => setMensagemAutoResposta(e.target.value)}
                className="text-xs leading-relaxed"
                placeholder="Texto da mensagem de primeiro contato..."
              />
              <p className="text-[11px] text-zinc-500">
                Se a IA estiver ativa, ela adapta cordialmente com base na pergunta do cliente; caso
                contrário, este template é enviado com fallback.
              </p>
            </div>
          </div>

          {/* Testes e Diagnóstico */}
          <div className="crm-card space-y-4 p-5">
            <div className="flex items-center gap-2 border-b pb-3">
              <Send className="h-4 w-4 text-[#FF6A13]" />
              <h4 className="font-bold text-sm">Diagnóstico & Teste de Disparo</h4>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Número de telefone para teste (com DDD)</Label>
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Ex.: 61984628800"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Mensagem personalizada (opcional)</Label>
                <Input
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Mensagem de teste da integração..."
                  className="text-xs"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleTestSend}
                disabled={testingSend}
                className="w-full text-xs"
              >
                {testingSend ? 'Enviando teste...' : 'Enviar mensagem de teste via API do Provedor'}
              </Button>

              {lastTestResult && (
                <div
                  className={`rounded-lg border p-3 text-xs ${
                    lastTestResult.resultado.sent
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  <p className="font-semibold">
                    {lastTestResult.resultado.sent
                      ? 'Disparo realizado com sucesso'
                      : 'Resultado do teste:'}
                  </p>
                  <p className="mt-1">
                    {lastTestResult.resultado.reason ||
                      lastTestResult.resultado.error ||
                      'Mensagem processada pelo provedor.'}
                  </p>
                </div>
              )}
            </div>

            {/* Simulação sintética de webhook */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-zinc-700">
                  SIMULAR WEBHOOK SINTÉTICO (Cria Oportunidade no Funil)
                </Label>
              </div>
              <p className="text-[11px] text-zinc-500">
                Dispara um payload de exemplo direto no endpoint local para validar a triagem
                automática de novos leads mesmo sem chaves externas conectadas:
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={simulating}
                  onClick={() => handleSimulateWebhook('meta')}
                  className="flex-1 text-xs"
                >
                  <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                  Testar Payload Meta
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={simulating}
                  onClick={() => handleSimulateWebhook('zapi')}
                  className="flex-1 text-xs"
                >
                  <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                  Testar Payload Z-API
                </Button>
              </div>

              {simResult && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-900">
                  <p className="font-semibold">Simulação de Entrada Bem-sucedida!</p>
                  <p className="mt-1">
                    Cliente ID: <code>{simResult.cliente_id}</code> | Oportunidade ID:{' '}
                    <code>{simResult.oportunidade_id}</code>
                  </p>
                  <p className="text-[11px] text-blue-700 mt-1">
                    Verifique no menu <strong>Funil</strong> para ver o card com a badge de
                    WhatsApp!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Instruções passo a passo de configuração por provedor */}
      <div className="crm-card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <ShieldCheck className="h-4 w-4 text-[#FF6A13]" />
          <h4 className="font-bold text-sm">Guia Passo a Passo: Configuração nos Provedores</h4>
        </div>

        <div className="grid gap-4 md:grid-cols-2 text-xs">
          <div className="rounded-lg border bg-zinc-50/50 p-4 space-y-2">
            <div className="flex items-center gap-2 font-bold text-zinc-900">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF6A13] text-[10px] text-white">
                1
              </span>
              <span>Meta WhatsApp Cloud API (Oficial)</span>
            </div>
            <ol className="list-decimal pl-5 space-y-1 text-zinc-600">
              <li>
                Acesse o <strong>Meta for Developers</strong> &gt; seu App &gt; WhatsApp &gt;{' '}
                <em>Configuration</em>.
              </li>
              <li>
                No campo <strong>Callback URL</strong>, cole a URL do Webhook gerada acima.
              </li>
              <li>
                No campo <strong>Verify Token</strong>, cole exatamente o Token de Validação.
              </li>
              <li>
                Clique em <em>Verify and Save</em> e assine os eventos do campo{' '}
                <strong>messages</strong>.
              </li>
              <li>
                Para respostas automáticas ativas, adicione os segredos de ambiente no Skip Cloud:
                <code>WHATSAPP_API_TOKEN</code> (User Access Token) e <code>WHATSAPP_PHONE_ID</code>
                .
              </li>
            </ol>
          </div>

          <div className="rounded-lg border bg-zinc-50/50 p-4 space-y-2">
            <div className="flex items-center gap-2 font-bold text-zinc-900">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF6A13] text-[10px] text-white">
                2
              </span>
              <span>Z-API / UmbraWeb</span>
            </div>
            <ol className="list-decimal pl-5 space-y-1 text-zinc-600">
              <li>
                Acesse o painel da sua instância na Z-API &gt; <em>Webhooks</em>.
              </li>
              <li>
                No evento <strong>Ao receber mensagem (On receive)</strong>, cole a URL do webhook
                acima.
              </li>
              <li>
                Adicione o parâmetro <code>?token=SEU_TOKEN</code> na URL ou configure o cabeçalho{' '}
                <code>X-Webhook-Secret</code>.
              </li>
              <li>
                Para respostas ativas, configure os segredos: <code>WHATSAPP_INSTANCE_ID</code> e{' '}
                <code>WHATSAPP_API_TOKEN</code>.
              </li>
              <li>
                Mantenha a opção <em>Notify sent by me</em> desmarcada para evitar loops.
              </li>
            </ol>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5" />
          <p>
            <strong>Regra de resiliência:</strong> Se os segredos de envio não estiverem
            preenchidos, o webhook de entrada continua funcionando normalmente, criando e
            atualizando oportunidades e clientes no CRM sem travar e sem gerar erros para o cliente
            que enviou a mensagem.
          </p>
        </div>
      </div>
    </div>
  )
}
