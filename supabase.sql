-- CAF ° — AXIA Energia
-- Execute no SQL Editor do Supabase.
-- O formulário aceita INSERT anônimo. Dashboard público recebe apenas agregados e notas,
-- nunca o texto livre. Não coloque a chave service_role no frontend.

create extension if not exists pgcrypto;

create table if not exists public.caf_respostas (
  id uuid primary key default gen_random_uuid(),
  atendimento smallint not null check (atendimento between 1 and 5),
  qualidade smallint not null check (qualidade between 1 and 5),
  comentario text null check (comentario is null or char_length(comentario) <= 1000),
  satisfacao smallint not null check (satisfacao between 1 and 5),
  criado_em timestamptz not null default now()
);

alter table public.caf_respostas enable row level security;

-- Remove políticas abertas antigas, se existirem.
drop policy if exists "caf_insert_anon" on public.caf_respostas;
drop policy if exists "caf_select_anon" on public.caf_respostas;

-- Permite envio anônimo somente das colunas públicas do formulário.
create policy "caf_insert_anon"
on public.caf_respostas
for insert
to anon
with check (
  atendimento between 1 and 5
  and qualidade between 1 and 5
  and satisfacao between 1 and 5
  and (comentario is null or char_length(comentario) <= 1000)
);

revoke all on table public.caf_respostas from anon, authenticated;
grant insert (atendimento, qualidade, comentario, satisfacao)
on table public.caf_respostas to anon;

-- RPCs públicas retornam somente métricas consolidadas / notas recentes.
-- SECURITY DEFINER é necessário porque RLS impede SELECT direto. O retorno é limitado.

create or replace function public.caf_dashboard_summary(p_from timestamptz default null)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'total', count(*),
    'hoje', count(*) filter (where (criado_em at time zone 'America/Recife')::date = (now() at time zone 'America/Recife')::date),
    'media_atendimento', round(avg(atendimento)::numeric, 2),
    'media_qualidade', round(avg(qualidade)::numeric, 2),
    'media_satisfacao', round(avg(satisfacao)::numeric, 2),
    'media_geral', round(((avg(atendimento) + avg(qualidade) + avg(satisfacao)) / 3)::numeric, 2),
    'percentual_satisfeitos', round((100.0 * count(*) filter (where satisfacao >= 4) / nullif(count(*), 0))::numeric, 1)
  )
  from public.caf_respostas
  where p_from is null or criado_em >= p_from;
$$;

create or replace function public.caf_daily_trend(p_from timestamptz default null)
returns table(dia date, media numeric, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select (criado_em at time zone 'America/Recife')::date as dia,
         round(((avg(atendimento) + avg(qualidade) + avg(satisfacao)) / 3)::numeric, 2) as media,
         count(*) as total
  from public.caf_respostas
  where p_from is null or criado_em >= p_from
  group by (criado_em at time zone 'America/Recife')::date
  order by dia;
$$;

create or replace function public.caf_recent_ratings(p_limit integer default 8, p_from timestamptz default null)
returns table(criado_em timestamptz, atendimento smallint, qualidade smallint, satisfacao smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.criado_em, r.atendimento, r.qualidade, r.satisfacao
  from public.caf_respostas r
  where p_from is null or r.criado_em >= p_from
  order by r.criado_em desc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function public.caf_dashboard_summary(timestamptz) from public;
revoke all on function public.caf_daily_trend(timestamptz) from public;
revoke all on function public.caf_recent_ratings(integer, timestamptz) from public;
grant execute on function public.caf_dashboard_summary(timestamptz) to anon, authenticated;
grant execute on function public.caf_daily_trend(timestamptz) to anon, authenticated;
grant execute on function public.caf_recent_ratings(integer, timestamptz) to anon, authenticated;

-- Realtime: habilite a publicação se ainda não estiver habilitada.
do $$
begin
  alter publication supabase_realtime add table public.caf_respostas;
exception
  when duplicate_object then null;
  when undefined_object then raise notice 'Crie/ative a publicação supabase_realtime no painel do Supabase.';
end $$;

-- IMPORTANTE:
-- Como o dashboard é público sem login, métricas e notas agregadas/individuais podem ser vistas
-- por qualquer pessoa que acesse o link. O comentário livre NÃO é retornado pelas RPCs.
-- Para dados internos ou comentários identificáveis, restrinja o dashboard com autenticação.
