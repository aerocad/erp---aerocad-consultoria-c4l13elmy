import type { ClienteRecord, ProjetoRecord, Trail } from '@/types/crm'
import { deduzirTrilha, limparDocumento, normalizarChave } from './importacaoParser'
import { agruparECorrelacionarTomadores } from './nfseClienteCorrelacionador'
import { calcularSimilaridadeTexto } from './nfseCorrelacionador'
import { extrairNumeroProjeto, extrairNumeroProposta, type NfseDadoExtraido } from './nfseParser'

export type AcaoProjetoSugerido = 'criar_projeto' | 'vincular_existente' | 'ignorar'

export interface SugestaoProjetoExtraido {
  // Chave identificadora única do grupo/sugestão
  idSugestao: string

  // Dados do tomador/cliente
  tomadorRazao: string
  tomadorCnpjCpf: string
  clienteIdSugerido?: string
  clienteExistente?: ClienteRecord
  clienteStatus: 'existente' | 'novo' | 'conflito'

  // Notas associadas ao projeto sugerido
  notas: NfseDadoExtraido[]
  numerosNotas: string[]
  valorTotalNotas: number

  // Campos inferidos do projeto
  numeroProjetoSugerido?: string // ex: 2026-232 se encontrado no texto da nota
  numeroPropostaSugerido?: string // ex: PC nº 012/2026 se encontrado no texto
  nomeSugerido: string
  tipoServicoInferido: string // ex: "OPEA", "Registro", "Demais"
  trilhaSugerida: Trail // 'opea' | 'registro' | 'demais'
  escopoInferido: string
  municipioUfInferido: string
  prazoInferido?: string
  valorGlobalEstimado: number // marcado como estimado

  // Correspondência com projeto já existente no CRM
  projetoExistenteSugerido?: ProjetoRecord
  scoreCorrespondenciaProjeto: number // 0 a 1

  // Ação configurada pelo usuário
  acao: AcaoProjetoSugerido
  projetoExistenteIdDestino?: string
  selecionado: boolean
  motivoSugestao: string
}

/**
 * Infere o tipo de serviço mais adequado a partir do texto das notas
 */
export function inferirTipoServicoETtrilha(texto: string): {
  tipoServico: string
  trilha: Trail
  escopo: string
} {
  const t = (texto || '').toLowerCase()

  if (
    t.includes('opea') ||
    t.includes('pbzpa') ||
    t.includes('pzpana') ||
    t.includes('plano básico de zona de proteção') ||
    t.includes('aga') ||
    t.includes('aproveitamento')
  ) {
    return {
      tipoServico: 'OPEA — Objeto Projetado no Espaço Aéreo',
      trilha: 'opea',
      escopo: 'Elaboração de processo OPEA/PBZPA para aprovação junto ao COMAER/DECEA.',
    }
  }

  if (
    t.includes('registro') ||
    t.includes('sdia') ||
    t.includes('inscrição') ||
    t.includes('aeródromo') ||
    t.includes('heliponto') ||
    t.includes('homologação')
  ) {
    return {
      tipoServico: 'Registro e Homologação de Aeródromo / Heliponto',
      trilha: 'registro',
      escopo:
        'Processo regulatório de inscrição/registro e homologação de infraestrutura perante a ANAC.',
    }
  }

  if (t.includes('laudo') || t.includes('parecer') || t.includes('estudo')) {
    return {
      tipoServico: 'Estudo Técnico / Parecer Aeroportuário',
      trilha: 'demais',
      escopo: 'Elaboração de laudo técnico especializado e viabilidade aeroportuária.',
    }
  }

  if (t.includes('topografia') || t.includes('levantamento')) {
    return {
      tipoServico: 'Levantamento Topográfico / Georreferenciamento',
      trilha: 'demais',
      escopo: 'Levantamento de obstáculos e georreferenciamento de precisão.',
    }
  }

  const trilhaPadrao = deduzirTrilha(texto, texto)
  return {
    tipoServico: 'Consultoria Técnica Aeroportuária',
    trilha: trilhaPadrao,
    escopo: 'Serviços especializados em engenharia e conformidade aeroportuária.',
  }
}

/**
 * Analisa notas órfãs, agrupa por tomador e texto de discriminação/serviço,
 * e gera sugestões de criação ou vínculo de projetos.
 */
export function analisarNotasOrfasParaExtracaoProjetos(
  notasOrfas: NfseDadoExtraido[],
  clientesExistentes: ClienteRecord[],
  projetosExistentes: ProjetoRecord[],
): SugestaoProjetoExtraido[] {
  if (!notasOrfas || notasOrfas.length === 0) return []

  // 1. Agrupar tomadores usando o correlacionador de clientes já testado
  const tomadores = agruparECorrelacionarTomadores(notasOrfas, clientesExistentes)

  const tomadorMap = new Map<string, (typeof tomadores)[0]>()
  tomadores.forEach((t) => tomadorMap.set(t.chaveGrupo, t))

  // 2. Sub-agrupar notas de cada tomador por projeto mencionado (se houver número explícito AAAA-NNN ou PC/PT)
  // ou agrupar todas as notas do tomador se não houver distinção explícita
  const gruposFinais: {
    chaveGrupo: string
    tomadorInfo: (typeof tomadores)[0]
    numeroProjetoExplito?: string
    numeroPropostaExplicito?: string
    notas: NfseDadoExtraido[]
  }[] = []

  for (const tomador of tomadores) {
    // Coletar as notas deste tomador
    const notasDoTomador = notasOrfas.filter((n) => {
      const doc = limparDocumento(n.tomadorCnpjCpf)
      const razao = (n.tomadorRazao || '').trim() || 'Tomador não informado'
      const chave = doc ? `doc_${doc}` : `razao_${normalizarChave(razao)}`
      return chave === tomador.chaveGrupo
    })

    if (notasDoTomador.length === 0) continue

    // Verificar se dentro das notas deste tomador existem números de projeto distintos
    const subGruposPorProjeto = new Map<string, NfseDadoExtraido[]>()

    for (const nota of notasDoTomador) {
      const textoNota = `${nota.descricaoServico || ''} ${nota.numero || ''}`
      const numProj = extrairNumeroProjeto(textoNota) || nota.projetoIdMencionado || ''
      const numProp = extrairNumeroProposta(textoNota) || nota.propostaMencionada || ''
      const chaveSub = numProj ? `proj_${numProj}` : numProp ? `prop_${numProp}` : 'sem_codigo'

      const subLista = subGruposPorProjeto.get(chaveSub) || []
      subLista.push(nota)
      subGruposPorProjeto.set(chaveSub, subLista)
    }

    for (const [chaveSub, subNotas] of subGruposPorProjeto.entries()) {
      let numProj = ''
      let numProp = ''
      if (chaveSub.startsWith('proj_')) {
        numProj = chaveSub.replace('proj_', '')
      } else if (chaveSub.startsWith('prop_')) {
        numProp = chaveSub.replace('prop_', '')
      }

      gruposFinais.push({
        chaveGrupo: `${tomador.chaveGrupo}_${chaveSub}`,
        tomadorInfo: tomador,
        numeroProjetoExplito: numProj || undefined,
        numeroPropostaExplicito: numProp || undefined,
        notas: subNotas,
      })
    }
  }

  // 3. Montar as sugestões de projetos
  const sugestoes: SugestaoProjetoExtraido[] = []

  for (const grupo of gruposFinais) {
    const { tomadorInfo, numeroProjetoExplito, numeroPropostaExplicito, notas } = grupo

    const valorTotalNotas = notas.reduce((acc, n) => acc + (n.valorBruto || 0), 0)
    const numerosNotas = Array.from(new Set(notas.map((n) => n.numero).filter(Boolean)))

    // Texto consolidado das discriminações
    const discriminacaoConsolidada = notas
      .map((n) => n.descricaoServico)
      .filter(Boolean)
      .join(' | ')

    const { tipoServico, trilha, escopo } = inferirTipoServicoETtrilha(discriminacaoConsolidada)

    // Localidade inferida
    const municipio =
      notas.find((n) => n.tomadorMunicipio)?.tomadorMunicipio || tomadorInfo.municipio || ''
    const uf = notas.find((n) => n.tomadorUf)?.tomadorUf || tomadorInfo.uf || ''
    const municipioUfInferido = municipio && uf ? `${municipio}/${uf}` : municipio || uf

    // Nome sugerido para o projeto
    let nomeSugerido = ''
    if (numeroProjetoExplito) {
      nomeSugerido = `${tipoServico} — ${tomadorInfo.razaoSocial}`
    } else if (numeroPropostaExplicito) {
      nomeSugerido = `${tipoServico} (${numeroPropostaExplicito})`
    } else {
      nomeSugerido = `${tipoServico} — ${tomadorInfo.razaoSocial}`
    }

    // Tentar encontrar projeto existente correspondente
    let projetoExistenteSugerido: ProjetoRecord | undefined
    let scoreCorrespondencia = 0
    let motivoSugestao = ''
    let acao: AcaoProjetoSugerido = 'criar_projeto'

    // 1. Correspondência exata por número de projeto AAAA-NNN
    if (numeroProjetoExplito) {
      const pMatch = projetosExistentes.find(
        (p) => (p.numero || '').toUpperCase() === numeroProjetoExplito.toUpperCase(),
      )
      if (pMatch) {
        projetoExistenteSugerido = pMatch
        scoreCorrespondencia = 1.0
        motivoSugestao = `Projeto ${pMatch.numero} mencionado expressamente na nota.`
        acao = 'vincular_existente'
      }
    }

    // 2. Correspondência por proposta PC/PT se não encontrou projeto
    if (!projetoExistenteSugerido && numeroPropostaExplicito) {
      const pMatchProp = projetosExistentes.find(
        (p) =>
          p.numero_pc_pt &&
          (p.numero_pc_pt.toLowerCase().includes(numeroPropostaExplicito.toLowerCase()) ||
            numeroPropostaExplicito.toLowerCase().includes(p.numero_pc_pt.toLowerCase())),
      )
      if (pMatchProp) {
        projetoExistenteSugerido = pMatchProp
        scoreCorrespondencia = 0.9
        motivoSugestao = `Proposta ${numeroPropostaExplicito} vinculada ao projeto existente ${pMatchProp.numero}.`
        acao = 'vincular_existente'
      }
    }

    // 3. Correspondência por cliente do projeto se o cliente já for cadastrado
    if (!projetoExistenteSugerido && tomadorInfo.clienteExistente) {
      const projetosDoCliente = projetosExistentes.filter(
        (p) => p.cliente === tomadorInfo.clienteExistente?.id,
      )
      if (projetosDoCliente.length === 1) {
        // Se o cliente possui exatamente 1 projeto ativo
        const pUnico = projetosDoCliente[0]
        projetoExistenteSugerido = pUnico
        scoreCorrespondencia = 0.75
        motivoSugestao = `Cliente possui 1 projeto cadastrado (${pUnico.numero} · ${pUnico.nome}). Sugerido vincular ou criar novo.`
        acao = 'vincular_existente'
      } else if (projetosDoCliente.length > 1) {
        // Procurar projeto com similaridade de texto na descrição
        let melhorScore = 0
        let melhorP: ProjetoRecord | undefined
        for (const p of projetosDoCliente) {
          const sim = calcularSimilaridadeTexto(
            `${p.nome} ${p.tipo_servico || ''} ${p.escopo_resumido || ''}`,
            discriminacaoConsolidada,
          )
          if (sim > 0.4 && sim > melhorScore) {
            melhorScore = sim
            melhorP = p
          }
        }
        if (melhorP) {
          projetoExistenteSugerido = melhorP
          scoreCorrespondencia = melhorScore
          motivoSugestao = `Similaridade temática (${Math.round(melhorScore * 100)}%) com o projeto ${melhorP.numero} deste cliente.`
          acao = 'vincular_existente'
        }
      }
    }

    if (!motivoSugestao) {
      if (numeroProjetoExplito) {
        motivoSugestao = `Código ${numeroProjetoExplito} citado na nota fiscal. Projeto novo a ser cadastrado.`
      } else {
        motivoSugestao = `Agrupamento de ${notas.length} nota(s) do tomador ${tomadorInfo.razaoSocial} no valor de ${valorTotalNotas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
      }
    }

    sugestoes.push({
      idSugestao: grupo.chaveGrupo,
      tomadorRazao: tomadorInfo.razaoSocial,
      tomadorCnpjCpf: tomadorInfo.cnpjCpfFormatado || tomadorInfo.cnpjCpf,
      clienteIdSugerido: tomadorInfo.clienteIdDestino,
      clienteExistente: tomadorInfo.clienteExistente,
      clienteStatus: tomadorInfo.status,
      notas,
      numerosNotas,
      valorTotalNotas,
      numeroProjetoSugerido: numeroProjetoExplito,
      numeroPropostaSugerido: numeroPropostaExplicito,
      nomeSugerido,
      tipoServicoInferido: tipoServico,
      trilhaSugerida: trilha,
      escopoInferido: escopo,
      municipioUfInferido,
      valorGlobalEstimado: valorTotalNotas,
      projetoExistenteSugerido,
      scoreCorrespondenciaProjeto: scoreCorrespondencia,
      acao,
      projetoExistenteIdDestino: projetoExistenteSugerido?.id,
      selecionado: true,
      motivoSugestao,
    })
  }

  // Ordenar: primeiro projetos com número explícito ou correspondência alta, depois por valor total decrescente
  return sugestoes.sort((a, b) => {
    if (a.scoreCorrespondenciaProjeto !== b.scoreCorrespondenciaProjeto) {
      return b.scoreCorrespondenciaProjeto - a.scoreCorrespondenciaProjeto
    }
    return b.valorTotalNotas - a.valorTotalNotas
  })
}
