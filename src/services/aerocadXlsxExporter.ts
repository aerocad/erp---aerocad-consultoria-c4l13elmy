/**
 * Serviço de exportação de dados para Excel (.XLSX) formatado no padrão AEROCAD.
 * Identidade visual: Título, metadados, colunas com largura ajustada,
 * formatação numérica e respeito estrito ao mascaramento de valores financeiros.
 */

import { loadSheetJS } from '@/services/sheetjsLoader'
import { isValoresOcultos, VALOR_MASCARADO } from '@/lib/format'

export interface ColunaXlsx {
  header: string
  key: string
  width?: number
  tipo?: 'texto' | 'moeda' | 'numero' | 'data' | 'percentual'
}

export interface OpcoesExportacaoXlsx {
  nomeArquivo: string
  tituloRelatorio: string
  subtitulo?: string
  usuarioNome?: string
  userRole?: string
  permitirValoresReais?: boolean
  colunas: ColunaXlsx[]
  linhas: Record<string, unknown>[]
  totais?: Record<string, unknown>
}

/**
 * Gera e baixa uma planilha XLSX formatada no padrão institucional AEROCAD
 */
export async function exportarTabelaParaXlsx(opcoes: OpcoesExportacaoXlsx): Promise<void> {
  const xlsx = await loadSheetJS()
  const ocultar = isValoresOcultos()
  const podeVerReais = ['admin', 'financeiro'].includes(opcoes.userRole || '')
  // Se os valores estão ocultos na UI e o usuário NÃO tem perfil autorizado, mascara.
  // Se tem perfil autorizado mas está com o olho fechado (modo apresentação), mascara também para segurança de tela.
  const aplicarMascara = ocultar && !opcoes.permitirValoresReais

  const dataEmissao = new Date().toLocaleDateString('pt-BR')
  const horaEmissao = new Date().toLocaleTimeString('pt-BR')

  // Construção do Array-of-Arrays (AOA) com cabeçalho institucional AEROCAD
  const aoa: unknown[][] = [
    ['AEROCAD CONSULTORIA & AEROPORTOS'],
    [`RELATÓRIO: ${opcoes.tituloRelatorio.toUpperCase()}`],
  ]

  if (opcoes.subtitulo) {
    aoa.push([`Referência: ${opcoes.subtitulo}`])
  }

  aoa.push([
    `Emissão: ${dataEmissao} às ${horaEmissao} | Responsável: ${
      opcoes.usuarioNome || 'Equipe AEROCAD'
    }`,
  ])

  if (aplicarMascara) {
    aoa.push([
      'ATENÇÃO: Valores financeiros exportados em modo mascarado conforme configuração de privacidade.',
    ])
  }

  aoa.push([]) // Linha em branco separadora

  // Linha de Cabeçalhos das Colunas
  const headers = opcoes.colunas.map((c) => c.header)
  aoa.push(headers)

  // Linhas de dados
  for (const row of opcoes.linhas) {
    const linha: unknown[] = []
    for (const col of opcoes.colunas) {
      let val = row[col.key]

      if (col.tipo === 'moeda') {
        if (aplicarMascara) {
          linha.push(VALOR_MASCARADO)
        } else {
          linha.push(typeof val === 'number' ? val : Number(val) || 0)
        }
      } else if (col.tipo === 'numero' || col.tipo === 'percentual') {
        linha.push(typeof val === 'number' ? val : Number(val) || 0)
      } else {
        linha.push(val !== undefined && val !== null ? String(val) : '')
      }
    }
    aoa.push(linha)
  }

  // Linha de totais se fornecida
  if (opcoes.totais) {
    aoa.push([]) // Linha em branco antes do total
    const linhaTotal: unknown[] = []
    let primeiraColuna = true
    for (const col of opcoes.colunas) {
      if (primeiraColuna) {
        linhaTotal.push('TOTAIS CONSOLIDADOS')
        primeiraColuna = false
        continue
      }
      if (col.key in opcoes.totais) {
        let val = opcoes.totais[col.key]
        if (col.tipo === 'moeda') {
          if (aplicarMascara) {
            linhaTotal.push(VALOR_MASCARADO)
          } else {
            linhaTotal.push(typeof val === 'number' ? val : Number(val) || 0)
          }
        } else {
          linhaTotal.push(val)
        }
      } else {
        linhaTotal.push('')
      }
    }
    aoa.push(linhaTotal)
  }

  // Cria a planilha e o livro
  const worksheet = xlsx.utils.aoa_to_sheet(aoa)

  // Configuração de larguras de coluna
  const colWidths = opcoes.colunas.map((c) => ({
    wch: c.width || Math.max(c.header.length + 4, 15),
  }))
  // Garante largura suficiente na primeira coluna para o cabeçalho não quebrar
  if (colWidths[0]) {
    colWidths[0].wch = Math.max(colWidths[0].wch, 32)
  }
  worksheet['!cols'] = colWidths

  const workbook = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Relatório AEROCAD')

  // Disparo do download do arquivo .xlsx
  const nomeSanitizado = (opcoes.nomeArquivo || 'relatorio_aerocad')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w-]/g, '')
  const filename = `${nomeSanitizado}.xlsx`

  if (typeof xlsx.writeFile === 'function') {
    xlsx.writeFile(workbook, filename)
  } else {
    // Fallback caso writeFile não esteja no stub
    const wbout = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}
