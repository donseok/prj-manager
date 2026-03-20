-- account_status 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending'
  CHECK (account_status IN ('pending', 'active', 'suspended'));

-- 기존 사용자들은 active로 설정
UPDATE profiles SET account_status = 'active' WHERE account_status = 'pending';

-- 첫 번째 사용자(admin)는 자동 active
CREATE OR REPLACE FUNCTION set_first_user_as_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (SELECT count(*) FROM profiles) = 1 THEN
    UPDATE profiles SET system_role = 'admin', account_status = 'active' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- admin만 account_status 변경 가능 (기존 admin_update_profiles 정책으로 커버됨)
