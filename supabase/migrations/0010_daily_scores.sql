-- KORA — Fase 9: score + streak.
-- Referência de produto: KORA_MASTER_CONTEXT.md seções 45 a 48 (índice de
-- aderência, composição, normalização, streak) e 77 (tabela).
--
-- Decisões documentadas (seção 133 — não decidir em silêncio, ver docs/PHASE_9.md):
--  * `workout_score`/`consistency_score` nunca são nulos — o documento define
--    fórmulas sempre calculáveis para os dois (dia de descanso vale 100 no
--    treino; consistência é sempre computável a partir do que foi registrado).
--  * `nutrition_score`/`protein_score`/`hydration_score` vêm da mesma linha de
--    `nutrition_targets` e ficam nulos juntos quando não há meta vigente
--    naquele dia — sem meta não é score zero, é ausência de score.
--  * `total_score` também fica nulo nesse caso: sem meta nutricional, o
--    número não teria o que medir de verdade.
--  * `algorithm_version` grava a versão da fórmula (espelha
--    `calculation_source` de `nutrition_targets`), para uma mudança futura de
--    peso/fórmula não reescrever histórico já fechado.
--  * Sem tabela de streak: é sempre calculado a partir do histórico de
--    `daily_scores`, nunca persistido.
--  * `unique(user_id, score_date)` — um dia fecha uma vez só; releitura de
--    dado atrasado usa upsert pela mesma chave.

create table public.daily_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  score_date date not null,
  nutrition_score numeric(5, 2),
  protein_score numeric(5, 2),
  hydration_score numeric(5, 2),
  workout_score numeric(5, 2) not null,
  consistency_score numeric(5, 2) not null,
  total_score numeric(5, 2),
  algorithm_version text not null,
  created_at timestamptz not null default now(),
  constraint daily_scores_version_length check (char_length(btrim(algorithm_version)) between 1 and 40),
  constraint daily_scores_nutrition_range check (nutrition_score is null or nutrition_score between 0 and 100),
  constraint daily_scores_protein_range check (protein_score is null or protein_score between 0 and 100),
  constraint daily_scores_hydration_range check (hydration_score is null or hydration_score between 0 and 100),
  constraint daily_scores_workout_range check (workout_score between 0 and 100),
  constraint daily_scores_consistency_range check (consistency_score between 0 and 100),
  constraint daily_scores_total_range check (total_score is null or total_score between 0 and 100),
  unique (user_id, score_date)
);
comment on table public.daily_scores is
  'Índice interno de aderência (seção 45) — não é nota de saúde, avaliação médica, diagnóstico nem indicador clínico.';
comment on column public.daily_scores.total_score is
  'Nulo quando não havia meta nutricional vigente no dia — ausência de meta não vira score zero.';

create index daily_scores_user_date_idx on public.daily_scores (user_id, score_date desc);

alter table public.daily_scores enable row level security;

create policy daily_scores_select_own on public.daily_scores
  for select to authenticated using ((select auth.uid()) = user_id);
create policy daily_scores_insert_own on public.daily_scores
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy daily_scores_update_own on public.daily_scores
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Privilégios explícitos: nada de TRUNCATE/DELETE herdado (ver 0002).
-- Sem DELETE: um dia fechado não é apagado pelo cliente, só corrigido por
-- upsert, mesmo padrão de `nutrition_targets`/`goals`.
revoke all on public.daily_scores from anon, authenticated;
grant select, insert, update on public.daily_scores to authenticated;
