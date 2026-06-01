-- =====================================================================
-- NOT APPLIED: schema change for project_members.
-- Test on staging, then apply via Supabase SQL editor / npm run db:migrate.
-- Do not assume active. The app degrades gracefully when this column is
-- absent (dataRepository.syncProjectMembers strips previous_role and retries
-- on PGRST204), so super-admin "관리자 배정 해제" role-restore (M-6) only
-- persists across sessions AFTER this migration is applied.
-- =====================================================================

-- 슈퍼관리자가 기존 멤버를 관리자(admin)로 승격할 때 직전 역할을 기록해 두었다가,
-- 관리자 배정 해제 시 그 역할로 복원하기 위한 컬럼. (M-6)
-- 관리자로 신규 추가된 멤버는 NULL이며, 해제 시 멤버십이 제거된다.
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS previous_role text;
