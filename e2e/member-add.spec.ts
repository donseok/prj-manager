import { test, expect } from '@playwright/test';

test.describe('멤버 개별 입력', () => {
  test('역할 선택 후 이름 입력하고 추가 버튼으로 멤버 저장', async ({ page }) => {
    // Supabase 미설정 빌드 → initializeApp이 자동 로그인
    await page.goto('/');
    await page.waitForTimeout(2000);

    // 프로젝트 목록으로 이동
    await page.goto('/projects');
    await page.waitForTimeout(1000);

    // 프로젝트 생성
    await page.getByText('새 프로젝트').first().click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('[data-testid="projects-create-name"]');
    await nameInput.fill('멤버 테스트 프로젝트');
    const createBtn = page.locator('[data-testid="projects-create-submit"]');
    await expect(createBtn).toBeEnabled({ timeout: 3000 });
    await createBtn.click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 5000 });
    await page.waitForTimeout(500);

    // 멤버 페이지로 이동
    await page.getByRole('link', { name: '멤버', exact: true }).click();
    await page.waitForURL(/\/members/, { timeout: 5000 });
    await page.waitForTimeout(500);

    // 멤버 추가 모달 열기
    await page.locator('[data-testid="members-add-button"]').click();
    await page.waitForTimeout(300);

    // 1. 역할 선택 (관리자)
    const roleSelect = page.locator('[data-testid="member-role-select"]');
    await expect(roleSelect).toBeVisible({ timeout: 3000 });
    await roleSelect.selectOption('admin');

    // 2. 이름 입력
    const memberNameInput = page.locator('[data-testid="member-name-input"]');
    await memberNameInput.fill('홍길동');

    // 3. 추가 버튼 클릭
    const addBtn = page.locator('[data-testid="members-confirm-add-button"]');
    await expect(addBtn).toBeEnabled();
    await addBtn.click();
    await page.waitForTimeout(500);

    // 4. 멤버 카드에 이름이 표시되는지 확인 (피드백 알림이 아닌 카드 영역)
    const memberCards = page.locator('[data-testid^="member-card-"]');
    await expect(memberCards.filter({ hasText: '홍길동' })).toBeVisible({ timeout: 3000 });

    // 5. 이름 입력 필드 초기화 확인 (연속 입력 가능)
    await expect(memberNameInput).toHaveValue('');

    // 6. 두 번째 멤버 추가 (역할: 멤버)
    await roleSelect.selectOption('member');
    await memberNameInput.fill('김철수');
    await addBtn.click();
    await page.waitForTimeout(500);
    await expect(memberCards.filter({ hasText: '김철수' })).toBeVisible({ timeout: 3000 });

    // 7. Enter 키로도 추가 가능
    await memberNameInput.fill('이영희');
    await memberNameInput.press('Enter');
    await page.waitForTimeout(500);
    await expect(memberCards.filter({ hasText: '이영희' })).toBeVisible({ timeout: 3000 });
  });
});
