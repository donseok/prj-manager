-- 프로젝트 멤버 역할 제약조건 수정
-- 기존: owner, admin, member, viewer (4종)
-- 변경: owner, admin, editor, member, restricted_member, viewer (6종)
-- editor, restricted_member 가 UI/권한에 이미 구현되어 있으나 DB 제약조건이 누락된 버그 수정

ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_role_check;

ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_role_check
  CHECK (role IN ('owner', 'admin', 'editor', 'member', 'restricted_member', 'viewer'));
