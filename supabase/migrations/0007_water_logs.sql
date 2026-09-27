-- Fase 6: registros independentes da existência de meta automática.
create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_ml integer not null check (amount_ml between 1 and 5000),
  recorded_at timestamptz not null default now(),
  recorded_date date not null,
  recorded_timezone text not null,
  created_at timestamptz not null default now(),
  constraint water_logs_local_date check (recorded_date = (recorded_at at time zone recorded_timezone)::date)
);
comment on column public.water_logs.recorded_date is 'Dia no fuso do perfil no momento do registro; não é a data UTC e não muda ao viajar.';
comment on column public.water_logs.id is 'UUID criado no cliente por operação; repetir a mesma operação não duplica o registro.';
create index water_logs_user_recorded_at_idx on public.water_logs(user_id, recorded_at desc);
create index water_logs_user_day_id_idx on public.water_logs(user_id, recorded_date, id);
alter table public.water_logs enable row level security;
create policy water_logs_select_own on public.water_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy water_logs_insert_own on public.water_logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy water_logs_delete_own on public.water_logs for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.water_logs from anon, authenticated;
grant select, insert, delete on public.water_logs to authenticated;
