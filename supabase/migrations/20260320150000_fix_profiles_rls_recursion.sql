-- 무한 재귀를 방지하는 admin 체크 함수 (SECURITY DEFINER로 RLS 우회)
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

-- 기존 재귀 정책 삭제
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

-- SELECT: 자기 자신 또는 admin
CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT
USING (id = auth.uid() OR public.is_admin());

-- UPDATE: 자기 자신 또는 admin
CREATE POLICY "profiles_update"
ON public.profiles FOR UPDATE
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());

-- INSERT: 트리거용 (자기 자신)
CREATE POLICY "profiles_insert"
ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid());
