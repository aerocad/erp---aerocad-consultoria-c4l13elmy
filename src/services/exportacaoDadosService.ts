/**
 * Serviço de exportação completa e granular dos dados do banco PocketBase do CRM AEROCAD.
 *
 * Suporta:
 * 1. Exportação completa em arquivo único JSON (com paginação batchSize=500, metadados, contagem e tratamento gracioso de erros).
 * 2. Exportação de coleções principais em arquivos formatados XLSX (Excel padrão AEROCAD com colunas traduzidas em pt-BR e datas DD/MM/AAAA).
 */

import pb from '@/lib/pocketbase/client'
import { loadSheetJS } from '@/services/sheetjsLoader'
import { exportarTabelaParaXlsx, type ColunaXlsx } from '@/services/aerocadXlsxExporter'
import { formatDate } from '@/lib/format'
import { CATEGORIA_PAGAR_LABELS, FORMA_PAGTO_LABELS } from '@/components/financeiro/ContasPagarTab'
import { CATEGORIA_RECEBER_LABELS } from '@/components/financeiro/ContasReceberTab'
import { CATEGORIA_FORNECEDOR_LABELS } from '@/pages/FornecedoresPage'
import { REGIME_CONTRATACAO_LABELS } from '@/pages/PessoalPage'
import { processStatusLabels, stageLabels, trailLabels } from '@/lib/crm'

/**
 * Definição das coleções disponíveis no PocketBase do CRM AEROCAD.
 */
export interface ColecaoExportConfig {
  id: string // Nome real no PocketBase
  label: string // Nome de exibição amigável
  categoria: 'comercial' | 'tecnico' | 'financeiro' | 'pessoas' | 'sistema'
  permiteXlsx: boolean
  descricao?: string
}

export const COLECOES_NEGOCIO_AEROCAD: ColecaoExportConfig[] = [
  // Comercial / Cadastros
  {
    id: 'clientes',
    label: 'Clientes',
    categoria: 'comercial',
    permiteXlsx: true,
    descricao: 'Pessoas físicas e jurídicas cadastradas',
  },
  {
    id: 'contatos',
    label: 'Contatos de Clientes',
    categoria: 'comercial',
    permiteXlsx: false,
    descricao: 'Pontos de contato vinculados a clientes',
  },
  {
    id: 'empreendimentos',
    label: 'Empreendimentos',
    categoria: 'comercial',
    permiteXlsx: false,
    descricao: 'Obras, edifícios, torres e sítios aeroportuários',
  },
  {
    id: 'oportunidades',
    label: 'Oportunidades (Funil)',
    categoria: 'comercial',
    permiteXlsx: true,
    descricao: 'Negociações comerciais e leads do funil',
  },
  {
    id: 'propostas',
    label: 'Propostas Comerciais e Técnicas',
    categoria: 'comercial',
    permiteXlsx: false,
    descricao: 'Propostas geradas com numeração e itens',
  },
  {
    id: 'contratos',
    label: 'Contratos',
    categoria: 'comercial',
    permiteXlsx: false,
    descricao: 'Contratos assinados e vínculos com clientes',
  },

  // Técnico / Operacional
  {
    id: 'projetos',
    label: 'Projetos',
    categoria: 'tecnico',
    permiteXlsx: true,
    descricao: 'Projetos técnicos e aeroportuários cadastrados',
  },
  {
    id: 'processos',
    label: 'Processos Regulatórios',
    categoria: 'tecnico',
    permiteXlsx: true,
    descricao: 'Processos DECEA, CINDACTA, ANAC, COMAER',
  },
  {
    id: 'exigencias',
    label: 'Exigências de Processos',
    categoria: 'tecnico',
    permiteXlsx: false,
    descricao: 'Pendências e respostas a órgãos',
  },
  {
    id: 'tarefas',
    label: 'Tarefas',
    categoria: 'tecnico',
    permiteXlsx: false,
    descricao: 'Tarefas e follow-ups da equipe',
  },
  {
    id: 'ordens_servico',
    label: 'Ordens de Serviço (OS)',
    categoria: 'tecnico',
    permiteXlsx: false,
    descricao: 'OS para técnicos e prestadores parceiros',
  },
  {
    id: 'documentos',
    label: 'Documentos do CRM',
    categoria: 'tecnico',
    permiteXlsx: false,
    descricao: 'Documentos gerados ou anexados a projetos',
  },

  // Financeiro
  {
    id: 'credores',
    label: 'Credores',
    categoria: 'financeiro',
    permiteXlsx: true,
    descricao: 'Cadastro de credores e dados bancários para quitação',
  },
  {
    id: 'contas_pagar',
    label: 'Contas a Pagar',
    categoria: 'financeiro',
    permiteXlsx: true,
    descricao: 'Despesas operacionais, impostos e terceirizados',
  },
  {
    id: 'contas_receber',
    label: 'Contas a Receber',
    categoria: 'financeiro',
    permiteXlsx: true,
    descricao: 'Receitas avulsas e serviços faturados',
  },
  {
    id: 'parcelas',
    label: 'Receitas / Parcelas de Projetos',
    categoria: 'financeiro',
    permiteXlsx: true,
    descricao: 'Parcelas e marcos financeiros contratuais',
  },
  {
    id: 'extratos',
    label: 'Extratos Bancários',
    categoria: 'financeiro',
    permiteXlsx: false,
    descricao: 'Extratos importados (OFX / CSV / XLSX)',
  },
  {
    id: 'extratos_transacoes',
    label: 'Transações de Extratos',
    categoria: 'financeiro',
    permiteXlsx: false,
    descricao: 'Linhas dos extratos bancários e conciliações',
  },
  {
    id: 'balancetes_mensais',
    label: 'Balancetes Mensais',
    categoria: 'financeiro',
    permiteXlsx: false,
    descricao: 'Demonstrativos e fechamentos mensais',
  },

  // Pessoas / Parceiros
  {
    id: 'colaboradores',
    label: 'Pessoal / Colaboradores',
    categoria: 'pessoas',
    permiteXlsx: true,
    descricao: 'Quadro societário, técnicos, analistas e RTs',
  },
  {
    id: 'fornecedores',
    label: 'Fornecedores',
    categoria: 'pessoas',
    permiteXlsx: true,
    descricao: 'Fornecedores e prestadores parceiros',
  },
  {
    id: 'users',
    label: 'Usuários do Sistema',
    categoria: 'pessoas',
    permiteXlsx: false,
    descricao: 'Contas de acesso e permissões',
  },

  // Configurações / Catálogos
  {
    id: 'servicos_catalogo',
    label: 'Tabela de Preços (Catálogo)',
    categoria: 'sistema',
    permiteXlsx: false,
    descricao: 'Serviços aeroportuários e faixas de preço',
  },
  {
    id: 'modelos_documentos',
    label: 'Modelos de Documento',
    categoria: 'sistema',
    permiteXlsx: false,
    descricao: 'Templates contratuais e técnicos',
  },
  {
    id: 'whatsapp_config',
    label: 'Configuração WhatsApp',
    categoria: 'sistema',
    permiteXlsx: false,
    descricao: 'Parâmetros de integração WhatsApp',
  },
  {
    id: 'sequencias',
    label: 'Sequências de Numeração',
    categoria: 'sistema',
    permiteXlsx: false,
    descricao: 'Contadores de projetos e documentos',
  },
  {
    id: 'links_externos',
    label: 'Links Externos',
    categoria: 'sistema',
    permiteXlsx: false,
    descricao: 'Pastas no Drive, SysAGA e outros links',
  },
  {
    id: 'atividades',
    label: 'Histórico de Atividades',
    categoria: 'sistema',
    permiteXlsx: false,
    descricao: 'Timeline de logs e interações',
  },
  {
    id: 'anexos',
    label: 'Anexos',
    categoria: 'sistema',
    permiteXlsx: false,
    descricao: 'Metadados de arquivos anexados',
  },
]

export interface ExportProgressEvent {
  colecaoAtual: string
  colecaoIndex: number
  totalColecoes: number
  registrosLidos: number
  mensagem: string
}

export interface ResultadoExportacaoJson {
  nomeArquivo: string
  totalRegistros: number
  colecoesExportadas: number
  avisos: string[]
}

/**
 * Obtém a contagem de registros de uma coleção com timeout curto e tratamento gracioso.
 */
export async function obterContagemColecao(collectionName: string): Promise<number | null> {
  try {
    const res = await pb.collection(collectionName).getList(1, 1, {
      fields: 'id',
      requestKey: null,
    })
    return res.totalItems
  } catch (err) {
    console.warn(`[ExportarDados] Falha ao contar coleção ${collectionName}:`, err)
    return null
  }
}

/**
 * Obtém a contagem de todas as coleções de negócio em paralelo controlado.
 */
export async function obterContagensTodasColecoes(): Promise<Record<string, number | null>> {
  const contagens: Record<string, number | null> = {}
  await Promise.all(
    COLECOES_NEGOCIO_AEROCAD.map(async (col) => {
      contagens[col.id] = await obterContagemColecao(col.id)
    }),
  )
  return contagens
}

/**
 * Lê todos os registros de uma coleção usando paginação com batchSize=500.
 */
export async function lerTodosRegistrosColecao(
  collectionName: string,
  onBatchProgress?: (lidos: number, total: number) => void,
): Promise<{ registros: Record<string, unknown>[]; total: number }> {
  const batchSize = 500
  let page = 1
  let todos: Record<string, unknown>[] = []
  let totalItems = 0

  while (true) {
    const res = await pb.collection(collectionName).getList(page, batchSize, {
      requestKey: null,
      sort: '-created',
    })

    totalItems = res.totalItems
    const items = (res.items || []) as unknown as Record<string, unknown>[]
    todos = todos.concat(items)

    if (onBatchProgress) {
      onBatchProgress(todos.length, totalItems)
    }

    if (page >= res.totalPages || items.length === 0) {
      break
    }
    page++
  }

  return { registros: todos, total: totalItems }
}

/**
 * Formata a data e hora atual no fuso horário oficial de Brasília (America/Sao_Paulo).
 */
export function formatarDataHoraBrasilia(data = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(data)
}

/**
 * Retorna o sufixo de data no formato AAAA-MM-DD no fuso de Brasília.
 */
export function obterSufixoDataBrasilia(data = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(data)

  const ano = parts.find((p) => p.type === 'year')?.value || String(data.getFullYear())
  const mes =
    parts.find((p) => p.type === 'month')?.value || String(data.getMonth() + 1).padStart(2, '0')
  const dia = parts.find((p) => p.type === 'day')?.value || String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/**
 * Dispara o download de um Blob no navegador.
 */
function dispararDownload(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 1. Exportação completa em formato JSON único.
 */
export async function exportarBackupCompletoJson(
  appVersion: string,
  usuarioNome?: string,
  onProgress?: (evento: ExportProgressEvent) => void,
): Promise<ResultadoExportacaoJson> {
  const dataInicio = new Date()
  const sufixoData = obterSufixoDataBrasilia(dataInicio)
  const nomeArquivo = `aerocad-backup-${sufixoData}.json`

  const contagemPorColecao: Record<string, number> = {}
  const dadosColecoes: Record<string, Record<string, unknown>[]> = {}
  const avisos: string[] = []
  let totalGeralRegistros = 0

  for (let i = 0; i < COLECOES_NEGOCIO_AEROCAD.map((c) => c.id).length; i++) {
    const colConfig = COLECOES_NEGOCIO_AEROCAD[i]
    const colId = colConfig.id

    if (onProgress) {
      onProgress({
        colecaoAtual: colConfig.label,
        colecaoIndex: i + 1,
        totalColecoes: COLECOES_NEGOCIO_AEROCAD.length,
        registrosLidos: 0,
        mensagem: `Iniciando leitura de ${colConfig.label}...`,
      })
    }

    try {
      const { registros, total } = await lerTodosRegistrosColecao(colId, (lidos) => {
        if (onProgress) {
          onProgress({
            colecaoAtual: colConfig.label,
            colecaoIndex: i + 1,
            totalColecoes: COLECOES_NEGOCIO_AEROCAD.length,
            registrosLidos: lidos,
            mensagem: `Lendo ${colConfig.label}: ${lidos} registros...`,
          })
        }
      })

      dadosColecoes[colId] = registros
      contagemPorColecao[colId] = total
      totalGeralRegistros += registros.length
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[ExportarDados] Falha ao ler coleção ${colId}:`, err)
      avisos.push(
        `Coleção "${colId}" (${colConfig.label}): não foi possível ler os registros (${msg})`,
      )
      dadosColecoes[colId] = []
      contagemPorColecao[colId] = 0
    }
  }

  // Metadados no topo do arquivo
  const payloadBackup = {
    _metadados: {
      sistema: 'AEROCAD CONSULTORIA AEROPORTUÁRIA — CRM',
      versao_app: appVersion,
      data_exportacao_brasilia: formatarDataHoraBrasilia(dataInicio),
      timestamp_iso: dataInicio.toISOString(),
      responsavel_exportacao: usuarioNome || 'Administrador',
      fuso_horario: 'America/Sao_Paulo',
      total_geral_registros: totalGeralRegistros,
      total_colecoes_exportadas: Object.keys(dadosColecoes).length,
      contagem_por_colecao: contagemPorColecao,
      avisos: avisos.length > 0 ? avisos : undefined,
    },
    ...dadosColecoes,
  }

  const jsonString = JSON.stringify(payloadBackup, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' })
  dispararDownload(blob, nomeArquivo)

  return {
    nomeArquivo,
    totalRegistros: totalGeralRegistros,
    colecoesExportadas: Object.keys(dadosColecoes).length,
    avisos,
  }
}

/**
 * Helpers de formatação para células XLSX
 */
function formatarDataCelula(val: unknown): string {
  if (!val) return ''
  const str = String(val)
  // Se for data pura AAAA-MM-DD ou ISO
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return str
  return formatDate(str)
}

function formatarDocumento(doc?: unknown): string {
  if (!doc) return ''
  const limpo = String(doc).replace(/\D/g, '')
  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (limpo.length === 14) {
    return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return String(doc)
}

/**
 * 2. Mapeamento especializado para exportação XLSX por coleção
 */
interface MapeamentoXlsxColecao {
  titulo: string
  subtitulo?: string
  colunas: ColunaXlsx[]
  transformarLinha: (item: Record<string, unknown>) => Record<string, unknown>
}

function obterMapeamentoColecao(colecao: string): MapeamentoXlsxColecao | null {
  switch (colecao) {
    case 'clientes':
      return {
        titulo: 'CADASTRO DE CLIENTES',
        subtitulo: 'Relação completa de clientes e prospects AEROCAD',
        colunas: [
          { header: 'ID', key: 'id', width: 16 },
          { header: 'Tipo', key: 'tipo', width: 8 },
          { header: 'Razão Social / Nome', key: 'razao_social', width: 36 },
          { header: 'CNPJ / CPF', key: 'cnpj_cpf', width: 20 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Segmento', key: 'segmento', width: 22 },
          { header: 'Município / UF', key: 'municipio_uf', width: 24 },
          { header: 'Telefone', key: 'telefone', width: 18 },
          { header: 'E-mail', key: 'email', width: 28 },
          { header: 'Endereço', key: 'endereco', width: 32 },
          { header: 'Origem', key: 'origem', width: 18 },
          { header: 'Primeira Contratação', key: 'primeira_contratacao', width: 18, tipo: 'data' },
          { header: 'Data Cadastro', key: 'created', width: 14, tipo: 'data' },
        ],
        transformarLinha: (item) => ({
          id: item.id,
          tipo: String(item.tipo || '').toUpperCase(),
          razao_social: item.razao_social || '',
          cnpj_cpf: formatarDocumento(item.cnpj_cpf),
          status:
            item.status === 'cliente'
              ? 'Cliente'
              : item.status === 'prospect'
                ? 'Prospect'
                : 'Inativo',
          segmento: item.segmento || '',
          municipio_uf:
            item.municipio_uf || `${item.municipio || ''}${item.uf ? `/${item.uf}` : ''}`,
          telefone: item.telefone || '',
          email: item.email || '',
          endereco: item.endereco || '',
          origem: item.origem || '',
          primeira_contratacao: formatarDataCelula(item.primeira_contratacao),
          created: formatarDataCelula(item.created),
        }),
      }

    case 'projetos':
      return {
        titulo: 'PROJETOS TÉCNICOS E AEROPORTUÁRIOS',
        subtitulo: 'Carteira de projetos AEROCAD (ativos, arquivados e concluídos)',
        colunas: [
          { header: 'Número', key: 'numero', width: 14 },
          { header: 'Nome do Projeto', key: 'nome', width: 36 },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Trilha', key: 'trilha', width: 16 },
          { header: 'Fase Atual', key: 'fase', width: 22 },
          { header: 'Tipo de Serviço', key: 'tipo_servico', width: 24 },
          { header: 'Valor Global (R$)', key: 'valor_global', width: 20, tipo: 'moeda' },
          { header: 'Município / UF', key: 'municipio_uf', width: 20 },
          { header: 'Aeródromo', key: 'aerodromo', width: 16 },
          { header: 'Data Início', key: 'data_inicio', width: 14, tipo: 'data' },
          { header: 'Prazo', key: 'prazo', width: 14, tipo: 'data' },
          { header: '% Concluído', key: 'percentual_concluido', width: 14, tipo: 'percentual' },
          { header: 'Prioridade', key: 'prioridade', width: 12 },
          { header: 'Arquivado', key: 'arquivado', width: 10 },
          { header: 'ART / RRT', key: 'art', width: 18 },
          { header: 'Data Cadastro', key: 'created', width: 14, tipo: 'data' },
        ],
        transformarLinha: (item) => ({
          numero: item.numero || '',
          nome: item.nome || '',
          status: String(item.status || '').toUpperCase(),
          trilha: trailLabels[item.trilha as keyof typeof trailLabels] || item.trilha || '',
          fase: item.fase || item.marco_fase_atual || '',
          tipo_servico: item.tipo_servico || '',
          valor_global:
            typeof item.valor_global === 'number'
              ? item.valor_global
              : Number(item.valor_global) || 0,
          municipio_uf: item.municipio_uf || '',
          aerodromo: item.aerodromo || '',
          data_inicio: formatarDataCelula(item.data_inicio),
          prazo: formatarDataCelula(item.prazo),
          percentual_concluido:
            typeof item.percentual_concluido === 'number' ? item.percentual_concluido : 0,
          prioridade:
            item.prioridade === 'alta' ? 'Alta' : item.prioridade === 'baixa' ? 'Baixa' : 'Normal',
          arquivado: item.arquivado ? 'Sim' : 'Não',
          art: item.art || '',
          created: formatarDataCelula(item.created),
        }),
      }

    case 'processos':
      return {
        titulo: 'PROCESSOS REGULATÓRIOS',
        subtitulo: 'Processos perante DECEA, CINDACTA, ANAC, COMAER e Prefeituras',
        colunas: [
          { header: 'Protocolo', key: 'numero_protocolo', width: 22 },
          { header: 'Órgão', key: 'orgao', width: 20 },
          { header: 'Status', key: 'status', width: 26 },
          { header: 'Data Protocolo', key: 'data_protocolo', width: 16, tipo: 'data' },
          { header: 'Prazo Órgão', key: 'prazo_orgao', width: 16, tipo: 'data' },
          { header: 'Parecer', key: 'parecer', width: 20 },
          { header: 'Data Parecer', key: 'data_parecer', width: 16, tipo: 'data' },
          { header: 'Link SysAGA', key: 'link_sysaga', width: 30 },
          { header: 'Link Ambiente', key: 'link_ambiente', width: 30 },
          { header: 'Data Cadastro', key: 'created', width: 14, tipo: 'data' },
        ],
        transformarLinha: (item) => ({
          numero_protocolo: item.numero_protocolo || 'Sem protocolo',
          orgao: item.orgao || '',
          status:
            processStatusLabels[item.status as keyof typeof processStatusLabels] ||
            item.status ||
            '',
          data_protocolo: formatarDataCelula(item.data_protocolo),
          prazo_orgao: formatarDataCelula(item.prazo_orgao),
          parecer:
            item.parecer === 'favoravel'
              ? 'Favorável'
              : item.parecer === 'favoravel_com_restricoes'
                ? 'Favorável c/ restrições'
                : item.parecer === 'desfavoravel'
                  ? 'Desfavorável'
                  : 'Pendente',
          data_parecer: formatarDataCelula(item.data_parecer),
          link_sysaga: item.link_sysaga || '',
          link_ambiente: item.link_ambiente || '',
          created: formatarDataCelula(item.created),
        }),
      }

    case 'oportunidades':
      return {
        titulo: 'FUNIL DE VENDAS E OPORTUNIDADES',
        subtitulo: 'Oportunidades comerciais e leads cadastrados',
        colunas: [
          { header: 'Título da Oportunidade', key: 'titulo', width: 36 },
          { header: 'Etapa Funil', key: 'etapa', width: 20 },
          { header: 'Valor Estimado (R$)', key: 'valor_estimado', width: 20, tipo: 'moeda' },
          { header: 'Probabilidade (%)', key: 'probabilidade', width: 16, tipo: 'percentual' },
          {
            header: 'Previsão Fechamento',
            key: 'data_prevista_fechamento',
            width: 18,
            tipo: 'data',
          },
          { header: 'Data Fechamento', key: 'data_fechamento', width: 18, tipo: 'data' },
          { header: 'Motivo Perda', key: 'motivo_perda', width: 18 },
          { header: 'Trilha Prevista', key: 'trilha_prevista', width: 16 },
          { header: 'Origem Canal', key: 'origem_canal', width: 16 },
          { header: 'Data Cadastro', key: 'created', width: 14, tipo: 'data' },
        ],
        transformarLinha: (item) => ({
          titulo: item.titulo || '',
          etapa: stageLabels[item.etapa as keyof typeof stageLabels] || item.etapa || '',
          valor_estimado:
            typeof item.valor_estimado === 'number'
              ? item.valor_estimado
              : Number(item.valor_estimado) || 0,
          probabilidade: typeof item.probabilidade === 'number' ? item.probabilidade : 0,
          data_prevista_fechamento: formatarDataCelula(item.data_prevista_fechamento),
          data_fechamento: formatarDataCelula(item.data_fechamento),
          motivo_perda: item.motivo_perda || '',
          trilha_prevista: item.trilha_prevista || '',
          origem_canal: item.origem_canal || '',
          created: formatarDataCelula(item.created),
        }),
      }

    case 'contas_pagar':
      return {
        titulo: 'CONTAS A PAGAR',
        subtitulo: 'Despesas operacionais, fornecedores, impostos e terceirizados',
        colunas: [
          { header: 'Descrição', key: 'descricao', width: 36 },
          { header: 'Conta Bancária', key: 'conta_bancaria_nome', width: 28 },
          { header: 'Fornecedor', key: 'fornecedor', width: 26 },
          { header: 'Categoria', key: 'categoria', width: 24 },
          { header: 'Valor (R$)', key: 'valor', width: 18, tipo: 'moeda' },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Vencimento', key: 'data_vencimento', width: 14, tipo: 'data' },
          { header: 'Pagamento', key: 'data_pagamento', width: 14, tipo: 'data' },
          { header: 'Forma Pagamento', key: 'forma_pagamento', width: 18 },
          { header: 'Nº Documento', key: 'numero_documento', width: 18 },
          { header: 'Observações', key: 'observacoes', width: 32 },
          { header: 'Data Cadastro', key: 'created', width: 14, tipo: 'data' },
        ],
        transformarLinha: (item) => {
          const expandConta = (item.expand as Record<string, unknown> | undefined)
            ?.conta_bancaria as Record<string, unknown> | undefined
          const contaNome =
            (expandConta?.apelido as string) ||
            (expandConta?.banco_nome as string) ||
            (item.conta_bancaria === '865d10p9cbxbf9i'
              ? 'BB PJ Principal'
              : item.conta_bancaria === 'biid0elu3tyhm7r'
                ? 'Itaú-Inter PJ Operacional'
                : item.conta_bancaria
                  ? 'Conta PJ'
                  : 'Não classificada')
          return {
            descricao: item.descricao || '',
            conta_bancaria_nome: contaNome,
            fornecedor: item.fornecedor || '',
            categoria:
              CATEGORIA_PAGAR_LABELS[item.categoria as keyof typeof CATEGORIA_PAGAR_LABELS] ||
              item.categoria ||
              '',
            valor: typeof item.valor === 'number' ? item.valor : Number(item.valor) || 0,
            status:
              item.status === 'pago'
                ? 'Pago'
                : item.status === 'cancelado'
                  ? 'Cancelado'
                  : 'Pendente',
            data_vencimento: formatarDataCelula(item.data_vencimento),
            data_pagamento: formatarDataCelula(item.data_pagamento),
            forma_pagamento:
              FORMA_PAGTO_LABELS[item.forma_pagamento as keyof typeof FORMA_PAGTO_LABELS] ||
              item.forma_pagamento ||
              '',
            numero_documento: item.numero_documento || '',
            observacoes: item.observacoes
              ? String(item.observacoes)
                  .replace(/<[^>]*>/g, '')
                  .trim()
              : '',
            created: formatarDataCelula(item.created),
          }
        },
      }

    case 'contas_receber':
      return {
        titulo: 'CONTAS A RECEBER',
        subtitulo: 'Receitas avulsas e serviços faturados',
        colunas: [
          { header: 'Descrição', key: 'descricao', width: 36 },
          { header: 'Conta Bancária', key: 'conta_bancaria_nome', width: 28 },
          { header: 'Cliente / Tomador', key: 'cliente_nome', width: 26 },
          { header: 'Categoria', key: 'categoria', width: 24 },
          { header: 'Valor (R$)', key: 'valor', width: 18, tipo: 'moeda' },
          { header: 'Valor Recebido (R$)', key: 'valor_recebido', width: 18, tipo: 'moeda' },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Vencimento', key: 'data_vencimento', width: 14, tipo: 'data' },
          { header: 'Recebimento', key: 'data_recebimento', width: 14, tipo: 'data' },
          { header: 'Forma Recebimento', key: 'forma_recebimento', width: 18 },
          { header: 'Nº Documento', key: 'numero_documento', width: 18 },
          { header: 'Data Cadastro', key: 'created', width: 14, tipo: 'data' },
        ],
        transformarLinha: (item) => {
          const expandConta = (item.expand as Record<string, unknown> | undefined)
            ?.conta_bancaria as Record<string, unknown> | undefined
          const contaNome =
            (expandConta?.apelido as string) ||
            (expandConta?.banco_nome as string) ||
            (item.conta_bancaria === '865d10p9cbxbf9i'
              ? 'BB PJ Principal'
              : item.conta_bancaria === 'biid0elu3tyhm7r'
                ? 'Itaú-Inter PJ Operacional'
                : item.conta_bancaria
                  ? 'Conta PJ'
                  : 'Não classificada')
          return {
            descricao: item.descricao || '',
            conta_bancaria_nome: contaNome,
            cliente_nome: item.cliente_nome || '',
            categoria:
              CATEGORIA_RECEBER_LABELS[item.categoria as keyof typeof CATEGORIA_RECEBER_LABELS] ||
              item.categoria ||
              '',
            valor: typeof item.valor === 'number' ? item.valor : Number(item.valor) || 0,
            valor_recebido:
              typeof item.valor_recebido === 'number'
                ? item.valor_recebido
                : Number(item.valor_recebido) || 0,
            status:
              item.status === 'recebido'
                ? 'Recebido'
                : item.status === 'cancelado'
                  ? 'Cancelado'
                  : 'Pendente',
            data_vencimento: formatarDataCelula(item.data_vencimento),
            data_recebimento: formatarDataCelula(item.data_recebimento),
            forma_recebimento:
              FORMA_PAGTO_LABELS[item.forma_recebimento as keyof typeof FORMA_PAGTO_LABELS] ||
              item.forma_recebimento ||
              '',
            numero_documento: item.numero_documento || '',
            created: formatarDataCelula(item.created),
          }
        },
      }

    case 'parcelas':
      return {
        titulo: 'RECEITAS / PARCELAS DE PROJETOS',
        subtitulo: 'Marcos de faturamento contratual e vínculos com NFS-e',
        colunas: [
          { header: 'Descrição do Marco', key: 'descricao', width: 36 },
          { header: 'Conta Bancária', key: 'conta_bancaria_nome', width: 28 },
          { header: 'Nº Parcela / Marco', key: 'numero_parcela_marco', width: 18 },
          { header: 'Valor (R$)', key: 'valor', width: 18, tipo: 'moeda' },
          { header: 'Valor Recebido (R$)', key: 'valor_recebido', width: 18, tipo: 'moeda' },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Status Pagamento', key: 'status_pagamento', width: 16 },
          { header: 'Gatilho', key: 'gatilho', width: 16 },
          { header: 'Nº NFS-e', key: 'nf_numero', width: 16 },
          { header: 'Chave NFS-e', key: 'nfse_chave', width: 22 },
          { header: 'Vencimento', key: 'vencimento', width: 14, tipo: 'data' },
          { header: 'Data Pagamento', key: 'data_pagamento', width: 14, tipo: 'data' },
          { header: 'Data Faturamento', key: 'data_faturamento', width: 14, tipo: 'data' },
          { header: '% Contrato', key: 'percentual_contrato', width: 14, tipo: 'percentual' },
          { header: 'Data Cadastro', key: 'created', width: 14, tipo: 'data' },
        ],
        transformarLinha: (item) => {
          const expandConta = (item.expand as Record<string, unknown> | undefined)
            ?.conta_bancaria as Record<string, unknown> | undefined
          const contaNome =
            (expandConta?.apelido as string) ||
            (expandConta?.banco_nome as string) ||
            (item.conta_bancaria === '865d10p9cbxbf9i'
              ? 'BB PJ Principal'
              : item.conta_bancaria === 'biid0elu3tyhm7r'
                ? 'Itaú-Inter PJ Operacional'
                : item.conta_bancaria
                  ? 'Conta PJ'
                  : 'Não classificada')
          return {
            descricao: item.descricao || '',
            conta_bancaria_nome: contaNome,
            numero_parcela_marco: item.numero_parcela_marco || '',
            valor: typeof item.valor === 'number' ? item.valor : Number(item.valor) || 0,
            valor_recebido:
              typeof item.valor_recebido === 'number'
                ? item.valor_recebido
                : Number(item.valor_recebido) || 0,
            status:
              item.status === 'paga' ? 'Paga' : item.status === 'vencida' ? 'Vencida' : 'Pendente',
            status_pagamento: item.status_pagamento || '',
            gatilho: item.gatilho || '',
            nf_numero: item.nf_numero || '',
            nfse_chave: item.nfse_chave || '',
            vencimento: formatarDataCelula(item.vencimento),
            data_pagamento: formatarDataCelula(item.data_pagamento),
            data_faturamento: formatarDataCelula(item.data_faturamento),
            percentual_contrato:
              typeof item.percentual_contrato === 'number' ? item.percentual_contrato : 0,
            created: formatarDataCelula(item.created),
          }
        },
      }

    case 'colaboradores':
      return {
        titulo: 'QUADRO DE PESSOAL E COLABORADORES',
        subtitulo: 'Sócios, engenheiros, analistas, RTs e equipe técnica AEROCAD',
        colunas: [
          { header: 'Nome Completo', key: 'nome_completo', width: 34 },
          { header: 'CPF / CNPJ', key: 'cpf_cnpj', width: 20 },
          { header: 'Cargo', key: 'cargo', width: 26 },
          { header: 'Função', key: 'funcao', width: 26 },
          { header: 'Regime Contratação', key: 'regime_contratacao', width: 22 },
          { header: 'Situação', key: 'situacao', width: 12 },
          { header: 'É Técnico?', key: 'eh_tecnico', width: 12 },
          { header: 'É RT?', key: 'eh_rt', width: 10 },
          { header: 'Registro Profissional', key: 'registro_profissional', width: 22 },
          { header: 'E-mail', key: 'email', width: 28 },
          { header: 'Telefone', key: 'telefone', width: 18 },
          { header: 'Chave PIX', key: 'chave_pix', width: 22 },
          { header: 'Data Admissão', key: 'data_admissao', width: 14, tipo: 'data' },
          { header: 'Data Cadastro', key: 'created', width: 14, tipo: 'data' },
        ],
        transformarLinha: (item) => ({
          nome_completo: item.nome_completo || '',
          cpf_cnpj: formatarDocumento(item.cpf_cnpj),
          cargo: item.cargo || '',
          funcao: item.funcao || '',
          regime_contratacao:
            REGIME_CONTRATACAO_LABELS[
              item.regime_contratacao as keyof typeof REGIME_CONTRATACAO_LABELS
            ] ||
            item.regime_contratacao ||
            '',
          situacao: item.situacao === 'ativo' ? 'Ativo' : 'Inativo',
          eh_tecnico: item.eh_tecnico ? 'Sim' : 'Não',
          eh_rt: item.eh_rt ? 'Sim' : 'Não',
          registro_profissional: item.registro_profissional_numero
            ? `${item.registro_profissional_tipo || 'CREA'}: ${item.registro_profissional_numero}/${item.registro_profissional_uf || 'DF'}`
            : '',
          email: item.email || '',
          telefone: item.telefone || '',
          chave_pix: item.chave_pix || '',
          data_admissao: formatarDataCelula(item.data_admissao),
          created: formatarDataCelula(item.created),
        }),
      }

    case 'credores':
      return {
        titulo: 'CADASTRO DE CREDORES',
        subtitulo: 'Favorecidos financeiros, dados fiscais e bancários para quitação AEROCAD',
        colunas: [
          { header: 'Razão Social / Nome', key: 'nome_razao_social', width: 34 },
          { header: 'Nome Fantasia', key: 'nome_fantasia', width: 24 },
          { header: 'CNPJ / CPF', key: 'cnpj_cpf', width: 20 },
          { header: 'Tipo', key: 'tipo_pessoa', width: 10 },
          { header: 'Categoria Financeira', key: 'categoria', width: 26 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Telefone', key: 'telefone', width: 18 },
          { header: 'E-mail', key: 'email', width: 26 },
          { header: 'Cidade / UF', key: 'cidade_uf', width: 20 },
          { header: 'Chave PIX', key: 'chave_pix', width: 24 },
          { header: 'Banco', key: 'banco_nome', width: 20 },
          { header: 'Agência', key: 'banco_agencia', width: 12 },
          { header: 'Conta', key: 'banco_conta', width: 14 },
          { header: 'Data Cadastro', key: 'created', width: 14, tipo: 'data' },
        ],
        transformarLinha: (item) => ({
          nome_razao_social: item.nome_razao_social || '',
          nome_fantasia: item.nome_fantasia || '',
          cnpj_cpf: formatarDocumento(item.cnpj_cpf),
          tipo_pessoa: item.tipo_pessoa === 'pj' ? 'PJ' : 'PF',
          categoria: String(item.categoria || ''),
          status: item.status === 'ativo' ? 'Ativo' : 'Inativo',
          telefone: item.telefone || '',
          email: item.email || '',
          cidade_uf: item.cidade_uf || '',
          chave_pix: item.chave_pix || '',
          banco_nome: item.banco_nome || '',
          banco_agencia: item.banco_agencia || '',
          banco_conta: item.banco_conta || '',
          created: formatarDataCelula(item.created),
        }),
      }

    case 'fornecedores':
      return {
        titulo: 'CADASTRO DE FORNECEDORES',
        subtitulo: 'Parceiros de software, equipamentos, terceirizados e infraestrutura',
        colunas: [
          { header: 'Razão Social', key: 'razao_social', width: 34 },
          { header: 'Nome Fantasia', key: 'nome_fantasia', width: 26 },
          { header: 'CNPJ / CPF', key: 'cnpj_cpf', width: 20 },
          { header: 'Categoria', key: 'categoria', width: 24 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Contato', key: 'contato_nome', width: 20 },
          { header: 'Telefone', key: 'telefone', width: 18 },
          { header: 'E-mail', key: 'email', width: 26 },
          { header: 'Município / UF', key: 'municipio_uf', width: 20 },
          { header: 'Chave PIX', key: 'chave_pix', width: 22 },
          { header: 'Data Cadastro', key: 'created', width: 14, tipo: 'data' },
        ],
        transformarLinha: (item) => ({
          razao_social: item.razao_social || '',
          nome_fantasia: item.nome_fantasia || '',
          cnpj_cpf: formatarDocumento(item.cnpj_cpf),
          categoria:
            CATEGORIA_FORNECEDOR_LABELS[
              item.categoria as keyof typeof CATEGORIA_FORNECEDOR_LABELS
            ] ||
            item.categoria ||
            '',
          status: item.status === 'ativo' ? 'Ativo' : 'Inativo',
          contato_nome: item.contato_nome || '',
          telefone: item.telefone || '',
          email: item.email || '',
          municipio_uf: item.municipio_uf || '',
          chave_pix: item.chave_pix || '',
          created: formatarDataCelula(item.created),
        }),
      }

    case 'extratos_transacoes':
      return {
        titulo: 'TRANSAÇÕES DE EXTRATOS BANCÁRIOS',
        subtitulo: 'Movimentações bancárias, conciliações e classificações contábeis',
        colunas: [
          { header: 'Data', key: 'data', width: 14, tipo: 'data' },
          { header: 'Descrição', key: 'descricao', width: 36 },
          { header: 'Observações / Despesa', key: 'observacoes', width: 32 },
          { header: 'Tipo', key: 'tipo', width: 12 },
          { header: 'Valor (R$)', key: 'valor', width: 18, tipo: 'moeda' },
          { header: 'Conta Contábil (Cód.)', key: 'plano_contas_codigo', width: 22 },
          { header: 'Conta Contábil (Nome)', key: 'plano_contas_nome', width: 30 },
          { header: 'Classificação Manual', key: 'classificacao_manual', width: 20 },
          { header: 'Doc. / Ref.', key: 'documento_ref', width: 20 },
          { header: 'Status Conciliação', key: 'status_conciliacao', width: 18 },
          { header: 'Data Cadastro', key: 'created', width: 14, tipo: 'data' },
        ],
        transformarLinha: (item) => ({
          data: formatarDataCelula(item.data),
          descricao: item.descricao || '',
          observacoes: item.observacoes
            ? String(item.observacoes)
                .replace(/<[^>]*>/g, '')
                .trim()
            : '',
          tipo:
            item.tipo === 'credito'
              ? 'Crédito'
              : item.tipo === 'debito'
                ? 'Débito'
                : String(item.tipo || ''),
          valor: typeof item.valor === 'number' ? item.valor : Number(item.valor) || 0,
          plano_contas_codigo: item.plano_contas_codigo || '',
          plano_contas_nome: item.plano_contas_nome || '',
          classificacao_manual: item.classificacao_manual ? 'Sim' : 'Não',
          documento_ref: item.documento_ref || '',
          status_conciliacao: item.status_conciliacao || '',
          created: formatarDataCelula(item.created),
        }),
      }

    // Exportação especializada de NFS-e (Notas Fiscais): são parcelas com vínculo NFS-e
    case 'nfse':
      return {
        titulo: 'NOTAS FISCAIS DE SERVIÇOS ELETRÔNICAS (NFS-E)',
        subtitulo: 'Notas fiscais vinculadas a parcelas e marcos de faturamento',
        colunas: [
          { header: 'Número NFS-e', key: 'nf_numero', width: 16 },
          { header: 'Chave / Código', key: 'nfse_chave', width: 24 },
          { header: 'Descrição do Serviço', key: 'descricao', width: 36 },
          { header: 'Valor da Nota (R$)', key: 'valor', width: 20, tipo: 'moeda' },
          { header: 'Valor Recebido (R$)', key: 'valor_recebido', width: 20, tipo: 'moeda' },
          { header: 'Status Financeiro', key: 'status_pagamento', width: 18 },
          { header: 'Data Emissão / Fat.', key: 'data_faturamento', width: 18, tipo: 'data' },
          { header: 'Data Vencimento', key: 'vencimento', width: 16, tipo: 'data' },
          { header: 'Data Pagamento', key: 'data_pagamento', width: 16, tipo: 'data' },
          { header: 'Retenções / Impostos', key: 'retencoes', width: 24 },
          { header: 'Data Registro', key: 'created', width: 14, tipo: 'data' },
        ],
        transformarLinha: (item) => ({
          nf_numero: item.nf_numero || '',
          nfse_chave: item.nfse_chave || '',
          descricao: item.descricao || '',
          valor: typeof item.valor === 'number' ? item.valor : Number(item.valor) || 0,
          valor_recebido:
            typeof item.valor_recebido === 'number'
              ? item.valor_recebido
              : Number(item.valor_recebido) || 0,
          status_pagamento: item.status_pagamento || (item.status === 'paga' ? 'Pago' : 'Pendente'),
          data_faturamento: formatarDataCelula(item.data_faturamento),
          vencimento: formatarDataCelula(item.vencimento),
          data_pagamento: formatarDataCelula(item.data_pagamento),
          retencoes: item.retencoes || '',
          created: formatarDataCelula(item.created),
        }),
      }

    default:
      return null
  }
}

/**
 * 2. Exportação de uma coleção em arquivo Excel XLSX.
 */
export async function exportarColecaoXlsx(
  collectionName: string,
  usuarioNome?: string,
  onBatchProgress?: (lidos: number, total: number) => void,
): Promise<{ nomeArquivo: string; totalRegistros: number }> {
  const sufixoData = obterSufixoDataBrasilia()
  const nomeArquivo = `aerocad-${collectionName}-${sufixoData}`

  let registros: Record<string, unknown>[] = []

  if (collectionName === 'nfse') {
    // Para NFS-e, buscamos da coleção 'parcelas' os registros com nota fiscal
    const res = await lerTodosRegistrosColecao('parcelas', onBatchProgress)
    registros = res.registros.filter(
      (p) =>
        Boolean(String(p.nf_numero || '').trim()) ||
        Boolean(String(p.nfse_chave || '').trim()) ||
        Boolean(p.nfse_dados),
    )
  } else {
    const res = await lerTodosRegistrosColecao(collectionName, onBatchProgress)
    registros = res.registros
  }

  const mapeamento = obterMapeamentoColecao(collectionName)

  if (mapeamento) {
    const linhasFormatadas = registros.map((r) => mapeamento.transformarLinha(r))

    // Calcula total se houver coluna de moeda
    let totais: Record<string, unknown> | undefined
    const colMoeda = mapeamento.colunas.find((c) => c.tipo === 'moeda')
    if (colMoeda) {
      totais = {}
      for (const col of mapeamento.colunas) {
        if (col.tipo === 'moeda') {
          totais[col.key] = linhasFormatadas.reduce(
            (acc, curr) => acc + (Number(curr[col.key]) || 0),
            0,
          )
        }
      }
    }

    await exportarTabelaParaXlsx({
      nomeArquivo,
      tituloRelatorio: mapeamento.titulo,
      subtitulo: mapeamento.subtitulo,
      usuarioNome: usuarioNome || 'Administrador AEROCAD',
      userRole: 'admin',
      permitirValoresReais: true, // admin tem acesso aos valores reais na exportação de banco
      colunas: mapeamento.colunas,
      linhas: linhasFormatadas,
      totais,
    })
  } else {
    // Fallback genérico para coleções sem mapeamento customizado
    const xlsx = await loadSheetJS()
    if (registros.length === 0) {
      // Cria planilha vazia com cabeçalho
      const ws = xlsx.utils.aoa_to_sheet([
        [`AEROCAD — EXPORTAÇÃO DA COLEÇÃO: ${collectionName.toUpperCase()}`],
        [`Data: ${formatarDataHoraBrasilia()}`],
        [],
        ['Nenhum registro encontrado nesta coleção.'],
      ])
      const wb = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(wb, ws, collectionName)
      xlsx.writeFile(wb, `${nomeArquivo}.xlsx`)
    } else {
      // Identifica todas as colunas presentes nos objetos
      const chaves = Array.from(new Set(registros.flatMap((r) => Object.keys(r)))).filter(
        (k) => k !== 'collectionId' && k !== 'collectionName',
      )

      // Mapeia linhas limpando objetos aninhados
      const linhasSimples = registros.map((r) => {
        const linha: Record<string, unknown> = {}
        for (const k of chaves) {
          const val = r[k]
          if (val === null || val === undefined) {
            linha[k] = ''
          } else if (typeof val === 'object') {
            linha[k] = JSON.stringify(val)
          } else if (typeof val === 'string' && val.includes('T') && val.endsWith('Z')) {
            linha[k] = formatarDataCelula(val)
          } else {
            linha[k] = val
          }
        }
        return linha
      })

      const ws = xlsx.utils.json_to_sheet(linhasSimples)
      const wb = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(wb, ws, collectionName.slice(0, 31))
      xlsx.writeFile(wb, `${nomeArquivo}.xlsx`)
    }
  }

  return { nomeArquivo: `${nomeArquivo}.xlsx`, totalRegistros: registros.length }
}
