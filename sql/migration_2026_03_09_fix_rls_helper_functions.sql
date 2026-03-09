create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.perfil = 'admin'
      and u.ativo = true
  );
$$;

create or replace function public.current_user_loja()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select u.loja_id
  from public.usuarios u
  where u.id = auth.uid();
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_user_loja() to authenticated;
