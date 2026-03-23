-- ─── 프로필 테이블 인덱스 추가 (쿼리 성능 최적화) ───────────────────

-- account_status 필터링 최적화 (승인 대기 카운트 등)
CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON public.profiles (account_status);

-- created_at 정렬 최적화
CREATE INDEX IF NOT EXISTS idx_profiles_created_at
  ON public.profiles (created_at);

-- system_role 조회 최적화 (is_admin 함수 등)
CREATE INDEX IF NOT EXISTS idx_profiles_system_role
  ON public.profiles (system_role);

-- ─── 관리자 전용 프로필 일괄 조회 RPC (RLS 우회) ─────────────────────

CREATE OR REPLACE FUNCTION public.admin_load_all_profiles()
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  system_role text,
  account_status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 관리자 권한 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.system_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  RETURN QUERY
    SELECT p.id, p.email, p.name, p.system_role, p.account_status, p.created_at
    FROM public.profiles p
    ORDER BY p.created_at ASC;
END;
$$;

-- ─── 관리자 전용 승인 대기 카운트 RPC (RLS 우회) ─────────────────────

CREATE OR REPLACE FUNCTION public.admin_pending_count()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt bigint;
BEGIN
  -- 관리자 권한 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.system_role = 'admin'
  ) THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO cnt
  FROM public.profiles p
  WHERE p.account_status = 'pending';

  RETURN cnt;
END;
$$;
