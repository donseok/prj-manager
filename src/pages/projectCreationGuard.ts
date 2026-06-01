import type { SystemSettings } from '../lib/systemSettings';

/**
 * M-7 — 프로젝트 생성 정책 게이트 (순수 술어).
 *
 * 생성 정책이 'all'이면 누구나, 'admin_only'이면 시스템 관리자만 새 프로젝트를
 * 만들 수 있다. 이 값은 (1) 생성 버튼 노출, (2) /projects/new 자동 오픈 모달의
 * 강제 리다이렉트, (3) 제출 핸들러 가드에서 모두 동일하게 사용된다.
 *
 * 주의: 이 클라이언트 가드는 UX/방어선일 뿐 최종 보안 경계가 아니다. 설정이
 * 비동기로 하이드레이션되기 전 짧은 구간에는 기본값('all')이 적용되므로,
 * 실제 강제는 서버 RLS(projects_insert_owner WITH CHECK)가 책임진다.
 */
export function canCreateProject(
  policy: SystemSettings['projectCreationPolicy'],
  isAdmin: boolean,
): boolean {
  return policy === 'all' || isAdmin;
}
