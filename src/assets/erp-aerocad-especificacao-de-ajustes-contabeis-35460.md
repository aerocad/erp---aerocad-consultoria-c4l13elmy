# ERP AEROCAD — Especificação de Ajustes Contábeis

Oct 23, 2026 · @Cleyton Borges Saraiva

## Resumo

O Balancete, o Balanço e a DRE do ERP não refletem os lançamentos já classificados no Plano de Contas, e o Patrimônio Líquido é calculado como valor de fechamento. Esta especificação define cinco ajustes no app e os testes que comprovam cada um.

Base: Plano de Contas revisado em 22/10/2026, extratos OFX de 2026 (Inter e Caixa), módulos de Empréstimos e Ativos, e a 4ª Alteração Contratual da AEROCAD Terraplanagem e Construção Ltda (CNPJ 28.036.597/0001-43), registrada na JCDF sob nº 2637593 em 27/11/2024. A empresa é optante pelo Simples Nacional (EPP).

## 1. Saldos de abertura e Patrimônio Líquido

O Capital Social deve vir do contrato social, informado manualmente, e nunca calculado. Hoje o sistema gera um valor de fechamento (R$ 32.855,61, depois R$ 12.477,34) sem lançamento.

**O que o contrato estabelece (4ª Alteração, 04/11/2024)**

| Sócio                             | Participação | Integralizado     | A integralizar (até 31/12/2027) | Total             |
| --------------------------------- | ------------ | ----------------- | ------------------------------- | ----------------- |
| Cleyton Borges Saraiva            | 80%          | R$ 177.600,00     | R$ 222.400,00                   | R$ 400.000,00     |
| Jaqueline Mota de Freitas Saraiva | 20%          | R$ 44.400,00      | R$ 55.600,00                    | R$ 100.000,00     |
| **Total**                         | **100%**     | **R$ 222.000,00** | **R$ 278.000,00**               | **R$ 500.000,00** |

**Tela nova: “Saldos de Abertura”**

1. Campo de data de abertura (padrão 01/01/2026) e, para cada conta analítica, valor e natureza (D/C).
2. Valores fixos a cadastrar:
   - 2.3.1 Capital Social Subscrito = R$ 500.000,00 (C)
   - 2.3.2 (–) Capital Social a Integralizar = R$ 278.000,00 (D)
3. Contas de bancos (1.1.1.01 Inter e 1.1.1.02 Caixa): saldo real de 31/12/2025, informado pelo usuário a partir do extrato.
4. Imobilizado: vir do módulo de Ativos (custo em 1.2.x e depreciação acumulada até 31/12/2025 em 1.2.12).
5. Empréstimos: saldo devedor em 31/12/2025 vindo do módulo de Empréstimos (2.1.6 / 2.1.7 / 2.2.1 / 2.2.2).
6. **2.3.4 Lucros ou Prejuízos Acumulados = diferença de fechamento**, calculada pelo sistema: Ativo – Passivo – (2.3.1 – 2.3.2). Exibir com o rótulo “ajuste de abertura – validar com o contador”.
7. Bloquear o cálculo automático do 2.3.1 em qualquer relatório.

**Integralização futura do capital:** novo tipo de lançamento “Integralização de Capital”, com sócio e valor, gerando D 1.1.1.0x (banco) / C 2.3.2. O sistema deve mostrar o saldo a integralizar por sócio e alertar quando faltar menos de 90 dias para 31/12/2027.

## 2. Partidas dobradas e base única dos relatórios

Todo movimento deve gerar um débito e um crédito de mesmo valor, e Balancete, Balanço e DRE devem ler a mesma base que o Plano de Contas. Hoje os relatórios só leem Contas a Pagar e Contas a Receber e ignoram os extratos classificados.

**Regras de geração das partidas**

| Origem                                        | Débito                                                   | Crédito                                                       |
| --------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Linha de extrato – saída                      | Conta classificada na linha                              | Banco da linha (1.1.1.01 ou 1.1.1.02)                         |
| Linha de extrato – entrada                    | Banco da linha                                           | Conta classificada na linha                                   |
| Linha de extrato conciliada com NFS-e/parcela | Banco                                                    | 1.1.2 Clientes (não receita, para não duplicar)               |
| Emissão de NFS-e / parcela de projeto         | 1.1.2 Clientes                                           | 4.1.x Receita                                                 |
| Recebimento de parcela sem extrato            | Banco escolhido no recebimento                           | 1.1.2 Clientes                                                |
| Conta a pagar – registro                      | Conta do Plano de Contas                                 | 2.1.x a pagar                                                 |
| Conta a pagar – pagamento                     | 2.1.x a pagar                                            | Banco                                                         |
| Transferência entre contas PJ                 | Banco de destino                                         | 1.1.7 (e 1.1.7 contra banco de origem; saldo da 1.1.7 = zero) |
| Pagamento de parcela de empréstimo            | 2.1.6/2.1.7 (amortização) + 3.5.2 (juros) + 3.5.3 (mora) | Banco                                                         |
| Depreciação mensal                            | 3.8.1                                                    | 1.2.12                                                        |

**Regras de negócio**

- Uma mesma linha de extrato nunca pode gerar receita/despesa e também baixar uma conta a pagar/receber: se estiver conciliada com um título, a contrapartida é o título.
- Lançamentos de pagamento de empréstimo vindos do extrato (“PREST EMP”, “CAIXA SIST EMPRESTIMO”, “STELLANTIS”) devem ser conciliados com a parcela do módulo de Empréstimos, e não lançados direto em 2.1.6/2.1.7, para não baixar a dívida duas vezes.
- O total de cada grupo deve ser a soma dos seus subgrupos (hoje o grupo 3 mostra R$ 55.821,05 com subgrupos somando R$ 1.592,81).
- O teste de equilíbrio do Balancete deve comparar a soma dos débitos com a soma dos créditos das contas analíticas. Nunca igualar a linha de totais artificialmente.

## 3. Contas redutoras e totais de grupo

Cada conta deve ter o atributo “natureza” (devedora/credora), e as redutoras são subtraídas do grupo em todos os relatórios. A DRE já subtrai o DAS; o Balancete ainda não aplica a regra a todas as redutoras.

| Conta                                   | Natureza | Reduz                                                                                                                     |
| --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1.2.12 (–) Depreciação Acumulada        | Credora  | Imobilizado                                                                                                               |
| 1.2.13 (–) Amortização Acumulada        | Credora  | Intangível                                                                                                                |
| 2.1.8 / 2.2.3 (–) Encargos a Apropriar  | Devedora | Empréstimos (usar só se a dívida for registrada com juros embutidos; hoje está pelo principal, então devem ficar zeradas) |
| 2.3.2 (–) Capital a Integralizar        | Devedora | Patrimônio Líquido                                                                                                        |
| 2.3.5 Distribuição de Lucros Antecipada | Devedora | Patrimônio Líquido                                                                                                        |
| 4.4.1 (–) DAS sobre o Faturamento       | Devedora | Receita Bruta                                                                                                             |

**Estrutura da DRE**

1. Receita Bruta (4.1)
2. (–) DAS (4.4.1)
3. = Receita Líquida
4. (–) Custos e Despesas (grupo 3, exceto 3.5.2/3.5.3 e 3.7)
5. (+/–) Resultado Financeiro (4.2 – 3.5.2 – 3.5.3)
6. (+/–) Resultado não operacional (4.3 – 3.7.1)
7. = Resultado do período, que no encerramento vai para 2.3.4.

A 2.3.5 (Distribuição de Lucros) não entra na DRE: é movimento de Patrimônio Líquido.

## 4. Distribuição de lucros por sócio

O sistema deve controlar a distribuição por sócio e comparar com a proporção do contrato (Cleyton 80%, Jaqueline 20%). Em 2026, os R$ 188.646,74 lançados em 2.3.5 foram todos pagos ao sócio Cleyton.

**O que implementar**

1. Campo obrigatório “Sócio” em todo lançamento classificado em 2.3.5.
2. Cadastro dos sócios com o percentual de participação: Cleyton 80% e Jaqueline 20%.
3. Painel “Distribuição por sócio” com: valor distribuído, valor proporcional ao contrato e diferença.
4. Alerta quando a distribuição acumulada no ano passar do lucro apurado na DRE do período, ou quando ficar desproporcional sem ata registrada.
5. Campo para anexar a ata de reunião de sócios que aprova distribuição desproporcional, se houver.

**Conta nova:** 1.1.8 Conta Corrente de Sócios (Ativo Circulante, devedora). Destino dos valores pagos ao sócio que não forem aprovados como lucro (adiantamento a devolver). A 1.1.6 atual (Adiantamentos de Viagens) deve ser mantida.

**Pró-labore:** a conta 3.4.2 fica disponível, sem uso hoje. Se os sócios fixarem pró-labore (cláusula 7ª), o lançamento deve gerar a retenção de INSS em 2.1.4. A definição é do contador.

## 5. Lançamento manual e outros ajustes

O contador precisa de uma tela de lançamento manual (débito/crédito) para registrar fatos sem extrato ou título. Hoje isso é impossível no app.

**Tela “Lançamento Contábil Manual”**

- Campos: data, histórico, uma ou mais linhas de débito e de crédito (conta + valor), anexo.
- Validação: soma dos débitos = soma dos créditos, senão bloqueia.
- Auditoria: usuário, data/hora e possibilidade de estorno (lançamento inverso), sem exclusão física.

Primeiros usos previstos: perda na troca do Civic pelo Jeep (16/10/2025, cerca de R$ 26.200,00 em 3.7.1), integralização de capital, encerramento do exercício e ajustes de abertura.

**Outros ajustes observados**

| #   | Problema                                                                                                    | Ajuste                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Recebimentos não debitam o banco (Inter e Caixa com débitos R$ 0,00 e saldos negativos)                     | Aplicar as regras da seção 2                                                                                         |
| 2   | Bens com status “Baixado/Alienado” continuam no total do imobilizado e continuam depreciando                | Excluir dos totais e parar a depreciação na data da baixa; gerar a baixa contábil (custo, depreciação e ganho/perda) |
| 3   | Ao salvar observação e reclassificar para conta nova no mesmo painel, a tela fica em branco e nada é salvo  | Corrigir o erro de renderização                                                                                      |
| 4   | Checkbox “Aplicar também às outras transações” vem marcado por padrão                                       | Deixar desmarcado e mostrar a lista do que será alterado antes de confirmar                                          |
| 5   | “Pagar Parcela (Etapa 3)” falha com “Invalid value outros” na 1ª tentativa; “Débito Automático” nunca grava | Corrigir o mapeamento da forma de pagamento                                                                          |
| 6   | “Já Apropriados: R$ 0,00” mesmo com parcelas com juros apropriados                                          | Somar os juros apropriados das parcelas                                                                              |
| 7   | “Apropriar Juros do Mês” com “todas as pendentes” inclui parcelas futuras (R$ 43.680,55)                    | Limitar à competência até o mês corrente                                                                             |
| 8   | DAS em aberto (R$ 117,39) aparece em 2.1.1 Fornecedores                                                     | Usar 2.1.3 Tributos a Recolher para títulos classificados em 4.4.1                                                   |
| 9   | Cronograma do PRONAMPE (Caixa) com taxa fixa e parcelas de R$ 2.931,23 sem carência de 12 meses             | Permitir editar o contrato (carência, taxa, datas) sem excluir; recalcular quando o contrato for enviado             |

## Critérios de aceite

Os ajustes só estão concluídos quando todos os testes abaixo passarem no Balancete de 2026 (exercício inteiro, todas as contas PJ).

| Teste                                                                                  | Valor esperado                                                                     |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Soma dos débitos = soma dos créditos (contas analíticas, sem forçar a linha de totais) | Iguais                                                                             |
| 2.3.1 Capital Social Subscrito                                                         | R$ 500.000,00 (C), fixo                                                            |
| 2.3.2 (–) Capital a Integralizar                                                       | R$ 278.000,00 (D)                                                                  |
| 2.3.5 Distribuição de Lucros                                                           | R$ 188.646,74 (D), com sócio informado                                             |
| 4.4.1 (–) DAS                                                                          | R$ 54.378,49 (D)                                                                   |
| Receita Líquida na DRE                                                                 | Receita Bruta – R$ 54.378,49                                                       |
| Bancos 1.1.1.01 e 1.1.1.02                                                             | Débitos ≠ zero; saldo final igual ao extrato de 16/10/2026                         |
| 1.1.7 Transferências entre Contas                                                      | Saldo zero                                                                         |
| Imobilizado líquido                                                                    | R$ 177.490,90 (igual ao módulo de Ativos)                                          |
| Empréstimos (principal)                                                                | R$ 136.831,62 (R$ 34.950,05 curto + R$ 101.881,57 longo), sem encargos a apropriar |
| Total de cada grupo                                                                    | Igual à soma dos subgrupos                                                         |
| Ativo                                                                                  | Passivo + Patrimônio Líquido + Resultado do período                                |

Depois de aplicado, o contador valida os saldos de abertura (2.3.4) e o tratamento fiscal da distribuição de lucros e do pró-labore.
