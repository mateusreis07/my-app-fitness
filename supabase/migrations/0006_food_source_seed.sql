-- KORA — acrescenta a origem `seed` ao enum de fonte de alimento.
--
-- Motivo: a base global precisa de conteúdo para exercitar busca e registro
-- antes de a fonte definitiva ser decidida (ver docs/PHASE_5.md). Marcar esses
-- registros como `official` seria apresentar dado de teste como base curada,
-- o que o invariante 3 proíbe.
--
-- `seed` diz exatamente o que a linha é: valor de referência aproximado,
-- inserido para teste, não verificado e não proveniente de base licenciada.
-- Some com uma linha só: delete from public.foods where source = 'seed';

alter type public.food_source add value 'seed';
