-- KORA — Fase 8: treinos.
-- Referência de produto: KORA_MASTER_CONTEXT.md seções 38 a 44 (domínio) e
-- 70 a 76 (tabelas), seção 2226 (entregáveis da fase) e seção 2251 (Fase 10 —
-- notificação de treino fica lá, não aqui).
--
-- Decisões documentadas (seção 133 — não decidir em silêncio):
--  * `exercises` é catálogo global, somente leitura pelo cliente, semeado à
--    mão (source='seed', verified=false) como os alimentos da Fase 5 — sem
--    licença de terceiro envolvida. `user_exercises` é o par do usuário,
--    mesmo desenho de `foods`/`user_foods`.
--  * `workout_day_exercises` e `workout_session_exercises` ganham
--    `name_snapshot`, e `workout_sessions` ganha `day_name_snapshot`: os FKs
--    para `exercises`/`user_exercises`/`workout_plan_days` usam
--    `on delete set null`, e apagar a origem não pode apagar o nome de um
--    plano ou de uma sessão já registrada. Mesmo motivo de `meal_items`.
--  * Um plano ativo por usuário, garantido por índice parcial (mesmo padrão
--    de `goals`). Trocar de plano ativo é uma escrita explícita, não uma
--    lista de planos concorrentes.
--  * `workout_plan_days.day_index` é uma sequência dentro do plano (Dia 1,
--    Dia 2...), sem mapeamento para dia da semana — a seção 71 não pede
--    isso. "Treino programado hoje" (sinal do dashboard) significa "há um
--    plano ativo com dias configurados", não "hoje é o dia X do calendário".
--  * `workout_sets` é histórico imutável, como `weight_logs`/`water_logs`:
--    `id` vem do cliente para a escrita ser idempotente; sem UPDATE
--    concedido, só INSERT/DELETE.
--  * `workout_day_exercises` e `workout_sets` são o primeiro caso no projeto
--    de posse a dois saltos (neto, não filho); a política usa EXISTS com
--    JOIN pela tabela intermediária.

-- ---------------------------------------------------------------------------
-- Enums.
-- ---------------------------------------------------------------------------

create type public.exercise_source as enum ('seed', 'official', 'imported');

create type public.workout_session_status as enum ('in_progress', 'completed', 'abandoned');

-- ---------------------------------------------------------------------------
-- exercises — catálogo global, somente leitura pelo cliente (seção 39).
-- ---------------------------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text,
  instructions text,
  -- Mídia é futura (seção 39); a coluna existe e fica sempre nula por ora.
  media_url text,
  source public.exercise_source not null default 'seed',
  verified boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint exercises_name_length check (char_length(btrim(name)) between 1 and 160),
  constraint exercises_muscle_length check (char_length(btrim(primary_muscle)) between 1 and 80),
  constraint exercises_equipment_length check (equipment is null or char_length(btrim(equipment)) <= 80),
  constraint exercises_instructions_length check (instructions is null or char_length(instructions) <= 2000)
);
comment on table public.exercises is
  'Catálogo global. Linhas source=seed são referência de teste, não base verificada — ver scripts/seed-exercises.mjs.';

create index exercises_active_idx on public.exercises (active) where active;

-- ---------------------------------------------------------------------------
-- user_exercises — exercícios cadastrados pelo próprio usuário.
-- ---------------------------------------------------------------------------

create table public.user_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_exercises_name_length check (char_length(btrim(name)) between 1 and 160),
  constraint user_exercises_muscle_length check (char_length(btrim(primary_muscle)) between 1 and 80),
  constraint user_exercises_equipment_length check (equipment is null or char_length(btrim(equipment)) <= 80),
  constraint user_exercises_instructions_length check (instructions is null or char_length(instructions) <= 2000)
);
comment on table public.user_exercises is
  'Exercícios do próprio usuário. Apagar um deles preserva o histórico já registrado, por causa dos snapshots em workout_day_exercises/workout_session_exercises.';

create index user_exercises_user_id_idx on public.user_exercises (user_id);

-- ---------------------------------------------------------------------------
-- workout_plans — seção 70.
-- ---------------------------------------------------------------------------

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- Texto livre do objetivo do plano; não é o goal_type do onboarding, que é
  -- sobre composição corporal, não sobre a rotina de treino.
  goal text,
  days_per_week smallint,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_plans_name_length check (char_length(btrim(name)) between 1 and 160),
  constraint workout_plans_goal_length check (goal is null or char_length(btrim(goal)) <= 200),
  constraint workout_plans_days_range check (days_per_week is null or days_per_week between 1 and 7)
);
comment on table public.workout_plans is 'Um plano ativo por vez — ver workout_plans_one_active_per_user.';

create unique index workout_plans_one_active_per_user
  on public.workout_plans (user_id)
  where active;

create index workout_plans_user_id_idx on public.workout_plans (user_id);

-- ---------------------------------------------------------------------------
-- workout_plan_days — seção 71.
-- ---------------------------------------------------------------------------

create table public.workout_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  day_index smallint not null,
  name text not null,
  order_index smallint not null,
  created_at timestamptz not null default now(),
  constraint workout_plan_days_name_length check (char_length(btrim(name)) between 1 and 160),
  constraint workout_plan_days_index_positive check (day_index > 0 and order_index >= 0),
  unique (plan_id, day_index)
);

create index workout_plan_days_plan_id_idx on public.workout_plan_days (plan_id);

-- ---------------------------------------------------------------------------
-- workout_day_exercises — seção 73, com name_snapshot (ver decisões acima).
-- ---------------------------------------------------------------------------

create table public.workout_day_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references public.workout_plan_days (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  user_exercise_id uuid references public.user_exercises (id) on delete set null,
  name_snapshot text not null,
  order_index smallint not null,
  target_sets smallint not null,
  min_reps smallint not null,
  max_reps smallint not null,
  rest_seconds smallint not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint workout_day_exercises_single_origin check (
    (exercise_id is not null)::int + (user_exercise_id is not null)::int <= 1
  ),
  constraint workout_day_exercises_name_length check (char_length(btrim(name_snapshot)) between 1 and 160),
  constraint workout_day_exercises_sets_range check (target_sets between 1 and 20),
  constraint workout_day_exercises_reps_range check (
    min_reps between 1 and 200 and max_reps between 1 and 200 and min_reps <= max_reps
  ),
  constraint workout_day_exercises_rest_range check (rest_seconds between 0 and 3600),
  constraint workout_day_exercises_notes_length check (notes is null or char_length(notes) <= 500)
);

create index workout_day_exercises_day_id_idx on public.workout_day_exercises (workout_day_id);

-- ---------------------------------------------------------------------------
-- workout_sessions — seção 74, com day_name_snapshot (ver decisões acima).
-- ---------------------------------------------------------------------------

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Anulável: sessão avulsa, fora de um dia de plano, também é válida.
  workout_day_id uuid references public.workout_plan_days (id) on delete set null,
  day_name_snapshot text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer,
  status public.workout_session_status not null default 'in_progress',
  created_at timestamptz not null default now(),
  constraint workout_sessions_completed_after_start check (completed_at is null or completed_at >= started_at),
  constraint workout_sessions_duration_range check (duration_seconds is null or duration_seconds >= 0),
  constraint workout_sessions_completed_has_end check (status <> 'completed' or completed_at is not null)
);

create index workout_sessions_user_started_at_idx on public.workout_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- workout_session_exercises — seção 75.
-- ---------------------------------------------------------------------------

create table public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  user_exercise_id uuid references public.user_exercises (id) on delete set null,
  name_snapshot text not null,
  order_index smallint not null,
  created_at timestamptz not null default now(),
  constraint workout_session_exercises_single_origin check (
    (exercise_id is not null)::int + (user_exercise_id is not null)::int <= 1
  ),
  constraint workout_session_exercises_name_length check (char_length(btrim(name_snapshot)) between 1 and 160)
);

create index workout_session_exercises_session_id_idx on public.workout_session_exercises (session_id);

-- ---------------------------------------------------------------------------
-- workout_sets — seção 76. Histórico imutável, id gerado no cliente.
-- ---------------------------------------------------------------------------

create table public.workout_sets (
  id uuid primary key,
  session_exercise_id uuid not null references public.workout_session_exercises (id) on delete cascade,
  set_number smallint not null,
  weight_kg numeric(6, 2),
  reps smallint not null,
  completed boolean not null default true,
  rest_seconds smallint,
  created_at timestamptz not null default now(),
  constraint workout_sets_number_positive check (set_number > 0),
  constraint workout_sets_weight_range check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 500)),
  constraint workout_sets_reps_range check (reps between 0 and 200),
  constraint workout_sets_rest_range check (rest_seconds is null or rest_seconds between 0 and 3600),
  unique (session_exercise_id, set_number)
);
comment on column public.workout_sets.id is 'UUID criado no cliente por operação; repetir a mesma operação não duplica o registro.';

create index workout_sets_session_exercise_id_idx on public.workout_sets (session_exercise_id);

-- ---------------------------------------------------------------------------
-- Row Level Security.
-- ---------------------------------------------------------------------------

alter table public.exercises enable row level security;
alter table public.user_exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_plan_days enable row level security;
alter table public.workout_day_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_sets enable row level security;

create policy exercises_select_authenticated on public.exercises
  for select to authenticated using (true);

create policy user_exercises_select_own on public.user_exercises
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_exercises_insert_own on public.user_exercises
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_exercises_update_own on public.user_exercises
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_exercises_delete_own on public.user_exercises
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy workout_plans_select_own on public.workout_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_plans_insert_own on public.workout_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workout_plans_update_own on public.workout_plans
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy workout_plans_delete_own on public.workout_plans
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy workout_plan_days_select_own on public.workout_plan_days
  for select to authenticated
  using (
    exists (
      select 1 from public.workout_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );
create policy workout_plan_days_insert_own on public.workout_plan_days
  for insert to authenticated
  with check (
    exists (
      select 1 from public.workout_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );
create policy workout_plan_days_update_own on public.workout_plan_days
  for update to authenticated
  using (
    exists (
      select 1 from public.workout_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.workout_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );
create policy workout_plan_days_delete_own on public.workout_plan_days
  for delete to authenticated
  using (
    exists (
      select 1 from public.workout_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );

-- Dois saltos: workout_day_exercises -> workout_plan_days -> workout_plans.
create policy workout_day_exercises_select_own on public.workout_day_exercises
  for select to authenticated
  using (
    exists (
      select 1 from public.workout_plan_days d
      join public.workout_plans p on p.id = d.plan_id
      where d.id = workout_day_id and p.user_id = (select auth.uid())
    )
  );
create policy workout_day_exercises_insert_own on public.workout_day_exercises
  for insert to authenticated
  with check (
    exists (
      select 1 from public.workout_plan_days d
      join public.workout_plans p on p.id = d.plan_id
      where d.id = workout_day_id and p.user_id = (select auth.uid())
    )
  );
create policy workout_day_exercises_update_own on public.workout_day_exercises
  for update to authenticated
  using (
    exists (
      select 1 from public.workout_plan_days d
      join public.workout_plans p on p.id = d.plan_id
      where d.id = workout_day_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.workout_plan_days d
      join public.workout_plans p on p.id = d.plan_id
      where d.id = workout_day_id and p.user_id = (select auth.uid())
    )
  );
create policy workout_day_exercises_delete_own on public.workout_day_exercises
  for delete to authenticated
  using (
    exists (
      select 1 from public.workout_plan_days d
      join public.workout_plans p on p.id = d.plan_id
      where d.id = workout_day_id and p.user_id = (select auth.uid())
    )
  );

create policy workout_sessions_select_own on public.workout_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_sessions_insert_own on public.workout_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workout_sessions_update_own on public.workout_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy workout_sessions_delete_own on public.workout_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy workout_session_exercises_select_own on public.workout_session_exercises
  for select to authenticated
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );
create policy workout_session_exercises_insert_own on public.workout_session_exercises
  for insert to authenticated
  with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );
create policy workout_session_exercises_delete_own on public.workout_session_exercises
  for delete to authenticated
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

-- Dois saltos: workout_sets -> workout_session_exercises -> workout_sessions.
create policy workout_sets_select_own on public.workout_sets
  for select to authenticated
  using (
    exists (
      select 1 from public.workout_session_exercises se
      join public.workout_sessions s on s.id = se.session_id
      where se.id = session_exercise_id and s.user_id = (select auth.uid())
    )
  );
create policy workout_sets_insert_own on public.workout_sets
  for insert to authenticated
  with check (
    exists (
      select 1 from public.workout_session_exercises se
      join public.workout_sessions s on s.id = se.session_id
      where se.id = session_exercise_id and s.user_id = (select auth.uid())
    )
  );
create policy workout_sets_delete_own on public.workout_sets
  for delete to authenticated
  using (
    exists (
      select 1 from public.workout_session_exercises se
      join public.workout_sessions s on s.id = se.session_id
      where se.id = session_exercise_id and s.user_id = (select auth.uid())
    )
  );

-- Privilégios explícitos: nada de TRUNCATE/UPDATE herdado onde não cabe (ver 0002).
revoke all on public.exercises, public.user_exercises, public.workout_plans,
  public.workout_plan_days, public.workout_day_exercises, public.workout_sessions,
  public.workout_session_exercises, public.workout_sets
  from anon, authenticated;

grant select on public.exercises to authenticated;
grant select, insert, update, delete on public.user_exercises to authenticated;
grant select, insert, update, delete on public.workout_plans to authenticated;
grant select, insert, update, delete on public.workout_plan_days to authenticated;
grant select, insert, update, delete on public.workout_day_exercises to authenticated;
grant select, insert, update, delete on public.workout_sessions to authenticated;
grant select, insert, delete on public.workout_session_exercises to authenticated;
-- Histórico imutável: sem UPDATE, como weight_logs/water_logs.
grant select, insert, delete on public.workout_sets to authenticated;
