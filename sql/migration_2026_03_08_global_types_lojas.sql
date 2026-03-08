-- Migração para bases já existentes
-- Objetivo:
-- 1) Tipos de chamado globais (sem loja_id)
-- 2) Observação opcional em lojas
-- 3) Evitar duplicidade por variação de caixa (maiúscula/minúscula)

alter table if exists public.lojas
  add column if not exists observacao text;

alter table if exists public.tipos_chamado
  drop column if exists loja_id;

create unique index if not exists uq_lojas_codigo_lower
  on public.lojas (lower(codigo));

create unique index if not exists uq_tipos_nome_lower
  on public.tipos_chamado (lower(nome));
