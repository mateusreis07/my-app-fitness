# Decisões de produto — Motor Fitness 1.2

**Aprovadas pelo responsável e implementadas em 22/09/2026.** Este registro detalha o adendo do `KORA_MASTER_CONTEXT.md`. As seis decisões não estão mais pendentes. São políticas de automação do produto, não um protocolo clínico validado.

## Decisões aprovadas

| Decisão                   | Regra vigente                                                                               | Justificativa e efeito no produto                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idade mínima              | 18 anos completos                                                                           | Onboarding e motor recusam menores. O aniversário é considerado.                                                                                                                                            |
| Limite de mudança de peso | Perda: menor entre 1% do peso atual e 1 kg/semana. Ganho: menor entre 0,5% e 0,5 kg/semana. | Limites da automação, não metas recomendadas para todos, previsão ou garantia de segurança. Ganho de peso não equivale a músculo.                                                                           |
| Prazo desejado            | Avisar sem bloquear o acesso; mostrar o ajuste limitado antes de salvar                     | Guardar a data pedida em `goals.target_date` como preferência. Nunca ampliar o déficit/superávit além dos limites para cumprir a data. Sem previsão de data de chegada.                                     |
| Padrões sem prazo         | Déficit de 15%; superávit de 5%; demais objetivos em manutenção estimada                    | Os limites continuam prevalecendo. Proteína: 1,8 g/kg para perda/ganho, 1,4 para manutenção/saúde, 1,6 para condicionamento. Gordura preferencial: 27,5% das calorias, piso de 0,6 g/kg.                    |
| Sexo não informado        | Manter a opção e permitir concluir sem meta automática                                      | `calculateBmr` retorna `null`. Retirada a constante média −78, que não corresponde a uma terceira equação validada. Não atribuir sexo, calorias ou macros fictícios.                                        |
| Piso calórico             | 1.500 kcal/dia para toda meta automática                                                    | Piso operacional conservador, não mínimo biológico universal. TMB não é piso de ingestão. Reduzir o déficit quando necessário; se não houver ajuste coerente com o objetivo, continuar sem meta automática. |

## Ordem do cálculo

1. Validar entradas e idade. As faixas técnicas de altura/peso/idade não representam elegibilidade clínica.
2. Para perda de peso, não gerar meta se o IMC atual **ou o do peso desejado** for menor que 18,5. Comparar o IMC sem arredondamento; 18,46 não vira elegível por aparecer como 18,5 na tela.
3. Calcular Mifflin-St Jeor apenas quando há coeficiente feminino/masculino informado e estimar TDEE pelos fatores existentes.
4. Sem prazo, aplicar o padrão aprovado. Com peso-alvo e prazo, usar `diferença de peso × 7700 / dias` apenas como aproximação para o ajuste inicial. Não há déficit mínimo obrigatório de 10% nem superávit mínimo de 5% quando o prazo pede menos.
5. Limitar ajuste a 20% do TDEE para perda ou 15% para ganho e ao limite proporcional/absoluto semanal. Esses tetos não são padrões a perseguir.
6. Aplicar piso operacional. Nunca transformar perda em manutenção/ganho, nem manutenção em ganho, para satisfazer o piso. No ganho, não elevar artificialmente calorias até o piso se isso exceder o ajuste permitido.
7. Arredondar calorias em direção à manutenção para não aumentar o ajuste por arredondamento. Gerar macros compatíveis; se proteína e piso de gordura não couberem, não produzir plano automático. Diferenças de poucos kcal na reconstrução pelos macros inteiros são de arredondamento.
8. Verificar limites de armazenamento da migration 0004 sem truncar números para fabricar um plano. Retornar `ready` ou `unavailable` com motivo.

O modelo linear de 7.700 kcal/kg não descreve a adaptação metabólica, composição corporal e trajetória de longo prazo. Foi removido `projectPace`; não existe `projectedDate` nem promessa de revisão automática a partir do histórico nesta fase.

## Contrato para a Fase 4

- `FitnessPlan` é uma união discriminada: **`status: ready`** contém as estimativas; **`status: unavailable`** contém o motivo e a versão, sem calorias/macros zero ou inventados.
- Motivos: `invalid_input`, `unspecified_sex`, `underweight`, `target_underweight`, `calorie_floor`, `incompatible_macros`, `outside_supported_range`.
- O resumo explica o motivo e permite **Continuar sem meta automática**; quando elegível, mostra as estimativas e permite **Aceitar estimativas e continuar**. Prazo limitado e piso aplicado têm mensagens próprias antes da gravação.
- `goals` representa a intenção informada. Um objetivo ativo **não** comprova a existência de uma recomendação nutricional e não deve disparar incentivo de perda por conta própria.
- `nutrition_targets` continua sendo a fonte das metas persistidas. Onboarding sem meta fecha a meta anterior, se houver, e não insere outra. `onboarding_completed_at` é gravado por último e libera as abas.
- O motivo detalhado é exibido no resultado do onboarding, mas **não é persistido** nesta versão. Depois da conclusão, ausência de linha vigente gera mensagem genérica de ausência de meta. Não recalcular com o motor atual para tentar reconstruir o motivo histórico.
- Sem linha vigente, dashboard deve mostrar estado sem meta; não dividir por zero, não atribuir porcentagens, não gerar metas/calorias automaticamente, não penalizar score e não redirecionar para onboarding já concluído. Registros independentes de meta poderão continuar conforme cada fase os implementar.
- `fetchCurrentTargets` distingue erro de consulta de ausência legítima de meta. O hook recarrega quando a conclusão do onboarding muda.
- Meta de hidratação isolada não foi criada: a tabela atual agrupa água e nutrição, portanto o caso sem plano não persiste meta de água separada. Na Fase 6, o consumo pode ser registrado e acompanhado mesmo sem meta; a interface exibe ausência de meta, sem inventar meta calórica ou hídrica. Personalizar uma meta independente permanece evolução futura.
- Metas antigas, inclusive `fitness_engine@1.1`, continuam com os números e versão originais. Só uma ação explícita futura de revisão poderá gerar nova vigência; abrir o dashboard não recalcula nada.
- Não foram alterados banco, RLS, migrations ou dados reais neste ajuste. O CHECK histórico de 800 kcal da tabela não representa a política da automação 1.2 (1.500 kcal).

## Persistência e limites conhecidos

O fluxo REST não é transacional. Fecha a meta vigente e depois insere a nova; uma falha entre essas chamadas pode deixar temporariamente o usuário sem meta vigente. O onboarding inicial permanece pendente até todas as gravações concluírem, e pode ser tentado novamente. Upserts são idempotentes, mas inserts de peso/objetivo/histórico podem se repetir numa nova tentativa. Não documentar o fluxo inteiro como idempotente.

Antes de oferecer edição/recálculo do plano a usuários com onboarding concluído, implementar operação transacional de troca de meta e idempotência. Não há tela de edição hoje. A ausência de linha vigente não deve ser interpretada como diagnóstico.

## Pendências que não bloqueiam o desenvolvimento da Fase 4

- Validação clínica da política antes do beta, inclusive elegibilidade de gestantes/lactantes, condições e medicamentos que alteram necessidades nutricionais, transtornos alimentares e limitações das equações em diferentes populações. O onboarding atual **não faz essa triagem**; não inferir diagnósticos das observações livres. Definir coleta mínima e consentimento antes de adicionar dados sensíveis.
- Metas manuais orientadas por profissional: possibilidade futura, não implementada nem exibida como recurso disponível.
- Ajuste pela evolução real, peso de referência para casos extremos e personalização da hidratação: futuras evoluções versionadas.
- Revisão visual do novo fluxo no navegador e validação em dispositivo real continuam pendentes; compilação e testes de regra não substituem esse aceite.

## Referências e limites da evidência

As fontes sustentam as considerações abaixo; não validam em conjunto os números escolhidos para o KORA.

- [NIDDK — Body Weight Planner](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner): ferramenta destinada a adultos; não destinada a gestantes/lactantes. Apoia delimitar público e elegibilidade.
- [CDC — Losing Weight](https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html): orientação geral de perda gradual de cerca de 1–2 libras por semana; não transforma 1 kg/semana em meta universal.
- [Mifflin et al., 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/): origem das equações usadas; não fundamenta coeficiente médio para sexo não informado.
- [ISSN — Protein and exercise](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/): referência de proteína em pessoas que se exercitam; não é prescrição para todo usuário ou condição clínica.
- [Helms et al., 2023 — Energy surplus](https://link.springer.com/article/10.1186/s40798-023-00651-y): estudo em pessoas treinadas, com limitações de amostra/duração; informa a escolha conservadora de superávit inicial, sem garantir ganho muscular.
- [NICE NG246 — Physical activity and diet](https://www.nice.org.uk/guidance/ng246/chapter/Physical-activity-and-diet): dietas de baixa energia exigem contexto e suporte apropriados; não estabelece 1.500 kcal como piso universal.
- [Hall et al. — Dynamic energy balance](https://pmc.ncbi.nlm.nih.gov/articles/PMC3880593/): mudanças de peso são dinâmicas; conversão linear não justifica datas exatas de chegada.

## Verificação

Ver `STATUS.md`, seção 7, para o resultado final dos comandos. Testes de regras cobrem limites proporcionais, prazo longo, piso, IMC bruto, ausência de sexo, macros, extremos e versionamento. Testes de integração com cliente simulado exercitam o `submitOnboarding` real, incluindo conclusão sem meta, falhas, histórico e correspondência entre prévia e gravação. Não equivalem a nova validação remota de Supabase ou teste de componente.
