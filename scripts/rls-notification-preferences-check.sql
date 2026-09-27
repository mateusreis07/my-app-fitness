-- Verificação de isolamento por RLS de `notification_preferences` (Fase 10).
--
-- Cria dois usuários, assume a identidade de cada um como o papel
-- `authenticated` e confere isolamento e privilégios. Roda inteiro dentro de
-- uma transação com ROLLBACK: nada fica no banco.
--
--   psql -v ON_ERROR_STOP=1 -d "$SUPABASE_DB_URL_SESSION" -f scripts/rls-notification-preferences-check.sql

begin;

\set ana   '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set bruno '''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'''

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values
  (:ana::uuid,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ana.notif@exemplo.test',   'x', now(), now(), '{"display_name":"Ana"}'::jsonb),
  (:bruno::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bruno.notif@exemplo.test', 'x', now(), now(), '{"display_name":"Bruno"}'::jsonb);

-- ---------------------------------------------------------------------------
-- A partir daqui tudo roda como a Ana, exatamente como o app autenticado.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

insert into public.notification_preferences (user_id, water_enabled, reminder_time)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, true, '09:00');

select 'ana ve apenas a propria preferencia' as verificacao,
       count(*) = 1 and bool_and(water_enabled) as passou
from public.notification_preferences;

-- Inserir preferência em nome do Bruno deve violar a política.
do $$
begin
  insert into public.notification_preferences (user_id, workout_enabled)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, true);
  raise exception 'FALHOU: preferencia inserida em nome do bruno';
exception
  when insufficient_privilege then
    raise notice 'ok: insert em nome alheio bloqueado pela RLS';
end;
$$;

-- Atualizar a preferência do Bruno não pode afetar nenhuma linha (ele ainda
-- nem tem linha, mas a tentativa de update por posse tem que dar zero mesmo assim).
with tentativa as (
  update public.notification_preferences
  set summary_enabled = true
  where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
  returning 1
)
select 'ana nao consegue atualizar preferencia do bruno' as verificacao,
       count(*) = 0 as passou
from tentativa;

-- Um segundo registro para o mesmo usuário viola o unique(user_id).
do $$
begin
  insert into public.notification_preferences (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid);
  raise exception 'FALHOU: segunda linha de preferencia para o mesmo usuario foi aceita';
exception
  when unique_violation then
    raise notice 'ok: unique(user_id) bloqueou a segunda linha';
end;
$$;

-- TRUNCATE/DELETE ignoram RLS; a defesa é a ausência do privilégio (migration 0002).
do $$
begin
  execute 'truncate table public.notification_preferences';
  raise exception 'FALHOU: authenticated truncou notification_preferences';
exception
  when insufficient_privilege then
    raise notice 'ok: truncate negado em notification_preferences';
end;
$$;

do $$
begin
  delete from public.notification_preferences where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  raise exception 'FALHOU: authenticated apagou a propria preferencia (sem DELETE concedido)';
exception
  when insufficient_privilege then
    raise notice 'ok: delete negado (sem DELETE concedido)';
end;
$$;

reset role;

select 'anon nao enxerga nenhuma linha' as verificacao,
       not has_table_privilege('anon', 'public.notification_preferences', 'SELECT') as passou;

rollback;
