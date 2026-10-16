migrate(
  (app) => {
    const credoresCol = app.findCollectionByNameOrId('credores')

    // 1. Campo arquivo contrato_social (PDF ou imagem)
    if (!credoresCol.fields.getByName('contrato_social')) {
      credoresCol.fields.add(
        new FileField({
          name: 'contrato_social',
          maxSelect: 5,
          maxSize: 52428800, // 50MB
          mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        }),
      )
    }

    // 2. Campo capital_social (número)
    if (!credoresCol.fields.getByName('capital_social')) {
      credoresCol.fields.add(
        new NumberField({
          name: 'capital_social',
          min: 0,
        }),
      )
    }

    // 3. Campo socios (JSON: lista de sócios com nome, cpf/cnpj, percentual, cargo/qualificacao)
    if (!credoresCol.fields.getByName('socios')) {
      credoresCol.fields.add(
        new JSONField({
          name: 'socios',
          maxSize: 2097152, // 2MB
        }),
      )
    }

    // 4. Campo cnae_principal (texto: código e descrição do CNAE)
    if (!credoresCol.fields.getByName('cnae_principal')) {
      credoresCol.fields.add(
        new TextField({
          name: 'cnae_principal',
        }),
      )
    }

    // 5. Campo objeto_social (texto/editor)
    if (!credoresCol.fields.getByName('objeto_social')) {
      credoresCol.fields.add(
        new TextField({
          name: 'objeto_social',
        }),
      )
    }

    // 6. Campo data_constituicao (texto no padrão AAAA-MM-DD ou date)
    if (!credoresCol.fields.getByName('data_constituicao')) {
      credoresCol.fields.add(
        new TextField({
          name: 'data_constituicao',
        }),
      )
    }

    app.save(credoresCol)
  },
  (app) => {
    const credoresCol = app.findCollectionByNameOrId('credores')
    if (credoresCol.fields.getByName('contrato_social')) {
      credoresCol.fields.removeByName('contrato_social')
    }
    if (credoresCol.fields.getByName('capital_social')) {
      credoresCol.fields.removeByName('capital_social')
    }
    if (credoresCol.fields.getByName('socios')) {
      credoresCol.fields.removeByName('socios')
    }
    if (credoresCol.fields.getByName('cnae_principal')) {
      credoresCol.fields.removeByName('cnae_principal')
    }
    if (credoresCol.fields.getByName('objeto_social')) {
      credoresCol.fields.removeByName('objeto_social')
    }
    if (credoresCol.fields.getByName('data_constituicao')) {
      credoresCol.fields.removeByName('data_constituicao')
    }
    app.save(credoresCol)
  },
)
