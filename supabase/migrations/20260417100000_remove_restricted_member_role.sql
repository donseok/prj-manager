-- restricted_member 역할 제거 (viewer와 동일 권한이므로 통합)
-- 기존 restricted_member를 viewer로 변환
UPDATE public.project_members
SET role = 'viewer'
WHERE role = 'restricted_member';

-- 제약조건 재설정 (restricted_member 제거)
ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_role_check;

ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_role_check
  CHECK (role IN ('owner', 'admin', 'editor', 'member', 'viewer'));
