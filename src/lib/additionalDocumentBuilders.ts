import { dataHojeExtenso, INSTITUTIONAL_DATA } from './documentCatalogo'
import { formatCurrencyRaw as formatCurrency } from './format'

export interface ContractDocumentData {
  numeroContrato: string
  clienteRazaoSocial: string
  clienteCnpj: string
  clienteEndereco: string
  objetoNome: string
  projetoNumero: string
  escopo: string
  valorGlobal: number
  prazoExecucao: string
  condicoesPagamento: string
}

export function buildContractHTML(data: ContractDocumentData): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  return `
<style>
  .ct-title { color: #FF6A13; font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  .ct-subtitle { font-size: 13px; font-weight: bold; text-align: center; color: #333; margin-bottom: 24px; }
  .ct-clause { font-size: 12px; font-weight: bold; color: #FF6A13; margin-top: 18px; margin-bottom: 4px; text-transform: uppercase; page-break-after: avoid; }
  .ct-p { font-size: 11px; line-height: 1.6; text-align: justify; margin: 6px 0; color: #222; }
</style>

<div class="ct-title">CONTRATO DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS DE ENGENHARIA E CONSULTORIA AERONÁUTICA</div>
<div class="ct-subtitle">INSTRUMENTO CONTRATUAL Nº ${data.numeroContrato}</div>

<div class="ct-clause">CLÁUSULA 1ª — DAS PARTES E QUALIFICAÇÃO</div>
<p class="ct-p">
  <strong>CONTRATANTE:</strong> <strong>${data.clienteRazaoSocial}</strong>, pessoa jurídica de direito privado inscrita no CNPJ sob o nº <strong>${data.clienteCnpj}</strong>, com sede estabelecida em ${data.clienteEndereco}, doravante denominada simplesmente CONTRATANTE.
</p>
<p class="ct-p">
  <strong>CONTRATADA:</strong> <strong>${INSTITUTIONAL_DATA.razaoSocial}</strong>, pessoa jurídica de direito privado inscrita no CNPJ sob o nº <strong>${INSTITUTIONAL_DATA.cnpj}</strong>, com sede no ${INSTITUTIONAL_DATA.endereco}, neste ato representada por sua procuradora e signatária administrativa <strong>${INSTITUTIONAL_DATA.representantes.signataria.nome}</strong>, inscrita no CPF sob o nº <strong>${INSTITUTIONAL_DATA.representantes.signataria.cpf}</strong>, doravante denominada simplesmente CONTRATADA.
</p>

<div class="ct-clause">CLÁUSULA 2ª — DO OBJETO</div>
<p class="ct-p">
  O presente contrato tem por objeto a prestação de serviços técnicos especializados de assessoria e engenharia aeronáutica para o empreendimento <strong>${data.objetoNome}</strong> (referência Projeto AEROCAD nº ${data.projetoNumero}), compreendendo: ${data.escopo}.
</p>

<div class="ct-clause">CLÁUSULA 3ª — DAS OBRIGAÇÕES DA CONTRATADA</div>
<p class="ct-p">
  A CONTRATADA obriga-se a: (a) Desenvolver os estudos, memoriais, plantas e peças técnicas em rigorosa conformidade com os regulamentos vigentes do DECEA/COMAER e da ANAC; (b) Alocar equipe técnica habilitada; (c) Emitir a respectiva Anotação de Responsabilidade Técnica (ART) junto ao CREA competente; (d) Prestar suporte técnico e atender a eventuais exigências regulatórias formuladas pelos órgãos públicos dentro das premissas contratadas.
</p>

<div class="ct-clause">CLÁUSULA 4ª — DAS OBRIGAÇÕES DA CONTRATANTE</div>
<p class="ct-p">
  A CONTRATANTE obriga-se a: (a) Disponibilizar tempestivamente os dados cadastrais, plantas arquitetônicas, coordenadas e informações técnicas necessárias à execução dos trabalhos; (b) Efetuar os pagamentos nas datas e marcos ajustados; (c) Arcar com as taxas, emolumentos e guias oficiais cobradas diretamente pelos órgãos públicos reguladores (DECEA/COMAER e ANAC).
</p>

<div class="ct-clause">CLÁUSULA 5ª — DO PREÇO E CONDIÇÕES DE PAGAMENTO</div>
<p class="ct-p">
  Pela prestação dos serviços objeto deste contrato, a CONTRATANTE pagará à CONTRATADA o valor global de <strong>${formatCurrency(data.valorGlobal)}</strong>, a ser liquidado conforme o seguinte cronograma e condições:
</p>
<p class="ct-p" style="background: #FFF9F5; border-left: 3px solid #FF6A13; padding: 8px 12px; margin: 8px 0;">
  ${data.condicoesPagamento}
</p>
<p class="ct-p">
  Os pagamentos serão efetuados mediante transferência bancária ou PIX em favor da CONTRATADA no <strong>Banco INTER (077)</strong>, Agência 0001, Conta Corrente 7637194-8, CNPJ/PIX: 28.036.597/0001-43. A Nota Fiscal de Serviços eletrônica (NFS-e) será emitida em até 5 (cinco) dias úteis após o cumprimento de cada marco comprobatório, com prazo de vencimento de 30 (trinta) dias.
</p>

<div class="ct-clause">CLÁUSULA 6ª — DO PRAZO DE EXECUÇÃO</div>
<p class="ct-p">
  O prazo estimado para desenvolvimento técnico sob controle da CONTRATADA é de <strong>${data.prazoExecucao}</strong> contados do recebimento completo dos dados de entrada. Fica expressamente ajustado que o tempo de análise e deliberação dos órgãos da administração pública (DECEA e ANAC) independe do controle da CONTRATADA e não computa para fins de mora.
</p>

<div class="ct-clause">CLÁUSULA 7ª — DA RESPONSABILIDADE TÉCNICA (OBRIGAÇÃO DE MEIO)</div>
<p class="ct-p">
  As partes expressamente ajustam que, por se tratar de procedimentos submetidos à análise discricionária dos órgãos reguladores da Aviação Civil, a obrigação técnica assumida pela CONTRATADA é de <strong>MEIO</strong>, consubstanciada na elaboração fidedigna das peças conforme a melhor técnica da engenharia e na defesa e complementação técnica necessária até o parecer final do processo.
</p>

<div class="ct-clause">CLÁUSULA 8ª — DA CONFIDENCIALIDADE</div>
<p class="ct-p">
  As partes comprometem-se a resguardar o mais absoluto sigilo sobre dados técnicos, comerciais, financeiros e estratégicos a que tiverem acesso em razão deste contrato, perdurando tal obrigação durante a vigência do contrato e pelo período de <strong>5 (cinco) anos</strong> após a sua extinção.
</p>

<div class="ct-clause">CLÁUSULA 9ª — DA RESCISÃO E MULTA RESCISÓRIA</div>
<p class="ct-p">
  Em caso de rescisão imotivada ou desistência por qualquer das partes, incidirá multa compensatória de <strong>20% (vinte por cento)</strong> calculada sobre o saldo contratual remanescente, sem prejuízo da remuneração integral de todas as etapas e produtos já concluídos e entregues até a data do distrato.
</p>

<div class="ct-clause">CLÁUSULA 10ª — DAS CONDIÇÕES GERAIS E ADITIVOS</div>
<p class="ct-p">
  Qualquer acréscimo de escopo, alteração na geometria conceitual do empreendimento ou demanda extraordinária de revisões será objeto de termo aditivo contratual específico prévio.
</p>

<div class="ct-clause">CLÁUSULA 11ª — DO FORO DE ELEIÇÃO</div>
<p class="ct-p">
  Para dirimir quaisquer dúvidas ou litígios decorrentes da execução deste contrato, as partes elegem o Foro da Circunscrição Judiciária de <strong>Brasília – DF</strong>, com expressa renúncia de qualquer outro, por mais privilegiado que seja.
</p>

<div style="margin-top: 36px; page-break-inside: avoid;">
  <p style="text-align: center; font-size: 11px; color: #444;">${cidadeData}</p>
  
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 24px;">
    <div style="border-top: 1px solid #444; padding-top: 8px; text-align: center; font-size: 11px;">
      <strong>CONTRATANTE</strong><br/>
      ${data.clienteRazaoSocial}<br/>
      CNPJ ${data.clienteCnpj}
    </div>
    <div style="border-top: 1px solid #444; padding-top: 8px; text-align: center; font-size: 11px;">
      <strong>CONTRATADA</strong><br/>
      ${INSTITUTIONAL_DATA.razaoSocial}<br/>
      ${INSTITUTIONAL_DATA.representantes.signataria.nome} · Procuradora
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px;">
    <div style="border-top: 1px solid #999; padding-top: 8px; font-size: 10px; text-align: center; color: #666;">
      Testemunha 1: ____________________________<br/>
      Nome / CPF:
    </div>
    <div style="border-top: 1px solid #999; padding-top: 8px; font-size: 10px; text-align: center; color: #666;">
      Testemunha 2: ____________________________<br/>
      Nome / CPF:
    </div>
  </div>
</div>
`
}

export function buildInternalServiceOrderHTML(data: {
  numeroOS: string
  projetoNumero: string
  projetoNome: string
  clienteRazaoSocial: string
  clienteCnpj: string
  escopo: string
  responsavelTecnico: string
  prazo: string
}): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  return `
<style>
  .os-title { color: #FF6A13; font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  .os-subtitle { font-size: 13px; font-weight: bold; text-align: center; color: #333; margin-bottom: 24px; }
  .os-sec { color: #FF6A13; font-size: 12px; font-weight: bold; margin-top: 18px; margin-bottom: 6px; border-bottom: 1.5px solid #FF6A13; padding-bottom: 2px; text-transform: uppercase; page-break-after: avoid; }
  .os-table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0; page-break-inside: avoid; }
  .os-table thead { display: table-header-group; }
  .os-table th, .os-table td { border: 1px solid #D9D9D9; padding: 6px 8px; text-align: left; }
  .os-table th { background: #F8F9FA; font-weight: bold; width: 25%; }
</style>

<div class="os-title">ORDEM DE SERVIÇO INTERNA</div>
<div class="os-subtitle">OS Nº ${data.numeroOS} — Abertura e Alocação de Projeto</div>

<div class="os-sec">1. DADOS DE CONTROLE DO PROJETO</div>
<table class="os-table">
  <tr><th>Projeto Nº</th><td><strong>${data.projetoNumero}</strong></td></tr>
  <tr><th>Empreendimento</th><td>${data.projetoNome}</td></tr>
  <tr><th>Cliente / Contratante</th><td>${data.clienteRazaoSocial} (${data.clienteCnpj})</td></tr>
  <tr><th>Prazo Técnico Alocado</th><td>${data.prazo}</td></tr>
  <tr><th>Responsável Técnico</th><td>${data.responsavelTecnico}</td></tr>
  <tr><th>Data de Emissão</th><td>${cidadeData}</td></tr>
</table>

<div class="os-sec">2. ESCOPO DOS TRABALHOS</div>
<p style="font-size: 11px; line-height: 1.6; text-align: justify; margin: 6px 0;">
  ${data.escopo}
</p>

<div class="os-sec">3. EQUIPE DESIGNADA E RESPONSABILIDADES</div>
<table class="os-table">
  <thead>
    <tr style="background: #FF6A13; color: white;">
      <th style="color: white;">Função</th>
      <th style="color: white;">Profissional</th>
      <th style="color: white;">Atribuição Principal</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Responsável Técnico (RT)</strong></td>
      <td>${INSTITUTIONAL_DATA.representantes.responsavelTecnico.nome} (${INSTITUTIONAL_DATA.representantes.responsavelTecnico.crea})</td>
      <td>Coordenação geral técnica e emissão de Anotação de Responsabilidade Técnica (ART).</td>
    </tr>
    <tr>
      <td><strong>Coordenação de Projetos</strong></td>
      <td>${INSTITUTIONAL_DATA.representantes.coordenador.nome}</td>
      <td>Compatibilização de entregas, conformidade de arquivos e cronograma.</td>
    </tr>
    <tr>
      <td><strong>Especialista Técnico</strong></td>
      <td>${data.responsavelTecnico}</td>
      <td>Modelagem das superfícies limitadoras (OLS), memórias de cálculo e dossiês de instrução.</td>
    </tr>
  </tbody>
</table>

<div class="os-sec">4. ENTREGÁVEIS OBRIGATÓRIOS</div>
<ul style="font-size: 11px; line-height: 1.6; margin: 6px 0; padding-left: 20px;">
  <li>Relatório de consolidação dos dados de entrada SIRGAS 2000;</li>
  <li>Plantas das superfícies limitadoras em formato editável (DWG) e pranchas em PDF;</li>
  <li>Memorial Descritivo circunstanciado fundamentado na ICA 11-408 / ICA 63-19;</li>
  <li>Dossiê formal para protocolo junto ao órgão regulador competente;</li>
  <li>Anotação de Responsabilidade Técnica (ART/CREA).</li>
</ul>

<div style="margin-top: 40px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 320px; border-top: 1px solid #444; padding-top: 6px; margin-top: 24px; font-size: 11px;">
    <strong>${INSTITUTIONAL_DATA.representantes.coordenador.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.coordenador.cargo} · AEROCAD
  </div>
</div>
`
}

export function buildPowerOfAttorneyHTML(data: {
  clienteRazaoSocial: string
  clienteCnpj: string
  clienteEndereco: string
  objetoNome: string
  projetoNumero: string
  orgao?: string
}): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  return `
<style>
  .pr-title { color: #FF6A13; font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 24px; text-transform: uppercase; }
  .pr-sec { color: #FF6A13; font-size: 12px; font-weight: bold; margin-top: 18px; margin-bottom: 4px; text-transform: uppercase; page-break-after: avoid; }
  .pr-p { font-size: 11px; line-height: 1.7; text-align: justify; margin: 6px 0; }
</style>

<div class="pr-title">PROCURAÇÃO ESPECÍFICA PARA PROCESSOS AERONÁUTICOS (DECEA / ANAC)</div>

<div class="pr-sec">OUTORGANTE</div>
<p class="pr-p">
  <strong>${data.clienteRazaoSocial}</strong>, pessoa jurídica de direito privado inscrita no CNPJ sob o nº <strong>${data.clienteCnpj}</strong>, com sede em ${data.clienteEndereco}, neste ato representada na forma de seus atos constitutivos pelo seu representante legal infra-assinado.
</p>

<div class="pr-sec">OUTORGADA</div>
<p class="pr-p">
  <strong>${INSTITUTIONAL_DATA.representantes.signataria.nome}</strong>, brasileira, inscrita no CPF sob o nº <strong>${INSTITUTIONAL_DATA.representantes.signataria.cpf}</strong>, residente e domiciliada em Brasília – DF, atuando na qualidade de Procuradora e Gerente de Negócios da sociedade <strong>${INSTITUTIONAL_DATA.razaoSocial}</strong>, inscrita no CNPJ sob o nº <strong>${INSTITUTIONAL_DATA.cnpj}</strong>, com sede no ${INSTITUTIONAL_DATA.endereco}.
</p>

<div class="pr-sec">PODERES ESPECÍFICOS</div>
<p class="pr-p">
  Pelo presente instrumento particular de procuração, a OUTORGANTE confere à OUTORGADA amplos e específicos poderes para representá-la perante o <strong>Departamento de Controle do Espaço Aéreo (DECEA)</strong>, <strong>Comando da Aeronáutica (COMAER)</strong>, <strong>Centros Integrados de Defesa Aérea e Controle de Tráfego Aéreo (CINDACTA I, II, III e IV)</strong>, <strong>Serviço Regional de Proteção ao Voo de São Paulo (SRPV-SP)</strong> e perante a <strong>Agência Nacional de Aviação Civil (ANAC)</strong>, podendo requerer, protocolar, acompanhar, prestar esclarecimentos técnicos, retirar pareceres, notificações e ofícios, tomar ciência de despachos e exigências, interpor recursos administrativos, assinar requerimentos de Objeto Projetado no Espaço Aéreo (OPEA), Plano Básico de Zona de Proteção de Aeródromo (PBZPA), PZPANA, autorização/registro de heliponto e inscrição, alteração ou atualização cadastral de aeródromos no SDIA, praticando todos os atos que se façam estritamente necessários ao fiel cumprimento do mandato relativo ao empreendimento <strong>${data.objetoNome}</strong> (referência Projeto AEROCAD nº ${data.projetoNumero}).
</p>

<div style="margin-top: 50px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 360px; border-top: 1px solid #444; padding-top: 6px; margin-top: 36px; font-size: 11px;">
    <strong>${data.clienteRazaoSocial}</strong><br/>
    CNPJ ${data.clienteCnpj}<br/>
    Representante Legal:
  </div>
</div>
`
}

export function buildInvoiceHTML(data: {
  numeroFatura: string
  clienteRazaoSocial: string
  clienteCnpj: string
  clienteEndereco: string
  projetoNumero: string
  projetoNome: string
  descricaoMarco: string
  vencimento: string
  valor: number
}): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  return `
<style>
  .ft-title { color: #FF6A13; font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  .ft-subtitle { font-size: 13px; font-weight: bold; text-align: center; color: #333; margin-bottom: 24px; }
  .ft-table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 10px 0; page-break-inside: avoid; }
  .ft-table thead { display: table-header-group; }
  .ft-table th, .ft-table td { border: 1px solid #D9D9D9; padding: 7px 10px; text-align: left; }
  .ft-table th { background: #F8F9FA; font-weight: bold; }
  .ft-total-row td { background: #FFF4EC; font-weight: bold; font-size: 12px; }
</style>

<div class="ft-title">FATURA DE SERVIÇOS TÉCNICOS</div>
<div class="ft-subtitle">FATURA Nº ${data.numeroFatura}</div>

<p style="font-size: 11px; font-weight: bold; color: #FF6A13; margin-top: 16px; margin-bottom: 4px; text-transform: uppercase;">1. TOMADOR DOS SERVIÇOS</p>
<table class="ft-table">
  <tr><th style="width: 25%;">Razão Social</th><td><strong>${data.clienteRazaoSocial}</strong></td></tr>
  <tr><th>CNPJ / CPF</th><td>${data.clienteCnpj}</td></tr>
  <tr><th>Endereço</th><td>${data.clienteEndereco}</td></tr>
  <tr><th>Referência</th><td>Projeto nº ${data.projetoNumero} — ${data.projetoNome}</td></tr>
</table>

<p style="font-size: 11px; font-weight: bold; color: #FF6A13; margin-top: 18px; margin-bottom: 4px; text-transform: uppercase;">2. DISCRIMINAÇÃO DOS SERVIÇOS / PARCELA</p>
<table class="ft-table">
  <thead>
    <tr style="background: #FF6A13; color: white;">
      <th style="color: white; width: 12%;">Parcela</th>
      <th style="color: white;">Descrição do Evento Comprobatório</th>
      <th style="color: white; width: 22%; text-align: center;">Vencimento</th>
      <th style="color: white; width: 22%; text-align: right;">Valor (R$)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="font-weight: bold;">01/01</td>
      <td>${data.descricaoMarco}</td>
      <td style="text-align: center; font-weight: bold;">${data.vencimento}</td>
      <td style="text-align: right; font-weight: bold; color: #FF6A13;">${formatCurrency(data.valor)}</td>
    </tr>
    <tr class="ft-total-row">
      <td colspan="3"><strong>TOTAL LÍQUIDO A PAGAR</strong></td>
      <td style="text-align: right; color: #FF6A13;"><strong>${formatCurrency(data.valor)}</strong></td>
    </tr>
  </tbody>
</table>

<p style="font-size: 11px; font-weight: bold; color: #FF6A13; margin-top: 18px; margin-bottom: 4px; text-transform: uppercase;">3. DADOS PARA PAGAMENTO VIA TED / PIX</p>
<table class="ft-table">
  <tr><th style="width: 25%;">Banco</th><td>${INSTITUTIONAL_DATA.banco}</td></tr>
  <tr><th>Agência</th><td>${INSTITUTIONAL_DATA.agencia}</td></tr>
  <tr><th>Conta Corrente</th><td>${INSTITUTIONAL_DATA.contaCorrente}</td></tr>
  <tr><th>Favorecida</th><td>${INSTITUTIONAL_DATA.favorecida}</td></tr>
  <tr><th>CNPJ / Chave PIX</th><td>${INSTITUTIONAL_DATA.chavePix}</td></tr>
</table>

<p style="font-size: 10px; color: #666; font-style: italic; margin-top: 8px;">
  A correspondente Nota Fiscal de Serviços eletrônica (NFS-e) emitida pela Fazenda do Distrito Federal acompanha este documento para registro contábil e fiscal.
</p>

<div style="margin-top: 40px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #444; padding-top: 6px; margin-top: 24px; font-size: 11px;">
    <strong>${INSTITUTIONAL_DATA.razaoSocial}</strong><br/>
    CNPJ ${INSTITUTIONAL_DATA.cnpj}
  </div>
</div>
`
}

export function buildReceiptHTML(data: {
  numeroRecibo: string
  clienteRazaoSocial: string
  clienteCnpj: string
  projetoNumero: string
  projetoNome: string
  descricaoEntrega: string
  valor: number
}): string {
  const cidadeData = dataHojeExtenso('Brasília – DF')

  return `
<style>
  .rb-title { color: #FF6A13; font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  .rb-subtitle { font-size: 13px; font-weight: bold; text-align: center; color: #333; margin-bottom: 24px; }
  .rb-box { background: #FFF9F5; border: 1.5px solid #FFD3B4; border-radius: 8px; padding: 22px; margin: 20px 0; font-size: 12px; line-height: 1.8; text-align: justify; color: #222; }
  .rb-table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 12px 0; page-break-inside: avoid; }
  .rb-table thead { display: table-header-group; }
  .rb-table th, .rb-table td { border: 1px solid #D9D9D9; padding: 7px 10px; text-align: left; }
  .rb-table th { background: #F8F9FA; font-weight: bold; width: 25%; }
</style>

<div class="rb-title">RECIBO DE QUITAÇÃO DE HONORÁRIOS</div>
<div class="rb-subtitle">RECIBO Nº ${data.numeroRecibo}</div>

<div class="rb-box">
  Recebemos de <strong>${data.clienteRazaoSocial}</strong>, pessoa jurídica de direito privado inscrita no CNPJ sob o nº <strong>${data.clienteCnpj}</strong>, a importância líquida de <strong>${formatCurrency(data.valor)}</strong>, referente à quitação dos serviços técnicos de engenharia aeroportuária executados no âmbito do projeto <strong>${data.projetoNome}</strong> (referência Projeto AEROCAD nº ${data.projetoNumero} — ${data.descricaoEntrega}), conferindo à devedora a mais ampla, geral, rasa e irrevogável quitação relativamente à referida parcela.
</div>

<table class="rb-table">
  <tr><th>Projeto Referência</th><td>${data.projetoNumero} — ${data.projetoNome}</td></tr>
  <tr><th>Valor Quitado</th><td><strong style="color: #FF6A13; font-size: 13px;">${formatCurrency(data.valor)}</strong></td></tr>
  <tr><th>Forma de Liquidação</th><td>Transferência Bancária / PIX — Banco Inter (077)</td></tr>
  <tr><th>Data da Quitação</th><td>${cidadeData}</td></tr>
</table>

<div style="margin-top: 48px; text-align: center; page-break-inside: avoid;">
  <p style="font-size: 11px; color: #444;">${cidadeData}</p>
  <div style="display: inline-block; width: 340px; border-top: 1px solid #444; padding-top: 6px; margin-top: 32px; font-size: 11px;">
    <strong>${INSTITUTIONAL_DATA.representantes.signataria.nome}</strong><br/>
    ${INSTITUTIONAL_DATA.representantes.signataria.cargo} · AEROCAD<br/>
    CNPJ ${INSTITUTIONAL_DATA.cnpj}
  </div>
</div>
`
}
