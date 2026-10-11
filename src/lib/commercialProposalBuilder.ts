import { formatCurrencyRaw as formatCurrency } from './format'
import { dataHojeExtenso, INSTITUTIONAL_DATA } from './documentCatalogo'

export interface MarcoFaturamento {
  id: string
  marco: string
  percentual: number
  valor: number
  evento: string
  modulo?: string
}

export interface ModuloRFQ {
  codigo: string
  nome: string
  descricao: string
  preco: number
  prazo: string
  excluido?: boolean
}

export interface ItemSimples {
  numero: string
  descricao: string
  preco: number
  prazo: string
}

export interface CommercialProposalData {
  tipoVariante: 'simples' | 'duas_opcoes' | 'multi_modulo'
  numero: string
  ano: number
  contratante: string
  cnpjCpf: string
  endereco: string
  objetoAerodromo: string
  referenciaRfq?: string
  contatoEnvio: string
  docTecnicoCorrelato?: string
  valorGlobal: number
  validadeDias: number
  reajusteIndice: string
  limiteRevisoes: number
  exclusoesCustom?: string[]
  // Variante Simples
  itensSimples?: ItemSimples[]
  // Variante 2 opções
  opcaoA?: { titulo: string; descricao: string; valor: number; parcelas: string }
  opcaoB?: { titulo: string; descricao: string; valor: number; parcelas: string }
  // Variante Multi-Módulo (RFQ)
  modulos?: ModuloRFQ[]
  marcos?: MarcoFaturamento[]
  estimativaModuloD?: {
    faixaPreco: string
    taxaAero: string
    prazo: string
    escopo: string
  }
}

export function buildCommercialProposalHTML(data: CommercialProposalData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  if (data.tipoVariante === 'multi_modulo') {
    return buildMultiModuloHTML(data, cidadeData)
  }

  if (data.tipoVariante === 'duas_opcoes') {
    return buildDuasOpcoesHTML(data, cidadeData)
  }

  return buildSimplesHTML(data, cidadeData)
}

function buildHeaderStyle(): string {
  return `
<style>
  .doc-title { color: #FF6A13; font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
  .doc-subtitle { font-size: 13px; font-weight: bold; text-align: center; color: #222; margin-bottom: 24px; line-height: 1.4; }
  .section-title { color: #FF6A13; font-size: 13px; font-weight: bold; margin-top: 22px; margin-bottom: 8px; border-bottom: 1.5px solid #FF6A13; padding-bottom: 3px; text-transform: uppercase; page-break-after: avoid; }
  .aerocad-table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 12px; font-size: 11px; page-break-inside: avoid; }
  .aerocad-table thead { display: table-header-group; }
  .aerocad-table th, .aerocad-table td { border: 1px solid #D9D9D9; padding: 6px 9px; vertical-align: top; text-align: left; }
  .aerocad-table th { background-color: #F8F9FA; font-weight: bold; color: #333; }
  .aerocad-table thead th { background-color: #FF6A13; color: #FFFFFF; font-weight: bold; border-color: #FF6A13; }
  .aerocad-table tr.total-row td { background-color: #FFF3EB; font-weight: bold; color: #222; }
  .text-right { text-align: right !important; }
  .text-center { text-align: center !important; }
  .signature-box { margin-top: 36px; page-break-inside: avoid; text-align: center; }
  .signature-line-inner { display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 24px; font-size: 11px; }
  .notes { font-size: 10px; color: #666; line-height: 1.5; margin-top: 6px; font-style: italic; }
</style>
`
}

function buildSimplesHTML(data: CommercialProposalData, cidadeData: string): string {
  const itens = data.itensSimples || [
    {
      numero: '01',
      descricao: `${data.objetoAerodromo} — Processo técnico e instrução regulatória`,
      preco: data.valorGlobal,
      prazo: '45 a 90 dias corridos',
    },
  ]

  return `
${buildHeaderStyle()}
<div class="doc-title">PROPOSTA COMERCIAL — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<div class="doc-subtitle">PC nº ${data.numero}/${data.ano} — ${data.objetoAerodromo} — ${data.contratante}</div>

<div class="section-title">1. INTERESSADO(A)</div>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Contratante</th><td>${data.contratante}</td></tr>
  <tr><th>CNPJ / CPF</th><td>${data.cnpjCpf}</td></tr>
  <tr><th>Endereço</th><td>${data.endereco}</td></tr>
  <tr><th>Objeto do aeródromo</th><td>${data.objetoAerodromo}</td></tr>
  <tr><th>Contato para envio</th><td>${data.contatoEnvio}</td></tr>
  ${data.docTecnicoCorrelato ? `<tr><th>Documento correlato</th><td>${data.docTecnicoCorrelato}</td></tr>` : ''}
</table>

<div class="section-title">2. APRESENTAÇÃO DA AEROCAD</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 6px 0;">
  A <strong>AEROCAD® CONSULTORIA & AEROPORTOS</strong> foi fundada em 2017 com a missão de prestar serviços de engenharia consultiva e assessoria aeronáutica de excelência técnica ao mercado brasileiro. Sediada em Brasília – DF, mantém interlocução direta com a ANAC, o DECEA e o COMAER, atuando em projetos aeroportuários, heliportuários e de proteção ao espaço aéreo em todo o território nacional.
</p>

<div class="section-title">3. OBJETO E ATIVIDADES TÉCNICAS</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 6px 0;">
  Prestação de serviços técnicos especializados para viabilidade, elaboração de peças técnicas, modelagem de superfícies limitadoras de obstáculos (OLS) e instrução dos processos regulatórios pertinentes ao empreendimento <strong>${data.objetoAerodromo}</strong>.
</p>

<div class="section-title">4. ORÇAMENTO</div>
<table class="aerocad-table">
  <thead>
    <tr>
      <th style="width: 10%;" class="text-center">Item</th>
      <th>Descrição</th>
      <th style="width: 22%;" class="text-right">Preço (R$)</th>
      <th style="width: 22%;" class="text-center">Prazo</th>
    </tr>
  </thead>
  <tbody>
    ${itens
      .map(
        (it) => `
    <tr>
      <td class="text-center"><strong>${it.numero}</strong></td>
      <td>${it.descricao}</td>
      <td class="text-right"><strong>${formatCurrency(it.preco)}</strong></td>
      <td class="text-center">${it.prazo}</td>
    </tr>`,
      )
      .join('')}
    <tr class="total-row">
      <td colspan="2"><strong>VALOR GLOBAL DA PROPOSTA</strong></td>
      <td class="text-right" style="color: #FF6A13;"><strong>${formatCurrency(data.valorGlobal)}</strong></td>
      <td class="text-center"><strong>Sob cronograma</strong></td>
    </tr>
  </tbody>
</table>
<div class="notes">
  Os valores contemplam tributos, despesas diretas e emolumentos da AEROCAD. Taxas oficiais cobradas pelos órgãos reguladores (DECEA e ANAC) correm por conta da Contratante.
</div>

<div class="section-title">5. DADOS BANCÁRIOS INSTITUCIONAIS</div>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Banco</th><td>${INSTITUTIONAL_DATA.banco}</td></tr>
  <tr><th>Agência</th><td>${INSTITUTIONAL_DATA.agencia}</td></tr>
  <tr><th>Conta Corrente</th><td>${INSTITUTIONAL_DATA.contaCorrente}</td></tr>
  <tr><th>Favorecida</th><td>${INSTITUTIONAL_DATA.favorecida}</td></tr>
  <tr><th>CNPJ / Chave PIX</th><td>${INSTITUTIONAL_DATA.chavePix}</td></tr>
</table>

<div class="section-title">6. CONDIÇÕES COMERCIAIS</div>
<ul style="font-size: 11px; line-height: 1.6; margin: 6px 0; padding-left: 20px;">
  <li><strong>Validade da proposta:</strong> ${data.validadeDias} dias corridos contados da emissão.</li>
  <li><strong>Reajuste:</strong> Valores sujeitos a reajuste anual pelo índice ${data.reajusteIndice} após 12 meses.</li>
  <li><strong>Faturamento:</strong> NFS-e emitida em até 5 dias úteis após cada evento comprobatório, com vencimento em 30 dias.</li>
  <li><strong>Obrigação de Meio:</strong> A atuação técnica observará rigorosamente os preceitos normativos vigentes (ICA 11-408/2021 e RBAC correlatos).</li>
</ul>

<div class="section-title">7. EXCLUSÕES</div>
<ul style="font-size: 11px; line-height: 1.6; margin: 6px 0; padding-left: 20px;">
  <li>Projetos de engenharia civil pesada, estruturas, drenagem física e execução de obras;</li>
  <li>Taxas e emolumentos oficiais de órgãos públicos (DECEA/COMAER e ANAC);</li>
  <li>Estudos ambientais específicos (EIA/RIMA/PBA), salvo contratação adicional.</li>
</ul>

<div class="signature-box">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div class="signature-line-inner">
    <strong>${INSTITUTIONAL_DATA.representantes.signataria.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.signataria.cargo} — AEROCAD® CONSULTORIA & AEROPORTOS<br/>
    CNPJ ${INSTITUTIONAL_DATA.cnpj}
  </div>
</div>
`
}

function buildDuasOpcoesHTML(data: CommercialProposalData, cidadeData: string): string {
  const opA = data.opcaoA || {
    titulo: 'Opção 1 — Contratação Módulo a Módulo (Fases Independentes)',
    descricao:
      'Contratação faseada inicial (Estudo de Viabilidade e Pré-análise) com opção futura de execução dos projetos e registros.',
    valor: data.valorGlobal * 0.45,
    parcelas: 'Entrada 50% + 50% na entrega do Relatório de Viabilidade.',
  }
  const opB = data.opcaoB || {
    titulo: 'Opção 2 — Pacote Integrado Completo (Turnkey Regulatório)',
    descricao:
      'Contratação completa com desconto integrado abrangendo Viabilidade, PBZPA/PZPANA, Projetos e acompanhamento até homologação.',
    valor: data.valorGlobal,
    parcelas: 'Sinal 30% + 30% no protocolo DECEA + 40% na aprovação final.',
  }

  return `
${buildHeaderStyle()}
<div class="doc-title">PROPOSTA COMERCIAL — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<div class="doc-subtitle">PC nº ${data.numero}/${data.ano} — ${data.objetoAerodromo} — ${data.contratante}</div>

<div class="section-title">1. INTERESSADO(A)</div>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Contratante</th><td>${data.contratante}</td></tr>
  <tr><th>CNPJ / CPF</th><td>${data.cnpjCpf}</td></tr>
  <tr><th>Endereço</th><td>${data.endereco}</td></tr>
  <tr><th>Objeto do aeródromo</th><td>${data.objetoAerodromo}</td></tr>
  <tr><th>Contato</th><td>${data.contatoEnvio}</td></tr>
</table>

<div class="section-title">2. OPÇÕES DE CONTRATAÇÃO</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 6px 0;">
  Para atender ao melhor interesse operacional e financeiro do Contratante, apresentamos duas alternativas comerciais para a execução dos trabalhos:
</p>

<div style="background: #FAFAFA; border: 1px solid #E0E0E0; border-radius: 6px; padding: 12px; margin: 10px 0;">
  <p style="font-size: 12px; font-weight: bold; color: #FF6A13; margin: 0 0 6px 0;">${opA.titulo}</p>
  <p style="font-size: 11px; margin: 0 0 6px 0;">${opA.descricao}</p>
  <p style="font-size: 11px; margin: 0;"><strong>Valor:</strong> ${formatCurrency(opA.valor)} | <strong>Condições:</strong> ${opA.parcelas}</p>
</div>

<div style="background: #FFF7F0; border: 1.5px solid #FF6A13; border-radius: 6px; padding: 12px; margin: 10px 0;">
  <p style="font-size: 12px; font-weight: bold; color: #FF6A13; margin: 0 0 6px 0;">${opB.titulo} (RECOMENDADO)</p>
  <p style="font-size: 11px; margin: 0 0 6px 0;">${opB.descricao}</p>
  <p style="font-size: 11px; margin: 0;"><strong>Valor Global:</strong> <span style="font-size: 13px; color: #FF6A13; font-weight: bold;">${formatCurrency(opB.valor)}</span> | <strong>Condições:</strong> ${opB.parcelas}</p>
</div>

<div class="section-title">3. DADOS BANCÁRIOS INSTITUCIONAIS</div>
<table class="aerocad-table">
  <tr><th style="width: 25%;">Banco</th><td>${INSTITUTIONAL_DATA.banco}</td></tr>
  <tr><th>Agência</th><td>${INSTITUTIONAL_DATA.agencia}</td></tr>
  <tr><th>Conta Corrente</th><td>${INSTITUTIONAL_DATA.contaCorrente}</td></tr>
  <tr><th>Favorecida</th><td>${INSTITUTIONAL_DATA.favorecida}</td></tr>
  <tr><th>CNPJ / Chave PIX</th><td>${INSTITUTIONAL_DATA.chavePix}</td></tr>
</table>

<div class="section-title">4. CONDIÇÕES GERAIS</div>
<p style="font-size: 11px; line-height: 1.6;">Validade: ${data.validadeDias} dias corridos. NFS-e com prazo de 30 dias para pagamento.</p>

<div class="signature-box">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div class="signature-line-inner">
    <strong>${INSTITUTIONAL_DATA.representantes.signataria.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.signataria.cargo} — AEROCAD® CONSULTORIA & AEROPORTOS<br/>
    CNPJ ${INSTITUTIONAL_DATA.cnpj}
  </div>
</div>
`
}

function buildMultiModuloHTML(data: CommercialProposalData, cidadeData: string): string {
  const modulos = data.modulos || [
    {
      codigo: 'A',
      nome: 'Estudo de Viabilidade AGA/ATM',
      descricao: 'Estudo de Viabilidade AGA/ATM (itens A1 a A8)',
      preco: 78500,
      prazo: '90 dias corridos',
    },
    {
      codigo: 'B',
      nome: 'Implementação regulatória',
      descricao: 'Implementação regulatória (itens B1 a B3)',
      preco: 47700,
      prazo: '45 dias sob controle AEROCAD + prazo de órgão (90 a 180 dias por processo)',
    },
    {
      codigo: 'C',
      nome: 'Atualização do PDIR',
      descricao: 'Atualização do PDIR (itens C1 e C2)',
      preco: 56500,
      prazo: '45 dias corridos',
    },
    {
      codigo: 'D',
      nome: 'Base topográfica/cartográfica',
      descricao:
        'Base topográfica/cartográfica (itens D1 e D2) — EXCLUÍDA da proposta base. Sob demanda, mediante aditivo — estimativa preliminar informada em §3.',
      preco: 0,
      prazo: '—',
      excluido: true,
    },
  ]

  const totalModulos = modulos.filter((m) => !m.excluido).reduce((acc, cur) => acc + cur.preco, 0)

  const marcos = data.marcos || [
    {
      id: '1',
      marco: 'M1',
      percentual: 20,
      valor: 15700,
      modulo: 'Módulo A — R$ 78.500,00 (5 marcos)',
      evento: 'Assinatura do Contrato / OS + recebimento dos dados-base pela AEROCAD.',
    },
    {
      id: '2',
      marco: 'M2',
      percentual: 20,
      valor: 15700,
      modulo: 'Módulo A — R$ 78.500,00 (5 marcos)',
      evento:
        'Entrega do Relatório de Dados de Entrada + Plantas comparativas PBZPA/PZPANA (itens A1 + A2).',
    },
    {
      id: '3',
      marco: 'M3',
      percentual: 20,
      valor: 15700,
      modulo: 'Módulo A — R$ 78.500,00 (5 marcos)',
      evento:
        'Entrega do cadastro de obstáculos + matriz antes/depois + Relatório de Impactos ATM (itens A3 + A4).',
    },
    {
      id: '4',
      marco: 'M4',
      percentual: 20,
      valor: 15700,
      modulo: 'Módulo A — R$ 78.500,00 (5 marcos)',
      evento:
        'Entrega do Estudo Aeronáutico + Matriz de Mitigação + Relatório Preliminar consolidado (itens A5 + A6 v0).',
    },
    {
      id: '5',
      marco: 'M5',
      percentual: 20,
      valor: 15700,
      modulo: 'Módulo A — R$ 78.500,00 (5 marcos)',
      evento:
        'Entrega FINAL do Módulo A — Relatório consolidado revisado + dossiê técnico + ART CREA (itens A6 final + A7 + A8).',
    },
    {
      id: '6',
      marco: 'M6',
      percentual: 35,
      valor: 16695,
      modulo: 'Módulo B — R$ 47.700,00 (3 marcos)',
      evento:
        'Emissão da OS do Módulo B + entrega dos dossiês completos dos processos regulatórios (PBZPA + PZPANA + Estudo Aeronáutico/OPEA + alteração cadastral ANAC).',
    },
    {
      id: '7',
      marco: 'M7',
      percentual: 35,
      valor: 16695,
      modulo: 'Módulo B — R$ 47.700,00 (3 marcos)',
      evento:
        'Apresentação dos comprovantes formais de PROTOCOLO de todos os processos junto ao DECEA/COMAER e ANAC.',
    },
    {
      id: '8',
      marco: 'M8',
      percentual: 30,
      valor: 14310,
      modulo: 'Módulo B — R$ 47.700,00 (3 marcos)',
      evento:
        'Encerramento técnico dos processos com apresentação dos pareceres/comprovantes de aprovação (ou parecer conclusivo) dos órgãos + Relatório Conclusivo por processo.',
    },
    {
      id: '9',
      marco: 'M9',
      percentual: 40,
      valor: 22600,
      modulo: 'Módulo C — R$ 56.500,00 (2 marcos)',
      evento: 'Entrega da Matriz de Impactos sobre o PDIR vigente (item C1).',
    },
    {
      id: '10',
      marco: 'M10',
      percentual: 60,
      valor: 33900,
      modulo: 'Módulo C — R$ 56.500,00 (2 marcos)',
      evento: 'Entrega do PDIR consolidado revisado — DOCX + DWG + PDF + ART CREA (item C2).',
    },
  ]

  // Agrupamento dos marcos por módulo
  const gruposMarcos: Record<string, MarcoFaturamento[]> = {}
  marcos.forEach((m) => {
    const mod = m.modulo || 'Marcos de Faturamento'
    if (!gruposMarcos[mod]) gruposMarcos[mod] = []
    gruposMarcos[mod].push(m)
  })

  return `
${buildHeaderStyle()}
<div class="doc-title">PROPOSTA COMERCIAL — SERVIÇOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<div class="doc-subtitle">
  PC nº ${data.numero}/${data.ano} — ${data.objetoAerodromo} — ${data.contratante}
</div>

<div class="section-title">1. INTERESSADO(A)</div>
<table class="aerocad-table">
  <tr><th style="width: 26%;">Contratante</th><td>${data.contratante}</td></tr>
  <tr><th>Objeto do aeródromo</th><td>${data.objetoAerodromo}</td></tr>
  <tr><th>Referência RFQ</th><td>${data.referenciaRfq || 'RFQ Set/2026 · Rev. nº 0'}</td></tr>
  <tr><th>Contato para envio</th><td>${data.contatoEnvio}</td></tr>
  <tr><th>Documento técnico correlato</th><td>Proposta Técnica AEROCAD PT nº ${data.docTecnicoCorrelato || '240/2026'} (parte integrante desta PC)</td></tr>
</table>

<div class="section-title">2. QUADRO OBRIGATÓRIO DA PROPOSTA COMERCIAL (RFQ)</div>
<p style="font-size: 11px; margin-bottom: 6px;">Preços e prazos por módulo, no formato exigido pela RFQ ${data.contratante}:</p>
<table class="aerocad-table">
  <thead>
    <tr>
      <th style="width: 10%;" class="text-center">Módulo</th>
      <th>Descrição</th>
      <th style="width: 20%;" class="text-right">Preço (R$)</th>
      <th style="width: 25%;" class="text-center">Prazo</th>
    </tr>
  </thead>
  <tbody>
    ${modulos
      .map(
        (m) => `
    <tr>
      <td class="text-center"><strong>${m.codigo}</strong></td>
      <td>${m.descricao}</td>
      <td class="text-right">${m.excluido ? 'EXCLUÍDO (ver §3)' : `R$ ${m.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</td>
      <td class="text-center">${m.prazo}</td>
    </tr>`,
      )
      .join('')}
    <tr class="total-row">
      <td class="text-center"><strong>TOTAL</strong></td>
      <td><strong>Valor global — Módulos A + B + C (Módulo D EXCLUÍDO)</strong></td>
      <td class="text-right" style="color: #FF6A13;"><strong>${formatCurrency(totalModulos || data.valorGlobal)}</strong></td>
      <td class="text-center"><strong>140 dias corridos AEROCAD + prazo de órgão</strong></td>
    </tr>
  </tbody>
</table>
<div class="notes">
  Os valores contemplam integralmente tributos, despesas, deslocamentos, diárias, emolumentos da AEROCAD, custos de aquisição de dados públicos e demais custos diretos e indiretos necessários à execução dos Módulos A, B e C. Taxas oficiais eventualmente cobradas pelos órgãos reguladores (DECEA/COMAER e ANAC) não estão incluídas.
</div>

<div class="section-title">3. MÓDULO D — ESTIMATIVA PRELIMINAR (SUBCONTRATAÇÃO OPCIONAL)</div>
<p style="font-size: 11px; line-height: 1.5; text-align: justify; margin: 6px 0;">
  O Módulo D encontra-se EXCLUÍDO desta proposta base. Caso a CONTRATANTE opte pelo levantamento aerofotogramétrico dedicado, a AEROCAD oferece, mediante ADITIVO específico, a subcontratação e coordenação técnica do serviço junto a empresa aerofotogramétrica qualificada, com estimativa preliminar de:
</p>
<table class="aerocad-table">
  <tr><th style="width: 32%;">Estimativa preliminar (base)</th><td>R$ 95.000,00 a R$ 140.000,00 (a depender da área efetiva, resolução e época de voo)</td></tr>
  <tr><th>Taxa de coordenação AEROCAD</th><td>12% sobre o valor da subcontratação</td></tr>
  <tr><th>Prazo estimado do Módulo D</th><td>30 a 45 dias corridos (a confirmar em cotação firme)</td></tr>
  <tr><th>Escopo mínimo</th><td>Ortoimagem (GSD ≤ 10 cm) + MDS/MDT + pontos de controle + cadastro georreferenciado de obstáculos (conforme Anexo I da PT)</td></tr>
</table>
<div class="notes">
  A cotação firme do Módulo D será apresentada em até 10 dias úteis após a manifestação de interesse da CONTRATANTE, com validade própria informada pelo aerofotogramétrico contratado.
</div>

<div class="section-title">4. CRONOGRAMA DE FATURAMENTO — VINCULADO A ENTREGAS TÉCNICAS</div>
<p style="font-size: 11px; margin-bottom: 6px;">
  Os marcos de faturamento estão vinculados a entregáveis objetivos, conforme os produtos descritos na Proposta Técnica:
</p>

${Object.entries(gruposMarcos)
  .map(
    ([grupoNome, lista]) => `
<p style="font-size: 11px; font-weight: bold; margin-top: 10px; margin-bottom: 4px; color: #333;">${grupoNome}</p>
<table class="aerocad-table">
  <thead>
    <tr>
      <th style="width: 10%;" class="text-center">Marco</th>
      <th style="width: 10%;" class="text-center">%</th>
      <th style="width: 20%;" class="text-right">Valor (R$)</th>
      <th>Evento comprobatório</th>
    </tr>
  </thead>
  <tbody>
    ${lista
      .map(
        (m) => `
    <tr>
      <td class="text-center"><strong>${m.marco}</strong></td>
      <td class="text-center">${m.percentual}%</td>
      <td class="text-right">${formatCurrency(m.valor)}</td>
      <td>${m.evento}</td>
    </tr>`,
      )
      .join('')}
  </tbody>
</table>`,
  )
  .join('')}
<div class="notes">
  NFS-e emitida em até 5 (cinco) dias úteis após a comprovação de cada marco. Vencimento em 30 (trinta) dias corridos da emissão da NFS-e. Pagamento via TED/PIX na conta corrente informada em §5.
</div>

<div class="section-title">5. DADOS BANCÁRIOS</div>
<table class="aerocad-table">
  <tr><th style="width: 26%;">Banco</th><td>${INSTITUTIONAL_DATA.banco}</td></tr>
  <tr><th>Agência</th><td>${INSTITUTIONAL_DATA.agencia}</td></tr>
  <tr><th>Conta Corrente</th><td>${INSTITUTIONAL_DATA.contaCorrente}</td></tr>
  <tr><th>Favorecida</th><td>${INSTITUTIONAL_DATA.favorecida}</td></tr>
  <tr><th>CNPJ / Chave PIX</th><td>${INSTITUTIONAL_DATA.chavePix}</td></tr>
</table>

<div class="section-title">6. CONDIÇÕES COMERCIAIS</div>
<p style="font-size: 11px; margin: 4px 0;"><strong>6.1 Validade da proposta:</strong> Proposta válida por ${data.validadeDias} (noventa) dias corridos contados da data de sua emissão.</p>
<p style="font-size: 11px; margin: 4px 0;"><strong>6.2 Reajuste:</strong> Os valores contratados serão reajustados pelo ${data.reajusteIndice} após transcurso de 12 (doze) meses da assinatura do Contrato, aplicável aos marcos ainda não faturados.</p>
<p style="font-size: 11px; margin: 4px 0;"><strong>6.3 Serviços extraordinários:</strong> Serviços extraordinários (fora do escopo dos Módulos A, B e C ou revisões além das 2 já inclusas no Módulo A) serão objeto de orçamento específico apresentado previamente para aprovação formal da CONTRATANTE antes da execução, mediante aditivo contratual.</p>
<p style="font-size: 11px; margin: 4px 0;"><strong>6.4 Premissas de aditivo:</strong> Alteração de aeronave-crítica ou mudança relevante de projeto conceitual; inclusão de novos escopos; revisões adicionais; mudanças normativas supervenientes; novas visitas técnicas adicionais.</p>
<p style="font-size: 11px; margin: 4px 0;"><strong>6.5 Limite de revisões inclusas:</strong> Estão inclusas ${data.limiteRevisoes} (duas) revisões completas dos produtos do Módulo A, SEM CUSTO ADICIONAL.</p>

<div class="section-title">7. EXCLUSÕES E CONDICIONANTES</div>
<ul style="font-size: 11px; line-height: 1.5; margin: 6px 0; padding-left: 20px;">
  <li>Projetos executivos de engenharia civil, estruturas, instalações elétricas, drenagem, geotecnia, meio ambiente ou execução física de obras — não incluídos, salvo módulo adicional expressamente contratado;</li>
  <li>Elaboração de PANS-OPS completos (desenho novo de procedimentos IFR) — o Módulo A entrega ANÁLISE DE IMPACTOS em procedimentos IFR, não o desenho completo dos novos procedimentos;</li>
  <li>Taxas oficiais dos órgãos reguladores (DECEA/COMAER e ANAC) — de responsabilidade da CONTRATANTE;</li>
  <li>Módulo D — Base topográfica/cartográfica (excluída — ver §3);</li>
  <li>Elaboração de ajustes do projeto arquitetônico/geométrico da ampliação — responsabilidade da CONTRATANTE e de seus projetistas; AEROCAD atua na análise e orientação AGA/ATM;</li>
  <li>Estudos ambientais (EIA/RIMA, PBA, PZR completo) — quando aplicáveis, cotáveis em proposta específica;</li>
  <li>Serviços em outros aeródromos além do sítio acordado.</li>
</ul>

<div class="section-title">8. DOCUMENTOS CADASTRAIS BÁSICOS ANEXOS</div>
<ul style="font-size: 11px; line-height: 1.5; margin: 6px 0; padding-left: 20px;">
  <li>Contrato Social consolidado da AEROCAD Terraplanagem e Construção LTDA;</li>
  <li>Documento do representante legal — ${INSTITUTIONAL_DATA.representantes.signataria.nome} (CPF ${INSTITUTIONAL_DATA.representantes.signataria.cpf});</li>
  <li>Comprovante de CNPJ (${INSTITUTIONAL_DATA.cnpj}) e Inscrição Estadual (${INSTITUTIONAL_DATA.inscricaoEstadual});</li>
  <li>Dados bancários (§5 desta PC);</li>
  <li>Certidões negativas aplicáveis: Receita Federal / Dívida Ativa da União; FGTS; débitos trabalhistas (CNDT); tributos estaduais DF; tributos municipais DF.</li>
</ul>

<div class="section-title">9. ENCERRAMENTO</div>
<p style="font-size: 11px; line-height: 1.5; text-align: justify; margin: 6px 0;">
  Esta Proposta Comercial é apresentada em conjunto com a Proposta Técnica AEROCAD PT nº ${data.docTecnicoCorrelato || '240/2026'}, que a integra para todos os efeitos, e obedece rigorosamente à estrutura e aos critérios técnicos acordados. Colocamo-nos à inteira disposição para eventuais esclarecimentos.
</p>

<div class="signature-box">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div class="signature-line-inner">
    <strong>${INSTITUTIONAL_DATA.representantes.signataria.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.signataria.cargo} — AEROCAD® CONSULTORIA & AEROPORTOS<br/>
    CNPJ ${INSTITUTIONAL_DATA.cnpj}
  </div>
</div>
`
}
