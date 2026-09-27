-- Inteiro revertido: não deixa usuários ou registros de teste.
begin;
create function pg_temp.assert_weight(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %',label; end if; raise notice 'ok: %',label; end $$;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at,raw_user_meta_data) values
('ca700001-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','weight-a@exemplo.test','x',now(),now(),'{}'),
('ca700002-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','weight-b@exemplo.test','x',now(),now(),'{}');

-- Colunas do backfill nunca devem admitir nulo em linha nova.
select pg_temp.assert_weight(
  (select attnotnull from pg_attribute where attrelid='public.weight_logs'::regclass and attname='recorded_date')
  and (select attnotnull from pg_attribute where attrelid='public.weight_logs'::regclass and attname='recorded_timezone'),
  'recorded_date e recorded_timezone sao NOT NULL apos a migration 0008'
);

set local role authenticated;
set local request.jwt.claims='{"sub":"ca700001-0000-4000-8000-000000000001","role":"authenticated"}';

insert into public.weight_logs(id,user_id,weight_kg,recorded_at,recorded_date,recorded_timezone) values
('da700001-0000-4000-8000-000000000001','ca700001-0000-4000-8000-000000000001',72.5,'2026-09-24T01:00:00Z','2026-09-23','America/Sao_Paulo'),
('da700002-0000-4000-8000-000000000002','ca700001-0000-4000-8000-000000000001',72.3,'2026-09-25T01:00:00Z','2026-09-24','America/Sao_Paulo');

-- Retry idempotente: o mesmo id não duplica.
insert into public.weight_logs(id,user_id,weight_kg,recorded_at,recorded_date,recorded_timezone) values
('da700001-0000-4000-8000-000000000001','ca700001-0000-4000-8000-000000000001',72.5,'2026-09-24T01:00:00Z','2026-09-23','America/Sao_Paulo') on conflict(id) do nothing;
select pg_temp.assert_weight((select count(*)=2 from public.weight_logs where user_id='ca700001-0000-4000-8000-000000000001'),'retry sem duplicar, 2 registros');

do $$ begin
  insert into public.weight_logs(user_id,weight_kg,recorded_at,recorded_date,recorded_timezone)
  values ('ca700002-0000-4000-8000-000000000002',70,now(),current_date,'UTC');
  raise exception 'FALHOU insert alheio';
exception when insufficient_privilege then raise notice 'ok: insert alheio negado'; end $$;

do $$ begin
  insert into public.weight_logs(user_id,weight_kg,recorded_at,recorded_date,recorded_timezone)
  values ('ca700001-0000-4000-8000-000000000001',24,now(),current_date,'UTC');
  raise exception 'FALHOU peso abaixo do minimo';
exception when check_violation then raise notice 'ok: peso abaixo de 25kg negado'; end $$;

do $$ begin
  insert into public.weight_logs(user_id,weight_kg,recorded_at,recorded_date,recorded_timezone)
  values ('ca700001-0000-4000-8000-000000000001',401,now(),current_date,'UTC');
  raise exception 'FALHOU peso acima do maximo';
exception when check_violation then raise notice 'ok: peso acima de 400kg negado'; end $$;

-- Dia local incoerente com o fuso informado: era exatamente o furo que a
-- migration 0008 fechou.
do $$ begin
  insert into public.weight_logs(user_id,weight_kg,recorded_at,recorded_date,recorded_timezone)
  values ('ca700001-0000-4000-8000-000000000001',72,'2026-09-24T01:00:00Z','2026-09-24','America/Sao_Paulo');
  raise exception 'FALHOU dia UTC incorreto';
exception when check_violation then raise notice 'ok: data incoerente com fuso negada'; end $$;

do $$ begin
  insert into public.weight_logs(user_id,weight_kg,recorded_at,recorded_date,recorded_timezone,notes)
  values ('ca700001-0000-4000-8000-000000000001',72,now(),current_date,'UTC',repeat('x',501));
  raise exception 'FALHOU observacao acima do limite';
exception when check_violation then raise notice 'ok: observacao acima de 500 caracteres negada'; end $$;

set local request.jwt.claims='{"sub":"ca700002-0000-4000-8000-000000000002","role":"authenticated"}';
select pg_temp.assert_weight((select count(*)=0 from public.weight_logs),'B nao enxerga peso de A');
with removed as (delete from public.weight_logs where id='da700001-0000-4000-8000-000000000001' returning id)
select pg_temp.assert_weight((select count(*)=0 from removed),'B nao apaga peso de A');

set local request.jwt.claims='{"sub":"ca700001-0000-4000-8000-000000000001","role":"authenticated"}';
delete from public.weight_logs where id='da700002-0000-4000-8000-000000000002';
select pg_temp.assert_weight((select count(*)=1 from public.weight_logs where user_id='ca700001-0000-4000-8000-000000000001'),'A remove o proprio registro');

reset role;
select pg_temp.assert_weight(
  not has_table_privilege('anon','public.weight_logs','SELECT')
  and not has_table_privilege('anon','public.weight_logs','INSERT'),
  'anon sem leitura/escrita'
);
select pg_temp.assert_weight(
  not has_table_privilege('authenticated','public.weight_logs','TRUNCATE'),
  'authenticated sem TRUNCATE (nao passa por RLS)'
);

rollback;
