-- =====================================================================
-- NOT APPLIED: login-critical SECURITY DEFINER function.
-- Test on staging, then apply via Supabase SQL editor / npm run db:migrate.
-- Do not assume active.
--
-- This redefines link_orphan_members_to_user(), which is invoked on EVERY
-- login via App.tsx -> dataRepository.loadProjectIdsForUser. An untested
-- redefinition can break login for ALL users — verify on staging first.
-- =====================================================================
--
-- Hardening over 20260513100000_link_orphan_members_rpc.sql (M-5):
--   (i)   Drop email-PREFIX and loose user_metadata-name candidates. These
--         match far too broadly (e.g. "kim" prefix, display nicknames) and
--         are the main vector for hijacking another person's orphan row.
--         Only the FULL verified email and the canonical profile name remain.
--   (ii)  NEVER auto-link orphan rows whose role is 'admin' or 'owner'. Only
--         the lowest roles are linked, so a stray high-privilege orphan row
--         can't grant admin/owner to whoever happens to share a name.
--   (iii) Still returns the caller's member project_ids (unchanged contract).

CREATE OR REPLACE FUNCTION public.link_orphan_members_to_user()
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_profile_name text;
  v_candidates text[] := ARRAY[]::text[];
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- auth.users 에서 이메일 추출 (이메일 prefix·user_metadata 이름은 사용하지 않음)
  SELECT au.email
  INTO v_email
  FROM auth.users au
  WHERE au.id = v_user_id;

  -- profiles 의 정식 이름만 추가 후보로 사용
  SELECT trim(coalesce(p.name, ''))
  INTO v_profile_name
  FROM public.profiles p
  WHERE p.id = v_user_id;

  -- 매칭 후보: 전체 이메일 + profile 정식 이름 (느슨한 prefix/메타이름 제외)
  IF v_email IS NOT NULL AND length(v_email) > 0 THEN
    v_candidates := array_append(v_candidates, v_email);
  END IF;
  IF v_profile_name IS NOT NULL AND length(v_profile_name) > 0 THEN
    v_candidates := array_append(v_candidates, v_profile_name);
  END IF;

  -- orphan(user_id IS NULL) 매칭 → 본인 user_id 로 백필.
  -- 단, 권한 상속을 막기 위해 admin/owner 역할 orphan 행은 절대 자동 연결하지 않는다.
  IF array_length(v_candidates, 1) > 0 THEN
    UPDATE public.project_members
    SET user_id = v_user_id
    WHERE user_id IS NULL
      AND role NOT IN ('admin', 'owner')
      AND name = ANY (v_candidates);
  END IF;

  -- 본인이 멤버인 모든 프로젝트 id 반환 (백필 후 상태 기준)
  RETURN QUERY
  SELECT DISTINCT project_id
  FROM public.project_members
  WHERE user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_orphan_members_to_user() TO authenticated;
