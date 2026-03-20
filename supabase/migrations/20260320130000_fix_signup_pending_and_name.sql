-- 신규 가입 시 account_status = 'pending' (관리자 승인 대기)
-- 회원가입 시 입력한 이름이 정확히 저장되도록 수정

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  signup_name text;
  initial_status text;
BEGIN
  signup_name := coalesce(
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'full_name'
  );

  -- 최초 관리자 계정은 즉시 active, 나머지는 pending
  IF NEW.email = 'donseok75@gmail.com' THEN
    initial_status := 'active';
  ELSE
    initial_status := 'pending';
  END IF;

  INSERT INTO public.profiles (id, email, name, avatar_url, system_role, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    signup_name,
    NEW.raw_user_meta_data ->> 'avatar_url',
    CASE WHEN NEW.email = 'donseok75@gmail.com' THEN 'admin' ELSE 'user' END,
    initial_status
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    avatar_url = coalesce(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = timezone('utc', now());

  RETURN NEW;
END;
$$;

-- 트리거 재연결
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 관리자 계정의 admin RLS 정책: admin이 모든 profiles를 조회·수정 가능
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public.profiles;
CREATE POLICY "admin_select_all_profiles"
ON public.profiles
FOR SELECT
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.system_role = 'admin'
  )
);

DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
CREATE POLICY "admin_update_profiles"
ON public.profiles
FOR UPDATE
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.system_role = 'admin'
  )
)
WITH CHECK (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.system_role = 'admin'
  )
);
