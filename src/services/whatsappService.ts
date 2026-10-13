import pb from '@/lib/pocketbase/client'
import type { WhatsAppConfigRecord, WhatsAppProvider } from '@/types/crm'

export interface WhatsAppTestSendResponse {
  resultado: {
    sent: boolean
    provider?: string
    reason?: string
    error?: string
    statusCode?: number
    response?: unknown
  }
  destino: string
}

export interface WebhookSimulationResponse {
  status: string
  cliente_id?: string
  oportunidade_id?: string
  is_existente?: boolean
  remetente?: string
  auto_resposta?: {
    sent: boolean
    skipped?: boolean
    reason?: string
    error?: string
  }
  error?: string
}

/**
 * Obtém a URL base do backend PocketBase.
 * Conforme regras do Skip Cloud, o backend é acessível publicamente via VITE_POCKETBASE_URL.
 */
export function getBackendBaseUrl(): string {
  const envUrl = import.meta.env.VITE_POCKETBASE_URL
  if (envUrl) {
    return envUrl.replace(/\/+$/, '')
  }
  return window.location.origin
}

/**
 * Gera a URL completa do Webhook de WhatsApp para cadastrar no provedor (Meta, Z-API, etc.)
 */
export function getWhatsAppWebhookUrl(secretToken?: string): string {
  const baseUrl = getBackendBaseUrl()
  const path = `${baseUrl}/backend/v1/whatsapp/webhook`
  if (secretToken) {
    return `${path}?token=${encodeURIComponent(secretToken)}`
  }
  return path
}

/**
 * Monta link do wa.me direto com mensagem opcional
 */
export function buildWhatsAppChatUrl(phone?: string, text?: string): string {
  if (!phone) return ''
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = `55${cleaned}`
  }
  let url = `https://wa.me/${cleaned}`
  if (text) {
    url += `?text=${encodeURIComponent(text)}`
  }
  return url
}

/**
 * Busca a configuração padrão do WhatsApp
 */
export async function getWhatsAppConfig(): Promise<WhatsAppConfigRecord | null> {
  try {
    const record = await pb
      .collection('whatsapp_config')
      .getFirstListItem<WhatsAppConfigRecord>('chave = "default"')
    return record
  } catch {
    return null
  }
}

/**
 * Atualiza parâmetros da configuração do WhatsApp
 */
export async function updateWhatsAppConfig(
  id: string,
  data: Partial<{
    provider: WhatsAppProvider
    webhook_secret: string
    auto_resposta_ativa: boolean
    mensagem_auto_resposta: string
    numero_empresa: string
    observacoes: string
  }>,
): Promise<WhatsAppConfigRecord> {
  return await pb.collection('whatsapp_config').update<WhatsAppConfigRecord>(id, data)
}

/**
 * Envia mensagem de teste autenticada via backend pb_hook
 */
export async function sendWhatsAppTestMessage(
  phone: string,
  message?: string,
): Promise<WhatsAppTestSendResponse> {
  const baseUrl = getBackendBaseUrl()
  const res = await fetch(`${baseUrl}/backend/v1/whatsapp/test-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({ phone, message }),
  })

  const payload = await res.json()
  if (!res.ok) {
    throw new Error(payload?.error || `Falha no envio de teste (HTTP ${res.status})`)
  }
  return payload as WhatsAppTestSendResponse
}

/**
 * Simula webhook local/sintético para validar criação de Oportunidade sem chaves configuradas
 */
export async function simulateWebhookPayload(
  payload: Record<string, unknown>,
  token?: string,
): Promise<WebhookSimulationResponse> {
  const baseUrl = getBackendBaseUrl()
  const url = token
    ? `${baseUrl}/backend/v1/whatsapp/webhook?token=${encodeURIComponent(token)}`
    : `${baseUrl}/backend/v1/whatsapp/webhook`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const json = await res.json()
  return json as WebhookSimulationResponse
}
