import { formatCurrency } from './format'
import { dataHojeExtenso, INSTITUTIONAL_DATA, PALETA_AEROCAD_2026 } from './documentCatalogo'

// ==========================================
// 1. PT Multi-Etapa por Horas (Alcoa Juruti)
// ==========================================
export interface EtapaHoras {
  numero: number
  nome: string
  objeto: string
  itens: Array<{ item: string; entregavel: string; horas: number }>
}

export interface PTMultiEtapaHorasData {
  numero: string
  ano: number
  contratante: string
  cnpjCpf: string
  aerodromoOuSite: string
  objetoResumo: string
  taxaTecnicaHora?: number // padrão R$ 217,80
  prazoDias?: number // padrão 60 dias (SPOT)
  etapas?: EtapaHoras[]
  referenciasNormativas?: string[]
}

export function buildPTMultiEtapaHorasHTML(data: PTMultiEtapaHorasData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')
  const taxa = data.taxaTecnicaHora || 217.8
  const prazo = data.prazoDias || 60

  const etapasPadrao: EtapaHoras[] = [
    {
      numero: 1,
      nome: 'Levantamento e Análise Técnica',
      objeto:
        'Levantamento e consolidação das informações técnicas necessárias ao desenvolvimento do estudo aeronáutico, contemplando a análise documental, cadastro e levantamento dos parâmetros do aeródromo e das estruturas no entorno.',
      itens: [
        {
          item: '1.1',
          entregavel:
            'Análise documental do Aeródromo (cadastro ANAC, portarias, histórico de operações e cartas vigentes)',
          horas: 40,
        },
        {
          item: '1.2',
          entregavel:
            'Consolidação da base cartográfica, dados SIRGAS 2000, altitudes ortométricas e coordenadas geográficas',
          horas: 30,
        },
      ],
    },
    {
      numero: 2,
      nome: 'Avaliação das Superfícies Aeronáuticas (PBZPA / OLS)',
      objeto:
        'Estudo técnico das superfícies limitadoras de obstáculos e das superfícies de proteção aeronáutica, com modelagem tridimensional das superfícies de aproximação, decolagem, transição e cônica.',
      itens: [
        {
          item: '2.1',
          entregavel:
            'Análise das superfícies previstas na ICA 11-408 e normas RBAC correlatas para a pista existente',
          horas: 45,
        },
        {
          item: '2.2',
          entregavel:
            'Modelagem tridimensional das OLS e geração de seções e plantas em formato CAD/GIS',
          horas: 35,
        },
      ],
    },
    {
      numero: 3,
      nome: 'Estudo das Interferências das Torres e Linhas de Transmissão',
      objeto:
        'Identificação e avaliação técnica individualizada das estruturas de Linhas de Transmissão (LT) e torres que penetram as superfícies aeronáuticas, com quantificação rigorosa do grau de penetração.',
      itens: [
        {
          item: '3.1',
          entregavel:
            'Identificação individual das estruturas (torres e cabos de LT) e confronto altimétrico com as OLS',
          horas: 50,
        },
        {
          item: '3.2',
          entregavel:
            'Matriz de impacto individualizada com cotas de penetração, distâncias às cabeceiras e criticidade',
          horas: 40,
        },
      ],
    },
    {
      numero: 4,
      nome: 'Definição de Limites e Alternativas Técnicas',
      objeto:
        'Definição das alturas máximas admissíveis, envelopes operacionais aplicáveis, parâmetros geométricos e avaliação de alternativas de mitigação física ou operacional.',
      itens: [
        {
          item: '4.1',
          entregavel:
            'Definição das alturas máximas admissíveis para as estruturas e envelopes de proteção',
          horas: 35,
        },
        {
          item: '4.2',
          entregavel:
            'Estudo de alternativas técnicas de mitigação (rebaixamento, reposicionamento, balizamento e sinalização diurna/noturna)',
          horas: 35,
        },
      ],
    },
    {
      numero: 5,
      nome: 'Metodologia Operacional e de Segurança (AGA / SGSO)',
      objeto:
        'Aplicação de metodologia técnica fundamentada nos princípios de AGA (Aeródromos) e SMS/SGSO (Sistema de Gerenciamento da Segurança Operacional), avaliando o risco aeronáutico.',
      itens: [
        {
          item: '5.1',
          entregavel:
            'Aplicação de metodologia AGA na avaliação do risco operacional decorrente das penetrações',
          horas: 30,
        },
        {
          item: '5.2',
          entregavel:
            'Elaboração de matriz de risco SGSO e proposição de medidas de mitigação operacional',
          horas: 25,
        },
      ],
    },
    {
      numero: 6,
      nome: 'Relatório Técnico Final',
      objeto:
        'Consolidação dos resultados das etapas 1 a 5 em Relatório Técnico Final circunstanciado, entregue em formato digital editável e PDF de alta resolução.',
      itens: [
        {
          item: '6.1',
          entregavel:
            'Redação do memorial descritivo consolidado com premissas, metodologia e conclusões',
          horas: 20,
        },
      ],
    },
  ]

  const etapas = data.etapas && data.etapas.length > 0 ? data.etapas : etapasPadrao
  const totalHoras = etapas.reduce(
    (acc, e) => acc + e.itens.reduce((sum, it) => sum + it.horas, 0),
    0,
  )
  const valorTotalHoras = totalHoras * taxa

  const normas = data.referenciasNormativas || [
    'ICA 11-3 — Cartas Aeronáuticas (referência de levantamento e cartografia);',
    'ICA 11-408/2021 — Restrições aos objetos projetados no espaço aéreo (PBZPA / OLS);',
    'ICA 63-19/2021 — Planos de Zoneamento de Proteção contra Auxílios à Navegação Aérea (PZPANA);',
    'RBAC nº 154 — Projeto de Aeródromos (ANAC);',
    'Anexo 14 OACI — Aerodromes (Volume I — Aerodrome Design and Operations);',
    'Lei nº 7.565/1986 — Código Brasileiro de Aeronáutica (CBA).',
  ]

  return `
<style>
  .pt-hours-title { color: #FF6A13; font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  .pt-hours-sub { font-size: 12px; font-weight: bold; text-align: center; color: #222; margin-bottom: 22px; line-height: 1.4; }
  .pt-hours-sec { color: #FF6A13; font-size: 12px; font-weight: bold; margin-top: 18px; margin-bottom: 6px; border-bottom: 1.5px solid #FF6A13; padding-bottom: 2px; text-transform: uppercase; page-break-after: avoid; }
  .table-hours { width: 100%; border-collapse: collapse; margin: 6px 0 12px 0; font-size: 10.5px; page-break-inside: avoid; }
  .table-hours th, .table-hours td { border: 1px solid #D9D9D9; padding: 5px 8px; vertical-align: middle; }
  .table-hours thead th { background-color: #FF6A13; color: #FFFFFF; font-weight: bold; border-color: #FF6A13; }
  .table-hours tr.subtot td { background-color: #FFF6EC; font-weight: bold; color: #333; }
  .table-hours tr.tot td { background-color: #FFEDD9; font-weight: bold; color: #222; border-top: 2px solid #FF6A13; }
</style>

<div class="pt-hours-title">PROPOSTA TÉCNICA — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<div class="pt-hours-sub">PT Nº ${data.numero}/${data.ano} — ${data.objetoResumo} — ${data.contratante}</div>

<div class="pt-hours-sec">1. INTERESSADO(A)</div>
<table class="table-hours">
  <tr><th style="width: 25%; background:#F2F2F2; color:#333;">Contratante</th><td>${data.contratante}</td></tr>
  <tr><th style="background:#F2F2F2; color:#333;">CNPJ / CPF</th><td>${data.cnpjCpf}</td></tr>
  <tr><th style="background:#F2F2F2; color:#333;">Sítio / Aeródromo</th><td>${data.aerodromoOuSite}</td></tr>
  <tr><th style="background:#F2F2F2; color:#333;">Objeto</th><td>${data.objetoResumo}</td></tr>
</table>

<div class="pt-hours-sec">2. APRESENTAÇÃO DA AEROCAD</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  A <strong>AEROCAD® CONSULTORIA & AEROPORTOS</strong>, fundada em 2017, firma-se como referência nacional na prestação de serviços de engenharia consultiva aeronáutica, atuando com rigor analítico perante os órgãos reguladores (ANAC, DECEA e COMAER). Possui sede em Brasília – DF e equipe técnica com ampla bagagem em segurança operacional, superfícies limitadoras de obstáculos e regularidade de aeródromos e helipontos.
</p>

<div class="pt-hours-sec">3. VISÃO GERAL DO ESCOPO — ${etapas.length} ETAPAS POR HORAS TÉCNICAS</div>
<p style="font-size: 11px; line-height: 1.6; margin: 4px 0;">
  O escopo técnico foi estruturado em <strong>${etapas.length} etapas consecutivas</strong>, dimensionadas por horas técnicas com taxa oficial de <strong>${formatCurrency(taxa)}/h</strong>:
</p>

${etapas
  .map((et) => {
    const subtotalEtapa = et.itens.reduce((sum, it) => sum + it.horas, 0)
    return `
<div style="margin-top: 10px; margin-bottom: 2px;">
  <p style="font-size: 11px; font-weight: bold; color: #FF6A13; margin: 0 0 2px 0;">
    ETAPA ${et.numero} — ${et.nome.toUpperCase()}
  </p>
  <p style="font-size: 10.5px; line-height: 1.5; color: #444; margin: 0 0 4px 0; text-align: justify;">
    <strong>Objeto:</strong> ${et.objeto}
  </p>
</div>
<table class="table-hours">
  <thead>
    <tr>
      <th style="width: 12%; text-align: center;">Item</th>
      <th>Entregável / Atividade Técnica</th>
      <th style="width: 18%; text-align: center;">Horas Técnicas</th>
    </tr>
  </thead>
  <tbody>
    ${et.itens
      .map(
        (it) => `
    <tr>
      <td style="text-align: center; font-weight: bold;">${it.item}</td>
      <td>${it.entregavel}</td>
      <td style="text-align: center; font-weight: bold;">${it.horas} h</td>
    </tr>`,
      )
      .join('')}
    <tr class="subtot">
      <td colspan="2" style="text-align: right;">Subtotal da Etapa ${et.numero}:</td>
      <td style="text-align: center; color: #FF6A13;">${subtotalEtapa} h</td>
    </tr>
  </tbody>
</table>`
  })
  .join('')}

<table class="table-hours" style="margin-top: 14px;">
  <tr class="tot">
    <td style="width: 65%;"><strong>TOTAL DE HORAS TÉCNICAS CONTRATADAS (${etapas.length} ETAPAS)</strong></td>
    <td style="width: 18%; text-align: center; font-size: 12px; color: #FF6A13;"><strong>${totalHoras} h</strong></td>
    <td style="text-align: right; font-size: 12px; color: #FF6A13;"><strong>${formatCurrency(valorTotalHoras)}</strong></td>
  </tr>
</table>
<div style="font-size: 10px; color: #666; font-style: italic;">
  Taxa técnica de referência AEROCAD 2026: ${formatCurrency(taxa)}/hora técnica.
</div>

<div class="pt-hours-sec">4. CRONOGRAMA SPOT E COMPROMISSOS</div>
<p style="font-size: 11px; line-height: 1.6; margin: 4px 0;">
  <strong>Prazo global de execução:</strong> ${prazo} (sessenta) dias corridos a contar da emissão da Ordem de Serviço ou assinatura do Contrato (regime SPOT).
</p>
<p style="font-size: 11px; line-height: 1.6; margin: 4px 0;">
  <strong>Compromissos da Contratante:</strong> Disponibilização de plantas georreferenciadas do sítio, dados de coordenadas e perfis de elevação das estruturas de linha de transmissão (LT), histórico cadastral e indicação de interlocutor técnico formal.
</p>

<div class="pt-hours-sec">5. CONFIDENCIALIDADE E SUBCONTRATAÇÃO</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  A AEROCAD compromete-se com o sigilo estrito de todas as informações comerciais, industriais e operacionais compartilhadas no âmbito deste trabalho. Fica vedada a subcontratação dos estudos centrais de engenharia aeronáutica sem a prévia anuência por escrito da CONTRATANTE.
</p>

<div class="pt-hours-sec">6. REFERÊNCIAS NORMATIVAS</div>
<ul style="font-size: 10.5px; line-height: 1.5; margin: 4px 0; padding-left: 20px;">
  ${normas.map((n) => `<li>${n}</li>`).join('')}
</ul>

<div style="margin-top: 30px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 20px; font-size: 11px;">
    <strong>${INSTITUTIONAL_DATA.representantes.signataria.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.signataria.cargo} — AEROCAD® CONSULTORIA & AEROPORTOS<br/>
    CNPJ ${INSTITUTIONAL_DATA.cnpj}
  </div>
</div>
`
}

// ==========================================
// 2. PC vinculada à PT + RFS (Alcoa Juruti)
// ==========================================
export interface MarcoFinanceiroRFS {
  marco: string
  evento: string
  valor: number
  percentual: number
  prazoDias: number
}

export interface PCVinculadaRFSData {
  numero: string
  ano: number
  contratante: string
  cnpjCpf: string
  referenciaPt: string
  referenciaRfs: string
  valorGlobal: number
  etapasDistribuicao?: Array<{ etapa: string; valor: number; percentual: number }>
  marcos?: MarcoFinanceiroRFS[]
  prazoVencimentoNfeDias?: number // 60 dias (Alcoa) ou 30 dias padrão
}

export function buildPCVinculadaRFSHTML(data: PCVinculadaRFSData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')
  const vencimento = data.prazoVencimentoNfeDias || 60

  const etapas = data.etapasDistribuicao || [
    { etapa: 'Etapa 1 — Levantamento e Análise Técnica', valor: 15714, percentual: 18 },
    { etapa: 'Etapa 2 — Avaliação das Superfícies (PBZPA/OLS)', valor: 17460, percentual: 20 },
    { etapa: 'Etapa 3 — Estudo das Interferências das LTs e Torres', valor: 20952, percentual: 24 },
    { etapa: 'Etapa 4 — Definição de Limites e Alternativas', valor: 15714, percentual: 18 },
    { etapa: 'Etapa 5 — Metodologia Operacional e Segurança', valor: 10476, percentual: 12 },
    { etapa: 'Etapa 6 — Relatório Técnico Final + ART', valor: 6984, percentual: 8 },
  ]

  const marcos = data.marcos || [
    {
      marco: 'M1',
      evento: 'Assinatura do Contrato / OS e reunião de alinhamento inicial (Kick-off)',
      valor: data.valorGlobal * 0.2,
      percentual: 20,
      prazoDias: 10,
    },
    {
      marco: 'M2',
      evento: 'Entrega do Relatório de Levantamento e Esboço das Superfícies OLS (Etapas 1 e 2)',
      valor: data.valorGlobal * 0.3,
      percentual: 30,
      prazoDias: 25,
    },
    {
      marco: 'M3',
      evento: 'Entrega do Estudo de Interferências e Matriz de Riscos Operacionais (Etapas 3 e 4)',
      valor: data.valorGlobal * 0.3,
      percentual: 30,
      prazoDias: 45,
    },
    {
      marco: 'M4',
      evento:
        'Entrega e aceitação do Relatório Técnico Final consolidado + ART CREA (Etapas 5 e 6)',
      valor: data.valorGlobal * 0.2,
      percentual: 20,
      prazoDias: 60,
    },
  ]

  return `
<style>
  .pc-rfs-title { color: #FF6A13; font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  .pc-rfs-sub { font-size: 12px; font-weight: bold; text-align: center; color: #222; margin-bottom: 22px; line-height: 1.4; }
  .pc-rfs-sec { color: #FF6A13; font-size: 12px; font-weight: bold; margin-top: 18px; margin-bottom: 6px; border-bottom: 1.5px solid #FF6A13; padding-bottom: 2px; text-transform: uppercase; page-break-after: avoid; }
  .table-rfs { width: 100%; border-collapse: collapse; margin: 6px 0 12px 0; font-size: 11px; page-break-inside: avoid; }
  .table-rfs th, .table-rfs td { border: 1px solid #D9D9D9; padding: 6px 8px; vertical-align: top; }
  .table-rfs thead th { background-color: #FF6A13; color: #FFFFFF; font-weight: bold; border-color: #FF6A13; }
  .table-rfs tr.total td { background-color: #FFF6EC; font-weight: bold; color: #222; }
</style>

<div class="pc-rfs-title">PROPOSTA COMERCIAL — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<div class="pc-rfs-sub">PC Nº ${data.numero}/${data.ano} — Vinculada à PT Nº ${data.referenciaPt} e ao RFS ${data.referenciaRfs}</div>

<div class="pc-rfs-sec">1. INTERESSADO(A) E IDENTIFICAÇÃO</div>
<table class="table-rfs">
  <tr><th style="width: 25%; background:#F8F9FA;">Contratante</th><td>${data.contratante}</td></tr>
  <tr><th style="background:#F8F9FA;">CNPJ / CPF</th><td>${data.cnpjCpf}</td></tr>
  <tr><th style="background:#F8F9FA;">Vinculação Técnica</th><td>Proposta Técnica AEROCAD PT nº ${data.referenciaPt}</td></tr>
  <tr><th style="background:#F8F9FA;">Processo / RFS</th><td>RFS ${data.referenciaRfs} (Regime SPOT — 60 dias)</td></tr>
</table>

<div class="pc-rfs-sec">2. VINCULAÇÃO À PROPOSTA TÉCNICA E AO RFS</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  Esta Proposta Comercial (PC nº ${data.numero}/${data.ano}) é indissociável da Proposta Técnica PT nº ${data.referenciaPt} e atende integralmente às especificações do Termo de Referência / RFS ${data.referenciaRfs}. O escopo abrange a verificação de conformidade regulatória, modelagem OLS e avaliação de interferências das linhas de transmissão no entorno operacional do aeródromo.
</p>

<div class="pc-rfs-sec">3. VALOR GLOBAL E DISTRIBUIÇÃO POR ETAPAS</div>
<p style="font-size: 11px; line-height: 1.6; margin: 4px 0;">
  Valor global dos serviços: <strong>${formatCurrency(data.valorGlobal)}</strong>, distribuído pelas etapas técnicas da Proposta Técnica:
</p>
<table class="table-rfs">
  <thead>
    <tr>
      <th>Etapa Técnica (PT nº ${data.referenciaPt})</th>
      <th style="width: 15%; text-align: center;">%</th>
      <th style="width: 25%; text-align: right;">Valor (R$)</th>
    </tr>
  </thead>
  <tbody>
    ${etapas
      .map(
        (et) => `
    <tr>
      <td>${et.etapa}</td>
      <td style="text-align: center;">${et.percentual}%</td>
      <td style="text-align: right;">${formatCurrency(et.valor)}</td>
    </tr>`,
      )
      .join('')}
    <tr class="total">
      <td><strong>TOTAL GLOBAL</strong></td>
      <td style="text-align: center; color: #FF6A13;"><strong>100%</strong></td>
      <td style="text-align: right; color: #FF6A13;"><strong>${formatCurrency(data.valorGlobal)}</strong></td>
    </tr>
  </tbody>
</table>

<div class="pc-rfs-sec">4. CRONOGRAMA FINANCEIRO POR MARCOS TÉCNICOS (REGRA GERAL AEROCAD)</div>
<p style="font-size: 11px; line-height: 1.6; margin: 4px 0;">
  <strong>REGRA GERAL AEROCAD:</strong> Os marcos de faturamento são estritamente vinculados a <strong>ENTREGAS TÉCNICAS COMPROBATÓRIAS</strong> (nunca datas puras):
</p>
<table class="table-rfs">
  <thead>
    <tr>
      <th style="width: 10%; text-align: center;">Marco</th>
      <th>Evento Comprobatório</th>
      <th style="width: 12%; text-align: center;">Prazo</th>
      <th style="width: 12%; text-align: center;">%</th>
      <th style="width: 22%; text-align: right;">Valor (R$)</th>
    </tr>
  </thead>
  <tbody>
    ${marcos
      .map(
        (m) => `
    <tr>
      <td style="text-align: center; font-weight: bold;">${m.marco}</td>
      <td>${m.evento}</td>
      <td style="text-align: center;">D+${m.prazoDias}</td>
      <td style="text-align: center;">${m.percentual}%</td>
      <td style="text-align: right; font-weight: bold;">${formatCurrency(m.valor)}</td>
    </tr>`,
      )
      .join('')}
  </tbody>
</table>

<div style="background: #FFF7F0; border-left: 3px solid #FF6A13; padding: 8px 12px; margin: 8px 0; font-size: 10.5px; line-height: 1.5;">
  <strong>Regra de Faturamento e Vencimento:</strong> A AEROCAD emitirá a Nota Fiscal de Serviços eletrônica (NFS-e) em até <strong>5 (cinco) dias úteis</strong> após a entrega dos documentos comprobatórios de cada marco. O prazo de vencimento do boleto/fatura é de <strong>${vencimento} (sessenta) dias corridos</strong> após a emissão da NFS-e, em estrita conformidade com a política corporativa de pagamentos da CONTRATANTE.
</div>

<div class="pc-rfs-sec">5. ADERÊNCIA AO SISTEMA DE AVALIAÇÃO DO CLIENTE</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  A AEROCAD compromete-se com as metas de desempenho operacional, pontualidade nas entregas, padrões rigorosos de segurança e integridade (Compliance e ESG) exigidos pelos sistemas corporativos de avaliação de fornecedores da CONTRATANTE.
</p>

<div class="pc-rfs-sec">6. DADOS BANCÁRIOS INSTITUCIONAIS</div>
<table class="table-rfs">
  <tr><th style="width: 25%; background:#F8F9FA;">Banco</th><td>${INSTITUTIONAL_DATA.banco}</td></tr>
  <tr><th style="background:#F8F9FA;">Agência</th><td>${INSTITUTIONAL_DATA.agencia}</td></tr>
  <tr><th style="background:#F8F9FA;">Conta Corrente</th><td>${INSTITUTIONAL_DATA.contaCorrente}</td></tr>
  <tr><th style="background:#F8F9FA;">Favorecida</th><td>${INSTITUTIONAL_DATA.favorecida}</td></tr>
  <tr><th style="background:#F8F9FA;">CNPJ / Chave PIX</th><td>${INSTITUTIONAL_DATA.chavePix}</td></tr>
</table>

<div style="margin-top: 30px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 20px; font-size: 11px;">
    <strong>${INSTITUTIONAL_DATA.representantes.signataria.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.signataria.cargo} — AEROCAD® CONSULTORIA & AEROPORTOS<br/>
    CNPJ ${INSTITUTIONAL_DATA.cnpj}
  </div>
</div>
`
}

// ==========================================
// 3. PC Multi-Blocos com Gantt (OCC Maragogi)
// ==========================================
export interface BlocoServico {
  codigo: string // A, B, C, D, E
  titulo: string
  escopo: string
  entregaveis: string[]
  valor: number
}

export interface PCMultiBlocosGanttData {
  numero: string
  ano: number
  contratante: string
  cnpjCpf: string
  aerodromoNome: string
  prazoTotalDias?: number // padrão 90 dias
  valorGlobal: number
  blocos?: BlocoServico[]
  marcosFinanceiros?: Array<{ marco: string; percentual: number; valor: number; evento: string }>
}

export function buildPCMultiBlocosGanttHTML(data: PCMultiBlocosGanttData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  const blocosPadrao: BlocoServico[] = [
    {
      codigo: 'A',
      titulo: 'Estudo Técnico Aeronáutico das Torres (CAB 33)',
      escopo:
        'Levantamento cadastral das torres existentes no cone de aproximação da cabeceira 33, quantificação das penetrações às superfícies de proteção e modelagem de alternativas técnicas.',
      entregaveis: [
        'Levantamento georreferenciado das torres e coordenadas SIRGAS 2000;',
        'Análise de interferência com OLS e superfícies da ICA 11-408/2021;',
        'Matriz de mitigação e parecer técnico conclusivo.',
      ],
      valor: 37000,
    },
    {
      codigo: 'B',
      titulo: 'Projetos ZPA CAB 15 e CAB 33 (PBZPA Completo)',
      escopo:
        'Elaboração completa do Plano Básico de Zona de Proteção de Aeródromo para ambas as cabeceiras e superfícies internas.',
      entregaveis: [
        'Modelagem geométrica das superfícies limitadoras em DWG e PDF;',
        'Memorial descritivo e requerimentos formais perante o DECEA/CINDACTA;',
        'ART CREA do responsável técnico.',
      ],
      valor: 46250,
    },
    {
      codigo: 'C',
      titulo: 'Elaboração de Cartas Aeronáuticas (AIS-Brasil)',
      escopo:
        'Desenho técnico das cartas aeronáuticas padrão Anexo 4 OACI para publicação em AIP-BRASIL.',
      entregaveis: [
        'Carta ADC (Aerodrome Chart);',
        'Carta PDC (Aircraft Parking/Docking Chart);',
        'Carta AOC Tipo A (Aerodrome Obstacle Chart).',
      ],
      valor: 46250,
    },
    {
      codigo: 'D',
      titulo: 'Procedimentos de Voo por Instrumentos (PANS-OPS)',
      escopo:
        'Elaboração preliminar das bacias e trajetórias IFR com base nos critérios Doc 8168 OACI.',
      entregaveis: [
        'Análise de áreas de proteção para procedimentos RNP APCH;',
        'Verificação de gradientes de subida e descida;',
        'Relatório técnico para submissão ao DECEA.',
      ],
      valor: 30000,
    },
    {
      codigo: 'E',
      titulo: 'Laudos Técnicos para Compensação Ambiental',
      escopo:
        'Laudos periciais que comprovam a necessidade técnica da supressão e manejo de vegetação sob o ponto de vista estrito da segurança de voo.',
      entregaveis: [
        'Laudo pericial com ART CREA;',
        'Mapeamento das áreas de corte de vegetação governadas pelo PBZPA.',
      ],
      valor: 25500,
    },
  ]

  const blocos = data.blocos && data.blocos.length > 0 ? data.blocos : blocosPadrao

  return `
<style>
  .doc-title { color: #FF6A13; font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  .doc-subtitle { font-size: 12px; font-weight: bold; text-align: center; color: #222; margin-bottom: 22px; line-height: 1.4; }
  .section-title { color: #FF6A13; font-size: 12px; font-weight: bold; margin-top: 18px; margin-bottom: 6px; border-bottom: 1.5px solid #FF6A13; padding-bottom: 2px; text-transform: uppercase; page-break-after: avoid; }
  .aerocad-table { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 12px; font-size: 11px; page-break-inside: avoid; }
  .aerocad-table th, .aerocad-table td { border: 1px solid #D9D9D9; padding: 6px 8px; vertical-align: top; }
  .aerocad-table thead th { background-color: #FF6A13; color: #FFFFFF; font-weight: bold; border-color: #FF6A13; }
  .gantt-landscape { page-break-before: always; page-break-after: always; width: 100%; }
</style>

<div class="doc-title">PROPOSTA COMERCIAL — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<div class="doc-subtitle">PC Nº ${data.numero}/${data.ano} — ${data.aerodromoNome} — ${data.contratante}</div>

<div class="section-title">1. APRESENTAÇÃO INSTITUCIONAL & QUEM SOMOS</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  A <strong>AEROCAD® CONSULTORIA & AEROPORTOS</strong> atua há quase uma década prestando assessoria de engenharia aeroportuária e conformidade regulatória. Sediada em Brasília – DF, garante agilidade na aprovação de processos perante a ANAC e o COMAER.
</p>
<table class="aerocad-table">
  <tr><th style="width: 25%; background:#F8F9FA;">Contratante</th><td>${data.contratante}</td></tr>
  <tr><th style="background:#F8F9FA;">CNPJ / CPF</th><td>${data.cnpjCpf}</td></tr>
  <tr><th style="background:#F8F9FA;">Aeródromo</th><td>${data.aerodromoNome}</td></tr>
  <tr><th style="background:#F8F9FA;">Base Cartográfica</th><td>Projeto Executivo do Sítio Aeroportuário (planta MGI_ARQ_PE_06_39)</td></tr>
</table>

<div class="section-title">2. DETALHAMENTO DOS BLOCOS DE SERVIÇO</div>
${blocos
  .map(
    (b) => `
<div style="background: #FAFAFA; border: 1px solid #E5E5E5; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px;">
  <p style="font-size: 11.5px; font-weight: bold; color: #FF6A13; margin: 0 0 4px 0;">
    BLOCO ${b.codigo} — ${b.titulo.toUpperCase()} (${formatCurrency(b.valor)})
  </p>
  <p style="font-size: 10.5px; line-height: 1.5; color: #444; margin: 0 0 6px 0;">${b.escopo}</p>
  <p style="font-size: 10px; font-weight: bold; color: #333; margin: 0 0 2px 0;">Entregáveis:</p>
  <ul style="font-size: 10px; line-height: 1.4; margin: 0; padding-left: 18px; color: #555;">
    ${b.entregaveis.map((e) => `<li>${e}</li>`).join('')}
  </ul>
</div>`,
  )
  .join('')}

<div class="section-title">3. VALOR GLOBAL & CRONOGRAMA FINANCEIRO POR MARCOS TÉCNICOS</div>
<table class="aerocad-table">
  <thead>
    <tr>
      <th style="width: 12%; text-align: center;">Marco</th>
      <th>Evento Comprobatório</th>
      <th style="width: 15%; text-align: center;">%</th>
      <th style="width: 25%; text-align: right;">Valor (R$)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align: center; font-weight: bold;">M1</td>
      <td>Mobilização + Análise de dados-base e início do Bloco A</td>
      <td style="text-align: center;">20%</td>
      <td style="text-align: right;">${formatCurrency(data.valorGlobal * 0.2)}</td>
    </tr>
    <tr>
      <td style="text-align: center; font-weight: bold;">M2</td>
      <td>Entrega do Estudo das Torres (Bloco A) e esboços do PBZPA (Bloco B)</td>
      <td style="text-align: center;">25%</td>
      <td style="text-align: right;">${formatCurrency(data.valorGlobal * 0.25)}</td>
    </tr>
    <tr>
      <td style="text-align: center; font-weight: bold;">M3</td>
      <td>Protocolo do PBZPA perante o CINDACTA e entrega das Cartas (Bloco C)</td>
      <td style="text-align: center;">25%</td>
      <td style="text-align: right;">${formatCurrency(data.valorGlobal * 0.25)}</td>
    </tr>
    <tr>
      <td style="text-align: center; font-weight: bold;">M4</td>
      <td>Entrega dos procedimentos PANS-OPS (Bloco D) e Laudos Ambientais (Bloco E)</td>
      <td style="text-align: center;">30%</td>
      <td style="text-align: right;">${formatCurrency(data.valorGlobal * 0.3)}</td>
    </tr>
    <tr style="background: #FFEDD9; font-weight: bold;">
      <td colspan="2" style="text-align: right;">VALOR TOTAL GLOBAL CONTRATADO:</td>
      <td style="text-align: center; color: #FF6A13;">100%</td>
      <td style="text-align: right; color: #FF6A13;">${formatCurrency(data.valorGlobal)}</td>
    </tr>
  </tbody>
</table>

<!-- CRONOGRAMA GANTT EM PÁGINA PAISAGEM -->
<div class="gantt-landscape" style="border: 2px dashed #FF6A13; padding: 14px; border-radius: 8px; margin: 16px 0; background: #FFFDFB;">
  <p style="font-size: 12px; font-weight: bold; color: #FF6A13; text-transform: uppercase; margin: 0 0 4px 0; text-align: center;">
    CRONOGRAMA GANTT FÍSICO-FINANCEIRO — 13 SEMANAS (PÁGINA PAISAGEM RESTRITA)
  </p>
  <p style="font-size: 10px; color: #666; text-align: center; margin: 0 0 10px 0;">
    Régua de 90 dias corridos · Prazos sob controle AEROCAD × Prazos de Órgão Público devidamente segregados
  </p>
  <table style="width: 100%; border-collapse: collapse; font-size: 9px; text-align: center;">
    <thead>
      <tr style="background: #F2F2F2; color: #333; font-weight: bold;">
        <th style="width: 28%; text-align: left; padding: 4px;">Bloco / Atividade</th>
        ${Array.from({ length: 13 }, (_, i) => `<th style="padding: 4px; border: 1px solid #D9D9D9;">S${i + 1}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align: left; padding: 4px; font-weight: bold; border: 1px solid #D9D9D9;">Bloco A — Estudo Torres CAB 33 [M1-M2]</td>
        <td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>
      <tr>
        <td style="text-align: left; padding: 4px; font-weight: bold; border: 1px solid #D9D9D9;">Bloco B — PBZPA Completo [M2-M3]</td>
        <td></td><td></td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>
      <tr>
        <td style="text-align: left; padding: 4px; font-weight: bold; border: 1px solid #D9D9D9;">Bloco C — Cartas Aeronáuticas [M3]</td>
        <td></td><td></td><td></td><td></td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td></td><td></td><td></td><td></td><td></td>
      </tr>
      <tr>
        <td style="text-align: left; padding: 4px; font-weight: bold; border: 1px solid #D9D9D9;">Bloco D — PANS-OPS preliminar [M4]</td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td></td><td></td><td></td>
      </tr>
      <tr>
        <td style="text-align: left; padding: 4px; font-weight: bold; border: 1px solid #D9D9D9;">Bloco E — Laudos Ambientais [M4]</td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td></td>
      </tr>
    </tbody>
  </table>
  <div style="font-size: 9px; color: #777; margin-top: 6px;">
    <strong>Legenda:</strong> Células laranja (●) indicam período ativo sob controle da AEROCAD. Marcos financeiros M1 a M4 devidamente identificados.
  </div>
</div>

<div class="section-title">4. DADOS BANCÁRIOS</div>
<table class="aerocad-table">
  <tr><th style="width: 25%; background:#F8F9FA;">Banco</th><td>${INSTITUTIONAL_DATA.banco}</td></tr>
  <tr><th style="background:#F8F9FA;">Agência</th><td>${INSTITUTIONAL_DATA.agencia}</td></tr>
  <tr><th style="background:#F8F9FA;">Conta Corrente</th><td>${INSTITUTIONAL_DATA.contaCorrente}</td></tr>
  <tr><th style="background:#F8F9FA;">Favorecida</th><td>${INSTITUTIONAL_DATA.favorecida}</td></tr>
  <tr><th style="background:#F8F9FA;">CNPJ / Chave PIX</th><td>${INSTITUTIONAL_DATA.chavePix}</td></tr>
</table>

<div style="margin-top: 24px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 18px; font-size: 11px;">
    <strong>${INSTITUTIONAL_DATA.representantes.signataria.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.signataria.cargo} — AEROCAD® CONSULTORIA & AEROPORTOS<br/>
    CNPJ ${INSTITUTIONAL_DATA.cnpj}
  </div>
</div>
`
}

// ==========================================
// 4. PC com 2 Opções de Contratação (Bruna Rodrigues)
// ==========================================
export interface PC2OpcoesContratacaoData {
  numero: string
  ano: number
  clienteNome: string
  clienteCpfCnpj: string
  aerodromoNome: string // ex: Aeródromo Pouso da Águia (SWPD · CIAD RR0111)
  aeronaveCritica: string // ex: CESSNA C408 Sky Courier (PMD 8.618 kg)
  valorOpcao1: number // ex: R$ 115.500 (3 contratos independentes)
  valorOpcao2: number // ex: R$ 108.000 (contrato único combinado)
}

export function buildPC2OpcoesContratacaoHTML(data: PC2OpcoesContratacaoData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  return `
<style>
  .pc-2op-title { color: #FF6A13; font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  .pc-2op-sub { font-size: 12px; font-weight: bold; text-align: center; color: #222; margin-bottom: 22px; line-height: 1.4; }
  .pc-2op-sec { color: #FF6A13; font-size: 12px; font-weight: bold; margin-top: 18px; margin-bottom: 6px; border-bottom: 1.5px solid #FF6A13; padding-bottom: 2px; text-transform: uppercase; page-break-after: avoid; }
  .table-2op { width: 100%; border-collapse: collapse; margin: 6px 0 12px 0; font-size: 10.5px; page-break-inside: avoid; }
  .table-2op th, .table-2op td { border: 1px solid #D9D9D9; padding: 5px 8px; vertical-align: top; }
  .table-2op thead th { background-color: #FF6A13; color: #FFFFFF; font-weight: bold; border-color: #FF6A13; }
</style>

<div class="pc-2op-title">PROPOSTA COMERCIAL — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<div class="pc-2op-sub">PC Nº ${data.numero}/${data.ano} (rev. 2) — ${data.aerodromoNome} — ${data.clienteNome}</div>

<div class="pc-2op-sec">1. INTERESSADO(A) E AERONAVE DE PROJETO</div>
<table class="table-2op">
  <tr><th style="width: 25%; background:#F8F9FA;">Contratante</th><td>${data.clienteNome}</td></tr>
  <tr><th style="background:#F8F9FA;">CPF / CNPJ</th><td>${data.clienteCpfCnpj}</td></tr>
  <tr><th style="background:#F8F9FA;">Aeródromo</th><td>${data.aerodromoNome}</td></tr>
  <tr><th style="background:#F8F9FA;">Aeronave-Crítica Futura</th><td><strong>${data.aeronaveCritica}</strong></td></tr>
  <tr><th style="background:#F8F9FA;">Prazo Global</th><td>150 dias corridos (Viabilidade sequencial + Registro e Executivo em paralelo)</td></tr>
</table>

<div class="pc-2op-sec">2. DUAS OPÇÕES DE CONTRATAÇÃO</div>

<div style="background: #FAFAFA; border: 1px solid #E0E0E0; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
  <p style="font-size: 12px; font-weight: bold; color: #FF6A13; margin: 0 0 4px 0;">
    OPÇÃO 1 — CONTRATOS INDEPENDENTES POR ETAPA (${formatCurrency(data.valorOpcao1)})
  </p>
  <p style="font-size: 10.5px; line-height: 1.5; color: #444; margin: 0 0 8px 0;">
    O Contratante firma 3 instrumentos contratuais autônomos, liberando cada etapa conforme sua conveniência:
  </p>
  <table class="table-2op">
    <thead>
      <tr><th>Contrato / Disciplina</th><th style="width: 20%; text-align: center;">Prazo</th><th style="width: 25%; text-align: right;">Valor (R$)</th></tr>
    </thead>
    <tbody>
      <tr><td>Contrato I — Estudo de Viabilidade Operacional (EVA)</td><td style="text-align: center;">30 dias</td><td style="text-align: right;">R$ 8.000,00</td></tr>
      <tr><td>Contrato II — Processo de Registro e Inscrição ANAC (SDIA) + PBZPA</td><td style="text-align: center;">60 dias</td><td style="text-align: right;">R$ 22.500,00</td></tr>
      <tr><td>Contrato III — Projeto Executivo de Ampliação da PPD (1.300 × 23 m)</td><td style="text-align: center;">90 dias</td><td style="text-align: right;">R$ 85.000,00</td></tr>
      <tr style="background: #FFF6EC; font-weight: bold;">
        <td colspan="2" style="text-align: right;">Total Opção 1 (9 parcelas técnicas):</td>
        <td style="text-align: right; color: #FF6A13;">${formatCurrency(data.valorOpcao1)}</td>
      </tr>
    </tbody>
  </table>
</div>

<div style="background: #FFF7F0; border: 1.5px solid #FF6A13; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
  <p style="font-size: 12px; font-weight: bold; color: #FF6A13; margin: 0 0 4px 0;">
    OPÇÃO 2 — CONTRATO ÚNICO COMBINADO TURNKEY (${formatCurrency(data.valorOpcao2)}) — RECOMENDADO
  </p>
  <p style="font-size: 10.5px; line-height: 1.5; color: #444; margin: 0 0 8px 0;">
    Contratação integrada de todos os serviços com <strong>desconto comercial consolidado</strong> e cronograma em 6 parcelas balanceadas:
  </p>
  <table class="table-2op">
    <thead>
      <tr><th style="width: 15%; text-align: center;">Parcela</th><th>Marco Técnico de Comprovação</th><th style="width: 25%; text-align: right;">Valor (R$)</th></tr>
    </thead>
    <tbody>
      <tr><td style="text-align: center; font-weight: bold;">P1</td><td>Entrada na assinatura do Contrato Único + Mobilização</td><td style="text-align: right;">${formatCurrency(data.valorOpcao2 * 0.2)}</td></tr>
      <tr><td style="text-align: center; font-weight: bold;">P2</td><td>Entrega do Relatório Conclusivo de Viabilidade (EVA)</td><td style="text-align: right;">${formatCurrency(data.valorOpcao2 * 0.15)}</td></tr>
      <tr><td style="text-align: center; font-weight: bold;">P3</td><td>Entrega dos Anteprojetos Geométrico e de Terraplanagem</td><td style="text-align: right;">${formatCurrency(data.valorOpcao2 * 0.15)}</td></tr>
      <tr><td style="text-align: center; font-weight: bold;">P4</td><td>Protocolo do PBZPA no COMAER e abertura do processo no SDIA</td><td style="text-align: right;">${formatCurrency(data.valorOpcao2 * 0.2)}</td></tr>
      <tr><td style="text-align: center; font-weight: bold;">P5</td><td>Entrega do Projeto Executivo Completo (Pavimentação, Drenagem e Balizamento)</td><td style="text-align: right;">${formatCurrency(data.valorOpcao2 * 0.2)}</td></tr>
      <tr><td style="text-align: center; font-weight: bold;">P6</td><td>Parecer final favorável de Registro ANAC + entrega de ARTs</td><td style="text-align: right;">${formatCurrency(data.valorOpcao2 * 0.1)}</td></tr>
      <tr style="background: #FFEDD9; font-weight: bold;">
        <td colspan="2" style="text-align: right;">Valor Global Opção 2:</td>
        <td style="text-align: right; color: #FF6A13;">${formatCurrency(data.valorOpcao2)}</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="pc-2op-sec">3. CRONOGRAMA GANTT MULTI-TRILHA (VIAB / REG / EXEC)</div>
<div style="border: 1px solid #D9D9D9; border-radius: 6px; padding: 10px; background: #FFFDFB; font-size: 9.5px;">
  <p style="font-size: 11px; font-weight: bold; color: #FF6A13; text-align: center; margin: 0 0 6px 0;">
    ESTRUTURAÇÃO DAS 21 SEMANAS (150 DIAS) EM TRÊS TRILHAS PARALELAS
  </p>
  <p style="line-height: 1.5; margin: 2px 0;">
    <strong>Trilha 1 — VIABILIDADE (Semanas 1 a 4):</strong> Levantamento inicial, análise de restrições do espaço aéreo, estudo preliminar de orientação da pista e relatório conclusivo.
  </p>
  <p style="line-height: 1.5; margin: 2px 0;">
    <strong>Trilha 2 — REGISTRO (Semanas 5 a 12):</strong> Montagem do PBZPA, documentação técnica RBAC 157, protocolo COMAER/CINDACTA e abertura do processo SDIA.
  </p>
  <p style="line-height: 1.5; margin: 2px 0;">
    <strong>Trilha 3 — PROJETO EXECUTIVO (Semanas 5 a 21):</strong> Geometria, terraplanagem, dimensionamento PCR (ANAC/FAA), drenagem profunda/superficial, balizamento, memoriais e orçamento.
  </p>
</div>

<div class="pc-2op-sec">4. DADOS BANCÁRIOS</div>
<table class="table-2op">
  <tr><th style="width: 25%; background:#F8F9FA;">Banco</th><td>${INSTITUTIONAL_DATA.banco}</td></tr>
  <tr><th style="background:#F8F9FA;">Agência</th><td>${INSTITUTIONAL_DATA.agencia}</td></tr>
  <tr><th style="background:#F8F9FA;">Conta Corrente</th><td>${INSTITUTIONAL_DATA.contaCorrente}</td></tr>
  <tr><th style="background:#F8F9FA;">Favorecida</th><td>${INSTITUTIONAL_DATA.favorecida}</td></tr>
  <tr><th style="background:#F8F9FA;">CNPJ / Chave PIX</th><td>${INSTITUTIONAL_DATA.chavePix}</td></tr>
</table>

<div style="margin-top: 24px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 18px; font-size: 11px;">
    <strong>${INSTITUTIONAL_DATA.representantes.signataria.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.signataria.cargo} — AEROCAD® CONSULTORIA & AEROPORTOS<br/>
    CNPJ ${INSTITUTIONAL_DATA.cnpj}
  </div>
</div>
`
}

// ==========================================
// 5. PC de Medição / Item a Item (Zurich SBVT)
// ==========================================
export interface ItemMedicao {
  item: number
  descricao: string
  horasTecnicas: number
  unidade: string
  precoUnitario: number
  valorTotal: number
}

export interface PCMedicaoItemAItemData {
  numero: string
  ano: number
  contratante: string
  aerodromoNome: string
  objetoResumo: string // ex: Alteração Cadastral / OPEA A330-300
  prazoDias: number // 30 ou 45 dias
  pcCorrelataOuNota?: string
  itens?: ItemMedicao[]
}

export function buildPCMedicaoItemAItemHTML(data: PCMedicaoItemAItemData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  const itensPadrao: ItemMedicao[] = [
    {
      item: 1,
      descricao: 'LEVANTAMENTO DE DADOS, revisão e pré-análise dos documentos e plantas existentes',
      horasTecnicas: 20,
      unidade: 'hora/técnica',
      precoUnitario: 174,
      valorTotal: 3480,
    },
    {
      item: 2,
      descricao:
        'ANÁLISE DE IMPACTO PBZPA / PZPANA decorrente da nova aeronave-crítica (AIRBUS A330-300)',
      horasTecnicas: 40,
      unidade: 'hora/técnica',
      precoUnitario: 174,
      valorTotal: 6960,
    },
    {
      item: 3,
      descricao:
        'ESTUDO AERONÁUTICO circunstanciado e documentação instrutória para órgão regional',
      horasTecnicas: 60,
      unidade: 'hora/técnica',
      precoUnitario: 174,
      valorTotal: 10440,
    },
    {
      item: 4,
      descricao:
        'PROCESSO SYSAGA — Montagem, protocolo e acompanhamento das notificações do COMAER/DECEA',
      horasTecnicas: 30,
      unidade: 'hora/técnica',
      precoUnitario: 174,
      valorTotal: 5220,
    },
    {
      item: 5,
      descricao: 'ASSESSORIA TÉCNICA E EMISSÃO DE ART junto ao CREA competente',
      horasTecnicas: 28,
      unidade: 'hora/técnica',
      precoUnitario: 178.57,
      valorTotal: 5000,
    },
  ]

  const itens = data.itens && data.itens.length > 0 ? data.itens : itensPadrao
  const totalGeral = itens.reduce((sum, it) => sum + it.valorTotal, 0)

  return `
<style>
  .pc-med-title { color: #FF6A13; font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  .pc-med-sub { font-size: 12px; font-weight: bold; text-align: center; color: #222; margin-bottom: 22px; line-height: 1.4; }
  .pc-med-sec { color: #FF6A13; font-size: 12px; font-weight: bold; margin-top: 18px; margin-bottom: 6px; border-bottom: 1.5px solid #FF6A13; padding-bottom: 2px; text-transform: uppercase; page-break-after: avoid; }
  .table-med { width: 100%; border-collapse: collapse; margin: 6px 0 12px 0; font-size: 10.5px; page-break-inside: avoid; }
  .table-med th, .table-med td { border: 1px solid #D9D9D9; padding: 5px 8px; vertical-align: top; }
  .table-med thead th { background-color: #FF6A13; color: #FFFFFF; font-weight: bold; border-color: #FF6A13; }
</style>

<div class="pc-med-title">PROPOSTA COMERCIAL — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<div class="pc-med-sub">PC Nº ${data.numero}/${data.ano} — ${data.objetoResumo} — ${data.aerodromoNome}</div>

<div class="pc-med-sec">1. IDENTIFICAÇÃO E OBJETO</div>
<table class="table-med">
  <tr><th style="width: 25%; background:#F8F9FA;">Contratante</th><td>${data.contratante}</td></tr>
  <tr><th style="background:#F8F9FA;">Aeródromo</th><td>${data.aerodromoNome}</td></tr>
  <tr><th style="background:#F8F9FA;">Objeto</th><td>${data.objetoResumo}</td></tr>
  <tr><th style="background:#F8F9FA;">Prazo de Execução</th><td>${data.prazoDias} dias corridos até protocolo oficial</td></tr>
  ${data.pcCorrelataOuNota ? `<tr><th style="background:#F8F9FA;">Nota Correlata</th><td>${data.pcCorrelataOuNota}</td></tr>` : ''}
</table>

<div class="pc-med-sec">2. PLANILHA DE MEDIÇÃO ITEM A ITEM (HORAS TÉCNICAS)</div>
<table class="table-med">
  <thead>
    <tr>
      <th style="width: 8%; text-align: center;">Item</th>
      <th>Descrição dos Serviços Especializados</th>
      <th style="width: 12%; text-align: center;">Qtd</th>
      <th style="width: 14%; text-align: center;">Unidade</th>
      <th style="width: 16%; text-align: right;">Preço Unit.</th>
      <th style="width: 18%; text-align: right;">Total (R$)</th>
    </tr>
  </thead>
  <tbody>
    ${itens
      .map(
        (it) => `
    <tr>
      <td style="text-align: center; font-weight: bold;">${it.item}</td>
      <td>${it.descricao}</td>
      <td style="text-align: center;">${it.horasTecnicas}</td>
      <td style="text-align: center;">${it.unidade}</td>
      <td style="text-align: right;">${formatCurrency(it.precoUnitario)}</td>
      <td style="text-align: right; font-weight: bold;">${formatCurrency(it.valorTotal)}</td>
    </tr>`,
      )
      .join('')}
    <tr style="background: #FFEDD9; font-weight: bold;">
      <td colspan="5" style="text-align: right;">VALOR TOTAL DAS MEDIÇÕES TÉCNICAS:</td>
      <td style="text-align: right; color: #FF6A13; font-size: 12px;">${formatCurrency(totalGeral)}</td>
    </tr>
  </tbody>
</table>

<div class="pc-med-sec">3. CRONOGRAMA GANTT PAISAGEM (5 A 7 SEMANAS)</div>
<div style="border: 1px solid #D9D9D9; border-radius: 6px; padding: 10px; background: #FFFDFB; font-size: 9.5px; text-align: center;">
  <p style="font-size: 11px; font-weight: bold; color: #FF6A13; margin: 0 0 6px 0;">
    CRONOGRAMA DE ATIVIDADES EM ${Math.ceil(data.prazoDias / 7)} SEMANAS (CONTROLE AEROCAD)
  </p>
  <table style="width: 100%; border-collapse: collapse; font-size: 9px; text-align: center;">
    <thead>
      <tr style="background: #F2F2F2;">
        <th style="text-align: left; padding: 4px;">Atividade Técnica</th>
        ${Array.from({ length: Math.ceil(data.prazoDias / 7) }, (_, i) => `<th style="padding: 4px; border: 1px solid #D9D9D9;">Semana ${i + 1}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align: left; padding: 4px; border: 1px solid #D9D9D9;">1. Levantamento e Análise de Documentos</td>
        <td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td></td><td></td><td></td>
      </tr>
      <tr>
        <td style="text-align: left; padding: 4px; border: 1px solid #D9D9D9;">2. Análise de Penetração PBZPA/PZPANA</td>
        <td></td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td></td><td></td>
      </tr>
      <tr>
        <td style="text-align: left; padding: 4px; border: 1px solid #D9D9D9;">3. Estudo Aeronáutico Circunstanciado</td>
        <td></td><td></td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td><td></td>
      </tr>
      <tr>
        <td style="text-align: left; padding: 4px; border: 1px solid #D9D9D9;">4. Protocolo Oficial SYSAGA e Emissão ART</td>
        <td></td><td></td><td></td><td style="background:#FF6A13; color:#fff;">●</td><td style="background:#FF6A13; color:#fff;">●</td>
      </tr>
    </tbody>
  </table>
  <div style="font-size: 9px; color: #666; margin-top: 4px;">
    Células laranja (●) indicam o fluxo técnico estrito executado pela equipe AEROCAD.
  </div>
</div>

<div class="pc-med-sec">4. DADOS BANCÁRIOS INSTITUCIONAIS</div>
<table class="table-med">
  <tr><th style="width: 25%; background:#F8F9FA;">Banco</th><td>${INSTITUTIONAL_DATA.banco}</td></tr>
  <tr><th style="background:#F8F9FA;">Agência</th><td>${INSTITUTIONAL_DATA.agencia}</td></tr>
  <tr><th style="background:#F8F9FA;">Conta Corrente</th><td>${INSTITUTIONAL_DATA.contaCorrente}</td></tr>
  <tr><th style="background:#F8F9FA;">Favorecida</th><td>${INSTITUTIONAL_DATA.favorecida}</td></tr>
  <tr><th style="background:#F8F9FA;">CNPJ / Chave PIX</th><td>${INSTITUTIONAL_DATA.chavePix}</td></tr>
</table>

<div style="margin-top: 24px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 18px; font-size: 11px;">
    <strong>${INSTITUTIONAL_DATA.representantes.signataria.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.signataria.cargo} — AEROCAD® CONSULTORIA & AEROPORTOS<br/>
    CNPJ ${INSTITUTIONAL_DATA.cnpj}
  </div>
</div>
`
}
