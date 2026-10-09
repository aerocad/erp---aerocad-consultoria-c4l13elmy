import { dataHojeExtenso, INSTITUTIONAL_DATA } from './documentCatalogo'

export interface ItemAderencia {
  item: string
  requisito: string
  classificacao: 'ATENDE' | 'ATENDE PARCIALMENTE' | 'NÃO SE APLICA'
  justificativa: string
}

export interface AtividadeGantt {
  nome: string
  semanasAtivas: number[] // 1 a 20
}

export interface TechnicalProposalData {
  numero: string
  ano: number
  objetoAerodromo: string
  contratante: string
  referenciaRfq: string
  contatoEnvio: string
  responsavelTecnicoCliente: string
  prazoEnvioProposta: string
  propostaComercialCorrelata: string
  itensAderencia?: ItemAderencia[]
  normasAdotadas?: string[]
  atividadesGantt?: AtividadeGantt[]
}

export function buildTechnicalProposalHTML(data: TechnicalProposalData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  const aderencia: ItemAderencia[] = data.itensAderencia || [
    {
      item: 'A1',
      requisito: 'Consolidar dados da pista existente e ampliada',
      classificacao: 'ATENDE',
      justificativa: 'Executado no Módulo A · Relatório de Dados de Entrada.',
    },
    {
      item: 'A2',
      requisito: 'Esboços de PBZPA e PZPANA para a configuração ampliada',
      classificacao: 'ATENDE',
      justificativa: 'Executado no Módulo A · plantas editáveis + memorial.',
    },
    {
      item: 'A3',
      requisito: 'Levantar, consolidar e analisar obstáculos + matriz antes/depois',
      classificacao: 'ATENDE',
      justificativa: 'Executado no Módulo A · KMZ + DWG + planilha rastreável.',
    },
    {
      item: 'A4',
      requisito: 'Analisar impactos em procedimentos IFR — CAB 32',
      classificacao: 'ATENDE',
      justificativa: 'Executado no Módulo A · Relatório ATM.',
    },
    {
      item: 'A5',
      requisito: 'Estudo Aeronáutico e medidas de mitigação',
      classificacao: 'ATENDE',
      justificativa: 'Executado no Módulo A · Estudo Aeronáutico + Matriz de Mitigação.',
    },
    {
      item: 'A6',
      requisito: 'Consolidar Estudo de Viabilidade',
      classificacao: 'ATENDE',
      justificativa: 'Executado no Módulo A · Relatório Final + anexos.',
    },
    {
      item: 'A7',
      requisito: 'Assessoria AGA/ATM à equipe da CONTRATANTE',
      classificacao: 'ATENDE',
      justificativa: 'Executado no Módulo A · até 8 reuniões e 4 rodadas de análise incluídas.',
    },
    {
      item: 'A8',
      requisito: 'Mínimo 2 revisões completas SEM custo adicional',
      classificacao: 'ATENDE',
      justificativa: 'Incluído no Módulo A · revisões excedentes em taxa horária.',
    },
    {
      item: 'B1',
      requisito: 'Preparar e protocolar processos aplicáveis (PBZPA/PZPANA/OPEA/ANAC)',
      classificacao: 'ATENDE',
      justificativa: 'Executado no Módulo B · dossiês + protocolos + comprovantes.',
    },
    {
      item: 'B2',
      requisito: 'Acompanhar tramitações e responder exigências',
      classificacao: 'ATENDE',
      justificativa: 'Executado no Módulo B · relatório mensal de acompanhamento.',
    },
    {
      item: 'B3',
      requisito: 'Apoiar aprovação e encerramento técnico',
      classificacao: 'ATENDE',
      justificativa: 'Executado no Módulo B · relatório conclusivo por processo.',
    },
    {
      item: 'C1',
      requisito: 'Matriz de impactos no PDIR vigente',
      classificacao: 'ATENDE',
      justificativa: 'Executado no Módulo C.',
    },
    {
      item: 'C2',
      requisito: 'Atualizar plantas, memorial, quadros e restrições OPEA',
      classificacao: 'ATENDE',
      justificativa: 'Executado no Módulo C · PDIR consolidado editável + PDF.',
    },
    {
      item: 'D1',
      requisito: 'Fornecer ou especificar levantamento (ortoimagem, MDS, MDT, controle)',
      classificacao: 'ATENDE PARCIALMENTE',
      justificativa:
        'Módulo D EXCLUÍDO da proposta base — especificação técnica no Anexo I; subcontratação disponível mediante aditivo.',
    },
    {
      item: 'D2',
      requisito: 'Entregar cadastro de obstáculos KMZ/DWG/planilha',
      classificacao: 'ATENDE',
      justificativa:
        'Executado no Módulo A com base nos dados existentes; cadastro atualizado integrado se houver novo levantamento.',
    },
    {
      item: 'ART SC',
      requisito: 'Emissão de ART junto ao CREA-SC pelos documentos aplicáveis',
      classificacao: 'ATENDE',
      justificativa: 'ART emitida por profissional habilitado com registro no CREA.',
    },
    {
      item: 'Formatos',
      requisito: 'Entregáveis em PDF + editáveis nativos (DWG/KMZ/SHP/XLSX)',
      classificacao: 'ATENDE',
      justificativa: 'Todos os entregáveis nos formatos requeridos.',
    },
    {
      item: 'Rastreabilidade',
      requisito: 'Preservação rigorosa de rastreabilidade e versionamento',
      classificacao: 'ATENDE',
      justificativa: 'Sistema de controle de versões + dossiê técnico versionado.',
    },
    {
      item: 'Visita',
      requisito: 'Realização opcional mediante agendamento',
      classificacao: 'ATENDE',
      justificativa:
        '1 visita técnica ao aeródromo inclusa no Módulo A (equipe de 1 profissional).',
    },
  ]

  const normas: string[] = data.normasAdotadas || [
    'ICA 11-408/2021 — Restrições aos objetos projetados no espaço aéreo (PBZPA);',
    'ICA 63-19/2021 — Plano de Zoneamento de Proteção contra Auxílios à Navegação Aérea (PZPANA) e Análise Técnica AGA;',
    'ICA 11-3 e ICA 12-24/2015 — Análises, processos e cobrança de emolumentos junto ao COMAER;',
    'RBAC nº 153 — Aeródromos: Operação, Manutenção e Resposta à Emergência (ANAC);',
    'RBAC nº 154 — Projeto de Aeródromos (ANAC);',
    'RBAC nº 161 — Planos de Zoneamento de Ruído de Aeródromos (PZR);',
    'Anexo 14 OACI — Aerodromes, Volume I (Aerodrome Design and Operations);',
    'Anexo 4 OACI — Aeronautical Charts;',
    'Documento 8168 OACI — PANS-OPS (Procedures for Air Navigation Services — Aircraft Operations);',
    'Publicações AIS-Brasil / AIP-BRASIL vigentes na data dos produtos;',
    'Portarias ANAC nº 1.227/SIA (2010), 3.104/SIA (2013) e 1.214/SIA (2018);',
    'Cadastro SDIA — ANAC.',
  ]

  const ganttAtividades: AtividadeGantt[] = data.atividadesGantt || [
    { nome: 'KICK-OFF e recebimento dos dados-base', semanasAtivas: [1] },
    { nome: 'A1 · Consolidação de dados de entrada + pendências', semanasAtivas: [1, 2] },
    { nome: 'A2 · Esboços PBZPA/PZPANA (config. ampliada)', semanasAtivas: [2, 3, 4] },
    {
      nome: 'A3 · Cadastro e análise de obstáculos (matriz antes/depois)',
      semanasAtivas: [3, 4, 5],
    },
    { nome: 'A4 · Análise de impactos em procedimentos IFR (CAB 32)', semanasAtivas: [4, 5, 6, 7] },
    { nome: 'A5 · Estudo Aeronáutico + matriz de mitigação', semanasAtivas: [6, 7, 8] },
    { nome: 'A6 · Consolidação do Estudo de Viabilidade (v0)', semanasAtivas: [8, 9] },
    { nome: 'Comentários da CONTRATANTE', semanasAtivas: [9, 10] },
    { nome: 'A8 · Revisão 1 dos produtos do Módulo A', semanasAtivas: [10, 11] },
    { nome: 'A8 · Revisão 2 (se aplicável) + entrega FINAL do Módulo A', semanasAtivas: [11, 12] },
    {
      nome: 'A7 · Assessoria AGA/ATM ao projeto (transversal)',
      semanasAtivas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    { nome: 'C1 · PDIR — matriz de impactos', semanasAtivas: [7, 8, 9, 10] },
    { nome: 'C2 · PDIR — atualização das peças + entrega final', semanasAtivas: [10, 11, 12, 13] },
    { nome: 'B1 · Preparação dos dossiês regulatórios', semanasAtivas: [11, 12, 13, 14] },
    { nome: 'B1 · Protocolo dos processos (DECEA/COMAER + ANAC)', semanasAtivas: [14] },
    { nome: 'B2 · Acompanhamento sob controle AEROCAD', semanasAtivas: [15, 16, 17, 18, 19, 20] },
    { nome: 'B3 · Encerramento técnico dos processos aprovados', semanasAtivas: [18, 19, 20] },
  ]

  return `
<style>
  .pt-title { color: #FF6A13; font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
  .pt-subtitle { font-size: 13px; font-weight: bold; text-align: center; color: #222; margin-bottom: 24px; line-height: 1.4; }
  .pt-section { color: #FF6A13; font-size: 13px; font-weight: bold; margin-top: 22px; margin-bottom: 8px; border-bottom: 1.5px solid #FF6A13; padding-bottom: 3px; text-transform: uppercase; page-break-after: avoid; }
  .pt-table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 12px; font-size: 11px; page-break-inside: avoid; }
  .pt-table th, .pt-table td { border: 1px solid #D9D9D9; padding: 6px 8px; vertical-align: top; text-align: left; }
  .pt-table th { background-color: #F8F9FA; font-weight: bold; color: #333; }
  .pt-table thead th { background-color: #FF6A13; color: #FFFFFF; font-weight: bold; border-color: #FF6A13; }
  .gantt-table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 8px; margin-bottom: 8px; }
  .gantt-table th, .gantt-table td { border: 1px solid #D9D9D9; padding: 4px 2px; text-align: center; }
  .gantt-table th { background-color: #F0F0F0; font-weight: bold; }
  .gantt-bar { background-color: #FF6A13 !important; }
  .badge-atende { background-color: #E6F4EA; color: #137333; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 10px; display: inline-block; }
  .badge-parcial { background-color: #FEF7E0; color: #B06000; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 10px; display: inline-block; }
</style>

<div class="pt-title">PROPOSTA TÉCNICA — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<div class="pt-subtitle">
  PT nº ${data.numero}/${data.ano} — ${data.objetoAerodromo} — ${data.contratante}
</div>

<div class="pt-section">1. INTERESSADO(A)</div>
<table class="pt-table">
  <tr><th style="width: 25%;">Contratante</th><td>${data.contratante}</td></tr>
  <tr><th>Objeto do aeródromo</th><td>${data.objetoAerodromo}</td></tr>
  <tr><th>Referência RFQ</th><td>${data.referenciaRfq}</td></tr>
  <tr><th>Contato para envio</th><td>${data.contatoEnvio}</td></tr>
  <tr><th>Responsável técnico Contratante</th><td>${data.responsavelTecnicoCliente}</td></tr>
  <tr><th>Prazo de envio da proposta</th><td>${data.prazoEnvioProposta}</td></tr>
</table>

<div class="pt-section">2. APRESENTAÇÃO DA AEROCAD</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  <strong>2.1 Quem somos:</strong> A AEROCAD® CONSULTORIA & AEROPORTOS foi fundada em 2017 com a missão de prestar serviços de engenharia consultiva e assessoria aeronáutica de excelência técnica ao mercado brasileiro. Sediada em Brasília – DF, no coração político-regulatório da aviação civil, mantém interlocução direta com a ANAC, o DECEA e o COMAER, o que confere agilidade e precisão à condução dos processos técnicos e regulatórios dos seus clientes em todas as regiões do país.
</p>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  A empresa é integrada por engenheiros civis, arquitetos, engenheiros de segurança, controladores de tráfego aéreo e especialistas em navegação aérea — um corpo técnico multidisciplinar com décadas somadas de experiência no setor aeroportuário.
</p>
<p style="font-size: 11px; line-height: 1.6; margin: 4px 0;"><strong>2.2 Experiência aplicável ao objeto desta RFQ:</strong></p>
<ul style="font-size: 11px; line-height: 1.6; margin: 4px 0; padding-left: 20px;">
  <li>Consultoria contínua de infraestrutura aeroportuária e zonas de proteção (PBZPA/PZPANA), cartas AIS-Brasil e Estudos Aeronáuticos/OPEA em aeroportos concessionados;</li>
  <li>Atuação expressiva na 6ª Rodada de Concessões Aeroportuárias (2019) abrangendo 22 aeroportos dos Blocos Central, Norte e Sul;</li>
  <li>Portfólio consolidado com mais de 100 planos de zona de proteção (PBZPA/PZPANA) aprovados perante o DECEA em todo o país;</li>
  <li>Elaboração e revisão de Planos Diretores Aeroportuários (PDIR) e alteração cadastral junto à ANAC.</li>
</ul>
<p style="font-size: 11px; line-height: 1.6; margin: 4px 0;"><strong>2.3 Diferenciais competitivos:</strong></p>
<ul style="font-size: 11px; line-height: 1.6; margin: 4px 0; padding-left: 20px;">
  <li><strong>PROXIMIDADE REGULATÓRIA:</strong> sede em Brasília, junto à ANAC, DECEA e COMAER, com interlocução direta e ágil;</li>
  <li><strong>DOMÍNIO DO SÍTIO:</strong> experiência contínua em aeródromos complexos com curva de aprendizado zero;</li>
  <li><strong>EQUIPE MULTIDISCIPLINAR SÊNIOR:</strong> engenheiros civis, controladores de tráfego aéreo, especialistas em PANS-OPS e consultores regulatórios;</li>
  <li><strong>RASTREABILIDADE E VERSIONAMENTO:</strong> controle rigoroso de fontes SIRGAS 2000, premissas, cálculos e revisões com dossiê técnico entregável em cada marco;</li>
  <li><strong>RESPONSABILIDADE TÉCNICA:</strong> emissão formal de Anotação de Responsabilidade Técnica (ART) junto ao CREA competente.</li>
</ul>

<div class="pt-section">3. OBJETO E ESCOPO CONTRATUAL</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 6px 0;">
  Prestação de serviços especializados de engenharia consultiva e assessoria aeronáutica compreendendo o <strong>ESTUDO DE VIABILIDADE AERONÁUTICA (AGA/ATM)</strong> e a <strong>IMPLEMENTAÇÃO REGULATÓRIA</strong> da ampliação e adequações operacionais do aeródromo <strong>${data.objetoAerodromo}</strong>, organizada em quatro módulos independentes:
</p>
<table class="pt-table">
  <thead>
    <tr><th style="width: 12%; text-align: center;">Módulo</th><th>Descrição do Escopo</th></tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align: center;"><strong>A</strong></td>
      <td><strong>Estudo de Viabilidade AGA/ATM</strong> — consolidação de dados, PBZPA/PZPANA esboços, cadastro e análise de obstáculos, impactos em procedimentos IFR (IAC, SID, STAR, ILS/LOC, RNP/GNSS), Estudo Aeronáutico e medidas de mitigação, relatório consolidado, assessoria à equipe da CONTRATANTE, 2 revisões completas sem custo adicional.</td>
    </tr>
    <tr>
      <td style="text-align: center;"><strong>B</strong></td>
      <td><strong>Implementação Regulatória</strong> — preparação e protocolo dos processos aplicáveis (PBZPA, PZPANA, Estudo Aeronáutico/OPEA e alteração cadastral) junto ao DECEA/COMAER e ANAC; acompanhamento das tramitações; respostas a exigências; encerramento técnico dos processos.</td>
    </tr>
    <tr>
      <td style="text-align: center;"><strong>C</strong></td>
      <td><strong>Atualização do PDIR</strong> — matriz de impactos da ampliação sobre o PDIR vigente; revisão de plantas, memorial, quadro de distâncias declaradas e restrições OPEA; PDIR consolidado em formato editável e PDF.</td>
    </tr>
    <tr>
      <td style="text-align: center;"><strong>D</strong></td>
      <td><strong>Base Topográfica/Cartográfica</strong> — MARCADO COMO EXCLUÍDO na proposta base. Especificação técnica completa dos dados requeridos consta do Anexo I. AEROCAD oferece, sob demanda e mediante aditivo, a subcontratação e coordenação do serviço junto a empresa aerofotogramétrica qualificada.</td>
    </tr>
  </tbody>
</table>

<div class="pt-section">4. DETALHAMENTO POR MÓDULO — ESCOPO, METODOLOGIA E ENTREGÁVEIS</div>
<p style="font-size: 11px; margin-bottom: 6px;"><strong>4.1 Módulo A — Estudo de Viabilidade AGA/ATM (itens A1 a A8):</strong></p>
<table class="pt-table">
  <thead>
    <tr>
      <th style="width: 8%; text-align: center;">Item</th>
      <th style="width: 25%;">Requisito</th>
      <th>Escopo AEROCAD / Metodologia</th>
      <th style="width: 25%;">Entregável</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align: center;"><strong>A1</strong></td>
      <td>Consolidação de dados de entrada</td>
      <td>Coleta e sistematização das coordenadas SIRGAS 2000, altitudes, dimensões físicas da PPD, distâncias declaradas, auxílios (ILS, DME, VOR, PAPI), aeronave-crítica e cartas vigentes.</td>
      <td>Relatório de Dados de Entrada + Matriz de Pendências (editável).</td>
    </tr>
    <tr>
      <td style="text-align: center;"><strong>A2</strong></td>
      <td>Esboços PBZPA e PZPANA</td>
      <td>Modelagem das superfícies limitadoras de obstáculos (OLS) conforme ICA 11-408/2021 e superfícies PZPANA (ICA 63-19/2021). Elaboração de plantas comparativas.</td>
      <td>Plantas em formato editável (DWG/DXF) e PDF + memorial descritivo.</td>
    </tr>
    <tr>
      <td style="text-align: center;"><strong>A3</strong></td>
      <td>Levantamento e análise de obstáculos</td>
      <td>Catalogação georreferenciada de obstáculos, verificação de penetrações OLS e matriz analítica antes/depois.</td>
      <td>Cadastro georreferenciado (KMZ + DWG + XLSX rastreável) + matriz analítica.</td>
    </tr>
    <tr>
      <td style="text-align: center;"><strong>A4</strong></td>
      <td>Impactos em procedimentos IFR</td>
      <td>Avaliação técnica dos impactos nos futuros procedimentos por instrumento (IAC, SID, STAR, ILS/LOC/GS, RNP APCH) conforme Doc 8168 OACI (PANS-OPS).</td>
      <td>Relatório ATM com impactos, recomendações e mapa de trajetórias.</td>
    </tr>
    <tr>
      <td style="text-align: center;"><strong>A5</strong></td>
      <td>Estudo Aeronáutico e mitigação</td>
      <td>Estudo circunstanciado dos efeitos adversos com proposição individualizada de medidas mitigadoras (rebaixamento, remoção, sinalização, balizamento ou restrição).</td>
      <td>Estudo Aeronáutico + Matriz de Mitigação priorizada.</td>
    </tr>
    <tr>
      <td style="text-align: center;"><strong>A6</strong></td>
      <td>Consolidação do Estudo de Viabilidade</td>
      <td>Consolidação dos resultados, riscos, condicionantes e conclusão conclusiva sobre a viabilidade técnico-regulatória.</td>
      <td>Relatório Final consolidado + anexos técnicos (PDF + editável).</td>
    </tr>
    <tr>
      <td style="text-align: center;"><strong>A7</strong></td>
      <td>Assessoria AGA/ATM ao projeto</td>
      <td>Assessoria à equipe técnica e projetistas com até 8 reuniões técnicas e até 4 rodadas de análise de versões durante o contrato.</td>
      <td>Atas de reunião, pareceres técnicos e registro de comentários versionado.</td>
    </tr>
    <tr>
      <td style="text-align: center;"><strong>A8</strong></td>
      <td>Revisões dos produtos</td>
      <td>Realização de no mínimo 2 (duas) revisões completas dos produtos do Módulo A, SEM CUSTO ADICIONAL.</td>
      <td>Produtos revisados + controle de revisões versionado.</td>
    </tr>
  </tbody>
</table>

<p style="font-size: 11px; margin-top: 8px; margin-bottom: 6px;"><strong>4.2 Módulo B — Implementação Regulatória (itens B1 a B3):</strong></p>
<table class="pt-table">
  <thead>
    <tr>
      <th style="width: 8%; text-align: center;">Item</th>
      <th style="width: 25%;">Requisito</th>
      <th>Escopo AEROCAD / Metodologia</th>
      <th style="width: 25%;">Entregável</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align: center;"><strong>B1</strong></td>
      <td>Preparação e protocolo dos processos</td>
      <td>Dossiês completos de PBZPA, PZPANA, Estudo Aeronáutico/OPEA e alteração cadastral ANAC com formulários e plantas oficiais.</td>
      <td>Dossiês completos + Protocolos formais + Comprovantes de recebimento.</td>
    </tr>
    <tr>
      <td style="text-align: center;"><strong>B2</strong></td>
      <td>Acompanhamento até decisão dos órgãos</td>
      <td>Monitoramento contínuo das tramitações, interlocução técnica com os órgãos e atendimento tempestivo a exigências.</td>
      <td>Respostas técnicas + Revisões documentais + Relatório mensal.</td>
    </tr>
    <tr>
      <td style="text-align: center;"><strong>B3</strong></td>
      <td>Encerramento técnico dos processos</td>
      <td>Apoio à comprovação formal de aprovação e encerramento técnico de cada processo junto ao DECEA e à ANAC.</td>
      <td>Comprovantes finais + Relatório Conclusivo por processo.</td>
    </tr>
  </tbody>
</table>
<div style="font-size: 10px; color: #555; font-style: italic; margin-top: 4px;">
  <strong>OBSERVAÇÃO SOBRE PRAZOS:</strong> Os prazos sob controle da AEROCAD (preparação, protocolo, respostas a exigências) estão segregados dos prazos sob manifestação dos órgãos públicos (análise DECEA/COMAER e ANAC), que são estimados historicamente entre 90 e 180 dias por processo.
</div>

<div class="pt-section">5. EQUIPE TÉCNICA E RESPONSABILIDADES</div>
<table class="pt-table">
  <thead>
    <tr>
      <th style="width: 25%;">Função no Contrato</th>
      <th style="width: 30%;">Perfil Profissional</th>
      <th>Responsabilidade e Experiência</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Gerente de Contrato</strong><br/>(ponto focal comercial)</td>
      <td>${INSTITUTIONAL_DATA.representantes.signataria.nome}<br/><span style="font-size: 10px; color: #666;">${INSTITUTIONAL_DATA.representantes.signataria.cargo}</span></td>
      <td>Interlocução comercial/contratual, faturamento, gestão de aditivos e conformidade documental.</td>
    </tr>
    <tr>
      <td><strong>Responsável Técnico</strong><br/>(ponto focal técnico)</td>
      <td>${INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome}<br/><span style="font-size: 10px; color: #666;">${INSTITUTIONAL_DATA.representantes.responsavelTecnico.crea}</span></td>
      <td>Coordenação técnica geral do contrato; emissão e assinatura de ARTs; interlocução com DECEA e ANAC.</td>
    </tr>
    <tr>
      <td><strong>Coordenador de Projetos</strong></td>
      <td>${INSTITUTIONAL_DATA.representantes.coordenador.nome}<br/><span style="font-size: 10px; color: #666;">${INSTITUTIONAL_DATA.representantes.coordenador.cargo}</span></td>
      <td>Gestão do cronograma físico, controle de qualidade das peças e integração das disciplinas.</td>
    </tr>
    <tr>
      <td><strong>Especialista AGA</strong><br/>(zonas de proteção)</td>
      <td>Engenheiro sênior especializado em PBZPA / PZPANA</td>
      <td>Modelagem OLS (PBZPA/PZPANA), plantas comparativas, memoriais, cadastro de obstáculos e Estudo Aeronáutico.</td>
    </tr>
    <tr>
      <td><strong>Especialista ATM</strong><br/>(procedimentos IFR)</td>
      <td>Controlador de tráfego aéreo / Especialista PANS-OPS</td>
      <td>Análise de impactos operacionais em IAC/SID/STAR/ILS/RNP; interlocução técnica com SGSO/AIS.</td>
    </tr>
  </tbody>
</table>

<div class="pt-section">6. QUADRO DE ADERÊNCIA À RFQ</div>
<p style="font-size: 11px; margin-bottom: 6px;">Classificação item a item da RFQ ${data.contratante}:</p>
<table class="pt-table">
  <thead>
    <tr>
      <th style="width: 10%; text-align: center;">Item</th>
      <th style="width: 32%;">Requisito Solicitado</th>
      <th style="width: 18%; text-align: center;">Classificação</th>
      <th>Justificativa / Observação AEROCAD</th>
    </tr>
  </thead>
  <tbody>
    ${aderencia
      .map(
        (ad) => `
    <tr>
      <td style="text-align: center;"><strong>${ad.item}</strong></td>
      <td>${ad.requisito}</td>
      <td style="text-align: center;">
        <span class="${ad.classificacao === 'ATENDE' ? 'badge-atende' : 'badge-parcial'}">
          ${ad.classificacao}
        </span>
      </td>
      <td>${ad.justificativa}</td>
    </tr>`,
      )
      .join('')}
  </tbody>
</table>

<div class="pt-section">7. NORMAS ADOTADAS</div>
<ul style="font-size: 11px; line-height: 1.6; margin: 6px 0; padding-left: 20px;">
  ${normas.map((n) => `<li>${n}</li>`).join('')}
</ul>
<div style="font-size: 10px; color: #666; font-style: italic;">
  Eventuais divergências de edição ou atualização normativa identificadas durante o serviço serão reportadas à CONTRATANTE e consolidadas em nota técnica anexa ao produto final.
</div>

<div class="pt-section">8. DADOS DE ENTRADA E MATRIZ DE PREMISSAS</div>
<p style="font-size: 11px; margin: 4px 0;"><strong>8.1 A serem disponibilizados pela CONTRATANTE:</strong></p>
<ul style="font-size: 11px; line-height: 1.5; margin: 4px 0; padding-left: 20px;">
  <li>Projeto conceitual/geométrico da intervenção e suas versões evolutivas;</li>
  <li>Plano Diretor Aeroportuário (PDIR) vigente e histórico de revisões;</li>
  <li>Dados operacionais disponíveis (movimento, aeronaves-crítica, cartas vigentes, distâncias declaradas);</li>
  <li>Cadastros existentes de obstáculos (SGSO/AIS-Brasil e cadastros internos do aeroporto);</li>
  <li>Acesso ao sítio aeroportuário para realização da visita técnica técnica prévia.</li>
</ul>
<p style="font-size: 11px; margin: 6px 0 4px 0;"><strong>8.2 Premissas de execução:</strong></p>
<ul style="font-size: 11px; line-height: 1.5; margin: 4px 0; padding-left: 20px;">
  <li>Prazos dos processos regulatórios segregados entre prazos sob controle AEROCAD e prazo dependente de órgão público;</li>
  <li>Todos os produtos AGA acompanhados de ART emitida no CREA pelo responsável técnico habilitado;</li>
  <li>Mudanças relevantes de escopo ou de diretrizes conceituais serão tratadas via termo aditivo.</li>
</ul>

<div class="pt-section">9. GESTÃO DO CONTRATO E COMUNICAÇÃO</div>
<ul style="font-size: 11px; line-height: 1.5; margin: 6px 0; padding-left: 20px;">
  <li>Reunião de KICK-OFF em até 5 dias úteis da OS para alinhamento de escopo, dados e cronograma;</li>
  <li>CHECKPOINTS TÉCNICOS quinzenais durante a execução dos estudos;</li>
  <li>Apresentação do Estudo Preliminar (versão 0) com janela de 10 dias corridos para comentários da Contratante;</li>
  <li>Realização de até 2 rodadas completas de revisão dos produtos incluídas;</li>
  <li>Relatórios periódicos de acompanhamento das tramitações junto aos órgãos reguladores.</li>
</ul>

<div class="pt-section">10. CRONOGRAMA FÍSICO — GRÁFICO DE GANTT (20 SEMANAS)</div>
<p style="font-size: 10px; margin-bottom: 4px;">
  Distribuição das atividades dos Módulos A, B e C em 20 semanas sob controle AEROCAD. Prazos dependentes de órgãos públicos (Módulo B) segregados na nota abaixo:
</p>
<table class="gantt-table">
  <thead>
    <tr>
      <th style="width: 32%; text-align: left; padding-left: 6px;">ATIVIDADE</th>
      ${Array.from({ length: 20 }, (_, i) => `<th>S${i + 1}</th>`).join('')}
    </tr>
  </thead>
  <tbody>
    ${ganttAtividades
      .map(
        (atv) => `
    <tr>
      <td style="text-align: left; padding-left: 6px; font-weight: 500;">${atv.nome}</td>
      ${Array.from({ length: 20 }, (_, i) => {
        const sem = i + 1
        const active = atv.semanasAtivas.includes(sem)
        return `<td class="${active ? 'gantt-bar' : ''}">${active ? '●' : ''}</td>`
      }).join('')}
    </tr>`,
      )
      .join('')}
  </tbody>
</table>
<div style="font-size: 9px; color: #555; margin-top: 4px;">
  <strong>Legenda:</strong> células laranja (●) = período ativo. <strong>PRAZOS SOB CONTROLE AEROCAD = 140 dias corridos</strong> (A + C + protocolo de B). <strong>PRAZOS DE ÓRGÃO PÚBLICO</strong> (Módulo B após protocolo) = 90 a 180 dias por processo — encerramento técnico após deliberação do órgão.
</div>

<div class="pt-section">11. ENTREGÁVEIS CONSOLIDADOS POR MÓDULO</div>
<ul style="font-size: 11px; line-height: 1.5; margin: 6px 0; padding-left: 20px;">
  <li><strong>MÓDULO A:</strong> Relatório de Dados de Entrada · Plantas PBZPA/PZPANA editáveis (DWG) + PDF · Memorial descritivo · Cadastro georreferenciado de obstáculos (KMZ + DWG + XLSX) · Matriz de obstáculos antes/depois · Relatório de Impactos ATM (procedimentos IFR) · Estudo Aeronáutico + Matriz de Mitigação · Relatório Final consolidado · Atas de reunião e pareceres técnicos · ART CREA.</li>
  <li><strong>MÓDULO B:</strong> Dossiês completos por processo (PBZPA / PZPANA / Estudo Aeronáutico / OPEA / alteração cadastral ANAC) · Comprovantes formais de protocolo · Respostas a exigências e revisões · Relatório mensal de acompanhamento · Relatório Conclusivo por processo · Comprovantes finais de aprovação.</li>
  <li><strong>MÓDULO C:</strong> Matriz de Alterações do PDIR · PDIR consolidado revisado (DOCX + DWG + PDF) · Quadro de distâncias declaradas atualizado · ART CREA.</li>
  <li><strong>MÓDULO D:</strong> EXCLUÍDO da proposta base. Especificação técnica mantida para eventual contratação futura via aditivo.</li>
</ul>

<div class="pt-section">12. CONFIDENCIALIDADE E CONFLITO DE INTERESSES</div>
<p style="font-size: 11px; line-height: 1.5; text-align: justify; margin: 6px 0;">
  A AEROCAD declara não haver conflitos de interesse conhecidos que impeçam a execução deste contrato para a ${data.contratante}, e compromete-se com o sigilo absoluto de todas as informações e documentos técnicos, comerciais, operacionais e estratégicos aos quais tiver acesso em razão dos serviços — nos termos de NDA a ser firmado entre as partes.
</p>

<div class="pt-section">13. ENCERRAMENTO</div>
<p style="font-size: 11px; line-height: 1.5; text-align: justify; margin: 6px 0;">
  Esta Proposta Técnica é apresentada em conjunto com a Proposta Comercial PC nº ${data.propostaComercialCorrelata || '241/2026'} correlata, que consolida a estrutura obrigatória de preços por módulo, prazos, condições de pagamento e marcos de faturamento.
</p>

<div style="margin-top: 32px; page-break-inside: avoid; text-align: center;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 24px; font-size: 11px;">
    <strong>${INSTITUTIONAL_DATA.representantes.signataria.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.signataria.cargo} — AEROCAD® CONSULTORIA & AEROPORTOS<br/>
    CNPJ ${INSTITUTIONAL_DATA.cnpj}
  </div>
</div>
`
}
