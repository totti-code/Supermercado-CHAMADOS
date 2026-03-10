drop policy if exists chamados_delete_admin on public.chamados;

create policy chamados_delete_admin on public.chamados
for delete to authenticated
using (public.is_admin());
