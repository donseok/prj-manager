import { test, expect } from '@playwright/test';
import { createProject, deleteCurrentProjectFromSettings, deleteProjectByName, e2eEmail, loginAsAdmin } from './helpers';

test.describe('project delete', () => {
  test.skip(!e2eEmail, 'E2E_EMAIL and E2E_PASSWORD are required');

  test('creates and deletes a project persistently', async ({ page }) => {
    test.setTimeout(120_000);
    const projectName = `e2e-delete-${Date.now()}`;

    await loginAsAdmin(page);
    const projectId = await createProject(page, projectName);

    await deleteCurrentProjectFromSettings(page, projectName, projectId);
    await deleteProjectByName(page, projectName);

    await page.reload();
    await page.waitForURL(/\/projects$/, { timeout: 20_000 });
    await expect(page.getByText(projectName)).toHaveCount(0);
  });
});
