alter table public.tasks
  add column if not exists duration_days integer,
  add column if not exists predecessor_ids uuid[] default '{}'::uuid[],
  add column if not exists task_source varchar(20) default 'manual';

alter table public.tasks drop constraint if exists tasks_task_source_check;

alter table public.tasks
  add constraint tasks_task_source_check
  check (task_source in ('manual', 'template', 'quick_draft', 'imported', 'cloned'));
