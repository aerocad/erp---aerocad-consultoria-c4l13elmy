/**
 * Gerador e Utilitários de DANFE Simplificado AEROCAD
 *
 * 1. copiarDadosDanfeTexto: Formata e copia resumo estruturado para área de transferência.
 * 2. buildDanfeSimplificadoHtml: Gera HTML A4 para impressão/PDF de conferência interna.
 *    Respeita estritamente:
 *    - Identidade AEROCAD (Laranja #FF6A13, Arial, logo aerocad_logo_2026).
 *    - Sem geração nativa de DOCX (preview A4 + window.print).
 *    - Carimbo visível: "DANFE simplificado — reimpressão informativa, não substitui o documento fiscal original".
 *    - Mascaramento de valores caso o usuário não tenha permissão de visualização financeira.
 */

import type { ComprovanteExtraido } from '@/services/comprovantesVision'
import { formatCurrency, VALOR_MASCARADO } from '@/lib/format'
import { logoSrc } from '@/components/common/AerocadLogo'

/**
 * Formata a chave de 44 dígitos em blocos de 4 para melhor legibilidade
 */
export function formatarChaveAcesso(chave?: string): string {
  if (!chave) return '—'
  const limpa = chave.replace(/\D/g, '')
  if (limpa.length !== 44) return chave
  return limpa.replace(/(\d{4})/g, '$1 ').trim()
}

/**
 * Gera texto estruturado para cópia na área de transferência (E-mail, WhatsApp, Slack, etc.)
 */
export function formatarResumoDanfeParaAreaTransferencia(
  dados: Partial<ComprovanteExtraido>,
  podeVerValores: boolean,
): string {
  const tipo =
    dados.tipo_documento === 'nfe'
      ? 'DANFE (NF-e Modelo 55)'
      : dados.tipo_documento === 'cupom_fiscal'
        ? 'Cupom Fiscal (NFC-e / SAT)'
        : dados.tipo_documento?.toUpperCase() || 'DOCUMENTO FISCAL'

  const valorFmt = podeVerValores ? formatCurrency(dados.valor_total ?? 0) : VALOR_MASCARADO

  const chaveFmt = formatarChaveAcesso(dados.chave_acesso)

  const linhas: string[] = [
    `=== CRM AEROCAD • DOCUMENTO FISCAL EXTRAÍDO ===`,
    `Tipo: ${tipo}`,
    `Emitente: ${dados.fornecedor || 'Não identificado'}`,
    `CNPJ Emitente: ${dados.cnpj_cpf || 'Não informado'}`,
    dados.destinatario ? `Destinatário: ${dados.destinatario}` : '',
    dados.cnpj_destinatario ? `CNPJ Destinatário: ${dados.cnpj_destinatario}` : '',
    `Número / Série: ${dados.numero_documento || 'S/N'}${dados.serie ? ` (Série ${dados.serie})` : ''}`,
    `Data de Emissão: ${dados.data_emissao || 'Não informada'}`,
    `Valor Total: ${valorFmt}`,
    dados.valor_impostos != null && dados.valor_impostos > 0
      ? `Impostos Destacados: ${podeVerValores ? formatCurrency(dados.valor_impostos) : VALOR_MASCARADO}`
      : '',
    dados.chave_acesso ? `Chave de Acesso (44 dígitos): ${chaveFmt}` : '',
    dados.forma_pagamento_sugerida
      ? `Forma de Pagamento: ${dados.forma_pagamento_sugerida.toUpperCase()}`
      : '',
    dados.plano_contas_codigo
      ? `Classificação Contábil: ${dados.plano_contas_codigo} - ${dados.plano_contas_nome || ''}`
      : '',
    dados.descricao_itens ? `Itens / Descrição: ${dados.descricao_itens}` : '',
    dados.observacoes ? `Observações: ${dados.observacoes}` : '',
    `--------------------------------------------------`,
    `Reimpressão informativa interna gerada via AEROCAD ERP`,
  ]

  return linhas.filter((l) => Boolean(l && l.trim())).join('\n')
}

/**
 * Monta o HTML A4 completo para visualização e impressão do DANFE Simplificado AEROCAD
 */
export function buildDanfeSimplificadoHtml(
  dados: Partial<ComprovanteExtraido>,
  podeVerValores: boolean,
): string {
  const valorTotalStr = podeVerValores ? formatCurrency(dados.valor_total ?? 0) : VALOR_MASCARADO

  const valorImpostosStr = podeVerValores
    ? formatCurrency(dados.valor_impostos ?? 0)
    : VALOR_MASCARADO

  const chaveFormatada = formatarChaveAcesso(dados.chave_acesso)
  const dataHoje = new Date().toLocaleDateString('pt-BR')
  const horaHoje = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const itensHtml =
    dados.itens_detalhados && dados.itens_detalhados.length > 0
      ? dados.itens_detalhados
          .map(
            (it, idx) => `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #E5E7EB; text-align: center; font-size: 11px;">${idx + 1}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #E5E7EB; font-size: 11px; font-weight: 500;">${it.descricao}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #E5E7EB; text-align: center; font-size: 11px;">${it.ncm || '—'}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #E5E7EB; text-align: center; font-size: 11px;">${it.quantidade ?? 1}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #E5E7EB; text-align: right; font-size: 11px;">${podeVerValores && it.valor_unitario != null ? formatCurrency(it.valor_unitario) : '—'}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #E5E7EB; text-align: right; font-size: 11px; font-weight: 600;">${podeVerValores && it.valor_total != null ? formatCurrency(it.valor_total) : valorTotalStr}</td>
        </tr>`,
          )
          .join('')
      : `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #E5E7EB; text-align: center; font-size: 11px;">1</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #E5E7EB; font-size: 11px; font-weight: 500;">${dados.descricao_itens || 'Itens conforme documento fiscal lido'}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #E5E7EB; text-align: center; font-size: 11px;">—</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #E5E7EB; text-align: center; font-size: 11px;">1 UN</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #E5E7EB; text-align: right; font-size: 11px;">${valorTotalStr}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #E5E7EB; text-align: right; font-size: 11px; font-weight: 600;">${valorTotalStr}</td>
        </tr>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DANFE Simplificado • AEROCAD - Doc Nº ${dados.numero_documento || 'S/N'}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 16mm 16mm 16mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 24px;
      background-color: #FAFAFA;
      color: #1F2937;
      font-size: 12px;
      line-height: 1.4;
    }
    .a4-container {
      max-width: 800px;
      margin: 0 auto;
      background: #FFFFFF;
      padding: 32px 36px;
      border: 1px solid #E5E7EB;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    .carimbo-aviso {
      background: #FFF7ED;
      border: 2px dashed #FF6A13;
      color: #C2410C;
      padding: 10px 14px;
      border-radius: 4px;
      text-align: center;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .header-table td {
      vertical-align: middle;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      color: #111827;
      letter-spacing: -0.5px;
    }
    .danfe-badge {
      display: inline-block;
      background: #FF6A13;
      color: #FFFFFF;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .box-section {
      border: 1px solid #D1D5DB;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 12px;
      background: #FFFFFF;
    }
    .box-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #4B5563;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #F3F4F6;
      padding-bottom: 4px;
    }
    .grid-2 {
      display: flex;
      gap: 12px;
    }
    .grid-2 > div {
      flex: 1;
    }
    .chave-box {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: center;
      margin-bottom: 14px;
    }
    .chave-numero {
      font-family: monospace;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #111827;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    table.data-table th {
      background: #F3F4F6;
      border-top: 1px solid #D1D5DB;
      border-bottom: 1px solid #D1D5DB;
      padding: 6px 8px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #374151;
    }
    .footer-stamp {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #E5E7EB;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #6B7280;
    }
    @media print {
      body {
        background: #FFFFFF;
        padding: 0;
      }
      .a4-container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="a4-container">
    <!-- CARIMBO DE CONFERÊNCIA INFORMATIVA -->
    <div class="carimbo-aviso">
      ⚠ DANFE SIMPLIFICADO • REIMPRESSÃO INFORMATIVA DE CONTROLE INTERNO<br>
      <span style="font-size: 9.5px; font-weight: 500; text-transform: none; color: #9A3412;">
        Este documento é gerado para conferência contábil e auditoria financeira interna do CRM AEROCAD e não substitui o documento fiscal original emitido pelo fornecedor.
      </span>
    </div>

    <!-- CABEÇALHO COM IDENTIDADE AEROCAD -->
    <table class="header-table">
      <tr>
        <td style="width: 50%;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${logoSrc}" alt="AEROCAD" style="height: 38px; object-fit: contain;" />
            <div>
              <div class="brand-title">AEROCAD CONSULTORIA</div>
              <div style="font-size: 10px; color: #6B7280;">Engenharia Aeroportuária & Infraestrutura</div>
            </div>
          </div>
        </td>
        <td style="width: 50%; text-align: right;">
          <div class="danfe-badge">${dados.tipo_documento === 'nfe' ? 'DANFE SIMPLIFICADO' : 'CUPOM FISCAL / NFC-e'}</div>
          <div style="font-size: 11px; margin-top: 4px; font-weight: 600; color: #111827;">
            Nº ${dados.numero_documento || 'S/N'}${dados.serie ? ` • Série: ${dados.serie}` : ''}
          </div>
          <div style="font-size: 10px; color: #6B7280;">Emissão: ${dados.data_emissao || '—'}</div>
        </td>
      </tr>
    </table>

    <!-- CHAVE DE ACESSO -->
    <div class="chave-box">
      <div style="font-size: 9.5px; font-weight: 700; color: #6B7280; text-transform: uppercase; margin-bottom: 4px;">
        CHAVE DE ACESSO DE 44 DÍGITOS (CONSULTA SEFAZ)
      </div>
      <div class="chave-numero">${chaveFormatada}</div>
    </div>

    <!-- EMITENTE E DESTINATÁRIO -->
    <div class="grid-2">
      <div class="box-section">
        <div class="box-title">DADOS DO EMITENTE / FORNECEDOR</div>
        <div style="font-weight: 700; font-size: 12px; color: #111827;">${dados.fornecedor || 'Fornecedor não identificado'}</div>
        <div style="font-size: 11px; color: #374151; margin-top: 2px;">CNPJ: <strong>${dados.cnpj_cpf || 'Não informado'}</strong></div>
      </div>
      <div class="box-section">
        <div class="box-title">DESTINATÁRIO / TOMADOR</div>
        <div style="font-weight: 600; font-size: 11.5px; color: #111827;">${dados.destinatario || 'AEROCAD CONSULTORIA E GESTAO LTDA'}</div>
        <div style="font-size: 11px; color: #374151; margin-top: 2px;">CNPJ/CPF: <strong>${dados.cnpj_destinatario || 'Conforme cadastro AEROCAD'}</strong></div>
      </div>
    </div>

    <!-- TOTAIS E CLASSIFICAÇÃO -->
    <div class="grid-2">
      <div class="box-section">
        <div class="box-title">VALORES DA OPERAÇÃO</div>
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
          <span style="font-size: 11px; color: #4B5563;">Valor Total do Documento:</span>
          <span style="font-size: 16px; font-weight: 800; color: #FF6A13;">${valorTotalStr}</span>
        </div>
        ${
          dados.valor_impostos != null && dados.valor_impostos > 0
            ? `<div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 11px;">
                <span style="color: #6B7280;">Impostos Destacados:</span>
                <span style="font-weight: 600;">${valorImpostosStr}</span>
               </div>`
            : ''
        }
        <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 11px;">
          <span style="color: #6B7280;">Forma de Pagamento:</span>
          <span style="font-weight: 600; text-transform: uppercase;">${dados.forma_pagamento_sugerida || 'Conforme fatura'}</span>
        </div>
      </div>

      <div class="box-section">
        <div class="box-title">CLASSIFICAÇÃO FINANCEIRA AEROCAD</div>
        <div style="font-size: 11px; margin-top: 2px;">
          Categoria: <strong style="text-transform: capitalize;">${dados.categoria_sugerida?.replace('_', ' ') || 'Despesas Operacionais'}</strong>
        </div>
        <div style="font-size: 11px; margin-top: 4px;">
          Plano de Contas: <strong>${dados.plano_contas_codigo || '3.1.4'}</strong>
          <span style="color: #4B5563;">${dados.plano_contas_nome ? ` • ${dados.plano_contas_nome}` : ''}</span>
        </div>
        <div style="font-size: 10px; color: #6B7280; margin-top: 4px;">
          Auditoria: Classificação sugerida por IA e conferida pela equipe financeira.
        </div>
      </div>
    </div>

    <!-- TABELA DE PRODUTOS / SERVIÇOS -->
    <div class="box-section" style="margin-top: 6px;">
      <div class="box-title">DISCRIMINAÇÃO DOS PRODUTOS / SERVIÇOS FATURADOS</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">Item</th>
            <th style="text-align: left;">Descrição do Produto / Serviço</th>
            <th style="width: 70px; text-align: center;">NCM</th>
            <th style="width: 60px; text-align: center;">Qtd</th>
            <th style="width: 90px; text-align: right;">Unitário</th>
            <th style="width: 100px; text-align: right;">Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${itensHtml}
        </tbody>
      </table>
    </div>

    <!-- OBSERVAÇÕES / DADOS ADICIONAIS -->
    ${
      dados.observacoes
        ? `<div class="box-section" style="font-size: 10.5px; background: #F9FAFB;">
            <div class="box-title">DADOS ADICIONAIS / OBSERVAÇÕES</div>
            <div style="color: #374151; white-space: pre-wrap;">${dados.observacoes}</div>
           </div>`
        : ''
    }

    <!-- RODAPÉ DE RASTREABILIDADE -->
    <div class="footer-stamp">
      <div>AEROCAD ERP • Módulo Contas a Pagar</div>
      <div>Processado em: ${dataHoje} às ${horaHoje}</div>
      <div>Página 1 / 1</div>
    </div>
  </div>
</body>
</html>`
}

/**
 * Abre janela de impressão/salvar PDF do DANFE simplificado
 */
export function imprimirDanfeSimplificado(
  dados: Partial<ComprovanteExtraido>,
  podeVerValores: boolean,
): void {
  const html = buildDanfeSimplificadoHtml(dados, podeVerValores)
  const printWindow = window.open('', '_blank', 'width=900,height=800')
  if (!printWindow) {
    alert('Por favor, permita pop-ups no seu navegador para imprimir ou salvar o DANFE em PDF.')
    return
  }
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  // Aguarda carregamento do HTML e dos recursos (logo) para acionar print
  setTimeout(() => {
    printWindow.print()
  }, 400)
}
