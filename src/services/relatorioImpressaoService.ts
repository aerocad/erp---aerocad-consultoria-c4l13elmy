/**
 * Serviço de Impressão Defensiva de Relatórios e Documentos Oficiais AEROCAD (A4 / PDF)
 *
 * Garante que:
 * 1. O elemento #print-document ou elemento customizado esteja presente no DOM e com conteúdo antes de acionar a impressão.
 * 2. Tenta abrir em janela isolada de impressão limpa (sem interferência de modais, overlays e transforms do Radix Dialog).
 * 3. Se popup for bloqueado pelo navegador, executa fallback imediato para window.print() com aviso em toast.
 * 4. Protege contra dados nulos, erros de runtime e exibe toast claro de status.
 */

import { toast } from '@/hooks/use-toast'

export interface OpcoesImpressaoA4 {
  elementId?: string
  titulo?: string
  orientacao?: 'portrait' | 'landscape'
  timeoutRenderMs?: number
}

export function imprimirElementoA4(opcoes: OpcoesImpressaoA4 = {}): boolean {
  const {
    elementId = 'print-document',
    titulo = 'Relatório Oficial AEROCAD',
    orientacao = 'portrait',
    timeoutRenderMs = 250,
  } = opcoes

  // 1. Localiza o elemento do documento no DOM
  const targetElement = document.getElementById(elementId)

  if (!targetElement) {
    console.warn(
      `[AEROCAD Print] Elemento #${elementId} não encontrado no DOM. Tentando impressão da janela atual.`,
    )
    toast({
      title: 'Documento não encontrado',
      description:
        'Documento A4 não renderizado na página. Por favor, abra a visualização antes de imprimir.',
      variant: 'destructive',
    })
    return false
  }

  // 2. Valida se há conteúdo textual ou de tabela
  const innerHtml = targetElement.innerHTML.trim()
  if (!innerHtml || innerHtml.length < 50) {
    toast({
      title: 'Aguarde a renderização',
      description: 'O documento A4 ainda está carregando ou não possui conteúdo para impressão.',
      variant: 'destructive',
    })
    return false
  }

  try {
    // 3. Monta documento HTML completo e estilizado para garantir renderização perfeita em qualquer navegador
    const isLandscape = orientacao === 'landscape'
    const pageSize = isLandscape ? '297mm 210mm' : '210mm 297mm'

    const printHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titulo} · AEROCAD</title>
  <style>
    @page {
      size: ${pageSize};
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #2D2D2D !important;
      font-family: Arial, Helvetica, sans-serif !important;
      font-size: 11px;
      line-height: 1.4;
    }
    #print-document {
      width: 100% !important;
      max-width: ${isLandscape ? '297mm' : '210mm'} !important;
      margin: 0 auto !important;
      padding: 0 !important;
      background: #ffffff !important;
      box-shadow: none !important;
      border: none !important;
      min-height: auto !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    thead {
      display: table-header-group;
    }
    th, td {
      padding: 5px 8px;
    }
    .print\\:hidden, button, .no-print {
      display: none !important;
    }
  </style>
  <link rel="stylesheet" href="/src/main.css" />
</head>
<body>
  <div id="print-document">
    ${targetElement.innerHTML}
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, ${timeoutRenderMs});
    });
  </script>
</body>
</html>`

    // 4. Tenta abrir janela popup de impressão
    const printWindow = window.open(
      '',
      '_blank',
      'width=980,height=850,menubar=no,toolbar=no,location=no,status=no',
    )

    if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
      // Popup bloqueado pelo navegador -> Fallback nativo com aviso explicativo
      toast({
        title: 'Aviso de Pop-up',
        description:
          'Pop-up bloqueado pelo navegador. Abrindo diálogo de impressão direto da página.',
      })
      setTimeout(() => {
        window.print()
      }, 100)
      return true
    }

    printWindow.document.open()
    printWindow.document.write(printHtml)
    printWindow.document.close()

    // Backup caso o addEventListener load já tenha disparado
    setTimeout(() => {
      try {
        printWindow.focus()
      } catch {
        /* intentionally ignored */
      }
    }, timeoutRenderMs + 100)

    toast({
      title: 'Impressão A4',
      description: 'Diálogo de impressão A4 preparado com sucesso!',
    })
    return true
  } catch (err: unknown) {
    console.error('[AEROCAD Print] Erro ao preparar documento para impressão:', err)
    toast({
      title: 'Aviso',
      description: 'Tentando diálogo padrão de impressão...',
    })
    try {
      window.print()
      return true
    } catch (fallbackErr) {
      toast({
        title: 'Erro de Impressão',
        description:
          'Não foi possível acionar a impressão. Verifique as permissões do seu navegador.',
        variant: 'destructive',
      })
      return false
    }
  }
}
