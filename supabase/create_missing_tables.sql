-- ============================================================
-- DK Flow: 누락 테이블 일괄 생성 스크립트
-- Supabase SQL Editor에서 실행하세요.
-- 이미 존재하는 테이블/인덱스/정책은 건너뜁니다.
-- ============================================================

-- ─── 1. member_weekly_notes ─────────────────────────────────

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

create index if not exists idx_member_weekly_notes_project_week
  on public.member_weekly_notes (project_id, week_start);

create unique index if not exists idx_member_weekly_notes_unique
  on public.member_weekly_notes (project_id, member_id, week_start);

alter table public.member_weekly_notes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'member_weekly_notes' and policyname = 'member_weekly_notes_select') then
    create policy "member_weekly_notes_select" on public.member_weekly_notes for select to authenticated
      using (
        exists (select 1 from public.project_members pm where pm.project_id = member_weekly_notes.project_id and pm.user_id = auth.uid())
        or is_admin()
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'member_weekly_notes' and policyname = 'member_weekly_notes_insert') then
    create policy "member_weekly_notes_insert" on public.member_weekly_notes for insert to authenticated
      with check (
        exists (select 1 from public.project_members pm where pm.project_id = member_weekly_notes.project_id and pm.user_id = auth.uid())
        or is_admin()
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'member_weekly_notes' and policyname = 'member_weekly_notes_update') then
    create policy "member_weekly_notes_update" on public.member_weekly_notes for update to authenticated
      using (
        exists (select 1 from public.project_members pm where pm.project_id = member_weekly_notes.project_id and pm.user_id = auth.uid())
        or is_admin()
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'member_weekly_notes' and policyname = 'member_weekly_notes_delete') then
    create policy "member_weekly_notes_delete" on public.member_weekly_notes for delete to authenticated
      using (
        exists (select 1 from public.project_members pm where pm.project_id = member_weekly_notes.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin'))
        or is_admin()
      );
  end if;
end $$;

grant select, insert, update, delete on public.member_weekly_notes to anon, authenticated, service_role;


-- ─── 2. weekly_member_reports (혹시 누락 시) ────────────────

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

grant select, insert, update, delete on public.weekly_member_reports to anon, authenticated, service_role;

create index if not exists idx_wmr_project_week on public.weekly_member_reports (project_id, week_start);
create index if not exists idx_wmr_member on public.weekly_member_reports (member_id);

alter table public.weekly_member_reports enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'weekly_member_reports' and policyname = 'wmr_select') then
    create policy "wmr_select" on public.weekly_member_reports for select to authenticated
      using (
        exists (select 1 from public.project_members pm where pm.project_id = weekly_member_reports.project_id and pm.user_id = auth.uid())
        or is_admin()
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'weekly_member_reports' and policyname = 'wmr_insert') then
    create policy "wmr_insert" on public.weekly_member_reports for insert to authenticated
      with check (
        exists (select 1 from public.project_members pm where pm.project_id = weekly_member_reports.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin'))
        or exists (select 1 from public.project_members pm where pm.project_id = weekly_member_reports.project_id and pm.user_id = auth.uid() and pm.id = weekly_member_reports.member_id)
        or is_admin()
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'weekly_member_reports' and policyname = 'wmr_update') then
    create policy "wmr_update" on public.weekly_member_reports for update to authenticated
      using (
        exists (select 1 from public.project_members pm where pm.project_id = weekly_member_reports.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin'))
        or exists (select 1 from public.project_members pm where pm.project_id = weekly_member_reports.project_id and pm.user_id = auth.uid() and pm.id = weekly_member_reports.member_id)
        or is_admin()
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'weekly_member_reports' and policyname = 'wmr_delete') then
    create policy "wmr_delete" on public.weekly_member_reports for delete to authenticated
      using (
        exists (select 1 from public.project_members pm where pm.project_id = weekly_member_reports.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin'))
        or is_admin()
      );
  end if;
end $$;


-- ─── 3. audit_log (혹시 누락 시) ────────────────────────────

create table if not exists public.audit_log (
  id text primary key,
  project_id text not null,
  user_id text not null,
  user_name text not null,
  action text not null,
  details text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_audit_log_project_id on public.audit_log (project_id);
create index if not exists idx_audit_log_created_at on public.audit_log (created_at);

grant select, insert, update, delete on public.audit_log to anon, authenticated, service_role;


-- ─── 4. system_settings (혹시 누락 시) ──────────────────────

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

grant select, insert, update, delete on public.system_settings to anon, authenticated, service_role;


-- ─── 5. attendance (혹시 누락 시) ────────────────────────────

create table if not exists public.attendance (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  member_id text not null references public.project_members (id) on delete cascade,
  date date not null,
  type varchar(30) not null,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_attendance_project_id on public.attendance (project_id);
create index if not exists idx_attendance_member_id on public.attendance (member_id);
create index if not exists idx_attendance_date on public.attendance (date);
create index if not exists idx_attendance_project_date on public.attendance (project_id, date);

alter table public.attendance enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'attendance' and policyname = 'attendance_select') then
    create policy "attendance_select" on public.attendance for select to authenticated
      using (
        exists (select 1 from public.project_members pm where pm.project_id = attendance.project_id and pm.user_id = auth.uid())
        or is_admin()
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'attendance' and policyname = 'attendance_insert') then
    create policy "attendance_insert" on public.attendance for insert to authenticated
      with check (
        exists (select 1 from public.project_members pm where pm.project_id = attendance.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin'))
        or exists (select 1 from public.project_members pm where pm.project_id = attendance.project_id and pm.user_id = auth.uid() and pm.id = attendance.member_id)
        or is_admin()
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'attendance' and policyname = 'attendance_update') then
    create policy "attendance_update" on public.attendance for update to authenticated
      using (
        exists (select 1 from public.project_members pm where pm.project_id = attendance.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin'))
        or exists (select 1 from public.project_members pm where pm.project_id = attendance.project_id and pm.user_id = auth.uid() and pm.id = attendance.member_id)
        or is_admin()
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'attendance' and policyname = 'attendance_delete') then
    create policy "attendance_delete" on public.attendance for delete to authenticated
      using (
        exists (select 1 from public.project_members pm where pm.project_id = attendance.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin'))
        or is_admin()
      );
  end if;
end $$;

grant select, insert, update, delete on public.attendance to anon, authenticated, service_role;


-- ─── 6. profiles.account_status 컬럼 (혹시 누락 시) ─────────

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'account_status'
  ) then
    alter table public.profiles
      add column account_status text not null default 'active'
      check (account_status in ('pending', 'active', 'suspended'));
  end if;
end $$;


-- ============================================================
-- 완료! 이미 존재하는 항목은 모두 건너뛰므로 안전하게 재실행 가능합니다.
-- ============================================================
