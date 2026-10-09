migrate(
  (app) => {
    // 1. Atualizar a coleção modelos_documentos para permitir as novas categorias do catálogo oficial
    const col = app.findCollectionByNameOrId('modelos_documentos')
    const categoriaField = col.fields.getByName('categoria')
    if (categoriaField) {
      categoriaField.values = [
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
      categoriaField.maxSelect = 1
    }
    app.save(col)

    // Helper para upsert
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

    // Modelos com texto completo e estruturado conforme o catálogo oficial
    upsertModel(
      'PC — Proposta Comercial Simples (OPEA / Cadastro)',
      'proposta',
      `<h2>PROPOSTA COMERCIAL — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</h2>
<p class="subtitle"><strong>PC nº {{proposta.numero}}</strong> — {{projeto.nome}} — {{cliente.razao_social}}</p>

<h3>1. INTERESSADO(A)</h3>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Contratante</th><td>{{cliente.razao_social}}</td></tr>
  <tr><th>CNPJ / CPF</th><td>{{cliente.cnpj_cpf}}</td></tr>
  <tr><th>Endereço</th><td>{{cliente.endereco}}</td></tr>
  <tr><th>Objeto / Aeródromo</th><td>{{projeto.nome}}</td></tr>
  <tr><th>Contato</th><td>{{contato.nome}} · {{contato.email}} · {{contato.telefone}}</td></tr>
  <tr><th>Referência</th><td>Projeto nº {{projeto.numero}}</td></tr>
</table>

<h3>2. APRESENTAÇÃO DA AEROCAD</h3>
<p>A <strong>AEROCAD® CONSULTORIA & AEROPORTOS</strong> foi fundada em 2017 com a missão de prestar serviços de engenharia consultiva e assessoria aeronáutica de excelência técnica ao mercado brasileiro. Sediada em Brasília – DF, no coração político-regulatório da aviação civil, mantém interlocução direta e ágil com o DECEA/COMAER e a ANAC.</p>

<h3>3. OBJETO</h3>
<p>{{escopo}}</p>

<h3>4. ATIVIDADES E DETALHAMENTO TÉCNICO</h3>
<p>Os serviços compreendem a análise preliminar de superfícies limitadoras de obstáculos (OLS), levantamento e compatibilização de dados SIRGAS 2000, modelagem técnica conforme normativas vigentes (ICA 11-408/2021 e correlatas), preparação do dossiê instrucional e protocolo formal perante os órgãos reguladores.</p>

<h3>5. ORÇAMENTO E CONDIÇÕES DE PAGAMENTO</h3>
<table class="aerocad-table">
  <thead>
    <tr>
      <th style="width: 15%;">Item</th>
      <th>Descrição dos Serviços</th>
      <th style="width: 20%; text-align: right;">Valor (R$)</th>
      <th style="width: 20%; text-align: center;">Prazo</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>01</strong></td>
      <td>{{projeto.nome}} — Processo técnico e regulatório completo</td>
      <td style="text-align: right;"><strong>{{valor_contrato}}</strong></td>
      <td style="text-align: center;">{{prazo_execucao}}</td>
    </tr>
    <tr class="table-total">
      <td colspan="2"><strong>VALOR GLOBAL DA PROPOSTA</strong></td>
      <td style="text-align: right; color: #FF6A13;"><strong>{{valor_contrato}}</strong></td>
      <td style="text-align: center;"><strong>{{prazo_execucao}}</strong></td>
    </tr>
  </tbody>
</table>
<p class="mt-2"><strong>Condições de Pagamento:</strong> {{condicoes_pagamento}}</p>
<p class="text-xs text-muted">A Nota Fiscal de Serviços (NFS-e) será emitida em até 5 (cinco) dias úteis após o cumprimento de cada marco/evento. Vencimento em 30 (trinta) dias da emissão da NFS-e.</p>

<h3>6. DADOS BANCÁRIOS INSTITUCIONAIS</h3>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Banco</th><td>INTER (077)</td></tr>
  <tr><th>Agência</th><td>0001</td></tr>
  <tr><th>Conta Corrente</th><td>7637194-8</td></tr>
  <tr><th>Favorecida</th><td>AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA</td></tr>
  <tr><th>CNPJ / Chave PIX</th><td>28.036.597/0001-43</td></tr>
</table>

<h3>7. CONDIÇÕES GERAIS E VALIDADE</h3>
<ul>
  <li><strong>Validade da proposta:</strong> {{validade_dias}} dias corridos a contar da data de emissão.</li>
  <li><strong>Reajuste:</strong> Valores sujeitos a reajuste anual pelo índice IPCA/IBGE caso o contrato ultrapasse 12 meses.</li>
  <li><strong>Obrigação de Meio:</strong> Por envolver manifestação discricionária de órgãos reguladores da administração pública, a obrigação assumida pela AEROCAD é de meio técnico especializado, executada segundo as melhores práticas da engenharia aeroportuária.</li>
</ul>

<h3>8. EXCLUSÕES EXPRESSAS</h3>
<ul>
  <li>Projetos civis executivos, geotecnia, drenagem, terraplanagem física ou acompanhamento de obras físicas, salvo contratação em módulo aditivo específico;</li>
  <li>Taxas e emolumentos oficiais eventualmente cobrados pelos órgãos reguladores (DECEA/COMAER e ANAC), de responsabilidade da Contratante.</li>
</ul>

<div class="signature-block">
  <p class="signature-city">{{cidade_data}}</p>
  <div class="signature-line">
    <p><strong>Jaqueline Mota de Freitas Saraiva</strong></p>
    <p>Gerente de Negócios e Administração · AEROCAD® CONSULTORIA & AEROPORTOS</p>
    <p>CNPJ 28.036.597/0001-43</p>
  </div>
</div>`,
    )

    upsertModel(
      'PC — Proposta Comercial Multi-Módulo (RFQ Aeroportuária)',
      'proposta',
      `<h2>PROPOSTA COMERCIAL — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</h2>
<p class="subtitle"><strong>PC nº {{proposta.numero}}</strong> — {{projeto.nome}} — {{cliente.razao_social}}</p>

<h3>1. INTERESSADO(A)</h3>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Contratante</th><td>{{cliente.razao_social}}</td></tr>
  <tr><th>Objeto do aeródromo</th><td>{{projeto.nome}}</td></tr>
  <tr><th>Referência RFQ</th><td>{{referencia_rfq}}</td></tr>
  <tr><th>Contato para envio</th><td>{{contato.email}}</td></tr>
  <tr><th>Documento técnico correlato</th><td>Proposta Técnica AEROCAD PT nº {{proposta_tecnica_correlata}} (parte integrante desta PC)</td></tr>
</table>

<h3>2. QUADRO OBRIGATÓRIO DA PROPOSTA COMERCIAL (RFQ)</h3>
<p>Preços e prazos por módulo, no formato exigido pela RFQ:</p>
<table class="aerocad-table">
  <thead>
    <tr>
      <th style="width: 12%;">Módulo</th>
      <th>Descrição</th>
      <th style="width: 22%; text-align: right;">Preço (R$)</th>
      <th style="width: 22%; text-align: center;">Prazo</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>A</strong></td>
      <td>Estudo de Viabilidade AGA/ATM (itens A1 a A8)</td>
      <td style="text-align: right;">{{preco_modulo_a}}</td>
      <td style="text-align: center;">90 dias corridos</td>
    </tr>
    <tr>
      <td><strong>B</strong></td>
      <td>Implementação regulatória (itens B1 a B3)</td>
      <td style="text-align: right;">{{preco_modulo_b}}</td>
      <td style="text-align: center;">45 dias controle AEROCAD + prazo de órgão (90 a 180 d)</td>
    </tr>
    <tr>
      <td><strong>C</strong></td>
      <td>Atualização do PDIR (itens C1 e C2)</td>
      <td style="text-align: right;">{{preco_modulo_c}}</td>
      <td style="text-align: center;">45 dias corridos</td>
    </tr>
    <tr>
      <td><strong>D</strong></td>
      <td>Base topográfica/cartográfica (itens D1 e D2) — EXCLUÍDA da proposta base. Sob demanda, mediante aditivo.</td>
      <td style="text-align: right;">EXCLUÍDO (ver §3)</td>
      <td style="text-align: center;">—</td>
    </tr>
    <tr class="table-total">
      <td colspan="2"><strong>VALOR GLOBAL — Módulos A + B + C (Módulo D EXCLUÍDO)</strong></td>
      <td style="text-align: right; color: #FF6A13;"><strong>{{valor_contrato}}</strong></td>
      <td style="text-align: center;"><strong>140 dias corridos AEROCAD + prazo de órgão</strong></td>
    </tr>
  </tbody>
</table>
<p class="text-xs text-muted mt-1">Os valores contemplam integralmente tributos, despesas, deslocamentos, diárias, emolumentos da AEROCAD, custos de aquisição de dados públicos e demais custos diretos e indiretos necessários à execução dos Módulos A, B e C. Taxas oficiais cobradas pelos órgãos reguladores (DECEA/COMAER e ANAC) não estão incluídas.</p>

<h3>3. MÓDULO D — ESTIMATIVA PRELIMINAR (SUBCONTRATAÇÃO OPCIONAL)</h3>
<p>O Módulo D encontra-se EXCLUÍDO desta proposta base. Caso a CONTRATANTE opte pelo levantamento aerofotogramétrico dedicado, a AEROCAD oferece, mediante ADITIVO específico, a subcontratação e coordenação técnica do serviço junto a empresa aerofotogramétrica qualificada, com estimativa preliminar de:</p>
<table class="aerocad-table">
  <tr><th style="width: 30%;">Estimativa preliminar (base)</th><td>R$ 95.000,00 a R$ 140.000,00 (a depender da área efetiva, resolução e época de voo)</td></tr>
  <tr><th>Taxa de coordenação AEROCAD</th><td>12% sobre o valor da subcontratação</td></tr>
  <tr><th>Prazo estimado do Módulo D</th><td>30 a 45 dias corridos (a confirmar em cotação firme)</td></tr>
  <tr><th>Escopo mínimo</th><td>Ortoimagem (GSD ≤ 10 cm) + MDS/MDT + pontos de controle + cadastro georreferenciado de obstáculos</td></tr>
</table>

<h3>4. CRONOGRAMA DE FATURAMENTO — VINCULADO A ENTREGAS TÉCNICAS</h3>
<p>Os marcos de faturamento estão vinculados a entregáveis objetivos, conforme os produtos descritos na Proposta Técnica:</p>
{{cronograma_marcos_tabela}}

<h3>5. DADOS BANCÁRIOS INSTITUCIONAIS</h3>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Banco</th><td>INTER (077)</td></tr>
  <tr><th>Agência</th><td>0001</td></tr>
  <tr><th>Conta Corrente</th><td>7637194-8</td></tr>
  <tr><th>Favorecida</th><td>AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA</td></tr>
  <tr><th>CNPJ / Chave PIX</th><td>28.036.597/0001-43</td></tr>
</table>

<h3>6. CONDIÇÕES COMERCIAIS</h3>
<p><strong>6.1 Validade da proposta:</strong> Proposta válida por {{validade_dias}} dias corridos contados da data de sua emissão.</p>
<p><strong>6.2 Reajuste:</strong> Os valores contratados serão reajustados pelo IPCA/IBGE após transcurso de 12 (doze) meses da assinatura do Contrato, aplicável aos marcos ainda não faturados.</p>
<p><strong>6.3 Serviços extraordinários:</strong> Serviços extraordinários serão objeto de orçamento específico apresentado previamente para aprovação formal da CONTRATANTE antes da execução, mediante aditivo contratual.</p>
<p><strong>6.4 Premissas de aditivo:</strong> (i) Alteração de aeronave-crítica ou mudança relevante do projeto conceitual após aprovação da versão-base; (ii) Inclusão de novos escopos; (iii) Revisões adicionais além das 2 inclusas no Módulo A; (iv) Mudanças normativas supervenientes.</p>
<p><strong>6.5 Limite de revisões inclusas:</strong> Estão inclusas 2 (duas) revisões completas dos produtos do Módulo A, SEM CUSTO ADICIONAL.</p>

<h3>7. EXCLUSÕES E CONDICIONANTES</h3>
<ul>
  <li>Projetos executivos de engenharia civil, estruturas, instalações elétricas, drenagem, geotecnia, meio ambiente ou execução física de obras;</li>
  <li>Elaboração de PANS-OPS completos (desenho novo de procedimentos IFR) — o Módulo A entrega ANÁLISE DE IMPACTOS em procedimentos IFR, não o desenho completo;</li>
  <li>Taxas oficiais dos órgãos reguladores (DECEA/COMAER e ANAC) — de responsabilidade da CONTRATANTE;</li>
  <li>Módulo D — Base topográfica/cartográfica (excluída da base — ver §3);</li>
  <li>Estudos ambientais (EIA/RIMA, PBA, PZR completo) — quando aplicáveis, cotáveis em proposta específica.</li>
</ul>

<h3>8. DOCUMENTOS CADASTRAIS BÁSICOS ANEXOS</h3>
<ul>
  <li>Contrato Social consolidado da AEROCAD Terraplanagem e Construção LTDA;</li>
  <li>Documento do representante legal — Jaqueline Mota de Freitas Saraiva (CPF 005.417.801-07);</li>
  <li>Comprovante de CNPJ (28.036.597/0001-43) e Inscrição Estadual (07.815.970/001-59);</li>
  <li>Certidões negativas aplicáveis: Receita Federal / PGFN; FGTS; CNDT Trabalhista; Tributos Distritais.</li>
</ul>

<h3>9. ENCERRAMENTO</h3>
<p>Esta Proposta Comercial é apresentada em conjunto com a Proposta Técnica AEROCAD PT nº {{proposta_tecnica_correlata}}, que a integra para todos os efeitos. Colocamo-nos à inteira disposição para eventuais esclarecimentos.</p>

<div class="signature-block">
  <p class="signature-city">{{cidade_data}}</p>
  <div class="signature-line">
    <p><strong>Jaqueline Mota de Freitas Saraiva</strong></p>
    <p>Gerente de Negócios e Administração · AEROCAD® CONSULTORIA & AEROPORTOS</p>
    <p>CNPJ 28.036.597/0001-43</p>
  </div>
</div>`,
    )

    upsertModel(
      'PT — Proposta Técnica Fiel (13 Seções + Aderência + Gantt)',
      'proposta_tecnica',
      `<h2>PROPOSTA TÉCNICA — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</h2>
<p class="subtitle"><strong>PT nº {{proposta.numero}}</strong> — {{projeto.nome}} — {{cliente.razao_social}}</p>

<h3>1. INTERESSADO(A)</h3>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Contratante</th><td>{{cliente.razao_social}}</td></tr>
  <tr><th>Objeto do aeródromo</th><td>{{projeto.nome}}</td></tr>
  <tr><th>Referência RFQ</th><td>{{referencia_rfq}}</td></tr>
  <tr><th>Contato para envio</th><td>{{contato.email}}</td></tr>
  <tr><th>Responsável técnico Contratante</th><td>{{responsavel_tecnico_cliente}}</td></tr>
  <tr><th>Prazo de envio da proposta</th><td>{{prazo_envio_proposta}}</td></tr>
</table>

<h3>2. APRESENTAÇÃO DA AEROCAD</h3>
<p><strong>2.1 Quem somos:</strong> A AEROCAD® CONSULTORIA & AEROPORTOS foi fundada em 2017 com a missão de prestar serviços de engenharia consultiva e assessoria aeronáutica de excelência técnica ao mercado brasileiro. Sediada em Brasília – DF, mantém interlocução direta com a ANAC, o DECEA e o COMAER. O corpo técnico multidisciplinar soma décadas de experiência no setor aeroportuário.</p>
<p><strong>2.2 Experiência aplicável:</strong> Portfólio consolidado com mais de 100 processos de PBZPA/PZPANA aprovados no DECEA, consultorias contínuas em aeroportos concessionados e ampla atuação na 6ª Rodada de Concessões Aeroportuárias.</p>
<p><strong>2.3 Diferenciais competitivos:</strong> Proximidade regulatória em Brasília; domínio de projetos aeroportuários de grande porte; equipe técnica sênior multidisciplinar; controle rigoroso de rastreabilidade de versões e dados SIRGAS 2000; emissão de ART/RRT junto ao CREA competente.</p>

<h3>3. OBJETO E ESCOPO CONTRATUAL</h3>
<p>{{escopo}}</p>
<table class="aerocad-table">
  <thead>
    <tr><th style="width: 15%;">Módulo</th><th>Descrição Sintética</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>Módulo A</strong></td><td>Estudo de Viabilidade AGA/ATM — consolidação de dados, modelagem OLS, impactos IFR e Estudo Aeronáutico.</td></tr>
    <tr><td><strong>Módulo B</strong></td><td>Implementação Regulatória — preparação de dossiês, protocolos DECEA/ANAC e atendimento a exigências.</td></tr>
    <tr><td><strong>Módulo C</strong></td><td>Atualização do Plano Diretor Aeroportuário (PDIR) e peças gráficas/memoriais.</td></tr>
    <tr><td><strong>Módulo D</strong></td><td>Base Topográfica/Cartográfica dedicada (marcada como excluída da proposta base — oferecida via aditivo).</td></tr>
  </tbody>
</table>

<h3>4. DETALHAMENTO POR MÓDULO — ESCOPO, METODOLOGIA E ENTREGÁVEIS</h3>
<p>{{detalhamento_modulos_tabela}}</p>

<h3>5. EQUIPE TÉCNICA E RESPONSABILIDADES</h3>
<table class="aerocad-table">
  <thead>
    <tr>
      <th style="width: 25%;">Função no Contrato</th>
      <th style="width: 30%;">Perfil Profissional</th>
      <th>Responsabilidade e Atribuição</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Gerente de Contrato</strong></td>
      <td>Jaqueline Mota de Freitas Saraiva</td>
      <td>Interlocução comercial, faturamento, gestão de conformidade e aditivos.</td>
    </tr>
    <tr>
      <td><strong>Responsável Técnico (RT)</strong></td>
      <td>João Valmir Bigattão · CREA 124906/D-SP</td>
      <td>Coordenação técnica geral, emissão e assinatura de ARTs perante o CREA.</td>
    </tr>
    <tr>
      <td><strong>Coordenador de Projetos</strong></td>
      <td>Cleyton Borges Saraiva</td>
      <td>Gestão de entregáveis, qualidade dos produtos e compatibilização técnica.</td>
    </tr>
    <tr>
      <td><strong>Especialista AGA / OLS</strong></td>
      <td>Engenheiro Sênior de Infraestrutura Aeroportuária</td>
      <td>Modelagem das superfícies limitadoras, cadastro de obstáculos e Estudo Aeronáutico.</td>
    </tr>
    <tr>
      <td><strong>Especialista ATM / PANS-OPS</strong></td>
      <td>Controlador de Tráfego Aéreo / Especialista em Procedimentos</td>
      <td>Análise de impactos em procedimentos IFR (IAC, SID, STAR, ILS, RNP APCH).</td>
    </tr>
  </tbody>
</table>

<h3>6. QUADRO DE ADERÊNCIA À RFQ</h3>
<p>Classificação item a item em relação aos requisitos técnicos solicitados:</p>
{{quadro_aderencia_tabela}}

<h3>7. NORMAS ADOTADAS</h3>
<ul class="dense-list">
  <li><strong>ICA 11-408/2021:</strong> Restrições aos objetos projetados no espaço aéreo (PBZPA);</li>
  <li><strong>ICA 63-19/2021:</strong> Plano de Zoneamento de Proteção contra Auxílios à Navegação Aérea (PZPANA) e Análise AGA;</li>
  <li><strong>ICA 11-3 e ICA 12-24/2015:</strong> Análises, processos e cobrança de emolumentos no COMAER;</li>
  <li><strong>RBAC nº 153:</strong> Aeródromos: Operação, Manutenção e Resposta à Emergência (ANAC);</li>
  <li><strong>RBAC nº 154:</strong> Projeto de Aeródromos (ANAC);</li>
  <li><strong>RBAC nº 161:</strong> Planos de Zoneamento de Ruído de Aeródromos (PZR);</li>
  <li><strong>Anexo 14 OACI:</strong> Aerodromes, Volume I (Aerodrome Design and Operations);</li>
  <li><strong>Anexo 4 OACI:</strong> Aeronautical Charts;</li>
  <li><strong>Doc 8168 OACI:</strong> PANS-OPS (Procedures for Air Navigation Services);</li>
  <li><strong>Publicações AIS-Brasil / AIP-BRASIL vigentes;</strong></li>
  <li><strong>Portarias ANAC nº 1.227/SIA (2010), 3.104/SIA (2013) e 1.214/SIA (2018) — SDIA.</strong></li>
</ul>

<h3>8. DADOS DE ENTRADA E MATRIZ DE PREMISSAS</h3>
<p><strong>8.1 A serem disponibilizados pela Contratante:</strong> Projeto conceitual da ampliação; PDIR vigente (editável); dados operacionais de movimento e aeronave-crítica; cadastros existentes de obstáculos; acesso ao sítio aeroportuário para visita técnica.</p>
<p><strong>8.2 Premissas de execução:</strong> Adoção de dados oficiais vigentes como base de partida; segregação estrita entre prazos sob controle da AEROCAD e prazos de análise dos órgãos públicos reguladores; emissão de ART CREA por profissional habilitado.</p>

<h3>9. GESTÃO DO CONTRATO E COMUNICAÇÃO</h3>
<ul>
  <li>Reunião de Kick-off em até 5 dias úteis da assinatura/OS para alinhamento de canais e premissas;</li>
  <li>Checkpoints técnicos quinzenais durante a elaboração dos estudos;</li>
  <li>Entrega da versão preliminar para comentários com janela de 10 dias corridos;</li>
  <li>Inclusão de até 2 rodadas completas de revisão dos produtos sem custo adicional;</li>
  <li>Relatórios mensais de acompanhamento de tramitação junto aos órgãos reguladores.</li>
</ul>

<h3>10. CRONOGRAMA FÍSICO — GRÁFICO DE GANTT</h3>
<p>Abaixo apresenta-se a distribuição temporal das atividades em 20 semanas sob controle da AEROCAD (excluído o tempo de tramitação dos órgãos reguladores):</p>
{{cronograma_gantt_bloco}}

<h3>11. ENTREGÁVEIS CONSOLIDADOS POR MÓDULO</h3>
<ul>
  <li><strong>Módulo A:</strong> Relatório de Dados de Entrada; Plantas PBZPA/PZPANA (DWG + PDF); Memorial Descritivo; Cadastro georreferenciado de obstáculos (KMZ + DWG + XLSX); Relatório de Impactos ATM; Estudo Aeronáutico e Matriz de Mitigação; Relatório Final consolidado e ART CREA.</li>
  <li><strong>Módulo B:</strong> Dossiês regulatórios completos; Comprovantes formais de protocolo DECEA/ANAC; Atendimento a exigências; Relatório conclusivo de encerramento.</li>
  <li><strong>Módulo C:</strong> Matriz de alterações do PDIR; PDIR consolidado revisado (DOCX + DWG + PDF) e ART CREA.</li>
</ul>

<h3>12. CONFIDENCIALIDADE E CONFLITO DE INTERESSES</h3>
<p>A AEROCAD declara a inexistência de conflito de interesses que impeça a execução contratual e assume compromisso formal de sigilo e confidencialidade sobre todas as informações acessadas durante a vigência dos trabalhos e pelo prazo de 5 (cinco) anos após sua conclusão.</p>

<h3>13. ENCERRAMENTO</h3>
<p>Esta Proposta Técnica é apresentada em conjunto com a Proposta Comercial PC nº {{proposta_comercial_correlata}}, consolidando o compromisso de rigor técnico e conformidade com as diretrizes da Contratante.</p>

<div class="signature-block">
  <p class="signature-city">{{cidade_data}}</p>
  <div class="signature-line">
    <p><strong>Jaqueline Mota de Freitas Saraiva</strong></p>
    <p>Gerente de Negócios e Administração · AEROCAD® CONSULTORIA & AEROPORTOS</p>
    <p>CNPJ 28.036.597/0001-43</p>
  </div>
</div>`,
    )

    upsertModel(
      'CT — Minuta de Contrato de Prestação de Serviços (11 Cláusulas)',
      'contrato',
      `<h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</h2>
<p class="subtitle"><strong>CONTRATO Nº {{contrato.numero}}</strong></p>

<h3>CLÁUSULA 1ª — QUALIFICAÇÃO DAS PARTES</h3>
<p><strong>CONTRATANTE:</strong> <strong>{{cliente.razao_social}}</strong>, pessoa jurídica de direito privado inscrita no CNPJ sob o nº {{cliente.cnpj_cpf}}, com sede em {{cliente.endereco}}.</p>
<p><strong>CONTRATADA:</strong> <strong>AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA.</strong>, pessoa jurídica de direito privado inscrita no CNPJ sob o nº 28.036.597/0001-43, com sede no SBS Quadra 2, Sala 206, Edifício Prime Business Convenience, Asa Sul, Brasília – DF, CEP 70.070-120, representada neste ato por sua procuradora e signatária <strong>Jaqueline Mota de Freitas Saraiva</strong>, portadora do CPF 005.417.801-07.</p>

<h3>CLÁUSULA 2ª — DO OBJETO</h3>
<p>Constitui objeto do presente instrumento a prestação de serviços especializados de consultoria em engenharia aeroportuária para o empreendimento <strong>{{projeto.nome}}</strong> (referência Projeto nº {{projeto.numero}}), com o seguinte escopo técnico: {{escopo}}.</p>

<h3>CLÁUSULA 3ª — DAS OBRIGAÇÕES DA CONTRATADA</h3>
<p>A CONTRATADA obriga-se a: (a) Executar os serviços técnicos com diligência, observando as normativas vigentes do DECEA/COMAER e da ANAC; (b) Alocar equipe técnica qualificada; (c) Emitir Anotação de Responsabilidade Técnica (ART/CREA) perante o Conselho regional competente; (d) Prestar esclarecimentos e atender a eventuais exigências técnicas formuladas pelos órgãos reguladores dentro das premissas contratadas.</p>

<h3>CLÁUSULA 4ª — DAS OBRIGAÇÕES DA CONTRATANTE</h3>
<p>A CONTRATANTE obriga-se a: (a) Fornecer com presteza todas as informações, plantas e dados técnicos necessários ao início e desenvolvimento dos trabalhos; (b) Efetuar os pagamentos nas datas e condições pactuadas; (c) Arcar com eventuais taxas e emolumentos oficiais cobrados diretamente pelos órgãos reguladores (DECEA/COMAER/ANAC).</p>

<h3>CLÁUSULA 5ª — DO VALOR E FORMA DE PAGAMENTO</h3>
<p>Pela prestação dos serviços objeto deste contrato, a CONTRATANTE pagará à CONTRATADA o valor global de <strong>{{valor_contrato}}</strong>, a ser quitado nas seguintes condições e marcos:</p>
<p>{{cronograma_pagamento}}</p>
<p>Os pagamentos serão efetuados mediante transferência bancária ou PIX em favor da CONTRATADA no Banco INTER (077), Agência 0001, Conta Corrente 7637194-8, CNPJ/Chave PIX: 28.036.597/0001-43.</p>

<h3>CLÁUSULA 6ª — DO PRAZO DE EXECUÇÃO</h3>
<p>O prazo para elaboração dos produtos técnicos pela CONTRATADA é de <strong>{{prazo_execucao}}</strong> contados do recebimento da documentação inicial completa e confirmação do sinal/entrada. Fica expressamente ajustado que o tempo de análise e deliberação dos órgãos da administração pública independe do controle da CONTRATADA.</p>

<h3>CLÁUSULA 7ª — DA RESPONSABILIDADE TÉCNICA (OBRIGAÇÃO DE MEIO)</h3>
<p>As partes reconhecem que a aprovação final de processos técnicos regulatórios submete-se ao poder discricionário dos órgãos competentes da Aviação Civil. Assim, a obrigação da CONTRATADA é de MEIO especializado, assegurando a mais estrita conformidade técnica e o empenho em sanar exigências regulatórias pertinentes ao escopo pactuado.</p>

<h3>CLÁUSULA 8ª — DA CONFIDENCIALIDADE</h3>
<p>As partes obrigam-se a manter sob sigilo absoluto todas as informações técnicas, comerciais, financeiras e estratégicas a que tiverem acesso em razão deste contrato, vigorando a obrigação durante a execução contratual e pelo período de 5 (cinco) anos após o seu encerramento.</p>

<h3>CLÁUSULA 9ª — DA RESCISÃO E MULTA COMPENSATÓRIA</h3>
<p>Em caso de rescisão imotivada por qualquer das partes, a parte desistente pagará à outra multa rescisória fixada em <strong>20% (vinte por cento)</strong> sobre o valor do contrato ou sobre o saldo remanescente, sem prejuízo da remuneração correspondente aos serviços já efetivamente executados até a data da comunicação rescisória.</p>

<h3>CLÁUSULA 10ª — DAS CONDIÇÕES GERAIS</h3>
<p>Qualquer alteração ou ampliação no escopo dos trabalhos dependerá de celebração de termo aditivo formal entre as partes, com prévia definição de custos e prazos.</p>

<h3>CLÁUSULA 11ª — DO FORO</h3>
<p>Para dirimir quaisquer controvérsias decorrentes deste contrato, as partes elegem o Foro da Circunscrição Judiciária de <strong>Brasília – DF</strong>, com expressa renúncia a qualquer outro, por mais privilegiado que seja.</p>

<div class="signature-block">
  <p class="signature-city">{{cidade_data}}</p>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px;">
    <div style="border-top: 1px solid #444; padding-top: 8px; text-align: center;">
      <p><strong>CONTRATANTE</strong></p>
      <p>{{cliente.razao_social}}</p>
      <p>CNPJ: {{cliente.cnpj_cpf}}</p>
    </div>
    <div style="border-top: 1px solid #444; padding-top: 8px; text-align: center;">
      <p><strong>CONTRATADA</strong></p>
      <p>AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA</p>
      <p>Jaqueline Mota de Freitas Saraiva · Procuradora</p>
    </div>
  </div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px;">
    <div style="border-top: 1px solid #999; padding-top: 8px; font-size: 10px; text-align: center;">
      <p>Testemunha 1: ____________________________</p>
      <p>Nome / CPF:</p>
    </div>
    <div style="border-top: 1px solid #999; padding-top: 8px; font-size: 10px; text-align: center;">
      <p>Testemunha 2: ____________________________</p>
      <p>Nome / CPF:</p>
    </div>
  </div>
</div>`,
    )

    upsertModel(
      'OS — Ordem de Serviço Interna',
      'ordem_servico',
      `<h2>ORDEM DE SERVIÇO INTERNA</h2>
<p class="subtitle"><strong>OS Nº {{ordem_servico.numero}}</strong> — Abertura Técnica de Projeto</p>

<h3>1. IDENTIFICAÇÃO DO PROJETO E CLIENTE</h3>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Projeto Nº</th><td>{{projeto.numero}}</td></tr>
  <tr><th>Nome do Empreendimento</th><td>{{projeto.nome}}</td></tr>
  <tr><th>Cliente</th><td>{{cliente.razao_social}} ({{cliente.cnpj_cpf}})</td></tr>
  <tr><th>Data de Emissão</th><td>{{data_hoje}}</td></tr>
  <tr><th>Prazo Interno de Conclusão</th><td>{{prazo_execucao}}</td></tr>
</table>

<h3>2. ESCOPO DOS TRABALHOS</h3>
<p>{{escopo}}</p>

<h3>3. EQUIPE DESIGNADA E ATRIBUIÇÕES</h3>
<table class="aerocad-table">
  <thead>
    <tr><th>Função</th><th>Profissional Designado</th><th>Atribuição no Projeto</th></tr>
  </thead>
  <tbody>
    <tr><td>Responsável Técnico</td><td>Eng. João Valmir Bigattão (CREA 124906/D-SP)</td><td>Coordenação técnica geral e emissão de ART</td></tr>
    <tr><td>Coordenação de Projetos</td><td>Cleyton Borges Saraiva</td><td>Compatibilização de entregas e cronograma</td></tr>
    <tr><td>Especialista Técnico</td><td>{{responsavel}}</td><td>Modelagem OLS / Memoriais / Análise regulatória</td></tr>
  </tbody>
</table>

<h3>4. ENTREGÁVEIS ESPERADOS</h3>
<ul>
  <li>Relatório de consolidação de dados de entrada e coordenadas SIRGAS 2000;</li>
  <li>Plantas das superfícies limitadoras (DWG e PDF);</li>
  <li>Memorial Descritivo e planilha de cálculo circunstanciada;</li>
  <li>Dossiê para protocolo junto ao órgão regulador competente ({{orgao}});</li>
  <li>Anotação de Responsabilidade Técnica (ART/CREA).</li>
</ul>

<h3>5. NORMATIVOS APLICÁVEIS</h3>
<p>ICA 11-408/2021, ICA 63-19/2021, RBAC 153/154/155 e demais diretrizes técnicas correlatas.</p>

<div class="signature-block">
  <p class="signature-city">{{cidade_data}}</p>
  <div class="signature-line">
    <p><strong>Cleyton Borges Saraiva</strong></p>
    <p>Coordenador de Projetos · AEROCAD® CONSULTORIA & AEROPORTOS</p>
  </div>
</div>`,
    )

    upsertModel(
      'PR — Procuração para Representação Regulatória (DECEA / ANAC)',
      'procuracao',
      `<h2>PROCURAÇÃO AD NEGOTIA</h2>

<h3>OUTORGANTE</h3>
<p><strong>{{cliente.razao_social}}</strong>, pessoa jurídica de direito privado inscrita no CNPJ sob o nº {{cliente.cnpj_cpf}}, com sede em {{cliente.endereco}}, neste ato representada por seu representante legal infra-assinado.</p>

<h3>OUTORGADA</h3>
<p><strong>JAQUELINE MOTA DE FREITAS SARAIVA</strong>, brasileira, inscrita no CPF sob o nº <strong>005.417.801-07</strong>, residente e domiciliada em Brasília – DF, atuando na qualidade de Procuradora e Gerente da sociedade <strong>AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA.</strong>, CNPJ 28.036.597/0001-43, com sede no SBS Quadra 2, Sala 206, Ed. Prime Business, Brasília – DF, CEP 70.070-120.</p>

<h3>PODERES ESPECÍFICOS</h3>
<p>A outorgada recebe poderes amplos e específicos para representar a OUTORGANTE perante o <strong>Departamento de Controle do Espaço Aéreo (DECEA)</strong>, <strong>Comando da Aeronáutica (COMAER)</strong>, <strong>Centros Integrados de Defesa Aérea e Controle de Tráfego Aéreo (CINDACTA I, II, III e IV)</strong>, <strong>Serviço Regional de Proteção ao Voo de São Paulo (SRPV-SP)</strong> e perante a <strong>Agência Nacional de Aviação Civil (ANAC)</strong>, podendo requerer, protocolar, acompanhar, prestar esclarecimentos, retirar ofícios, pareceres e notificações, tomar ciência de decisões e despachos, juntar e desentranhar documentos, interpor recursos administrativos, assinar requerimentos de Objeto Projetado no Espaço Aéreo (OPEA), Plano Básico de Zona de Proteção de Aeródromo (PBZPA), PZPANA, autorização de heliponto, inscrição, alteração e atualização cadastral de aeródromos no SDIA, praticando todos os atos estritamente necessários ao fiel cumprimento do mandato relativo ao empreendimento <strong>{{projeto.nome}}</strong> (Projeto nº {{projeto.numero}}).</p>

<div class="signature-block">
  <p class="signature-city">{{cidade_data}}</p>
  <div class="signature-line">
    <p>____________________________________________________</p>
    <p><strong>{{cliente.razao_social}}</strong></p>
    <p>CNPJ: {{cliente.cnpj_cpf}}</p>
    <p>Representante Legal:</p>
  </div>
</div>`,
    )

    upsertModel(
      'FT — Fatura de Serviços Técnicos',
      'fatura',
      `<h2>FATURA DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS</h2>
<p class="subtitle"><strong>FATURA Nº {{fatura.numero}}</strong></p>

<h3>1. DADOS DO TOMADOR DOS SERVIÇOS</h3>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Razão Social</th><td>{{cliente.razao_social}}</td></tr>
  <tr><th>CNPJ / CPF</th><td>{{cliente.cnpj_cpf}}</td></tr>
  <tr><th>Endereço</th><td>{{cliente.endereco}}</td></tr>
  <tr><th>Referência</th><td>Projeto nº {{projeto.numero}} — {{projeto.nome}}</td></tr>
  <tr><th>Contrato / PC Ref.</th><td>{{referencia_contrato_pc}}</td></tr>
</table>

<h3>2. DISCRIMINAÇÃO DA COBRANÇA</h3>
<table class="aerocad-table">
  <thead>
    <tr>
      <th style="width: 15%;">Parcela</th>
      <th>Descrição da Entrega / Evento Comprobatório</th>
      <th style="width: 20%; text-align: center;">Vencimento</th>
      <th style="width: 20%; text-align: right;">Valor (R$)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>{{parcela.identificador}}</strong></td>
      <td>{{parcela.descricao}}</td>
      <td style="text-align: center;"><strong>{{parcela.vencimento}}</strong></td>
      <td style="text-align: right; color: #FF6A13;"><strong>{{parcela.valor}}</strong></td>
    </tr>
    <tr class="table-total">
      <td colspan="3"><strong>TOTAL LÍQUIDO A PAGAR</strong></td>
      <td style="text-align: right; color: #FF6A13;"><strong>{{parcela.valor}}</strong></td>
    </tr>
  </tbody>
</table>

<h3>3. DADOS PARA PAGAMENTO VIA TED / PIX</h3>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Banco</th><td>INTER (077)</td></tr>
  <tr><th>Agência</th><td>0001</td></tr>
  <tr><th>Conta Corrente</th><td>7637194-8</td></tr>
  <tr><th>Favorecida</th><td>AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA</td></tr>
  <tr><th>CNPJ / Chave PIX</th><td>28.036.597/0001-43</td></tr>
</table>

<p class="text-xs text-muted mt-2">A Nota Fiscal de Serviços eletrônica (NFS-e) emitida pelo Município de Brasília-DF acompanha esta fatura para fins contábeis e fiscais.</p>

<div class="signature-block">
  <p class="signature-city">{{cidade_data}}</p>
  <div class="signature-line">
    <p><strong>AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA</strong></p>
    <p>CNPJ 28.036.597/0001-43</p>
  </div>
</div>`,
    )

    upsertModel(
      'RB — Recibo de Quitação',
      'recibo',
      `<h2>RECIBO DE QUITAÇÃO DE HONORÁRIOS</h2>
<p class="subtitle"><strong>RECIBO Nº {{recibo.numero}}</strong></p>

<div style="background: #FFF8F3; border: 1px solid #FFD3B4; border-radius: 8px; padding: 20px; margin: 24px 0;">
  <p style="font-size: 15px; line-height: 1.8; margin: 0;">
    Recebemos de <strong>{{cliente.razao_social}}</strong>, pessoa jurídica de direito privado inscrita no CNPJ sob o nº <strong>{{cliente.cnpj_cpf}}</strong>, a importância de <strong>{{valor_contrato}}</strong>, referente à quitação dos serviços técnicos de engenharia aeroportuária executados no âmbito do projeto <strong>{{projeto.nome}}</strong> (Projeto nº {{projeto.numero}} — Parcela {{parcela.identificador}}), conferindo a mais ampla, rasa e irrevogável quitação relativamente à referida parcela.
  </p>
</div>

<table class="aerocad-table">
  <tr><th style="width: 25%;">Referência</th><td>{{projeto.numero}} — {{projeto.nome}}</td></tr>
  <tr><th>Valor Quitado</th><td><strong>{{valor_contrato}}</strong></td></tr>
  <tr><th>Forma de Quitação</th><td>Transferência Bancária / PIX — Banco Inter (077)</td></tr>
  <tr><th>Data da Confirmação</th><td>{{data_hoje}}</td></tr>
</table>

<div class="signature-block">
  <p class="signature-city">{{cidade_data}}</p>
  <div class="signature-line">
    <p><strong>Jaqueline Mota de Freitas Saraiva</strong></p>
    <p>Gerente de Negócios e Administração · AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA</p>
    <p>CNPJ 28.036.597/0001-43</p>
  </div>
</div>`,
    )

    upsertModel(
      'AT — Ata de Reunião Técnica',
      'ata_reuniao',
      `<h2>ATA DE REUNIÃO TÉCNICA DE ALINHAMENTO</h2>
<p class="subtitle"><strong>PROJETO: {{projeto.numero}} — {{projeto.nome}}</strong></p>

<h3>1. INFORMAÇÕES GERAIS</h3>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Data e Horário</th><td>{{data_hoje}} · {{horario}}</td></tr>
  <tr><th>Local / Modalidade</th><td>{{modalidade_reuniao}} (Videoconferência / Presencial)</td></tr>
  <tr><th>Cliente</th><td>{{cliente.razao_social}}</td></tr>
  <tr><th>Assunto / Pauta</th><td>{{assunto}}</td></tr>
</table>

<h3>2. PARTICIPANTES</h3>
<p>{{participantes}}</p>

<h3>3. DELIBERAÇÕES E PONTOS DISCUTIDOS</h3>
<p>{{texto}}</p>

<h3>4. MATRIZ DE PENDÊNCIAS E RESPONSABILIDADES</h3>
<table class="aerocad-table">
  <thead>
    <tr><th style="width: 10%;">Item</th><th>Ação / Pendência</th><th style="width: 25%;">Responsável</th><th style="width: 20%;">Prazo</th></tr>
  </thead>
  <tbody>
    <tr><td>01</td><td>Envio das coordenadas atualizadas SIRGAS 2000 da cabeceira</td><td>Cliente</td><td>5 dias úteis</td></tr>
    <tr><td>02</td><td>Modelagem comparativa OLS (PBZPA)</td><td>AEROCAD</td><td>10 dias corridos</td></tr>
    <tr><td>03</td><td>Próximo checkpoint quinzenal</td><td>Ambas as partes</td><td>A agendar</td></tr>
  </tbody>
</table>

<div class="signature-block">
  <p class="signature-city">{{cidade_data}}</p>
  <div class="signature-line">
    <p><strong>AEROCAD® CONSULTORIA & AEROPORTOS</strong></p>
  </div>
</div>`,
    )

    upsertModel(
      'RQ — Requerimento Oficial ANAC / DECEA',
      'requerimento',
      `<h2>REQUERIMENTO OFICIAL DE PROCESSO AERONÁUTICO</h2>
<p class="subtitle"><strong>AO {{orgao}}</strong></p>

<h3>1. IDENTIFICAÇÃO DO INTERESSADO</h3>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Requerente</th><td>{{cliente.razao_social}}</td></tr>
  <tr><th>CNPJ / CPF</th><td>{{cliente.cnpj_cpf}}</td></tr>
  <tr><th>Endereço</th><td>{{cliente.endereco}}</td></tr>
  <tr><th>Representante Legal</th><td>Jaqueline Mota de Freitas Saraiva · Procuradora Especial</td></tr>
</table>

<h3>2. OBJETO DO REQUERIMENTO</h3>
<p>A Requerente, por intermédio de sua assessoria técnica especializada <strong>AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA</strong>, vem respeitosamente requerer a abertura, análise e parecer técnico do processo aeronáutico referente ao empreendimento <strong>{{projeto.nome}}</strong>.</p>

<h3>3. ENQUADRAMENTO NORMATIVO E PEÇAS INSTRUTÓRIAS</h3>
<p>O presente requerimento fundamenta-se nas instruções normativas {{base_normativa}} e encontra-se instruído com as seguintes peças técnicas:</p>
<ul>
  <li>Memorial Descritivo e Justificativa Técnica assinados pelo Responsável Técnico;</li>
  <li>Plantas das superfícies em formato DWG georreferenciadas (SIRGAS 2000);</li>
  <li>Planilha de cadastro de coordenadas e cotas altimétricas;</li>
  <li>Anotação de Responsabilidade Técnica (ART/CREA);</li>
  <li>Instrumento de Procuração e atos constitutivos do Requerente.</li>
</ul>

<div class="signature-block">
  <p class="signature-city">{{cidade_data}}</p>
  <div class="signature-line">
    <p><strong>Jaqueline Mota de Freitas Saraiva</strong></p>
    <p>Procuradora / Signatária · AEROCAD® CONSULTORIA & AEROPORTOS</p>
  </div>
</div>`,
    )

    upsertModel(
      'NT — Nota Técnica Especializada',
      'nota_tecnica',
      `<h2>NOTA TÉCNICA AERONÁUTICA</h2>
<p class="subtitle"><strong>NT nº {{documento.numero}}</strong> — {{projeto.nome}}</p>

<h3>1. CONTEXTO E CONSULTA TÉCNICA</h3>
<p>{{escopo}}</p>

<h3>2. ENQUADRAMENTO NORMATIVO</h3>
<p>A presente análise fundamenta-se nos preceitos da ICA 11-408/2021, ICA 63-19/2021, RBAC 154 e no Anexo 14 da OACI.</p>

<h3>3. ANÁLISE TÉCNICA E CRITÉRIOS AERONÁUTICOS</h3>
<p>{{texto}}</p>

<h3>4. CONCLUSÃO E RECOMENDAÇÕES OBJETIVAS</h3>
<p>Com base na análise geométrica e operacional das superfícies limitadoras de obstáculos (OLS) e dos auxílios à navegação afetados, conclui-se que o empreendimento atende às condições técnicas necessárias sob as condicionantes apresentadas.</p>

<div class="signature-block">
  <p class="signature-city">{{cidade_data}}</p>
  <div class="signature-line">
    <p><strong>Eng. João Valmir Bigattão</strong></p>
    <p>Responsável Técnico · CREA 124906/D-SP · AEROCAD</p>
  </div>
</div>`,
    )
  },
  (app) => {
    // Revert opcional
  },
)
