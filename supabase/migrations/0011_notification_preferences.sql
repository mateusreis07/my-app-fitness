-- KORA — Fase 10: notificações.
-- Referência de produto: KORA_MASTER_CONTEXT.md seções 44 (descanso), 54
-- (notificações), 102 (MVP), 121 (tom) e 122 (evitar punição/vergonha).
--
-- Decisões documentadas (seção 133 — não decidir em silêncio, ver docs/PHASE_10.md):
--  * As quatro notificações nascem desativadas (`default false`) — decisão do
--    responsável. O usuário ativa o que quiser; nada é agendado sem
--    consentimento explícito.
--  * Duas preferências de horário, não quatro: `reminder_time` cobre
--    água/treino/peso ("ainda dá tempo hoje"), `summary_time` cobre o resumo
--    ("o dia já foi"). A seção 54 só pede "configurável", sem exigir um
--    horário por tipo.
--  * Sem tabela de "notificações agendadas": o agendamento em si vive no
--    dispositivo (expo-notifications), recalculado a cada abertura do app.
--    Esta tabela guarda só a preferência, não o estado do agendamento.

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  water_enabled boolean not null default false,
  workout_enabled boolean not null default false,
  weight_enabled boolean not null default false,
  summary_enabled boolean not null default false,
  reminder_time time not null default '15:00',
  summary_time time not null default '21:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.notification_preferences is
  'Preferência de notificação local por usuário. O agendamento em si vive no dispositivo, não aqui.';

alter table public.notification_preferences enable row level security;

create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Privilégios explícitos: nada de TRUNCATE/DELETE herdado (ver 0002).
revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
