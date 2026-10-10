migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('modelos_documentos')

    const upsertModel = (nome, categoria, corpo) => {
      try {
        const record = app.findFirstRecordByData('modelos_documentos', 'nome', nome)
        record.set('categoria', categoria)
        record.set('corpo', corpo)
        app.save(record)
      } catch (_) {
        const record = new Record(col)
        record.set('nome', nome)
        record.set('categoria', categoria)
        record.set('corpo', corpo)
        app.save(record)
      }
    }

    // 1. PT Multi-Etapa por Horas (Alcoa Juruti)
    upsertModel(
      'PT — Proposta Técnica Multi-Etapa por Horas (Alcoa Juruti / Linhas de Transmissão)',
      'proposta_tecnica',
      `<div class="doc-title">PROPOSTA TÉCNICA — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<p class="subtitle"><strong>PT Nº {{documento.numero}}</strong> — Estudo de Interferências de Linhas de Transmissão e Torres</p>
<p>Proposta técnica estruturada em 6 etapas consecutivas por horas técnicas (taxa padrão R$ 217,80/h), cronograma SPOT 60 dias, entregáveis, compromissos da contratante e confidencialidade estrita.</p>`,
    )

    // 2. PC Vinculada à PT + RFS (Alcoa Juruti)
    upsertModel(
      'PC — Proposta Comercial Vinculada à PT + RFS (Alcoa Juruti / SPOT 60 dias)',
      'proposta',
      `<div class="doc-title">PROPOSTA COMERCIAL — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<p class="subtitle"><strong>PC Nº {{documento.numero}}</strong> — Vinculada à PT e ao RFS do Cliente</p>
<p>Proposta comercial vinculada indissociavelmente à Proposta Técnica, distribuição de valor por etapas, cronograma financeiro por marcos técnicos (M1..Mn), NFS-e em 5 dias e vencimento em 60 dias.</p>`,
    )

    // 3. PC Multi-Blocos com Gantt Paisagem (OCC Maragogi)
    upsertModel(
      'PC — Proposta Comercial Multi-Blocos com Gantt Paisagem (OCC Maragogi)',
      'proposta',
      `<div class="doc-title">PROPOSTA COMERCIAL — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<p class="subtitle"><strong>PC Nº {{documento.numero}}</strong> — Aeroporto Costa dos Corais</p>
<p>Apresentação institucional completa, detalhamento por blocos A a E (Torres, PBZPA, Cartas, PANS-OPS, Laudos), cronograma financeiro e Gantt em página paisagem (13 semanas segregadas).</p>`,
    )

    // 4. PC com 2 Opções de Contratação (Bruna Rodrigues / Cantá)
    upsertModel(
      'PC — Proposta Comercial com 2 Opções de Contratação (Cantá / Bruna Rodrigues)',
      'proposta',
      `<div class="doc-title">PROPOSTA COMERCIAL — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<p class="subtitle"><strong>PC Nº {{documento.numero}} (rev. 2)</strong> — Viabilidade + Registro + Projeto Executivo</p>
<p>Opção 1 com 3 contratos independentes (9 parcelas) × Opção 2 contrato único combinado (6 parcelas), comparativo resumido e Gantt multi-trilha (VIAB / REG / EXEC).</p>`,
    )

    // 5. PC de Medição / Item a Item em Horas Técnicas (Zurich SBVT)
    upsertModel(
      'PC — Proposta Comercial de Medição / Item a Item (Zurich SBVT / A330)',
      'proposta',
      `<div class="doc-title">PROPOSTA COMERCIAL — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<p class="subtitle"><strong>PC Nº {{documento.numero}}</strong> — Alteração Cadastral e OPEA</p>
<p>Planilha de itens com quantidade em horas técnicas, preço unitário, notas sobre proposta técnica correlata e cronograma de 5 a 7 semanas.</p>`,
    )

    // 6. Ofício (OF)
    upsertModel(
      'OF — Ofício Técnico Institucional (ANAC / DECEA / Prefeituras)',
      'oficio',
      `<div class="doc-title">OFÍCIO Nº {{documento.numero}} – AEROCAD</div>
<p>Correspondência técnica oficial dirigida a autoridades da aviação civil (ANAC, CINDACTA, DECEA) ou prefeituras com fundamentação técnica e assinatura de Responsável Técnico.</p>`,
    )

    // 7. Memorial Descritivo (MD)
    upsertModel(
      'MD — Memorial Descritivo de Engenharia Aeroportuária (11 Seções)',
      'memorial',
      `<div class="doc-title">MEMORIAL DESCRITIVO DE ENGENHARIA AERONÁUTICA</div>
<p>Estrutura mestre do catálogo em 11 seções técnicas (apresentação, objeto, localização, normas, geometria, pavimentação, auxílios, edificações, obstáculos, conclusões e responsabilidade técnica).</p>`,
    )

    // 8. Memorial de Cálculo (MC)
    upsertModel(
      'MC — Memorial de Cálculo (Cargas / PCR / Superfícies OLS)',
      'memorial',
      `<div class="doc-title">MEMORIAL DE CÁLCULO DE ENGENHARIA</div>
<p>6 seções com objeto, premissas, tabela de cargas com coeficientes de ponderação, normas aplicáveis, dimensionamento e responsabilidade técnica com ART.</p>`,
    )

    // 9. Laudo / Parecer Técnico (LT)
    upsertModel(
      'LT — Laudo / Parecer Técnico Pericial (Vistoria In Loco)',
      'laudo',
      `<div class="doc-title">LAUDO / PARECER TÉCNICO PERICIAL</div>
<p>Peça pericial com identificação do solicitante, data de vistoria in loco, análise de interferência com superfícies de proteção e conclusão fundamentada.</p>`,
    )

    // 10. Relatório Gerencial (RG)
    upsertModel(
      'RG — Relatório Gerencial Mensal de Operação e Manutenção (O&M / Helipontos)',
      'relatorio_gerencial',
      `<div class="doc-title">RELATÓRIO GERENCIAL MENSAL DE OPERAÇÃO & MANUTENÇÃO</div>
<p>Acompanhamento periódico de aeródromos e helipontos (documentação, aspecto físico FATO/TLOF, manutenções preventivas, movimento operacional e recomendações, com suporte a dados SNAW/CEAMN).</p>`,
    )

    // 11. Ata de Reunião (AT)
    upsertModel(
      'AT — Ata de Reunião Técnica de Alinhamento',
      'ata_reuniao',
      `<div class="doc-title">ATA DE REUNIÃO TÉCNICA DE ALINHAMENTO</div>
<p>Registro estruturado de reuniões técnicas com participantes em tabela, pauta, deliberações e matriz de encaminhamentos (ação, responsável e prazo).</p>`,
    )

    // 12. Plano de Ação Corretiva (PAC)
    upsertModel(
      'PAC — Plano de Ação Corretiva (Análise de Causa Raiz / 5 Porquês)',
      'pac',
      `<div class="doc-title">PLANO DE AÇÃO CORRETIVA (PAC)</div>
<p>Resposta técnica a notificações e fiscalizações com análise de causa raiz pelo método dos 5 Porquês e matriz de ações corretivas, responsáveis e prazos.</p>`,
    )

    // 13. Ficha de Não Conformidade (FNC)
    upsertModel(
      'FNC — Ficha de Não Conformidade (Inspeção Técnica / Auditoria)',
      'fnc',
      `<div class="doc-title">FICHA DE NÃO CONFORMIDADE (FNC)</div>
<p>Registro de achados de campo com setor inspecionado, requisito violado, classificação de severidade (CRÍTICA, ALTA, MÉDIA, BAIXA) e ação recomendada.</p>`,
    )

    // 14. Requerimento ANAC / DECEA (RQ)
    upsertModel(
      'RQ — Requerimento Oficial Administrativo (ANAC / DECEA)',
      'requerimento',
      `<div class="doc-title">REQUERIMENTO OFICIAL DE PROCESSO AERONÁUTICO</div>
<p>Petição administrativa com qualificação do requerente, exposição dos fatos, fundamentação normativa, formulação do pedido e rol de documentos instrutórios anexos.</p>`,
    )
  },
  (app) => {
    // Revert
  },
)
