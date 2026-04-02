create policy lojas_select_anon on public.lojas
for select to anon
using (true);
