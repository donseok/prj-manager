-- NOT APPLIED: test on staging then apply
--
-- M-7 — 프로젝트 생성 정책(admin_only) 서버측 강제.
--
-- 배경: projects_insert_owner WITH CHECK는 owner_id = auth.uid() 만 검사하여,
-- system_settings.projectCreationPolicy = 'admin_only' 인데도 비관리자가
-- (UI를 우회해 직접 INSERT 하면) 프로젝트를 생성할 수 있었다. 클라이언트
-- 가드(ProjectList.tsx)는 UX/방어선일 뿐이고, 정책의 실제 강제는 RLS가
-- 책임져야 한다.
--
-- 설계 메모:
-- 1) WITH CHECK 안에서 system_settings 를 bare 서브쿼리로 읽으면 호출자
--    컨텍스트/RLS에 따라 행이 안 보여 NULL 로 평가될 수 있고, 그러면
--    "admin_only 아님"으로 잘못 통과(fail-open)한다. 이를 막기 위해 정책
--    조회를 SECURITY DEFINER STABLE 헬퍼로 감싼다.
-- 2) 정책 행이 없거나 값이 NULL 이면 클라이언트 DEFAULT_SETTINGS 와 동일하게
--    'all'(허용)로 취급한다.
-- 3) 관리자 판정은 기존 is_system_admin()(SECURITY DEFINER) 를 재사용한다.
--
-- 스테이징 체크리스트:
-- * is_system_admin() 은 system_role = 'admin' 만 매칭한다. 그러나 클라이언트
--   authStore.isAdmin 은 systemRole === 'superadmin' || 'admin' 이므로,
--   superadmin 도 admin_only 정책에서 프로젝트를 만들 수 있어야 한다면
--   여기 admin 판정을 superadmin 포함으로 넓혀야 한다(클라이언트 허용/서버
--   거부 불일치 방지). 현 profiles.system_role CHECK 는 ('admin','user') 만
--   허용하므로 superadmin 이 DB 컬럼에 실재하는지 먼저 확인할 것.

-- ─── 생성 정책이 admin_only 인지 신뢰성 있게 조회하는 헬퍼 ─────────────
create or replace function public.is_project_creation_admin_only()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select (s.value ->> 'projectCreationPolicy') = 'admin_only'
      from public.system_settings s
      where s.key = 'system_settings'
      limit 1
    ),
    false  -- 행 없음 / 값 없음 → 'all' 기본값과 동일하게 허용(=admin_only 아님)
  );
$$;

revoke all on function public.is_project_creation_admin_only() from public;
grant execute on function public.is_project_creation_admin_only() to anon, authenticated, service_role;

-- ─── insert RLS 강화 ──────────────────────────────────────────────────
-- admin_only 정책일 때는 시스템 관리자만 INSERT 허용. 그 외에는 종전과
-- 동일하게 owner_id = auth.uid() 본인 소유 프로젝트만 허용.
drop policy if exists "projects_insert_owner" on public.projects;
create policy "projects_insert_owner"
on public.projects
for insert
with check (
  owner_id = auth.uid()
  and (
    not public.is_project_creation_admin_only()
    or public.is_system_admin()
  )
);
