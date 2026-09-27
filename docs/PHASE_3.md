# Fase 3 — Motor Fitness

**Concluída; revisão aprovada em 22/09/2026: `fitness_engine@1.2`.** Próxima fase: Dashboard Hoje.

Fonte: seções 13–22, 63, 97, 106, 108, 118 e 119 do `KORA_MASTER_CONTEXT.md`, com o adendo aprovado ao final do mestre. Regras detalhadas, justificativas, referências e contrato de integração em [PRODUCT_DECISIONS.md](PRODUCT_DECISIONS.md).

## Implementação vigente

Motor determinístico em `src/features/fitness/engine.ts`, sem React, IA ou rede. Parâmetros em `constants.ts`; arredondamentos em `src/lib/rounding.ts`.

| Cálculo/regra        | Implementação                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| IMC                  | Peso / altura²; limites de elegibilidade usam valor bruto, exibição com uma casa                                |
| TMB                  | Mifflin-St Jeor; sexo não informado retorna `null`, sem média artificial                                        |
| TDEE                 | TMB × fator de atividade                                                                                        |
| Ajuste sem prazo     | −15% para perda, +5% para ganho, manutenção nos demais                                                          |
| Ajuste com prazo     | Aproximação inicial de 7.700 kcal/kg; sem ajuste mínimo forçado                                                 |
| Limites              | Perda: min(1% do peso, 1 kg)/semana e 20% do TDEE; ganho: min(0,5%, 0,5 kg)/semana e 15% do TDEE                |
| Piso da automação    | 1.500 kcal para todos; TMB não é piso de ingestão                                                               |
| Proteína             | 1,8 g/kg perda/ganho, 1,4 manutenção/saúde, 1,6 condicionamento                                                 |
| Gordura/carboidratos | Preferência 27,5% das calorias, piso de gordura 0,6 g/kg; carboidratos pelo restante; sem plano se incompatível |
| Água                 | 35 ml/kg para planos elegíveis; hidratação separada ainda não implementada                                      |
| Elegibilidade        | Adultos; sem perda automática para IMC atual ou alvo <18,5; entradas e limites do esquema validados             |

São limites de automação e estimativas, não garantias individuais de segurança. Não existe previsão de data de chegada, nem promessa de ajustes automáticos pelo histórico.

## Interface e persistência

- Resultado discriminado `ready` / `unavailable`. Sem plano, a interface explica e permite concluir sem metas automáticas.
- Prévia e gravação usam o mesmo payload e motor. A tela mostra avisos de prazo/piso antes de aceitar.
- Nova meta grava `fitness_engine@1.2`. Histórico 1.1 é preservado, sem recálculo retroativo.
- Sem plano, fecha eventual meta vigente e não insere números fictícios. Objetivo permanece intenção declarada, não prescrição.
- `TargetsCard` é ponte provisória para a Fase 4; diferencia ausência de meta e erro de leitura.
- Migration `0004_nutrition_targets.sql` continua intacta. Não há nova migration nesta revisão.
- Escritas REST são sequenciais, não transacionais; ver riscos de nova tentativa e troca de meta em `PRODUCT_DECISIONS.md`.

## Correções da revisão 1.2

- Removidos coeficiente −78, pisos por sexo, piso obrigatório por TMB e `projectPace`.
- Prazo longo não força déficit de 10%; caso 70→69 kg em 365 dias e TDEE 2.250 gera 2.229 kcal iniciais, sem data prometida.
- IMC abaixo do peso atual/alvo impede apenas geração automática de perda, não o acesso ao app.
- Incompatibilidade entre proteína/gordura e calorias retorna ausência de plano em vez de macros impossíveis.
- Objetivos sem peso-alvo passam por dados básicos e pulam apenas a etapa de meta; navegação de volta consistente.
- Payload revalida todas as etapas; menores não podem entrar pelo submit direto.
- Falhas de rede devolvem erro traduzível; falha de leitura não vira falso estado de ausência de meta.

## Testes e aceite

- `engine.test.mts`: fórmulas, pisos, limites proporcionais, prazos, elegibilidade, versão e varredura de extremos.
- `validation.test.mts` e `payload.test.mts`: validação, idade, datas e conversão de dados.
- `submit.test.mts`: cliente simulado; plano exibido = gravado, conclusão sem meta, encerramento preservando histórico, falhas sem conclusão, navegação e ausência vs erro de consulta.
- Resultado consolidado dos comandos em `STATUS.md`, seção 7. A revisão 1.2 não foi testada em dispositivo real nem novamente contra o banco remoto.

## Histórico de validação 1.1

Antes desta revisão, 61 testes e export Android/iOS/web passavam. Foram feitos testes remotos de RLS, unicidade da meta vigente, gravação da versão e preservação de histórico, além de revisão de interface pelo responsável. Esses resultados históricos não devem ser apresentados como validação remota ou visual da versão 1.2.

## Entrega para a Fase 4

Consumir metas persistidas sem recálculo implícito. Tratar carregamento, erro, meta presente e ausência legítima de meta; não inventar percentuais ou penalizar usuários sem metas. Prioridades não podem prometer prazo, confundir peso ganho com músculo ou incentivar perda com base apenas no objetivo declarado. Escopo da Fase 4: dashboard e motor de prioridades conforme seções 23–26; registro alimentar, água, peso e treino seguem suas fases próprias.
