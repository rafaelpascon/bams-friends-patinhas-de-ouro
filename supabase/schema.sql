create table if not exists public.votos (
  id bigint generated always as identity primary key,
  ong text not null,
  ip_hash text not null,
  criado_em timestamptz not null default now()
);

create index if not exists votos_ip_hash_idx on public.votos (ip_hash);

alter table public.votos enable row level security;

create or replace function public.contagem_votos()
returns table (ong text, total bigint)
language sql
security definer
set search_path = public
as $$
  select v.ong, count(*) from public.votos v group by v.ong;
$$;

revoke all on function public.contagem_votos() from public, anon, authenticated;
grant execute on function public.contagem_votos() to service_role;
