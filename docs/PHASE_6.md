# Fase 6 — Hidratação

Implementada em 23/09/2026. Fonte: seções 22, 34, 65, 81 e roadmap Fase 6 do `KORA_MASTER_CONTEXT.md`; contrato de ausência de meta em `PRODUCT_DECISIONS.md`.

## Entrega

- Tela `/hydration`, protegida pelo grupo `(logging)` existente.
- Meta vigente de `nutrition_targets.water_ml`, consumo, restante e histórico do dia.
- Atalhos de 250/500 ml na tela e diretamente no Dashboard Hoje; quantidade personalizada na tela.
- Remoção com confirmação inline e atualização do total.
- Registro permitido sem meta automática; sem percentual ou restante inventado.
- Capacidade `water` ligada junto do sinal real e da ação de prioridade; treino/peso continuam desligados.
- Atualizar no dashboard recarrega também água e nutrição. Foco, retorno ao primeiro plano e virada do dia atualizam a hidratação.
- Mensagens separadas para carregamento, ausência, falha de leitura, falha de meta, gravação e remoção.

## Decisões técnicas e de produto

1. **Meta existente, sem recálculo.** O motor fitness permanece 1.2. Não foi criada meta manual ou independente para quem não tem plano; essas pessoas podem registrar normalmente sem meta. Notificações, widgets e relógios continuam futuros.
2. **Dia capturado no fuso do perfil.** `recorded_at` guarda o instante, `recorded_date` o dia local e `recorded_timezone` o fuso usado. CHECK no banco exige coerência entre eles. O dia histórico não é reescrito quando o usuário viaja. Registro é do momento atual; navegação por datas anteriores não faz parte desta fase.
3. **Quantidade inteira entre 1 e 5.000 ml por registro.** Limite técnico de entrada, não recomendação de ingestão. Mesma validação no cliente e no banco. Não há incentivo a ultrapassar a meta nem limite artificial do total diário.
4. **Repetição idempotente.** `expo-crypto`, instalado via Expo, gera UUID por operação. INSERT com conflito ignorado seguido de releitura confirma os valores. Retry usa o mesmo UUID, instante, dia e quantidade; não usa UPDATE e não duplica a operação.
5. **Resposta incerta.** Um bloqueio síncrono evita toque duplo durante gravação. Após falha, nova tentativa conserva a operação; o usuário também pode conferir o histórico e encerrar a tentativa. Não é uma fila offline: a tentativa pendente vive em memória e não sobrevive ao encerramento do app. Após reabrir, conferir o histórico antes de repetir manualmente.
6. **Leitura completa e isolada.** Paginação por cursor de UUID em páginas de 200 evita o truncamento padrão do Supabase. Erro não vira zero. Lista vazia carregada com sucesso representa zero registrado. Cada consulta filtra usuário e dia; respostas antigas são descartadas.
7. **Excluir para corrigir.** Sem edição de registro nesta fase. Remoção confirmada apaga somente a linha escolhida e do usuário autenticado.

## Banco e privilégios

Migration aplicada: `0007_water_logs.sql`.

`water_logs`: UUID, `user_id`, quantidade, instante, dia/fuso de registro, criação. Índices `(user_id, recorded_at desc)` e `(user_id, recorded_date, id)`.

RLS com políticas próprias para SELECT, INSERT e DELETE. Privilégios explicitamente revogados de `anon` e `authenticated`, concedendo somente os três verbos a `authenticated`. Sem UPDATE/TRUNCATE. Chave estrangeira para `auth.users` com exclusão em cascata.

`database.types.ts` atualizado na mesma entrega. Migrations anteriores e registros do responsável preservados.

## Testes e validação

- 13 testes novos de hidratação; suíte total **125**. Validação de quantidades, calendário noturno, soma/deduplicação, ausência de meta, paginação, isolamento de consultas, cancelamento, falhas, confirmação e retry idempotente.
- `check`: TypeScript, ESLint, Prettier e testes aprovados.
- `scripts/rls-water-check.sql` executado no banco real, com ROLLBACK: permissões, isolamento, insert alheio, delete alheio, repetição, soma, limites de quantidade, coerência de data/fuso e remoção própria.
- `scripts/rls-check.sql` também executado: invariantes de perfis e objetivos preservados.
- API real usando os módulos do app e conta QA temporária: onboarding, 250/500/350 ml, repetição sem duplicar, total 1.100 ml, remoção e total 850 ml.
- Navegador com conta QA: dashboard carregou 850 ml; atalho +250 resultou em 1.100 ml; zero personalizado rejeitado; +350 personalizado resultou em 1.450 ml, com confirmação e histórico. Layout inspecionado em largura móvel.
- Exportação final e limpeza da conta QA registradas em `STATUS.md`. Teste em dispositivo físico continua pendente.
- Registro sem meta automática confirmado na interface: +500 ml levou o total a 1.950 ml, mantendo a meta ausente. Exportação Android/iOS e 29 rotas web aprovada; conta QA removida.

## Arquivos e continuidade

`src/features/hydration/`: validação e totais, repositório, hook de leitura/gravação, tela e testes. A rota fica em `src/app/(logging)/hydration.tsx`. A integração usa `DashboardScreen`/`DashboardView` existentes e preserva a nutrição da Fase 5.

Próxima fase: **Fase 7 — Peso e evolução**. Não gerar metas novas silenciosamente a partir de alterações de peso. Preservar o versionamento e a vigência dos planos.
