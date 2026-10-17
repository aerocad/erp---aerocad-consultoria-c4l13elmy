import { dataHojeExtenso, INSTITUTIONAL_DATA, PALETA_AEROCAD_2026 } from './documentCatalogo'

// Helper comum de estilo
function baseDocStyle(): string {
  return `
<style>
  .doc-title-h1 { color: #FF6A13; font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .doc-sub-h2 { font-size: 12px; font-weight: bold; text-align: center; color: #222; margin-bottom: 22px; line-height: 1.4; }
  .doc-sec-h3 { color: #FF6A13; font-size: 12px; font-weight: bold; margin-top: 18px; margin-bottom: 6px; border-bottom: 1.5px solid #FF6A13; padding-bottom: 2px; text-transform: uppercase; page-break-after: avoid; }
  .table-std { width: 100%; border-collapse: collapse; margin: 6px 0 12px 0; font-size: 10.5px; page-break-inside: avoid; }
  .table-std th, .table-std td { border: 1px solid #D9D9D9; padding: 5px 8px; vertical-align: top; }
  .table-std thead th { background-color: #FF6A13; color: #FFFFFF; font-weight: bold; border-color: #FF6A13; }
  .table-std th.label-col { background-color: #F8F9FA; width: 25%; font-weight: bold; color: #333; }
</style>
`
}

// ==========================================
// 1. Ofício (OF)
// ==========================================
export interface OficioData {
  numero: string
  ano: number
  destinatarioNome: string
  destinatarioCargo: string
  destinatarioOrgao: string
  destinatarioCidadeUf: string
  assunto: string
  formaTratamento?: string // ex: "Senhor(a) Superintendente,"
  paragrafoAbertura?: string
  desenvolvimento?: string
  encerramento?: string
  signatarioNome?: string
  signatarioCargo?: string
  signatarioCreaCau?: string
}

export function buildOficioHTML(data: OficioData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')
  const signatarioNome =
    data.signatarioNome || INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome
  const signatarioCargo =
    data.signatarioCargo || INSTITUTIONAL_DATA.representantes.responsavelTecnico.cargo
  const signatarioReg =
    data.signatarioCreaCau || INSTITUTIONAL_DATA.representantes.responsavelTecnico.crea

  return `
${baseDocStyle()}
<div class="doc-title-h1">OFÍCIO Nº ${data.numero}/${data.ano} – AEROCAD</div>
<div class="doc-sub-h2">Brasília – DF, ${cidadeData}</div>

<div style="margin-bottom: 18px; font-size: 11px; line-height: 1.6; color: #333;">
  <strong>Ao(À) ${data.destinatarioNome}</strong><br/>
  ${data.destinatarioCargo}<br/>
  ${data.destinatarioOrgao}<br/>
  ${data.destinatarioCidadeUf}
</div>

<div style="background: #FFF7F0; border-left: 3px solid #FF6A13; padding: 8px 12px; margin-bottom: 18px; font-size: 11px;">
  <strong>Assunto:</strong> ${data.assunto}
</div>

<div style="font-size: 11px; line-height: 1.8; text-align: justify; color: #222;">
  <p>${data.formaTratamento || 'Prezado(a) Senhor(a),'}</p>

  <p>
    ${data.paragrafoAbertura || 'Cumprimentando-o(a) cordialmente, servimo-nos do presente para submeter à apreciação técnica de V. Sa. as informações e requerimentos pertinentes à regularidade das operações e zonas de proteção aeronáutica do empreendimento sob nossa assessoria técnica.'}
  </p>

  <p>
    ${data.desenvolvimento || 'Em atenção às diretrizes estabelecidas pelas normas vigentes da Autoridade de Aviação Civil (ANAC) e do Departamento de Controle do Espaço Aéreo (DECEA), informamos que foram concluídos os levantamentos técnicos e as análises das superfícies limitadoras de obstáculos (ICA 11-408/2021). Constatou-se a estrita conformidade com os requisitos de segurança e operacionalidade requeridos, conforme dossiê instrutório anexo.'}
  </p>

  <p>
    ${data.encerramento || 'Diante do exposto, solicitamos a manifestação formal de anuência deste respeitável órgão, renovando nossos protestos de elevada estima e distinta consideração.'}
  </p>

  <p style="margin-top: 24px;">Atenciosamente,</p>
</div>

<div style="margin-top: 36px; text-align: center; page-break-inside: avoid;">
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; font-size: 11px;">
    <strong>${signatarioNome}</strong><br/>
    ${signatarioCargo}<br/>
    ${signatarioReg} — AEROCAD® CONSULTORIA & AEROPORTOS
  </div>
</div>
`
}

// ==========================================
// 2. Memorial Descritivo (MD — 11 seções)
// ==========================================
export interface MemorialDescritivoData {
  numero: string
  revisao: string
  empreendimentoNome: string
  clienteRazaoSocial: string
  localizacaoIcao: string
  disciplina: string
  responsavelTecnico: string
  creaNumero: string
  conteudoSeccoes?: Record<string, string>
}

export function buildMemorialDescritivoHTML(data: MemorialDescritivoData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  const secoes = [
    {
      id: '1',
      titulo: '1. APRESENTAÇÃO E CONTEXTO',
      texto:
        data.conteudoSeccoes?.['1'] ||
        'O presente Memorial Descritivo tem por finalidade registrar e fundamentar tecnicamente as características de implantação, dimensionamento operacional e zoneamento de proteção aeronáutica do sítio em estudo.',
    },
    {
      id: '2',
      titulo: '2. OBJETO DO MEMORIAL',
      texto:
        data.conteudoSeccoes?.['2'] ||
        `Detalhamento das características geométricas, físicas e operacionais do ${data.empreendimentoNome}, em conformidade com as diretrizes normativas da ANAC e do DECEA.`,
    },
    {
      id: '3',
      titulo: '3. LOCALIZAÇÃO E CARACTERIZAÇÃO DO SÍTIO',
      texto:
        data.conteudoSeccoes?.['3'] ||
        `Localizado em ${data.localizacaoIcao}, o sítio possui coordenadas georreferenciadas no sistema SIRGAS 2000, com altitude oficial e acessos viários devidamente compatibilizados.`,
    },
    {
      id: '4',
      titulo: '4. NORMAS E REFERÊNCIAS TÉCNICAS',
      texto:
        data.conteudoSeccoes?.['4'] ||
        'Atendimento rigoroso ao RBAC 153/154/155, ICA 11-408/2021, ICA 63-19/2021, Anexo 14 OACI e normas ABNT aplicáveis.',
    },
    {
      id: '5',
      titulo: '5. GEOMETRIA E IMPLANTAÇÃO OPERACIONAL',
      texto:
        data.conteudoSeccoes?.['5'] ||
        'Definição da pista de pouso e decolagem (PPD), faixas de pista (strip), áreas de segurança de fim de pista (RESA), pátios e áreas de manobra.',
    },
    {
      id: '6',
      titulo: '6. PAVIMENTAÇÃO E CAPACIDADE DE CARGA',
      texto:
        data.conteudoSeccoes?.['6'] ||
        'Dimensionamento estrutural do pavimento com especificação de PCR (Pavement Classification Rating) e compatibilidade com a aeronave-crítica de projeto.',
    },
    {
      id: '7',
      titulo: '7. AUXÍLIOS VISUAIS E LUMINOSOS',
      texto:
        data.conteudoSeccoes?.['7'] ||
        'Sinalização horizontal, balizamento luminoso de borda e cabeceira, indicador visual de rampa de aproximação (PAPI) e biruta iluminada.',
    },
    {
      id: '8',
      titulo: '8. EDIFICAÇÕES E INFRAESTRUTURA DE APOIO',
      texto:
        data.conteudoSeccoes?.['8'] ||
        'Instalações terminais, hangares, posto de abastecimento de aeronaves (PAA) e seção contra incêndio (SCI).',
    },
    {
      id: '9',
      titulo: '9. SUPRESSÃO E MANEJO DE OBSTÁCULOS',
      texto:
        data.conteudoSeccoes?.['9'] ||
        'Identificação de obstáculos no cone de aproximação e superfícies de transição com diretrizes para poda, rebaixamento ou balizamento de obstáculos.',
    },
    {
      id: '10',
      titulo: '10. CONCLUSÕES E RECOMENDAÇÕES TÉCNICAS',
      texto:
        data.conteudoSeccoes?.['10'] ||
        'O empreendimento demonstra plena viabilidade técnico-operacional, recomendando-se o protocolo dos processos de aprovação e inscrição cadastral perante as autoridades competentes.',
    },
    {
      id: '11',
      titulo: '11. RESPONSABILIDADE TÉCNICA',
      texto:
        data.conteudoSeccoes?.['11'] ||
        `Serviços executados sob responsabilidade técnica de ${data.responsavelTecnico}, ${data.creaNumero}, com recolhimento da respectiva ART junto ao CREA competente.`,
    },
  ]

  return `
${baseDocStyle()}
<div class="doc-title-h1">MEMORIAL DESCRITIVO DE ENGENHARIA AERONÁUTICA</div>
<div class="doc-sub-h2">AEROCAD-MD-${data.numero} · Rev. ${data.revisao} — ${data.empreendimentoNome}</div>

<table class="table-std">
  <tr><th class="label-col">Empreendimento</th><td>${data.empreendimentoNome}</td></tr>
  <tr><th class="label-col">Cliente / Operador</th><td>${data.clienteRazaoSocial}</td></tr>
  <tr><th class="label-col">Localização / ICAO</th><td>${data.localizacaoIcao}</td></tr>
  <tr><th class="label-col">Disciplina</th><td>${data.disciplina}</td></tr>
  <tr><th class="label-col">Responsável Técnico</th><td>${data.responsavelTecnico} — ${data.creaNumero}</td></tr>
</table>

${secoes
  .map(
    (s) => `
<div class="doc-sec-h3">${s.titulo}</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0 10px 0; color: #222;">
  ${s.texto}
</p>`,
  )
  .join('')}

<div style="margin-top: 30px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 18px; font-size: 11px;">
    <strong>${data.responsavelTecnico}</strong><br/>
    Engenheiro Responsável Técnico — ${data.creaNumero}<br/>
    AEROCAD® CONSULTORIA & AEROPORTOS
  </div>
</div>
`
}

// ==========================================
// 3. Memorial de Cálculo (MC — 6 seções + tabela de cargas)
// ==========================================
export interface CargaCalculo {
  id: string
  descricao: string
  valor: string
  coefPonderacao: string
}

export interface MemorialCalculoData {
  numero: string
  empreendimentoNome: string
  disciplina: string // ex: Pavimentação / Estrutural / OLS
  softwareUtilizado: string
  responsavelTecnico: string
  creaNumero: string
  cargas?: CargaCalculo[]
}

export function buildMemorialCalculoHTML(data: MemorialCalculoData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')
  const cargas = data.cargas || [
    {
      id: 'C-01',
      descricao: 'Peso Máximo de Decolagem (MTOW) — Aeronave-Crítica',
      valor: '8.618 kg',
      coefPonderacao: '1.00',
    },
    {
      id: 'C-02',
      descricao: 'Carga por Roda Principal (Trem Principal Duplo)',
      valor: '3.878 kg',
      coefPonderacao: '1.20',
    },
    {
      id: 'C-03',
      descricao: 'Pressão de Inflação dos Pneus (Tire Pressure)',
      valor: '0.62 MPa (90 psi)',
      coefPonderacao: '1.00',
    },
    {
      id: 'C-04',
      descricao: 'Impacto Dinâmico de Pouso / Fator de Impacto',
      valor: '1.50 × Carga Estática',
      coefPonderacao: '1.50',
    },
  ]

  return `
${baseDocStyle()}
<div class="doc-title-h1">MEMORIAL DE CÁLCULO DE ENGENHARIA</div>
<div class="doc-sub-h2">AEROCAD-MC-${data.numero} — ${data.empreendimentoNome}</div>

<table class="table-std">
  <tr><th class="label-col">Empreendimento</th><td>${data.empreendimentoNome}</td></tr>
  <tr><th class="label-col">Disciplina</th><td>${data.disciplina}</td></tr>
  <tr><th class="label-col">Software / Ferramenta</th><td>${data.softwareUtilizado}</td></tr>
  <tr><th class="label-col">Responsável Técnico</th><td>${data.responsavelTecnico} — ${data.creaNumero}</td></tr>
</table>

<div class="doc-sec-h3">1. OBJETO E ESCOPO DO CÁLCULO</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  Memória de dimensionamento e verificações numéricas dos parâmetros técnicos de segurança para o empreendimento <strong>${data.empreendimentoNome}</strong>.
</p>

<div class="doc-sec-h3">2. PREMISSAS E HIPÓTESES DE CÁLCULO</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  Consideração de vida útil de projeto de 20 anos, modelos de degradação estrutural padronizados e enquadramento nos estados limites últimos (ELU) e de serviço (ELS).
</p>

<div class="doc-sec-h3">3. DADOS DE ENTRADA E TABELA DE CARGAS</div>
<table class="table-std">
  <thead>
    <tr>
      <th style="width: 15%; text-align: center;">ID</th>
      <th>Descrição da Carga / Ação</th>
      <th style="width: 25%; text-align: center;">Valor Característico</th>
      <th style="width: 20%; text-align: center;">Coef. Ponderação</th>
    </tr>
  </thead>
  <tbody>
    ${cargas
      .map(
        (c) => `
    <tr>
      <td style="text-align: center; font-weight: bold;">${c.id}</td>
      <td>${c.descricao}</td>
      <td style="text-align: center; font-weight: bold;">${c.valor}</td>
      <td style="text-align: center;">${c.coefPonderacao}</td>
    </tr>`,
      )
      .join('')}
  </tbody>
</table>

<div class="doc-sec-h3">4. CRITÉRIOS NORMATIVOS ADOTADOS</div>
<p style="font-size: 11px; line-height: 1.6; margin: 4px 0;">
  Normas de referência: FAA AC 150/5320-6, ICAO Doc 9157 (Aerodrome Design Manual), RBAC 154 e normas ABNT NBR 6118 / NBR 8681.
</p>

<div class="doc-sec-h3">5. DIMENSIONAMENTO E RESULTADOS OBTIDOS</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  Os coeficientes de segurança calculados superam as exigências normativas mínimas em todos os cenários operacionais simulados, garantindo estabilidade e integridade operacional.
</p>

<div class="doc-sec-h3">6. CONCLUSÃO E RESPONSABILIDADE TÉCNICA</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  Atesta-se a conformidade plena dos cálculos apresentados, vinculando-se a presente memória à Anotação de Responsabilidade Técnica (ART) competente.
</p>

<div style="margin-top: 30px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 18px; font-size: 11px;">
    <strong>${data.responsavelTecnico}</strong><br/>
    ${data.creaNumero} — AEROCAD® CONSULTORIA & AEROPORTOS
  </div>
</div>
`
}

// ==========================================
// 4. Laudo / Parecer Técnico (LT)
// ==========================================
export interface LaudoParecerData {
  numero: string
  tipo: 'Laudo Técnico' | 'Parecer Técnico' | 'Vistoria Técnica'
  solicitante: string
  objetoExaminado: string
  localizacao: string
  dataVistoria: string
  responsavelTecnico: string
  creaNumero: string
  analiseTecnica?: string
  conclusao?: string
}

export function buildLaudoParecerHTML(data: LaudoParecerData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  return `
${baseDocStyle()}
<div class="doc-title-h1">${data.tipo.toUpperCase()}</div>
<div class="doc-sub-h2">AEROCAD-LT-${data.numero} — ${data.objetoExaminado}</div>

<table class="table-std">
  <tr><th class="label-col">Tipo de Peça</th><td><strong>[X] ${data.tipo}</strong></td></tr>
  <tr><th class="label-col">Solicitante</th><td>${data.solicitante}</td></tr>
  <tr><th class="label-col">Objeto Examinado</th><td>${data.objetoExaminado}</td></tr>
  <tr><th class="label-col">Localização</th><td>${data.localizacao}</td></tr>
  <tr><th class="label-col">Data da Vistoria In Loco</th><td>${data.dataVistoria}</td></tr>
  <tr><th class="label-col">Responsável Técnico</th><td>${data.responsavelTecnico} — ${data.creaNumero}</td></tr>
</table>

<div class="doc-sec-h3">1. HISTÓRICO E OBJETIVO DA SOLICITAÇÃO</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  Avaliação pericial e manifestação técnica formal quanto à conformidade aeronáutica, integridade operacional e segurança de voo do objeto inspecionado.
</p>

<div class="doc-sec-h3">2. METODOLOGIA E VISTORIA EM CAMPO</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  Inspeção visual e geométrica realizada em <strong>${data.dataVistoria}</strong>, com levantamento fotográfico, conferência de cotas altimétricas com receptor GNSS geodésico e confrontação direta com os limites das superfícies de proteção aeronáutica.
</p>

<div class="doc-sec-h3">3. ANÁLISE TÉCNICA CIRCUNSTANCIADA</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  ${data.analiseTecnica || 'A análise detida dos elementos coligidos demonstra que a estrutura atende aos critérios operacionais estipulados pela ICA 11-408/2021 e RBAC 154. Não foram identificadas violações críticas às superfícies de aproximação ou decolagem que inviabilizem a autorização pretendida.'}
</p>

<div class="doc-sec-h3">4. CONCLUSÃO E RECOMENDAÇÕES PERICIAIS</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  ${data.conclusao || 'Conclui-se favoravelmente à regularidade do objeto periciado perante a Autoridade Aeronáutica, recomendando-se a manutenção periódica dos dispositivos luminosos de balizamento e sinalização visual.'}
</p>

<div style="margin-top: 30px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 18px; font-size: 11px;">
    <strong>${data.responsavelTecnico}</strong><br/>
    Engenheiro Responsável Técnico — ${data.creaNumero}<br/>
    ART vinculada registrada no CREA
  </div>
</div>
`
}

// ==========================================
// 5. Relatório Gerencial (RG — com suporte a RG CNI/SNAW)
// ==========================================
export interface RelatorioGerencialData {
  numero: string
  ano: number
  mesReferencia: string // ex: AGOSTO/2026
  tipoInstalacao: 'heliponto' | 'aerodromo'
  nomeEmpreendimento: string // ex: Edifício Armando Monteiro Neto (CEAMN)
  designacaoIcao: string // ex: SNAW
  contratante: string
  cnpjContratante: string
  coordenadas: string
  elevacao: string
  dimensoesMaterial: string
  dadosSnawDefault?: boolean
}

export function buildRelatorioGerencialHTML(data: RelatorioGerencialData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  const local = data.dadosSnawDefault
    ? 'Edifício Armando Monteiro Neto (CEAMN) — Brasília-DF'
    : data.nomeEmpreendimento
  const rotaer = data.dadosSnawDefault
    ? 'SNAW — SENAI/SESI/CNI — HELPN PRIV UTC-3 HJ (Operação diurna VFR)'
    : `${data.designacaoIcao} — Operação VFR`
  const coord = data.dadosSnawDefault ? '15°47\'26" S / 047°52\'46" W' : data.coordenadas
  const elev = data.dadosSnawDefault ? '1.152 m MSL (3.779 ft)' : data.elevacao
  const dim = data.dadosSnawDefault
    ? '19,50 m × 19,50 m — Concreto (CONC) — 4 t (categorias L30 · L34)'
    : data.dimensoesMaterial

  return `
${baseDocStyle()}
<div class="doc-title-h1">RELATÓRIO GERENCIAL MENSAL DE OPERAÇÃO & MANUTENÇÃO</div>
<div class="doc-sub-h2">AEROCAD-RG Nº ${data.numero}/${data.ano} — Mês de Referência: ${data.mesReferencia}</div>

<div class="doc-sec-h3">1. IDENTIFICAÇÃO DO HELIPONTO / AERÓDROMO</div>
<table class="table-std">
  <tr><th class="label-col">Local / Edifício</th><td>${local}</td></tr>
  <tr><th class="label-col">Designação ROTAER</th><td>${rotaer}</td></tr>
  <tr><th class="label-col">Coordenadas</th><td>${coord}</td></tr>
  <tr><th class="label-col">Elevação Oficial</th><td>${elev}</td></tr>
  <tr><th class="label-col">Dimensões / Carga</th><td>${dim}</td></tr>
  <tr><th class="label-col">Contratante</th><td>${data.contratante} · CNPJ ${data.cnpjContratante}</td></tr>
  <tr><th class="label-col">Contratada</th><td>${INSTITUTIONAL_DATA.razaoSocial} · CNPJ ${INSTITUTIONAL_DATA.cnpj}</td></tr>
</table>

<div class="doc-sec-h3">2. ATIVIDADES DESENVOLVIDAS NO MÊS</div>

<p style="font-size: 11px; font-weight: bold; color: #444; margin: 6px 0 2px 0;">a) Documentação e Situação Regulatória</p>
<p style="font-size: 10.5px; line-height: 1.5; color: #333; margin: 0 0 6px 0;">
  Cadastro plenamente regular e ativo perante ANAC e CINDACTA I. Monitoramento contínuo das publicações ROTAER e avisos aos navegantes (NOTAM).
</p>

<p style="font-size: 11px; font-weight: bold; color: #444; margin: 6px 0 2px 0;">b) Aspecto Físico e Estado Geral da Superfície FATO/TLOF</p>
<p style="font-size: 10.5px; line-height: 1.5; color: #333; margin: 0 0 6px 0;">
  Inspeção visual da superfície de toque (TLOF), platibandas de proteção, canaletas perimetrais de drenagem e tela de segurança (safety net). Revestimento asfáltico/concreto em boas condições operacionais.
</p>

<p style="font-size: 11px; font-weight: bold; color: #444; margin: 6px 0 2px 0;">c) Dados de Movimento Operacional</p>
<p style="font-size: 10.5px; line-height: 1.5; color: #333; margin: 0 0 6px 0;">
  Não foram registradas ocorrências de incidentes no período de referência. Ficha de movimento com registro zerado de operações de emergência ou não autorizadas.
</p>

<p style="font-size: 11px; font-weight: bold; color: #444; margin: 6px 0 2px 0;">d) Manutenções Preventivas e Corretivas</p>
<p style="font-size: 10.5px; line-height: 1.5; color: #333; margin: 0 0 6px 0;">
  Verificação funcional do farol de heliponto, balizamento luminoso perimetral e biruta indicadora de direção do vento. Equipamentos operando em perfeita conformidade com o RBAC 155.
</p>

<div class="doc-sec-h3">3. RECOMENDAÇÕES DA EQUIPE TÉCNICA</div>
<ul style="font-size: 10.5px; line-height: 1.5; margin: 4px 0; padding-left: 20px; color: #333;">
  <li>Manter o cronograma de limpeza quinzenal das canaletas de drenagem pluvial;</li>
  <li>Revisão semestral preventiva da pintura e sinalização horizontal diurna;</li>
  <li>Inspeção periódica da tensão dos tirantes de sustentação da biruta.</li>
</ul>

<div style="margin-top: 30px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 18px; font-size: 11px;">
    <strong>${INSTITUTIONAL_DATA.representantes.coordenador.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.coordenador.cargo}<br/>
    AEROCAD® CONSULTORIA & AEROPORTOS
  </div>
</div>
`
}

// ==========================================
// 6. Ata de Reunião (AT)
// ==========================================
export interface ParticipanteAta {
  nome: string
  empresa: string
  cargo: string
}

export interface EncaminhamentoAta {
  acao: string
  responsavel: string
  prazo: string
}

export interface AtaReuniaoData {
  numero: string
  ano: number
  projetoNome: string
  clienteNome: string
  dataHora: string
  local: string
  pauta: string[]
  participantes?: ParticipanteAta[]
  deliberacoes?: string[]
  encaminhamentos?: EncaminhamentoAta[]
}

export function buildAtaReuniaoHTML(data: AtaReuniaoData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  const participantes = data.participantes || [
    {
      nome: INSTITUTIONAL_DATA.representantes.coordenador.nome,
      empresa: 'AEROCAD',
      cargo: 'Coordenador de Projetos (Redator)',
    },
    {
      nome: INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome,
      empresa: 'AEROCAD',
      cargo: 'RT Engenheiro Civil',
    },
    { nome: 'Representante Técnico', empresa: data.clienteNome, cargo: 'Gestor do Contrato' },
  ]

  const encaminhamentos = data.encaminhamentos || [
    {
      acao: 'Disponibilização da planta georreferenciada atualizada do sítio',
      responsavel: data.clienteNome,
      prazo: '5 dias úteis',
    },
    {
      acao: 'Conclusão da modelagem das superfícies limitadoras OLS',
      responsavel: 'AEROCAD',
      prazo: '15 dias úteis',
    },
    {
      acao: 'Agendamento de checkpoint técnico quinzenal',
      responsavel: 'AEROCAD / Cliente',
      prazo: 'Conforme cronograma',
    },
  ]

  return `
${baseDocStyle()}
<div class="doc-title-h1">ATA DE REUNIÃO TÉCNICA DE ALINHAMENTO</div>
<div class="doc-sub-h2">AEROCAD-AT-${data.numero}/${data.ano} — ${data.projetoNome}</div>

<table class="table-std">
  <tr><th class="label-col">Projeto</th><td>${data.projetoNome}</td></tr>
  <tr><th class="label-col">Cliente / Contratante</th><td>${data.clienteNome}</td></tr>
  <tr><th class="label-col">Data e Horário</th><td>${data.dataHora}</td></tr>
  <tr><th class="label-col">Local / Modalidade</th><td>${data.local}</td></tr>
</table>

<div class="doc-sec-h3">1. PARTICIPANTES</div>
<table class="table-std">
  <thead>
    <tr>
      <th>Nome Completo</th>
      <th style="width: 30%;">Instituição / Empresa</th>
      <th style="width: 30%;">Cargo / Função</th>
    </tr>
  </thead>
  <tbody>
    ${participantes
      .map(
        (p) => `
    <tr>
      <td><strong>${p.nome}</strong></td>
      <td>${p.empresa}</td>
      <td>${p.cargo}</td>
    </tr>`,
      )
      .join('')}
  </tbody>
</table>

<div class="doc-sec-h3">2. PAUTA DISCUTIDA</div>
<ul style="font-size: 11px; line-height: 1.6; margin: 4px 0; padding-left: 20px;">
  ${data.pauta.map((item) => `<li>${item}</li>`).join('')}
</ul>

<div class="doc-sec-h3">3. DELIBERAÇÕES E DECISÕES</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  ${data.deliberacoes?.join(' ') || 'Foram alinhadas as premissas para modelagem das superfícies de proteção e estabelecido o canal oficial de troca de informações entre os pontos focais técnicos.'}
</p>

<div class="doc-sec-h3">4. MATRIZ DE ENCAMINHAMENTOS (ACTION ITEMS)</div>
<table class="table-std">
  <thead>
    <tr>
      <th>Ação / Encaminhamento</th>
      <th style="width: 25%;">Responsável</th>
      <th style="width: 20%; text-align: center;">Prazo</th>
    </tr>
  </thead>
  <tbody>
    ${encaminhamentos
      .map(
        (e) => `
    <tr>
      <td>${e.acao}</td>
      <td><strong>${e.responsavel}</strong></td>
      <td style="text-align: center;">${e.prazo}</td>
    </tr>`,
      )
      .join('')}
  </tbody>
</table>

<div style="margin-top: 30px; page-break-inside: avoid;">
  <p style="font-size: 10px; color: #555; text-align: center; margin-bottom: 24px;">Assinaturas dos representantes:</p>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: center; font-size: 10px;">
    ${participantes
      .slice(0, 3)
      .map(
        (p) => `
    <div>
      <div style="border-top: 1px solid #555; padding-top: 4px;">
        <strong>${p.nome}</strong><br/>${p.empresa}
      </div>
    </div>`,
      )
      .join('')}
  </div>
</div>
`
}

// ==========================================
// 7. Plano de Ação Corretiva (PAC)
// ==========================================
export interface AcaoCorretiva {
  acao: string
  responsavel: string
  prazo: string
  status: string
}

export interface PlanoAcaoCorretivaData {
  numero: string
  ano: number
  documentoOrigem: string // Auto de infração / Notificação ANAC
  aerodromoNome: string
  operadorNome: string
  causaRaiz5Porques: string[]
  acoes: AcaoCorretiva[]
}

export function buildPlanoAcaoCorretivaHTML(data: PlanoAcaoCorretivaData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  return `
${baseDocStyle()}
<div class="doc-title-h1">PLANO DE AÇÃO CORRETIVA (PAC)</div>
<div class="doc-sub-h2">AEROCAD-PAC-${data.numero}/${data.ano} — ${data.aerodromoNome}</div>

<table class="table-std">
  <tr><th class="label-col">Documento de Origem</th><td>${data.documentoOrigem}</td></tr>
  <tr><th class="label-col">Aeródromo / Sítio</th><td>${data.aerodromoNome}</td></tr>
  <tr><th class="label-col">Operador / Contratante</th><td>${data.operadorNome}</td></tr>
  <tr><th class="label-col">Responsável Técnico</th><td>${INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome} — ${INSTITUTIONAL_DATA.representantes.responsavelTecnico.crea}</td></tr>
</table>

<div class="doc-sec-h3">1. ANÁLISE DE CAUSA RAIZ (METODOLOGIA DOS 5 PORQUÊS)</div>
<table class="table-std">
  <thead>
    <tr>
      <th style="width: 15%; text-align: center;">Nível</th>
      <th>Interrogação e Resposta Técnica</th>
    </tr>
  </thead>
  <tbody>
    ${data.causaRaiz5Porques
      .map(
        (item, idx) => `
    <tr>
      <td style="text-align: center; font-weight: bold;">${idx + 1}º Porquê</td>
      <td>${item}</td>
    </tr>`,
      )
      .join('')}
  </tbody>
</table>

<div class="doc-sec-h3">2. CRONOGRAMA DE AÇÕES CORRETIVAS E MITIGADORAS</div>
<table class="table-std">
  <thead>
    <tr>
      <th>Ação Corretiva Proposta</th>
      <th style="width: 25%;">Responsável</th>
      <th style="width: 18%; text-align: center;">Prazo</th>
      <th style="width: 18%; text-align: center;">Status</th>
    </tr>
  </thead>
  <tbody>
    ${data.acoes
      .map(
        (a) => `
    <tr>
      <td>${a.acao}</td>
      <td>${a.responsavel}</td>
      <td style="text-align: center;">${a.prazo}</td>
      <td style="text-align: center; font-weight: bold; color: #FF6A13;">${a.status}</td>
    </tr>`,
      )
      .join('')}
  </tbody>
</table>

<div style="margin-top: 30px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 18px; font-size: 11px;">
    <strong>${INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.responsavelTecnico.cargo} — ${INSTITUTIONAL_DATA.nomeComercial}<br/>
    ${INSTITUTIONAL_DATA.representantes.responsavelTecnico.crea}
  </div>
</div>
`
}

// ==========================================
// 8. Ficha de Não Conformidade (FNC)
// ==========================================
export interface FichaNaoConformidadeData {
  numero: string
  ano: number
  aerodromoNome: string
  setorInspecionado: string
  requisitoViolado: string
  severidade: 'CRÍTICA' | 'ALTA' | 'MÉDIA' | 'BAIXA'
  descricaoNaoConformidade: string
  acaoRecomendada: string
  prazoRecomendado: string
}

export function buildFichaNaoConformidadeHTML(data: FichaNaoConformidadeData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  const sevColor =
    data.severidade === 'CRÍTICA'
      ? '#D93025'
      : data.severidade === 'ALTA'
        ? '#E37400'
        : data.severidade === 'MÉDIA'
          ? '#F9AB00'
          : '#1E8E3E'

  return `
${baseDocStyle()}
<div class="doc-title-h1">FICHA DE NÃO CONFORMIDADE (FNC)</div>
<div class="doc-sub-h2">AEROCAD-FNC-${data.numero}/${data.ano} — ${data.aerodromoNome}</div>

<table class="table-std">
  <tr><th class="label-col">Aeródromo / Sítio</th><td>${data.aerodromoNome}</td></tr>
  <tr><th class="label-col">Setor Inspecionado</th><td>${data.setorInspecionado}</td></tr>
  <tr><th class="label-col">Requisito Violado</th><td>${data.requisitoViolado}</td></tr>
  <tr>
    <th class="label-col">Classificação de Severidade</th>
    <td>
      <span style="background-color: ${sevColor}; color: #FFF; font-weight: bold; padding: 3px 8px; border-radius: 4px; font-size: 10px;">
        ${data.severidade}
      </span>
    </td>
  </tr>
</table>

<div class="doc-sec-h3">1. DESCRIÇÃO OBJETIVA DO ACHADO / NÃO CONFORMIDADE</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0; color: #222;">
  ${data.descricaoNaoConformidade}
</p>

<div class="doc-sec-h3">2. AÇÃO CORRETIVA IMEDIATA RECOMENDADA</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0; color: #222;">
  ${data.acaoRecomendada}
</p>
<p style="font-size: 10.5px; margin-top: 6px;"><strong>Prazo máximo recomendado:</strong> ${data.prazoRecomendado}</p>

<div style="margin-top: 30px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 18px; font-size: 11px;">
    <strong>${INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.responsavelTecnico.crea} — Auditor / Inspetor Técnico
  </div>
</div>
`
}

// ==========================================
// 9. Requerimento ANAC / DECEA (RQ)
// ==========================================
export interface RequerimentoAnacDeceaData {
  numero: string
  ano: number
  orgaoDestinatario: string // ex: CINDACTA I / ANAC - SIA
  requerenteRazaoSocial: string
  requerenteCnpj: string
  requerenteEndereco: string
  fundamentacaoNormativa: string
  dosFatos: string
  doPedido: string
  documentosAnexos: string[]
}

export function buildRequerimentoAnacDeceaHTML(data: RequerimentoAnacDeceaData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  return `
${baseDocStyle()}
<div class="doc-title-h1">REQUERIMENTO OFICIAL DE PROCESSO AERONÁUTICO</div>
<div class="doc-sub-h2">AEROCAD-RQ-${data.numero}/${data.ano}</div>

<div style="margin-bottom: 16px; font-size: 11.5px; font-weight: bold; color: #333;">
  AO ILUSTRÍSSIMO SENHOR DIRIGENTE DO ${data.orgaoDestinatario.toUpperCase()}
</div>

<div class="doc-sec-h3">1. QUALIFICAÇÃO DO REQUERENTE</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  <strong>${data.requerenteRazaoSocial}</strong>, pessoa jurídica devidamente inscrita no CNPJ sob o nº ${data.requerenteCnpj}, com sede estabelecida em ${data.requerenteEndereco}, por intermédio de sua representante legalmente constituída nos autos (AEROCAD CONSULTORIA & AEROPORTOS), vem respeitosamente à presença de V. Sa. expor e requerer o que se segue:
</p>

<div class="doc-sec-h3">2. DOS FATOS</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  ${data.dosFatos}
</p>

<div class="doc-sec-h3">3. DA FUNDAMENTAÇÃO NORMATIVA</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  O presente pleito encontra integral respaldo na legislação aeronáutica brasileira, em especial no disposto na <strong>${data.fundamentacaoNormativa}</strong>, tendo sido atendidas todas as exigências técnicas e instrutórias estabelecidas pela Autoridade Aeronáutica.
</p>

<div class="doc-sec-h3">4. DO PEDIDO</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 4px 0;">
  ${data.doPedido}
</p>

<div class="doc-sec-h3">5. ROL DE DOCUMENTOS ANEXOS</div>
<ul style="font-size: 10.5px; line-height: 1.5; margin: 4px 0; padding-left: 20px;">
  ${data.documentosAnexos.map((doc) => `<li>${doc}</li>`).join('')}
</ul>

<div style="margin-top: 30px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #555; padding-top: 8px; margin-top: 18px; font-size: 11px;">
    <strong>${INSTITUTIONAL_DATA.representantes.signataria.nome}</strong><br/>
    Procuradora Outorgada — CPF ${INSTITUTIONAL_DATA.representantes.signataria.cpf}<br/>
    AEROCAD® CONSULTORIA & AEROPORTOS
  </div>
</div>
`
}
