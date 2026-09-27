-- KORA — Fase 1: autenticação e perfil base.
-- Referência de produto: KORA_MASTER_CONTEXT.md seções 61, 81, 82 e 106 (regra 10).
-- Toda tabela de usuário nasce com RLS e isolamento por auth.uid().

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums compartilhados. Valores internos em inglês; rótulos ficam no i18n.
-- ---------------------------------------------------------------------------

create type public.biological_sex as enum ('female', 'male', 'unspecified');

create type public.activity_level as enum (
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extremely_active'
);

create type public.fitness_experience as enum ('beginner', 'intermediate', 'advanced');

-- ---------------------------------------------------------------------------
-- Funções auxiliares.
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — um registro por usuário autenticado.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text,
  birth_date date,
  biological_sex public.biological_sex,
  height_cm smallint,
  activity_level public.activity_level,
  fitness_experience public.fitness_experience,
  country text,
  locale text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  -- Limites amplos de sanidade. A validação de idade mínima é regra de negócio
  -- e vive em src/features/onboarding, com teste próprio.
  constraint profiles_birth_date_range
    check (birth_date is null or birth_date between date '1900-01-01' and date '2100-01-01'),
  constraint profiles_height_range
    check (height_cm is null or height_cm between 80 and 260),
  constraint profiles_country_format
    check (country is null or country ~ '^[A-Z]{2}$'),
  constraint profiles_locale_format
    check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

comment on table public.profiles is 'Perfil base do usuário. Preenchido no cadastro e completado no onboarding.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Criação automática do perfil no cadastro.
-- SECURITY DEFINER porque o INSERT ocorre antes de existir uma sessão.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security. Sem política para DELETE: a exclusão de conta é um item
-- de LGPD (seção 84) e será feita por rotina de servidor em fase própria.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
