# KORA — Status do projeto

> **Este é o arquivo de direcionamento.** Qualquer agente de IA que for trabalhar neste
> repositório deve ler este arquivo **antes** de qualquer outra coisa, e **atualizá-lo ao
> final de toda implementação**. Ver "Como atualizar este arquivo" no fim.
>
> Hierarquia de documentos:
>
> 1. `KORA_MASTER_CONTEXT.md` — fonte oficial de produto. Não reformatar, não reescrever.
> 2. `STATUS.md` (este arquivo) — o que existe hoje, o que falta, o que não pode quebrar.
> 3. `docs/PHASE_N.md` — detalhe e decisões de cada fase.
> 4. `AGENTS.md` — regras técnicas de Expo, banco e comandos.

**Última atualização:** 27/09/2026
**Fase concluída:** Fase 10 — Notificações
**Próxima fase:** Fase 11 — Assinatura

---

## 1. Panorama

| Item          | Situação                                                                 |
| ------------- | ------------------------------------------------------------------------ |
| Stack         | Expo SDK 57, React Native 0.86, React 19.2, TypeScript 6, Expo Router 57 |
| Backend       | Supabase, projeto `pjecyxuiigqwarzjrmuj` (us-west-2)                     |
| Idioma        | pt-BR, catálogo único em `src/lib/i18n/pt-BR.ts`                         |
| Migrations    | 11 aplicadas                                                             |
| Testes        | 220 passando                                                             |
| Motor Fitness | `fitness_engine@1.2`                                                     |
| Versionamento | Git, remoto em `github.com/mateusreis07/my-app-fitness` (desde 27/09/2026). |

### Roadmap

| Fase  | Nome                                                        | Status                                       |
| ----- | ----------------------------------------------------------- | -------------------------------------------- |
| 0     | Fundação                                                    | ✅ concluída                                 |
| 1     | Autenticação                                                | ✅ concluída                                 |
| 2     | Onboarding                                                  | ✅ concluída                                 |
| 3     | Motor Fitness                                               | ✅ concluída                                 |
| 4     | Dashboard Hoje                                              | ✅ concluída                                 |
| 5     | Nutrição                                                    | ✅ concluída                                 |
| 6     | Hidratação                                                  | ✅ concluída                                 |
| 7     | Peso e evolução                                             | ✅ concluída                                 |
| 8     | Treinos                                                     | ✅ concluída                                 |
| 9     | Score + streak                                              | ✅ concluída                                 |
| 10    | Notificações                                                | ✅ concluída                                 |
| 11    | Assinatura                                                  | ⬅️ **próxima** (após esta, pronto para beta) |
| 12–16 | Coach, registro com IA, insights, foto, health integrations | ⬜                                           |

---

## 2. O que está implementado

### Navegação e telas

- Cinco abas: Hoje, Alimentação, Treino, Progresso, Perfil. Página Sobre e 404.
- Telas de conta: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`.
- Onboarding em `/onboarding`, sete etapas com barra de progresso.
- Alimentação, Progresso e, desde a Fase 8, Treino já registram/mostram dado real. Nenhuma aba segue em estado de prévia.
- Registro alimentar em `/add-food`, cadastro de alimento em `/new-food`, hidratação em `/hydration`, peso em `/weight`, construção de plano em `/plan-builder` e sessão de treino em `/workout-session`, todos no grupo `(logging)`, com a mesma guarda do onboarding.

### Autenticação (Fase 1)

- Cadastro, login, sessão persistida, logout, recuperação e troca de senha.
- Sessão nativa em AsyncStorage; refresh automático só com o app em primeiro plano.
- Perfil criado por trigger no cadastro, com `display_name` vindo do metadata.
- Erros do servidor nunca aparecem crus: `mapAuthError` converte código em texto pt-BR.
- Recuperação responde igual para e-mail existente e inexistente (não revela quem tem conta).

### Onboarding (Fase 2)

- Sete etapas conforme seção 12 do documento mestre.
- Etapa de meta é pulada para objetivos sem peso-alvo.
- Prazo acima dos limites **avisa sem bloquear o acesso**. O resumo mostra o ajuste permitido antes de salvar; não há previsão de data de chegada.
- Escritas sequenciais; conclusão por último. Upserts são idempotentes, mas inserts podem repetir histórico em nova tentativa. Não há transação REST.
- Refazer o onboarding encerra o objetivo anterior (`abandoned`) em vez de apagar.

### Motor Fitness (Fase 3)

- Módulo determinístico em `src/features/fitness/engine.ts`. Sem IA, sem rede, sem React.
- IMC, TMB (Mifflin-St Jeor), TDEE, calorias por objetivo, proteína, gordura, carboidrato e água.
- Piso da automação: **1.500 kcal/dia**, igual para todos. Não é mínimo biológico universal; TMB não é piso de ingestão.
- Padrões sem prazo: **15% de déficit / 5% de superávit**. Com prazo, ajustes menores são permitidos; não forçar déficit mínimo.
- Limite semanal via `getWeeklyChangeLimit`: perda min(1% do peso, 1 kg); ganho min(0,5%, 0,5 kg). Limites da automação, não garantias individuais.
- Sem sexo informado, IMC atual/alvo <18,5 para perda, ajuste inviável, macros incompatíveis ou limites técnicos excedidos: resultado explícito **sem meta automática**, com acesso permitido após onboarding.
- Todas as constantes centralizadas; mudança exige nova versão. Metas históricas não são recalculadas. Novas metas usam `fitness_engine@1.2`.
- Resumo apresenta estimativas e avisos antes de aceitar; removidas previsão semanal e data de chegada. Sem meta, oferece conclusão sem números fictícios.
- Onboarding revalida as etapas no submit. Corrigida a navegação dos objetivos sem peso-alvo, que pulava dados básicos.
- Ausência de meta e falha de leitura têm estados diferentes. Sem plano não insere `nutrition_targets`; fecha eventual meta anterior preservando histórico.
- O `TargetsCard` provisório foi **removido na Fase 4**, substituído pelo dashboard. `useCurrentTargets` saiu junto; `fetchCurrentTargets` continua em `targets.ts`, coberto por teste.

### Dashboard Hoje (Fase 4)

- Tela Hoje conectada aos dados reais: saudação, meta calórica, macros, água, peso e treino previsto.
- **Capacidades nascem todas desligadas** (`DASHBOARD_CAPABILITIES`). Nenhuma prioridade aparece enquanto a fase que gera o dado e a ação correspondente não existirem. Ligar uma sem o adaptador real criaria lembrete que não leva a lugar nenhum.
- `metricProgress` devolve `null` para desconhecido — **ausência de dado nunca vira zero**, e não há divisão por zero.
- Erro de leitura e ausência legítima são estados distintos (`Resource<T>`). Cada painel falha isolado dos outros.
- Atualiza em quatro gatilhos: foco na aba, retorno do app, virada do dia no fuso do perfil e troca de usuário/onboarding. Retrato só é exibido se pertencer à chave `usuário:dia:fuso:onboarding`.
- Motor de prioridades determinístico, no máximo três: treino pendente (100), água depois das 15h abaixo de 60% (80), proteína depois das 16h abaixo de 70% com refeição registrada (70), peso parado há 7 dias (50).
- A entrega original da Fase 4 era somente leitura, sem migration. A Fase 6 acrescenta gravação de água pelos atalhos.

### Nutrição (Fase 5)

- Cadastrar alimento próprio, registrar em uma refeição, ver total do dia e por refeição, remover item e atalho de recentes.
- **A fonte importada ainda não foi decidida**: TBCA exige licença paga, os termos da TACO não puderam ser verificados, e o Open Food Facts impõe atribuição e share-alike.
- **A base global tem 46 alimentos de teste**, inseridos por `scripts/seed-foods.mjs`. São aproximações de conhecimento público escritas à mão, **não vindas de nenhuma base licenciada**. Entram com `source = 'seed'` e `verified = false` justamente para nunca passarem por base curada. Removem-se com `node scripts/seed-foods.mjs --remove` e **precisam ser substituídas por fonte verificada antes do beta**.
- **`meal_date` vem do relógio do perfil**, o mesmo `dashboardClock` do dashboard. Com data UTC os registros da noite sumiriam da tela sem erro nenhum.
- **Snapshots preservam o histórico**: apagar um alimento não reescreve o que já foi registrado. As chaves usam `on delete set null` e o item continua legível e somando.
- Uma refeição por tipo por dia, por índice único; o registro usa upsert.
- `meal_items` não guarda `user_id`: a posse vem da refeição, por subconsulta na política.
- `mealCount` conta refeições **com item**. É o que impede o motor de prioridades de ler "não registrou" como "comeu pouca proteína".
- Capacidades `nutrition` e `water` do dashboard **ligadas** com sinais e ações reais. Peso e treino seguem desligados.
- Registro só do dia corrente. `meal_date` já aceita datas anteriores, mas não há navegação por dia.

### Hidratação (Fase 6)

- Tela `/hydration` no grupo protegido `(logging)`: meta salva, consumido, restante e histórico do dia.
- 250/500 ml diretamente no dashboard ou na tela; quantidade personalizada e remoção confirmada na tela.
- Registro independente de meta: ausência de plano não bloqueia hidratação nem inventa percentual.
- Datas preservam dia e fuso do perfil no momento da gravação; CHECK no banco valida a correspondência.
- UUID por operação (`expo-crypto`) e retry idempotente com conflito ignorado/releitura; bloqueio de toque duplo. Tentativa pendente em memória, sem fila offline persistente.
- RLS e privilégios explícitos em `water_logs`; paginação para não truncar totais. Erro e zero registrado são estados distintos.
- Atualização no dashboard recarrega água e nutrição; hidratação acompanha foco, retomada do app e virada do dia.
- Detalhes e limites técnicos em `docs/PHASE_6.md`. Motor fitness permanece 1.2; nenhuma meta do responsável foi recalculada.

### Peso e evolução (Fase 7)

- Tela `/weight` no grupo `(logging)`: registro de peso, observação opcional e histórico com remoção confirmada.
- Aba Progresso deixa de ser prévia: peso atual, peso inicial e meta (de `goals`), variação desde o início, tendência de 7 dias, comparação semanal, gráfico e os totais de proteína/água do dia.
- **Primeiro gráfico de dados do app**, em `react-native-svg` (Victory Native XL não roda no Expo Go). Esquema monocromático por desenho: registro bruto e média móvel são a mesma grandeza, distinguidos por forma, não por cor. Eixo Y não começa em zero; dia sem registro vira lacuna, nunca interpolação.
- **Nenhuma projeção de data de chegada em lugar nenhum.** `trend.ts` calcula média móvel e comparação semanal, nunca converte isso em data futura. Testado explicitamente.
- **O Motor Fitness não é recalculado a partir do peso real.** Registrar peso não gera nova meta nem altera `goals`.
- `weight_logs` ganhou `recorded_date`/`recorded_timezone` na migration 0008, com backfill das linhas antigas a partir do fuso salvo em `profiles` — a tabela nasceu na Fase 2 sem essas colunas, que a Fase 6 já usava em `water_logs`.
- Mesmo protocolo de idempotência da hidratação: UUID por operação, upsert com conflito ignorado, retentativa preservando os mesmos valores.
- Capacidade `weight` do dashboard **ligada**; a legenda de tendência do painel de peso deixou de ser um texto fixo e passou a mostrar o número real.
- Um bailout do React Compiler apareceu ao chamar uma função com parâmetro padrão (`movingAverage`) solta no corpo do hook; isolar os cálculos de tendência em `useMemo` resolveu — ver `docs/PHASE_7.md` para o relato completo.
- Detalhes em `docs/PHASE_7.md`.

### Treinos (Fase 8)

- Plano de treino **manual, sem geração automática** (decisão do responsável): nome, objetivo opcional, dias e exercícios por dia com séries-alvo/faixa de repetições/descanso, em `/plan-builder`. Um plano ativo por vez.
- Catálogo de exercícios semeado (`scripts/seed-exercises.mjs`, 25 exercícios, `source='seed'`, `verified=false`) mais exercícios do próprio usuário — mesmo desenho `foods`/`user_foods` da Fase 5.
- Sessão ao vivo em `/workout-session`: série anterior, registro de peso/repetições com o mesmo protocolo de idempotência da Fase 6/7, temporizador de descanso com vibração (`expo-haptics`, sem notificação de sistema — isso é Fase 10), retomada automática de sessão em andamento, e sinal de progressão só depois de **duas sessões consecutivas** no topo da faixa de repetições.
- `/workouts` deixou de ser `ModulePreview` (componente removido); mostra o plano ativo e inicia sessão.
- Capacidade `workout` do dashboard **ligada**: a prioridade de relevância 100, codificada desde a Fase 4, dispara pela primeira vez. Aba Progresso ganhou aderência de treino (sessões dos últimos 7 dias, sem gráfico novo).
- `workout_day_exercises` e `workout_sets` são o primeiro caso do projeto de posse a **dois saltos** na RLS (neto da tabela dona, não filho direto).
- Detalhes em `docs/PHASE_8.md`.

### Score + streak (Fase 9)

- KORA Score do dia, calculado ao vivo (nunca lido de `daily_scores` enquanto o dia não fecha), com status e comparação com a média dos últimos 7 dias — card movido para o **topo** do Dashboard Hoje (seção 88), acima até da Energia.
- Cinco componentes com pesos do próprio documento mestre: nutrition 25%, protein 20%, hydration 15%, workout 25%, consistency 15%. **`total_score` fica `null` sem meta nutricional vigente no dia** — nunca um número fabricado a partir só de treino/consistência.
- Tela `/score`: detalhamento dos cinco componentes, streak atual e recorde, gráfico de barras dos últimos 14 dias (`react-native-svg`, sem dependência nativa nova).
- Streak nunca é persistido — é sempre calculado a partir do histórico de `daily_scores`. "Dia bom" é `total_score ≥ 50` (decisão do responsável); um dia abaixo disso ou sem registro interrompe a sequência atual, mas nunca apaga o recorde.
- Fechamento de dia é **tardio e feito pelo cliente**: a cada abertura do app, os últimos 30 dias sem linha em `daily_scores` são fechados. Sem servidor/cron neste projeto.
- Grava por **chave natural** (`user_id, score_date`), não por UUID de cliente — é escrita derivada e determinística, diferente do protocolo de idempotência das Fases 6/7/8.
- Sem badges/conquistas/gamificação avançada (fora do MVP, seções 103/123).
- Detalhes e as regras completas (calorias, consistency, streak) em `docs/PHASE_9.md`.

### Notificações (Fase 10)

- Lembretes locais de água, treino, peso e resumo diário, configuráveis em `/profile` — **nascem todos desativados** (decisão do responsável); o usuário ativa o que quiser.
- Cada tipo reaproveita uma condição já existente no app: água (meta vigente e não atingida), treino (`scheduled && !completed`, igual à prioridade do dashboard), peso (≥7 dias desde o último registro, mesmo limite de `PRIORITY_POLICY.weightAfterDays`), resumo (só se houver algo real para resumir, incluindo o KORA Score da Fase 9).
- **Só notificação local, sem servidor** — confirmado que funciona no Expo Go (SDK 53+); só o push remoto exigiria development build. `expo-notifications` instalado como toda dependência nativa anterior, sem gerar build novo.
- **Sem gatilho recorrente do agendador**: o app recalcula o que falta para hoje a cada abertura/retomada e a cada 30 s em primeiro plano, cancelando e reagendando por um identificador estável por tipo — nunca duplica, e para de incomodar assim que a condição deixa de valer.
- Fecha a seção 44: o temporizador de descanso (Fase 8) agora também soa com o app em segundo plano.
- Permissão do sistema é pedida só ao ativar o primeiro tipo, nunca no primeiro acesso ao app.
- Detalhes e as regras completas em `docs/PHASE_10.md`.

### Proteção de rotas

Cada grupo declara sua própria regra no `_layout.tsx`:

| Situação                         | Destino                                           |
| -------------------------------- | ------------------------------------------------- |
| Sem sessão                       | `/sign-in`                                        |
| Com sessão, onboarding pendente  | `/onboarding`                                     |
| Com sessão, onboarding concluído | abas                                              |
| Sem `.env` configurado           | abas em modo prévia, telas de conta mostram aviso |

---

## 3. Banco de dados

Projeto Supabase `pjecyxuiigqwarzjrmuj`. Migrations em `supabase/migrations`, aplicadas por `npm run migrate`. Controle em `kora_meta.schema_migrations`.

| Tabela                      | Conteúdo                                                             | RLS | Verbos concedidos              |
| --------------------------- | -------------------------------------------------------------------- | --- | ------------------------------ |
| `profiles`                  | perfil base + `onboarding_completed_at`                              | ✅  | select, insert, update         |
| `goals`                     | objetivo, histórico preservado                                       | ✅  | select, insert, update         |
| `weight_logs`               | peso, com dia/fuso e UUID idempotente (desde a migration 0008)       | ✅  | select, insert, update, delete |
| `training_preferences`      | etapa 5 do onboarding                                                | ✅  | select, insert, update         |
| `nutrition_preferences`     | etapa 6 do onboarding                                                | ✅  | select, insert, update         |
| `nutrition_targets`         | metas do Motor Fitness, com histórico                                | ✅  | select, insert, update         |
| `foods`                     | base global com 46 alimentos seed de teste                           | ✅  | **select apenas**              |
| `user_foods`                | alimentos do próprio usuário                                         | ✅  | select, insert, update, delete |
| `meals`                     | refeição de um dia, uma por tipo                                     | ✅  | select, insert, update, delete |
| `meal_items`                | itens com snapshot dos macros                                        | ✅  | select, insert, update, delete |
| `water_logs`                | água, com dia/fuso e UUID idempotente                                | ✅  | select, insert, delete         |
| `exercises`                 | catálogo global com 25 exercícios seed de teste                      | ✅  | **select apenas**              |
| `user_exercises`            | exercícios do próprio usuário                                        | ✅  | select, insert, update, delete |
| `workout_plans`             | plano de treino, um ativo por usuário                                | ✅  | select, insert, update, delete |
| `workout_plan_days`         | dias do plano (posse por `workout_plans`)                            | ✅  | select, insert, update, delete |
| `workout_day_exercises`     | exercícios do dia, com snapshot do nome (posse a dois saltos)        | ✅  | select, insert, update, delete |
| `workout_sessions`          | sessão de treino, com dia/nome preservados                           | ✅  | select, insert, update, delete |
| `workout_session_exercises` | exercícios da sessão, com snapshot do nome                           | ✅  | select, insert, delete         |
| `workout_sets`              | série registrada, histórico imutável, UUID idempotente               | ✅  | select, insert, delete         |
| `daily_scores`              | score do dia por componente, fechamento por chave natural            | ✅  | select, insert, update         |
| `notification_preferences`  | preferência de lembrete por usuário; agendamento vive no dispositivo | ✅  | select, insert, update         |

`anon` não tem privilégio algum. `profiles` não tem política de DELETE: exclusão de conta é item de LGPD e precisa remover o usuário em `auth.users`.

### Configuração do projeto Supabase

- `mailer_autoconfirm: true` — cadastro entra direto, sem confirmação por e-mail.
- `disable_signup: false`.
- Redirect URLs cadastradas no Dashboard.
- Remetente de e-mail ainda é o padrão do Supabase (limite baixo, não serve para produção).

---

## 4. Invariantes — o que não pode ser quebrado

Estas regras já causaram correção neste projeto. Violar qualquer uma é regressão.

1. **Toda tabela de usuário nasce com RLS e privilégios explícitos.** O Supabase concede `all privileges` no schema public para `anon` e `authenticated` por default privileges, e isso inclui `TRUNCATE`, que **não passa por RLS**. Cada migration deve `revoke all ... from anon, authenticated` e conceder só os verbos que têm política. Isso foi um furo real, corrigido na migration `0002`.
2. **Nada de segredo em `EXPO_PUBLIC_*`.** Só URL e chave publishable. `service_role`, `sb_secret_`, senhas e chaves de IA ficam fora do bundle.
3. **Nenhum dado fictício apresentado como real.** Sem número estimado, sem gráfico de mentira, sem registro de exemplo.
4. **Texto de interface só no catálogo pt-BR.** Nada de string literal em componente.
5. **Regra de negócio fora da UI**, em módulo próprio e com teste.
6. **Nunca editar uma migration já aplicada.** Criar outra.
7. **`database.types.ts` é escrito à mão.** Atualizar na mesma mudança que altera uma migration.
8. **Cálculo não se duplica** e parâmetros exigem incremento de `FITNESS_ENGINE_VERSION`, gravado em `calculation_source`.
9. **Não decidir produto em silêncio.** Se não está no documento mestre: escolher o mais simples e reversível, documentar aqui e avisar o dono.
10. **Limites compartilhados.** `WEEKLY_CHANGE_LIMIT` e `getWeeklyChangeLimit` são usados pelo motor e pelo onboarding; não duplicar regras de ritmo na UI.
11. **Não prometer prazo ou segurança individual.** Data desejada é preferência; sem data prevista ou promessa de ajuste automático pelo histórico.
12. **Sem meta não significa zero.** Onboarding pode estar concluído sem `nutrition_targets`. Dashboard não inventa números, não recalcula silenciosamente e não penaliza esse estado.
13. **IMC de elegibilidade usa precisão bruta.** Arredondamento é para exibição; 18,46 não se torna elegível para perda ao aparecer como 18,5.
14. **`Link asChild` descarta `style` em função.** Ao envolver um `Pressable` com `Link asChild`, o elemento é clonado para virar âncora na web e um `style={({ pressed }) => ...}` se perde. O visual precisa ficar em uma `View` interna. Aconteceu no `NavButton` e passou despercebido, porque só ficou visível sobre fundo escuro.
15. **Conferir contraste no fundo real.** Um componente nascido sobre fundo claro pode ficar ilegível ao ser reaproveitado sobre fundo escuro. Verificar onde ele vai de fato aparecer, não só onde foi criado.
16. **Dia do usuário vem do fuso do perfil.** Qualquer coluna de data de registro usa `dashboardClock(now, timeZone)`, nunca a data UTC. `selectDailySignals` compara a chave do dia por igualdade exata: com UTC, o registro da noite some da tela sem erro nenhum.
17. **Registro guarda snapshot.** Item registrado copia nome, quantidade, unidade e macros. Referência para o alimento é `on delete set null`. Apagar um alimento nunca reescreve o histórico.
18. **Nenhuma tendência vira data de chegada.** Média móvel e comparação semanal descrevem o passado; nenhuma função converte isso em previsão de data futura. O `PRODUCT_DECISIONS.md` cita evidência contra conversão linear de peso.
19. **Peso real nunca recalcula o Motor Fitness.** Registrar peso não gera nova `nutrition_targets`, não altera `goals` e não dispara incentivo. `goals` é intenção, não recomendação viva.
20. **Parâmetro padrão em função pura pode quebrar o React Compiler quando chamado solto no corpo de um hook.** Aconteceu com `movingAverage(series, dayKey)` em `useWeightHistory`: o compilador não conseguia preservar a memoização manual do `useFocusEffect`, mesmo passando o parâmetro explicitamente. Isolar o cálculo em `useMemo` resolveu. Se aparecer de novo, tentar isolar em `useMemo` antes de investigar mais fundo.
21. **`Date.now()` (ou qualquer função impura) não pode ser chamado durante a renderização.** O React Compiler recusa (`react-hooks/purity`). Aconteceu em `useRestTimer`: o restante do cronômetro precisava ser lido do relógio a cada tick, mas calculá-lo no corpo do hook a partir de `endsAt` quebrava a regra. A conta ficou só dentro do `setInterval` e dos manipuladores de evento (`start`/`addSeconds`), nunca no corpo do componente/hook.
22. **`setState` síncrono no corpo de um efeito é rejeitado pelo lint (`react-hooks/set-state-in-effect`).** Um `if (condição) { setEstado(x); return; }` logo no início de um `useEffect` conta como síncrono, mesmo que o resto do efeito seja assíncrono. Adiar a decisão para dentro do `.then()`/callback assíncrono, ou não resetar o estado nesse ramo e tratar a ausência na renderização, resolve sem recorrer a `eslint-disable`.

---

## 5. Decisões de produto — confirmadas e implementadas

**As seis decisões foram aprovadas pelo responsável em 22/09/2026. Nenhuma permanece aguardando confirmação.**

| Decisão            | Política vigente no motor 1.2                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Idade              | Mínimo de 18 anos completos                                                                   |
| Ritmo              | Limite perda min(1% do peso, 1 kg)/semana; ganho min(0,5%, 0,5 kg)/semana                     |
| Prazo              | Avisa, não bloqueia acesso; ajuste limitado mostrado antes de salvar; sem previsão de chegada |
| Sem prazo          | Déficit 15%; superávit 5%; proteína e gordura mantidas conforme objetivo                      |
| Sexo não informado | Sem TMB média ou plano calórico/macros automático; onboarding continua                        |
| Piso               | 1.500 kcal na automação; TMB não é piso; não inverter objetivo para atingir o piso            |

O adendo no mestre formaliza a mudança. Especificação, fontes, casos de borda, limites e contrato para a Fase 4 em **`docs/PRODUCT_DECISIONS.md`**. Implementação detalhada em `docs/PHASE_3.md`.

A correção 1.2 substitui a política anterior de previsão linear de data, piso por sexo/TMB e ajuste mínimo com prazo. O uso de 7.700 kcal/kg fica restrito à aproximação do ajuste inicial. Não há recálculo retroativo de metas 1.1.

---

## 6. Pendências

### Validação que só o dono pode fazer

- [ ] Validar a Fase 6 em dispositivo físico. Navegador e API já exercitados com conta QA pelo agente; não equivale a aceite do responsável.
- [x] **Revisão inicial da Fase 8 pelo responsável em 25/09/2026.** Testes próprios no navegador, sem defeito reportado até aqui. Ainda não é uma passada estruturada por todo o fluxo (plano → dia → exercício → sessão → série → descanso → conclusão → painel/prioridade/Progresso) como as revisões anteriores; vale repetir com mais atenção quando surgir tempo.
- [ ] **Revisar visualmente a Fase 9 no navegador.** Conferir o card de Score no topo da Hoje (número, status, comparação com a média), abrir `/score` e conferir os cinco componentes, o streak e o gráfico de barras contra alguns dias de dado real já existentes na conta. Ainda não foi feito pelo responsável — API e RLS já exercitadas pelo agente contra o banco real.
- [ ] **Testar notificação de verdade da Fase 10 — só dá para fazer em Expo Go, física ou emulador, não no navegador.** Ativar cada tipo em `/profile`, conceder a permissão do sistema, forçar a condição de cada um (zerar água do dia, ter treino pendente, peso há mais de 7 dias) e conferir que a notificação chega com o app em segundo plano; testar negar a permissão; testar o fim do temporizador de descanso com o app minimizado. Nada disso foi possível validar nesta máquina — mesma limitação de rede/dispositivo físico já registrada em "Particularidades desta máquina".

- [ ] Revisar visualmente o novo resumo e fluxo sem meta da versão 1.2.
- [x] **Dashboard da Fase 4 revisado no navegador pelo dono em 22/09/2026.** Aprovado, com um defeito apontado: seta solta entre os cards. Era o `NavButton` perdendo o estilo — corrigido e registrado em `docs/PHASE_4.md`.
- [ ] Rever os estados vazio/erro/carregando do dashboard, que só foram conferidos por conteúdo. Para ver na tela: `cp artifacts/dashboard-check.tsx.bak src/app/dashboard-check.tsx`, abrir `/dashboard-check?state=empty|error|loading|progress|long`, e **apagar o arquivo depois** — contém dados fictícios e não pode ir a produção.
- [x] **Interface 1.1 revisada no navegador pelo dono em 22/09/2026.** Cadastro, onboarding e resultado percorridos; sem problema reportado. Valida layout e fluxo, mas não o comportamento nativo.
- [ ] **Testar em dispositivo real.** Ainda não foi possível — ver "Particularidades desta máquina". Faltam: teclado nativo, gesto de voltar do Android, área segura, e a persistência de sessão em AsyncStorage (na web a sessão usa outro storage, então esse caminho nunca rodou de verdade).
- [x] **Telas da Fase 5 revisadas pelo dono em 23/09/2026.** Cadastrou alimento próprio, registrou itens das duas origens (cadastro próprio e base global) em três refeições, e confirmou que o total aparece na aba Hoje. Aprovado sem defeito reportado.
- [x] **Tela `/progress` revisada pelo dono em 24/09/2026.** Com 14 dias de peso, o gráfico desenhou a linha de registros e a média móvel corretamente; tendência de 7 dias (96,2 kg), comparação semanal (-1,1 kg) e variação desde o início (-2,0 kg em 13 dias) todas conferidas à mão contra os dados de origem — bateram exatas. Eixo Y sem começar em zero, distinção por forma (ponto vs. linha) visível, legenda e resumo textual presentes. Aprovado sem defeito reportado.
- [ ] Fluxo de recuperação de senha ponta a ponta — depende de SMTP próprio.

### Bloqueiam o beta / publicação

- [ ] Revisão clínica da política e definição/implementação de elegibilidade para gestação, lactação e outras situações não atendidas. O onboarding atual não realiza essa triagem; ver `docs/PRODUCT_DECISIONS.md`.
- [ ] **Substituir os 46 alimentos `seed` da base global por fonte verificada.** São aproximações escritas à mão para teste, com `verified = false`. Decidir a fonte (TBCA com licença paga, TACO com termos a esclarecer, ou Open Food Facts com atribuição e share-alike) e importar. Enquanto isso, nenhum valor da base global deve ser tratado como referência confiável.
- [ ] **Substituir os 25 exercícios `seed` do catálogo global por fonte verificada.** Mesma situação dos alimentos: `scripts/seed-exercises.mjs` insere referências escritas à mão para teste, `source='seed'`, `verified=false`, sem base licenciada envolvida. Remover com `node scripts/seed-exercises.mjs --remove`.
- [ ] **13 pesos fictícios na conta real do responsável (24/09/2026).** Diferente do seed de alimentos — peso é dado de saúde pessoal, não base compartilhada — inserido a pedido para validar visualmente o gráfico da Fase 7, e mantido por decisão do responsável após a revisão. Registros de 10/09 a 23/09, marcados com `notes = 'TESTE — apagar'` (o único registro real, 96,00 kg em 22/09, não tem essa observação). Remover antes de qualquer análise de progresso real ou de compartilhar a conta: `delete from public.weight_logs where notes = 'TESTE — apagar';`.

- [ ] **SMTP próprio.** O remetente padrão do Supabase tem limite baixo e não serve para produção.
- [ ] **Trocar a senha do banco.** Ela está em texto claro no `.env` local (arquivo ignorado pelo versionamento).
- [ ] **`app.json` incompleto:** faltam `ios.bundleIdentifier`, `android.package`, ícone e imagem de splash. Não existe pasta `assets/` — o alias `@/assets/*` do `tsconfig.json` aponta para o nada.
- [ ] **Sem `eas.json` / projeto EAS.** Nenhum APK/IPA assinado foi gerado até hoje.
- [ ] **Exclusão de conta (LGPD).** Precisa de rotina de servidor que remova o usuário em `auth.users`.
- [ ] Política de privacidade, termos de uso e registro de consentimento (seção 84).
- [ ] **15 alertas moderados** no `npm audit`, transitivos (`uuid`/`xcode`, `decode-uri-component`/`query-string`). Nenhum alto ou crítico. Não usar `audit fix --force`: o npm sugere downgrades incompatíveis do Expo.

### Melhorias conhecidas, sem data

- [ ] Troca de metas transacional e idempotência antes de disponibilizar edição/recálculo de plano concluído. Hoje, falha entre encerramento e inserção pode deixar a meta sem vigência; repetir inserts pode duplicar histórico.
- [ ] Entrada manual de metas orientadas por profissional e meta de água independente de calorias; não implementadas.

- [ ] Tokens de sessão em AsyncStorage, que não é criptografado. Avaliar `expo-secure-store`.
- [ ] Rascunho do onboarding vive só em memória; fechar o app no meio recomeça do zero.
- [ ] Não há tela para editar o plano depois do onboarding concluído.
- [ ] Sem traduções en-US/es.
- [ ] Sem testes de componente — a cobertura é de regra de negócio.
- [ ] **`lock: processLock` está depreciado** no `supabase-js` 2.116 e sai na v3 — o cliente passou a coordenar o refresh de sessão sozinho. Aparece como aviso no log a cada bundle. Remover a opção em `src/services/supabase/client.ts` e revalidar o ciclo de sessão. Não foi feito junto com a Fase 3 de propósito: mexer em sessão às vésperas de um teste manual seria arriscado.
- [ ] **`@expo/ngrok` está em `devDependencies`** só para tentar o modo tunnel, que **não funciona nesta máquina** (bloqueado por EDR). Se o teste em dispositivo for resolvido por firewall ou cabo USB, remover: `npm uninstall @expo/ngrok`.

### Particularidades desta máquina

- **O Node do sistema é 22.4.1**, abaixo do mínimo do projeto (`^22.13.0 || >=24.3.0`). Rodar `npm run check` direto **quebra os testes**. Use sempre:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 check
  ```
  O script localiza um Node 24 compatível (inclusive o runtime do Codex) sem alterar a instalação global. Decisão do dono: seguir assim por enquanto.
- **Repositório git desde 27/09/2026**, remoto em `github.com/mateusreis07/my-app-fitness` — decisão revertida pelo responsável (era "sem git" até a Fase 10).
- **Não dá para testar em dispositivo pelo Wi-Fi**, mas **cabo USB + `adb reverse` resolve** (funcionando desde 26/09/2026). A máquina é ingressada no domínio `softplan.com.br`, então mesmo na rede doméstica o Windows aplica o perfil **Domain** do firewall. Diagnóstico feito em 22/09/2026:
  - `http://127.0.0.1:8082` responde `200`; `http://192.168.0.17:8082` dá timeout. O Metro aceita IPv4 normalmente — é o firewall.
  - Todas as regras de entrada são presas a um executável. As faixas `8080-8082` (Spotify) e `8081-8112` (codex.exe) existem, mas não valem para o `node.exe`. **Trocar de porta não resolve.**
  - Tunnel via ngrok falha com `spawn EPERM` — o binário é bloqueado, provavelmente por EDR corporativo.
  - **Solução que funcionou**: Android platform-tools (`adb.exe`) instalado em `%USERPROFILE%\android-tools\platform-tools` (fora do repositório). Com o celular conectado por cabo USB e a depuração USB autorizada, `adb reverse tcp:8082 tcp:8082` faz o celular enxergar `localhost:8082` como o próprio PC — contorna o firewall porque não é mais tráfego de rede real, é ponte USB. No Expo Go, conectar manualmente em `exp://127.0.0.1:8082`. Depurador Wi-Fi (`adb pair`/`adb connect`) é uma alternativa sem cabo, ainda não testada.
  - **Achado nessa mesma sessão**: só o `import` estático de `expo-notifications` derruba o app no Expo Go Android (SDK 53+) — bug conhecido da comunidade Expo, mesmo sem usar push. Corrigido em `src/features/notifications/scheduler.ts` com import dinâmico, nunca carregado dentro do Expo Go (`Constants.executionEnvironment === StoreClient`) nem na web.
  - Saídas: criar a regra de firewall como administrador (comando abaixo), ou `adb reverse` via cabo USB.
  ```powershell
  New-NetFirewallRule -DisplayName "Expo Metro 8082" -Direction Inbound `
    -Program "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" `
    -Protocol TCP -LocalPort 8082 -Action Allow -Profile Domain,Private
  ```

---

## 7. Como validar

```sh
npm run check           # TypeScript, ESLint, Prettier e os 220 testes
npm run build:native    # bundles Hermes Android/iOS + 37 rotas web (inclui aliases)
npm run migrate:status  # o que já foi aplicado no banco
npm run migrate         # aplica migrations pendentes
node scripts/seed-foods.mjs --status       # alimentos de teste na base global
node scripts/seed-exercises.mjs --status   # exercícios de teste no catálogo global

# Isolamento por RLS, em transação revertida — nada fica no banco:
psql -v ON_ERROR_STOP=1 -d "$SUPABASE_DB_URL_SESSION" -f scripts/rls-check.sql
psql -v ON_ERROR_STOP=1 -d "$SUPABASE_DB_URL_SESSION" -f scripts/rls-nutrition-check.sql
psql -v ON_ERROR_STOP=1 -d "$SUPABASE_DB_URL_SESSION" -f scripts/rls-water-check.sql
psql -v ON_ERROR_STOP=1 -d "$SUPABASE_DB_URL_SESSION" -f scripts/rls-weight-check.sql
psql -v ON_ERROR_STOP=1 -d "$SUPABASE_DB_URL_SESSION" -f scripts/rls-workouts-check.sql
psql -v ON_ERROR_STOP=1 -d "$SUPABASE_DB_URL_SESSION" -f scripts/rls-daily-scores-check.sql
psql -v ON_ERROR_STOP=1 -d "$SUPABASE_DB_URL_SESSION" -f scripts/rls-notification-preferences-check.sql
```

Nesta máquina, troque `npm run X` por `powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 X`.

### Validação da Fase 10 — Notificações (25/09/2026)

- `check` aprovado: TypeScript, ESLint, Prettier e **220 testes** (21 novos: 16 em `model.test.mts`, 5 em `repository.test.mts`).
- Migration `0011_notification_preferences.sql` aplicada: **11 migrations** no total. Uma tabela nova, sem enum.
- `rls-notification-preferences-check.sql` executado contra o banco real com ROLLBACK: isolamento entre dois usuários (select/update), insert em nome alheio negado, `unique(user_id)` bloqueando segunda linha, `TRUNCATE`/`DELETE` negados, `anon` sem privilégio. **7/7 aprovadas.**
- **Ponta a ponta pela API REST**, importando `model.ts` do próprio app, com dois usuários reais: preferência gravada via API com RLS ligada; plano calculado corretamente (água abaixo da meta agenda, treino concluído cancela mesmo com sinal de treino presente, tipos desativados sempre cancelam); segundo usuário sem acesso. **4/4 aprovadas.** Usuários de teste removidos.
- `build:native`: bundles Hermes Android/iOS/web exportados com `expo-notifications` incluído, sem gerar development build; **37 rotas web** (sem rota nova — a configuração vive em `/profile`, já existente).
- Pesquisa técnica prévia confirmou que notificação local funciona no Expo Go a partir do SDK 53 (só o push remoto exige development build), validando a viabilidade da fase antes de escrever código.
- **Revisão manual de notificação de verdade (permissão do sistema, entrega em segundo plano) ainda pendente** — primeira fase que exige isso, além de tela. Ver seção 6.

### Validação da Fase 9 — Score + streak (25/09/2026)

- `check` aprovado: TypeScript, ESLint, Prettier e **199 testes** (20 novos: 13 em `model.test.mts`, 7 em `repository.test.mts`).
- Migration `0010_daily_scores.sql` aplicada: **10 migrations** no total. Uma tabela nova, sem enum; `closeDayScore` lê metas/nutrição/água/treino sequencialmente (não `Promise.all`) para ficar simples de testar com o cliente simulado de fila única.
- `rls-daily-scores-check.sql` executado contra o banco real com ROLLBACK: isolamento entre dois usuários (select/update), insert em nome alheio negado, CHECK de faixa de componente, `TRUNCATE`/`DELETE` negados, `unique(user_id, score_date)` bloqueando um segundo fechamento do mesmo dia, `anon` sem privilégio. **8/8 aprovadas.**
- **Ponta a ponta pela API REST**, importando `model.ts`/`totals.ts` do próprio app, com dois usuários reais: meta nutricional vigente; um dia batendo a meta exatamente e sem treino programado calculou 95 à mão (100×0,25+100×0,20+100×0,15+100×0,25+67×0,15); um dia sem nenhum registro (mas com meta vigente) calculou 25 à mão — nunca zero fabricado, porque o componente de treino sem plano vale 100; o fechamento gravado no banco bateu com o cálculo; segundo usuário sem acesso. **4/4 aprovadas.** Usuários de teste removidos.
- `build:native`: bundles Hermes Android/iOS/web exportados sem dependência nativa nova; **37 rotas web**, com `/score`.
- KORA Score movido para o topo do Dashboard Hoje (seção 88), com tratamento visual de card escuro igual ao de Energia — o card antigo (`s.badge`/placeholder "em breve") foi removido.
- Revisão visual pelo dono **ainda pendente** — ver seção 6.

### Validação da Fase 8 — Treinos (24/09/2026)

- `check` aprovado: TypeScript, ESLint, Prettier e **179 testes** (23 novos: 10 em `model.test.mts`, 7 em `progression.test.mts`, 6 em `repository.test.mts`).
- Dois avisos do lint corrigidos durante a implementação, ambos viraram invariante (21 e 22 na seção 4): impureza por `Date.now()` no corpo de `useRestTimer`, e `setState` síncrono no início de um `useEffect` em `SessionScreen`.
- Migration `0009_workouts.sql` aplicada: **9 migrations** no total. Oito tabelas, dois enums; `workout_day_exercises` e `workout_sets` são o primeiro caso de posse a dois saltos do projeto.
- `scripts/seed-exercises.mjs` executado: 25 exercícios com `source='seed'`.
- `rls-workouts-check.sql` executado contra o banco real com ROLLBACK: isolamento entre dois usuários em toda a cadeia (incluindo os dois saltos), catálogo global só leitura, CHECK de origem única, faixa de repetições invertida, segundo plano ativo, `UPDATE` em série registrada, `anon` sem privilégio, `authenticated` sem `TRUNCATE`, e preservação do nome ao apagar um exercício do catálogo. **18/18 aprovadas.**
- **Ponta a ponta pela API REST**, importando `progression.ts` do próprio app, com dois usuários reais: plano/dia/exercício-do-dia via API real; duas sessões concluídas no topo da faixa de repetições; retentativa da mesma série sem duplicar; sinal de progressão calculado localmente batendo com o esperado; segundo usuário sem acesso. **4/4 aprovadas.** Usuários de teste removidos.
- `build:native`: bundles Hermes Android/iOS/web exportados com `expo-haptics` incluído (nova dependência nativa desde `react-native-svg`); **35 rotas web**, com `/workouts`, `/plan-builder` e `/workout-session`.
- Revisão visual pelo dono **ainda pendente** — ver seção 6.

### Validação da Fase 7 — Peso e evolução (24/09/2026)

- `check` aprovado: TypeScript, ESLint, Prettier e **156 testes** (31 novos: 8 em `model.test.mts`, 8 em `repository.test.mts`, 15 em `trend.test.mts`).
- Migration `0008_weight_logs_local_day.sql` aplicada: **8 migrations** no total. Acrescenta `recorded_date`/`recorded_timezone` a `weight_logs` com backfill a partir do fuso de `profiles`, e o CHECK de coerência entre data e fuso.
- Um bailout do React Compiler surgiu isolando `movingAverage(series, dayKey)` solto no corpo de `useWeightHistory`: a memoização manual do `useFocusEffect` deixava de ser preservada, mesmo com o parâmetro padrão passado explicitamente. Isolar os cálculos de tendência em `useMemo` resolveu. Relato completo em `docs/PHASE_7.md`.
- `rls-weight-check.sql` executado contra o banco real com ROLLBACK: colunas obrigatórias, retentativa sem duplicar, isolamento entre dois usuários, faixa de peso, coerência data/fuso, limite de observação, `anon` sem privilégio e `authenticated` sem `TRUNCATE`. **12/12 aprovadas.**
- **Ponta a ponta pela API REST**, importando `trend.ts` e `model.ts` do próprio app, com dois usuários reais: onze registros de peso em dez dias mais um objetivo ativo; a tendência de 7 dias lida do banco (78,8 kg) bateu com a mesma conta feita localmente sobre os dados de origem; comparação semanal, variação desde o início e progresso até a meta calculados sobre dado real; nenhum resultado com data prevista; segundo usuário sem acesso; reenvio do mesmo registro sem duplicar. **12/12 aprovadas.** Usuários de teste removidos — só a conta real do responsável permaneceu no banco.
- `build:native`: bundles Hermes Android (4 MB), iOS (3,7 MB) e web (1,8 MB), com `react-native-svg` incluído sem quebrar a exportação. **31 rotas web**, com `/weight` e `/progress`.
- Revisão visual no navegador **ainda pendente** — é o primeiro gráfico do app.

### Validação da Fase 6 — Hidratação (23/09/2026)

- `check` aprovado: TypeScript, ESLint, Prettier e **125 testes** (13 novos).
- Migration `0007_water_logs.sql` aplicada: **7 migrations** no total; sem alterações nas anteriores.
- `rls-water-check.sql` e `rls-check.sql` executados contra o banco real com ROLLBACK. Isolamento, limites, data/fuso, privilégios e idempotência aprovados.
- API real com conta QA: registros 250/500/350, retry sem duplicação, total 1.100 e remoção para 850 ml.
- Navegador em largura móvel: 850 → 1.100 pelo atalho do dashboard; rejeição de zero; 1.100 → 1.450 por quantidade personalizada. Confirmação, histórico e layout conferidos.
- Sem meta automática: registro de +500 ml confirmado, total 1.950 ml e meta ausente, sem inventar valores. Conta QA e seus dados removidos ao fim da validação.
- `build:native`: bundles Hermes Android/iOS e 29 rotas web (inclui aliases de grupos), com `/hydration`. Teste em aparelho físico permanece pendente.
- Logs em `artifacts/phase6-check.log`, `artifacts/phase6-rls.log`, `artifacts/phase6-export.log`. Backup anterior ao trabalho em `artifacts/phase6-backup/`.

### Validação da Fase 5 — Nutrição (23/09/2026)

- `check`: TypeScript, ESLint e Prettier aprovados; **112 testes** (eram 83). 29 novos em `src/features/nutrition/`.
- `migrate`: `0005_nutrition.sql` aplicada. Conferido que as quatro tabelas têm RLS e que `anon` não recebeu privilégio algum; `foods` só recebeu `select`.
- `scripts/rls-nutrition-check.sql` contra o projeto real, em transação revertida: isolamento entre dois usuários em alimento, refeição e item; escrita na base global negada; insert em refeição alheia bloqueado; delete em item alheio sem efeito; `TRUNCATE` negado nas quatro tabelas; refeição duplicada e item com duas origens recusados; e **apagar o alimento preserva o item registrado**.
- **Ponta a ponta pela API REST** com dois usuários reais, importando os módulos de cálculo do app: alimento `201`, refeição `201`, item `201`, upsert reaproveitando a refeição, totais do banco batendo com o motor (186 kcal para 150 g de um alimento de 124 kcal/100 g), isolamento entre os dois, insert alheio `403`, escrita em `foods` `403`, e item preservado após apagar o alimento. 14/14. Usuários de teste removidos.
- `build:native`: rotas `/add-food` e `/new-food` exportadas.
- **Uso real pelo dono em 23/09/2026**, que fecha a validação da fase: 3 refeições e 4 itens registrados, sendo 2 do cadastro próprio e 2 da base global. Conferida a aritmética linha a linha contra os valores de origem — arroz 200 g = 256 kcal, feijão 200 g = 152 kcal, total 508 kcal e 25 g de proteína. `meal_date` gravado no dia correto do fuso do perfil, e o total apareceu na aba Hoje: é a prova de ponta a ponta de que o relógio compartilhado funciona.

### Validação da Fase 4 — Dashboard Hoje (22/09/2026)

- A fase foi retomada de outro terminal que ficou sem créditos no meio. **Estava com o `check` quebrado**: 4 erros de `react-hooks/preserve-manual-memoization` em `useDashboard.ts`. O React Compiler infere os setters do `useState` como dependências; incluí-los resolve sem mudar comportamento, já que são identidades estáveis.
- Corrigido junto um vazamento real: `setRefreshing(false)` era pulado quando a leitura era substituída ou abortada, deixando o indicador girando para sempre. Agora vai em `finally`, e só a requisição mais recente devolve o controle.
- `check`: TypeScript, ESLint e Prettier aprovados; **83 testes passando** (eram 69).
- `build:native`: exportação Hermes Android/iOS e **18 rotas web**.
- Estados renderizados pelo servidor de desenvolvimento, com verificação de conteúdo: com registros mostra os números; vazio mostra ausência e **não vaza** os números do fixture; erro mostra a mensagem de falha.
- Removidos: a rota de teste `src/app/dashboard-check.tsx` (dados fictícios, não pode ir a produção — cópia em `artifacts/dashboard-check.tsx.bak`) e o código morto `TargetsCard.tsx` + `useCurrentTargets.ts`, substituídos pelo dashboard.
- Conferido que nenhum segredo do `.env` entra nos bundles exportados.
- Sem migration, sem alteração de RLS, sem toque em dado real.
- **Revisão visual pelo dono apontou um defeito real**: o `NavButton` perdia todo o estilo na web, porque `Link asChild` descarta o `style` em função do `Pressable`. O visual foi movido para uma `View` interna. Atingia Perfil, Sobre, 404, boas-vindas e o dashboard; no card escuro deixava o texto invisível. Verificado no DOM antes e depois.

### Validação da revisão 1.2 (22/09/2026)

- `check`: TypeScript, ESLint e Prettier aprovados; **69 testes passando**. Inclui testes de integração do submit com cliente simulado e varredura de entradas extremas do motor.
- `build:native`: exportação Hermes Android/iOS e **23 rotas web** concluída.
- Sem nova migration ou alteração de RLS; banco real e metas históricas não foram modificados. Os novos testes de persistência usam cliente simulado, não validam novamente o serviço remoto.
- Revisão visual dos novos estados e teste em dispositivo real ainda pendentes. A revisão clínica/triagem é requisito antes do beta; não bloqueia implementar a Fase 4.
- Avisos conhecidos de ferramentas: Node reinterpreta módulos dos testes como ESM; Supabase informa depreciação de `processLock`. Não houve erro nos checks/exportação; não alterado o ciclo de sessão nesta revisão.
- Backup local anterior à revisão em `artifacts/product-decisions-backup/`; fontes copiadas têm extensão `.bak` para não entrar no TypeScript. O documento mestre recebeu somente um adendo, sem reformatação do original.

### Histórico de validação até o motor 1.1 (22/09/2026)

Os itens abaixo são históricos e não representam nova validação remota/visual da revisão 1.2. A situação de banco vazio era do teste; posteriormente houve uso real.

- `npm run check` verde; **61 testes**.
- `npm run build:native`: bundles Android/iOS e 23 rotas web.
- `scripts/rls-check.sql` contra o projeto real: cada usuário vê só a própria linha; update em linha alheia não afeta nada; insert em nome de outro bloqueado; `TRUNCATE` e `DELETE` em `profiles` negados; índice de objetivo ativo único funcionando.
- **Ponta a ponta pela API REST**, replicando a ordem exata de `submit.ts`: cadastro devolve sessão; trigger cria o perfil com o nome; as cinco escritas do onboarding passam; conclusão marcada e relida; objetivo anterior encerrado e histórico preservado; segundo objetivo ativo simultâneo recusado com `409`; logout aceito.
- **Motor Fitness ponta a ponta**, importando o próprio módulo do projeto: o banco guardou exatamente os números calculados (1775 kcal · P131 C191 G54 · 2538 ml); versão `fitness_engine@1.1` registrada; segunda meta vigente simultânea recusada com `409`; recálculo fechou a anterior e preservou o histórico; `calculation_source` inválido recusado com `400`; meta em nome de outro usuário bloqueada com `403`. 10/10 verificações.
- Usuários de teste removidos — o banco ficou com zero linhas em todas as tabelas.
- **Motor Fitness ponta a ponta na versão 1.1**, importando o módulo do projeto: o banco guardou exatamente os números calculados, com a versão `fitness_engine@1.1`; meta vigente única, histórico preservado no recálculo, formato de versão inválido recusado com `400` e meta de outro usuário com `403`. 10/10.
- **Revisão da interface no navegador pelo dono** em 22/09/2026, com o app servido pelo Metro. Nenhum problema reportado no cadastro, no onboarding ou na tela de resultado.
- **Conferência da linha gravada por esse uso real** (homem, 33 anos, 177 cm, 96 kg, moderadamente ativo, perder 6 kg até 31/12/2026): TMB 1906, TDEE 2955, meta 2493 kcal, P173 C279 G76, 3360 ml, `fitness_engine@1.1`. Refeita a conta à mão, bate em todos os campos. O déficit saiu **462 kcal/dia**, derivado do prazo real (6 kg em 100 dias ≈ 0,42 kg/semana) — não do padrão de 15% nem do antigo fixo de 10%. É a prova de que a correção do motor 1.1 funciona pela interface, não só nos testes.

---

## 8. Como atualizar este arquivo

Ao terminar qualquer implementação, antes de dizer que acabou:

1. Atualize **"Última atualização"**, **"Fase concluída"** e **"Próxima fase"** no topo.
2. Marque a fase na tabela de roadmap.
3. Acrescente o que passou a existir na seção 2.
4. Se mexeu no banco: atualize a seção 3 (tabela, RLS, verbos) e `database.types.ts`.
5. Se descobriu um furo que não pode voltar: vire invariante na seção 4.
6. Se decidiu algo que não estava no documento mestre: registre na seção 5 e **avise o dono**.
7. Revise a seção 6 — risque o que foi resolvido, acrescente o que apareceu.
8. Atualize a seção 7 com o que foi realmente executado, com números reais.
9. Crie ou atualize o `docs/PHASE_N.md` da fase.

Não escreva aqui que algo funciona sem ter rodado. Se não deu para validar, diga que não deu e por quê.
