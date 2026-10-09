# AEROCAD® — Catálogo de Templates de Documentos

**AEROCAD Terraplanagem e Construção Ltda.** · CNPJ 28.036.597/0001-43
SBS Quadra 2, Sala 206, Ed. Prime Business, Asa Sul, CEP 70.070-120, Brasília-DF
+55 61 98462-8800 · contato@aerocad.com.br · www.aerocad.com.br

---

## Padrão Visual e Codificação

Todos os templates seguem a identidade visual AEROCAD:

- **Cor-marca:** Safety Orange `#FF6A13`
- **Cabeçalho e rodapé:** logo AEROCAD + dados institucionais
- **Família tipográfica:** sem-serifa (Calibri/Arial), corpo 11 pt
- **Formato padrão:** A4 retrato (A4 paisagem para cronogramas Gantt e plantas A0)
- **Script-base de geração:** `aerocad_base.py` (funções `title_block`, `heading`, `subheading`, `add_para`, `kv_table`, `signature_block`, `finalize_and_save`)
- **Regras globais:** data dinâmica via `data_hoje_extenso()`, nunca encerrar página quebrando logo após título (`keep_with_next=True`), numeração sequencial de figuras e tabelas, `evitar_orfa_cabecalho` em todas as tabelas

### Convenção de nomenclatura dos arquivos

| Prefixo      | Significado                               |
| ------------ | ----------------------------------------- |
| **PC**       | Proposta Comercial                        |
| **PT**       | Proposta Técnica                          |
| **CT / CTR** | Contrato / Minuta de Contrato             |
| **OS**       | Ordem de Serviço                          |
| **AT**       | Atestado Técnico / Ata de Reunião         |
| **IGR**      | Ingresso de Registro (dossiê)             |
| **PR**       | Procuração                                |
| **FT / NF**  | Fatura / Nota Fiscal                      |
| **RB**       | Recibo                                    |
| **RG**       | Relatório Gerencial                       |
| **MD / MC**  | Memorial Descritivo / Memorial de Cálculo |
| **LT / PT**  | Laudo Técnico / Parecer Técnico           |
| **FNC**      | Ficha de Não Conformidade                 |
| **PAC**      | Plano de Ação Corretiva                   |
| **NT**       | Nota Técnica                              |
| **RQ**       | Requerimento (ANAC/DECEA)                 |
| **CHK**      | Checklist de Inspeção                     |

Formato típico: `AEROCAD_<PREFIXO>_<NÚMERO>_<ANO>_<CLIENTE>_<ESCOPO>_v<HHMMSS>.docx`

---

## 1. Comerciais e Pré-Contratuais

### 1.1 Proposta Comercial (PC)

Documento comercial padrão com estrutura de 11 a 13 seções:

1. Interessado(a) — dados do contratante
2. Apresentação da AEROCAD
3. Objeto
4. Atividades (detalhamento técnico)
5. Prazos
6. Orçamento (tabela com itens, horas, preços unitários e total)
7. Forma de pagamento (parcelas e marcos técnicos)
8. Dados bancários
9. Não inclusos no orçamento
10. Referências legais
11. Considerações finais
12. (opcional) Cronograma Gantt — página paisagem

**Variantes:**

- **PC simples (OPEA, cadastro, parecer):** 5-7 seções, medição única ou 2-3 parcelas
- **PC multi-item (viabilidade + registro + projeto executivo):** 2 opções de contratação (contratos independentes × contrato único combinado)
- **PC multi-módulo (RFQ aeroportuária):** 4 módulos independentes com preço separado + Quadro de Aderência item a item + estimativa de subcontratação

**Exemplos no repositório:**
`gen_pc_zurich_sbvt_opea_a330.py` · `gen_pc_233_bruna_rodrigues_2opcoes.py` · `gen_pc_occ_maragogi.py` · `gen_pc_ricardo_lima_opea.py` · `gen_pc_zurich_sbvt_alteracao_cadastral.py`

### 1.2 Proposta Técnica (PT)

Documento técnico que acompanha uma PC em RFQs maiores. 13 seções típicas:
Interessado · Apresentação com experiência aplicável · Objeto/Escopo em módulos · Detalhamento por módulo (tabela Requisito × Metodologia × Entregável) · Equipe técnica · Quadro de Aderência item a item · Normas adotadas · Dados de entrada + matriz de premissas · Gestão do contrato · Cronograma Gantt landscape · Entregáveis consolidados · Confidencialidade/conflito de interesses · Encerramento.

**Exemplo:** `gen_pt_zurich_sbfl_ampliacao.py` (PT 240/2026 — ampliação PPD 14/32 SBFL)

### 1.3 Carta de Apresentação / E-mail de Encaminhamento

Texto estruturado (sem assinatura — a assinatura vai no e-mail do remetente). Blocos padrão:

1. Saudação ao destinatário nominada
2. Contexto/sequência
3. Resumo do escopo em bullets
4. Condições comerciais principais (valor, prazo, pagamento, validade)
5. Nota sobre PCs correlatas (se houver)
6. Disposição para videoconferência + referência ao contato secundário
7. Fechamento com agradecimento

---

## 2. Contratuais

### 2.1 Minuta de Contrato de Prestação de Serviços

Estrutura típica em 11 cláusulas:

1. Qualificação das partes (CONTRATANTE + CONTRATADA)
2. Objeto
3. Obrigações da CONTRATADA
4. Obrigações do CONTRATANTE
5. Valor e Forma de Pagamento (com cronograma por parcela)
6. Prazo de execução
7. Responsabilidade técnica (obrigação de meio vs. resultado)
8. Confidencialidade (vigência de 5 anos pós-término)
9. Rescisão (multa 20% por desistência imotivada)
10. Condições gerais
11. Foro (Brasília/DF)

Encerramento com bloco de assinaturas das partes em tabela 2×4 + bloco de 2 testemunhas.

**Exemplo:** `gen_contrato_paulo_victor_registro.py`

### 2.2 Ordem de Serviço (OS) Interna

Documento interno de abertura de projeto, dirigido ao Responsável Técnico ou Especialista. Campos:

- Nº OS / data / prazo
- Projeto / cliente / escopo
- Equipe designada e responsabilidades
- Entregáveis esperados
- Marcos de controle
- Normativos aplicáveis

**Exemplo:** `gen_os_sbfl_ampliacao.py` (OS-001, 002, 003 para SBFL)

### 2.3 Procuração

Procuração para representação da CONTRATANTE junto a DECEA, COMAER, ANAC e demais órgãos. Outorgado padrão: Jaqueline Mota de Freitas Saraiva (CPF 005.417.801-07). Finalidade específica: representação em processo OPEA, cadastro, registro ou alteração.

**Exemplo:** `gen_procuracao_paulovictor.py`

### 2.4 Pedido de Compras

Documento usado para contratação de fornecedores de serviços técnicos pela AEROCAD. 6 seções:

1. Dados do Tomador de Serviços (AEROCAD) + Responsável pelo Pedido
2. Dados do Fornecedor (razão, atribuição, CNPJ, contatos, endereço)
3. Descrição do Produto/Serviço
4. Itens e Valores (tabela Item · Descrição · Qtd · Preço Unit. · Valor Total · Entrega + Subtotal + Total)
5. Condições de Pagamento
6. Atenção ao Fornecedor (regras de faturamento, prazos NF, retenções)

Encerramento com assinatura do comprador.

**Exemplo:** `gen_pedido_compras_008_twr.py`

---

## 3. Técnicos de Engenharia Aeronáutica

### 3.1 Estudo de Viabilidade Operacional (EVA / Pré-análise)

Relatório técnico conclusivo recomendando ou não a construção/operação de um aeródromo ou obra. Estrutura:

1. Caracterização do empreendimento e da área
2. Metodologia e critérios
3. Enquadramento normativo e superfície afetada
4. Análise de restrições — altura máxima construível ou impactos
5. Verificação da altura/condição pretendida
6. Mapas (QGIS) — figuras numeradas
7. Conclusão e viabilidade
8. Glossário
9. Referências bibliográficas

**Exemplos:** `gen_estudo_viabilidade_006_galpoes.py` · `gen_estudo_viabilidade_galpoes_sbfl.py` · `AEROCAD_Estudo_Viabilidade_OPEA_SBFL_Galpoes_1e2_006.docx`

### 3.2 Estudo Aeronáutico (OPEA — ICA 11-408/2021)

Documento técnico para análise de Objeto Projetado no Espaço Aéreo:

- Caracterização do empreendimento
- Identificação formal dos OPEA decorrentes
- Análise de risco operacional
- Matriz de mitigação priorizada (demolição, rebaixamento, sinalização, balizamento, aceitação técnica)
- Fundamentação normativa (ICA 11-408/2021, ICA 63-19/2021, Anexo 14 OACI, RBAC 154)

### 3.3 PBZPA — Plano Básico de Zona de Proteção de Aeródromo (ICA 11-408/2021)

Pacote técnico:

- Memorial descritivo (caracterização do aeródromo, aeronave-crítica, parâmetros geométricos)
- Plantas das superfícies limitadoras (aproximação, decolagem, transição, horizontal interna, cônica, horizontal externa) em DWG + PDF
- Planilha de Requerimento ANAC/DECEA (formulários oficiais)
- ART CREA

### 3.4 PZPANA — Plano de Zoneamento de Proteção contra Auxílios à Navegação Aérea (ICA 63-19/2021)

Mesma estrutura do PBZPA, aplicada aos auxílios rádio (VOR, DME, ILS, RADAR).

### 3.5 PDIR — Plano Diretor Aeroportuário

Documento abrangente com caracterização atual + horizonte de planejamento. Pacote:

- Relatório PDIR consolidado (DOCX + PDF)
- Pranchas A0 em paper space (planta de implantação, planta geral, uso do solo aeronáutico, zoneamento operacional)
- Quadro de distâncias declaradas (TORA/TODA/ASDA/LDA)
- Carimbo e legenda padrão
- Entrega em DXF/DWG editável
- Ver skill `aerocad-pdir` para orientações específicas

### 3.6 Projeto Técnico Executivo de Aeródromo (RBAC 154)

Pacote por disciplina:

- Projeto geométrico da PPD (eixo, cabeceiras, declividades, RESA)
- Faixa de pista
- Terraplanagem (cortes, aterros, taludes)
- Pavimentação + dimensionamento PCR (ANAC/FAA)
- Drenagem (superficial + profunda, estudo hidrológico)
- Sinalização horizontal e vertical
- Balizamento diurno e noturno + instalações elétricas
- Memoriais descritivo e de cálculo
- Caderno de especificações técnicas
- Planilhas quantitativas + orçamento sintético + cronograma físico-financeiro
- ARTs/RRTs por disciplina

### 3.7 Cartas Aeronáuticas (Anexo 4 OACI / AIS-Brasil)

- Carta ADC (Aerodrome Chart)
- Carta PDC (Aircraft Parking/Docking Chart)
- Carta AOC Type A (Aerodrome Obstacle Chart)
- Carta AOC Type B (quando aplicável)
  Entrega em formato oficial AIS-Brasil para publicação em AIP-BRASIL.

### 3.8 Procedimentos de Voo (PANS-OPS — Doc 8168 OACI)

- IAC (Instrument Approach Chart) — RNP APCH, ILS/LOC
- SID (Standard Instrument Departure)
- STAR (Standard Terminal Arrival Route)
- Memoriais de cálculo PANS-OPS
- Peças para submissão ao DECEA

### 3.9 Base Topográfica/Cartográfica (RPA ou aeronave tripulada)

- Plano de voo + autorizações (SARPAS/DECEA, SISANT/ANAC)
- Relatório GNSS dos pontos de controle
- Ortoimagem (GeoTIFF + ECW)
- MDS + MDT (grades 25 cm / 50 cm)
- Nuvem de pontos LiDAR classificada (LAS)
- Cadastro georreferenciado de obstáculos (KMZ + DWG + XLSX)
- Relatório técnico + ART CREA do responsável topográfico

### 3.10 Nota Técnica

Documento curto (2-6 páginas) de parecer rápido sobre consulta específica. Estrutura: contexto · pergunta · análise · conclusão objetiva. **Exemplo:** `build_nt_jeri.py`

### 3.11 Memorial Descritivo / Memorial de Cálculo

- **Memorial Descritivo:** descrição qualitativa (empreendimento, metodologia, critérios, resultados). `build_memorial.py`
- **Memorial de Cálculo:** justificativa quantitativa (cálculos de PCR, drenagem, pavimentação, OLS, etc.). `build_memorial_calculo.py`

### 3.12 Laudo / Parecer Técnico

Documento com peso probatório emitido pelo RT. Estrutura: objeto do laudo · metodologia · análise técnica · conclusão fundamentada · ART. **Exemplo:** `build_laudo.py`

---

## 4. Operacionais e de Gestão

### 4.1 Relatório Gerencial Mensal

Relatório periódico de acompanhamento. Caso de uso principal:

- **RG CNI (Heliponto SNAW / CEAMN)** — mensal, gerado a partir de fotos da visita técnica. Ver skill `aerocad-rg-cni`.

**Exemplo:** `build_relatorio_gerencial.py` · `AEROCAD_RG_CNI_08_2026.docx`

### 4.2 Ata de Reunião

Registro formal de reuniões técnicas (kick-off, checkpoints, pareceres). Campos: data/local · participantes · pauta · deliberações · pendências com responsáveis e prazos. **Exemplo:** `build_ata.py` · `gerar_ata_paulo_victor.py`

### 4.3 Checklist de Inspeção

Formulário estruturado para inspeções de campo (vistoria em aeródromos, helipontos, obras). Campos binários Conforme/Não Conforme + observações + fotos. **Exemplo:** `build_checklist.py`

### 4.4 Ficha de Não Conformidade (FNC)

Registro formal de desvio identificado — descreve a não conformidade, causa raiz, ação imediata e responsável. Vinculada a um PAC. **Exemplo:** `build_fnc.py`

### 4.5 Plano de Ação Corretiva (PAC)

Resposta formal a FNC ou exigência do órgão regulador. Estrutura: identificação da NC · ações corretivas · responsáveis · prazos · evidências de implementação. **Exemplo:** `build_pac.py`

### 4.6 Cronograma Físico-Financeiro

Gantt consolidado por disciplina/atividade com desembolsos vinculados aos marcos. Padrão AEROCAD: tabela em página landscape com atividades × semanas, barras laranja marcando períodos ativos, régua de dias corridos, marcos financeiros destacados. **Exemplo:** `build_cronograma.py`

### 4.7 Requerimento ANAC / DECEA

Formulário oficial preenchido para submissão de processos regulatórios (OPEA, SDIA, alteração cadastral, PBZPA, PZPANA). **Exemplo:** `build_requerimento.py`

---

## 5. Financeiros

### 5.1 Fatura / Nota de Cobrança

Documento de cobrança por parcela/marco. Campos: nº da fatura · referência ao contrato/PC · valor da parcela · evento comprobatório · data de vencimento · dados bancários. **Exemplo:** `build_fatura.py` · `build_fatura_plena.py`

### 5.2 Recibo

Comprovante de pagamento após quitação. **Exemplo:** `build_recibo.py`

---

## 6. Tipos de Projeto (classificação por macro-escopo)

| Código                       | Tipo                                                              | Normativa principal             |
| ---------------------------- | ----------------------------------------------------------------- | ------------------------------- |
| **OPEA**                     | Objeto Projetado no Espaço Aéreo                                  | ICA 11-408/2021                 |
| **PBZPA**                    | Plano Básico de Zona de Proteção de Aeródromo                     | ICA 11-408/2021 · RBAC 154      |
| **PZPANA**                   | Plano de Zoneamento de Proteção contra Auxílios à Navegação Aérea | ICA 63-19/2021                  |
| **PBZH**                     | Plano Básico de Zona de Proteção de Heliponto                     | ICA 11-408/2021 · RBAC 155      |
| **PBZR / PEZR**              | Plano Básico/Específico de Zoneamento de Ruído                    | RBAC 161                        |
| **EVA / EVTEA**              | Estudo de Viabilidade (Técnica/Econômica/Ambiental)               | —                               |
| **Registro de Aeródromo**    | Registro Privado ou Público                                       | RBAC 153 · ICA 11-3 · ICA 12-24 |
| **Registro de Heliponto**    | Registro privativo                                                | RBAC 155 · ICA 11-408           |
| **Alteração Cadastral**      | Mudança de aeronave-crítica, geometria, etc.                      | ICA 11-3 · SYSAGA/DECEA         |
| **Homologação**              | Aeroporto comercial                                               | RBAC 139 (ANAC)                 |
| **SDIA**                     | Sistema de Dados e Informações Aeronáuticas                       | Portaria ANAC 1.214/SIA         |
| **PDIR**                     | Plano Diretor Aeroportuário                                       | RBAC 153 · PGI                  |
| **PGI**                      | Plano de Gestão da Infraestrutura                                 | RBAC 153                        |
| **PANS-OPS**                 | Procedimentos de Voo por Instrumento                              | Doc 8168 OACI                   |
| **MOPS**                     | Manual de Operações Aeroportuárias                                | RBAC 139/153                    |
| **Cartas Aeronáuticas**      | ADC, PDC, AOC, IAC, SID, STAR                                     | Anexo 4 OACI · AIS-Brasil       |
| **Projeto Básico/Executivo** | Geometria, pavimentação, drenagem, sinalização, balizamento       | RBAC 154                        |
| **Laudos / Pareceres**       | ART/RRT emitida                                                   | CREA/CAU                        |

---

## 7. Skills AEROCAD (automação de geração)

| Skill                | Finalidade                                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **aerocad-projetos** | Dispara para qualquer documento AEROCAD (PC, Contrato, OS, Ata, Memorial, Laudo, Requerimento, Fatura, Recibo, FNC, PAC, Checklist, Cronograma, etc.). Suporta todos os tipos de projeto listados em §6.                |
| **aerocad-pdir**     | Específica para Plano Diretor Aeroportuário (relatório + plantas A0 + carimbo + quadro de distâncias declaradas + viewport/paper space + DXF/DWG). Não usar para PBZPA/PZPANA.                                          |
| **aerocad-rg-cni**   | Específica para o Relatório Gerencial mensal do Heliponto SNAW/CEAMN, gerado a partir de fotos da visita técnica. Dispara ao mencionar "Relatório Gerencial CNI", "RG CNI", "relatório CEAMN", "relatório mensal SNAW". |

---

## 8. Convenções e Boas Práticas AEROCAD

1. **Data dos documentos:** sempre `data_hoje_extenso()` — nunca hardcoded (regra global).
2. **Headings:** `keep_with_next=True` para evitar título órfão no final da página.
3. **Tabelas:** `evitar_orfa_cabecalho(tbl)` sempre; largura fixa `w:tblLayout type="fixed"`.
4. **Numeração:** figuras e tabelas numeradas sequencialmente; marcos financeiros M1-Mn consistentes com a tabela de pagamento.
5. **Marcos de pagamento:** vinculados a entregas técnicas (nunca a datas puras).
6. **NFS-e:** emitida em 5 dias úteis após o evento comprobatório; vencimento 30 dias (60 dias para Alcoa).
7. **ART/RRT:** emitida no CREA/CAU por disciplina/documento, pelo responsável técnico com registro na UF do empreendimento.
8. **Cronograma Gantt:** página landscape, barras laranja (`ORANGE_HEX`), régua de dias corridos, legenda clara, prazos de órgãos públicos SEGREGADOS do prazo sob controle AEROCAD.
9. **Confidencialidade:** NDA de 5 anos pós-término em todos os contratos.
10. **Responsabilidade técnica:** obrigação de MEIO (não de resultado) para processos sujeitos a análise de órgão regulador.

---

## 9. Representantes Padrão

| Função                                  | Nome                                  | Documento          |
| --------------------------------------- | ------------------------------------- | ------------------ |
| Signatária administrativa / Procuradora | **Jaqueline Mota de Freitas Saraiva** | CPF 005.417.801-07 |
| Coordenador de Projetos                 | **Cleyton Borges Saraiva**            | —                  |
| Responsável Técnico (Eng. Civil)        | **João Valmir Bigattão**              | CREA 124906/D-SP   |

---

## 10. Dados Bancários Institucionais

| Campo            | Valor                                   |
| ---------------- | --------------------------------------- |
| Banco            | INTER (077)                             |
| Agência          | 0001                                    |
| Conta Corrente   | 7637194-8                               |
| Favorecida       | AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA |
| CNPJ / Chave PIX | 28.036.597/0001-43                      |

---

_Documento consolidado em outubro/2026 · Versão viva — atualizar conforme novos templates sejam criados._
