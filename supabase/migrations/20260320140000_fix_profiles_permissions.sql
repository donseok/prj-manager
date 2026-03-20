-- profiles 테이블 접근 권한 부여
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO service_role;

-- 기존 RLS 정책 정리 및 재설정
-- 자기 자신 프로필 읽기 (기존 정책 유지)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
USING (id = auth.uid());

-- admin이 모든 프로필 조회
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public.profiles;
CREATE POLICY "admin_select_all_profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.system_role = 'admin'
  )
);

-- 자기 프로필 수정
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- admin이 모든 프로필 수정 (역할·상태 변경)
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
CREATE POLICY "admin_update_profiles"
ON public.profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.system_role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.system_role = 'admin'
  )
);

-- 자기 프로필 insert (회원가입 트리거용)
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid());

-- donseok75 admin 보장
UPDATE public.profiles
SET system_role = 'admin', account_status = 'active'
WHERE email = 'donseok75@gmail.com';
