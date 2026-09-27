-- KORA — Fase 1: correção de privilégios herdados.
--
-- O Supabase concede `all privileges` no schema public aos papéis anon e
-- authenticated por default privileges. Entre eles está TRUNCATE, que NÃO é
-- filtrado por Row Level Security: qualquer usuário logado poderia esvaziar a
-- tabela inteira mesmo com as políticas corretas. DELETE também é concedido,
-- e embora a ausência de política já o bloqueie, manter o privilégio é ruído.
--
-- Regra do projeto, válida para toda tabela nova: revogar tudo e conceder
-- apenas os verbos que existem como política de RLS.

revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

-- Futuras tabelas do schema public nascem sem privilégios automáticos. Cada
-- migration passa a declarar explicitamente o que concede.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
