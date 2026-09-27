# Fase 2 — Onboarding

Fonte de produto: `KORA_MASTER_CONTEXT.md`, seção 12 (etapas), 62 (goals), 64 (weight_logs), 81 (RLS), 97 (histórico de metas) e 133 (não decidir em silêncio).

## Escopo

Fluxo completo de sete etapas, com persistência no banco e conclusão registrada no perfil. O onboarding é obrigatório: enquanto `profiles.onboarding_completed_at` for nulo, o usuário autenticado é levado para `/onboarding` em vez das abas.

Etapas implementadas, na ordem da seção 12: objetivo, dados básicos, meta, atividade, treino, alimentação e resultado.

## Decisões da entrega original

**Registro histórico da Fase 2.** Idade, ritmo, prazo e resultado foram revisados e aprovados no motor 1.2; regras atuais em `PRODUCT_DECISIONS.md` e `PHASE_3.md`. Não implementar as decisões antigas abaixo em código novo.

- As etapas 5 e 6 não têm tabela definida no documento mestre. Foram criadas duas tabelas focadas, de uma linha por usuário — `training_preferences` e `nutrition_preferences` — em vez de um blob de respostas.
- **Idade mínima de 18 anos.** Metas calóricas e de treino para menores exigem tratamento próprio e consentimento de responsável (seção 84). É o padrão mais seguro e é reversível: basta alterar `MIN_AGE` em `src/features/onboarding/validation.ts` e a cópia correspondente. **Confirmada em 22/09/2026; fonte atual em `PRODUCT_DECISIONS.md`.**
- **Ritmo seguro de mudança de peso:** até 1 kg por semana para perda e 0,5 kg por semana para ganho. A seção 18 remete a "configuração de negócio" sem fixar números, então eles ficam isolados em constantes exportadas e testadas.
- Prazo inseguro **avisa e sugere uma data viável, sem bloquear**. Bloquear empurraria o usuário a informar dados falsos. Atende a seção 12.3: o sistema não incentiva prazo inseguro.
- A etapa de meta é pulada para objetivos sem peso-alvo (manter peso, melhorar saúde, melhorar condicionamento).
- `nutrition_targets` (seção 63) **não** foi criada. Ela é preenchida pelo Motor Fitness, que é a Fase 3. Criar a tabela vazia agora seria implementar função futura sem uso (regra 1).
- **A etapa 7 não exibe calorias, macros nem água.** Esses números são do Motor Fitness. Em vez de estimar, a tela mostra o resumo das respostas e informa que as metas chegam na próxima fase. Isso mantém o princípio da Fase 0 de não apresentar dado fictício como real.
- Um único objetivo ativo por usuário, garantido por índice parcial. Refazer o onboarding encerra o objetivo anterior com status `abandoned` em vez de apagá-lo (seção 97).
- Vegano implica vegetariano, tanto na interface quanto em `CHECK` no banco.

## Critérios de aceite

- [x] Sete etapas navegáveis, com barra de progresso e volta sem perder respostas.
- [x] Validação por etapa, com mensagem por campo no catálogo pt-BR.
- [x] Aviso de prazo inseguro com data sugerida.
- [x] Persistência em `profiles`, `goals`, `weight_logs`, `training_preferences` e `nutrition_preferences`.
- [x] Conclusão marcada em `profiles.onboarding_completed_at` e liberação das abas.
- [x] Conclusão por último: falha no meio permite nova tentativa, sem garantia de idempotência dos inserts.
- [x] TypeScript, ESLint, Prettier e testes passam. Export Android/iOS/web gerado.

## Migrations

- `0003_onboarding.sql` — enums `goal_type`, `goal_status`, `training_location`; coluna `profiles.onboarding_completed_at`; tabelas `goals`, `weight_logs`, `training_preferences` e `nutrition_preferences`; índice parcial de objetivo ativo único; RLS e privilégios explícitos para as quatro tabelas.

## Ordem de escrita

Não existe transação entre chamadas REST. A ordem em `submit.ts` é deliberada: perfil, peso, encerramento do objetivo anterior, novo objetivo, preferências de treino, preferências de alimentação e, por último, a marca de conclusão. Se algo falhar no meio, o onboarding continua pendente e pode ser refeito, com ressalvas: upserts são idempotentes, mas inserts podem duplicar histórico. O fluxo não é transacional.

## Testes

- `src/features/onboarding/validation.test.mts` — 14 testes: vírgula decimal, datas em dois formatos, dias impossíveis, cálculo de idade, bloqueio de menores de 18, direção do peso-alvo, prazo no passado, prazo inseguro com data sugerida, ritmo diferente para perda e ganho, e obrigatoriedade das etapas.
- `src/features/onboarding/payload.test.mts` — 5 testes: conversão completa para as linhas do schema, objetivo sem peso-alvo, vegano implicando vegetariano, observação vazia virando `null`, e rascunho incompleto devolvendo `null`.

## Validação executada

- `npm run check`: TypeScript, ESLint e Prettier sem erros; 34 testes aprovados.
- `npm run build:native`: bundles Hermes Android/iOS e 23 rotas web, incluindo `/onboarding`.
- Isolamento por RLS das novas tabelas verificado junto com a Fase 1 (`scripts/rls-check.sql`), incluindo o índice parcial de objetivo ativo único.
- **Sequência completa de escrita verificada contra o projeto real**, replicando a ordem de `submit.ts` com um usuário criado pela API: perfil, peso, encerramento do objetivo anterior, novo objetivo, preferências de treino, preferências de alimentação e marca de conclusão. A releitura do perfil já traz `onboarding_completed_at` preenchido e os dados gravados. Refazer o fluxo encerra o objetivo anterior e preserva o histórico; um segundo objetivo ativo simultâneo é recusado com `409`. Os usuários de teste foram removidos e o banco ficou com zero linhas.

## Limites conhecidos

- A sequência de escrita foi validada pela API REST e por teste unitário do payload, não por uma pessoa percorrendo as telas. A interface em si não foi exercitada por um usuário real.
- O rascunho vive apenas em memória. Fechar o app no meio do onboarding recomeça do zero. Persistir o rascunho localmente é melhoria pendente.
- Não há tela para refazer ou editar o plano depois de concluído.

## Próxima fase

Fase 3 — Motor Fitness: IMC, TMB, TDEE, calorias por objetivo, proteína, gorduras, carboidratos e água, com versionamento de regra (`fitness_engine_version`) e teste unitário por fórmula. É essa fase que preenche `nutrition_targets` e completa a etapa 7 do onboarding com números reais.
