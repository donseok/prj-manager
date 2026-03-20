import { expect, type Page } from '@playwright/test';

export const e2eEmail = process.env.E2E_EMAIL;
export const e2ePassword = process.env.E2E_PASSWORD;

export async function loginAsAdmin(page: Page) {
  if (!e2eEmail || !e2ePassword) {
    throw new Error('E2E_EMAIL and E2E_PASSWORD are required');
  }

  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();

  await page.locator('input[type="email"]').fill(e2eEmail);
  await page.locator('input[type="password"]').fill(e2ePassword);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login') && !url.pathname.startsWith('/pending'), {
    timeout: 20_000,
  });
}

export async function createProject(page: Page, projectName: string) {
  await page.goto('/projects');
  await page.locator('[data-testid="projects-open-create-button"]').click();
  await page.locator('[data-testid="projects-create-name"]').fill(projectName);
  await page.locator('[data-testid="projects-create-submit"]').click();
  await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 20_000 });

  const match = page.url().match(/\/projects\/([^/]+)$/);
  if (!match) {
    throw new Error('Failed to determine created project id');
  }

  return match[1];
}

export async function deleteProjectByName(page: Page, projectName: string) {
  await page.goto('/projects');
  await expect(page.getByText(projectName)).toHaveCount(0);
}

export async function deleteCurrentProjectFromSettings(page: Page, projectName: string, projectId: string) {
  await page.goto(`/projects/${projectId}/settings`);
  await page.locator('[data-testid="settings-delete-project-button"]').click();

  const modal = page.locator('.fixed.inset-0.z-50').last();
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await modal.locator('button').last().click();

  await page.waitForURL(/\/projects$/, { timeout: 20_000 });
  await expect(page.getByText(projectName)).toHaveCount(0);
}
