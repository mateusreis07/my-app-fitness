-- KORA — Fase 2: onboarding.
-- Referência de produto: KORA_MASTER_CONTEXT.md seções 12 (etapas), 62 (goals),
-- 64 (weight_logs), 81 (RLS) e 106 (regra 10).
--
-- Decisões documentadas (seção 133 — não decidir em silêncio):
--  * As etapas 5 e 6 do onboarding não têm tabela definida no documento mestre.
--    Optou-se por duas tabelas focadas e reversíveis, uma linha por usuário,
--    em vez de um blob de respostas: training_preferences e
--    nutrition_preferences.
--  * nutrition_targets (seção 63) NÃO é criada aqui. Ela é preenchida pelo
--    Motor Fitness, que é a Fase 3. Criar a tabela vazia agora seria
--    implementar função futura "só porque pode" (regra 1).
--  * Um único objetivo ativo por usuário, garantido por índice parcial.

-- ---------------------------------------------------------------------------
-- Enums.
-- ---------------------------------------------------------------------------

create type public.goal_type as enum (
  'lose_weight',
  'gain_muscle',
  'maintain_weight',
  'improve_health',
  'improve_fitness'
);

create type public.goal_status as enum ('active', 'achieved', 'abandoned');

create type public.training_location as enum ('home', 'gym', 'outdoor', 'mixed');

-- ---------------------------------------------------------------------------
-- profiles — marca de conclusão do onboarding.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column onboarding_completed_at timestamptz;

comment on column public.profiles.onboarding_completed_at is
  'Nulo enquanto o onboarding não foi concluído. Usado para rotear o usuário.';

-- ---------------------------------------------------------------------------
-- goals — seção 62.
-- ---------------------------------------------------------------------------

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_type public.goal_type not null,
  starting_weight_kg numeric(5, 2),
  target_weight_kg numeric(5, 2),
  started_at date not null default current_date,
  target_date date,
  status public.goal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint goals_starting_weight_range
    check (starting_weight_kg is null or starting_weight_kg between 25 and 400),
  constraint goals_target_weight_range
    check (target_weight_kg is null or target_weight_kg between 25 and 400),
  constraint goals_target_date_after_start
    check (target_date is null or target_date >= started_at)
);

comment on table public.goals is
  'Objetivo do usuário. Histórico preservado: metas antigas mudam de status, não são apagadas.';

-- Um objetivo ativo por vez.
create unique index goals_one_active_per_user
  on public.goals (user_id)
  where status = 'active';

create index goals_user_id_created_at_idx on public.goals (user_id, created_at desc);

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- weight_logs — seção 64. O onboarding grava o primeiro registro.
-- ---------------------------------------------------------------------------

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weight_kg numeric(5, 2) not null,
  recorded_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),

  constraint weight_logs_range check (weight_kg between 25 and 400),
  constraint weight_logs_notes_length check (notes is null or char_length(notes) <= 500)
);

create index weight_logs_user_id_recorded_at_idx
  on public.weight_logs (user_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- training_preferences — etapa 5.
-- ---------------------------------------------------------------------------

create table public.training_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  days_per_week smallint not null,
  session_minutes smallint not null,
  location public.training_location not null,
  equipment text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint training_days_range check (days_per_week between 1 and 7),
  constraint training_minutes_range check (session_minutes between 10 and 240),
  constraint training_equipment_size
    check (array_length(equipment, 1) is null or array_length(equipment, 1) <= 20)
);

create trigger training_preferences_set_updated_at
  before update on public.training_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- nutrition_preferences — etapa 6. Todos os campos são opcionais.
-- ---------------------------------------------------------------------------

create table public.nutrition_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  meals_per_day smallint,
  vegetarian boolean not null default false,
  vegan boolean not null default false,
  restrictions text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint nutrition_meals_range check (meals_per_day is null or meals_per_day between 1 and 10),
  constraint nutrition_restrictions_size
    check (array_length(restrictions, 1) is null or array_length(restrictions, 1) <= 20),
  constraint nutrition_notes_length check (notes is null or char_length(notes) <= 500),
  -- Vegano implica vegetariano. Evita estados contraditórios no banco.
  constraint nutrition_vegan_implies_vegetarian check (not vegan or vegetarian)
);

create trigger nutrition_preferences_set_updated_at
  before update on public.nutrition_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS para as quatro tabelas. Mesmo princípio: o usuário só alcança as próprias
-- linhas. weight_logs permite DELETE porque apagar um registro errado de peso é
-- uma ação legítima do usuário; as demais são de linha única e só mudam.
-- ---------------------------------------------------------------------------

alter table public.goals enable row level security;
alter table public.weight_logs enable row level security;
alter table public.training_preferences enable row level security;
alter table public.nutrition_preferences enable row level security;

create policy goals_select_own on public.goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy goals_insert_own on public.goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goals_update_own on public.goals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy weight_logs_select_own on public.weight_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy weight_logs_insert_own on public.weight_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy weight_logs_update_own on public.weight_logs
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy weight_logs_delete_own on public.weight_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy training_preferences_select_own on public.training_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy training_preferences_insert_own on public.training_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy training_preferences_update_own on public.training_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy nutrition_preferences_select_own on public.nutrition_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy nutrition_preferences_insert_own on public.nutrition_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy nutrition_preferences_update_own on public.nutrition_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Privilégios explícitos: nada de TRUNCATE/DELETE herdado (ver 0002).
revoke all on public.goals, public.weight_logs,
  public.training_preferences, public.nutrition_preferences
  from anon, authenticated;

grant select, insert, update on public.goals to authenticated;
grant select, insert, update, delete on public.weight_logs to authenticated;
grant select, insert, update on public.training_preferences to authenticated;
grant select, insert, update on public.nutrition_preferences to authenticated;
