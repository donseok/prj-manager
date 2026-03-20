import { test, expect } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe('real db cleanup', () => {
  test.skip(!email || !password, 'E2E_EMAIL and E2E_PASSWORD are required');

  test('delete leftover e2e smoke projects', async ({ page }) => {
    test.setTimeout(120_000);

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

    while (true) {
      const card = page.locator('.metric-card').filter({ hasText: /e2e-smoke-/ }).first();
      if (await card.count() === 0) break;

      await card.locator('button').first().click();
      await card.getByRole('button', { name: '삭제', exact: true }).click();
      await page.getByRole('button', { name: '프로젝트 삭제', exact: true }).last().click();
      await page.waitForTimeout(1500);
      await page.goto('/projects');
    }

    await expect(page.getByText(/e2e-smoke-/)).toHaveCount(0);
  });
});
