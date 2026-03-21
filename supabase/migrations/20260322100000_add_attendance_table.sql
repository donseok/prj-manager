-- 근태현황 테이블
create table if not exists public.attendance (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  member_id text not null references public.project_members (id) on delete cascade,
  date date not null,
  type varchar(30) not null check (type in ('present', 'annual_leave', 'half_day_am', 'half_day_pm', 'sick_leave', 'business_trip', 'late', 'early_leave', 'absence')),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 테이블 접근 권한
grant select, insert, update, delete on public.attendance to anon, authenticated, service_role;

create index if not exists idx_attendance_project_id on public.attendance (project_id);
create index if not exists idx_attendance_member_id on public.attendance (member_id);
create index if not exists idx_attendance_date on public.attendance (date);
create index if not exists idx_attendance_project_date on public.attendance (project_id, date);

-- RLS 활성화
alter table public.attendance enable row level security;

-- RLS 정책: 프로젝트 멤버만 조회 가능
create policy "attendance_select" on public.attendance
  for select to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = attendance.project_id
        and pm.user_id = auth.uid()
    )
    or is_admin()
  );

-- RLS 정책: owner/admin은 모든 근태 관리, member는 본인만
create policy "attendance_insert" on public.attendance
  for insert to authenticated
  with check (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = attendance.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = attendance.project_id
        and pm.user_id = auth.uid()
        and pm.id = attendance.member_id
    )
    or is_admin()
  );

create policy "attendance_update" on public.attendance
  for update to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = attendance.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = attendance.project_id
        and pm.user_id = auth.uid()
        and pm.id = attendance.member_id
    )
    or is_admin()
  );

create policy "attendance_delete" on public.attendance
  for delete to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = attendance.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
    or is_admin()
  );

-- updated_at 자동 갱신
create trigger touch_attendance_updated_at
  before update on public.attendance
  for each row
  execute function touch_updated_at();
