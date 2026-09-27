-- Verificação de isolamento por RLS.
--
-- Cria dois usuários, assume a identidade de cada um como o papel
-- `authenticated` (o mesmo que o app usa) e confere que ninguém alcança a
-- linha do outro. Roda inteiro dentro de uma transação com ROLLBACK: nada
-- fica no banco.
--
--   psql -v ON_ERROR_STOP=1 -d "$SUPABASE_DB_URL_SESSION" -f scripts/rls-check.sql

begin;

\set ana  '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set bruno '''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'''

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values
  (:ana::uuid,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ana.rls@exemplo.test',  'x', now(), now(), '{"display_name":"Ana"}'::jsonb),
  (:bruno::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bruno.rls@exemplo.test', 'x', now(), now(), '{"display_name":"Bruno"}'::jsonb);

-- O trigger on_auth_user_created deve ter criado os dois perfis.
select 'perfis criados pelo trigger' as verificacao,
       count(*) = 2 as passou
from public.profiles where user_id in (:ana::uuid, :bruno::uuid);

insert into public.goals (user_id, goal_type, starting_weight_kg)
values (:ana::uuid, 'lose_weight', 80), (:bruno::uuid, 'gain_muscle', 70);

-- ---------------------------------------------------------------------------
-- A partir daqui tudo roda como a Ana, exatamente como o app autenticado.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select 'ana ve apenas o proprio perfil' as verificacao,
       count(*) = 1 and min(display_name) = 'Ana' as passou
from public.profiles;

select 'ana ve apenas o proprio objetivo' as verificacao,
       count(*) = 1 and min(goal_type::text) = 'lose_weight' as passou
from public.goals;

-- Tentar alterar a linha do Bruno não deve afetar nenhuma linha.
with tentativa as (
  update public.profiles set display_name = 'invadido'
  where user_id = :bruno::uuid
  returning 1
)
select 'ana nao consegue alterar o perfil do bruno' as verificacao,
       count(*) = 0 as passou
from tentativa;

-- Inserir uma linha em nome de outro usuário deve violar a política.
do $$
begin
  insert into public.weight_logs (user_id, weight_kg)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 99);
  raise exception 'FALHOU: insert em nome de outro usuario foi aceito';
exception
  when insufficient_privilege then
    raise notice 'ok: insert em nome de outro usuario foi bloqueado pela RLS';
end;
$$;

-- TRUNCATE ignora RLS; a defesa é a ausência do privilégio (migration 0002).
do $$
begin
  execute 'truncate table public.profiles';
  raise exception 'FALHOU: authenticated conseguiu truncar profiles';
exception
  when insufficient_privilege then
    raise notice 'ok: truncate negado por falta de privilegio';
end;
$$;

-- DELETE em profiles não tem política; nenhuma linha pode sair.
do $$
begin
  execute 'delete from public.profiles';
  raise exception 'FALHOU: authenticated conseguiu apagar perfis';
exception
  when insufficient_privilege then
    raise notice 'ok: delete em profiles negado por falta de privilegio';
end;
$$;

reset role;

-- Um índice parcial garante um único objetivo ativo por usuário.
do $$
begin
  insert into public.goals (user_id, goal_type)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'maintain_weight');
  raise exception 'FALHOU: segundo objetivo ativo foi aceito';
exception
  when unique_violation then
    raise notice 'ok: segundo objetivo ativo bloqueado pelo indice parcial';
end;
$$;

rollback;
