-- Função para automaticamente mover tarefas vencidas do backlog para todo
-- SECURITY INVOKER: executa com privilégios do usuário chamador, respeitando RLS
-- (não precisa de SECURITY DEFINER porque já tem filtro por auth.uid())
create or replace function public.auto_triage_tasks()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.tasks
  set status = 'todo', updated_at = now()
  where status = 'backlog'
    and due_date <= current_date
    and archived = false
    and user_id = auth.uid();
end;
$$;