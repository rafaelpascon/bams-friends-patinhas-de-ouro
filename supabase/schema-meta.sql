create table public.meta_arrecadacao (
  id boolean primary key default true,
  arrecadado numeric(12,2) not null default 0,
  meta numeric(12,2) not null default 15000,
  atualizado_em timestamptz not null default now(),
  constraint meta_arrecadacao_singleton check (id)
);

insert into public.meta_arrecadacao (id, arrecadado, meta) values (true, 0, 15000);

create or replace function public.meta_arrecadacao_toca_atualizado()
returns trigger
language plpgsql
as $$
begin
  if new.arrecadado is distinct from old.arrecadado then
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

create trigger meta_arrecadacao_atualiza
before update on public.meta_arrecadacao
for each row execute function public.meta_arrecadacao_toca_atualizado();

alter table public.meta_arrecadacao enable row level security;
-- Sem policy: só a service_role (usada pela Vercel Function) enxerga a linha.
