import { expect, test, type Page } from '@playwright/test';

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '테스트 로그인 (관리자)' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '최근 프로젝트' })).toBeVisible();
}

async function readCount(page: Page, testId: string) {
  const raw = (await page.getByTestId(testId).textContent()) ?? '0';
  return Number.parseInt(raw.trim(), 10);
}

test.describe('DK Flow E2E', () => {
  test('로그인 후 핵심 라우트를 탐색할 수 있다', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByText('스마트 계량 프로젝트').first()).toBeVisible();

    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: '프로젝트 탐색' })).toBeVisible();
    await expect(page.getByText('스마트 계량 프로젝트').first()).toBeVisible();
    await expect(page.getByText('동국씨엠 PI').first()).toBeVisible();
    await expect(page.getByText('KG스틸 MES 재구축').first()).toBeVisible();
    await expect(page.getByText('동국씨엠 ERP/MES 재구축').first()).toBeVisible();

    await page.goto('/manual');
    await expect(page.getByRole('heading', { name: /사용자 매뉴얼/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: '시작하기' })).toBeVisible();

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible();
  });

  test('WBS 저장은 대시보드 진행중 작업 지표에 반영된다', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/projects/proj-smart-001');
    const beforeCount = await readCount(page, 'dashboard-in-progress-count');

    await page.goto('/projects/proj-smart-001/wbs');
    await expect(page.getByRole('heading', { name: /WBS/ })).toBeVisible();
    await page.getByTestId('wbs-status-sm-task-2-2-3').selectOption('in_progress');
    await page.getByTestId('wbs-save-button').click();
    await expect(page.getByText(/저장됨$/).first()).toBeVisible();

    await page.goto('/projects/proj-smart-001');
    const afterCount = await readCount(page, 'dashboard-in-progress-count');
    expect(afterCount).toBe(beforeCount + 1);
  });

  test('간트 빠른 편집 저장값은 새로고침 후에도 유지된다', async ({ page }) => {
    await loginAsAdmin(page);

    const outputValue = `E2E 산출물 ${Date.now()}`;

    await page.goto('/projects/proj-smart-001/gantt');
    await expect(page.getByRole('heading', { name: /일정 흐름/ })).toBeVisible();
    await page.getByTestId('gantt-row-sm-task-2-2-2').click();
    await expect(page.getByTestId('gantt-quick-edit')).toBeVisible();
    await page.getByTestId('gantt-edit-output').fill(outputValue);
    await page.getByTestId('gantt-save-button').click();
    await expect(page.getByText(/저장됨$/).first()).toBeVisible();

    await page.reload();
    await page.getByTestId('gantt-row-sm-task-2-2-2').click();
    await expect(page.getByTestId('gantt-edit-output')).toHaveValue(outputValue);
  });

  test('멤버 추가와 삭제가 저장 후 유지된다', async ({ page }) => {
    await loginAsAdmin(page);

    const memberName = `E2E 멤버 ${Date.now()}`;

    await page.goto('/projects/proj-smart-001/members');
    await expect(page.getByRole('heading', { name: '멤버 목록' })).toBeVisible();
    await page.getByTestId('members-add-button').click();
    await page.getByPlaceholder('멤버 이름을 입력하세요').fill(memberName);
    await page.getByTestId('members-confirm-add-button').click();
    await page.getByTestId('members-save-button').click();
    await expect(page.getByText(/저장됨$/).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(memberName)).toBeVisible();

    await page.getByRole('button', { name: `${memberName} 삭제` }).click();
    await page.getByRole('button', { name: '멤버 삭제' }).click();
    await page.getByTestId('members-save-button').click();
    await expect(page.getByText(/저장됨$/).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(memberName)).toHaveCount(0);
  });

  test('설정에서 수동 상태 고정을 켜고 완료 상태를 유지할 수 있다', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/projects/proj-smart-001/settings');
    await expect(page.getByRole('heading', { name: /설정/ })).toBeVisible();

    await page.getByTestId('settings-status-mode-manual').click();
    await expect(page.getByTestId('feedback-notice')).toContainText('수동 상태 고정 활성화');

    await page.getByTestId('settings-project-status-completed').click();
    await expect(page.getByTestId('feedback-notice')).toContainText('프로젝트 상태 변경');

    await page.reload();
    await expect(page.getByTestId('settings-project-status-completed')).toContainText('현재 상태');
  });

  test('프로젝트를 생성한 뒤 설정에서 삭제할 수 있다', async ({ page }) => {
    await loginAsAdmin(page);

    const projectName = `E2E 프로젝트 ${Date.now()}`;

    await page.goto('/projects');
    await page.getByTestId('projects-open-create-button').click();
    await page.getByTestId('projects-create-name').fill(projectName);
    await page.getByTestId('projects-create-description').fill('E2E 생성 및 삭제 검증용 프로젝트');
    await page.getByTestId('projects-create-submit').click();

    await expect(page).toHaveURL(/\/projects\/.+$/);
    await expect(page.getByText(projectName).first()).toBeVisible();

    await page.goto(`${new URL(page.url()).pathname}/settings`);
    await page.getByTestId('settings-delete-project-button').click();
    await page.getByRole('button', { name: '프로젝트 삭제' }).click();

    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByText(projectName)).toHaveCount(0);
  });
});
