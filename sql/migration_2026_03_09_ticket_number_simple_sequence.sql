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

update public.chamados
set numero_chamado = id::text
where numero_chamado is distinct from id::text;
