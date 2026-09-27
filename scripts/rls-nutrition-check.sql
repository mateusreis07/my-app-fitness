-- Verificação de isolamento por RLS das tabelas da Fase 5.
--
-- Cria dois usuários, assume a identidade de cada um como o papel
-- `authenticated` e confere que ninguém alcança o registro alimentar do outro.
-- Roda inteiro dentro de uma transação com ROLLBACK: nada fica no banco.
--
--   psql -v ON_ERROR_STOP=1 -d "$SUPABASE_DB_URL_SESSION" -f scripts/rls-nutrition-check.sql

begin;

\set ana   '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set bruno '''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'''

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values
  (:ana::uuid,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ana.nutri@exemplo.test',   'x', now(), now(), '{"display_name":"Ana"}'::jsonb),
  (:bruno::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bruno.nutri@exemplo.test', 'x', now(), now(), '{"display_name":"Bruno"}'::jsonb);

-- Um alimento na base global, para provar que é legível e não gravável.
insert into public.foods (id, name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g)
values ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Arroz oficial', 100, 'g', 130, 2.7, 28, 0.3);

insert into public.user_foods (id, user_id, name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g)
values
  ('11111111-1111-4111-8111-111111111111', :ana::uuid,   'Pao da Ana',   50, 'g', 140, 5, 26, 1),
  ('22222222-2222-4222-8222-222222222222', :bruno::uuid, 'Pao do Bruno', 50, 'g', 150, 6, 25, 2);

insert into public.meals (id, user_id, meal_type, meal_date)
values
  ('aaaa1111-1111-4111-8111-111111111111', :ana::uuid,   'lunch',  current_date),
  ('bbbb2222-2222-4222-8222-222222222222', :bruno::uuid, 'dinner', current_date);

insert into public.meal_items (meal_id, user_food_id, name_snapshot, quantity, serving_unit,
                               calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot)
values
  ('aaaa1111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
   'Pao da Ana', 100, 'g', 280, 10, 52, 2),
  ('bbbb2222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
   'Pao do Bruno', 100, 'g', 300, 12, 50, 4);

-- ---------------------------------------------------------------------------
-- A partir daqui tudo roda como a Ana, exatamente como o app autenticado.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select 'ana ve apenas o proprio alimento' as verificacao,
       count(*) = 1 and min(name) = 'Pao da Ana' as passou
from public.user_foods;

select 'ana ve apenas a propria refeicao' as verificacao,
       count(*) = 1 and min(meal_type::text) = 'lunch' as passou
from public.meals;

select 'ana ve apenas os proprios itens' as verificacao,
       count(*) = 1 and min(name_snapshot) = 'Pao da Ana' as passou
from public.meal_items;

select 'base global e legivel por qualquer autenticado' as verificacao,
       count(*) = 1 as passou
from public.foods;

-- Escrever na base global precisa ser negado por falta de privilégio.
do $$
begin
  insert into public.foods (name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g)
  values ('Invencao', 100, 'g', 1, 1, 1, 1);
  raise exception 'FALHOU: authenticated conseguiu inserir na base global';
exception
  when insufficient_privilege then
    raise notice 'ok: insert em foods negado por falta de privilegio';
end;
$$;

-- Inserir item na refeição do Bruno deve violar a política.
do $$
begin
  insert into public.meal_items (meal_id, name_snapshot, quantity, serving_unit,
                                 calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot)
  values ('bbbb2222-2222-4222-8222-222222222222', 'Invasao', 1, 'g', 1, 1, 1, 1);
  raise exception 'FALHOU: item inserido em refeicao alheia';
exception
  when insufficient_privilege then
    raise notice 'ok: insert em refeicao alheia bloqueado pela RLS';
end;
$$;

-- Apagar o item do Bruno não pode afetar nenhuma linha.
with tentativa as (
  delete from public.meal_items
  where meal_id = 'bbbb2222-2222-4222-8222-222222222222'
  returning 1
)
select 'ana nao consegue apagar item do bruno' as verificacao,
       count(*) = 0 as passou
from tentativa;

-- TRUNCATE ignora RLS; a defesa é a ausência do privilégio (migration 0002).
do $$
declare
  alvo text;
begin
  foreach alvo in array array['public.foods', 'public.user_foods', 'public.meals', 'public.meal_items'] loop
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

reset role;

-- Duas refeições do mesmo tipo no mesmo dia devem ser recusadas.
do $$
begin
  insert into public.meals (user_id, meal_type, meal_date)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'lunch', current_date);
  raise exception 'FALHOU: segunda refeicao do mesmo tipo no mesmo dia foi aceita';
exception
  when unique_violation then
    raise notice 'ok: refeicao duplicada bloqueada pelo indice unico';
end;
$$;

-- Item apontando para os dois tipos de alimento ao mesmo tempo é incoerente.
do $$
begin
  insert into public.meal_items (meal_id, food_id, user_food_id, name_snapshot, quantity,
                                 serving_unit, calories_snapshot, protein_snapshot,
                                 carbs_snapshot, fat_snapshot)
  values ('aaaa1111-1111-4111-8111-111111111111',
          'ffffffff-ffff-4fff-8fff-ffffffffffff',
          '11111111-1111-4111-8111-111111111111',
          'Duas origens', 1, 'g', 1, 1, 1, 1);
  raise exception 'FALHOU: item com duas origens foi aceito';
exception
  when check_violation then
    raise notice 'ok: item com duas origens bloqueado pelo CHECK';
end;
$$;

-- Apagar o alimento preserva o histórico: o item continua, sem a referência.
delete from public.user_foods where id = '11111111-1111-4111-8111-111111111111';
select 'apagar alimento preserva o item registrado' as verificacao,
       count(*) = 1 and bool_and(user_food_id is null) and min(name_snapshot) = 'Pao da Ana' as passou
from public.meal_items
where meal_id = 'aaaa1111-1111-4111-8111-111111111111';

rollback;
