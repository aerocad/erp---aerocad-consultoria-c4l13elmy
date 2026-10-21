# AEGIS — Visão Geral Funcional, Comercial e Estratégica

> **Plataforma de planejamento de proteção de aeródromos** — Aerocad Consultoria & Aeroportos
> Documento de referência único · Versão do produto: **v1.9.384** · Atualizado em: 21/10/2026
> **CONFIDENCIAL** — uso interno e avaliação de investimento. Números comerciais marcados **[A VALIDAR]** dependem de dados internos da administração.

---

## 1. O que é o AEGIS

O AEGIS é uma plataforma (plugin sobre QGIS, gratuito) que automatiza o cálculo das **superfícies aeronáuticas de proteção brasileiras** conforme a **ICA 11-408/2020** (DECEA/COMAER) e gera todos os produtos do processo: planta técnica em DXF no padrão oficial, modelos 3D, análise de interferência de obstáculos/terreno e a documentação técnica (memoriais, laudos, fichas e anexos).

**Problema que resolve.** A implantação, ampliação e regularização de aeródromos e helipontos no Brasil exige planos de zona de proteção (PBZPA e correlatos) e análises de obstáculos (OPEA). Hoje esse trabalho é majoritariamente **manual** — combina CAD, planilhas, GIS genérico e checagem normativa peça por peça. É lento, dependente de especialistas escassos, sujeito a erro humano e difícil de auditar; cada exigência de revisão do DECEA reinicia parte do ciclo. O AEGIS transforma dias de trabalho especializado em minutos, de forma consistente, repetível e auditável.

**Norma de referência:** ICA 11-408/2020 (PBZPA, PZPANA, PBZPH, OPEA), com aderência ao Anexo 14 da ICAO; PZPANA conforme ICA 63-19.
**Usuário principal:** engenheiro aeronáutico responsável por processos junto à ANAC/DECEA; consultorias; operadores; e o mercado de construção civil (via OPEA).
**Fabricante:** Aerocad Terraplanagem e Construção Ltda (Aerocad Consultoria & Aeroportos), CNPJ 28.036.597/0001-43 — Brasília/DF.

---

## 2. Estágio atual do produto

- **Produto funcional e em uso real** (muito além de um MVP), em desenvolvimento iterativo contínuo.
- Fluxo completo: **PBZPA**; **PZPANA** (inclusive VASIS/PAPI e superfícies direcionais GS/LOC/ALS); e **OPEA** com vista 3D.
- Entregáveis oficiais: **plantas DXF**, **KMZ 3D**, **Ficha Anexo A / Anexo E**, laudos e memoriais.
- Base de código: ~44 mil linhas de Python — **motor de cálculo independente** (~16,7 mil linhas, QGIS-independente) + **aplicativo QGIS** (~27,6 mil linhas). Instalador próprio e suíte de testes automatizados (pytest).
- Arquitetura com motor desacoplado da interface — pré-condição para evolução SaaS e para proteção de PI.

---

## 3. Arquitetura técnica

```
AEGIS
├── aegis/                      Motor de cálculo (Python puro)
│   ├── aerodrome/              Banco ANAC, AISWEB, Portal AGA, declinação, THR
│   ├── geometry/               UTM↔Lat/Lon, along-track, offsets
│   ├── surfaces/               compute_pbzpa() → superfícies com cota MSL
│   ├── analysis/               interferência obstáculo×superfície, terreno, OPEA, PZPANA
│   ├── export/                 DXF (ezdxf), 3D (KMZ/COLLADA)
│   ├── io/                     projeto .aeg, geradores de documento (docx), situação OPEA
│   └── standards/              tabelas normativas ICA 11-408
└── aegis_plugin/ (QGIS)        Abas: Novo, Aeródromo, Superfícies, Planos (AGA),
                                Obstáculos, Análise, Banco, Documentos, OPEA
```

**Princípios de engenharia:** coordenadas em UTM internamente (Lat/Lon só na saída); cálculos pesados em `QThread` (nunca bloqueiam a UI); camadas QGIS com prefixo `AEGIS_`; fonte única de elevação (`terrain_sources`); sinais PyQt sempre via `dict`.

---

## 4. Funcionalidades — por domínio

### 4.1 PBZPA (Plano Básico de Zona de Proteção de Aeródromo)

- Motor completo das superfícies parametrizado pelas Tabelas 4-3/4-4/4-5 da ICA 11-408: Faixa, Horizontal Interna (SHI), Cônica, Horizontal Externa (HE), Aproximação, Decolagem, Transição, Superfícies de Voo Visual e internas de Precisão (AI/TI/PI).
- Cotas MSL propagadas por superfície (`elev_model`, `elevation_at`, `contains_2d`).
- **Divergência assimétrica por lado** (ficha E7/E8): esquerdo ≠ direito, aplicada na geometria com fallback simétrico da tabela.
- Multi-pista (paralelas e cruzadas) com tratamento individual.
- Validado contra a ficha Anexo A oficial (caso SBBR).

### 4.2 PZPANA (proteção dos auxílios à navegação)

- Superfícies dos auxílios (VOR/DVOR, DME, ILS GS/LOC, ALS, VASIS/PAPI, radar) com visualização, rótulos e estilo por tipo.
- Integra-se à análise OPEA junto com o PBZPA (ver 4.4).

### 4.3 PBZPH (heliponto) — roadmap

- Próximo grande degrau da Fase 1 (a mesma ICA 11-408 rege os três planos); motor hoje cobre PBZPA/PZPANA.

### 4.4 OPEA (Objeto Projetado no Espaço Aéreo) — módulo de viabilidade construtiva

O vetor que conecta o mundo aeronáutico ao mercado de construção civil. Responde: **"até que altura é possível construir aqui, sem violar o espaço aéreo?"**

- **Consulta de altura máxima permitida** por CEP, endereço ou coordenada (geocodificação em cascata via BrasilAPI).
- **Levantamento e carga de vértices** (CSV, planta+corte), auto-detecção de fuso UTM, base por vértice (SRTM) e por superfície; subestruturas (casa de máquinas, caixa d'água) como cotas adicionais.
- **Análise de interferência OPEA × PBZPA + PZPANA no mesmo lote** (uma execução), com penetração (Δh) por plano e indicação do plano de cada superfície violada.
- **Altura máxima construível por polígono** (importado KML/KMZ/CSV ou desenhado): varredura em malha fina, **mapa de calor** (verde=folga, vermelho=restrição), ponto crítico governante e **governante por plano** (PBZPA e PZPANA separadamente).
- **Altura pretendida → área destacada:** dado o gabarito desejado, destaca no mapa e exporta a **área construível (verde)** e a **área que interfere (vermelho)**, dissolvida e recortada ao lote.
- **Fontes de terreno:** nuvem de pontos do levantamento do cliente (IDW, precisão centimétrica), MDE (SRTM 30 m / Copernicus GLO-30) ou base fixa.
- **Exportações:** Anexo D (Decl. Interesse Público), Anexo E (vértices) em xlsx/CSV/docx, KML, KMZ, KMZ 3D e o polígono-resultado colorido (comporta/não comporta) em KMZ/KML/CSV georreferenciado.
- **Plantas DXF no padrão DECEA:** Planta de Situação e Perfil, com cartografia (curvas, vias, hidrografia, edificações de OSM/IBGE/WFS oficial), grade de coordenadas, rosa de declinação dinâmica (WMM-2025), carimbo, datum SIRGAS e logo vetorial.
- **Documentação técnica automatizada:** Laudo Técnico, Memorial Descritivo e de Cálculo e Estudo de Viabilidade Técnica, no template Aerocad — incluindo **figura automática** da área destacada, impactos por plano, glossário, referências e ressalvas. **Estudo Comparativo multi-área** consolida várias áreas candidatas com recomendação técnica.
- **Vista 3D do entorno** (OSM + gradiente de violação, KMZ 3D para Google Earth).

### 4.5 Entregáveis transversais

- **DXF multilayer** no padrão DECEA, com rótulos por pista (cartografia pelo mesmo motor da PBZPA).
- **3D:** KMZ georreferenciado (Google Earth) e COLLADA (.dae, SketchUp).
- **Mapa temático / encarte** PBZPA (legenda, norte verdadeiro, escala, logo) em PNG/JPG/PDF.
- **Projeto .aeg** (salvar/restaurar estado e camadas).
- **Resumo técnico** com todos os parâmetros ICA por código/tipo.

---

## 5. Integrações e fontes de dados oficiais

| Fonte                                      | Uso                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------- |
| Banco ANAC (CSV, ~4.283 aeródromos)        | Base primária de aeródromos, com fallback AISWEB                     |
| AISWEB DECEA                               | Dados de aeródromo (fallback online)                                 |
| Portal AGA DECEA                           | Ficha Anexo A, portarias PBZPA, KML "Linha entre cabeceiras"         |
| GeoAISWEB (WFS ICA:opea)                   | Banco oficial de obstáculos DECEA (~158 mil) — roadmap de importação |
| OpenTopoData SRTM 30 m / Copernicus GLO-30 | Elevação de pontos e curvas de nível                                 |
| OSM Overpass                               | Estradas, rios, edificações (cartografia)                            |
| IBGE / WFS oficiais                        | Camadas cartográficas oficiais                                       |
| WMM-2025                                   | Declinação magnética (rosa dinâmica)                                 |
| BrasilAPI                                  | Geocodificação por CEP/endereço                                      |

Integração nativa com fontes oficiais brasileiras reduz redigitação — causa frequente de retrabalho — e é um componente central do fosso competitivo.

---

## 6. Diferenciais (produto)

1. **Fidelidade normativa:** a ICA 11-408 está codificada em geometria (superfícies, gradientes, tabelas) e validada contra fontes oficiais — não é um GIS genérico.
2. **Entregáveis oficiais prontos:** planta DXF, 3D e Anexo A/E no formato aceito pelo DECEA — não apenas resultados de cálculo.
3. **Análise combinada PBZPA + PZPANA:** erro clássico do mercado é olhar só o PBZPA; o AEGIS enxerga os dois.
4. **Resposta em nível de lote (OPEA):** varre o polígono inteiro e entrega mapa de calor + área construível, não só a altura de um ponto.
5. **Terreno do próprio cliente:** levantamento planialtimétrico entra no cálculo; MDE quando não há.
6. **Cadeia ponta a ponta:** do dado oficial ao documento assinável, em uma só ferramenta.
7. **Plataforma gratuita (QGIS):** sem custo de licença Autodesk/Bentley/Esri.

---

## 7. Benchmark competitivo

Referências de mercado (benchmark Aerocad, jun/2026 — reconfirmar antes de uso externo):

| Dimensão                        | SkySAFE (Transoft) | Esri ArcGIS Aviation       | PDToolkit/AEROSafeGuard | **AEGIS**                 |
| ------------------------------- | ------------------ | -------------------------- | ----------------------- | ------------------------- |
| Plataforma base                 | AutoCAD/Civil 3D   | ArcGIS Pro+Online          | MicroStation/AutoCAD    | **QGIS — gratuito**       |
| Conformidade DECEA/ANAC         | Não                | Não                        | Não                     | **Sim, nativo**           |
| Integração AISWEB/DECEA         | Não                | Não                        | Não                     | **Sim**                   |
| Processo OPEA / dossiê BR       | Não                | Não                        | Não                     | **Sim**                   |
| Altura construível por lote     | Não                | Não                        | Não                     | **Sim**                   |
| Superfícies OLS/PBZPA           | Completo           | Completo                   | Completo                | **Completo (ICA 11-408)** |
| Procedimentos de voo (PANS-OPS) | Não                | Não                        | Sim (núcleo)            | Não                       |
| Obstáculos temporários          | Sim                | Parcial                    | Sim                     | Lacuna                    |
| 3D / LiDAR                      | 2D/3D no CAD       | Sim + LiDAR                | 3D nativo               | QGIS 3D; LiDAR não        |
| Abrangência regulatória         | ICAO/FAA/EASA      | ICAO/FAA/UFC               | ICAO/EASA/FAA/CAP168    | Brasil + Anexo 14         |
| Maturidade                      | Multinacional      | Líder mundial              | Estabelecido (UK)       | Early-stage               |
| Relação com a Aerocad           | Concorrente        | Concorrente **e parceiro** | Concorrente             | Produto próprio           |

**Leitura:** há paridade no núcleo de superfícies/penetração; o AEGIS ultrapassa todos no **encaixe regulatório brasileiro** e no **custo de plataforma**. Os concorrentes lideram em abrangência internacional e maturidade enterprise (vantagens de empresas estabelecidas, não de superioridade conceitual). A **Esri** é a única que aparece também como **parceira** potencial (nuvem, 3D/LiDAR, gestão de processos). Nenhum concorrente cobre DECEA/ICA 11-408, AISWEB ou o dossiê protocolável brasileiro.

---

## 8. Mercado e modelo de negócio

### 8.1 Quem sente a dor

Consultorias de engenharia aeroportuária; operadores de aeródromos e helipontos (públicos e privados); prefeituras e órgãos que processam os planos; e — via OPEA — incorporadoras, construtoras, arquitetos e fundos imobiliários. A demanda é **compulsória** (obrigação legal derivada de norma ICAO), o que sustenta recorrência e churn estruturalmente baixo.

### 8.2 Base factual de mercado (Fonte: ANAC out/2025; ICAO 2025)

- Brasil: **498 aeródromos públicos + 3.688 privados** (4.186 aeródromos), **199 helidecks + 1.526 helipontos** — cerca de **5.900 sítios** que exigem plano de proteção e geram fluxo recorrente de estudos de obstáculo.
- Norma deriva da ICAO, com **193 Estados signatários** — define o mercado global de nicho.

### 8.3 Modelos de receita (o motor desacoplado permite coexistirem)

- **Licença por assento/ano** (consultorias de uso recorrente).
- **Cobrança por projeto/entregável** (quem precisa de um plano específico).
- **SaaS por assinatura** (evolução natural do motor para a nuvem).
- **Serviço produtizado:** a própria Aerocad entrega planos usando a ferramenta — gera receita e valida o produto.
- Ancoragem de preço sugerida: **custo evitado** (horas de especialista/projeto) + valor de prazo/risco reduzido. Preços específicos: **[A PREENCHER]**.

### 8.4 Go-to-market (proposta)

Aterrissar pela própria Aerocad e por consultorias parceiras (pilotos pagos) → expandir por indicação no nicho (comunidade pequena e conectada) → evoluir para autoatendimento (SaaS) quando o produto estiver endurecido.

---

## 9. Dimensionamento e valuation **[A VALIDAR]**

> Faixas **indicativas**, reproduzíveis no modelo `AEGIS_Valuation_Modelo.xlsx` (premissas editáveis). **Não** constituem aconselhamento financeiro nem avaliação formal; dependem de validação da administração.

- **SAM Brasil:** ~**R$ 17,2 milhões/ano**. **TAM LATAM:** ~**R$ 86 milhões/ano**.
- Premissas do SAM: ~500 consultores (R$ 12k/ano), ~400 prefeituras prioritárias (R$ 20k/ano), ~200 construtoras/incorporadoras (R$ 6k/ano), ~50 operadores (R$ 40k/ano).
- **Valuation hoje (estágio inicial, baixa receita):** faixa **R$ 3–12 milhões** (valor de potencial: produto validado, fosso regulatório, liderança de nicho), deslizando para o topo conforme primeiros clientes pagantes, parceria Esri e registro de PI no INPI.
- **Em escala (rodada/saída em 3–5 anos):** caminho plausível para **R$ 26–66 milhões**, por múltiplo de ARR (SaaS vertical regulado costuma negociar a **5–8× ARR** no mercado privado).

### Drivers de valor

Recorrência por força de lei (churn ≈ 0); baixa elasticidade de preço (laudo errado custa muito mais que a licença); barreira regulatória (norma + integração com a autoridade); opcionalidade (parceria Esri e vetor eVTOL/AAM ampliam o TAM sem trocar o motor).

### Riscos

Nicho (número absoluto pequeno de clientes); estágio inicial (receita a comprovar, execução comercial a provar); dependências (pessoa-chave, mudanças normativas, custo de internacionalização). São os itens que, endereçados, movem o valor do piso ao teto da faixa.

---

## 10. Fosso competitivo (defensibilidade)

1. **Conhecimento normativo codificado e validado** — ICA 11-408 traduzida em geometria; replicar exige tempo e expertise rara.
2. **Fidelidade aos entregáveis oficiais** (planta, 3D, Anexo A/E) — reduz atrito de aprovação no DECEA.
3. **Integração com a autoridade** (DECEA/AGA, AISWEB, banco ANAC) — barreira local que produtos internacionais não têm incentivo a construir.
4. **Padrão de desenho aderente à autoridade** — obtido por engenharia reversa de projetos efetivamente aprovados.
5. **Ativos acumulados** — templates oficiais, casos validados, base de dados e integrações.
6. **Aerocad como canal e laboratório** — credibilidade no setor e validação contínua do produto.
7. **Arquitetura pronta para SaaS** — caminho de escala e lock-in via dados/projetos.

---

## 11. Roadmap e opcionalidades

- **Fase 1 (fechamento):** PBZPH (heliponto) — gerar superfícies/DXF/Anexo A.
- **Anexo E automatizado** (ICA 63-19) a partir do banco de obstáculos DECEA (WFS ICA:opea).
- **Obstáculos temporários** (guindastes de obra) — hoje lacuna frente a SkySAFE/AEROSafeGuard.
- **Sensoriamento remoto / drones:** o mesmo motor passa a operar com ortofoto/MDT/MDE/LiDAR (RTK/PPK), automatizando a detecção de obstáculos que penetram a PBZPA com precisão de levantamento. Triplo ganho: amplia o mercado, aprofunda o fosso (dado proprietário do cliente) e abre receita de levantamento + análise integrados.
- **Parceria Esri:** camada de localização regulatória Brasil/LATAM sobre a plataforma deles (distribuição global, nuvem, 3D/LiDAR).
- **Vetor eVTOL / AAM:** novos sítios e novas regras ampliam o TAM sem trocar o motor.
- **Evolução SaaS** (nuvem) quando o produto estiver endurecido.
- **Proteção de PI:** registro no INPI (marca e software) — licença proprietária/"All Rights Reserved".

---

## 12. Mensagens de posicionamento

**Tese central.** A Aerocad deixa de ser a consultoria que "faz o estudo" e passa a ser a que **responde, com rastreabilidade, a pergunta que decide o negócio do cliente** — "até onde eu posso subir aqui?" — e entrega a resposta assinada.

**Para construção civil / incorporação:**

- "O limite do seu terreno não está no plano diretor. Está no céu."
- "Antes de comprar o terreno, descubra até onde dá para subir — no lote inteiro."
- "Passou no PBZPA e travou no PZPANA? A gente olha os dois."
- "Do polígono ao laudo assinado."

**Para o setor aeronáutico:**

- "Seu plano de proteção, no padrão da autoridade — e sempre atualizado."
- "Obstáculos: do banco oficial ao Anexo E, sem digitar."
- "PBZPA e PZPANA na mesma plataforma."

**Resumo de uma linha:** _Aerocad + AEGIS: o limite aeronáutico do seu terreno, mapeado no lote inteiro, com PBZPA e PZPANA analisados juntos — e entregue em laudo técnico assinado._

---

## 13. Ressalvas (uso responsável)

- **Não prometer aprovação.** Os produtos do AEGIS são **apoio técnico à decisão** e **não substituem** a análise e os pareceres das autoridades (DECEA/COMAER, ANAC, órgãos municipais/estaduais). A responsabilidade técnica é do RT, mediante ART/RRT.
- **Não usar métricas de desempenho sem medir** ("90% mais rápido", "10x") até haver medição real.
- **Transparência sobre precisão do terreno:** com MDE o erro vertical é de alguns metros; com levantamento, muito menor. Recomendar margem de segurança é postura técnica.
- **Não anunciar o que não está pronto** (PBZPH, drones) antes da entrega.
- **Números comerciais [A VALIDAR]** dependem de dados internos e devem ser confirmados pela administração.

---

_Fontes: CLAUDE.md e código-fonte do AEGIS (v1.9.384); AEGIS Data Room (itens 01 Sumário, 05 Mercado, 09/17 Benchmark, 12 Valuation); campanha de vantagens competitivas (Aerocad); ANAC — Cadastro de Aeródromos (out/2025); ICAO — Member States (2025). Descrições de concorrentes conforme benchmark jun/2026 — reconfirmar antes de distribuição externa._
