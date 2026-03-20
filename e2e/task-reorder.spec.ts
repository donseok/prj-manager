import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, createProject, deleteCurrentProjectFromSettings } from './helpers';

const TEST_PROJECT = `E2E-Reorder-${Date.now()}`;
let projectId: string;

async function addPhase(page: Page, name: string) {
  await page.locator('[data-testid="add-phase-button"]').click();
  // The newly added phase should appear with an editable name cell
  // Find the last phase row and set its name
  const rows = page.locator('tr[data-testid^="wbs-row-"]');
  const lastRow = rows.last();
  await lastRow.waitFor({ state: 'visible', timeout: 5000 });
  // Click on the name cell to start editing
  const nameCell = lastRow.locator('td').nth(1);
  await nameCell.dblclick();
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
  // Brief wait for state to settle
  await page.waitForTimeout(300);
}

function getPhaseNames(page: Page) {
  return page
    .locator('tr[data-testid^="wbs-row-"] td:nth-child(2)')
    .allInnerTexts();
}

test.describe('WBS 작업 순서 변경', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    projectId = await createProject(page, TEST_PROJECT);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await deleteCurrentProjectFromSettings(page, TEST_PROJECT, projectId);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/projects/${projectId}/wbs`);
    await page.waitForSelector('tr[data-testid^="wbs-row-"]', { timeout: 10000 }).catch(() => {
      // No rows yet — that's fine for setup
    });
  });

  test('컨텍스트 메뉴를 통한 위/아래 이동', async ({ page }) => {
    // Add 3 phases
    await addPhase(page, 'Phase A');
    await addPhase(page, 'Phase B');
    await addPhase(page, 'Phase C');

    const rows = page.locator('tr[data-testid^="wbs-row-"]');
    await expect(rows).toHaveCount(3, { timeout: 5000 });

    // Right-click on Phase B (second row) and move down
    await rows.nth(1).click({ button: 'right' });
    await page.getByText('아래로 이동').click();
    await page.waitForTimeout(300);

    // Now order should be: A, C, B
    let names = await getPhaseNames(page);
    expect(names[0]).toContain('Phase A');
    expect(names[1]).toContain('Phase C');
    expect(names[2]).toContain('Phase B');

    // Right-click on Phase C (now second) and move up
    await rows.nth(1).click({ button: 'right' });
    await page.getByText('위로 이동').click();
    await page.waitForTimeout(300);

    // Now order should be: C, A, B
    names = await getPhaseNames(page);
    expect(names[0]).toContain('Phase C');
    expect(names[1]).toContain('Phase A');
    expect(names[2]).toContain('Phase B');
  });

  test('첫 번째/마지막 작업의 이동 제한', async ({ page }) => {
    const rows = page.locator('tr[data-testid^="wbs-row-"]');
    await expect(rows).toHaveCount(3, { timeout: 5000 });

    // Right-click on first row — "위로 이동" should be disabled
    await rows.first().click({ button: 'right' });
    const moveUpButton = page.getByText('위로 이동').locator('..');
    await expect(moveUpButton).toBeDisabled();
    await page.keyboard.press('Escape');

    // Right-click on last row — "아래로 이동" should be disabled
    await rows.last().click({ button: 'right' });
    const moveDownButton = page.getByText('아래로 이동').locator('..');
    await expect(moveDownButton).toBeDisabled();
    await page.keyboard.press('Escape');
  });

  test('Ctrl+Arrow 키보드 단축키로 순서 변경', async ({ page }) => {
    const rows = page.locator('tr[data-testid^="wbs-row-"]');
    await expect(rows).toHaveCount(3, { timeout: 5000 });

    // Click on the second row to select it
    await rows.nth(1).click();
    await page.waitForTimeout(200);

    // Ctrl+ArrowDown to move it down
    await page.keyboard.press('Control+ArrowDown');
    await page.waitForTimeout(300);

    let names = await getPhaseNames(page);
    // The task that was second should now be third
    const movedTask = names[2];
    expect(movedTask).toContain('Phase A');

    // Click on the now-last row and press Ctrl+ArrowUp twice to move it to top
    await rows.nth(2).click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+ArrowUp');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+ArrowUp');
    await page.waitForTimeout(300);

    names = await getPhaseNames(page);
    expect(names[0]).toContain('Phase A');
  });
});
