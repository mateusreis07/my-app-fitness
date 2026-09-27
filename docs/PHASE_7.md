# Fase 7 — Peso e evolução

Implementada em 24/09/2026. Fonte: seções 35, 36, 37, 64, 81 e roadmap Fase 7 do `KORA_MASTER_CONTEXT.md`; contrato de não recalcular metas a partir do peso real em `PRODUCT_DECISIONS.md`.

## Entrega

- Tela `/weight`, protegida pelo grupo `(logging)` existente: registro de peso, observação opcional e histórico com remoção por confirmação inline.
- Aba Progresso deixa de ser prévia e passa a mostrar peso atual, peso inicial e meta (de `goals`), variação desde o início, tendência de 7 dias, comparação semanal, gráfico e os totais de proteína e água do dia (Fases 5 e 6).
- Gráfico de peso em `react-native-svg`, primeiro componente visual de dados do app: linha diária mais média móvel, distinguidas por forma (ponto vs. linha), não por cor.
- Capacidade `weight` ligada no Dashboard Hoje, com a legenda de tendência real substituindo o placeholder "a tendência ficará disponível…", e a meta de `goals.target_weight_kg` — antes buscada e nunca exibida.
- Mensagens separadas para carregamento, ausência de histórico, falha de leitura, falha de meta, gravação, remoção e resposta incerta.

## Decisões técnicas e de produto

1. **Sem biblioteca de gráfico.** Victory Native XL exige Nova Arquitetura e Skia, incompatível com Expo Go. `react-native-svg` vem incluído no Expo Go e no bundle web; o gráfico foi escrito à mão sobre ele. Esquema monocromático por desenho, não por limitação: os dois traços (registro bruto e média móvel) representam a mesma grandeza, então a distinção correta é por forma, não por matiz — o que já atende à seção 91 sem precisar de uma segunda cor validada por CVD.
2. **Eixo Y não começa em zero.** É peso corporal, não contagem; forçar o zero esconderia a variação real. Rótulos de mínimo e máximo sempre visíveis; dia sem registro vira lacuna, nunca interpolação.
3. **Progresso mostra só o que existe de verdade.** Peso, meta, variação, tendência, proteína e água. Treinos e aderência (também citados na seção 37) entram nas Fases 8 e 9; não há espaço reservado vazio para eles.
4. **Nenhuma projeção de data de chegada, em lugar nenhum.** `trend.ts` calcula média móvel de 7 dias e comparação entre médias semanais (seção 36), mas nunca converte isso em data futura — o `PRODUCT_DECISIONS.md` cita Hall et al. contra conversão linear de peso. Testado explicitamente: nenhuma função do módulo devolve string em formato de data.
5. **Motor Fitness não é recalculado a partir do peso real.** Registrar peso não gera nova `nutrition_targets`, não altera `goals` e não dispara incentivo de perda — `goals` continua representando intenção, não recomendação viva.
6. **Dia local capturado na escrita**, mesmo padrão da Fase 6: `recorded_at` guarda o instante, `recorded_date` o dia no fuso do perfil, `recorded_timezone` o fuso usado, com CHECK de coerência no banco. `weight_logs` nasceu na Fase 2 sem essas colunas; a migration 0008 as acrescentou com backfill a partir do fuso salvo em `profiles`, e só depois as tornou obrigatórias.
7. **Repetição idempotente.** Mesmo protocolo da hidratação: UUID por operação via `expo-crypto`, upsert com conflito ignorado seguido de releitura de conferência, e retentativa que preserva UUID, instante e valores — nunca UPDATE, nunca duplicação.
8. **Dia com mais de um registro vira a média do dia**, não o último valor: escolher a última pesagem seria arbitrário, e a média já reduz o ruído que a seção 36 quer combater.
9. **Sem edição de registro nesta fase.** Só adicionar e remover, como nas fases anteriores.

## Banco e privilégios

Migration aplicada: `0008_weight_logs_local_day.sql`. Acrescenta `recorded_date` e `recorded_timezone` a `weight_logs`, faz o backfill das linhas existentes a partir do fuso do dono (com `America/Sao_Paulo` como último recurso), torna as colunas obrigatórias e adiciona o CHECK `weight_logs_local_date`. Índice novo `(user_id, recorded_date desc, id)` para a série do gráfico.

RLS e os quatro verbos (`select`, `insert`, `update`, `delete`) já existiam desde a migration 0003 e não foram alterados. `database.types.ts` atualizado na mesma entrega: `WeightLog` ganhou as duas colunas, e o `Insert` de `weight_logs` passou a manter `id` opcional, para o cliente poder mandar o próprio UUID sem perder a geração automática no onboarding.

## Testes e validação

- 31 testes novos entre `model.test.mts` (8), `repository.test.mts` (8) e `trend.test.mts` (15); suíte total **156**. Cobrem faixa de peso, vírgula decimal, arredondamento de 1 casa, entrada inválida que não chega ao servidor, isolamento por dono, paginação por cursor, idempotência do upsert, e — no núcleo da fase — média móvel exata na janela de 7 dias, dia com múltiplos registros virando média, lacuna não interpolada, comparação semanal, progresso até a meta nos dois sentidos (perda e ganho), meta alcançada sem faltante negativo, e a garantia de que nenhuma função devolve data prevista.
- Uma armadilha real do React Compiler apareceu no meio do caminho: `movingAverage` tem um parâmetro com valor padrão (`windowDays = TREND_WINDOW_DAYS`), e chamá-lo solto no corpo do hook impedia o compilador de preservar a memoização manual do `useFocusEffect` — mesmo passando o parâmetro explicitamente na chamada. A causa exata não foi confirmada com certeza (o compilador aponta para uma dependência não relacionada), mas isolar os cálculos de tendência em um `useMemo` próprio resolveu, e é também a forma correta de expor um dado derivado como esse.
- `check`: TypeScript, ESLint, Prettier e os 156 testes aprovados.
- `scripts/rls-weight-check.sql` executado no banco real, com ROLLBACK: colunas da migration 0008 obrigatórias, retentativa sem duplicar, isolamento entre dois usuários (select/insert/delete), faixa de peso, coerência entre `recorded_date` e o fuso, limite de observação, `anon` sem privilégio algum e `authenticated` sem `TRUNCATE`. Doze verificações, todas aprovadas.
- Ponta a ponta pela API REST com dois usuários reais, importando os módulos `trend.ts` e `model.ts` do próprio app: onze registros de peso ao longo de dez dias, mais um objetivo ativo; a tendência de 7 dias lida do banco (78,8 kg) bateu com a mesma conta feita localmente sobre os dados de origem; comparação semanal, variação desde o início e progresso até a meta calculados sobre dado real; nenhum resultado carregando data prevista; segundo usuário sem acesso; reenvio do mesmo registro sem duplicar. Doze verificações, todas aprovadas. Usuários de teste removidos ao final — só a conta e os dados reais do responsável permaneceram no banco.
- `build:native`: bundles Hermes Android (4 MB), iOS (3,7 MB) e web (1,8 MB) exportados sem erro com `react-native-svg` incluído; 31 rotas estáticas, com `/weight` e `/progress` entre elas.
- **Revisão visual pelo dono em 24/09/2026**, com 14 dias de peso inseridos na conta real para exercitar o gráfico pela primeira vez (13 fictícios, marcados `notes = 'TESTE — apagar'`; mantidos por decisão do responsável — ver `STATUS.md`). Tendência de 7 dias (96,2 kg), comparação semanal (-1,1 kg) e variação desde o início (-2,0 kg em 13 dias) conferidas à mão contra os dados de origem: bateram exatas. Aprovado sem defeito.

## Arquivos e continuidade

`src/features/weight/`: modelo, tendência, repositório, hook de histórico, gráfico e as duas telas (registro e evolução). As rotas ficam em `src/app/(logging)/weight.tsx` e `src/app/(tabs)/progress.tsx`. `ModulePreview.tsx` perdeu `'progress'` da união de módulos, que agora só atende Treino. A integração reusa `DashboardScreen`/`DashboardView`, `useNutritionDay` e `useHydrationDay` das fases anteriores, sem duplicar nenhum cálculo.

Próxima fase: **Fase 8 — Treinos**. Ao chegar lá, a aba Progresso ganha a métrica de treinos que a seção 37 já previa, e o motor de prioridades passa a ter dado real para a prioridade `workout`, hoje condicionada mas nunca acionada.
