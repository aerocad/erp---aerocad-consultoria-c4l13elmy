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
