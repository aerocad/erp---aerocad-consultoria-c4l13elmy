import pb from '@/lib/pocketbase/client'
import {
  type ClienteMapeado,
  type ComunicacaoMapeada,
  type FinanceiroMapeado,
  type ProjetoMapeado,
} from './importacaoValidador'
import { deduzirTrilha, limparDocumento } from './importacaoParser'
import type { ItemValidado } from './importacaoParser'

export interface ProgressoImportacao {
  etapaAtual: string
  percentual: number
  totalGeral: number
  processados: number
  criados: number
  atualizados: number
  erros: number
}

export interface RegistroPendenteValidacao {
  colecao: 'clientes' | 'projetos' | 'parcelas' | 'atividades'
  id: string
  titulo: string
  camposPendentes: string[]
  rota: string
}

export interface ImportacaoExecucaoResultado {
  clientes: { criados: number; atualizados: number; ignorados: number; erros: number }
  projetos: { criados: number; atualizados: number; ignorados: number; erros: number }
  financeiro: { criados: number; atualizados: number; ignorados: number; erros: number }
  comunicacoes: { criados: number; atualizados: number; ignorados: number; erros: number }
  pendenciasValidacao: RegistroPendenteValidacao[]
  errosDetalhados: string[]
  avisosGerais: string[]
  logId?: string
}

export async function executarImportacao(
  dados: {
    arquivoNome: string
    tamanhoBytes: number
    clientes?: ItemValidado<ClienteMapeado>[]
    projetos?: ItemValidado<ProjetoMapeado>[]
    financeiro?: ItemValidado<FinanceiroMapeado>[]
    comunicacoes?: ItemValidado<ComunicacaoMapeada>[]
  },
  onProgress?: (p: ProgressoImportacao) => void,
): Promise<ImportacaoExecucaoResultado> {
  const currentUserId = pb.authStore.record?.id || ''

  const resultado: ImportacaoExecucaoResultado = {
    clientes: { criados: 0, atualizados: 0, ignorados: 0, erros: 0 },
    projetos: { criados: 0, atualizados: 0, ignorados: 0, erros: 0 },
    financeiro: { criados: 0, atualizados: 0, ignorados: 0, erros: 0 },
    comunicacoes: { criados: 0, atualizados: 0, ignorados: 0, erros: 0 },
    pendenciasValidacao: [],
    errosDetalhados: [],
    avisosGerais: [],
  }

  // Mapeadores para referências cruzadas em runtime
  const mapClientesIdPorIdPlanilha = new Map<string, string>() // C001 -> id
  const mapClientesIdPorDoc = new Map<string, string>() // 09296159000170 -> id
  const mapClientesIdPorNome = new Map<string, string>() // zurich -> id
  const mapProjetosIdPorIdPlanilha = new Map<string, string>() // P001 -> id
  const mapProjetosIdPorNome = new Map<string, string>() // nome -> id

  const totalLinhas =
    (dados.clientes?.length || 0) +
    (dados.projetos?.length || 0) +
    (dados.financeiro?.length || 0) +
    (dados.comunicacoes?.length || 0)

  let processadosTotal = 0

  const reportarProgresso = (etapa: string) => {
    if (!onProgress) return
    const perc = totalLinhas > 0 ? Math.round((processadosTotal / totalLinhas) * 100) : 100
    onProgress({
      etapaAtual: etapa,
      percentual: Math.min(100, Math.max(0, perc)),
      totalGeral: totalLinhas,
      processados: processadosTotal,
      criados:
        resultado.clientes.criados +
        resultado.projetos.criados +
        resultado.financeiro.criados +
        resultado.comunicacoes.criados,
      atualizados:
        resultado.clientes.atualizados +
        resultado.projetos.atualizados +
        resultado.financeiro.atualizados +
        resultado.comunicacoes.atualizados,
      erros:
        resultado.clientes.erros +
        resultado.projetos.erros +
        resultado.financeiro.erros +
        resultado.comunicacoes.erros,
    })
  }

  // ==========================================
  // ETAPA 1: IMPORTAR CLIENTES
  // ==========================================
  if (dados.clientes && dados.clientes.length > 0) {
    reportarProgresso('Importando Clientes...')
    for (const item of dados.clientes) {
      processadosTotal++
      if (item.acao === 'ignorar' || item.erros.length > 0) {
        resultado.clientes.ignorados++
        reportarProgresso(
          `Clientes (${item.dadosMapeados.razao_social || 'Linha ' + item.linhaOriginal})`,
        )
        continue
      }

      const c = item.dadosMapeados
      try {
        let clienteId = item.idExistente

        const payloadCliente: Record<string, unknown> = {
          tipo: c.tipo,
          razao_social: c.razao_social,
          cnpj_cpf: c.cnpj_cpf,
          segmento: c.segmento,
          municipio_uf: c.municipio_uf,
          municipio: c.municipio,
          uf: c.uf,
          telefone: c.telefone,
          email: c.email || '',
          primeira_contratacao: c.primeira_contratacao,
          observacoes: c.observacoes || '',
          status: 'cliente',
          origem: 'Importação Base Histórica',
          origem_importacao: true,
        }

        if (item.acao === 'atualizar' && clienteId) {
          // Atualiza registro existente
          await pb.collection('clientes').update(clienteId, payloadCliente)
          resultado.clientes.atualizados++
        } else {
          // Cria novo registro
          const novoCliente = await pb.collection('clientes').create(payloadCliente)
          clienteId = novoCliente.id
          resultado.clientes.criados++
        }

        // Criar contato principal se fornecido e ainda não existir
        if (clienteId && c.contato_principal) {
          try {
            await pb.collection('contatos').create({
              cliente: clienteId,
              nome: c.contato_principal,
              cargo: c.cargo || '',
              email: c.email || '',
              telefone_whatsapp: c.telefone || '',
              papel: 'decisor',
            })
          } catch {
            // Contato já existente ou erro secundário, prosseguir
          }
        }

        // Criar contato secundário se fornecido
        if (clienteId && c.contato_secundario) {
          try {
            await pb.collection('contatos').create({
              cliente: clienteId,
              nome: c.contato_secundario,
              cargo: '',
              email: '',
              telefone_whatsapp: '',
              papel: 'tecnico',
            })
          } catch {
            // prosseguir
          }
        }

        // Guardar nos mapas de resolução
        if (c.id_planilha) {
          mapClientesIdPorIdPlanilha.set(c.id_planilha.trim().toLowerCase(), clienteId)
        }
        if (c.cnpj_cpf) {
          const doc = limparDocumento(c.cnpj_cpf)
          if (doc) mapClientesIdPorDoc.set(doc, clienteId)
        }
        if (c.razao_social) {
          mapClientesIdPorNome.set(c.razao_social.trim().toLowerCase(), clienteId)
        }

        // Se tem campos "a validar", marcar na lista de pendências
        if (item.camposAValidar.length > 0) {
          resultado.pendenciasValidacao.push({
            colecao: 'clientes',
            id: clienteId,
            titulo: c.razao_social,
            camposPendentes: item.camposAValidar,
            rota: `/clientes/${clienteId}`,
          })
        }
      } catch (err: unknown) {
        resultado.clientes.erros++
        const msg = err instanceof Error ? err.message : String(err)
        resultado.errosDetalhados.push(
          `Cliente "${c.razao_social || 'Linha ' + item.linhaOriginal}": ${msg}`,
        )
      }
      reportarProgresso(`Clientes (${c.razao_social || 'Linha ' + item.linhaOriginal})`)
    }
  }

  // ==========================================
  // ETAPA 2: IMPORTAR PROJETOS
  // ==========================================
  if (dados.projetos && dados.projetos.length > 0) {
    reportarProgresso('Importando Projetos...')

    // Pré-carregar clientes existentes se necessário
    if (mapClientesIdPorNome.size === 0) {
      const cls = await pb
        .collection('clientes')
        .getFullList({ fields: 'id,razao_social,cnpj_cpf' })
      for (const cl of cls) {
        const d = limparDocumento(cl.cnpj_cpf)
        if (d) mapClientesIdPorDoc.set(d, cl.id)
        if (cl.razao_social) mapClientesIdPorNome.set(cl.razao_social.trim().toLowerCase(), cl.id)
      }
    }

    for (const item of dados.projetos) {
      processadosTotal++
      if (item.acao === 'ignorar' || item.erros.length > 0) {
        resultado.projetos.ignorados++
        reportarProgresso(
          `Projetos (${item.dadosMapeados.id_planilha || 'Linha ' + item.linhaOriginal})`,
        )
        continue
      }

      const p = item.dadosMapeados
      try {
        // Resolver ID do cliente
        let clienteId = p.cliente_id_vinculado

        if (!clienteId && p.id_cliente) {
          clienteId = mapClientesIdPorIdPlanilha.get(p.id_cliente.trim().toLowerCase())
          if (!clienteId) {
            const doc = limparDocumento(p.id_cliente)
            if (doc) clienteId = mapClientesIdPorDoc.get(doc)
          }
        }

        if (!clienteId && p.cliente_ref) {
          const doc = limparDocumento(p.cliente_ref)
          if (doc) clienteId = mapClientesIdPorDoc.get(doc)
          if (!clienteId) {
            clienteId = mapClientesIdPorNome.get(p.cliente_ref.trim().toLowerCase())
          }
          if (!clienteId) {
            // Tenta match parcial
            for (const [k, v] of mapClientesIdPorNome.entries()) {
              if (
                k.includes(p.cliente_ref.trim().toLowerCase()) ||
                p.cliente_ref.trim().toLowerCase().includes(k)
              ) {
                clienteId = v
                break
              }
            }
          }
        }

        // Se ainda não encontrou cliente, tenta associar ao primeiro cliente importado ou cria vínculo padrão
        if (!clienteId) {
          const firstClient = mapClientesIdPorNome.values().next().value
          if (firstClient) {
            clienteId = firstClient
            resultado.avisosGerais.push(
              `Projeto ${p.id_planilha || p.tipo_servico}: cliente "${p.cliente_ref}" associado automaticamente.`,
            )
          } else {
            throw new Error(
              `Cliente não localizado para o projeto (${p.cliente_ref || p.id_cliente})`,
            )
          }
        }

        const trilha = deduzirTrilha(p.tipo_servico, p.escopo_resumido)
        const nomeProjeto = p.escopo_resumido || p.tipo_servico || `Projeto ${p.id_planilha}`

        const payloadProjeto: Record<string, unknown> = {
          nome: nomeProjeto,
          cliente: clienteId,
          trilha,
          fase: p.fase_crm || 'Proposta enviada',
          status: p.status_crm || 'ativo',
          status_planilha: p.status_planilha || '',
          id_planilha: p.id_planilha || '',
          numero_pc_pt: p.numero_pc_pt || '',
          tipo_servico: p.tipo_servico || '',
          escopo_resumido: p.escopo_resumido || '',
          municipio_uf: p.municipio_uf || '',
          aerodromo: p.aerodromo || '',
          prazo_dias: p.prazo_dias || 0,
          valor_global: p.valor_global || 0,
          marco_fase_atual: p.marco_fase_atual || '',
          proxima_entrega: p.proxima_entrega || '',
          pendente_orgao: p.pendente_orgao || '',
          observacoes: p.observacoes || '',
          origem_importacao: true,
        }

        if (p.data_proposta) payloadProjeto.data_inicio = p.data_proposta
        if (p.data_proposta) payloadProjeto.data_proposta = p.data_proposta
        if (p.data_aceite) payloadProjeto.data_aceite = p.data_aceite

        let projetoId = item.idExistente

        if (item.acao === 'atualizar' && projetoId) {
          await pb.collection('projetos').update(projetoId, payloadProjeto)
          resultado.projetos.atualizados++
        } else {
          // O hook numeracao_projeto.js do PocketBase gera o número AAAA-NNN automaticamente
          // quando não enviado no payload!
          const novoProj = await pb.collection('projetos').create(payloadProjeto)
          projetoId = novoProj.id
          resultado.projetos.criados++
        }

        if (p.id_planilha) {
          mapProjetosIdPorIdPlanilha.set(p.id_planilha.trim().toLowerCase(), projetoId)
        }
        mapProjetosIdPorNome.set(nomeProjeto.trim().toLowerCase(), projetoId)

        if (item.camposAValidar.length > 0) {
          resultado.pendenciasValidacao.push({
            colecao: 'projetos',
            id: projetoId,
            titulo: `${p.id_planilha || ''} — ${nomeProjeto}`.trim(),
            camposPendentes: item.camposAValidar,
            rota: `/projetos/${projetoId}`,
          })
        }
      } catch (err: unknown) {
        resultado.projetos.erros++
        const msg = err instanceof Error ? err.message : String(err)
        resultado.errosDetalhados.push(
          `Projeto "${p.id_planilha || p.tipo_servico || 'Linha ' + item.linhaOriginal}": ${msg}`,
        )
      }
      reportarProgresso(`Projetos (${p.id_planilha || 'Linha ' + item.linhaOriginal})`)
    }
  }

  // ==========================================
  // ETAPA 3: IMPORTAR FINANCEIRO (PARCELAS)
  // ==========================================
  if (dados.financeiro && dados.financeiro.length > 0) {
    reportarProgresso('Importando Financeiro...')

    // Pré-carregar projetos caso não existam no mapa
    if (mapProjetosIdPorIdPlanilha.size === 0) {
      const prs = await pb
        .collection('projetos')
        .getFullList({ fields: 'id,id_planilha,cliente,nome' })
      for (const pr of prs) {
        if (pr.id_planilha)
          mapProjetosIdPorIdPlanilha.set(pr.id_planilha.trim().toLowerCase(), pr.id)
        if (pr.nome) mapProjetosIdPorNome.set(pr.nome.trim().toLowerCase(), pr.id)
      }
    }

    for (const item of dados.financeiro) {
      processadosTotal++
      if (item.acao === 'ignorar' || item.erros.length > 0) {
        resultado.financeiro.ignorados++
        reportarProgresso(
          `Financeiro (${item.dadosMapeados.id_lancamento || 'Linha ' + item.linhaOriginal})`,
        )
        continue
      }

      const f = item.dadosMapeados
      try {
        let projetoId = f.projeto_id_vinculado
        let clienteId = f.cliente_id_vinculado

        if (!projetoId && f.id_projeto) {
          projetoId = mapProjetosIdPorIdPlanilha.get(f.id_projeto.trim().toLowerCase())
        }

        if (!projetoId && f.projeto_ref) {
          const ref = f.projeto_ref.trim().toLowerCase()
          projetoId = mapProjetosIdPorNome.get(ref)
          if (!projetoId) {
            for (const [k, v] of mapProjetosIdPorNome.entries()) {
              if (k.includes(ref) || ref.includes(k)) {
                projetoId = v
                break
              }
            }
          }
        }

        if (!projetoId) {
          // Busca primeiro projeto disponível se nenhum informado
          const firstProj = mapProjetosIdPorIdPlanilha.values().next().value
          if (firstProj) {
            projetoId = firstProj
            resultado.avisosGerais.push(
              `Lançamento ${f.id_lancamento}: vinculado ao projeto disponível ${firstProj}.`,
            )
          } else {
            throw new Error(
              `Projeto não localizado para o lançamento financeiro ${f.id_lancamento}`,
            )
          }
        }

        // Se cliente não resolvido, buscar do projeto
        if (!clienteId && projetoId) {
          try {
            const prRecord = await pb
              .collection('projetos')
              .getOne(projetoId, { fields: 'cliente' })
            clienteId = prRecord.cliente
          } catch {
            // prossegue
          }
        }

        if (!clienteId) {
          const firstClient = mapClientesIdPorNome.values().next().value
          clienteId = firstClient || ''
        }

        // Mapear status financeiro
        let statusParcela: 'pendente' | 'paga' | 'vencida' = 'pendente'
        const stStr = (f.status_pagamento || '').toLowerCase()
        if (stStr.includes('pag') || stStr.includes('recebid') || f.data_pagamento) {
          statusParcela = 'paga'
        } else if (stStr.includes('vencid')) {
          statusParcela = 'vencida'
        }

        const dataVenc = f.vencimento || f.data_prevista || new Date().toISOString().split('T')[0]

        const payloadParcela: Record<string, unknown> = {
          projeto: projetoId,
          cliente: clienteId,
          descricao: f.numero_parcela_marco || 'Parcela de contrato',
          valor: f.valor || 0,
          gatilho: 'manual',
          nf_numero: f.nf_numero || '',
          vencimento: dataVenc,
          status: statusParcela,
          origem: 'manual',
          observacoes: f.observacoes || '',
          id_lancamento: f.id_lancamento || '',
          numero_parcela_marco: f.numero_parcela_marco || '',
          percentual_contrato: f.percentual_contrato || 0,
          evento_comprobatorio: f.evento_comprobatorio || '',
          status_pagamento: f.status_pagamento || '',
          origem_importacao: true,
        }

        if (f.data_prevista) payloadParcela.data_prevista = f.data_prevista
        if (f.data_faturamento) payloadParcela.data_faturamento = f.data_faturamento
        if (f.data_pagamento) {
          payloadParcela.data_pagamento = f.data_pagamento
          payloadParcela.valor_recebido = f.valor || 0
        }

        let parcelaId = item.idExistente

        if (item.acao === 'atualizar' && parcelaId) {
          await pb.collection('parcelas').update(parcelaId, payloadParcela)
          resultado.financeiro.atualizados++
        } else {
          const novaParcela = await pb.collection('parcelas').create(payloadParcela)
          parcelaId = novaParcela.id
          resultado.financeiro.criados++
        }

        if (item.camposAValidar.length > 0) {
          resultado.pendenciasValidacao.push({
            colecao: 'parcelas',
            id: parcelaId,
            titulo: `${f.id_lancamento || 'Lançamento'} — ${f.numero_parcela_marco}`,
            camposPendentes: item.camposAValidar,
            rota: `/financeiro`,
          })
        }
      } catch (err: unknown) {
        resultado.financeiro.erros++
        const msg = err instanceof Error ? err.message : String(err)
        resultado.errosDetalhados.push(
          `Financeiro "${f.id_lancamento || 'Linha ' + item.linhaOriginal}": ${msg}`,
        )
      }
      reportarProgresso(`Financeiro (${f.id_lancamento || 'Linha ' + item.linhaOriginal})`)
    }
  }

  // ==========================================
  // ETAPA 4: IMPORTAR COMUNICAÇÕES
  // ==========================================
  if (dados.comunicacoes && dados.comunicacoes.length > 0) {
    reportarProgresso('Importando Comunicações...')

    for (const item of dados.comunicacoes) {
      processadosTotal++
      if (item.acao === 'ignorar' || item.erros.length > 0) {
        resultado.comunicacoes.ignorados++
        reportarProgresso(
          `Comunicações (${item.dadosMapeados.id_planilha || 'Linha ' + item.linhaOriginal})`,
        )
        continue
      }

      const m = item.dadosMapeados
      try {
        let clienteId = m.cliente_id_vinculado
        if (!clienteId && m.id_cliente) {
          clienteId = mapClientesIdPorIdPlanilha.get(m.id_cliente.trim().toLowerCase())
        }
        if (!clienteId && m.cliente_ref) {
          clienteId = mapClientesIdPorNome.get(m.cliente_ref.trim().toLowerCase())
        }

        const payloadAtividade: Record<string, unknown> = {
          usuario: currentUserId,
          texto: `[${m.tipo.toUpperCase()}] ${m.texto}${m.observacoes ? ' — ' + m.observacoes : ''}`,
          tipo: m.tipo,
          id_planilha: m.id_planilha || '',
          origem_importacao: true,
        }

        if (clienteId) payloadAtividade.cliente = clienteId
        if (m.data_hora) payloadAtividade.data_hora = m.data_hora

        let atividadeId = item.idExistente

        if (item.acao === 'atualizar' && atividadeId) {
          await pb.collection('atividades').update(atividadeId, payloadAtividade)
          resultado.comunicacoes.atualizados++
        } else {
          const novaAtiv = await pb.collection('atividades').create(payloadAtividade)
          atividadeId = novaAtiv.id
          resultado.comunicacoes.criados++
        }

        if (item.camposAValidar.length > 0) {
          resultado.pendenciasValidacao.push({
            colecao: 'atividades',
            id: atividadeId,
            titulo: `Comunicação ${m.id_planilha || m.tipo}`,
            camposPendentes: item.camposAValidar,
            rota: clienteId ? `/clientes/${clienteId}` : '/clientes',
          })
        }
      } catch (err: unknown) {
        resultado.comunicacoes.erros++
        const msg = err instanceof Error ? err.message : String(err)
        resultado.errosDetalhados.push(
          `Comunicação "${m.id_planilha || 'Linha ' + item.linhaOriginal}": ${msg}`,
        )
      }
      reportarProgresso(`Comunicações (${m.id_planilha || 'Linha ' + item.linhaOriginal})`)
    }
  }

  // ==========================================
  // ETAPA 5: REGISTRAR LOG DA IMPORTAÇÃO
  // ==========================================
  try {
    const logRecord = await pb.collection('importacoes_log').create({
      arquivo_nome: dados.arquivoNome,
      tamanho_bytes: dados.tamanhoBytes,
      usuario: currentUserId || null,
      total_clientes: resultado.clientes.criados + resultado.clientes.atualizados,
      total_projetos: resultado.projetos.criados + resultado.projetos.atualizados,
      total_financeiro: resultado.financeiro.criados + resultado.financeiro.atualizados,
      total_comunicacoes: resultado.comunicacoes.criados + resultado.comunicacoes.atualizados,
      resumo: {
        clientes: {
          ...resultado.clientes,
          pendencias: resultado.pendenciasValidacao.filter((p) => p.colecao === 'clientes').length,
        },
        projetos: {
          ...resultado.projetos,
          pendencias: resultado.pendenciasValidacao.filter((p) => p.colecao === 'projetos').length,
        },
        financeiro: {
          ...resultado.financeiro,
          pendencias: resultado.pendenciasValidacao.filter((p) => p.colecao === 'parcelas').length,
        },
        comunicacoes: {
          ...resultado.comunicacoes,
          pendencias: resultado.pendenciasValidacao.filter((p) => p.colecao === 'atividades')
            .length,
        },
        avisos: resultado.avisosGerais,
        erros: resultado.errosDetalhados,
      },
    })
    resultado.logId = logRecord.id
  } catch (err) {
    console.warn('Não foi possível gravar o log da importação:', err)
  }

  reportarProgresso('Importação concluída!')
  return resultado
}
