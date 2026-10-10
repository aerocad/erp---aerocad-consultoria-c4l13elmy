import { createOne, listAll, updateOne } from '@/services/api'
import type { ClienteRecord, ParcelaRecord, ProjetoRecord } from '@/types/crm'
import { formatarDocumento, limparDocumento } from './importacaoParser'
import type { SugestaoProjetoExtraido } from './projetoExtratorNfse'

export interface ProgressoExtracaoProjetos {
  fase: 'preparando' | 'clientes' | 'projetos' | 'parcelas' | 'concluido' | 'erro'
  mensagem: string
  totalEtapas: number
  etapaAtual: number
}

export interface ResultadoExecucaoExtracaoProjetos {
  projetosCriados: number
  projetosVinculados: number
  clientesCriados: number
  parcelasCriadasOuAtualizadas: number
  notasProcessadas: number
  idsNotasProcessadas: string[]
  erros: string[]
}

/**
 * Garante que o cliente associado à sugestão exista no CRM.
 * Se o tomador já existe ou foi selecionado, retorna o ID do cliente.
 * Se não existe, cria um novo cliente com os dados extraídos das notas.
 */
async function garantirClienteParaProjeto(
  sugestao: SugestaoProjetoExtraido,
): Promise<{ clienteId: string; novoClienteCriado: boolean }> {
  if (sugestao.clienteIdSugerido) {
    return { clienteId: sugestao.clienteIdSugerido, novoClienteCriado: false }
  }

  // Tentar encontrar pelo CNPJ/CPF limpo
  const docLimpo = limparDocumento(sugestao.tomadorCnpjCpf)
  if (docLimpo) {
    const existentes = await listAll<ClienteRecord>('clientes', {
      filter: `cnpj_cpf ~ '${docLimpo}'`,
    }).catch(() => [])

    if (existentes.length > 0) {
      return { clienteId: existentes[0].id, novoClienteCriado: false }
    }
  }

  // Criar cliente novo a partir dos dados do tomador
  const tipo: 'pj' | 'pf' = docLimpo.length === 11 ? 'pf' : 'pj'
  const razao = sugestao.tomadorRazao || 'Cliente Importado NFS-e'
  const primeiraNota = sugestao.notas[0]

  const novoCliente = await createOne<ClienteRecord>('clientes', {
    razao_social: razao,
    cnpj_cpf: formatarDocumento(docLimpo) || sugestao.tomadorCnpjCpf || '',
    tipo,
    status: 'cliente',
    segmento: tipo === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física',
    endereco: primeiraNota?.tomadorEndereco || '',
    municipio: primeiraNota?.tomadorMunicipio || '',
    uf: primeiraNota?.tomadorUf || '',
    telefone: primeiraNota?.tomadorTelefone || '',
    email: primeiraNota?.tomadorEmail || '',
    origem: 'NFS-e (Extração de Projeto)',
    origem_importacao: true,
    recorrente: sugestao.notas.length > 1,
    observacoes: `<p>Cliente criado automaticamente durante a extração de projeto a partir de ${sugestao.notas.length} NFS-e.</p>`,
  })

  return { clienteId: novoCliente.id, novoClienteCriado: true }
}

/**
 * Executa a gravação dos projetos sugeridos e vinculação das notas órfãs
 */
export async function executarGravacaoProjetosExtraidos(
  sugestoes: SugestaoProjetoExtraido[],
  onProgress?: (progresso: ProgressoExtracaoProjetos) => void,
): Promise<ResultadoExecucaoExtracaoProjetos> {
  const resultado: ResultadoExecucaoExtracaoProjetos = {
    projetosCriados: 0,
    projetosVinculados: 0,
    clientesCriados: 0,
    parcelasCriadasOuAtualizadas: 0,
    notasProcessadas: 0,
    idsNotasProcessadas: [],
    erros: [],
  }

  const selecionadas = sugestoes.filter((s) => s.selecionado && s.acao !== 'ignorar')
  const totalEtapas = selecionadas.length
  let etapaAtual = 0

  for (const sugestao of selecionadas) {
    etapaAtual++
    try {
      onProgress?.({
        fase: 'clientes',
        mensagem: `Validando cliente para "${sugestao.tomadorRazao}"...`,
        totalEtapas,
        etapaAtual,
      })

      // 1. Garantir cliente
      const { clienteId, novoClienteCriado } = await garantirClienteParaProjeto(sugestao)
      if (novoClienteCriado) {
        resultado.clientesCriados++
      }

      let projetoId = ''

      if (sugestao.acao === 'vincular_existente' && sugestao.projetoExistenteIdDestino) {
        // Vinculando a um projeto já existente
        projetoId = sugestao.projetoExistenteIdDestino
        resultado.projetosVinculados++
      } else {
        // Criando um novo projeto
        onProgress?.({
          fase: 'projetos',
          mensagem: `Criando projeto "${sugestao.nomeSugerido}"...`,
          totalEtapas,
          etapaAtual,
        })

        // Se houver número de projeto específico sugerido pela nota, usamos;
        // senão deixamos em branco para o hook `numeracao_projeto` gerar AAAA-NNN
        const payloadProjeto: Record<string, unknown> = {
          nome: sugestao.nomeSugerido,
          cliente: clienteId,
          trilha: sugestao.trilhaSugerida,
          fase:
            sugestao.trilhaSugerida === 'opea'
              ? 'Análise de Viabilidade'
              : sugestao.trilhaSugerida === 'registro'
                ? 'Levantamento Cadastral'
                : 'Briefing e Alinhamento',
          status: 'ativo',
          tipo_servico: sugestao.tipoServicoInferido,
          escopo_resumido: sugestao.escopoInferido,
          municipio_uf: sugestao.municipioUfInferido,
          valor_global: sugestao.valorGlobalEstimado,
          percentual_concluido: 0,
          origem_importacao: true,
          observacoes: `<p>Projeto gerado via Extração de Projetos a partir de ${sugestao.notas.length} NFS-e vinculadas.</p>`,
        }

        if (sugestao.numeroProjetoSugerido) {
          payloadProjeto.numero = sugestao.numeroProjetoSugerido
        }
        if (sugestao.numeroPropostaSugerido) {
          payloadProjeto.numero_pc_pt = sugestao.numeroPropostaSugerido
        }

        const novoProjeto = await createOne<ProjetoRecord>('projetos', payloadProjeto)
        projetoId = novoProjeto.id
        resultado.projetosCriados++
      }

      // 2. Criar parcelas para cada nota vinculada ao projeto
      onProgress?.({
        fase: 'parcelas',
        mensagem: `Registrando faturamento de ${sugestao.notas.length} NFS-e no projeto...`,
        totalEtapas,
        etapaAtual,
      })

      for (const nota of sugestao.notas) {
        try {
          const valorNota = nota.valorBruto || 0
          const dataVencimento =
            nota.dataRecebimento || nota.dataEmissao || new Date().toISOString().slice(0, 10)

          // Cria parcela associada à NFS-e com faturamento registrado
          await createOne<ParcelaRecord>('parcelas', {
            projeto: projetoId,
            cliente: clienteId,
            descricao: `NFS-e nº ${nota.numero} — ${nota.descricaoServico || sugestao.tipoServicoInferido}`,
            valor: valorNota,
            gatilho: 'manual',
            nf_numero: nota.numero || '',
            vencimento: `${dataVencimento} 12:00:00.000Z`,
            status: nota.dataRecebimento ? 'paga' : 'pendente',
            data_pagamento: nota.dataRecebimento ? `${nota.dataRecebimento} 12:00:00.000Z` : '',
            valor_recebido: nota.dataRecebimento ? nota.valorLiquido || valorNota : 0,
            retencoes: nota.retencoesTexto || '',
            origem: 'manual',
            data_faturamento: `${nota.dataEmissao} 12:00:00.000Z`,
            status_pagamento: nota.dataRecebimento ? 'Recebido' : 'Faturado',
            origem_importacao: true,
            nfse_chave: nota.codigoVerificacao || `${nota.numero}_${nota.prestadorCnpjCpf}`,
            nfse_dados: {
              numero: nota.numero,
              serie: nota.serie,
              codigoVerificacao: nota.codigoVerificacao,
              dataEmissao: nota.dataEmissao,
              dataRecebimento: nota.dataRecebimento,
              valorBruto: nota.valorBruto,
              valorLiquido: nota.valorLiquido,
              tomadorRazao: nota.tomadorRazao,
              tomadorCnpjCpf: nota.tomadorCnpjCpf,
              descricaoServico: nota.descricaoServico,
              origemArquivo: nota.origemArquivo,
            },
            observacoes: `<p>Parcela criada e vinculada a partir da extração de projeto da NFS-e nº ${nota.numero}.</p>`,
          })

          resultado.parcelasCriadasOuAtualizadas++
          resultado.notasProcessadas++
          resultado.idsNotasProcessadas.push(nota.idTemp)
        } catch (errParcela) {
          const msg = errParcela instanceof Error ? errParcela.message : String(errParcela)
          resultado.erros.push(`Erro ao registrar parcela para nota ${nota.numero}: ${msg}`)
        }
      }
    } catch (errGrupo) {
      const msg = errGrupo instanceof Error ? errGrupo.message : String(errGrupo)
      resultado.erros.push(
        `Erro ao processar sugestão de projeto para "${sugestao.tomadorRazao}": ${msg}`,
      )
    }
  }

  onProgress?.({
    fase: 'concluido',
    mensagem: 'Processo de extração de projetos finalizado.',
    totalEtapas,
    etapaAtual: totalEtapas,
  })

  return resultado
}
