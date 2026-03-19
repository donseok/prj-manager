-- profiles 테이블에 system_role 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS system_role text NOT NULL DEFAULT 'user'
  CHECK (system_role IN ('admin', 'user'));

-- 시스템 관리자 확인 헬퍼 함수
CREATE OR REPLACE FUNCTION is_system_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND system_role = 'admin'
  );
$$;

-- 첫 번째 가입 사용자를 자동으로 admin으로 설정하는 함수
CREATE OR REPLACE FUNCTION set_first_user_as_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (SELECT count(*) FROM profiles) = 1 THEN
    UPDATE profiles SET system_role = 'admin' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 트리거: 프로필 생성 후 첫 사용자를 admin으로
DROP TRIGGER IF EXISTS trigger_set_first_user_as_admin ON profiles;
CREATE TRIGGER trigger_set_first_user_as_admin
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_first_user_as_admin();

-- RLS 정책: admin은 모든 프로젝트 조회 가능
CREATE POLICY "admin_read_all_projects"
  ON projects FOR SELECT
  USING (is_system_admin());

-- RLS 정책: admin은 모든 프로젝트 멤버 조회 가능
CREATE POLICY "admin_read_all_project_members"
  ON project_members FOR SELECT
  USING (is_system_admin());

-- RLS 정책: admin은 모든 태스크 조회 가능
CREATE POLICY "admin_read_all_tasks"
  ON tasks FOR SELECT
  USING (is_system_admin());

-- RLS 정책: admin은 모든 프로필 조회 가능
CREATE POLICY "admin_read_all_profiles"
  ON profiles FOR SELECT
  USING (is_system_admin());

-- RLS 정책: admin은 다른 사용자의 system_role 변경 가능
CREATE POLICY "admin_update_profiles"
  ON profiles FOR UPDATE
  USING (is_system_admin());
