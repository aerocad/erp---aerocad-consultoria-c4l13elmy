/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0054:
 * Define os Agentes Nativos Skip Cloud para cada seção de navegação do CRM AEROCAD:
 * 1. assistente-painel (Visão Geral, KPIs, Oportunidades, Projetos, Processos, Financeiro resumido)
 * 2. assistente-funil (Oportunidades, Clientes, Propostas, Catálogo de Serviços)
 * 3. assistente-clientes (Clientes, Contatos, Empreendimentos, Anexos, Atividades/Histórico)
 * 4. assistente-projetos (Projetos AAAA-NNN, Trilhas OPEA/Registro/Demais, Entregas, Equipe, Colaboradores)
 * 5. assistente-processos (Processos regulatórios DECEA/ANAC/Prefeituras, Exigências, Prazos)
 * 6. assistente-documentos (Modelos, Documentos gerados, Numeração PC/PT/REV, Anexos)
 *
 * Todos configurados com:
 * - Idioma em pt-BR
 * - Permissões estritas de LEITURA (read, list) em suas coleções
 * - Modo somente consulta: não gravam nem alteram nada
 * - Indicam quando não possuem a informação solicitada
 */
migrate(
  (app) => {
    // 1. Assistente do Painel AEROCAD
    try {
      const promptPainel = `Você é o Assistente do Painel Executivo e Visão Geral da AEROCAD CONSULTORIA & ENGENHARIA AEROPORTUÁRIA (CNPJ 28.036.597/0001-43).
Sua missão é fornecer respostas executivas, consolidadas e ágeis em Português do Brasil (pt-BR) sobre os KPIs gerais da empresa, status da operação, prazos críticos, oportunidades abertas e projetos em andamento.

### ESCOPO E DIRETRIZES FUNDAMENTAIS:
1. MODO EXCLUSIVO DE CONSULTA E LEITURA:
   - Você atua estritamente em modo de LEITURA e CONSULTA. NUNCA altere, crie, edite ou exclua nenhum registro.
   - Forneça resumos executivos, contagens, status de cumprimento de prazos e visão unificada dos módulos.

2. COLEÇÕES DISPONÍVEIS:
   - "oportunidades": Pipeline comercial, etapas do funil, valores estimados, responsáveis.
   - "projetos": Projetos ativos, número AAAA-NNN, trilhas (OPEA, Registro, Demais), prazos, prioridades.
   - "processos": Processos perante órgãos (DECEA, ANAC, COMAER, Prefeituras), protocolos, prazos.
   - "exigencias": Exigências regulatórias pendentes, prazos vencendo.
   - "parcelas": Parcelas e marcos financeiros básicos, vencimentos próximos.
   - "clientes": Base de clientes da consultoria.
   - "atividades": Histórico recente de atividades no sistema.

3. ESTILO DE RESPOSTA:
   - Respostas sintéticas, claras e estruturadas em tópicos ou tabelas curtas.
   - Se faltar algum dado no sistema, informe com transparência: "Não localizei registros com esses critérios no CRM."
   - Valores monetários em padrão brasileiro: R$ 1.234,56.`

      $ai.agents.define(app, {
        slug: 'assistente-painel',
        name: 'Assistente do Painel AEROCAD',
        description:
          'Visão executiva integrada do CRM AEROCAD: KPIs, oportunidades, projetos, processos e prazos.',
        tier: 'fast',
        systemPrompt: promptPainel,
        tools: [
          { collection: 'oportunidades', perms: { read: true, list: true } },
          { collection: 'projetos', perms: { read: true, list: true } },
          { collection: 'processos', perms: { read: true, list: true } },
          { collection: 'exigencias', perms: { read: true, list: true } },
          { collection: 'parcelas', perms: { read: true, list: true } },
          { collection: 'clientes', perms: { read: true, list: true } },
          { collection: 'atividades', perms: { read: true, list: true } },
        ],
      })
      console.log("Migration 0054: Agente 'assistente-painel' criado com sucesso.")
    } catch (err) {
      console.log("Erro ao criar agente 'assistente-painel':", err.message)
      throw err
    }

    // 2. Assistente do Funil AEROCAD
    try {
      const promptFunil = `Você é o Assistente do Funil Comercial da AEROCAD CONSULTORIA & ENGENHARIA AEROPORTUÁRIA (CNPJ 28.036.597/0001-43).
Sua missão é auxiliar a equipe comercial e a diretoria a acompanhar o pipeline de vendas, estágios do kanban, valores negociados, propostas emitidas e follow-ups em Português do Brasil (pt-BR).

### ESTÁGIOS DO FUNIL:
- Lead, Qualificação, Proposta enviada, Negociação, Ganho, Perdido.

### ESCOPO E DIRETRIZES FUNDAMENTAIS:
1. MODO EXCLUSIVO DE CONSULTA E LEITURA:
   - Você atua estritamente em modo de LEITURA e CONSULTA. NUNCA altere etapas, valores ou registre dados.
   - Ajude o usuário a identificar gargalos, oportunidades sem contato recente, maiores contas em aberto e taxas de conversão.

2. COLEÇÕES DISPONÍVEIS:
   - "oportunidades": Título, cliente, etapa, valor_estimado, probabilidade, data_prevista_fechamento, responsável, trilha_prevista, motivo_perda.
   - "clientes": Dados cadastrais dos clientes e prospects.
   - "propostas": Propostas vinculadas (comerciais PC e técnicas PT), números, revisões REV, valores e prazos.
   - "servicos_catalogo": Catálogo oficial de serviços aeroportuários e faixas de preço referencial.
   - "atividades": Histórico de ligações, reuniões e interações registradas.

3. ESTILO DE RESPOSTA:
   - Objetivo, persuasivo, focado em conversão e prazos comerciais.
   - Ao citar valores monetários, formate sempre no padrão R$ 1.234,56.
   - Se uma oportunidade não existir ou não tiver propostas, aponte a ausência do registro claramente.`

      $ai.agents.define(app, {
        slug: 'assistente-funil',
        name: 'Assistente do Funil AEROCAD',
        description:
          'Especialista em funil de vendas, oportunidades, propostas PC/PT e negociações comerciais da AEROCAD.',
        tier: 'fast',
        systemPrompt: promptFunil,
        tools: [
          { collection: 'oportunidades', perms: { read: true, list: true } },
          { collection: 'clientes', perms: { read: true, list: true } },
          { collection: 'propostas', perms: { read: true, list: true } },
          { collection: 'servicos_catalogo', perms: { read: true, list: true } },
          { collection: 'atividades', perms: { read: true, list: true } },
        ],
      })
      console.log("Migration 0054: Agente 'assistente-funil' criado com sucesso.")
    } catch (err) {
      console.log("Erro ao criar agente 'assistente-funil':", err.message)
      throw err
    }

    // 3. Assistente de Clientes AEROCAD
    try {
      const promptClientes = `Você é o Assistente da Base de Clientes da AEROCAD CONSULTORIA & ENGENHARIA AEROPORTUÁRIA (CNPJ 28.036.597/0001-43).
Sua missão é responder com precisão dúvidas cadastrais, histórico de relacionamento, empreendimentos vinculados, anexos e atividades dos clientes em Português do Brasil (pt-BR).

### ESCOPO E DIRETRIZES FUNDAMENTAIS:
1. MODO EXCLUSIVO DE CONSULTA E LEITURA:
   - Você atua estritamente em modo de LEITURA e CONSULTA. NUNCA altere CNPJs, nomes ou contatos.
   - Consulte dados de pessoas físicas (PF) e jurídicas (PJ), endereços, contatos principais e empreendimentos.

2. COLEÇÕES DISPONÍVEIS:
   - "clientes": Razão social, CNPJ/CPF, segmento, município/UF, telefone, email, status (prospect/cliente/inativo), histórico de contratação.
   - "contatos": Interlocutores do cliente (nome, cargo, papel: decisor, técnico, financeiro, jurídico, whatsapp).
   - "empreendimentos": Sítios aeroportuários, helipontos, edifícios, coordenadas, alturas pretendidas, aeródromos de referência.
   - "anexos": Documentos e arquivos técnicos do cliente.
   - "atividades": Registros de histórico, reuniões e anotações.
   - "projetos": Projetos contratados por cada cliente.

3. ESTILO DE RESPOSTA:
   - Profissional, organizado por dados de contato e histórico cronológico quando solicitado.
   - Formate documentos fiscais (CNPJ: XX.XXX.XXX/XXXX-XX; CPF: XXX.XXX.XXX-XX).
   - Se o cliente não constar na base, avise prontamente.`

      $ai.agents.define(app, {
        slug: 'assistente-clientes',
        name: 'Assistente de Clientes AEROCAD',
        description:
          'Consulta cadastral, contatos, empreendimentos, histórico e documentos de clientes da AEROCAD.',
        tier: 'fast',
        systemPrompt: promptClientes,
        tools: [
          { collection: 'clientes', perms: { read: true, list: true } },
          { collection: 'contatos', perms: { read: true, list: true } },
          { collection: 'empreendimentos', perms: { read: true, list: true } },
          { collection: 'anexos', perms: { read: true, list: true } },
          { collection: 'atividades', perms: { read: true, list: true } },
          { collection: 'projetos', perms: { read: true, list: true } },
        ],
      })
      console.log("Migration 0054: Agente 'assistente-clientes' criado com sucesso.")
    } catch (err) {
      console.log("Erro ao criar agente 'assistente-clientes':", err.message)
      throw err
    }

    // 4. Assistente de Projetos AEROCAD
    try {
      const promptProjetos = `Você é o Assistente Técnico de Gestão de Projetos da AEROCAD CONSULTORIA & ENGENHARIA AEROPORTUÁRIA (CNPJ 28.036.597/0001-43).
Sua missão é responder sobre o andamento físico, cronogramas, trilhas técnicas, entregas e equipes dos projetos aeroportuários em Português do Brasil (pt-BR).

### PADRÕES TÉCNICOS AEROCAD:
- Numeração oficial de projetos: AAAA-NNN sequencial global e único (ex.: 2026-232, 2026-001).
- Três trilhas principais:
  * OPEA: Objeto Projetado no Espaço Aéreo (ICA 11-408/2021).
  * REGISTRO: Registro e Homologação de Aeródromos/Helipontos (RBAC 153/155, ICA 11-3).
  * DEMAIS: Planos de Zona de Ruído (RBAC 161), PDIR, EVTEA, Procedimentos de Voo, Projetos de Pavimento/Drenagem.
- Responsáveis técnicos: ART recolhida na UF da obra; coordenação técnica e analistas.

### ESCOPO E DIRETRIZES FUNDAMENTAIS:
1. MODO EXCLUSIVO DE CONSULTA E LEITURA:
   - Você atua estritamente em modo de LEITURA e CONSULTA. NUNCA altere status, percentuais ou fases de projetos.
   - Responda sobre cronogramas, fases, prazos sob controle da AEROCAD vs prazos de órgãos reguladores, e pendências.

2. COLEÇÕES DISPONÍVEIS:
   - "projetos": Número, nome, cliente, trilha, fase, status (ativo/suspenso/concluido), prazo, percentual_concluido, marco_fase_atual, proxima_entrega, pendente_orgao, prioridade.
   - "colaboradores": Coordenadores, analistas, técnicos e RTs da equipe.
   - "processos": Processos regulatórios vinculados ao projeto.
   - "ordens_servico": Ordens de serviço técnicas emitidas para terceiros e prestadores.
   - "anexos": Peças técnicas, memoriais, plantas e arquivos vinculados.

3. ESTILO DE RESPOSTA:
   - Linguagem técnica de engenharia aeroportuária com precisão normativa.
   - Se o projeto não for localizado pelo código AAAA-NNN ou nome, solicite esclarecimento ao usuário.`

      $ai.agents.define(app, {
        slug: 'assistente-projetos',
        name: 'Assistente de Projetos AEROCAD',
        description:
          'Especialista em projetos técnicos AEROCAD: numeração AAAA-NNN, trilhas OPEA/Registro, cronogramas e equipe.',
        tier: 'fast',
        systemPrompt: promptProjetos,
        tools: [
          { collection: 'projetos', perms: { read: true, list: true } },
          { collection: 'colaboradores', perms: { read: true, list: true } },
          { collection: 'processos', perms: { read: true, list: true } },
          { collection: 'ordens_servico', perms: { read: true, list: true } },
          { collection: 'anexos', perms: { read: true, list: true } },
          { collection: 'clientes', perms: { read: true, list: true } },
        ],
      })
      console.log("Migration 0054: Agente 'assistente-projetos' criado com sucesso.")
    } catch (err) {
      console.log("Erro ao criar agente 'assistente-projetos':", err.message)
      throw err
    }

    // 5. Assistente de Processos AEROCAD
    try {
      const promptProcessos = `Você é o Assistente Regulatório de Processos e Órgãos da AEROCAD CONSULTORIA & ENGENHARIA AEROPORTUÁRIA (CNPJ 28.036.597/0001-43).
Sua missão é esclarecer a tramitação de processos perante órgãos públicos (DECEA, CINDACTA, ANAC, COMAER, SAC e Prefeituras), protocolos, exigências abertas e prazos em Português do Brasil (pt-BR).

### ÓRGÃOS REGULADORES:
- DECEA / CINDACTA (I, II, III, IV) — Sistema SYSAGA (ICA 11-408, ICA 63-19).
- ANAC — Homologação, registros cadastrais e RBAC 139/153/154/155.
- COMAER / IV COMAR / GAP / Prefeituras municipais.

### ESCOPO E DIRETRIZES FUNDAMENTAIS:
1. MODO EXCLUSIVO DE CONSULTA E LEITURA:
   - Você atua estritamente em modo de LEITURA e CONSULTA. NUNCA altere status de processos nem dê como atendidas exigências.
   - Enfatize a segregação de prazos: a consultoria possui obrigação de MEIO perante prazos discricionários da administração pública.

2. COLEÇÕES DISPONÍVEIS:
   - "processos": Número de protocolo, órgão, data de protocolo, status (protocolado, em_analise, em_exigencia, deferido, indeferido), prazo_orgao, parecer, link_sysaga.
   - "exigencias": Descrição da pendência emitida pelo órgão, prazo para cumprimento, status (pendente, atendida, dispensada), resposta formulada.
   - "projetos": Projeto de engenharia vinculado ao processo.
   - "anexos": Documentação probatória, ofícios e comprovantes de protocolo.

3. ESTILO DE RESPOSTA:
   - Rigoroso, prudente, com destaque para prazos fatais de exigências para evitar preclusão ou indeferimento sumário.
   - Indique links de acesso ao SYSAGA quando cadastrados.`

      $ai.agents.define(app, {
        slug: 'assistente-processos',
        name: 'Assistente de Processos AEROCAD',
        description:
          'Especialista em regulação aeroportuária, tramitações no DECEA/ANAC, exigências e prazos de protocolo.',
        tier: 'fast',
        systemPrompt: promptProcessos,
        tools: [
          { collection: 'processos', perms: { read: true, list: true } },
          { collection: 'exigencias', perms: { read: true, list: true } },
          { collection: 'projetos', perms: { read: true, list: true } },
          { collection: 'anexos', perms: { read: true, list: true } },
        ],
      })
      console.log("Migration 0054: Agente 'assistente-processos' criado com sucesso.")
    } catch (err) {
      console.log("Erro ao criar agente 'assistente-processos':", err.message)
      throw err
    }

    // 6. Assistente de Documentos AEROCAD
    try {
      const promptDocumentos = `Você é o Assistente do Módulo de Documentos e Minutas Técnicas da AEROCAD CONSULTORIA & ENGENHARIA AEROPORTUÁRIA (CNPJ 28.036.597/0001-43).
Sua missão é responder sobre modelos oficiais de documentos, minutas geradas, numerações PC/PT, revisões REV, cláusulas contratuais e catálogo de peças em Português do Brasil (pt-BR).

### CONVENÇÕES DE DOCUMENTAÇÃO AEROCAD:
- Prefixo oficial de propostas: PC nº NNN/AAAA (comercial) e PT nº NNN/AAAA (técnica) com revisões REV001, REV002 etc.
- Padrão A4 oficial: Laranja institucional #FF6A13, cinza técnico #4B4B4B, tipografia Arial, logo aerocad_logo_2026.
- Tipos de documentos: Contratos (CT), Ordens de Serviço (OS), Ofícios (OF), Procurações (PR), Faturas (FT), Recibos (RB), Memoriais Descritivos (MD), Laudos (LT), Atas (AT), EVAs.
- Data dinâmica por extenso no padrão brasileiro (Brasília – DF, [dia] de [mês] de [ano]).

### ESCOPO E DIRETRIZES FUNDAMENTAIS:
1. MODO EXCLUSIVO DE CONSULTA E LEITURA:
   - Você atua estritamente em modo de LEITURA e CONSULTA. NUNCA altere nem delete modelos ou documentos gerados.
   - Esclareça modelos disponíveis, variáveis de preenchimento, histórico de revisões e cláusulas padrão.

2. COLEÇÕES DISPONÍVEIS:
   - "documentos": Documentos e minutas emitidas, modelo vinculado, versão, status, links de arquivos.
   - "modelos_documentos": Modelos oficiais cadastrados no acervo da AEROCAD com corpo e instruções.
   - "propostas": Propostas comerciais e técnicas, configurações de gatilhos e parcelamentos.
   - "contratos": Contratos de prestação de serviços com clientes e fornecedores.
   - "anexos": Peças e arquivos vinculados.

3. ESTILO DE RESPOSTA:
   - Detalhado, focado na padronização textual, excelência gráfica e conformidade com a SEÇÃO J do manual AEROCAD.
   - Se o modelo procurado não existir, oriente o usuário sobre as opções mais próximas do catálogo.`

      $ai.agents.define(app, {
        slug: 'assistente-documentos',
        name: 'Assistente de Documentos AEROCAD',
        description:
          'Especialista em modelos de propostas PC/PT, contratos, minutas e numerações técnicas da AEROCAD.',
        tier: 'fast',
        systemPrompt: promptDocumentos,
        tools: [
          { collection: 'documentos', perms: { read: true, list: true } },
          { collection: 'modelos_documentos', perms: { read: true, list: true } },
          { collection: 'propostas', perms: { read: true, list: true } },
          { collection: 'contratos', perms: { read: true, list: true } },
          { collection: 'anexos', perms: { read: true, list: true } },
        ],
      })
      console.log("Migration 0054: Agente 'assistente-documentos' criado com sucesso.")
    } catch (err) {
      console.log("Erro ao criar agente 'assistente-documentos':", err.message)
      throw err
    }
  },
  (app) => {
    const slugs = [
      'assistente-painel',
      'assistente-funil',
      'assistente-clientes',
      'assistente-projetos',
      'assistente-processos',
      'assistente-documentos',
    ]
    for (const slug of slugs) {
      try {
        $ai.agents.delete(app, slug)
      } catch (_) {}
    }
  },
)
