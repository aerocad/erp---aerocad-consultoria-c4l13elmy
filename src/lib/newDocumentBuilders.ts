import { dataHojeExtenso, INSTITUTIONAL_DATA } from './documentCatalogo'
import { formatCurrency } from './format'

/**
 * Interface para os dados do Estudo de Viabilidade Aeronáutica (EVA)
 * Inspirado no gen_estudo_viabilidade_006_galpoes.py
 */
export interface EVACandidato {
  nome: string
  areaHa?: string
  poligono?: string
  superficieGovernante: string
  cotaTopoGovernanteM?: number
  terrenoMinMaxM?: string
  alturaPretendidaM: number
  alturaConstruivelM: number
  saldoMargemM?: number
  recomendacao: 'RECOMENDADO' | 'NÃO RECOMENDADO'
  observacao?: string
}

export interface EVADocumentData {
  numeroEstudo: string
  empreendimentoNome: string
  clienteRazaoSocial: string
  clienteCnpj: string
  municipioUf: string
  aerodromoReferencia: string
  coordenadasOuPoligono: string
  responsavelTecnicoNome: string
  responsavelTecnicoCrea: string
  responsavelTecnicoTitulo?: string
  mencionarArt: boolean
  numeroArt?: string
  candidatos: EVACandidato[]
  discussaoTecnica?: string
  conclusaoRecomendacaoFinal: 'RECOMENDADO' | 'NÃO RECOMENDADO' | 'CONDICIONADO'
  parecerResumo?: string
}

export function buildEVAHTML(data: EVADocumentData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')
  const rtTitulo = data.responsavelTecnicoTitulo || 'Engenheiro Civil — Responsável Técnico'

  return `
<style>
  .eva-doc { font-family: Arial, Helvetica, sans-serif; color: #222; }
  .eva-title { color: #FF6A13; font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  .eva-subtitle { font-size: 13px; font-weight: bold; text-align: center; color: #333; margin-bottom: 24px; line-height: 1.4; }
  .eva-sec { color: #FF6A13; font-size: 12px; font-weight: bold; margin-top: 20px; margin-bottom: 8px; border-bottom: 1.5px solid #FF6A13; padding-bottom: 3px; text-transform: uppercase; page-break-after: avoid; }
  .eva-table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 12px; font-size: 11px; page-break-inside: avoid; }
  .eva-table th, .eva-table td { border: 1px solid #D9D9D9; padding: 6px 9px; vertical-align: top; text-align: left; }
  .eva-table th { background-color: #F8F9FA; font-weight: bold; color: #333; }
  .eva-table thead th { background-color: #FF6A13; color: #FFFFFF; font-weight: bold; border-color: #FF6A13; }
  .eva-badge-rec { background-color: #E6F4EA; color: #137333; font-weight: bold; padding: 2px 8px; border-radius: 4px; display: inline-block; font-size: 10px; }
  .eva-badge-nao-rec { background-color: #FCE8E6; color: #C5221F; font-weight: bold; padding: 2px 8px; border-radius: 4px; display: inline-block; font-size: 10px; }
  .eva-p { font-size: 11px; line-height: 1.6; text-align: justify; margin: 6px 0; }
  .eva-signature-box { margin-top: 36px; text-align: center; page-break-inside: avoid; }
  .eva-signature-inner { display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 24px; font-size: 11px; }
</style>

<div class="eva-doc">
  <div class="eva-title">ESTUDO DE VIABILIDADE AERONÁUTICA (EVA)</div>
  <div class="eva-subtitle">
    RELATÓRIO TÉCNICO CONCLUSIVO Nº ${data.numeroEstudo}<br/>
    AVALIAÇÃO DE RESTRIÇÕES AO ESPAÇO AÉREO — ICA 11-408 / ICA 63-19
  </div>

  <div class="eva-sec">1. CARACTERIZAÇÃO DO EMPREENDIMENTO E DA ÁREA</div>
  <table class="eva-table">
    <tr><th style="width: 28%;">Empreendimento</th><td><strong>${data.empreendimentoNome}</strong></td></tr>
    <tr><th>Interessado / Contratante</th><td>${data.clienteRazaoSocial} (CNPJ/CPF: ${data.clienteCnpj})</td></tr>
    <tr><th>Município / UF</th><td>${data.municipioUf}</td></tr>
    <tr><th>Aeródromo de Referência</th><td><strong>${data.aerodromoReferencia}</strong></td></tr>
    <tr><th>Polígono / Coordenadas</th><td>${data.coordenadasOuPoligono}</td></tr>
    <tr><th>Responsável Técnico (RT)</th><td>${data.responsavelTecnicoNome} — ${data.responsavelTecnicoCrea}</td></tr>
    ${data.mencionarArt && data.numeroArt ? `<tr><th>ART CREA</th><td>${data.numeroArt}</td></tr>` : ''}
    <tr><th>Data de Emissão</th><td>${cidadeData}</td></tr>
  </table>

  <div class="eva-sec">2. METODOLOGIA E ENQUADRAMENTO NORMATIVO</div>
  <p class="eva-p">
    O presente Estudo de Viabilidade Aeronáutica tem por finalidade verificar a conformidade regulatória e a altura máxima construível para as áreas candidatas do empreendimento, em consonância com as seguintes normas vigentes:
  </p>
  <ul style="font-size: 11px; line-height: 1.6; margin: 6px 0; padding-left: 20px;">
    <li><strong>ICA 11-408/2021:</strong> Instrução do Comando da Aeronáutica sobre Restrições aos Objetos Projetados no Espaço Aéreo (Plano Básico de Zona de Proteção de Aeródromo — PBZPA);</li>
    <li><strong>ICA 63-19/2021:</strong> Critérios para elaboração de Plano de Zoneamento de Proteção contra Auxílios à Navegação Aérea (PZPANA) e Análise Técnica AGA;</li>
    <li><strong>RBAC nº 154 / Anexo 14 OACI:</strong> Projeto e Operação de Aeródromos;</li>
    <li><strong>Doc 8168 OACI (PANS-OPS):</strong> Procedimentos para Serviços de Navegação Aérea.</li>
  </ul>

  <div class="eva-sec">3. ANÁLISE POR ÁREA CANDIDATA E SUPERFÍCIES GOVERNANTES</div>
  <p class="eva-p">
    A análise técnica modelou a interação do terreno e do gabarito pretendido com as superfícies limitadoras de obstáculos (PBZPA) e superfícies de proteção de auxílios rádio (PZPANA — VOR, DME, ILS, RADAR), identificando a restrição mais restritiva (superfície governante):
  </p>

  <table class="eva-table">
    <thead>
      <tr>
        <th style="width: 18%;">Área / Candidato</th>
        <th style="width: 22%;">Superfície Governante</th>
        <th style="width: 14%; text-align: right;">Alt. Pretendida</th>
        <th style="width: 16%; text-align: right;">Alt. Construível</th>
        <th style="width: 14%; text-align: center;">Resultado</th>
        <th style="width: 16%;">Observação</th>
      </tr>
    </thead>
    <tbody>
      ${data.candidatos
        .map(
          (c) => `
      <tr>
        <td><strong>${c.nome}</strong>${c.areaHa ? `<br/><span style="font-size: 10px; color: #666;">Área: ${c.areaHa}</span>` : ''}</td>
        <td>${c.superficieGovernante}</td>
        <td style="text-align: right;">${c.alturaPretendidaM.toFixed(2)} m</td>
        <td style="text-align: right; font-weight: bold; color: ${c.alturaConstruivelM >= c.alturaPretendidaM ? '#137333' : '#C5221F'};">${c.alturaConstruivelM.toFixed(2)} m</td>
        <td style="text-align: center;">
          <span class="${c.recomendacao === 'RECOMENDADO' ? 'eva-badge-rec' : 'eva-badge-nao-rec'}">
            ${c.recomendacao}
          </span>
        </td>
        <td style="font-size: 10px; color: #555;">${c.observacao || (c.alturaConstruivelM >= c.alturaPretendidaM ? 'Comporta gabarito integral' : 'Ultrapassa superfície limitadora')}</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <div class="eva-sec">4. DISCUSSÃO TÉCNICA E COMPARATIVA</div>
  <p class="eva-p">
    ${
      data.discussaoTecnica ||
      `Da análise comparativa entre as áreas candidatas, verifica-se que as condicionantes de proteção ao voo (AGA/ATM) impõem limites rigorosos decorrentes dos auxílios à navegação e superfícies cônica/horizontal interna do aeródromo ${data.aerodromoReferencia}. A área candidata recomendada apresenta folga técnica em relação às superfícies de transição e rampa de rádio-auxílio, garantindo viabilidade para aprovação no COMAER sem necessidade de rebaixamento estrutural ou plano mitigador complexo.`
    }
  </p>

  <div class="eva-sec">5. RECOMENDAÇÃO TÉCNICA FINAL</div>
  <div style="background: ${data.conclusaoRecomendacaoFinal === 'RECOMENDADO' ? '#E6F4EA' : '#FCE8E6'}; border: 1.5px solid ${data.conclusaoRecomendacaoFinal === 'RECOMENDADO' ? '#137333' : '#C5221F'}; border-radius: 6px; padding: 14px; margin: 12px 0;">
    <p style="font-size: 13px; font-weight: bold; color: ${data.conclusaoRecomendacaoFinal === 'RECOMENDADO' ? '#137333' : '#C5221F'}; margin: 0 0 4px 0;">
      PARECER TÉCNICO CONCLUSIVO: ${data.conclusaoRecomendacaoFinal}
    </p>
    <p style="font-size: 11px; margin: 0; line-height: 1.6; color: #222;">
      ${
        data.parecerResumo ||
        (data.conclusaoRecomendacaoFinal === 'RECOMENDADO'
          ? `O empreendimento é considerado TECNICAMENTE RECOMENDADO na área selecionada, não gerando efeitos adversos sobre a segurança e regularidade das operações aéreas do aeródromo ${data.aerodromoReferencia}, estando apto para submissão formal ao DECEA/COMAER via processo OPEA.`
          : `O empreendimento NÃO É RECOMENDADO na configuração e área avaliada com a altura pretendida, em razão de penetração às superfícies limitadoras governantes. Recomenda-se ajuste de gabarito ou escolha da área alternativa favorável.`)
      }
    </p>
  </div>

  <div class="eva-signature-box">
    <p style="font-size: 11px; color: #444;">${cidadeData}</p>
    <div class="eva-signature-inner">
      <strong>${data.responsavelTecnicoNome}</strong><br/>
      ${rtTitulo}<br/>
      ${data.responsavelTecnicoCrea}${data.mencionarArt && data.numeroArt ? `<br/>ART: ${data.numeroArt}` : ''}
    </div>
  </div>
</div>
`
}

/**
 * Interface para os dados do Pedido de Compras
 * Inspirado no gen_pedido_compras_008_twr.py
 */
export interface ItemPedidoCompras {
  item: number | string
  descricao: string
  quantidade?: number
  precoUnitario: number
  valorTotal: number
  previsaoEntrega?: string
}

export interface PurchaseOrderData {
  numeroPedido: string
  // Dados do Tomador (AEROCAD)
  tomadorRazaoSocial?: string
  tomadorCnpj?: string
  responsavelPedido?: string
  // Dados do Fornecedor
  fornecedorRazaoSocial: string
  fornecedorNomeFantasia?: string
  fornecedorCnpjCpf: string
  fornecedorContatoNome?: string
  fornecedorEmail?: string
  fornecedorTelefone?: string
  fornecedorEndereco?: string
  fornecedorAtribuicao?: string
  // Itens
  itens: ItemPedidoCompras[]
  valorTotal: number
  // Condições
  formaPagamento?: string
  chavePixOuBanco?: string
  prazosCondicoes?: string
  observacoesFaturamento?: string
  // Comprador
  compradorNome?: string
  compradorCargo?: string
}

export function buildPurchaseOrderHTML(data: PurchaseOrderData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')
  const tomadorNome = data.tomadorRazaoSocial || INSTITUTIONAL_DATA.razaoSocial
  const tomadorCnpj = data.tomadorCnpj || INSTITUTIONAL_DATA.cnpj
  const comprador = data.compradorNome || INSTITUTIONAL_DATA.representantes.signataria.nome
  const compradorCargo = data.compradorCargo || 'Gerente de Negócios e Administração / Compradora'

  const totalCalculado = data.itens.reduce((acc, i) => acc + i.valorTotal, 0) || data.valorTotal

  return `
<style>
  .po-doc { font-family: Arial, Helvetica, sans-serif; color: #222; }
  .po-title { color: #FF6A13; font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  .po-subtitle { font-size: 13px; font-weight: bold; text-align: center; color: #333; margin-bottom: 24px; }
  .po-sec { color: #FF6A13; font-size: 12px; font-weight: bold; margin-top: 18px; margin-bottom: 6px; border-bottom: 1.5px solid #FF6A13; padding-bottom: 3px; text-transform: uppercase; page-break-after: avoid; }
  .po-table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 12px; font-size: 11px; page-break-inside: avoid; }
  .po-table th, .po-table td { border: 1px solid #D9D9D9; padding: 6px 9px; vertical-align: top; text-align: left; }
  .po-table th { background-color: #F8F9FA; font-weight: bold; color: #333; }
  .po-table thead th { background-color: #FF6A13; color: #FFFFFF; font-weight: bold; border-color: #FF6A13; }
  .po-total-row td { background-color: #FFF4EC; font-weight: bold; font-size: 12px; }
  .po-p { font-size: 11px; line-height: 1.6; text-align: justify; margin: 6px 0; }
  .po-signature-box { margin-top: 36px; text-align: center; page-break-inside: avoid; }
  .po-signature-inner { display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 24px; font-size: 11px; }
</style>

<div class="po-doc">
  <div class="po-title">PEDIDO DE COMPRAS DE SERVIÇOS TÉCNICOS</div>
  <div class="po-subtitle">PEDIDO DE COMPRAS Nº ${data.numeroPedido}</div>

  <div class="po-sec">1. DADOS DO TOMADOR DE SERVIÇOS (AEROCAD)</div>
  <table class="po-table">
    <tr><th style="width: 26%;">Razão Social</th><td><strong>${tomadorNome}</strong></td></tr>
    <tr><th>CNPJ</th><td>${tomadorCnpj}</td></tr>
    <tr><th>Endereço</th><td>${INSTITUTIONAL_DATA.endereco}</td></tr>
    <tr><th>Responsável pelo Pedido</th><td>${data.responsavelPedido || comprador}</td></tr>
    <tr><th>Data de Emissão</th><td>${cidadeData}</td></tr>
  </table>

  <div class="po-sec">2. DADOS DO FORNECEDOR / PRESTADOR CONTRATADO</div>
  <table class="po-table">
    <tr><th style="width: 26%;">Razão Social / Nome</th><td><strong>${data.fornecedorRazaoSocial}</strong></td></tr>
    <tr><th>CNPJ / CPF</th><td>${data.fornecedorCnpjCpf}</td></tr>
    ${data.fornecedorAtribuicao ? `<tr><th>Atribuição / Especialidade</th><td>${data.fornecedorAtribuicao}</td></tr>` : ''}
    ${data.fornecedorContatoNome ? `<tr><th>Ponto Focal / Contato</th><td>${data.fornecedorContatoNome}</td></tr>` : ''}
    <tr><th>E-mail / Telefone</th><td>${data.fornecedorEmail || '—'} · ${data.fornecedorTelefone || '—'}</td></tr>
    ${data.fornecedorEndereco ? `<tr><th>Endereço</th><td>${data.fornecedorEndereco}</td></tr>` : ''}
  </table>

  <div class="po-sec">3. ITENS, ESCOPO E VALORES</div>
  <table class="po-table">
    <thead>
      <tr>
        <th style="width: 8%; text-align: center;">Item</th>
        <th>Descrição do Produto / Serviço Técnico</th>
        <th style="width: 10%; text-align: center;">Qtd</th>
        <th style="width: 18%; text-align: right;">Preço Unit. (R$)</th>
        <th style="width: 18%; text-align: right;">Total (R$)</th>
        <th style="width: 16%; text-align: center;">Prazo / Entrega</th>
      </tr>
    </thead>
    <tbody>
      ${data.itens
        .map(
          (it) => `
      <tr>
        <td style="text-align: center;"><strong>${it.item}</strong></td>
        <td>${it.descricao}</td>
        <td style="text-align: center;">${it.quantidade || 1}</td>
        <td style="text-align: right;">${formatCurrency(it.precoUnitario)}</td>
        <td style="text-align: right; font-weight: bold;">${formatCurrency(it.valorTotal)}</td>
        <td style="text-align: center; font-size: 10px;">${it.previsaoEntrega || 'Conforme demanda'}</td>
      </tr>`,
        )
        .join('')}
      <tr class="po-total-row">
        <td colspan="4"><strong>VALOR TOTAL DO PEDIDO</strong></td>
        <td style="text-align: right; color: #FF6A13;"><strong>${formatCurrency(totalCalculado)}</strong></td>
        <td style="text-align: center;"><strong>—</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="po-sec">4. CONDIÇÕES E FORMA DE PAGAMENTO</div>
  <p class="po-p">
    <strong>Forma de Liquidação:</strong> ${data.formaPagamento || 'Transferência Bancária / PIX'}.<br/>
    <strong>Dados do Favorecido:</strong> ${data.chavePixOuBanco || `Conforme dados bancários cadastrados do fornecedor (${data.fornecedorCnpjCpf})`}.<br/>
    <strong>Prazos e Comprovação:</strong> ${data.prazosCondicoes || 'Pagamento efetuado após a entrega técnica e validação dos produtos pelo Responsável Técnico da AEROCAD.'}
  </p>

  <div class="po-sec">5. INSTRUÇÕES AO FORNECEDOR / FATURAMENTO</div>
  <ul style="font-size: 11px; line-height: 1.6; margin: 6px 0; padding-left: 20px;">
    <li>A Nota Fiscal de Serviços eletrônica (NFS-e) deve ser emitida constando expressamente a referência a este <strong>Pedido de Compras nº ${data.numeroPedido}</strong>;</li>
    <li>Os produtos técnicos deverão ser entregues em formato digital editável (DWG, KMZ, DOCX ou XLSX) e PDF;</li>
    <li>Eventuais revisões decorrentes de conformidade com os regulamentos DECEA/ANAC deverão ser atendidas tempestivamente;</li>
    <li>${data.observacoesFaturamento || 'Retenções tributárias aplicáveis na fonte serão efetuadas conforme a legislação tributária vigente.'}</li>
  </ul>

  <div class="po-signature-box">
    <p style="font-size: 11px; color: #444;">${cidadeData}</p>
    <div class="po-signature-inner">
      <strong>${comprador}</strong><br/>
      ${compradorCargo}<br/>
      ${tomadorNome} · CNPJ ${tomadorCnpj}
    </div>
  </div>
</div>
`
}

/**
 * Interface para os dados do E-mail de Apresentação de Proposta
 * Estrutura padrão da Seção H do FUNCIONALIDADES.md
 */
export interface ProposalEmailData {
  numeroProposta: string
  objeto: string
  destinatarioNome: string
  destinatarioTratamento?: string
  contexto: string
  bulletsEscopo: string[]
  valorGlobal: number
  prazoExecucao: string
  condicoesPagamento: string
  validadeDias: number
  propostaCorrelata?: string
  contatoSecundario?: string
  disposicaoVideoconferencia?: boolean
}

export function buildProposalEmailText(data: ProposalEmailData): {
  subject: string
  bodyText: string
  fullEmail: string
} {
  const tratamento = data.destinatarioTratamento || 'Prezado(a)'
  const subject = `AEROCAD — Proposta Comercial PC nº ${data.numeroProposta} — ${data.objeto}`

  const bulletsFormatted = data.bulletsEscopo
    .filter((b) => b && b.trim())
    .map((b) => `• ${b.trim()}`)
    .join('\n')

  const correlataSection = data.propostaCorrelata
    ? `\nEm conjunto com esta proposta comercial, encaminhamos a Proposta Técnica AEROCAD PT nº ${data.propostaCorrelata}, que detalha a metodologia, as normas adotadas (ICA 11-408 / ICA 63-19) e o cronograma executivo.\n`
    : ''

  const reuniaoSection =
    data.disposicaoVideoconferencia !== false
      ? `Permanecemos à inteira disposição para realizar uma videoconferência de alinhamento com sua equipe técnica, bem como com ${data.contatoSecundario || 'os demais responsáveis pelo projeto'}, para esclarecer qualquer aspecto desta proposta.\n`
      : ''

  const bodyText = `${tratamento} ${data.destinatarioNome},

${data.contexto}

Apresentamos a seguir o resumo dos principais pontos do escopo técnico proposto:

${bulletsFormatted}

Condições comerciais principais:
• Valor global: ${formatCurrency(data.valorGlobal)}
• Prazo de execução técnica: ${data.prazoExecucao}
• Condições de pagamento: ${data.condicoesPagamento}
• Validade da proposta: ${data.validadeDias} dias corridos
${correlataSection}${reuniaoSection}
Agradecemos a oportunidade e renovamos nossos protestos de elevada consideração.

Cordialmente,`

  const fullEmail = `Assunto: ${subject}\n\n${bodyText}`

  return { subject, bodyText, fullEmail }
}
