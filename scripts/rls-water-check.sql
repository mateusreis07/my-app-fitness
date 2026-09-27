-- Inteiro revertido: não deixa usuários ou registros de teste.
begin;
create function pg_temp.assert_water(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %',label; end if; raise notice 'ok: %',label; end $$;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at,raw_user_meta_data) values
('ca600001-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','water-a@exemplo.test','x',now(),now(),'{}'),
('ca600002-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','water-b@exemplo.test','x',now(),now(),'{}');
select pg_temp.assert_water(not has_table_privilege('anon','public.water_logs','SELECT') and not has_table_privilege('anon','public.water_logs','INSERT'),'anon sem leitura/escrita');
select pg_temp.assert_water(not has_table_privilege('authenticated','public.water_logs','UPDATE') and not has_table_privilege('authenticated','public.water_logs','TRUNCATE'),'sem UPDATE/TRUNCATE');
set local role authenticated;
set local request.jwt.claims='{"sub":"ca600001-0000-4000-8000-000000000001","role":"authenticated"}';
insert into public.water_logs(id,user_id,amount_ml,recorded_at,recorded_date,recorded_timezone) values
('da600001-0000-4000-8000-000000000001','ca600001-0000-4000-8000-000000000001',250,'2026-09-24T01:00:00Z','2026-09-23','America/Sao_Paulo'),
('da600002-0000-4000-8000-000000000002','ca600001-0000-4000-8000-000000000001',500,'2026-09-24T01:05:00Z','2026-09-23','America/Sao_Paulo');
insert into public.water_logs(id,user_id,amount_ml,recorded_at,recorded_date,recorded_timezone) values
('da600001-0000-4000-8000-000000000001','ca600001-0000-4000-8000-000000000001',250,'2026-09-24T01:00:00Z','2026-09-23','America/Sao_Paulo') on conflict(id) do nothing;
select pg_temp.assert_water((select count(*)=2 and sum(amount_ml)=750 from public.water_logs),'retry sem duplicar, total 750 e dia local');
do $$ begin
  insert into public.water_logs(user_id,amount_ml,recorded_at,recorded_date,recorded_timezone) values ('ca600002-0000-4000-8000-000000000002',250,now(),current_date,'UTC');
  raise exception 'FALHOU insert alheio';
exception when insufficient_privilege then raise notice 'ok: insert alheio negado'; end $$;
do $$ begin
  insert into public.water_logs(user_id,amount_ml,recorded_at,recorded_date,recorded_timezone) values ('ca600001-0000-4000-8000-000000000001',0,now(),current_date,'UTC');
  raise exception 'FALHOU quantidade zero';
exception when check_violation then raise notice 'ok: quantidade zero negada'; end $$;
do $$ begin
  insert into public.water_logs(user_id,amount_ml,recorded_at,recorded_date,recorded_timezone) values ('ca600001-0000-4000-8000-000000000001',5001,now(),current_date,'UTC');
  raise exception 'FALHOU quantidade excessiva';
exception when check_violation then raise notice 'ok: quantidade acima do limite negada'; end $$;
do $$ begin
  insert into public.water_logs(user_id,amount_ml,recorded_at,recorded_date,recorded_timezone) values ('ca600001-0000-4000-8000-000000000001',250,'2026-09-24T01:00:00Z','2026-09-24','America/Sao_Paulo');
  raise exception 'FALHOU dia UTC incorreto';
exception when check_violation then raise notice 'ok: data incoerente com fuso negada'; end $$;
set local request.jwt.claims='{"sub":"ca600002-0000-4000-8000-000000000002","role":"authenticated"}';
select pg_temp.assert_water((select count(*)=0 from public.water_logs),'B nao enxerga agua de A');
with removed as (delete from public.water_logs where id='da600001-0000-4000-8000-000000000001' returning id)
select pg_temp.assert_water((select count(*)=0 from removed),'B nao apaga agua de A');
set local request.jwt.claims='{"sub":"ca600001-0000-4000-8000-000000000001","role":"authenticated"}';
delete from public.water_logs where id='da600002-0000-4000-8000-000000000002';
select pg_temp.assert_water((select count(*)=1 and sum(amount_ml)=250 from public.water_logs),'A remove proprio registro e total cai');
rollback;
