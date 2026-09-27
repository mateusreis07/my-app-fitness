# Fase 4 — Dashboard Hoje

Fonte de produto: `KORA_MASTER_CONTEXT.md`, seções 23 (dashboard), 24 (componentes da home), 25 (prioridades diárias), 26 (motor de prioridades), 89 (estados vazios), 91 (acessibilidade), 93 (timezone) e 112 (experiência de erro). O contrato herdado da Fase 3 está em `docs/PRODUCT_DECISIONS.md`.

## Escopo

Tela Hoje conectada aos dados reais do usuário: saudação, meta calórica e macros, água, peso mais recente, treino previsto e o motor de prioridades. Cada painel falha de forma isolada.

Esta fase substitui o `TargetsCard`, que era a ponte provisória criada na Fase 3.

## Como a tela se atualiza

O `useDashboard` invalida a leitura em quatro situações: foco na aba, retorno do app ao primeiro plano, virada do dia no fuso do perfil e mudança do usuário ou da conclusão do onboarding.

Um retrato só é exibido quando pertence à chave atual — `usuário : dia : fuso : conclusão do onboarding`. Assim, dados de outro dia ou de outra conta nunca aparecem por um instante na troca.

Respostas antigas são descartadas por um contador de requisição somado a `AbortController`. Ao sair da tela, tudo em voo é invalidado.

## Decisões reversíveis

- **Capacidades nascem todas desligadas.** `DASHBOARD_CAPABILITIES` tem `nutrition`, `water`, `weight` e `workout` em `false`. Nenhuma prioridade aparece enquanto a fase que gera o dado e a ação correspondente não existirem. Ligar uma capacidade sem o adaptador real produziria um lembrete que não leva a lugar nenhum.
- **Ausência de dado nunca vira zero.** `metricProgress` devolve `null` quando o consumo é desconhecido, quando a meta é ausente ou quando qualquer valor é inválido. A tela distingue "sem registro" de "registrou zero", e `fraction` só existe quando há meta positiva — não há divisão por zero.
- **Sem meta vigente, a tela mostra o estado sem meta.** Não inventa calorias, não atribui porcentagem, não penaliza nada e não devolve o usuário ao onboarding já concluído, conforme o contrato da Fase 3.
- **Erro e ausência são estados diferentes.** `Resource<T>` é `{ status: 'ready', data: T | null }` ou `{ status: 'error' }`. Falha de leitura mostra erro com opção de tentar de novo; ausência legítima mostra estado vazio.
- **Falha isolada por painel.** As quatro consultas rodam em paralelo e cada uma tem seu próprio resultado. O peso falhar não apaga a meta calórica.
- **O dia é o do fuso do perfil**, não o do servidor nem o UTC (seção 93). `resolveTimeZone` cai para o fuso do dispositivo e, por último, UTC, sem lançar exceção com fuso inválido.
- **Prioridades são determinísticas.** Sem rede, sem IA, sem relógio implícito: tudo entra por parâmetro. No máximo três, ordenadas por relevância fixa.
- **`goals` é intenção, não recomendação.** Um objetivo ativo sozinho não dispara incentivo de perda de peso.

## Regras do motor de prioridades

| Prioridade | Condição                                                       | Relevância |
| ---------- | -------------------------------------------------------------- | ---------- |
| Treino     | sessão marcada para hoje e não concluída                       | 100        |
| Água       | depois das 15h e abaixo de 60% da meta                         | 80         |
| Proteína   | depois das 16h, com refeição registrada, abaixo de 70% da meta | 70         |
| Peso       | último registro com 7 dias ou mais, ou nenhum registro         | 50         |

Proteína exige `mealCount > 0`: não ter registrado refeição não é o mesmo que ter comido pouca proteína. A meta precisa estar vigente no dia consultado — uma meta futura ou encerrada não gera lembrete.

## Critérios de aceite

- [x] Saudação por período do dia, no fuso do perfil.
- [x] Painéis de meta calórica, macros, água, peso e treino.
- [x] Estado vazio, estado de erro e estado sem meta distintos entre si.
- [x] Atualização por foco, retorno do app e virada do dia.
- [x] Motor de prioridades determinístico, limitado a três.
- [x] Nenhum dado fictício e nenhuma porcentagem sem meta.
- [x] TypeScript, ESLint, Prettier e 83 testes passam. Export Android/iOS/web gerado.

## Migrations

Nenhuma. A fase é só de leitura: consulta `nutrition_targets`, `weight_logs`, `training_preferences` e `goals`, todas criadas nas fases 1 a 3.

## Testes

- `src/features/dashboard/dashboard.test.mts` — 13 testes: progresso desconhecido que não vira zero; zero, restante e excesso explícitos; virada de dia à meia-noite do fuso e em Tóquio; saudações por faixa horária; fuso inválido com fallback; iniciais do avatar sem expor e-mail; prioridades determinísticas e limitadas a três; limiares de água e proteína nos minutos exatos; ausência de meta que não gera lembrete; dados de ontem que não contam como hoje; metas futuras ou encerradas sem efeito; treino concluído ou não marcado; peso desconhecido que não é atrasado; e ausência de refeição que não vira falta de proteína.
- `src/features/dashboard/repository.test.mts` — 1 teste que verifica, com cliente simulado, que a carga é só de leitura, que toda consulta filtra por `user_id` do dono, que todas recebem o `AbortSignal` e que apenas as quatro tabelas existentes são consultadas.

## Validação executada

- `npm run check`: TypeScript, ESLint e Prettier sem erros; **83 testes aprovados** (eram 69).
- `npm run build:native`: bundles Hermes Android/iOS e 18 rotas web. A rota de teste `dashboard-check` não está no build.
- Renderização dos estados pelo servidor de desenvolvimento, com verificação do conteúdo: o estado com registros mostra os números informados; o estado vazio mostra a mensagem de ausência e **não** vaza os números do fixture; o estado de erro mostra a mensagem de falha.
- Conferido que nenhum segredo do `.env` entra nos bundles exportados.

## Correção surgida da revisão visual

O dono revisou a tela e apontou uma seta solta entre o card de energia e o de macronutrientes. Era um defeito real, e antigo.

`NavButton` envolvia um `Pressable` com `Link asChild`. Na web, o elemento é clonado para virar âncora e o `style` **em forma de função** do Pressable se perde. O link renderizava sem fundo, sem padding e sem layout em linha: o rótulo e a seta viravam dois blocos soltos.

No fundo claro das outras telas o defeito passava despercebido, porque o texto verde escuro continuava legível sobre creme. No card verde escuro do dashboard ele ficou evidente — **verde escuro sobre verde escuro, texto invisível**, sobrando só a seta.

Conferido no DOM renderizado: as quatro âncoras da tela saíam apenas com `css-view-g5y9jx r-cursor r-touchAction`, sem uma única classe de estilo.

A correção move o visual para uma `View` interna, que é um filho comum e sempre carrega o próprio estilo. O `Pressable` fica só como área de toque, com `alignSelf`. Depois da mudança, a `View` interna sai com fundo, raio, direção em linha, `gap`, altura mínima e padding.

O defeito atingia **todas** as telas que usam `NavButton`: Perfil, Sobre, 404, boas-vindas e o próprio dashboard. Todas se beneficiam da correção.

A lição: verificar contraste sobre o fundo real onde o componente vai aparecer, não só no fundo em que ele nasceu.

## O que ficou de fora, de propósito

Os painéis existem, mas **não há como registrar nada ainda**. Alimentação, água, peso e treino ganham seus registros nas fases 5 a 8. Até lá, as capacidades continuam desligadas e a tela é honesta sobre a ausência de dados.

O `KORA Score` e o streak (seções 45 a 48) são da Fase 9 e não aparecem aqui.

## Limites conhecidos

- **Revisão visual e teste em dispositivo continuam pendentes.** Compilação, testes de regra e renderização pelo servidor não substituem olhar a tela.
- O fixture de estados usado durante o desenvolvimento foi retirado das rotas para não ir a produção com dados fictícios. A cópia está em `artifacts/dashboard-check.tsx.bak`, fora do versionamento. Para revisar os estados novamente: `cp artifacts/dashboard-check.tsx.bak src/app/dashboard-check.tsx` e apagar depois.
- O relógio é reavaliado a cada 30 segundos. A virada do dia pode demorar esse intervalo para refletir na tela.

## Próxima fase

Fase 5 — Nutrição: refeições, alimentos, registro manual e o vínculo com as metas já calculadas. É quando a capacidade `nutrition` pode ser ligada e a prioridade de proteína passa a ter dado real por trás.
