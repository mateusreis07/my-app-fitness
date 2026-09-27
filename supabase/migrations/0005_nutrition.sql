-- KORA — Fase 5: nutrição.
-- Referência de produto: KORA_MASTER_CONTEXT.md seções 28 (tipos de refeição),
-- 29 (alimento), 30 (fontes), 66 a 69 (tabelas), 81 (RLS) e 115 (índices).
--
-- Decisões documentadas (seção 133):
--  * `foods` nasce vazia. A seção 30 pede "base oficial/importada" sem dizer
--    qual, e a licença de cada candidata tem consequência diferente. A busca
--    funciona sobre `user_foods` até a fonte ser decidida; nada na estrutura
--    muda quando a base entrar.
--  * `foods` é global, sem `user_id`: leitura para qualquer autenticado e
--    nenhuma escrita pelo cliente, conforme a seção 81. A carga será feita por
--    rotina de servidor.
--  * `meal_items` guarda snapshots dos macros. Por isso as chaves para alimento
--    usam `on delete set null`: apagar um alimento não pode reescrever o
--    histórico já registrado (seção 69).
--  * Uma refeição por tipo por dia, garantida por índice único. Os itens vivem
--    dentro dela; não existem "dois almoços" no mesmo dia.
--  * A posse de `meal_items` vem da refeição, sem `user_id` duplicado. Mantém o
--    esquema do documento mestre e evita duas fontes de verdade para o dono.

-- ---------------------------------------------------------------------------
-- Enums.
-- ---------------------------------------------------------------------------

create type public.meal_type as enum (
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'supper',
  'other'
);

-- Origem do dado nutricional (seção 29). `ai` fica reservado para a fase de
-- registro com IA, que trata esses valores como estimativa.
create type public.food_source as enum ('official', 'imported', 'ai');

-- ---------------------------------------------------------------------------
-- foods — base global, somente leitura pelo cliente (seções 66 e 81).
-- ---------------------------------------------------------------------------

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  serving_size numeric(8, 2) not null,
  serving_unit text not null,
  calories numeric(8, 2) not null,
  protein_g numeric(8, 2) not null,
  carbs_g numeric(8, 2) not null,
  fat_g numeric(8, 2) not null,
  fiber_g numeric(8, 2),
  sodium_mg numeric(9, 2),
  source public.food_source not null default 'official',
  verified boolean not null default false,
  created_at timestamptz not null default now(),

  constraint foods_name_length check (char_length(btrim(name)) between 1 and 160),
  constraint foods_brand_length check (brand is null or char_length(btrim(brand)) <= 120),
  constraint foods_unit_length check (char_length(btrim(serving_unit)) between 1 and 20),
  constraint foods_serving_range check (serving_size > 0 and serving_size <= 10000),
  constraint foods_calories_range check (calories >= 0 and calories <= 9000),
  constraint foods_protein_range check (protein_g >= 0 and protein_g <= 1000),
  constraint foods_carbs_range check (carbs_g >= 0 and carbs_g <= 1000),
  constraint foods_fat_range check (fat_g >= 0 and fat_g <= 1000),
  constraint foods_fiber_range check (fiber_g is null or (fiber_g >= 0 and fiber_g <= 1000)),
  constraint foods_sodium_range check (sodium_mg is null or (sodium_mg >= 0 and sodium_mg <= 100000))
);

comment on table public.foods is
  'Base global de alimentos. Vazia até a fonte importada ser decidida; escrita só por rotina de servidor.';

create index foods_name_idx on public.foods (lower(name));

-- ---------------------------------------------------------------------------
-- user_foods — alimentos cadastrados pelo próprio usuário (seção 67).
-- ---------------------------------------------------------------------------

create table public.user_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  serving_size numeric(8, 2) not null,
  serving_unit text not null,
  calories numeric(8, 2) not null,
  protein_g numeric(8, 2) not null,
  carbs_g numeric(8, 2) not null,
  fat_g numeric(8, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_foods_name_length check (char_length(btrim(name)) between 1 and 160),
  constraint user_foods_unit_length check (char_length(btrim(serving_unit)) between 1 and 20),
  constraint user_foods_serving_range check (serving_size > 0 and serving_size <= 10000),
  constraint user_foods_calories_range check (calories >= 0 and calories <= 9000),
  constraint user_foods_protein_range check (protein_g >= 0 and protein_g <= 1000),
  constraint user_foods_carbs_range check (carbs_g >= 0 and carbs_g <= 1000),
  constraint user_foods_fat_range check (fat_g >= 0 and fat_g <= 1000)
);

comment on table public.user_foods is
  'Alimentos do próprio usuário. Apagar um deles preserva o histórico já registrado, por causa dos snapshots em meal_items.';

create index user_foods_user_id_name_idx on public.user_foods (user_id, lower(name));

create trigger user_foods_set_updated_at
  before update on public.user_foods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- meals — uma refeição por tipo por dia (seção 68).
-- ---------------------------------------------------------------------------

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_type public.meal_type not null,
  meal_date date not null,
  created_at timestamptz not null default now(),

  -- Limites amplos de sanidade. O dia correto vem do fuso do perfil, regra que
  -- vive no aplicativo e tem teste próprio.
  constraint meals_date_range check (meal_date between date '2020-01-01' and date '2100-01-01')
);

comment on table public.meals is 'Refeição de um dia. Os alimentos registrados ficam em meal_items.';
comment on column public.meals.meal_date is
  'Dia no fuso do perfil, não em UTC. Precisa bater com o dia usado pelo dashboard.';

create unique index meals_one_per_type_per_day on public.meals (user_id, meal_date, meal_type);

-- Seção 115.
create index meals_user_id_meal_date_idx on public.meals (user_id, meal_date desc);

-- ---------------------------------------------------------------------------
-- meal_items — o que foi registrado, com snapshot dos macros (seção 69).
-- ---------------------------------------------------------------------------

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  user_food_id uuid references public.user_foods (id) on delete set null,
  -- Nome no momento do registro: se o alimento for apagado, a linha continua
  -- legível na tela de histórico.
  name_snapshot text not null,
  quantity numeric(8, 2) not null,
  serving_unit text not null,
  calories_snapshot numeric(8, 2) not null,
  protein_snapshot numeric(8, 2) not null,
  carbs_snapshot numeric(8, 2) not null,
  fat_snapshot numeric(8, 2) not null,
  created_at timestamptz not null default now(),

  -- Um item aponta para a base global ou para um alimento do usuário, nunca
  -- para os dois, e nunca para nenhum no momento do registro.
  constraint meal_items_single_origin check (
    (food_id is not null)::int + (user_food_id is not null)::int <= 1
  ),
  constraint meal_items_name_length check (char_length(btrim(name_snapshot)) between 1 and 160),
  constraint meal_items_unit_length check (char_length(btrim(serving_unit)) between 1 and 20),
  constraint meal_items_quantity_range check (quantity > 0 and quantity <= 10000),
  constraint meal_items_calories_range check (calories_snapshot >= 0 and calories_snapshot <= 20000),
  constraint meal_items_protein_range check (protein_snapshot >= 0 and protein_snapshot <= 2000),
  constraint meal_items_carbs_range check (carbs_snapshot >= 0 and carbs_snapshot <= 2000),
  constraint meal_items_fat_range check (fat_snapshot >= 0 and fat_snapshot <= 2000)
);

comment on table public.meal_items is
  'Itens de uma refeição. Os snapshots preservam o histórico mesmo se o alimento mudar ou for apagado (seção 69).';

create index meal_items_meal_id_idx on public.meal_items (meal_id);

-- ---------------------------------------------------------------------------
-- Row Level Security.
--
-- `foods` é global: leitura para qualquer autenticado, nenhuma escrita pelo
-- cliente. As demais seguem o isolamento por dono. `meal_items` não guarda
-- `user_id`; a posse é verificada pela refeição a que pertence.
-- ---------------------------------------------------------------------------

alter table public.foods enable row level security;
alter table public.user_foods enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;

create policy foods_select_authenticated on public.foods
  for select to authenticated using (true);

create policy user_foods_select_own on public.user_foods
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_foods_insert_own on public.user_foods
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_foods_update_own on public.user_foods
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_foods_delete_own on public.user_foods
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy meals_select_own on public.meals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy meals_insert_own on public.meals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy meals_update_own on public.meals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy meals_delete_own on public.meals
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy meal_items_select_own on public.meal_items
  for select to authenticated
  using (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = (select auth.uid())
    )
  );
create policy meal_items_insert_own on public.meal_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = (select auth.uid())
    )
  );
create policy meal_items_update_own on public.meal_items
  for update to authenticated
  using (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = (select auth.uid())
    )
  );
create policy meal_items_delete_own on public.meal_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = (select auth.uid())
    )
  );

-- Privilégios explícitos: nada de TRUNCATE/DELETE herdado (ver 0002).
revoke all on public.foods, public.user_foods, public.meals, public.meal_items
  from anon, authenticated;

grant select on public.foods to authenticated;
grant select, insert, update, delete on public.user_foods to authenticated;
grant select, insert, update, delete on public.meals to authenticated;
grant select, insert, update, delete on public.meal_items to authenticated;
