-- 관리자 전용 프로필 "쓰기" RPC (RLS 우회) + 직접 쓰기 경로용 정책 보정
--
-- 배경: 읽기 경로(admin_load_all_profiles)는 SECURITY DEFINER RPC 로 RLS 를 우회하지만,
-- 쓰기 경로(updateAccountStatus / updateUserSystemRole)는 profiles 를 직접 UPDATE 한다.
-- profiles 의 UPDATE RLS 가 타인 행 수정을 차단하면 PostgREST 는 0건만 매칭하고 "에러 없이"
-- 성공을 반환한다 → 관리자가 승인해도 실제로는 아무것도 바뀌지 않고, RLS 를 우회하는
-- 조회 RPC 로 재조회하면 'pending' 이 그대로 남는다.
-- → 읽기와 동일하게 쓰기도 SECURITY DEFINER RPC 로 처리해 RLS 상태와 무관하게 동작시킨다.

-- ── 1) 관리자 전용 계정 상태 변경 RPC ─────────────────────────
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
  -- 호출자 관리자 권한 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.system_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  IF new_status NOT IN ('pending', 'active', 'suspended') THEN
    RAISE EXCEPTION 'Invalid account status: %', new_status;
  END IF;

  UPDATE public.profiles
  SET account_status = new_status
  WHERE id = target_user_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;  -- 대상이 없으면 false
END;
$$;

-- ── 2) 관리자 전용 시스템 역할 변경 RPC ───────────────────────
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
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.system_role = 'admin'
  ) THEN
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

-- ── 3) 직접 쓰기 폴백 경로 보정 ───────────────────────────────
-- RPC 미설치 환경에서 폴백되는 직접 UPDATE 가 동작하도록, admin 이 모든 profiles 를
-- 수정할 수 있는 정책을 재확인한다. (재귀 방지용 SECURITY DEFINER is_admin() 사용)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND system_role = 'admin'
  );
$$;

-- 과거 마이그레이션에서 남았을 수 있는 재귀/본인전용 UPDATE 정책 정리 후 재생성
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update"
ON public.profiles FOR UPDATE
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());
