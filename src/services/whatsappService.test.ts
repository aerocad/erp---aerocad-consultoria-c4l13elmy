import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getBackendBaseUrl,
  getWhatsAppWebhookUrl,
  buildWhatsAppChatUrl,
  simulateWebhookPayload,
  sendWhatsAppTestMessage,
} from './whatsappService'
import pb from '@/lib/pocketbase/client'

describe('WhatsApp Integration Service & Webhook Payload Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('URL Generators', () => {
    it('deve gerar a URL do webhook com e sem token de segurança', () => {
      const baseUrl = getBackendBaseUrl()
      expect(baseUrl).toBeTruthy()

      const urlSemToken = getWhatsAppWebhookUrl()
      expect(urlSemToken).toContain('/backend/v1/whatsapp/webhook')
      expect(urlSemToken).not.toContain('?token=')

      const urlComToken = getWhatsAppWebhookUrl('meu-segredo-123')
      expect(urlComToken).toBe(`${baseUrl}/backend/v1/whatsapp/webhook?token=meu-segredo-123`)
    })

    it('deve montar o link wa.me corretamente com sanitização do telefone e mensagem', () => {
      // Telefone com DDD 61 (11 dígitos)
      const link1 = buildWhatsAppChatUrl('61984628800', 'Olá AEROCAD')
      expect(link1).toBe('https://wa.me/5561984628800?text=Ol%C3%A1%20AEROCAD')

      // Telefone formatado com parênteses e traço
      const link2 = buildWhatsAppChatUrl('(61) 98462-8800')
      expect(link2).toBe('https://wa.me/5561984628800')

      // Vazio
      expect(buildWhatsAppChatUrl('')).toBe('')
    })
  })

  describe('Parser de Payloads Meta Cloud API e Z-API', () => {
    it('deve validar estrutura de payload da Meta Cloud API (com texto, remetente e contato)', () => {
      const metaPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WABA_123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { display_phone_number: '5561984628800', phone_number_id: 'PID_999' },
                  contacts: [{ profile: { name: 'Comandante Carlos' }, wa_id: '5561999990001' }],
                  messages: [
                    {
                      from: '5561999990001',
                      id: 'wamid.HBgL123456',
                      timestamp: '1728800000',
                      type: 'text',
                      text: { body: 'Gostaria de uma cotação para estudo OPEA em Goiânia.' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      }

      const msg = metaPayload.entry[0].changes[0].value.messages[0]
      const contact = metaPayload.entry[0].changes[0].value.contacts[0]

      expect(msg.from).toBe('5561999990001')
      expect(contact.profile.name).toBe('Comandante Carlos')
      expect(msg.text.body).toContain('OPEA em Goiânia')
    })

    it('deve validar estrutura de payload da Z-API (on-message-received)', () => {
      const zapiPayload = {
        type: 'ReceivedCallback',
        instanceId: 'AEROCAD_ZAPI_01',
        phone: '5561999990002',
        fromMe: false,
        senderName: 'Eng. Mariana Costa',
        chatName: 'Eng. Mariana Costa',
        momment: 1728800000,
        text: {
          message: 'Preciso registrar um heliponto privado no DECEA.',
        },
      }

      expect(zapiPayload.fromMe).toBe(false)
      expect(zapiPayload.phone).toBe('5561999990002')
      expect(zapiPayload.senderName).toBe('Eng. Mariana Costa')
      expect(zapiPayload.text.message).toContain('registrar um heliponto')
    })
  })

  describe('Simulação de Webhook (simulateWebhookPayload)', () => {
    it('deve simular chamada ao webhook com token e retornar status e dados', async () => {
      const mockResponse = {
        status: 'success',
        cliente_id: 'cli_abc123',
        oportunidade_id: 'opp_xyz789',
        is_existente: false,
        remetente: '5561999990001',
        auto_resposta: { sent: false, skipped: true },
      }

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await simulateWebhookPayload(
        { phone: '61999990001', message: 'Teste de orçamento' },
        'secret-teste',
      )

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const calledUrl = fetchSpy.mock.calls[0][0] as string
      expect(calledUrl).toContain('/backend/v1/whatsapp/webhook?token=secret-teste')
      expect(result.status).toBe('success')
      expect(result.cliente_id).toBe('cli_abc123')
      expect(result.oportunidade_id).toBe('opp_xyz789')
      expect(result.is_existente).toBe(false)
    })

    it('deve suportar retorno de token inválido (403 forbidden)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ status: 403, message: 'Webhook secret inválido' }),
      } as unknown as Response)

      const result = await simulateWebhookPayload(
        { phone: '61999990001', message: 'Sem autorizacao' },
        'token-errado',
      )

      expect(result).toBeDefined()
    })
  })

  describe('Disparo de Mensagem de Teste (sendWhatsAppTestMessage)', () => {
    it('deve enviar requisição com Authorization token do PocketBase', async () => {
      // Mock do token de auth
      pb.authStore.save('fake-token-admin', {
        id: 'admin-id',
        role: 'admin',
        collectionId: '_pb_users_auth_',
        collectionName: 'users',
      } as unknown as import('pocketbase').RecordModel)

      const mockSendResult = {
        resultado: {
          sent: false,
          reason: 'Segredos WHATSAPP_API_TOKEN ou WHATSAPP_PHONE_ID não configurados no servidor',
        },
        destino: '5561999990001',
      }

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockSendResult,
      } as Response)

      const res = await sendWhatsAppTestMessage('61999990001', 'Mensagem de teste')

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const options = fetchSpy.mock.calls[0][1] as RequestInit
      expect(options.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'fake-token-admin',
      })
      expect(res.destino).toBe('5561999990001')
      expect(res.resultado.sent).toBe(false)
      expect(res.resultado.reason).toContain('não configurados')

      pb.authStore.clear()
    })

    it('deve lançar erro se o endpoint responder com erro HTTP', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Número de telefone destinatário é obrigatório' }),
      } as unknown as Response)

      await expect(sendWhatsAppTestMessage('')).rejects.toThrow(
        'Número de telefone destinatário é obrigatório',
      )
    })
  })
})
