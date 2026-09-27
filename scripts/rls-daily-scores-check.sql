-- Verificação de isolamento por RLS de `daily_scores` (Fase 9).
--
-- Cria dois usuários, assume a identidade de cada um como o papel
-- `authenticated` e confere isolamento, faixa dos componentes e a chave
-- natural única. Roda inteiro dentro de uma transação com ROLLBACK: nada
-- fica no banco.
--
--   psql -v ON_ERROR_STOP=1 -d "$SUPABASE_DB_URL_SESSION" -f scripts/rls-daily-scores-check.sql

begin;

\set ana   '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set bruno '''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'''

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values
  (:ana::uuid,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ana.score@exemplo.test',   'x', now(), now(), '{"display_name":"Ana"}'::jsonb),
  (:bruno::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bruno.score@exemplo.test', 'x', now(), now(), '{"display_name":"Bruno"}'::jsonb);

insert into public.daily_scores
  (user_id, score_date, nutrition_score, protein_score, hydration_score, workout_score, consistency_score, total_score, algorithm_version)
values
  (:ana::uuid,   '2026-06-01', 90, 80, 70, 100, 67, 84, 'kora_score@1.0'),
  (:bruno::uuid, '2026-06-01', 50, 40, 30, 100, 33, 49, 'kora_score@1.0');

-- ---------------------------------------------------------------------------
-- A partir daqui tudo roda como a Ana, exatamente como o app autenticado.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select 'ana ve apenas o proprio score' as verificacao,
       count(*) = 1 and min(total_score) = 84 as passou
from public.daily_scores;

-- Inserir score em nome do Bruno deve violar a política.
do $$
begin
  insert into public.daily_scores
    (user_id, score_date, workout_score, consistency_score, algorithm_version)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, '2026-06-02', 100, 0, 'kora_score@1.0');
  raise exception 'FALHOU: score inserido em nome do bruno';
exception
  when insufficient_privilege then
    raise notice 'ok: insert em nome alheio bloqueado pela RLS';
end;
$$;

-- Atualizar o score do Bruno não pode afetar nenhuma linha.
with tentativa as (
  update public.daily_scores
  set total_score = 0
  where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
  returning 1
)
select 'ana nao consegue atualizar score do bruno' as verificacao,
       count(*) = 0 as passou
from tentativa;

-- Componente fora da faixa de 0 a 100 é incoerente.
do $$
begin
  insert into public.daily_scores
    (user_id, score_date, workout_score, consistency_score, algorithm_version)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, '2026-06-03', 150, 0, 'kora_score@1.0');
  raise exception 'FALHOU: workout_score de 150 foi aceito';
exception
  when check_violation then
    raise notice 'ok: componente fora de 0-100 bloqueado pelo CHECK';
end;
$$;

-- TRUNCATE/DELETE ignoram RLS; a defesa é a ausência do privilégio (migration 0002).
do $$
begin
  execute 'truncate table public.daily_scores';
  raise exception 'FALHOU: authenticated truncou daily_scores';
exception
  when insufficient_privilege then
    raise notice 'ok: truncate negado em daily_scores';
end;
$$;

do $$
begin
  delete from public.daily_scores where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  raise exception 'FALHOU: authenticated apagou o proprio score (sem DELETE concedido)';
exception
  when insufficient_privilege then
    raise notice 'ok: delete negado em daily_scores (sem DELETE concedido)';
end;
$$;

reset role;

-- Um segundo fechamento do mesmo dia para o mesmo usuário deve ser recusado
-- pela chave natural, não silenciosamente duplicado.
do $$
begin
  insert into public.daily_scores
    (user_id, score_date, workout_score, consistency_score, algorithm_version)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, '2026-06-01', 100, 0, 'kora_score@1.0');
  raise exception 'FALHOU: segundo fechamento do mesmo dia foi aceito';
exception
  when unique_violation then
    raise notice 'ok: unique(user_id, score_date) bloqueou o segundo fechamento';
end;
$$;

select 'anon nao enxerga nenhuma linha' as verificacao,
       not has_table_privilege('anon', 'public.daily_scores', 'SELECT') as passou;

rollback;
