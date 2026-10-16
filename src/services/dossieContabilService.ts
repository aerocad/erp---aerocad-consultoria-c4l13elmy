import JSZip from 'jszip'
import { pb } from '@/lib/pocketbase/client'
import { INSTITUTIONAL_DATA } from '@/lib/documentCatalogo'
import { formatCurrency, formatDate, formatDateBrasilia } from '@/lib/format'
import { ContaPagarRecord, ExtratoRecord, ParcelaRecord, ContaReceberRecord } from '@/types/crm'

export type TipoPeriodoDossie = 'ano' | 'mes' | 'personalizado'

export interface FiltroDossieContabil {
  tipo: TipoPeriodoDossie
  ano: number
  mes?: number // 1 a 12
  dataInicio?: string // YYYY-MM-DD
  dataFim?: string // YYYY-MM-DD
}

export interface ArquivoDossieItem {
  caminhoZip: string
  nomeArquivo: string
  origem: string
  tamanhoBytes: number
  dataReferencia: string
  tipo: 'comprovante' | 'extrato' | 'demonstrativo'
}

export interface ProgressoDossie {
  etapa: string
  progresso: number // 0 a 100
  totalArquivos: number
  arquivosProcessados: number
}

function normalizarNomeArquivo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
}

function obterAnoMes(dataIso?: string | null): { ano: string; mes: string } {
  if (!dataIso || dataIso.length < 7) {
    const agora = new Date()
    return {
      ano: String(agora.getFullYear()),
      mes: String(agora.getMonth() + 1).padStart(2, '0'),
    }
  }
  const ano = dataIso.slice(0, 4)
  const mes = dataIso.slice(5, 7)
  return { ano, mes }
}

function dentroDoPeriodo(
  dataIso: string | undefined | null,
  filtro: FiltroDossieContabil,
): boolean {
  if (!dataIso) return false
  const dataLimpa = dataIso.slice(0, 10)

  if (filtro.tipo === 'ano') {
    return dataLimpa.startsWith(String(filtro.ano))
  }

  if (filtro.tipo === 'mes' && filtro.mes) {
    const prefixo = `${filtro.ano}-${String(filtro.mes).padStart(2, '0')}`
    return dataLimpa.startsWith(prefixo)
  }

  if (filtro.tipo === 'personalizado') {
    if (filtro.dataInicio && dataLimpa < filtro.dataInicio) return false
    if (filtro.dataFim && dataLimpa > filtro.dataFim) return false
    return true
  }

  return true
}

export async function gerarDossieContabilZip(
  filtro: FiltroDossieContabil,
  contasPagar: ContaPagarRecord[],
  extratos: ExtratoRecord[],
  demonstrativosHtml?: { [nome: string]: string },
  onProgresso?: (progresso: ProgressoDossie) => void,
): Promise<{ blob: Blob; nomeArquivoZip: string; totalArquivos: number }> {
  const zip = new JSZip()
  const arquivosRegistrados: ArquivoDossieItem[] = []

  onProgresso?.({
    etapa: 'Filtrando registros contábeis...',
    progresso: 5,
    totalArquivos: 0,
    arquivosProcessados: 0,
  })

  // 1. Filtrar Contas a Pagar do período que possuam comprovantes
  const contasFiltradas = contasPagar.filter((cp) => {
    const dataRef = cp.data_pagamento || cp.data_vencimento
    return dentroDoPeriodo(dataRef, filtro)
  })

  // 2. Filtrar Extratos do período
  const extratosFiltrados = extratos.filter((ex) => {
    const dataRef = ex.data_inicio || ex.data_fim || (ex.created ? ex.created.slice(0, 10) : null)
    return dentroDoPeriodo(dataRef, filtro)
  })

  // Coleta tarefas de download
  interface DownloadTask {
    url: string
    caminhoZip: string
    nomeOriginal: string
    origem: string
    dataRef: string
    tipo: 'comprovante' | 'extrato' | 'demonstrativo'
  }

  const tasks: DownloadTask[] = []

  // Mapear comprovantes de contas_pagar
  for (const cp of contasFiltradas) {
    const dataRef = cp.data_pagamento || cp.data_vencimento || new Date().toISOString()
    const { ano, mes } = obterAnoMes(dataRef)

    // Se possui campo comprovante (string ou array de strings)
    const arquivosList: string[] = []
    if (Array.isArray(cp.comprovante)) {
      arquivosList.push(...cp.comprovante)
    } else if (typeof cp.comprovante === 'string' && cp.comprovante.trim()) {
      arquivosList.push(cp.comprovante.trim())
    }

    arquivosList.forEach((nomeArq, idx) => {
      const meta = cp.comprovantes_metadados?.find(
        (m) => m.file === nomeArq || m.nome_original === nomeArq,
      )
      const nomeLimpo = normalizarNomeArquivo(meta?.nome_original || nomeArq)
      const sufixo = arquivosList.length > 1 ? `_${idx + 1}` : ''
      const docId = cp.numero_documento ? `_DOC_${normalizarNomeArquivo(cp.numero_documento)}` : ''
      const nomeFinal = `CP_${cp.id.slice(0, 8)}${docId}${sufixo}_${nomeLimpo}`
      const caminho = `${ano}/${mes}/comprovantes/${nomeFinal}`

      const url = pb.files.getURL(cp, nomeArq)
      tasks.push({
        url,
        caminhoZip: caminho,
        nomeOriginal: meta?.nome_original || nomeArq,
        origem: `Conta a Pagar ID ${cp.id} (${cp.fornecedor || 'Fornecedor'} - ${formatCurrency(cp.valor)})`,
        dataRef,
        tipo: 'comprovante',
      })
    })
  }

  // Mapear extratos bancários com arquivo anexo
  for (const ex of extratosFiltrados) {
    if (!ex.arquivo) continue
    const dataRef = ex.data_inicio || ex.created?.slice(0, 10) || new Date().toISOString()
    const { ano, mes } = obterAnoMes(dataRef)
    const nomeLimpo = normalizarNomeArquivo(ex.nome_arquivo || ex.arquivo)
    const caminho = `${ano}/${mes}/extratos/EXTRATO_${ex.id.slice(0, 8)}_${nomeLimpo}`
    const url = pb.files.getURL(ex, ex.arquivo)

    tasks.push({
      url,
      caminhoZip: caminho,
      nomeOriginal: ex.nome_arquivo || ex.arquivo,
      origem: `Extrato Bancário (${ex.banco || 'Banco'} - ${ex.formato.toUpperCase()})`,
      dataRef,
      tipo: 'extrato',
    })
  }

  const totalTasks = tasks.length
  let concluidas = 0

  onProgresso?.({
    etapa: `Baixando e indexando ${totalTasks} arquivos de evidência...`,
    progresso: 15,
    totalArquivos: totalTasks,
    arquivosProcessados: 0,
  })

  // Download dos arquivos com fetch para ArrayBuffer
  for (const t of tasks) {
    try {
      const resp = await fetch(t.url)
      if (resp.ok) {
        const buffer = await resp.arrayBuffer()
        zip.file(t.caminhoZip, buffer)
        arquivosRegistrados.push({
          caminhoZip: t.caminhoZip,
          nomeArquivo: t.nomeOriginal,
          origem: t.origem,
          tamanhoBytes: buffer.byteLength,
          dataReferencia: t.dataRef,
          tipo: t.tipo,
        })
      }
    } catch (err) {
      console.warn(`Erro ao obter arquivo para dossiê (${t.url}):`, err)
    }

    concluidas++
    const pct = Math.round(15 + (concluidas / Math.max(1, totalTasks)) * 65)
    onProgresso?.({
      etapa: `Processando arquivo ${concluidas} de ${totalTasks}...`,
      progresso: pct,
      totalArquivos: totalTasks,
      arquivosProcessados: concluidas,
    })
  }

  // 3. Incluir demonstrativos HTML/A4 fornecidos na pasta AAAA/MM/demonstrativos
  if (demonstrativosHtml && Object.keys(demonstrativosHtml).length > 0) {
    const dataRefHoje = new Date().toISOString().slice(0, 10)
    const { ano, mes } = obterAnoMes(
      filtro.tipo === 'mes' && filtro.mes
        ? `${filtro.ano}-${String(filtro.mes).padStart(2, '0')}-01`
        : filtro.tipo === 'ano'
          ? `${filtro.ano}-12-31`
          : dataRefHoje,
    )

    for (const [nomeDoc, conteudo] of Object.entries(demonstrativosHtml)) {
      const caminho = `${ano}/${mes}/demonstrativos/${normalizarNomeArquivo(nomeDoc)}.html`
      zip.file(caminho, conteudo)
      arquivosRegistrados.push({
        caminhoZip: caminho,
        nomeArquivo: `${nomeDoc}.html`,
        origem: `Demonstrativo Contábil do ERP AEROCAD`,
        tamanhoBytes: new TextEncoder().encode(conteudo).length,
        dataReferencia: dataRefHoje,
        tipo: 'demonstrativo',
      })
    }
  }

  // 4. Montar NOTA_EXPLICATIVA.md na raiz do ZIP
  onProgresso?.({
    etapa: 'Gerando NOTA_EXPLICATIVA.md e compilando ZIP...',
    progresso: 85,
    totalArquivos: totalTasks,
    arquivosProcessados: concluidas,
  })

  const agoraBrasilia = formatDateBrasilia(new Date())
  let periodoDescricao = ''
  if (filtro.tipo === 'ano') {
    periodoDescricao = `Exercício Anual de ${filtro.ano}`
  } else if (filtro.tipo === 'mes' && filtro.mes) {
    const meses = [
      '',
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ]
    periodoDescricao = `${meses[filtro.mes] || filtro.mes} de ${filtro.ano}`
  } else if (filtro.tipo === 'personalizado') {
    periodoDescricao = `Período Personalizado: ${filtro.dataInicio ? formatDate(filtro.dataInicio) : 'Início'} até ${filtro.dataFim ? formatDate(filtro.dataFim) : 'Fim'}`
  }

  const tabelaArquivosMd =
    arquivosRegistrados.length === 0
      ? '_Nenhum arquivo de comprovante ou extrato anexado para o período especificado._'
      : `| Tipo | Caminho no Pacote | Arquivo Original | Origem no Sistema | Data Ref. | Tamanho |\n` +
        `| :--- | :--- | :--- | :--- | :---: | :---: |\n` +
        arquivosRegistrados
          .map(
            (a) =>
              `| ${a.tipo.toUpperCase()} | \`${a.caminhoZip}\` | ${a.nomeArquivo} | ${a.origem} | ${formatDate(a.dataReferencia)} | ${(a.tamanhoBytes / 1024).toFixed(1)} KB |`,
          )
          .join('\n')

  const totalComprovantes = arquivosRegistrados.filter((a) => a.tipo === 'comprovante').length
  const totalExtratos = arquivosRegistrados.filter((a) => a.tipo === 'extrato').length
  const totalDemonstrativos = arquivosRegistrados.filter((a) => a.tipo === 'demonstrativo').length

  const notaExplicativaConteudo = `# DOSSIÊ CONTÁBIL E FISCAL — ${INSTITUTIONAL_DATA.nomeFantasia}
**Razão Social:** ${INSTITUTIONAL_DATA.razaoSocial}  
**CNPJ:** ${INSTITUTIONAL_DATA.cnpj} | **Inscrição Estadual:** ${INSTITUTIONAL_DATA.inscricaoEstadual}  
**Endereço:** ${INSTITUTIONAL_DATA.endereco}  
**Contato:** ${INSTITUTIONAL_DATA.email} | ${INSTITUTIONAL_DATA.telefone}  

---

### 1. DADOS DE GERAÇÃO
- **Período de Referência:** ${periodoDescricao}
- **Data e Hora de Geração:** ${agoraBrasilia} (Horário Oficial de Brasília / UTC-3)
- **Critério Contábil:** Regime de Competência e Caixa com conciliação bancária integral
- **Total de Arquivos Empacotados:** ${arquivosRegistrados.length} (Comprovantes: ${totalComprovantes}, Extratos: ${totalExtratos}, Demonstrativos: ${totalDemonstrativos})

---

### 2. ESTRUTURA ORGANIZACIONAL DAS PASTAS
Este arquivo ZIP está estruturado no padrão cronológico contábil **AAAA/MM/** com as seguintes subpastas:
- \`AAAA/MM/comprovantes/\`: Comprovantes de pagamento, recibos, boletos e notas fiscais de despesas.
- \`AAAA/MM/extratos/\`: Extratos bancários oficiais (.OFX, .RET, .XLSX, .CSV) e retornos bancários importados.
- \`AAAA/MM/demonstrativos/\`: Minutas do Balanço Patrimonial e Demonstrativo do Resultado do Exercício (DRE).

---

### 3. ÍNDICE DE ARQUIVOS E RASTREABILIDADE
${tabelaArquivosMd}

---

### 4. NOTA DE RESPONSABILIDADE E ESCRITURAÇÃO
As informações contidas neste dossiê foram extraídas eletronicamente do ERP corporativo da AEROCAD CONSULTORIA. Os documentos originais anexados servem de suporte instrutório à escrituração contábil, fiscal e previdenciária, ficando à disposição da contabilidade externa e auditoria fiscal conforme exigido pela legislação tributária brasileira.
`

  zip.file('NOTA_EXPLICATIVA.md', notaExplicativaConteudo)

  onProgresso?.({
    etapa: 'Finalizando compressão do arquivo ZIP...',
    progresso: 95,
    totalArquivos: totalTasks,
    arquivosProcessados: concluidas,
  })

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })

  let sufixoNome = ''
  if (filtro.tipo === 'ano') {
    sufixoNome = `ANO_${filtro.ano}`
  } else if (filtro.tipo === 'mes' && filtro.mes) {
    sufixoNome = `${filtro.ano}_${String(filtro.mes).padStart(2, '0')}`
  } else {
    sufixoNome = `PERIODO_${(filtro.dataInicio || 'INICIO').replace(/-/g, '')}_${(filtro.dataFim || 'FIM').replace(/-/g, '')}`
  }

  const nomeArquivoZip = `DOSSIE_CONTABIL_AEROCAD_${sufixoNome}.zip`

  onProgresso?.({
    etapa: 'Dossiê contábil gerado com sucesso!',
    progresso: 100,
    totalArquivos: totalTasks,
    arquivosProcessados: concluidas,
  })

  return {
    blob,
    nomeArquivoZip,
    totalArquivos: arquivosRegistrados.length,
  }
}
