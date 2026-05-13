-- 사용자 본인의 식별 정보(이메일·이메일 prefix·user_metadata 이름·profile 이름)와
-- 일치하는 orphan member(user_id IS NULL) 행을 본인 user_id로 자동 백필하고,
-- 본인이 속한 프로젝트 ID 목록을 반환한다.
--
-- SECURITY DEFINER로 project_members RLS를 우회하되, 매칭 키는 auth.uid()로
-- 결정한 본인 식별 정보만 사용해 다른 사람 명의 row를 가로채는 것을 방지한다.

CREATE OR REPLACE FUNCTION public.link_orphan_members_to_user()
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_meta_name text;
  v_profile_name text;
  v_email_prefix text;
  v_candidates text[] := ARRAY[]::text[];
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- auth.users 에서 이메일과 user_metadata 이름 추출
  SELECT au.email,
         trim(coalesce(au.raw_user_meta_data ->> 'name', au.raw_user_meta_data ->> 'full_name', ''))
  INTO v_email, v_meta_name
  FROM auth.users au
  WHERE au.id = v_user_id;

  -- profiles 의 정식 이름도 후보에 포함
  SELECT trim(coalesce(p.name, ''))
  INTO v_profile_name
  FROM public.profiles p
  WHERE p.id = v_user_id;

  -- 매칭 후보 빌드 (이메일·이메일 prefix·meta name·profile name)
  IF v_email IS NOT NULL AND length(v_email) > 0 THEN
    v_candidates := array_append(v_candidates, v_email);
    v_email_prefix := split_part(v_email, '@', 1);
    IF v_email_prefix IS NOT NULL AND length(v_email_prefix) > 0 THEN
      v_candidates := array_append(v_candidates, v_email_prefix);
    END IF;
  END IF;
  IF v_meta_name IS NOT NULL AND length(v_meta_name) > 0 THEN
    v_candidates := array_append(v_candidates, v_meta_name);
  END IF;
  IF v_profile_name IS NOT NULL AND length(v_profile_name) > 0
     AND v_profile_name <> coalesce(v_meta_name, '') THEN
    v_candidates := array_append(v_candidates, v_profile_name);
  END IF;

  -- orphan(user_id IS NULL) 매칭 → 본인 user_id 로 백필
  IF array_length(v_candidates, 1) > 0 THEN
    UPDATE public.project_members
    SET user_id = v_user_id
    WHERE user_id IS NULL
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
