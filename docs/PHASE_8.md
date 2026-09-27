# Fase 8 — Treinos

Implementada em 24/09/2026. Fonte: seções 38 a 44 (domínio), 70 a 76 (tabelas), 102 e roadmap Fase 8 (2226) do `KORA_MASTER_CONTEXT.md`. A seção 2251 (Fase 10) é a prova textual de que notificação de treino fica fora desta fase.

## Entrega

- Plano de treino manual (nome, objetivo opcional, dias, exercícios por dia com séries-alvo/faixa de repetições/descanso/observações), tela `/plan-builder`.
- Catálogo de exercícios: base global semeada (`scripts/seed-exercises.mjs`, 25 exercícios) mais exercícios cadastrados pelo próprio usuário, mesmo desenho `foods`/`user_foods` da Fase 5.
- Sessão ao vivo em `/workout-session`: exercício atual, série anterior, registro de série (peso opcional, repetições), temporizador de descanso com vibração, sinal conservador de progressão, retomada automática de sessão em andamento.
- Aba Treino (`/workouts`) deixa de ser `ModulePreview` e passa a listar o plano ativo e permitir iniciar um dia.
- Capacidade `workout` do Dashboard Hoje **ligada**: painel de treino mostra estado real (sem plano / pendente hoje / concluído hoje), e a prioridade `workout` (relevância 100, já codificada desde a Fase 4) dispara pela primeira vez.
- Aba Progresso ganha aderência de treino: sessões concluídas nos últimos 7 dias e data da última — só números, sem gráfico novo nesta fase.

## Decisões técnicas e de produto

1. **Catálogo semeado à mão, no espírito da Fase 5.** Vinte e cinco exercícios comuns, `source='seed'`, `verified=false`, sem base licenciada envolvida — mesma pendência pré-beta dos 46 alimentos da Fase 5. `scripts/seed-exercises.mjs` segue o molde de `scripts/seed-foods.mjs`: idempotente pelo nome, `--status`/`--remove`.
2. **Plano construído manualmente, sem geração automática** a partir de `training_preferences` — decisão explícita do responsável. A preferência do onboarding aparece só como valor sugerido de `days_per_week` ao criar o primeiro plano.
3. **Temporizador de descanso local, sem notificação de sistema.** A seção 44 pede "vibrar/notificar", mas a seção 2251 já separa "treino" entre as notificações da Fase 10. `useRestTimer` vibra com `expo-haptics` (nova dependência) só em primeiro plano, guardando o **instante de término**, não uma contagem isolada — o valor mostrado continua correto se o app for para segundo plano e voltar. Ao computar o restante durante a renderização com `Date.now()` o React Compiler acusa impureza; a conta ficou só dentro do `setInterval` e dos manipuladores `start`/`addSeconds`, nunca no corpo do componente.
4. **Duas tabelas novas além do schema literal das seções 70–76**, ambas documentadas e com o mesmo motivo de `meal_items.name_snapshot`: `workout_day_exercises`/`workout_session_exercises` ganharam `name_snapshot`, e `workout_sessions` ganhou `day_name_snapshot`, porque as referências ao catálogo e ao dia do plano usam `on delete set null` — apagar um exercício ou editar um plano não pode apagar o nome de uma sessão já registrada.
5. **`workout_day_exercises` e `workout_sets` são o primeiro caso de posse a dois saltos no projeto** (neto de `workout_plans`/`workout_sessions`, não filho direto). A política RLS usa `exists` com `join` pela tabela intermediária — testado em `scripts/rls-workouts-check.sql`.
6. **"Treino programado hoje" não é agendamento por dia da semana.** `workout_plan_days.day_index` é sequência dentro do plano (Dia 1, Dia 2...), sem mapear para segunda/quarta/sexta — a seção 71 não pede isso. `scheduled` no sinal do dashboard significa "há um plano ativo com pelo menos um dia configurado"; `completed` significa "existe sessão concluída hoje". Decisão reversível, registrada aqui.
7. **Progressão é sugestão, nunca prescrição automática (seção 43).** `progression.ts` só sinaliza depois de **duas sessões consecutivas** com todas as séries completas no topo da faixa de repetições configurada — uma sessão boa isolada nunca dispara. O app nunca reescreve `target_sets`/`min_reps`/`max_reps` sozinho.
8. **Histórico imutável de séries**, mesmo protocolo de idempotência da Fase 6/7: UUID por operação vindo do cliente, upsert com conflito ignorado seguido de releitura de conferência. `workout_sets` recebe só `select`/`insert`/`delete` — sem `UPDATE`, como `water_logs` — porque o app só permite adicionar e remover série, nunca editar uma já registrada.
9. **Um plano ativo por vez**, índice único parcial `workout_plans_one_active_per_user`, mesmo padrão de `goals`. Criar um novo plano desativa o anterior antes.
10. **`ModulePreview.tsx` foi removido.** Era o placeholder de `/workouts`, único módulo que ainda usava o componente; sem outro uso, ficaria morto.

## Banco e privilégios

Migration aplicada: `0009_workouts.sql`. Oito tabelas novas: `exercises`, `user_exercises`, `workout_plans`, `workout_plan_days`, `workout_day_exercises`, `workout_sessions`, `workout_session_exercises`, `workout_sets`; dois enums (`exercise_source`, `workout_session_status`). RLS habilitada nas oito; `exercises` só concede `select` a `authenticated` (catálogo global, sem escrita pelo cliente); as demais recebem os verbos que têm política, com `workout_sets` sem `UPDATE`. `revoke all` de `anon`/`authenticated` antes de conceder, como em toda migration desde a `0002`.

Semente: `scripts/seed-exercises.mjs`, 25 exercícios cobrindo os principais grupos musculares, todos `source='seed'`, `verified=false` — mesma pendência pré-beta da Fase 5 (ver `STATUS.md`).

`database.types.ts` atualizado na mesma mudança: dois enums, oito `Row`/`Insert`/`Update`, `workout_sessions` com `started_at`/`completed_at`/`duration_seconds`/`status` opcionais no `Insert` (têm padrão ou são escritos em passos separados), `workout_sets` com `id` obrigatório e `Update: never`.

## Testes e validação

- 23 testes novos: `model.test.mts` (10), `progression.test.mts` (7), `repository.test.mts` (6); suíte total **179**. Cobrem validação de plano/dia/exercício-do-dia, faixa de repetições invertida, criação de série com UUID obrigatório, o sinal de progressão exigindo duas sessões consecutivas no topo da faixa (nunca uma só), sessão com série incompleta não contando, ordem pai-antes-de-filho na escrita (plano→dia→exercício-do-dia; sessão→exercício-da-sessão), mescla do catálogo global com o do usuário, e igualdade das opções de upsert entre tentativa e retentativa de série.
- `check`: TypeScript, ESLint, Prettier e os 179 testes aprovados.
- `scripts/rls-workouts-check.sql` executado no banco real, com ROLLBACK: isolamento entre dois usuários em toda a cadeia — incluindo os dois saltos de `workout_day_exercises` e `workout_sets` —, catálogo global legível e não gravável, CHECK de origem única (exercício do catálogo + exercício do usuário ao mesmo tempo) rejeitado, faixa de repetições invertida rejeitada, segundo plano ativo rejeitado pelo índice único, `UPDATE` em série registrada negado, `anon` sem privilégio algum, `authenticated` sem `TRUNCATE`, e exclusão de exercício do catálogo preservando o nome gravado em `workout_day_exercises`/`workout_session_exercises`. **18 verificações, todas aprovadas.**
- Ponta a ponta pela API REST com um usuário real e um segundo para isolamento, importando `progression.ts` do próprio app: plano, dia e exercício-do-dia criados via API real; duas sessões concluídas com todas as séries no topo da faixa (12 repetições); retentativa da mesma série (mesmo UUID) não duplicou — 2 séries, não 4; o sinal calculado localmente bateu com o esperado (`increase_load` só depois das duas sessões); segundo usuário sem acesso ao plano do primeiro. **4/4 aprovadas.** Usuários de teste removidos ao final — nenhum dado de teste ficou no banco.
- `build:native`: bundles Hermes Android, iOS e web exportados sem erro com `expo-haptics` incluído; 35 rotas estáticas, com `/workouts`, `/plan-builder` e `/workout-session` entre elas.
- Revisão visual pelo dono **ainda pendente** — ver `STATUS.md`.

## Arquivos e continuidade

`src/features/workouts/`: `model.ts` (validação e criação pura de plano/dia/exercício-do-dia/série), `progression.ts` (sinal da seção 43), `repository.ts` (toda leitura/escrita), `useWorkoutCatalog.ts`, `useWorkoutPlans.ts`, `useTodayWorkout.ts` (consumido pelo dashboard), `useWorkoutSession.ts` (hook de sessão ao vivo, molde do hook de dia da Fase 6/7), `useRestTimer.ts`, `useWorkoutAdherence.ts` (consumido pela aba Progresso), e as telas `WorkoutsScreen.tsx`, `PlanBuilderScreen.tsx`, `SessionScreen.tsx`. Rotas em `src/app/(tabs)/workouts.tsx` e `src/app/(logging)/plan-builder.tsx`/`workout-session.tsx`.

A integração reusa `useDashboard` (preferência de treino como sugestão) e `useWorkoutAdherence` em `ProgressScreen.tsx`, sem duplicar nenhum cálculo. `DashboardScreen`/`DashboardView` ganharam o quarto sinal diário; `DASHBOARD_CAPABILITIES.workout` e a prioridade `workout` (já codificados desde a Fase 4) foram ligados nesta fase.

Próxima fase: **Fase 9 — Score + streak**. O motor de prioridades e o histórico de sessões desta fase são a base de dado real que a Fase 9 vai agregar.
