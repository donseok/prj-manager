-- 담당자별 주간보고 작성 테이블
create table if not exists public.weekly_member_reports (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  member_id text not null references public.project_members (id) on delete cascade,
  week_start date not null,
  this_week_result text not null default '',
  next_week_plan text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, member_id, week_start)
);

-- 테이블 접근 권한
grant select, insert, update, delete on public.weekly_member_reports to anon, authenticated, service_role;

-- 인덱스
create index if not exists idx_wmr_project_week on public.weekly_member_reports (project_id, week_start);
create index if not exists idx_wmr_member on public.weekly_member_reports (member_id);

-- RLS 활성화
alter table public.weekly_member_reports enable row level security;

-- RLS 정책: 프로젝트 멤버만 조회 가능
create policy "wmr_select" on public.weekly_member_reports
  for select to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = weekly_member_reports.project_id
        and pm.user_id = auth.uid()
    )
    or is_admin()
  );

-- RLS 정책: owner/admin은 모든 보고 관리, member는 본인만
create policy "wmr_insert" on public.weekly_member_reports
  for insert to authenticated
  with check (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = weekly_member_reports.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = weekly_member_reports.project_id
        and pm.user_id = auth.uid()
        and pm.id = weekly_member_reports.member_id
    )
    or is_admin()
  );

create policy "wmr_update" on public.weekly_member_reports
  for update to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = weekly_member_reports.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = weekly_member_reports.project_id
        and pm.user_id = auth.uid()
        and pm.id = weekly_member_reports.member_id
    )
    or is_admin()
  );

create policy "wmr_delete" on public.weekly_member_reports
  for delete to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = weekly_member_reports.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
    or is_admin()
  );

-- updated_at 자동 갱신
create trigger touch_wmr_updated_at
  before update on public.weekly_member_reports
  for each row
  execute function touch_updated_at();
