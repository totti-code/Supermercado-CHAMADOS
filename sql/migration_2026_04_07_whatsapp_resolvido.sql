alter table public.usuarios
add column if not exists telefone text;

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

create index if not exists idx_notificacoes_whatsapp_chamado on public.notificacoes_whatsapp(chamado_id);
create index if not exists idx_notificacoes_whatsapp_usuario on public.notificacoes_whatsapp(usuario_id);

alter table public.notificacoes_whatsapp enable row level security;

drop policy if exists notificacoes_whatsapp_select_access on public.notificacoes_whatsapp;
create policy notificacoes_whatsapp_select_access on public.notificacoes_whatsapp
for select to authenticated
using (
  public.is_admin()
  or usuario_id = auth.uid()
);

drop policy if exists notificacoes_whatsapp_insert_admin on public.notificacoes_whatsapp;
create policy notificacoes_whatsapp_insert_admin on public.notificacoes_whatsapp
for insert to authenticated
with check (public.is_admin());

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
