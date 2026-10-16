import pb from '@/lib/pocketbase/client'
import type { EmpresaRecord, EmpresaFormData } from '@/types/crm'

export const EMPRESA_CHAVE_PADRAO = 'aerocad_principal'

/**
 * Carrega os dados cadastrais e societários da empresa AEROCAD.
 * Se ainda não existir registro na coleção, cria um padrão e retorna.
 */
export async function obterDadosEmpresa(
  chave: string = EMPRESA_CHAVE_PADRAO,
): Promise<EmpresaRecord> {
  try {
    const record = await pb
      .collection('empresa')
      .getFirstListItem<EmpresaRecord>(`chave = "${chave}"`, {
        requestKey: null,
      })
    return record
  } catch (err: unknown) {
    // Tenta fallback: se houver qualquer registro na coleção empresa
    try {
      const records = await pb.collection('empresa').getList<EmpresaRecord>(1, 1, {
        requestKey: null,
      })
      if (records.items.length > 0) {
        return records.items[0]
      }
    } catch {
      /* fallback ignorado */
    }

    // Se a coleção estiver vazia (ex: réplica inicial), cria o registro padrão
    const novo = await pb.collection('empresa').create<EmpresaRecord>({
      chave,
      razao_social: 'AEROCAD Terraplanagem e Construção Ltda.',
      nome_fantasia: 'AEROCAD® CONSULTORIA & AEROPORTOS',
      cnpj: '28.036.597/0001-43',
      inscricao_estadual: '07.815.970/001-59',
      endereco: 'SBS Quadra 2, Sala 206, Ed. Prime Business, Asa Sul, CEP 70.070-120, Brasília-DF',
      cidade_uf: 'Brasília / DF',
      cep: '70.070-120',
      telefone: '+55 61 9 8462-8800',
      email: 'contato@aerocad.com.br',
      website: 'www.aerocad.com.br',
      banco_nome: 'INTER (077)',
      banco_agencia: '0001',
      banco_conta: '7637194-8',
      chave_pix: '28.036.597/0001-43',
      capital_social: 100000,
      data_constituicao: '2017-06-26',
      cnae_principal: '71.12-0-00 - Serviços de engenharia aeroportuária e consultoria técnica',
      objeto_social:
        'Serviços de engenharia aeroportuária, elaboração de planos de zona de proteção (PBZPA, PBZH, PZPANA, PBZR), estudos de viabilidade técnica aeronáutica (EVA/EVTEA), processos perante ANAC, DECEA e COMAER, projetos e consultoria técnica especializada.',
      socios: [
        {
          nome: 'Jaqueline Mota de Freitas Saraiva',
          cpf_cnpj: '005.417.801-07',
          qualificacao: 'Sócio-Administrador',
          percentual_participacao: 50.0,
        },
        {
          nome: 'Cleyton Borges Saraiva',
          cpf_cnpj: '619.274.492-00',
          qualificacao: 'Sócio-Administrador',
          percentual_participacao: 50.0,
        },
      ],
    })
    return novo
  }
}

/**
 * Salva os dados cadastrais da empresa AEROCAD, opcionalmente com arquivo do contrato social
 */
export async function salvarDadosEmpresa(
  dados: EmpresaFormData,
  id?: string,
  arquivoContratoSocial?: File | null,
): Promise<EmpresaRecord> {
  const chave = dados.chave || EMPRESA_CHAVE_PADRAO

  const payload: Record<string, unknown> = {
    chave,
    razao_social: dados.razao_social.trim(),
    nome_fantasia: (dados.nome_fantasia || '').trim(),
    cnpj: dados.cnpj.trim(),
    inscricao_estadual: (dados.inscricao_estadual || '').trim(),
    inscricao_municipal: (dados.inscricao_municipal || '').trim(),
    data_constituicao: (dados.data_constituicao || '').trim(),
    capital_social: typeof dados.capital_social === 'number' ? dados.capital_social : 0,
    cnae_principal: (dados.cnae_principal || '').trim(),
    objeto_social: (dados.objeto_social || '').trim(),
    endereco: (dados.endereco || '').trim(),
    cidade_uf: (dados.cidade_uf || '').trim(),
    cep: (dados.cep || '').trim(),
    telefone: (dados.telefone || '').trim(),
    email: (dados.email || '').trim(),
    website: (dados.website || '').trim(),
    banco_nome: (dados.banco_nome || '').trim(),
    banco_agencia: (dados.banco_agencia || '').trim(),
    banco_conta: (dados.banco_conta || '').trim(),
    chave_pix: (dados.chave_pix || '').trim(),
    socios: dados.socios || [],
    observacoes: (dados.observacoes || '').trim(),
  }

  let empresaRecord: EmpresaRecord

  if (id) {
    empresaRecord = await pb.collection('empresa').update<EmpresaRecord>(id, payload)
  } else {
    // Busca se já existe por chave antes de criar
    try {
      const existente = await pb
        .collection('empresa')
        .getFirstListItem<EmpresaRecord>(`chave = "${chave}"`, {
          requestKey: null,
        })
      empresaRecord = await pb.collection('empresa').update<EmpresaRecord>(existente.id, payload)
    } catch {
      empresaRecord = await pb.collection('empresa').create<EmpresaRecord>(payload)
    }
  }

  // Anexa arquivo do contrato social se fornecido
  if (arquivoContratoSocial && empresaRecord.id) {
    const formData = new FormData()
    formData.append('contrato_social', arquivoContratoSocial)
    empresaRecord = await pb.collection('empresa').update<EmpresaRecord>(empresaRecord.id, formData)
  }

  return empresaRecord
}

/**
 * Remove um arquivo específico de contrato social da empresa (se múltiplos existirem)
 */
export async function removerArquivoContratoSocialEmpresa(
  empresaId: string,
  nomeArquivo: string,
): Promise<EmpresaRecord> {
  const formData = new FormData()
  formData.append('contrato_social-', nomeArquivo)
  return await pb.collection('empresa').update<EmpresaRecord>(empresaId, formData)
}
