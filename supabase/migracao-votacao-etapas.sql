-- Migração aditiva da votação por etapas.
-- O código que está em produção antes do merge continua funcionando depois de rodar este arquivo.
-- Pode ser executado mais de uma vez.

-- 1) votos: etapa e marca de teste
alter table public.votos
  add column if not exists etapa smallint not null default 1 check (etapa between 1 and 3),
  add column if not exists teste boolean not null default false;

create index if not exists votos_etapa_ong_idx on public.votos (etapa, ong);
create index if not exists votos_ip_etapa_idx  on public.votos (ip_hash, etapa);

-- 2) etapas (datas e vencedoras editáveis pelo Table Editor)
create table if not exists public.etapas (
  numero smallint primary key check (numero between 1 and 3),
  inicio_em timestamptz,
  fim_em timestamptz,
  vencedoras text[] not null default '{}',
  constraint etapas_vencedoras_0_ou_2 check (cardinality(vencedoras) in (0, 2)),
  constraint etapas_periodo_valido check (fim_em is null or inicio_em is null or fim_em > inicio_em)
);

insert into public.etapas (numero) values (1), (2), (3) on conflict do nothing;

-- 3) tentativas erradas de senha da tela /acompanhar
create table if not exists public.acompanhar_tentativas (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  criado_em timestamptz not null default now()
);

create index if not exists acompanhar_tentativas_idx on public.acompanhar_tentativas (ip_hash, criado_em);

-- 4) contagem de votos por etapa (p_teste = true conta só os votos de teste)
create or replace function public.contagem_votos_etapa(p_etapa smallint, p_teste boolean default false)
returns table (ong text, total bigint)
language sql
security definer
set search_path = public
as $$
  select v.ong, count(*) from public.votos v
  where v.etapa = p_etapa and v.teste = p_teste
  group by v.ong;
$$;

-- 5) ranking para auditoria no Supabase (ignora votos de teste)
create or replace view public.ranking_votos with (security_invoker = on) as
select etapa, ong, count(*) as votos,
       round(100.0 * count(*) / sum(count(*)) over (partition by etapa), 1) as percentual
from public.votos
where not teste
group by etapa, ong
order by etapa, votos desc;

-- 6) segurança: RLS ligado e nada público
alter table public.etapas enable row level security;
alter table public.acompanhar_tentativas enable row level security;

revoke all on public.votos, public.etapas, public.acompanhar_tentativas, public.ranking_votos from anon, authenticated;
revoke all on function public.contagem_votos_etapa(smallint, boolean) from public, anon, authenticated;
grant execute on function public.contagem_votos_etapa(smallint, boolean) to service_role;
