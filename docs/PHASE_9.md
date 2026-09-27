# Fase 9 — Score + Streak

Implementada em 25/09/2026. Fonte: seções 45 a 48 (índice de aderência, composição, normalização, streak), 77 (tabela) e roadmap Fase 9 (2240) do `KORA_MASTER_CONTEXT.md`.

## Entrega

- KORA Score do dia, calculado ao vivo, com status e comparação com a média dos últimos 7 dias — card no topo do Dashboard Hoje (seção 88: é o primeiro elemento visual da tela, movido para acima da Energia).
- Tela `/score`: detalhamento dos cinco componentes de hoje, streak atual e recorde, gráfico de barras dos últimos 14 dias.
- Fechamento tardio de dias passados em `daily_scores`, feito pelo próprio cliente (sem servidor/cron neste projeto).
- Streak calculado a partir do histórico, nunca persistido — não existe tabela de streak.

## Regras

Seção explícita para corresponder ao quarto entregável do roadmap ("regras").

1. **Componentes e pesos** (seção 46, valores do próprio documento): nutrition 25%, protein 20%, hydration 15%, workout 25%, consistency 15%.
2. **Calorias** (seção 47, fórmula própria — o documento só pede "proximidade da faixa"): desvio ≤ 10% do alvo pontua 100; acima disso, decai linearmente até 0 num desvio de 50%, para qualquer lado. Faltar ou passar da meta penaliza igual.
3. **Proteína** (fórmula explícita da seção 47) e **hidratação** (extensão da mesma lógica, sem ressalva do documento contra ultrapassar): `min(consumido/meta, 1) × 100`.
4. **Treino**: dia sem plano ativo ou sem dia programado vale 100 — decisão do responsável, para não gerar culpa em dia de descanso. Só cai a 0 quando havia treino programado e ele não foi concluído.
5. **Consistency**: fração das três áreas registráveis (refeição, água, treino) com pelo menos um registro no dia, independente de ter batido a meta. Distingue "não registrei nada" de "registrei e fiquei longe do alvo", que os outros componentes já penalizam sozinhos.
6. **Total**: soma ponderada dos cinco. **`null` quando não havia meta nutricional vigente no dia** — nutrition/protein/hydration vêm da mesma linha de `nutrition_targets` e ficam nulos juntos. Sem meta não é score zero, é ausência de score, estendendo o invariante 12 ("sem meta não é zero").
7. **Streak**: "dia bom" é `total_score ≥ 50` — decisão do responsável. A sequência atual conta os dias fechados mais recentes enquanto forem bons; um dia abaixo do limite ou um buraco no histórico interrompe a contagem atual, mas nunca apaga o recorde (`longestStreak`). Streak Freeze (seção 48) é `Futuro`, fora desta fase.
8. **Fechamento de dia**: feito pelo cliente, de forma tardia. A cada abertura do app, os últimos 30 dias sem linha em `daily_scores` são fechados (hoje nunca é persistido — é sempre calculado ao vivo). Um hiato maior que a janela vira lacuna no histórico, como qualquer "dia sem registro" do projeto.
9. **Versionamento**: `SCORE_ALGORITHM_VERSION` (`kora_score@1.0`) gravado em cada linha — mudar peso ou fórmula no futuro não reescreve histórico já fechado, mesmo espírito de `FITNESS_ENGINE_VERSION`.

## Decisões técnicas e de produto

1. **Duas decisões confirmadas com o responsável** antes da implementação: o limite de streak (`≥ 50`, entre as opções "qualquer registro" e "≥ 70") e o valor do componente de treino em dia de descanso (`100`, entre "100" e "excluído do peso"). Ambas registradas nas regras acima.
2. **Sem tabela de streak.** É sempre derivado do histórico de `daily_scores`, no mesmo espírito de `trend.ts` calcular a tendência de peso sem persistir a média móvel.
3. **Score de hoje nunca é persistido.** `dayComponents`/`totalScore` (puros, em `model.ts`) são chamados tanto no dashboard/tela (com os hooks já existentes de nutrição/água/treino) quanto em `closeDayScore` (com leituras históricas) — a mesma conta em um lugar só, sem duplicar fórmula.
4. **Upsert por chave natural (`user_id, score_date`), não por UUID de cliente.** Diferente do protocolo de idempotência das Fases 6/7/8: fechar um dia é uma escrita derivada e determinística, não um toque do usuário sujeito a duplo-clique em rede instável.
5. **Limitação assumida e documentada**: o componente de treino de um dia fechado no passado reusa o estado **atual** do plano ativo (mesmo `scheduled`/`completed` de `loadTodaySignal`), não uma reconstrução histórica de qual plano estava ativo naquele dia exato. Reconstruir isso exigiria uma tabela de histórico de plano, fora do escopo desta fase.
6. **Sem badges/conquistas/gamificação avançada** (seções 103 e 123 — `Futuro`, fora do MVP).
7. **KORA Score movido para o topo do Dashboard Hoje**, antes do card de Energia — a seção 88 lista o Score como o primeiro elemento visual da tela, e o card antes ficava depois das prioridades.

## Banco e privilégios

Migration aplicada: `0010_daily_scores.sql`. Tabela `daily_scores`: RLS por posse direta de `user_id`; `select`, `insert`, `update` concedidos (sem `delete` — um dia fechado só é corrigido por upsert, mesmo padrão de `nutrition_targets`/`goals`); CHECKs nomeados garantindo cada componente entre 0 e 100; `unique(user_id, score_date)` impede um segundo fechamento do mesmo dia. `revoke all` de `anon`/`authenticated` antes de conceder, como em toda migration desde a `0002`.

`database.types.ts` atualizado na mesma mudança: `DailyScore`, com os três componentes nutricionais e o total como `number | null`, `workout_score`/`consistency_score` como `number` (nunca nulos).

## Testes e validação

- 20 testes novos: `model.test.mts` (13) e `repository.test.mts` (7); suíte total **199**. Cobrem a banda de tolerância de calorias (dentro/fora, simétrica para os dois lados), `ratioScore` capando em 100, o componente de treino nas duas condições, consistency nas combinações, `totalScore` devolvendo `null` sem meta e a soma ponderada correta com meta, streak — sequência simples, quebra por dia abaixo do limite, quebra por buraco (nunca por zero fabricado), streak atual menor que o recorde histórico —, e no repositório: `loadTargetsForDay` com o predicado de vigência certo, `closeDayScore` lendo antes de gravar e usando `onConflict: 'user_id,score_date'`, fechamento sem meta gravando total nulo, e `ensureRecentScoresClosed` pulando dias já fechados.
- `check`: TypeScript, ESLint, Prettier e os 199 testes aprovados.
- `scripts/rls-daily-scores-check.sql` executado no banco real, com ROLLBACK: isolamento entre dois usuários (select/update), insert em nome alheio negado, CHECK de faixa rejeitando componente fora de 0–100, `TRUNCATE`/`DELETE` negados (sem `DELETE` concedido), `unique(user_id, score_date)` rejeitando um segundo fechamento do mesmo dia, e `anon` sem privilégio algum. **8 verificações, todas aprovadas.**
- Ponta a ponta pela API REST com um usuário real e um segundo para isolamento, importando `model.ts` e `totals.ts` do próprio app: meta nutricional vigente, um dia com refeição/água batendo exatamente a meta e sem treino programado calculou 95 à mão; um dia sem nenhum registro (mas com meta vigente) calculou 25 à mão — nem zero fabricado, nem alto; o fechamento gravado no banco bateu com o valor calculado; segundo usuário sem acesso ao score do primeiro. **4/4 aprovadas.** Usuários de teste removidos ao final — nenhum dado de teste ficou no banco.
- `build:native`: bundles Hermes Android, iOS e web exportados sem erro, sem dependência nativa nova; 37 rotas estáticas, com `/score` entre elas.
- Revisão visual pelo dono **ainda pendente** — ver `STATUS.md`.

## Arquivos e continuidade

`src/features/score/`: `model.ts` (fórmulas puras dos cinco componentes, total, status e streak), `repository.ts` (leitura de meta por dia, fechamento de dia, histórico paginado), `useScoreHistory.ts` (histórico + streak, consumido pelo dashboard e pela tela), `ScoreChart.tsx` (barras 0–100, `react-native-svg`), `ScoreScreen.tsx`. Rota em `src/app/(logging)/score.tsx`.

O score de hoje é calculado diretamente em `DashboardScreen.tsx` e em `ScoreScreen.tsx`, cada um com sua própria chamada a `dayComponents`/`totalScore` alimentada pelos hooks de nutrição, água e treino já existentes — sem nenhuma leitura nova de rede além do histórico de `daily_scores`. `DashboardView.tsx` ganhou o card de Score real, movido para o topo, com tratamento de dark card (fundo `theme.colors.primary`) igual ao card de Energia.

Próxima fase: **Fase 10 — Notificações**. Água, treino, peso e resumo — inclusive o "vibrar/notificar" do descanso de treino (seção 44) e um eventual resumo diário citando o KORA Score, que esta fase deixou pronto para ser referenciado.
