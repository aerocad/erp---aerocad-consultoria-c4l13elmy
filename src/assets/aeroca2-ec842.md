# AEROCAD® — Pacote Completo Consolidado

> **Documento único consolidado** com a concatenação de todos os arquivos Markdown do pacote `AEROCAD_Pacote_Completo/`.
> Gerado em: 10 de outubro de 2026 · AEROCAD Terraplanagem e Construção Ltda. · CNPJ 28.036.597/0001-43

---

## Sumário

1. [PARTE 1 — README do Pacote](#parte-1--readme-do-pacote)
2. [PARTE 2 — Funcionalidades Desenvolvidas](#parte-2--funcionalidades-desenvolvidas)
3. [PARTE 3 — Instalação e Execução](#parte-3--instalação-e-execução)
4. [PARTE 4 — Catálogo Mestre de Templates](#parte-4--catálogo-mestre-de-templates)
5. [PARTE 5 — SKILL: aerocad-projetos](#parte-5--skill-aerocad-projetos)
   - [5.1 Referência: tipos de projeto](#parte-51--referência-tipos-de-projeto)
   - [5.2 Referência: documentos de suporte](#parte-52--referência-documentos-de-suporte)
6. [PARTE 6 — SKILL: aerocad-pdir](#parte-6--skill-aerocad-pdir)
   - [6.1 Referência: fluxo e nomenclatura PDIR](#parte-61--referência-fluxo-e-nomenclatura-pdir)
   - [6.2 Referência: fontes e convenções PDIR](#parte-62--referência-fontes-e-convenções-pdir)
   - [6.3 Referência: plantas PDIR](#parte-63--referência-plantas-pdir)
7. [PARTE 7 — SKILL: aerocad-rg-cni](#parte-7--skill-aerocad-rg-cni)

---

<br>

---

# PARTE 1 — README DO PACOTE

<sub>**Arquivo original:** `README.md`</sub>

---

# AEROCAD® — Pacote Completo de Funcionalidades

**Pacote auto-contido** com toda a infraestrutura de geração de documentos AEROCAD desenvolvida nesta conversa — scripts, skills, catálogo de templates e documentação de uso. Pode ser clonado para qualquer ambiente com Python 3.10+ e executado sem alterações.

**Autor:** AEROCAD Terraplanagem e Construção Ltda. · CNPJ 28.036.597/0001-43
**Data de consolidação:** 10 de outubro de 2026
**Mantenedor:** Cleyton Borges Saraiva · cleytonsaraiva@gmail.com

---

## Estrutura do Pacote

```
AEROCAD_Pacote_Completo/
├── README.md                        ← este arquivo (índice e visão geral)
├── FUNCIONALIDADES.md               ← lista exaustiva de TODAS as funcionalidades
├── INSTALACAO.md                    ← guia de instalação e execução em outro ambiente
├── docs/
│   └── CATALOGO_TEMPLATES.md        ← catálogo mestre de templates AEROCAD
├── scripts/                         ← 13 geradores Python + biblioteca base
│   ├── aerocad_base.py              ← biblioteca compartilhada (dependência de todos)
│   ├── gen_proposta_tecnica_alcoa_juruti.py
│   ├── gen_proposta_comercial_alcoa_juruti.py
│   ├── gen_pc_occ_maragogi.py
│   ├── gen_estudo_viabilidade_006_galpoes.py
│   ├── gen_contrato_paulo_victor_registro.py
│   ├── gen_pc_ricardo_lima_opea.py
│   ├── gen_pedido_compras_008_twr.py
│   ├── gen_pt_zurich_sbfl_ampliacao.py
│   ├── gen_pc_zurich_sbfl_ampliacao.py
│   ├── gen_pc_233_bruna_rodrigues_2opcoes.py
│   ├── gen_pc_zurich_sbvt_alteracao_cadastral.py
│   └── gen_pc_zurich_sbvt_opea_a330.py
├── skills/                          ← 3 skills AEROCAD portáveis
│   ├── aerocad-projetos/            ← SKILL.md + references + scripts
│   ├── aerocad-pdir/                ← SKILL.md + references + scripts + assets
│   └── aerocad-rg-cni/              ← SKILL.md
└── exemplos/                        ← pasta reservada para .docx de exemplo
```

---

## Guia Rápido

### 1. Instalar dependências

Ver [`INSTALACAO.md`](INSTALACAO.md).

```bash
pip install python-docx openpyxl Pillow
```

### 2. Executar um gerador

```bash
cd scripts/
python3 gen_pc_zurich_sbvt_opea_a330.py
# → gera /tmp/AEROCAD_Proposta_Comercial_45093_2026_Zurich_SBVT_OPEA_A330.docx
```

### 3. Usar as skills em outro ambiente Claude Code / Cowork

Copiar a pasta `skills/` para o diretório de skills do seu agente (`~/.claude/skills/` em configurações locais, ou o diretório equivalente da sua instalação).

---

## O Que Está Incluído

- **13 geradores de documentos** — propostas comerciais e técnicas, contratos, estudos de viabilidade, pedidos de compras, procurações
- **1 biblioteca-base** (`aerocad_base.py`) que concentra padrões visuais, cabeçalho/rodapé, cores, fontes e helpers reutilizáveis
- **3 skills portáveis** cobrindo todo o universo de documentos AEROCAD, PDIR específico e Relatório Gerencial CNI mensal
- **Catálogo mestre** com 17 tipos de projeto, convenções de nomenclatura, representantes padrão e dados bancários institucionais
- **Documentação completa** de instalação, uso e extensibilidade

---

## Documentos de Referência

| Arquivo                                                                | Finalidade                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| [`FUNCIONALIDADES.md`](FUNCIONALIDADES.md)                             | Lista exaustiva de TODAS as funcionalidades desenvolvidas |
| [`INSTALACAO.md`](INSTALACAO.md)                                       | Como instalar e rodar em outro ambiente                   |
| [`docs/CATALOGO_TEMPLATES.md`](docs/CATALOGO_TEMPLATES.md)             | Catálogo mestre dos templates AEROCAD                     |
| [`skills/aerocad-projetos/SKILL.md`](skills/aerocad-projetos/SKILL.md) | Skill universal AEROCAD                                   |
| [`skills/aerocad-pdir/SKILL.md`](skills/aerocad-pdir/SKILL.md)         | Skill específica para PDIR                                |
| [`skills/aerocad-rg-cni/SKILL.md`](skills/aerocad-rg-cni/SKILL.md)     | Skill específica para RG CNI                              |

---

## Licença de Uso

Pacote de uso interno AEROCAD®. Todos os scripts e documentos são propriedade intelectual da AEROCAD Terraplanagem e Construção Ltda.

<br>

---

# PARTE 2 — FUNCIONALIDADES DESENVOLVIDAS

<sub>**Arquivo original:** `FUNCIONALIDADES.md`</sub>

---

# AEROCAD — Lista Exaustiva de Funcionalidades Desenvolvidas

Documento de rastreabilidade completo de **todas** as funcionalidades, scripts, skills, documentos e artefatos criados ao longo da conversa que gerou este pacote. Nenhum item foi omitido.

Cada entrada traz: ID, nome, finalidade, arquivos relacionados, dependências e instrução de uso.

---

## A. INFRAESTRUTURA (biblioteca-base compartilhada)

### A.1 `aerocad_base.py`

**Finalidade:** biblioteca Python compartilhada por TODOS os geradores. Concentra identidade visual, helpers de layout, cabeçalho/rodapé institucional e primitivas de alto nível para construção dos documentos.

**Funções exportadas:**

- `make_doc()` — instancia novo `python-docx.Document` com margens, cabeçalho (logo AEROCAD) e rodapé institucional
- `title_block(doc, titulo, subtitulo)` — bloco de título laranja
- `heading(doc, texto)` — título de seção (laranja, bold, keep-with-next)
- `subheading(doc, texto)` — sub-seção
- `add_para(doc, texto, bold, italic, color, align, size, before, after)` — parágrafo formatado
- `kv_table(doc, pares, col0, col1)` — tabela chave-valor para identificação/dados cadastrais
- `signature_block(doc, name, title, reg, art, city_date)` — bloco de assinatura padrão
- `finalize_and_save(doc, out_path)` — aplica `keep_with_next`, salva e protege permissões
- `style_run(run, size, bold, italic, color)` — formatação de run
- `set_cell_shading(cell, hex)` — preenchimento colorido de célula
- `set_cell_borders(cell)` — bordas padrão
- `evitar_orfa_cabecalho(table)` — marca cabeçalho da tabela como "repetir no topo"
- `data_hoje_extenso()` — "Brasília – DF, 10 de outubro de 2026."

**Constantes:**
`ORANGE` (RGB), `ORANGE_HEX` (`FF6A13`), `GREY_LIGHT_HEX`, `GREY_DARK`, `BLACK`

**Localização no pacote:** `scripts/aerocad_base.py`

---

## B. GERADORES DE PROPOSTAS COMERCIAIS

### B.1 `gen_proposta_comercial_alcoa_juruti.py`

**ID:** PC 231/2026
**Cliente:** Alcoa Alumínio S.A. — Juruti/PA
**Escopo:** Avaliação de conformidade regulatória de Linhas de Transmissão em zonas de proteção aeroportuária.
**Destaques:**

- Marcos de pagamento vinculados a entregas técnicas
- Capítulo específico sobre AUTORIZAÇÃO × EXECUÇÃO das LTs
- NFS-e com vencimento 60 dias (regra Alcoa)
- Valor global R$ 87.300

### B.2 `gen_pc_occ_maragogi.py`

**ID:** PC 233/2026
**Cliente:** OCC Construções e Participações
**Projeto:** Aeroporto Costa dos Corais — Maragogi/AL
**Escopo:** 5 blocos AEROCAD (A=Estudo Torres CAB 33, B=PBZPA, C=Cartas, D=PANS-OPS, E=Laudos). Prazo 90 dias.
**Destaques:**

- 4 marcos financeiros M1-M4 (R$ 37.000 + 46.250 + 46.250 + 55.500 = R$ 185.000)
- Cronograma Gantt landscape 13 semanas × 10 atividades
- Tributação Alagoas (DIFAL, não contribuinte ICMS)
- §3.1 base cartográfica MGI_ARQ_PE_06_39 (planta do sítio)

### B.3 `gen_pc_ricardo_lima_opea.py`

**ID:** PC 234/2026
**Cliente:** Sr. Ricardo Lima — São Paulo/SP
**Escopo:** Pré-análise OPEA + Processo OPEA (condicional) — ICA 11-408/2020
**Valor:** R$ 4.000 (pré-análise) + R$ 6.000 (OPEA condicional) = R$ 10.000
**Pagamento:** Parcela única R$ 4.000 no aceite + 2 parcelas R$ 3.000 (fechamento + protocolo COMAER)

### B.4 `gen_pc_zurich_sbfl_ampliacao.py`

**ID:** PC 241/2026
**Cliente:** Zurich Airport Brasil — SBFL
**Projeto:** Ampliação PPD 14/32 com deslocamento CAB 32
**Escopo:** 4 módulos (A=Viabilidade AGA/ATM R$ 78.500, B=Regulatório R$ 47.700, C=PDIR R$ 56.500, D=Base Cartográfica RPA R$ 110.000)
**Valor global:** R$ 292.700 completo · R$ 182.700 sem Módulo D
**Destaques:**

- 13 marcos financeiros (M1-M13)
- Módulo D com RPA/drone (SARPAS/SISANT/BVLOS em ATZ)
- Alternativa reduzida (validação) R$ 22.000
- Estimativa firme ±10%
- Nova §3 detalhada com 8 sub-itens D.1-D.8

### B.5 `gen_pc_zurich_sbvt_alteracao_cadastral.py`

**ID:** PC 45.092/2026 (revisão atualizada da PC original 45.092/2025)
**Cliente:** Zurich Airport Brasil — SBVT (Vitória)
**Escopo:** Alteração Cadastral para operação regular do AIRBUS A330-300
**Valor:** R$ 31.100 (sem desconto, reajustado por IPCA ~7,5% maio/2025 → set/2026)
**Prazo:** 45 dias até protocolo SYSAGA
**Destaques:**

- Cronograma Gantt landscape 7 semanas × 9 atividades
- Nota de atualização explicitando critério de reajuste
- Contatos: Raphael Lerbach (primário) + Leonardo Arins (secundário)

### B.6 `gen_pc_zurich_sbvt_opea_a330.py`

**ID:** PC 45.093/2026
**Cliente:** Zurich Airport Brasil — SBVT
**Escopo:** Processo OPEA no COMAER para operação do A330-300 (penetrações PBZPA/PZPANA)
**Valor:** R$ 8.240 (medição única 100% no protocolo)
**Prazo:** 30 dias
**Atividades:**

1. Levantamento de dados com base na documentação do interessado
2. Análise de penetrações às superfícies PBZPA/PZPANA
3. Pré-análise e Processo OPEA COMAER (no que couber)

### B.7 `gen_pc_233_bruna_rodrigues_2opcoes.py`

**ID:** PC 233/2026 (rev. 2)
**Cliente:** Bruna Rodrigues — Cantá/RR
**Projeto:** Aeródromo Pouso da Águia (SWPD · CIAD RR0111)
**Escopo:** Viabilidade (R$ 8.000) + Registro (R$ 22.500) + **Projeto Executivo** da ampliação da PPD de 750×18 m para 1.300×23 m (R$ 85.000)
**Aeronave-crítica futura:** CESSNA C408 Sky Courier (PMD 8.618 kg)
**Valor global:** R$ 115.500 — Prazo total: 150 dias (Viabilidade sequencial + Registro e Projeto Executivo paralelos)
**Destaques:**

- 2 OPÇÕES de contratação: (1) 3 contratos independentes com 9 parcelas · (2) contrato único combinado com 6 parcelas
- Cronograma Gantt landscape 21 semanas × 18 atividades agrupadas em VIAB/REG/EXEC
- Preserva cronograma do documento original adaptado para 150 dias

---

## C. GERADORES DE PROPOSTAS TÉCNICAS

### C.1 `gen_proposta_tecnica_alcoa_juruti.py`

**ID:** PT 230/2026
**Cliente:** Alcoa Alumínio S.A. — Juruti
**Escopo técnico:** 6 etapas com 390 horas totais (verificação de conformidade regulatória de LTs + relatório final específico)
**Correlata:** PC 231/2026

### C.2 `gen_pt_zurich_sbfl_ampliacao.py`

**ID:** PT 240/2026
**Cliente:** Zurich Airport Brasil — SBFL
**Escopo:** detalhamento técnico dos 4 módulos da PC 241/2026 (A/B/C/D)
**Destaques:**

- 13 seções (apresentação, experiência aplicável, equipe-chave, quadro de aderência, normas, matriz de premissas, gestão)
- Cronograma Gantt **condensado em UMA ÚNICA página landscape** (20 semanas × 19 atividades incluindo Módulo D paralelo)
- Quadro de Aderência item a item com 19 linhas Atende/Atende Parcialmente

---

## D. GERADORES DE CONTRATOS E DOCUMENTOS ADMINISTRATIVOS

### D.1 `gen_contrato_paulo_victor_registro.py`

**Cliente:** Paulo Victor Freitas (pessoa física) — Cruz/CE
**Escopo:** Minuta de Contrato de Registro de Aeródromo Privado (sem Médio Porte na denominação após ajuste)
**Estrutura:** 11 cláusulas (qualificação das partes, objeto, obrigações, valor R$ 22.500, prazo 60 dias, responsabilidade técnica, referências legais, confidencialidade 5 anos, rescisão 20% multa, condições gerais, foro Brasília/DF)
**Destaques:**

- Cláusula 1ª §1º reconhece que o Estudo de Viabilidade já foi executado anteriormente (não gera novo faturamento)
- Bloco de assinatura 2×4 + bloco de 2 testemunhas
- Vinculado à PC AEROCAD nº 48.120/2026

### D.2 `gen_pedido_compras_008_twr.py`

**ID:** Pedido de Compras nº 008/2025
**Fornecedor:** TWR Consultoria Aeronáutica Ltda. (Eugênio Edison Silva) · CNPJ 49.421.197/0001-21
**Serviços contratados:**

1. FLN — PBZPA/PZPANA R$ 10.000
2. FLN — PDIR R$ 10.000
3. Central Garden (SE) — OPEA R$ 1.500
4. MEA — SDIA R$ 1.500
   **Total:** R$ 23.000 · PIX · Jaqueline Mota (assinatura comprador)

---

## E. GERADORES DE ESTUDOS TÉCNICOS

### E.1 `gen_estudo_viabilidade_006_galpoes.py`

**Projeto:** Estudo Comparativo de Viabilidade OPEA/SBFL para 2 áreas candidatas a Galpão Logístico
**Aeroporto:** SBFL — Hercílio Luz — Florianópolis/SC
**RT:** Eng. João Valmir Bigattão — CREA 124906/D-SP
**Destaques:**

- Consolida relatórios 006-001 (Galpão 1) e 006-002 (Galpão 2 Hospital)
- Galpão 1: governante radar_rampa, altura construível 9,44 m → NÃO RECOMENDADO para altura pretendida 14,80 m
- Galpão 2: governante dme_fln_rampa, altura construível 20,31 m → RECOMENDADO (100% da área comporta)
- 4 figuras embutidas (2 mapas por galpão)
- Tabela comparativa + discussão + recomendação técnica
- Bloco de assinatura sem menção a ART/RRT (específico do pedido)

---

## F. SKILLS AEROCAD (incluídas integralmente em `skills/`)

### F.1 `aerocad-projetos`

**Finalidade:** Skill universal para QUALQUER documento AEROCAD. Dispara para PC, Contrato, OS, Ata, Ofício, Memorial Descritivo, Memorial de Cálculo, Laudo, Parecer Técnico, Relatório Gerencial, EVT, Procuração, PAC, FNC, Requerimento ANAC/DECEA, Fatura, Recibo, Checklist, Cronograma Físico-Financeiro.
**Tipos de projeto cobertos:** OPEA, Heliponto, Registro de Aeródromo, PBZPA, PZPANA, PDIR, EVA, MOPS, PAC, Homologação, SDIA, Ofício Técnico.
**Localização:** `skills/aerocad-projetos/`
**Arquivos:** `SKILL.md` + pasta `references/` + pasta `scripts/`

### F.2 `aerocad-pdir`

**Finalidade:** Skill específica e exclusiva para o PLANO DIRETOR AEROPORTUÁRIO (PDIR) — relatório + plantas A0.
**Palavras-chave:** PDIR, caracterização atual, horizonte de planejamento, planta de implantação, planta geral, carimbo, legenda, quadro de distâncias declaradas, prancha A0, paper space, DXF/DWG, PGI, SBFL/FLN, SBSG/NAT, viewport, layout de plotagem.
**NÃO USAR para:** PBZPA/PZPANA ou outros documentos administrativos (esses usam `aerocad-projetos`).
**Localização:** `skills/aerocad-pdir/`
**Arquivos:** `SKILL.md` + `references/` + `scripts/` + `assets/`

### F.3 `aerocad-rg-cni`

**Finalidade:** Gera o Relatório Gerencial MENSAL do Heliponto SNAW / CEAMN (AEROCAD × Condomínio CEAMN) a partir das fotos da visita técnica.
**Dispara ao mencionar:** "Relatório Gerencial CNI", "RG CNI", "relatório CEAMN", "relatório mensal SNAW".
**Localização:** `skills/aerocad-rg-cni/`
**Arquivos:** `SKILL.md`

---

## G. DOCUMENTOS AVULSOS GERADOS (sem script — edição direta)

### G.1 Preenchimento de `AEROCAD_Estudo_Viabilidade_OPEA_SBFL_Galpão01.docx`

**Operação:** edição direta do docx uploaded via `python-docx` para preencher a tabela de caracterização.
**Dados preenchidos:**

- Empreendimento: Galpão Logístico — Galpão 1
- Município/UF: Florianópolis / SC
- Aeródromo: SBFL / FLN — Aeroporto Internacional Hercílio Luz
- Polígono: Galpão 1 — 2,6553 ha
- Responsável Técnico: Eng. João Valmir Bigattão — CREA 124906/D-SP (atualizado em segunda rodada)
- Bloco de assinatura final atualizado: João Valmir Bigattão / Engenheiro Civil — Responsável Técnico — CREA 124906/D-SP

---

## H. TEXTOS DE E-MAIL DE APRESENTAÇÃO (gerados em chat, sem assinatura)

Modelos de e-mail criados para encaminhamento de propostas:

1. **PC 233 Bruna Rodrigues** — Viabilidade + Registro Aeródromo (Cantá/RR)
2. **PC 45.092 Zurich SBVT** — Alteração Cadastral A330-300 (destinatário Raphael Lerbach)
3. **PC 45.093 Zurich SBVT** — Processo OPEA A330-300 (destinatário Raphael Lerbach)

**Estrutura padrão dos e-mails:**

- Assunto específico + nº da PC + objeto
- Saudação nominada
- Contexto/sequência
- Resumo do escopo em bullets (3-4 itens)
- Condições comerciais principais (valor, prazo, pagamento, validade)
- Nota sobre PC correlata (quando houver)
- Disposição para videoconferência + referência ao contato secundário
- Agradecimento e fechamento "Cordialmente,"
- SEM assinatura (vai no e-mail do remetente)

---

## I. CATÁLOGO MESTRE DE TEMPLATES

### I.1 `AEROCAD_Templates_Documentos.md`

**Finalidade:** Documento MD consolidado com toda a gama de templates AEROCAD organizados em 10 seções:

1. Padrão visual e codificação (identidade, convenções)
2. Comerciais e pré-contratuais (PC/PT/Carta)
3. Contratuais (Contrato/OS/Procuração/Pedido de Compras)
4. Técnicos de engenharia aeronáutica (EVA, OPEA, PBZPA, PZPANA, PDIR, Projeto Executivo, Cartas Aeronáuticas, PANS-OPS, Base Topográfica, Nota Técnica, Memoriais, Laudo)
5. Operacionais e de gestão (RG, Ata, Checklist, FNC, PAC, Cronograma, Requerimento)
6. Financeiros (Fatura, Recibo)
7. Tabela de 17 tipos de projeto com normativa principal
8. Skills AEROCAD
9. 10 convenções e boas práticas
10. Representantes padrão + dados bancários institucionais

**Localização:** `docs/CATALOGO_TEMPLATES.md`

---

## J. REGRAS E CONVENÇÕES CONSOLIDADAS (acumuladas na conversa)

### J.1 Regras globais aplicadas em todos os geradores

1. Data dos documentos sempre via `data_hoje_extenso()` — nunca hardcoded
2. Nunca encerrar página quebrando logo após título — usar `keep_with_next=True` em headings
3. `evitar_orfa_cabecalho(tbl)` em todas as tabelas
4. Numerar figuras e tabelas sequencialmente
5. RTs sem menção a ART quando não aplicável
6. Marcos de pagamento vinculados a ENTREGAS TÉCNICAS (não datas puras)
7. NFS-e emitida em 5 dias úteis após evento comprobatório
8. Vencimento: 30 dias (padrão) ou 60 dias (Alcoa)
9. ART/RRT no CREA por disciplina/documento, pelo RT da UF do empreendimento
10. Cronograma Gantt em página LANDSCAPE, com segregação de prazos AEROCAD × prazos de órgão público

### J.2 Nomenclatura padrão

- `AEROCAD_<PREFIXO>_<NÚMERO>_<ANO>_<CLIENTE>_<ESCOPO>_v<HHMMSS>.docx`
- Prefixos: PC, PT, CT/CTR, OS, AT, IGR, PR, FT/NF, RB, RG, MD/MC, LT/PT, FNC, PAC, NT, RQ, CHK

### J.3 Identidade visual

- Cor-marca: Safety Orange `#FF6A13`
- Fonte: Calibri 11 pt (padrão), 10 pt (tabelas), 9 pt (notas)
- A4 retrato (padrão); A4 paisagem para Gantt e plantas A0

### J.4 Representantes institucionais padrão

- **Jaqueline Mota de Freitas Saraiva** — CPF 005.417.801-07 — Signatária Administrativa / Procuradora
- **Cleyton Borges Saraiva** — Coordenador de Projetos
- **João Valmir Bigattão** — CREA 124906/D-SP — RT Engenheiro Civil

### J.5 Dados bancários institucionais

- Banco: INTER (077)
- Agência: 0001
- Conta Corrente: 7637194-8
- Favorecida: AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA
- CNPJ / Chave PIX: 28.036.597/0001-43

---

## K. CRONOLOGIA DA CONVERSA (ordem em que as funcionalidades foram criadas)

| #   | Momento                                                              | Funcionalidade  | Arquivo principal                                                                 |
| --- | -------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------- |
| 1   | PT/PC Alcoa Juruti — ajustes do capítulo de conformidade regulatória | PT 230 + PC 231 | `gen_proposta_tecnica_alcoa_juruti.py` + `gen_proposta_comercial_alcoa_juruti.py` |
| 2   | PC OCC Maragogi + planta MGI                                         | PC 233          | `gen_pc_occ_maragogi.py`                                                          |
| 3   | Preenchimento Estudo Viabilidade Galpão 01 SBFL                      | docx direto     | —                                                                                 |
| 4   | Consolidação Estudo Viabilidade Galpões 1 e 2                        | —               | `gen_estudo_viabilidade_006_galpoes.py`                                           |
| 5   | Minuta de Contrato Paulo Victor Registro Aeródromo                   | Contrato        | `gen_contrato_paulo_victor_registro.py`                                           |
| 6   | PC Ricardo Lima OPEA (São Paulo)                                     | PC 234          | `gen_pc_ricardo_lima_opea.py`                                                     |
| 7   | Pedido de Compras 008 TWR Consultoria                                | PedCompras 008  | `gen_pedido_compras_008_twr.py`                                                   |
| 8   | PT + PC Zurich SBFL Ampliação PPD 14/32 (RFQ)                        | PT 240 + PC 241 | `gen_pt_zurich_sbfl_ampliacao.py` + `gen_pc_zurich_sbfl_ampliacao.py`             |
| 9   | PC 233 Bruna Rodrigues (2 opções + Projeto Executivo)                | PC 233 rev2     | `gen_pc_233_bruna_rodrigues_2opcoes.py`                                           |
| 10  | PC Zurich SBVT Alt. Cadastral A330 (revisão)                         | PC 45.092 rev   | `gen_pc_zurich_sbvt_alteracao_cadastral.py`                                       |
| 11  | PC Zurich SBVT OPEA A330 (nova)                                      | PC 45.093       | `gen_pc_zurich_sbvt_opea_a330.py`                                                 |
| 12  | Catálogo mestre de templates MD                                      | Catálogo        | `docs/CATALOGO_TEMPLATES.md`                                                      |
| 13  | Pacote completo portável                                             | —               | pacote atual                                                                      |

---

_Nenhuma funcionalidade desenvolvida durante a conversa foi omitida desta lista. Todos os scripts referenciados estão disponíveis em `scripts/` deste pacote._

<br>

---

# PARTE 3 — INSTALAÇÃO E EXECUÇÃO

<sub>**Arquivo original:** `INSTALACAO.md`</sub>

---

# AEROCAD — Guia de Instalação e Execução

Este pacote foi desenhado para ser **portável**: basta copiar a pasta `AEROCAD_Pacote_Completo/` para qualquer máquina com Python 3.10+ e seguir os passos abaixo.

---

## 1. Requisitos

- **Python 3.10 ou superior** (`python3 --version`)
- **pip** atualizado
- Sistema operacional: Linux, macOS ou Windows (todos testados)
- ~100 MB de espaço em disco (para dependências e documentos gerados)

---

## 2. Instalação das dependências Python

Dentro de qualquer terminal:

```bash
pip install --upgrade pip
pip install python-docx openpyxl Pillow
```

**Dependências diretas:**

- `python-docx` — manipulação de arquivos .docx
- `openpyxl` — leitura/escrita de .xlsx (usado em geradores que importam dados de planilhas)
- `Pillow` — manipulação de imagens embarcadas nos documentos

**Dependências opcionais (apenas para alguns geradores que extraem dados de PDFs):**

```bash
# Linux (Debian/Ubuntu)
sudo apt-get install -y poppler-utils ghostscript libreoffice

# macOS (via Homebrew)
brew install poppler ghostscript libreoffice
```

---

## 3. Estrutura esperada após copiar o pacote

```
<diretório_destino>/
└── AEROCAD_Pacote_Completo/
    ├── README.md
    ├── FUNCIONALIDADES.md
    ├── INSTALACAO.md             ← este arquivo
    ├── docs/
    │   └── CATALOGO_TEMPLATES.md
    ├── scripts/
    │   ├── aerocad_base.py
    │   └── gen_*.py              ← 12 geradores
    ├── skills/
    │   ├── aerocad-projetos/
    │   ├── aerocad-pdir/
    │   └── aerocad-rg-cni/
    └── exemplos/
```

---

## 4. Executando um gerador

### 4.1 Observação importante — ajuste do `sys.path`

Todos os geradores no diretório `scripts/` começam com:

```python
import sys
sys.path.insert(0, '/sessions/vigilant-hopeful-cray/mnt/outputs')
```

Esse caminho é específico do ambiente onde o pacote foi gerado. **Antes de rodar em outro ambiente**, edite cada script e aponte para o caminho real da pasta `scripts/` da sua máquina — ou use a alternativa portável abaixo.

### 4.2 Alternativa portável (recomendada)

Substitua o `sys.path.insert(...)` de cada script por:

```python
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
```

Ou, equivalentemente, rode cada script a partir do diretório `scripts/`:

```bash
cd AEROCAD_Pacote_Completo/scripts/
python3 gen_pc_zurich_sbvt_opea_a330.py
```

### 4.3 Caminho de saída

Os geradores salvam o `.docx` em `/tmp/`. Para redirecionar o output, edite a variável `OUT` no topo de cada script:

```python
OUT = "/tmp/AEROCAD_Proposta_Comercial_45093_2026_Zurich_SBVT_OPEA_A330.docx"
# → mude para o caminho desejado, por exemplo:
OUT = "./saida/AEROCAD_PC_45093.docx"
```

---

## 5. Instalando as skills em outro ambiente Claude

As skills AEROCAD são compatíveis com qualquer agente Claude que suporte o formato `SKILL.md` (Claude Code, Cowork, Claude Agent SDK).

### 5.1 Localização padrão de skills por aplicativo

| Aplicativo                | Diretório de skills                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------- |
| **Claude Code (local)**   | `~/.claude/skills/`                                                                    |
| **Claude Code (projeto)** | `<repo>/.claude/skills/`                                                               |
| **Cowork (desktop)**      | gerenciado pela instalação; copie para o diretório indicado em `claude plugin install` |
| **Claude Agent SDK**      | passar via parâmetro `skills_dir` ao instanciar o agente                               |

### 5.2 Como copiar

```bash
# Linux / macOS
cp -r AEROCAD_Pacote_Completo/skills/aerocad-projetos  ~/.claude/skills/
cp -r AEROCAD_Pacote_Completo/skills/aerocad-pdir      ~/.claude/skills/
cp -r AEROCAD_Pacote_Completo/skills/aerocad-rg-cni    ~/.claude/skills/

# Windows (PowerShell)
Copy-Item -Recurse AEROCAD_Pacote_Completo\skills\aerocad-projetos  $HOME\.claude\skills\
Copy-Item -Recurse AEROCAD_Pacote_Completo\skills\aerocad-pdir      $HOME\.claude\skills\
Copy-Item -Recurse AEROCAD_Pacote_Completo\skills\aerocad-rg-cni    $HOME\.claude\skills\
```

### 5.3 Verificando se as skills foram carregadas

Dentro de um agente Claude com acesso ao tool `Skill`, pergunte:

> _Quais skills AEROCAD estão disponíveis?_

A resposta deve listar `aerocad-projetos`, `aerocad-pdir` e `aerocad-rg-cni` com suas descrições.

---

## 6. Verificação de integridade

Após instalar, rode o teste de smoke abaixo (deve gerar os 12 docx em `/tmp/` ou no diretório configurado):

```bash
cd AEROCAD_Pacote_Completo/scripts/
for s in gen_*.py; do
  echo ">>> $s"
  python3 "$s" || echo "    FALHOU: $s"
done
```

Esperado: `[OK] gerado: <caminho>` para cada script, sem exceções.

---

## 7. Atualização e manutenção

### 7.1 Adicionar um novo gerador

1. Criar `scripts/gen_<nome>.py` seguindo o padrão dos existentes (importar de `aerocad_base`)
2. Adicionar entrada no `FUNCIONALIDADES.md` (seção B, C ou D conforme o tipo)
3. Atualizar o catálogo `docs/CATALOGO_TEMPLATES.md` se o template for novo

### 7.2 Modificar a identidade visual (cor-marca, logo, cabeçalho)

- Editar diretamente `scripts/aerocad_base.py` — a mudança propaga para todos os geradores

### 7.3 Atualizar uma skill

- Editar o `SKILL.md` dentro de `skills/<nome>/` e reinstalar no agente

---

## 8. Suporte / Troubleshooting

| Problema                              | Causa provável                                   | Solução                                                                          |
| ------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `ModuleNotFoundError: aerocad_base`   | `sys.path` apontando para caminho antigo         | Ajustar `sys.path.insert(...)` para a pasta `scripts/` real (ver §4.1-4.2)       |
| `PermissionError` ao salvar           | Diretório `/tmp/` sem permissão de escrita       | Mudar `OUT` para outro caminho (ver §4.3)                                        |
| Fonte Calibri não aparece no Linux    | Fonte proprietária não instalada                 | `sudo apt-get install -y ttf-mscorefonts-installer` ou usar substituta (Carlito) |
| Logo AEROCAD não aparece no cabeçalho | Imagem referenciada no `aerocad_base.py` ausente | Verificar caminho da imagem no `aerocad_base.py` e ajustar se necessário         |
| Skills não disparam no Claude         | Diretório errado ou SKILL.md inválido            | Verificar §5.3 e revisar o frontmatter de cada `SKILL.md`                        |

---

## 9. Contato

Dúvidas, pedidos de novos templates ou suporte:
**Cleyton Borges Saraiva** · cleytonsaraiva@gmail.com · AEROCAD® Consultoria & Aeroportos

<br>

---

# PARTE 4 — CATÁLOGO MESTRE DE TEMPLATES

<sub>**Arquivo original:** `docs/CATALOGO_TEMPLATES.md`</sub>

---

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

<br>

---

# PARTE 5 — SKILL: aerocad-projetos

<sub>**Arquivo original:** `skills/aerocad-projetos/SKILL.md`</sub>

---

---

name: aerocad-projetos
description: |
Use esta skill SEMPRE para qualquer documento da Aerocad Consultoria & Aeroportos: Proposta Comercial, Contrato, Ordem de Serviço interna, Ata de Reunião, Ofício, Memorial Descritivo, Memorial de Cálculo, Laudo/Parecer Técnico, Relatório Gerencial, EVT, Procuração, Plano de Ação Corretiva, Ficha de Não Conformidade, Requerimento ANAC/DECEA, Fatura, Recibo, Checklist de Inspeção, Cronograma Físico-Financeiro. Tipos de projeto: OPEA, Heliponto, Registro de Aeródromo, PBZPA/PZPANA, PDIR, EVA, MOPS, PAC, Homologação, SDIA, Ofício Técnico. Dispare ao mencionar: novo cliente, orçamento, número PC, ANAC, RBAC, DECEA, COMAER, aeródromo, heliponto, obstáculo, contrato, ata, laudo, parecer, memorial, requerimento, fatura, recibo, não conformidade, checklist, cronograma.

---

# Aerocad — Geração de Documentos de Projetos Aeronáuticos

> **Versão 2.0 — Identidade Visual 2026.** Cor Safety Orange `#FF6A13`, logo `aerocad_logo_2026.png` (5718×1158 px), endereço `Ed. Prime Business Convenience`. Todo docx gerado deve incluir `doNotAutoCompressPictures` + `defaultImageDpi=1200` — ver seção 6-A.

Especialista em projetos aeroportuários da **Aerocad Consultoria & Aeroportos**. Esta skill automatiza a geração de todos os 20 tipos de documentos do portfólio da empresa.

---

## 1. DADOS FIXOS DA AEROCAD

```
Razão Social : Aerocad Terraplanagem e Construção Ltda
Nome Fantasia: Aerocad Consultoria & Aeroportos
CNPJ         : 28.036.597/0001-43  |  CF/DF: 07.815.970/001-59
Endereço     : SBS Quadra 2, Sala 206, Sobreloja, Ed. Prime Business Convenience, CEP 70.070-120, Brasília-DF
Telefone     : +55 61 9 8462-8800  |  contato@aerocad.com.br  |  www.aerocad.com.br
Representante: JAQUELINE MOTA DE FREITAS SARAIVA — CPF 005.417.801-07

Dados Bancários:
  Banco INTER (077) | Ag. 0001 | CC 7637194-8
  PIX: CNPJ 28.036.597/0001-43
  Favorecida: Aerocad Terraplanagem e Construção Ltda

Taxa Técnica 2026: R$ 217,80/h  |  ART/RRT: R$ 4.900–R$ 7.580
```

---

## 2. WORKFLOW PADRÃO

### Passo 1 — Identificar o documento e coletar dados

Use AskUserQuestion para as informações variáveis. O conjunto mínimo depende do tipo:

**Todos os documentos:**

- Número sequencial (ex: 001/2026), data de emissão, cliente/empreendimento, município-UF

**Proposta Comercial:** PC Nº, tipo(s) de serviço, valor, prazo, condições de pagamento
**Contrato:** CNPJ/CPF + endereço + representante do contratante, referência à proposta aprovada
**OS Interna:** dados do prestador (CREA/CAU, CPF, PIX/banco), valor interno (CONFIDENCIAL), gestor Aerocad
**Ata:** participantes, pauta, tópicos discutidos com decisões, encaminhamentos/action items
**Ofício:** destinatário (nome, cargo, órgão, cidade-UF), assunto, corpo do texto
**Memorial Descritivo:** disciplina, empreendimento/ICAO, responsável técnico, seções técnicas
**Memorial de Cálculo:** disciplina, software, premissas, cargas, critérios normativos
**Laudo/Parecer:** tipo (laudo/parecer/vistoria), solicitante, data de vistoria, objeto examinado
**Relatório Gerencial:** empreendimento/ICAO, contratante, mês de referência, atividades e achados
**EVT:** tipo de instalação, aeronave de projeto, MTOW, coordenadas ARP, altitude
**Procuração:** dados do outorgante, órgão e objeto de representação
**PAC Corretivo:** origem (auto ANAC/auditoria/vistoria), requisito violado, causa raiz, ações
**FNC:** setor inspecionado, descrição do achado, severidade, ação recomendada
**Requerimento:** autoridade/órgão, assunto, fatos, fundamentação normativa, pedido
**Fatura:** nº da fatura, vencimento, referência contratual, serviços prestados, valores, impostos
**Recibo:** valor, parcela vinculada, forma de pagamento, referência contratual
**Checklist:** tipo de inspeção, data, inspetor, condições meteorológicas
**Cronograma:** atividades, pesos %, valores, meses de execução

### Passo 2 — Selecionar template e escopo padrão

- Para Propostas: leia `references/tipos_projeto.md` para escopos, prazos e valores
- Para todos os outros documentos: leia `references/documentos_suporte.md` — contém estrutura completa, placeholders e instruções de geração de cada template

### Passo 3 — Gerar o documento

**Propostas Comerciais e OS:** use `scripts/gerador.py` como base, adapte o CONFIG e execute.
**Todos os demais (17 tipos):** fluxo unpack → editar XML → pack → PDF:

```bash
python3 UNPACK "TEMPLATES/01 - Documentos/AEROCAD_Template_Xxx.docx" outputs/doc_unpacked/
# editar word/document.xml com substituições de placeholders
python3 PACK outputs/doc_unpacked/ outputs/AEROCAD_XX_001_2026_Cliente.docx \
  --original "TEMPLATES/01 - Documentos/AEROCAD_Template_Xxx.docx" --validate false
python3 SOFFICE --headless --convert-to pdf --outdir outputs/ arquivo.docx
```

Sempre aplicar `fix_pt(doc)` do pt_fix.py antes de salvar o document.xml.

### Passo 4 — Entregar

Links `computer://` para DOCX e PDF em:
`C:\Users\aeroc\AppData\Roaming\Claude\local-agent-mode-sessions\59414fe7-3c5e-4202-af5f-38bd8ef36f2f\b9d3855e-b1b3-4e24-9ce2-8b127bf746e5\local_1667b9df-6b0f-435a-93b2-9c717bb555dc\outputs\`

---

## 3. CATÁLOGO COMPLETO DE DOCUMENTOS

### Documentos Word (.docx)

| Código      | Tipo de Documento        | Template                                          | Uso                                |
| ----------- | ------------------------ | ------------------------------------------------- | ---------------------------------- |
| AEROCAD-PC  | Proposta Comercial       | AEROCAD_Template_Proposta_Comercial.docx          | Orçamento ao cliente               |
| AEROCAD-CT  | Contrato OPEA            | AEROCAD_Template_Contrato_OPEA.docx               | Contrato serviços OPEA             |
| AEROCAD-CT  | Contrato Registro AD     | AEROCAD_Template_Contrato_Registro_Aerodromo.docx | Contrato registro aeródromo        |
| AEROCAD-OS  | Ordem de Serviço         | AEROCAD_Template_Ordem_de_Servico.docx            | Instrução interna a prestador      |
| AEROCAD-AT  | Ata de Reunião           | AEROCAD_Template_Ata_de_Reuniao.docx              | Registro de reuniões               |
| AEROCAD-EVT | Est. Viabilidade Técnica | AEROCAD_Template_Estudo_Viabilidade_Tecnica.docx  | Estudo técnico preliminar          |
| AEROCAD-OF  | Ofício                   | AEROCAD_Template_Oficio.docx                      | Correspondência a órgãos           |
| AEROCAD-MD  | Memorial Descritivo      | AEROCAD_Template_Memorial_Descritivo.docx         | Descrição técnica de projeto       |
| AEROCAD-MC  | Memorial de Cálculo      | AEROCAD_Template_Memorial_de_Calculo.docx         | Memória de dimensionamento         |
| AEROCAD-LT  | Laudo/Parecer Técnico    | AEROCAD_Template_Laudo_Parecer_Tecnico.docx       | Laudos e vistorias                 |
| AEROCAD-RG  | Relatório Gerencial      | AEROCAD_Template_Relatorio_Gerencial.docx         | Relatório mensal O&M               |
| AEROCAD-PR  | Procuração               | AEROCAD_Template_Procuracao.docx                  | Outorga de poderes à Jaqueline     |
| AEROCAD-PAC | Plano de Ação Corretiva  | AEROCAD_Template_Plano_Acao_Corretiva.docx        | Resposta a autos/não conformidades |
| AEROCAD-FNC | Ficha Não Conformidade   | AEROCAD_Template_Ficha_Nao_Conformidade.docx      | Registro de achados                |
| AEROCAD-RQ  | Requerimento ANAC/DECEA  | AEROCAD_Template_Requerimento_ANAC_DECEA.docx     | Petições administrativas           |
| AEROCAD-FT  | Fatura                   | AEROCAD_Template_Fatura.docx                      | Cobrança de parcelas               |
| AEROCAD-RC  | Recibo                   | AEROCAD_Template_Recibo.docx                      | Quitação de pagamento              |

### Planilhas Excel (.xlsx)

| Código      | Tipo                         | Template                                           | Uso                        |
| ----------- | ---------------------------- | -------------------------------------------------- | -------------------------- |
| AEROCAD-CL  | Checklist de Inspeção        | AEROCAD_Template_Checklist_Inspecao.xlsx           | Inspeção técnica periódica |
| AEROCAD-CFF | Cronograma Físico-Financeiro | AEROCAD_Template_Cronograma_Fisico_Financeiro.xlsx | Planejamento de obras      |

---

## 4. CATÁLOGO DE SERVIÇOS (resumo — detalhes em tipos_projeto.md)

| Cód       | Serviço                           | Prazo       | Faixa R$       | Norma           |
| --------- | --------------------------------- | ----------- | -------------- | --------------- |
| OPEA      | Objeto Projetado no Espaço Aéreo  | 20 dias     | 5.000–8.500    | ICA 11-408      |
| HEL-SOLO  | Heliponto no Solo — completo      | 180 dias    | 55.000–75.000  | RBAC 155        |
| HEL-ELEV  | Heliponto Elevado (rooftop)       | 180 dias    | 25.000–35.000  | RBAC 155        |
| EVA       | Estudo de Viabilidade Aeronáutica | 30 dias     | 10.000–18.000  | RBAC 153        |
| REG-AD    | Registro de Aeródromo Privado     | 180 dias    | 15.000–45.000  | RBAC 153        |
| PBZPA     | PBZPA + PZPANA regional           | 90 dias     | 35.000–55.000  | RBAC 161        |
| PBZPA-I   | PBZPA + PZPANA internacional      | 90 dias     | 80.000–120.000 | RBAC 161        |
| PDIR      | Plano Diretor regional            | 60 dias     | 45.000–65.000  | RBAC 153        |
| PDIR-I    | Plano Diretor internacional       | 90 dias     | 52.000–95.000  | RBAC 153        |
| PDIR-PACK | PDIR+PBZPA+PZPANA (pacote)        | 90–120 dias | 70.000–220.000 | RBAC 153+161    |
| EST-AERO  | Estudo Aeronáutico                | 30–45 dias  | 6.000–25.000   | DECEA/SITAR     |
| SDIA      | Cancelamento Obstáculos/SDIA      | 10 dias     | 4.000–22.500   | SDIA/DECEA      |
| DOC-TEC   | Documento Técnico/Ofício          | 10 dias     | 10.000–15.000  | ANAC/Prefeitura |
| MOPS      | Manual de Operações               | 45 dias     | 12.000–20.000  | RBAC 153        |
| PAC-CT    | Plano de Ação de Contingência     | 60 dias     | 15.000–25.000  | ICA 63-17       |
| HOMO      | Homologação de Aeródromo          | 180 dias    | 60.000–120.000 | RBAC 153        |

---

## 5. INFRAESTRUTURA TÉCNICA

### Resolução de caminhos (independente de sessão)

```python
import glob

def _find(pat):
    r = glob.glob(pat); return r[0] if r else None

TEMPLATES = _find('/sessions/*/mnt/TEMPLATES AEROCAD 2026/')
OUTPUTS   = _find('/sessions/*/mnt/outputs/')
SKILLS    = _find('/sessions/*/mnt/.claude/skills/docx/scripts/office/')

DIR_COMERCIAL   = TEMPLATES + '01 - Documentos/01.1 - Comercial/'
DIR_TECNICO     = TEMPLATES + '01 - Documentos/01.2 - Tecnico/'
DIR_REGULATORIO = TEMPLATES + '01 - Documentos/01.3 - Regulatorio/'
DIR_GESTAO      = TEMPLATES + '01 - Documentos/01.4 - Gestao/'
DIR_PLANILHAS   = TEMPLATES + '02 - Planilhas/'
DIR_MARCA       = TEMPLATES + '03 - Ativos de Marca/'
DIR_EMITIDOS    = TEMPLATES + '04 - Documentos Emitidos/2026/'
LOGO            = DIR_MARCA + 'aerocad_logo_2026.png'
PACK, UNPACK, SOFFICE = SKILLS+'pack.py', SKILLS+'unpack.py', SKILLS+'soffice.py'
```

Se TEMPLATES for None → solicitar via `mcp__cowork__request_cowork_directory`.

### Nomenclatura de saída (padrão 2026)

```
AEROCAD_[TIPO]-[NNN]_[AAAA]_[SIGLA-PROJETO].[ext]

Exemplos:
  AEROCAD_AT-001_2026_PDIR-NAT.docx
  AEROCAD_PC-007_2026_HEL-VCP.docx
  AEROCAD_CT-003_2026_OPEA-BSB.docx
  AEROCAD_FT-004_2026_ZAB-NAT.docx
  AEROCAD_CL-001_2026_SBGL.xlsx
```

| Sigla | Documento            | Sigla | Documento              |
| ----- | -------------------- | ----- | ---------------------- |
| AT    | Ata de Reunião       | PC    | Proposta Comercial     |
| CT    | Contrato             | OF    | Ofício                 |
| MD    | Memorial Descritivo  | MC    | Memorial de Cálculo    |
| LT    | Laudo/Parecer        | RG    | Relatório Gerencial    |
| RQ    | Requerimento         | FT    | Fatura                 |
| OS    | Ordem de Serviço     | RC    | Recibo                 |
| PAC   | Plano Ação Corretiva | FNC   | Ficha Não Conformidade |
| EVT   | Est. Viabilidade     | PR    | Procuração             |
| CL    | Checklist            | CFF   | Cronograma Fís.-Fin.   |

### DST sem PermissionError

```python
base = f'{OUTPUTS}doc_{slug}'
i = 1
while os.path.exists(f'{base}_{i}_unpacked'): i += 1
DST = f'{base}_{i}_unpacked'
```

### Regras críticas

- Escapar XML: `xe()` — `&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;`
- Sem backslash em f-strings Python 3.10+
- Tabelas docx-js: `WidthType.DXA`, largura dupla, `ShadingType.CLEAR`
- Planilhas: openpyxl; não depender de recalc automático
- Salvar sempre em `DIR_EMITIDOS`

---

## 6. PALETA AEROCAD

```
Laranja   : FF6A13  |  Cinza texto: 595959  |  Fundo label: F2F2F2
Borda     : BFBFBF  |  Linha alt 1: FFEDD9  |  Linha alt 2: FFF6EC
Preto     : 0B0B0C  |  Branco off  : F4F1EC  (Manual Marca 2026)
```

Fonte: Arial, 11pt (sz=22). Logo disponível em LOGO (aerocad_logo_2026.png — 5718×1158 px, aspecto 4,94:1).

---

## 6-A. NITIDEZ DO LOGO EM PDF (obrigatório)

Todo docx gerado por esta skill DEVE ter em `word/settings.xml`:

```xml
<w:doNotAutoCompressPictures/>
<w14:defaultImageDpi w14:val="1200"/>
```

Impede o Word de comprimir imagens ao exportar PDF (nitidez preservada).

**Dimensões oficiais do logo no cabeçalho:**

- Largura: **4,5 cm** · Altura: **0,911 cm** · Aspecto 4,94:1
- EMU (para XML): `cx="1620000"` `cy="327960"`
- PNG: `DIR_MARCA + 'aerocad_logo_2026.png'` (5718×1158 px, ~624 KB, 8K)

**Snippet obrigatório após empacotar cada docx:**

```python
import zipfile, re, shutil, os
def patch_pdf_quality(docx_path):
    tmp = docx_path + '.tmp'
    with zipfile.ZipFile(docx_path,'r') as zin, zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED) as zout:
        for it in zin.infolist():
            data = zin.read(it.filename)
            if it.filename == 'word/settings.xml':
                t = data.decode('utf-8','ignore')
                if 'doNotAutoCompressPictures' not in t:
                    t = re.sub(r'(</w:settings>)', '<w:doNotAutoCompressPictures/>\\1', t)
                if 'w14:defaultImageDpi' in t:
                    t = re.sub(r'<w14:defaultImageDpi w14:val="\d+"/>',
                               '<w14:defaultImageDpi w14:val="1200"/>', t)
                else:
                    t = re.sub(r'(</w:settings>)', '<w14:defaultImageDpi w14:val="1200"/>\\1', t)
                data = t.encode('utf-8')
            zout.writestr(it, data)
    shutil.copy(tmp, docx_path);
    try: os.remove(tmp)
    except: pass
```

Chame `patch_pdf_quality(out)` sempre após montar o docx e antes de exportar PDF.

**Regra global:** todo documento produzido daqui pra frente segue a IDENTIDADE VISUAL AEROCAD 2026 (esta seção + paleta atualizada + logo novo). Documentos com marca antiga devem ser regenerados.

---

## 7. AJUSTES RÁPIDOS (sem perguntar)

- Mudar valor → atualiza variável e recalcula total
- Mudar prazo → atualiza tabela e Gantt
- Mudar pagamento → atualiza seção de condições
- Mudar município/cliente → atualiza todas as referências
- Adicionar serviço → novo item no escopo + Gantt se prazo ≥ 15 dias
- Exportar PDF → executa soffice.py após DOCX
- Fatura após contrato → reutilizar dados do contrato já gerado
- Adicionar participante à ata → substituir `[NOME PARTICIPANTE N]` / `[EMPRESA N]` / `[CARGO N]`

<br>

---

# PARTE 5.1 — Referência: tipos de projeto

<sub>**Arquivo original:** `skills/aerocad-projetos/references/tipos_projeto.md`</sub>

---

# Catálogo Completo de Tipos de Projeto — Aerocad 2026

Taxa técnica vigente: R$ 217,80/h | ART/RRT: R$ 4.900–R$ 7.580 | Reajuste anual: ~10%

---

## OPEA — Objeto Projetado no Espaço Aéreo

**Norma:** ICA 11-408 (DECEA/CINDACTA)
**Descrição:** Avaliação e condução do processo de autorização de Objetos Projetados no Espaço Aéreo — edificações, torres, antenas, painéis fotovoltaicos, etc.

### OPEA Simples (edificação privada fora de sítio aeroportuário)

**Atividades:**

1. Análise prévia (pré-análise) do empreendimento junto ao CINDACTA regional
2. Elaboração e protocolo do processo OPEA conforme ICA 11-408
3. Acompanhamento da análise até decisão final do DECEA
4. Emissão de ART do responsável técnico

**Entregáveis:** Processo OPEA completo (PDF) | ART (PDF) | Ofício de anuência ou dispensa (PDF)
**Prazo:** 20 dias corridos | **Faixa:** R$ 5.000 – R$ 8.075
**Pagamento padrão:** Parcela 1 na assinatura / Parcela 2 na apresentação do protocolo DECEA

### OPEA em Sítio Aeroportuário (complexo FV / instalações em aeroporto)

**Prazo:** 20 dias | **Faixa:** R$ 6.000 – R$ 7.000
**Obs.:** Maior complexidade — requer coordenação direta com o operador aeroportuário

### OPEA Múltiplos Empreendimentos (pacote — preço por unidade)

**Prazo:** 30 dias | **Faixa:** R$ 7.000 – R$ 8.500 por empreendimento
**Obs.:** Aplicar desconto de escala para 3+ empreendimentos da mesma construtora

---

## HEL-SOLO — Heliponto no Solo

**Norma:** RBAC 155/2018, RBAC 153
**Aeronave típica:** MTOW ≥ 4 t (corporativo, hospitalar)

### Projeto + Registro Completo

**Atividades:**

1. Estudo Preliminar — análise de localização, espaço aéreo e obstáculos (R$ 8.000)
2. Anteprojeto — geometria, pavimentação, sinalizações horizontais (R$ 15.000)
3. Projeto Executivo — detalhamento completo, especificações técnicas (R$ 25.000)
4. Registro junto ao COMAER/ANAC — processo administrativo completo (R$ 17.000)

**Entregáveis:** Projeto completo (PDF/DWG) | Memorial descritivo | Manual de operações | ART | Certidão de registro ANAC
**Prazo:** 180 dias corridos | **Faixa:** R$ 55.000 – R$ 75.000
**Pagamento padrão:** 4 parcelas por fase (Preliminar / Anteprojeto / Executivo / Registro)

### Somente Registro COMAER/ANAC (projeto já existente)

**Prazo:** 90 dias | **Faixa:** R$ 12.000 – R$ 20.000

---

## HEL-ELEV — Heliponto Elevado (Rooftop / Cobertura)

**Norma:** RBAC 155/2018 | **MTOW típico:** ≤ 2 t

### Projeto + Registro Completo

**Atividades:**

1. Sinalização horizontal (pintura e marcações) — R$ 1.500
2. Equipamentos operacionais e Manual de Operações — R$ 3.000
3. Registro junto ao COMAER/ANAC — R$ 18.000
4. Estudo Aeronáutico (se exigido pelo DECEA) — cotado à parte: R$ 7.000–R$ 9.000

**Entregáveis:** Projeto de sinalização (PDF/DWG) | Manual de operações | ART | Certidão ANAC
**Prazo:** 180 dias corridos | **Faixa:** R$ 25.000 – R$ 35.000
**Estudo Aeronáutico adicional:** R$ 6.000 – R$ 9.000 / 30 dias (verificar exigência DECEA)

---

## EVA — Estudo de Viabilidade Aeronáutica

**Norma:** RBAC 153, ICA 11-408
**Atividades:**

1. Levantamento de dados e análise do sítio aeroportuário
2. Verificação das restrições ao espaço aéreo e PBZPA
3. Análise de obstáculos e compatibilidade com voos IFR/VFR
4. Elaboração do Estudo de Viabilidade Aeronáutica conforme ICA 11-408
5. Relatório técnico conclusivo com memorial descritivo
6. Suporte técnico durante análise pela ANAC

**Entregáveis:** Relatório EVA (PDF) | Memorial descritivo (PDF) | ART (PDF)
**Prazo:** 30 dias | **Faixa:** R$ 10.000 – R$ 18.000
**Pagamento padrão:** 50% no aceite / 50% na entrega do relatório

---

## REG-AD — Registro de Aeródromo Privado (Existente / Regularização)

**Norma:** RBAC 153, RBAC 157
**Atividades:**

1. Análise de documentação existente e diagnóstico técnico
2. Levantamento topográfico do sítio aeroportuário
3. Elaboração da documentação técnica para registro (RBAC 157)
4. Elaboração de plantas, memorial descritivo e PBZPA
5. ART do responsável técnico junto ao CREA
6. Processo de Abertura ao Tráfego Aéreo
7. Acompanhamento junto à ANAC até publicação do parecer favorável
8. Validação do PBZPA junto ao COMAER

**Entregáveis:** Documentação técnica completa (PDF) | Plantas (PDF/DWG) | PBZPA | ART | Protocolo ANAC
**Prazo:** 180 dias | **Faixa:** R$ 15.000 – R$ 22.000
**Composição típica:** PBZPA + Estudo OPEA R$ 10k + Proc. COMAER R$ 3k + ANAC/SDIA R$ 3k + desp. R$ 2k
**Pagamento padrão:** entrada no aceite / protocolo ANAC / publicação do parecer

### REG-AD-N — Aeródromo Novo (implantação + licença + registro)

**Prazo:** 270 dias | **Faixa:** R$ 25.000 – R$ 45.000
**Inclui:** Estudos de viabilidade + PBZPA + PZPANA + processo ANAC/COMAER completo

---

## EVAP — EVA + Registro (Pacote Completo)

Combinação dos serviços EVA e REG-AD em proposta única com itens separados.
**Prazo:** 30 dias (EVA) + 180 dias (Registro) — podendo ser sobrepostos
**Pagamento:** Definir por item separadamente

---

## PBZPA / PZPANA — Planos de Zona de Proteção

**Norma:** RBAC 161, RBHA 77
**Atividades:**

1. Levantamento aerofotogramétrico e análise do entorno
2. Cálculo das superfícies limitadoras de obstáculos (RBHA 77)
3. Elaboração do PBZPA com delimitação de zonas de proteção
4. Elaboração do PZPANA (Plano de Zona de Proteção e Aproximação de Navegação Aérea)
5. Levantamento e cadastro de obstáculos existentes
6. Protocolo junto à prefeitura, ANAC e COMAER

### Aeroporto Regional (pista 1.500–2.800 m)

**Horas:** ~210h × R$ 217,80/h | **Prazo:** 90 dias | **Faixa:** R$ 35.000 – R$ 55.000

### Aeroporto Internacional (pista > 2.800 m)

**Horas:** ~260h (PBZPA 120h + PZPANA 90h + levantamento 50h) | **Prazo:** 90 dias
**Faixa:** R$ 80.000 – R$ 120.000 (+ despesas ~R$ 25.980)

---

## PDIR — Plano Diretor Aeroportuário

**Norma:** RBAC 153 | **Inclui:** ART R$ 4.900–R$ 7.580

### Aeroporto Regional (até 5 Mpax/ano)

**Horas:** ~240h × R$ 217,80/h | **Prazo:** 60 dias | **Faixa:** R$ 45.000 – R$ 65.000

### Aeroporto Internacional (> 5 Mpax/ano)

**Horas:** ~360h × R$ 217,80/h + ART R$ 7.580 | **Prazo:** 90 dias
**Faixa:** R$ 52.000 – R$ 95.000

---

## PDIR-PACK — PDIR + PBZPA + PZPANA (Pacote Integrado)

### Regional

**Horas:** ~350h × R$ 217,80/h + despesas | **Prazo:** 90 dias
**Faixa:** R$ 70.000 – R$ 100.000
**Ref. real:** Orç. 45.093/2025 — SBSG (R$ 83.200)

### Internacional

**Horas:** ~570h × R$ 217,80/h + ART R$ 7.580 + despesas R$ 25.980 | **Prazo:** 120 dias
**Faixa:** R$ 150.000 – R$ 220.000
**Ref. real:** Orç. 48.115/2026 — SBFL (R$ 188.198)

---

## EST-AERO — Estudo Aeronáutico

**Norma:** DECEA/SITAR

### Heliponto / Aeródromo privado

**Prazo:** 30 dias | **Faixa:** R$ 6.000 – R$ 10.000

### Aeronave de grande porte (wide-body / cargueiro) em aeroporto internacional

**Horas:** ~120h (90h estudo + 30h levantamento) × R$ 144/h + desp. R$ 3.500
**Prazo:** 45 dias | **Faixa:** R$ 18.000 – R$ 25.000
**Ref. real:** Orç. 45.015/2025 — B747-8F SBFL (R$ 20.780)

---

## SDIA — Cancelamento de Obstáculos / Atualização SDIA

**Norma:** SDIA/DECEA | **Por obstáculo:** R$ 4.000 – R$ 6.000
**Processo completo (4 obstáculos, inclui ART e documentação):** R$ 18.000 – R$ 22.500
**Prazo:** 10 dias | **Ref. real:** Orç. 46.152/2026 — SBME/Macaé (4 obstáculos)

**Atividades:**

1. Análise técnica dos obstáculos cadastrados no SDIA
2. Elaboração de laudo técnico e documentação para supressão
3. ART do responsável técnico
4. Protocolo e acompanhamento junto ao DECEA/CINDACTA

---

## DOC-TEC — Documento Técnico / Ofício de Anuência

**Prazo:** 10 dias | **Faixa:** R$ 10.000 – R$ 15.000
**Descrição:** Elaboração de ofício técnico ou relatório para regularidade de edificações junto à Prefeitura/ANAC em sítio aeroportuário.
**Ref. real:** Orç. 46.253/2026 — SBVT/Vitória (R$ 12.900)

---

## MOPS — Manual de Operações

**Norma:** RBAC 153
**Atividades:** Levantamento operacional | Redação conforme RBAC 153 | Mapas operacionais | Revisão com operador | Protocolo ANAC
**Prazo:** 45 dias | **Faixa:** R$ 12.000 – R$ 20.000

---

## PAC — Plano de Ação de Contingência

**Norma:** ICA 63-17
**Atividades:** Levantamento de riscos | Redação do PAC | Fluxogramas de emergência | Treinamento básico | Aprovação
**Prazo:** 60 dias | **Faixa:** R$ 15.000 – R$ 25.000

---

## HOMO — Homologação de Aeródromo

**Norma:** RBAC 153 | **Prazo:** 180 dias | **Faixa:** R$ 60.000 – R$ 120.000
**Obs.:** Projeto de grande porte — proposta deve ser detalhada por etapas/fases.

---

## TEXTO DE APRESENTAÇÃO AEROCAD (usar em propostas)

"A **Aerocad Consultoria & Aeroportos** é uma empresa especializada em consultoria aeronáutica, com atuação em todo o território nacional. Nossa equipe multidisciplinar reúne engenheiros, arquitetos e especialistas em regulamentação aeroportuária, com ampla experiência em projetos de viabilidade, registro, regularização e homologação de aeródromos e helipontos junto à ANAC, COMAER e DECEA.

Atuamos em conformidade com as normas do Comando da Aeronáutica (COMAER), ANAC e DECEA, garantindo rigor técnico e eficiência em cada etapa dos processos aeronáuticos."

---

## CLÁUSULAS GERAIS (contratos e OS)

1. **Confidencialidade** — Sigilo absoluto sobre informações técnicas, comerciais e operacionais durante e após a vigência.
2. **Propriedade Intelectual** — Todos os produtos são de propriedade exclusiva da Aerocad, vedada reprodução sem autorização.
3. **Responsabilidade Técnica** — Prestador é responsável pela qualidade e precisão das informações entregues.
4. **Alterações de Escopo** — Formalizadas por aditivo assinado por ambas as partes antes das atividades adicionais.
5. **Rescisão** — Descumprimento enseja rescisão imediata + multa de 50% do valor do contrato + correção IGP-M + juros 1%/mês.
6. **Foro** — Foro da circunscrição judiciária de Brasília, Distrito Federal.
7. **Vigência** — A partir da manifestação de concordância das partes (assinatura, aceite verbal ou qualquer meio que comprove anuência).

---

## REFERÊNCIAS NORMATIVAS

| Regulamento  | Descrição                        | Aplicação                     |
| ------------ | -------------------------------- | ----------------------------- |
| RBAC 153     | Aeródromos — Projeto e Operação  | EVA, REG-AD, HOMO, MOPS, PDIR |
| RBAC 155     | Helipontos                       | HEL-SOLO, HEL-ELEV            |
| RBAC 157     | Registro de Aeródromo            | REG-AD, EVAP                  |
| RBAC 161     | Planos de Zona de Proteção       | PBZPA, PZPANA                 |
| RBAC 164     | Gestão de Risco (fauna)          | EVA, EVT                      |
| ICA 11-408   | OPEA e Aprovação de Projetos     | OPEA, EVA                     |
| ICA 63-17    | Plano de Ação de Contingência    | PAC                           |
| RBHA 77      | Obstáculos — Zona de Proteção    | PBZPA, SDIA                   |
| Lei 7.565/86 | Código Brasileiro de Aeronáutica | Todos                         |

<br>

---

# PARTE 5.2 — Referência: documentos de suporte

<sub>**Arquivo original:** `skills/aerocad-projetos/references/documentos_suporte.md`</sub>

---

# Documentos de Suporte — Referência Completa de Templates

Todos gerados pelo fluxo: unpack → editar XML → aplicar fix_pt → pack → PDF.

```python
import glob, os, re, shutil, subprocess

def _find(pat):
    r = glob.glob(pat); return r[0] if r else None

TEMPLATES = _find('/sessions/*/mnt/TEMPLATES AEROCAD 2026/')
OUTPUTS   = _find('/sessions/*/mnt/outputs/')
SKILLS    = _find('/sessions/*/mnt/.claude/skills/docx/scripts/office/')

DIR_COMERCIAL   = TEMPLATES + '01 - Documentos/01.1 - Comercial/'
DIR_TECNICO     = TEMPLATES + '01 - Documentos/01.2 - Tecnico/'
DIR_REGULATORIO = TEMPLATES + '01 - Documentos/01.3 - Regulatorio/'
DIR_GESTAO      = TEMPLATES + '01 - Documentos/01.4 - Gestao/'
DIR_PLANILHAS   = TEMPLATES + '02 - Planilhas/'
DIR_EMITIDOS    = TEMPLATES + '04 - Documentos Emitidos/2026/'
UNPACK  = SKILLS + 'unpack.py'
PACK    = SKILLS + 'pack.py'
SOFFICE = SKILLS + 'soffice.py'

def xe(s):
    return str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def gerar_doc(template_path, substituicoes, out_name, dst_slug):
    i = 1
    while os.path.exists(f'{OUTPUTS}{dst_slug}_{i}_unpacked'): i += 1
    dst = f'{OUTPUTS}{dst_slug}_{i}_unpacked'
    subprocess.run(['python3', UNPACK, template_path, dst], check=True, capture_output=True)
    xml_path = os.path.join(dst, 'word', 'document.xml')
    with open(xml_path, encoding='utf-8') as f: doc = f.read()
    for k, v in substituicoes.items():
        doc = doc.replace(k, xe(v))
    with open(xml_path, 'w', encoding='utf-8') as f: f.write(doc)
    os.makedirs(DIR_EMITIDOS, exist_ok=True)
    out = DIR_EMITIDOS + out_name
    subprocess.run(['python3', PACK, dst, out, '--validate', 'false'], check=True)
    subprocess.run(['python3', SOFFICE, '--headless', '--convert-to', 'pdf',
                    '--outdir', DIR_EMITIDOS, out])
    return out
```

---

## AEROCAD-OF — OFÍCIO

**Template:** AEROCAD*Template_Oficio.docx
**Nomenclatura:** `AEROCAD_OF*{NNN}_{AAAA}_{Dest_resumido}.docx`

| Placeholder                       | Campo                                                 |
| --------------------------------- | ----------------------------------------------------- |
| `Ofício Nº ____/2025 – AEROCAD`   | `Ofício Nº {NNN}/{AAAA} – AEROCAD`                    |
| `[DIA] de [MÊS] de [ANO]`         | Data de emissão                                       |
| `[NOME DO DESTINATÁRIO]`          | Nome completo do destinatário                         |
| `[CARGO / FUNÇÃO]`                | Cargo/função                                          |
| `[INSTITUIÇÃO / EMPRESA]`         | Órgão/empresa                                         |
| `[CIDADE – UF]`                   | Cidade e UF                                           |
| `[DESCREVER O ASSUNTO DO OFÍCIO]` | Assunto resumido                                      |
| `Senhor(a) [CARGO],`              | Forma de tratamento (Senhor(a) Superintendente, etc.) |
| `[PARÁGRAFO DE ABERTURA – ...]`   | Parágrafo de abertura                                 |
| `[DESENVOLVIMENTO – ...]`         | Desenvolvimento técnico                               |
| `[ENCERRAMENTO – ...]`            | Encerramento/solicitação                              |
| `[NOME COMPLETO DO SIGNATÁRIO]`   | Nome do signatário Aerocad                            |
| `[CARGO / FUNÇÃO]` (signatário)   | Cargo do signatário                                   |
| `[NÚMERO DO REGISTRO]`            | CREA/CAU do signatário                                |

---

## AEROCAD-MD — MEMORIAL DESCRITIVO

**Template:** AEROCAD_Template_Memorial_Descritivo.docx
**Seções (11):** Apresentação · Objeto · Localização e Caracterização · Normas e Referências · Geometria e Implantação · Pavimentação · Auxílios Visuais e Luminosos · Edificações e Infraestrutura · Supressão de Obstáculos · Conclusões e Recomendações · Responsabilidade Técnica

| Placeholder                              | Campo                  |
| ---------------------------------------- | ---------------------- |
| `[NOME DO PROJETO / OBJETO DO MEMORIAL]` | Título do memorial     |
| `[AEROCAD-MD-XXX/AAAA]`                  | Número do documento    |
| `[00]`                                   | Revisão                |
| `[DD/MM/AAAA]`                           | Data de emissão        |
| `[RAZÃO SOCIAL DO CLIENTE]`              | Cliente                |
| `[NOME DO AERÓDROMO / OBRA]`             | Empreendimento         |
| `[CIDADE - UF / COORDENADAS / ICAO]`     | Localização            |
| `[INFRAESTRUTURA / EDIFICAÇÕES / ...]`   | Disciplina             |
| `[NOME COMPLETO - CREA/CAU XX-XXXXX]`    | Responsável técnico    |
| `[Descrever brevemente o contexto...]`   | Conteúdo de cada seção |

---

## AEROCAD-MC — MEMORIAL DE CÁLCULO

**Template:** AEROCAD_Template_Memorial_de_Calculo.docx
**Seções (6):** Objeto e Escopo · Premissas e Hipóteses · Dados de Entrada · Critérios Normativos · Dimensionamento e Resultados · Conclusão e Responsabilidade

| Placeholder                                      | Campo                             |
| ------------------------------------------------ | --------------------------------- |
| `[AEROCAD-MC-XXX/AAAA]`                          | Número do documento               |
| `[ESTRUTURAL / GEOTÉCNICA / PAVIMENTAÇÃO / ...]` | Disciplina                        |
| `[NOME DO EMPREENDIMENTO / DESIGNADOR ICAO]`     | Empreendimento                    |
| `[Mathcad / Excel / SAP2000 / ...]`              | Software utilizado                |
| `[NOME COMPLETO - CREA/CAU XX-XXXXX]`            | Responsável técnico               |
| Linhas da tabela de cargas `[ ] [ ] [ ] [ ]`     | ID, Descrição, Valor, Coef. Pond. |
| `[Definir com precisão...]`                      | Objeto e escopo do cálculo        |
| `[Vida útil de projeto, classe...]`              | Premissas gerais                  |

**Normas já no template (NBR 6118, 6122, 8681, 6123, FAA AC 150/5320-6, ICAO Doc 9157, DNIT)**

---

## AEROCAD-LT — LAUDO / PARECER TÉCNICO

**Template:** AEROCAD_Template_Laudo_Parecer_Tecnico.docx
**Tipo:** marcar [ ] Laudo Técnico / [ ] Parecer Técnico / [ ] Vistoria Técnica
**Seções (7+):** Solicitante e Histórico · Objetivo · Descrição do Objeto · Metodologia e Vistoria · Referências Normativas · Análise Técnica · Conclusão e Recomendações · Responsabilidade Técnica

| Placeholder                                     | Campo                        |
| ----------------------------------------------- | ---------------------------- |
| `[AEROCAD-LT-XXX/AAAA]`                         | Número                       |
| `[DD/MM/AAAA]` (emissão)                        | Data de emissão              |
| `[DD/MM/AAAA]` (vistoria)                       | Data da vistoria             |
| `[RAZÃO SOCIAL DO SOLICITANTE / PESSOA FÍSICA]` | Solicitante                  |
| `[NOME / CARGO / CONTATO]`                      | Responsável pela solicitação |
| `[NOME DO EMPREENDIMENTO / DESIGNADOR ICAO]`    | Objeto examinado             |
| `[ENDEREÇO / CIDADE - UF / COORDENADAS]`        | Localização                  |
| `[NOME COMPLETO - CREA/CAU XX-XXXXX]`           | Responsável técnico          |
| `[protocolada em DD/MM/AAAA]`                   | Data do protocolo            |
| Seções de conteúdo `[...]`                      | Texto técnico de cada seção  |

---

## AEROCAD-RG — RELATÓRIO GERENCIAL (O&M)

**Template:** AEROCAD_Template_Relatorio_Gerencial.docx
**Uso:** Relatório mensal de operação e manutenção de heliponto/aeródromo
**Seções:** Identificação · Atividades (documentação, aspecto físico, manutenções, ocorrências operacionais, situação financeira) · Recomendações · Responsabilidade

| Placeholder                                  | Campo                      |
| -------------------------------------------- | -------------------------- |
| `[NOME DO EMPREENDIMENTO / DESIGNAÇÃO ICAO]` | Nome do empreendimento     |
| `Nº [XX]/[AAAA]`                             | Número do relatório        |
| `[NOME DO EDIFÍCIO / EMPREENDIMENTO]`        | Local                      |
| `[DESIGNADOR ICAO / NOME]`                   | Designação                 |
| `[LAT ° ' " S/N / LON ° ' " E/W]`            | Coordenadas                |
| `[XXXX m em relação ao nível médio do mar]`  | Altitude                   |
| `[DIMENSÕES m × m / MATERIAL / PESO MÁX. t]` | Características            |
| `[RAZÃO SOCIAL DO CONTRATANTE]`              | Contratante                |
| `[XX.XXX.XXX/XXXX-XX]`                       | CNPJ contratante           |
| `[MÊS]/[AAAA]`                               | Mês de referência          |
| `[heliponto / aeródromo]`                    | Tipo de instalação         |
| `[REGULAR / IRREGULAR]`                      | Situação documental        |
| Seções `[Descrever...]` e `[FATO]`           | Conteúdo de cada atividade |

---

## AEROCAD-AT — ATA DE REUNIÃO

**Template:** AEROCAD_Template_Ata_de_Reuniao.docx
**Seções:** Identificação · Participantes · Pauta · Tópicos Discutidos e Decisões · Encaminhamentos · Próxima Reunião · Encerramento

| Placeholder                                     | Campo                                          |
| ----------------------------------------------- | ---------------------------------------------- |
| `[AEROCAD-AT-XXX/AAAA]`                         | Número                                         |
| `[ASSUNTO PRINCIPAL DA REUNIÃO]`                | Título/assunto                                 |
| `[NOME DO PROJETO / CLIENTE]`                   | Projeto e cliente                              |
| `[DD/MM/AAAA]`                                  | Data                                           |
| `Início: [HH:MM] \| Término: [HH:MM]`           | Horários                                       |
| `[Endereço presencial] \| [Plataforma virtual]` | Local/modalidade                               |
| `[NOME DO CONVOCANTE / EMPRESA]`                | Convocante                                     |
| `[NOME COMPLETO]` (redator)                     | Redator da ata                                 |
| Linhas `[ ] [ ] [ ]` (participantes)            | Nome, Empresa, Cargo                           |
| `[Item X da pauta]`                             | Itens da pauta                                 |
| `[Título do Tópico X]`                          | Títulos dos tópicos                            |
| `[Descrever objetivamente...]`                  | Conteúdo de cada tópico                        |
| `Decisão / Encaminhamento: [...]`               | Decisão de cada tópico                         |
| Linhas de encaminhamentos                       | Ação, Responsável, Prazo                       |
| `[DD/MM/AAAA]` (próxima)                        | Data da próxima reunião                        |
| `[NOME DO REDATOR DA ATA]`                      | Assinatura — coluna 1 da tabela de assinaturas |
| `[CARGO]`                                       | Cargo do redator (col. 1)                      |
| `[NOME PARTICIPANTE 2]`                         | Nome — coluna 2 da tabela de assinaturas       |
| `[EMPRESA 2]`                                   | Empresa do participante 2                      |
| `[CARGO 2]`                                     | Cargo do participante 2                        |
| `[NOME PARTICIPANTE 3]`                         | Nome — coluna 3 da tabela de assinaturas       |
| `[EMPRESA 3]`                                   | Empresa do participante 3                      |
| `[CARGO 3]`                                     | Cargo do participante 3                        |

---

## AEROCAD-PR — PROCURAÇÃO

**Template:** AEROCAD_Template_Procuracao.docx
**Outorgada fixa:** JAQUELINE MOTA DE FREITAS SARAIVA, CPF 005.417.801-07

| Placeholder                                     | Campo                       |
| ----------------------------------------------- | --------------------------- |
| `[AEROCAD-PR-XXX/AAAA]`                         | Número                      |
| `[NOME EMPRESARIAL DO OUTORGANTE]`              | Razão social do outorgante  |
| `[XX.XXX.XXX/XXXX-XX]`                          | CNPJ do outorgante          |
| `[ENDEREÇO COMPLETO COM CEP]` (sede)            | Endereço do outorgante      |
| `[NOME COMPLETO DO SIGNATÁRIO]`                 | Representante do outorgante |
| `[XXX.XXX.XXX-XX]`                              | CPF do representante        |
| `[ENDEREÇO COMPLETO COM CEP]` (domicílio)       | Domicílio do representante  |
| `[ÓRGÃO / AUTORIDADE — ex.: ANAC; ...]`         | Órgão de representação      |
| `[PROCESSO / ASSUNTO — ex.: OPEA; ...]`         | Objeto da procuração        |
| `[DD] de [mês] de [AAAA]`                       | Data                        |
| `[NOME EMPRESARIAL DO OUTORGANTE]` (assinatura) | Nome na assinatura          |

---

## AEROCAD-PAC — PLANO DE AÇÃO CORRETIVA

**Template:** AEROCAD_Template_Plano_Acao_Corretiva.docx
**Atenção:** não confundir com PAC-CT (Plano de Ação de Contingência — serviço ICA 63-17)
**Seções:** Identificação NC · Identificação da NC · Análise de Causa Raiz (5 Porquês/Ishikawa) · Ações Corretivas · Ações Preventivas · Verificação de Eficácia · Responsabilidade Técnica

| Placeholder                              | Campo                            |
| ---------------------------------------- | -------------------------------- |
| `[AEROCAD-PAC-XXX/AAAA]`                 | Número                           |
| `[Nº DO AUTO / RELATÓRIO / NOTIFICAÇÃO]` | Documento de origem              |
| `[DD/MM/AAAA]` (notificação)             | Data da notificação              |
| `[NOME DO AERÓDROMO / DESIGNADOR ICAO]`  | Empreendimento                   |
| `[RAZÃO SOCIAL DO OPERADOR]`             | Operador/cliente                 |
| `[CIDADE - UF / COORDENADAS]`            | Localização                      |
| `[NOME COMPLETO - CREA/CAU XX-XXXXX]`    | Responsável técnico              |
| `[DD/MM/AAAA]` (emissão)                 | Data de emissão                  |
| Transcrição da NC, norma violada         | Descrição e requisito            |
| Tabela 5 Porquês `[ ]`                   | Cadeia de causas                 |
| Tabela ações `[ ] [ ] [ ] [ ]`           | Ação, Responsável, Prazo, Status |

---

## AEROCAD-FNC — FICHA DE NÃO CONFORMIDADE

**Template:** AEROCAD_Template_Ficha_Nao_Conformidade.docx

| Placeholder                                | Campo                                  |
| ------------------------------------------ | -------------------------------------- |
| `[AEROCAD-FNC-XXX/AAAA]`                   | Número                                 |
| `[DD/MM/AAAA]`                             | Data de emissão                        |
| `[NOME / DESIGNADOR]`                      | Empreendimento/ICAO                    |
| `[Pista / Pátio / TPS / Heliponto / ...]`  | Setor inspecionado                     |
| `[NOME COMPLETO - CREA/CAU XX-XXXXX]`      | Inspetor                               |
| `[Checklist nº / Vistoria nº / Auditoria]` | Documento de referência                |
| `[Descrever objetivamente o achado...]`    | Descrição da NC                        |
| `[Norma e item]`                           | Requisito normativo violado            |
| Severidade                                 | Marcar: CRÍTICA / ALTA / MÉDIA / BAIXA |
| `[INSERIR FOTOGRAFIA AQUI]`                | Foto da evidência                      |
| `[Descrever a ação corretiva...]`          | Ação recomendada                       |
| `[NOME / EMPRESA]`                         | Responsável pela execução              |
| `[DD/MM/AAAA]` (prazo)                     | Prazo recomendado                      |

---

## AEROCAD-RQ — REQUERIMENTO ANAC/DECEA

**Template:** AEROCAD_Template_Requerimento_ANAC_DECEA.docx
**Seções:** Qualificação do Requerente · Dos Fatos · Da Fundamentação Normativa · Do Pedido · Dos Documentos Anexos · Da Responsabilidade Técnica

| Placeholder                           | Campo                                    |
| ------------------------------------- | ---------------------------------------- |
| `[AEROCAD-RQ-XXX/AAAA]`               | Número                                   |
| `[[CARGO / FUNÇÃO DA AUTORIDADE]]`    | Cargo da autoridade destinatária         |
| `[ÓRGÃO DESTINATÁRIO]`                | ANAC / CINDACTA I/II/III/IV / Prefeitura |
| `[ENDEREÇO COMPLETO DO ÓRGÃO]`        | Endereço do órgão                        |
| `[[RESUMO OBJETIVO DO REQUERIMENTO]]` | Assunto/resumo                           |
| `[Nº de Processo SEI / SysAGA / ...]` | Referência processual                    |
| `[NOME EMPRESARIAL OU NOME COMPLETO]` | Requerente                               |
| `[XX.XXX.XXX/XXXX-XX]`                | CNPJ/CPF do requerente                   |
| `[LOGRADOURO, Nº, ...]`               | Endereço do requerente                   |
| `[NOME COMPLETO]` (representante)     | Representante legal                      |
| `[XXX.XXX.XXX-XX]` (representante)    | CPF do representante                     |
| `[E-MAIL] \| [+55 XX XXXX-XXXX]`      | Contato                                  |
| `[RBAC nº XXX — Item §XXX]`           | Fundamentação normativa                  |
| `[...]` (fatos, pedido, anexos)       | Conteúdo de cada seção                   |
| `[NOME COMPLETO - CREA/CAU XX-XXXXX]` | Responsável técnico                      |

---

## AEROCAD-FT — FATURA

**Template:** AEROCAD_Template_Fatura.docx
**Seções:** Identificação · Prestador (fixo) · Tomador · Referência Contratual · Serviços · Composição Financeira (subtotal, impostos, total) · Dados de Pagamento · Observações

| Placeholder                           | Campo                                                         |
| ------------------------------------- | ------------------------------------------------------------- |
| `[AEROCAD-FT-XXX/AAAA]`               | Número do documento                                           |
| `[XXX/AAAA]` (nº fatura)              | Número da fatura                                              |
| `[DD/MM/AAAA]` (emissão)              | Data de emissão                                               |
| `[DD/MM/AAAA]` (vencimento)           | Data de vencimento                                            |
| `[ ] EM ABERTO / [ ] PAGA`            | Status                                                        |
| `R$ [X.XXX,XX] ([VALOR POR EXTENSO])` | Valor a pagar                                                 |
| Dados do tomador                      | Razão social, CNPJ/CPF, IE/IM, endereço, responsável, contato |
| `[XXX/AAAA]` (contrato)               | Nº do contrato                                                |
| `[DD/MM/AAAA]` (assinatura)           | Data de assinatura do contrato                                |
| `[XX.XXX/AAAA]` (proposta)            | Nº da proposta comercial                                      |
| `[DESCRIÇÃO RESUMIDA]` (objeto)       | Objeto contratado                                             |
| `[Nº DA PARCELA]`                     | Parcela (ex: 1ª de 4) — Marco vinculado                       |
| Linhas de serviços `[ ] [R$] [R$]`    | Descrição, Qtd, Valor unit., Total                            |
| Composição financeira                 | Subtotal, % ISS, % retenções, total líquido                   |

---

## AEROCAD-RC — RECIBO

**Template:** AEROCAD_Template_Recibo.docx
**Declarante fixo:** Aerocad (dados já no template)

| Placeholder                                      | Campo                                                 |
| ------------------------------------------------ | ----------------------------------------------------- |
| `[AEROCAD-RC-XXX/AAAA]`                          | Número                                                |
| `R$ [X.XXX,XX] ([VALOR POR EXTENSO])`            | Valor recebido                                        |
| `[NOME EMPRESARIAL OU NOME COMPLETO DO PAGADOR]` | Pagador                                               |
| `[XX.XXX.XXX/XXXX-XX]`                           | CNPJ/CPF do pagador                                   |
| `[ENDEREÇO COMPLETO COM CEP]`                    | Endereço do pagador                                   |
| `[Nº DA PARCELA]`                                | Parcela (ex: 1ª (PRIMEIRA))                           |
| `[XX]` (total parcelas)                          | Total de parcelas                                     |
| `[XXX/AAAA]` (contrato)                          | Nº do contrato                                        |
| `[DD/MM/AAAA]`                                   | Data de assinatura do contrato                        |
| `[DESCRIÇÃO RESUMIDA DO OBJETO]`                 | Objeto                                                |
| Marco vinculado                                  | Aceite / Protocolo SysAGA / Publicação parecer / etc. |
| Forma de pagamento                               | Marcar: PIX / TED/DOC / Boleto / Outro                |
| `[DD] de [mês] de [AAAA]`                        | Data                                                  |

---

## AEROCAD-CT — CONTRATO OPEA

**Template:** AEROCAD_Template_Contrato_OPEA.docx
**Cláusulas fixas:** DO OBJETO (ICA 11-408) · OBRIGAÇÕES CONTRATADA · OBRIGAÇÕES CONTRATANTE · DO PRAZO · CONFIDENCIALIDADE · RESCISÃO (50%+IGP-M+1%/mês) · CONDIÇÕES GERAIS · DO FORO (Brasília-DF)

| Placeholder                                    | Campo                    |
| ---------------------------------------------- | ------------------------ |
| `[AEROCAD-CT-XXX/AAAA]`                        | Número do contrato       |
| `[NOME COMPLETO ...]` (contratante)            | Razão social/nome        |
| `[XX.XXX.XXX/XXXX-XX]`                         | CNPJ do contratante      |
| `[ENDEREÇO COMPLETO COM CEP]` (sede)           | Sede do contratante      |
| `[NOME DO REPRESENTANTE LEGAL]`                | Representante legal      |
| `[nacionalidade], [estado civil], [profissão]` | Qualificação pessoal     |
| `[XX.XXX.XXX SSP-XX]`                          | RG                       |
| `[XXX.XXX.XXX-XX]`                             | CPF                      |
| `[ENDEREÇO COMPLETO COM CEP]` (domicílio)      | Domicílio                |
| `[VALOR POR EXTENSO] (R$ [X.XXX,XX])`          | Valor global             |
| `R$ [X.XXX,XX] ([extenso])` (P1)               | Entrada na assinatura    |
| `R$ [X.XXX,XX] ([extenso])` (P2)               | Saldo no protocolo DECEA |
| `[XX] ([extenso]) dias`                        | Prazo                    |
| `[XX.XXX/AAAA]`                                | Nº da proposta comercial |
| `[DD] de [mês] de [AAAA]`                      | Data de assinatura       |

---

## AEROCAD-CT — CONTRATO REGISTRO DE AERÓDROMO

**Template:** AEROCAD_Template_Contrato_Registro_Aerodromo.docx
**Mesmos placeholders do Contrato OPEA, com objeto diferente:**
Cláusula 2ª detalha: ESTUDOS DE VIABILIDADE + PROJETOS (geométrico, PBZPA, ART) + CONDUÇÃO DOS PROCESSOS (abertura tráfego, registro ANAC, validação PBZPA COMAER)

---

## AEROCAD-EVT — ESTUDO DE VIABILIDADE TÉCNICA

**Template:** AEROCAD_Template_Estudo_Viabilidade_Tecnica.docx
**11 seções:** Introdução · Caracterização · Análise de Localização · Análise Aeronáutica · Análise Operacional · Análise Ambiental · Análise de Custos (CAPEX/OPEX) · Cenários e Alternativas · Síntese SWOT · Conclusão · Responsabilidade Técnica

| Placeholder                                 | Campo                   |
| ------------------------------------------- | ----------------------- |
| `[AEROCAD-EVT-XXX/AAAA]`                    | Número                  |
| `[NOME DO PROJETO / DESIGNAÇÃO PROVISÓRIA]` | Empreendimento proposto |
| `[Aeródromo Privado / Heliponto / ...]`     | Tipo de instalação      |
| `[RAZÃO SOCIAL DO CLIENTE]`                 | Cliente                 |
| `[CIDADE - UF]`                             | Localização             |
| Coordenadas Lat/Lon                         | ARP                     |
| `[XXXX m ...]`                              | Altitude                |
| `[DD/MM/AAAA]`                              | Data                    |
| `[NOME COMPLETO - CREA/CAU XX-XXXXX]`       | Responsável técnico     |
| `[aeronave-tipo]`, MTOW, envergadura        | Aeronave de projeto     |
| Conteúdo de cada seção `[...]`              | Texto técnico           |

---

## PLANILHAS

### AEROCAD-CL — CHECKLIST DE INSPEÇÃO

**Template:** `02 - Planilhas/AEROCAD_Template_Checklist_Inspecao.xlsx`
**Abas:** CAPA · CHECKLIST (19+ itens por categoria) · RESUMO
**Categorias do checklist:** DOCUMENTAÇÃO · PISTA/FATO · PÁTIO/TWY · AUXÍLIOS VISUAIS · OBSTÁCULOS · CERCAMENTO/SEGURANÇA · SCI (SESCINC)
**Geração:** usar openpyxl para preencher células da CAPA e colunas de resultado (Conformidade C/NC/NA, Criticidade, Observações)

```python
import openpyxl, shutil
src = DIR_PLANILHAS + 'AEROCAD_Template_Checklist_Inspecao.xlsx'
out = DIR_EMITIDOS + 'AEROCAD_CL-001_2026_ICAO.xlsx'
shutil.copy(src, out)
wb = openpyxl.load_workbook(out)
capa = wb['CAPA']
# Preencher células conforme dados coletados
# Ex: capa['C4'] = 'SBVT — Heliponto Hospital Vitória'
wb.save(out)
```

### AEROCAD-CFF — CRONOGRAMA FÍSICO-FINANCEIRO

**Template:** `02 - Planilhas/AEROCAD_Template_Cronograma_Fisico_Financeiro.xlsx`
**Abas:** CAPA · CRONOGRAMA (atividades + meses + Curva S) · CURVA S (gráfico automático)
**Atividades base:** Mobilização · Projeto executivo e licenças · Terraplenagem · Pavimentação · Drenagem · Sinalização · Auxílios visuais · Edificações · Cercamento · Comissionamento/ART
**Campos chave:** Peso (%) por atividade, Valor (R$), marcação por mês (X ou %)

```python
import openpyxl, shutil
src = DIR_PLANILHAS + 'AEROCAD_Template_Cronograma_Fisico_Financeiro.xlsx'
out = DIR_EMITIDOS + 'AEROCAD_CFF-001_2026_Projeto.xlsx'
shutil.copy(src, out)
wb = openpyxl.load_workbook(out)
capa = wb['CAPA']
cron = wb['CRONOGRAMA']
# Preencher CAPA e linhas do CRONOGRAMA
wb.save(out)
```

<br>

---

# PARTE 6 — SKILL: aerocad-pdir

<sub>**Arquivo original:** `skills/aerocad-pdir/SKILL.md`</sub>

---

---

name: aerocad-pdir
description: |
Use esta skill SEMPRE para o PLANO DIRETOR AEROPORTUÁRIO (PDIR) da Aerocad Consultoria & Aeroportos — relatório e plantas. Dispare ao mencionar: PDIR, Plano Diretor, Plano Diretor Aeroportuário, RBAC 153, caracterização atual, horizonte de planejamento, planta de implantação, planta geral, carimbo, legenda, quadro de distâncias declaradas, prancha A0, paper space, DXF/DWG do aeroporto, PGI (Plano de Gestão da Infraestrutura), SBFL/FLN, SBSG/NAT, viewport, layout de plotagem. NÃO use para PBZPA/PZPANA (zonas de proteção) nem para os demais documentos administrativos — esses ficam na skill aerocad-projetos.

---

# Aerocad — Plano Diretor Aeroportuário (PDIR)

Skill dedicada ao **PDIR** (RBAC 153). O PDIR diverge de PBZPA/PZPANA: tem estrutura de relatório própria, plantas em prancha padronizada e regras específicas de fontes/dados. Cobre três frentes:

1. **Plantas** — reproduzir a prancha padrão aprovada (carimbo, legenda, quadros, rosa dos ventos) em DXF. Ver `references/plantas.md` (+ asset `assets/FRAME-PDIR-A0-template.dxf` e script `scripts/montar_prancha_pdir.py`).
2. **Fontes e convenções** — regras de fonte, dados a confirmar (vermelho), não conformidades, ABNT do relatório. Ver `references/fontes_e_convencoes.md`.
3. **Fluxo e nomenclatura** — workflow, nomes de arquivos, organização de pastas, saída docx+pdf. Ver `references/fluxo_e_nomenclatura.md`.

---

## Regras de ouro (aplicar sempre)

- **Fonte dos elementos**: foto → `Fonte: Visita in loco`; tabela/dado → `Fonte: Zurich Airport Brasil` (ou `Fonte: PGI`). **Remover** qualquer citação a EVTEA e ao PDIR SBSG do texto do novo relatório (o SBSG serve só de TEMPLATE de forma, não de conteúdo).
- **Dado atual = PGI**. O `PGI` (Plano de Gestão da Infraestrutura) do operador é a fonte mais atual; o PDir INFRAERO 2013 é só referência histórica. Ao atualizar, buscar no PGI; se o dado não existir, **eliminar a linha/coluna/tabela** em vez de inventar.
- **Não conformidades**: mencionar **apenas** as citadas pelo PGI/ACI. Remover as herdadas do PDir INFRAERO 2013.
- **Pendências em vermelho**: todo dado a confirmar vai em vermelho (docx: RGB `FF0000`; DXF: cor ACI `1`) para revisão do cliente.
- **Saída sempre em docx E pdf** (relatório) / **DXF** (plantas). Converter docx→pdf com LibreOffice, limpar `.~lock*`/`*.tmp`, entregar via `present_files`.
- **Arquivo travado**: se o cliente estiver com o docx/pdf aberto, o "Permission denied" impede sobrescrever; salvar o que der e entregar o outro por `present_files`, pedindo para fechar.
- **Nomes de figuras/tabelas** começam com letra maiúscula; legendas de tabela/figura acima/abaixo conforme ABNT.
- Genérico por aeroporto: onde aparecer `SBFL`/`FLN`/`Florianópolis`, trocar pelo `[ICAO]`/`[IATA]`/`[Município-UF]` do projeto em questão.

---

## Passo a passo típico

1. Identifique a frente (relatório, planta ou ambos) e o aeroporto (ICAO/IATA, operador, ARP, pistas).
2. Reúna as fontes: **PGI** (dados atuais), fotos de **visita in loco**, plantas DXF base. Extraia dados do PGI antes de montar o entregável.
3. Aplique o padrão: relatório → ABNT + estrutura; planta → frame padrão (`references/plantas.md`).
4. Preencha com dados reais; **deixe em vermelho** o que faltar.
5. Gere a saída (docx+pdf / DXF), valide por render/preview e entregue por `present_files`, salvando na pasta certa (`references/fluxo_e_nomenclatura.md`).

Leia o arquivo de referência pertinente ANTES de produzir cada entregável.

<br>

---

# PARTE 6.1 — Referência: fluxo e nomenclatura PDIR

<sub>**Arquivo original:** `skills/aerocad-pdir/references/fluxo_e_nomenclatura.md`</sub>

---

# Fluxo e nomenclatura do PDIR

## 1. Norma e produtos

- Base regulatória: **RBAC 153** (Plano Diretor). Prazo típico Aerocad: 60 dias (regional) / 90 dias (internacional).
- Produtos do PDIR: **Relatório** (docx+pdf), **Plantas** (DXF/DWG → PDF) e **Requerimento** ANAC.
- Horizontes de planejamento: curto (5 anos), médio (10), longo (20).

## 2. Nomenclatura de arquivos

Genérico por aeroporto (`[ICAO]`, `REV00X`, `DDMMYY`, `YYYY` = ano do horizonte):

```
Relatório      : [ICAO]-PDIR-YYYY-RELATÓRIO-REV00X-DDMMYY.docx / .pdf
Planta atual   : [ICAO]-PDIR-YYYY-PLANTA-CARAC-ATUAL-REV00X-DDMMYY.dxf
Planta futura  : [ICAO]-PDIR-YYYY-PLANTA-FUT-HOR-YYYY-REV00X-DDMMYY.dxf
```

Nº da prancha no carimbo: `[ICAO]- Anexo 0N- Implantação Geral [ANO]`.
Exemplos FLN: `SBFL-PDIR-2026-RELATÓRIO-REV001-240626.docx`; `ACAD-SBFL- IMPLANTAÇÃO 2026- CARACTERIZAÇÃO ATUAL_R01.dxf`.

## 3. Organização de pastas

Pasta-mãe `PDIR-[ICAO]-[ANO]/` com três subpastas:

```
PDIR-FLN-2026/
├─ 001-PDIR-Relatório-FLN-2026/     # docx + pdf do relatório
├─ 002-PDIR-Plantas-FLN-2026/       # DXF/DWG + PDF das plantas
└─ 003-PDIR-Requerimento-FLN-2026/  # requerimento ANAC
```

Salvar sempre a versão nova nesta estrutura. Usar o docx editado manualmente pelo cliente como **base** das próximas alterações, quando existir.

## 4. Saída (docx + pdf) e entrega

1. Editar/gerar o docx.
2. Converter para PDF: `soffice --headless --convert-to pdf --outdir <dir> <arquivo.docx>` (LibreOffice).
3. Limpar `.~lock*` e `*.tmp`.
4. Validar por render (pymupdf/fitz) as páginas críticas.
5. Entregar por `present_files` (docx + pdf).

**Travamento de arquivo**: se o cliente estiver com o docx OU o pdf aberto, o alvo dá "Permission denied". Salvar o que estiver livre, entregar o outro por `present_files` e pedir para fechar o app.

## 5. Restrições de ambiente (aprendizados)

- A pasta do Google Drive **não monta** no sandbox bash; trabalhar em `Downloads` (que monta e é gravável) e o cliente sincroniza com o Drive.
- DXF grandes (40–75 MB) **carregam** no ezdxf (~6–11 s); DXF enviados pelo chat caem em `uploads/` (leitura ok). PDFs grandes do PGI: ler direto de `Downloads` com fitz/pdfplumber.
- Para inspecionar estrutura de DXF gigante sem carregar tudo: varredura de tags (SECTION/TABLE/LAYER/LAYOUT/BLOCK) por streaming de linhas.

## 6. Ferramentas

- Relatório: `python-docx` + LibreOffice (pdf) + `pymupdf` (validação/render).
- Plantas: `ezdxf` (1.4.x) + `Importer` (copiar frame/blocos) + `ezdxf.addons.drawing` (preview matplotlib, **fundo preto**).
- Dados do PGI: `fitz`/`pdfplumber`.

<br>

---

# PARTE 6.2 — Referência: fontes e convenções PDIR

<sub>**Arquivo original:** `skills/aerocad-pdir/references/fontes_e_convencoes.md`</sub>

---

# Fontes, dados e convenções do PDIR

## 1. Fontes (regra fixa do cliente)

- **Foto** → `Fonte: Visita in loco`.
- **Tabela / dado numérico** → `Fonte: Zurich Airport Brasil` (ou `Fonte: PGI` quando o dado vier direto do PGI).
- **Remover** do relatório qualquer menção a **EVTEA** e ao **PDIR SBSG** — o SBSG é só modelo de forma (estrutura/prancha), nunca fonte de conteúdo.

## 2. Hierarquia de dados

1. **PGI (Plano de Gestão da Infraestrutura)** do operador — fonte mais atual (dados cadastrais, pistas, pátios, TPS, TECA, demanda, capacidade, investimentos, não conformidades).
2. Visita in loco — fotos georreferenciadas (EXIF: GPS + altitude distingue pavimentos: ~17 m = 1º pav/embarque, ~12 m = térreo/desembarque).
3. PDir INFRAERO 2013 — **apenas referência histórica**.

**Regra**: ao atualizar um dado "ref. 2013", buscar no PGI. Se o dado **não existir** no PGI, **eliminar** a linha/coluna/tabela (não inventar, não manter valor antigo).

## 3. Dados em vermelho (a confirmar)

Todo valor/campo pendente de confirmação vai em **vermelho** para revisão do cliente:

- docx: `RGBColor(0xFF,0,0)` no run.
- DXF: `entity.dxf.color = 1` (ACI vermelho).
  Exemplos: responsável/CREA e gestor no carimbo; variação magnética; distâncias de pista sem dado; áreas consolidadas sem somatório possível.

## 4. Não conformidades

Mencionar **somente** as não conformidades citadas pelo **PGI/ACI** (ex.: pontos de atenção da infraestrutura). **Remover** quaisquer não conformidades herdadas do PDir INFRAERO 2013 (ex.: RESA já implantada não deve mais aparecer). Fazer varredura para eliminar duplicidades e itens já sanados segundo o PGI.

## 5. ABNT NBR 14724 (formatação do relatório)

- Papel A4 branco. Fonte **Arial**, cor **preta** (cores só em ilustrações). Margens **3/3/2/2** (sup/esq/inf/dir cm).
- Tamanhos: **12** texto geral; **10** legendas de figuras/tabelas, conteúdo de tabela e paginação do rodapé.
- Espaçamento: **1,5** no corpo; **simples** em legendas e referências.
- Alinhamento **justificado**; **REFERÊNCIAS** à esquerda, sem marcadores, linha em branco entre entradas (padrão ABNT).
- **Sumário e listas** (figuras/tabelas) com **hiperlinks internos** (bookmarks nos títulos/legendas), mantendo texto preto/sem sublinhado; repaginar por correspondência **monotônica** (na ordem do documento) após qualquer mudança de conteúdo.
- **Tabelas**: dados na largura da página com valores curtos/numéricos centralizados; tabelas chave/valor (2 colunas) com valores à esquerda; **cabeçalho/faixa de fundo azul → texto branco**; travar linhas para não quebrar entre páginas (cantSplit).
- Nomes de figuras/tabelas iniciando com maiúscula. Evitar quebras de página desnecessárias (remover parágrafos vazios com page break).

## 6. Dados de referência do FLN (exemplo já levantado do PGI)

- ICAO/IATA: SBFL / FLN. Operador: Zurich Airport Brasil (concessão desde 2019). Município: Florianópolis-SC.
- ARP: 27º 40' 13" S / 048º 33' 09" W. Altitude 5,00 m (16 ft). Ref. do aeródromo 4E.
- Pistas: **14/32** = 2400×45 m, RESA 240×150, PCR 710/F/A/X/T, ILS CAT I (THR14); **03/21** = 1320×45 m, RESA 120×90, PCR 200/R/B/W/T. 7 taxiways (A,B,D,F,G,H,J).
- Distâncias declaradas 14/32 (TORA/TODA/ASDA/LDA): 2300/2300/2360/2300 (por cabeceira).
- Demanda 5,32 → 10,46 Mpax (2026–2045); capacidade 10,55 Mpax/ano e 108.000 mov/ano.

<br>

---

# PARTE 6.3 — Referência: plantas PDIR

<sub>**Arquivo original:** `skills/aerocad-pdir/references/plantas.md`</sub>

---

# Plantas do PDIR — padrão de prancha (carimbo, legenda, quadros)

Padrão de referência = **PDIR SBSG aprovado** (arquivo `ACAD-SBSG- IMPLANTAÇÃO 2025- CARACTERIZAÇÃO ATUAL_R02.dxf`). O frame limpo (carimbo + legenda + quadros + rosa dos ventos, **sem** viewports e sem o desenho do modelo) está em `assets/FRAME-PDIR-A0-template.dxf`, pronto para reaproveitar em qualquer aeroporto.

## 1. Folha e page setup (layout de plotagem)

- **A0 paisagem**: folha 1189×841 mm. O paper space é desenhado **em METROS** — o frame ocupa **1.189 × 0.841** unidades (m).
- Nome do layout: `PDIR-PLANTA CARACTERIZAÇÃO ATUAL [ANO]`.
- Atributos de plotagem a replicar (do SBSG) no `layout.dxf`:

```
paper_width = 841.0          paper_height = 1189.0
plot_paper_units = 1         # mm
plot_rotation = 1            # 90° -> resulta em paisagem
scale_numerator = 1.0        scale_denominator = 0.001    # 1 m desenho = 1000 mm papel
unit_factor = 1000.0         standard_scale_type = 32
plot_type = 5                plot_layout_flags = 690
current_style_sheet = "CTB - PADRÃOPROJETOS - FINO.ctb"
limmin = (0.0, 0.0)          limmax = (1.189, 0.841)
```

- **Escala do desenho**: rótulo `ESCALA: 1/5000` (ajustar por projeto). A escala real vem do viewport (view_height ÷ tamanho do viewport).
- **CTB**: os textos da legenda ficam na layer `ge_textos` com cor **255 (branco)** — isso é normal; no fundo preto do AutoCAD aparecem, e o CTB "FINO" plota em preto no papel. Não "corrigir" para preto.

## 2. Carimbo (title block) — campos a preencher

Fica na faixa inferior. Substituir os textos do SBSG pelos dados do aeroporto:

| Campo                         | Exemplo FLN                                                                 | Origem                         |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------ |
| Nome do aeroporto             | `SBFL - AEROPORTO INTERNACIONAL DE FLORIANÓPOLIS (FLN)`                     | fixo do projeto                |
| Município/UF                  | `(FLORIANÓPOLIS / SC)`                                                      | fixo                           |
| ARP                           | `PONTO DE REFERÊNCIA DO AERÓDROMO (ARP): 27º 40' 13" S / 048º 33' 09" W`    | PGI (Dados Cadastrais)         |
| Fase                          | `PDIR - Plano Diretor / Planta Geral de Implantação / Caracterização Atual` | fixo                           |
| Nº da prancha                 | `[ICAO]- Anexo 01- Implantação Geral [ANO]`                                 | nomenclatura                   |
| Fase (ano)                    | `[ANO]`                                                                     | projeto                        |
| Data de elaboração            | `MÊS/ANO`                                                                   | data de geração                |
| Responsável pelo planejamento | Eng. + **CREA**                                                             | **vermelho — confirmar**       |
| Gestor do aeroporto           | nome + registro                                                             | **vermelho — confirmar**       |
| Rosa dos ventos               | `VAR. [XX]º W - [ANO]` (variação magnética)                                 | **vermelho se não confirmado** |

## 3. Legenda de convenções

Lista padrão (ajustar ao aeroporto): HANGARES EXISTENTES, ÁREA DE DESTINAÇÃO COMERCIAL, TPS (Terminal de Passageiros), TECA (Terminal de Carga), PAA (Parque de Abastecimento de Aeronaves), TWR (Torre de Controle), KF (Subestação de Balizamento), SCI (Seção Contra Incêndio), USINA FOTOVOLTAICA (remover se não existir), DEMAIS EDIFICAÇÕES; ÁREA DE RESA, FAIXA PREPARADA – REVESTIMENTO EM GRAMA, PPD [designação das pistas], ACOSTAMENTO EXISTENTE, CÓRREGO E ALAGADO; linhas: FAIXA DE PISTA (STRIP), FAIXA DE PISTA PREPARADA, VIA DE SERVIÇO PAVIMENTADA, LIMITE PATRIMONIAL, CERCA ALAMBRADO E MOURÕES / CURVOS DE CONCRETO.

## 4. Quadro de distâncias declaradas

Uma tabela por pista: `CABECEIRA | TORA (m) | TODA (m) | ASDA (m) | LDA (m)`, uma linha por cabeceira. Título `DISTÂNCIAS DECLARADAS DA PPD [desig]`.
Ex. FLN PPD 14-32 (do relatório/PGI): cabeceiras 14 e 32 → 2300 / 2300 / 2360 / 2300 cada. Incluir um quadro por pista (FLN tem 14/32 e 03/21); se faltar dado de uma pista, deixar nota **em vermelho** e omitir os números.

## 5. Documentos de referência e Notas

- `DOCUMENTOS DE REFERÊNCIA`: apontar a planta-fonte (ex.: `SBFL-GRL-000-1001-04 - Planta Geral.dwg`) e o `PGI [ANO]`.
- `NOTAS`: dimensões em metros, elevações etc. (manter o texto padrão do SBSG).

## 6. Viewport (janela do modelo)

- Criar 1 viewport na área livre do frame (aprox. paper space, em metros: centro ~ (0.465, 0.49), tamanho ~ (0.88, 0.67)).
- `view_center_point` = centro das extensões do modelo; `view_height` para enquadrar (fit) com ~5% de margem, respeitando o aspecto do viewport.
- **Atenção (aprendizado FLN)**: o modelo pode ter **coordenadas misturadas** (UTM ~6.9M N + pontos locais + outliers). Antes de enquadrar, **isolar as entidades válidas** (por layer/extensão) ou definir a janela manualmente — o auto-fit por bbox bruto falha.

## 7. Como montar com ezdxf (resumo)

1. Extrair o frame do modelo aprovado: importar as entidades do paper space (exceto `VIEWPORT`/`INSERT` vazios) para o modelspace de um DXF novo (`Importer.import_entities`). Já feito em `assets/FRAME-PDIR-A0-template.dxf`.
2. Preencher os textos (TEXT: `e.dxf.text`; MTEXT: `e.text`); pendências → `e.dxf.color = 1`.
3. Importar o frame preenchido para um **novo layout** do DXF do aeroporto; replicar os atributos de page setup (seção 1).
4. Adicionar o viewport (seção 6).
5. Validar por render (ezdxf drawing addon / matplotlib) **com fundo preto** (a legenda é branca) antes de entregar.

Ver `scripts/montar_prancha_pdir.py` para um esqueleto executável.

<br>

---

# PARTE 7 — SKILL: aerocad-rg-cni

<sub>**Arquivo original:** `skills/aerocad-rg-cni/SKILL.md`</sub>

---

---

name: "aerocad-rg-cni"
description: "Gera o Relatório Gerencial mensal do Heliponto SNAW / CEAMN (AEROCAD × Condomínio CEAMN) a partir de fotos da visita técnica. Dispare quando o usuário escrever \"Relatório gerencial CNI\" (variações: \"RG CNI\", \"relatório CEAMN\", \"relatório mensal SNAW\") e enviar/mencionar fotos da vistoria."

---

# AEROCAD — Relatório Gerencial Mensal · Heliponto SNAW (CEAMN)

## Quando usar esta skill

Dispare AUTOMATICAMENTE quando o usuário escrever qualquer variação de:

- "Relatório gerencial CNI"
- "RG CNI"
- "Relatório mensal CEAMN"
- "Relatório SNAW"
- "RG mensal do heliponto CEAMN"

E enviar/apontar fotos da visita técnica (formato .heic, .jpg, .png ou pasta).

## Objetivo

Gerar automaticamente um novo Relatório Gerencial de Operação e Manutenção do Heliponto SNAW (topo do Edifício Armando Monteiro Neto — CEAMN, Brasília-DF), no mesmo padrão dos RGs anteriores, preservando integralmente o cabeçalho e alterando apenas: (1) número sequencial do RG, (2) mês de referência, (3) data da visita, (4) fotos analisadas e respectivas descrições técnicas, (5) conclusão contextualizada.

## Dados FIXOS do cabeçalho (nunca alterar)

Estes campos são invariáveis. Sempre reproduzir literalmente:

| Campo                                 | Valor                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **LOCAL**                             | Edifício Armando Monteiro Neto (CEAMN) — Brasília-DF                                                 |
| **DESIGNAÇÃO ROTAER**                 | SNAW — SENAI/SESI/CNI — HELPN PRIV UTC-3 HJ (Operação diurna VFR)                                    |
| **COORDENADAS**                       | 15°47'26" S / 047°52'46" W                                                                           |
| **ELEVAÇÃO**                          | 1.152 m MSL (3.779 ft)                                                                               |
| **CABECEIRAS**                        | 04 / 22                                                                                              |
| **DIMENSÕES / MATERIAL / CAPACIDADE** | 19,50 m × 19,50 m — Concreto (CONC) — 4 t (categorias L30 · L34)                                     |
| **JURISDIÇÃO**                        | CINDACTA I                                                                                           |
| **D-AMDT**                            | 31/23                                                                                                |
| **OBJETO**                            | PRESTAÇÃO DE SERVIÇOS DE CONSULTORIA AERONÁUTICA PARA O HELIPONTO                                    |
| **CONTRATADA**                        | AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA (AEROCAD CONSULTORIA & AEROPORTOS) — CNPJ 28.036.597/0001-43 |
| **CONTRATANTE**                       | Condomínio do Edifício Armando Monteiro Neto (CEAMN)                                                 |

Assinatura fixa: **Cleyton Borges Saraiva — Coordenador de Projetos — Aerocad Consultoria & Aeroportos**.

## Numeração e Nomeação

- Número do RG: `NN/AAAA` onde `NN` = número do mês da visita, `AAAA` = ano. Ex: visita em agosto/2026 → RG nº **08/2026**.
- Nome do arquivo: `AEROCAD_RG-NN_AAAA_SNAW-CEAMN.docx`
- Título do documento: `Heliponto SNAW — Edifício Armando Monteiro Neto (CEAMN) — Brasília-DF — Nº NN/AAAA`
- Mês de referência: nome do mês em MAIÚSCULAS + ano (ex: `AGOSTO/2026`).

## Processo de execução — passo a passo

### 1. Preparar imagens

Se as fotos vieram em `.heic`, convertê-las para `.jpg` (max 1600 px, qualidade 85) via ImageMagick:

```bash
mkdir -p /tmp/rg_cni_imgs
i=1
for f in $(ls /sessions/*/mnt/uploads/*20AAAAMMDD*.heic 2>/dev/null | sort); do
  ts=$(echo "$f" | grep -oP '20[0-9]{6}_[0-9]+')
  out="/tmp/rg_cni_imgs/foto_$(printf '%02d' $i)_${ts}.jpg"
  convert "$f" -resize "1600x1600>" -quality 85 "$out"
  i=$((i+1))
done
```

Ajustar `20AAAAMMDD` para a data real da visita.

Copiar as fotos convertidas para `/sessions/<sess>/mnt/outputs/_visita_cni/` para que possam ser lidas pela ferramenta Read (que requer paths do outputs).

### 2. Analisar cada foto com o Read tool

Ler todas as imagens (Read aceita JPG). Para cada uma, elaborar uma descrição técnica em 3 partes:

- **Elemento fotografado** — o que aparece (TLOF, platibanda, luminária, biruta, farol de obstáculo, safety net, sinalização, área de acesso etc.)
- **Diagnóstico técnico** — patologias identificadas (fissuras, corrosão, destacamento de revestimento, degradação de concreto, oxidação, envelhecimento, danos à impermeabilização, obstruções, deformações)
- **Recomendação técnica** — intervenção necessária (recomposição da impermeabilização, tratamento anticorrosivo, laudo estrutural, revitalização de pintura, selagem de fissuras, substituição de dispositivo, adequação à RBAC 155)

### 3. Gerar o documento

Usar o gerador Python abaixo (autocontido, baseado em `aerocad_base`). Substituir apenas:

- `MES_NUM` (2 dígitos)
- `ANO` (4 dígitos)
- `MES_NOME_MAI` (nome do mês em maiúsculas)
- `DATA_VISITA_STR` ("DD/MM/AAAA (HHhMM – HHhMM)")
- Lista `fotos` com os arquivos e descrições geradas na etapa 2

### 4. Publicar

- Aplicar patch DPI 1200 (via zip) no arquivo final
- Copiar para `/sessions/<sess>/mnt/outputs/AEROCAD_RG-NN_AAAA_SNAW-CEAMN_vHHMMSS.docx`
- Chamar `mcp__cowork__present_files` com o path final para exibir ao usuário
- Resumir para o usuário: nº do RG, mês, quantidade de fotos, principais achados, recomendações prioritárias

## Estrutura obrigatória do documento

1. **Título** (title_block)
2. **IDENTIFICAÇÃO** — heading + `Tabela 1 — Identificação do heliponto...` (kv_table com todos os dados FIXOS acima + mês e data da visita)
3. **1. INTRODUÇÃO** — parágrafo padrão
4. **2. ATIVIDADES DESENVOLVIDAS**:
   - a) DOCUMENTAÇÃO DO HELIPONTO
   - b) ASPECTO FÍSICO / ESTADO GERAL DA SUPERFÍCIE FATO — parágrafo introdutório + subseções `b.1` a `b.N` (uma por foto), cada uma com `Figura N — Título`, `Fonte: Aerocad (data · hora)`, e parágrafo "Situação atual: ..."
   - c) DADOS DE MOVIMENTO — remete ao Anexo I
   - d) OCORRÊNCIAS OPERACIONAIS
   - e) OUTROS
5. **3. CONCLUSÃO** — lista de intervenções prioritárias derivadas da análise fotográfica
6. Data (dinâmica) + assinatura Cleyton Borges Saraiva
7. Quebra de página → **ANEXO I — FICHA DE MOVIMENTO** — `Tabela 2 — Ficha de Movimento Operacional — Mês/Ano` (tabela 8 colunas: Data, Aeronave, Modelo, Origem, Destino, Pousos, Decolagens, Observações + linha de totais zerada)

Numeração sequencial obrigatória: Tabelas 1..N e Figuras 1..N em contadores globais.

## Regras estéticas (aerocad_base — obrigatórias)

- Logo AEROCAD 2026 no cabeçalho, linha laranja (#FF6A13) abaixo
- Fonte Arial, formato A4, margens padrão AEROCAD
- Cabeçalhos de tabela em laranja com texto branco bold
- Legendas de figuras/tabelas em negro bold, centralizadas
- `keep_with_next` em headings e legendas de tabela para evitar órfãos
- `evitar_orfa_cabecalho(tbl)` em toda tabela para não quebrar após header
- DPI 1200 embutido em `word/settings.xml`
- Data dinâmica via `data_hoje_extenso()` do aerocad_base

## Gerador Python (base autocontida)

Referência ao script mestre: `/sessions/<sess>/mnt/outputs/gen_rg_cni_08_2026.py`.
Ao gerar um novo RG:

1. Copiar o script como `gen_rg_cni_NN_AAAA.py`
2. Editar: `OUT`, `title_block` subtítulo, `MÊS DE REFERÊNCIA`, `DATA DA VISITA TÉCNICA`, `IMG_DIR`, lista `fotos`, subtítulo da Tabela 2
3. Executar e aplicar patch PDF quality
4. Salvar em outputs com timestamp e apresentar

Se o script mestre não existir na sessão atual, gerar do zero seguindo a estrutura acima e o padrão visual `aerocad_base` (make_doc, title_block, heading, subheading, add_para, kv_table, add_picture, signature_block, evitar_orfa_cabecalho, data_hoje_extenso).

## Comportamento esperado

- Não perguntar ao usuário sobre dados fixos do cabeçalho — usar sempre os valores tabelados acima
- Perguntar ao usuário APENAS se: (a) o mês/ano da visita não estiver evidente pelo nome dos arquivos ou timestamp EXIF, (b) houver dúvida sobre alguma foto crítica
- Se não houver visita registrada de pousos/decolagens, indicar "0 (zero)" na tabela do Anexo I e escrever no item d) "Não foram registradas operações de pouso e decolagem no período de referência"
- Sempre apresentar o arquivo final via `mcp__cowork__present_files`

<br>

---

_Fim do documento consolidado — AEROCAD® Pacote Completo._
