do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lojas'
      and policyname = 'lojas_select_anon'
  ) then
    create policy lojas_select_anon
    on public.lojas
    for select
    to anon
    using (true);
  end if;
end
$$;

grant select on public.lojas to anon;
