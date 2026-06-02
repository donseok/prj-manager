-- superadmin 을 서버측 admin 권한 판정에 포함시켜, 관리자 쓰기 경로(승인/거부/역할변경 등)를 복구한다.
--
-- 배경:
--   SystemRole = 'superadmin' | 'admin' | 'user'. 클라이언트(authStore.isAdmin)는
--   superadmin 을 admin 의 상위집합으로 취급한다(isAdmin = superadmin || admin).
--   그러나 서버측 권한 판정 — is_admin() 함수와 admin_update_* RPC 의 인라인 검사 —
--   은 system_role = 'admin' 만 매칭하여 superadmin 을 제외했다.
--   그 결과 superadmin 운영자가 "승인/거부/역할변경" 을 눌러도 RPC 가
--   "Permission denied: admin only" 예외를 던져 아무 변화 없이 실패했다.
--   (이 불일치는 20260530140000 마이그레이션 주석에서 이미 예고되어 있었다.)
--
-- 조치: is_admin() 및 두 admin 쓰기 RPC 를 superadmin 포함으로 확장한다.
--   is_admin() 은 profiles_update / attendance / weekly_member_reports /
--   member_weekly_notes / chatbot_embeddings 등 다수 RLS 정책에서 재사용되므로,
--   한 번의 수정으로 모든 정책 기반 admin 경로가 동시에 복구된다.

-- ── 1) is_admin(): superadmin 포함 ────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND system_role IN ('admin', 'superadmin')
  );
$$;

-- ── 2) admin_update_account_status: is_admin() 재사용(superadmin 포함) ──
CREATE OR REPLACE FUNCTION public.admin_update_account_status(
  target_user_id uuid,
  new_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  IF new_status NOT IN ('pending', 'active', 'suspended') THEN
    RAISE EXCEPTION 'Invalid account status: %', new_status;
  END IF;

  UPDATE public.profiles
  SET account_status = new_status
  WHERE id = target_user_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

-- ── 3) admin_update_user_system_role: is_admin() 재사용(superadmin 포함) ──
CREATE OR REPLACE FUNCTION public.admin_update_user_system_role(
  target_user_id uuid,
  new_role text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  IF new_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Invalid system role: %', new_role;
  END IF;

  UPDATE public.profiles
  SET system_role = new_role
  WHERE id = target_user_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_account_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_system_role(uuid, text) TO authenticated;
