import { test, expect } from '@playwright/test';
import { createProject, deleteCurrentProjectFromSettings, deleteProjectByName, e2eEmail, loginAsAdmin } from './helpers';

test.describe('member add', () => {
  test.skip(!e2eEmail, 'E2E_EMAIL and E2E_PASSWORD are required');

  test('adds members and persists after reload', async ({ page }) => {
    test.setTimeout(120_000);
    const projectName = `e2e-member-${Date.now()}`;

    await loginAsAdmin(page);
    const projectId = await createProject(page, projectName);

    await page.goto(`/projects/${projectId}/members`);
    await page.waitForURL(/\/members$/, { timeout: 20_000 });

    await page.locator('[data-testid="members-add-button"]').click();

    const roleSelect = page.locator('[data-testid="member-role-select"]');
    const memberNameInput = page.locator('[data-testid="member-name-input"]');
    const addButton = page.locator('[data-testid="members-confirm-add-button"]');
    const memberCards = page.locator('[data-testid^="member-card-"]');

    await expect(roleSelect).toBeVisible({ timeout: 10_000 });

    await roleSelect.selectOption('admin');
    await memberNameInput.fill('E2E Admin');
    await addButton.click();
    await expect(memberCards.filter({ hasText: 'E2E Admin' })).toBeVisible({ timeout: 10_000 });
    await expect(memberNameInput).toHaveValue('');

    await roleSelect.selectOption('member');
    await memberNameInput.fill('E2E Member');
    await addButton.click();
    await expect(memberCards.filter({ hasText: 'E2E Member' })).toBeVisible({ timeout: 10_000 });

    await memberNameInput.fill('E2E Enter');
    await memberNameInput.press('Enter');
    await expect(memberCards.filter({ hasText: 'E2E Enter' })).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Escape');
    await page.locator('[data-testid="members-save-button"]').click();
    await page.waitForTimeout(2500);

    await page.reload();
    await page.waitForURL(/\/members$/, { timeout: 20_000 });
    await expect(page.locator('[data-testid^="member-card-"]').filter({ hasText: 'E2E Admin' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid^="member-card-"]').filter({ hasText: 'E2E Member' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid^="member-card-"]').filter({ hasText: 'E2E Enter' })).toBeVisible({ timeout: 10_000 });

    await deleteCurrentProjectFromSettings(page, projectName, projectId);
    await deleteProjectByName(page, projectName);
  });
});
