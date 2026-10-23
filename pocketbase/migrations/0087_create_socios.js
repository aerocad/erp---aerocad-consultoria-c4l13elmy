/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    try {
      const existing = app.findCollectionByNameOrId('socios')
      if (existing) return
    } catch (_) {
      // collection does not exist yet
    }

    const collection = new Collection({
      name: 'socios',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: null,
      fields: [
        {
          name: 'nome',
          type: 'text',
          required: true,
        },
        {
          name: 'cpf',
          type: 'text',
        },
        {
          name: 'percentual_participacao',
          type: 'number',
          required: true,
        },
        {
          name: 'capital_subscrito',
          type: 'number',
        },
        {
          name: 'capital_integralizado',
          type: 'number',
        },
        {
          name: 'capital_a_integralizar',
          type: 'number',
        },
        {
          name: 'prazo_integralizacao',
          type: 'text',
        },
        {
          name: 'ata_distribuicao_url',
          type: 'text',
        },
        {
          name: 'ativo',
          type: 'bool',
        },
      ],
    })

    app.save(collection)

    // Seed default socios
    try {
      const record1 = new Record(collection, {
        nome: 'Cleyton Borges Saraiva',
        percentual_participacao: 80,
        capital_subscrito: 400000,
        capital_integralizado: 177600,
        capital_a_integralizar: 222400,
        prazo_integralizacao: '2027-12-31',
        ativo: true,
      })
      app.save(record1)

      const record2 = new Record(collection, {
        nome: 'Jaqueline Mota de Freitas Saraiva',
        percentual_participacao: 20,
        capital_subscrito: 100000,
        capital_integralizado: 44400,
        capital_a_integralizar: 55600,
        prazo_integralizacao: '2027-12-31',
        ativo: true,
      })
      app.save(record2)
    } catch (err) {
      console.warn('Erro ao inserir sócios iniciais:', err)
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('socios')
      if (collection) {
        app.delete(collection)
      }
    } catch (_) {}
  },
)
