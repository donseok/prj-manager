-- profiles 테이블에 account_status 컬럼 확인/추가 (기본값 active)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

-- CHECK 제약 조건 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_account_status_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_account_status_check
    CHECK (account_status IN ('pending', 'active', 'suspended'));
  END IF;
END $$;

-- 트리거 함수 재생성 (account_status 포함)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = coalesce(EXCLUDED.name, public.profiles.name),
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

-- 기존 auth.users에 있지만 profiles에 없는 사용자 보충
INSERT INTO public.profiles (id, email, name, account_status)
SELECT id, email, raw_user_meta_data ->> 'name', 'active'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- donseok75@gmail.com 관리자 지정
UPDATE public.profiles
SET system_role = 'admin', account_status = 'active'
WHERE email = 'donseok75@gmail.com';
