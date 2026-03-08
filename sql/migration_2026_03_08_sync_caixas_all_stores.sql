-- Sincroniza caixas/setores existentes para todas as lojas.
-- Mantém caixas como entidade vinculada a loja, mas garante cobertura global.

with modelos as (
  select distinct on (lower(nome), lower(coalesce(setor, '')))
    nome,
    setor,
    ativo
  from public.caixas
  order by lower(nome), lower(coalesce(setor, '')), ativo desc, id asc
)
insert into public.caixas (loja_id, nome, setor, ativo)
select
  l.id as loja_id,
  m.nome,
  m.setor,
  m.ativo
from public.lojas l
cross join modelos m
where not exists (
  select 1
  from public.caixas c
  where c.loja_id = l.id
    and lower(c.nome) = lower(m.nome)
    and lower(coalesce(c.setor, '')) = lower(coalesce(m.setor, ''))
);
