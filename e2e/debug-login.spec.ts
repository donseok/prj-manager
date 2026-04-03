import { test, expect } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test('debug login', async ({ page }) => {
  test.skip(!email || !password, 'E2E_EMAIL and E2E_PASSWORD are required');

  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();

  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);

  await page.screenshot({ path: 'e2e/debug-before-login.png' });

  await page.locator('button[type="submit"]').click();

  // Wait a bit for login to process
  await page.waitForTimeout(5000);

  await page.screenshot({ path: 'e2e/debug-after-login.png' });

  console.log('Current URL:', page.url());
  const bodyText = await page.locator('body').innerText();
  console.log('Body text (first 500 chars):', bodyText.slice(0, 500));
});
