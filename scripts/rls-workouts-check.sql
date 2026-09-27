-- Verificação de isolamento por RLS das tabelas da Fase 8 (treino).
--
-- Cria dois usuários, assume a identidade de cada um como o papel
-- `authenticated` e confere isolamento em toda a cadeia — inclusive nas duas
-- tabelas com posse a dois saltos (workout_day_exercises, workout_sets).
-- Roda inteiro dentro de uma transação com ROLLBACK: nada fica no banco.
--
--   psql -v ON_ERROR_STOP=1 -d "$SUPABASE_DB_URL_SESSION" -f scripts/rls-workouts-check.sql

begin;

\set ana   '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set bruno '''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'''

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values
  (:ana::uuid,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ana.treino@exemplo.test',   'x', now(), now(), '{"display_name":"Ana"}'::jsonb),
  (:bruno::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bruno.treino@exemplo.test', 'x', now(), now(), '{"display_name":"Bruno"}'::jsonb);

-- Um exercício global, para provar que é legível e não gravável pelo cliente.
insert into public.exercises (id, name, primary_muscle)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Supino de teste', 'Peito');

insert into public.workout_plans (id, user_id, name)
values
  ('aaaa0001-1111-4111-8111-111111111111', :ana::uuid,   'Plano da Ana'),
  ('bbbb0001-2222-4222-8222-222222222222', :bruno::uuid, 'Plano do Bruno');

insert into public.workout_plan_days (id, plan_id, day_index, name, order_index)
values
  ('aaaa0002-1111-4111-8111-111111111111', 'aaaa0001-1111-4111-8111-111111111111', 1, 'Dia A da Ana', 0),
  ('bbbb0002-2222-4222-8222-222222222222', 'bbbb0001-2222-4222-8222-222222222222', 1, 'Dia A do Bruno', 0);

insert into public.workout_day_exercises
  (id, workout_day_id, exercise_id, name_snapshot, order_index, target_sets, min_reps, max_reps, rest_seconds)
values
  ('aaaa0003-1111-4111-8111-111111111111', 'aaaa0002-1111-4111-8111-111111111111',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Supino de teste', 0, 3, 8, 12, 90),
  ('bbbb0003-2222-4222-8222-222222222222', 'bbbb0002-2222-4222-8222-222222222222',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Supino de teste', 0, 3, 8, 12, 90);

insert into public.workout_sessions (id, user_id, workout_day_id, day_name_snapshot, status)
values
  ('aaaa0004-1111-4111-8111-111111111111', :ana::uuid,   'aaaa0002-1111-4111-8111-111111111111', 'Dia A da Ana',   'in_progress'),
  ('bbbb0004-2222-4222-8222-222222222222', :bruno::uuid, 'bbbb0002-2222-4222-8222-222222222222', 'Dia A do Bruno', 'in_progress');

insert into public.workout_session_exercises (id, session_id, exercise_id, name_snapshot, order_index)
values
  ('aaaa0005-1111-4111-8111-111111111111', 'aaaa0004-1111-4111-8111-111111111111',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Supino de teste', 0),
  ('bbbb0005-2222-4222-8222-222222222222', 'bbbb0004-2222-4222-8222-222222222222',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Supino de teste', 0);

insert into public.workout_sets (id, session_exercise_id, set_number, weight_kg, reps)
values
  ('aaaa0006-1111-4111-8111-111111111111', 'aaaa0005-1111-4111-8111-111111111111', 1, 60, 10),
  ('bbbb0006-2222-4222-8222-222222222222', 'bbbb0005-2222-4222-8222-222222222222', 1, 70, 8);

-- ---------------------------------------------------------------------------
-- A partir daqui tudo roda como a Ana, exatamente como o app autenticado.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select 'ana ve apenas o proprio plano' as verificacao,
       count(*) = 1 and min(name) = 'Plano da Ana' as passou
from public.workout_plans;

select 'ana ve apenas o proprio dia' as verificacao,
       count(*) = 1 as passou
from public.workout_plan_days;

select 'ana ve apenas o proprio exercicio-do-dia (dois saltos)' as verificacao,
       count(*) = 1 as passou
from public.workout_day_exercises;

select 'ana ve apenas a propria sessao' as verificacao,
       count(*) = 1 as passou
from public.workout_sessions;

select 'ana ve apenas o proprio exercicio-da-sessao' as verificacao,
       count(*) = 1 as passou
from public.workout_session_exercises;

select 'ana ve apenas a propria serie (dois saltos)' as verificacao,
       count(*) = 1 and min(reps) = 10 as passou
from public.workout_sets;

select 'catalogo global e legivel por qualquer autenticado' as verificacao,
       count(*) >= 1 as passou
from public.exercises;

-- Escrever no catálogo global precisa ser negado por falta de privilégio.
do $$
begin
  insert into public.exercises (name, primary_muscle) values ('Invencao', 'Nenhum');
  raise exception 'FALHOU: authenticated conseguiu inserir no catalogo global';
exception
  when insufficient_privilege then
    raise notice 'ok: insert em exercises negado por falta de privilegio';
end;
$$;

-- Inserir dia no plano do Bruno deve violar a política.
do $$
begin
  insert into public.workout_plan_days (plan_id, day_index, name, order_index)
  values ('bbbb0001-2222-4222-8222-222222222222', 2, 'Invasao', 1);
  raise exception 'FALHOU: dia inserido em plano alheio';
exception
  when insufficient_privilege then
    raise notice 'ok: insert em plano alheio bloqueado pela RLS';
end;
$$;

-- Inserir exercício-do-dia no dia do Bruno (dois saltos) deve violar a política.
do $$
begin
  insert into public.workout_day_exercises
    (workout_day_id, exercise_id, name_snapshot, order_index, target_sets, min_reps, max_reps, rest_seconds)
  values ('bbbb0002-2222-4222-8222-222222222222', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          'Invasao', 1, 3, 8, 12, 60);
  raise exception 'FALHOU: exercicio-do-dia inserido em dia alheio';
exception
  when insufficient_privilege then
    raise notice 'ok: insert em dia alheio bloqueado pela RLS (dois saltos)';
end;
$$;

-- Inserir série na sessão do Bruno (dois saltos) deve violar a política.
do $$
begin
  insert into public.workout_sets (session_exercise_id, set_number, reps)
  values ('bbbb0005-2222-4222-8222-222222222222', 2, 5);
  raise exception 'FALHOU: serie inserida em sessao alheia';
exception
  when insufficient_privilege then
    raise notice 'ok: insert em sessao alheia bloqueado pela RLS (dois saltos)';
end;
$$;

-- Apagar a série do Bruno não pode afetar nenhuma linha.
with tentativa as (
  delete from public.workout_sets
  where id = 'bbbb0006-2222-4222-8222-222222222222'
  returning 1
)
select 'ana nao consegue apagar serie do bruno' as verificacao,
       count(*) = 0 as passou
from tentativa;

-- TRUNCATE ignora RLS; a defesa é a ausência do privilégio (migration 0002).
do $$
declare
  alvo text;
begin
  foreach alvo in array array[
    'public.exercises', 'public.user_exercises', 'public.workout_plans',
    'public.workout_plan_days', 'public.workout_day_exercises',
    'public.workout_sessions', 'public.workout_session_exercises', 'public.workout_sets'
  ] loop
    begin
      execute 'truncate table ' || alvo;
      raise exception 'FALHOU: authenticated truncou %', alvo;
    exception
      when insufficient_privilege then
        raise notice 'ok: truncate negado em %', alvo;
    end;
  end loop;
end;
$$;

-- UPDATE em série registrada (histórico imutável) deve ser negado.
do $$
begin
  update public.workout_sets set reps = 99 where id = 'aaaa0006-1111-4111-8111-111111111111';
  raise exception 'FALHOU: update em serie registrada foi aceito';
exception
  when insufficient_privilege then
    raise notice 'ok: update em workout_sets negado (sem UPDATE concedido)';
end;
$$;

reset role;

-- Um segundo plano ativo para o mesmo usuário deve ser recusado.
do $$
begin
  insert into public.workout_plans (user_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'Segundo plano');
  raise exception 'FALHOU: segundo plano ativo foi aceito';
exception
  when unique_violation then
    raise notice 'ok: segundo plano ativo bloqueado pelo indice unico parcial';
end;
$$;

-- Exercício-do-dia com as duas origens ao mesmo tempo é incoerente.
do $$
begin
  insert into public.workout_day_exercises
    (workout_day_id, exercise_id, user_exercise_id, name_snapshot, order_index, target_sets, min_reps, max_reps, rest_seconds)
  values ('aaaa0002-1111-4111-8111-111111111111', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          gen_random_uuid(), 'Duas origens', 1, 3, 8, 12, 60);
  raise exception 'FALHOU: exercicio-do-dia com duas origens foi aceito';
exception
  when check_violation then
    raise notice 'ok: exercicio-do-dia com duas origens bloqueado pelo CHECK';
end;
$$;

-- Faixa de repetições invertida (min > max) é incoerente.
do $$
begin
  insert into public.workout_day_exercises
    (workout_day_id, exercise_id, name_snapshot, order_index, target_sets, min_reps, max_reps, rest_seconds)
  values ('aaaa0002-1111-4111-8111-111111111111', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          'Faixa invertida', 2, 3, 12, 8, 60);
  raise exception 'FALHOU: faixa de repeticoes invertida foi aceita';
exception
  when check_violation then
    raise notice 'ok: min_reps > max_reps bloqueado pelo CHECK';
end;
$$;

-- Apagar o exercício do catálogo preserva o histórico: a linha continua, sem
-- a referência, mas com o nome que já estava gravado (name_snapshot).
delete from public.exercises where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
select 'apagar exercicio preserva o exercicio-do-dia com o nome gravado' as verificacao,
       count(*) = 1 and bool_and(exercise_id is null) and min(name_snapshot) = 'Supino de teste' as passou
from public.workout_day_exercises
where workout_day_id = 'aaaa0002-1111-4111-8111-111111111111';

select 'apagar exercicio preserva a serie da sessao com o nome gravado' as verificacao,
       count(*) = 1 and bool_and(exercise_id is null) and min(name_snapshot) = 'Supino de teste' as passou
from public.workout_session_exercises
where session_id = 'aaaa0004-1111-4111-8111-111111111111';

rollback;
