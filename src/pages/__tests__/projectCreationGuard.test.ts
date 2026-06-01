import { describe, it, expect } from 'vitest';
import { canCreateProject } from '../projectCreationGuard';

// ── M-7 — 프로젝트 생성 정책 우회 차단 ─────────────────────────
// 버그: 생성 정책이 'admin_only'일 때도 비관리자가 /projects/new 로 직접
// 이동하면 프로젝트를 만들 수 있었다. canCreateProject 술어는 옳았지만
// 자동 오픈 effect와 제출 핸들러에서 강제되지 않았다.
//
// 이 테스트는 게이트 술어의 계약을 고정한다. 강제(effect 리다이렉트 +
// 제출 가드)는 술어가 false를 반환하는 경우에만 의미가 있으므로,
// 비관리자 + admin_only 조합이 반드시 false 여야 한다.

describe('M-7 — canCreateProject 게이트 술어', () => {
  it("정책이 'all'이면 비관리자도 생성 가능", () => {
    expect(canCreateProject('all', false)).toBe(true);
  });

  it("정책이 'all'이면 관리자도 생성 가능", () => {
    expect(canCreateProject('all', true)).toBe(true);
  });

  it("정책이 'admin_only'이고 관리자면 생성 가능", () => {
    expect(canCreateProject('admin_only', true)).toBe(true);
  });

  it("정책이 'admin_only'이고 비관리자면 생성 불가 (우회 차단 핵심)", () => {
    expect(canCreateProject('admin_only', false)).toBe(false);
  });
});
