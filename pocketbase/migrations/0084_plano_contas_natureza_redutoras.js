/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('plano_contas_customizadas')

    // Adicionar campo natureza_saldo se não existir
    if (!collection.fields.getByName('natureza_saldo')) {
      collection.fields.add(
        new SelectField({
          name: 'natureza_saldo',
          values: ['devedora', 'credora'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // Adicionar campo redutora se não existir
    if (!collection.fields.getByName('redutora')) {
      collection.fields.add(
        new BoolField({
          name: 'redutora',
          required: false,
        }),
      )
    }

    app.save(collection)

    // Contas redutoras oficiais da AEROCAD
    const contasRedutoras = [
      {
        codigo: '4.4.1',
        nome: '(–) DAS sobre o Faturamento',
        natureza: 'receita',
        grupo: 'Deduções sobre o Faturamento',
        natureza_saldo: 'devedora',
        redutora: true,
      },
      {
        codigo: '1.2.12',
        nome: '(–) Depreciação Acumulada - Ativo Imobilizado',
        natureza: 'ativo',
        grupo: 'Ativo Não Circulante',
        natureza_saldo: 'credora',
        redutora: true,
      },
      {
        codigo: '1.2.13',
        nome: '(–) Amortização Acumulada - Ativo Intangível',
        natureza: 'ativo',
        grupo: 'Ativo Não Circulante',
        natureza_saldo: 'credora',
        redutora: true,
      },
      {
        codigo: '2.1.8',
        nome: '(-) Encargos Financeiros a Apropriar (Circulante)',
        natureza: 'passivo',
        grupo: 'Passivo Circulante',
        natureza_saldo: 'devedora',
        redutora: true,
      },
      {
        codigo: '2.2.3',
        nome: '(-) Encargos Financeiros a Apropriar (Não Circulante)',
        natureza: 'passivo',
        grupo: 'Passivo Não Circulante',
        natureza_saldo: 'devedora',
        redutora: true,
      },
      {
        codigo: '2.3.2',
        nome: '(–) Capital Social a Integralizar',
        natureza: 'patrimonio_liquido',
        grupo: 'Patrimônio Líquido',
        natureza_saldo: 'devedora',
        redutora: true,
      },
      {
        codigo: '2.3.5',
        nome: 'Lucros a Destinar / Distribuição de Lucros Antecipada',
        natureza: 'patrimonio_liquido',
        grupo: 'Patrimônio Líquido',
        natureza_saldo: 'devedora',
        redutora: true,
      },
    ]

    for (const c of contasRedutoras) {
      try {
        const existing = app.findFirstRecordByFilter(
          'plano_contas_customizadas',
          `codigo = "${c.codigo}"`,
        )
        if (existing) {
          existing.set('natureza_saldo', c.natureza_saldo)
          existing.set('redutora', true)
          app.save(existing)
        } else {
          const record = new Record(collection)
          record.set('codigo', c.codigo)
          record.set('nome', c.nome)
          record.set('natureza', c.natureza)
          record.set('grupo', c.grupo)
          record.set('natureza_saldo', c.natureza_saldo)
          record.set('redutora', true)
          record.set('ativo', true)
          app.save(record)
        }
      } catch (e) {
        // Ignorar se falhar individualmente para manter idempotência
      }
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('plano_contas_customizadas')
      const fNatureza = collection.fields.getByName('natureza_saldo')
      if (fNatureza) collection.fields.remove(fNatureza)
      const fRedutora = collection.fields.getByName('redutora')
      if (fRedutora) collection.fields.remove(fRedutora)
      app.save(collection)
    } catch (e) {
      // noop
    }
  },
)
