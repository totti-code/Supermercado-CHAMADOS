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

grant execute on function public.get_global_open_ticket_count() to authenticated;
grant execute on function public.get_my_open_ticket_queue_positions() to authenticated;
