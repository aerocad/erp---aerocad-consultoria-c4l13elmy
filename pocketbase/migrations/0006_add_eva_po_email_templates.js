migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('modelos_documentos')

    // Garantir que as categorias 'pedido_compras' e 'email_apresentacao' estejam no enum de categoria
    const categoriaField = col.fields.getByName('categoria')
    if (categoriaField) {
      const allowedCategories = [
        'contrato',
        'proposta',
        'proposta_tecnica',
        'ordem_servico',
        'oficio',
        'procuracao',
        'requerimento',
        'recibo',
        'fatura',
        'ata_reuniao',
        'estudo_viabilidade',
        'pedido_compras',
        'email_apresentacao',
        'nota_tecnica',
        'memorial',
        'laudo',
        'cronograma',
        'checklist',
        'fnc',
        'pac',
        'relatorio_gerencial',
        'outro',
      ]
      categoriaField.values = allowedCategories
      categoriaField.maxSelect = 1
      app.save(col)
    }

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

    // 1. Estudo de Viabilidade Aeronáutica (EVA) — inspirado no gen_estudo_viabilidade_006_galpoes.py
    upsertModel(
      'EVA — Estudo de Viabilidade Aeronáutica (Comparativo / OPEA / PZPANA)',
      'estudo_viabilidade',
      `<h2>ESTUDO DE VIABILIDADE AERONÁUTICA (EVA)</h2>
<p class="subtitle"><strong>RELATÓRIO TÉCNICO CONCLUSIVO Nº {{documento.numero}}</strong> — {{projeto.nome}}</p>

<h3>1. CARACTERIZAÇÃO DO EMPREENDIMENTO E DA ÁREA</h3>
<table class="aerocad-table">
  <tr><th style="width: 28%;">Empreendimento</th><td><strong>{{projeto.nome}}</strong></td></tr>
  <tr><th>Interessado / Contratante</th><td>{{cliente.razao_social}} (CNPJ/CPF: {{cliente.cnpj_cpf}})</td></tr>
  <tr><th>Município / UF</th><td>{{cliente.municipio}} / {{cliente.uf}}</td></tr>
  <tr><th>Aeródromo de Referência</th><td><strong>{{aerodromo_referencia}}</strong></td></tr>
  <tr><th>Polígono / Coordenadas</th><td>{{poligono_coordenadas}}</td></tr>
  <tr><th>Responsável Técnico (RT)</th><td>Eng. João Valmir Bigattão — CREA 124906/D-SP</td></tr>
  <tr><th>Data de Emissão</th><td>{{cidade_data}}</td></tr>
</table>

<h3>2. METODOLOGIA E ENQUADRAMENTO NORMATIVO</h3>
<p>O presente estudo avalia a conformidade com a <strong>ICA 11-408/2021</strong> (PBZPA), <strong>ICA 63-19/2021</strong> (PZPANA e auxílios à navegação aérea), RBAC 154 e Doc 8168 OACI (PANS-OPS), determinando a superfície governante e a altura máxima construível.</p>

<h3>3. ANÁLISE POR ÁREA CANDIDATA E SUPERFÍCIES GOVERNANTES</h3>
<table class="aerocad-table">
  <thead>
    <tr>
      <th style="width: 20%;">Área / Candidato</th>
      <th style="width: 25%;">Superfície Governante</th>
      <th style="width: 15%; text-align: right;">Alt. Pretendida</th>
      <th style="width: 15%; text-align: right;">Alt. Construível</th>
      <th style="width: 15%; text-align: center;">Resultado</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Candidato 1</strong></td>
      <td>radar_rampa (PZPANA)</td>
      <td style="text-align: right;">14.80 m</td>
      <td style="text-align: right; color: #C5221F; font-weight: bold;">9.44 m</td>
      <td style="text-align: center;"><span style="background: #FCE8E6; color: #C5221F; padding: 2px 6px; border-radius: 4px; font-weight: bold;">NÃO RECOMENDADO</span></td>
    </tr>
    <tr>
      <td><strong>Candidato 2</strong></td>
      <td>dme_fln_rampa (PZPANA)</td>
      <td style="text-align: right;">14.80 m</td>
      <td style="text-align: right; color: #137333; font-weight: bold;">20.31 m</td>
      <td style="text-align: center;"><span style="background: #E6F4EA; color: #137333; padding: 2px 6px; border-radius: 4px; font-weight: bold;">RECOMENDADO</span></td>
    </tr>
  </tbody>
</table>

<h3>4. DISCUSSÃO TÉCNICA E COMPARATIVA</h3>
<p>Da análise comparativa, verifica-se que as condicionantes de proteção ao voo (AGA/ATM) impõem limites decorrentes dos auxílios à navegação. A área candidata recomendada apresenta folga técnica em relação às superfícies de transição e rampa de rádio-auxílio, garantindo viabilidade para aprovação no COMAER.</p>

<h3>5. RECOMENDAÇÃO TÉCNICA FINAL</h3>
<div style="background: #E6F4EA; border: 1.5px solid #137333; border-radius: 6px; padding: 12px; margin: 12px 0;">
  <p style="font-weight: bold; color: #137333; margin: 0 0 4px 0;">PARECER TÉCNICO CONCLUSIVO: RECOMENDADO</p>
  <p style="font-size: 11px; margin: 0; line-height: 1.5;">O empreendimento é considerado TECNICAMENTE RECOMENDADO na área selecionada favorável, estando apto para submissão formal ao DECEA/COMAER via processo OPEA.</p>
</div>

<div class="signature-block">
  <p class="signature-city">{{cidade_data}}</p>
  <div class="signature-line">
    <p><strong>Eng. João Valmir Bigattão</strong></p>
    <p>Engenheiro Civil — Responsável Técnico</p>
    <p>CREA 124906/D-SP</p>
  </div>
</div>`,
    )

    // 2. Pedido de Compras — inspirado no gen_pedido_compras_008_twr.py
    upsertModel(
      'PO — Pedido de Compras de Serviços Técnicos',
      'pedido_compras',
      `<h2>PEDIDO DE COMPRAS DE SERVIÇOS TÉCNICOS</h2>
<p class="subtitle"><strong>PEDIDO DE COMPRAS Nº {{documento.numero}}</strong></p>

<h3>1. DADOS DO TOMADOR DE SERVIÇOS (AEROCAD)</h3>
<table class="aerocad-table">
  <tr><th style="width: 26%;">Razão Social</th><td><strong>AEROCAD Terraplanagem e Construção Ltda.</strong></td></tr>
  <tr><th>CNPJ</th><td>28.036.597/0001-43</td></tr>
  <tr><th>Endereço</th><td>SBS Quadra 2, Sala 206, Ed. Prime Business, Brasília – DF, CEP 70.070-120</td></tr>
  <tr><th>Responsável pelo Pedido</th><td>Jaqueline Mota de Freitas Saraiva</td></tr>
  <tr><th>Data de Emissão</th><td>{{cidade_data}}</td></tr>
</table>

<h3>2. DADOS DO FORNECEDOR / PRESTADOR CONTRATADO</h3>
<table class="aerocad-table">
  <tr><th style="width: 26%;">Razão Social / Nome</th><td><strong>{{cliente.razao_social}}</strong></td></tr>
  <tr><th>CNPJ / CPF</th><td>{{cliente.cnpj_cpf}}</td></tr>
  <tr><th>Contato</th><td>{{contato.nome}} · {{contato.email}} · {{contato.telefone}}</td></tr>
</table>

<h3>3. ITENS, ESCOPO E VALORES</h3>
<table class="aerocad-table">
  <thead>
    <tr>
      <th style="width: 8%; text-align: center;">Item</th>
      <th>Descrição do Produto / Serviço Técnico</th>
      <th style="width: 10%; text-align: center;">Qtd</th>
      <th style="width: 18%; text-align: right;">Preço Unit. (R$)</th>
      <th style="width: 18%; text-align: right;">Total (R$)</th>
      <th style="width: 16%; text-align: center;">Prazo</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align: center;"><strong>01</strong></td>
      <td>{{escopo}}</td>
      <td style="text-align: center;">1</td>
      <td style="text-align: right;">{{valor_contrato}}</td>
      <td style="text-align: right; font-weight: bold;">{{valor_contrato}}</td>
      <td style="text-align: center;">{{prazo_execucao}}</td>
    </tr>
    <tr class="table-total">
      <td colspan="4"><strong>VALOR TOTAL DO PEDIDO</strong></td>
      <td style="text-align: right; color: #FF6A13;"><strong>{{valor_contrato}}</strong></td>
      <td style="text-align: center;"><strong>—</strong></td>
    </tr>
  </tbody>
</table>

<h3>4. CONDIÇÕES E FORMA DE PAGAMENTO</h3>
<p><strong>Forma de Liquidação:</strong> Transferência Bancária / Chave PIX.<br/>
<strong>Prazos:</strong> Pagamento efetuado em até 5 dias úteis após o aceite e validação técnica do produto pela AEROCAD.</p>

<h3>5. INSTRUÇÕES AO FORNECEDOR</h3>
<ul>
  <li>A Nota Fiscal de Serviços eletrônica (NFS-e) deve referenciar expressamente o número deste Pedido de Compras;</li>
  <li>Os produtos técnicos deverão ser entregues em formato digital editável (DWG, KMZ, DOCX) e PDF assinado.</li>
</ul>

<div class="signature-block">
  <p class="signature-city">{{cidade_data}}</p>
  <div class="signature-line">
    <p><strong>Jaqueline Mota de Freitas Saraiva</strong></p>
    <p>Gerente de Negócios e Administração / Compradora</p>
    <p>AEROCAD Terraplanagem e Construção Ltda. · CNPJ 28.036.597/0001-43</p>
  </div>
</div>`,
    )

    // 3. E-mail de Apresentação de Proposta — estrutura padrão da Seção H
    upsertModel(
      'EML — E-mail de Apresentação de Proposta Comercial',
      'email_apresentacao',
      `<p><strong>Assunto:</strong> AEROCAD — Proposta Comercial PC nº {{proposta.numero}} — {{projeto.nome}}</p>

<p>Prezado(a) {{contato.nome}},</p>

<p>Em cumprimento às diretrizes alinhadas para a contratação dos serviços técnicos especializados de consultoria aeroportuária, temos a satisfação de submeter à sua apreciação nossa proposta técnica e comercial referente ao projeto <strong>{{projeto.nome}}</strong>.</p>

<p>Apresentamos a seguir o resumo dos principais pontos do escopo técnico proposto:</p>
<ul>
  <li>Estudo de Viabilidade Aeronáutica (AGA/ATM) com análise de obstáculos e impactos em procedimentos IFR;</li>
  <li>Modelagem e atualização dos Planos de Zona de Proteção (PBZPA e PZPANA);</li>
  <li>Instrução e acompanhamento dos processos regulatórios junto ao DECEA/COMAER e à ANAC;</li>
  <li>Assessoria contínua com reuniões técnicas e revisões completas dos produtos inclusas.</li>
</ul>

<p><strong>Condições comerciais principais:</strong></p>
<ul>
  <li><strong>Valor global:</strong> {{valor_contrato}}</li>
  <li><strong>Prazo de execução técnica:</strong> {{prazo_execucao}}</li>
  <li><strong>Condições de pagamento:</strong> Marcos vinculados a entregas técnicas comprováveis, com NFS-e emitida em 5 dias úteis e vencimento em 30 dias</li>
  <li><strong>Validade da proposta:</strong> {{validade_dias}} dias corridos</li>
</ul>

<p>Em conjunto com esta proposta comercial, encaminhamos a Proposta Técnica AEROCAD PT nº {{proposta_tecnica_correlata}}, que detalha a metodologia, as normas adotadas (ICA 11-408 / ICA 63-19) e o cronograma executivo.</p>

<p>Permanecemos à inteira disposição para realizar uma videoconferência de alinhamento com sua equipe técnica para esclarecer qualquer aspecto desta proposta.</p>

<p>Agradecemos a oportunidade e renovamos nossos protestos de elevada consideração.</p>

<p>Cordialmente,</p>`,
    )
  },
  (app) => {
    // Revert opcional
  },
)
