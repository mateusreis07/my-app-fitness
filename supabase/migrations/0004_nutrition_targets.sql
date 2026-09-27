-- KORA — Fase 3: Motor Fitness.
-- Referência de produto: KORA_MASTER_CONTEXT.md seções 63 (nutrition_targets),
-- 97 (histórico de metas), 108 (versionamento de regras) e 81 (RLS).
--
-- Decisões documentadas (seção 133):
--  * Histórico por janela de vigência: `effective_from` / `effective_until`.
--    Recalcular não sobrescreve — fecha a meta anterior e abre outra. É o que
--    permite saber com que regra uma meta foi calculada (seção 108).
--  * `calculation_source` guarda a versão do motor, no formato
--    `fitness_engine@1.0`, seguindo o nome de coluna do documento mestre em vez
--    de criar uma coluna nova.
--  * Índice parcial garante uma única meta vigente por usuário.

create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  calories integer not null,
  protein_g integer not null,
  carbs_g integer not null,
  fat_g integer not null,
  water_ml integer not null,
  effective_from date not null default current_date,
  effective_until date,
  calculation_source text not null,
  created_at timestamptz not null default now(),

  -- Limites amplos de sanidade. A regra de negócio (piso calórico por sexo,
  -- nunca abaixo da TMB) vive no motor, com teste próprio.
  constraint nutrition_targets_calories_range check (calories between 800 and 8000),
  constraint nutrition_targets_protein_range check (protein_g between 0 and 500),
  constraint nutrition_targets_carbs_range check (carbs_g between 0 and 1200),
  constraint nutrition_targets_fat_range check (fat_g between 0 and 400),
  constraint nutrition_targets_water_range check (water_ml between 500 and 10000),
  constraint nutrition_targets_window check (effective_until is null or effective_until >= effective_from),
  constraint nutrition_targets_source_format check (calculation_source ~ '^[a-z_]+@[0-9]+\.[0-9]+$')
);

comment on table public.nutrition_targets is
  'Metas calculadas pelo Motor Fitness. Histórico preservado por janela de vigência.';
comment on column public.nutrition_targets.calculation_source is
  'Versão do motor que produziu a meta, ex: fitness_engine@1.0.';

-- Uma única meta vigente por usuário.
create unique index nutrition_targets_one_current_per_user
  on public.nutrition_targets (user_id)
  where effective_until is null;

create index nutrition_targets_user_id_effective_from_idx
  on public.nutrition_targets (user_id, effective_from desc);

-- ---------------------------------------------------------------------------
-- RLS. Sem DELETE: a meta antiga é fechada, não apagada (seção 97).
-- ---------------------------------------------------------------------------

alter table public.nutrition_targets enable row level security;

create policy nutrition_targets_select_own on public.nutrition_targets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy nutrition_targets_insert_own on public.nutrition_targets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy nutrition_targets_update_own on public.nutrition_targets
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Privilégios explícitos: nada de TRUNCATE/DELETE herdado (ver 0002).
revoke all on public.nutrition_targets from anon, authenticated;
grant select, insert, update on public.nutrition_targets to authenticated;
