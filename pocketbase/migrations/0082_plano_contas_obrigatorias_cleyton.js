/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const colPlano = app.findCollectionByNameOrId('plano_contas_customizadas')
    if (!colPlano) {
      console.log('Collection plano_contas_customizadas não encontrada.')
      return
    }

    const contasNovas = [
      {
        codigo: '3.8.1',
        nome: 'Despesa com Depreciação e Amortização',
        natureza: 'despesa',
        grupo: 'Depreciação e Amortização',
        fixoOuVariavel: 'fixo',
        descricao:
          'Apropriação periódica de quotas de depreciação do imobilizado e amortização de ativos intangíveis (CPC 04 / CPC 27)',
      },
      {
        codigo: '4.3.1',
        nome: 'Ganho na Alienação de Imobilizado',
        natureza: 'receita',
        grupo: 'Outras Receitas e Ganhos Não Operacionais',
        fixoOuVariavel: 'variavel',
        descricao:
          'Resultado positivo apurado na alienação, venda ou desincorporação de bens do ativo imobilizado',
      },
      {
        codigo: '4.4.1',
        nome: '(–) DAS sobre o Faturamento',
        natureza: 'receita',
        grupo: 'Deduções sobre o Faturamento',
        fixoOuVariavel: 'variavel',
        descricao:
          'Dedução direta da receita bruta por tributação do Simples Nacional (guia DAS calculada sobre o faturamento)',
      },
    ]

    for (const c of contasNovas) {
      try {
        let existente = null
        try {
          existente = app.findFirstRecordByFilter(
            'plano_contas_customizadas',
            `codigo = {:codigo}`,
            { codigo: c.codigo },
          )
        } catch (_) {
          existente = null
        }

        if (!existente) {
          const rec = new Record(colPlano)
          rec.set('codigo', c.codigo)
          rec.set('nome', c.nome)
          rec.set('natureza', c.natureza)
          rec.set('grupo', c.grupo)
          rec.set('fixoOuVariavel', c.fixoOuVariavel)
          rec.set('descricao', c.descricao)
          rec.set('ativo', true)
          app.save(rec)
          console.log(`Conta ${c.codigo} inserida com sucesso.`)
        } else {
          // Atualiza dados se necessário mantendo idempotência
          existente.set('nome', c.nome)
          existente.set('natureza', c.natureza)
          existente.set('grupo', c.grupo)
          existente.set('fixoOuVariavel', c.fixoOuVariavel)
          existente.set('descricao', c.descricao)
          existente.set('ativo', true)
          app.save(existente)
          console.log(`Conta ${c.codigo} já existia e foi sincronizada.`)
        }
      } catch (err) {
        console.log(`Erro ao processar conta ${c.codigo}:`, err.message)
      }
    }

    // Reclassificação automática de transações ou contas pagar com menção a DAS / Simples Nacional
    try {
      const colTransacoes = app.findCollectionByNameOrId('extratos_transacoes')
      if (colTransacoes) {
        const dasRecords = app.findRecordsByFilter(
          'extratos_transacoes',
          '(descricao ~ "DAS" || descricao ~ "das simples" || descricao ~ "simples nacional") && (plano_contas_codigo = "" || plano_contas_codigo = "3.3.2")',
          '',
          100,
          0,
        )
        for (const r of dasRecords) {
          r.set('plano_contas_codigo', '4.4.1')
          r.set('plano_contas_nome', '(–) DAS sobre o Faturamento')
          app.save(r)
        }
      }
    } catch (err) {
      console.log('Aviso ao reclassificar transações DAS na migration 0082:', err.message)
    }

    console.log('Migration 0082 executada com sucesso.')
  },
  (app) => {
    // Reversão no-op
  },
)
