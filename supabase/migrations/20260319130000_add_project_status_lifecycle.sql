-- 프로젝트 상태 체계 변경: active/archived/deleted → preparing/active/completed/deleted
-- 완료일시 컬럼 추가

-- 1. 기존 check 제약 조건 제거
alter table public.projects drop constraint if exists projects_status_check;

-- 2. 새 check 제약 조건 추가
alter table public.projects add constraint projects_status_check
  check (status in ('preparing', 'active', 'completed', 'deleted'));

-- 3. completed_at 컬럼 추가
alter table public.projects add column if not exists completed_at timestamptz;

-- 4. 기존 archived 상태를 completed로 마이그레이션
update public.projects set status = 'completed', completed_at = updated_at
  where status = 'archived';

-- 5. 기본값을 preparing으로 변경
alter table public.projects alter column status set default 'preparing';
