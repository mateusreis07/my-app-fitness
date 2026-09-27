# KORA — MASTER CONTEXT

> **Documento mestre do projeto**
>
> Este arquivo define a visão oficial do produto, regras funcionais, regras de negócio, arquitetura, experiência do usuário, modelo de dados, cálculos, limites de segurança, monetização, roadmap e princípios de implementação do KORA.
>
> Toda IA, agente de código, desenvolvedor ou colaborador deve ler este documento antes de implementar qualquer funcionalidade.
>
> **Regra principal:** em caso de conflito entre uma implementação existente e este documento, este documento representa a intenção atual do produto, salvo se houver uma decisão mais recente registrada explicitamente em documentação posterior.

---

# 1. IDENTIDADE DO PRODUTO

## 1.1 Nome provisório

**KORA**

### Tagline provisória

**Seu corpo. Seu plano. Todo dia.**

O nome é provisório e deve ser validado futuramente em relação a:

- disponibilidade de domínio;
- disponibilidade nas lojas;
- registro de marca;
- redes sociais;
- possíveis conflitos comerciais;
- adequação internacional.

Nenhuma decisão técnica importante deve depender do nome atual.

---

# 2. VISÃO DO PRODUTO

KORA é um aplicativo fitness e wellness que transforma dados pessoais, metas, rotina, alimentação, hidratação, peso e treinos em um plano diário simples de seguir.

O KORA não deve ser apenas:

- contador de calorias;
- calculadora de IMC;
- diário alimentar;
- aplicativo de treino;
- chatbot fitness;
- rastreador de água.

O produto deve combinar essas funções e, principalmente, **interpretar os dados para dizer ao usuário o que é mais importante fazer agora**.

A proposta central é:

> O usuário informa seu perfil e objetivo. O KORA calcula um ponto de partida, acompanha sua rotina e transforma os dados do dia em prioridades claras e acionáveis.

---

# 3. PROBLEMA QUE O PRODUTO RESOLVE

Muitos usuários querem emagrecer, ganhar massa, melhorar a alimentação ou criar consistência nos treinos, mas encontram vários problemas:

- não sabem quantas calorias precisam consumir;
- não sabem quanto de proteína precisam;
- não sabem quanta água beber;
- não sabem como estruturar uma rotina de treino;
- usam vários aplicativos separados;
- recebem muitos números, mas pouca orientação prática;
- abandonam o acompanhamento porque registrar tudo dá trabalho;
- não sabem interpretar a própria evolução;
- não sabem o que fazer quando o peso para de mudar;
- têm dificuldade em criar consistência.

O KORA deve reduzir essa complexidade.

---

# 4. POSICIONAMENTO

## 4.1 Frase principal

> **O KORA organiza sua rotina fitness e mostra o que você precisa fazer hoje.**

## 4.2 Diferencial estratégico

O diferencial principal não é ter mais métricas.

O diferencial é:

> **transformar métricas em prioridades.**

Exemplo:

Em vez de apenas mostrar:

- 1.650 kcal consumidas;
- 102 g de proteína;
- 1,8 L de água;
- treino não iniciado.

O KORA deve traduzir isso para:

> **Suas prioridades agora**
>
> 1. Consumir aproximadamente +43 g de proteína.
> 2. Beber +800 ml de água.
> 3. Concluir o treino programado de hoje.

---

# 5. PRINCÍPIOS DO PRODUTO

Todas as decisões de produto devem seguir estes princípios.

## 5.1 Simplicidade

O usuário não deve precisar entender:

- TMB;
- TDEE;
- distribuição de macros;
- zonas metabólicas;
- fórmulas avançadas;
- conceitos complexos de periodização.

O sistema pode usar conceitos técnicos internamente, mas deve apresentar o resultado de forma simples.

## 5.2 Clareza

Toda métrica deve responder pelo menos uma destas perguntas:

- O que isso significa?
- Estou indo bem?
- Quanto falta?
- O que devo fazer agora?

## 5.3 Baixa fricção

Registrar alimentação, água, treino e peso deve exigir o mínimo possível de passos.

## 5.4 Personalização progressiva

O sistema começa com estimativas e melhora conforme o usuário gera dados reais.

## 5.5 Dados antes de IA

Sempre que uma funcionalidade puder ser resolvida com:

- cálculo;
- regra;
- query;
- algoritmo determinístico;

ela NÃO deve depender de LLM.

IA deve ser usada apenas onde ela realmente agrega valor.

## 5.6 Wellness, não medicina

KORA é um produto de fitness, bem-estar e organização pessoal.

KORA não deve:

- diagnosticar doenças;
- prescrever tratamento médico;
- substituir médico;
- substituir nutricionista em condições clínicas;
- substituir fisioterapeuta;
- interpretar exames como diagnóstico;
- incentivar práticas extremas.

---

# 6. PÚBLICO-ALVO

## 6.1 Público principal

Adultos que:

- querem emagrecer;
- querem ganhar massa muscular;
- querem manter o peso;
- querem melhorar hábitos;
- treinam ou pretendem começar a treinar;
- querem acompanhar alimentação;
- querem simplificar sua rotina fitness.

## 6.2 Perfil ideal inicial

Usuário de 18 a 45 anos que:

- possui smartphone;
- tem conhecimento fitness básico ou intermediário;
- treina de 2 a 6 vezes por semana;
- quer acompanhamento, mas não precisa de orientação clínica;
- prefere uma interface simples e visual.

## 6.3 Fora do foco inicial

O MVP não será desenvolvido especificamente para:

- atletas profissionais;
- crianças;
- gestantes;
- idosos com necessidades clínicas;
- pacientes em tratamento nutricional;
- pessoas com transtornos alimentares;
- usuários que necessitam acompanhamento médico especializado.

Esses públicos podem ser considerados futuramente com regras específicas e participação profissional.

---

# 7. OBJETIVOS SUPORTADOS

No onboarding o usuário pode escolher:

1. **Emagrecer**
2. **Ganhar massa muscular**
3. **Manter peso**
4. **Melhorar saúde e hábitos**
5. **Melhorar condicionamento**

O MVP deve priorizar os três primeiros.

---

# 8. PLATAFORMAS

## 8.1 Aplicativo principal

- iOS
- Android

Tecnologia recomendada:

**React Native + Expo**

## 8.2 Web

Web será utilizada inicialmente para:

- landing page;
- autenticação complementar;
- páginas institucionais;
- política de privacidade;
- termos;
- painel administrativo futuro.

Tecnologia recomendada:

**Next.js**

---

# 9. STACK RECOMENDADA

## Frontend mobile

- React Native
- Expo
- TypeScript
- Expo Router

## Frontend web

- Next.js
- TypeScript
- Tailwind CSS

## Backend

- Supabase

## Recursos Supabase

- PostgreSQL
- Auth
- Storage
- Row Level Security
- Edge Functions quando necessário

## IA

Arquitetura independente de fornecedor.

Nunca acoplar regras críticas diretamente a um único modelo.

Estrutura:

App
→ Backend
→ Context Builder
→ Provider de IA
→ Resposta estruturada
→ Validação
→ App

---

# 10. ARQUITETURA GERAL

```text
MOBILE APP
    |
    v
APPLICATION LAYER
    |
    +--> SUPABASE AUTH
    |
    +--> POSTGRESQL
    |
    +--> BUSINESS RULES
    |
    +--> FITNESS ENGINE
    |
    +--> SCORE ENGINE
    |
    +--> INSIGHT ENGINE
    |
    +--> AI GATEWAY
            |
            v
        LLM PROVIDER
```

---

# 11. MÓDULOS PRINCIPAIS

O produto é dividido nos seguintes módulos:

1. Autenticação
2. Perfil
3. Onboarding
4. Motor Fitness
5. Dashboard Hoje
6. Nutrição
7. Hidratação
8. Peso
9. Evolução
10. Treinos
11. KORA Score
12. Streak
13. Insights
14. Notificações
15. Assinaturas
16. Coach com IA
17. Registro alimentar com IA
18. Visão semanal
19. Integrações de saúde
20. Painel administrativo

Nem todos entram no MVP.

---

# 12. ONBOARDING

O onboarding é uma das experiências mais importantes do produto.

Objetivo:

> Em poucos minutos, transformar dados básicos do usuário em um plano inicial visualmente convincente.

## 12.1 Etapas

### Etapa 1 — Objetivo

Pergunta:

**Qual é o seu principal objetivo?**

Opções:

- Emagrecer
- Ganhar massa
- Manter peso
- Melhorar saúde
- Melhorar condicionamento

### Etapa 2 — Dados básicos

- sexo biológico para fins das fórmulas quando necessário;
- data de nascimento;
- altura;
- peso atual.

### Etapa 3 — Meta

- peso desejado;
- prazo opcional.

O sistema nunca deve incentivar um prazo inseguro.

### Etapa 4 — Atividade

Pergunta:

**Como é sua rotina?**

Valores internos:

- sedentary
- lightly_active
- moderately_active
- very_active
- extremely_active

### Etapa 5 — Treino

- quantos dias por semana;
- tempo médio disponível;
- local;
- equipamentos;
- experiência.

### Etapa 6 — Alimentação

Perguntas opcionais:

- restrições;
- preferência alimentar;
- número habitual de refeições;
- dieta vegetariana;
- dieta vegana.

### Etapa 7 — Resultado

Mostrar:

- calorias estimadas;
- proteína;
- carboidratos;
- gorduras;
- água;
- frequência de treino;
- objetivo;
- resumo.

---

# 13. MOTOR FITNESS

Motor Fitness é o módulo determinístico responsável por cálculos.

Ele NÃO utiliza IA.

---

# 14. IMC

Fórmula:

```text
IMC = peso_kg / (altura_m ^ 2)
```

Deve ser apresentado como uma referência geral.

O sistema deve evitar usar IMC como julgamento individual definitivo.

---

# 15. TAXA METABÓLICA BASAL

Inicialmente utilizar fórmula de Mifflin-St Jeor.

## Masculino

```text
TMB = 10 × peso_kg + 6.25 × altura_cm - 5 × idade + 5
```

## Feminino

```text
TMB = 10 × peso_kg + 6.25 × altura_cm - 5 × idade - 161
```

Caso o produto futuramente permita outras opções de identidade, a experiência deve tratar com sensibilidade a diferença entre identidade e parâmetros fisiológicos utilizados por fórmulas.

---

# 16. GASTO ENERGÉTICO TOTAL

```text
TDEE = TMB × fator_atividade
```

Valores iniciais:

```text
sedentary = 1.20
lightly_active = 1.375
moderately_active = 1.55
very_active = 1.725
extremely_active = 1.90
```

Esses valores são estimativas.

---

# 17. CALORIAS POR OBJETIVO

O sistema não deve aplicar déficits ou superávits extremos.

Configuração inicial conservadora:

## Emagrecimento

```text
target_calories = TDEE - deficit
```

Faixa padrão interna:

- aproximadamente 10% a 20% de déficit.

## Ganho de massa

```text
target_calories = TDEE + surplus
```

Faixa inicial:

- aproximadamente 5% a 15%.

## Manutenção

```text
target_calories = TDEE
```

O sistema poderá melhorar essas metas no futuro usando tendência real de peso.

---

# 18. LIMITES DE SEGURANÇA CALÓRICA

Nunca reduzir automaticamente calorias a valores extremos.

Limites exatos devem ficar em configuração de negócio e podem evoluir.

Se uma meta calculada for potencialmente inadequada, mostrar:

> Sua meta requer uma análise mais individualizada. Considere conversar com um nutricionista ou profissional de saúde.

---

# 19. PROTEÍNA

A proteína deve utilizar peso corporal e objetivo.

Configuração inicial sugerida por engine:

```text
maintenance_general:
1.2 – 1.6 g/kg

fat_loss_active:
1.6 – 2.2 g/kg

muscle_gain:
1.6 – 2.2 g/kg
```

Não existe necessidade de expor toda a faixa ao usuário.

O motor escolhe um ponto inicial e permite ajustes.

---

# 20. GORDURAS

Pode-se definir inicialmente por:

- percentual calórico; ou
- g/kg.

Estratégia recomendada:

aproximadamente 25% a 30% das calorias.

---

# 21. CARBOIDRATOS

Carboidratos são calculados após proteína e gordura.

```text
protein_calories = protein_g × 4
fat_calories = fat_g × 9

remaining = total_calories - protein_calories - fat_calories

carbs_g = remaining / 4
```

---

# 22. ÁGUA

A meta de água é uma estimativa.

Base inicial:

```text
35 ml × peso_kg
```

A engine pode ajustar posteriormente conforme:

- atividade;
- clima;
- treino;
- preferências.

Não prometer precisão clínica.

---

# 23. DASHBOARD HOJE

É a tela principal.

A pergunta que essa tela responde é:

> **Como está meu dia e o que devo fazer agora?**

---

# 24. COMPONENTES DA HOME

## Header

- saudação;
- nome;
- data;
- avatar.

## KORA Score

- score do dia;
- status;
- comparação com média recente.

## Energia

Mostrar:

```text
Consumido / Meta
```

e calorias restantes.

## Macros

- proteína;
- carboidrato;
- gordura.

## Água

- consumido;
- meta;
- atalhos de registro.

## Peso

- último peso;
- tendência.

## Treino

- treino programado;
- duração;
- CTA.

## Prioridades

Lista dinâmica de até 3 ações.

---

# 25. PRIORIDADES DIÁRIAS

Prioridades são uma das funções centrais do produto.

Exemplos:

- consumir proteína;
- beber água;
- registrar peso;
- iniciar treino;
- completar calorias;
- recuperar consistência.

Nunca mostrar 10 tarefas simultaneamente.

Máximo recomendado:

**3 prioridades principais.**

---

# 26. MOTOR DE PRIORIDADES

O motor deve ser determinístico inicialmente.

Exemplo conceitual:

```text
IF protein_progress < 70%
AND current_time > 16:00
THEN priority += "Aumentar proteína"

IF water_progress < 60%
AND current_time > 15:00
THEN priority += "Aumentar hidratação"

IF workout_scheduled = true
AND workout_completed = false
THEN priority += "Treino pendente"
```

Prioridades devem ser ordenadas por relevância.

---

# 27. NUTRIÇÃO

Objetivo:

Permitir acompanhamento alimentar com o mínimo de fricção possível.

---

# 28. REFEIÇÕES

Tipos padrão:

- breakfast
- morning_snack
- lunch
- afternoon_snack
- dinner
- supper
- other

A interface pode exibir nomes localizados.

---

# 29. ALIMENTOS

Um alimento contém:

- nome;
- marca opcional;
- tamanho da porção;
- unidade;
- calorias;
- proteína;
- carboidrato;
- gordura;
- fibra futura;
- sódio futuro;
- origem do dado.

---

# 30. FONTES DE ALIMENTOS

O sistema deve permitir:

- base oficial/importada;
- alimentos cadastrados pelo usuário;
- receitas futuras;
- alimentos sugeridos por IA.

Alimentos gerados por IA devem ser tratados como estimativas.

---

# 31. REGISTRO MANUAL

Fluxo:

1. selecionar refeição;
2. pesquisar alimento;
3. selecionar;
4. informar quantidade;
5. confirmar.

Deve existir atalhos para:

- recentes;
- favoritos;
- mais usados.

---

# 32. REGISTRO POR TEXTO COM IA

Pós-MVP.

Exemplo:

> Comi dois ovos, duas fatias de pão e café com leite.

O modelo deve responder em JSON estruturado.

Exemplo:

```json
{
  "items": [
    {
      "name": "Ovo",
      "quantity": 2,
      "unit": "unit"
    },
    {
      "name": "Pão de forma",
      "quantity": 2,
      "unit": "slice"
    }
  ]
}
```

O sistema então associa alimentos da base ou apresenta estimativa.

Nunca salvar silenciosamente sem revisão do usuário na primeira versão.

---

# 33. FOTO DE REFEIÇÃO

Pós-MVP.

Fluxo:

1. usuário fotografa;
2. IA identifica possíveis alimentos;
3. IA estima quantidade;
4. app exibe resultado;
5. usuário corrige;
6. app calcula estimativa nutricional;
7. usuário confirma.

Sempre exibir:

**Estimativa nutricional**

Nunca apresentar como medição exata.

---

# 34. HIDRATAÇÃO

Tela simples.

Mostrar:

- meta;
- consumido;
- restante;
- histórico do dia.

Botões rápidos:

- +250 ml
- +500 ml
- personalizado

Possível futuro:

- notificações inteligentes;
- widgets;
- smartwatch.

---

# 35. PESO

O usuário pode registrar peso.

Campos:

- peso;
- data;
- horário opcional;
- observação opcional.

Recomendar consistência de medição, mas não obrigar.

---

# 36. TENDÊNCIA DE PESO

Nunca tomar decisões com base apenas em uma medição.

Utilizar médias móveis.

Possível estratégia:

- média de 7 dias;
- comparação entre médias semanais.

Isso reduz efeito de:

- água;
- sódio;
- glicogênio;
- horário;
- retenção.

---

# 37. EVOLUÇÃO

Tela de progresso.

Métricas:

- peso;
- meta;
- variação;
- tendência;
- aderência;
- treinos;
- proteína;
- água.

Futuro:

- medidas;
- fotos;
- composição corporal.

---

# 38. TREINOS

O módulo de treinos deve funcionar sem IA.

Estrutura:

```text
Plano
  ↓
Dias
  ↓
Exercícios
  ↓
Sessão
  ↓
Séries
```

---

# 39. EXERCÍCIO

Campos:

- nome;
- grupo muscular;
- equipamento;
- mídia futura;
- descrição;
- instruções;
- alternativas.

---

# 40. PLANO DE TREINO

Contém:

- objetivo;
- dias;
- exercícios;
- ordem;
- séries;
- faixa de repetições;
- descanso;
- observações.

---

# 41. SESSÃO DE TREINO

Durante uma sessão mostrar:

- exercício;
- série atual;
- peso;
- reps;
- série anterior;
- descanso;
- histórico.

---

# 42. REGISTRO DE SÉRIES

Campos:

- set_number;
- weight;
- reps;
- completed;
- RIR opcional futuro;
- RPE opcional futuro;
- timestamp.

---

# 43. PROGRESSÃO

A primeira versão não deve prometer prescrição perfeita.

Pode gerar sinais como:

> Você atingiu o topo da faixa de repetições nas últimas sessões.

> Considere aumentar ligeiramente a carga.

A recomendação deve ser conservadora.

---

# 44. DESCANSO

Após série:

- iniciar temporizador;
- permitir pular;
- permitir aumentar;
- vibrar/notificar.

---

# 45. KORA SCORE

O KORA Score é um índice interno de aderência.

Não é:

- nota de saúde;
- avaliação médica;
- diagnóstico;
- indicador clínico.

---

# 46. COMPOSIÇÃO DO SCORE

MVP:

```text
Nutrition adherence
Protein adherence
Hydration adherence
Workout adherence
Consistency
```

Exemplo de pesos iniciais:

```text
nutrition = 25%
protein = 20%
hydration = 15%
workout = 25%
consistency = 15%
```

Configuração deve ser facilmente alterável.

---

# 47. NORMALIZAÇÃO DO SCORE

Cada componente varia de 0 a 100.

Nunca incentivar ultrapassar excessivamente uma meta apenas para obter mais pontos.

Exemplo:

Proteína:

```text
score = min(consumed / target, 1) × 100
```

Para calorias, a lógica deve considerar proximidade da faixa, não "quanto mais, melhor".

---

# 48. STREAK

Streak representa consistência.

Evitar streak cruel.

O usuário não deve sentir que perdeu meses de progresso por um único dia.

Possível modelo:

- sequência diária;
- consistência semanal;
- recuperação.

Futuro:

**Streak Freeze**.

---

# 49. INSIGHTS

Existem três níveis.

## Nível 1 — Regras

Sem IA.

Exemplo:

- proteína baixa;
- água baixa;
- treino pendente.

## Nível 2 — Analytics

Dados históricos.

Exemplo:

> Sua média de peso aumentou 0,3 kg nas últimas duas semanas.

## Nível 3 — IA

Interpretação contextual.

Exemplo:

> Seus treinos estão consistentes, mas sua ingestão de proteína ficou abaixo da meta em 4 dos últimos 7 dias.

---

# 50. KORA COACH

Pós-MVP.

O Coach deve ter acesso a dados permitidos pelo usuário.

Ele NÃO deve ser apenas um chatbot genérico.

Ele deve responder com base em:

- perfil;
- objetivo;
- metas;
- alimentação;
- treino;
- peso;
- evolução;
- histórico.

---

# 51. EXEMPLOS DE COACH

Usuário:

> Como estou indo esta semana?

Resposta ideal:

> Você concluiu 3 de 4 treinos programados e atingiu pelo menos 90% da meta de proteína em 5 dos últimos 7 dias. Sua hidratação foi a área menos consistente.

---

# 52. GUARDRAILS DO COACH

O Coach nunca deve:

- diagnosticar;
- recomendar medicação;
- sugerir suspensão de remédio;
- prescrever hormônio;
- prescrever esteroide;
- incentivar fome extrema;
- recomendar vômito;
- sugerir desidratação;
- recomendar treino em caso de lesão grave;
- substituir avaliação profissional.

---

# 53. CASOS DE ESCALONAMENTO

Se o usuário mencionar:

- desmaios;
- dor intensa;
- sintomas graves;
- transtorno alimentar;
- gravidez;
- doença renal;
- diabetes descompensada;
- doença cardiovascular;
- condição clínica relevante;

o app deve limitar recomendações personalizadas e sugerir orientação profissional.

---

# 54. NOTIFICAÇÕES

MVP pode suportar:

- lembrar água;
- lembrar treino;
- lembrar peso;
- resumo do dia.

Notificações devem ser configuráveis.

Nunca utilizar spam agressivo.

---

# 55. VISÃO SEMANAL

Pós-MVP ou final do MVP dependendo de capacidade.

Mostrar:

- média de calorias;
- média de proteína;
- hidratação;
- treinos concluídos;
- peso médio;
- KORA Score médio;
- streak;
- principal insight.

---

# 56. MONETIZAÇÃO

Modelo:

**Freemium**

---

# 57. KORA FREE

Possíveis recursos:

- onboarding;
- metas;
- IMC;
- calorias;
- macros;
- água;
- peso;
- nutrição manual;
- treino básico;
- KORA Score;
- histórico limitado.

---

# 58. KORA PRO

Possíveis recursos:

- histórico completo;
- Coach;
- IA de alimentação;
- insights avançados;
- plano adaptativo;
- treinos personalizados;
- relatórios;
- análise semanal;
- reconhecimento por foto;
- integrações futuras.

Preço não deve ser hardcoded na lógica central.

Preço será definido por:

- mercado;
- testes;
- loja;
- país;
- promoções.

---

# 59. ASSINATURAS

Mobile:

preferencialmente utilizar infraestrutura compatível com:

- App Store;
- Google Play.

Uma camada como RevenueCat pode ser avaliada.

Não acoplar regra de produto diretamente ao gateway.

Criar conceitos internos:

```text
free
pro
```

---

# 60. MODELO DE DADOS

Estrutura conceitual inicial.

---

# 61. profiles

```text
id
user_id
display_name
birth_date
biological_sex
height_cm
activity_level
fitness_experience
country
locale
timezone
created_at
updated_at
```

---

# 62. goals

```text
id
user_id
goal_type
starting_weight_kg
target_weight_kg
started_at
target_date
status
created_at
updated_at
```

---

# 63. nutrition_targets

```text
id
user_id
calories
protein_g
carbs_g
fat_g
water_ml
effective_from
effective_until
calculation_source
created_at
```

---

# 64. weight_logs

```text
id
user_id
weight_kg
recorded_at
notes
created_at
```

---

# 65. water_logs

```text
id
user_id
amount_ml
recorded_at
created_at
```

---

# 66. foods

```text
id
name
brand
serving_size
serving_unit
calories
protein_g
carbs_g
fat_g
fiber_g
sodium_mg
source
verified
created_at
```

---

# 67. user_foods

Para alimentos personalizados.

```text
id
user_id
name
serving_size
serving_unit
calories
protein_g
carbs_g
fat_g
created_at
```

---

# 68. meals

```text
id
user_id
meal_type
meal_date
created_at
```

---

# 69. meal_items

```text
id
meal_id
food_id
user_food_id
quantity
calories_snapshot
protein_snapshot
carbs_snapshot
fat_snapshot
created_at
```

Snapshots são importantes para preservar histórico mesmo se alimento mudar.

---

# 70. workout_plans

```text
id
user_id
name
goal
days_per_week
active
created_at
updated_at
```

---

# 71. workout_plan_days

```text
id
plan_id
day_index
name
order_index
```

---

# 72. exercises

```text
id
name
primary_muscle
secondary_muscles
equipment
instructions
media_url
active
```

---

# 73. workout_day_exercises

```text
id
workout_day_id
exercise_id
order_index
target_sets
min_reps
max_reps
rest_seconds
notes
```

---

# 74. workout_sessions

```text
id
user_id
workout_day_id
started_at
completed_at
duration_seconds
status
```

---

# 75. workout_session_exercises

```text
id
session_id
exercise_id
order_index
```

---

# 76. workout_sets

```text
id
session_exercise_id
set_number
weight_kg
reps
completed
rest_seconds
created_at
```

---

# 77. daily_scores

```text
id
user_id
score_date
total_score
nutrition_score
protein_score
hydration_score
workout_score
consistency_score
created_at
```

---

# 78. daily_insights

```text
id
user_id
date
type
priority
title
message
source
metadata
created_at
```

---

# 79. subscriptions

```text
id
user_id
plan
provider
provider_customer_id
provider_subscription_id
status
current_period_end
created_at
updated_at
```

---

# 80. AI USAGE

```text
id
user_id
feature
provider
model
input_tokens
output_tokens
estimated_cost
created_at
```

Importante para controle de custo.

---

# 81. ROW LEVEL SECURITY

Todos os dados do usuário devem usar RLS.

Princípio:

> usuário só pode acessar os próprios dados.

Tabelas globais, como foods e exercises, podem ter leitura pública autenticada, mas escrita restrita.

---

# 82. AUTENTICAÇÃO

MVP:

- email;
- senha;
- magic link opcional.

Futuro:

- Google;
- Apple.

---

# 83. PRIVACIDADE

Dados fitness são sensíveis do ponto de vista do usuário, mesmo quando não são utilizados clinicamente.

Princípios:

- coletar apenas o necessário;
- não vender dados pessoais;
- permitir exclusão;
- explicar uso;
- criptografia em trânsito;
- segurança no backend;
- consentimento para IA;
- consentimento separado para integrações.

---

# 84. LGPD

O projeto deve ser preparado para boas práticas compatíveis com LGPD.

Itens futuros obrigatórios antes de produção:

- política de privacidade;
- termos de uso;
- consentimento;
- finalidade;
- exclusão de conta;
- exportação quando aplicável;
- registro de consentimento.

---

# 85. DESIGN SYSTEM

Identidade:

- moderna;
- limpa;
- tecnológica;
- amigável;
- energética;
- premium;
- sem parecer clínica.

Evitar:

- excesso de elementos;
- aparência hospitalar;
- interface extremamente esportiva;
- excesso de neon;
- aparência de jogo infantil.

---

# 86. ESTILO VISUAL

Direção sugerida:

- fundos claros e escuros bem trabalhados;
- cards grandes;
- números fortes;
- gráficos minimalistas;
- círculos de progresso;
- tipografia legível;
- bastante espaço;
- microinterações suaves.

---

# 87. NAVEGAÇÃO MOBILE

Sugestão:

```text
Hoje
Alimentação
Treino
Progresso
Perfil
```

Ou:

```text
Hoje
Diário
Treino
Progresso
Mais
```

Decisão final deve ser testada.

---

# 88. TELA HOJE

Prioridade visual:

1. KORA Score
2. prioridades
3. calorias
4. macros
5. água
6. treino
7. peso
8. insights

---

# 89. ESTADOS VAZIOS

Toda tela precisa de estado vazio útil.

Exemplo:

> Você ainda não registrou seu peso hoje.

CTA:

**Registrar peso**

---

# 90. FEEDBACK

Toda ação deve retornar feedback:

- salvar;
- concluir;
- erro;
- remover;
- atingir meta.

Evitar toasts excessivos.

---

# 91. ACESSIBILIDADE

Considerar:

- contraste;
- tamanho de fonte;
- áreas de toque;
- leitor de tela;
- números não dependentes apenas de cor.

---

# 92. LOCALIZAÇÃO

Desde o início usar i18n.

Idioma inicial:

**pt-BR**

Preparar para:

- en-US;
- es.

Unidades configuráveis futuramente:

- kg / lb;
- cm / ft;
- ml / oz.

---

# 93. TIMEZONE

Toda lógica diária deve respeitar timezone do usuário.

Não assumir UTC para definição do "dia".

---

# 94. ANALYTICS

Eventos iniciais:

```text
signup_completed
onboarding_started
onboarding_completed
daily_dashboard_opened
food_added
water_added
weight_added
workout_started
workout_completed
score_viewed
subscription_started
subscription_cancelled
```

Não registrar dados pessoais desnecessários no analytics.

---

# 95. MÉTRICAS DE PRODUTO

Principais métricas futuras:

- onboarding completion;
- D1 retention;
- D7 retention;
- D30 retention;
- registros por semana;
- treinos concluídos;
- frequência de uso;
- conversão Free → Pro;
- churn;
- streak médio.

---

# 96. MOTOR DE ADAPTAÇÃO

Pós-MVP.

Objetivo:

ajustar metas de acordo com dados reais.

Exemplo:

Usuário quer ganhar peso.

Se:

- adesão alta;
- peso médio estável por várias semanas;

o sistema pode sugerir ajuste calórico.

Nunca mudar automaticamente sem explicar.

Modelo:

```text
Detectar
→ sugerir
→ explicar
→ usuário aceita
→ nova meta entra em vigor
```

---

# 97. HISTÓRICO DE METAS

Nunca sobrescrever metas antigas.

Cada mudança deve gerar uma nova versão em nutrition_targets.

Isso permite auditoria e análise histórica.

---

# 98. IA — PRINCÍPIOS

IA deve:

- ajudar a interpretar;
- resumir;
- reduzir fricção;
- personalizar linguagem;
- gerar estrutura inicial;
- identificar padrões.

IA não deve:

- substituir regras críticas;
- inventar alimentos silenciosamente;
- alterar banco sem validação;
- criar diagnósticos;
- tomar decisões irreversíveis.

---

# 99. IA — RESPOSTAS ESTRUTURADAS

Sempre que IA alimentar alguma função do sistema, preferir JSON schema.

Nunca depender de texto livre para lógica crítica.

---

# 100. IA — CUSTOS

Toda chamada deve registrar:

- feature;
- modelo;
- tokens;
- custo aproximado.

Implementar limites por plano.

---

# 101. IA — CACHE

Evitar chamadas repetidas para análises iguais.

Exemplo:

relatório semanal pode ser gerado uma vez e armazenado.

---

# 102. MVP — ESCOPO OFICIAL

O MVP deve conter:

## Fundação

- projeto;
- arquitetura;
- tema;
- navegação;
- ambiente.

## Auth

- cadastro;
- login;
- logout;
- recuperação.

## Onboarding

- dados;
- objetivo;
- atividade;
- rotina.

## Fitness Engine

- IMC;
- TMB;
- TDEE;
- calorias;
- macros;
- água.

## Dashboard Hoje

- resumo;
- metas;
- progresso;
- prioridades.

## Nutrição

- pesquisa;
- registro;
- refeições;
- total diário.

## Hidratação

- meta;
- registro;
- progresso.

## Peso

- registro;
- histórico;
- tendência simples.

## Treino

- plano;
- exercícios;
- sessões;
- sets;
- histórico.

## Score

- KORA Score.

## Streak

- consistência.

## Notificações básicas

## Perfil

## Assinatura preparada

A cobrança real pode ser implementada perto da publicação.

---

# 103. NÃO ENTRA NO MVP

- foto da comida;
- Coach completo;
- Apple Health;
- Health Connect;
- smartwatch;
- rede social;
- feed;
- marketplace;
- comunidade;
- desafios;
- nutricionista integrado;
- personal trainer integrado;
- receitas complexas;
- compras;
- scanner corporal;
- exames;
- análise de sangue;
- gamificação avançada.

---

# 104. ROADMAP

---

# FASE 0 — FUNDAÇÃO

Objetivo:

Criar estrutura profissional.

Entregáveis:

- React Native + Expo;
- TypeScript;
- Expo Router;
- lint;
- formatter;
- env;
- tema;
- estrutura de pastas;
- Supabase client;
- documentação;
- build funcionando.

Não implementar features complexas.

---

# FASE 1 — AUTENTICAÇÃO

Entregáveis:

- cadastro;
- login;
- sessão;
- logout;
- recuperação;
- proteção de rotas;
- perfil base.

---

# FASE 2 — ONBOARDING

Entregáveis:

- fluxo completo;
- persistência;
- objetivo;
- dados;
- atividade;
- rotina;
- resultado.

---

# FASE 3 — FITNESS ENGINE

Entregáveis:

- IMC;
- TMB;
- TDEE;
- metas;
- testes unitários;
- versionamento de fórmula.

---

# FASE 4 — DASHBOARD HOJE

Entregáveis:

- layout;
- energia;
- macros;
- água;
- peso;
- treino;
- prioridades.

---

# FASE 5 — NUTRIÇÃO

Entregáveis:

- alimentos;
- refeições;
- meal_items;
- totais;
- recentes;
- favoritos futuro.

---

# FASE 6 — HIDRATAÇÃO

Entregáveis:

- meta;
- logs;
- botões rápidos;
- progresso.

---

# FASE 7 — PESO E EVOLUÇÃO

Entregáveis:

- peso;
- histórico;
- gráfico;
- tendência.

---

# FASE 8 — TREINOS

Entregáveis:

- plano;
- dias;
- exercícios;
- sessões;
- séries;
- descanso;
- histórico.

---

# FASE 9 — SCORE + STREAK

Entregáveis:

- algoritmo;
- tela;
- histórico;
- regras.

---

# FASE 10 — NOTIFICAÇÕES

Entregáveis:

- água;
- treino;
- peso;
- resumo.

---

# FASE 11 — ASSINATURA

Entregáveis:

- free/pro;
- feature flags;
- paywall;
- provider.

---

# MVP PUBLICÁVEL

Após Fase 11 o produto deve estar pronto para beta/publicação.

---

# FASE 12 — KORA COACH

- chat;
- contexto;
- limites;
- insights.

---

# FASE 13 — REGISTRO COM IA

- linguagem natural;
- parsing;
- confirmação.

---

# FASE 14 — INSIGHTS AVANÇADOS

- semana;
- tendência;
- adaptação.

---

# FASE 15 — FOTO DE ALIMENTAÇÃO

- visão;
- alimentos;
- porções;
- revisão.

---

# FASE 16 — HEALTH INTEGRATIONS

- Apple Health;
- Health Connect;
- passos;
- energia;
- sono futuro.

---

# 105. ESTRUTURA DE PASTAS SUGERIDA

```text
src/
  app/
  components/
  features/
    auth/
    onboarding/
    dashboard/
    nutrition/
    hydration/
    weight/
    workouts/
    score/
    subscriptions/
    ai/
  services/
  lib/
  hooks/
  stores/
  types/
  utils/
  constants/
  theme/
```

Cada feature deve ser autocontida.

---

# 106. REGRAS DE IMPLEMENTAÇÃO

## Regra 1

Não implementar funções futuras "só porque pode".

## Regra 2

Não criar abstrações prematuras.

## Regra 3

Toda regra crítica precisa de teste.

## Regra 4

Lógica de negócio não deve ficar escondida em componentes UI.

## Regra 5

Não duplicar cálculos.

## Regra 6

Não hardcodar preços.

## Regra 7

Não hardcodar textos que deveriam estar no i18n.

## Regra 8

Não expor secrets no mobile.

## Regra 9

Nenhuma chave privada deve estar no cliente.

## Regra 10

Toda tabela de usuário deve ter RLS.

---

# 107. TESTES

Prioridade:

## Unitários

- fitness engine;
- score;
- prioridades;
- cálculos.

## Integração

- auth;
- meal flow;
- workout flow.

## E2E

Após MVP estabilizado:

- onboarding;
- alimentação;
- treino;
- assinatura.

---

# 108. VERSIONAMENTO DE REGRAS

Cálculos devem ser versionados.

Exemplo:

```text
fitness_engine_version = "1.0"
```

Isso permite saber com qual lógica uma meta foi calculada.

---

# 109. FEATURE FLAGS

Features futuras devem poder ser ativadas por flag.

Exemplo:

```text
ai_food_logging
ai_coach
photo_food_scan
weekly_insights
health_connect
```

---

# 110. LOGS

Não registrar informações sensíveis em logs.

Evitar:

- refeição completa;
- peso;
- mensagens privadas;
- tokens;
- dados de saúde.

---

# 111. ADMIN FUTURO

Painel administrativo poderá incluir:

- usuários;
- assinaturas;
- alimentos;
- exercícios;
- conteúdo;
- flags;
- métricas;
- custos IA;
- erros.

Não precisa estar no MVP mobile.

---

# 112. EXPERIÊNCIA DE ERRO

Mensagens devem ser:

- simples;
- úteis;
- sem códigos técnicos.

Exemplo ruim:

> PostgreSQL FK violation.

Exemplo bom:

> Não foi possível salvar sua refeição. Tente novamente.

---

# 113. OFFLINE

MVP pode depender de conexão.

Futuro:

- cache;
- treino offline;
- sincronização.

Treino é prioridade para suporte offline futuro.

---

# 114. PERFORMANCE

Objetivos:

- home rápida;
- queries agregadas eficientes;
- evitar N+1;
- não carregar histórico inteiro;
- paginação;
- índices.

---

# 115. BANCO — ÍNDICES IMPORTANTES

Exemplos:

```text
weight_logs(user_id, recorded_at)
water_logs(user_id, recorded_at)
meals(user_id, meal_date)
workout_sessions(user_id, started_at)
daily_scores(user_id, score_date)
```

---

# 116. ESTADO DA APLICAÇÃO

Separar:

- server state;
- local UI state;
- auth state.

Não usar store global para tudo.

---

# 117. DATAS

Banco:

preferencialmente UTC.

Interface:

converter para timezone do usuário.

---

# 118. UNIDADES

Internamente usar sistema métrico:

- kg;
- cm;
- ml.

Converter na apresentação futuramente.

---

# 119. ARREDONDAMENTOS

Centralizar funções.

Exemplo:

- peso: 1 casa;
- calorias: inteiro;
- macros: inteiro;
- água: ml/L conforme contexto.

---

# 120. TERMOS INTERNOS

Nome oficial de conceitos:

```text
KORA Score
Today Dashboard
Priority
Insight
Target
Workout Plan
Workout Session
Meal
Meal Item
Weight Log
Water Log
```

Evitar múltiplos nomes para o mesmo conceito.

---

# 121. COPY

Tom:

- direto;
- acolhedor;
- motivador;
- não infantil;
- não agressivo;
- não julgador.

Evitar:

- "Você falhou."
- "Você estragou sua dieta."
- "Queime essa comida."
- "Compense amanhã."

Preferir:

> Hoje ficou abaixo da sua meta de proteína. Amanhã você pode retomar normalmente.

---

# 122. GAMIFICAÇÃO

Gamificação deve incentivar consistência, não obsessão.

Permitido:

- streak;
- badges;
- score;
- metas;
- milestones.

Evitar:

- punições;
- vergonha;
- comparação corporal;
- rankings de peso.

---

# 123. FUTURAS CONQUISTAS

Exemplos:

- primeiro treino;
- 10 treinos;
- 30 treinos;
- 7 dias de hidratação;
- 30 registros;
- nova melhor marca.

---

# 124. FUTURA COMUNIDADE

Não implementar antes de validar o produto base.

Se existir:

- foco em apoio;
- sem rankings corporais;
- moderação.

---

# 125. FUTURO PARA PROFISSIONAIS

Possível expansão:

- nutricionistas;
- personal trainers;
- coach dashboard.

Mas isso será um produto B2B/B2B2C futuro.

Não deve influenciar o MVP.

---

# 126. CRITÉRIO DE SUCESSO DO MVP

O MVP é bem-sucedido se o usuário consegue:

1. criar conta;
2. informar seus dados;
3. receber metas;
4. registrar alimentação;
5. registrar água;
6. registrar peso;
7. executar treino;
8. acompanhar o dia;
9. visualizar progresso;
10. retornar frequentemente.

---

# 127. PRINCIPAL LOOP DO PRODUTO

```text
Abrir KORA
    ↓
Ver status
    ↓
Executar prioridade
    ↓
Registrar ação
    ↓
Ver progresso
    ↓
Receber feedback
    ↓
Voltar depois
```

Esse é o loop principal.

---

# 128. LOOP SEMANAL

```text
Registrar durante a semana
    ↓
Receber resumo
    ↓
Entender tendência
    ↓
Ajustar comportamento
    ↓
Continuar
```

---

# 129. LOOP DE LONGO PRAZO

```text
Objetivo
    ↓
Plano
    ↓
Consistência
    ↓
Dados
    ↓
Adaptação
    ↓
Resultado
```

---

# 130. PRINCIPAL PROMESSA

KORA deve sempre buscar cumprir:

> **Você não precisa entender todos os números. O KORA organiza o que importa para você hoje.**

---

# 131. REGRA PARA AGENTES DE IA QUE PROGRAMAM O PROJETO

Antes de qualquer implementação:

1. Ler este arquivo.
2. Identificar a fase atual.
3. Não implementar funcionalidades de fases futuras.
4. Verificar o estado existente do projeto.
5. Respeitar arquitetura atual.
6. Não remover funcionalidades sem necessidade.
7. Não criar mock permanente quando já existe backend.
8. Implementar com código legível.
9. Criar migrations quando necessário.
10. Atualizar documentação relevante.

---

# 132. FORMATO DE ENTREGA DE CADA FASE

Ao finalizar uma fase, o agente deve informar:

```text
FASE:
STATUS:

IMPLEMENTADO:
- ...

ARQUIVOS PRINCIPAIS:
- ...

MIGRATIONS:
- ...

TESTES:
- ...

COMO VALIDAR:
1.
2.
3.

PENDÊNCIAS:
- ...

PRÓXIMA FASE:
...
```

---

# 133. NÃO TOMAR DECISÕES DE PRODUTO SILENCIOSAMENTE

Se uma decisão não estiver neste documento:

O agente deve:

1. escolher a alternativa mais simples e reversível;
2. documentar a escolha;
3. não inventar grandes features.

---

# 134. PRIORIDADE DE DECISÃO

Quando houver conflito:

1. Segurança
2. Integridade de dados
3. Regras deste documento
4. Experiência do usuário
5. Simplicidade
6. Performance
7. Elegância técnica

---

# 135. VISÃO FINAL

O KORA deve evoluir de:

> um aplicativo de acompanhamento fitness

para:

> um sistema pessoal que entende o contexto do usuário, acompanha sua evolução e ajuda a transformar objetivos de saúde e fitness em ações diárias simples.

Mas essa evolução deve acontecer em etapas.

O sucesso não depende de criar todas as funções.

O sucesso depende de construir muito bem o loop:

> **ver → entender → agir → registrar → evoluir.**

---

# 136. RESUMO EXECUTIVO

**Produto:** KORA  
**Categoria:** Fitness / Wellness  
**Modelo:** Freemium  
**Plataforma inicial:** iOS + Android  
**Stack principal:** React Native + Expo + Supabase  
**Idioma inicial:** pt-BR  
**Diferencial:** transformar dados em prioridades diárias  
**IA:** complementar, não central para cálculos  
**MVP:** nutrição + água + peso + treino + score + dashboard  
**Pós-MVP:** Coach + IA + foto + integrações  
**Público:** adultos buscando emagrecer, ganhar massa ou manter hábitos  
**Princípio central:** simplicidade e ação  

---

# 137. STATUS ATUAL

```text
CONCEITO: DEFINIDO
MASTER CONTEXT: CRIADO
DESENVOLVIMENTO: NÃO INICIADO NESTE DOCUMENTO
FASE ATUAL RECOMENDADA: FASE 0
```

---

# 138. PRÓXIMA AÇÃO

Criar e executar a:

# FASE 0 — FUNDAÇÃO

A Fase 0 deve preparar o projeto para receber todas as outras funcionalidades sem implementar ainda o produto completo.

Após concluir a Fase 0, atualizar este documento somente se houver mudança estrutural de produto ou arquitetura.

---

**Fim do KORA_MASTER_CONTEXT.md**


---

# ADENDO APROVADO — 22/09/2026 — MOTOR FITNESS 1.2

O responsável aprovou a revisão das seis decisões de produto após a Fase 3. Este adendo prevalece sobre as regras anteriores conflitantes nas seções 12 e 14–22; o corpo original foi preservado.

1. Público mínimo: 18 anos completos.
2. Limites da automação: perda até o menor entre 1% do peso atual e 1 kg/semana; ganho até o menor entre 0,5% e 0,5 kg/semana. Não são metas universais nem garantias de segurança.
3. Prazo desejado avisa sem bloquear o app. Exibir o ajuste limitado antes de salvar, guardar a data como preferência e não prever data de chegada por conversão linear de calorias em peso.
4. Sem prazo: déficit inicial de 15%, superávit de 5%. Com prazo, permitir ajustes menores; não impor déficit mínimo de 10% ou superávit mínimo de 5%. Tetos percentuais: 20%/15%. Proteína 1,4/1,8/1,6 g/kg conforme objetivo e gordura preferencial de 27,5% permanecem.
5. Sexo não informado não recebe coeficiente médio de TMB nem meta automática calórica/macros; pode concluir onboarding e usar o app sem ela.
6. Piso operacional único de 1.500 kcal para geração automática, não mínimo biológico universal. TMB não é piso de ingestão. Se o ajuste não couber ou inverter o objetivo, não gerar meta automática.
7. Não gerar perda automática com IMC atual ou alvo abaixo de 18,5 (comparação sem arredondamento). Não fabricar macros incompatíveis ou números para caber nos limites de armazenamento.
8. Versão nova `fitness_engine@1.2`; metas históricas preservadas. Ausência de meta é estado legítimo e deve ser suportada no dashboard sem penalização ou números fictícios.

Regras completas, fontes, limitações e contrato para o Dashboard: `docs/PRODUCT_DECISIONS.md`. Estado atual e validações: `STATUS.md`. Fases 0–3 concluídas; próxima fase de desenvolvimento: **Fase 4 — Dashboard Hoje**. Revisão clínica e triagem de situações não atendidas permanecem requisitos antes do beta, não funções já implementadas.
