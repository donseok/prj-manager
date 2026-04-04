-- 담당자별 주간보고 메모 테이블
create table if not exists public.member_weekly_notes (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  member_id text not null,
  member_name text not null,
  week_start date not null,
  this_week_achievements text not null default '',
  next_week_plans text not null default '',
  updated_at timestamptz not null default timezone('utc', now())
);

-- 인덱스
create index if not exists idx_member_weekly_notes_project_week
  on public.member_weekly_notes (project_id, week_start);
create unique index if not exists idx_member_weekly_notes_unique
  on public.member_weekly_notes (project_id, member_id, week_start);

-- RLS
alter table public.member_weekly_notes enable row level security;

create policy "member_weekly_notes_select" on public.member_weekly_notes
  for select to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = member_weekly_notes.project_id
      and pm.user_id = auth.uid()
    ) or is_admin()
  );

create policy "member_weekly_notes_insert" on public.member_weekly_notes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = member_weekly_notes.project_id
      and pm.user_id = auth.uid()
    ) or is_admin()
  );

create policy "member_weekly_notes_update" on public.member_weekly_notes
  for update to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = member_weekly_notes.project_id
      and pm.user_id = auth.uid()
    ) or is_admin()
  );

create policy "member_weekly_notes_delete" on public.member_weekly_notes
  for delete to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = member_weekly_notes.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'admin')
    ) or is_admin()
  );
