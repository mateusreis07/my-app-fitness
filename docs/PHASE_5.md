# Fase 5 — Nutrição

Fonte de produto: `KORA_MASTER_CONTEXT.md`, seções 27 a 31 (nutrição, refeições, alimentos, fontes, registro manual), 66 a 69 (tabelas), 81 (RLS), 102 (escopo do MVP) e 115 (índices). O contrato herdado está em `docs/PRODUCT_DECISIONS.md`.

## Escopo

Primeira fase em que o usuário **escreve dados de uso**: cadastrar alimentos, registrar refeições, ver o total do dia contra a meta, e o atalho de recentes. É também a fase que liga a capacidade `nutrition` do dashboard, desligada desde a Fase 4.

Entregáveis do roadmap: alimentos, refeições, `meal_items`, totais e recentes. Favoritos são explicitamente futuros.

## Decisão: a base de alimentos nasce vazia

A seção 30 pede "base oficial/importada" sem dizer qual. A pesquisa das candidatas encontrou consequências jurídicas diferentes:

| Fonte           | Situação                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------- |
| TBCA (USP)      | Consulta livre, mas **licença paga** para usar a base em outra ferramenta.               |
| TACO (UNICAMP)  | Termos de reúso **não verificados** — a página não expõe licença.                        |
| Open Food Facts | ODbL: uso comercial permitido, com **atribuição** e **share-alike** sobre base derivada. |

Decisão do responsável: **nenhuma importação nesta fase**. A tabela `foods` é criada com o esquema completo e fica vazia; a busca funciona sobre `user_foods`. A arquitetura não muda quando a base entrar — a consulta global já existe e já é exercitada por teste.

### Alimentos de teste na base global (23/09/2026)

Para exercitar busca e registro sobre a base global, foram inseridos **46 alimentos de referência** por `scripts/seed-foods.mjs`.

São **aproximações escritas à mão a partir de conhecimento público** — valores nutricionais de alimentos comuns são fatos, não obra protegida. **Não vieram da TACO, da TBCA, do Open Food Facts nem de qualquer base licenciada.**

Para que nunca sejam confundidos com base curada, a migration `0006_food_source_seed.sql` acrescentou o valor `seed` ao enum `food_source`. Todas as linhas entram com `source = 'seed'` e `verified = false`. Marcá-las como `official` seria apresentar dado de teste como se fosse verificado, o que o invariante 3 proíbe.

Somem com um comando: `node scripts/seed-foods.mjs --remove`. **Precisam ser substituídas por uma fonte verificada antes do beta.**

Segunda decisão: **registro só do dia corrente**. `meal_date` já nasce pronta para datas anteriores, mas a navegação por dia entra com a tela de histórico.

## A armadilha do fuso

`selectDailySignals` compara a chave do dia por **igualdade exata de string**. Gravar `meal_date` com a data UTC faria os registros feitos à noite no Brasil sumirem do dashboard, sem erro nenhum — apenas "aguardando registros".

Por isso `useNutritionDay` deriva o dia de `dashboardClock(new Date(), timeZone)`, o mesmo relógio do dashboard, com o fuso do perfil. A coluna tem comentário no banco dizendo isso.

## Decisões de modelagem

- **`foods` é global e só de leitura pelo cliente** (seção 81): política de `select` para qualquer autenticado, e o `grant` concede apenas `select`. A carga virá por rotina de servidor.
- **Snapshots em `meal_items`** (seção 69): nome, quantidade, unidade e os quatro macros são copiados no momento do registro. As chaves para alimento usam `on delete set null`, então **apagar um alimento não reescreve o histórico** — o item continua legível e continua somando.
- **Uma refeição por tipo por dia**, garantida por índice único `(user_id, meal_date, meal_type)`. O registro usa upsert, então dois toques seguidos não criam duas refeições.
- **`meal_items` não guarda `user_id`.** A posse vem da refeição, verificada por subconsulta na política. Mantém o esquema do documento mestre e evita duas fontes de verdade sobre o dono.
- **CHECK de origem única**: um item aponta para a base global ou para um alimento do usuário, nunca para os dois.
- **`mealCount` conta refeições com item**, não refeições criadas. Uma refeição vazia não é registro — e é esse número que impede o motor de prioridades de ler "não registrou" como "comeu pouca proteína".
- **Recentes sem tabela nova**: saem do próprio histórico, das últimas refeições do usuário. Item cujo alimento foi apagado não volta como atalho, porque não há porção de onde reconstruir um novo registro.

## Reúso em vez de código novo

- `parseDecimal` saiu de `src/features/onboarding/validation.ts` para `src/lib/number.ts`, e agora serve aos dois. A regra de vírgula decimal existe uma vez só.
- Arredondamento por `src/lib/rounding.ts`, como manda o `AGENTS.md`.
- `Metric`, já exportado por `DashboardView.tsx`, é reusado na tela de nutrição — ele já trata `null` corretamente.
- `fetchCurrentTargets` de `src/features/fitness/targets.ts` é reusado para a meta, sem nova consulta.
- `Page`, `Card`, `Field`, `ActionButton`, `FormNotice` e `ChoiceGroup` vieram dos componentes existentes.

## Migrations

`0005_nutrition.sql` — enums `meal_type` e `food_source`; tabelas `foods`, `user_foods`, `meals` e `meal_items`; índice único de refeição por tipo por dia; índices de `(user_id, meal_date desc)` e `(meal_id)`; RLS nas quatro tabelas com política por verbo; e privilégios explícitos.

## Ligação com o dashboard

`DashboardScreen.tsx` passa as **três** props juntas: `signals`, `capabilities` e `onPriority`. A ordem importa porque `DashboardView` tem `capabilities: onPriority ? capabilities : DASHBOARD_CAPABILITIES` — sem o handler, as capacidades são ignoradas em silêncio.

A leitura da nutrição é separada da leitura do dashboard, para uma falha não derrubar o painel de metas. Enquanto carrega ou falha, o bloco vai `null`, que a tela mostra como "aguardando registros" — nunca zero. Água, peso e treino continuam desligados.

## Critérios de aceite

- [x] Cadastrar alimento do usuário, com validação de nome, porção, unidade, calorias e macros.
- [x] Registrar alimento em uma refeição: escolher refeição, buscar, selecionar, informar quantidade, confirmar (seção 31).
- [x] Atalho de recentes.
- [x] Total do dia e por refeição, comparados com a meta quando existe.
- [x] Remover item registrado.
- [x] Estados distintos para carregando, vazio, erro e sem meta.
- [x] Capacidade `nutrition` ligada no dashboard, com a prioridade de proteína passando a ter dado real.
- [x] TypeScript, ESLint, Prettier e 112 testes passam. Export Android/iOS/web gerado.

## Testes

29 testes novos em `src/features/nutrition/`:

- `quantity.test.mts` (7) — proporção, porções diferentes de 100, arredondamento inteiro, e o conjunto de entradas inválidas que devolve `null` em vez de zero disfarçado.
- `totals.test.mts` (7) — dia vazio, soma entre refeições, refeição sem item que não conta, valor inválido que não vira `NaN`, e a prova de que o formato produzido sobrevive ao filtro `selectDailySignals` — inclusive o caso do dia errado ser descartado.
- `validation.test.mts` (6) — quantidade com vírgula, zero legítimo em caloria e macro mas não em porção, limites de tamanho e espaço em branco.
- `repository.test.mts` (9) — com cliente simulado: lista de tabelas permitida, filtro por dono em toda consulta, `abortSignal` propagado, busca vazia que não vai ao banco, curingas do usuário neutralizados, ordem das escritas, chave certa conforme a origem do alimento, e falha que impede a gravação seguinte.

## Validação executada

- `npm run check`: TypeScript, ESLint e Prettier sem erros; **112 testes aprovados** (eram 83).
- `npm run migrate`: migration aplicada; conferido que as quatro tabelas têm RLS e que `anon` não recebeu privilégio algum.
- `scripts/rls-nutrition-check.sql` contra o projeto real, em transação revertida: cada usuário vê só o próprio alimento, refeição e item; escrita na base global negada por falta de privilégio; insert em refeição alheia bloqueado pela RLS; delete em item alheio não afeta linha; `TRUNCATE` negado nas quatro tabelas; refeição duplicada bloqueada pelo índice; item com duas origens bloqueado pelo CHECK; e **apagar o alimento preserva o item registrado**.
- **Ponta a ponta pela API REST**, importando os módulos de cálculo do próprio app, com dois usuários reais: cadastro de alimento `201`, refeição criada `201`, item registrado `201`, upsert reaproveitando a mesma refeição, totais lidos do banco batendo com o motor (186 kcal para 150 g), isolamento entre os dois usuários, insert em refeição alheia `403`, escrita na base global `403`, e o item preservado após o alimento ser apagado. 14/14. Usuários de teste removidos.
- `npm run build:native`: bundles Hermes Android/iOS e as rotas novas `/add-food` e `/new-food` exportadas.

## Limites conhecidos

- ~~Revisão visual pendente.~~ **Feita pelo dono em 23/09/2026**, com uso real: alimento próprio cadastrado, itens das duas origens registrados em três refeições, total conferido na aba Hoje e aritmética validada linha a linha contra os valores de origem.
- A base global está vazia, então a busca só encontra o que o usuário cadastrou. É esperado e está explicado na tela.
- Não existe edição de item registrado: só adicionar e remover.
- Não existe registro de dia anterior nem tela de histórico.
- O fluxo de gravação não é transacional. Se o item falhar depois da refeição ser criada, sobra uma refeição vazia — que a tela mostra como "nada registrado" e que não entra em `mealCount`.
- A busca não tem espera entre teclas: cada alteração dispara uma consulta, descartando respostas fora de ordem por contador. Para a lista do próprio usuário é barato; ao entrar uma base grande, vale reavaliar.

## Próxima fase

Fase 6 — Hidratação: meta, registro e progresso de água. A meta já existe em `nutrition_targets.water_ml`; falta a tabela de registro e ligar a capacidade `water` do dashboard, hoje desligada.
