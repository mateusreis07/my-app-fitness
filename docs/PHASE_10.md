# Fase 10 — Notificações

Implementada em 25/09/2026. Fonte: seções 44 (descanso), 54 (notificações), 102 (MVP), 121 (tom de copy) e 122 (evitar punição/vergonha) do `KORA_MASTER_CONTEXT.md`; roadmap Fase 10.

## Entrega

- Notificações locais configuráveis de água, treino, peso e resumo diário, ativáveis individualmente em `/profile`.
- Fecha a seção 44: o temporizador de descanso agora também soa com o app em segundo plano (antes, só vibrava em primeiro plano).
- Sem servidor: tudo é agendado e recalculado no próprio dispositivo, com `expo-notifications` local — nenhum push remoto, nenhum token, nenhuma credencial de push.

## Regras

1. **Nascem desativadas** (decisão do responsável): nenhuma notificação é agendada até o usuário ativar o tipo explicitamente. Evita "spam agressivo" (seção 54) e pedir permissão do sistema sem um pedido do próprio usuário.
2. **Água**: agenda só com meta nutricional vigente e consumo abaixo dela. Sem meta, não é obrigação — não agenda.
3. **Treino**: agenda só quando há treino programado e ele ainda não foi concluído — a mesma condição exata da prioridade `workout` do dashboard (Fase 4/8).
4. **Peso**: agenda quando o último registro tem 7 dias ou mais (ou nunca houve registro) — o mesmo limite já usado pela prioridade de peso (`PRIORITY_POLICY.weightAfterDays`), não um número novo.
5. **Resumo**: agenda só se houver algo real para resumir (refeição, água ou treino registrados, ou score calculável) — um resumo vazio seria ruído, não conteúdo.
6. **Dois horários, não quatro**: `reminder_time` (padrão 15:00) para água/treino/peso; `summary_time` (padrão 21:00) para o resumo. Escolha por presets (`PillGroup`), sem time picker nativo.
7. **Recalculado a cada abertura/retomada do app**, nunca por um gatilho recorrente fixo do agendador: cada tipo tem um identificador estável (`kora-water`, `kora-workout`, `kora-weight`, `kora-summary`), cancelado e reagendado a cada checagem — nunca duplica, e para de incomodar assim que a condição deixa de valer (ex.: meta de água batida, treino concluído).
8. **Permissão do sistema é pedida na hora**, só ao ativar o primeiro tipo — nunca no primeiro acesso ao app. Negada, o toggle não é salvo como ativo e a tela mostra o aviso.
9. **Tom da seção 121**: nenhum texto de cobrança ou vergonha. O resumo é descritivo (números), nunca "você não bateu a meta".
10. **Sem suporte na web**: a seção de configurações fica visível, mas os controles ficam desabilitados com legenda explicando a limitação.

## Decisões técnicas e de produto

1. **Só notificação local, verificado antes de implementar.** Pesquisa indicou que notificações locais funcionam no Expo Go (Android e iOS) a partir do SDK 53 — só o _push remoto_ passou a exigir development build. `expo-notifications` foi instalado com `npx expo install`, mesmo caminho de `expo-haptics`/`react-native-svg`, sem gerar build nativo novo.
2. **Achado só em dispositivo real, em 26/09/2026**: no Expo Go Android (SDK 53+), o simples `import` estático de `expo-notifications` no topo do arquivo derruba o app inteiro — o módulo lança uma exceção de inicialização checando suporte a push remoto, mesmo quando o app só usa notificação local. É um bug conhecido da comunidade Expo (não documentado como tal pela Expo), sem sinal nenhum em testes de tipo, lint ou no navegador — só apareceu ao testar via cabo USB + `adb reverse` num Android real. Corrigido em `scheduler.ts`: o módulo é importado dinamicamente (`import()`), nunca de forma estática, e nunca dentro do Expo Go (`Constants.executionEnvironment === Constants.ExecutionEnvironment.StoreClient`) nem na web — nesses dois ambientes os quatro lembretes ficam desativados sem travar o app, e passam a funcionar de verdade assim que o projeto tiver um development build.
3. **Sem gatilho `DAILY` do próprio `expo-notifications`.** Um lembrete recorrente fixo não pode ser "pulado" quando a condição deixa de valer nem atualizar o texto com o dado do dia. Em vez disso, `useNotificationScheduler` recalcula tudo a cada abertura/retomada e a cada 30 s em primeiro plano (mesmo padrão de `AppState`/poll de todos os hooks de dia do projeto), usando um `TIME_INTERVAL` (segundos até o horário de hoje) por tipo.
4. **Nenhuma leitura de rede nova para decidir o quê agendar.** `useNotificationScheduler` reaproveita os mesmos hooks já existentes (`useNutritionDay`, `useHydrationDay`, `useTodayWorkout`, `useWeightHistory`) e a mesma fórmula de score da Fase 9 (`dayComponents`/`totalScore`) — só a leitura de preferências é nova.
5. **Custo aceito**: o agendador roda no layout das abas, sempre montado durante a sessão autenticada, então esses hooks de dia ficam ativos mesmo fora da aba Hoje — duplicando parte do tráfego que o Dashboard já faz quando está em foco. Aceitável dado o tamanho do projeto e a ausência de uma camada de cache compartilhada; documentado aqui para não ser reintroduzido como "bug" numa fase futura.
6. **Limitação assumida**: o texto de uma notificação já agendada não se atualiza sozinho — só na próxima recontagem (abertura do app, retomada ou o poll de 30 s em primeiro plano). Uma notificação agendada e o app fechado logo em seguida chega com o dado de quando foi calculada.
7. **Sem badge de app, sem som customizado, sem push remoto** — nada disso foi pedido pelo documento mestre; ver "Fora de escopo".

## Banco e privilégios

Migration aplicada: `0011_notification_preferences.sql`. Uma tabela, RLS por posse direta de `user_id` (`unique`, uma linha por usuário); `select`, `insert`, `update` concedidos (sem `delete`, mesmo padrão de `training_preferences`/`nutrition_preferences`/`goals`). `revoke all` de `anon`/`authenticated` antes de conceder, como em toda migration desde a `0002`. Sem tabela de "notificação agendada": o agendamento em si vive no dispositivo, recalculado sempre — só a preferência é persistida.

`database.types.ts` atualizado na mesma mudança: `NotificationPreferences`.

## Testes e validação

- 21 testes novos: `model.test.mts` (16) e `repository.test.mts` (5); suíte total **220**. Cobrem `secondsUntil` (horário futuro/passado hoje), as três condições de lembrete espelhando exatamente as regras já usadas no dashboard/prioridades, `summaryContent` devolvendo `null` sem nada para resumir, e `planTodayNotifications` — tipo desativado sempre cancela, meta ausente nunca agenda água, treino concluído cancela o lembrete, peso recente cancela o lembrete, horário já passado hoje cancela em vez de agendar no passado.
- `check`: TypeScript, ESLint, Prettier e os 220 testes aprovados.
- `scripts/rls-notification-preferences-check.sql` executado no banco real, com ROLLBACK: isolamento entre dois usuários (select/update), insert em nome alheio negado, `unique(user_id)` bloqueando uma segunda linha, `TRUNCATE`/`DELETE` negados, `anon` sem privilégio. **7 verificações, todas aprovadas.**
- Ponta a ponta pela API REST com dois usuários reais, importando `model.ts` do próprio app: preferência gravada via API com RLS ligada; plano calculado corretamente distinguindo água abaixo da meta (agenda) de treino concluído (cancela, mesmo com sinal de treino presente); tipos desativados sempre cancelando; segundo usuário sem acesso. **4/4 aprovadas.** Usuários de teste removidos ao final.
- `build:native`: bundles Hermes Android, iOS e web exportados com `expo-notifications` incluído, sem gerar development build.
- **Revisão manual de notificação de verdade (permissão, entrega em segundo plano) ainda pendente** — é a primeira fase que exige isso, não só conferir tela. Ver `STATUS.md`.

## Arquivos e continuidade

`src/features/notifications/`: `model.ts` (regras puras de cada tipo e o planejador central), `scheduler.ts` (único lugar que importa `expo-notifications`, com guarda de `Platform.OS`), `repository.ts` (preferências), `useNotificationPreferences.ts` (tela de configurações), `useNotificationScheduler.ts` (recálculo contínuo, montado em `src/app/(tabs)/_layout.tsx`). `useRestTimer.ts` (Fase 8) ganhou a notificação de fim de descanso. Configurações em `src/app/(tabs)/profile.tsx`, novo card "Notificações".

Próxima fase: **Fase 11 — Assinatura**. Free/pro, feature flags, paywall e provider — a primeira fase de monetização, marcando o fim do trecho "pronto para beta" do roadmap.
