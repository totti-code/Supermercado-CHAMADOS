-- Habilitar extensões
create extension if not exists pgcrypto;

-- Enums
create type public.user_role as enum ('admin', 'funcionario');
create type public.ticket_priority as enum ('baixa', 'media', 'alta', 'critica');
create type public.ticket_status as enum ('aberto', 'em_andamento', 'aguardando_retorno', 'resolvido', 'fechado', 'cancelado');

-- Tabelas principais
create table if not exists public.lojas (
  id bigint generated always as identity primary key,
  nome text not null,
  codigo text not null unique,
  observacao text,
  endereco text,
  telefone text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.caixas (
  id bigint generated always as identity primary key,
  loja_id bigint not null references public.lojas(id) on delete cascade,
  nome text not null,
  setor text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tipos_chamado (
  id bigint generated always as identity primary key,
  nome text not null unique,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  telefone text not null,
  perfil public.user_role not null default 'funcionario',
  loja_id bigint references public.lojas(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chamados (
  id bigint generated always as identity primary key,
  numero_chamado text unique,
  loja_id bigint not null references public.lojas(id),
  caixa_id bigint not null references public.caixas(id),
  tipo_chamado_id bigint not null references public.tipos_chamado(id),
  usuario_id uuid not null references public.usuarios(id),
  titulo text not null,
  descricao text not null,
  prioridade public.ticket_priority not null default 'media',
  status public.ticket_status not null default 'aberto',
  anexo_url text,
  telefone_retorno text,
  responsavel_local text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.historico_chamados (
  id bigint generated always as identity primary key,
  chamado_id bigint not null references public.chamados(id) on delete cascade,
  usuario_id uuid references public.usuarios(id),
  acao text not null,
  descricao text,
  status_anterior public.ticket_status,
  status_novo public.ticket_status,
  created_at timestamptz not null default now()
);

create table if not exists public.notificacoes_whatsapp (
  id bigint generated always as identity primary key,
  chamado_id bigint not null references public.chamados(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  enviado_por uuid references public.usuarios(id) on delete set null,
  telefone text not null,
  mensagem text not null,
  status_chamado public.ticket_status not null,
  created_at timestamptz not null default now()
);

-- Índices
create index if not exists idx_caixas_loja_id on public.caixas(loja_id);
create index if not exists idx_chamados_loja on public.chamados(loja_id);
create index if not exists idx_chamados_caixa on public.chamados(caixa_id);
create index if not exists idx_chamados_tipo on public.chamados(tipo_chamado_id);
create index if not exists idx_chamados_usuario on public.chamados(usuario_id);
create index if not exists idx_chamados_status on public.chamados(status);
create index if not exists idx_chamados_prioridade on public.chamados(prioridade);
create index if not exists idx_chamados_created_at on public.chamados(created_at desc);
create index if not exists idx_historico_chamado on public.historico_chamados(chamado_id);
create index if not exists idx_notificacoes_whatsapp_chamado on public.notificacoes_whatsapp(chamado_id);
create index if not exists idx_notificacoes_whatsapp_usuario on public.notificacoes_whatsapp(usuario_id);
create unique index if not exists uq_lojas_codigo_lower on public.lojas(lower(codigo));
create unique index if not exists uq_tipos_nome_lower on public.tipos_chamado(lower(nome));

-- Funções auxiliares
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_chamados_updated_at on public.chamados;
create trigger trg_chamados_updated_at
before update on public.chamados
for each row execute function public.set_updated_at();

create or replace function public.generate_ticket_number()
returns trigger
language plpgsql
as $$
begin
  if new.numero_chamado is null or new.numero_chamado = '' then
    new.numero_chamado := new.id::text;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_generate_ticket_number on public.chamados;
create trigger trg_generate_ticket_number
before insert on public.chamados
for each row execute function public.generate_ticket_number();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.perfil = 'admin' and u.ativo = true
  );
$$;

create or replace function public.current_user_loja()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select u.loja_id from public.usuarios u where u.id = auth.uid();
$$;

create or replace function public.get_global_open_ticket_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.chamados c
  where c.status = 'aberto';
$$;

create or replace function public.get_my_open_ticket_queue_positions()
returns table (ticket_id bigint, queue_position bigint)
language sql
stable
security definer
set search_path = public
as $$
  with ordered_queue as (
    select
      c.id as ticket_id,
      c.usuario_id,
      row_number() over (order by c.created_at asc, c.id asc) as queue_position
    from public.chamados c
    where c.status = 'aberto'
  )
  select oq.ticket_id, oq.queue_position
  from ordered_queue oq
  where oq.usuario_id = auth.uid();
$$;

create or replace function public.log_chamado_update()
returns trigger
language plpgsql
security definer
as $$
declare
  v_user uuid;
begin
  v_user := auth.uid();

  if tg_op = 'INSERT' then
    insert into public.historico_chamados (chamado_id, usuario_id, acao, descricao, status_novo)
    values (new.id, v_user, 'chamado_criado', 'Chamado criado no sistema', new.status);
    return new;
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      insert into public.historico_chamados (chamado_id, usuario_id, acao, descricao, status_anterior, status_novo)
      values (
        new.id,
        v_user,
        'status_alterado',
        'Status alterado de ' || old.status || ' para ' || new.status,
        old.status,
        new.status
      );
    end if;
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_log_chamado_insert on public.chamados;
create trigger trg_log_chamado_insert
after insert on public.chamados
for each row execute function public.log_chamado_update();

drop trigger if exists trg_log_chamado_update on public.chamados;
create trigger trg_log_chamado_update
after update on public.chamados
for each row execute function public.log_chamado_update();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.usuarios (id, nome, email, telefone, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    regexp_replace(coalesce(new.raw_user_meta_data->>'telefone', ''), '\D', '', 'g'),
    coalesce((new.raw_user_meta_data->>'perfil')::public.user_role, 'funcionario')
  )
  on conflict (id) do update set
    nome = excluded.nome,
    email = excluded.email,
    telefone = excluded.telefone;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.validate_chamado_consistency()
returns trigger
language plpgsql
as $$
declare
  v_store bigint;
  v_type_active boolean;
begin
  select loja_id into v_store from public.caixas where id = new.caixa_id and ativo = true;
  if v_store is null then
    raise exception 'Caixa invalido/inativo';
  end if;

  if v_store <> new.loja_id then
    raise exception 'Caixa nao pertence a loja selecionada';
  end if;

  select ativo into v_type_active from public.tipos_chamado where id = new.tipo_chamado_id;
  if coalesce(v_type_active, false) = false then
    raise exception 'Tipo de chamado inativo ou inexistente';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_chamado on public.chamados;
create trigger trg_validate_chamado
before insert or update on public.chamados
for each row execute function public.validate_chamado_consistency();

create or replace function public.add_ticket_observation(p_chamado_id bigint, p_texto text)
returns void
language plpgsql
security definer
as $$
declare
  v_allowed boolean;
begin
  select exists (
    select 1 from public.chamados c
    join public.usuarios u on u.id = auth.uid()
    where c.id = p_chamado_id
      and (
        u.perfil = 'admin'
        or c.usuario_id = auth.uid()
        or (u.loja_id is not null and c.loja_id = u.loja_id)
      )
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Sem permissao para adicionar observacao neste chamado';
  end if;

  insert into public.historico_chamados (chamado_id, usuario_id, acao, descricao)
  values (p_chamado_id, auth.uid(), 'observacao', p_texto);
end;
$$;

-- RLS
alter table public.lojas enable row level security;
alter table public.caixas enable row level security;
alter table public.tipos_chamado enable row level security;
alter table public.usuarios enable row level security;
alter table public.chamados enable row level security;
alter table public.historico_chamados enable row level security;
alter table public.notificacoes_whatsapp enable row level security;

-- Limpeza policies antigas
DO $$
DECLARE p record;
BEGIN
  FOR p IN select policyname, tablename from pg_policies where schemaname='public' LOOP
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- Lojas, caixas, tipos: leitura para autenticados; escrita admin
create policy lojas_select_auth on public.lojas
for select to authenticated
using (ativo = true or public.is_admin());

create policy lojas_select_anon on public.lojas
for select to anon
using (true);

create policy lojas_admin_all on public.lojas
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy caixas_select_auth on public.caixas
for select to authenticated
using (
  public.is_admin()
  or (
    ativo = true and (
      public.current_user_loja() is null
      or loja_id = public.current_user_loja()
    )
  )
);

create policy caixas_admin_all on public.caixas
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy tipos_select_auth on public.tipos_chamado
for select to authenticated
using (ativo = true or public.is_admin());

create policy tipos_admin_all on public.tipos_chamado
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Usuarios
create policy usuarios_select_self_or_admin on public.usuarios
for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy usuarios_update_self_or_admin on public.usuarios
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy usuarios_admin_insert on public.usuarios
for insert to authenticated
with check (public.is_admin());

-- Chamados
create policy chamados_select_access on public.chamados
for select to authenticated
using (
  public.is_admin()
  or usuario_id = auth.uid()
  or loja_id = public.current_user_loja()
);

create policy chamados_insert_auth on public.chamados
for insert to authenticated
with check (
  usuario_id = auth.uid()
  and (
    public.is_admin()
    or loja_id = public.current_user_loja()
    or public.current_user_loja() is null
  )
);

create policy chamados_update_access on public.chamados
for update to authenticated
using (
  public.is_admin()
  or usuario_id = auth.uid()
)
with check (
  public.is_admin()
  or usuario_id = auth.uid()
);

create policy chamados_delete_admin on public.chamados
for delete to authenticated
using (public.is_admin());

-- Historico
create policy historico_select_access on public.historico_chamados
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.chamados c
    where c.id = historico_chamados.chamado_id
      and (
        c.usuario_id = auth.uid()
        or c.loja_id = public.current_user_loja()
      )
  )
);

create policy historico_insert_access on public.historico_chamados
for insert to authenticated
with check (
  public.is_admin()
  or usuario_id = auth.uid()
);

create policy notificacoes_whatsapp_select_access on public.notificacoes_whatsapp
for select to authenticated
using (
  public.is_admin()
  or usuario_id = auth.uid()
);

create policy notificacoes_whatsapp_insert_admin on public.notificacoes_whatsapp
for insert to authenticated
with check (public.is_admin());

-- Seed inicial das 7 lojas
insert into public.lojas (nome, codigo)
values
  ('Loja 1', 'LJ001'),
  ('Loja 2', 'LJ002'),
  ('Loja 3', 'LJ003'),
  ('Loja 4', 'LJ004'),
  ('Loja 5', 'LJ005'),
  ('Loja 6', 'LJ006'),
  ('Loja 7', 'LJ007')
on conflict (codigo) do nothing;

-- Seed tipos padrão
insert into public.tipos_chamado (nome, descricao)
values
  ('Rede', 'Problemas de conectividade de rede'),
  ('Balança', 'Falha em balanças de pesagem'),
  ('Impressora', 'Falha de impressão ou spooler'),
  ('Caixa', 'Problemas no PDV/caixa'),
  ('Sistema', 'Erro no sistema de gestão'),
  ('Leitor de código de barras', 'Falha no scanner'),
  ('Pinpad', 'Falha em terminal de pagamento'),
  ('Computador', 'Falha de hardware/software'),
  ('Monitor', 'Falha de vídeo/tela'),
  ('Nobreak', 'Problemas de energia/backup'),
  ('Internet', 'Queda ou lentidão de internet'),
  ('Outros', 'Outros chamados técnicos')
on conflict (nome) do nothing;

-- Seed de caixas por loja
insert into public.caixas (loja_id, nome, setor)
select l.id, c.nome, c.setor
from public.lojas l
cross join (
  values
    ('Caixa 01', 'Frente de loja'),
    ('Caixa 02', 'Frente de loja'),
    ('Caixa 03', 'Frente de loja'),
    ('Balcão', 'Atendimento'),
    ('Açougue', 'Açougue'),
    ('Padaria', 'Padaria'),
    ('Hortifruti', 'Hortifruti'),
    ('Recebimento', 'Estoque')
) as c(nome, setor)
where not exists (
  select 1 from public.caixas cx where cx.loja_id = l.id and cx.nome = c.nome
);
