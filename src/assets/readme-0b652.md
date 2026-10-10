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
