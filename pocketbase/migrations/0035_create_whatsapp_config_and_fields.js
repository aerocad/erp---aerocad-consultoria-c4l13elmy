/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0035: WhatsApp Artesanal Integration
 * - Cria coleção whatsapp_config para armazenar parâmetros gerais (provedor, auto-resposta, secret-token do webhook)
 * - Adiciona campos de rastreabilidade na coleção oportunidades (origem_canal, whatsapp_remetente, whatsapp_mensagem)
 * - Garante que regras de acesso permitam admin gerenciar whatsapp_config e leitura para comercial
 */
migrate(
  (app) => {
    const adminOnly = "@request.auth.role = 'admin'"
    const staffRead =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'tecnico' || @request.auth.role = 'financeiro')"

    // 1. Criar coleção whatsapp_config se não existir
    if (!app.hasTable('whatsapp_config')) {
      const configCol = new Collection({
        name: 'whatsapp_config',
        type: 'base',
        listRule: staffRead,
        viewRule: staffRead,
        createRule: adminOnly,
        updateRule: adminOnly,
        deleteRule: adminOnly,
        fields: [
          { name: 'chave', type: 'text', required: true, max: 64 },
          {
            name: 'provider',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['meta', 'zapi', 'outro'],
          },
          { name: 'webhook_secret', type: 'text', max: 128 },
          { name: 'auto_resposta_ativa', type: 'bool' },
          { name: 'mensagem_auto_resposta', type: 'text', max: 2000 },
          { name: 'numero_empresa', type: 'text', max: 32 },
          { name: 'observacoes', type: 'editor', maxSize: 50000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_whatsapp_config_chave ON whatsapp_config (chave)'],
      })
      app.save(configCol)

      // Seed registro padrão se não existir
      const rec = new Record(configCol)
      rec.set('chave', 'default')
      rec.set('provider', 'meta')
      rec.set('webhook_secret', $security.randomString(32))
      rec.set('auto_resposta_ativa', false)
      rec.set(
        'mensagem_auto_resposta',
        'Olá! Sou o assistente da AEROCAD Consultoria Aeronáutica. Recebemos sua mensagem sobre solicitação de cotação/orçamento. Você poderia nos informar qual serviço você precisa (como OPEA, registro de aeródromo/heliponto ou outro estudo aeronáutico)? Em breve nossa equipe comercial dará continuidade ao seu atendimento.',
      )
      rec.set('numero_empresa', '+55 61 9 8462-8800')
      app.save(rec)
    }

    // 2. Adicionar campos opcionais em oportunidades para rastreamento de WhatsApp
    const oportunidades = app.findCollectionByNameOrId('oportunidades')
    if (!oportunidades.fields.getByName('origem_canal')) {
      oportunidades.fields.add(
        new SelectField({
          name: 'origem_canal',
          maxSelect: 1,
          values: ['whatsapp', 'site', 'indicacao', 'email', 'outro'],
        }),
      )
    }
    if (!oportunidades.fields.getByName('whatsapp_remetente')) {
      oportunidades.fields.add(
        new TextField({
          name: 'whatsapp_remetente',
          max: 64,
        }),
      )
    }
    if (!oportunidades.fields.getByName('whatsapp_mensagem')) {
      oportunidades.fields.add(
        new TextField({
          name: 'whatsapp_mensagem',
          max: 4000,
        }),
      )
    }
    app.save(oportunidades)
  },
  (app) => {
    try {
      const configCol = app.findCollectionByNameOrId('whatsapp_config')
      app.delete(configCol)
    } catch (_) {}

    try {
      const oportunidades = app.findCollectionByNameOrId('oportunidades')
      if (oportunidades.fields.getByName('origem_canal')) {
        oportunidades.fields.removeByName('origem_canal')
      }
      if (oportunidades.fields.getByName('whatsapp_remetente')) {
        oportunidades.fields.removeByName('whatsapp_remetente')
      }
      if (oportunidades.fields.getByName('whatsapp_mensagem')) {
        oportunidades.fields.removeByName('whatsapp_mensagem')
      }
      app.save(oportunidades)
    } catch (_) {}
  },
)
