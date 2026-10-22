/**
 * Migration 0080: Plano de Contas AEROCAD — Contas a Criar (Cleyton, 22/10/2026)
 * - Criação estruturada do Grupo 2.3 Patrimônio Líquido
 * - Inserção de 23 novas contas no plano contábil (plano_contas_customizadas)
 * - Subcontas bancárias PJ 1.1.1.01 e 1.1.1.02
 * - Reclassificação contábil provisória de lançamentos (Lucros -> 2.3.5, CDB -> 1.1.4, Transferências -> 1.1.7)
 * - Marcação da conta 3.4.2 como sem uso e ajuste das classificações
 */

/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let colPlano = null
    try {
      colPlano = app.findCollectionByNameOrId('plano_contas_customizadas')
    } catch (e) {
      console.log('Migration 0080: Coleção plano_contas_customizadas não encontrada:', e.message)
      return
    }

    const novasContas = [
      // 1. ATIVO CIRCULANTE
      {
        codigo: '1.1.1.01',
        nome: 'Banco Inter PJ (Conta Corrente)',
        natureza: 'ativo',
        grupo: 'Ativo Circulante / Disponibilidades',
        descricao: 'Conta movimento principal PJ no Banco Inter',
      },
      {
        codigo: '1.1.1.02',
        nome: 'Banco Secundário / Itaú PJ',
        natureza: 'ativo',
        grupo: 'Ativo Circulante / Disponibilidades',
        descricao: 'Segunda conta corrente operacional PJ da AEROCAD',
      },
      {
        codigo: '1.1.4',
        nome: 'Aplicações de Liquidez Imediata (CDB / Renda Fixa PJ)',
        natureza: 'ativo',
        grupo: 'Ativo Circulante / Disponibilidades',
        descricao: 'Aplicações financeiras de resgate automático ou D+0/D+1',
      },
      {
        codigo: '1.1.5',
        nome: 'Tributos Retidos a Compensar (IRRF, PIS, COFINS, CSLL e ISS)',
        natureza: 'ativo',
        grupo: 'Ativo Circulante',
        descricao:
          'Retenções na fonte sofridas em notas de serviços emitidas a compensar com tributos devidos',
      },
      {
        codigo: '1.1.6',
        nome: 'Adiantamentos de Viagens e Operações de Campo',
        natureza: 'ativo',
        grupo: 'Ativo Circulante',
        descricao:
          'Valores adiantados para deslocamentos, hospedagem e despesas em aeródromos a comprovar',
      },
      {
        codigo: '1.1.7',
        nome: 'Transferências Entre Contas PJ (Trânsito Financeiro)',
        natureza: 'ativo',
        grupo: 'Ativo Circulante',
        descricao: 'Movimentações e aportes entre contas bancárias da própria pessoa jurídica',
      },

      // 1.2 ATIVO NÃO CIRCULANTE (Retificadoras / Depreciação / Amortização)
      {
        codigo: '1.2.12',
        nome: '(–) Depreciação Acumulada - Ativo Imobilizado',
        natureza: 'ativo',
        grupo: 'Ativo Não Circulante / Imobilizado',
        descricao:
          'Conta redutora do ativo imobilizado (desgaste de equipamentos topográficos, drones, veículos e computadores)',
      },
      {
        codigo: '1.2.13',
        nome: '(–) Amortização Acumulada - Ativo Intangível',
        natureza: 'ativo',
        grupo: 'Ativo Não Circulante / Intangível',
        descricao:
          'Conta redutora de ativos intangíveis (amortização de marcas, softwares e licenças permanentes)',
      },

      // 2. PASSIVO CIRCULANTE
      {
        codigo: '2.1.9',
        nome: 'Cartão PJ a Pagar (Cartão Corporativo)',
        natureza: 'passivo',
        grupo: 'Passivo Circulante',
        descricao: 'Faturas em aberto do cartão corporativo PJ da empresa',
      },
      {
        codigo: '2.1.10',
        nome: 'Obrigações Trabalhistas e Provisões (Férias e 13º Salário)',
        natureza: 'passivo',
        grupo: 'Passivo Circulante',
        descricao:
          'Provisões de encargos trabalhistas acumulados da equipe técnica e administrativa',
      },

      // 2.2 PASSIVO NÃO CIRCULANTE
      {
        codigo: '2.2.4',
        nome: 'Empréstimos de Sócios / Mútuos Passivos',
        natureza: 'passivo',
        grupo: 'Passivo Não Circulante',
        descricao:
          'Aportes societários e mútuos efetuados por sócios com exigibilidade a longo prazo',
      },
      {
        codigo: '2.2.5',
        nome: 'Obrigações Fiscais e Parcelamentos de Longo Prazo',
        natureza: 'passivo',
        grupo: 'Passivo Não Circulante',
        descricao:
          'Parcelamentos tributários federais, previdenciários e municipais com prazo superior a 12 meses',
      },

      // 2.3 PATRIMÔNIO LÍQUIDO (GRUPO 2.3 BRASILEIRO OFICIAL)
      {
        codigo: '2.3.1',
        nome: 'Capital Social Subscrito',
        natureza: 'patrimonio_liquido',
        grupo: 'Patrimônio Líquido',
        descricao: 'Capital social nominal formalizado no contrato social da AEROCAD Consultoria',
      },
      {
        codigo: '2.3.2',
        nome: '(–) Capital Social a Integralizar',
        natureza: 'patrimonio_liquido',
        grupo: 'Patrimônio Líquido',
        descricao:
          'Parcela do capital social subscrito ainda pendente de realização financeira pelos sócios',
      },
      {
        codigo: '2.3.3',
        nome: 'Reservas de Capital',
        natureza: 'patrimonio_liquido',
        grupo: 'Patrimônio Líquido',
        descricao: 'Aportes, doações e reservas constituídas sem contrapartida de ações ou quotas',
      },
      {
        codigo: '2.3.4',
        nome: 'Lucros ou Prejuízos Acumulados',
        natureza: 'patrimonio_liquido',
        grupo: 'Patrimônio Líquido',
        descricao: 'Resultados líquidos de exercícios anteriores apurados e acumulados no balanço',
      },
      {
        codigo: '2.3.5',
        nome: 'Lucros a Destinar / Distribuição de Lucros Antecipada',
        natureza: 'patrimonio_liquido',
        grupo: 'Patrimônio Líquido',
        descricao:
          'Antecipações de lucros comprovadas do exercício aos sócios conforme apuração contábil',
      },
      {
        codigo: '2.3.6',
        nome: 'Reserva Legal e Estatutária',
        natureza: 'patrimonio_liquido',
        grupo: 'Patrimônio Líquido',
        descricao: 'Parcela de lucros destinada à garantia da integridade do capital social',
      },

      // 3. DESPESAS OPERACIONAIS COMPLEMENTARES
      {
        codigo: '3.1.6',
        nome: 'Despesas com Ocupação, Aluguel e Condomínio Comercial',
        natureza: 'despesa',
        grupo: 'Despesas Operacionais Fixas',
        descricao: 'Aluguel do escritório sede, taxa de condomínio e taxas prediais',
      },
      {
        codigo: '3.1.7',
        nome: 'Despesas com Telecomunicações, Internet e Telefonia',
        natureza: 'despesa',
        grupo: 'Despesas Operacionais Fixas',
        descricao: 'Planos corporativos de telefonia móvel e conexões de fibra dedicada',
      },
      {
        codigo: '3.4.3',
        nome: 'Benefícios a Empregados e Sócios (Alimentação, Transporte, Saúde)',
        natureza: 'despesa',
        grupo: 'Pessoal & Encargos',
        descricao: 'Vale-alimentação, vale-transporte e seguros de saúde corporativos',
      },
      {
        codigo: '3.5.3',
        nome: 'Despesas Financeiras Diversas e Variações Monetárias',
        natureza: 'despesa',
        grupo: 'Despesas Financeiras',
        descricao: 'Atualizações monetárias, despesas com protestos e multas bancárias',
      },
      {
        codigo: '3.7.1',
        nome: 'Outras Receitas e Despesas Não Operacionais',
        natureza: 'despesa',
        grupo: 'Despesas Não Operacionais',
        descricao: 'Baixas de bens inservíveis ou alienações pontuais de ativos',
      },
    ]

    for (const c of novasContas) {
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
          rec.set('descricao', c.descricao)
          rec.set('ativo', true)
          app.save(rec)
        }
      } catch (err) {
        console.log(`Erro ao inserir conta ${c.codigo}:`, err.message)
      }
    }

    // Reclassificações provisórias do documento (idempotentes):
    try {
      const colTransacoes = app.findCollectionByNameOrId('extratos_transacoes')
      if (colTransacoes) {
        // 1. CDB (resgate ou aplicação) -> 1.1.4 Aplicações de Liquidez Imediata
        const cdbRecords = app.findRecordsByFilter(
          'extratos_transacoes',
          '(descricao ~ "CDB" || descricao ~ "cdb" || observacoes ~ "CDB") && plano_contas_codigo != "1.1.4"',
          '',
          100,
          0,
        )
        for (const r of cdbRecords) {
          r.set('plano_contas_codigo', '1.1.4')
          r.set('plano_contas_nome', 'Aplicações de Liquidez Imediata (CDB / Renda Fixa PJ)')
          app.save(r)
        }

        // 2. Transferências entre contas PJ / Pix de R$ 3.700 -> 1.1.7 Transferências Entre Contas PJ
        const transfRecords = app.findRecordsByFilter(
          'extratos_transacoes',
          'valor = 3700 && (descricao ~ "PIX" || descricao ~ "Pix" || descricao ~ "AEROCAD")',
          '',
          50,
          0,
        )
        for (const r of transfRecords) {
          r.set('plano_contas_codigo', '1.1.7')
          r.set('plano_contas_nome', 'Transferências Entre Contas PJ (Trânsito Financeiro)')
          app.save(r)
        }

        // 3. Distribuição de lucros aos sócios (antigas 3.4.2 com observação de lucros) -> 2.3.5 Lucros a Destinar / Distribuição
        const lucroRecords = app.findRecordsByFilter(
          'extratos_transacoes',
          'plano_contas_codigo = "3.4.2" && observacoes ~ "Distribuicao de lucros"',
          '',
          100,
          0,
        )
        for (const r of lucroRecords) {
          r.set('plano_contas_codigo', '2.3.5')
          r.set('plano_contas_nome', 'Lucros a Destinar / Distribuição de Lucros Antecipada')
          app.save(r)
        }
      }
    } catch (err) {
      console.log('Aviso ao reclassificar transações na migration 0080:', err.message)
    }

    console.log('Migration 0080: Contas do Plano e reclassificações concluídas com sucesso.')
  },
  (app) => {
    // Reversão no-op
  },
)
