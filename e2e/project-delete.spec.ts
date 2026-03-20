import { test, expect } from '@playwright/test';

test.describe('프로젝트 삭제', () => {
  test.beforeEach(async ({ page }) => {
    // localStorage 초기화
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(1500);
  });

  test('프로젝트를 생성하고 삭제한 후 새로고침해도 사라져야 한다', async ({ page }) => {
    // 1. 프로젝트 생성
    await page.goto('/projects');
    await page.waitForTimeout(1000);

    await page.getByText('새 프로젝트').first().click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('[data-testid="projects-create-name"]');
    await nameInput.click();
    await nameInput.pressSequentially('삭제 테스트 프로젝트', { delay: 50 });
    await page.waitForTimeout(300);

    const createBtn = page.locator('[data-testid="projects-create-submit"]');
    await expect(createBtn).toBeEnabled({ timeout: 3000 });
    await createBtn.click();

    // 프로젝트 대시보드로 이동 대기
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 5000 });
    await page.waitForTimeout(1000);

    // 2. 프로젝트 목록으로 이동
    await page.goto('/projects');
    await page.waitForTimeout(1500);

    // 프로젝트가 존재하는지 확인
    await expect(page.getByText('삭제 테스트 프로젝트').first()).toBeVisible({ timeout: 5000 });

    // 3. 카드의 더보기(⋮) 메뉴 버튼 클릭
    // 카드 우측 상단에 있는 MoreVertical 버튼
    const card = page.locator('.metric-card').filter({ hasText: '삭제 테스트 프로젝트' });
    const menuBtn = card.locator('button').first();
    await menuBtn.click();
    await page.waitForTimeout(500);

    // 4. 메뉴 내 삭제 버튼 클릭
    const deleteBtn = card.getByRole('button', { name: '삭제' });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // 5. 확인 모달에서 "프로젝트 삭제" 버튼 클릭
    const confirmDeleteBtn = page.locator('button').filter({ hasText: '프로젝트 삭제' });
    await expect(confirmDeleteBtn).toBeVisible({ timeout: 3000 });
    await confirmDeleteBtn.click();
    await page.waitForTimeout(1500);

    // 6. 삭제 후 프로젝트가 사라졌는지 확인
    await expect(page.getByText('삭제 테스트 프로젝트')).toHaveCount(0, { timeout: 5000 });

    // 7. 새로고침 후에도 사라져 있어야 함 (localStorage 영속성 검증)
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.getByText('삭제 테스트 프로젝트')).toHaveCount(0, { timeout: 5000 });
  });
});
