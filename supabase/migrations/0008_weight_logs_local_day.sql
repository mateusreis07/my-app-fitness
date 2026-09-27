-- Fase 7: o dia do peso passa a ser gravado, não derivado no cliente.
--
-- `weight_logs` nasceu na Fase 2 sem `recorded_date`/`recorded_timezone`, que a
-- Fase 6 introduziu em `water_logs`. Sem eles, agrupar por dia depende de quem
-- está lendo, e a série do gráfico mudaria conforme o fuso do aparelho.
--
-- As colunas entram anuláveis, as linhas antigas são preenchidas com o fuso do
-- perfil do dono, e só então viram obrigatórias com o CHECK de coerência.
alter table public.weight_logs
  add column recorded_date date,
  add column recorded_timezone text;

-- Backfill: fuso do perfil, com o mesmo padrão usado como default em profiles.
update public.weight_logs w
set recorded_timezone = coalesce(p.timezone, 'America/Sao_Paulo')
from public.profiles p
where p.user_id = w.user_id and w.recorded_timezone is null;

-- Linha órfã de perfil não deve impedir a migration.
update public.weight_logs
set recorded_timezone = 'America/Sao_Paulo'
where recorded_timezone is null;

update public.weight_logs
set recorded_date = (recorded_at at time zone recorded_timezone)::date
where recorded_date is null;

alter table public.weight_logs
  alter column recorded_date set not null,
  alter column recorded_timezone set not null,
  add constraint weight_logs_local_date
    check (recorded_date = (recorded_at at time zone recorded_timezone)::date);

comment on column public.weight_logs.recorded_date is 'Dia no fuso do perfil no momento do registro; não é a data UTC e não muda ao viajar.';
comment on column public.weight_logs.recorded_timezone is 'Fuso usado para derivar recorded_date, preservado para auditoria.';
comment on column public.weight_logs.id is 'UUID criado no cliente por operação; repetir a mesma operação não duplica o registro.';

-- Série do gráfico: histórico por dia, do mais recente para trás.
create index weight_logs_user_day_id_idx on public.weight_logs(user_id, recorded_date desc, id);

-- RLS e privilégios já vieram completos da migration 0003; nada a alterar.
