import { test, expect } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe('real db save smoke', () => {
  test.skip(!email || !password, 'E2E_EMAIL and E2E_PASSWORD are required');

  test('project create, member save, gantt save, cleanup', async ({ page }) => {
    test.setTimeout(120_000);

    const projectName = `e2e-smoke-${Date.now()}`;

    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL((url) => !url.pathname.startsWith('/login') && !url.pathname.startsWith('/pending'), {
      timeout: 20_000,
    });

    await page.goto('/projects');
    await page.locator('[data-testid="projects-open-create-button"]').click();
    await page.locator('[data-testid="projects-create-name"]').fill(projectName);
    await page.locator('[data-testid="projects-create-submit"]').click();
    await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 20_000 });

    await page.getByRole('link', { name: '멤버', exact: true }).click();
    await page.waitForURL(/\/members$/, { timeout: 20_000 });
    await page.locator('[data-testid="members-add-button"]').click();
    await page.locator('[data-testid="member-role-select"]').selectOption('member');
    await page.locator('[data-testid="member-name-input"]').fill('E2E 저장 검증');
    await page.locator('[data-testid="members-confirm-add-button"]').click();
    await expect(page.locator('[data-testid^="member-card-"]').filter({ hasText: 'E2E 저장 검증' })).toBeVisible({
      timeout: 10_000,
    });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: '멤버 추가', exact: true })).toHaveCount(0);
    await page.locator('[data-testid="members-save-button"]').click();

    await page.getByRole('link', { name: 'WBS', exact: true }).click();
    await page.waitForURL(/\/wbs$/, { timeout: 20_000 });
    await page.getByRole('button', { name: 'Phase 추가', exact: true }).click();

    const firstRow = page.locator('[data-testid^="wbs-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.locator('input[type="text"]').first().fill('E2E Phase');
    await firstRow.locator('input[type="text"]').first().press('Enter');

    const statusSelect = firstRow.locator('select[data-testid^="wbs-status-"]').first();
    await statusSelect.selectOption('in_progress');
    await page.locator('[data-testid="wbs-save-button"]').click();

    await page.getByRole('link', { name: '간트 차트', exact: true }).click();
    await page.waitForURL(/\/gantt$/, { timeout: 20_000 });

    const ganttRow = page.locator('[data-testid^="gantt-row-"]').filter({ hasText: 'E2E Phase' }).first();
    await expect(ganttRow).toBeVisible({ timeout: 10_000 });
    await ganttRow.click();

    await page.locator('[data-testid="gantt-edit-status"]').selectOption('completed');
    await expect(page.locator('[data-testid="gantt-edit-status"]')).toHaveValue('completed');
    await expect(page.locator('[data-testid="gantt-edit-actual-progress"]')).toHaveValue('100');
    await expect(page.locator('[data-testid="gantt-edit-actual-end"]')).not.toHaveValue('');
    await page.locator('[data-testid="gantt-save-button"]').click();
    await page.waitForTimeout(2500);
    await page.reload();
    await page.waitForURL(/\/gantt$/, { timeout: 20_000 });

    const reloadedRow = page.locator('[data-testid^="gantt-row-"]').filter({ hasText: 'E2E Phase' }).first();
    await expect(reloadedRow).toBeVisible({ timeout: 10_000 });
    await reloadedRow.click();
    await expect(page.locator('[data-testid="gantt-edit-status"]')).toHaveValue('completed');
    await expect(page.locator('[data-testid="gantt-edit-actual-progress"]')).toHaveValue('100');
    await expect(page.locator('[data-testid="gantt-edit-actual-end"]')).not.toHaveValue('');

    await page.getByRole('link', { name: '설정', exact: true }).click();
    await page.waitForURL(/\/settings$/, { timeout: 20_000 });
    await page.locator('[data-testid="settings-delete-project-button"]').click();
    await page.getByRole('button', { name: '프로젝트 삭제', exact: true }).last().click();
    await page.waitForURL(/\/projects$/, { timeout: 20_000 });
    await expect(page.getByText(projectName)).toHaveCount(0);
  });
});
